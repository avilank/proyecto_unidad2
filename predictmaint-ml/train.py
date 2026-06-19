"""Entrenamiento offline de los 6 modelos ML y serialización a artifacts/."""

from __future__ import annotations

import json
import os
import sys
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from lightgbm import LGBMClassifier
from sklearn.ensemble import RandomForestClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import (
    accuracy_score,
    classification_report,
    confusion_matrix,
    f1_score,
    precision_score,
    recall_score,
    roc_auc_score,
)
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler
from sklearn.svm import SVC
from sklearn.tree import DecisionTreeClassifier
from xgboost import XGBClassifier

from features import FEATURE_COLUMNS, FAULT_TYPES, extract_fault_labels, preprocess_dataframe

RANDOM_STATE = 42
TEST_SIZE = 0.2


def _default_dataset_path() -> Path:
    env_path = os.getenv("DATASET_PATH")
    if env_path:
        return Path(env_path)
    return Path(__file__).resolve().parent.parent / "ai4i2020.csv"


def _default_artifacts_path() -> Path:
    env_path = os.getenv("MODEL_ARTIFACTS_PATH")
    if env_path:
        return Path(env_path)
    return Path(__file__).resolve().parent / "artifacts"


def _binary_metrics(y_true: np.ndarray, y_pred: np.ndarray, y_prob: np.ndarray) -> dict:
    tn, fp, fn, tp = confusion_matrix(y_true, y_pred, labels=[0, 1]).ravel()
    roc_auc = roc_auc_score(y_true, y_prob) if len(np.unique(y_true)) > 1 else 0.0
    return {
        "accuracy": round(accuracy_score(y_true, y_pred) * 100, 1),
        "rocAuc": round(float(roc_auc), 3),
        "precision": round(precision_score(y_true, y_pred, zero_division=0) * 100, 1),
        "recall": round(recall_score(y_true, y_pred, zero_division=0) * 100, 1),
        "f1Score": round(f1_score(y_true, y_pred, zero_division=0) * 100, 1),
        "tn": int(tn),
        "fp": int(fp),
        "fn": int(fn),
        "tp": int(tp),
    }


def _multiclass_metrics(y_true: np.ndarray, y_pred: np.ndarray) -> dict:
    labels = FAULT_TYPES
    cm = confusion_matrix(y_true, y_pred, labels=labels)
    tn = int(cm.sum() - (cm.sum(axis=0) - np.diag(cm)).sum()) if cm.size else 0
    # Para compatibilidad con contrato: agregados globales
    return {
        "accuracy": round(accuracy_score(y_true, y_pred) * 100, 1),
        "f1Macro": round(f1_score(y_true, y_pred, average="macro", zero_division=0, labels=labels), 3),
        "f1Weighted": round(
            f1_score(y_true, y_pred, average="weighted", zero_division=0, labels=labels), 3
        ),
        "tp": int(np.trace(cm)),
        "fn": int(cm.sum() - np.trace(cm)),
        "fp": 0,
        "tn": 0,
    }


def train() -> dict:
    dataset_path = _default_dataset_path()
    artifacts_path = _default_artifacts_path()
    artifacts_path.mkdir(parents=True, exist_ok=True)

    print(f"Cargando dataset: {dataset_path}")
    raw = pd.read_csv(dataset_path)
    df = preprocess_dataframe(raw)

    X = df[FEATURE_COLUMNS].values
    y_binary = df["Machine failure"].astype(int).values
    y_fault = extract_fault_labels(df).values

    X_train, X_test, y_train, y_test, y_fault_train, y_fault_test = train_test_split(
        X,
        y_binary,
        y_fault,
        test_size=TEST_SIZE,
        stratify=y_binary,
        random_state=RANDOM_STATE,
    )

    scaler = StandardScaler()
    X_train_scaled = scaler.fit_transform(X_train)
    X_test_scaled = scaler.transform(X_test)

    joblib.dump(scaler, artifacts_path / "scaler.joblib")

    s1_specs = {
        "regresion_logistica": LogisticRegression(max_iter=1000, random_state=RANDOM_STATE),
        "random_forest": RandomForestClassifier(n_estimators=200, random_state=RANDOM_STATE),
        "xgboost": XGBClassifier(
            n_estimators=200,
            max_depth=6,
            learning_rate=0.1,
            eval_metric="logloss",
            random_state=RANDOM_STATE,
        ),
    }

    s1_metrics: dict[str, dict] = {}
    print("\n=== Entrenamiento S-1 (binario) ===")
    for name, model in s1_specs.items():
        model.fit(X_train_scaled, y_train)
        y_pred = model.predict(X_test_scaled)
        y_prob = model.predict_proba(X_test_scaled)[:, 1]
        metrics = _binary_metrics(y_test, y_pred, y_prob)
        s1_metrics[name] = metrics
        joblib.dump(model, artifacts_path / f"{name}.joblib")
        print(f"  {name}: accuracy={metrics['accuracy']}% rocAuc={metrics['rocAuc']}")

    fault_train_mask = y_fault_train != "NONE"
    fault_test_mask = y_fault_test != "NONE"
    X_fault_train = X_train_scaled[fault_train_mask]
    y_fault_train_filtered = y_fault_train[fault_train_mask]
    X_fault_test = X_test_scaled[fault_test_mask]
    y_fault_test_filtered = y_fault_test[fault_test_mask]

    s2_specs = {
        "decision_tree": DecisionTreeClassifier(max_depth=12, random_state=RANDOM_STATE),
        "lightgbm": LGBMClassifier(
            n_estimators=200,
            max_depth=8,
            learning_rate=0.1,
            random_state=RANDOM_STATE,
            verbose=-1,
        ),
        "svm": SVC(kernel="rbf", probability=True, random_state=RANDOM_STATE),
    }

    s2_metrics: dict[str, dict] = {}
    print("\n=== Entrenamiento S-2 (multiclase, solo fallos) ===")
    print(f"  Muestras de entrenamiento: {len(y_fault_train_filtered)}")
    print(f"  Muestras de test: {len(y_fault_test_filtered)}")

    for name, model in s2_specs.items():
        model.fit(X_fault_train, y_fault_train_filtered)
        y_pred = model.predict(X_fault_test)
        metrics = _multiclass_metrics(y_fault_test_filtered, y_pred)
        s2_metrics[name] = metrics
        joblib.dump(model, artifacts_path / f"{name}.joblib")
        print(
            f"  {name}: accuracy={metrics['accuracy']}% "
            f"f1Macro={metrics['f1Macro']} f1Weighted={metrics['f1Weighted']}"
        )

    report_s2 = classification_report(
        y_fault_test_filtered,
        s2_specs["lightgbm"].predict(X_fault_test),
        labels=FAULT_TYPES,
        zero_division=0,
    )
    print("\nReporte LightGBM (test fallos):\n", report_s2)

    all_metrics = {"s1": s1_metrics, "s2": s2_metrics}
    metrics_path = artifacts_path / "metrics.json"
    with metrics_path.open("w", encoding="utf-8") as fh:
        json.dump(all_metrics, fh, indent=2)

    print(f"\nArtefactos guardados en: {artifacts_path}")
    return all_metrics


def _sync_metrics_to_api() -> None:
    root = Path(__file__).resolve().parent.parent
    script = root / "predictmaint-api" / "scripts" / "sync-ml-metrics.js"
    if not script.exists():
        print("Aviso: sync-ml-metrics.js no encontrado; omitiendo sync BD")
        return
    env = os.environ.copy()
    metrics_path = _default_artifacts_path() / "metrics.json"
    env["ML_METRICS_PATH"] = str(metrics_path)
    print(f"\nSincronizando métricas → modelos_ml ({metrics_path.name})…")
    import subprocess

    result = subprocess.run(
        ["node", str(script)],
        cwd=str(root / "predictmaint-api"),
        env=env,
        capture_output=True,
        text=True,
    )
    if result.stdout:
        print(result.stdout.strip())
    if result.returncode != 0:
        print(result.stderr.strip() or "Sync BD falló (¿API/Postgres disponible?)", file=sys.stderr)


if __name__ == "__main__":
    try:
        results = train()
        print("\nEntrenamiento completado.")
        print(json.dumps(results, indent=2))
        _sync_metrics_to_api()
    except Exception as exc:
        print(f"Error durante entrenamiento: {exc}", file=sys.stderr)
        sys.exit(1)
