# Descripción de rutas — PredictMaint

Documento narrativo de **cada ruta** del sistema: qué hace el usuario o el sistema, qué envía el frontend, qué procesa el backend (y ML cuando aplica), y **dónde está el código**.

**Bases URL (desarrollo local):** Web `http://localhost:3000` · API `http://localhost:3004` · ML `http://localhost:8001`

**Formato de cada entrada:**
- **Flujo** — descripción en prosa (estilo ejemplo de registro/login).
- **Frontend** — archivos y líneas relevantes.
- **Backend** — controlador, servicio y modelos implicados.
- **ML** — solo si el endpoint llama a FastAPI.

Índice rápido: [Parte 1 Frontend](#parte-1--frontend-predictmaint-web) · [Parte 2 Backend](#parte-2--backend-predictmaint-api) · [Automatización y notificaciones](#módulo-automatización-y-envío-de-notificaciones) · [Parte 3 ML](#parte-3--servicio-ml-predictmaint-ml) · [Jobs programados](#jobs-programados-sin-ruta-http)

---

# Parte 1 — Frontend (`predictmaint-web`)

## Módulo: Auth y navegación

### `GET /` — Redirección inicial

**Flujo:** Al abrir la raíz del sitio, Next.js no muestra contenido propio: redirige automáticamente a `/login`. No hay llamada al backend en este paso.

**Frontend:**
- `predictmaint-web/src/app/page.tsx` — `redirect('/login')`

**Backend:** No aplica.

---

### `GET /login` — Inicio de sesión

**Flujo:** El usuario escribe correo y contraseña en el formulario de login. Al enviar, el frontend valida con Zod y llama a `POST /auth/login`. El backend busca el usuario activo, compara la contraseña con el hash bcrypt y, si es válido, devuelve un JWT (`accessToken`) y datos básicos del usuario (nombre, rol, `tecnicoId`). El frontend guarda token y usuario en el store de sesión (Zustand) y redirige: técnicos → `/dashboard/my-work`; supervisor/jefe → `/dashboard`.

**Frontend:**
- Página: `predictmaint-web/src/app/(auth)/login/page.tsx`
- UI y submit: `predictmaint-web/src/components/auth/login-page.tsx` (líneas 30–46: `authService.login` + `setSession` + `router.push`)
- Servicio: `predictmaint-web/src/application/services/auth.service.ts`
- Repositorio HTTP: `predictmaint-web/src/infrastructure/repositories/auth.repository.ts` (líneas 6–8: `POST /auth/login`)
- Validación: `predictmaint-web/src/lib/validations/login.ts`
- Sesión: `predictmaint-web/src/presentation/stores/sessionStore.ts`

**Backend:**
- Controlador: `predictmaint-api/src/auth/auth.controller.ts` (líneas 13–17: `@Post('login')`)
- Servicio: `predictmaint-api/src/auth/auth.service.ts` (líneas 30–71: búsqueda usuario, `bcrypt.compare`, firma JWT)
- DTO: `predictmaint-api/src/auth/dto/login.dto.ts`
- Modelos: `predictmaint-api/src/database/models/usuario.model.ts`, `tecnico.model.ts`, `rol.model.ts`

---

## Módulo: Dashboard principal

### `GET /dashboard` — KPIs y estado de planta

**Flujo:** Tras autenticarse, supervisor o jefe entra al dashboard. La vista carga en paralelo KPIs (`GET /analytics/dashboard`), lista de máquinas (`GET /machines`), alertas activas (`GET /alerts/active`), alertas recientes y tendencia de sensores (`GET /analytics/sensor-trend`). Con esos datos muestra tarjetas de métricas, tabla de alertas, estado operativo de máquinas y gráfico de variables de sensor.

**Frontend:**
- Página: `predictmaint-web/src/app/dashboard/page.tsx`
- Vista: `predictmaint-web/src/components/dashboard/dashboard-view.tsx` (hooks `useDashboard`, `useMachines`, `useActiveAlerts`, `useSensorTrend`)
- Hooks: `predictmaint-web/src/presentation/hooks/useAnalytics.ts`, `useAlerts.ts`, `useMachines.ts`
- Repositorios: `analytics.repository.ts`, `machine.repository.ts`, `alert.repository.ts`
- Layout con sidebar y guard de rol: `predictmaint-web/src/app/dashboard/layout.tsx`, `predictmaint-web/src/components/common/dashboard-shell.tsx`

**Backend:** Ver endpoints `GET /analytics/dashboard`, `GET /machines`, `GET /alerts/active`, `GET /analytics/sensor-trend` en [Parte 2](#módulo-analyticsmodule--analítica).

---

## Módulo: Monitoreo en tiempo real

### `GET /dashboard/monitoring` — Tarjetas en vivo y asignación

**Flujo:** El supervisor abre monitoreo. La vista obtiene máquinas y alertas activas por REST y abre además una conexión SSE a `GET /monitoring/stream?token=...`. Cada lectura de sensor que entra al pipeline emite eventos SSE (`reading`, `alert`, asignación de técnico, etc.) y la UI actualiza tarjetas sin recargar. El usuario puede ver el flujo de detección → orden → asignación en tiempo casi real.

**Frontend:**
- Página: `predictmaint-web/src/app/dashboard/monitoring/page.tsx`
- Vista: `predictmaint-web/src/components/dashboard/monitoring-view.tsx`
- SSE: `predictmaint-web/src/presentation/hooks/useMonitoringStream.ts` (línea 58: URL con token en query)

**Backend:** `GET /monitoring/stream` (SSE), `GET /alerts/active`, `GET /machines` — ver Parte 2.

---

## Módulo: Análisis ML (S-1 / S-2 / S-3)

### `GET /dashboard/analysis/[machineId]` — Predicción por máquina

**Flujo:** Desde el dashboard o monitoreo, el usuario entra al análisis de una máquina concreta. La vista localiza la orden activa o más reciente de esa máquina y consulta predicciones binarias (`GET /predictions/binary/:orderId`), multiclase (`GET /predictions/multiclass/:orderId`) y el plan RAG (`GET /rag/plan/:orderId`). Muestra consenso de modelos S-1, tipo de fallo S-2 y pasos recomendados S-3.

**Frontend:**
- Página: `predictmaint-web/src/app/dashboard/analysis/[machineId]/page.tsx`
- Vista: `predictmaint-web/src/components/dashboard/analysis-view.tsx`
- Repositorios: `order.repository.ts` (`getBinaryPredictions`, `getMulticlassPredictions`), `rag.repository.ts` (`getPlan`)

**Backend:** `PredictionsModule`, `RagModule`, `OrdersModule` — ver Parte 2.

---

## Módulo: Órdenes de mantenimiento

### `GET /dashboard/orders` — Historial y gestión supervisor

**Flujo:** Supervisor o jefe ve el historial paginado de órdenes con filtros (estado, máquina, técnico, fechas, búsqueda). El frontend llama `GET /orders` con query params. Puede exportar CSV en cliente, reasignar técnico (`POST /orders/:id/reassign`) o abrir el detalle de una fila.

**Frontend:**
- Página: `predictmaint-web/src/app/dashboard/orders/page.tsx`
- Vista: `predictmaint-web/src/components/dashboard/orders-history-view.tsx`
- Servicio: `predictmaint-web/src/application/services/order.service.ts`
- Repositorio: `predictmaint-web/src/infrastructure/repositories/order.repository.ts` (`findAll`, `reassign`)

**Backend:** `GET /orders`, `POST /orders/:id/reassign` — ver Parte 2.

---

### `GET /dashboard/orders/[id]` — Detalle, RAG y cierre

**Flujo:** Al abrir una orden, la vista carga detalle (`GET /orders/:id`), timeline (`GET /orders/:id/timeline`), predicciones y plan RAG. El técnico asignado puede: **aceptar plan RAG** (`POST /rag/plan/:id/accept`) y, en el detalle, **iniciar reparación** (`POST /orders/:id/start`); **rechazar plan RAG** (`POST /rag/plan/:id/reject`); **regenerar plan** (`POST /rag/plan/:id/regenerate`); **registrar solución** (`POST /orders/:id/solution`), lo que finaliza la orden; **escalar** (`POST /orders/:id/escalate`). El endpoint `reject-prediction` existe en backend pero no tiene botón dedicado en la UI actual.

**Frontend:**
- Página: `predictmaint-web/src/app/dashboard/orders/[id]/page.tsx`
- Vista: `predictmaint-web/src/components/dashboard/order-detail-view.tsx` (líneas 71–72: `ragService.accept` + `orderService.startOrder`)
- Panel RAG: `predictmaint-web/src/components/dashboard/rag-technician-response-panel.tsx`
- Servicios: `order.service.ts`, `rag.service.ts`
- Repositorios: `order.repository.ts`, `rag.repository.ts`

**Backend:** `OrdersModule`, `RagModule`, `PredictionsModule` — ver Parte 2.

---

## Módulo: Gestión de técnicos

### `GET /dashboard/technicians` — CRUD de técnicos

**Flujo:** Supervisor lista técnicos (`GET /technicians`), crea nuevos (`POST /technicians`), edita disponibilidad/turno/especialidad (`PATCH /technicians/:id`) o inactiva (`DELETE /technicians/:id`). Cada acción envía el payload al backend y refresca la tabla.

**Frontend:**
- Página: `predictmaint-web/src/app/dashboard/technicians/page.tsx`
- Vista: `predictmaint-web/src/components/dashboard/technicians-view.tsx`
- Servicio: `predictmaint-web/src/application/services/technician.service.ts`
- Repositorio: `predictmaint-web/src/infrastructure/repositories/technician.repository.ts`

**Backend:** `TechniciansModule` — ver Parte 2.

---

## Módulo: Analítica y reportes

### `GET /dashboard/analytics` — Efectividad, MTTR/MTBF, validación ML

**Flujo:** Pantalla de analítica para supervisor/jefe. Carga resumen de efectividad, fallos por tipo, órdenes sin atender, disponibilidad, MTTR/MTBF, validación predicción vs. técnico y log de notificaciones. Cada panel dispara su endpoint REST con filtros de fecha opcionales.

**Frontend:**
- Página: `predictmaint-web/src/app/dashboard/analytics/page.tsx`
- Vista: `predictmaint-web/src/components/dashboard/analytics-view.tsx`
- Paneles: `predictmaint-web/src/components/dashboard/analytics/reliability-panel.tsx`, etc.
- Repositorio: `predictmaint-web/src/infrastructure/repositories/analytics.repository.ts`

**Backend:** `AnalyticsModule`, `NotificationsModule` — ver Parte 2.

---

### `GET /dashboard/analytics/repetitive` — Fallos recurrentes

**Flujo:** Muestra máquinas marcadas con fallos repetitivos (`GET /repetitive-faults` y datos de `GET /analytics/recurrent-machines`). El supervisor puede marcar un caso como resuelto con nota (`POST /repetitive-faults/:id/resolve`).

**Frontend:**
- Página: `predictmaint-web/src/app/dashboard/analytics/repetitive/page.tsx`
- Vista: componente en `components/dashboard/analytics/`
- Repositorio: `config.repository.ts` (`getRepetitiveFaults`, `resolveRepetitiveFault`)

**Backend:** `RepetitiveFaultsModule`, `AnalyticsModule` — ver Parte 2.

---

## Módulo: Configuración del sistema

### `GET /dashboard/settings` — Umbrales, modelos, RAG, notificaciones

**Flujo:** Supervisor edita configuración global (`GET/PATCH /config`), activa modelos ML (`GET /ml-models`, `PATCH /ml-models/:id/activate`), gestiona fuentes RAG, reglas de notificación, acciones de escalamiento y horarios de envío (`/catalog/*`). Los cambios se persisten en PostgreSQL vía la API.

**Frontend:**
- Página: `predictmaint-web/src/app/dashboard/settings/page.tsx`
- Vista: `predictmaint-web/src/components/dashboard/settings-view.tsx`
- Servicios: `config.service.ts`
- Repositorios: `config.repository.ts`, `ml-models.repository.ts`

**Backend:** `ConfigCatalogModule`, `MlModelsModule` — ver Parte 2.

---

## Módulo: Perfil de usuario

### `GET /dashboard/profile` — Editar nombre y teléfono

**Flujo:** Cualquier usuario autenticado (incluido técnico) ve su perfil (`GET /users/me`) y puede actualizar nombre y teléfono (`PATCH /users/me`). Tras guardar, SWR revalida los datos.

**Frontend:**
- Página: `predictmaint-web/src/app/dashboard/profile/page.tsx`
- Servicio: `predictmaint-web/src/application/services/profile.service.ts` (líneas 17–21)
- Hook: `predictmaint-web/src/presentation/hooks/useProfile.ts`

**Backend:** `UsersModule` — ver Parte 2.

---

## Módulo: Mi trabajo (técnico)

### `GET /dashboard/my-work` — Tablero del técnico

**Flujo:** El técnico ve órdenes pendientes y completadas asignadas a él (`GET /orders/my-board`). Desde una tarjeta abre el detalle para aceptar RAG, iniciar, registrar solución, etc.

**Frontend:**
- Página: `predictmaint-web/src/app/dashboard/my-work/page.tsx`
- Vista: `predictmaint-web/src/components/dashboard/technician-board-view.tsx`
- Repositorio: `order.repository.ts` (`getTechnicianBoard`)

**Backend:** `GET /orders/my-board` — ver Parte 2.

---

# Parte 2 — Backend (`predictmaint-api`)

> Prefijo: ninguno. JWT en cabecera `Authorization: Bearer …` salvo rutas **Público**.

---

## Módulo: `AuthModule` — Autenticación

### `POST /auth/login` — Iniciar sesión (**Público**)

**Flujo:** Recibe `{ email, password }`. Busca usuario activo por correo, valida hash bcrypt, resuelve rol y técnico vinculado, firma JWT con payload `{ id, email, rol, tecnicoId }` y devuelve `{ accessToken, user }`.

**Frontend:** `auth.repository.ts` → `login-page.tsx`

**Backend:**
- `predictmaint-api/src/auth/auth.controller.ts` — `@Post('login')`
- `predictmaint-api/src/auth/auth.service.ts` — método `login()`

---

### `GET /auth/me` — Usuario autenticado + permisos CASL

**Flujo:** Con JWT válido, reconstruye perfil del usuario, nombre (técnico o nombres/apellidos), rol y lista de permisos CASL (`accion:subject`). Usado al hidratar sesión o validar acceso.

**Frontend:** `auth.repository.ts` (`getProfile`); puede usarse en guards de cliente.

**Backend:**
- `predictmaint-api/src/auth/auth.controller.ts` — `@Get('me')`
- `predictmaint-api/src/auth/auth.service.ts` — método `me()` (líneas 74–102)
- `predictmaint-api/src/common/casl/casl-ability.factory.ts`

---

### `POST /auth/logout` — Cerrar sesión

**Flujo:** Endpoint stateless: responde `{ ok: true }`. El frontend borra token y usuario del store local; no invalida JWT en servidor.

**Frontend:** `auth.repository.ts` + acción logout en shell/sidebar.

**Backend:**
- `predictmaint-api/src/auth/auth.controller.ts` — `@Post('logout')`
- `predictmaint-api/src/auth/auth.service.ts` — `logout()`

---

## Módulo: `AppModule` — Raíz

### `GET /` — Health del API

**Flujo:** Devuelve estado básico del servicio NestJS. Requiere JWT en entorno normal.

**Frontend:** Sin UI dedicada (herramientas de ops o Swagger).

**Backend:** `predictmaint-api/src/app.controller.ts`

---

### `GET /api/docs` — Swagger UI

**Flujo:** Sirve documentación interactiva OpenAPI de todos los endpoints.

**Frontend:** No consumido por la app; acceso manual en navegador.

**Backend:** Configurado en `predictmaint-api/src/main.ts` (SwaggerModule).

---

## Módulo: `UsersModule` — Usuarios y perfil

### `GET /users` — Listar usuarios

**Flujo:** Devuelve listado de usuarios del sistema (administración interna). No hay pantalla dedicada en el frontend actual.

**Frontend:** Sin consumo directo en UI.

**Backend:**
- `predictmaint-api/src/users/users.controller.ts`
- `predictmaint-api/src/users/users.service.ts`

---

### `GET /users/me` — Perfil del usuario autenticado

**Flujo:** Similar a `/auth/me` pero orientado a datos editables de perfil (nombre, teléfono, correo).

**Frontend:** `profile.service.ts` → `useProfile.ts` → página `/dashboard/profile`

**Backend:**
- `predictmaint-api/src/users/users.controller.ts`
- `predictmaint-api/src/users/users.service.ts`

---

### `PATCH /users/me` — Actualizar perfil

**Flujo:** Recibe campos parciales (nombre, teléfono), valida y persiste en tabla `usuario`. Devuelve perfil actualizado.

**Frontend:** `profile.service.ts` (`updateProfile`)

**Backend:** `users.controller.ts` + `users.service.ts`

---

## Módulo: `MachinesModule` — Máquinas

### `GET /machines` — Listar máquinas

**Flujo:** Lista máquinas con estado operativo, código y metadatos. Alimenta dashboard, monitoreo y filtros de órdenes.

**Frontend:** `machine.repository.ts` → `useMachines.ts`

**Backend:**
- `predictmaint-api/src/machines/machines.controller.ts`
- `predictmaint-api/src/machines/machines.service.ts`

---

### `GET /machines/:id` — Obtener una máquina

**Flujo:** Detalle de una máquina por ID o código interno.

**Frontend:** `machine.repository.ts` (`findById`)

**Backend:** `machines.controller.ts` + `machines.service.ts`

---

### `GET /machines/:id/readings` — Lecturas de una máquina

**Flujo:** Devuelve historial paginado de lecturas de sensores asociadas a la máquina.

**Frontend:** Consumo indirecto en gráficos/análisis si aplica.

**Backend:** `machines.controller.ts` + `machines.service.ts`

---

### `POST /machines` · `PATCH /machines/:id` — Crear / actualizar máquina

**Flujo:** CRUD administrativo de máquinas (código, nombre, ubicación, estado). Sin formulario dedicado en UI principal; útil vía Swagger o seeds.

**Frontend:** Sin UI dedicada.

**Backend:** `machines.controller.ts` + `machines.service.ts`

---

## Módulo: `SensorReadingsModule` — Lecturas y pipeline S-1→S-2→S-3

### `POST /sensor-readings` — Registrar lectura y ejecutar pipeline (**Público**)

**Flujo:** Punto de entrada del pipeline predictivo. Recibe lectura de sensores (temperaturas, RPM, torque, desgaste). El servicio: (1) persiste `lectura_sensor`; (2) evalúa reglas de alerta; (3) si supera umbrales y no hay cooldown, llama ML **S-1** (`POST /predict` vía `MlGatewayService`); (4) si hay falla, crea alerta y orden `pendiente`, clasifica con **S-2** (`POST /classify`); (5) genera plan **S-3** RAG (`POST /rag`); (6) intenta asignar técnico y emite eventos SSE. En demo, el cron `AutoFaultService` inyecta lecturas periódicamente contra este mismo endpoint.

**Frontend:** No lo llama el navegador; origen: sensores simulados, cron demo o script externo.

**Backend:**
- `predictmaint-api/src/sensor-readings/sensor-readings.controller.ts` (líneas 13–17)
- `predictmaint-api/src/sensor-readings/sensor-readings.service.ts` — método `create()`
- `predictmaint-api/src/ml-gateway/ml-gateway.service.ts`
- `predictmaint-api/src/jobs/auto-fault.service.ts` — demo cron

**ML:** `POST /predict`, `POST /classify`, `POST /rag` en FastAPI.

---

### `GET /sensor-readings` · `GET /sensor-readings/:id` — Consultar lecturas

**Flujo:** Listado paginado o detalle de una lectura almacenada. Uso analítico/administrativo.

**Frontend:** Sin pantalla dedicada; posible uso futuro en analítica.

**Backend:** `sensor-readings.controller.ts` + `sensor-readings.service.ts`

---

## Módulo: `PredictionsModule` — Inferencia ML (consulta)

### `GET /predictions/binary/:orderId` — Predicciones S-1 de la orden

**Flujo:** Lee de BD las predicciones binarias guardadas al crear la orden (6 modelos + líder, consenso, nivel de riesgo). No re-ejecuta ML salvo que se use `POST /predictions/run`.

**Frontend:** `order.repository.ts` → análisis y detalle de orden

**Backend:**
- `predictmaint-api/src/predictions/predictions.controller.ts`
- `predictmaint-api/src/predictions/predictions.service.ts`

---

### `GET /predictions/multiclass/:orderId` — Clasificación S-2

**Flujo:** Devuelve resultados multiclase almacenados (tipo de fallo predicho, acuerdo entre modelos, confianza).

**Frontend:** `order.repository.ts`

**Backend:** `predictions.controller.ts` + `predictions.service.ts`

---

### `POST /predictions/run/:orderId` — Re-ejecutar inferencia

**Flujo:** Body `{ etapa: 'S1' | 'S2' }`. Vuelve a llamar al servicio ML para esa orden y actualiza registros en BD. Útil tras cambiar modelo activo.

**Frontend:** Posible desde settings o análisis; no siempre expuesto en UI.

**Backend:** `predictions.controller.ts` + `predictions.service.ts` + `ml-gateway.service.ts`

**ML:** `POST /predict` o `POST /classify`

---

## Módulo: `OrdersModule` — Órdenes de mantenimiento

### `GET /orders` — Listar órdenes

**Flujo:** Listado paginado con filtros. Aplica reglas de visibilidad según rol (técnico solo ve las suyas si aplica).

**Frontend:** `order.repository.ts` → historial de órdenes

**Backend:**
- `predictmaint-api/src/orders/orders.controller.ts` (líneas 29–41)
- `predictmaint-api/src/orders/orders.service.ts` — `findAll()`

---

### `GET /orders/my-board` — Tablero del técnico

**Flujo:** Con JWT de técnico, devuelve `{ pendientes, completadas }` según asignación y estados.

**Frontend:** `order.repository.ts` → `technician-board-view.tsx`

**Backend:** `orders.controller.ts` (líneas 44–47) + `orders.service.ts` — `getTechnicianBoard()`

---

### `GET /orders/:id` — Detalle de orden

**Flujo:** Orden completa con máquina, técnico, predicciones resumidas, estado RAG y fechas SLA.

**Frontend:** `order.repository.ts` → `order-detail-view.tsx`

**Backend:** `orders.controller.ts` + `orders.service.ts` — `findOne()`

---

### `GET /orders/:id/timeline` — Línea de tiempo

**Flujo:** Lista cronológica de eventos (`evento_orden`: creación, asignación, RAG, inicio, solución, escalamiento).

**Frontend:** `order.repository.ts` → timeline en detalle

**Backend:** `orders.controller.ts` + `orders.service.ts` — `getTimeline()`

---

### `POST /orders` — Crear orden manual

**Flujo:** Crea orden fuera del pipeline automático (casos administrativos). Normalmente las órdenes nacen en `sensor-readings`.

**Frontend:** Sin formulario principal en UI.

**Backend:** `orders.controller.ts` + `orders.service.ts` — `create()`

---

### `POST /orders/:id/start` — Iniciar reparación

**Flujo:** Técnico asignado pasa la orden a `en_progreso`, registra `fechaInicio` y evento en timeline. Requiere permisos de técnico.

**Frontend:** `order.repository.ts` (`startOrder`) → `order-detail-view.tsx` (tras aceptar RAG)

**Backend:** `orders.controller.ts` (líneas 71–74) + `orders.service.ts` — `startOrder()`

---

### `PATCH /orders/:id/status` — Actualizar estado

**Flujo:** Cambio genérico de estado con validaciones de transición.

**Frontend:** `order.repository.ts` (`updateStatus`)

**Backend:** `orders.controller.ts` + `orders.service.ts` — `updateStatus()`

---

### `POST /orders/:id/solution` — Registrar solución (finaliza)

**Flujo:** Técnico envía descripción, tipo de solución, flags de validación ML (¿falla real?, ¿predicción correcta?, ¿clasificación correcta?). La orden pasa a `completada`, se guarda `fechaFin`, observaciones y se calculan métricas MTTR.

**Frontend:** `order.repository.ts` (`registerSolution`) → formulario en detalle de orden

**Backend:** `orders.controller.ts` (líneas 87–94) + `orders.service.ts` — `registerSolution()`

---

### `POST /orders/:id/reject-prediction` — Rechazar predicción / falsa alarma

**Flujo:** Técnico indica que la predicción ML fue incorrecta con justificación. Registra evento y puede cerrar o dejar orden en estado especial según reglas de negocio.

**Frontend:** Repositorio implementado (`rejectPrediction`); **sin botón en UI actual**.

**Backend:** `orders.controller.ts` (líneas 97–104) + `orders.service.ts` — `rejectPrediction()`

---

### `POST /orders/:id/reassign` — Reasignar técnico

**Flujo:** Supervisor envía `{ tecnicoId, motivo }`. Cambia asignación, registra evento y puede disparar notificación al nuevo técnico.

**Frontend:** `order.repository.ts` → historial de órdenes

**Backend:** `orders.controller.ts` + `orders.service.ts` — `reassignOrder()`

---

### `POST /orders/:id/escalate` — Escalar orden

**Flujo:** Registra escalamiento manual con motivo; puede activar flujos de notificación o regeneración RAG escalada.

**Frontend:** `order.repository.ts` (`escalate`)

**Backend:** `orders.controller.ts` + `orders.service.ts` — `escalate()`

---

## Módulo: `AlertsModule` — Alertas

### `GET /alerts/active` — Alertas activas

**Flujo:** Devuelve alertas en estado activo para monitoreo y dashboard.

**Frontend:** `alert.repository.ts` → `useActiveAlerts`

**Backend:**
- `predictmaint-api/src/alerts/alerts.controller.ts`
- `predictmaint-api/src/alerts/alerts.service.ts`

---

### `GET /alerts` · `GET /alerts/:id` — Listar / detalle

**Flujo:** Consulta paginada o detalle de alerta histórica.

**Frontend:** `alert.repository.ts`

**Backend:** `alerts.controller.ts` + `alerts.service.ts`

---

### `PATCH /alerts/:id/status` — Actualizar estado

**Flujo:** Cambia estado de alerta (p. ej. reconocida, cerrada).

**Frontend:** Uso limitado en UI; lógica principal en pipeline automático.

**Backend:** `alerts.controller.ts` + `alerts.service.ts`

---

## Módulo: `RagModule` — Plan de acción RAG (S-3)

### `GET /rag/plan/:orderId` — Obtener plan RAG

**Flujo:** Lee recomendación RAG persistida para la orden: pasos, fuentes citadas, estado de respuesta del técnico.

**Frontend:** `rag.repository.ts` → paneles RAG en detalle y análisis

**Backend:**
- `predictmaint-api/src/rag/rag.controller.ts` (líneas 11–14)
- `predictmaint-api/src/rag/rag.service.ts` — `getPlan()`

---

### `POST /rag/plan/:orderId/accept` — Aceptar plan RAG

**Flujo:** Registra decisión `aceptado` en `respuesta_rag` y evento `rag_aceptado`. **No** cambia estado de la orden a `en_progreso`; eso lo hace por separado `POST /orders/:id/start` desde el frontend en detalle de orden.

**Frontend:** `rag.repository.ts` → `order-detail-view.tsx` (accept + startOrder)

**Backend:** `rag.controller.ts` (líneas 17–20) + `rag.service.ts` — `accept()` (líneas 116–130)

---

### `POST /rag/plan/:orderId/reject` — Rechazar plan RAG

**Flujo:** Registra decisión `rechazado` con motivo opcional. La orden suele permanecer `pendiente` hasta otra acción del técnico.

**Frontend:** `rag.repository.ts` → `rag-technician-response-panel.tsx`

**Backend:** `rag.controller.ts` + `rag.service.ts` — `reject()` (líneas 133–148)

---

### `POST /rag/plan/:orderId/regenerate` — Regenerar plan

**Flujo:** Vuelve a llamar ML RAG con tipo de fallo y fuentes (opcionalmente escalado). Reemplaza o versiona recomendación en BD.

**Frontend:** `rag.repository.ts`

**Backend:** `rag.controller.ts` + `rag.service.ts` — `regenerate()` + `ml-gateway.service.ts`

**ML:** `POST /rag`

---

## Módulo: `TechniciansModule` — Técnicos

### `GET /technicians` · `GET /technicians/:id` — Listar / detalle

**Flujo:** Devuelve técnicos con usuario, especialidad, disponibilidad y turno.

**Frontend:** `technician.repository.ts` → vista técnicos y filtros

**Backend:**
- `predictmaint-api/src/technicians/technicians.controller.ts`
- `predictmaint-api/src/technicians/technicians.service.ts`

---

### `GET /technicians/available` — Técnicos disponibles

**Flujo:** Usado por el motor de asignación automática al crear orden: filtra por turno, carga y especialidad.

**Frontend:** Sin UI directa; llamado desde backend en asignación.

**Backend:** `technicians.controller.ts` + `technicians.service.ts`

---

### `POST /technicians` · `PATCH /technicians/:id` · `DELETE /technicians/:id`

**Flujo:** Alta, edición o baja lógica (inactivar) de técnico y usuario vinculado.

**Frontend:** `technician.repository.ts` → `/dashboard/technicians`

**Backend:** `technicians.controller.ts` + `technicians.service.ts`

---

## Módulo: `NotificationsModule` — Notificaciones (endpoints REST)

> Flujo completo de automatización: ver [Módulo Automatización y envío de notificaciones](#módulo-automatización-y-envío-de-notificaciones).

### `GET /notifications/log` — Log de mensajes

**Flujo:** Historial paginado de emails/WhatsApp enviados (canal, destinatario, estado, orden, tipo de envío). Cada fila corresponde a un registro en `mensaje_enviado` creado tras un envío exitoso o fallido.

**Frontend:** `analytics.repository.ts` → tabla en `/dashboard/analytics` (`csv-log-table.tsx`)

**Backend:**
- `predictmaint-api/src/notifications/notifications.controller.ts`
- `predictmaint-api/src/notifications/notifications.service.ts` — `getLog()`

---

### `POST /notifications/send` — Enviar notificación manual

**Flujo:** Recibe `{ orderId, tecnicoId }`. Carga la orden y reutiliza `notifyTechnicianAssignment()` — el mismo pipeline que la asignación automática. Útil para reenvíos o pruebas vía Swagger.

**Frontend:** Sin botón en UI; invocable desde Swagger o scripts.

**Backend:** `notifications.controller.ts` → `notifications.service.ts` — `send()`

---

### `GET /notifications/next-dispatch` — Próximo envío programado

**Flujo:** Endpoint reservado para envíos batch por horario (`/catalog/dispatch-schedule`). Actualmente devuelve `null` (stub); el envío real es **inmediato** al asignar o escalar.

**Frontend:** Settings (horarios de envío); lógica batch en `JobsService` aún stub.

**Backend:** `notifications.service.ts` — `getNextDispatch()`

---

## Módulo: Automatización y envío de notificaciones

Sistema **event-driven** (NestJS `EventEmitter2` + listeners) que avisa por **email** y/o **WhatsApp** cuando se asigna una orden o cuando vence el SLA. No depende de que el usuario pulse un botón en la UI: se dispara desde el pipeline de sensores, los crons de jobs o `POST /notifications/send`.

### Diagrama del flujo

```
Pipeline / reasignación / reintento
        │
        ▼
  ORDER_CREATED_EVENT ──► OrderNotificationListener
        │                      │
        │                      ▼
        │              NotificationsService.notifyTechnicianAssignment()
        │                      │
        │         ┌────────────┼────────────┐
        │         ▼            ▼            ▼
        │    ReglaNotificacion  Fallos      Acciones RAG
        │    (canal/destino)    repetitivos  en mensaje
        │         │
        │         ├──► SMTP directo (nodemailer)     si MAIL_* configurado
        │         └──► Webhook n8n (FormData)        si no hay SMTP + SEND_EMAIL_WEBHOOK
        │
        ▼
  mensaje_enviado (log) ◄── GET /notifications/log

EscalationService (cron 30 s)
        │
        ▼
  ORDER_ESCALATED_EVENT ──► EscalationNotificationListener
        │
        ▼
  NotificationsService.notifyEscalation() ──► supervisores/jefe (webhook)
```

### Flujo 1 — Notificación al asignar técnico

**Flujo:** Cuando el pipeline (`sensor-readings.service.ts`) o `AssignmentRetryService` asigna un técnico, emite `ORDER_CREATED_EVENT` con `{ orderId, tecnicoId, maquinaId, nivelRiesgo }`. `OrderNotificationListener` escucha el evento y llama a `notifyTechnicianAssignment()`. El servicio:

1. Lee la **regla de notificación** del nivel de riesgo (`regla_notificacion`: canal y destinatario).
2. Si destinatario es «Nadie» o canal «Sin notificación», **no envía nada**.
3. Construye el mensaje con `alert-message.builder.ts` (máquina, fallo S-2, lectura, plan RAG, historial, SLA).
4. Evalúa **fallos repetitivos** en ventana: puede añadir aviso al supervisor, marcar reincidencia o anexar plan escalado.
5. Envía al técnico y/o supervisor según regla y toggles de config.
6. Persiste fila en **`mensaje_enviado`** (estado `entregado` o `fallido`).

**Backend:**
- Evento: `predictmaint-api/src/common/events/order.events.ts` — `ORDER_CREATED_EVENT`
- Emisión: `sensor-readings.service.ts` (~línea 533), `assignment-retry.service.ts` (~94), `orders.service.ts` (reasignación)
- Listener: `predictmaint-api/src/notifications/order-notification.listener.ts`
- Lógica: `predictmaint-api/src/notifications/notifications.service.ts` — `notifyTechnicianAssignment()`, `dispatchToTechnician()`, `notifySupervisorsForAlert()`
- Plantillas HTML/texto: `predictmaint-api/src/integrations/email/templates/assignment-notification.template.ts`
- Builder mensaje: `predictmaint-api/src/notifications/alert-message.builder.ts`

---

### Flujo 2 — Reintento automático de asignación

**Flujo:** Cada minuto, `AssignmentRetryService` busca órdenes `pendiente` sin técnico cuyo `proximoReintentoAsignacion` ya venció. Intenta `TechniciansService.assignForOrder()`. Si encuentra técnico, actualiza orden/alerta, registra evento y **vuelve a emitir `ORDER_CREATED_EVENT`** → misma notificación del Flujo 1. Si no hay técnico, programa siguiente reintento según nivel de riesgo.

**Backend:** `predictmaint-api/src/jobs/assignment-retry.service.ts`

---

### Flujo 3 — Escalamiento por SLA y notificación a supervisores

**Flujo:** Cada 30 segundos, `EscalationService` revisa órdenes `pendiente` **con técnico asignado** que superaron el tiempo SLA del nivel (`config` → tiempos de atención). Si aún no fue escalada, crea evento `escalado` en timeline y emite `ORDER_ESCALATED_EVENT`. `EscalationNotificationListener` llama a `notifyEscalation()`, que arma mensaje de escalamiento (técnico que no inició, minutos sin atención, enlace a la orden) y lo envía a **supervisores y jefe de planta** vía **webhook n8n** (WhatsApp + email HTML).

**Backend:**
- Cron: `predictmaint-api/src/jobs/escalation.service.ts`
- Evento: `ORDER_ESCALATED_EVENT` en `order.events.ts`
- Listener: `predictmaint-api/src/notifications/escalation-notification.listener.ts`
- Envío: `notifications.service.ts` — `notifyEscalation()`

---

### Canales de envío (email y WhatsApp)

| Canal | Cuándo se usa | Código |
|-------|----------------|--------|
| **SMTP directo** | `MAIL_HOST` + `MAIL_USER` + `MAIL_PASS` configurados; regla permite email | `integrations/email/smtp-email.service.ts` (nodemailer) |
| **Webhook n8n** | SMTP no configurado **o** WhatsApp; POST multipart a `SEND_EMAIL_WEBHOOK` | `notifications/webhook-notifier.service.ts` |
| **WhatsApp** | Regla incluye canal WhatsApp **y** técnico/supervisor tiene teléfono; técnico con `enviarWssp !== false` | Payload `phone` + `whatsappSummary` al webhook |
| **Email vía webhook** | Sin SMTP pero regla email; técnico con `enviarCorreo === true` o nivel CRITICAL | `emailBody` en FormData al webhook |

El webhook envía FormData con: `email`, `subject`, `title`, `phone`, `whatsappSummary`, `emailBody`, adjunto HTML opcional. n8n/Evolution API procesa el envío externo.

**Variables `.env` (API):**
- `MAIL_HOST`, `MAIL_PORT`, `MAIL_USER`, `MAIL_PASS`, `MAIL_FROM_NAME` — SMTP directo
- `SEND_EMAIL_WEBHOOK` — URL del flujo n8n
- `FRONTEND_URL` — enlaces en mensajes (p. ej. `/dashboard/orders/ORD-001`)

---

### Configuración desde el frontend

**Flujo:** En `/dashboard/settings` → pestaña **Alertas**, el supervisor edita:

- **Umbrales de riesgo** y **tiempos de atención (SLA)** por nivel → `PATCH /config`
- **Reglas de notificación** (canal: Email / WhatsApp / ambos / ninguno; destinatario: técnico / supervisor / ambos / nadie) → `GET/PATCH /catalog/notification-rules/:nivel`
- **Acciones escaladas** por tipo de fallo → `/catalog/escalation-actions`
- **Fallos repetitivos** (umbrales marcar / notificar supervisor / RAG escalado) → `PATCH /config`

Al guardar, las reglas quedan en BD y aplican en el **próximo** envío automático.

**Frontend:**
- `predictmaint-web/src/components/dashboard/settings-view.tsx`
- `predictmaint-web/src/components/dashboard/settings/alerts-settings-tab.tsx`
- `predictmaint-web/src/presentation/hooks/useSettings.ts` — `useNotificationRules`, `saveNotificationRules`
- `predictmaint-web/src/infrastructure/repositories/config.repository.ts` — `getNotificationRules`, `patchNotificationRule`

**Backend catálogo:**
- `predictmaint-api/src/config-catalog/config-catalog.controller.ts` — rutas `/catalog/notification-rules`, `/config`
- Modelo: `predictmaint-api/src/database/models/regla-notificacion.model.ts`

---

### Consulta del log en analítica

**Flujo:** En `/dashboard/analytics`, el panel de log carga `GET /notifications/log?page=&limit=` y muestra canal, técnico, orden, motivo (tipo fallo), estado y fecha.

**Frontend:**
- `predictmaint-web/src/components/dashboard/analytics/csv-log-table.tsx`
- `predictmaint-web/src/infrastructure/repositories/analytics.repository.ts` — `getNotificationLog()`

---

### Endpoints REST del módulo

| Método | Ruta | Uso en automatización |
|--------|------|------------------------|
| GET | `/notifications/log` | Auditoría de envíos |
| POST | `/notifications/send` | Reenvío manual |
| GET | `/notifications/next-dispatch` | Stub horarios batch |
| GET/PATCH | `/catalog/notification-rules/:nivel` | Reglas canal/destinatario |
| GET/PATCH | `/config` | SLA y umbrales repetitivos |
| GET/PATCH | `/catalog/dispatch-schedule` | Horarios batch (futuro) |

---

## Módulo: `RepetitiveFaultsModule` — Fallos repetitivos

### `GET /repetitive-faults` — Listar casos repetitivos

**Flujo:** Máquinas que superaron umbral de fallos en ventana configurada.

**Frontend:** `config.repository.ts` → settings y analítica repetitiva

**Backend:**
- `predictmaint-api/src/repetitive-faults/repetitive-faults.controller.ts`
- `predictmaint-api/src/repetitive-faults/repetitive-faults.service.ts`

---

### `GET /repetitive-faults/:maquinaId/history` — Historial por máquina

**Flujo:** Detalle temporal de fallos repetidos de una máquina.

**Frontend:** Vista analítica repetitiva

**Backend:** `repetitive-faults.controller.ts` + `repetitive-faults.service.ts`

---

### `POST /repetitive-faults/:id/resolve` — Marcar resuelto

**Flujo:** Supervisor registra nota y cierra el caso repetitivo.

**Frontend:** `config.repository.ts` (`resolveRepetitiveFault`)

**Backend:** `repetitive-faults.controller.ts` + `repetitive-faults.service.ts`

---

## Módulo: `MlModelsModule` — Catálogo de modelos

### `GET /ml-models?etapa=S1|S2` — Listar modelos

**Flujo:** Devuelve modelos registrados con métricas y cuál está activo por etapa.

**Frontend:** `ml-models.repository.ts` → settings

**Backend:**
- `predictmaint-api/src/ml-models/ml-models.controller.ts`
- `predictmaint-api/src/ml-models/ml-models.service.ts`

---

### `PATCH /ml-models/:id/activate` — Activar modelo

**Flujo:** Desactiva otros de la misma etapa y marca uno como líder para inferencias futuras.

**Frontend:** `ml-models.repository.ts`

**Backend:** `ml-models.controller.ts` + `ml-models.service.ts`

---

## Módulo: `ConfigCatalogModule` — Configuración y catálogos

### `GET /config` · `PATCH /config`

**Flujo:** Lee o actualiza umbrales ML, SLA, ventanas de fallos repetitivos, cooldown de evaluación, etc.

**Frontend:** `config.repository.ts` → settings

**Backend:** `predictmaint-api/src/config-catalog/config-catalog.controller.ts` + servicios de config

---

### Rutas `/catalog/*`

| Ruta | Flujo resumido | Frontend | Backend |
|------|----------------|----------|---------|
| `GET /catalog/fault-types` | Tipos de fallo para selects y analítica | Indirecto | `config-catalog.controller.ts` |
| `GET /catalog/risk-levels` | SLA por nivel de riesgo | Settings | idem |
| `GET /catalog/rag-sources` | Fuentes documentales RAG | `config.repository.ts` | idem |
| `PATCH /catalog/rag-sources/:id` | Activar/desactivar fuente | `config.repository.ts` | idem |
| `GET/PATCH /catalog/notification-rules` | Canal y destinatario por nivel | Settings | idem |
| `GET/PATCH /catalog/escalation-actions` | Acción por tipo de fallo | Settings | idem |
| `GET/PATCH /catalog/dispatch-schedule` | Horarios de envío batch | Settings | idem |

---

## Módulo: `AnalyticsModule` — Analítica

| Ruta | Flujo resumido | Frontend | Backend |
|------|----------------|----------|---------|
| `GET /analytics/dashboard` | KPIs del día: fallas, tasa, turno | `analytics.repository.ts` → `useDashboard` | `analytics.controller.ts` + `analytics.service.ts` |
| `GET /analytics/summary` | Efectividad en rango de fechas | `analytics.repository.ts` | idem |
| `GET /analytics/faults-by-type` | Distribución por tipo de fallo | idem | idem |
| `GET /analytics/unattended` | Órdenes fuera de SLA | idem | idem |
| `GET /analytics/recurrent-machines` | Máquinas recurrentes | idem | idem |
| `GET /analytics/machine-recurrence` | Ranking en ventana | idem | idem |
| `GET /analytics/availability` | % disponibilidad | idem | idem |
| `GET /analytics/prediction-validation` | Predicción vs. observación técnica | idem | idem |
| `GET /analytics/reliability` | MTTR y MTBF por máquina | idem → `reliability-panel.tsx` | idem |
| `GET /analytics/sensor-trend` | Serie temporal de variable | idem → dashboard | idem |
| `GET /analytics/export` | Export CSV (stub) | No implementado en UI | idem |

**Backend principal:** `predictmaint-api/src/analytics/analytics.controller.ts`, `predictmaint-api/src/analytics/analytics.service.ts`

---

## Módulo: `MonitoringModule` — Tiempo real (SSE)

### `GET /monitoring/stream?token=` — Stream de eventos (**Público** con token en query)

**Flujo:** Cliente abre EventSource con JWT en query (el navegador no puede enviar cabecera Authorization en SSE). El guard `SseJwtQueryGuard` valida el token. El servicio emite eventos cuando el pipeline publica lecturas, alertas, órdenes o asignaciones vía `EventEmitter2`.

**Frontend:** `useMonitoringStream.ts` → `monitoring-view.tsx`

**Backend:**
- `predictmaint-api/src/monitoring/monitoring.controller.ts` (líneas 11–15)
- `predictmaint-api/src/monitoring/monitoring-sse.service.ts`
- Emisores: `sensor-readings.service.ts`, servicios de órdenes/asignación

---

## Módulo: `MlGatewayModule` — Puente interno (sin rutas HTTP propias)

**Flujo:** Servicio inyectado que traduce llamadas NestJS a HTTP hacia FastAPI con `X-API-Key`. Lo usan `SensorReadingsService`, `RagService` y `PredictionsService`.

**Backend:** `predictmaint-api/src/ml-gateway/ml-gateway.service.ts`

**ML:** Ver Parte 3.

---

# Parte 3 — Servicio ML (`predictmaint-ml`)

> Solo lo invoca el API (`MlGatewayModule`), no el navegador. Cabecera `X-API-Key`.

---

### `GET /health` — Estado del servicio

**Flujo:** Responde si FastAPI está vivo y qué artefactos `.joblib` tiene cargados.

**Frontend:** No aplica.

**Backend (API):** Health check opcional desde ops.

**ML:**
- `predictmaint-ml/main.py` — `@app.get("/health")` (aprox. línea 110)

---

### `POST /predict` — Etapa S-1 (binario)

**Flujo:** Recibe features de sensores. Ejecuta 6 modelos binarios, elige líder, calcula consenso, probabilidad y nivel de riesgo. Devuelve JSON con predicción FALLA/SIN_FALLA por modelo.

**Frontend:** No aplica (pipeline automático en `POST /sensor-readings`).

**Backend:** `ml-gateway.service.ts` → `predict()`

**ML:**
- `predictmaint-ml/main.py` — `@app.post("/predict")` (aprox. línea 118)
- Modelos: `predictmaint-ml/models.py`, artefactos en `predictmaint-ml/artifacts/`

---

### `POST /classify` — Etapa S-2 (multiclase)

**Flujo:** Recibe mismas features; clasifica tipo de fallo (H/F/M/RNF, etc.) con ensemble multiclase y acuerdo entre modelos.

**Backend:** `ml-gateway.service.ts` → `classify()`

**ML:**
- `predictmaint-ml/main.py` — `@app.post("/classify")` (aprox. línea 171)

---

### `POST /rag` — Etapa S-3 (plan de acción)

**Flujo:** Recibe tipo de fallo, código de máquina, historial y flag escalado. Recupera chunks de fuentes RAG, genera plan estructurado (pasos, herramientas, precauciones) y devuelve texto + referencias.

**Backend:** `ml-gateway.service.ts` → `rag()`; también `rag.service.ts` en regeneración.

**ML:**
- `predictmaint-ml/main.py` — `@app.post("/rag")` (aprox. línea 236)
- Lógica RAG: `predictmaint-ml/rag.py`

---

### Entrenamiento offline (sin HTTP)

**Flujo:** `train.py` entrena modelos con `ai4i2020.csv`, escribe `artifacts/*.joblib`. No hay ruta web; se ejecuta manualmente antes de desplegar ML.

**ML:** `predictmaint-ml/train.py`, `features.py`, `models.py`

---

# Jobs programados (sin ruta HTTP)

Tareas cron del módulo **`JobsModule`** que automatizan el pipeline y las notificaciones. Trabajan junto con [Automatización y notificaciones](#módulo-automatización-y-envío-de-notificaciones).

| Job | Frecuencia | Función | Relación con notificaciones |
|-----|------------|---------|----------------------------|
| **AutoFaultService** | cada min (respeta `DEMO_AUTOFAULT_MIN`) | Inyecta fallas demo → `POST /sensor-readings` | Pipeline crea orden + asigna técnico → `ORDER_CREATED_EVENT` → email/WhatsApp |
| **AssignmentRetryService** | cada min (`0 * * * * *`) | Reintenta asignación si no hubo técnico disponible | Al asignar, emite `ORDER_CREATED_EVENT` → notificación al técnico |
| **EscalationService** | cada 30 s (`30 * * * * *`) | Escala órdenes que superaron SLA sin iniciar | Emite `ORDER_ESCALATED_EVENT` → notificación a supervisores/jefe |
| **JobsService** | horario / diario | Stubs: dispatch batch, reset diario, scan repetitivos | `handleHourlyDispatch` preparado para `/catalog/dispatch-schedule` (aún no activo) |

**Código:**
- `predictmaint-api/src/jobs/auto-fault.service.ts`
- `predictmaint-api/src/jobs/assignment-retry.service.ts`
- `predictmaint-api/src/jobs/escalation.service.ts`
- `predictmaint-api/src/jobs/jobs.service.ts`
- `predictmaint-api/src/jobs/jobs.module.ts`

---

# Capa HTTP compartida (frontend)

Todas las llamadas REST del navegador pasan por:

- Cliente Axios: `predictmaint-web/src/infrastructure/http/clients/apiClient.ts` (inyecta `Authorization: Bearer` desde `sessionStore`)
- Variables: `predictmaint-web/.env.local` → `NEXT_PUBLIC_API_URL`

---

# Referencia cruzada rápida

| Pantalla frontend | Endpoints backend principales |
|-------------------|------------------------------|
| `/login` | `POST /auth/login` |
| `/dashboard` | `/analytics/dashboard`, `/machines`, `/alerts/active`, `/analytics/sensor-trend` |
| `/dashboard/monitoring` | SSE `/monitoring/stream`, `/alerts/active` |
| `/dashboard/analysis/[id]` | `/predictions/binary/*`, `/predictions/multiclass/*`, `/rag/plan/*` |
| `/dashboard/orders` | `GET /orders`, `POST /orders/:id/reassign` |
| `/dashboard/orders/[id]` | `/orders/*`, `/rag/plan/*` |
| `/dashboard/technicians` | `/technicians/*` |
| `/dashboard/analytics` | `/analytics/*`, `/notifications/log` |
| `/dashboard/settings` | `/config`, `/catalog/*`, `/ml-models/*`, `/catalog/notification-rules` |
| `/dashboard/profile` | `/users/me` |
| `/dashboard/my-work` | `/orders/my-board` |
| Automatización (sin UI) | Eventos `order.created` / `order.escalated`, crons `JobsModule`, SMTP / `SEND_EMAIL_WEBHOOK` |

**Pipeline automático (sin UI):** `AutoFaultService` → `POST /sensor-readings` → ML S-1/S-2/S-3 → orden + asignación → `ORDER_CREATED_EVENT` → email/WhatsApp + SSE.

---

*Documento generado para el proyecto PredictMaint. Complementa `docs/MANUAL_RUTAS.md` (listado tabular) con narrativa de flujo y ubicación de código.*
