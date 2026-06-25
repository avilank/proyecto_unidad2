# Propuesta — Hacer funcional la pestaña "Alertas" (Configuración)

**Archivo objetivo:** `predictmaint-web/src/components/dashboard/settings/alerts-settings-tab.tsx`
**Estado:** ✅ **IMPLEMENTADO** (Fase 1 + reglas de notificación editables, sin editar modelos). Ver §9.

---

## 1. Diagnóstico — estado actual

La pestaña **Alertas** es hoy **100 % estática y decorativa**. Tiene 4 paneles:

| Panel | Estado actual | Problema |
|---|---|---|
| **Niveles de riesgo (umbrales)** | `useState` local con `defaultThreshold` hardcodeado | No carga ni guarda nada; al salir de la pestaña se pierde |
| **Reglas de notificación automática** | Array constante `NOTIFICATION_RULES`; `onClick={() => undefined}` | No refleja la BD ni permite editar |
| **Tiempo límite de atención por nivel** | Array constante `ATTENTION_LIMITS` (2h / 30m / 15m) | Valores fijos en el código |
| **Plantilla WhatsApp** | String constante `WHATSAPP_TEMPLATE` | Decorativa; el mensaje real lo arma otro código |

Además, en `settings-view.tsx` el botón "Guardar configuración de alertas" es **falso**:
```ts
} else if (tab === 'alerts' || tab === 'recurrent') {
  await new Promise((r) => setTimeout(r, 400)); // ← no persiste nada
}
```

La pestaña tampoco recibe props (las otras tabs sí: `MlModelsSettingsTab` y `MessageDispatchSettingsTab` reciben estado controlado + callbacks).

---

## 2. Qué soporta YA el backend (sin tocar nada)

El backend **ya expone** casi todo lo que esta pestaña necesita, vía `ConfigController`:

**`GET /config`** y **`PATCH /config`** (`config-catalog.service.ts`) manejan estos campos en la tabla `configuracion_alertas`:

| Campo BD (`configuracion_alertas`) | Clave en API | Hoy lo usa |
|---|---|---|
| `riesgoBajo` | `riesgo_bajo` | **Nadie en la UI** (¡disponible!) |
| `riesgoMedio` | `riesgo_medio` | Nadie en la UI |
| `riesgoAlto` | `riesgo_alto` | Nadie en la UI |
| `riesgoCritico` | `riesgo_critico` | Nadie en la UI |
| `tiempoEscalamiento` | `tiempo_escalamiento` | Nadie en la UI |
| `umbralEnsembleFalla` | `umbral_ensemble_falla` | Pestaña "Modelos ML" |
| `agreementMinimoS3` | `agreement_minimo_s3` | Pestaña "Modelos ML" |
| `horariosEnvioJson` | `horarios_envio` | Pestaña "Envío de Mensajes" |

El tipo del frontend **ya incluye** estos campos (`SystemConfigResponse` en `lib/types/settings.ts`):
```ts
riesgo_bajo: string; riesgo_medio: string; riesgo_alto: string;
riesgo_critico: string; tiempo_escalamiento: string;
```
Y `configService.saveConfig(body)` acepta cualquier subconjunto → **el panel de umbrales y el de tiempo de escalamiento se pueden conectar sin tocar el backend.**

También existe **`GET /catalog/risk-levels`** que ya devuelve, calculado desde la config real:
```json
[{ "nivel":"LOW","min":0,"max":0.4,"accion":"Monitorear","tiempoLimite":null,"escalaA":null }, ...]
```

---

## 3. Brechas (lo que el backend NO soporta hoy)

| Necesidad de la UI | ¿Backend lo soporta? | Detalle |
|---|---|---|
| Editar **reglas de notificación** (quién recibe + canal por nivel) | ❌ **No hay endpoint** | La tabla `regla_notificacion` (nivel, recibe, canal) solo se **siembra** y la **lee internamente** `notifications.service.ts`. No hay `GET`/`PATCH`. |
| **Tiempo límite por nivel** (4 valores: —/2h/30m/15m) | ⚠️ Parcial | En BD solo existe **un** `tiempoEscalamiento` global (30 min). Los "2h/30m/15m" están **hardcodeados** en `getRiskLevels()`. |
| **Plantilla WhatsApp** editable | ⚠️ Engañoso | Existe la columna `plantillaNotificacion` (sin uso), pero el mensaje real lo arma **en código** `notifications/alert-message.builder.ts`. Editar una plantilla en BD **no cambiaría** el WhatsApp enviado. |

---

## 4. Propuesta

### Principio de diseño
Seguir el patrón ya usado por las otras tabs: **tab controlada** (estado en `SettingsView`, props + callbacks hacia la tab), cargar con `useSystemConfig()` y guardar con una mutación real (`configService.saveConfig`). Lo que el backend no soporta editar, mostrarlo **read-only con datos reales** (no inventados), claramente marcado.

### Panel por panel

#### 🟦 Panel 1 — Niveles de riesgo (umbrales) → **FUNCIONAL (editable + persistente)**
- Cargar `riesgo_bajo/medio/alto/critico` desde `GET /config`.
- Editar con los inputs existentes; guardar con `PATCH /config`.
- **Validación de monotonía:** `0 < bajo < medio < alto < critico ≤ 1`. Si no se cumple, marcar en rojo y bloquear guardado (evita rangos incoherentes que romperían `getRiskLevels`).
- Mostrar el rango real calculado (`min–max`) en vez del string fijo `'0.00 — 0.40'`.

#### 🟩 Panel 2 — Reglas de notificación → 2 opciones

- **Opción A (recomendada, sin backend):** convertirlo en **read-only desde datos reales**. Hoy las reglas viven en `regla_notificacion`; se puede exponer un `GET /catalog/notification-rules` mínimo (solo lectura) o reutilizar lo ya sembrado. Muestra quién recibe y el canal **reales**, no un array hardcodeado. Etiqueta "Definido por reglas del sistema".
- **Opción B (editable, requiere backend):** agregar endpoints `GET/PATCH /catalog/notification-rules` (CRUD por nivel sobre `regla_notificacion`) y hacer los `ChannelPill` clicables para alternar canal/activo. Más completo, pero implica tocar el backend (controller + service + DTO).

#### 🟧 Panel 3 — Tiempo límite de atención → **FUNCIONAL parcial**
- Conectar el **`tiempo_escalamiento`** global (editable, persistente vía `/config`). Es el único soportado y **sí se usa** como `tiempoEscalamiento`.
- Los tiempos por nivel (2h/30m/15m) hoy son fijos; mostrarlos **read-only** tomándolos de `GET /catalog/risk-levels` (que ya los calcula) y editar solo el global.
- *(Opcional Fase 2)* si se quiere tiempo por nivel real, extender `configuracion_alertas` con columnas o un JSON `tiemposAtencionJson` (análogo a `horariosEnvioJson`).

#### 🟪 Panel 4 — Plantilla WhatsApp → **read-only (informativo)**
- Dejar la plantilla como **referencia visual** (es la estructura que arma `alert-message.builder.ts`), con una nota honesta: "Generada automáticamente por el sistema". **No** ofrecer edición que no tendría efecto.
- *(Opcional Fase 2)* si se quiere de verdad editable, habría que hacer que `alert-message.builder.ts` lea `plantillaNotificacion` de BD — cambio mayor, fuera de alcance.

### Integración (igual que las demás tabs)
1. `alerts-settings-tab.tsx` pasa a recibir props controladas:
   ```ts
   { thresholds, tiempoEscalamiento, onThresholdsChange, onTiempoChange, notificationRules, riskLevels }
   ```
2. `settings-view.tsx`:
   - Añadir estado `thresholds` + `tiempoEscalamiento`, hidratados en el `useEffect(config.data)`.
   - En `handleSave`, reemplazar el `setTimeout` falso del caso `'alerts'` por:
     ```ts
     await mutations.saveAlertSettings({ riesgo_bajo, riesgo_medio, riesgo_alto, riesgo_critico, tiempo_escalamiento });
     ```
3. `useSettings.ts`: añadir `saveAlertSettings` en `useSettingsMutations` (reusa `configService.saveConfig` + `globalMutate('/config')`).

---

## 5. Alcance recomendado (por fases)

**Fase 1 — Sólo frontend, sin tocar backend (recomendada para entregar ya):**
- Panel 1 umbrales: editable + validado + persistente.
- Panel 3 tiempo de escalamiento global: editable + persistente; tiempos por nivel read-only desde `risk-levels`.
- Panel 2 reglas: read-only con datos reales (requiere un `GET` mínimo) o, si no se quiere tocar backend, dejar el array pero alimentado por `risk-levels`.
- Panel 4 plantilla: read-only informativo.
- Guardado real del botón "Guardar configuración de alertas".

**Fase 2 — Opcional, con backend (si se quiere edición completa):**
- `GET/PATCH /catalog/notification-rules` → Panel 2 editable.
- `tiemposAtencionJson` en `configuracion_alertas` → Panel 3 por nivel editable.

---

## 6. Archivos a tocar

**Frontend (Fase 1):**
- `components/dashboard/settings/alerts-settings-tab.tsx` (controlada, carga/guarda)
- `components/dashboard/settings-view.tsx` (estado + handleSave real)
- `presentation/hooks/useSettings.ts` (`saveAlertSettings`)
- (si Panel 2 read-only real) `infrastructure/repositories/config.repository.ts` + `application/services/config.service.ts` + hook `useNotificationRules`

**Backend (sólo Fase 2):**
- `config-catalog/config-catalog.controller.ts` + `config-catalog.service.ts` (endpoints notification-rules)
- `database/models/regla-notificacion.model.ts` (sin cambios; o `configuracion-alertas.model.ts` para tiempos por nivel)

---

## 7. Riesgos / consideraciones
- **Coherencia de umbrales:** validar monotonía para no romper `getRiskLevels()` ni el pipeline.
- **Honestidad de la UI:** no mostrar como "editable" algo que no persiste (plantilla, tiempos por nivel) → marcar read-only.
- **Una sola fila de config:** `getOrCreateConfig()` siempre opera sobre una única fila; los cambios son globales (no por máquina), lo cual es correcto para este caso.

---

## 8. Decisiones tomadas
1. **Alcance:** Fase 1 + reglas de notificación editables **sin tocar modelos** (solo endpoints nuevos).
2. **Panel 2 (reglas):** **editable** — canal + destinatario por nivel (no se agregó toggle on/off para evitar editar el modelo).
3. **Panel 3 (tiempos):** **solo escalamiento global editable**; los tiempos por nivel quedan como referencia read-only.
4. **Panel 4 (plantilla):** **read-only informativo**.

> Por qué NO se editaron modelos: cambiar canal/destinatario usa columnas que `regla_notificacion` ya tiene; editar el escalamiento usa `tiempoEscalamiento` que ya existe. Solo habría hecho falta editar modelos para (a) un toggle `activo` en las reglas, o (b) tiempos por nivel — ambos descartados.

---

## 9. Estado de implementación ✅

### Backend (sin cambios de esquema / sin migración)
- `config-catalog/config-catalog.controller.ts` → **`GET /catalog/notification-rules`** y **`PATCH /catalog/notification-rules/:nivel`**.
- `config-catalog/config-catalog.service.ts` → `getNotificationRules()` y `patchNotificationRule(nivel, {recibe, canal})`; se inyecta el modelo `ReglaNotificacion`. Orden canónico LOW→MEDIUM→HIGH→CRITICAL.
- `config-catalog/config-catalog.module.ts` → se registra `ReglaNotificacion` en `forFeature`.
- Umbrales y `tiempo_escalamiento`: ya soportados por `PATCH /config` (sin cambios).

### Frontend
- **`settings/alerts-settings-tab.tsx`** → reescrito como **componente controlado** (recibe props + callbacks, sin estado propio). Paneles:
  - **1. Umbrales:** editables, rango calculado en vivo, **validación de monotonía** (bordes rojos + aviso). Helper exportado `invalidThresholdLevels()` y tipo `ThresholdMap`.
  - **2. Reglas:** `recibe` (input) + `canal` (select `CHANNEL_OPTIONS`), datos reales desde BD.
  - **3. Tiempos:** escalamiento global editable (min) + política por nivel read-only.
  - **4. Plantilla:** read-only informativo.
- **`settings-view.tsx`** → posee el estado de alertas (`thresholds`, `tiempoEscalamiento`, `notifRules`), lo hidrata desde `/config` y `/catalog/notification-rules`, y el botón **"Guardar configuración de alertas"** ahora **persiste de verdad** (se eliminó el `setTimeout` falso) con validación previa de umbrales.
- **`presentation/hooks/useSettings.ts`** → `useNotificationRules()` + mutaciones `saveAlertSettings` y `saveNotificationRules`.
- **`application/services/config.service.ts`** y **`infrastructure/repositories/config.repository.ts`** → métodos `getNotificationRules` / `saveNotificationRule` (`patchNotificationRule`).
- **`lib/types/settings.ts`** → tipos `RiskLevel`, `NotificationRule`, constante `CHANNEL_OPTIONS` y helper `normalizeChannel()` (mapea cualquier texto de canal a un valor canónico que el motor de notificaciones interpreta por substring).

### Detalle de normalización de canal
El canal se guarda en valores canónicos (`—`, `WhatsApp`, `Email`, `WhatsApp + Email`). El motor (`notifications.service.ts` / `alert-message.builder.ts`) detecta el canal con `includes('whats')` / `includes('email')`, por lo que estos valores producen el envío correcto. Efecto secundario: textos descriptivos previos (p. ej. "WhatsApp inmediato") se normalizan a "WhatsApp" al guardar.

### Verificación
- `tsc --noEmit` OK en API (`tsconfig.build.json`) y en Web.
- **Probar:** reiniciar el API (endpoints nuevos, sin migración) → Configuración → Alertas → editar umbrales/destinatarios/canal/escalamiento → Guardar → recargar y confirmar persistencia. Umbral incoherente (MEDIUM < LOW) → bloquea con aviso.

### Pendiente / fuera de alcance (Fase 2 opcional)
- Toggle activar/desactivar reglas (requiere columna `activo` en `regla_notificacion`).
- Tiempos de atención por nivel editables (requiere `tiemposAtencionJson` en `configuracion_alertas`).
- Plantilla WhatsApp realmente editable (requiere que `alert-message.builder.ts` lea la plantilla desde BD).
</content>
