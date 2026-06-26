# PredictMaint — Estado de implementación del flujo de monitoreo

> **Documento actualizado — la mayoría de pasos antes pendientes ya están implementados.**
>
> Este documento listaba originalmente los "pasos faltantes" para cerrar el flujo
> **simulado en tiempo real** (desde la lectura del CSV hasta la asignación y reintento
> de técnico). Tras la revisión del código, casi todos esos pasos **ya están en producción**.
> A continuación se documenta, paso por paso, el **estado real de implementación** con
> referencia al archivo o servicio que lo resuelve.
>
> Complementa `DOCUMENTACION_FLUJO_MONITOREO.md`. Última verificación de código: 2026-06-26.

---

## 1. Resumen de estado

| Paso / capacidad | Estado | Implementado en |
|------------------|--------|-----------------|
| Simulador aleatorio (terminal) | ✅ IMPLEMENTADO | `scripts/simulate-sensor-stream.py` |
| Gate S-1: solo clasificar/RAG/asignar si S-1 = FALLA | ✅ IMPLEMENTADO | `sensor-readings.service.ts` (`s1Falla`) |
| Tabs condicionales S-1 → S-2 → S-3 (UI) | ✅ IMPLEMENTADO | `analysis-view.tsx` (`s1Falla`/`s2Ready`/`s3Ready`) |
| Asignación desde `regla_asignacion` (BD) + turno | ✅ IMPLEMENTADO | `technicians.service.ts` |
| Reintento de asignación por nivel de riesgo (job) | ✅ IMPLEMENTADO | `jobs/assignment-retry.service.ts` |
| Escalamiento a supervisor por SLA | ✅ IMPLEMENTADO | `jobs/escalation.service.ts` |
| Técnico (nombre/iniciales) en API de alertas | ✅ IMPLEMENTADO | `alerts.service.ts` |
| Refresh automático en vista Monitoreo | ✅ IMPLEMENTADO | `useAlerts.ts` / `useMachines.ts` (`refreshInterval`) |
| Fallos repetitivos (cálculo + persistencia) | ✅ IMPLEMENTADO | `repetitive-faults.service.ts` |
| Notificaciones reales (Email SMTP / WhatsApp webhook) | ✅ IMPLEMENTADO | `notifications.service.ts`, `smtp-email.service.ts`, `webhook-notifier.service.ts` |
| Cron `handleRepetitiveFaultScan` en `jobs.service.ts` | ⏳ PENDIENTE (stub) | `jobs/jobs.service.ts` — sigue como `[stub]` |
| Crons `handleHourlyDispatch` / `handleDailyReset` | ⏳ PENDIENTE (stub) | `jobs/jobs.service.ts` — siguen como `[stub]` |
| RAG dinámico con LLM (retrieval real) | ⏳ PENDIENTE | RAG actual es estático (`mlGateway.rag`) |

> Nota sobre los stubs de `jobs.service.ts`: el **cálculo de fallos repetitivos sí está
> implementado** en `repetitive-faults.service.ts` (se computa en vivo al consultar el
> endpoint y se persiste en `fallo_repetitivo`). El cron `handleRepetitiveFaultScan`
> sigue siendo un stub de log, pero la funcionalidad de negocio no depende de él.

---

## 2. Reglas de negocio acordadas (referencia)

### 2.1 Tabs de Análisis (S-1 → S-2 → S-3)

```
Regla RN-0x dispara alerta + orden
        ↓
   Tab 1 (S-1) siempre visible
        ↓
   ¿S-1 predice FALLA?  (ensemble_avg ≥ umbral_ensemble_falla)
        │
   NO ──┴── SÍ
   │         │
   │         ├── Tab 2 (S-2) se activa → muestra tipo de falla
   │         │
   │         └── Tab 3 (S-3) se activa después → muestra recomendaciones
   │
   └── Tabs 2 y 3 permanecen deshabilitados
```

- Si **S-1 = SIN FALLA**: tabs 2 y 3 **no se activan**.
- Si **S-1 = FALLA**: tab 2 con clasificación; tab 3 con recomendaciones.

### 2.2 Asignación de técnico

- Solo se asigna cuando **S-1 predijo FALLA** y **S-2 clasificó** el tipo de fallo.
- Si no hay técnico disponible: orden y alerta quedan con `tecnicoId = null` y se programa reintento.
- Reintento según `nivel_riesgo`:

| Nivel | Espera antes del siguiente intento |
|-------|-------------------------------------|
| **CRITICAL** | 15 min |
| **HIGH** | 15 min |
| **MEDIUM** | 30 min |
| **LOW** | 60 min |

- Criterios de selección: tabla **`regla_asignacion`** + filtro de turno.

### 2.3 Monitoreo

- Cada alerta activa muestra **nombre e iniciales** del técnico asignado, o badge "Sin técnico"
  con tiempo hasta el próximo reintento.

---

## 3. Estado detallado por paso

### Paso 1 — Simulador aleatorio · ✅ IMPLEMENTADO

**Archivo:** `scripts/simulate-sensor-stream.py`

Simulador por etapas: en cada etapa una máquina distinta recibe un fallo confirmado
(S-1 + tipo de fallo) y el resto recibe lecturas normales. Excluye máquinas con pipeline
activo. Se autentica contra la API (`/sensor-readings`) y publica lecturas reales que
disparan el pipeline completo. Además del simulador, el sistema cuenta con generación
automática de lecturas/fallas vía el flujo de ingesta.

---

### Paso 2 — Pipeline backend con gate de S-1 · ✅ IMPLEMENTADO

**Archivo:** `predictmaint-api/src/sensor-readings/sensor-readings.service.ts`

- Tras S-1 se calcula `const s1Falla = scoreLider >= umbral` (umbral leído de
  `configuracion_alertas` vía `getUmbralFalla()`).
- **Si `!s1Falla`:** la orden y la alerta se cierran (`EstadoOrden.FINALIZADO` /
  `EstadoAlerta.FINALIZADO`), se registra evento `finalizado` ("S-1 sin confirmación de
  falla — regla descartada por ML") y **no** se ejecuta S-2, S-3 ni asignación.
- **Si `s1Falla`:** se ejecuta S-2 (`mlGateway.classify`), se persiste la clasificación,
  se genera el plan RAG (`persistRagPlan`, S-3) y se intenta asignar técnico
  (`assignForOrder`). Cada transición registra un `evento_orden`
  (`deteccion_s1`, `clasificacion_s2`, `rag_s3`, `respuesta_tecnico`).

> El gate descrito en §4.1 del documento original ("estado de alerta cuando S-1 = SIN FALLA")
> está implementado tal cual: orden y alerta en `finalizado` con nota en timeline.

---

### Paso 3 — Reintento de asignación sin técnico · ✅ IMPLEMENTADO

**Modelo de datos:** la tabla `orden` ya incluye `proximo_reintento_asignacion` e
`intentos_asignacion` (usados en `sensor-readings.service.ts` y en el job).

**Programación inicial:** cuando `assignForOrder` devuelve `null`, `scheduleAssignmentRetry()`
escribe `proximoReintentoAsignacion = addMinutes(now, minutos)`, `intentosAsignacion = 1` y
crea el evento `asignacion_pendiente`.

**Job programado:** `predictmaint-api/src/jobs/assignment-retry.service.ts`

```typescript
@Cron('0 * * * * *') // cada minuto
async retryPendingAssignments() {
  // órdenes: idTecnico IS NULL, estado = PENDIENTE,
  //          proximoReintentoAsignacion <= NOW(), con S-2 (clasificaciones)
  // → assignForOrder → actualizar orden/alerta + evento respuesta_tecnico
  //   o re-programar (evento reintento_asignacion, intentos + 1)
}
```

Los minutos por nivel se resuelven con `techniciansService.getReintentoMinutos()`
(`common/utils/assignment-retry.util.ts`).

---

### Paso 4 — Asignación desde `regla_asignacion` (BD) + turno · ✅ IMPLEMENTADO

**Archivo:** `predictmaint-api/src/technicians/technicians.service.ts`

- Inyecta el modelo `ReglaAsignacion`; `resolveSpecialty()` lee la especialidad requerida
  desde `regla_asignacion` (con fallback a un mapa `FAULT_SPECIALTY` por tipo de fallo).
- `findAvailable(nivelRiesgo, tipoFallo)` aplica estrategia por nivel:
  - **CRITICAL** → mayor `nivel_experiencia`.
  - **HIGH** → técnico por especialidad según tipo de fallo (con fallback de HIDRAULICO → MECANICO).
  - **MEDIUM/LOW** → menor carga de órdenes activas.
- **Filtro de turno:** `filterByActiveShift()` usa `getCurrentTurno()`
  (`common/utils/shift.util.ts`) y excluye `EstadoTecnico.FUERA_DE_TURNO`.

---

### Paso 5 — API: técnico en respuesta de alertas · ✅ IMPLEMENTADO

**Archivo:** `predictmaint-api/src/alerts/alerts.service.ts`

`ALERT_INCLUDES` hace join de `Tecnico` (con `Usuario`) y de la `Orden`. `toResponse()`
expone:

```typescript
tecnicoId: a.idTecnico ?? null,
tecnico: a.tecnico ? { id, nombre, iniciales } : null,
proximoReintentoAsignacion: a.orden?.proximoReintentoAsignacion?.toISOString() ?? null,
```

`findActive()` y `findOne()` usan los mismos includes, por lo que `GET /alerts/active`
devuelve `tecnico.nombre` e `iniciales` cuando hay asignación.

---

### Paso 6 — Frontend: Monitoreo en vivo + técnico visible · ✅ IMPLEMENTADO

**Archivos:** `predictmaint-web/src/presentation/hooks/useAlerts.ts`,
`useMachines.ts`, `monitoring-view.tsx`

- `refreshInterval` configurado en los hooks de alertas y máquinas (polling automático).
- La UI muestra técnico (nombre/iniciales) o badge "Sin técnico" + próximo reintento.

> Adicionalmente existe streaming por SSE (`monitoring/monitoring-sse.service.ts` +
> listeners) para empujar alertas/lecturas en vivo además del polling.

---

### Paso 7 — Frontend: tabs condicionales en Análisis · ✅ IMPLEMENTADO

**Archivo:** `predictmaint-web/src/components/dashboard/analysis-view.tsx`

Implementa la cadena con `s1Falla`, `s2Ready` y `s3Ready`: los tabs 2 y 3 se deshabilitan
mientras S-1 no confirme falla y/o S-2/S-3 no tengan datos, respetando la regla §2.1.

---

### Paso 8 — Historial con data simulada · ✅ IMPLEMENTADO

**Archivo:** `predictmaint-web/src/components/dashboard/orders-history-view.tsx`

El historial consume órdenes reales generadas por el pipeline (tipo de fallo, nivel de
riesgo, técnico, fecha de detección), sin datos mock.

---

## 4. Capacidades extra ya implementadas (antes "fase 2")

| Ítem | Estado | Implementado en |
|------|--------|-----------------|
| **Escalado a supervisor por SLA** | ✅ IMPLEMENTADO | `jobs/escalation.service.ts` (`escalateOverdueOrders`, `@Cron('30 * * * * *')`), con idempotencia por evento `escalado` y SLA por nivel desde `config-catalog` |
| **Fallos repetitivos** | ✅ IMPLEMENTADO | `repetitive-faults.service.ts`: calcula en vivo (máquina + tipo con ≥ umbral en ventana), persiste en `fallo_repetitivo` y devuelve los activos |
| **Notificaciones (Email/WhatsApp)** | ✅ IMPLEMENTADO | `notifications.service.ts` + `integrations/email/smtp-email.service.ts` + `webhook-notifier.service.ts` (escucha `order.created` / `order.escalated`) |

---

## 5. Pendientes reales

| Ítem | Estado | Detalle |
|------|--------|---------|
| Crons stub en `jobs.service.ts` | ⏳ PENDIENTE | `handleHourlyDispatch`, `handleDailyReset` y `handleRepetitiveFaultScan` siguen siendo logs `[stub]`. La lógica de fallos repetitivos vive en `repetitive-faults.service.ts` (cálculo on-demand), por lo que el stub no bloquea el negocio. |
| RAG dinámico con LLM | ⏳ PENDIENTE | El RAG actual es estático (`mlGateway.rag` + `buildGeneralRecommendation`). El contrato `/rag` se mantiene; falta sustituir el backend por retrieval + LLM. |

---

## 6. Checklist de verificación end-to-end

```text
[ ] PostgreSQL + API + ML + Web levantados
[ ] python scripts/simulate-sensor-stream.py --max 10
[ ] /dashboard/monitoring — alertas nuevas en vivo, técnico o "Sin técnico"
[ ] Ver análisis — tab 1; si FALLA → tab 2 tipo; → tab 3 recomendaciones
[ ] /dashboard/orders — órdenes con datos ML reales
[ ] Orden sin técnico — tras esperar plazo, el job asigna y registra reintento
[ ] Orden no atendida — tras SLA, el job de escalamiento registra evento 'escalado'
[ ] GET /alerts/active incluye tecnico.nombre e iniciales
```

---

## 7. Referencias cruzadas

| Tema | Documento / archivo |
|------|---------------------|
| Flujo general y simulador | `DOCUMENTACION_FLUJO_MONITOREO.md` |
| Modelo de datos | `DOCUMENTACION_MODELO_DE_DATOS.md` |
| Contrato REST | `DOCUMENTACION_API_CONTRATO.md` |
| Pipeline (gate S-1) | `predictmaint-api/src/sensor-readings/sensor-readings.service.ts` |
| Asignación + turno | `predictmaint-api/src/technicians/technicians.service.ts` |
| Reintento de asignación | `predictmaint-api/src/jobs/assignment-retry.service.ts` |
| Escalamiento por SLA | `predictmaint-api/src/jobs/escalation.service.ts` |
| Fallos repetitivos | `predictmaint-api/src/repetitive-faults/repetitive-faults.service.ts` |
| Notificaciones | `predictmaint-api/src/notifications/notifications.service.ts` |
| API de alertas (técnico) | `predictmaint-api/src/alerts/alerts.service.ts` |
| Vista Monitoreo | `predictmaint-web/src/components/dashboard/monitoring-view.tsx` |
| Vista Análisis (tabs) | `predictmaint-web/src/components/dashboard/analysis-view.tsx` |

---

## 8. Definición de "flujo completo"

El flujo de monitoreo simulado **hasta selección de técnico está completo**:

1. El simulador alimenta la API de forma continua. ✅
2. Monitoreo muestra alertas en vivo con técnico (o reintento programado). ✅
3. Análisis respeta la cadena S-1 → S-2 → S-3 según §2.1. ✅
4. El historial lista órdenes reales generadas por el pipeline. ✅
5. La asignación usa `regla_asignacion` + turno y reintenta según §2.2. ✅
6. El escalamiento por SLA notifica al supervisor cuando una orden no se atiende. ✅

Lo único que queda fuera es el **RAG dinámico con LLM** y la limpieza de los **crons stub**
en `jobs.service.ts`, ninguno de los cuales bloquea el flujo de negocio descrito.
