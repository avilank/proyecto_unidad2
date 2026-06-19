# Guía de Estudio — PredictMaint (Mantenimiento Predictivo)

> Guía para exposición y evaluación. Explica **qué hay, quién llama a quién y por qué**.
> Está dividida en partes; puedes estudiar de arriba hacia abajo.

---

## PARTE 0 — Visión general en una frase

> El sistema **lee sensores de máquinas CNC, detecta posibles fallas con Machine Learning, clasifica el tipo de falla, genera un plan de acción (RAG), crea una orden de mantenimiento, asigna un técnico y lo notifica** (WhatsApp/Email). Todo queda registrado para analítica.

Son **3 servicios** que se comunican por HTTP:

| Servicio | Carpeta | Tecnología | Rol |
|---|---|---|---|
| **Web** | `predictmaint-web` | Next.js (App Router) + React + TypeScript | Interfaz de usuario (dashboard, técnico, analítica) |
| **API / Backend** | `predictmaint-api` | NestJS + Sequelize + PostgreSQL | Orquesta TODO el negocio, la BD y el pipeline |
| **ML** | `predictmaint-ml` | FastAPI (Python) + scikit-learn / XGBoost / LightGBM | Solo inferencia: predice, clasifica y genera plan RAG |

**Regla de oro de comunicación:** el navegador (Web) **nunca** llama al ML directamente. Siempre:
`Web → API → ML`. El API es el único que habla con el ML (a través del *ml-gateway*).

```
┌─────────────┐   HTTP/JWT   ┌──────────────┐   HTTP/X-API-Key   ┌────────────┐
│  Web (Next) │ ───────────▶ │  API (Nest)  │ ─────────────────▶ │  ML (FastAPI)│
│  :3000      │ ◀─────────── │  :3001       │ ◀───────────────── │  :8000      │
└─────────────┘              └──────┬───────┘                    └────────────┘
                                    │ Sequelize
                              ┌─────▼──────┐
                              │ PostgreSQL │
                              └────────────┘
```

¿Por qué Python aparte? Porque los 6 modelos ML están entrenados en scikit-learn/XGBoost/LightGBM y se serializan a `.joblib`. Node no puede ejecutarlos; FastAPI los carga y los expone como endpoints.

---

## PARTE 1 — Conceptos clave (vocabulario que DEBES dominar)

- **S-1 (Etapa 1, "Predicción"):** modelo **binario** → ¿hay FALLA o SIN_FALLA?
- **S-2 (Etapa 2, "Clasificación"):** modelo **multiclase** → ¿qué **tipo** de falla? (HDF/PWF/TWF/OSF/RNF).
- **S-3 (Etapa 3, "RAG"):** genera el **plan de acción** (recomendaciones) para el técnico.
- **Tipos de falla (dataset AI4I 2020):**
  - **HDF** = Heat Dissipation Failure (disipación de calor).
  - **PWF** = Power Failure (potencia).
  - **TWF** = Tool Wear Failure (desgaste de herramienta).
  - **OSF** = Overstrain Failure (sobreesfuerzo).
  - **RNF** = Random Failure (aleatoria → inspección manual).
- **Ensemble:** se usan 3 modelos por etapa; el de mayor confianza es el **líder** (`esLider`).
- **Nivel de riesgo:** LOW / MEDIUM / HIGH / CRITICAL (según la probabilidad del líder S-1).
- **Agreement (S-2):** cuántos de los 3 modelos coinciden → ALTO (3), MEDIO (2), BAJO (1).
- **Orden de mantenimiento:** el "ticket" de trabajo. Estados: `pendiente → en_progreso → finalizado` (+ `rechazada`, agregado para el rechazo de predicción).
- **Alerta:** notificación visual del pipeline. Estados: `analizando → clasificando → pendiente → en_progreso → finalizado`.

---

## PARTE 2 — Modelo de datos (las tablas y por qué existen)

La tabla **central** es `analisis_fallos`: agrupa **una lectura** con sus resultados S-1, S-2, S-3 y su orden.

```
maquinas ──< lecturas_sensor ──< analisis_fallos ─┬─< prediccion_fallo      (S-1: 3 filas, una por modelo)
                                                   ├─< clasificaciones_fallo (S-2: 3 filas, una por modelo)
                                                   ├──  ordenes_mantenimiento (1:1)
                                                   └──  alertas (1:1)

clasificaciones_fallo ──< recomendaciones_rag ──> fuente_rag   (S-3: plan de acción + fuentes)

ordenes_mantenimiento ─┬─< eventos_orden          (timeline/auditoría de la orden)
                       ├─< solucion_aplicada       (qué solución usó el técnico)
                       ├─< observacion_tecnica     (validación: ¿la predicción acertó?)
                       └──  tecnico (asignado)

usuarios ──1:1── tecnicos      (login/rol vs. datos operativos: turno, especialidad, disponibilidad)
modelos_ml                     (catálogo de los 6 modelos + métricas y cuál es default)
reglas_sensor / reglas_asignacion / reglas_notificacion / configuracion_alertas  (parametrización)
mensaje_enviado                (log de notificaciones enviadas)
```

**Por qué se separan `usuarios` y `tecnicos`:** `usuarios` guarda lo de autenticación (correo, hash de contraseña, rol). `tecnicos` guarda lo operativo (turno, especialidad, disponibilidad, nivel de experiencia). Un usuario puede o no ser técnico.

**Por qué 3 filas por etapa:** se guarda la predicción de **cada uno de los 3 modelos** (para comparar y mostrar el ensemble), marcando `esLider=true` en el ganador.

**Tabla feedback (clave para tu analítica):** `observacion_tecnica` registra la validación del técnico:
`esFalla`, `esPrediccionCorrecta` (S-1 acertó), `esClasificacionCorrecta` (S-2 acertó), `comentario`, y `decision` (`aceptada`/`rechazada`). Esto cierra el ciclo: **¿el modelo acertó o no?**

> Nota: La BD se autocrea/ajusta al arrancar el API si `DATABASE_SYNC=true` (+ `DATABASE_ALTER=true`). Con `DATABASE_SEED=true` se cargan catálogos demo si la BD está vacía.

---

## PARTE 3 — El servicio ML (FastAPI) — `predictmaint-ml`

Expone 4 endpoints (todos menos `/health` requieren cabecera `X-API-Key`):

| Método | Ruta | Para qué |
|---|---|---|
| GET | `/health` | Estado + nº de modelos cargados |
| POST | `/predict` | **S-1**: binario FALLA/SIN_FALLA |
| POST | `/classify` | **S-2**: tipo de falla |
| POST | `/rag` | **S-3**: plan de acción |

**Entrada común (`SensorReading`):** `type` (L/M/H), `airTemperature`, `processTemperature`, `rotationalSpeed`, `torque`, `toolWear`.

### Modelos (archivo `train.py`, artefactos en `artifacts/*.joblib`)
- **S-1 (binario):** Regresión Logística, **Random Forest**, **XGBoost** (líder por defecto, ~98.6% acc).
- **S-2 (multiclase):** Decision Tree, **LightGBM** (líder por defecto), SVM.
- `features.py` transforma la lectura en vector de 7 features, incluyendo **Power = torque × rpm × 2π/60** (derivada). Se escala con `StandardScaler`.
- Entrenamiento: `python train.py` una sola vez → guarda `.joblib` + `metrics.json`. En runtime, FastAPI **solo carga** los modelos (no reentrena).
- **Dataset `ai4i2020.csv`** (~10k filas): columnas de sensores + `Machine failure` (0/1) + one-hot TWF/HDF/PWF/OSF/RNF. S-2 se entrena solo con filas que tuvieron falla.

### El RAG del ML (`rag.py`) — IMPORTANTE (pregunta típica)
Es un **RAG híbrido**:
1. **Retrieval:** selecciona fuentes técnicas autorizadas (papers) según el tipo de falla (`FAULT_SOURCES`).
2. **Generación:** si hay API key y `RAG_USE_LLM=true`, llama a un **LLM vía OpenRouter** (`gpt-4o-mini`) pidiendo JSON con 3 acciones (prioridad, título, detalle), usando las fuentes como contexto.
3. **Fallback:** si el LLM falla o está desactivado, devuelve **plantillas locales** por tipo de falla (`FAULT_ACTION_PLANS`). El caso **RNF** siempre devuelve "inspección manual obligatoria".

> Frase para exponer: *"El RAG combina recuperación de fuentes confiables + un LLM para redactar el plan, con degradación elegante a plantillas si no hay LLM disponible."*

---

## PARTE 4 — EL PIPELINE DE MONITOREO (el corazón del sistema)

Todo arranca en `POST /sensor-readings` (lo dispara un **simulador** `scripts/simulate-sensor-stream.py`, no hay sensores reales). Lógica en `sensor-readings.service.ts`.

**Secuencia paso a paso (quién llama a quién):**

1. **Entra la lectura** → `SensorReadingsController.create()` → `SensorReadingsService.create()`.
2. Se **persiste** la lectura (`LecturaSensor`) y se calcula `powerW`.
3. Se **emite evento SSE** `monitoring:reading` (para que el dashboard se actualice en vivo).
4. **Reglas de sensor** (`evaluateSensorRules`) deciden si vale la pena analizar:
   - **RN-01 → HDF:** `(processTemp − airTemp) > 8.6` o `rpm < 1380`.
   - **RN-02 → PWF:** `power < 3500` o `power > 9000`.
   - **RN-03 → TWF:** `toolWear ≥ 200`.
   - **RN-04 → OSF:** `torque × toolWear > 5000`.
   - Si **ninguna** se dispara → **se detiene** (lectura normal, no pasa nada).
5. **Compuerta (gate):** si ya hay un pipeline activo para esa máquina, o estamos en *cooldown* (30 min), **se omite** (evita duplicados).
6. Se crean los registros base: **`AnalisisFallo`**, **`Orden`** (estado `pendiente`), **`Alerta`** (estado `analizando`) y un **`EventoOrden`** (`deteccion_s1`).
7. **S-1:** `mlGateway.predict(features)` → `POST {ML}/predict`. Se guardan 3 `PrediccionFallo` (una por modelo) y se actualiza `AnalisisFallo` con `ensembleAvg`, `nivelRiesgo`, `prediccion`.
8. **Compuerta de decisión:** si la confianza del líder **< umbral** → se descarta (orden y alerta a `finalizado`, "S-1 sin confirmación"). **Fin del pipeline.**
9. Si **FALLA confirmada** → alerta a `clasificando` → **S-2:** `mlGateway.classify()` → `POST {ML}/classify`. Se guardan 3 `ClasificacionFallo`; el líder define el `tipoFallo`.
10. **S-3 (RAG):** `persistRagPlan()` → `mlGateway.rag({tipoFallo, maquinaId, fuentes})` → `POST {ML}/rag`. Las acciones se guardan en `recomendaciones_rag` ligadas a la clasificación líder. Evento `rag_s3`.
11. **Asignación de técnico:** `techniciansService.assignForOrder(nivelRiesgo, tipoFallo)`.
    - Si hay técnico → se asigna a la orden y alerta; el técnico pasa a `en_intervencion`. Evento `respuesta_tecnico`.
    - Si **no** hay técnico → se programa **reintento** (`proximoReintentoAsignacion`).
12. Se **emite `ORDER_CREATED_EVENT`** (lo escucha Notificaciones) y `monitoring:alert` (SSE para el dashboard).

```
Lectura → [Reglas RN-0x] → ¿dispara? ──no──▶ fin (lectura normal)
                               │sí
                               ▼
          crear Analisis+Orden+Alerta → S-1(/predict) → ¿FALLA≥umbral? ─no─▶ descartar
                                                              │sí
                                                              ▼
                                       S-2(/classify) → S-3(/rag) → asignar técnico → notificar
```

**Por qué tantas compuertas:** para no saturar el sistema ni notificar por ruido. Solo las lecturas que rompen una regla **y** que el ML confirma como falla generan trabajo real.

### Eventos y SSE (tiempo real)
- Se usa **`@nestjs/event-emitter`** (patrón observador). Quien dispara la acción **no conoce** a quien reacciona → bajo acoplamiento.
  - `ORDER_CREATED_EVENT` → lo escucha `OrderNotificationListener` (notifica).
  - `monitoring:reading` / `monitoring:alert` → los escucha `monitoring-sse.listener` y los **transmite por SSE** a los navegadores conectados (`GET /monitoring/stream`).
- **SSE (Server-Sent Events):** canal unidireccional servidor→navegador para refrescar el monitoreo en vivo (con *heartbeat* cada 15 s).

### Job programado (reintento de asignación)
- `assignment-retry.service.ts` corre **cada minuto** (`@Cron`). Busca órdenes `pendiente` sin técnico cuyo `proximoReintentoAsignacion` ya venció e intenta reasignar. Si lo logra, emite `ORDER_CREATED_EVENT` (y por ende, notifica). Reintentos según riesgo (CRITICAL/HIGH antes, LOW después).

---

## PARTE 5 — Órdenes, técnicos y asignación

- **`orders.service.ts`** es el núcleo de la orden. Transiciones válidas:
  `pendiente → en_progreso | rechazada`, `en_progreso → finalizado`.
- **Iniciar** (`POST /orders/:id/start`): técnico arranca → `en_progreso`.
- **Registrar solución** (`POST /orders/:id/solution`): crea `SolucionAplicada` (tipo `con_rag` / `propia`) + `ObservacionTecnica` (validación ML) + pasa la orden a `finalizado` + **libera al técnico** (`releaseIfIdle`).
- **Rechazar predicción** (`POST /orders/:id/reject-prediction`, **funcionalidad agregada**): el técnico justifica por qué la predicción es un falso positivo → crea `ObservacionTecnica` con `esPrediccionCorrecta=false`, `decision='rechazada'`, pasa la orden a `rechazada` y libera al técnico. Alimenta el **historial de aciertos**.
- **Asignación (`assignForOrder`)** elige técnico **disponible y en turno**:
  - CRITICAL → el de **mayor experiencia**.
  - HIGH → por **especialidad** que matchea el tipo de falla (regla `FAULT_SPECIALTY`).
  - MEDIUM/LOW → el de **menor carga** (menos órdenes activas).
- **Control de acceso por rol:** un técnico solo ve/gestiona **sus** órdenes (`assertCanAccessOrder`); supervisor/jefe ven todo.

---

## PARTE 6 — RAG en el backend (cómo se sirve al técnico)

Ojo a la distinción (pregunta típica):
- **El ML genera** el plan (LLM o plantilla).
- **El backend lo persiste y lo sirve** desde la BD (`recomendaciones_rag`). Para el técnico, el RAG es una lectura de BD.

**Endpoints (`rag.controller.ts`):**
| Método | Ruta | Acción |
|---|---|---|
| GET | `/rag/plan/:orderId` | Devuelve el plan (acciones + fuentes + estado) |
| POST | `/rag/plan/:orderId/accept` | Técnico **acepta** → `RespuestaRecomendacion(decision='aceptado')` + evento |
| POST | `/rag/plan/:orderId/reject` | Técnico **rechaza** (con motivo) |
| POST | `/rag/plan/:orderId/regenerate` | Regenera (puede forzar `escalado` o fuentes específicas) → vuelve a llamar al ML |

**Cierre del ciclo con la orden:** en el detalle de orden, "Aceptar plan RAG y finalizar" acepta el plan y registra la solución como `con_rag`. Si el técnico usó su criterio → `propia`.

**Fuentes (`fuente_rag`):** catálogo de papers/normas. Cada acción puede quedar ligada a una fuente (`recomendaciones_rag.idFuente`).

---

## PARTE 7 — Notificaciones y alertas

**Disparo:** `ORDER_CREATED_EVENT` → `OrderNotificationListener.handleOrderCreated()` → si hay técnico asignado → `NotificationsService.notifyTechnicianAssignment()`.

**Lógica de envío:**
1. Si `nivelRiesgo = LOW` → **no** se notifica.
2. **Canal** según `reglas_notificacion` por nivel (whatsapp / email / ambos) + preferencias del técnico (`enviarWssp`, `enviarCorreo`). En **CRITICAL** siempre se manda email.
3. **`alert-message.builder.ts`** arma el contenido: máquina, tipo de falla, acción principal del RAG, lecturas con umbrales resaltados, historial de intervenciones, y enlace al dashboard. Distingue versión **WhatsApp** (texto) y **Email** (HTML).
4. **Envío real:** `webhook-notifier.service.ts` hace `POST` (multipart) a un **webhook de n8n** (`SEND_EMAIL_WEBHOOK`). **No** llama directo a WhatsApp/SMTP; **n8n** es quien entrega el mensaje. → Es un *relay*.
5. Se registra en **`mensaje_enviado`** (`estado`: entregado/fallido; `tipoEnvio`: `alerta_critica` o `repetitivo` si ≥3 ocurrencias en 7 días). Esto es lo que muestra `GET /notifications/log` (el "Log de mensajes automáticos" de la analítica).

**Alertas (`alerts.module`):** endpoints `GET /alerts/active`, `GET /alerts`, `GET /alerts/:id`, `PATCH /alerts/:id/status`. La alerta acompaña visualmente al pipeline (analizando → clasificando → pendiente → en_progreso → finalizado).

> Nota: las tablas de horarios por turno (`horario_envio`, `inicio_turno`/`fin_turno`) están **definidas pero no activas**; hoy las notificaciones son inmediatas al asignar.

---

## PARTE 8 — Fallos repetitivos y escalamiento

- Idea: si una máquina repite el mismo tipo de falla **≥3 veces en 7 días**, es un patrón → escalar a supervisor (`accion_escalada` define qué hacer por tipo).
- **Estado de implementación:** los endpoints `repetitive-faults` son **stubs** (no calculan aún). En su lugar, la **analítica** sí calcula recurrencia en vivo: `getRecurrentMachines()` / `getMachineRecurrence()` agrupan órdenes por máquina+tipo en la ventana de días.

---

## PARTE 9 — Autenticación, roles y seguridad

- **Login (`POST /auth/login`, `@Public()`):** valida correo + contraseña con **bcrypt** → firma un **JWT**. Payload del token: `{ id, email, rol, tecnicoId }`. Expira en 8h (`JWT_SECRET`, `JWT_EXPIRES_IN`).
- **Guard global:** `JwtAuthGuard` protege **todas** las rutas por defecto; `@Public()` las exceptúa (ej. login). `@UserContext()` extrae `req.user` (el payload del JWT) en los controllers.
- **Roles + CASL** (`casl-ability.factory.ts`):
  - `jefe_planta` / `supervisor` → `manage:all` (todo).
  - `tecnico_senior` → `read:all` + `update:Order/Alert`.
  - `tecnico` → `read:Order/Alert/Machine`.
- **SSE Guard aparte** (`sse-jwt-query.guard.ts`): como el navegador no puede enviar header `Authorization` en EventSource, el token va por **query** (`/monitoring/stream?token=...`).
- **`main.ts`:** CORS abierto, `ValidationPipe` global (whitelist/transform), Swagger en `/api/docs`, puerto 3001.

---

## PARTE 10 — Frontend (arquitectura limpia)

Capas (de adentro hacia afuera), con **regla de dependencia** estricta:

```
core (entidades, enums, interfaces — sin React ni HTTP)
  ▲
application (services: orquestan, usan interfaces)
  ▲
infrastructure (repositories + HttpClient/axios + storage — implementan interfaces)
  ▲
presentation (hooks SWR + stores Zustand)
  ▲
components (UI) → app (rutas Next.js)
```

**Quién llama a quién (flujo de un dato):**
```
Página → hook (useOrders) → Service (OrderService) → Repository (orderRepository)
       → apiClient.get('/orders') → [HTTP + JWT] → Backend
```
SWR cachea y revalida; `refreshInterval: 5000` para vistas en vivo.

**Token:** `sessionStore` (Zustand + localStorage) es la única fuente de verdad. `setApiTokenGetter()` inyecta el token en axios → cada request lleva `Authorization: Bearer`.

**SSE en el front:** `useMonitoringStream` abre `new EventSource('/monitoring/stream?token=...')`; al recibir `monitoring:reading`/`monitoring:alert`, llama `mutate()` para refrescar los datos.

**Rutas principales (`src/app/dashboard`):**
| Ruta | Vista | Para quién |
|---|---|---|
| `/dashboard` | KPIs, estado de máquinas, alertas recientes | supervisor/jefe |
| `/dashboard/monitoring` | alertas en vivo (SSE) | supervisor/jefe |
| `/dashboard/analysis/[machineId]` | tabs S-1 / S-2 / S-3 | supervisor/jefe |
| `/dashboard/orders` + `/orders/[id]` | historial y detalle de orden | supervisor/jefe |
| `/dashboard/technicians` | gestión de técnicos | supervisor/jefe |
| `/dashboard/analytics` | KPIs, efectividad, recurrencia, **validación de predicciones** | supervisor/jefe |
| `/dashboard/my-work` | tablero del técnico (rechazar/iniciar/finalizar) | **técnico** |

**UI por rol:** el `sidebar.tsx` lee `user.rol`: técnico ve solo "Mi trabajo"; supervisor/jefe ven el menú completo. Al hacer login, el técnico va a `/dashboard/my-work` y el resto a `/dashboard`.

---

## PARTE 11 — Analítica (incl. la tabla de validación que construimos)

Endpoints en `analytics.controller.ts` (`/analytics/...`): `dashboard`, `summary`, `faults-by-type`, `unattended`, `recurrent-machines`, `machine-recurrence`, `availability`, `sensor-trend`, **`prediction-validation`** (nuevo).

**Tabla "Validación de predicciones — Modelo vs. Técnico"** (lo que pediste):
- Une `ordenes` + `observacion_tecnica` + `analisis/clasificacion`.
- Muestra: orden, máquina, técnico, predicción (FALLA + tipo), **¿aceptó/rechazó?** y la **justificación** (icono 👁 → modal) si fue rechazada.
- KPIs: total, aceptadas, rechazadas, **% acertadas**. Filtro **Semana/Mes**.
- En el **Historial de Mantenimiento** se agregó la card **"Rechazada"** (conteo del estado).
- **Objetivo:** historial de si las predicciones automáticas aciertan o fallan según el criterio humano.

---

## PARTE 12 — Resumen "quién llama a quién" (chuleta para exponer)

```
SIMULADOR ──POST /sensor-readings──▶ API (SensorReadingsService)
   1. guarda lectura + SSE "reading"
   2. reglas RN-0x  ─(no dispara)─▶ fin
   3. crea Analisis+Orden+Alerta
   4. ml-gateway.predict ──▶ ML /predict   (S-1)
   5. ¿FALLA≥umbral? ─no─▶ descarta
   6. ml-gateway.classify ──▶ ML /classify (S-2)
   7. ml-gateway.rag ──▶ ML /rag           (S-3, persiste recomendaciones)
   8. technicians.assignForOrder           (elige técnico)
   9. emit ORDER_CREATED ──▶ NotificationsService ──▶ webhook n8n ──▶ WhatsApp/Email
  10. emit monitoring:alert ──SSE──▶ Web (dashboard en vivo)

TÉCNICO (Web /my-work):
   Iniciar  ──POST /orders/:id/start──▶ en_progreso
   Rechazar ──POST /orders/:id/reject-prediction──▶ rechazada (+ observacion_tecnica)
   Finalizar──POST /orders/:id/solution──▶ finalizado (+ solucion + observacion)

JOB cada minuto: assignment-retry ──▶ reintenta asignar órdenes sin técnico
```

---

## PARTE 13 — Posibles preguntas de evaluación (con respuestas)

**Arquitectura**
1. **¿Por qué tres servicios separados y no uno solo?** Separación de responsabilidades: la UI (Next), la lógica/negocio+BD (Nest) y la inferencia ML (Python, porque los modelos están en librerías de Python). Escala y se despliega por separado.
2. **¿Por qué el navegador no llama al ML directamente?** Seguridad y desacople: el ML solo confía en el API (X-API-Key); el API centraliza auth (JWT), validación, persistencia y orquestación.
3. **¿Qué patrón de arquitectura usa el frontend y cuál es la regla de dependencia?** Arquitectura limpia/hexagonal: `core ← application ← infrastructure`, y `presentation → components → app`. `core` es dominio puro sin dependencias.

**Pipeline / ML**
4. **¿Qué es S-1, S-2 y S-3?** S-1 binario (¿falla?), S-2 multiclase (¿qué tipo?), S-3 RAG (plan de acción).
5. **¿Qué algoritmos usa cada etapa y cuál es el líder?** S-1: LogReg, Random Forest, **XGBoost (líder)**. S-2: Decision Tree, **LightGBM (líder)**, SVM.
6. **¿Qué dispara el pipeline?** Una lectura que rompe una **regla de sensor** (RN-01..RN-04) **y** que S-1 confirma como falla por encima del umbral.
7. **¿Qué pasa si S-1 dice SIN_FALLA o no supera el umbral?** Se descarta: orden y alerta a `finalizado`, no se clasifica ni se notifica.
8. **¿Qué es el "ensemble" y el "agreement"?** Ensemble = combinación de los 3 modelos; el líder es el de mayor confianza. Agreement (S-2) = cuántos coinciden (ALTO/MEDIO/BAJO).
9. **¿Cómo se calcula el nivel de riesgo?** Por la probabilidad del líder S-1 mapeada a rangos (LOW<0.40, MEDIUM<0.65, HIGH<0.85, CRITICAL≥0.85).
10. **¿Qué feature derivada se calcula?** Power = torque × rpm × 2π/60.

**RAG**
11. **¿El RAG usa un LLM?** Sí, opcionalmente: el ML llama a un LLM (OpenRouter/gpt-4o-mini) con fuentes seleccionadas; si falla o está desactivado, usa **plantillas locales**. RNF siempre es inspección manual.
12. **¿Dónde se guarda el plan RAG?** En `recomendaciones_rag`, ligado a la clasificación líder; el backend lo sirve desde la BD vía `/rag/plan/:orderId`.
13. **¿Diferencia entre `RespuestaRecomendacion` y `SolucionAplicada`?** La primera es la **decisión** sobre el plan (aceptar/rechazar); la segunda es la **solución real** aplicada (con_rag / propia).

**Órdenes / técnicos**
14. **¿Cómo se asigna un técnico?** Por riesgo: CRITICAL→más experiencia; HIGH→especialidad del tipo de falla; MEDIUM/LOW→menor carga. Solo disponibles y en turno.
15. **¿Qué pasa si no hay técnico disponible?** Se programa reintento (`proximoReintentoAsignacion`) y un **cron cada minuto** reintenta.
16. **Estados de una orden.** `pendiente → en_progreso → finalizado`, más `rechazada` (rechazo de predicción).

**Notificaciones**
17. **¿Cómo se envían las notificaciones realmente?** El API hace POST a un **webhook de n8n**; n8n entrega WhatsApp/Email. No se llama directo al proveedor.
18. **¿Cuándo NO se notifica?** Cuando el riesgo es LOW, o cuando no hay técnico asignado.
19. **¿Qué es `mensaje_enviado`?** El log de notificaciones (canal, tipo, estado entregado/fallido); lo muestra `/notifications/log`.

**Eventos / tiempo real**
20. **¿Por qué usar EventEmitter en vez de llamar directo al servicio de notificaciones?** Desacoplamiento: el pipeline emite un evento y no sabe quién reacciona; facilita agregar listeners sin tocar el emisor.
21. **¿Qué es SSE y para qué se usa?** Server-Sent Events: canal servidor→navegador para refrescar el monitoreo en vivo. El token va por query porque EventSource no manda headers.

**Seguridad**
22. **¿Cómo se protegen las rutas?** `JwtAuthGuard` global + `@Public()` para excepciones. JWT con bcrypt para el login.
23. **¿Qué hace cada rol?** jefe/supervisor: todo; técnico_senior: leer todo + editar órdenes/alertas; técnico: solo leer (y operar sus órdenes).

**Datos / persistencia**
24. **¿Cuál es la tabla central del modelo y por qué?** `analisis_fallos`: conecta una lectura con sus resultados S-1/S-2/S-3 y su orden/alerta.
25. **¿Cómo se mide si el modelo acierta?** Con `observacion_tecnica` (`esPrediccionCorrecta`, `esClasificacionCorrecta`, `decision`), base de la tabla de validación en analítica.
26. **¿Hay sensores reales?** No; un simulador en Python reproduce lecturas del dataset AI4I 2020.

**Tu funcionalidad (rechazo de predicción)**
27. **¿Qué problema resuelve "rechazar predicción"?** Permite al técnico marcar un **falso positivo** con justificación, generando historial real de aciertos/errores del modelo sin tener que "trabajar" una orden falsa.
28. **¿Qué cambia en la BD al rechazar?** Se crea `observacion_tecnica` (`esPrediccionCorrecta=false`, `decision='rechazada'`, comentario=justificación), la orden pasa a `rechazada` y el técnico vuelve a `disponible`.

---

## PARTE 14 — Cómo demostrarlo en vivo (demo sugerida)

1. Levantar: PostgreSQL → API (`:3001`) → ML (`:8000`) → Web (`:3000`).
2. Correr el **simulador** de sensores para generar una falla.
3. Mostrar **Monitoreo** actualizándose en vivo (SSE).
4. Abrir el **Análisis** de la máquina: tabs S-1 → S-2 → S-3.
5. Entrar como **técnico** a "Mi trabajo": **Iniciar** o **Rechazar predicción** (con justificación).
6. Ir a **Analítica → Validación de predicciones**: ver la fila, el % acertadas y el modal de justificación.
7. Mostrar el **Log de mensajes** (notificación enviada) y la **card Rechazada** en el Historial.

---

### Archivos clave (para responder "¿dónde está esto?")
- Pipeline: `predictmaint-api/src/sensor-readings/sensor-readings.service.ts`
- Llamadas al ML: `predictmaint-api/src/ml-gateway/ml-gateway.service.ts`
- Reglas de sensor: `predictmaint-api/src/common/utils/sensor-rules.util.ts`
- Órdenes: `predictmaint-api/src/orders/orders.service.ts`
- Notificaciones: `predictmaint-api/src/notifications/*`
- RAG (backend): `predictmaint-api/src/rag/rag.service.ts`
- RAG (ML): `predictmaint-ml/rag.py`
- Modelos ML: `predictmaint-ml/train.py`, `models.py`, `features.py`
- Auth/roles: `predictmaint-api/src/auth/*`, `common/casl/casl-ability.factory.ts`
- Frontend capas: `predictmaint-web/src/{core,application,infrastructure,presentation,components,app}`
</content>
</invoke>
