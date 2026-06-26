# Analítica y Reportes — Documentación técnica

Documento de referencia de **todos los paneles y métricas** de la vista
**"Analítica y Reportes"** (`AnalyticsView`). Cubre, para cada endpoint/método de
analítica: qué calcula, de qué datos (qué órdenes/filtros), su endpoint REST y el
panel del frontend que lo consume con su tipo de gráfico.

## Archivos clave

| Capa | Ruta |
|------|------|
| Servicio backend | `predictmaint-api/src/analytics/analytics.service.ts` |
| Controlador backend | `predictmaint-api/src/analytics/analytics.controller.ts` |
| DTO de filtros | `predictmaint-api/src/analytics/dto/analytics-filters.dto.ts` |
| Vista raíz frontend | `predictmaint-web/src/components/dashboard/analytics-view.tsx` |
| Paneles frontend | `predictmaint-web/src/components/dashboard/analytics/` |
| Hooks SWR | `predictmaint-web/src/presentation/hooks/useAnalytics.ts` |
| Servicio frontend | `predictmaint-web/src/application/services/analytics.service.ts` |
| Repositorio HTTP | `predictmaint-web/src/infrastructure/repositories/analytics.repository.ts` |
| Tipos de filtros frontend | `predictmaint-web/src/lib/types/analytics-filters.ts` |
| Log de mensajes (backend) | `predictmaint-api/src/notifications/notifications.controller.ts` y `notifications.service.ts` |

### Estructura de la vista (`analytics-view.tsx`)

El layout se monta en este orden (todos bajo el `Topbar` "Analítica y Reportes"):

1. `AnalyticsFiltersBar` — barra de filtros global (`reportFilters`).
2. `AnalyticsKpiRow` — 3 KPIs de cabecera (consume `summary`).
3. Grid 2 columnas: `UnattendedPanel` + `FaultAnalyticsPanel`.
4. Grid 2 columnas: `RagEffectivenessPanel` + `RecurrencePanel`.
5. `AvailabilityPanel` (pie chart).
6. `ReliabilityPanel` (MTTR/MTBF, dos gráficos de barras).
7. `PredictionValidationPanel` (tabla + KPIs + modal, filtros propios).
8. `CsvLogTable` (log de mensajes, filtros propios).

---

## 1. Endpoints y métodos de analítica

Cada método del servicio recibe `ParsedAnalyticsFilters` (salvo los que no usan
filtros) construido por `parseAnalyticsFilters(query)` en el controlador.

### Concepto base: "falla confirmada" (intervención humana)

Varios métodos parten de `findOrdenesFallaConfirmada(filters)`. Una **falla
confirmada** es una orden que:

- Tiene **técnico asignado** (`idTecnico != null`, o el técnico filtrado).
- Tiene un `AnalisisFallo` (S-2) con una `ClasificacionFallo` **líder**
  (`esLider: true`) — es decir, un tipo de falla fue clasificado por el pipeline.
- Cae dentro del rango de fechas (`fechaCreacion BETWEEN from AND to`).
- Opcionalmente filtrada por `estado` en el `where` SQL.

Definido en `analytics.service.ts` (`fallaConfirmadaIncludes`, líneas 74-97;
`findOrdenesFallaConfirmada`, líneas 131-153). Sobre el resultado se aplica
`applyAnalyticsFilters` (líneas 112-129), que filtra **en memoria** por:
`tipoFallo` (clasificación líder), `respuestaRag` (último estado RAG vía
`latestRagEstado`) y `decision` (aceptada/rechazada vía `tecnicoDecision`).

---

### 1.1 `getDashboard` — KPIs del día

- **Endpoint:** `GET /analytics/dashboard`
- **Controlador:** `getDashboard()` (líneas 12-16).
- **Sin filtros** (no recibe `ParsedAnalyticsFilters`). Todo se calcula sobre **hoy**
  (`startOfDay()`, medianoche del día actual).
- **Hook:** `useDashboard` / `useDashboardKpis` — refresco cada 5 s (`useAnalytics.ts`, líneas 7-15).

**Qué calcula** (líneas 155-282):

- `totalMaquinas`: `count()` de todas las máquinas.
- Un **"evento S-1"** = orden creada hoy con `AnalisisFallo` (pipeline iniciado:
  regla disparada + evaluación ML). De ahí salen:
  - `pipelinesHoy` / `fallosHoy` / `analisisHoy` = nº de órdenes con análisis hoy.
  - `maquinasEvaluadasHoy` = máquinas distintas evaluadas hoy.
- **Fallos por tipo hoy** (`fallosPorTipoHoy`: HDF, PWF, TWF, OSF, RNF): cuenta
  órdenes de hoy cuyo `AnalisisFallo.prediccion === FALLA` y clasificación líder con
  tipo de fallo (líneas 185-219).
  - `criticosHoy` = nivel `CRITICAL`; `moderadosHoy` = `HIGH` o `MEDIUM`.
  - `fallasDetectadasHoy` = suma de `fallosPorTipoHoy`.
  - `sinIncidenciaHoy` = `pipelinesHoy − fallasDetectadasHoy` (mín. 0).
- **Alertas activas** (estado != `finalizado`): `alertasActivas`, `alertasCriticas`
  (`CRITICAL`), `alertasModeradas` (`HIGH`/`MEDIUM`), `maquinasConAlerta`,
  `sinIncidencia` = `totalMaquinas − maquinasConAlerta`.
- **Precisión del modelo:** toma el modelo S-1 default (`esPrediccion: true,
  esDefault: true`); usa su `accuracy`, o el promedio de `accuracy` de las últimas
  100 predicciones si no hay default. `modeloActivoS1` = nombre (fallback `'XGBoost'`).
- `tasaDeteccion` = `maquinasEvaluadasHoy / totalMaquinas`.
- `tasaFalloGlobal` = `fallasDetectadasHoy / totalMaquinas × 100` (1 decimal).

**Panel frontend:** estos KPIs alimentan el **dashboard principal** (cabecera global),
no la cabecera de la vista de analítica (la cabecera de analítica usa `getSummary`,
ver 1.2). El método queda documentado aquí por pertenecer al módulo de analítica.

---

### 1.2 `getSummary` — Efectividad / RAG (con / sin)

- **Endpoint:** `GET /analytics/summary`
- **Controlador:** `getSummary(query)` (líneas 18-22).
- **Datos:** `findOrdenesFallaConfirmada(filters)` → fallas confirmadas del rango.
- **Hook:** `useAnalyticsSummary(filters)` (líneas 29-31).

**Qué calcula** (líneas 284-315): recorre las órdenes confirmadas y clasifica cada
una en **una sola** categoría:

- `sinAtender`: la orden **no** está `FINALIZADO` (pendiente / en curso / rechazada).
- Si está `FINALIZADO`, mira el **último tipo de solución aplicada**
  (`latestSolutionType`, líneas 41-48):
  - `CON_RAG` → `conRag` (cerró siguiendo el plan RAG).
  - `PROPIA` o `RECHAZADA_MANUAL` → `sinRag` (solución propia del técnico).
- Devuelve: `totalAlertas` (total de fallas confirmadas), `conRag`, `sinRag`,
  `pctConRag` (`conRag / total × 100`), `sinAtender`, `range`.

**Paneles frontend (dos consumidores del mismo `summary`):**

- **`AnalyticsKpiRow`** (`analytics-kpi-row.tsx`): fila de **3 tarjetas KPI**
  animadas — "Fallas confirmadas" (`totalAlertas`), "Resueltas con RAG" (`conRag`),
  "Sin atender" (`sinAtender`).
- **`RagEffectivenessPanel`** (`rag-effectiveness-panel.tsx`): panel **"Efectividad
  del sistema"**. Tipo de gráfico: **barra apilada horizontal** (segmentos `conRag`
  verde / `sinRag` ámbar / `sinAtender` rojo, suman 100 %), más filas con conteo +
  porcentaje y una nota "de las X cerradas, Y % siguieron el plan RAG". Usa
  `buildRagBreakdown(summary)`.

---

### 1.3 `getFaultsByType` — Fallos por tipo

- **Endpoint:** `GET /analytics/faults-by-type`
- **Controlador:** `getFaultsByType(query)` (líneas 24-28).
- **Datos:** `findOrdenesFallaConfirmada(filters)`.
- **Hook:** `useFaultsByType(filters)` (líneas 17-21).

**Qué calcula** (líneas 317-326): agrupa las fallas confirmadas por **código del tipo
de fallo líder** (`tipoFallo?.codigo`, fallback `'RNF'`) y devuelve
`[{ tipoFallo, count }]`.

El **repositorio frontend** (`analytics.repository.ts`, `getFaultsByType`, líneas
60-74) normaliza la respuesta sobre `FAULT_TYPE_ORDER`, garantizando una fila por
cada tipo (HDF, PWF, TWF, OSF, RNF) aunque su `count` sea 0.

**Panel frontend:** **`FaultAnalyticsPanel`** (`fault-analytics-panel.tsx`),
**"Fallos por tipo — Semana actual"**. Tipo de gráfico: lista de **barras de progreso
horizontales** (una por tipo), ancho = `count / max × 100 %`, color por tipo
(`FAULT_COLORS`). Marca "(sin casos)" cuando RNF está en 0.

---

### 1.4 `getUnattended` — Órdenes sin atender

- **Endpoint:** `GET /analytics/unattended`
- **Controlador:** `getUnattended(query)` (líneas 30-34).
- **Hook:** `useUnattendedOrders(filters)` — refresco cada 15 s (líneas 33-37).

**Qué calcula** (líneas 343-413): órdenes en estado **`PENDIENTE`** dentro del rango
(`fechaCreacion BETWEEN from AND to`), opcionalmente por técnico/tipo de fallo. Trae
máquina, técnico, análisis (nivel de riesgo), alerta, respuestas RAG y observaciones.
Tras `applyAnalyticsFilters`, **descarta las que ya tienen respuesta RAG**
(`!o.respuestasRag?.length`) y toma las primeras 20. Por cada una devuelve:
`id` (código de orden), `alertaId`, `maquinaId`, `tecnico` (nombre corto), `nivelRiesgo`,
`minutosSinAtender` (`now − fechaCreacion`), `detectadoEn` (ISO).

**Panel frontend:** **`UnattendedPanel`** (`unattended-panel.tsx`), **"Alertas sin
atender"** (borde superior rojo). Tipo: **lista de tarjetas-enlace** (no es gráfico);
cada fila linkea a `/dashboard/analysis/{maquinaId}?order=...&alert=...`, muestra
tiempo de espera formateado y técnico.

---

### 1.5 `getRecurrentMachines` — Fallos recurrentes (umbral desde config)

- **Endpoint:** `GET /analytics/recurrent-machines`
- **Controlador:** `getRecurrentMachines()` (líneas 36-40). **Sin filtros**.
- **Hook:** `useRecurrentFaults` / alias `useRepetitiveFaults` — refresco cada 30 s
  (líneas 49-54, 74).

**Qué calcula** (líneas 472-512): los umbrales vienen de
**Configuración → Fallos Repetitivos** (`configCatalog.getFallosRepetitivosConfig()`):

- `ventanaDias = repCfg.umbrales.ventanaDias` (default **7**).
- `umbral = repCfg.umbrales.notificar.veces` (default **3**).

Toma órdenes con técnico asignado creadas en los últimos `ventanaDias` días, agrupa por
clave **`maquina:tipoFallo`** (clasificación líder), y devuelve los grupos con
`count >= umbral`, ordenados desc: `{ maquinaId, tipoFallo, ocurrencias, ventanaDias,
escalado: true }`.

> Nota: el panel de "Máquinas con más fallos recurrentes" de la vista usa en realidad
> `getMachineRecurrence` (ver 1.6). `getRecurrentMachines` es el feed de "fallos
> repetitivos escalados" y lo consumen otras vistas/notificaciones.

---

### 1.6 `getMachineRecurrence` — Ranking de máquinas por fallos en ventana

- **Endpoint:** `GET /analytics/machine-recurrence?days=7&minFallos=2`
- **Controlador:** `getMachineRecurrence(days='7', minFallos='2', query)` (líneas 42-54).
- **Hook:** `useMachineRecurrence(7, 2, filters)` (líneas 39-43); la vista lo invoca
  con `useMachineRecurrence(7, 2, reportFilters)`.

**Qué calcula** (líneas 415-470): ventana = `filters.desde/hasta` si se especificó,
si no `[hoy − days, hoy]`. Toma órdenes con `AnalisisFallo.prediccion === FALLA`,
aplica `applyAnalyticsFilters`, cuenta fallos por **código de máquina**, y devuelve
las que tienen `fallos >= minFallos`, ordenadas desc, top 10:
`{ maquinaId, fallos, ventanaDias: days }`.

**Panel frontend:** **`RecurrencePanel`** (`recurrence-panel.tsx`), **"Máquinas con
más fallos recurrentes"**. Tipo: **barras de progreso horizontales** (una por máquina),
ancho = `fallos / max`, color según severidad (`recurrenceSeverity`). Mensaje vacío:
"Ninguna máquina alcanzó {minFallos} fallos en los últimos {ventanaDias} días".

---

### 1.7 `getAvailability` — Disponibilidad de máquinas (pie chart)

- **Endpoint:** `GET /analytics/availability`
- **Controlador:** `getAvailability()` (líneas 56-60). **Sin filtros**.
- **Hook:** `useAvailability()` — refresco cada 15 s (líneas 56-60).

**Qué calcula** (líneas 628-659): "en mantenimiento" = máquina con al menos una orden
**activa** (`PENDIENTE` o `EN_PROGRESO`). Devuelve:
`maquinas.total`, `maquinas.operativas` (`total − enMantenimiento`),
`maquinas.enMantenimiento`, `maquinas.detalleMantenimiento` (códigos ordenados).

**Panel frontend:** **`AvailabilityPanel`** (`availability-panel.tsx`),
**"Disponibilidad de máquinas"**. Tipo de gráfico: **pie chart (donut)** de recharts —
2 segmentos "Operativas" (verde) y "En mantenimiento" (ámbar), con tooltip que añade
porcentaje (`calcPct`), leyenda, lista resumen y línea de detalle con los códigos en
mantenimiento.

---

### 1.8 `getPredictionValidation` — Predicción vs. decisión del técnico

- **Endpoint:** `GET /analytics/prediction-validation`
- **Controlador:** `getPredictionValidation(query)` (líneas 62-66).
- **Default de rango:** `month` (30 días) cuando no se especifica.
- **Hook:** `usePredictionValidation(filters)` (líneas 62-66).

**Qué calcula** (líneas 661-739): contrasta la **predicción automática** del modelo
(falla / tipo) contra la **decisión del técnico** (aceptada / rechazada). Solo incluye
órdenes con **técnico asignado** y **observación técnica registrada**
(`ObservacionTecnica required: true`). Soporta filtro por `estado`, `maquinaId`
(resuelto vía `findMaquinaByCodigo`) y `tipoFallo`. Por cada orden devuelve:

- `orden`, `maquinaId`, `tecnico`.
- `prediccion`: `AnalisisFallo.prediccion`, o derivada (`FALLA` si hay tipo líder).
- `tipoFallo`: código de la clasificación líder.
- `decision`: **`RECHAZADA`** si la última observación tiene
  `decision === RECHAZADA`, o el estado de orden es `RECHAZADA`, o
  `esPrediccionCorrecta === false`; en otro caso **`ACEPTADA`**.
- `esPrediccionCorrecta`, `justificacion` (comentario, solo si rechazada),
  `estado`, `fecha`.

**Panel frontend:** **`PredictionValidationPanel`** (`prediction-validation-panel.tsx`),
**"Validación de predicciones — Modelo vs. Técnico"**. Componentes:

- **4 KPIs** calculados en cliente (`stats`): "Predicciones validadas" (total),
  "Aceptadas", "Rechazadas", "% acertadas" (`aceptadas / total × 100`).
- **Tabla** (`DataTable`): Orden, Máquina, Técnico, Predicción (badge Falla/Sin falla
  + badge tipo), "¿Aceptó / Rechazó?" (badge), Justificación.
- **Modal**: al pulsar el ojo en una fila rechazada, abre un diálogo con la
  justificación del rechazo, badges de predicción/tipo y la fecha.
- **Filtros propios del panel** (`ValidationPanelFilters`): tipo de fallo, decisión,
  máquina; se combinan con `reportFilters` vía `mergePredictionFilters`.

---

### 1.9 `getReliability` — MTTR y MTBF (dos gráficos de barras)

- **Endpoint:** `GET /analytics/reliability`
- **Controlador:** `getReliability(query)` (líneas 68-72).
- **Hook:** `useReliability(filters)` (líneas 68-72).

**Datos** (líneas 519-594): órdenes con **técnico asignado** en el rango
(`fechaCreacion BETWEEN from AND to`), opcionalmente por `tecnicoId` y `maquinaId`
(resuelto con `findMaquinaByCodigo`). Atributos: `idMaquina`, `estado`,
`fechaCreacion`, `fechaInicio`, `fechaFin`.

**Fórmulas exactas:**

- **MTTR** (tiempo medio de reparación) = **promedio de `fechaFin − fechaInicio`**
  únicamente en órdenes **`FINALIZADO`** con `fechaFin`; si falta `fechaInicio`, se usa
  `fechaCreacion` como inicio. Solo se computan duraciones `> 0`.
- **MTBF** (tiempo medio entre fallas) = **promedio de los intervalos (gaps) entre
  detecciones consecutivas** de la **misma máquina**. Se ordenan los `fechaCreacion`
  por máquina y se promedian las diferencias `t[i] − t[i-1]`.
- Conversión a horas con `H = 1000·60·60`. `mtbfHoras` redondea a 1 decimal (`toH`).
- **MTTR sub-hora:** `toMttrH` conserva precisión en minutos cuando la duración es
  `< 1 h` (evita que 3 min se muestren como 0.0 h); para `≥ 1 h` redondea a 1 decimal.

Devuelve:
- `global`: `{ mttrHoras, mtbfHoras, reparaciones, fallas }` (sobre todas las
  reparaciones y todos los gaps acumulados).
- `porMaquina[]`: `{ maquinaId, mttrHoras, mtbfHoras, reparaciones (nº de repairs),
  fallas (nº de detecciones) }`, ordenado por `fallas` desc.
- `range`.

**Panel frontend:** **`ReliabilityPanel`** (`reliability-panel.tsx`),
**"Confiabilidad — MTTR y MTBF"**. Componentes:

- **4 mini-métricas** (`MiniMetric`): MTTR global, MTBF global, Reparaciones, Fallas.
  Formateadas con `fmtMttr`/`fmtMtbf` (min / h / d según magnitud).
- **Dos gráficos de barras separados** (recharts `BarChart`), lado a lado en grid
  `lg:grid-cols-2`:
  - **"MTTR por máquina"** — barras ámbar (`--color-warning`); solo máquinas con
    `reparaciones > 0`.
  - **"MTBF por máquina"** — barras azules de acento (`--color-accent`).
- **Unidad automática por gráfico:**
  - `pickMttrUnit`: `min` si el máx < 1 h, `días` si el máx ≥ 48 h, si no `horas`.
  - `pickMtbfUnit`: `días` si el máx ≥ 48 h, si no `horas`.
  - El valor de cada barra se divide por `div` y se redondea según `decimals`; la
    etiqueta de unidad aparece junto al título de cada gráfico y en el tooltip.

---

### 1.10 `getSensorTrend` — Serie temporal de sensores

- **Endpoint:** `GET /analytics/sensor-trend?variable=rotationalSpeed&hours=24&maquinaId=...`
- **Controlador:** `getSensorTrend(variable, hours, maquinaId?)` (líneas 74-82).
- **Hook:** `useSensorTrend(variable, hours, maquinaId)` (líneas 23-27).

**Qué calcula** (líneas 596-626): lee `LecturaSensor` de las últimas `hours` horas
(`fechaLectura >= now − hours`), opcionalmente por máquina (`findMaquinaByCodigo`),
ordenadas asc, máx **200** puntos. Mapea `variable` a un campo del modelo
(`airTemperature`, `processTemperature`, `rotationalSpeed`/`rpm`, `torque`,
`toolWear`; fallback `rotationalSpeed`). Devuelve `[{ timestamp, value, maquinaId }]`.

**Panel frontend:** no se monta directamente en `AnalyticsView`; es el feed para
gráficos de tendencia de sensores reutilizables (line chart) consumidos por otras
vistas/diálogos de análisis. Documentado aquí por pertenecer al módulo.

---

### Endpoints auxiliares (no en la vista de analítica)

- `GET /analytics/recent-orders` → `getRecentOrders(limit)` (líneas 328-341): últimas
  órdenes con máquina + análisis + lecturas, mapeadas con `ordersService.toResponse`.
- `GET /analytics/export` → `export(...)` (líneas 84-95) / `exportCsv` (líneas 741-743):
  **stub** de exportación CSV (devuelve filas vacías).

---

## 2. Sistema de filtros

### 2.1 Backend — `ParsedAnalyticsFilters` y resolución de fechas

Archivo: `predictmaint-api/src/analytics/dto/analytics-filters.dto.ts`.

**`ParsedAnalyticsFilters`** (líneas 1-11):
```ts
{ range: string; desde?, hasta?: string; tecnicoId?: number; maquinaId?,
  tipoFallo?: string; respuestaRag?: 'aceptado'|'rechazado'|'pendiente';
  decision?: 'aceptada'|'rechazada'; estado?: string }
```

**`parseAnalyticsFilters(query)`** (líneas 13-39): normaliza el querystring crudo:
- `range` default `'week'`; `tecnicoId` → `Number`.
- `maquinaId`/`tipoFallo` se descartan si valen `'todos'`.
- `respuestaRag` solo se acepta si está en `['aceptado','rechazado','pendiente']`.
- `decision` solo si está en `['aceptada','rechazada']`.
- `estado` se descarta si vale `'todos'`.

**`resolveDateRange(filters)`** (líneas 41-52): calcula `{ from, to }`:
- `to` = `hasta` (a las 23:59:59.999) o `now`.
- Si hay `desde` → `from` = `desde` a las 00:00:00.000.
- Si no → `from` = `to − (range === 'month' ? 30 : 7) días`.

`getMachineRecurrence` tiene su propia lógica de ventana (usa `days` salvo que se
pase `desde`).

**Aplicación de filtros:** el `where` SQL filtra por fecha, técnico, estado y máquina;
`applyAnalyticsFilters` (servicio, líneas 112-129) filtra **en memoria** por
`tipoFallo`, `respuestaRag` (vía `latestRagEstado`) y `decision` (vía `tecnicoDecision`).

### 2.2 Frontend — tipos y `analyticsFiltersToParams`

Archivo: `predictmaint-web/src/lib/types/analytics-filters.ts`.

- **`ReportFilters`** (barra global): `range`, `desde`, `hasta`, `tecnicoId`,
  `respuestaRag`.
- **`ValidationPanelFilters`** (panel de validación): `tipoFallo`, `decision`,
  `maquinaId`.
- **`LogPanelFilters`** (log CSV): `tipoFallo`, `maquinaId`, `estado`, `canal`.
- **`AnalyticsFilters`** = `ReportFilters & ValidationPanelFilters & { estado? }` — el
  payload completo que viaja a la API.

**`analyticsFiltersToParams(filters)`** (líneas 39-54): convierte los filtros en
query params, **omitiendo** valores vacíos o `'todos'`. Lo usa
`analytics.repository.ts` en cada llamada (`params: analyticsFiltersToParams(filters)`).

**`mergePredictionFilters(report, validation)`** (líneas 64-69): mezcla la barra
global con los filtros del panel de validación. En `AnalyticsView`:
```ts
const predictionFilters = mergePredictionFilters(reportFilters, validationFilters);
```

**Cómo el front pasa los filtros** (`analytics-view.tsx`):
- `AnalyticsFiltersBar` (`analytics-filters-bar.tsx`) edita `reportFilters` (desde,
  hasta, técnico, Plan RAG; botón "Limpiar" → `DEFAULT_REPORT_FILTERS`).
- `reportFilters` se inyecta en `useAnalyticsSummary`, `useUnattendedOrders`,
  `useFaultsByType`, `useMachineRecurrence`, `useReliability`.
- `PredictionValidationPanel` usa `predictionFilters` (merge) para la query y
  `validationFilters` para sus selects propios.
- `useAvailability`, `useNotificationLog` y `useDashboard` **no** reciben filtros
  (datos globales / en tiempo real). El `CsvLogTable` filtra **en cliente**.

Los controles (`analytics-filter-controls.tsx`) exponen `ReportFilterSelect`,
`AnalyticsDateInput` (input `type=date`) y `AnalyticsFilterField`.

---

## 3. Log de mensajes — `CsvLogTable`

- **Endpoint:** `GET /notifications/log?limit=50`
- **Controlador:** `NotificationsController.getLog` (`notifications.controller.ts`,
  líneas 12-19).
- **Servicio:** `NotificationsService.getLog` (`notifications.service.ts`, líneas
  83-121): pagina `Mensaje` (modelo de mensajes enviados) con `Orden` y `Tecnico`,
  orden `enviadoEn DESC`. Cada fila: `id`, `tecnicoId`, `tecnico`, `ordenId`,
  `maquinas`, `motivo`, `canal`, `tipoEnvio`, `estado`, `enviadoEn`. Respuesta
  paginada (`PaginatedResponse`).
- **Hook:** `useNotificationLog(limit = 50)` (`useAnalytics.ts`, líneas 45-47) →
  `analyticsService.getNotificationLog` → repositorio `getNotificationLog`
  (`/notifications/log`, `params: { limit }`).

**Panel frontend:** **`CsvLogTable`** (`csv-log-table.tsx`), **"Log de mensajes
automáticos"**. No es gráfico: es una **tabla paginada** (`DataTable` + `Pagination`)
con columnas Hora, Técnico, Máquinas, Motivo, Canal, Estado (badge). El frontend pide
hasta 50 ítems (`useNotificationLog(50)`) y **filtra/pagina en cliente**:

- Filtros propios (`LogPanelFilters`): Tipo de fallo (compara con `motivo` vía
  `formatNotificationMotivo`/`matchesTipoFallo`), Máquina (`matchesMaquina` sobre la
  cadena `maquinas` separada por `,`/`;`), Estado
  (`entregado`/`fallido`/`pendiente`) y Canal (`email`/`whatsapp`/`whatsapp_email`).
- Paginación local: `page`/`limit` (10 por defecto) sobre `filteredItems`.

---

## 4. Tabla resumen: panel ↔ endpoint ↔ qué muestra

| Panel (componente) | Endpoint | Método servicio | Hook | Gráfico / UI | Qué muestra |
|---|---|---|---|---|---|
| `AnalyticsKpiRow` | `GET /analytics/summary` | `getSummary` | `useAnalyticsSummary` | 3 tarjetas KPI | Fallas confirmadas, Resueltas con RAG, Sin atender |
| `RagEffectivenessPanel` | `GET /analytics/summary` | `getSummary` | `useAnalyticsSummary` | Barra apilada + filas | Efectividad: con RAG / solución propia / abiertas; % RAG entre cerradas |
| `FaultAnalyticsPanel` | `GET /analytics/faults-by-type` | `getFaultsByType` | `useFaultsByType` | Barras de progreso | Conteo de fallas por tipo (HDF/PWF/TWF/OSF/RNF) |
| `UnattendedPanel` | `GET /analytics/unattended` | `getUnattended` | `useUnattendedOrders` | Lista de tarjetas-enlace | Órdenes PENDIENTE sin respuesta del técnico + tiempo de espera |
| `RecurrencePanel` | `GET /analytics/machine-recurrence` | `getMachineRecurrence` | `useMachineRecurrence` | Barras de progreso | Top máquinas por nº de fallas en la ventana |
| `AvailabilityPanel` | `GET /analytics/availability` | `getAvailability` | `useAvailability` | Pie chart (donut) | Máquinas operativas vs. en mantenimiento |
| `ReliabilityPanel` | `GET /analytics/reliability` | `getReliability` | `useReliability` | 4 KPIs + 2 BarChart | MTTR y MTBF global y por máquina (unidad automática) |
| `PredictionValidationPanel` | `GET /analytics/prediction-validation` | `getPredictionValidation` | `usePredictionValidation` | 4 KPIs + tabla + modal | Predicción del modelo vs. decisión del técnico (aceptó/rechazó + justificación) |
| `CsvLogTable` | `GET /notifications/log` | `NotificationsService.getLog` | `useNotificationLog` | Tabla paginada | Log de mensajes automáticos (Hora, Técnico, Máquinas, Motivo, Canal, Estado) |
| (Dashboard global) | `GET /analytics/dashboard` | `getDashboard` | `useDashboard` | KPIs | KPIs del día (pipelines, fallas detectadas, alertas, precisión modelo) |
| (Tendencias sensor) | `GET /analytics/sensor-trend` | `getSensorTrend` | `useSensorTrend` | Line chart | Serie temporal de una variable de sensor |
| (Fallos repetitivos) | `GET /analytics/recurrent-machines` | `getRecurrentMachines` | `useRecurrentFaults` | Feed/escalado | Máquina+tipo con ocurrencias ≥ umbral (config Fallos Repetitivos) |

> Umbrales de recurrencia: `getRecurrentMachines` lee
> `ConfigCatalogService.getFallosRepetitivosConfig()` →
> `umbrales.notificar.veces` (default **3**) y `umbrales.ventanaDias` (default **7**),
> configurables en **Configuración → Fallos Repetitivos**
> (`config-catalog.service.ts`, líneas 50-72, 195-198).
