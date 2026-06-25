# Guía — Modelos ML: entrenamiento, métricas y cómo los lee el backend

> Cubre dos cosas que suelen preguntar:
> **A)** Cómo el backend "lee" los modelos (catálogo + inferencias).
> **B)** En qué se basa `train.py`, qué algoritmos usa, qué métricas calcula y cómo las maneja.

---

## Idea central (no confundir)

> **El backend (NestJS) NO carga los archivos `.joblib`.** Quien los carga en memoria es el **servicio Python (FastAPI)**. El backend solo: (1) mantiene un **catálogo** de modelos en la BD (`modelos_ml`) con sus métricas, y (2) **consume las inferencias** del ML por HTTP a través del *ml-gateway*.

Las 3 "capas" de modelos:

| Capa | Dónde | Qué es |
|---|---|---|
| Archivos `.joblib` | `predictmaint-ml/artifacts/*.joblib` | Modelos entrenados (binarios serializados). Solo Python los abre. |
| Catálogo `modelos_ml` | Tabla PostgreSQL | Metadatos: nombre, etapa, accuracy, AUC/F1, matriz de confusión, `esDefault`. |
| Resultados por orden | `prediccion_fallo` / `clasificaciones_fallo` | La inferencia concreta de cada modelo por cada análisis. |

---

# PARTE A — Cómo el backend lee/usa los modelos

## A.1 Carga real de los modelos (la hace Python)

`predictmaint-ml/models.py` → `ModelStore.load()` (se ejecuta al arrancar FastAPI):

```python
self.scaler = joblib.load(path / "scaler.joblib")
for name in S1_MODELS:          # regresion_logistica, random_forest, xgboost
    self.s1_models[name] = joblib.load(path / f"{name}.joblib")
for name in S2_MODELS:          # decision_tree, lightgbm, svm
    self.s2_models[name] = joblib.load(path / f"{name}.joblib")
# además carga artifacts/metrics.json en self.metrics
```
`GET /health` devuelve `modelosCargados: N`. El backend **nunca** toca estos archivos.

## A.2 El backend sincroniza las MÉTRICAS al catálogo (al arrancar)

`predictmaint-api/src/ml-models/ml-metrics-bootstrap.service.ts` (`OnApplicationBootstrap`):

```
API arranca
 → MlModelsService.syncMetricsFromArtifacts()
 → ml-metrics-sync.ts: loadMetricsFile()         # lee artifacts/metrics.json (¡el JSON, no el .joblib!)
        ruta configurable: ML_METRICS_PATH (default ../predictmaint-ml/artifacts/metrics.json)
 → syncMetricsToCatalog(): por cada modelo del JSON
        slug → nombre   (modelo-ml.util.ts: "xgboost" → "XGBoost")
        UPDATE modelos_ml SET accuracy, rocAuc, f1Score, tn/fp/fn/tp WHERE nombre + etapa
```

## A.3 En el pipeline: vincular cada inferencia con su fila de `modelos_ml`

`sensor-readings.service.ts` (S-1; S-2 es análogo):

```ts
const r = await mlGateway.predict(features);     // POST {ML}/predict
for (const m of r.modelos) {
  const idModelo = await resolveModeloId(m.modelo, 'S1');   // busca por nombre en modelos_ml
  await mlModelsService.applyRuntimeS1Metrics(idModelo, m); // refresca métricas "en caliente"
  await prediccionModel.create({ idAnalisis, idModelo, prediccion: m.prediccion, esLider: m.esLider, ... });
}
```

`resolveModeloId()` (`src/common/utils/modelo-ml.util.ts`) es lo que "lee el modelo del catálogo":
```ts
const row = await ModeloMl.findOne({ where: isS1 ? { nombre, esPrediccion:true }
                                                  : { nombre, esClasificacion:true } });
if (row) return row.idModelo;
// si no lo encuentra → usa el modelo esDefault de esa etapa (fallback)
```

## A.4 Endpoints

**Catálogo de modelos** — `src/ml-models/ml-models.controller.ts` (base `/ml-models`):

| Método | Endpoint | Acción |
|---|---|---|
| `GET` | `/ml-models` | Lista modelos del catálogo. Filtro `?etapa=S1` / `?etapa=S2`. |
| `PATCH` | `/ml-models/:id/activate` | Marca ese modelo como `esDefault` de su etapa (apaga el resto). |

`activate()`:
```ts
await this.modeloModel.update({ esDefault:false }, { where: filterEtapa }); // apaga la etapa
await modelo.update({ esDefault:true });                                    // enciende el elegido
```

**Inferencias por orden** — `src/predictions/predictions.controller.ts` (base `/predictions`):

| Método | Endpoint | Acción |
|---|---|---|
| `GET` | `/predictions/binary/:orderId` | Predicciones S-1 guardadas (3 modelos + líder + ensemble). |
| `GET` | `/predictions/multiclass/:orderId` | Clasificación S-2 guardada (3 modelos + tipo + agreement). |
| `POST` | `/predictions/run/:orderId` | Re-ejecuta inferencia (`{etapa:S1\|S2}`): borra previas, vuelve a llamar al ML, re-graba. |

**Gateway** — `src/ml-gateway/ml-gateway.service.ts`: único que llama a Python (`predict`/`classify`/`rag`) con `X-API-Key` hacia `ML_SERVICE_URL`.

## A.5 Modelo de datos del catálogo (`modelos_ml`)

`src/database/models/modelo-ml.model.ts`. Campos clave:
`nombre`, `esPrediccion`(S1) / `esClasificacion`(S2), `accuracy`, `rocAuc`, `precisionScore`, `recallScore`, `f1Score`, `f1Weighted`, `tn/fp/fn/tp`, `umbral`, **`esDefault`** (cuál es el "activo"/líder por defecto de su etapa).

---

# PARTE B — `train.py`: en qué se basa, algoritmos y métricas

**Archivo:** `predictmaint-ml/train.py`. Es un **script offline** que se corre **una sola vez** (`python train.py`). FastAPI luego solo **carga** los `.joblib` (no reentrena).

## B.1 ¿En qué se basa? El dataset AI4I 2020

`ai4i2020.csv` (~10 000 filas). Columnas:
- **Entradas (sensores):** `Type` (L/M/H), `Air temperature [K]`, `Process temperature [K]`, `Rotational speed [rpm]`, `Torque [Nm]`, `Tool wear [min]`.
- **Etiqueta binaria (S-1):** `Machine failure` (0/1).
- **Etiquetas one-hot de tipo (S-2):** `TWF`, `HDF`, `PWF`, `OSF`, `RNF`.

### Feature engineering (`features.py`)
- `Type` se codifica: **L→0, M→1, H→2**.
- Se añade una **feature derivada**: `Power = Torque × rpm × 2π / 60` (potencia en W).
- Vector final de **7 features** (`FEATURE_COLUMNS`).
- Etiqueta S-2 (`extract_fault_labels`): toma la columna one-hot activa; si `Machine failure==0` → `"NONE"`.

## B.2 Preparación de datos (en `train()`)

```python
X = df[FEATURE_COLUMNS].values
y_binary = df["Machine failure"]          # objetivo S-1
y_fault  = extract_fault_labels(df)       # objetivo S-2 (HDF/PWF/.../NONE)

# Split 80/20 ESTRATIFICADO por la etiqueta binaria
X_train, X_test, y_train, y_test, y_fault_train, y_fault_test = train_test_split(
    X, y_binary, y_fault, test_size=0.2, stratify=y_binary, random_state=42)

# Escalado: StandardScaler ajustado SOLO con train, aplicado a test
scaler = StandardScaler()
X_train_scaled = scaler.fit_transform(X_train)
X_test_scaled  = scaler.transform(X_test)
joblib.dump(scaler, "scaler.joblib")      # el scaler también se serializa
```
- **`random_state=42`** → entrenamiento **reproducible**.
- **Estratificado** → mantiene la proporción de fallas (dataset desbalanceado).
- El mismo `scaler` se guarda para aplicar **idéntica** transformación en inferencia.

## B.3 S-1 — Modelos binarios (¿FALLA / SIN_FALLA?)

Se entrenan con **todo** el set escalado:

```python
s1_specs = {
  "regresion_logistica": LogisticRegression(max_iter=1000, random_state=42),
  "random_forest":       RandomForestClassifier(n_estimators=200, random_state=42),
  "xgboost":             XGBClassifier(n_estimators=200, max_depth=6,
                                       learning_rate=0.1, eval_metric="logloss", random_state=42),
}
for name, model in s1_specs.items():
    model.fit(X_train_scaled, y_train)
    y_pred = model.predict(X_test_scaled)
    y_prob = model.predict_proba(X_test_scaled)[:, 1]   # probabilidad de FALLA
    s1_metrics[name] = _binary_metrics(y_test, y_pred, y_prob)
    joblib.dump(model, f"{name}.joblib")
```

## B.4 S-2 — Modelos multiclase (¿qué tipo de falla?)

**Solo se entrenan con las filas que SÍ tuvieron falla** (se filtra `"NONE"`):

```python
fault_train_mask = y_fault_train != "NONE"
X_fault_train = X_train_scaled[fault_train_mask]
y_fault_train_filtered = y_fault_train[fault_train_mask]

s2_specs = {
  "decision_tree": DecisionTreeClassifier(max_depth=12, random_state=42),
  "lightgbm":      LGBMClassifier(n_estimators=200, max_depth=8, learning_rate=0.1, random_state=42),
  "svm":           SVC(kernel="rbf", probability=True, random_state=42),
}
for name, model in s2_specs.items():
    model.fit(X_fault_train, y_fault_train_filtered)
    s2_metrics[name] = _multiclass_metrics(y_fault_test_filtered, model.predict(X_fault_test))
    joblib.dump(model, f"{name}.joblib")
```
> ¿Por qué solo fallas en S-2? Porque S-2 solo se ejecuta **después** de que S-1 confirmó falla; clasificar "no-fallas" no aporta.

## B.5 Las MÉTRICAS — cómo las calcula y maneja

### S-1 (binario) — `_binary_metrics()`
Usa `sklearn.metrics`:
```python
tn, fp, fn, tp = confusion_matrix(y_true, y_pred, labels=[0,1]).ravel()
return {
  "accuracy":  accuracy_score(...) * 100,    # %
  "rocAuc":    roc_auc_score(y_true, y_prob),# 0–1 (usa la probabilidad)
  "precision": precision_score(...) * 100,
  "recall":    recall_score(...) * 100,
  "f1Score":   f1_score(...) * 100,
  "tn": tn, "fp": fp, "fn": fn, "tp": tp,    # matriz de confusión
}
```
- **accuracy:** % de aciertos. **precision:** de las que predijo falla, cuántas lo eran. **recall:** de las fallas reales, cuántas detectó. **F1:** balance precision/recall. **ROC-AUC:** capacidad de separar clases (1 = perfecto).
- **TN/FP/FN/TP:** matriz de confusión (clave en mantenimiento: un **FN** = falla no detectada, lo más costoso).

### S-2 (multiclase) — `_multiclass_metrics()`
```python
cm = confusion_matrix(y_true, y_pred, labels=FAULT_TYPES)   # 5 clases
return {
  "accuracy":   accuracy_score(...) * 100,
  "f1Macro":    f1_score(..., average="macro"),     # promedio simple por clase (penaliza clases raras)
  "f1Weighted": f1_score(..., average="weighted"),  # promedio ponderado por soporte
  "tp": trace(cm), "fn": cm.sum()-trace(cm), "fp": 0, "tn": 0,
}
```
- **F1-macro** es la métrica principal de S-2 (justo con clases desbalanceadas como RNF).
- Además imprime un `classification_report` de LightGBM (precision/recall/F1 por cada tipo).

### Dónde quedan las métricas → `metrics.json`
```python
all_metrics = {"s1": s1_metrics, "s2": s2_metrics}
json.dump(all_metrics, open(artifacts_path/"metrics.json", "w"), indent=2)
```
Estructura resultante:
```json
{
  "s1": { "xgboost": {"accuracy":98.6,"rocAuc":0.981,"precision":...,"tn":...}, "random_forest":{...}, "regresion_logistica":{...} },
  "s2": { "lightgbm": {"accuracy":92.6,"f1Macro":0.735,...}, "decision_tree":{...}, "svm":{...} }
}
```

## B.6 ¿Cómo "viajan" esas métricas a la BD? (dos caminos)

1. **Al final de `train.py`** → `_sync_metrics_to_api()` ejecuta un script Node:
   `predictmaint-api/scripts/sync-ml-metrics.js` con `ML_METRICS_PATH=artifacts/metrics.json`
   → vuelca `metrics.json` a la tabla `modelos_ml`.
2. **Al arrancar el API** → `MlMetricsBootstrapService` hace lo mismo automáticamente (Parte A.2).
3. **En caliente** → durante cada inferencia, `applyRuntimeS1Metrics/S2` actualizan métricas con lo que reporta el ML.

```
train.py → metrics.json ──┬─(node sync-ml-metrics.js)──► modelos_ml
                          └─(API bootstrap lee el JSON)─► modelos_ml ──► GET /ml-models ──► Settings (Web)
```

## B.7 Artefactos que produce `train.py`
```
artifacts/
├── scaler.joblib                # StandardScaler (¡imprescindible para inferir igual!)
├── regresion_logistica.joblib   # S-1
├── random_forest.joblib         # S-1
├── xgboost.joblib               # S-1 (líder por defecto)
├── decision_tree.joblib         # S-2
├── lightgbm.joblib              # S-2 (líder por defecto)
├── svm.joblib                   # S-2
└── metrics.json                 # todas las métricas de evaluación
```

---

## Resumen para exponer

- **Base de `train.py`:** dataset **AI4I 2020**; 7 features (incluida `Power` derivada); split 80/20 estratificado con `random_state=42`; `StandardScaler` guardado.
- **S-1 (binario):** Regresión Logística, Random Forest, **XGBoost** (líder). Métricas: accuracy, ROC-AUC, precision, recall, F1, matriz TN/FP/FN/TP.
- **S-2 (multiclase, solo fallas):** Decision Tree, **LightGBM** (líder), SVM. Métricas: accuracy, **F1-macro**, F1-weighted + classification_report.
- **Manejo de métricas:** se guardan en `metrics.json` y se sincronizan a la tabla `modelos_ml` (al entrenar vía Node, y al arrancar el API).
- **El backend NO entrena ni abre `.joblib`:** lee el catálogo (`/ml-models`), traduce nombre→`idModelo` (`resolveModeloId`) y guarda las inferencias (`prediccion_fallo`/`clasificaciones_fallo`). El **gateway** es el único que llama al ML.

### Archivos clave
- Entrenamiento/métricas: `predictmaint-ml/train.py`, `features.py`, `models.py`
- Sync a BD: `predictmaint-api/scripts/sync-ml-metrics.js`, `src/ml-models/ml-metrics-sync.ts`, `ml-metrics-bootstrap.service.ts`
- Catálogo/endpoints: `src/ml-models/ml-models.controller.ts`, `src/common/utils/modelo-ml.util.ts`, `src/database/models/modelo-ml.model.ts`
- Inferencias: `src/predictions/predictions.controller.ts`, `src/ml-gateway/ml-gateway.service.ts`
</content>
