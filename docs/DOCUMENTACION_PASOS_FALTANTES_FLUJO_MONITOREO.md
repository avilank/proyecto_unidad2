# PredictMaint — Pasos faltantes para completar el flujo de monitoreo

> Plan de implementación para cerrar el flujo **simulado en tiempo real** desde la lectura
> aleatoria del CSV hasta la **asignación (y reintento) de técnico**, con tabs S-1/S-2/S-3
> coherentes en Análisis y técnico visible en Monitoreo.
>
> Complementa `DOCUMENTACION_FLUJO_MONITOREO.md`. Fecha: 2026-06-18.

---

## 1. Alcance de este documento

| Incluido | Fuera de alcance (fase posterior) |
|----------|-----------------------------------|
| Simulador aleatorio (terminal) | RAG dinámico con LLM |
| Tabs condicionales S-1 → S-2 → S-3 | Notificaciones WhatsApp/Email reales |
| Reglas S-1/S-2/S-3 según negocio | Fallos repetitivos / escalado supervisor |
| Asignación desde `regla_asignacion` (BD) | Config UI (tabs Settings) |
| Reintento de técnico por nivel de riesgo | n8n u orquestadores externos |
| Técnico (nombre/iniciales) en Monitoreo | |
| Refresh automático en vista Monitoreo | |

---

## 2. Reglas de negocio acordadas

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

- Si **S-1 = SIN FALLA**: tabs 2 y 3 **no se activan** (deshabilitados en UI; sin datos S-2/S-3).
- Si **S-1 = FALLA**: tab 2 **obligatorio** con clasificación; tab 3 **obligatorio** con recomendaciones (estáticas por ahora).
- La UI **no debe permitir** abrir tab 2/3 manualmente si S-1 no confirmó falla.
- Opcional UX: al cargar S-1 con FALLA → auto-avanzar a tab 2; al tener S-2 → auto-avanzar a tab 3.

### 2.2 Asignación de técnico

- Solo tiene sentido asignar cuando **S-1 predijo FALLA** y **S-2 clasificó** el tipo de fallo.
- Si no hay técnico disponible: orden y alerta quedan con `tecnicoId = null`.
- El sistema **reintenta** buscar técnico según `nivel_riesgo`:

| Nivel | Espera antes del siguiente intento |
|-------|-------------------------------------|
| **CRITICAL** | 15 min |
| **HIGH** | 15 min |
| **MEDIUM** | 30 min |
| **LOW** | 60 min |

- El ciclo se repite hasta asignar técnico o hasta intervención manual.
- Criterios de selección: leer tabla **`regla_asignacion`** en BD (no mapa fijo en código).

### 2.3 Monitoreo

- Cada alerta activa debe mostrar **nombre e iniciales** del técnico asignado.
- Si no hay técnico: mostrar badge **“Sin técnico”** y tiempo hasta próximo reintento (si aplica).

---

## 3. Brecha entre código actual y reglas acordadas

| Comportamiento acordado | Código actual | Acción |
|-------------------------|---------------|--------|
| Tab 2/3 solo si S-1 = FALLA | Los 3 tabs siempre clicables | Ajustar `analysis-view.tsx` |
| Tab 3 siempre tras S-2 exitoso | S-3 solo si `agreement ≥ mínimo` | Ajustar pipeline o forzar RAG tras S-2 |
| Asignar solo si S-1 = FALLA + S-2 | Asigna aunque S-1 = SIN FALLA | Ajustar `sensor-readings.service.ts` |
| Reintento con plazo por nivel | No existe | Job + campo `proximo_reintento_asignacion` |
| Reglas desde `regla_asignacion` | Lógica hardcodeada en `technicians.service.ts` | Leer BD + strategy |
| Técnico en Monitoreo | Solo `tecnicoId` en API, no en UI | Enriquecer API + UI |
| Simulador aleatorio | No existe el archivo | Crear `scripts/simulate-sensor-stream.py` |
| Monitoreo “en vivo” | SWR sin polling | `refreshInterval: 5000` en hooks |

---

## 4. Pasos de implementación (orden recomendado)

### Paso 1 — Simulador aleatorio

**Archivo:** `scripts/simulate-sensor-stream.py` (copiar desde `DOCUMENTACION_FLUJO_MONITOREO.md` §6.3).

**Criterio de aceptación:**
- [ ] `python scripts/simulate-sensor-stream.py --max 5` crea alertas/órdenes en BD.
- [ ] Filas y máquinas elegidas al azar desde pool RN-0x.

---

### Paso 2 — Ajustar pipeline backend (S-1 / S-2 / S-3 / asignación)

**Archivo principal:** `predictmaint-api/src/sensor-readings/sensor-readings.service.ts`

**Cambios:**

1. **Tras S-1**, guardar flag lógico `s1Falla = ensemble_avg >= umbral`.
2. **Solo si `s1Falla`:**
   - Ejecutar S-2 y persistir `prediccion_multiclase`.
   - Ejecutar S-3 (RAG estático) **siempre** tras S-2 — eliminar o ignorar el gate de `agreement_minimo_s3` para el flujo automático (el agreement sigue mostrándose en UI tab 2).
3. **Solo si `s1Falla` y S-2 completó:**
   - Llamar `assignForOrder(nivelRiesgo, tipoFalloFinal)`.
4. **Si `s1Falla` es false:**
   - No ejecutar S-2 ni S-3.
   - No asignar técnico.
   - Actualizar alerta a estado coherente (p. ej. `finalizado` o `pendiente` sin técnico — definir en §4.1).
5. Registrar `evento_orden` en cada transición.

**Criterio de aceptación:**
- [ ] Lectura con S-1 SIN FALLA → orden sin `prediccion_multiclase`, sin `plan_rag`, `tecnicoId = null`.
- [ ] Lectura con S-1 FALLA → orden con S-2, S-3 y técnico (si hay disponible).

#### 4.1 Estado de alerta cuando S-1 = SIN FALLA

Opción recomendada:

| Campo | Valor |
|-------|-------|
| `alerta.estado` | `finalizado` |
| `alerta.nivel` | según `ensemble_avg` (LOW/MEDIUM) |
| `orden.estado` | `finalizado` con nota en timeline: “S-1 sin confirmación de falla” |

Documentar la decisión en comentario del servicio para no confundir con órdenes de mantenimiento reales.

---

### Paso 3 — Reintento de asignación sin técnico

#### 3.1 Modelo de datos

Añadir a tabla `orden`:

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `proximo_reintento_asignacion` | TIMESTAMP NULL | Próximo intento si `tecnico_id` es NULL |
| `intentos_asignacion` | SMALLINT DEFAULT 0 | Contador de reintentos |

Añadir a `configuracion` (seeder):

| clave | valor |
|-------|-------|
| `reintento_asignacion_critical_min` | `15` |
| `reintento_asignacion_high_min` | `15` |
| `reintento_asignacion_medium_min` | `30` |
| `reintento_asignacion_low_min` | `60` |

#### 3.2 Lógica al fallar asignación

En `sensor-readings.service.ts`, cuando `assignForOrder` devuelve `null`:

```typescript
const minutos = await getReintentoMinutos(nivelRiesgo); // desde configuracion
await order.update({
  proximoReintentoAsignacion: addMinutes(now, minutos),
  intentosAsignacion: 1,
});
await eventoModel.create({
  etapa: 'asignacion_pendiente',
  descripcion: `Sin técnico disponible. Reintento en ${minutos} min`,
  ...
});
```

#### 3.3 Job programado

**Archivo:** `predictmaint-api/src/jobs/assignment-retry/assignment-retry.service.ts`

```typescript
@Cron('0 * * * * *') // cada minuto
async retryPendingAssignments() {
  // órdenes: tecnico_id IS NULL
  //   AND estado = 'pendiente'
  //   AND proximo_reintento_asignacion <= NOW()
  //   AND existe prediccion_multiclase (S-2 corrió)
  // → assignForOrder → actualizar orden/alerta/evento
}
```

Registrar en `jobs.module.ts`.

**Criterio de aceptación:**
- [ ] Orden sin técnico muestra `proximo_reintento_asignacion` en API.
- [ ] Tras el plazo, job asigna técnico si alguno pasa a `disponible`.
- [ ] Evento `respuesta_tecnico` o `reintento_asignacion` en timeline.

---

### Paso 4 — Asignación desde `regla_asignacion` (BD)

**Archivos:**
- `predictmaint-api/src/technicians/technicians.service.ts`
- Nuevo: `predictmaint-api/src/technicians/strategies/` (opcional pero recomendado)

**Cambios:**

1. Inyectar modelo `ReglaAsignacion`.
2. `findAvailable(nivelRiesgo, tipoFallo)` lee criterio de BD por `nivel_riesgo`.
3. Implementar estrategias según seed `20260617000004-seed-regla-asignacion.js`:
   - **CRITICAL** → mayor `nivel_experiencia`, filtrar turno activo.
   - **HIGH** → especialidad según `tipo_fallo` (mapa `tipo_fallo.especialidad_requerida` o catálogo).
   - **MEDIUM** → menor carga de órdenes activas.
4. **Filtro de turno** según hora actual:
   - mañana: 06:00–14:00
   - tarde: 14:00–22:00
   - noche: 22:00–06:00
5. Excluir `estado = fuera_de_turno`.
6. Añadir técnico **hidráulico** en seeder demo para HDF (o fallback documentado a `mecanico`).

**Criterio de aceptación:**
- [ ] Cambiar fila en `regla_asignacion` afecta comportamiento sin redeploy de lógica hardcodeada.
- [ ] HIGH + PWF asigna técnico eléctrico en turno activo.

---

### Paso 5 — API: técnico en respuesta de alertas

**Archivo:** `predictmaint-api/src/alerts/alerts.service.ts`

Incluir join o lookup de `Tecnico` en `findActive()` y `findOne()`:

```typescript
{
  id: 'ALT-001',
  tecnicoId: 2,
  tecnico: { id: 2, nombre: 'Carlos Mendoza', iniciales: 'CM' } | null,
  proximoReintentoAsignacion: '2026-06-18T10:30:00Z' | null, // desde orden vinculada
  ...
}
```

Actualizar `DOCUMENTACION_API_CONTRATO.md` §7 si se expone el campo nuevo.

**Criterio de aceptación:**
- [ ] `GET /alerts/active` devuelve `tecnico.nombre` e `iniciales` cuando hay asignación.

---

### Paso 6 — Frontend: Monitoreo en vivo + técnico visible

**Archivos:**
- `predictmaint-web/src/presentation/hooks/useAlerts.ts`
- `predictmaint-web/src/presentation/hooks/useMachines.ts`
- `predictmaint-web/src/components/dashboard/monitoring-view.tsx`
- `predictmaint-web/src/core/entities/index.ts` (tipo `Alert`)

**Cambios:**

1. `refreshInterval: 5000` en `useActiveAlerts` y `useMachines`.
2. En `ActiveAlertCard` y `MachineFlowCard`:
   - Si `alert.tecnico` → avatar/iniciales + nombre.
   - Si no → `<Badge>Sin técnico</Badge>` + texto “Reintento en X min” si hay fecha.
3. Banner de fallo repetitivo: ocultar o conectar a `GET /repetitive-faults` (opcional).

**Criterio de aceptación:**
- [ ] Con simulador corriendo, alertas aparecen sin F5.
- [ ] Se ve “CM · Carlos Mendoza” o “Sin técnico”.

---

### Paso 7 — Frontend: tabs condicionales en Análisis

**Archivo:** `predictmaint-web/src/components/dashboard/analysis-view.tsx`

**Lógica:**

```typescript
const umbral = 0.5; // ideal: GET /config umbral_ensemble_falla
const s1Falla =
  (binary.data?.ensembleAvg ?? 0) >= umbral ||
  binary.data?.consenso === 'FALLA';

const s2Ready = s1Falla && (multiclass.data?.items?.length ?? 0) > 0;
const s3Ready = s2Ready && (rag.data?.acciones?.length ?? 0) > 0;

// Tab buttons: disabled + opacity si !s2Ready / !s3Ready
// useEffect: si s1Falla && tab==='s1' → setTab('s2') cuando multiclass cargue
// useEffect: si s2Ready && rag cargó → setTab('s3')
```

Mostrar mensaje en tab deshabilitado: *“S-1 no confirmó falla — clasificación no disponible”*.

**Criterio de aceptación:**
- [ ] Orden con S-1 SIN FALLA: solo tab 1 usable.
- [ ] Orden con S-1 FALLA: tabs 1→2→3 en secuencia con datos.

---

### Paso 8 — Historial con data simulada

**Archivo:** `predictmaint-web/src/components/dashboard/orders-history-view.tsx`

Verificar que columnas muestren: `tipoFallo`, `nivelRiesgo`, técnico, `detectadoEn`.
Tras correr simulador 20+ lecturas, historial debe listar órdenes reales.

**Criterio de aceptación:**
- [ ] `/dashboard/orders` refleja órdenes del simulador sin datos mock.

---

## 5. Checklist de verificación end-to-end

```text
[ ] PostgreSQL + API + ML + Web levantados
[ ] python scripts/simulate-sensor-stream.py --max 10
[ ] /dashboard/monitoring — alertas nuevas cada ~5 s, técnico o “Sin técnico”
[ ] Ver análisis — tab 1; si FALLA → tab 2 tipo; → tab 3 recomendaciones
[ ] /dashboard/orders — 10 órdenes con datos ML reales
[ ] Orden sin técnico — tras esperar plazo (o forzar proximo_reintento en BD), job asigna
[ ] GET /alerts/active incluye tecnico.nombre
```

---

## 6. Orden de trabajo sugerido (sprint)

| # | Tarea | Esfuerzo | Dependencia |
|---|-------|----------|-------------|
| 1 | Simulador aleatorio | Bajo | — |
| 2 | Pipeline S-1/S-2/S-3 + asignación condicional | Medio | — |
| 3 | Tabs condicionales Análisis | Bajo | Paso 2 |
| 4 | `regla_asignacion` desde BD + turno | Medio | — |
| 5 | Reintento asignación (campo + job) | Medio | Paso 4 |
| 6 | API alerta con técnico | Bajo | Paso 5 |
| 7 | Monitoreo refresh + UI técnico | Bajo | Paso 6 |
| 8 | Prueba E2E con simulador | Bajo | Todos |

---

## 7. Fuera de alcance inmediato (registrar para fase 2)

| Ítem | Notas |
|------|-------|
| **Notificaciones** (`order.created` → WhatsApp/Email) | Stub en `notifications`; activar cuando haya tokens SMTP/WhatsApp |
| **RAG dinámico** | Sustituir `predictmaint-ml/rag.py` por retrieval + LLM; contrato `/rag` se mantiene |
| **Escalado a supervisor** | Cuando `regla_asignacion.fallback` y N reintentos fallidos |
| **Fallos repetitivos** | Job `handleRepetitiveFaultScan` hoy es stub |

---

## 8. Referencias cruzadas

| Tema | Documento / archivo |
|------|---------------------|
| Flujo general y simulador | `DOCUMENTACION_FLUJO_MONITOREO.md` |
| Modelo de datos §6.1 | `DOCUMENTACION_MODELO_DE_DATOS.md` |
| Contrato REST | `DOCUMENTACION_API_CONTRATO.md` |
| Pipeline actual | `predictmaint-api/src/sensor-readings/sensor-readings.service.ts` |
| Asignación actual | `predictmaint-api/src/technicians/technicians.service.ts` |
| Vista Monitoreo | `predictmaint-web/src/components/dashboard/monitoring-view.tsx` |
| Vista Análisis | `predictmaint-web/src/components/dashboard/analysis-view.tsx` |

---

## 9. Definición de “flujo completo”

El flujo de monitoreo simulado se considera **completo hasta selección de técnico** cuando:

1. El simulador aleatorio alimenta la API de forma continua.
2. Monitoreo muestra alertas en vivo con técnico (o reintento programado).
3. Análisis respeta la cadena S-1 → S-2 → S-3 según §2.1.
4. Historial lista órdenes reales generadas por el pipeline.
5. La asignación usa `regla_asignacion` en BD y reintenta según §2.2.

Hasta entonces, el backend ejecuta gran parte del pipeline, pero la **experiencia acordada** y las **reglas de negocio** aún requieren los pasos 1–8 de este documento.
