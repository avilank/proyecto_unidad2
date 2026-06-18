# PredictMaint — Documentación de Arquitectura

> Arquitectura del proyecto **PredictMaint** (Mantenimiento Predictivo Industrial con ML + RAG).
> Frontend en **Next.js (App Router)** con Clean/Hexagonal Architecture, backend en **NestJS**
> modular por features con **Sequelize**, y un **servicio de ML en Python** independiente.
> La estructura sigue las convenciones del proyecto de referencia `YAMBOLY`
> (`mantenimiento-app` + `service-mantenimiento` + `mantenimiento-ia`).
> Complementa a `DOCUMENTACION_MODELO_DE_DATOS.md`. Fecha: 2026-06-17.

---

## 1. Vista general (monorepo de 3 servicios)

```
predictmaint/
├── predictmaint-web/        # Frontend  — Next.js (App Router) + Clean Architecture
├── predictmaint-api/        # Backend   — NestJS (modular) + Sequelize + PostgreSQL
└── predictmaint-ml/         # API de modelos — FastAPI mínima: S-1, S-2, S-3 (RAG)
```

> **¿Por qué Python aparte?** Los 6 modelos están entrenados con `scikit-learn`, `XGBoost` y
> `LightGBM` y quedan serializados como objetos Python (`.pkl`/`.joblib`). NestJS corre sobre
> Node.js y **no puede ejecutar un modelo de sklearn**, así que la inferencia debe ocurrir en
> Python. No es un "microservicio" pesado: es una **API FastAPI pequeña** que solo carga los
> modelos y expone 3 endpoints. La API Nest la consume por HTTP y persiste los resultados.

### Responsabilidades

| Servicio | Stack | Responsabilidad |
|----------|-------|-----------------|
| **predictmaint-web** | Next.js, React, SWR, Zustand, React Hook Form + Zod, Radix UI, Tailwind, Recharts | UI de las 19 vistas, estado de cliente, consumo de API |
| **predictmaint-api** | NestJS, Sequelize, PostgreSQL, JWT, CASL, Swagger, event-emitter, schedule | Lógica de negocio, orquestación del pipeline, persistencia, notificaciones, jobs |
| **predictmaint-ml** | Python, FastAPI, scikit-learn, XGBoost, LightGBM | API mínima de inferencia: ejecuta los 6 modelos + motor RAG. Solo predice; **no** tiene BD ni lógica de negocio |

### Flujo de una petición (request → respuesta)

```
[Next.js View]
   → Presentation (hook + store)
   → Application Service
   → Infrastructure Repository (axios → HttpClient)
        ⇅ HTTP
   → [NestJS Controller]
   → Service (lógica de negocio)
        → Sequelize Model (PostgreSQL)
        → ML Gateway ⇄ [predictmaint-ml] (FastAPI: /predict, /classify, /rag)
```

---

## 2. Backend — `predictmaint-api` (NestJS)

### 2.1 Stack y patrón
- **NestJS** modular: un módulo por dominio bajo `src/modules/<feature>/`.
- **Sequelize** (`@nestjs/sequelize` + `sequelize-typescript`) sobre **PostgreSQL** (`pg`).
- **Auth**: JWT (`@nestjs/jwt`) + **CASL** (`@casl/ability`) para permisos.
- **Validación**: `class-validator` + `class-transformer` en los DTOs.
- **Eventos**: `@nestjs/event-emitter` (listeners desacoplados, p. ej. al cambiar estado de orden).
- **Tareas programadas**: `@nestjs/schedule` (jobs de envío de CSV, escalamientos).
- **Docs**: Swagger (`@nestjs/swagger`).

### 2.2 Estructura de carpetas

```
predictmaint-api/
├── src/
│   ├── main.ts                      # bootstrap (CORS, pipes globales, Swagger)
│   ├── app.module.ts                # módulo raíz: importa todos los feature-modules
│   │
│   ├── config/                      # configuración tipada (registerAs)
│   │   ├── database.config.ts
│   │   ├── sequelize.config.ts
│   │   ├── auth.config.ts           # JWT secret/expiración
│   │   ├── ml.config.ts             # URL/credenciales del servicio Python
│   │   ├── notifications.config.ts  # WhatsApp/Email (proveedor, tokens)
│   │   └── constants.config.ts
│   │
│   ├── common/                      # transversal a todos los módulos
│   │   ├── common.module.ts
│   │   ├── casl/                    # casl-ability.factory.ts (permisos)
│   │   ├── constants/
│   │   ├── decorators/              # @Public(), @UserContext(), @Policy()
│   │   ├── enums/                   # NivelRiesgo, TipoFallo, EstadoOrden, Turno, Canal...
│   │   ├── events/                  # nombres/payloads de eventos de dominio
│   │   ├── filters/                 # http-exception.filter.ts
│   │   ├── guards/                  # jwt-auth.guard.ts, policies.guard.ts
│   │   ├── interceptors/            # logging, transform-response
│   │   ├── services/
│   │   ├── types/
│   │   └── utils/                   # feature-engineering (Power), helpers de fecha
│   │
│   ├── database/
│   │   ├── config/config.js         # config CLI de Sequelize
│   │   ├── migrations/              # YYYYMMDDHHMMSS-descripcion.js
│   │   └── seeders/                 # catálogos: tipos_fallo, niveles_riesgo, modelos_ml...
│   │
│   ├── jobs/                        # tareas programadas (@Cron)
│   │   ├── jobs.module.ts
│   │   ├── message-dispatch/        # envío CSV 06:00/14:00/22:00 + alertas CRITICAL
│   │   ├── escalation/              # escala a supervisor si vence tiempo límite
│   │   └── repetitive-faults/       # detección de reincidencia (ventana 7 días)
│   │
│   └── modules/                     # un módulo por dominio (ver 2.3)
│       ├── auth/
│       ├── users/
│       ├── technicians/
│       ├── machines/
│       ├── sensor-readings/
│       ├── orders/
│       ├── alerts/
│       ├── predictions/
│       ├── rag/
│       ├── repetitive-faults/
│       ├── notifications/
│       ├── ml-models/
│       ├── analytics/
│       ├── config-catalog/
│       └── ml-gateway/
│
├── test/
├── docker/                          # Dockerfile, docker-compose (api + postgres)
├── scripts/
└── package.json
```

### 2.3 Anatomía de un feature-module
Cada módulo replica la convención del proyecto de referencia:

```
modules/orders/
├── orders.module.ts                 # declara controllers, providers, imports/exports
├── controllers/
│   ├── orders.controller.ts         # CRUD + transiciones de estado
│   └── order-timeline.controller.ts # eventos/timeline de la orden
├── services/
│   ├── orders.service.ts            # lógica principal
│   ├── order-creation.service.ts    # crea orden tras confirmar fallo
│   ├── order-status.service.ts      # pendiente→en_progreso→finalizado
│   └── order-timeline.service.ts
├── models/                          # modelos Sequelize (1 tabla = 1 modelo)
│   ├── order.model.ts
│   └── order-event.model.ts
├── dto/
│   ├── create-order.dto.ts
│   ├── update-order-status.dto.ts
│   └── register-solution.dto.ts
├── listeners/
│   └── order-status-changed.listener.ts   # @OnEvent — dispara notificación
├── strategies/                      # (opcional) p. ej. asignación de técnico
│   ├── assignment-strategy.interface.ts
│   ├── critical-assignment.strategy.ts
│   ├── high-assignment.strategy.ts
│   └── assignment-strategy.factory.ts
├── enums/
├── permissions/                     # permisos CASL del módulo
└── types/
```

### 2.4 Mapeo dominio → módulos (desde el modelo de datos)

| Módulo | Tablas que gestiona | Vistas que sirve |
|--------|---------------------|------------------|
| `auth` | `usuario` (login, JWT, roles, CASL) | 01 Login |
| `users` | `usuario` (gestión) | Config / RBAC |
| `technicians` | `tecnico`, `regla_asignacion` | 06b Gestión de Técnicos |
| `machines` | `maquina` | Dashboard, Monitoreo, Detalle |
| `sensor-readings` | `lectura_sensor` | TAB 1, Detalle de Orden |
| `orders` | `orden`, `evento_orden` | 06 Historial, 07 Detalle, TAB 3 |
| `alerts` | `alerta`, `regla_sensor` | 02 Dashboard, 03 Monitoreo |
| `predictions` | `prediccion_binaria` (S-1), `prediccion_multiclase` (S-2) | TAB 1, TAB 2 |
| `rag` | `plan_rag`, `accion_rag`, `fuente_rag`, `plan_rag_fuente`, `mapa_fallo_recomendacion` | TAB 3, Config 3 |
| `repetitive-faults` | `fallo_repetitivo`, `accion_escalada` | Config 5, Analítica Repetitivos |
| `notifications` | `mensaje_enviado`, `regla_notificacion`, plantillas WhatsApp | Config 2/4, WhatsApp, Analítica |
| `ml-models` | `modelo_ml`, `configuracion` | Config 1 |
| `analytics` | lecturas agregadas, KPIs, efectividad | 07 Analítica y Reportes |
| `config-catalog` | `tipo_fallo`, `nivel_riesgo`, `horario_envio`, `configuracion` | Config 1–5 |
| `ml-gateway` | — (cliente HTTP a `predictmaint-ml`) | usado por `predictions`/`rag` |

### 2.5 Orquestación del pipeline (servicio clave)
El `ml-gateway` + `orders/order-creation.service.ts` implementan el flujo automático de
`DOCUMENTACION_MODELO_DE_DATOS.md` §6.1:

1. `alerts` recibe lectura que supera regla `RN-0x` → crea `alerta` (sin técnico).
2. `ml-gateway` → `POST /predict` (S-1) → guarda 3 `prediccion_binaria` + `ensemble_avg`.
3. Si FALLA → `POST /classify` (S-2) → guarda 3 `prediccion_multiclase` + agreement.
4. Si agreement ≥ mínimo → `POST /rag` (S-3) → guarda `plan_rag` + `accion_rag`.
5. `technicians` (strategy por nivel) asigna técnico → `orders` crea `orden` (pendiente).
6. Evento `order.created` → `notifications` envía WhatsApp/Email.

---

## 3. Frontend — `predictmaint-web` (Next.js App Router)

### 3.1 Stack y patrón
- **Next.js App Router** con **Clean/Hexagonal Architecture** en capas (`core` → `application`
  → `infrastructure` → `presentation`).
- **Data fetching**: SWR (cache/revalidación) sobre repositorios con **axios**.
- **Estado global**: **Zustand** (`presentation/stores`).
- **Formularios**: React Hook Form + **Zod** (`lib/validations`).
- **UI**: Radix UI + Tailwind (`components/ui`), gráficos con **Recharts**.

### 3.2 Estructura de carpetas

```
predictmaint-web/
├── src/
│   ├── app/                         # ROUTING (App Router)
│   │   ├── layout.tsx
│   │   ├── (auth)/
│   │   │   └── login/               # 01 - Login
│   │   ├── @modal/                  # rutas paralelas para modales
│   │   │   └── (.)orders/view/      # intercepting route (Detalle/Modales)
│   │   ├── api/                     # route handlers (BFF opcional)
│   │   └── dashboard/
│   │       ├── page.tsx             # 02 - Dashboard General
│   │       ├── monitoring/          # 03 - Monitoreo en Tiempo Real
│   │       ├── analysis/[machineId]/# TAB 1/2/3 (Predicción/Clasificación/RAG)
│   │       ├── orders/              # 06 - Historial  + [id] (07 Detalle)
│   │       ├── technicians/         # 06b - Gestión de Técnicos
│   │       ├── analytics/           # 07 - Analítica y Reportes
│   │       │   └── repetitive/      # Analítica - Fallos Repetitivos
│   │       └── settings/            # Config Tabs 1–5
│   │
│   ├── core/                        # DOMINIO (sin dependencias externas)
│   │   ├── entities/                # Order, Machine, Technician, Alert, Prediction...
│   │   ├── interfaces/              # contratos de repositorios/servicios
│   │   └── types/                   # tipos compartidos, enums espejo del backend
│   │
│   ├── application/                 # CASOS DE USO
│   │   ├── services/                # OrderService, PredictionService, RagService...
│   │   └── errors/                  # ErrorHandler
│   │
│   ├── infrastructure/              # DETALLES EXTERNOS
│   │   ├── http/
│   │   │   ├── base/HttpClient.ts   # wrapper axios (interceptores, auth header)
│   │   │   └── clients/apiClient.ts # instancia hacia predictmaint-api
│   │   ├── repositories/            # OrderRepository, MachineRepository... (implementan interfaces)
│   │   └── storage/                 # CookieStorage (token)
│   │
│   ├── presentation/                # ADAPTADORES DE UI
│   │   ├── hooks/                   # useOrders, useMonitoring (SWR)
│   │   ├── stores/                  # Zustand: sessionStore, alertsStore, notificationsStore
│   │   ├── providers/               # UserProvider
│   │   └── guards/                  # CanViews / CanComponents (permisos)
│   │
│   ├── components/
│   │   ├── ui/                      # primitivos Radix+Tailwind (button, dialog, tabs...)
│   │   ├── common/                  # sidebar, table, cards, badges, forms, search, export
│   │   └── dashboard/               # componentes por feature
│   │       ├── dashboard/  monitoring/  analysis/  orders/
│   │       ├── technicians/  analytics/  settings/
│   │
│   ├── lib/validations/             # esquemas Zod (login, técnico, configuración...)
│   ├── config/   constants/   types/   utils/   styles/
│
├── public/
└── package.json
```

### 3.3 Regla de dependencias (Clean Architecture)
```
core  ←  application  ←  infrastructure
                      ←  presentation  →  components → app
```
- `core` no importa nada de fuera (entidades + interfaces puras).
- `application` orquesta usando **interfaces** de `core` (no implementaciones).
- `infrastructure` implementa esas interfaces (repos con axios/SWR).
- `presentation`/`components`/`app` solo consumen `application` vía hooks.

### 3.4 Mapeo vistas Figma → rutas

| Vista Figma | Ruta Next |
|-------------|-----------|
| 01 - Login | `/(auth)/login` |
| 02 - Dashboard | `/dashboard` |
| 03 - Monitoreo | `/dashboard/monitoring` |
| TAB 1/2/3 Análisis | `/dashboard/analysis/[machineId]` (tabs internos) |
| 06 - Historial | `/dashboard/orders` |
| 07 - Detalle de Orden | `/dashboard/orders/[id]` |
| 06b - Gestión de Técnicos | `/dashboard/technicians` |
| 07 - Analítica y Reportes | `/dashboard/analytics` |
| Analítica - Fallos Repetitivos | `/dashboard/analytics/repetitive` |
| Config Tabs 1–5 | `/dashboard/settings` (tabs) |
| Modales (Confirmar RAG, Nuevo Técnico) | `@modal` + intercepting routes |

---

## 4. API de modelos — `predictmaint-ml` (FastAPI mínima)

No es un microservicio con arquitectura propia: es una **API pequeña** cuya única función es
cargar los modelos entrenados y responder predicciones. Reutiliza tu pipeline actual
(`TYPE_ENCODING`, `Power`, `scaler_store`, split estratificado).

```
predictmaint-ml/
├── main.py                  # app FastAPI: define /predict, /classify, /rag
├── models.py                # carga modelos .pkl + scaler (una vez al arrancar)
├── features.py              # TYPE_ENCODING, FEATURE_COLUMNS, cálculo de Power
├── rag.py                   # plan de acción por tipo de fallo (mapa base + fuentes)
├── train.py                 # entrenar y serializar los 6 modelos (XGBoost y LightGBM pendientes)
├── artifacts/               # modelos .pkl/.joblib + scaler serializados
└── requirements.txt         # fastapi, uvicorn, scikit-learn, xgboost, lightgbm, pandas, joblib
```

> El dataset `ai4i2020.csv` solo se usa en `train.py` (offline). En runtime la API **no** lee el
> CSV: carga los `.pkl` de `artifacts/` y predice. El entrenamiento se hace una vez (o cuando
> cambias de modelo activo en Config 1).

### Contrato de endpoints (consumidos por `ml-gateway` de Nest)

| Endpoint | Entrada | Salida |
|----------|---------|--------|
| `POST /predict` | lectura de sensor (6 features + Type) | por modelo: `{prediccion, probabilidad, métricas}` + `ensemble_avg`, `nivel_riesgo` |
| `POST /classify` | misma lectura | por modelo: `{tipo_predicho, prob_por_tipo, métricas}` + `agreement` |
| `POST /rag` | `{tipo_fallo, maquina_id, historial}` | `{acciones[], fuentes[], escalado}` |

---

## 5. Integración y convenciones transversales

### 5.1 Comunicación entre servicios
```
Next.js  ──REST(JWT)──►  NestJS  ──REST(API key)──►  Python ML
```
- El navegador **nunca** llama directo al servicio ML; siempre pasa por la API Nest.
- La API Nest persiste todo resultado de inferencia (no se recalcula al refrescar la vista).

### 5.2 Enums compartidos (mantener sincronizados front/back)
`NivelRiesgo` (LOW/MEDIUM/HIGH/CRITICAL), `TipoFallo` (HDF/PWF/TWF/OSF/RNF),
`EstadoOrden` (pendiente/en_progreso/finalizado), `Turno`, `Canal`, `Especialidad`,
`EtapaModelo` (S1/S2), `EstadoTecnico`.

### 5.3 Variables de entorno (referenciales)

| Servicio | Variables |
|----------|-----------|
| web | `NEXT_PUBLIC_API_URL` |
| api | `DATABASE_URL`, `JWT_SECRET`, `JWT_EXPIRES_IN`, `ML_SERVICE_URL`, `ML_API_KEY`, `WHATSAPP_TOKEN`, `SMTP_*` |
| ml | `MODEL_ARTIFACTS_PATH`, `DATASET_PATH`, `API_KEY` |

### 5.4 Base de datos
- Migraciones versionadas en `database/migrations/` (`YYYYMMDDHHMMSS-descripcion.js`).
- Seeders para catálogos del modelo de datos §4 (tipos de fallo, niveles de riesgo,
  modelos ML, fuentes RAG, horarios de envío).

---

## 6. Orden de implementación sugerido
1. **predictmaint-api**: `config` + `database` + módulo `auth` + seeders de catálogos.
2. Módulos base: `machines`, `technicians`, `users`.
3. **predictmaint-ml**: entrenar y servir los 6 modelos (prioridad: XGBoost S-1, LightGBM S-2) + `/predict`, `/classify`, `/rag`.
4. `ml-gateway` + `predictions` + `alerts` + `orders` (pipeline §2.5).
5. `rag`, `notifications`, `repetitive-faults`, `jobs`.
6. **predictmaint-web**: capas `core`→`infrastructure`, luego vistas en orden Figma (Login → Dashboard → Monitoreo → Análisis → Historial/Detalle → Técnicos → Analítica → Config).
