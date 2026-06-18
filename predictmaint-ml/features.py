"""Feature engineering compartido por entrenamiento e inferencia."""

from __future__ import annotations

import math
from typing import Any

import numpy as np
import pandas as pd

TYPE_ENCODING: dict[str, int] = {"L": 0, "M": 1, "H": 2}

FEATURE_COLUMNS: list[str] = [
    "Type",
    "Air temperature",
    "Process temperature",
    "Rotational speed",
    "Torque",
    "Tool wear",
    "Power",
]

CSV_COLUMN_MAP: dict[str, str] = {
    "Air temperature [K]": "Air temperature",
    "Process temperature [K]": "Process temperature",
    "Rotational speed [rpm]": "Rotational speed",
    "Torque [Nm]": "Torque",
    "Tool wear [min]": "Tool wear",
}

FAULT_TYPES: list[str] = ["HDF", "PWF", "TWF", "OSF", "RNF"]


def compute_power(torque: float, rotational_speed: float) -> float:
    """Potencia derivada: torque * rpm * 2π / 60 (W)."""
    return float(torque) * float(rotational_speed) * 2 * math.pi / 60


def _normalize_reading(data: dict[str, Any]) -> dict[str, Any]:
    """Acepta camelCase (API) o nombres internos."""
    key_map = {
        "type": "type",
        "airTemperature": "air_temperature",
        "processTemperature": "process_temperature",
        "rotationalSpeed": "rotational_speed",
        "torque": "torque",
        "toolWear": "tool_wear",
    }
    normalized: dict[str, Any] = {}
    for src, dst in key_map.items():
        if src in data:
            normalized[dst] = data[src]
        elif dst in data:
            normalized[dst] = data[dst]
    return normalized


def preprocess_reading(data: dict[str, Any]) -> np.ndarray:
    """Convierte una lectura de sensor en vector de features sin escalar."""
    row = _normalize_reading(data)
    tipo = str(row["type"]).upper()
    if tipo not in TYPE_ENCODING:
        raise ValueError(f"Type inválido: {tipo}. Use L, M o H.")

    torque = float(row["torque"])
    rpm = float(row["rotational_speed"])
    features = [
        TYPE_ENCODING[tipo],
        float(row["air_temperature"]),
        float(row["process_temperature"]),
        rpm,
        torque,
        float(row["tool_wear"]),
        compute_power(torque, rpm),
    ]
    return np.array(features, dtype=np.float64).reshape(1, -1)


def preprocess_dataframe(df: pd.DataFrame) -> pd.DataFrame:
    """Preprocesa el dataset CSV para entrenamiento."""
    out = df.rename(columns=CSV_COLUMN_MAP).copy()
    out["Type"] = out["Type"].map(TYPE_ENCODING)
    out["Power"] = out["Torque"] * out["Rotational speed"] * 2 * math.pi / 60
    return out


def extract_fault_labels(df: pd.DataFrame) -> pd.Series:
    """Etiqueta multiclase S-2 a partir de columnas one-hot del CSV."""
    fault_cols = ["HDF", "PWF", "TWF", "OSF", "RNF"]
    labels = df[fault_cols].idxmax(axis=1)
    mask = df["Machine failure"].astype(int) == 0
    labels = labels.where(~mask, other="NONE")
    return labels
