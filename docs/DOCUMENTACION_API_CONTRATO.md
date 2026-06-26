# PredictMaint — Contrato de API (REST)

> Contrato de endpoints entre **predictmaint-web** (Next) ↔ **predictmaint-api** (NestJS) ↔
> **predictmaint-ml** (FastAPI). Sigue las convenciones del proyecto de referencia `YAMBOLY`
> (`service-mantenimiento`). Complementa a `DOCUMENTACION_MODELO_DE_DATOS.md` y
> `DOCUMENTACION_ARQUITECTURA.md`. Fecha: 2026-06-17.

> **Nota:** Para la lista exhaustiva y siempre actualizada de rutas, ver `MANUAL_RUTAS.md`.

---

## 1. Convenciones globales (igual que la referencia)

- **Base URL:** `/{recurso}` (ej. `/orders`). Nest usa `@Controller('kebab-plural')`.
- **Verbos REST:** `POST /x` (crear), `GET /x` (listar), `GET /x/:id` (uno),
  `PATCH /x/:id` (actualizar parcial), `DELETE /x/:id` (eliminar).
- **Acciones sobre un recurso:** sub-ruta explícita → `POST /x/:id/accept`, `GET /x/board`.
- **Paginación:** query `?page=&limit=` (números). Filtros adicionales por query.
- **Cuerpos:** DTOs `Create<Entidad>Dto` / `Update<Entidad>Dto`, validados con `class-validator`.
- **Respuesta:** se devuelve la **data directa** (sin envoltorio `{data:...}`), como en la referencia.
  Las listas paginadas devuelven `{ items: [...], total, page, limit }`.
- **Errores:** formato estándar Nest → `{ "statusCode": 400, "message": "...", "error": "Bad Request" }`.
- **Auth:** header `Authorization: Bearer <jwt>` en todo excepto `POST /auth/login`
  (decorador `@Public()` en la referencia).
- **IDs:** las entidades con código de negocio usan ese código en la URL (`/orders/ORD-027`,
  `/machines/M-001`); las demás usan id numérico (`/technicians/3`).

### Códigos de estado
| Código | Uso |
|--------|-----|
| 200 | OK (GET/PATCH/acciones) |
| 201 | Creado (POST) |
| 400 | Validación fallida |
| 401 | Sin token / token inválido |
| 403 | Sin permiso (CASL) |
| 404 | No encontrado |
| 409 | Conflicto (estado inválido, duplicado) |

---

## 2. `auth` — Autenticación

| Método | Ruta | Body / Query | Respuesta |
|--------|------|--------------|-----------|
| POST | `/auth/login` | `{ email, password }` | `{ accessToken, user: { id, nombre, rol, tecnicoId } }` |
| GET | `/auth/me` | — | `{ id, email, nombre, rol, tecnicoId, permisos[] }` |
| POST | `/auth/logout` | — | `{ ok: true }` |

**LoginDto:** `email: string (email)`, `password: string (min 6)`.

---

## 2b. `users` — Usuarios y perfil

| Método | Ruta | Body / Query | Respuesta |
|--------|------|--------------|-----------|
| GET | `/users` | — | `User[]` (uso administrativo) |
| GET | `/users/me` | — | `User` (perfil editable del usuario autenticado) |
| PATCH | `/users/me` | `UpdateProfileDto` `{ nombre?, telefono? }` | `User` (perfil actualizado) |

**UpdateProfileDto:** `nombre?: string`, `telefono?: string` (ambos opcionales; el usuario autenticado solo puede editar su nombre y teléfono).
**User:** `{ id, email, nombre, telefono, rol, tecnicoId }`.

---

## 3. `machines` — Máquinas

| Método | Ruta | Query / Body | Respuesta |
|--------|------|--------------|-----------|
| GET | `/machines` | `?estado=&tipo=&page=&limit=` | `{ items: Machine[], total, page, limit }` |
| GET | `/machines/:id` | — | `Machine` (incluye última lectura + KPIs) |
| GET | `/machines/:id/readings` | `?from=&to=&limit=` | `SensorReading[]` |
| POST | `/machines` | `CreateMachineDto` | `Machine` |
| PATCH | `/machines/:id` | `UpdateMachineDto` | `Machine` |

**Machine:** `{ id, tipo, estadoOperativo, horasOperacion, desgasteActual, ultimoMantenimiento, proximaRevision, tecnicoAsignadoId }`.

---

## 4. `sensor-readings` — Lecturas de sensor

| Método | Ruta | Body / Query | Respuesta |
|--------|------|--------------|-----------|
| POST | `/sensor-readings` | `CreateSensorReadingDto` | `{ reading, alert?, order? }` — **dispara el pipeline** |
| GET | `/sensor-readings` | `?machineId=&from=&to=&page=&limit=` | `{ items, total, page, limit }` |
| GET | `/sensor-readings/:id` | — | `SensorReading` |

**CreateSensorReadingDto** (valida rangos de §5.2 del modelo de datos):
```json
{
  "maquinaId": "M-001", "tipo": "H",
  "airTemperature": 298.5, "processTemperature": 304.7,
  "rotationalSpeed": 1240, "torque": 42.8, "toolWear": 185,
  "capturadoEn": "2026-05-28T14:32:00Z"
}
```
> `power_w` lo calcula el backend (`torque*rpm*2π/60`); no se envía. Al crear una lectura que
> supera regla `RN-0x`, el backend ejecuta el pipeline (alerta → S-1 → S-2 → S-3 → orden).

---

## 5. `predictions` — Resultados S-1 / S-2

| Método | Ruta | Query | Respuesta |
|--------|------|-------|-----------|
| GET | `/predictions/binary/:orderId` | — | `BinaryPrediction[]` (3 modelos) + `{ ensembleAvg, nivelRiesgo, consenso }` |
| GET | `/predictions/multiclass/:orderId` | — | `MulticlassPrediction[]` (3 modelos) + `{ tipoPredicho, agreement, confianza }` |
| POST | `/predictions/run/:orderId` | `{ etapa: "S1" \| "S2" }` | re-ejecuta inferencia (vía ml-gateway) |

**BinaryPrediction:** `{ modelo, prediccion, probabilidad, accuracy, rocAuc, precision, recall, f1Score, tn, fp, fn, tp, esLider }`.
**MulticlassPrediction:** `{ modelo, tipoPredicho, probHdf, probPwf, probTwf, probOsf, probRnf, f1Macro, f1Weighted, accuracy, tp, fn, fp, tn, esLider, diverge }`.

---

## 6. `orders` — Órdenes de trabajo

| Método | Ruta | Query / Body | Respuesta |
|--------|------|--------------|-----------|
| GET | `/orders` | `?estado=&maquinaId=&tipoFallo=&tecnicoId=&algoritmo=&from=&to=&search=&page=&limit=` | `{ items: Order[], total, page, limit }` |
| GET | `/orders/my-board` | — | Tablero del técnico: órdenes pendientes y completadas asignadas al usuario logueado (rol técnico) |
| GET | `/orders/:id` | — | `Order` (con máquina, técnico, lectura) |
| GET | `/orders/:id/timeline` | — | `OrderEvent[]` |
| POST | `/orders` | `CreateOrderDto` `{ maquinaId, tipoFallo? }` | `Order` (normalmente la crea el pipeline) |
| POST | `/orders/:id/start` | — | `Order` (→ `en_progreso` + `fechaInicio`; rol técnico asignado) |
| PATCH | `/orders/:id/status` | `UpdateOrderStatusDto` `{ estado }` | `Order` |
| POST | `/orders/:id/solution` | `RegisterSolutionDto` `{ descripcion, solucionTipo }` | `Order` (→ `finalizado`; alimenta MTTR/MTBF) |
| POST | `/orders/:id/reject-prediction` | `RejectPredictionDto` `{ justificacion }` | `Order` (técnico rechaza la predicción ML / falsa alarma) |
| POST | `/orders/:id/reassign` | `ReassignOrderDto` `{ tecnicoId, motivo }` | `Order` (supervisor reasigna a otro técnico) |
| POST | `/orders/:id/escalate` | `EscalateOrderDto` `{ motivo }` | `Order` + notificación a supervisor |

**RegisterSolutionDto:** `{ descripcion, solucionTipo, comentario?, esFalla?, esPrediccionCorrecta?, esClasificacionCorrecta? }`.
**RejectPredictionDto:** `{ justificacion: string }`.
**ReassignOrderDto:** `{ tecnicoId: number, motivo: string }`.

**Order:** `{ id, maquinaId, lecturaId, tipoFallo, algoritmoClasificador, confianza, ensembleAvg, nivelRiesgo, tecnicoId, estado, solucionDescripcion, solucionTipo, detectadoEn, finalizadoEn }`.
**Transiciones válidas:** `pendiente → en_progreso → finalizado` (otra ruta → 409).

---

## 7. `alerts` — Alertas

| Método | Ruta | Query | Respuesta |
|--------|------|-------|-----------|
| GET | `/alerts` | `?estado=&nivel=&maquinaId=&page=&limit=` | `{ items: Alert[], total, page, limit }` |
| GET | `/alerts/active` | — | `Alert[]` (para Monitoreo en tiempo real) |
| GET | `/alerts/:id` | — | `Alert` |
| PATCH | `/alerts/:id/status` | `{ estado }` | `Alert` |

**Alert:** `{ id, orderId, maquinaId, nivel, reglaCodigo, tipoFallo, ensembleAvg, tecnicoId, estado, notificacionEnviada, creadoEn }`.

---

## 8. `rag` — Recomendaciones (S-3)

| Método | Ruta | Body | Respuesta |
|--------|------|------|-----------|
| GET | `/rag/plan/:orderId` | — | `RagPlan` `{ id, orderId, tipoFallo, modeloOrigen, escalado, estado, acciones: AccionRag[], fuentes: FuenteRag[] }` |
| POST | `/rag/plan/:orderId/accept` | — | `RagPlan` (→ `aceptado`, orden → `en_progreso`) |
| POST | `/rag/plan/:orderId/reject` | `{ motivo? }` | `RagPlan` (→ `rechazado`) |
| POST | `/rag/plan/:orderId/regenerate` | `{ escalado?: boolean }` | `RagPlan` |

**AccionRag:** `{ orden, prioridad, titulo, detalle }`.

---

## 9. `technicians` — Técnicos

| Método | Ruta | Query / Body | Respuesta |
|--------|------|--------------|-----------|
| GET | `/technicians` | `?estado=&especialidad=&turno=&page=&limit=` | `{ items: Technician[], total, page, limit }` |
| GET | `/technicians/available` | `?nivelRiesgo=&tipoFallo=` | `Technician[]` (candidatos según regla de asignación) |
| GET | `/technicians/:id` | — | `Technician` |
| POST | `/technicians` | `CreateTechnicianDto` | `Technician` |
| PATCH | `/technicians/:id` | `UpdateTechnicianDto` | `Technician` |
| DELETE | `/technicians/:id` | — | `{ ok: true }` |

**CreateTechnicianDto:** `{ nombre, especialidad, turno, telefono, email?, maquinasAsignadas[] }`.
**Technician:** `{ id, nombre, iniciales, especialidad, turno, estado, telefono, email, nivelExperiencia, ordenesHoy, maquinas[] }`.

---

## 10. `notifications` — Mensajería / log

| Método | Ruta | Query / Body | Respuesta |
|--------|------|--------------|-----------|
| GET | `/notifications/log` | `?tecnicoId=&canal=&from=&to=&page=&limit=` | `{ items: SentMessage[], total, page, limit }` |
| POST | `/notifications/send` | `{ tecnicoId?, orderId?, canal, tipoEnvio }` | `SentMessage` |
| GET | `/notifications/next-dispatch` | — | `{ proximoEnvio, hora }` (para Monitoreo) |

**SentMessage:** `{ id, tecnicoId, orderId, maquinas, motivo, canal, tipoEnvio, estado, enviadoEn }`.

---

## 11. `repetitive-faults` — Fallos repetitivos

| Método | Ruta | Query / Body | Respuesta |
|--------|------|--------------|-----------|
| GET | `/repetitive-faults` | `?estado=&nivel=&page=&limit=` | `{ items: RepetitiveFault[], total, page, limit }` |
| GET | `/repetitive-faults/:maquinaId/history` | `?tipoFallo=` | `Order[]` (intervenciones en la ventana) |
| POST | `/repetitive-faults/:id/resolve` | `{ nota? }` | `RepetitiveFault` (→ `resuelto`) |

**RepetitiveFault:** `{ id, maquinaId, tipoFallo, ocurrencias, ventanaDias, estado, ultimaAccion, nivel, supervisorNotificado, ultimaOcurrenciaEn }`.

---

## 12. `ml-models` + `config-catalog` — Configuración

| Método | Ruta | Body | Respuesta |
|--------|------|------|-----------|
| GET | `/ml-models` | `?etapa=S1\|S2` | `MlModel[]` |
| PATCH | `/ml-models/:id/activate` | — | `MlModel` (activa uno por etapa; desactiva el resto) |
| GET | `/config` | `?grupo=` | `{ clave: valor, ... }` (umbral ensemble, agreement, repetitividad) |
| PATCH | `/config` | `{ clave: valor, ... }` | config actualizada |
| GET | `/catalog/fault-types` | — | `FaultType[]` |
| GET | `/catalog/risk-levels` | — | `RiskLevel[]` |
| GET | `/catalog/rag-sources` | — | `RagSource[]` |
| PATCH | `/catalog/rag-sources/:id` | `{ activa }` | `RagSource` |
| GET | `/catalog/notification-rules` | — | `NotificationRule[]` (reglas de notificación por nivel de riesgo) |
| PATCH | `/catalog/notification-rules/:nivel` | `{ recibe?, canal? }` | `NotificationRule` (actualiza canal/destinatario) |
| GET | `/catalog/escalation-actions` | — | `EscalationAction[]` (acciones de escalamiento por tipo de fallo) |
| PATCH | `/catalog/escalation-actions/:tipoFallo` | `{ acciones }` | `EscalationAction` |
| GET | `/catalog/dispatch-schedule` | — | `DispatchSchedule[]` |
| PATCH | `/catalog/dispatch-schedule` | `{ items: DispatchScheduleItem[] }` | `DispatchSchedule[]` |

---

## 13. `analytics` — Analítica y reportes

| Método | Ruta | Query | Respuesta |
|--------|------|-------|-----------|
| GET | `/analytics/dashboard` | — | KPIs del Dashboard (máquinas, fallos hoy, tasa, precisión) |
| GET | `/analytics/summary` | `?range=week\|month` | efectividad (alertas, % con/sin RAG, sin atender) |
| GET | `/analytics/faults-by-type` | `?range=` | `[{ tipoFallo, count }]` |
| GET | `/analytics/unattended` | — | `Order[]` (pendientes sin respuesta) |
| GET | `/analytics/recurrent-machines` | — | `[{ maquinaId, tipo, fallos }]` |
| GET | `/analytics/machine-recurrence` | `?days=7&minFallos=2&range=` | ranking de máquinas por fallos en ventana temporal configurable |
| GET | `/analytics/availability` | — | disponibilidad operativa por máquina y global |
| GET | `/analytics/prediction-validation` | `?range=` | cruce predicción ML vs. observación/decisión del técnico |
| GET | `/analytics/reliability` | `?range=` | MTTR y MTBF por máquina y global |
| GET | `/analytics/sensor-trend` | `?variable=&hours=24&maquinaId=` | series para Recharts |
| GET | `/analytics/export` | `?type=csv&range=` | archivo CSV (descarga) |

---

## 13b. `monitoring` — Tiempo real (SSE)

| Método | Ruta | Query | Respuesta |
|--------|------|-------|-----------|
| GET (SSE) | `/monitoring/stream` | `?token=<jwt>` | Stream `text/event-stream` con eventos en vivo (lectura de sensor, alerta/orden creada, asignación de técnico) |

> A diferencia del resto de endpoints, **el SSE recibe el JWT por query** (`?token=`) y no por
> header `Authorization`, porque `EventSource` del navegador no permite cabeceras personalizadas.
> Marcado `@Public()` + guard `SseJwtQueryGuard`. Lo consume la vista de Monitoreo para refrescar
> tarjetas de máquinas sin recargar la página.

---

## 14. `predictmaint-ml` — API de modelos (FastAPI, consumida por `ml-gateway`)

> Interna; **no** expuesta al navegador. Auth por header `X-API-Key`.

| Método | Ruta | Body | Respuesta |
|--------|------|------|-----------|
| POST | `/predict` | features de la lectura | resultado S-1 |
| POST | `/classify` | features de la lectura | resultado S-2 |
| POST | `/rag` | `{ tipoFallo, maquinaId, historial[] }` | plan S-3 |
| GET | `/health` | — | `{ status: "ok", modelosCargados }` |

**Entrada `/predict` y `/classify`:**
```json
{ "type": "H", "airTemperature": 298.5, "processTemperature": 304.7,
  "rotationalSpeed": 1240, "torque": 42.8, "toolWear": 185 }
```
**Salida `/predict` (S-1):**
```json
{
  "ensembleAvg": 0.887, "nivelRiesgo": "CRITICAL", "consenso": "FALLA",
  "modelos": [
    { "modelo": "xgboost", "prediccion": "FALLA", "probabilidad": 94.2,
      "accuracy": 93.1, "rocAuc": 0.961, "precision": 91.4, "recall": 94.8,
      "f1Score": 93.1, "tn": 8820, "fp": 180, "fn": 320, "tp": 680, "esLider": true },
    { "modelo": "random_forest", "prediccion": "FALLA", "probabilidad": 91.8, "...": "..." },
    { "modelo": "regresion_logistica", "prediccion": "SIN_FALLA", "probabilidad": 72.1, "...": "..." }
  ]
}
```
**Salida `/classify` (S-2):**
```json
{
  "tipoPredicho": "HDF", "agreement": "ALTO", "confianza": 78.4,
  "modelos": [
    { "modelo": "lightgbm", "tipoPredicho": "HDF", "probHdf": 78.4, "probPwf": 12.1,
      "probTwf": 6.3, "probOsf": 2.8, "probRnf": 0.4, "f1Macro": 0.814,
      "f1Weighted": 0.831, "accuracy": 85.4, "esLider": true, "diverge": false },
    { "modelo": "decision_tree", "...": "..." },
    { "modelo": "svm", "tipoPredicho": "PWF", "diverge": true, "...": "..." }
  ]
}
```
**Salida `/rag` (S-3):**
```json
{
  "tipoFallo": "HDF", "escalado": false,
  "acciones": [
    { "orden": 1, "prioridad": "CRITICO", "titulo": "Verificación del sistema de enfriamiento",
      "detalle": "Detener M-001 antes de 30 min. Inspeccionar refrigeración..." }
  ],
  "fuentes": ["Theissler et al. (2021)", "Pashmforoush et al. (2025)", "Cai et al. (2023)"]
}
```

---

## 15. Mapeo vista → endpoints (lo que consume cada pantalla)

| Vista | Endpoints |
|-------|-----------|
| 01 Login | `POST /auth/login` |
| 02 Dashboard | `GET /analytics/dashboard`, `GET /alerts`, `GET /machines`, `GET /analytics/sensor-trend` |
| 03 Monitoreo | `GET /monitoring/stream` (SSE), `GET /alerts/active`, `GET /machines`, `GET /notifications/next-dispatch` |
| TAB 1 Predicción | `GET /orders/:id`, `GET /predictions/binary/:orderId`, `GET /machines/:id/readings` |
| TAB 2 Clasificación | `GET /predictions/multiclass/:orderId` |
| TAB 3 Recomendaciones | `GET /rag/plan/:orderId`, `POST /rag/plan/:orderId/accept\|reject`, `POST /orders/:id/solution` |
| 06 Historial | `GET /orders` (filtros), `POST /orders/:id/reassign` |
| 07 Detalle de Orden | `GET /orders/:id`, `GET /orders/:id/timeline`, `POST /orders/:id/start`, `POST /orders/:id/solution`, `POST /orders/:id/reject-prediction` |
| Mi trabajo (técnico) | `GET /orders/my-board`, acciones sobre `/orders/:id/*` |
| 06b Técnicos | `GET/POST/PATCH/DELETE /technicians`, `GET /catalog/...` |
| 07 Analítica | `GET /analytics/*` (incl. `reliability`, `availability`, `prediction-validation`, `machine-recurrence`), `GET /notifications/log` |
| Analítica Repetitivos | `GET /repetitive-faults`, `GET /repetitive-faults/:id/history` |
| Perfil | `GET /users/me`, `PATCH /users/me` |
| Config 1–5 | `GET/PATCH /ml-models`, `/config`, `/catalog/*` (incl. `notification-rules`, `escalation-actions`) |

---

## 16. Generación de Swagger
La referencia usa `@nestjs/swagger`. Al implementar, decorar controllers/DTOs con
`@ApiTags`, `@ApiOperation`, `@ApiResponse` y exponer la spec en `/api/docs`. Este documento
es el contrato fuente; Swagger será su versión navegable y siempre sincronizada con el código.
