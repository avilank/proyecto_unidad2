# Color Map — tokens del design system (PredictMaint)

> Cómo traducir un literal `#xxxxxx` del dump al token de `src/styles/theme.css`.
> **Regla**: si un hex está en esta tabla, usá el token. Si no (one-off), usá utility Tailwind
> apuntando al token más cercano, o inline si es decorativo único (con `/* one-off: razón */`).

> **Procedencia de los valores**:
> - ✅ **Confirmado** = extraído del render real del Figma (captura del Login muestreada pixel a pixel).
> - 🟡 **Propuesto** = derivado de las convenciones de estado del prototipo (NORMAL/ALERTA/FALLO,
>   niveles de riesgo). Pendiente de verificar contra el Figma cuando se reponga la cuota del MCP
>   (plan Starter agotado). Son valores sensatos para un tema oscuro; ajustar si difieren.

---

## Tema
Dark, dashboard industrial. Fondo azul-carbón muy oscuro, superficies apenas más claras,
texto casi-blanco lila, **acento celeste** `#309ce4`.

---

## Fondos y superficies (✅ confirmados)

| Hex | Token | Utility | Uso |
|-----|-------|---------|-----|
| `#0b0d14` | `--color-bg-deep` | `bg-bg-deep` | Fondo más profundo / panel lateral |
| `#0c0e15` | `--color-bg` | `bg-bg` | Fondo de página (dominante) |
| `#151822` | `--color-surface` | `bg-surface` | Card / panel |
| `#1c202c` | `--color-surface-2` | `bg-surface-2` | Superficie elevada / hover de fila |

## Texto (✅ confirmados)

| Hex | Token | Utility | Uso |
|-----|-------|---------|-----|
| `#e4e4f0` | `--color-ink` | `text-ink` | Texto primario / títulos |
| `#8490a8` | `--color-ink-soft` | `text-ink-soft` | Texto secundario |
| `#788490` | `--color-ink-muted` | `text-ink-muted` | Texto terciario / placeholders |

## Acento / primario (✅ confirmados)

| Hex | Token | Utility | Uso |
|-----|-------|---------|-----|
| `#309ce4` | `--color-accent` | `bg-accent` / `text-accent` | Botón primario, links, foco, series principales |
| `#2490cc` | `--color-accent-2` | `bg-accent-2` | Hover / gradiente del acento |
| `#2478b4` | `--color-accent-deep` | `bg-accent-deep` | Estado activo / borde de acento |

## Bordes (✅ confirmado / 🟡 alpha)

| Hex / valor | Token | Utility | Uso |
|-------------|-------|---------|-----|
| `#1c202c` | `--color-border` | `border-border` | Borde estándar de card |
| `rgba(255,255,255,0.06)` 🟡 | `--color-border-soft` | `border-border-soft` | Divider sutil |

---

## Estados — semáforo operativo (🟡 propuestos, verificar en Figma)

El prototipo usa estados NORMAL / ALERTA / FALLO y badges de algoritmo y de estado de orden.
Paleta propuesta para dark theme:

| Rol | Hex base | Hex suave (bg/badge) | Token | Uso |
|-----|----------|----------------------|-------|-----|
| Éxito / NORMAL / Finalizado | `#22c55e` | `rgba(34,197,94,0.15)` | `--color-success` | Estado normal, sin incidencia |
| Advertencia / ALERTA / En Progreso | `#f59e0b` | `rgba(245,158,11,0.15)` | `--color-warning` | Alerta moderada |
| Peligro / FALLO / Crítico | `#ef4444` | `rgba(239,68,68,0.15)` | `--color-danger` | Fallo detectado, repetitivo |
| Info / Pendiente | `#309ce4` | `rgba(48,156,228,0.15)` | `--color-info` | (usa el acento) |

## Niveles de riesgo (`ensemble_avg`) — (🟡 propuestos)

Mapean a `nivel_riesgo` del modelo de datos. Sugerencia de gradiente verde→rojo:

| Nivel | Hex | Token | Utility |
|-------|-----|-------|---------|
| LOW | `#22c55e` | `--color-risk-low` | `text-risk-low` / `bg-risk-low/15` |
| MEDIUM | `#f59e0b` | `--color-risk-medium` | `text-risk-medium` |
| HIGH | `#fb923c` | `--color-risk-high` | `text-risk-high` |
| CRITICAL | `#ef4444` | `--color-risk-critical` | `text-risk-critical` |

## Tipos de fallo (badges) — (🟡 propuestos, opcional)
Si se quiere color por tipo de fallo (HDF/PWF/TWF/OSF/RNF), reusar la paleta de estados o
definir tokens `--color-fault-hdf` etc. Por defecto: HDF→danger, PWF→warning, TWF→accent,
OSF→`#a855f7`, RNF→ink-muted. **Confirmar con el Figma.**

---

## Tipografía (🟡 a confirmar)
El render no expuso la familia exacta (sin variables en el Figma). Por defecto del proyecto:

| Rol | Familia | Peso | Tamaño aprox. |
|-----|---------|------|----------------|
| Display / título de vista | `Inter` (o la del sistema) | 600–700 | 28–34 px |
| Subtítulo / sección | `Inter` | 600 | 16–20 px |
| Body | `Inter` | 400–500 | 13–15 px |
| Label / meta / chips | `Inter` | 500–600 | 11–13 px |
| Números KPI | `Inter` | 700 | 24–32 px |

Tokens: `font-sans` (Inter) para todo; agregá `font-display` solo si el Figma usa otra.
**Verificar familia real contra el Figma al reponer la cuota MCP.**

---

## Radii (🟡 a confirmar)

| Valor | Token | Utility | Uso típico |
|-------|-------|---------|-----------|
| `8px` | `--radius-sm` | `rounded-sm` | inputs, chips |
| `12px` | `--radius-md` | `rounded-md` | botones, badges grandes |
| `16px` | `--radius-lg` | `rounded-lg` | cards / paneles |
| `9999px` | `--radius-full` | `rounded-full` | avatars, pills, dots de estado |

## Sombras (🟡 a confirmar)
En dark theme las sombras se notan poco; usar borde + leve elevación.

| Token | Valor sugerido | Uso |
|-------|----------------|-----|
| `--shadow-card` | `0 4px 16px rgba(0,0,0,0.35)` | Card elevada |
| `--shadow-pop` | `0 8px 24px rgba(0,0,0,0.45)` | Modal / popover |

---

## Bloque `@theme` inicial para `src/styles/theme.css`

```css
@theme {
  /* Fondos */
  --color-bg-deep: #0b0d14;
  --color-bg: #0c0e15;
  --color-surface: #151822;
  --color-surface-2: #1c202c;
  /* Texto */
  --color-ink: #e4e4f0;
  --color-ink-soft: #8490a8;
  --color-ink-muted: #788490;
  /* Acento */
  --color-accent: #309ce4;
  --color-accent-2: #2490cc;
  --color-accent-deep: #2478b4;
  /* Bordes */
  --color-border: #1c202c;
  --color-border-soft: rgba(255,255,255,0.06);
  /* Estados (verificar en Figma) */
  --color-success: #22c55e;
  --color-warning: #f59e0b;
  --color-danger: #ef4444;
  --color-info: #309ce4;
  /* Niveles de riesgo */
  --color-risk-low: #22c55e;
  --color-risk-medium: #f59e0b;
  --color-risk-high: #fb923c;
  --color-risk-critical: #ef4444;
  /* Radii */
  --radius-sm: 8px;
  --radius-md: 12px;
  --radius-lg: 16px;
  /* Sombras */
  --shadow-card: 0 4px 16px rgba(0,0,0,0.35);
  --shadow-pop: 0 8px 24px rgba(0,0,0,0.45);
}
```

---

## Cómo crecer este mapa
Al portar una vista nueva:
1. Extraé hex únicos: `rg -o '#[0-9a-fA-F]{6}|rgba?\([^)]+\)' design/code/<vista>/`.
2. ¿Está en esta tabla? → token. ¿No, y aparece 2+ veces? → agregá token. ¿1 sola vez? → inline con doc comment.
3. Actualizá `theme.css` solo si hay tokens nuevos; actualizá este archivo SIEMPRE.
4. Cuando se reponga la cuota del MCP de Figma, **confirmá los valores 🟡** corriendo
   `get_design_context` y reemplazá los propuestos por los reales.
