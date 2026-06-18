# PredictMaint — Vistas de Figma (índice del dump)

Índice de las vistas del Figma de PredictMaint, descompuestas por pantalla para portarlas a
código. Cada vista listará su estructura de componentes y, cuando se genere, su TSX en
`design/code/<vista>/`.

- **Figma file**: https://www.figma.com/design/QhxPPlp4uHOshh5iX3QWOa/hola--Copia---copia-
- **Stack target**: Next.js (App Router) + Tailwind + Clean Architecture (`predictmaint-web`).
- **Tema**: Dark, dashboard industrial. Fondo azul-carbón, acento celeste `#309ce4`.
- **Total vistas**: 19 (1 página de Figma, todas en el lienzo `0:1`).

> ⚠️ **Estado del dump TSX**: el TSX por vista (`design/code/<vista>/*Page.tsx`) **aún no está
> generado**. El MCP de Figma está en plan Starter (6 lecturas/mes) y la cuota se agotó. Para
> generarlo: reponer cuota / subir de plan, y correr `get_design_context` por nodeId (tabla
> abajo). Mientras tanto, esta documentación + `INVENTORY.md` + `COLOR-MAP.md` alcanzan para
> empezar a construir el design system y los componentes base.

---

## Convenciones (cuando se genere el dump)

- Cada vista en su carpeta: `design/code/<vista-kebab>/`.
- `<VistaPascal>Page.tsx` = root (ensambla los hijos). Un archivo = un componente.
- Assets (URLs CDN de Figma, expiran a 7 días) en `code/shared/assets.ts` agrupados por vista.
- `design/code/` es **spec visual**, NO código de producción. Ver `../FIGMA-TO-CODE.md`.

---

## Tabla de vistas (nodeId para `get_design_context`)

| # | Vista | nodeId | Ruta destino (Next) |
|---|-------|--------|---------------------|
| 1 | Login | `4:2` | `/(auth)/login` |
| 2 | Dashboard | `4053:2` | `/dashboard` |
| 3 | Monitoreo en Tiempo Real | `4053:172` | `/dashboard/monitoring` |
| 4 | Análisis — Predicción (TAB 1) | `4053:441` | `/dashboard/analysis/[machineId]` |
| 5 | Análisis — Clasificación (TAB 2) | `4053:649` | `/dashboard/analysis/[machineId]` |
| 6 | Análisis — Recomendaciones (TAB 3) | `4053:906` | `/dashboard/analysis/[machineId]` |
| 7 | Modal — Confirmar Aceptar RAG | `4053:1037` | `@modal` |
| 8 | WhatsApp — Fallo Repetitivo | `4053:1050` | (preview de plantilla) |
| 9 | Historial de Mantenimiento | `4053:1164` | `/dashboard/orders` |
| 10 | Gestión de Técnicos | `4053:1355` | `/dashboard/technicians` |
| 11 | Modal — Nuevo Técnico | `4053:1552` | `@modal` |
| 12 | Detalle de Orden | `4053:1580` | `/dashboard/orders/[id]` |
| 13 | Config — Modelos ML | `4053:1722` | `/dashboard/settings` |
| 14 | Config — Envío de Mensaje | `4053:1848` | `/dashboard/settings` |
| 15 | Config — RAG | `4053:1966` | `/dashboard/settings` |
| 16 | Config — Alertas | `4053:2092` | `/dashboard/settings` |
| 17 | Config — Fallos Repetitivos | `4053:2239` | `/dashboard/settings` |
| 18 | Analítica y Reportes | `4053:4083` | `/dashboard/analytics` |
| 19 | Analítica — Fallos Repetitivos | `4053:4267` | `/dashboard/analytics/repetitive` |

---

## Estructura por vista

### 1. Login (`4:2`)
```
LoginPage
├── LeftPanel            (branding: logo PredictMaint + claim "Anticipa fallos. Protege tu planta.")
└── LoginForm            (email + password + btn "Acceder al sistema" + "Olvidaste tu contraseña?")
```

### 2. Dashboard (`4053:2`)
```
DashboardPage
├── Sidebar
├── Topbar               (título + "3 Alertas activas" + fecha/turno + user)
├── KpiRow               → KpiCard ×4 (Máquinas, Fallos hoy, Tasa de fallo, Precisión modelo)
├── SensorChart          (Variables de sensor — últimas 24h)
├── FaultBreakdown       (Tipos de fallo hoy: HDF/PWF/TWF/OSF)
├── MachineStatusTable   (M-001..M-005 con Tipo + estado FALLO/NORMAL/ALERTA)
└── RecentAlertsTable    (Máquina/Tipo Fallo/Algoritmo/Confianza/Hora/Estado)
```

### 3. Monitoreo en Tiempo Real (`4053:172`)
```
MonitoringPage
├── Sidebar + Topbar     (EN VIVO + reloj)
├── KpiRow               (activas / críticas / moderadas / sin incidencia)
├── MachineList          → MachineCard ×N (RPM/Torque/Tipo/Desgaste + estado del flujo)
├── FlowExplain          (5 pasos del flujo automático S-1→S-2→asignación→orden)
└── AlertsColumn         → AlertCard ×3 + RepetitiveAlertBanner
```

### 4–6. Análisis de Máquina — TABS (`4053:441`, `4053:649`, `4053:906`)
```
AnalysisPage  (3 step-tabs: Predicción ✓ / Clasificación ✓ / Recomendaciones)
├── ContextBanner        (M-001 Tipo H · ensemble_avg · técnico · orden · CRITICAL)
├── TAB1 Predicción      → ModelCard ×3 (RF / RegLog / XGBoost: pred + métricas + matriz) + SensorDataPanel
├── TAB2 Clasificación   → SummaryChips ×4 + ProbabilitiesTable + ModelCard ×3 (DT / SVM / LightGBM)
└── TAB3 Recomendaciones → RagPlan (3 acciones priorizadas + fuentes) + ResponsePanel + RegisterSolution
```

### 7. Modal — Confirmar Aceptar RAG (`4053:1037`)
```
ConfirmRagModal  (orden + máquina + fallo · "¿Aceptas las recomendaciones RAG?" · Confirmar/Cancelar)
```

### 8. WhatsApp — Fallo Repetitivo (`4053:1050`)
```
WhatsAppPreview  (mockup de chat: ALERTA CRITICAL + datos + intervenciones anteriores + link)
```

### 9. Historial de Mantenimiento (`4053:1164`)
```
HistoryPage
├── Sidebar + Topbar
├── FiltersBar           (máquina / estado / tipo fallo / mes / buscar / Exportar)
├── KpiRow               (Pendiente / En Progreso / Finalizado / Total)
└── HistoryTable         (ID Orden/Máquina/Tipo Fallo/Algoritmo/Confianza/Detectado/Técnico/Estado/Acciones)
```

### 10. Gestión de Técnicos (`4053:1355`)
```
TechniciansPage
├── Sidebar + Topbar     (+ Nuevo Técnico)
├── KpiRow               (Total / Disponibles / En intervención / Fuera de turno)
├── AssignRulesPanel     (reglas CRITICAL/HIGH/MEDIUM)
├── SpecialtyMap         (especialidad por tipo de fallo)
└── TechniciansTable     (Técnico/Especialidad/Turno/Estado/Máquinas/Órdenes/Acciones)
```

### 11. Modal — Nuevo Técnico (`4053:1552`)
```
NewTechnicianModal  (nombre / especialidad / turno / máquinas / teléfono / email · Guardar/Cancelar)
```

### 12. Detalle de Orden (`4053:1580`)
```
OrderDetailPage
├── Sidebar + Topbar
├── Timeline             (eventos S-1→S-2→RAG→respuesta→en progreso→finalizado)
├── FaultDetail          (tipo + algoritmo + lecturas de sensor al momento del fallo + RAG)
├── QuickActions         (Marcar En Progreso / Registrar Solución / Escalar / Cerrar)
└── MachineInfo          (tipo, fallos del mes, último mantenimiento, horas, próx. revisión)
```

### 13–17. Configuración — Tabs (`1722`, `1848`, `1966`, `2092`, `2239`)
```
SettingsPage  (tab bar: Modelos ML / Envío de Mensaje / RAG / Alertas / Fallos Repetitivos)
├── Tab1 ModelosML       (selector modelo activo S-1/S-2 + umbral ensemble + agreement + dataset)
├── Tab2 EnvioMensaje    (horarios automáticos + destinatarios por máquina)
├── Tab3 RAG             (fuentes de conocimiento + mapa fallo→recomendación base)
├── Tab4 Alertas         (niveles de riesgo + tiempos límite + plantilla WhatsApp + reglas notif.)
└── Tab5 FallosRepet.    (umbrales de repetitividad + notificaciones + máquinas críticas + acciones escaladas)
```

### 18. Analítica y Reportes (`4053:4083`)
```
AnalyticsPage
├── Sidebar + Topbar
├── KpiRow               (alertas semana / resueltas RAG / sin atender / CSVs hoy)
├── UnattendedPanel      (órdenes pendientes sin respuesta)
├── FaultAnalytics       (fallos por tipo — semana)
├── RagEffectiveness     (% resueltas con/sin RAG / sin atender)
├── RecurrencePanel      (máquinas con más fallos)
└── CsvLogTable          (Hora/Técnico/Máquinas/Motivo/Canal/Estado)
```

### 19. Analítica — Fallos Repetitivos (`4053:4267`)
```
RepetitiveAnalyticsPage
├── Sidebar + Topbar     (tabs: Resumen / Fallos Repetitivos / Log de mensajes)
├── RepConfigBanner      (umbral repetitividad configurable)
├── KpiRow               (máquinas repetitivas / fallos semana / supervisores notif. / reincidencia)
├── RepetitiveTable      (Máquina/Tipo/Fallo/Ocurrencias/Última vez/Estado)
├── InterventionHistory  (historial de una máquina: 3 intervenciones en 7 días)
└── RagEscalation        (plan RAG escalado para fallo repetitivo)
```

---

## Capturas
Colocar los PNG de cada vista en `design/capturas/<Vista>.png` (export desde Figma) para
comparación side-by-side al portar. Hoy solo está disponible la del Login.
