"""Carga de artefactos joblib al arrancar la API."""

from __future__ import annotations

import json
import os
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

import joblib
from sklearn.preprocessing import StandardScaler

S1_MODELS = ("regresion_logistica", "random_forest", "xgboost")
S2_MODELS = ("decision_tree", "lightgbm", "svm")


@dataclass
class ModelStore:
    artifacts_path: Path
    scaler: StandardScaler | None = None
    s1_models: dict[str, Any] = field(default_factory=dict)
    s2_models: dict[str, Any] = field(default_factory=dict)
    metrics: dict[str, Any] = field(default_factory=dict)

    @property
    def loaded_count(self) -> int:
        return len(self.s1_models) + len(self.s2_models) + (1 if self.scaler else 0)

    def load(self) -> None:
        path = self.artifacts_path
        if not path.exists():
            raise FileNotFoundError(f"Directorio de artefactos no encontrado: {path}")

        scaler_path = path / "scaler.joblib"
        if not scaler_path.exists():
            raise FileNotFoundError(f"Scaler no encontrado: {scaler_path}")
        self.scaler = joblib.load(scaler_path)

        for name in S1_MODELS:
            model_path = path / f"{name}.joblib"
            if not model_path.exists():
                raise FileNotFoundError(f"Modelo S-1 no encontrado: {model_path}")
            self.s1_models[name] = joblib.load(model_path)

        for name in S2_MODELS:
            model_path = path / f"{name}.joblib"
            if not model_path.exists():
                raise FileNotFoundError(f"Modelo S-2 no encontrado: {model_path}")
            self.s2_models[name] = joblib.load(model_path)

        metrics_path = path / "metrics.json"
        if metrics_path.exists():
            with metrics_path.open(encoding="utf-8") as fh:
                self.metrics = json.load(fh)


def default_artifacts_path() -> Path:
    env_path = os.getenv("MODEL_ARTIFACTS_PATH")
    if env_path:
        return Path(env_path)
    return Path(__file__).resolve().parent / "artifacts"


model_store = ModelStore(artifacts_path=default_artifacts_path())
