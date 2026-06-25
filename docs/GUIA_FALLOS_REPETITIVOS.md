# Guía — Pestaña "Fallos Repetitivos" (Configuración)

**Archivo objetivo:** `predictmaint-web/src/components/dashboard/settings/repetitive-faults-settings-tab.tsx`
**Estado:** ✅ **IMPLEMENTADO** — los 4 paneles ahora son funcionales (antes 100% estáticos).

---

## 1. Diagnóstico previo

La pestaña estaba **completamente decorativa** y el backend del módulo `repetitive-faults` era un **stub** (devolvía `{ items: [], total: 0 }` y `{ ok: true, stub: true }`). Los 4 paneles:

| Panel | Antes | Ahora |
|---|---|---|
| **Umbrales de repetitividad** | `useState` local, no persistía | ✅ Editable + persistente (`/config`) |
| **Acciones escaladas por tipo de fallo** | Array constante | ✅ Editable por tipo (tabla `accion_escalada`) |
| **Notificaciones por fallo repetitivo** | Toggles locales | ✅ Editable + persistente (`/config`) |
| **Máquinas en estado crítico repetitivo** | Lista hardcodeada (M-001/M-003) | ✅ Datos reales calculados + "Marcar resuelto" funcional |

---

## 2. Decisiones de almacenamiento

- **Umbrales + toggles de notificación** → se guardan como JSON en una **nueva columna** `configuracion_alertas.fallosRepetitivosJson` (igual patrón que `tiemposAtencionJson`). Se autocrea con `DATABASE_ALTER=true` (sin migración manual).
- **Acciones escaladas** → ya existían en la tabla `accion_escalada` (sembrada). Solo se agregaron **endpoints** para leerlas/editarlas (no se tocó el modelo).
- **Máquinas críticas** → se calculan en vivo desde las órdenes y se **persisten** en la tabla existente `fallo_repetitivo` (para poder marcarlas resueltas).

---

## 3. Backend — qué se agregó

### 3.1 Configuración (`config-catalog`)
- **Modelo:** `configuracion-alertas.model.ts` → columna `fallosRepetitivosJson`.
- **Servicio (`config-catalog.service.ts`):**
  - `FallosRepetitivosConfig` (tipo) + `DEFAULT_FALLOS_REPETITIVOS` + `parseFallosRepetitivos()`.
  - `getConfig()` ahora expone `fallos_repetitivos`; `patchConfig()` lo guarda.
  - `getFallosRepetitivosConfig()` (lo usa el módulo de fallos repetitivos).
  - `getEscalationActions()` / `patchEscalationAction(tipoFallo, acciones)` (tabla `accion_escalada`).
- **Controller (`config-catalog.controller.ts`):**
  - `GET /catalog/escalation-actions`
  - `PATCH /catalog/escalation-actions/:tipoFallo`  (body `{ acciones }`)
- **Módulo:** registra `AccionEscalada` en `forFeature`.

### 3.2 Módulo `repetitive-faults` (antes stub → funcional)
- **`repetitive-faults.service.ts`:**
  - `findAll()`:
    1. Lee la config (`ventanaDias`, `marcar.veces`, `notificar.veces`).
    2. Agrupa órdenes con técnico por **máquina + tipo de fallo** dentro de la ventana.
    3. Filtra las que tienen **≥ `marcar.veces`** ocurrencias.
    4. Por cada grupo, **crea/actualiza** un registro en `fallo_repetitivo` (nivel `CRITICO` si `≥ notificar.veces`, si no `MODERADO`).
    5. Devuelve los **activos** (no resueltos), ordenados por ocurrencias.
  - `resolve(id, nota)`: marca el registro como `RESUELTO` (queda oculto).
- **Módulo:** registra los modelos (`Orden`, `FalloRepetitivo`, `Maquina`, `AnalisisFallo`, `ClasificacionFallo`, `TipoFallo`) e importa `ConfigCatalogModule`.
- **Endpoints (ya existían, ahora con lógica real):**
  - `GET /repetitive-faults` → `{ items, total }`
  - `POST /repetitive-faults/:id/resolve` → `{ ok: true }`

---

## 4. Frontend — qué se agregó

- **Tipos (`lib/types/settings.ts`):** `RepetitiveFaultsConfig`, `DEFAULT_REPETITIVE_CONFIG`, `EscalationAction`, `RepetitiveMachine`; `fallos_repetitivos` añadido a `SystemConfigResponse`.
- **Repositorio/Servicio (`config.repository.ts`, `config.service.ts`):**
  - `getEscalationActions` / `saveEscalationAction`
  - `getRepetitiveMachines` / `resolveRepetitiveMachine`
- **Hooks (`useSettings.ts`):**
  - `useEscalationActions()`, `useRepetitiveMachines()` (auto-refresh cada 30 s).
  - Mutaciones: `saveRepetitiveSettings`, `saveEscalationActions`, `resolveRepetitiveFault`.
- **`repetitive-faults-settings-tab.tsx`:** reescrito como **componente controlado** (recibe `config`, `escalationActions` + callbacks; el Panel 4 consume sus propios datos en vivo).
- **`settings-view.tsx`:** posee el estado de la pestaña, lo hidrata desde `/config` y `/catalog/escalation-actions`, y el botón **"Guardar configuración de fallos repetitivos"** ahora **persiste de verdad** (antes era un `setTimeout` falso).

---

## 5. Flujo de datos (quién llama a quién)

```
Configuración → Fallos Repetitivos (UI controlada por settings-view)
 ├─ Umbrales / Notificaciones → Guardar → PATCH /config { fallos_repetitivos }
 │                                          → configuracion_alertas.fallosRepetitivosJson
 ├─ Acciones escaladas → Guardar → PATCH /catalog/escalation-actions/:tipo { acciones }
 │                                  → tabla accion_escalada
 └─ Máquinas críticas (Panel 4)
        GET /repetitive-faults
          → RepetitiveFaultsService.findAll()
               lee config (ventana + umbral)
               agrupa órdenes por máquina+tipo, filtra ≥ marcar.veces
               upsert en fallo_repetitivo → devuelve activos
        "Marcar resuelto" → POST /repetitive-faults/:id/resolve
               → fallo_repetitivo.estado = 'resuelto' (desaparece de la lista)
```

---

## 6. Comportamiento y matices (para exponer / evaluar)

- **Umbral que gobierna el Panel 4:** `umbrales.marcar` (veces + días de ventana). Si subes/bajas estos valores y guardas, la lista de "máquinas críticas" cambia en la siguiente carga.
- **Nivel CRÍTICO vs MODERADO:** se asigna según `umbrales.notificar.veces` (≥ → CRÍTICO).
- **"Marcar resuelto"** persiste: el registro `fallo_repetitivo` pasa a `resuelto` y deja de mostrarse. **No se reactiva automáticamente** si el fallo reincide después (decisión de simplicidad — documentado; sería una mejora futura reactivarlo).
- **Las acciones escaladas** alimentan conceptualmente el plan RAG escalado; aquí se editan/persisten en `accion_escalada`. (El uso de ese texto en la generación del plan es del flujo RAG, no de esta pantalla.)
- **Los toggles de notificación** se guardan como intención de configuración. El envío real de notificaciones por reincidencia ya lo maneja el flujo de notificaciones (que detecta `ocurrencias ≥ 3` para `TipoEnvio.REPETITIVO`).

---

## 7. Cómo probar
1. **Reinicia el API** (crea la columna `fallosRepetitivosJson`; sin migración manual).
2. Configuración → **Fallos Repetitivos**:
   - Cambia umbrales (p. ej. "Marcar si ocurre 2 veces en 7 días"), edita una acción escalada, alterna toggles → **Guardar** → recarga y confirma persistencia.
3. Genera con el simulador **≥ 2 órdenes** de la misma máquina y mismo tipo de fallo dentro de la ventana → aparece en **"Máquinas en estado crítico repetitivo"**.
4. Pulsa **"Marcar resuelto"** → desaparece de la lista (queda `resuelto` en BD).

---

## 8. Archivos tocados

**Backend**
- `database/models/configuracion-alertas.model.ts` (columna nueva)
- `config-catalog/config-catalog.service.ts` · `.controller.ts` · `.module.ts`
- `repetitive-faults/repetitive-faults.service.ts` · `.module.ts`

**Frontend**
- `lib/types/settings.ts`
- `infrastructure/repositories/config.repository.ts`
- `application/services/config.service.ts`
- `presentation/hooks/useSettings.ts`
- `components/dashboard/settings/repetitive-faults-settings-tab.tsx`
- `components/dashboard/settings-view.tsx`

## 9. Pendiente / mejora futura
- Reactivar automáticamente un fallo `resuelto` si vuelve a superar el umbral.
- Notificación real al marcar repetitivo/escalar (hoy los toggles guardan intención; el envío por reincidencia ya existe en el flujo de notificaciones).
- Historial de intervenciones por máquina (`GET /repetitive-faults/:maquinaId/history` sigue devolviendo `[]`).
</content>
