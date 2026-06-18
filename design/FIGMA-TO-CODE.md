# De Figma a Producción — Guía oficial (PredictMaint)

> Cómo convertir las vistas del Figma de PredictMaint en componentes reales de `predictmaint-web`.
> **Lectura obligatoria** para devs y agentes IA antes de tocar `src/components/`.
> Complementa a `DOCUMENTACION_ARQUITECTURA.md` (estructura del frontend) y al contrato de API.

---

## 1. Mental model — la regla de oro

```
design/code/  ≠  código de producción
design/code/  =  spec visual de alta fidelidad
```

El TSX en `design/code/` lo genera Figma (Code Connect / get_design_context). Es **una foto del
diseño expresada como JSX**, no una implementación. Por eso:

- Usa **layout absoluto** (`absolute left-[24px] top-[120px]`) — no responsive.
- Usa **literales hex** en cada className (`bg-[#0c0e15]`) — no tokens.
- Usa **URLs de Figma que expiran a los 7 días** para los assets.
- Repite **el mismo átomo** (botón, badge, card, KPI) crudo en cada vista, sin abstracción.
- No tiene **estado, handlers, ni `'use client'`**.

**Sirve para mirar, medir y entender la intención del diseñador. NO para copiar y pegar en `src/`.**

> 🚫 **Anti-pattern crítico**: importar desde `design/code/` dentro de `src/`. Si ves un
> `import ... from "@/design/..."` o `from "../../design/..."` en un PR — bloquéalo.

---

## 2. Dónde vive cada cosa (alineado con la arquitectura)

PredictMaint usa Clean Architecture (ver `DOCUMENTACION_ARQUITECTURA.md` §3). El diseño aterriza así:

| Qué | Dónde |
|-----|-------|
| Átomos compartidos (Button, Badge, Card, KPI, Table…) | `src/components/ui/` |
| Componentes transversales (Sidebar, Topbar, Filtros…) | `src/components/common/` |
| Componentes por vista (dashboard, monitoring, orders…) | `src/components/dashboard/<feature>/` |
| Tokens de color/tipografía/radius/sombra | `src/styles/theme.css` |
| Hooks de datos (SWR) | `src/presentation/hooks/` |
| Estado global | `src/presentation/stores/` (Zustand) |
| Página Next (fina, solo ensambla) | `src/app/.../page.tsx` |

---

## 3. El workflow por vista (6 pasos, en orden — sin saltear)

### Paso 1 — Inventario y extracción de átomos
Antes de tocar la vista, identificá qué se REPITE entre vistas. Eso es un átomo y va a
`src/components/ui/`. Átomos esperados en PredictMaint (ver `INVENTORY.md`):

`Button`, `Badge` (estado/nivel de riesgo/tipo de fallo), `Card`, `KpiCard`, `DataTable`,
`StatusPill`, `Sidebar`, `Topbar`, `Tabs`, `ModelMetricCard`, `ConfusionMatrix`, `ProbabilityBar`,
`Avatar`, `Modal`, `FilterBar`.

**Patrón obligatorio**: **CVA** (`class-variance-authority`) para los variants. Nada de
ternarios sobre className strings. Crear átomo si se usa en **2+ vistas**; si es de una sola,
vive como subcomponente en la carpeta de esa vista.

### Paso 2 — Tokens primero, código después
Barré los hex de la vista y consolidálos en `src/styles/theme.css` como variables. Después se
consumen vía Tailwind. **Los tokens base ya están extraídos en `COLOR-MAP.md`** — usalos.

```tsx
// ❌ ANTES — copiado del dump
<div className="bg-[#0c0e15] text-[#e4e4f0] border-[#1c202c]">
// ✅ DESPUÉS — con tokens
<div className="bg-bg text-ink border-border">
```

Reglas duras: color usado 2+ veces → token; una sola fuente de verdad (el valor vive en
`theme.css`, no se duplica en `tailwind.config`); prohibido `@apply` para reempaquetar utilities.

### Paso 3 — Layout flow, NO absolute positioning
El dump usa `absolute` + coordenadas pixel-perfect (Figma piensa en lienzo). La app piensa en
flujo. Reescribilo con flex/grid + `gap`/`padding`.

```tsx
// ❌ ANTES
<div className="absolute left-[24px] top-[120px] w-[1392px] flex flex-col gap-[24px]">
// ✅ DESPUÉS
<main className="bg-bg min-h-screen">
  <Sidebar /> <Topbar />
  <div className="mx-auto max-w-[1220px] px-6 py-6 flex flex-col gap-6"> ... </div>
</main>
```
Reglas: el root JAMÁS lleva `absolute`; `w-[1220px]` fijo → `max-w-[1220px] mx-auto` + padding;
`left/top` → flex/grid. El layout de PredictMaint es **Sidebar (220px) + contenido (1220px)**.
Agregá breakpoints (`md:`, `lg:`) al portar — el dump es desktop-only.

### Paso 4 — Assets locales
Los `figma.com/api/mcp/asset/...` mueren a los 7 días. Reubicálos:
- **SVG/íconos** → componentes inline en `src/components/ui/icons/` (uno por archivo, named export).
  PredictMaint usa íconos de **lucide-react** para casi todo; solo hacé SVG propio para el logo.
- **Imágenes** → `public/images/<vista>/` + `<Image>` de `next/image`.
- **Nunca** importes URLs de Figma en producción.

### Paso 5 — Data fuera del componente
El dump trae data hardcodeada (M-001, ORD-027, métricas…). Eso va afuera, a un hook SWR que
consume el **contrato de API** (`DOCUMENTACION_API_CONTRATO.md`).

```tsx
// ✅ src/presentation/hooks/use-orders.ts
export function useOrders(filters) { return useSWR(['/orders', filters], fetcher); }
// ✅ src/components/dashboard/orders/orders-table.tsx
export function OrdersTable() {
  const { data, isLoading } = useOrders();
  if (isLoading) return <TableSkeleton />;
  return <DataTable rows={data?.items ?? []} columns={ORDER_COLUMNS} />;
}
```
Loading → `Skeleton`; vacío → `EmptyState`. HTTP siempre vía el `HttpClient`/repositorios de
`src/infrastructure/`.

### Paso 6 — Ensamblar en `src/components/<feature>/`
Armá la vista final con: átomos (paso 1) + tokens (paso 2) + layout flow (paso 3) + assets
locales (paso 4) + hooks (paso 5).

**Naming**: archivos `kebab-case` (`orders-table.tsx`), componentes `PascalCase` (`OrdersTable`),
hooks `use-*.ts`. `'use client'` SOLO si hay estado/handlers/hooks de browser. El `page.tsx` de
Next es fino e importa el componente raíz desde `src/components/`.

---

## 4. Checklist por componente portado
- [ ] Cero `bg-[#hex]` / `text-[#hex]` — todos los colores son tokens (`COLOR-MAP.md`).
- [ ] Cero fuentes inline — utilities `font-sans` / `font-display`.
- [ ] Cero `absolute left-[X] top-[Y]` en el contenedor raíz (sí permitido para overlays puntuales).
- [ ] Cero URLs de Figma — assets en `public/` o íconos (lucide / SVG propio).
- [ ] Cero data hardcodeada — viene de hooks (contrato de API) o props.
- [ ] Variants con **CVA**, no ternarios.
- [ ] Responsive en `sm/md/lg/xl`.
- [ ] `'use client'` solo donde hace falta.
- [ ] Archivo `kebab-case`, componente `PascalCase`.
- [ ] Cero imports desde `design/code/`.

---

## 5. Instrucciones específicas para agentes IA
1. **NUNCA** `cp design/code/... src/components/...`. Rompe el contrato.
2. **SIEMPRE** leé `design/code/<vista>/*Page.tsx` (o la captura) PRIMERO para entender la
   estructura, después aplicá los 6 pasos.
3. Si falta el átomo en `src/components/ui/`, **creálo antes** que el componente que lo consume.
4. Antes de crear un átomo, **buscá con grep** en `src/components/ui/`. Duplicar es peor.
5. Si un hex del dump ya existe como token en `COLOR-MAP.md` — usá el token, no el literal.
6. Antes de portar: leé `DOCUMENTACION_ARQUITECTURA.md`, este archivo, `INVENTORY.md`, `COLOR-MAP.md`.
7. Si el dump choca con la arquitectura — **gana la arquitectura**. Reportá la diferencia.
8. Los datos que pinta cada vista deben mapear a un endpoint del **contrato de API**. Si no existe
   el endpoint, no inventes UI nueva: reportalo.

---

## 6. Orden de implementación sugerido
1. **Fundación**: `theme.css` (tokens de `COLOR-MAP.md`) + átomos ALTA de `INVENTORY.md`
   (Button, Badge, Card, KpiCard, DataTable, StatusPill, Sidebar, Topbar).
2. **Login** — la más simple, valida el theme.
3. **Dashboard** — KPIs + tablas + charts (Recharts).
4. **Monitoreo** y **Análisis (3 tabs)** — el corazón del producto.
5. **Historial / Detalle de Orden / Técnicos**.
6. **Configuración (5 tabs)** y **Analítica (2 vistas)**.
7. Modales (Confirmar RAG, Nuevo Técnico) como `@modal` + intercepting routes.

---

## 7. Referencias
- `DOCUMENTACION_ARQUITECTURA.md` — estructura del frontend (capas, carpetas).
- `DOCUMENTACION_API_CONTRATO.md` — qué endpoint alimenta cada vista.
- `design/code/README.md` — índice de las 19 vistas + nodeIds.
- `design/INVENTORY.md` — átomos compartidos.
- `design/COLOR-MAP.md` — tokens de color/tipografía/radius/sombra.
- Figma: https://www.figma.com/design/QhxPPlp4uHOshh5iX3QWOa/hola--Copia---copia-
