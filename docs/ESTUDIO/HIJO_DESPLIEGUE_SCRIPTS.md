# Despliegue, Variables de Entorno y Scripts — PredictMaint

Documentación técnica de cómo correr y desplegar el sistema **PredictMaint** (mantenimiento predictivo industrial con ML + RAG), sus variables de entorno y los scripts auxiliares.

> **Nota de seguridad:** en este documento todos los valores sensibles (API keys, passwords, tokens, secretos JWT) aparecen **enmascarados como `********`**. Los archivos `.env` reales **no se modifican**; solo se leen para documentar.

---

## 1. Arquitectura de servicios y arranque

El monorepo tiene tres servicios + base de datos:

| Servicio | Carpeta | Tecnología | Puerto local | Puerto Docker |
|----------|---------|------------|--------------|---------------|
| Base de datos | (Postgres) | PostgreSQL 16 | `5432` | `5432` |
| API | `predictmaint-api/` | NestJS + Sequelize | `3004` (`.env` actual) / `3001` (Docker) | `3001` |
| ML | `predictmaint-ml/` | FastAPI + uvicorn | `8000` (uvicorn) / `8001` (esperado por API en `.env`) | `8000` |
| Web | `predictmaint-web/` | Next.js (App Router) | `3000` | `3000` |

> **Atención a los puertos:** los archivos `.env` locales NO coinciden con los defaults de `docker-compose.yml`.
> - En local, la API arranca en `PORT=3004` (`predictmaint-api/.env`) y la Web apunta a `http://localhost:3004` (`predictmaint-web/.env.local`).
> - En local, la API espera al ML en `ML_SERVICE_URL=http://localhost:8001`, pero `uvicorn` arranca por defecto en `8000`. Hay que alinear ambos (arrancar uvicorn en `--port 8001` o ajustar `ML_SERVICE_URL=http://localhost:8000`).
> - En Docker, todo usa los puertos "limpios": API `3001`, ML `8000`, Web → API `http://localhost:3001`.

### Orden de arranque recomendado

**Postgres → API → ML → Web.** La API necesita la BD para crear tablas/seed; el pipeline de la API llama al ML; la Web consume la API.

### 1.1. Arranque en LOCAL (sin Docker)

**Paso 1 — Base de datos (PostgreSQL 16+)**

```bash
# Opción A: Postgres en Docker, solo el contenedor de BD
docker compose up postgres -d

# Opción B: PostgreSQL local. Configurar la conexión en predictmaint-api/.env
```

Las credenciales locales actuales (`predictmaint-api/.env`) usan variables sueltas (tienen prioridad sobre `DATABASE_URL`):
host `localhost`, puerto `5432`, usuario `postgres`, BD `mantto_bd_v2`, password `********`.

**Paso 2 — API (predictmaint-api)** — Ruta: `C:\...\proyecto_unidad2\predictmaint-api`

```bash
cd predictmaint-api
copy .env.example .env      # o usar el .env existente
npm install
npm run start:dev           # NestJS en modo watch
```

- Con `DATABASE_SYNC=true`, Nest crea las tablas desde los modelos Sequelize al iniciar.
- Con `DATABASE_SEED=true`, corre los seeders **solo si la BD está vacía** (sin usuarios).
- Migraciones manuales (opcional, p. ej. producción): `npm run migration:run` y `npm run seed:run`.
- API: `http://localhost:3004` · Swagger: `http://localhost:3004/api/docs`

**Paso 3 — ML (predictmaint-ml)** — Ruta: `C:\...\proyecto_unidad2\predictmaint-ml`

```bash
cd predictmaint-ml
cp .env.example .env
pip install -r requirements.txt
python train.py                       # entrena y genera artifacts/ (solo la primera vez)
uvicorn main:app --reload --port 8000 # usar --port 8001 si la API lo espera ahí
```

- Health: `http://localhost:8000/health`

**Paso 4 — Web (predictmaint-web)** — Ruta: `C:\...\proyecto_unidad2\predictmaint-web`

```bash
cd predictmaint-web
cp .env.example .env.local            # define NEXT_PUBLIC_API_URL
npm install
npm run dev
```

- UI: `http://localhost:3000`

### 1.2. Arranque con DOCKER COMPOSE (todo el stack)

Archivo: `C:\...\proyecto_unidad2\docker-compose.yml`

```bash
docker compose up --build
```

Levanta los cuatro servicios:

```yaml
postgres:  postgres:16-alpine, healthcheck pg_isready, volumen pgdata
api:       build ./predictmaint-api, depends_on postgres (healthy) + ml
ml:        build ./predictmaint-ml, monta ./predictmaint-ml/artifacts:/app/artifacts:ro
web:       build ./predictmaint-web, depends_on api
```

**Diferencias local vs Docker (URLs entre servicios):**

| Variable | Local (.env) | Docker (compose) |
|----------|--------------|------------------|
| `DATABASE_URL` / host | `localhost:5432`, BD `mantto_bd_v2` | `postgres://predictmaint:********@postgres:5432/predictmaint` |
| `ML_SERVICE_URL` (API→ML) | `http://localhost:8001` | `http://ml:8000` (DNS interno del compose) |
| `NEXT_PUBLIC_API_URL` (Web→API) | `http://localhost:3004` | `http://localhost:3001` |
| `PORT` (API) | `3004` | `3001` |

En Docker los servicios se resuelven por **nombre de servicio** (`postgres`, `ml`, `api`) gracias a la red interna de Compose; en local todo es `localhost` con los puertos correspondientes.

### 1.3. Dockerfiles

- `predictmaint-api/Dockerfile`: build multi-stage Node 20-alpine → `npm run build` → imagen final corre `node dist/main.js`, expone `3001`.
- `predictmaint-ml/Dockerfile`: `python:3.11-slim` → `pip install -r requirements.txt` → `uvicorn main:app --host 0.0.0.0 --port 8000`, expone `8000`.
- `predictmaint-web/Dockerfile`: multi-stage Node 20-alpine, recibe `ARG NEXT_PUBLIC_API_URL` en build, `npm run build` → `npm start`, expone `3000`.

---

## 2. Variables de entorno

Valores tomados de los `.env` reales. **Secretos enmascarados con `********`.**

### 2.1. API — `predictmaint-api/.env`

| Variable | Para qué sirve | Valor por defecto |
|----------|----------------|-------------------|
| `DATABASE_URL` | URL completa de conexión Postgres (Opción A, comentada) | *(comentada)* `postgres://predictmaint:********@localhost:5432/predictmaint` |
| `DATABASE_HOST` | Host de Postgres (Opción B, tiene prioridad) | `localhost` |
| `DATABASE_PORT` | Puerto de Postgres | `5432` |
| `DATABASE_USER` | Usuario de Postgres | `postgres` |
| `DATABASE_PASSWORD` | Password de Postgres | `********` |
| `DATABASE_NAME` | Nombre de la base de datos | `mantto_bd_v2` |
| `DATABASE_SYNC` | Crea tablas desde modelos Sequelize al arrancar (dev) | `true` |
| `DATABASE_ALTER` | Ajusta columnas existentes a los modelos | `true` |
| `DATABASE_FORCE` | `true` borra y recrea todo (¡solo dev!) | `false` |
| `DATABASE_LOGGING` | Loguea SQL de Sequelize | `false` |
| `DATABASE_SEED` | Seed automático la primera vez (si no hay usuarios) | `true` |
| `JWT_SECRET` | Secreto para firmar JWT de autenticación | `********` |
| `JWT_EXPIRES_IN` | Caducidad del token JWT | `8h` |
| `ML_SERVICE_URL` | URL del servicio ML (gateway de inferencia) | `http://localhost:8001` |
| `ML_API_KEY` | API key para autenticar contra el servicio ML | `********` |
| `WHATSAPP_TOKEN` | Token de WhatsApp (stub si vacío) | *(vacío)* |
| `SMTP_HOST` | Host SMTP de notificaciones (stub si vacío) | *(vacío)* |
| `SMTP_PORT` | Puerto SMTP | `587` |
| `SMTP_USER` | Usuario SMTP | *(vacío)* `********` |
| `SMTP_PASS` | Password SMTP | *(vacío)* `********` |
| `PORT` | Puerto de escucha de la API | `3004` |
| `EVALUACION_COOLDOWN_MINUTOS` | Minutos entre evaluaciones S-1 en la misma máquina (evita spam del simulador) | `15` |
| `SEND_EMAIL_WEBHOOK` | Webhook (n8n) para envío de correos de asignación | `https://n8n.yamboly.lat/webhook/********` |
| `DEMO_AUTOFAULT_ENABLED` | Activa el cron que inyecta fallas en máquinas libres (demo) | `true` |
| `DEMO_AUTOFAULT_MIN` | Minutos entre inyecciones automáticas de falla | `10` |
| `DEMO_AUTOFAULT_BIAS` | Sesgo del tipo de falla por máquina (0–1) | `0.7` |
| `DEMO_AUTOFAULT_MAX_ACTIVAS` | Tope de órdenes activas para el generador de fallas | `5` |

### 2.2. ML — `predictmaint-ml/.env`

| Variable | Para qué sirve | Valor por defecto |
|----------|----------------|-------------------|
| `API_KEY` | API key que valida las llamadas entrantes desde la API | `********` |
| `MODEL_ARTIFACTS_PATH` | Carpeta con los modelos serializados (`.joblib`) y `metrics.json` | `./artifacts` |
| `DATASET_PATH` | Ruta al dataset de entrenamiento (AI4I 2020) | `../ai4i2020.csv` |
| `OPENROUTER_API_KEY` | API key de OpenRouter para el LLM del RAG (S-3) | `********` |
| `RAG_USE_LLM` | Usa LLM real para el plan de acción RAG (vs. plantillas) | `true` |
| `RAG_PROVIDER` | Proveedor del LLM para RAG | `openrouter` |
| `RAG_MODEL` | Modelo LLM usado por el RAG | `openai/gpt-4o-mini` |
| `RAG_TIMEOUT_SEC` | Timeout (s) de la llamada al LLM | `40` |
| `RAG_SSL_VERIFY` | Verificación SSL en la llamada al LLM | `false` |

### 2.3. Web — `predictmaint-web/.env.local`

| Variable | Para qué sirve | Valor por defecto |
|----------|----------------|-------------------|
| `NEXT_PUBLIC_API_URL` | URL base de la API que consume el frontend | `http://localhost:3004` |

> Variables `NEXT_PUBLIC_*` se inyectan en build; en Docker se pasa como `ARG`/`ENV` en el `Dockerfile`.

---

## 3. Scripts auxiliares

### 3.1. `reset-demo-day` — limpiar datos operativos de la demo

- **Node:** `predictmaint-api/scripts/reset-demo-day.js`
- **Wrapper PowerShell:** `scripts/reset-demo-day.ps1`

**Qué hace:** borra lecturas, análisis, órdenes, alertas, clasificaciones, recomendaciones RAG y eventos del simulador. **Conserva** usuarios, técnicos, máquinas y configuración. Además libera técnicos (`en_intervencion` → `disponible`). Opera sobre la BD definida en `predictmaint-api/.env`.

**Cómo se ejecuta (Node directo, desde `predictmaint-api/`):**

```bash
node scripts/reset-demo-day.js --dry-run      # solo muestra conteos, no borra
node scripts/reset-demo-day.js --yes          # borra SOLO los eventos de hoy (desde 00:00)
node scripts/reset-demo-day.js --all --yes    # borra TODO el historial operativo (TRUNCATE)
```

**Wrapper PowerShell (desde la raíz del repo):**

```powershell
.\scripts\reset-demo-day.ps1            # sin --yes: solo recuerda agregar confirmación
.\scripts\reset-demo-day.ps1 -Yes       # eventos de hoy
.\scripts\reset-demo-day.ps1 -All -Yes  # todo el historial operativo
.\scripts\reset-demo-day.ps1 -DryRun    # solo conteos
```

**Cuándo usarlo:** antes de una demo, para "resetear el día" y volver a generar eventos con el simulador. Sin `--yes` (y sin `--dry-run`) **no borra nada**: pide confirmación explícita.

### 3.2. `sync-ml-metrics` — métricas de ML → BD

- **Ruta:** `predictmaint-api/scripts/sync-ml-metrics.js`

**Qué hace:** lee `predictmaint-ml/artifacts/metrics.json` y actualiza la tabla `modelos_ml` de Postgres con las métricas de los 6 modelos. Mapea los *slugs* a nombres legibles (`regresion_logistica`→`Regresión Logística`, `random_forest`, `xgboost`, `decision_tree`, `lightgbm`, `svm`). Para S-1 (binarios) escribe accuracy, ROC-AUC, precision, recall, f1 y matriz de confusión (tn/fp/fn/tp); para S-2 (multiclase) escribe accuracy, f1Macro, f1Weighted y agregados.

**Cómo se ejecuta (desde `predictmaint-api/`):**

```bash
node scripts/sync-ml-metrics.js
# Ruta de métricas alternativa:
ML_METRICS_PATH=../predictmaint-ml/artifacts/metrics.json node scripts/sync-ml-metrics.js
```

**Cuándo usarlo:** después de reentrenar los modelos, para que el dashboard muestre las métricas actualizadas. `train.py` lo invoca automáticamente al terminar (ver sección 4).

### 3.3. `simulate-sensor-stream` — simulador de lecturas de sensores

- **Ruta:** `scripts/simulate-sensor-stream.py`

**Qué hace:** simula un stream de lecturas por **etapas**. En cada etapa, una máquina distinta termina con un **fallo confirmado** (S-1 + tipo de fallo) y el resto del tiempo todas las máquinas reciben lecturas normales. Excluye la última máquina que falló y las que ya tienen pipeline activo o están en cooldown. Toma filas reales del dataset `ai4i2020.csv` y hace `POST` al endpoint `sensor-readings` de la API. Hace login demo para consultar órdenes activas y evitar máquinas bloqueadas.

**Cómo se ejecuta:**

```bash
python scripts/simulate-sensor-stream.py
python scripts/simulate-sensor-stream.py --stages 3 --min-delay 1 --max-delay 2
```

**Flags principales:**

| Flag | Default | Descripción |
|------|---------|-------------|
| `--stages` / `--etapas` | `5` (nº de máquinas) | Cantidad de etapas (una máquina con fallo por etapa) |
| `--min-normal` | `4` | Mínimo de lecturas normales antes del fallo en cada etapa |
| `--max-normal` | `10` | Máximo de lecturas normales antes del fallo |
| `--initial-delay` | `3.0` | Segundos de espera antes del primer envío (batch inicial) |
| `--min-delay` | `1.5` | Segundos mínimos entre envíos |
| `--max-delay` | `3.0` | Segundos máximos entre envíos |
| `--seed` | `None` | Semilla para reproducir la secuencia |
| `--fault-retries` | `8` | Máx. de máquinas candidatas a probar por etapa hasta confirmar fallo |
| `--api-url` | `http://localhost:3001/sensor-readings` | URL del endpoint sensor-readings |
| `--demo-email` | `operador@planta.pe` | Usuario demo para consultar órdenes activas |
| `--demo-password` | `********` (`password123`) | Contraseña demo |

> **Ojo:** el default `--api-url` apunta a `:3001`. Si la API local corre en `PORT=3004`, pasar `--api-url http://localhost:3004/sensor-readings`.

**Cuándo usarlo:** para alimentar el sistema con lecturas y disparar el pipeline completo (S-1 → S-2 → S-3 → alerta + orden + técnico) en demos y pruebas. Respeta el `EVALUACION_COOLDOWN_MINUTOS` de la API.

### 3.4. `test-smtp` — prueba de envío de correo

- **Ruta:** `predictmaint-api/scripts/test-smtp.js`

**Qué hace:** verifica la conexión SMTP con `nodemailer` y envía un correo de prueba. Usa las variables `MAIL_HOST`, `MAIL_USER`, `MAIL_PASS` (y opcionales `MAIL_PORT`, `MAIL_FROM_NAME`, `MAIL_FROM_ADDRESS`, `MAIL_TEST_TO`). Falla si faltan `MAIL_HOST`/`MAIL_USER`/`MAIL_PASS`.

**Cómo se ejecuta (desde `predictmaint-api/`):**

```bash
node scripts/test-smtp.js
```

**Cuándo usarlo:** para validar que la configuración de correo de notificaciones/asignación funciona antes de habilitarla.

> Nota: este script usa el prefijo `MAIL_*`, distinto del `SMTP_*` que aparece en `.env`. Para probarlo hay que definir `MAIL_HOST`/`MAIL_USER`/`MAIL_PASS` (enmascarados como `********`).

### 3.5. `fix-demo-password` — restaurar contraseña del usuario demo

- **Ruta:** `predictmaint-api/scripts/fix-demo-password.js`

**Qué hace:** actualiza en la tabla `usuario` el `password_hash` de `operador@planta.pe` a un hash bcrypt conocido que corresponde a la contraseña `password123`.

**Cómo se ejecuta (desde `predictmaint-api/`):**

```bash
node scripts/fix-demo-password.js
```

**Cuándo usarlo:** si el login demo deja de funcionar (BD con hash distinto o seed antiguo), para volver a dejar `operador@planta.pe` / `password123` operativo.

### 3.6. `mark-legacy-migration` — marcar migración legacy como aplicada

- **Ruta:** `predictmaint-api/scripts/mark-legacy-migration.js`

**Qué hace:** crea la tabla `SequelizeMeta` si no existe e inserta el registro `20260617000001-create-all-tables.js`, marcando esa migración legacy como ya aplicada (sin ejecutarla).

**Cómo se ejecuta (desde `predictmaint-api/`):**

```bash
node scripts/mark-legacy-migration.js
```

**Cuándo usarlo:** al migrar de una BD creada con `DATABASE_SYNC` (sin historial de migraciones) hacia el flujo de `sequelize-cli`, para evitar que `migration:run` intente recrear tablas ya existentes.

---

## 4. Entrenamiento de modelos ML y flujo de métricas a la BD

- **Script:** `predictmaint-ml/train.py`
- **Dataset:** `ai4i2020.csv` (AI4I 2020, ~10.000 registros), ruta vía `DATASET_PATH` (default `../ai4i2020.csv`).
- **Artefactos de salida:** `predictmaint-ml/artifacts/` (vía `MODEL_ARTIFACTS_PATH`).

**Cómo se ejecuta:**

```bash
cd predictmaint-ml
python train.py
```

**Qué hace `train.py`:**

1. Carga y preprocesa el dataset; separa train/test (80/20, estratificado, `random_state=42`) y escala con `StandardScaler` (guarda `scaler.joblib`).
2. **S-1 (binario, "¿hay fallo?")** entrena 3 modelos: **Regresión Logística**, **Random Forest**, **XGBoost**. Métricas: accuracy, ROC-AUC, precision, recall, f1, matriz de confusión (tn/fp/fn/tp).
3. **S-2 (multiclase, tipo de fallo, solo filas con fallo)** entrena 3 modelos: **Decision Tree**, **LightGBM**, **SVM**. Métricas: accuracy, f1Macro, f1Weighted, agregados.
4. Serializa cada modelo a `artifacts/<nombre>.joblib` y vuelca todas las métricas a `artifacts/metrics.json` con la forma `{"s1": {...}, "s2": {...}}`.

**Cómo llegan las métricas a la BD:**

Al final, `train.py` llama a la función `_sync_metrics_to_api()`, que ejecuta como subproceso:

```text
node predictmaint-api/scripts/sync-ml-metrics.js
   (con ML_METRICS_PATH apuntando a artifacts/metrics.json)
```

Ese script (ver 3.2) lee `metrics.json` y hace `UPDATE` sobre la tabla **`modelos_ml`** en Postgres, dejando las métricas disponibles para el dashboard. Si la API/Postgres no están disponibles, el sync falla de forma "suave" (avisa en stderr) pero el entrenamiento y los artefactos quedan generados.

> En resumen: `python train.py` → `artifacts/*.joblib` + `metrics.json` → `sync-ml-metrics.js` → tabla `modelos_ml`. También puede correrse el sync por separado tras un reentrenamiento manual.

---

## 5. Usuario demo y credenciales de prueba

Del README y los seeders/scripts:

| Dato | Valor |
|------|-------|
| Email | `operador@planta.pe` |
| Contraseña | `password123` |

- El seed crea este usuario automáticamente la primera vez (con `DATABASE_SEED=true` y BD vacía).
- Si el login falla, restaurar con `node scripts/fix-demo-password.js` (sección 3.5).
- El simulador (`simulate-sensor-stream.py`) usa estas mismas credenciales por defecto para consultar órdenes activas.

---

## Apéndice — Comandos rápidos

```bash
# Stack completo en Docker
docker compose up --build

# Local, en orden
docker compose up postgres -d
(cd predictmaint-api  && npm install && npm run start:dev)     # :3004 (Swagger /api/docs)
(cd predictmaint-ml   && pip install -r requirements.txt && python train.py && uvicorn main:app --reload --port 8000)
(cd predictmaint-web  && npm install && npm run dev)           # :3000

# Demo: simular lecturas / resetear el día
python scripts/simulate-sensor-stream.py --stages 3
.\scripts\reset-demo-day.ps1 -Yes

# Mantenimiento
(cd predictmaint-api && node scripts/sync-ml-metrics.js)
(cd predictmaint-api && node scripts/fix-demo-password.js)
(cd predictmaint-api && node scripts/test-smtp.js)
(cd predictmaint-api && node scripts/mark-legacy-migration.js)
```
