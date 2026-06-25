# Guía — Gráficos de MTTR y MTBF en "Analítica y Reportes"

Documenta las métricas de confiabilidad **MTTR** (tiempo medio de reparación) y **MTBF**
(tiempo medio entre fallas) y su gráfico.

**Estado:** ✅ **IMPLEMENTADO**. Decisiones finales: **dos gráficos de barras separados**
(MTTR y MTBF) + **unidad automática** (horas, o días si ≥ 48 h). Ver §10 para el resumen
de lo construido. Las secciones 1–9 explican el diseño y los cálculos.

---

## 1. Conceptos y fórmulas (adaptados a este proyecto)

### MTTR — *Mean Time To Repair* (tiempo medio de reparación)
**Qué mide:** cuánto se tarda, en promedio, en **reparar** una falla.

**Datos que tenemos:** cada orden tiene `fechaInicio` (cuando el técnico inició) y `fechaFin` (cuando finalizó).

```
duración de reparación (de una orden) = fechaFin − fechaInicio
MTTR = promedio de esas duraciones sobre las órdenes FINALIZADAS
```
- Si `fechaInicio` es null (se finalizó sin "iniciar"), usar `fechaFin − fechaCreacion` como respaldo.
- Se calcula **por máquina** y **global**.
- Unidad sugerida: **horas** (los datos son simulados y las ventanas son de 7–30 días).

> Variante alternativa (si lo prefieres): MTTR = `fechaFin − fechaCreacion` (mide detección→resolución, incluye espera). Documentado por si quieres ese criterio; la guía usa `fechaFin − fechaInicio` (reparación activa).

### MTBF — *Mean Time Between Failures* (tiempo medio entre fallas)
**Qué mide:** cuánto "aguanta" una máquina entre una falla y la siguiente.

**Datos que tenemos:** la `fechaCreacion` (detección) de cada falla por máquina.

**Método recomendado (gaps entre fallas consecutivas):**
```
Para una máquina con fallas en t1 < t2 < t3 < ... < tn:
  gaps = [t2−t1, t3−t2, ..., tn−t(n-1)]
  MTBF(máquina) = promedio(gaps)
MTBF global = promedio de todos los gaps (de todas las máquinas)
```
- Requiere **≥ 2 fallas** de la misma máquina en la ventana; con 1 sola, MTBF es indefinido (mostrar "—").
- Unidad sugerida: **horas** (o días si las ventanas son largas).

> Método alternativo (uptime/fallas): `MTBF = tiempo_operativo_total / nº_fallas`. Requiere definir "tiempo operativo", que aquí no se mide directamente. Por eso se recomienda el método de gaps.

### Qué cuenta como "falla"
Para mantener coherencia con el resto de la analítica, una **falla** = orden con **técnico asignado** (intervención humana / falla confirmada). Para MTTR se usan además solo las **finalizadas**.

---

## 2. Fuente de datos (ya existe, no hay que crear tablas)

| Dato | Modelo (API) | Campo web |
|---|---|---|
| Detección de la falla | `ordenes_mantenimiento.fechaCreacion` | `detectadoEn` |
| Inicio de reparación | `fechaInicio` | `iniciadoEn` |
| Fin de reparación | `fechaFin` | `finalizadoEn` |
| Estado | `estado` (`finalizado`…) | `estado` |
| Máquina | `idMaquina` → `maquina.codigo` | `maquinaId` |
| Confirmada | `idTecnico` no nulo | `tecnicoId` |

**No se requieren migraciones ni columnas nuevas.** Todo se calcula desde `ordenes_mantenimiento`.

---

## 3. Backend — nuevo endpoint `GET /analytics/reliability`

Sigue el patrón existente (`ParsedAnalyticsFilters` + `resolveDateRange`), igual que `getSummary`, `getUnattended`, etc.

### 3.1 Servicio — `analytics.service.ts`

Agregar un método. Pseudocódigo concreto:

```ts
async getReliability(filters: ParsedAnalyticsFilters) {
  const { from, to } = resolveDateRange(filters);

  const where: Record<string, unknown> = {
    fechaCreacion: { [Op.gte]: from, [Op.lte]: to },
    idTecnico: { [Op.ne]: null },               // solo fallas confirmadas
  };
  if (filters.tecnicoId) where.idTecnico = filters.tecnicoId;

  // (filtra por máquina/tipo igual que getMachineRecurrence si se desea)
  const ordenes = await this.ordenModel.findAll({
    where,
    include: [
      { model: Maquina, attributes: ['codigo'] },
      // si filtras por tipoFallo, incluir AnalisisFallo→ClasificacionFallo→TipoFallo
    ],
    order: [['fechaCreacion', 'ASC']],
  });

  // Agrupar por máquina
  const porMaquinaMap = new Map<string, {
    repairMs: number[];   // duraciones de reparación (finalizadas)
    detTimes: number[];   // fechaCreacion de cada falla (para gaps)
  }>();

  for (const o of ordenes) {
    const codigo = o.maquina?.codigo ?? String(o.idMaquina);
    const entry = porMaquinaMap.get(codigo) ?? { repairMs: [], detTimes: [] };

    entry.detTimes.push(new Date(o.fechaCreacion).getTime());

    if (o.estado === EstadoOrden.FINALIZADO && o.fechaFin) {
      const start = o.fechaInicio ?? o.fechaCreacion;     // respaldo
      const ms = new Date(o.fechaFin).getTime() - new Date(start).getTime();
      if (ms > 0) entry.repairMs.push(ms);
    }
    porMaquinaMap.set(codigo, entry);
  }

  const H = 1000 * 60 * 60;                                // ms → horas
  const avg = (xs: number[]) => xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null;

  const allRepair: number[] = [];
  const allGaps: number[] = [];

  const porMaquina = [...porMaquinaMap.entries()].map(([maquinaId, e]) => {
    // MTBF: gaps entre detecciones consecutivas (orden ascendente garantizado)
    const sorted = [...e.detTimes].sort((a, b) => a - b);
    const gaps: number[] = [];
    for (let i = 1; i < sorted.length; i++) gaps.push(sorted[i] - sorted[i - 1]);

    allRepair.push(...e.repairMs);
    allGaps.push(...gaps);

    const mttr = avg(e.repairMs);
    const mtbf = avg(gaps);
    return {
      maquinaId,
      mttrHoras: mttr != null ? Math.round((mttr / H) * 10) / 10 : null,
      mtbfHoras: mtbf != null ? Math.round((mtbf / H) * 10) / 10 : null,
      reparaciones: e.repairMs.length,
      fallas: e.detTimes.length,
    };
  }).sort((a, b) => b.fallas - a.fallas);

  const mttrGlobal = avg(allRepair);
  const mtbfGlobal = avg(allGaps);

  return {
    global: {
      mttrHoras: mttrGlobal != null ? Math.round((mttrGlobal / H) * 10) / 10 : null,
      mtbfHoras: mtbfGlobal != null ? Math.round((mtbfGlobal / H) * 10) / 10 : null,
      reparaciones: allRepair.length,
      fallas: porMaquina.reduce((s, m) => s + m.fallas, 0),
    },
    porMaquina,
    range: filters.range,
  };
}
```

### 3.2 Controller — `analytics.controller.ts`

```ts
@Get('reliability')
@ApiOperation({ summary: 'MTTR y MTBF por máquina y global' })
getReliability(@Query() query: Record<string, string>) {
  return this.analyticsService.getReliability(parseAnalyticsFilters(query));
}
```

> No hace falta tocar el módulo: `Orden` y `Maquina` ya están en el `forFeature` de `AnalyticsModule`.

---

## 4. Frontend — capas (siguiendo el patrón de los otros paneles)

### 4.1 Tipo — `core/types/api.ts`
```ts
export interface ReliabilityMachine {
  maquinaId: string;
  mttrHoras: number | null;
  mtbfHoras: number | null;
  reparaciones: number;
  fallas: number;
}
export interface ReliabilityResponse {
  global: { mttrHoras: number | null; mtbfHoras: number | null; reparaciones: number; fallas: number };
  porMaquina: ReliabilityMachine[];
  range?: string;
}
```

### 4.2 Repositorio — `infrastructure/repositories/analytics.repository.ts`
```ts
getReliability(filters: ParsedAnalyticsFilters): Promise<ReliabilityResponse> {
  return apiClient.get<ReliabilityResponse>('/analytics/reliability', { params: filters });
}
```
*(Mira cómo se pasan los `params` en los otros métodos del repo — algunos serializan los `ReportFilters`.)*

### 4.3 Servicio — `application/services/analytics.service.ts`
```ts
getReliability(filters): Promise<ReliabilityResponse> {
  return analyticsRepository.getReliability(filters);
}
```

### 4.4 Hook — `presentation/hooks/useAnalytics.ts`
```ts
export function useReliability(filters: ReportFilters) {
  return useSWR(['/analytics/reliability', filters], () =>
    analyticsService.getReliability(toApiFilters(filters)),
  );
}
```
*(Reusa la misma conversión de `ReportFilters` → query que usan `useAnalyticsSummary`, `useFaultsByType`, etc.)*

### 4.5 Componente del gráfico — `components/dashboard/analytics/reliability-panel.tsx`

Usa **recharts** (igual que `availability-panel.tsx`). MTTR y MTBF tienen escalas distintas, así que lo más claro son **dos barras por máquina con dos ejes Y** o **dos mini-gráficos**. Recomendado: un `BarChart` con doble eje.

```tsx
'use client';
import {
  Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer,
  Tooltip, XAxis, YAxis,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import type { ReliabilityResponse } from '@/core/types/api';

export function ReliabilityPanel({ data, isLoading }:
  { data?: ReliabilityResponse; isLoading?: boolean }) {
  if (isLoading) return <Skeleton className="h-[360px] w-full" />;
  const rows = data?.porMaquina ?? [];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Confiabilidad — MTTR y MTBF</CardTitle>
        <p className="text-xs text-ink-muted">
          MTTR = tiempo medio de reparación · MTBF = tiempo medio entre fallas (horas)
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* KPIs globales */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Metric label="MTTR global" value={fmt(data?.global.mttrHoras)} />
          <Metric label="MTBF global" value={fmt(data?.global.mtbfHoras)} />
          <Metric label="Reparaciones" value={data?.global.reparaciones ?? 0} />
          <Metric label="Fallas" value={data?.global.fallas ?? 0} />
        </div>

        {rows.length === 0 ? (
          <p className="py-10 text-center text-sm text-ink-muted">Sin datos en el rango</p>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={rows}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
              <XAxis dataKey="maquinaId" tick={{ fontSize: 12, fill: 'var(--color-ink-muted)' }} />
              <YAxis yAxisId="left" tick={{ fontSize: 12, fill: 'var(--color-ink-muted)' }} />
              <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 12, fill: 'var(--color-ink-muted)' }} />
              <Tooltip contentStyle={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 8, fontSize: 12 }} />
              <Legend formatter={(v) => <span className="text-xs text-ink-soft">{v}</span>} />
              <Bar yAxisId="left"  dataKey="mttrHoras" name="MTTR (h)" fill="var(--color-warning)" radius={[4,4,0,0]} />
              <Bar yAxisId="right" dataKey="mtbfHoras" name="MTBF (h)" fill="var(--color-accent)"  radius={[4,4,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}

const fmt = (h?: number | null) => (h == null ? '—' : `${h} h`);
function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-md border border-border-soft bg-surface-2 p-3">
      <p className="text-xs text-ink-muted">{label}</p>
      <p className="mt-1 text-2xl font-bold text-ink">{value}</p>
    </div>
  );
}
```

### 4.6 Integración — `components/dashboard/analytics-view.tsx`
```tsx
import { ReliabilityPanel } from '@/components/dashboard/analytics/reliability-panel';
// ...
const reliability = useReliability(reportFilters);
// dentro del JSX, donde quieras (p. ej. tras AvailabilityPanel):
<ReliabilityPanel data={reliability.data} isLoading={reliability.isLoading} />
```
El panel **respeta los filtros** de la barra de analítica (rango/fechas/máquina) porque pasa `reportFilters`.

---

## 5. Diseño del gráfico (decisiones)

- **MTTR y MTBF tienen magnitudes muy distintas** (MTTR suele ser minutos/horas; MTBF, horas/días). Por eso el ejemplo usa **doble eje Y** (MTTR a la izquierda, MTBF a la derecha). Alternativa más simple: **dos `BarChart` separados** uno al lado del otro.
- **Unidad:** horas. Si las ventanas son largas (mes), puedes mostrar MTBF en **días** (divide por 24) y MTTR en horas.
- **KPIs globales** arriba (MTTR/MTBF promedio + nº reparaciones/fallas) dan el resumen de un vistazo.
- Colores con variables del tema (`--color-warning`, `--color-accent`) → funciona en **modo claro y oscuro**.

---

## 6. Casos borde y advertencias (ser honesto en la expo)

- **MTBF necesita ≥ 2 fallas** de la misma máquina en la ventana. Con datos simulados y ventana corta, muchas máquinas darán `MTBF = —`. Sube la ventana (mes) o genera más fallas con el simulador.
- **Datos simulados:** los tiempos vienen del simulador, no de planta real; MTTR/MTBF son representativos del flujo, no de la realidad física.
- **MTTR depende de que el técnico "inicie" y "finalice"** la orden (para tener `fechaInicio`/`fechaFin`). Órdenes rechazadas o sin finalizar no cuentan para MTTR.
- **Definición elegida:** MTTR = reparación activa (`fin − inicio`), MTBF = gaps entre detecciones. Si tu profesor espera otra definición (p. ej. MTTR detección→resolución), cámbiala en el servicio (un renglón).

---

## 7. Checklist de archivos

**Backend**
- [ ] `analytics/analytics.service.ts` → método `getReliability()`
- [ ] `analytics/analytics.controller.ts` → `GET /analytics/reliability`
- (Módulo: sin cambios — `Orden` y `Maquina` ya están registrados)

**Frontend**
- [ ] `core/types/api.ts` → `ReliabilityResponse`, `ReliabilityMachine`
- [ ] `infrastructure/repositories/analytics.repository.ts` → `getReliability()`
- [ ] `application/services/analytics.service.ts` → `getReliability()`
- [ ] `presentation/hooks/useAnalytics.ts` → `useReliability()`
- [ ] `components/dashboard/analytics/reliability-panel.tsx` → gráfico (recharts)
- [ ] `components/dashboard/analytics-view.tsx` → render del panel

---

## 8. Cómo probar
1. Reinicia el API.
2. Corre el simulador para generar varias órdenes (ideal: varias de la misma máquina para que MTBF tenga gaps), e **inícialas y finalízalas** como técnico para que MTTR tenga datos.
3. Analítica → el panel "Confiabilidad — MTTR y MTBF" mostrará las barras por máquina y los KPIs globales.
4. Cambia el rango/máquina en la barra de filtros → el gráfico se recalcula.

---

## 9. Referencias del código (patrones a copiar)
- Endpoint con filtros: `analytics.controller.ts` (`getSummary`, `getUnattended`).
- Servicio con `resolveDateRange` + agrupación: `analytics.service.ts` (`getMachineRecurrence`, `getRecurrentMachines`).
- Gráfico recharts + tema: `components/dashboard/analytics/availability-panel.tsx`.
- Hook SWR con filtros: `presentation/hooks/useAnalytics.ts`.

---

## 10. Estado de implementación ✅

### Decisiones aplicadas
- **Layout:** dos gráficos de barras **separados** (MTTR por máquina · MTBF por máquina), lado a lado, cada uno con su escala.
- **Unidad automática:** cada gráfico se muestra en **horas**; si el valor máximo ≥ 48 h, pasa a **días** (lo indica el título del gráfico). Los KPIs globales se formatean igual (h o d).
- **Definiciones:** MTTR = `fechaFin − fechaInicio` (reparación activa); MTBF = intervalos entre detecciones consecutivas por máquina.
- **Colores con variables del tema** (`--color-warning` para MTTR, `--color-accent` para MTBF) → funciona en claro y oscuro.

### Backend
- `analytics/analytics.service.ts` → método **`getReliability(filters)`** (agrupa por máquina, calcula MTTR/MTBF en horas, global + por máquina, respeta `range`/`desde`/`hasta`/`maquinaId`/`tecnicoId`).
- `analytics/analytics.controller.ts` → **`GET /analytics/reliability`** (usa `parseAnalyticsFilters`).
- Módulo sin cambios (`Orden` y `Maquina` ya registrados).

### Frontend
- `core/types/api.ts` → `ReliabilityResponse`, `ReliabilityMachine`.
- `infrastructure/repositories/analytics.repository.ts` → `getReliability()` (con `analyticsFiltersToParams`).
- `application/services/analytics.service.ts` → `getReliability()`.
- `presentation/hooks/useAnalytics.ts` → **`useReliability(filters)`**.
- `components/dashboard/analytics/reliability-panel.tsx` → **panel nuevo**: 4 KPIs globales + 2 `BarChart` (recharts), con unidad automática.
- `components/dashboard/analytics-view.tsx` → render del panel debajo de "Disponibilidad de máquinas", alimentado con `useReliability(reportFilters)` (respeta los filtros de la barra).

### Respuesta del endpoint (forma real)
```json
{
  "global": { "mttrHoras": 1.3, "mtbfHoras": 40.7, "reparaciones": 5, "fallas": 5 },
  "porMaquina": [
    { "maquinaId": "M-001", "mttrHoras": 1.2, "mtbfHoras": 37, "reparaciones": 3, "fallas": 3 },
    { "maquinaId": "M-002", "mttrHoras": 1.5, "mtbfHoras": 48, "reparaciones": 2, "fallas": 2 }
  ],
  "range": "week"
}
```

### Verificación
- `tsc --noEmit` OK en API (`tsconfig.build.json`) y en Web.
- **Probar:** reiniciar el API → generar órdenes con el simulador, **iniciarlas y finalizarlas** (MTTR) y varias de la misma máquina (MTBF) → Analítica muestra el panel; cambiar rango/máquina recalcula.

### Notas / límites (sin cambios respecto a §6)
- MTBF necesita **≥ 2 fallas** de la misma máquina en la ventana; si no, esa máquina sale "sin datos suficientes".
- Datos simulados → métricas representativas del flujo, no de planta real.
- El toggle de definición (MTTR detección→resolución) sigue siendo un cambio de un renglón en `getReliability` si se quisiera.
</content>
