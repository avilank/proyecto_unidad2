# Guía Maestra de Estudio — PredictMaint

Índice para **entender todo el proyecto** de forma ordenada. Cada sección dice qué estudiar,
por qué importa, los archivos clave y si **ya existe** una documentación hija o **falta pedirla**.

Al final (§B) está la **lista de documentaciones hijas a solicitar a un agente**, con un *prompt*
listo para copiar por cada una.

> Cómo usar esta guía: estudia las secciones **en orden** (van de lo general a lo específico).
> Para profundizar en una sección, abre su doc existente o pide la doc hija con el prompt de §B.

---

## A. Secciones a revisar (orden recomendado)

### S0 · Visión general y arquitectura
- **Objetivo:** entender los 3 servicios y cómo se comunican.
- **Abarca:** Web (Next.js) ↔ API (NestJS) ↔ ML (FastAPI); por qué Python aparte; flujo general.
- **Archivos clave:** `README.md`, `docker-compose.yml`, raíz del repo.
- **Doc existente:** ✅ `docs/DOCUMENTACION_ARQUITECTURA.md`, ✅ `docs/GUIA_ESTUDIO_EXPOSICION.md` (Parte 0–1).

### S1 · Modelo de datos (PostgreSQL)
- **Objetivo:** dominar las tablas y relaciones (la tabla central `analisis_fallos`).
- **Abarca:** máquinas, lecturas, análisis, predicciones S-1/S-2, RAG, órdenes, alertas, técnicos, config.
- **Archivos clave:** `predictmaint-api/src/database/models/*.model.ts`, `database/models/index.ts`.
- **Doc existente:** ✅ `docs/DOCUMENTACION_MODELO_DE_DATOS.md`.

### S2 · Servicio ML (FastAPI): modelos, features y RAG
- **Objetivo:** entender S-1 (binario), S-2 (multiclase) y S-3 (RAG/LLM), entrenamiento y métricas.
- **Abarca:** `train.py`, `features.py`, `models.py`, `rag.py`, dataset AI4I, endpoints `/predict /classify /rag`.
- **Archivos clave:** `predictmaint-ml/*`.
- **Doc existente:** ✅ `docs/GUIA_MODELOS_ML.md`.

### S3 · Pipeline de monitoreo (end-to-end)
- **Objetivo:** seguir una lectura desde el sensor hasta orden + notificación.
- **Abarca:** reglas RN-0x, S-1 → S-2 → S-3, asignación de técnico, eventos, SSE, cooldown.
- **Archivos clave:** `sensor-readings/sensor-readings.service.ts`, `ml-gateway/`, `common/utils/sensor-rules.util.ts`, `monitoring/`.
- **Doc existente:** ✅ `docs/DOCUMENTACION_FLUJO_MONITOREO.md`, ✅ `docs/GUIA_ESTUDIO_EXPOSICION.md` (Parte 4).

### S4 · Backend NestJS: estructura y módulos
- **Objetivo:** entender cómo está organizado el API (módulos, DI, controllers/services).
- **Abarca:** `app.module.ts`, módulos por dominio, configuración (`config/*`), arranque (`main.ts`), seed/bootstrap.
- **Archivos clave:** `predictmaint-api/src/app.module.ts`, `src/config/*`, `src/database/database-*.service.ts`.
- **Doc existente:** ⚠️ parcial (Parte 9 de `GUIA_ESTUDIO_EXPOSICION.md`). **Pedir doc hija D4.**

### S5 · Seguridad: auth, JWT, roles y CASL
- **Objetivo:** cómo se autentica y autoriza (login, guard global, roles, permisos).
- **Abarca:** `auth/`, `common/guards/`, `common/casl/`, `@Public`, `@UserContext`, SSE token.
- **Archivos clave:** `auth/auth.service.ts` (bcrypt + JWT), `jwt.strategy.ts`, `casl-ability.factory.ts`.
- **Doc existente:** ⚠️ parcial. **Pedir doc hija D5.**

### S6 · Órdenes, técnicos y asignación
- **Objetivo:** ciclo de vida de la orden y cómo se asigna/reasigna a técnicos.
- **Abarca:** estados (`pendiente/en_progreso/finalizado/rechazada`), iniciar/finalizar, rechazar predicción, **reasignar**, asignación por riesgo/especialidad/carga.
- **Archivos clave:** `orders/orders.service.ts`, `technicians/technicians.service.ts`.
- **Doc existente:** ⚠️ parcial. **Pedir doc hija D6.**

### S7 · RAG en el backend
- **Objetivo:** cómo se genera/sirve el plan de acción y la interacción del técnico.
- **Abarca:** `rag/`, `fuente_rag`, `recomendaciones_rag`, aceptar/rechazar/regenerar plan, solución `con_rag`.
- **Archivos clave:** `rag/rag.service.ts`, `ml-gateway` (llamada a `/rag`), `predictmaint-ml/rag.py`.
- **Doc existente:** ⚠️ parcial (Partes 3 y 6 de `GUIA_ESTUDIO_EXPOSICION.md`). **Pedir doc hija D7.**

### S8 · Notificaciones, alertas y escalamiento
- **Objetivo:** quién recibe avisos, por qué canal, y el escalamiento por SLA.
- **Abarca:** `notifications/` (builder, webhook **n8n**, listeners), reglas por nivel (canal/destinatario), SLA y job de escalamiento, mensaje detallado al supervisor.
- **Archivos clave:** `notifications/*`, `jobs/escalation.service.ts`, `alerts/`, `alert-message.builder.ts`.
- **Doc existente:** ⚠️ parcial (Parte 7 de `GUIA_ESTUDIO_EXPOSICION.md`). **Pedir doc hija D8.**

### S9 · Fallos repetitivos y configuración de alertas
- **Objetivo:** umbrales de repetitividad, acciones escaladas, SLA por nivel, y cómo se cablean.
- **Abarca:** tab "Fallos Repetitivos", `configuracion_alertas`, `accion_escalada`, cómo afecta a analítica y notificaciones.
- **Archivos clave:** `config-catalog/`, `repetitive-faults/`, `database/models/configuracion-alertas.model.ts`.
- **Doc existente:** ✅ `docs/GUIA_FALLOS_REPETITIVOS.md`, ✅ `docs/PROPUESTA_ALERTS_SETTINGS.md`.

### S10 · Analítica y reportes
- **Objetivo:** entender todas las métricas y gráficos de la vista de Analítica.
- **Abarca:** dashboard KPIs, efectividad/RAG, recurrencia, disponibilidad, **MTTR/MTBF**, validación de predicciones, log de mensajes, filtros.
- **Archivos clave:** `analytics/analytics.service.ts`, `components/dashboard/analytics/*`.
- **Doc existente:** ✅ `docs/GUIA_MTTR_MTBF.md`, ✅ `docs/GUIA_DASHBOARD_ANALITICA_DATOS_REALES.md`. **Pedir doc hija D10** (resto de paneles).

### S11 · Frontend: arquitectura limpia, rutas, estado y tema
- **Objetivo:** cómo está construido el front (capas, rutas, SWR, SSE, sesión, claro/oscuro).
- **Abarca:** `core/application/infrastructure/presentation/components/app`, sidebar/roles, sessionStore, tema.
- **Archivos clave:** `predictmaint-web/src/*`.
- **Doc existente:** ⚠️ parcial (Parte 10 de `GUIA_ESTUDIO_EXPOSICION.md`). **Pedir doc hija D11.**

### S12 · Jobs y tareas programadas (cron)
- **Objetivo:** entender los procesos automáticos en segundo plano.
- **Abarca:** reintento de asignación, escalamiento por SLA, **generador automático de fallas (demo)**.
- **Archivos clave:** `jobs/assignment-retry.service.ts`, `jobs/escalation.service.ts`, `jobs/auto-fault.service.ts`.
- **Doc existente:** ⚠️ falta. **Pedir doc hija D12.**

### S13 · Simulación de datos y demo
- **Objetivo:** cómo poblar datos para el monitoreo, MTTR/MTBF y repetitivos.
- **Abarca:** simulador Python, generador automático, parámetros `.env`, cooldown.
- **Archivos clave:** `scripts/simulate-sensor-stream.py`, `jobs/auto-fault.service.ts`, `.env`.
- **Doc existente:** ✅ `docs/GUIA_SIMULACION_DATOS.md`.

### S14 · Contrato de API y rutas
- **Objetivo:** conocer todas las rutas (front + back) y el contrato REST.
- **Abarca:** páginas Next.js, endpoints REST, ML interno.
- **Archivos clave:** controllers `*.controller.ts`, páginas `app/**/page.tsx`.
- **Doc existente:** ✅ `docs/MANUAL_RUTAS.md`, ✅ `docs/DOCUMENTACION_API_CONTRATO.md`.

### S15 · Despliegue, entorno y scripts
- **Objetivo:** cómo se corre/despliega y qué hace cada script y variable.
- **Abarca:** `docker-compose.yml`, `.env` de los 3 servicios, scripts (`reset-demo-day`, `sync-ml-metrics`, etc.).
- **Archivos clave:** `docker-compose.yml`, `predictmaint-*/Dockerfile`, `scripts/`, `predictmaint-api/scripts/`.
- **Doc existente:** ⚠️ parcial (`README.md`). **Pedir doc hija D15.**

---

## B. Documentaciones hijas a solicitar a un agente

Para cada doc que falte (o quieras más profunda), copia el *prompt* en un agente. Las marcadas
con ✅ ya existen (revísalas antes de pedir una nueva).

| # | Documento a pedir | Estado | Prompt sugerido para el agente |
|---|---|---|---|
| D0 | Arquitectura general | ✅ existe | "Lee `docs/DOCUMENTACION_ARQUITECTURA.md` y resúmela; agrega un diagrama de componentes y el flujo de una petición Web→API→ML." |
| D1 | Modelo de datos detallado | ✅ existe | "A partir de `predictmaint-api/src/database/models/*`, documenta cada tabla, columnas, relaciones y un diagrama ER. Compara con `docs/DOCUMENTACION_MODELO_DE_DATOS.md`." |
| D2 | Servicio ML (entrenamiento + RAG) | ✅ existe | "Lee `docs/GUIA_MODELOS_ML.md` y `predictmaint-ml/*`; documenta train/features/models/rag con ejemplos de request/response de cada endpoint." |
| D3 | Pipeline de monitoreo end-to-end | ✅ existe | "Lee `docs/DOCUMENTACION_FLUJO_MONITOREO.md` y `sensor-readings/sensor-readings.service.ts`; traza paso a paso quién llama a quién con números de línea." |
| **D4** | **Backend NestJS: módulos y arranque** | ⚠️ pedir | "Documenta la estructura del API NestJS: todos los módulos en `app.module.ts`, qué expone cada uno, providers/imports, `main.ts` (CORS, pipes, swagger), y el seed/bootstrap de BD. Incluye un mapa de dependencias entre módulos." |
| **D5** | **Seguridad: auth, JWT, roles, CASL** | ⚠️ pedir | "Documenta el sistema de autenticación/autorización: login con bcrypt+JWT (`auth/`), guard global y `@Public`, `@UserContext`, roles y CASL (`common/casl/`), y el guard SSE por query. Tabla de qué puede hacer cada rol." |
| **D6** | **Órdenes, técnicos y asignación** | ⚠️ pedir | "Documenta el ciclo de vida de una orden (estados y transiciones), iniciar/finalizar, rechazar predicción, **reasignar** (supervisor), y la asignación de técnicos por riesgo/especialidad/carga. Incluye `orders.service.ts` y `technicians.service.ts`." |
| **D7** | **RAG en el backend** | ⚠️ pedir | "Documenta cómo el backend genera, persiste y sirve el plan RAG: `rag/rag.service.ts`, llamada a `/rag` del ML, `fuente_rag`/`recomendaciones_rag`, y aceptar/rechazar/regenerar. Aclara qué es LLM vs plantilla." |
| **D8** | **Notificaciones, alertas y escalamiento** | ⚠️ pedir | "Documenta el subsistema de notificaciones: builder del mensaje (WhatsApp/Email), envío por webhook **n8n** y/o SMTP, reglas por nivel (canal/destinatario), preferencias del técnico, y el escalamiento por SLA (`jobs/escalation.service.ts`) con el mensaje detallado al supervisor." |
| **D9** | **Fallos repetitivos + config de alertas** | ✅ existe | "Lee `docs/GUIA_FALLOS_REPETITIVOS.md` y `docs/PROPUESTA_ALERTS_SETTINGS.md`; resume cómo se configuran umbrales/acciones/notificaciones y cómo se cablean al comportamiento real." |
| **D10** | **Analítica: todos los paneles** | ⚠️ pedir | "Documenta cada método de `analytics/analytics.service.ts` y su panel en el front: qué calcula, de qué datos, y su gráfico. Incluye efectividad/RAG, recurrencia, disponibilidad, MTTR/MTBF, validación de predicciones, faults-by-type, unattended y el log de mensajes." |
| **D11** | **Frontend: arquitectura limpia** | ⚠️ pedir | "Documenta el frontend Next.js: capas core/application/infrastructure/presentation/components/app y la regla de dependencia; rutas y qué muestra cada página; SWR + hooks; el stream SSE en el front; sessionStore (JWT) y el sidebar por rol; el tema claro/oscuro (next-themes)." |
| **D12** | **Jobs / cron** | ⚠️ pedir | "Documenta los tres jobs programados: reintento de asignación, escalamiento por SLA y el generador automático de fallas demo (`jobs/auto-fault.service.ts`): qué hacen, cada cuánto, sus variables `.env` y sus efectos." |
| D13 | Simulación de datos | ✅ existe | "Lee `docs/GUIA_SIMULACION_DATOS.md`; resume las opciones y el generador automático con sus parámetros." |
| D14 | Manual de rutas / contrato API | ✅ existe | "Lee `docs/MANUAL_RUTAS.md` y `docs/DOCUMENTACION_API_CONTRATO.md`; agrega request body y respuesta de los endpoints principales." |
| **D15** | **Despliegue, entorno y scripts** | ⚠️ pedir | "Documenta cómo correr/desplegar los 3 servicios: `docker-compose.yml`, los `.env` de api/ml/web (todas las variables y su efecto), y cada script de `scripts/` y `predictmaint-api/scripts/` (qué hace y cuándo usarlo)." |

### Prioridad sugerida (las que faltan)
1. **D4** (estructura backend) y **D5** (seguridad) → base para entender todo lo demás.
2. **D6** (órdenes/técnicos) y **D8** (notificaciones/escalamiento) → el corazón operativo.
3. **D11** (frontend) y **D10** (analítica) → la capa visible.
4. **D12** (jobs) y **D15** (despliegue) → operación y demo.
5. **D7** (RAG backend) → completar el flujo S-3.

---

## C. Ruta de aprendizaje en 1 página
```
S0 arquitectura → S1 datos → S2 ML → S3 pipeline   (el "qué" y el flujo)
      ↓
S4 backend → S5 seguridad → S6 órdenes → S7 RAG → S8 notificaciones   (el backend a fondo)
      ↓
S9 repetitivos/config → S10 analítica → S11 frontend   (configuración y vistas)
      ↓
S12 jobs → S13 simulación → S14 rutas → S15 despliegue   (operación)
```
</content>
