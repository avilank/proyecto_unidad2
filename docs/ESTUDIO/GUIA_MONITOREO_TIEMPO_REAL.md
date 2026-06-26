# Guía — Simulación de Monitoreo en Tiempo Real

> Explica **cómo se construyó** el monitoreo en tiempo real de PredictMaint: el simulador
> que genera lecturas, el pipeline que las procesa y el stream (SSE) que actualiza la
> pantalla en vivo. Incluye **archivos y líneas** de cada pieza.

---

## ⚠️ ¿Quién genera las fallas en ESTE proyecto? El CRON (automático)

Hay **dos formas** de generar fallas, y conviene tenerlas claras:

| Forma | Archivo | Estado en este proyecto |
|---|---|---|
| **Cron automático** (auto-fault) | `predictmaint-api/src/jobs/auto-fault.service.ts` | ✅ **ACTIVO** (`DEMO_AUTOFAULT_ENABLED=true`) |
| **Script manual** (Python) | `scripts/simulate-sensor-stream.py` | ⚙️ Opcional — solo si lo ejecutas tú |

**Por defecto, las fallas se generan SOLAS con el cron** (configurado en `predictmaint-api/.env`):
```env
DEMO_AUTOFAULT_ENABLED=true     # el cron está prendido
DEMO_AUTOFAULT_MIN=5           # una falla cada ~10 minutos
DEMO_AUTOFAULT_BIAS=0.7         # 70% usa el tipo de falla dominante de la máquina
DEMO_AUTOFAULT_MAX_ACTIVAS=5    # no genera si ya hay 5 órdenes activas
```

El **script de Python es el método manual** (para forzar una secuencia controlada en una demo
en vivo). **Ambos terminan haciendo lo mismo:** un `POST /sensor-readings` que entra al mismo
pipeline. La sección 1 describe el script manual; la sección **1-bis** describe el cron activo.

---

## Concepto clave: son DOS piezas que juntas dan el "tiempo real"

No es una sola cosa. La "simulación de monitoreo en tiempo real" combina:

1. **Generación de lecturas** (el *simulador*): el **cron auto-fault** (automático) o el
   **script de Python** (manual) leen el dataset y envían lecturas de sensores al backend,
   imitando máquinas reales.
2. **Empuje en vivo a la pantalla** (el *stream SSE*): el backend notifica al navegador
   cada vez que pasa algo, para que el dashboard se actualice solo, sin recargar.

```
  simulate-sensor-stream.py          (1) genera lecturas desde ai4i2020.csv
        │  POST /sensor-readings
        ▼
  SensorReadingsService.create()     ejecuta el pipeline S-1→S-2→S-3, crea orden/alerta
        │  eventEmitter.emit(MONITORING_*_EVENT)
        ▼
  MonitoringSseListener               (2) escucha el evento interno
        │  broadcast()
        ▼
  MonitoringSseService  ──SSE──▶  navegador (EventSource)
        │
        ▼
  useMonitoringStream()  →  revalida SWR  →  el dashboard se refresca solo
```

---

## 1. El simulador de lecturas (`scripts/simulate-sensor-stream.py`)

Script independiente en **Python puro** (sin dependencias externas, usa `urllib`). Lógica:

- **Lee el dataset real** `ai4i2020.csv` y clasifica cada fila en 3 *pools* (`load_pools`, líneas **63-83**):
  - `normal_pool`: lecturas que NO disparan ninguna regla → operación normal.
  - `trigger_pool`: lecturas que SÍ disparan una regla de alerta.
  - `failure_trigger_pool`: las que disparan regla **y** además están marcadas como falla real en el CSV (`Machine failure = 1`).
- **Replica las reglas del backend** en `triggers_rule` (líneas **38-49**): diferencia de temperatura, rpm, potencia, desgaste — para elegir filas que de verdad disparen el pipeline.
- **Trabaja por etapas** (`run_stage`, líneas **265-334**): en cada etapa envía varias lecturas **normales** a máquinas al azar y luego fuerza **un fallo confirmado** en una máquina distinta. Así se ve el sistema operando normal y de vez en cuando una falla.
- **Evita pisar máquinas ocupadas**: antes de cada etapa consulta `/orders` (login demo, líneas **113-139**) y excluye las máquinas con orden activa (pipeline en curso) o en cooldown. Por eso a veces dice "probando otra candidata".
- **Ritmo configurable** por flags (líneas **337-406**): `--min-delay`/`--max-delay` (segundos entre envíos), `--min-normal`/`--max-normal` (lecturas normales antes del fallo), `--stages`, `--seed`, etc.

Cada envío es un `POST /sensor-readings` con el payload de la máquina (`send_reading`, líneas **203-224**).

> **Importante:** el simulador **no inventa** valores; toma filas reales del CSV AI4I 2020.
> Solo decide *cuándo* y *a qué máquina* mandarlas.

---

## 1-bis. El generador automático de fallas — CRON (`auto-fault.service.ts`)

Este es el método **activo por defecto** en el proyecto. Vive **dentro del backend** (no es un
script aparte) y genera fallas solo, sin que ejecutes nada.

- **Se registra** en `jobs.module.ts` (línea 30) y arranca con la app. Al iniciar, si
  `DEMO_AUTOFAULT_ENABLED=true`, carga las filas de falla del CSV (`onModuleInit`, líneas 79-82).
- **`@Cron('15 * * * * *')`** (línea 168): corre cada minuto, pero solo dispara una falla cuando
  pasaron `DEMO_AUTOFAULT_MIN` minutos desde la última (líneas 171-172). Con la config actual:
  **una falla cada 10 min**.
- **Elige una máquina libre** (sin orden activa, líneas 188-196).
- **Sesga el tipo de falla** por máquina: con prob. `DEMO_AUTOFAULT_BIAS` (0.7) usa el tipo
  "dominante" de esa máquina (determinista por su código, `dominantFault`, líneas 161-166); si
  no, uno al azar (líneas 199-201). Esto hace que los **fallos repetitivos** aparezcan de forma
  realista.
- **Hace un `POST /sensor-readings` interno** (líneas 224-230) → entra al **mismo pipeline**
  S-1→S-2→S-3 que cualquier lectura.
- **Guardarraíl**: si ya hay `DEMO_AUTOFAULT_MAX_ACTIVAS` (5) órdenes activas, **no genera**
  (líneas 181-186), para no saturar.
- **Nunca completa órdenes** — eso es manual, lo hace el usuario.

| Variable (`.env`) | Default | Para qué |
|---|---|---|
| `DEMO_AUTOFAULT_ENABLED` | `false` | Prende/apaga el cron (en este proyecto: `true`) |
| `DEMO_AUTOFAULT_MIN` | `30` | Minutos entre fallas (aquí `10`) |
| `DEMO_AUTOFAULT_BIAS` | `0.7` | Prob. de usar el tipo de falla dominante de la máquina |
| `DEMO_AUTOFAULT_MAX_ACTIVAS` | `3` | Máx. de órdenes activas antes de pausar (aquí `5`) |
| `DEMO_AUTOFAULT_HARD_RATE` | `0.45` | Prob. de inyectar una fila "fuerte" (fallo real) vs "suave" |
| `DEMO_DATASET_PATH` | — | Ruta al `ai4i2020.csv` (si no, lo busca en rutas conocidas) |

> **Cron vs. script:** el **cron** es automático y continuo (el dashboard "vive" solo); el
> **script Python** (sección 1) es manual, para forzar una secuencia controlada en una demo en
> vivo. Para una exposición puedes apoyarte en el cron (ya corriendo) o disparar el script en el
> momento exacto que quieras mostrar la falla.

---

## 2. El endpoint que recibe y procesa (`sensor-readings`)

- **Controller** (`sensor-readings.controller.ts`, líneas **13-18**): `POST /sensor-readings`,
  marcado **`@Public()`** (no requiere JWT, por eso el simulador puede pegarle directo).
- **Service** (`sensor-readings.service.ts`, método `create`, líneas **302-547**) — el corazón. En orden:
  1. Guarda la lectura en BD (líneas 307-317).
  2. Evalúa las reglas de sensor (línea 321). Si **no** disparan → emite solo el evento de "lectura normal" y termina (líneas 329-332).
  3. **Guardarraíl** `shouldSkipPipeline` (líneas **163-202**): si la máquina ya tiene una orden activa (`pipeline_activo`) o está en `cooldown`, se salta el pipeline (líneas 334-348). Evita órdenes duplicadas.
  4. Crea `analisis`, `orden` (PENDIENTE) y `alerta` (estado ANALIZANDO) — líneas 354-379.
  5. **S-1** (predicción binaria): llama al ML (`mlGateway.predict`, línea 398). Calcula el **nivel de riesgo con los umbrales configurables** (`computeNivelRiesgo`, líneas 149-152 y 402-405). Si S-1 **no** confirma falla → cierra la orden como descartada (líneas 435-445).
  6. **S-2** (clasificación) + **S-3** (RAG): si S-1 confirma, clasifica el tipo de falla (línea 449), genera el plan RAG (`persistRagPlan`, líneas 204-235) y **asigna técnico** (línea 509) o programa reintento (línea 522).
  7. **Emite los eventos de monitoreo** (`emitMonitoringReading` / `emitMonitoringAlert`, líneas 286-300, llamados en 539-540).

---

## 3. El stream en tiempo real (SSE) — módulo `monitoring`

**SSE = Server-Sent Events**: una conexión HTTP que el servidor mantiene abierta para
*empujar* mensajes al navegador (a diferencia de pedir datos cada X segundos). Es
unidireccional (servidor → cliente), más simple que WebSocket y suficiente aquí.

- **`monitoring-sse.service.ts`** (líneas **10-37**): mantiene un `Set` de conexiones abiertas.
  `getStream()` crea un canal por cada navegador conectado y le manda un **heartbeat cada 15 s**
  (líneas 14-21) para que la conexión no muera. `broadcast()` (líneas 32-37) envía un mensaje a
  **todos** los navegadores conectados.
- **`monitoring-sse.listener.ts`** (líneas **15-23**): escucha los eventos internos
  (`MONITORING_READING_EVENT`, `MONITORING_ALERT_EVENT`) que emitió el `SensorReadingsService`
  y los reenvía por SSE con `broadcast`. Esto **desacopla**: el servicio que procesa la lectura
  no sabe nada del SSE; solo emite un evento.
- **`monitoring.controller.ts`** (líneas **11-16**): expone `GET /monitoring/stream` con el
  decorador **`@Sse('stream')`**. Protegido por `SseJwtQueryGuard` porque el navegador (con
  `EventSource`) **no puede mandar headers**, así que el token JWT viaja en la **query string**
  (`?token=...`).

---

## 4. El consumo en el navegador (`useMonitoringStream.ts`)

Hook de React que:
- Abre un **`EventSource`** apuntando a `/monitoring/stream?token=...` (líneas **58-59**).
- En `onmessage` (líneas **67-91**): ignora los heartbeats, y cuando llega un evento de
  lectura/alerta, **revalida los datos de SWR** (`mutate('/machines')`, `/alerts/active`,
  `/analytics/dashboard`, líneas 36-39) → eso hace que las tablas y KPIs se refresquen solos.
- **Reconexión automática** con backoff exponencial si se cae la conexión (líneas **93-101**).
- Además, un **poll de respaldo cada 8 s** (`MONITORING_REFRESH_MS`, líneas 9 y 106) por si el SSE falla.

> **Detalle honesto:** el SSE dispara la **revalidación** de los datos, pero los datos en sí se
> vuelven a pedir por la API REST normal (SWR). El SSE es la "señal de que algo cambió, vuelve a
> consultar", no el transporte del dato completo.

---

## Tabla de referencia — dónde está cada cosa

| Pieza | Archivo | Líneas |
|---|---|---|
| **Cron auto-fault** (genera fallas, ACTIVO) | `predictmaint-api/src/jobs/auto-fault.service.ts` | `tick` 168-242, carga CSV 107-155 |
| · Registro del cron en el módulo | `predictmaint-api/src/jobs/jobs.module.ts` | 30 |
| **Script manual** (genera lecturas) | `scripts/simulate-sensor-stream.py` | todo |
| · Reglas que disparan | `scripts/simulate-sensor-stream.py` | 38-49 |
| · Carga de pools del CSV | `scripts/simulate-sensor-stream.py` | 63-83 |
| · Lógica por etapas (normal + 1 fallo) | `scripts/simulate-sensor-stream.py` | 265-334 |
| · Flags configurables (velocidad, etapas) | `scripts/simulate-sensor-stream.py` | 337-406 |
| **Endpoint receptor** `POST /sensor-readings` | `predictmaint-api/src/sensor-readings/sensor-readings.controller.ts` | 13-18 |
| **Pipeline completo** S-1→S-2→S-3 | `predictmaint-api/src/sensor-readings/sensor-readings.service.ts` | 302-547 |
| · Guardarraíl (pipeline activo / cooldown) | `…/sensor-readings.service.ts` | 163-202 |
| · Nivel de riesgo con umbrales config | `…/sensor-readings.service.ts` | 149-152, 402-405 |
| · Emisión de eventos de monitoreo | `…/sensor-readings.service.ts` | 286-300, 539-540 |
| **Stream SSE** (conexiones, heartbeat, broadcast) | `predictmaint-api/src/monitoring/monitoring-sse.service.ts` | 10-37 |
| **Listener** (evento interno → SSE) | `predictmaint-api/src/monitoring/monitoring-sse.listener.ts` | 15-23 |
| **Endpoint SSE** `GET /monitoring/stream` | `predictmaint-api/src/monitoring/monitoring.controller.ts` | 11-16 |
| Definición de eventos de monitoreo | `predictmaint-api/src/common/events/monitoring.events.ts` | todo |
| **Hook del navegador** (EventSource + revalidación) | `predictmaint-web/src/presentation/hooks/useMonitoringStream.ts` | todo |
| Vista de monitoreo | `predictmaint-web/src/components/dashboard/monitoring-view.tsx` | todo |

---

## Cómo se ejecuta (para la demo)

```bash
# desde la raíz del proyecto, con el backend (3001) y ML (8000) corriendo:
python scripts/simulate-sensor-stream.py --min-delay 0.5 --max-delay 1.5
```

Mientras corre, abres **Monitoreo en tiempo real** en el navegador y verás las lecturas y
alertas aparecer solas (gracias al SSE).

> ⚠️ **Para la exposición:** el "tiempo real" es **simulado** — no hay sensores físicos; el
> script empuja datos del CSV. Respuesta honesta si preguntan: *"En producción, estos
> `POST /sensor-readings` los haría un gateway IoT real; nosotros los simulamos con un script
> que reproduce el dataset AI4I 2020."*

---

### Documentos relacionados
- `DOCUMENTACION_FLUJO_MONITOREO.md` — flujo completo del pipeline.
- `GUIA_SIMULACION_DATOS.md` — detalle del simulador y el dataset.
- `HIJO_JOBS_CRON.md` — el job `auto-fault` (otra forma de generar fallos, en el backend).
- `GUION_EXPOSICION.md` — guión para la exposición.
