# Sistema RAG (Recomendaciones S-3) — Vista de Backend

Documentación técnica del subsistema **RAG (S-3)** de PredictMaint, enfocada en cómo
el **backend NestJS** orquesta, **persiste** y **sirve** los planes de recomendación
generados por el servicio de Machine Learning.

> Convención del pipeline: **S-1** = detección binaria de fallo, **S-2** = clasificación
> multiclase del tipo de fallo (HDF/PWF/TWF/OSF/RNF), **S-3** = generación del plan de
> recomendaciones técnicas vía RAG.

---

## 1. Qué es el RAG aquí

En este proyecto, "RAG" es un **motor ligero de recuperación + generación de planes de
mantenimiento (S-3)**. Es importante separar claramente las responsabilidades:

- **El ML (`predictmaint-ml/rag.py`) GENERA el plan.** Es quien decide el contenido de
  las recomendaciones. Funciona en dos modos:
  - **LLM (modo principal):** llama a un proveedor estilo OpenAI, por defecto **OpenRouter**
    (`https://openrouter.ai/api/v1`, modelo por defecto `openai/gpt-4o-mini`). El prompt
    instruye al modelo a producir **exactamente 3 recomendaciones** usando **solo** las
    fuentes autorizadas que se le pasan en contexto.
  - **Plantillas (fallback determinista):** si el LLM está deshabilitado, no hay API key,
    o la respuesta del LLM falla / no valida, `rag.py` cae a planes locales por tipo de
    fallo (`FAULT_ACTION_PLANS`, y `RNF_MANUAL_INSPECTION` para fallos aleatorios).

  Extracto de la lógica de decisión en `predictmaint-ml/rag.py` (`generate_action_plan`):

  ```python
  if fault == "RNF":
      # RNF siempre va a inspección manual local (no LLM)
      ...
  if not _env_bool("RAG_USE_LLM", True):
      return _template_plan(fault, maquina_id, is_escalated, fuentes)   # fallback
  if not _provider_api_key():
      return _template_plan(fault, maquina_id, is_escalated, fuentes)   # fallback
  try:
      return _generate_with_llm(fault, maquina_id, is_escalated, fuentes)  # LLM OpenRouter
  except Exception as exc:
      ...
      return _template_plan(fault, maquina_id, is_escalated, fuentes)   # fallback ante error
  ```

  Variables de entorno relevantes del ML: `RAG_USE_LLM`, `OPENROUTER_API_KEY` /
  `OPENAI_API_KEY`, `RAG_PROVIDER` (default `openrouter`), `RAG_MODEL`, `RAG_TEMPERATURE`,
  `RAG_TIMEOUT_SEC`, `RAG_SSL_VERIFY`.

- **El backend (`predictmaint-api`) NO genera contenido de IA.** El backend:
  1. Llama al endpoint `/rag` del ML a través del **ML Gateway**.
  2. **Condensa** las 3 acciones devueltas en **una recomendación general** legible
     (`buildGeneralRecommendation`).
  3. **Persiste** esa recomendación en BD ligada a la **clasificación líder** del análisis.
  4. **Sirve** el plan desde BD a la app web mediante el `RagController`.
  5. Registra la **interacción del técnico** (aceptar / rechazar / regenerar) y la
     **solución aplicada** al finalizar la orden.

En otras palabras: **el ML es el cerebro generativo; el backend es la fuente de verdad
persistida y el API de servicio.**

> Nota sobre `plan_rag`: existe un modelo `PlanRag` (tabla `plan_rag`) con su propia
> jerarquía (`accion_rag`, `plan_rag_fuente`) y enum de estado `EstadoPlanRag`. Sin
> embargo, el flujo S-3 vivo descrito en este documento **persiste sobre
> `recomendaciones_rag` + `recomendaciones_rag_fuente`**, ligadas a la clasificación
> líder, no sobre `plan_rag`. El `RagController` lee y escribe siempre sobre
> `recomendaciones_rag`. `PlanRag` queda como modelo de estado del plan a nivel de orden
> (referencia/uso paralelo), no como el almacén de las acciones servidas por el endpoint.

Archivos clave del backend:

- `predictmaint-api/src/rag/rag.service.ts`
- `predictmaint-api/src/rag/rag.controller.ts`
- `predictmaint-api/src/rag/dto/rag.dto.ts`
- `predictmaint-api/src/ml-gateway/ml-gateway.service.ts`
- `predictmaint-api/src/sensor-readings/sensor-readings.service.ts` (`persistRagPlan`)
- `predictmaint-api/src/common/utils/rag-recommendation.util.ts` (`buildGeneralRecommendation`)
- `predictmaint-api/src/orders/orders.service.ts` (`registerSolution`)

---

## 2. Generación del plan en el pipeline (`persistRagPlan`)

Cuando una lectura de sensor dispara una alerta, el pipeline ejecuta S-1 → S-2 y, una vez
elegida la **clasificación líder** (tipo de fallo final), invoca `persistRagPlan` para
generar y guardar el plan S-3.

Punto de invocación en `sensor-readings.service.ts` (≈ línea 488):

```ts
await this.persistRagPlan(liderClas.idClasificacion, tipoFalloFinal, dto.maquinaId);
```

Implementación (`sensor-readings.service.ts`, líneas 204–235):

```ts
private async persistRagPlan(
  clasificacionId: number,
  tipoFallo: string,
  maquinaCodigo: string,
): Promise<void> {
  const fuentes = await this.getActiveRagSources();          // (5) catálogo de fuentes activas
  const ragResult = await this.mlGateway.rag({               // llamada al ML /rag
    tipoFallo,
    maquinaId: maquinaCodigo,
    historial: [],
    fuentes,
  });

  const general = buildGeneralRecommendation(                // condensa 3 acciones -> 1
    tipoFallo, ragResult.acciones, Boolean(ragResult.escalado),
  );
  const recommendation = await this.recomendacionModel.create({
    idClasificacion: clasificacionId,                        // ligada a la clasificación líder
    orden: 1,
    titulo: general.titulo,
    prioridad: general.prioridad,
    recomendacion: general.detalle,
  });

  const sourceIds = await this.ensureRagSourceIds(ragResult.fuentes);
  if (sourceIds.length) {
    await this.recomendacionFuenteModel.bulkCreate(          // tabla puente N:M
      sourceIds.map((idFuente) => ({
        idRecomendacion: recommendation.idRecomendacion,
        idFuente,
      })),
    );
  }
}
```

### Qué fuentes envía al ML

`getActiveRagSources()` lee de la tabla `fuentes_rag` **todas las fuentes con
`activo = true`**, ordenadas por `idFuente`, y las mapea al contrato `MlRagSource`
(`id`, `titulo`, `autor`, `url`, `descripcion`). El ML usa estas fuentes como **contexto
autorizado** del prompt (o para el filtrado de plantillas si cae a fallback).

### Cómo guarda las recomendaciones ligadas a la clasificación líder

1. El ML devuelve `MlRagResponse` con `tipoFallo`, `escalado`, `acciones[]` (3 acciones) y
   `fuentes[]` (títulos de las fuentes efectivamente usadas).
2. `buildGeneralRecommendation` **fusiona las 3 acciones** en una sola recomendación
   general con detalle estructurado (prioridad, tiempo de escalamiento, descripción del
   fallo, riesgo, estándar interno, herramientas, qué revisar, pasos numerados y
   justificación técnica). La prioridad resultante es la **más alta** entre las acciones.
3. Se crea **un** registro en `recomendaciones_rag` con `idClasificacion = <líder>` y
   `orden = 1`.
4. `ensureRagSourceIds` resuelve cada título devuelto contra `fuentes_rag`
   (**get-or-create**: si el título no existe, lo crea con `activo = true`) y se insertan
   las relaciones en la tabla puente `recomendaciones_rag_fuente`.

> Resiliencia: como el ML aplica fallback a plantillas ante cualquier error del LLM,
> `persistRagPlan` **siempre** recibe un plan válido con 3 acciones y siempre persiste
> una recomendación. El backend no implementa lógica propia de IA.

---

## 3. Endpoints del `RagController`

Controlador en `predictmaint-api/src/rag/rag.controller.ts`, prefijo de ruta `/rag`.
Todos operan sobre el **código de orden** (`orderId`) y resuelven internamente la
**clasificación líder** de esa orden vía `getLiderClasificacion(orderCodigo)`.

| Método | Ruta | DTO | Acción |
|--------|------|-----|--------|
| `GET`  | `/rag/plan/:orderId` | — | Obtener el plan persistido |
| `POST` | `/rag/plan/:orderId/accept` | — | Aceptar el plan |
| `POST` | `/rag/plan/:orderId/reject` | `RejectRagPlanDto` | Rechazar el plan |
| `POST` | `/rag/plan/:orderId/regenerate` | `RegenerateRagPlanDto` | Regenerar el plan |

### Forma de la respuesta (común a todos)

Todos los handlers devuelven `toPlanResponse(orderCodigo)`:

```ts
{
  id,                       // idClasificacion líder
  orderId,                  // código de orden
  tipoFallo,                // código del tipo de fallo líder (p.ej. 'HDF') o null
  modeloOrigen: 'rag',
  escalado: false,
  estado,                   // última 'decision' de respuesta_recomendacion, o 'pendiente'
  acciones: [               // recomendaciones_rag (orden ASC)
    { orden, prioridad, titulo, detalle },
  ],
  fuentes: [ ... ],         // títulos únicos de fuentes ligadas (vía tabla puente)
}
```

### `GET /rag/plan/:orderId`

Solo lectura. Lee de `recomendaciones_rag` (con sus `recomendaciones_rag_fuente` →
`fuentes_rag`) por `idClasificacion` líder, más la **última** `respuesta_recomendacion`
de la orden (para el campo `estado`). No llama al ML.

### `POST /rag/plan/:orderId/accept`

```ts
async accept(orderCodigo: string) {
  const { orden } = await this.getLiderClasificacion(orderCodigo);
  await this.respuestaModel.create({
    idOrden: orden.idOrden, decision: 'aceptado', fechaRespuesta: new Date(),
  });
  await this.eventoModel.create({
    idOrden: orden.idOrden, etapa: 'rag_aceptado',
    descripcion: 'Plan RAG aceptado', actor: 'tecnico', fechaEvento: new Date(),
  });
  return this.toPlanResponse(orderCodigo);
}
```

Persiste: una fila en `respuesta_recomendacion` (`decision = 'aceptado'`) y un evento de
orden (`etapa = 'rag_aceptado'`).

### `POST /rag/plan/:orderId/reject`

Cuerpo: `RejectRagPlanDto { motivo?: string }`.

Persiste: una fila en `respuesta_recomendacion` (`decision = 'rechazado'`,
`observacion = motivo`) y un evento de orden (`etapa = 'respuesta_tecnico'`,
`descripcion = motivo ?? 'Plan RAG rechazado'`).

### `POST /rag/plan/:orderId/regenerate`

Cuerpo: `RegenerateRagPlanDto { escalado?: boolean; fuenteIds?: number[] }`.

Único endpoint del controlador que **vuelve a llamar al ML** y **reescribe** la
recomendación. Flujo (`rag.service.ts` `regenerate`):

1. Resuelve la clasificación líder y el código de máquina.
2. Selecciona fuentes vía `getRagSources(fuenteIds)`:
   - si se pasan `fuenteIds`, usa esas fuentes (`idFuente IN (...)`);
   - si no, usa **todas las activas** (`activo = true`).
3. Llama a `mlGateway.rag({ tipoFallo, maquinaId, historial: [], escalado, fuentes })`.
   Si el líder no tiene tipo de fallo, usa `'RNF'` por defecto.
4. **Borra** las recomendaciones previas de esa clasificación y sus filas en la tabla
   puente, y crea la nueva recomendación general con `buildGeneralRecommendation`.
5. Re-vincula las fuentes (`ensureSourceIds`, get-or-create).
6. Devuelve `toPlanResponse`.

> A diferencia de `accept`/`reject`, `regenerate` **no** crea `respuesta_recomendacion`;
> reemplaza el contenido del plan, no la decisión del técnico.

---

## 4. Interacción del técnico

Hay **dos** registros distintos que capturan la interacción humana con el plan S-3:

### 4.1 `respuesta_recomendacion` (decisión sobre el plan)

Modelo `RespuestaRecomendacion` (tabla `respuesta_recomendacion`). Se escribe desde el
`RagController` (`accept` / `reject`). Campos: `idOrden`, `decision`
(`'aceptado'` | `'rechazado'`), `observacion?`, `fechaRespuesta`.

Es la decisión del técnico **sobre la recomendación RAG en sí** (la acepta como guía o la
rechaza). El campo `estado` del plan servido proviene de la **última** decisión registrada.

### 4.2 `solucion_aplicada` (cómo se resolvió la orden)

Modelo `SolucionAplicada` (tabla `soluciones_aplicadas`). Se escribe al **finalizar la
orden** desde `orders.service.ts` → `registerSolution`. Campos: `idOrden`,
`tipoSolucion`, `descripcion?`, `fechaRegistro`.

El `tipoSolucion` usa el enum `SolucionTipo` (`common/enums/index.ts`):

```ts
export enum SolucionTipo {
  CON_RAG = 'con_rag',              // el técnico resolvió siguiendo el plan RAG
  PROPIA = 'propia',               // resolvió con su propio criterio / método
  RECHAZADA_MANUAL = 'rechazada_manual', // rechazó la predicción/recomendación manualmente
}
```

(El tipo enum SQL `enum_orden_solucion` con estos tres valores se crea en la migración
`20260617000001-create-all-tables.js`.)

### 4.3 Relación con la finalización de la orden

`registerSolution` (orders.service.ts, ≈ 537–597) ata todo al cierre de la orden:

```ts
const isManualRejection = dto.solucionTipo === SolucionTipo.RECHAZADA_MANUAL;

await SolucionAplicada.create({
  idOrden: o.idOrden, tipoSolucion: dto.solucionTipo,
  descripcion: dto.descripcion, fechaRegistro: new Date(),
});

await ObservacionTecnica.create({                 // retroalimentación al pipeline ML
  idOrden: o.idOrden, idTipoFallo,
  esFalla: dto.esFalla ?? (isManualRejection ? false : Boolean(liderS2?.tipoFallo)),
  decision: isManualRejection
    ? DecisionPrediccion.RECHAZADA
    : DecisionPrediccion.ACEPTADA,
  ...
});

await o.update({ estado: EstadoOrden.FINALIZADO, fechaFin: new Date(), ... });
await this.syncAlertEstadoForOrder(o.idOrden, EstadoAlerta.FINALIZADO);
await this.eventoModel.create({ idOrden: o.idOrden, etapa: 'finalizado', ... });
if (o.idTecnico) await this.techniciansService.releaseIfIdle(o.idTecnico);
```

Puntos clave:

- No se puede registrar solución si la orden ya está `FINALIZADO` (lanza `ConflictException`).
- Un técnico no puede registrar solución sobre una orden `PENDIENTE` (debe iniciarla antes).
- `con_rag` y `propia` se tratan como predicción **aceptada**; `rechazada_manual` se
  tratan como predicción **rechazada** (afecta los flags de `ObservacionTecnica`, que sirven
  de retroalimentación para evaluar el modelo).
- Registrar la solución **finaliza la orden** (`estado = FINALIZADO`, `fechaFin`), sincroniza
  la alerta a `FINALIZADO`, emite el evento `finalizado` y libera al técnico si queda ocioso.

> Resumen del vínculo: `respuesta_recomendacion` = "¿aceptó el técnico el plan RAG?";
> `solucion_aplicada` = "¿con qué se cerró finalmente la orden (con RAG / propia / rechazada)?".
> La segunda es la que **cierra** la orden.

---

## 5. Fuentes RAG (`fuente_rag`) y su catálogo

Modelo `FuenteRag` (tabla `fuentes_rag`). Campos: `idFuente`, `titulo` (obligatorio,
≤200), `autor?`, `url?`, `activo` (default `true`). Relaciones:

- `HasMany(RecomendacionRag)` (vínculo directo legacy vía `recomendaciones_rag.id_fuente`).
- `HasMany(RecomendacionRagFuente)` — tabla puente **N:M** real usada por el flujo actual.

La tabla puente `RecomendacionRagFuente` (tabla `recomendaciones_rag_fuente`) tiene clave
primaria compuesta (`idRecomendacion`, `idFuente`) y vincula una recomendación con sus
fuentes citadas.

### Catálogo semilla (lado ML)

El catálogo "canónico" de fuentes vive en `rag.py` como `DEFAULT_RAG_SOURCES` (literatura
de mantenimiento predictivo). Estas se usan cuando el backend no envía fuentes o como
fallback de normalización:

| Título | Autor |
|--------|-------|
| Theissler et al. (2021) | Theissler et al. |
| Pashmforoush et al. (2025) | Pashmforoush et al. |
| Cai et al. (2023) | Cai et al. |
| Araujo et al. (2025) | Araujo et al. |
| Hesser & Markert (2019) | Hesser & Markert |
| Jakobs et al. (2026) | Jakobs et al. |

Además, `FAULT_SOURCES` mapea cada tipo de fallo a sus fuentes preferidas (p.ej.
`HDF → [Theissler, Cai, Pashmforoush]`, `RNF → [Jakobs]`); `_select_sources` elige hasta
3 fuentes por plan priorizando las preferidas del fallo.

### Sincronización backend ↔ catálogo

El backend mantiene su propio catálogo en `fuentes_rag`. La sincronización es por
**título**:

- `getActiveRagSources` / `getRagSources` leen las fuentes (activas o por id) y se las
  envían al ML.
- Al persistir, `ensureRagSourceIds` / `ensureSourceIds` hacen **get-or-create por
  título**: si el ML devuelve un título que aún no existe en `fuentes_rag`, el backend lo
  inserta con `activo = true`. Así, las fuentes del ML quedan disponibles también como
  catálogo de BD para futuras regeneraciones.

---

## 6. Diagrama de texto del flujo S-3

```
                         PIPELINE DE INGESTA (sensor-readings.service)
 ┌───────────────────────────────────────────────────────────────────────────────┐
 │ lectura sensor → ALERTA → S-1 (detección) → S-2 (clasificación)                 │
 │                                       │                                          │
 │                          clasificación LÍDER (tipo de fallo)                     │
 │                                       │                                          │
 │                                       ▼                                          │
 │                          persistRagPlan(idClasificacion, tipoFallo, maquina)     │
 └──────────────────────────────────────┬──────────────────────────────────────────┘
                                        │  getActiveRagSources()  (fuentes_rag.activo=true)
                                        ▼
                       ML Gateway  POST /rag  ──────────►  predictmaint-ml / rag.py
                                                                │
                                              ┌─────────────────┴───────────────────┐
                                              │ ¿RNF?  → inspección manual (plantilla)│
                                              │ ¿LLM on + API key? → OpenRouter LLM   │
                                              │ error / sin key    → plantillas       │
                                              └─────────────────┬───────────────────┘
                                                                │  MlRagResponse
                                                                ▼   { tipoFallo, escalado,
                                                                      acciones[3], fuentes[] }
                       buildGeneralRecommendation()  (3 acciones → 1 recomendación general)
                                                                │
                                                                ▼
          BD:  recomendaciones_rag  (idClasificacion líder, orden=1, titulo, prioridad, detalle)
               recomendaciones_rag_fuente  ──►  fuentes_rag   (get-or-create por título)

 ─────────────────────────────────────────────────────────────────────────────────────────

                              SERVICIO / INTERACCIÓN (rag.controller)
        App web ──► GET  /rag/plan/:orderId          → lee BD (toPlanResponse)
                 ──► POST /rag/plan/:orderId/accept   → respuesta_recomendacion('aceptado')
                                                        + evento 'rag_aceptado'
                 ──► POST /rag/plan/:orderId/reject   → respuesta_recomendacion('rechazado', motivo)
                                                        + evento 'respuesta_tecnico'
                 ──► POST /rag/plan/:orderId/regenerate→ ML /rag de nuevo → reescribe
                                                          recomendaciones_rag (+ fuentes)

 ─────────────────────────────────────────────────────────────────────────────────────────

                              CIERRE DE ORDEN (orders.service.registerSolution)
        técnico finaliza ──► soluciones_aplicadas.tipoSolucion ∈ {con_rag, propia, rechazada_manual}
                          ──► observacion_tecnica (feedback al modelo: aceptada/rechazada)
                          ──► orden.estado = FINALIZADO + alerta FINALIZADO + evento 'finalizado'
                          ──► libera técnico si queda ocioso
```

### Resumen de tablas tocadas en S-3

| Tabla | Escrita por | Contenido |
|-------|-------------|-----------|
| `recomendaciones_rag` | `persistRagPlan`, `regenerate` | Recomendación general (1 por clasificación líder) |
| `recomendaciones_rag_fuente` | `persistRagPlan`, `regenerate` | Puente N:M recomendación ↔ fuente |
| `fuentes_rag` | get-or-create por título | Catálogo de fuentes autorizadas |
| `respuesta_recomendacion` | `accept`, `reject` | Decisión del técnico sobre el plan |
| `soluciones_aplicadas` | `registerSolution` | Cómo se resolvió la orden (cierre) |
| `eventos_orden` | accept/reject/finalizar | Trazabilidad del ciclo de vida |
