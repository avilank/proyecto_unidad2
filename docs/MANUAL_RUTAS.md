# Manual — Rutas del sistema PredictMaint (por módulo)

Listado completo de rutas agrupadas por **módulo funcional**: frontend (Next.js), backend
(NestJS) y servicio ML (FastAPI).

## Direcciones base

| Servicio | URL base (Docker) | URL base (local dev) | Notas |
|---|---|---|---|
| **Web** (Next.js) | `http://localhost:3000` | `http://localhost:3000` | Interfaz de usuario |
| **API** (NestJS) | `http://localhost:3001` | `http://localhost:3004` | Sin prefijo global |
| **ML** (FastAPI) | `http://localhost:8000` | `http://localhost:8001` | Interno; solo lo llama el API |
| **Swagger** | `http://localhost:3001/api/docs` | `http://localhost:3004/api/docs` | Documentación interactiva |

**Autenticación:** todos los endpoints requieren `Authorization: Bearer <JWT>` **excepto** los
marcados como *Público*. El SSE de monitoreo recibe el token por query (`?token=`).

**Generación de fallas (demo):** el cron interno `AutoFaultService` (`DEMO_AUTOFAULT_ENABLED=true`)
inyecta lecturas vía `POST /sensor-readings`. El script `scripts/simulate-sensor-stream.py` es
opcional y no es necesario si el cron está activo.

---

# Parte 1 — Frontend (`predictmaint-web`)

## Módulo: Auth & navegación

| Ruta | Archivo | Descripción | Rol |
|---|---|---|---|
| `/` | `app/page.tsx` | Redirección inicial (login o dashboard) | Todos |
| `/login` | `app/(auth)/login/page.tsx` | Inicio de sesión | Público |

**Layouts compartidos:** `app/layout.tsx` (tema) · `app/dashboard/layout.tsx` (sidebar + guard de rol).

---

## Módulo: Dashboard principal

| Ruta | Archivo | Descripción | Rol |
|---|---|---|---|
| `/dashboard` | `app/dashboard/page.tsx` | KPIs, estado de máquinas, alertas recientes | Supervisor / Jefe |

---

## Módulo: Monitoreo en tiempo real

| Ruta | Archivo | Descripción | Rol |
|---|---|---|---|
| `/dashboard/monitoring` | `app/dashboard/monitoring/page.tsx` | Tarjetas de máquinas, alertas, flujo de asignación (SSE) | Supervisor / Jefe |

**API relacionada:** `GET /monitoring/stream` · `GET /alerts/active`

---

## Módulo: Análisis ML (S-1 / S-2 / S-3)

| Ruta | Archivo | Descripción | Rol |
|---|---|---|---|
| `/dashboard/analysis/[machineId]` | `app/dashboard/analysis/[machineId]/page.tsx` | Predicción, clasificación y plan RAG por máquina | Supervisor / Jefe |

**API relacionada:** `/predictions/*` · `/rag/plan/:orderId`

---

## Módulo: Órdenes de mantenimiento

| Ruta | Archivo | Descripción | Rol |
|---|---|---|---|
| `/dashboard/orders` | `app/dashboard/orders/page.tsx` | Historial, filtros, CSV, reasignación supervisor | Supervisor / Jefe |
| `/dashboard/orders/[id]` | `app/dashboard/orders/[id]/page.tsx` | Detalle, timeline, respuesta RAG, solución | Supervisor / Jefe / Técnico (su orden) |

**API relacionada:** `/orders/*` · `/rag/plan/:orderId/*`

---

## Módulo: Gestión de técnicos

| Ruta | Archivo | Descripción | Rol |
|---|---|---|---|
| `/dashboard/technicians` | `app/dashboard/technicians/page.tsx` | CRUD de técnicos, disponibilidad, turnos | Supervisor / Jefe |

**API relacionada:** `/technicians/*`

---

## Módulo: Analítica y reportes

| Ruta | Archivo | Descripción | Rol |
|---|---|---|---|
| `/dashboard/analytics` | `app/dashboard/analytics/page.tsx` | Efectividad, MTTR/MTBF, validación ML, log mensajes | Supervisor / Jefe |
| `/dashboard/analytics/repetitive` | `app/dashboard/analytics/repetitive/page.tsx` | Detalle de máquinas con fallos recurrentes | Supervisor / Jefe |

**API relacionada:** `/analytics/*` · `/notifications/log` · `/repetitive-faults/*`

---

## Módulo: Configuración del sistema

| Ruta | Archivo | Descripción | Rol |
|---|---|---|---|
| `/dashboard/settings` | `app/dashboard/settings/page.tsx` | Modelos ML, envíos, RAG, alertas, fallos repetitivos | Supervisor / Jefe |

**API relacionada:** `/config` · `/catalog/*` · `/ml-models/*`

---

## Módulo: Perfil de usuario

| Ruta | Archivo | Descripción | Rol |
|---|---|---|---|
| `/dashboard/profile` | `app/dashboard/profile/page.tsx` | Editar nombre y teléfono | Todos |

**API relacionada:** `GET/PATCH /users/me`

---

## Módulo: Mi trabajo (técnico)

| Ruta | Archivo | Descripción | Rol |
|---|---|---|---|
| `/dashboard/my-work` | `app/dashboard/my-work/page.tsx` | Tablero pendientes / completadas | Técnico / Técnico senior |

**API relacionada:** `GET /orders/my-board` · acciones sobre `/orders/:id/*`

---

# Parte 2 — Backend (`predictmaint-api`) por módulo NestJS

> Base: `http://localhost:3001` (Docker) o `http://localhost:3004` (local). Formato: Método · Ruta · Descripción · Acceso.

---

## Módulo: `AuthModule` — Autenticación

| Método | Ruta | Descripción | Acceso |
|---|---|---|---|
| POST | `/auth/login` | Iniciar sesión (JWT + usuario) | **Público** |
| GET | `/auth/me` | Usuario autenticado + permisos | JWT |
| POST | `/auth/logout` | Cerrar sesión | JWT |

---

## Módulo: `AppModule` — Raíz

| Método | Ruta | Descripción | Acceso |
|---|---|---|---|
| GET | `/` | Estado / health del API | JWT |
| GET | `/api/docs` | Swagger UI | JWT |

---

## Módulo: `UsersModule` — Usuarios y perfil

| Método | Ruta | Descripción | Acceso |
|---|---|---|---|
| GET | `/users` | Listar usuarios | JWT |
| GET | `/users/me` | Perfil del usuario autenticado | JWT |
| PATCH | `/users/me` | Actualizar perfil (nombre, teléfono) | JWT |

---

## Módulo: `MachinesModule` — Máquinas

| Método | Ruta | Descripción | Acceso |
|---|---|---|---|
| GET | `/machines` | Listar máquinas | JWT |
| GET | `/machines/:id` | Obtener una máquina | JWT |
| GET | `/machines/:id/readings` | Lecturas de una máquina | JWT |
| POST | `/machines` | Crear máquina | JWT |
| PATCH | `/machines/:id` | Actualizar máquina | JWT |

---

## Módulo: `SensorReadingsModule` — Lecturas y pipeline

| Método | Ruta | Descripción | Acceso |
|---|---|---|---|
| POST | `/sensor-readings` | Registrar lectura y ejecutar pipeline S-1→S-2→S-3 | **Público** |
| GET | `/sensor-readings` | Listar lecturas | JWT |
| GET | `/sensor-readings/:id` | Obtener una lectura | JWT |

**Origen demo:** cron `AutoFaultService` (`DEMO_AUTOFAULT_*` en `.env`).

---

## Módulo: `PredictionsModule` — Inferencia ML (consulta)

| Método | Ruta | Descripción | Acceso |
|---|---|---|---|
| GET | `/predictions/binary/:orderId` | Predicciones binarias S-1 de la orden | JWT |
| GET | `/predictions/multiclass/:orderId` | Clasificación multiclase S-2 de la orden | JWT |
| POST | `/predictions/run/:orderId` | Re-ejecutar inferencia (`{ etapa: S1\|S2 }`) | JWT |

---

## Módulo: `OrdersModule` — Órdenes de mantenimiento

| Método | Ruta | Descripción | Acceso |
|---|---|---|---|
| GET | `/orders` | Listar órdenes (filtros / paginación) | JWT |
| GET | `/orders/my-board` | Tablero del técnico | Técnico |
| GET | `/orders/:id` | Obtener una orden | JWT |
| GET | `/orders/:id/timeline` | Timeline de eventos | JWT |
| POST | `/orders` | Crear orden | JWT |
| POST | `/orders/:id/start` | Iniciar orden (`en_progreso`) | Técnico |
| PATCH | `/orders/:id/status` | Actualizar estado | JWT |
| POST | `/orders/:id/solution` | Registrar solución (finaliza) | Técnico |
| POST | `/orders/:id/reject-prediction` | Rechazar predicción / falsa alarma | Técnico |
| POST | `/orders/:id/reassign` | Reasignar técnico (motivo) | Supervisor / Jefe |
| POST | `/orders/:id/escalate` | Escalar orden (motivo) | JWT |

---

## Módulo: `AlertsModule` — Alertas

| Método | Ruta | Descripción | Acceso |
|---|---|---|---|
| GET | `/alerts/active` | Alertas activas | JWT |
| GET | `/alerts` | Listar alertas | JWT |
| GET | `/alerts/:id` | Obtener una alerta | JWT |
| PATCH | `/alerts/:id/status` | Actualizar estado | JWT |

---

## Módulo: `RagModule` — Plan de acción RAG

| Método | Ruta | Descripción | Acceso |
|---|---|---|---|
| GET | `/rag/plan/:orderId` | Obtener plan RAG | JWT |
| POST | `/rag/plan/:orderId/accept` | Aceptar plan RAG | JWT |
| POST | `/rag/plan/:orderId/reject` | Rechazar plan RAG (motivo) | JWT |
| POST | `/rag/plan/:orderId/regenerate` | Regenerar plan RAG | JWT |

---

## Módulo: `TechniciansModule` — Técnicos

| Método | Ruta | Descripción | Acceso |
|---|---|---|---|
| GET | `/technicians` | Listar técnicos | JWT |
| GET | `/technicians/available` | Técnicos disponibles (estrategia asignación) | JWT |
| GET | `/technicians/:id` | Obtener un técnico | JWT |
| POST | `/technicians` | Crear técnico | JWT |
| PATCH | `/technicians/:id` | Actualizar técnico | JWT |
| DELETE | `/technicians/:id` | Inactivar técnico | JWT |

---

## Módulo: `NotificationsModule` — Notificaciones

| Método | Ruta | Descripción | Acceso |
|---|---|---|---|
| GET | `/notifications/log` | Log de mensajes enviados | JWT |
| POST | `/notifications/send` | Enviar notificación al técnico asignado | JWT |
| GET | `/notifications/next-dispatch` | Próximo envío programado | JWT |

**Integraciones:** SMTP directo (nodemailer) · webhook n8n (`SEND_EMAIL_WEBHOOK`).

---

## Módulo: `RepetitiveFaultsModule` — Fallos repetitivos

| Método | Ruta | Descripción | Acceso |
|---|---|---|---|
| GET | `/repetitive-faults` | Listar fallos repetitivos | JWT |
| GET | `/repetitive-faults/:maquinaId/history` | Historial por máquina | JWT |
| POST | `/repetitive-faults/:id/resolve` | Resolver fallo repetitivo (nota) | JWT |

---

## Módulo: `MlModelsModule` — Catálogo de modelos ML

| Método | Ruta | Descripción | Acceso |
|---|---|---|---|
| GET | `/ml-models` | Listar modelos (`?etapa=S1\|S2`) | JWT |
| PATCH | `/ml-models/:id/activate` | Activar modelo de su etapa | JWT |

---

## Módulo: `ConfigCatalogModule` — Configuración y catálogos

### Rutas `/config`

| Método | Ruta | Descripción | Acceso |
|---|---|---|---|
| GET | `/config` | Obtener configuración del sistema | JWT |
| PATCH | `/config` | Actualizar umbrales, SLA, repetitivos, etc. | JWT |

### Rutas `/catalog`

| Método | Ruta | Descripción | Acceso |
|---|---|---|---|
| GET | `/catalog/fault-types` | Tipos de fallo | JWT |
| GET | `/catalog/risk-levels` | Niveles de riesgo (SLA) | JWT |
| GET | `/catalog/rag-sources` | Fuentes RAG | JWT |
| PATCH | `/catalog/rag-sources/:id` | Activar/desactivar fuente RAG | JWT |
| GET | `/catalog/notification-rules` | Reglas de notificación por nivel | JWT |
| PATCH | `/catalog/notification-rules/:nivel` | Actualizar regla (canal / destinatario) | JWT |
| GET | `/catalog/escalation-actions` | Acciones escaladas por tipo | JWT |
| PATCH | `/catalog/escalation-actions/:tipoFallo` | Actualizar acción escalada | JWT |
| GET | `/catalog/dispatch-schedule` | Horarios de envío | JWT |
| PATCH | `/catalog/dispatch-schedule` | Actualizar horarios de envío | JWT |

---

## Módulo: `AnalyticsModule` — Analítica y reportes

| Método | Ruta | Descripción | Acceso |
|---|---|---|---|
| GET | `/analytics/dashboard` | KPIs del dashboard | JWT |
| GET | `/analytics/summary` | Resumen de efectividad | JWT |
| GET | `/analytics/faults-by-type` | Fallos por tipo | JWT |
| GET | `/analytics/unattended` | Órdenes sin atender | JWT |
| GET | `/analytics/recurrent-machines` | Máquinas con fallos recurrentes | JWT |
| GET | `/analytics/machine-recurrence` | Ranking por fallos en ventana | JWT |
| GET | `/analytics/availability` | Disponibilidad de máquinas | JWT |
| GET | `/analytics/prediction-validation` | Predicción vs. decisión del técnico | JWT |
| GET | `/analytics/reliability` | MTTR y MTBF | JWT |
| GET | `/analytics/sensor-trend` | Serie temporal de sensores | JWT |
| GET | `/analytics/export` | Exportar CSV (stub) | JWT |

---

## Módulo: `MonitoringModule` — Tiempo real (SSE)

| Método | Ruta | Descripción | Acceso |
|---|---|---|---|
| GET (SSE) | `/monitoring/stream` | Stream de eventos en vivo | Token query `?token=` |

---

## Módulo: `JobsModule` — Tareas programadas (sin rutas HTTP)

| Servicio | Frecuencia | Función |
|---|---|---|
| `AutoFaultService` | cada min (respeta `DEMO_AUTOFAULT_MIN`) | Inyecta fallas demo → `POST /sensor-readings` |
| `AssignmentRetryService` | cada min | Reintenta asignación de técnico |
| `EscalationService` | cada 30 s | Escalamiento por SLA vencido |
| `JobsService` | horario / diario | Limpieza y mantenimiento |

---

## Módulo: `MlGatewayModule` — Puente al servicio ML (interno)

No expone rutas propias. Llama a FastAPI desde `SensorReadingsModule`, `RagModule` y `PredictionsModule`.

| Destino FastAPI | Uso |
|---|---|
| `POST /predict` | Pipeline S-1 |
| `POST /classify` | Pipeline S-2 |
| `POST /rag` | Pipeline S-3 |

---

# Parte 3 — Servicio ML (`predictmaint-ml`)

## Módulo: Inferencia FastAPI

> Base `http://localhost:8000` (Docker) o `http://localhost:8001` (local). Cabecera `X-API-Key`.
> **No** lo llama el navegador; solo `MlGatewayModule`.

| Método | Ruta | Etapa | Descripción |
|---|---|---|---|
| GET | `/health` | — | Estado + modelos cargados |
| POST | `/predict` | **S-1** | Predicción binaria (FALLA / SIN_FALLA) |
| POST | `/classify` | **S-2** | Clasificación de tipo de fallo |
| POST | `/rag` | **S-3** | Generación del plan de acción |

## Módulo: Entrenamiento offline (sin HTTP)

| Componente | Descripción |
|---|---|
| `train.py` | Entrena 6 modelos y genera `artifacts/*.joblib` |
| `ai4i2020.csv` | Dataset AI4I 2020 |
| `features.py` · `models.py` · `rag.py` | Preproceso, carga de modelos y RAG |

---

# Resumen por módulo

| Capa | Módulos | Rutas |
|---|---|---|
| **Frontend** | 10 módulos funcionales | 13 páginas + 2 layouts |
| **Backend** | 17 módulos NestJS (+ Jobs sin HTTP) | ~62 REST + 1 SSE |
| **ML** | Inferencia + entrenamiento | 4 endpoints HTTP + scripts offline |

**Públicos (sin JWT):** `POST /auth/login` · `POST /sensor-readings`

**SSE:** `GET /monitoring/stream?token=`

---

# Mapa rápido Frontend ↔ Backend

| Módulo frontend | Módulos API principales |
|---|---|
| Dashboard | `AnalyticsModule`, `AlertsModule` |
| Monitoreo | `MonitoringModule`, `AlertsModule`, `MachinesModule` |
| Análisis ML | `PredictionsModule`, `RagModule`, `OrdersModule` |
| Órdenes | `OrdersModule`, `RagModule` |
| Técnicos | `TechniciansModule` |
| Analítica | `AnalyticsModule`, `NotificationsModule`, `RepetitiveFaultsModule` |
| Configuración | `ConfigCatalogModule`, `MlModelsModule` |
| Perfil | `UsersModule` |
| Mi trabajo | `OrdersModule`, `RagModule` |
| Auth | `AuthModule` |
