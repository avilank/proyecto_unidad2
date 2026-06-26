# Manual — Rutas del sistema PredictMaint (por módulo)

Listado completo de rutas agrupadas por **módulo funcional**: frontend (Next.js), backend
(NestJS) y servicio ML (FastAPI). **Cuadro único de endpoints:** [Cuadro general](#cuadro-general--todos-los-endpoints-api--ml).

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

Base URL: `http://localhost:3000` · App Router en `predictmaint-web/src/app/`

## Cuadro resumen — todas las rutas frontend

| # | Ruta | Módulo | Archivo (`src/app/…`) | Componente vista | Rol | Sidebar |
|---:|---|---|---|---|---|---|
| 1 | `/` | Auth & navegación | `page.tsx` | — | Todos | No |
| 2 | `/login` | Auth & navegación | `(auth)/login/page.tsx` | `LoginPage` | Público | No |
| 3 | `/dashboard` | Dashboard principal | `dashboard/page.tsx` | `DashboardView` | Supervisor / Jefe | Sí |
| 4 | `/dashboard/monitoring` | Monitoreo | `dashboard/monitoring/page.tsx` | `MonitoringView` | Supervisor / Jefe | Sí |
| 5 | `/dashboard/analysis/[machineId]` | Análisis ML | `dashboard/analysis/[machineId]/page.tsx` | `AnalysisView` | Supervisor / Jefe | No* |
| 6 | `/dashboard/orders` | Órdenes | `dashboard/orders/page.tsx` | `OrdersHistoryView` | Supervisor / Jefe | Sí |
| 7 | `/dashboard/orders/[id]` | Órdenes | `dashboard/orders/[id]/page.tsx` | `OrderDetailView` | Supervisor / Jefe / Técnico† | No‡ |
| 8 | `/dashboard/technicians` | Técnicos | `dashboard/technicians/page.tsx` | `TechniciansView` | Supervisor / Jefe | Sí |
| 9 | `/dashboard/analytics` | Analítica | `dashboard/analytics/page.tsx` | `AnalyticsView` | Supervisor / Jefe | Sí |
| 10 | `/dashboard/analytics/repetitive` | Analítica | `dashboard/analytics/repetitive/page.tsx` | `RepetitiveAnalyticsPage` | Supervisor / Jefe | No |
| 11 | `/dashboard/settings` | Configuración | `dashboard/settings/page.tsx` | `SettingsView` | Supervisor / Jefe | Sí |
| 12 | `/dashboard/profile` | Perfil | `dashboard/profile/page.tsx` | `ProfileView` | Todos | Sí§ |
| 13 | `/dashboard/my-work` | Mi trabajo | `dashboard/my-work/page.tsx` | `TechnicianBoardView` | Técnico / Técnico senior | Sí¶ |

### Descripción de cada ruta

| # | Ruta | Descripción |
|---:|---|---|
| 1 | **`/`** | Al abrir la raíz del sitio (`http://localhost:3000`), Next.js no muestra contenido: ejecuta una redirección server-side a `/login`. No hay llamada al backend en este paso. |
| 2 | **`/login`** | Pantalla pública de acceso. El usuario ingresa correo y contraseña; el frontend valida el formulario y envía `POST /auth/login`. El backend verifica credenciales (bcrypt), devuelve JWT y datos del usuario. El frontend guarda token y sesión en el navegador y redirige: técnicos → `/dashboard/my-work`; supervisor/jefe → `/dashboard`. |
| 3 | **`/dashboard`** | Panel principal para roles de supervisión. Carga KPIs del día (`GET /analytics/dashboard`), listado de máquinas (`GET /machines`), alertas activas y recientes, y serie temporal de sensores (`GET /analytics/sensor-trend`). Muestra tarjetas de métricas, estado operativo de la planta, tabla de alertas y gráfico configurable por variable y máquina. |
| 4 | **`/dashboard/monitoring`** | Vista de monitoreo en tiempo casi real. Además de REST (máquinas y alertas), abre un canal SSE (`GET /monitoring/stream?token=…`) que recibe eventos cuando entra una lectura de sensor, se crea una alerta u orden o se asigna un técnico. Las tarjetas de máquinas se actualizan sin recargar la página. |
| 5 | **`/dashboard/analysis/[machineId]`** | Análisis ML de una máquina concreta (parámetro dinámico en la URL, p. ej. `M-001`). Localiza la orden asociada y consulta predicción binaria S-1 (`GET /predictions/binary/:orderId`), clasificación multiclase S-2 (`GET /predictions/multiclass/:orderId`) y plan de acción RAG S-3 (`GET /rag/plan/:orderId`). Se accede desde monitoreo o dashboard al pulsar una máquina en alerta. |
| 6 | **`/dashboard/orders`** | Historial de órdenes de mantenimiento para supervisor/jefe. Lista paginada con filtros (estado, máquina, técnico, fechas, búsqueda) vía `GET /orders`. Permite exportar datos a CSV en el cliente y reasignar un técnico con motivo (`POST /orders/:id/reassign`). Cada fila enlaza al detalle `/dashboard/orders/[id]`. |
| 7 | **`/dashboard/orders/[id]`** | Detalle completo de una orden (código p. ej. `ORD-001`). Carga orden, timeline de eventos, predicciones y plan RAG. El técnico asignado puede aceptar o rechazar el plan RAG, iniciar la reparación (`POST /orders/:id/start`) y registrar la solución al terminar (`POST /orders/:id/solution`), lo que finaliza la orden y alimenta MTTR/MTBF. Los técnicos solo ven órdenes propias; supervisores ven todas. |
| 8 | **`/dashboard/technicians`** | Gestión de personal de mantenimiento. CRUD de técnicos: listar (`GET /technicians`), crear (`POST /technicians`), editar disponibilidad, turno y especialidad (`PATCH /technicians/:id`) e inactivar (`DELETE /technicians/:id`). Alimenta el motor de asignación automática del pipeline de sensores. |
| 9 | **`/dashboard/analytics`** | Centro de analítica y reportes. Agrega efectividad del sistema, fallos por tipo, órdenes sin atender, disponibilidad de máquinas, MTTR/MTBF, validación predicción ML vs. decisión del técnico y log de notificaciones enviadas. Cada panel consume endpoints de `/analytics/*` y `/notifications/log` con filtros de rango de fechas. |
| 10 | **`/dashboard/analytics/repetitive`** | Vista de detalle de fallos recurrentes. Muestra máquinas que superaron el umbral de fallos repetidos en la ventana configurada (`GET /repetitive-faults`, `/analytics/recurrent-machines`). Permite revisar casos y marcarlos como resueltos con nota (`POST /repetitive-faults/:id/resolve`). Presentación en formato JSON estructurado. |
| 11 | **`/dashboard/settings`** | Configuración global del sistema. Edición de umbrales y SLA (`GET/PATCH /config`), activación de modelos ML por etapa S-1/S-2 (`/ml-models/*`), fuentes RAG, reglas de notificación por nivel de riesgo, acciones de escalamiento y horarios de envío de mensajes (`/catalog/*`). Solo supervisor/jefe. |
| 12 | **`/dashboard/profile`** | Perfil del usuario autenticado (accesible a todos los roles, incluido técnico). Carga datos con `GET /users/me` y permite actualizar nombre y teléfono con `PATCH /users/me`. Enlace desde el pie del sidebar (avatar). |
| 13 | **`/dashboard/my-work`** | Tablero operativo del técnico. Muestra órdenes pendientes y completadas asignadas al usuario logueado (`GET /orders/my-board`). Desde cada tarjeta se abre el detalle en `/dashboard/orders/[id]` para ejecutar el flujo RAG → iniciar → registrar solución. Es la pantalla de inicio tras login de técnico. |

**Notas del cuadro**

- **Total:** 13 páginas + 2 layouts (`app/layout.tsx`, `app/dashboard/layout.tsx`).
- \* La ruta de análisis se abre desde monitoreo/dashboard; el ítem activo del sidebar es «Monitoreo».
- † Técnicos solo acceden a órdenes asignadas a ellos (`dashboard-shell.tsx`).
- ‡ Enlace desde historial o «Mi trabajo»; no tiene ítem propio en el menú.
- § Enlace en pie del sidebar (avatar / perfil).
- ¶ Menú principal del técnico; resalta también rutas `/dashboard/orders/[id]`.

**API REST / SSE más usada por pantalla**

| Rutas frontend | Endpoints backend |
|---|---|
| `/login` | `POST /auth/login` |
| `/dashboard` | `GET /analytics/dashboard`, `/machines`, `/alerts/active`, `/analytics/sensor-trend` |
| `/dashboard/monitoring` | SSE `GET /monitoring/stream`, `GET /alerts/active`, `/machines` |
| `/dashboard/analysis/[machineId]` | `GET /predictions/binary/:orderId`, `/predictions/multiclass/:orderId`, `/rag/plan/:orderId` |
| `/dashboard/orders` | `GET /orders`, `POST /orders/:id/reassign` |
| `/dashboard/orders/[id]` | `GET /orders/:id`, `/orders/:id/timeline`, `/rag/plan/:orderId/*`, `POST /orders/:id/start`, `/solution` |
| `/dashboard/technicians` | `/technicians/*` |
| `/dashboard/analytics` | `/analytics/*`, `GET /notifications/log` |
| `/dashboard/analytics/repetitive` | `GET /repetitive-faults`, `/analytics/recurrent-machines` |
| `/dashboard/settings` | `GET/PATCH /config`, `/catalog/*`, `/ml-models/*` |
| `/dashboard/profile` | `GET/PATCH /users/me` |
| `/dashboard/my-work` | `GET /orders/my-board` |

---

## Módulo: Auth & navegación

| Ruta | Archivo | Descripción | Rol |
|---|---|---|---|
| `/` | `app/page.tsx` | Redirección inicial a `/login` | Todos |
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

> Base API: `http://localhost:3004` (local) · Base ML: `http://localhost:8001` (local, interno).

---

# Cuadro general — todos los endpoints (API + ML)

Una sola tabla con **método**, **ruta** y **descripción**. Total: **76 API** (75 REST + 1 SSE) + **4 ML** = **80 endpoints HTTP**.

| # | Servicio | Método | Ruta | Descripción |
|---:|---|---|---|---|
| 1 | API | POST | `/auth/login` | Inicia sesión con email y contraseña; valida bcrypt, firma JWT y devuelve token + datos del usuario. **Público.** |
| 2 | API | GET | `/auth/me` | Devuelve perfil del usuario autenticado y permisos CASL. Requiere JWT. |
| 3 | API | POST | `/auth/logout` | Cierra sesión (stateless); el cliente borra el token local. Requiere JWT. |
| 4 | API | GET | `/` | Health check del API NestJS. Requiere JWT. |
| 5 | API | GET | `/api/docs` | Swagger UI — documentación interactiva OpenAPI. Requiere JWT. |
| 6 | API | GET | `/users` | Lista usuarios del sistema (uso administrativo). Requiere JWT. |
| 7 | API | GET | `/users/me` | Perfil editable del usuario autenticado (nombre, correo, teléfono, rol). Requiere JWT. |
| 8 | API | PATCH | `/users/me` | Actualiza nombre y/o teléfono del perfil. Requiere JWT. |
| 9 | API | GET | `/machines` | Lista máquinas con estado operativo y metadatos. Alimenta dashboard y monitoreo. |
| 10 | API | GET | `/machines/:id` | Detalle de una máquina por ID o código. |
| 11 | API | GET | `/machines/:id/readings` | Historial paginado de lecturas de sensores de la máquina. |
| 12 | API | POST | `/machines` | Crea una máquina nueva (CRUD administrativo). |
| 13 | API | PATCH | `/machines/:id` | Actualiza datos de una máquina existente. |
| 14 | API | POST | `/sensor-readings` | **Pipeline predictivo:** persiste lectura, evalúa reglas, ejecuta ML S-1→S-2→S-3, crea alerta/orden, asigna técnico y emite SSE. **Público.** |
| 15 | API | GET | `/sensor-readings` | Listado paginado de lecturas con filtros opcionales. |
| 16 | API | GET | `/sensor-readings/:id` | Detalle de una lectura por ID. |
| 17 | API | GET | `/predictions/binary/:orderId` | Predicciones binarias S-1 persistidas (6 modelos, líder, consenso, riesgo). |
| 18 | API | GET | `/predictions/multiclass/:orderId` | Clasificación multiclase S-2 persistida (tipo de fallo, acuerdo, confianza). |
| 19 | API | POST | `/predictions/run/:orderId` | Re-ejecuta inferencia ML; body `{ etapa: 'S1' \| 'S2' }`. |
| 20 | API | GET | `/orders` | Listado paginado de órdenes con filtros; visibilidad según rol. |
| 21 | API | GET | `/orders/my-board` | Tablero del técnico: órdenes pendientes y completadas asignadas. |
| 22 | API | GET | `/orders/:id` | Detalle completo de una orden (máquina, técnico, estado, SLA). |
| 23 | API | GET | `/orders/:id/timeline` | Línea de tiempo cronológica de eventos de la orden. |
| 24 | API | POST | `/orders` | Crea orden manualmente (fuera del pipeline automático). |
| 25 | API | POST | `/orders/:id/start` | Técnico inicia reparación: estado `en_progreso` + `fechaInicio`. |
| 26 | API | PATCH | `/orders/:id/status` | Cambio genérico de estado con validación de transiciones. |
| 27 | API | POST | `/orders/:id/solution` | Registra solución y finaliza orden; alimenta MTTR/MTBF. |
| 28 | API | POST | `/orders/:id/reject-prediction` | Técnico rechaza predicción ML (falsa alarma) con justificación. |
| 29 | API | POST | `/orders/:id/reassign` | Supervisor reasigna orden a otro técnico con motivo. |
| 30 | API | POST | `/orders/:id/escalate` | Escala orden manualmente con motivo. |
| 31 | API | GET | `/alerts/active` | Alertas en estado activo para dashboard y monitoreo. |
| 32 | API | GET | `/alerts` | Listado paginado de alertas históricas. |
| 33 | API | GET | `/alerts/:id` | Detalle de una alerta. |
| 34 | API | PATCH | `/alerts/:id/status` | Actualiza estado de alerta (reconocida, cerrada, etc.). |
| 35 | API | GET | `/rag/plan/:orderId` | Plan RAG persistido: pasos, fuentes y estado de respuesta del técnico. |
| 36 | API | POST | `/rag/plan/:orderId/accept` | Técnico acepta plan RAG; registra decisión (no inicia la orden). |
| 37 | API | POST | `/rag/plan/:orderId/reject` | Técnico rechaza plan RAG con motivo opcional. |
| 38 | API | POST | `/rag/plan/:orderId/regenerate` | Regenera plan RAG vía ML S-3 (opcionalmente escalado). |
| 39 | API | GET | `/technicians` | Lista técnicos con usuario, especialidad, disponibilidad y turno. |
| 40 | API | GET | `/technicians/available` | Técnicos elegibles para asignación automática (turno, carga). |
| 41 | API | GET | `/technicians/:id` | Detalle de un técnico. |
| 42 | API | POST | `/technicians` | Alta de técnico y usuario vinculado. |
| 43 | API | PATCH | `/technicians/:id` | Edita disponibilidad, turno, especialidad, etc. |
| 44 | API | DELETE | `/technicians/:id` | Inactiva técnico (baja lógica). |
| 45 | API | GET | `/notifications/log` | Historial paginado de mensajes enviados (email/WhatsApp). |
| 46 | API | POST | `/notifications/send` | Dispara notificación al técnico asignado según reglas de canal. |
| 47 | API | GET | `/notifications/next-dispatch` | Próximo envío batch según horarios configurados. |
| 48 | API | GET | `/repetitive-faults` | Máquinas con fallos repetitivos que superaron umbral. |
| 49 | API | GET | `/repetitive-faults/:maquinaId/history` | Historial de fallos repetidos de una máquina. |
| 50 | API | POST | `/repetitive-faults/:id/resolve` | Marca caso repetitivo como resuelto con nota. |
| 51 | API | GET | `/ml-models` | Catálogo de modelos ML por etapa (`?etapa=S1\|S2`) con métricas. |
| 52 | API | PATCH | `/ml-models/:id/activate` | Activa un modelo y desactiva los demás de su etapa. |
| 53 | API | GET | `/config` | Lee configuración global (umbrales, SLA, repetitivos, cooldown). |
| 54 | API | PATCH | `/config` | Actualiza configuración del sistema. |
| 55 | API | GET | `/catalog/fault-types` | Catálogo de tipos de fallo (HDF, PWF, TWF, OSF, RNF). |
| 56 | API | GET | `/catalog/risk-levels` | Niveles de riesgo con tiempos SLA. |
| 57 | API | GET | `/catalog/rag-sources` | Fuentes documentales RAG activas/inactivas. |
| 58 | API | PATCH | `/catalog/rag-sources/:id` | Activa o desactiva una fuente RAG. |
| 59 | API | GET | `/catalog/notification-rules` | Reglas de notificación por nivel de riesgo. |
| 60 | API | PATCH | `/catalog/notification-rules/:nivel` | Actualiza canal y destinatario de una regla. |
| 61 | API | GET | `/catalog/escalation-actions` | Acciones de escalamiento por tipo de fallo. |
| 62 | API | PATCH | `/catalog/escalation-actions/:tipoFallo` | Modifica acción escalada para un tipo de fallo. |
| 63 | API | GET | `/catalog/dispatch-schedule` | Horarios de envío batch de notificaciones. |
| 64 | API | PATCH | `/catalog/dispatch-schedule` | Actualiza horarios de envío. |
| 65 | API | GET | `/analytics/dashboard` | KPIs del día: fallas, tasa global, fallos por tipo, turno. |
| 66 | API | GET | `/analytics/summary` | Resumen de efectividad en rango de fechas. |
| 67 | API | GET | `/analytics/faults-by-type` | Distribución de fallos por tipo en el periodo. |
| 68 | API | GET | `/analytics/unattended` | Órdenes sin atender o fuera de SLA. |
| 69 | API | GET | `/analytics/recurrent-machines` | Máquinas con patrón de fallos recurrentes. |
| 70 | API | GET | `/analytics/machine-recurrence` | Ranking de máquinas por fallos en ventana configurable. |
| 71 | API | GET | `/analytics/availability` | Disponibilidad operativa por máquina o global. |
| 72 | API | GET | `/analytics/prediction-validation` | Cruce predicción ML vs. observación del técnico. |
| 73 | API | GET | `/analytics/reliability` | MTTR y MTBF por máquina. |
| 74 | API | GET | `/analytics/sensor-trend` | Serie temporal de variable de sensor para gráficos. |
| 75 | API | GET | `/analytics/export` | Exportación CSV analítica (stub / parcial). |
| 76 | API | GET (SSE) | `/monitoring/stream` | Stream en vivo de lecturas, alertas y órdenes; JWT en `?token=`. |
| 77 | ML | GET | `/health` | Estado del servicio FastAPI y modelos `.joblib` cargados. |
| 78 | ML | POST | `/predict` | **S-1:** predicción binaria FALLA/SIN_FALLA con 6 modelos y consenso. Llama el API vía `MlGateway`. |
| 79 | ML | POST | `/classify` | **S-2:** clasificación multiclase del tipo de fallo (HDF/PWF/TWF/OSF/RNF). |
| 80 | ML | POST | `/rag` | **S-3:** genera plan de acción con fuentes RAG citadas (pasos, herramientas, precauciones). |

**Públicos API (sin JWT):** #1 · #14 · #76 (token en query).

**ML:** cabecera `X-API-Key`; solo lo invoca el API NestJS, no el navegador.

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

> Endpoints ML (#77–#80) en el [cuadro general](#cuadro-general--todos-los-endpoints-api--ml). Base `:8001` (local). Cabecera `X-API-Key`. Solo lo invoca `MlGatewayModule`.

**Quién llama a cada endpoint ML (desde NestJS)**

| Origen en API | Endpoint ML | Cuándo |
|---|---|---|
| `SensorReadingsService.create()` | `/predict`, `/classify`, `/rag` | Pipeline automático al registrar lectura anómala |
| `PredictionsService.run()` | `/predict` o `/classify` | Re-inferencia manual por etapa |
| `RagService.regenerate()` | `/rag` | Regenerar plan desde UI o escalamiento |

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
| **Backend + ML** | 17 módulos NestJS + FastAPI (+ Jobs sin HTTP) | **80 endpoints HTTP** (76 API + 4 ML) |

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
