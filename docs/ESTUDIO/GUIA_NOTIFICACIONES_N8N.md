# Guía — Notificaciones (n8n + WhatsApp + Email)

> Todo lo que necesitas saber sobre cómo PredictMaint envía notificaciones: qué las
> dispara, cómo decide a quién y por qué canal, cómo se conecta con **n8n** (webhook) y
> con **SMTP**, qué campos recibe tu flujo de n8n, y dónde está cada cosa en el código.

---

## 1. Visión general: dos caminos de salida

El sistema puede notificar por **dos canales**, y tiene **dos formas** de mandar el correo:

```
                          ┌─────────────────────────────┐
   Evento interno  ─────▶ │   NotificationsService      │
   (orden creada /        │   decide destinatario+canal │
    escalamiento)         └──────────────┬──────────────┘
                                         │
                 ┌───────────────────────┼───────────────────────┐
                 ▼                       ▼                        ▼
        SMTP directo (nodemailer)   Webhook → n8n            (log en BD)
        solo EMAIL                  WhatsApp + Email         mensaje_enviado
```

- **WhatsApp** → SIEMPRE sale por el **webhook de n8n** (PredictMaint no habla con la API
  de WhatsApp directamente; n8n se encarga).
- **Email** → tiene dos rutas:
  - Si **SMTP está configurado** → el correo se manda **directo** con `nodemailer`.
  - Si **SMTP NO está configurado** → el correo también se manda **por el webhook de n8n**
    (n8n envía el email).

> En resumen: **n8n es el integrador de salida**. Sirve para WhatsApp siempre, y para email
> cuando no hay SMTP propio. Así no acoplas el backend a las APIs de WhatsApp/correo.

---

## 2. Qué dispara una notificación (los 2 eventos)

Las notificaciones no se mandan "a mano": el backend usa **eventos internos**
(EventEmitter2) y unos *listeners* que reaccionan. Hay dos disparadores:

| Evento | Cuándo se emite | Listener | Método que ejecuta |
|---|---|---|---|
| `ORDER_CREATED_EVENT` | Al crear/asignar una orden (pipeline S-1→S-2→S-3, o reintento de asignación) | `order-notification.listener.ts` | `notifyTechnicianAssignment()` |
| `ORDER_ESCALATED_EVENT` | Cuando el job de SLA escala una orden no atendida | `escalation-notification.listener.ts` | `notifyEscalation()` |

Ambos listeners corren en modo `async` y capturan errores (si falla el webhook, no rompe
el pipeline; solo se loguea).

---

## 3. Cómo decide a QUIÉN y por QUÉ canal (reglas configurables)

Esto sale de la tabla **`regla_notificacion`** (editable en **Configuración → Alertas →
Reglas de notificación**). Hay una regla **por nivel de riesgo** con dos campos:

- **`recibe`**: a quién notificar — el texto se interpreta (`recipientsFromRecibe`,
  `notifications.service.ts` líneas 154-164):
  - contiene "técnico" → notifica al **técnico** asignado.
  - contiene "supervisor"/"jefe" → notifica a los **supervisores**.
  - "Nadie" / vacío → **no se notifica** ese nivel.
- **`canal`**: por dónde — (líneas 186-192):
  - contiene "whatsapp" → habilita WhatsApp.
  - contiene "email" → habilita Email.
  - "Sin notificación" → se omite.

Además, la configuración de **Fallos Repetitivos** modifica el envío (líneas 219-259):
- Si una máquina supera el umbral de **notificar** → se agrega al **supervisor** como destinatario.
- Si supera el umbral de **escalar plan RAG** → se anexa al mensaje el **plan escalado** (acción de escalamiento del tipo de fallo).
- El toggle de **marcar repetitivo** controla si aparece el aviso de reincidencia.

---

## 4. La pieza de n8n: el `WebhookNotifierService`

Archivo: `predictmaint-api/src/notifications/webhook-notifier.service.ts`.

Hace un `POST` con **`multipart/form-data`** (un `FormData`) a la URL del webhook
(`SEND_EMAIL_WEBHOOK`). **Estos son los campos que tu flujo de n8n recibe:**

| Campo (form-data) | Tipo | Siempre presente | Para qué sirve |
|---|---|---|---|
| `email` | texto | sí | Correo destino |
| `subject` | texto | sí | Asunto del correo |
| `title` | texto | sí | Título corto (encabezado) |
| `phone` | texto | solo si hay WhatsApp | Número destino de WhatsApp |
| `whatsappSummary` | texto | solo si hay WhatsApp | **Cuerpo del mensaje de WhatsApp** (ya formateado con `*negritas*`, saltos de línea, enlace) |
| `emailBody` | texto (HTML) | solo si el email va por webhook | Cuerpo HTML del correo |
| `message` | texto (HTML) | solo si hay `emailBody` | Copia de `emailBody` (alias) |
| `includeEmail` | `'true'`/`'false'` | sí | Le dice a n8n si debe enviar correo o no |
| `archivo_pdf` | binario (Blob HTML) | solo si hay `emailBody` | Adjunto con el HTML (nombre por defecto `notificacion.html`); en n8n se accede como `$binary.archivo_pdf` |

> **Para tu flujo de n8n:** lee `phone` + `whatsappSummary` para el nodo de WhatsApp, y
> usa `includeEmail` para decidir la rama de correo (`email`, `subject`, `emailBody`/`message`,
> y opcionalmente el adjunto `archivo_pdf`). Si `includeEmail` es `'false'`, no mandes correo.

Si el webhook responde con error HTTP, el service lanza excepción y registra el fallo
(líneas 67-71).

---

## 5. La otra ruta de email: SMTP directo (`SmtpEmailService`)

Archivo: `predictmaint-api/src/integrations/email/smtp-email.service.ts`.

- Usa **`nodemailer`**. Al arrancar (`bootstrap`, líneas 21-42) intenta crear el transporte
  con host/user/pass; si faltan, queda **deshabilitado** (`isConfigured() === false`) y avisa
  por log.
- `isConfigured()` es lo que el `NotificationsService` consulta para decidir: **¿mando el
  email directo (SMTP) o lo delego a n8n?**
- El correo de asignación al técnico usa una plantilla HTML dedicada
  (`integrations/email/templates/assignment-notification.template.ts`).

---

## 6. Reglas de envío por canal (la lógica fina)

En `dispatchToTechnician` (líneas 287-381) y `notifySupervisorsForAlert` (líneas 383-448):

- **WhatsApp** se envía si el canal lo permite **y** el técnico tiene `enviarWssp != false`
  **y** tiene teléfono. Siempre vía webhook.
- **Email SMTP**: si SMTP está listo, el canal permite email y hay correo → se manda directo.
- **Email por webhook**: solo si **SMTP no está listo**, el canal permite email, y
  (`enviarCorreo === true` o el nivel es `CRITICAL`).
- El **escalamiento** (`notifyEscalation`, líneas 451-559) **siempre** usa el webhook
  (WhatsApp + email a supervisores), con un mensaje detallado: técnico que no inició, motivo,
  fallo, nivel, detectada y "Sin atención: X min · límite Y min".

---

## 7. Registro de cada envío (auditoría)

Cada notificación (exitosa o fallida) se guarda en la tabla **`mensaje_enviado`** con:
técnico, orden, máquina, motivo, **canal** (`whatsapp` / `email` / `whatsapp_email`),
**tipo de envío** (`alerta_critica` / `repetitivo`), **estado** (`entregado` / `fallido`)
y fecha. Esto alimenta el **Log de envíos** de la vista de Analítica.

---

## 8. Variables de entorno (`.env` del backend)

| Variable | Para qué | Dónde se lee |
|---|---|---|
| `SEND_EMAIL_WEBHOOK` | **URL del webhook de n8n** (obligatoria para WhatsApp/email vía n8n) | `config/notifications.config.ts` |
| `FRONTEND_URL` | Base para los enlaces "Abrir orden" del mensaje | `config/notifications.config.ts` |
| `WHATSAPP_TOKEN` | Token de WhatsApp (si tu flujo lo requiere) | `config/notifications.config.ts` |
| `MAIL_HOST` / `MAIL_USER` / `MAIL_PASS` | Credenciales SMTP (si quieres email directo) | `config/email.config.ts` → `SmtpEmailService` |
| `MAIL_PORT` / `MAIL_SECURE` / `MAIL_FROM*` | Puerto, TLS y remitente del SMTP | `config/email.config.ts` |

> ⚠️ **Inconsistencia a tener en cuenta:** `config/notifications.config.ts` también lee
> `SMTP_HOST/SMTP_USER/SMTP_PASS`, pero el `SmtpEmailService` realmente usa los valores
> `email.*` que vienen de `config/email.config.ts` (prefijo **`MAIL_`**). Para que el SMTP
> directo funcione, define las variables **`MAIL_*`**. (El script `scripts/test-smtp.js`
> también usa `MAIL_*`.) Conviene unificar esto a un solo prefijo.

---

## 9. Endpoints relacionados (`notifications.controller.ts`)

| Método | Ruta | Qué hace |
|---|---|---|
| `GET` | `/notifications/log` | Log paginado de mensajes enviados (filtrable por `tecnicoId`) |
| `POST` | `/notifications/send` | Reenvía la notificación de asignación de una orden a su técnico |
| `GET` | `/notifications/next-dispatch` | Próximo envío programado (hoy devuelve `null`) |

---

## 10. Tabla de referencia — dónde está cada cosa

| Pieza | Archivo | Líneas clave |
|---|---|---|
| Servicio principal (orquesta todo) | `notifications/notifications.service.ts` | `notifyTechnicianAssignment` 166-285, `notifyEscalation` 451-559 |
| Interpretar destinatario configurable | `notifications/notifications.service.ts` | 154-164 |
| Lógica de canales (técnico) | `notifications/notifications.service.ts` | 287-381 |
| Lógica de canales (supervisor) | `notifications/notifications.service.ts` | 383-448 |
| **Cliente del webhook n8n** | `notifications/webhook-notifier.service.ts` | `send` 26-76 (campos form 34-60) |
| Email SMTP (nodemailer) | `integrations/email/smtp-email.service.ts` | `bootstrap` 21-42, `send` 48-69 |
| Plantilla email de asignación | `integrations/email/templates/assignment-notification.template.ts` | todo |
| Builder de mensajes (WhatsApp/email) | `notifications/alert-message.builder.ts` | todo |
| Listener orden creada → notifica | `notifications/order-notification.listener.ts` | 12-28 |
| Listener escalamiento → notifica | `notifications/escalation-notification.listener.ts` | 15-25 |
| Endpoints | `notifications/notifications.controller.ts` | todo |
| Config (webhook, SMTP, frontend) | `config/notifications.config.ts` | todo |

---

## 11. Para la exposición / preguntas del docente

- **"¿Por qué n8n y no llamar directo a WhatsApp?"** → Para desacoplar: el backend solo
  manda un `POST` con los datos; n8n orquesta los nodos de WhatsApp/correo. Si cambia el
  proveedor de mensajería, **se cambia el flujo en n8n, no el código**.
- **"¿Qué pasa si el webhook está caído?"** → El envío lanza error, se registra en
  `mensaje_enviado` como `fallido` y se loguea, pero **no rompe** el pipeline (los listeners
  capturan el error).
- **"¿Las notificaciones son configurables?"** → Sí: por nivel de riesgo se define quién
  recibe y por qué canal (tabla `regla_notificacion`), y los umbrales de fallos repetitivos
  pueden sumar al supervisor y anexar el plan escalado.
- **"¿Cómo sé que se enviaron?"** → En la vista de Analítica, el **Log de envíos**
  (`/notifications/log`).

---

### Documentos relacionados
- `HIJO_NOTIFICACIONES_ESCALAMIENTO.md` — detalle profundo de notificaciones y escalamiento.
- `DOCUMENTACION_FLUJO_MONITOREO.md` — dónde se emiten los eventos.
- `PROPUESTA_ALERTS_SETTINGS.md` — la configuración de alertas y reglas.
- `GUION_EXPOSICION.md` — guión para la exposición.
