# Ciclo de vida de las órdenes y asignación/reasignación de técnicos

Documentación técnica del flujo de órdenes de mantenimiento y de la asignación
de técnicos en `predictmaint-api`.

Archivos de referencia:

- `predictmaint-api/src/orders/orders.service.ts`
- `predictmaint-api/src/orders/orders.controller.ts`
- `predictmaint-api/src/orders/dto/order.dto.ts`
- `predictmaint-api/src/technicians/technicians.service.ts`
- `predictmaint-api/src/technicians/technicians.controller.ts`
- `predictmaint-api/src/technicians/dto/technician.dto.ts`
- `predictmaint-api/src/common/utils/assignment-retry.util.ts`
- `predictmaint-api/src/database/models/orden.model.ts`

---

## 1. Estados de la orden y transiciones válidas

El modelo `Orden` (`database/models/orden.model.ts`) guarda el estado en la
columna `estado` (`STRING(30)`, valor por defecto `'pendiente'`). Los estados
posibles, definidos por el enum `EstadoOrden`, son:

| Estado        | Significado                                                       |
| ------------- | ---------------------------------------------------------------- |
| `pendiente`   | Orden creada/asignada, aún no iniciada por el técnico.           |
| `en_progreso` | El técnico inició la intervención.                               |
| `finalizado`  | Cerrada con solución registrada (estado terminal).              |
| `rechazada`   | El técnico rechazó la predicción automática (estado terminal).  |

Las transiciones permitidas se declaran en `VALID_TRANSITIONS`
(`orders.service.ts`, líneas 53-58):

```ts
const VALID_TRANSITIONS: Record<EstadoOrden, EstadoOrden[]> = {
  [EstadoOrden.PENDIENTE]: [EstadoOrden.EN_PROGRESO, EstadoOrden.RECHAZADA],
  [EstadoOrden.EN_PROGRESO]: [EstadoOrden.FINALIZADO],
  [EstadoOrden.FINALIZADO]: [],
  [EstadoOrden.RECHAZADA]: [],
};
```

Diagrama de transiciones:

```
                 ┌──────────────┐
   crear ───────▶│  pendiente   │
                 └──────┬───────┘
            start /     │      \  reject-prediction
            status      │       \
                        ▼        ▼
                 ┌──────────────┐  ┌──────────────┐
                 │ en_progreso  │  │  rechazada   │ (terminal)
                 └──────┬───────┘  └──────────────┘
            solution /  │
            status      ▼
                 ┌──────────────┐
                 │ finalizado   │ (terminal)
                 └──────────────┘
```

La validación se aplica en `updateStatus` (líneas 507-512): si el estado destino
no está dentro de los permitidos para el estado actual, se lanza
`ConflictException('Transición inválida: <origen> → <destino>')`.

`finalizado` y `rechazada` son terminales: no admiten más transiciones.

---

## 2. Acciones, endpoints y efectos

Todas las rutas están bajo el controlador `orders` (`@Controller('orders')`).
El usuario autenticado se inyecta con `@UserContext()` (`AuthUserPayload`).

### 2.1 Crear orden

- Endpoint: `POST /orders`
- Handler: `create` → `OrdersService.create` (líneas 469-497)
- DTO: `CreateOrderDto` (`maquinaId` obligatorio, `tipoFallo` opcional).

Qué hace:

1. Busca la máquina por código (`findMaquinaByCodigo`); 404 si no existe.
2. Toma la última lectura de sensor de la máquina; error si no hay lecturas.
3. Crea un `AnalisisFallo` con `nivelRiesgo = 'MEDIUM'`.
4. Genera código de orden (`generateOrderCodigo`) y crea la `Orden` con
   `estado = PENDIENTE` y `fechaCreacion = now`.

Campos que toca: crea registros `AnalisisFallo` y `Orden`. La orden nace sin
técnico asignado (`idTecnico` nulo). No registra `EventoOrden` aquí.

### 2.2 Iniciar (start)

- Endpoint: `POST /orders/:id/start`
- Handler: `startOrder` → `OrdersService.startOrder` (líneas 385-395)

Qué hace:

1. Verifica acceso con `assertCanAccessOrder`.
2. Exige que el estado sea `PENDIENTE`, si no → `ConflictException('La orden ya
   fue iniciada o finalizada')`.
3. Exige que la orden tenga `idTecnico` asignado, si no →
   `BadRequestException('La orden no tiene técnico asignado')`.
4. Delega en `updateStatus(codigo, { estado: EN_PROGRESO }, user, 'tecnico')`.

Campos que toca (vía `updateStatus`): `estado → en_progreso`, fija
`fechaInicio` (si no existía). Evento registrado: etapa `en_progreso`,
actor `tecnico`.

### 2.3 Actualizar estado

- Endpoint: `PATCH /orders/:id/status`
- Handler: `updateStatus` → `OrdersService.updateStatus` (líneas 499-535)
- DTO: `UpdateOrderStatusDto` (`estado` enum `EstadoOrden`).

Qué hace:

1. `assertCanAccessOrder`.
2. Valida la transición contra `VALID_TRANSITIONS`.
3. Actualiza la orden:
   - Si destino `EN_PROGRESO` y no hay `fechaInicio` → fija `fechaInicio`.
   - Si destino `FINALIZADO` → fija `fechaFin`.
4. Sincroniza el estado de las alertas asociadas (`syncAlertEstadoForOrder`):
   `EN_PROGRESO` o `FINALIZADO` según corresponda.
5. Registra `EventoOrden` con etapa `en_progreso` o `finalizado`, descripción
   `Estado → <estado>`, actor = parámetro `actor` (por defecto `usuario`).
6. Si pasa a `FINALIZADO` y hay técnico → `releaseIfIdle(idTecnico)`.

### 2.4 Registrar solución (finaliza)

- Endpoint: `POST /orders/:id/solution`
- Handler: `registerSolution` → `OrdersService.registerSolution` (líneas 537-597)
- DTO: `RegisterSolutionDto` (`descripcion`, `solucionTipo`, y opcionales
  `comentario`, `esFalla`, `esPrediccionCorrecta`, `esClasificacionCorrecta`).

Qué hace:

1. `assertCanAccessOrder`.
2. Si la orden ya está `FINALIZADO` → `ConflictException`.
3. Si el actor es técnico y la orden sigue `PENDIENTE` →
   `BadRequestException('Debe iniciar la orden antes de registrar la solución')`.
4. Detecta rechazo manual (`solucionTipo === RECHAZADA_MANUAL`).
5. Crea `SolucionAplicada` (tipo, descripción, fecha).
6. Crea `ObservacionTecnica` con `idTipoFallo` del líder de clasificación,
   banderas `esFalla` / `esPrediccionCorrecta` / `esClasificacionCorrecta`
   (tomadas del DTO o derivadas; en rechazo manual quedan en `false`) y
   `decision = ACEPTADA` (o `RECHAZADA` si es rechazo manual).
7. Actualiza la orden: `estado → FINALIZADO`, `fechaFin = now`, `fechaInicio`
   si faltaba, y `observaciones` (comentario o descripción).
8. Sincroniza alertas a `FINALIZADO`.
9. Registra `EventoOrden`: etapa `finalizado`, descripción = `descripcion`,
   actor `tecnico`.
10. `releaseIfIdle(idTecnico)`.

### 2.5 Rechazar predicción

- Endpoint: `POST /orders/:id/reject-prediction`
- Handler: `rejectPrediction` → `OrdersService.rejectPrediction` (líneas 402-450)
- DTO: `RejectPredictionDto` (`justificacion` obligatoria).

Qué hace (el técnico rechaza la predicción automática del modelo):

1. `assertCanAccessOrder`.
2. Exige estado `PENDIENTE`, si no → `ConflictException`.
3. Exige `justificacion` no vacía, si no → `BadRequestException`.
4. Crea `ObservacionTecnica` con `esFalla = false`,
   `esPrediccionCorrecta = false`, `esClasificacionCorrecta = false`,
   `decision = RECHAZADA` y el comentario de justificación. Esto alimenta el
   historial de aciertos del modelo.
5. Actualiza la orden: `estado → RECHAZADA`, `fechaFin = now`,
   `observaciones = justificacion`.
6. Sincroniza alertas a `FINALIZADO`.
7. Registra `EventoOrden`: etapa `rechazo_prediccion`, descripción
   `Predicción rechazada: <justificacion>`, actor `tecnico`.
8. `releaseIfIdle(idTecnico)`.

### 2.6 Reasignar (supervisor)

- Endpoint: `POST /orders/:id/reassign`
- Handler: `reassign` → `OrdersService.reassignOrder` (líneas 613-684)
- DTO: `ReassignOrderDto` (`tecnicoId` y `motivo`, ambos obligatorios).

Solo un supervisor o jefe de planta puede reasignar. Validaciones:

1. Rol elevado obligatorio (`isElevatedRole`), si no →
   `ForbiddenException('Solo un supervisor o jefe de planta puede reasignar')`.
2. Si la orden está `FINALIZADO`/`RECHAZADA` → `ConflictException`
   ("ya está cerrada").
3. Solo se reasigna una orden `PENDIENTE` que aún no tenga `fechaInicio`.
4. Debe existir SLA configurado para el `nivelRiesgo` (`getSlaMinutos`);
   si no → `ConflictException`.
5. Debe haber vencido el tiempo límite: `minutosSinAtender >= sla`. Si no, error
   indicando los minutos restantes.
6. `motivo` obligatorio.
7. Resuelve el técnico destino con `assignToOrder(dto.tecnicoId)`; 404 si no
   existe. Si ya es el técnico actual → `ConflictException`.

Qué cambia en la orden (líneas 651-658):

```ts
await o.update({
  idTecnico: nuevo.idTecnico,
  estado: EstadoOrden.PENDIENTE,
  fechaInicio: undefined,
  proximoReintentoAsignacion: undefined,
  reasignadoMotivo: motivo,
  reasignadoEn: now,
});
```

Otros efectos:

- Actualiza las alertas de la orden (no finalizadas) al nuevo técnico y estado
  `PENDIENTE`.
- Registra `EventoOrden`: etapa `reasignacion`, descripción
  `Reasignado a <nombre>: <motivo>`, actor `supervisor`.
- **Libera al técnico anterior**: si había `prevTecnicoId` distinto del nuevo →
  `releaseIfIdle(prevTecnicoId)`.
- **Notifica al nuevo técnico**: emite el evento `ORDER_CREATED_EVENT` con el
  payload (`orderId`, `tecnicoId`, `maquinaId`, `nivelRiesgo`), reutilizando el
  flujo de notificación de asignación.

### 2.7 Escalar

- Endpoint: `POST /orders/:id/escalate`
- Handler: `escalate` → `OrdersService.escalate` (líneas 599-610)
- DTO: `EscalateOrderDto` (`motivo`).

Qué hace: `assertCanAccessOrder` y registra `EventoOrden` con etapa `escalado`,
descripción = `motivo`, actor `sistema`. **No cambia el estado de la orden**;
solo deja constancia en el timeline.

### Resumen de endpoints

| Acción              | Método y ruta                       | Estado destino        |
| ------------------- | ----------------------------------- | --------------------- |
| Listar              | `GET /orders`                       | —                     |
| Tablero técnico     | `GET /orders/my-board`              | —                     |
| Timeline            | `GET /orders/:id/timeline`          | —                     |
| Obtener             | `GET /orders/:id`                   | —                     |
| Crear               | `POST /orders`                      | `pendiente`           |
| Iniciar             | `POST /orders/:id/start`            | `en_progreso`         |
| Actualizar estado   | `PATCH /orders/:id/status`          | según transición      |
| Registrar solución  | `POST /orders/:id/solution`         | `finalizado`          |
| Rechazar predicción | `POST /orders/:id/reject-prediction`| `rechazada`           |
| Reasignar           | `POST /orders/:id/reassign`         | `pendiente` (reset)   |
| Escalar             | `POST /orders/:id/escalate`         | sin cambio            |

---

## 3. `toResponse`: campos expuestos al frontend

El método `toResponse(o: Orden)` (líneas 168-238) transforma la entidad a la
forma que consume el frontend. Campos principales:

| Campo                          | Origen                                                        |
| ------------------------------ | ------------------------------------------------------------ |
| `id`                           | `o.codigo`                                                    |
| `maquinaId`                    | `o.maquina.codigo` (o `idMaquina`)                           |
| `lecturaId`                    | `analisis.idLectura`                                          |
| `tipoFallo`                    | clasificación líder (`liderS2.tipoFallo.codigo`)             |
| `modeloPrediccion`             | modelo del líder de predicción (S1)                          |
| `confianzaPrediccion`          | `liderS1.probabilidad`                                        |
| `algoritmoClasificador`        | modelo del líder de clasificación (S2)                      |
| `modeloClasificacion`          | modelo del líder de clasificación (S2)                      |
| `confianza`                    | `liderS2.confianza`                                           |
| `confianzaLider` / `ensembleAvg` | probabilidad líder S1 o `ensembleAvg`                      |
| `nivelRiesgo`                  | `analisis.nivelRiesgo` (por defecto `MEDIUM`)               |
| `tecnicoId`                    | `o.idTecnico`                                                 |
| `estado`                       | `o.estado`                                                    |
| `solucionDescripcion` / `solucionTipo` | última `SolucionAplicada`                            |
| `observacionesOrden`           | `o.observaciones`                                            |
| **`reasignadoMotivo`**         | `o.reasignadoMotivo`                                          |
| **`reasignadoEn`**             | `o.reasignadoEn` en ISO (o `null`)                          |
| `observacionTecnica`           | última observación (comentario, banderas, decisión, fecha)  |
| `detectadoEn`                  | `o.fechaCreacion`                                            |
| `iniciadoEn`                   | `o.fechaInicio`                                              |
| `finalizadoEn`                 | `o.fechaFin`                                                 |
| `proximoReintentoAsignacion`   | `o.proximoReintentoAsignacion` en ISO                       |
| `intentosAsignacion`           | `o.intentosAsignacion` (0 por defecto)                      |
| `ragEstado`                    | último estado RAG (`latestRagEstado`)                       |
| `maquina`                      | objeto máquina (si está cargada)                            |
| `tecnico`                      | `{ id, nombre, iniciales }` (si está cargado)               |
| `lectura`                      | lectura de sensor (si está cargada)                         |

Los campos de reasignación (`reasignadoMotivo`, `reasignadoEn`) permiten al
frontend mostrar el motivo y la fecha de la última reasignación realizada por el
supervisor.

---

## 4. Control de acceso por rol

Roles relevantes (`RolUsuario`):

- Elevados: `SUPERVISOR`, `JEFE_PLANTA` → `isElevatedRole` (líneas 126-130).
- Técnicos: `TECNICO`, `TECNICO_SENIOR` → `isTechnicianRole` (líneas 132-136).

### `assertCanAccessOrder` (líneas 138-145)

```ts
private assertCanAccessOrder(order: Orden, user?: AuthUserPayload): void {
  if (!user || this.isElevatedRole(user)) return;
  if (this.isTechnicianRole(user)) {
    if (!user.tecnicoId || order.idTecnico !== user.tecnicoId) {
      throw new ForbiddenException('No tienes acceso a esta orden');
    }
  }
}
```

- Sin usuario o con rol elevado → acceso total.
- Técnico → solo puede acceder a órdenes donde `order.idTecnico === user.tecnicoId`;
  en caso contrario `ForbiddenException`.

Se invoca en `findOne`, `startOrder`, `rejectPrediction`, `getTimeline`,
`updateStatus`, `registerSolution`, `escalate` y `reassignOrder`.

### `applyRoleScope` (líneas 147-154)

En los listados (`findAll`) y en el tablero, si el usuario es técnico con
`tecnicoId`, se inyecta `where.idTecnico = user.tecnicoId`, de modo que el
técnico **solo ve sus propias órdenes**. `getTechnicianBoard` (líneas 356-383)
además exige rol técnico con `tecnicoId`, devolviendo sus órdenes pendientes/en
progreso y las últimas 30 finalizadas.

---

## 5. Asignación de técnicos

Lógica en `technicians.service.ts`.

### 5.1 `findAvailable` / `assignForOrder` (estrategia por nivel)

`assignForOrder(nivelRiesgo, tipoFallo)` (líneas 282-296) selecciona el primer
candidato de `findAvailable` (líneas 232-280) y, si está `DISPONIBLE`, lo marca
`EN_INTERVENCION`.

`findAvailable` parte de los técnicos `DISPONIBLE` con usuario activo, los filtra
por turno (ver 5.4) y luego aplica la estrategia según el nivel de riesgo:

- **CRITICAL → por experiencia**: ordena por `nivelExperiencia` descendente
  (más experimentado primero).
- **HIGH → por especialidad según tipo de fallo**: resuelve la especialidad con
  `resolveSpecialty(tipoFallo)` y filtra los técnicos que la tengan. Si la
  especialidad es `HIDRAULICO` y no hay coincidencias, cae a `MECANICO`. Si no
  hay coincidencias, devuelve todos los del turno.
- **MEDIUM / LOW → por menor carga**: cuenta las órdenes activas
  (`pendiente`/`en_progreso`) de cada técnico y los ordena de menor a mayor
  carga.

`resolveSpecialty` (líneas 95-108) busca primero una `ReglaAsignacion` activa
para el tipo de fallo; si no la hay, usa el mapa `FAULT_SPECIALTY`
(`HDF→MECANICO`, `PWF→ELECTRICO`, `TWF→MECANICO`, `OSF→MECANICO`,
`RNF→GENERAL`), con fallback a `GENERAL`.

### 5.2 `assignToOrder` (reasignación directa)

`assignToOrder(tecnicoId)` (líneas 298-308) busca el técnico por PK; si existe y
está `DISPONIBLE`, lo marca `EN_INTERVENCION`. Lo usa `reassignOrder` para la
reasignación directa por supervisor (sin pasar por la estrategia automática).

### 5.3 `releaseIfIdle`

`releaseIfIdle(tecnicoId)` (líneas 310-326): si el técnico está
`EN_INTERVENCION` y **no le quedan órdenes activas** (`pendiente`/`en_progreso`),
lo devuelve a `DISPONIBLE`. Se llama al finalizar, rechazar o reasignar una
orden, para liberar al técnico anterior cuando ya no tiene carga.

### 5.4 Filtro por turno

`filterByActiveShift` (líneas 110-118): obtiene el turno actual
(`getCurrentTurno`) y se queda con los técnicos cuyo `turno` coincide y que no
estén `FUERA_DE_TURNO`. Si ninguno coincide con el turno actual, hace fallback a
todos los que no estén `FUERA_DE_TURNO`.

### 5.5 Reintento de asignación por nivel

`common/utils/assignment-retry.util.ts` define los minutos de espera entre
reintentos de asignación según el nivel de riesgo:

```ts
const DEFAULT_MINUTES = {
  CRITICAL: 15,
  HIGH: 15,
  MEDIUM: 30,
  LOW: 60,
};
```

- `defaultReintentoMinutos(nivel)` → minutos por defecto (fallback 30).
- `configKeyForReintento(nivel)` → clave de configuración asociada
  (`reintento_asignacion_<nivel>_min`), para sobrescribir desde el catálogo.
- `specialtyFromFaultLabel(label)` → mapea el texto de
  `especialidad_requerida` del tipo de fallo al enum de especialidad
  (eléctrico / hidráulico / mecánico / general).

`TechniciansService.getReintentoMinutos` (líneas 91-93) reexpone
`defaultReintentoMinutos`. La orden almacena el control del reintento en
`proximoReintentoAsignacion` e `intentosAsignacion` (modelo `Orden`), campos que
se exponen en `toResponse` y se resetean al reasignar.

---

## 6. CRUD de técnicos

Controlador `technicians` (`@Controller('technicians')`).

| Acción     | Método y ruta                | Servicio                |
| ---------- | ---------------------------- | ----------------------- |
| Listar     | `GET /technicians`           | `findAll`               |
| Disponibles| `GET /technicians/available` | `findAvailable`         |
| Obtener    | `GET /technicians/:id`       | `findOne`               |
| Crear      | `POST /technicians`          | `create`                |
| Actualizar | `PATCH /technicians/:id`     | `update`                |
| Eliminar   | `DELETE /technicians/:id`    | `remove` (baja lógica)  |

### `findAll` (líneas 120-158)

Filtra por `estado` (→ `disponibilidad`) y `turno` vía SQL, y por
`especialidad` en memoria (comparando `especialidadRef.nombre`). Adjunta a cada
técnico estadísticas de carga (`loadAssignmentStats`): máquinas y
`ordenesHoy` = nº de órdenes activas asignadas. Devuelve resultado paginado.

### `findOne` (líneas 160-167)

Busca por PK con `Usuario` y `Especialidad`; 404 si no existe. Añade las
estadísticas de carga.

### `create` (líneas 169-193)

DTO `CreateTechnicianDto` (`nombre`, `especialidad`, `turno`, `telefono`,
`email?`). Resuelve la especialidad (404 si no existe), crea el `Usuario`
asociado (rol técnico, password hash por defecto, estado `activo`) y luego el
`Tecnico` con `disponibilidad = DISPONIBLE`. Devuelve el técnico creado.

### `update` (líneas 195-223)

DTO `UpdateTechnicianDto` (`PartialType` de create + `estado`, `enviarWssp`,
`enviarCorreo`). Actualiza nombre/apellidos del usuario, especialidad, turno,
disponibilidad (`estado`), flags de notificación, teléfono y correo según los
campos presentes. Devuelve el técnico actualizado.

### `remove` (líneas 225-230)

**Baja lógica**: marca el `Usuario` asociado como `inactivo` (no borra el
registro). Devuelve `{ ok: true }`.

### `findAvailable` (endpoint)

`GET /technicians/available?nivelRiesgo=&tipoFallo=` expone la estrategia de
selección descrita en la sección 5.1, útil para que el frontend muestre los
candidatos sugeridos antes de asignar/reasignar.
