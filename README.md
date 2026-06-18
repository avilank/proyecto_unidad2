# PredictMaint — Monorepo

Sistema de mantenimiento predictivo industrial con ML + RAG.

## Estructura

```
predictmaint-web/   # Next.js (App Router) — UI
predictmaint-api/   # NestJS + Sequelize + PostgreSQL — API REST
predictmaint-ml/    # FastAPI — inferencia ML (S-1, S-2, S-3 RAG)
```

Documentación de referencia:
- `DOCUMENTACION_MODELO_DE_DATOS.md`
- `DOCUMENTACION_ARQUITECTURA.md`
- `DOCUMENTACION_API_CONTRATO.md`

## Requisitos

- Node.js 20+
- Python 3.10+
- PostgreSQL 16+ (o Docker)

## Inicio rápido (local)

### 1. Base de datos

```bash
# Con Docker
docker compose up postgres -d

# O PostgreSQL local con DATABASE_URL en predictmaint-api/.env
```

### 2. Backend (predictmaint-api)

```bash
cd predictmaint-api
copy .env.example .env   # DATABASE_SYNC=true crea tablas al arrancar
npm install
npm run start:dev
```

> **Como lord-academy:** con `DATABASE_SYNC=true` (default en `.env.example`) Nest crea las tablas desde los modelos Sequelize al iniciar. Con `DATABASE_SEED=true` (default) corre los seeders **solo si la BD está vacía** (sin usuarios).
>
> Migraciones manuales (opcional, p. ej. producción): `npm run migration:run` y `npm run seed:run`

**Variables clave en `.env`:**

| Variable | Dev recomendado | Descripción |
|----------|-----------------|-------------|
| `DATABASE_SYNC` | `true` | Crea tablas al arrancar |
| `DATABASE_FORCE` | `false` | `true` = borra y recrea todo (solo dev) |
| `DATABASE_ALTER` | `false` | `true` = ajusta columnas existentes |
| `DATABASE_SEED` | `true` | Seed automático si no hay usuarios |
| `DATABASE_URL` | postgres://… | Conexión PostgreSQL |

API: http://localhost:3001  
Swagger: http://localhost:3001/api/docs  

**Usuario demo:** `operador@planta.pe` / `password123`

### 3. ML (predictmaint-ml)

```bash
cd predictmaint-ml
cp .env.example .env
pip install -r requirements.txt
python train.py          # entrena y genera artifacts/ (solo la primera vez)
uvicorn main:app --reload --port 8000
```

Health: http://localhost:8000/health

### 4. Frontend (predictmaint-web)

```bash
cd predictmaint-web
cp .env.example .env.local
npm install
npm run dev
```

UI: http://localhost:3000

## Docker Compose (todo el stack)

```bash
docker compose up --build
```

Servicios: postgres (5432), api (3001), ml (8000), web (3000).

La API crea tablas y seed al arrancar (`DATABASE_SYNC` + `DATABASE_SEED`). No hace falta correr migraciones manualmente en dev.

## Pipeline automático

Al enviar `POST /sensor-readings` con lectura que supera una regla de sensor (RN-01…RN-04):

1. **S-1** — 3 modelos binarios → `ensemble_avg` + nivel de riesgo
2. **S-2** — 3 modelos multiclase → tipo de fallo + agreement
3. **S-3** — RAG → plan de acción (3 acciones)
4. Creación de **alerta** + **orden** + asignación de **técnico** + notificación (stub)

## Variables de entorno

| Servicio | Archivo | Variables clave |
|----------|---------|-----------------|
| api | `predictmaint-api/.env.example` | `DATABASE_URL`, `JWT_SECRET`, `ML_SERVICE_URL`, `ML_API_KEY` |
| ml | `predictmaint-ml/.env.example` | `API_KEY`, `MODEL_ARTIFACTS_PATH` |
| web | `predictmaint-web/.env.example` | `NEXT_PUBLIC_API_URL` |

## Entrenamiento de modelos

Dataset: `ai4i2020.csv` (10.000 registros, AI4I 2020).

```bash
cd predictmaint-ml
python train.py
```

Modelos S-1: Regresión Logística, Random Forest, XGBoost  
Modelos S-2: Decision Tree, LightGBM, SVM

Artefactos en `predictmaint-ml/artifacts/`.

## Fase actual

Infraestructura funcional **sin diseño visual** en las vistas. Las pantallas muestran datos crudos del API como placeholders.

Pendiente para fases posteriores:
- Diseño visual (Figma)
- Integración real WhatsApp/Email
- Fuente de lecturas en tiempo real
- CASL permisos granulares
