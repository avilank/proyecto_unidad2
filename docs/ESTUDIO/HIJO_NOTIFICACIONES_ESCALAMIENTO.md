# Notificaciones, Alertas y Escalamiento por SLA

Documentación técnica del subsistema de notificaciones de PredictMaint: cómo se
disparan las alertas al técnico asignado, cómo las reglas por nivel de riesgo
deciden destinatario y canal, cómo se realiza el envío real (webhook a n8n y/o
SMTP), el contenido del mensaje, la integración con fallos repetitivos, el
escalamiento por SLA y el registro de mensajes enviados.

Todas las rutas son relativas a `predictmaint-api/src`.

---

## 1. Cadena de disparo: `ORDER_CREATED` → listener → `notifyTechnicianAssignment`

Cuando se crea una orden con un técnico asignado, otro módulo emite el evento
`order.created`. El payload está definido en `common/events/order.events.ts`:

```ts
export const ORDER_CREATED_EVENT = 'order.created';

export interface OrderCreatedPayload {
  orderId: string;
  tecnicoId?: number;
  maquinaId: string;
  nivelRiesgo: string;
}
```

El listener `notifications/order-notification.listener.ts` escucha el evento de
forma asíncrona. Si la orden no tiene técnico, omite la notificación; de lo
contrario delega en el servicio. Los errores se capturan para no romper el flujo
de creación de orden:

```ts
@OnEvent(ORDER_CREATED_EVENT, { async: true })
async handleOrderCreated(payload: OrderCreatedPayload): Promise<void> {
  if (!payload.tecnicoId) {
    this.logger.debug(`Orden ${payload.orderId} sin técnico asignado — notificación omitida`);
    return;
  }
  try {
    await this.notificationsService.notifyTechnicianAssignment(payload);
  } catch (err) {
    this.logger.error(`Error al notificar orden ${payload.orderId}: ...`);
  }
}
```

El método `notifyTechnicianAssignment` (`notifications/notifications.service.ts`)
es el punto central de la lógica. Pasos resumidos:

1. Carga el contexto de la orden (`loadOrderContext`): máquina, análisis de
   fallo, lectura de sensores, clasificaciones y tipo de fallo.
2. Carga el técnico con su usuario asociado (correo / teléfono / preferencias).
3. Determina el nivel de riesgo (payload → análisis → `MEDIUM` por defecto).
4. Busca la **regla de notificación** del nivel y resuelve destinatario y canal.
5. Construye el contexto del mensaje (métricas, historial, fallo repetitivo,
   tiempo límite, plan RAG).
6. Despacha al técnico (`dispatchToTechnician`) y/o a supervisores
   (`notifySupervisorsForAlert`) según corresponda.

> El endpoint manual `POST /notifications/send`
> (`notifications/notifications.controller.ts`) reutiliza la misma cadena:
> recupera la orden por código y llama a `notifyTechnicianAssignment`.

---

## 2. Reglas por nivel: destinatario y canal

La tabla `regla_notificacion` (`database/models/regla-notificacion.model.ts`)
define, por cada nivel de riesgo, **a quién** se notifica y **por qué canal**:

```ts
@Table({ tableName: 'regla_notificacion', ... })
export class ReglaNotificacion extends Model {
  nivel!: string;   // LOW | MEDIUM | HIGH | CRITICAL (único)
  recibe!: string;  // texto: "Nadie" | "Técnico" | "Técnico + Supervisor" | "Supervisor"
  canal!: string;   // texto: "WhatsApp" | "Email" | "WhatsApp + Email" | "Sin notificación"
}
```

Estas reglas se administran desde el frontend en
**Configuración → Alertas → Reglas de notificación**, y se listan vía
`GET /notifications` (`findAll` devuelve `nivel`, `recibe`, `canal`).

### 2.1 Destinatario (`recipientsFromRecibe`)

El campo `recibe` es texto libre interpretado por coincidencia de palabras clave
(`notifications.service.ts`):

```ts
private recipientsFromRecibe(recibe?: string): { tecnico: boolean; supervisor: boolean } {
  const r = (recibe ?? '').toLowerCase();
  return {
    tecnico: r.includes('técnico') || r.includes('tecnico'),
    supervisor: r.includes('supervisor') || r.includes('jefe'),
  };
}
```

Resultado por valor configurado:

| `recibe` configurado    | técnico | supervisor | Efecto |
|-------------------------|:-------:|:----------:|--------|
| Nadie                   | no      | no         | Notificación **omitida** por completo. |
| Técnico                 | sí      | no         | Solo `dispatchToTechnician`. |
| Técnico + Supervisor    | sí      | sí         | Técnico **y** supervisores. |
| Supervisor / Jefe       | no      | sí         | Solo `notifySupervisorsForAlert`. |

Si ni técnico ni supervisor quedan activos, se omite y se registra en debug.

### 2.2 Canal (`canal`)

El canal también se interpreta por palabras clave:

```ts
const canalRegla = regla?.canal?.toLowerCase() ?? '';
const allowWhatsapp = canalRegla.includes('whatsapp') || canalRegla.includes('whats');
const allowEmail = canalRegla.includes('email');
if (!allowWhatsapp && !allowEmail) {
  // canal "Sin notificación" — omitido
  return;
}
```

- `WhatsApp` → habilita `allowWhatsapp`.
- `Email` → habilita `allowEmail`.
- `WhatsApp + Email` → ambos.
- `Sin notificación` (no contiene ninguna palabra) → se omite.

`allowWhatsapp` / `allowEmail` actúan como **interruptores generales** de la
regla; el envío real adicionalmente respeta las preferencias del técnico y la
disponibilidad de datos (teléfono/correo) y de SMTP.

### 2.3 Preferencias del técnico (`enviarWssp` / `enviarCorreo`)

En `dispatchToTechnician` el canal final combina la regla con las preferencias
individuales del técnico:

```ts
const sendWhatsapp = tecnico.enviarWssp !== false && allowWhatsapp;
const sendEmailSmtp = smtpReady && allowEmail && Boolean(tecnico.usuario?.correo?.trim());
const sendEmailWebhook =
  !smtpReady && allowEmail &&
  (tecnico.enviarCorreo === true || nivel === NivelRiesgo.CRITICAL);
```

- `enviarWssp`: por defecto activo (solo se desactiva si es explícitamente
  `false`). Combinado con `allowWhatsapp` decide el WhatsApp.
- `enviarCorreo`: cuando **no hay SMTP**, el correo por webhook solo se manda si
  el técnico lo activó, **salvo** que el nivel sea `CRITICAL` (en cuyo caso se
  fuerza el correo aunque el técnico lo tuviera apagado).
- Si el técnico no tiene correo en su usuario, se aborta el despacho (se exige
  correo como dato base). Si falta teléfono, solo se omite el WhatsApp.

### 2.4 Nivel `LOW`

El nivel `LOW` no tiene un tratamiento especial de *canal/destinatario* en sí
(depende de su fila en `regla_notificacion`), pero **no tiene SLA de inicio**:
en `getTiemposAtencion` el tiempo límite para `LOW` es `null`, por lo que el
mensaje no muestra "⏱️ Iniciar antes de…" y el escalamiento por SLA nunca
aplica a órdenes `LOW` (ver sección 6). Lo habitual es configurar `LOW` con un
canal de bajo ruido (p. ej. solo Email) o incluso "Sin notificación".

---

## 3. Envío real: webhook a n8n y/o SMTP

Existen dos vías de envío. La elección depende de si SMTP está configurado.

### 3.1 SMTP (`integrations/email/smtp-email.service.ts`)

Se inicializa con `nodemailer` a partir de variables de entorno:

```ts
const host = this.config.get('email.host'); // MAIL_HOST
const user = this.config.get('email.user'); // MAIL_USER
const pass = this.config.get('email.pass'); // MAIL_PASS
if (!host || !user || !pass) { /* SMTP no configurado, no se envían correos */ }
```

`isConfigured()` devuelve `true` solo si se creó el `transporter`. El correo de
asignación al técnico usa una plantilla dedicada
(`assignment-notification.template.ts`) con asunto, HTML y texto plano.

### 3.2 Webhook a n8n (`notifications/webhook-notifier.service.ts`)

La URL viene de `SEND_EMAIL_WEBHOOK` (`config/notifications.config.ts` →
`notifications.sendEmailWebhook`). Si no está configurada, lanza error. El envío
es un `POST` `multipart/form-data` con los siguientes campos:

| Campo             | Cuándo se envía | Contenido |
|-------------------|-----------------|-----------|
| `email`           | siempre         | Correo destino. |
| `subject`         | siempre         | Asunto. |
| `title`           | siempre         | Título (p. ej. `Alerta de mantenimiento — <máquina>`). |
| `phone`           | si hay WhatsApp | Teléfono destino. |
| `whatsappSummary` | si hay WhatsApp | Resumen de texto para WhatsApp. |
| `emailBody`       | si hay correo   | HTML del cuerpo. También se duplica en `message`. |
| `includeEmail`    | siempre         | `'true'` si hay `emailBody`; `'false'` en caso contrario. |
| `archivo_pdf`     | si hay correo   | `Blob` HTML adjunto (`$binary.archivo_pdf` en n8n), nombre `notificacion.html` por defecto. |

```ts
const htmlBody = payload.emailBody?.trim() ?? '';
if (htmlBody) {
  form.append('emailBody', htmlBody);
  form.append('message', htmlBody);
  form.append('includeEmail', 'true');
  form.append('archivo_pdf', new Blob([htmlBody], { type: 'text/html;charset=utf-8' }), filename);
} else {
  form.append('includeEmail', 'false');
}
```

n8n se encarga de entregar el WhatsApp (por `phone` + `whatsappSummary`) y, si
`includeEmail === 'true'`, también el correo.

### 3.3 Cuándo va por cada vía (en `dispatchToTechnician`)

- **WhatsApp** → siempre por **webhook n8n** (campos `phone` + `whatsappSummary`).
- **Email**:
  - Si **SMTP está configurado** (`smtpReady`) → el correo se envía por **SMTP**
    directamente (`smtpEmail.send`), con la plantilla de asignación.
  - Si **SMTP no está configurado** → el correo se manda por **webhook n8n**
    (`emailBody` en el form-data), sujeto a `enviarCorreo` o nivel `CRITICAL`.

```ts
if (sendEmailSmtp) {
  await this.smtpEmail.send({ to: email, subject, html: emailBody, text: emailText });
}
if (needsPhone || sendEmailWebhook) {
  await this.webhookNotifier.send({
    email, subject, title: `Alerta de mantenimiento — ${maquinaCodigo}`,
    phone: needsPhone ? phone : undefined,
    whatsappSummary: needsPhone ? whatsappSummary : undefined,
    emailBody: sendEmailWebhook ? emailBody : undefined,
  });
}
```

Es decir, una notificación puede generar **una llamada SMTP** (correo) **y/o una
llamada al webhook** (WhatsApp y/o correo de respaldo). Para supervisores
(`notifySupervisorsForAlert`) la lógica es análoga: SMTP para el correo si está
listo, y webhook para WhatsApp o como respaldo de correo.

> Nota: el escalamiento (`notifyEscalation`, sección 6) siempre usa el **webhook
> n8n**, no SMTP.

---

## 4. Contenido del mensaje (`notifications/alert-message.builder.ts`)

`buildAlertMessageInput` arma un objeto `AlertMessageInput` con: máquina, orden,
nivel, tipo de fallo, lectura, acción RAG principal, plan escalado, ocurrencias
en la ventana, historial de intervenciones, enlace al análisis, tiempo límite de
inicio y umbral de repetitivo.

### 4.1 WhatsApp (`buildWhatsappSummary`)

Texto con formato Markdown de WhatsApp. Estructura:

- Encabezado con emoji por riesgo (`🔴` HIGH/CRITICAL, `🟠` MEDIUM, `🟡` resto).
- **Banner de fallo repetitivo** (si aplica, ver 4.3).
- Fallo (`código — nombre`), acción recomendada (si hay RAG).
- **Métricas resaltadas por tipo de fallo** (ver 4.4).
- Orden, **tiempo límite para iniciar** (si hay), intervenciones anteriores.
- Enlace al panel y, al final, el plan escalado (`📘 …`) si existe.

### 4.2 Email (`buildEmailHtml` / `buildEmailSubject`)

HTML con los mismos datos: encabezado `ALERTA — <máquina>`, párrafo de
repetitivo en naranja si aplica, fallo, acción, lista de métricas (las
resaltadas en rojo), orden, tiempo límite, historial y enlace. El asunto es
`ALERTA <nivel> — <máquina> — <orden>`.

> El correo de **asignación al técnico vía SMTP** usa una plantilla distinta
> (`assignment-notification.template.ts`), que añade el nombre del técnico.

### 4.3 Banner de fallo repetitivo (umbral configurable)

Tanto en WhatsApp como en Email se muestra si
`ocurrenciasVentana >= umbralRepetitivo`. El umbral por defecto del builder es
`UMBRAL_REPETITIVO = 3`, pero el servicio inyecta el **umbral configurable** (ver
sección 5). En WhatsApp:

```ts
const ordinal = input.ocurrenciasVentana === 3 ? '3er' : `${input.ocurrenciasVentana}º`;
lines.push(`🟠 *FALLO REPETITIVO — ${ordinal} ${input.tipoFalloCodigo} en ${input.ventanaDias} días*`);
```

La ventana por defecto es de 7 días (`VENTANA_REPETITIVO_DIAS`).

### 4.4 Métricas resaltadas por tipo de fallo (`buildFaultMetrics`)

Cada tipo de fallo resalta (`highlight`, en rojo) las métricas críticas según su
umbral:

| Tipo  | Métrica(s)                        | Umbral mostrado     | Resalta si |
|-------|-----------------------------------|---------------------|------------|
| HDF   | Diferencia térmica; RPM           | 8.6K; 1,380         | ΔT > 8.6K; RPM < 1380 |
| PWF   | Potencia                          | 3,500 – 9,000 W     | < 3500 o > 9000 W |
| TWF   | Desgaste herramienta              | 200                 | ≥ 200 |
| OSF   | Torque × desgaste                 | 5,000               | > 5000 |
| otro  | RPM                               | —                   | (no resalta) |

### 4.5 Tiempo límite para iniciar

Proviene de `getTiemposAtencion()[nivel]`. Es el SLA en minutos para iniciar la
orden. Si es `null` (p. ej. `LOW`), no se muestra. Aparece como
`⏱️ Iniciar antes de: <n> min`.

---

## 5. Integración con fallos repetitivos

La configuración vive en **Configuración → Fallos Repetitivos** y se lee con
`configCatalog.getFallosRepetitivosConfig()`
(`config-catalog/config-catalog.service.ts`). Estructura y valores por defecto:

```ts
umbrales: {
  marcar:    { veces: 2, dias: 7 },
  notificar: { veces: 3, dias: 7 },
  rag:       { veces: 2, dias: 7 },
  ventanaDias: 7,
},
notificaciones: { mark: true, supervisor: true, rag: true },
```

En `notifyTechnicianAssignment` se cuentan las ocurrencias del mismo tipo de
fallo en la misma máquina dentro de la ventana (`countOccurrencesInWindow`) y se
comparan contra cada umbral:

```ts
const alcanzaMarcar    = ocurrenciasVentana >= repCfg.umbrales.marcar.veces;
const alcanzaNotificar = ocurrenciasVentana >= repCfg.umbrales.notificar.veces;
const alcanzaRag       = ocurrenciasVentana >= repCfg.umbrales.rag.veces;
const esRepetitivo     = alcanzaMarcar;
```

Efecto de cada **toggle**:

- **`mark`** (marcar repetitivo): si está activo, `umbralRepetitivo` se fija en
  `umbrales.marcar.veces` y el **banner de repetitivo** se muestra al alcanzarlo.
  Si está apagado, `umbralRepetitivo = Number.MAX_SAFE_INTEGER`, de modo que el
  banner nunca aparece. Además, `esRepetitivo` marca el `tipoEnvio` del log como
  `repetitivo` (sección 7).

  ```ts
  const umbralRepetitivo = repCfg.notificaciones.mark
    ? repCfg.umbrales.marcar.veces
    : Number.MAX_SAFE_INTEGER;
  ```

- **`supervisor`** (notificar supervisor): si está activo y se alcanza el umbral
  `notificar`, se **fuerza** `recipients.supervisor = true`, agregando a los
  supervisores como destinatarios aunque la regla del nivel no los incluyera.

  ```ts
  if (alcanzaNotificar && repCfg.notificaciones.supervisor) {
    recipients.supervisor = true;
  }
  ```

- **`rag`** (escalar plan RAG): si está activo y se alcanza el umbral `rag`, se
  anexa al mensaje la **acción escalada** del tipo de fallo
  (`getEscalationActionText`). Si el toggle está apagado, se elimina cualquier
  plan escalado (`planEscalado = null`).

  ```ts
  if (alcanzaRag && repCfg.notificaciones.rag) {
    const accionEscalada = await this.configCatalog.getEscalationActionText(tipoFalloCodigo);
    if (accionEscalada) messageInput.planEscalado = `Plan escalado por reincidencia — ${accionEscalada}`;
  } else if (!repCfg.notificaciones.rag) {
    messageInput.planEscalado = null;
  }
  ```

En resumen, los umbrales y toggles afectan **el contenido del mensaje** (banner y
plan escalado) y **el destinatario** (alta del supervisor).

---

## 6. Escalamiento por SLA (`jobs/escalation.service.ts`)

### 6.1 Cron de detección

`EscalationService.escalateOverdueOrders` corre cada minuto (segundo 30):

```ts
@Cron('30 * * * * *')
async escalateOverdueOrders(): Promise<void> { ... }
```

Busca órdenes en estado **PENDIENTE** que **ya tienen técnico asignado** (es
decir, asignadas pero no iniciadas: el técnico "no respondió"):

```ts
const pendientes = await this.ordenModel.findAll({
  where: { estado: EstadoOrden.PENDIENTE, idTecnico: { [Op.ne]: null } },
  include: [ { model: Maquina }, { model: AnalisisFallo, attributes: ['nivelRiesgo'] } ],
});
```

Para cada orden calcula el SLA por nivel (`getTiemposAtencion()[nivel]`) y los
minutos transcurridos desde `fechaCreacion`. Si el nivel no tiene SLA (p. ej.
`LOW`, SLA `null`) o aún no se supera, la salta:

```ts
const sla = tiempos[nivel];
if (sla == null) continue;            // nivel sin SLA (LOW)
const minutosSinAtender = Math.floor((now - new Date(orden.fechaCreacion).getTime()) / 60_000);
if (minutosSinAtender < sla) continue;
```

### 6.2 Idempotencia

Antes de escalar, verifica si ya existe un evento de etapa `escalado` para esa
orden en `evento_orden`. Si existe, no vuelve a escalar:

```ts
const yaEscalada = await this.eventoModel.count({
  where: { idOrden: orden.idOrden, etapa: ESCALADO_ETAPA }, // 'escalado'
});
if (yaEscalada > 0) continue;
```

Si no, registra el evento `escalado` (actor `sistema`, con la descripción del SLA
superado) y **emite** `ORDER_ESCALATED_EVENT`. El evento persistido es lo que
garantiza que cada orden se escale **una sola vez**.

### 6.3 Evento `ORDER_ESCALATED` y notificación detallada

Payload (`common/events/order.events.ts`):

```ts
export interface OrderEscalatedPayload {
  orderId: string;
  maquinaId: string;
  nivelRiesgo: string;
  minutosSinAtender: number;
  slaMinutos: number;
}
```

El listener `notifications/escalation-notification.listener.ts` escucha el evento
y llama a `notifyEscalation` (`notifications.service.ts`), que envía un mensaje
**detallado a supervisores y jefes de planta** (usuarios activos con rol
`supervisor` o `jefe_planta`). El mensaje incluye:

- Motivo: "el técnico asignado no inició la orden dentro del tiempo límite".
- Orden, máquina, fallo (`código — nombre`), nivel de riesgo.
- **Técnico que no inició** la orden (nombre y teléfono) — marcado con ❌.
- Fecha de detección y **tiempos**: `minutosSinAtender` vs `slaMinutos`.
- Acción requerida (reasignar o intervenir) y enlace a la orden en el panel.

Se construye tanto el resumen WhatsApp (con `🛑 *ESCALAMIENTO*`) como el HTML, y
se entrega **siempre por el webhook n8n** (`webhookNotifier.send`), con `phone` y
`whatsappSummary` si el supervisor tiene teléfono y `emailBody` si tiene correo.
Cada envío exitoso registra una fila en `mensaje_enviado` con
`motivo = ESCALAMIENTO <código>` y `tipoEnvio = alerta_critica`.

---

## 7. Tabla `mensaje_enviado` (log) y estados

### 7.1 Modelo (`database/models/mensaje-enviado.model.ts`)

| Columna     | Tipo / enum         | Notas |
|-------------|---------------------|-------|
| `id`        | BIGINT (PK)         | Autoincremental. |
| `tecnicoId` | INT (FK Técnico)    | `null` cuando el destinatario es supervisor / escalamiento. |
| `idOrden`   | BIGINT (FK Orden)   | Orden asociada. |
| `maquinas`  | STRING              | Código de máquina. |
| `motivo`    | STRING              | Código de tipo de fallo, o `ESCALAMIENTO <código>`. |
| `canal`     | enum `Canal`        | `whatsapp` · `email` · `whatsapp_email`. |
| `tipoEnvio` | enum `TipoEnvio`    | `alerta_critica` · `repetitivo` (e `inicio_turno` / `mitad_turno` / `fin_turno`). |
| `estado`    | enum `EstadoMensaje`| `entregado` · `pendiente` · `fallido`. |
| `enviadoEn` | DATE                | Marca temporal de envío. |

El canal registrado se deriva con `resolveCanal(sendWhatsapp, sendEmail)`:
`whatsapp_email` si ambos, `email` si solo correo, `whatsapp` en otro caso.

En `dispatchToTechnician`, un envío exitoso crea la fila con
`estado = ENTREGADO` (y `tipoEnvio = REPETITIVO` si `esRepetitivo`, si no
`ALERTA_CRITICA`). Si la operación lanza error, se registra una fila con
`estado = FALLIDO` y se re-lanza el error.

### 7.2 Endpoint `GET /notifications/log`

`notifications/notifications.controller.ts` expone el log paginado (filtrable por
`tecnicoId`). `NotificationsService.getLog` devuelve, por fila: `id`,
`tecnicoId`, `tecnico` (nombre), `ordenId` (código de orden), `maquinas`,
`motivo`, `canal`, `tipoEnvio`, `estado` y `enviadoEn`, ordenado por
`enviadoEn DESC`.

### 7.3 Estados de alerta (módulo `alerts`)

Independiente del log de mensajes, las **alertas** tienen su propio ciclo de
estado (`EstadoAlerta`): `analizando`, `clasificando`, `pendiente`,
`en_progreso`, `finalizado`. Gestionado por `alerts/alerts.service.ts` y
`alerts/alerts.controller.ts`:

- `GET /alerts` — listado paginado (filtros: `estado`, `nivel`, `maquinaId`).
- `GET /alerts/active` — alertas en `analizando`, `clasificando`, `pendiente` o
  `en_progreso`.
- `GET /alerts/:id` — detalle de una alerta.
- `PATCH /alerts/:id/status` — actualiza el estado de la alerta.

---

## Referencias de configuración (variables de entorno)

| Variable             | Uso |
|----------------------|-----|
| `SEND_EMAIL_WEBHOOK` | URL del webhook de n8n (WhatsApp y correo de respaldo). |
| `FRONTEND_URL`       | Base para los enlaces a órdenes en el panel. |
| `MAIL_HOST` / `MAIL_USER` / `MAIL_PASS` | SMTP (nodemailer). Si faltan, el correo va por webhook. |
| `MAIL_PORT` / `MAIL_SECURE` | Puerto (587 por defecto) y TLS del SMTP. |

## Archivos clave

- `notifications/notifications.service.ts` — orquestación, reglas, despacho, escalamiento.
- `notifications/alert-message.builder.ts` — contenido WhatsApp/Email, métricas, banner.
- `notifications/webhook-notifier.service.ts` — envío `multipart/form-data` a n8n.
- `notifications/order-notification.listener.ts` / `escalation-notification.listener.ts` — listeners de eventos.
- `notifications/notifications.controller.ts` — endpoints (`log`, `send`, `next-dispatch`).
- `integrations/email/smtp-email.service.ts` — envío SMTP.
- `jobs/escalation.service.ts` — cron de escalamiento por SLA.
- `alerts/alerts.service.ts` / `alerts.controller.ts` — estados de alerta.
- `database/models/regla-notificacion.model.ts` / `mensaje-enviado.model.ts` — modelos.
- `common/events/order.events.ts` — eventos `order.created` / `order.escalated`.
- `config/notifications.config.ts` — configuración de notificaciones.
- `config-catalog/config-catalog.service.ts` — SLA por nivel y config de fallos repetitivos.
