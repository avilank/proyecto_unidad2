# Guía — Código de los Modelos ML: entrenamiento, métricas e inferencia

> Recorrido del **código** del servicio ML (`predictmaint-ml/`): cómo se entrenaron los 6
> modelos, qué features usan, qué métricas dieron y cómo se hace la inferencia en vivo.
> Pensado para estudiar y defender ante el docente.
>
> Complementa a `GUIA_MODELOS_ML.md` (esa explica cómo el **backend** consume los modelos;
> esta explica el **código Python** en sí).

---

## 0. Mapa de archivos del servicio ML

| Archivo | Rol |
|---|---|
| `features.py` | **Feature engineering** compartido por entrenamiento e inferencia |
| `train.py` | **Entrenamiento offline** de los 6 modelos → guarda `.joblib` |
| `models.py` | **Carga** los `.joblib` en memoria al arrancar la API |
| `main.py` | **API FastAPI**: endpoints `/predict` (S-1), `/classify` (S-2), `/rag` (S-3) |
| `rag.py` | Generación del plan de acción (S-3) |
| `artifacts/*.joblib` | Modelos entrenados serializados + `scaler` + `metrics.json` |
| `artifacts/reports/REPORTE_MODELOS.md` | Reporte de evaluación (métricas y gráficos) |

> **Clave:** el entrenamiento es **offline** (se corre una vez, genera los `.joblib`). La API
> solo **carga** esos archivos y hace inferencia. No se reentrena en cada predicción.

---

## 1. Las features (`features.py`)

Todos los modelos usan **7 features** (`FEATURE_COLUMNS`, líneas 13-21):

| Feature | Origen |
|---|---|
| `Type` | Calidad de la máquina (L/M/H) codificada a 0/1/2 (`TYPE_ENCODING`) |
| `Air temperature` | Sensor (K) |
| `Process temperature` | Sensor (K) |
| `Rotational speed` | Sensor (rpm) |
| `Torque` | Sensor (Nm) |
| `Tool wear` | Sensor (min) |
| `Power` | **Derivada**: `torque · rpm · 2π / 60` (W) — `compute_power`, líneas 34-36 |

- `Power` es **feature engineering**: no viene en el CSV, se calcula. Es la potencia mecánica,
  que correlaciona con fallas de potencia (PWF) y sobreesfuerzo (OSF).
- La MISMA función de preprocesamiento se usa en entrenamiento (`preprocess_dataframe`,
  líneas 79-84) y en inferencia (`preprocess_reading`, líneas 58-76) → garantiza que el
  modelo vea los datos igual en ambos momentos.
- `extract_fault_labels` (líneas 87-93): convierte las columnas one-hot del CSV (HDF, PWF,
  TWF, OSF, RNF) en **una etiqueta multiclase**; si no hubo falla, la etiqueta es `NONE`.

---

## 2. El entrenamiento (`train.py`)

### 2.1 Protocolo (líneas 33-34, 91-111)
- **Dataset:** AI4I 2020 (`ai4i2020.csv`), 10 000 filas.
- **Split:** 80% train / 20% test, **estratificado** por `Machine failure`, `random_state=42`
  (reproducible).
- **Escalado:** `StandardScaler` ajustado **solo con train** (`fit_transform`) y aplicado a
  test (`transform`). Se guarda como `scaler.joblib` para usar el MISMO escalado en inferencia.

### 2.2 Dos etapas, dos conjuntos de modelos

**S-1 (binario — ¿falla o no?)** — `s1_specs`, líneas 113-123. Se entrena con TODO el dataset:

| Modelo | Algoritmo | Hiperparámetros clave |
|---|---|---|
| `regresion_logistica` | Regresión Logística | `max_iter=1000` |
| `random_forest` | Random Forest | `n_estimators=200` |
| `xgboost` | XGBoost | `n_estimators=200, max_depth=6, learning_rate=0.1` |

**S-2 (multiclase — ¿qué tipo de falla?)** — `s2_specs`, líneas 143-153. Se entrena **solo con
las filas que SÍ fueron falla** (`fault_train_mask`, líneas 136-141):

| Modelo | Algoritmo | Hiperparámetros clave |
|---|---|---|
| `decision_tree` | Árbol de Decisión | `max_depth=12` |
| `lightgbm` | LightGBM | `n_estimators=200, max_depth=8, learning_rate=0.1` |
| `svm` | SVM (kernel RBF) | `probability=True` |

> ¿Por qué S-2 solo con fallas? Porque S-2 nunca recibe máquinas sanas: solo se ejecuta
> cuando S-1 ya confirmó falla. Entrenarlo solo con fallas lo hace especialista en el tipo.

### 2.3 Cómo se calculan las métricas
- **S-1** (`_binary_metrics`, líneas 51-64): accuracy, **ROC-AUC**, precision, recall, F1 y la
  **matriz de confusión** (TN, FP, FN, TP).
- **S-2** (`_multiclass_metrics`, líneas 67-82): accuracy, **F1 macro** y **F1 weighted**.
- Todo se guarda en `artifacts/metrics.json` (líneas 179-182) y cada modelo en su `.joblib`.

### 2.4 Sincronización con la BD
Al terminar, `train.py` llama a `sync-ml-metrics.js` (líneas 188-210) que vuelca las métricas
de `metrics.json` a la tabla `modelos_ml` del backend → así el frontend muestra las métricas
sin tocar Python.

### 2.5 Cómo se ejecuta
```bash
cd predictmaint-ml
python train.py        # genera artifacts/*.joblib + metrics.json y sincroniza la BD
```

---

## 3. Resultados reales (de `artifacts/reports/REPORTE_MODELOS.md`)

- **Test S-1:** 2000 muestras (68 fallas). **Test S-2:** 68 muestras (solo fallas).

### S-1 — Detección binaria
| Modelo | Accuracy | ROC-AUC | Precision | Recall | F1 | TP | FN | FP |
|--------|----------|---------|-----------|--------|-----|-----|-----|-----|
| Regresión Logística | 85.8% | 0.934 | 17.7% | 86.8% | 29.4% | 59 | 9 | 275 |
| Random Forest | 98.3% | 0.970 | 85.4% | 60.3% | 70.7% | 41 | 27 | 7 |
| **XGBoost (líder)** | **98.6%** | **0.981** | 80.3% | 77.9% | **79.1%** | 53 | 15 | 13 |

### S-2 — Clasificación multiclase
| Modelo | Accuracy | F1 macro | F1 weighted | TP | FN |
|--------|----------|----------|-------------|-----|-----|
| Decision Tree | 91.2% | 0.902 | 0.913 | 62 | 6 |
| **LightGBM (líder)** | **92.6%** | **0.919** | **0.926** | 63 | 5 |
| SVM | 85.3% | 0.846 | 0.856 | 58 | 10 |

### Cómo leer estos números (para el docente)
- **Accuracy alta no basta** en S-1: como solo 68 de 2000 son fallas (dataset desbalanceado),
  un modelo que diga "todo sano" acertaría 96.6%. Por eso miramos **recall** (¿cuántas fallas
  reales detecto?) y **ROC-AUC**.
- **Regresión Logística** tiene recall altísimo (86.8%) pero precision pésima (17.7%): detecta
  casi todas las fallas pero con **muchísimos falsos positivos** (FP=275). No sirve sola.
- **XGBoost** es el **líder S-1**: mejor equilibrio (F1 79.1%, ROC-AUC 0.981).
- **LightGBM** es el **líder S-2**: mejor accuracy y F1 en clasificación de tipo.

---

## 4. La inferencia en vivo (`main.py`)

### 4.1 Carga al arrancar (`models.py`)
`ModelStore.load()` (líneas 30-55) carga el `scaler` + los 3 modelos S-1 + los 3 S-2 +
`metrics.json`. Si falta algún archivo, lanza error al arrancar. `GET /health` (main.py 110-115)
reporta `modelosCargados`.

### 4.2 Seguridad
Todos los endpoints exigen **API-Key** (`verify_api_key`, main.py 49-51): el header
`X-API-Key` debe coincidir con la variable de entorno. Por eso solo el backend (que la conoce)
puede llamar al ML.

### 4.3 `POST /predict` — S-1 (líneas 118-168)
1. Escala la lectura con el `scaler` guardado (`_scale_features`, líneas 88-92).
2. Cada uno de los 3 modelos da `predict_proba` → probabilidad de falla.
3. **Líder = el de mayor probabilidad** (líneas 154-158).
4. Devuelve `confianzaLider`, `ensembleAvg`, `nivelRiesgo` y el detalle por modelo (con sus
   métricas offline adjuntas).

> Ojo: el `nivelRiesgo` que devuelve el ML (umbrales fijos `RISK_THRESHOLDS`, líneas 24-29) es
> **informativo**: el backend lo **recalcula** con los umbrales configurables (ver
> `GUIA_MONITOREO_TIEMPO_REAL.md`).

### 4.4 `POST /classify` — S-2 (líneas 171-233)
1. Escala la lectura.
2. Cada modelo predice un tipo (`votes`) y su confianza.
3. **Agreement** (`_agreement_label`, líneas 76-85): cuántos de los 3 coinciden → ALTO(3) /
   MEDIO(2) / BAJO(1).
4. **Líder S-2 = LightGBM** por defecto (mejor métrica offline; `_pick_s2_leader`, líneas 65-73),
   con fallback por confianza.
5. Si el agreement es BAJO, devuelve el tipo de **consenso** (el más votado) en vez del líder.
6. Marca `diverge=true` en los modelos que no coinciden con el consenso.

### 4.5 `POST /rag` — S-3 (líneas 236-247)
Delega en `rag.py` → `generate_action_plan()`, que arma el plan de acción según el tipo de
fallo. (El RAG actual es basado en reglas/plantillas, no LLM dinámico — ver nota abajo.)

---

## 5. Concepto de ENSEMBLE (clave para la defensa)

> No usamos un solo modelo por etapa, usamos **3** ("ensemble"). En cada inferencia los 3
> opinan; el más confiable es el **líder** (`esLider`). Esto da:
> - **Robustez:** si un modelo se equivoca, los otros lo contrastan.
> - **Agreement (S-2):** una medida de certeza (cuántos coinciden).
> - **Transparencia:** el frontend muestra qué dijo cada modelo, no una caja negra.

---

## 6. Tabla de referencia — archivo:líneas

| Tema | Archivo | Líneas |
|---|---|---|
| Features y `Power` derivada | `predictmaint-ml/features.py` | 13-36 |
| Preprocesamiento (train e inferencia) | `predictmaint-ml/features.py` | 58-93 |
| Split + scaler | `predictmaint-ml/train.py` | 91-111 |
| Modelos S-1 + hiperparámetros | `predictmaint-ml/train.py` | 113-134 |
| Modelos S-2 (solo fallas) | `predictmaint-ml/train.py` | 136-169 |
| Métricas binarias / multiclase | `predictmaint-ml/train.py` | 51-82 |
| Sync de métricas a la BD | `predictmaint-ml/train.py` | 188-210 |
| Carga de modelos en memoria | `predictmaint-ml/models.py` | 30-65 |
| API key | `predictmaint-ml/main.py` | 49-51 |
| `/predict` (S-1) | `predictmaint-ml/main.py` | 118-168 |
| `/classify` (S-2) + agreement | `predictmaint-ml/main.py` | 171-233 |
| `/rag` (S-3) | `predictmaint-ml/main.py` | 236-247 |
| Métricas reales | `predictmaint-ml/artifacts/reports/REPORTE_MODELOS.md` | todo |

---

## 7. Preguntas probables del docente

| Pregunta | Respuesta corta |
|---|---|
| **¿Qué algoritmos usaron?** | S-1: Regresión Logística, Random Forest, XGBoost. S-2: Árbol de Decisión, LightGBM, SVM. |
| **¿Por qué 3 por etapa?** | Ensemble: robustez, medida de acuerdo (agreement) y transparencia. |
| **¿Cuál es el líder y por qué?** | S-1: XGBoost (mejor F1/ROC-AUC). S-2: LightGBM (mejor accuracy/F1). |
| **¿Por qué la accuracy de S-1 engaña?** | Dataset desbalanceado (68/2000 fallas); por eso miramos recall y ROC-AUC. |
| **¿Por qué escalan las features?** | SVM y Regresión Logística son sensibles a la escala; el `StandardScaler` se ajusta en train y se reusa en inferencia. |
| **¿Qué es la feature Power?** | Potencia derivada (`torque·rpm·2π/60`), feature engineering ligado a fallas de potencia/sobreesfuerzo. |
| **¿Se reentrena en producción?** | No. Entrenamiento offline (`train.py`) → `.joblib`; la API solo carga e infiere. |
| **¿Cómo se conecta con el backend?** | El backend llama por HTTP con `X-API-Key`; nunca abre los `.joblib`. |

> ⚠️ **Honestidad para la defensa:** el RAG (S-3) hoy es **basado en reglas/plantillas**, no un
> LLM dinámico. Si preguntan por mejoras futuras, ese es el principal: RAG con LLM real.

---

### Documentos relacionados
- `GUIA_MODELOS_ML.md` — cómo el backend consume/cataloga los modelos.
- `DOCUMENTACION_FLUJO_MONITOREO.md` — el pipeline S-1→S-2→S-3 en el backend.
- `GUIA_MONITOREO_TIEMPO_REAL.md` — recálculo del nivel de riesgo.
- `HIJO_RAG_BACKEND.md` — detalle del RAG.
- `GUION_EXPOSICION.md` — guión para la exposición.
