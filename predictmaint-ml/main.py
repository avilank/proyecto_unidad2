"""API FastAPI de inferencia ML para PredictMaint."""

from __future__ import annotations

import os
from contextlib import asynccontextmanager
from typing import Any

from dotenv import load_dotenv
from fastapi import Depends, FastAPI, Header, HTTPException
from pydantic import BaseModel, Field

from features import FAULT_TYPES, preprocess_reading
from models import S1_MODELS, S2_MODELS, default_artifacts_path, model_store
from rag import generate_action_plan

load_dotenv()

API_KEY = os.getenv("API_KEY", "dev-ml-key-change-me")

RISK_THRESHOLDS = [
    ("LOW", 0.0, 0.40),
    ("MEDIUM", 0.40, 0.65),
    ("HIGH", 0.65, 0.85),
    ("CRITICAL", 0.85, 1.01),
]


class SensorReading(BaseModel):
    type: str = Field(..., description="L, M o H")
    airTemperature: float
    processTemperature: float
    rotationalSpeed: float
    torque: float
    toolWear: float


class RagRequest(BaseModel):
    tipoFallo: str
    maquinaId: str
    historial: list[Any] = Field(default_factory=list)


def verify_api_key(x_api_key: str | None = Header(default=None, alias="X-API-Key")) -> None:
    if not x_api_key or x_api_key != API_KEY:
        raise HTTPException(status_code=401, detail="API key inválida o ausente")


def _risk_level(ensemble_avg: float) -> str:
    for level, low, high in RISK_THRESHOLDS:
        if low <= ensemble_avg < high:
            return level
    return "CRITICAL"


def _agreement_label(votes: list[str]) -> str:
    if not votes:
        return "BAJO"
    winner = max(set(votes), key=votes.count)
    count = votes.count(winner)
    if count == 3:
        return "ALTO"
    if count == 2:
        return "MEDIO"
    return "BAJO"


def _scale_features(data: dict[str, Any]):
    if model_store.scaler is None:
        raise HTTPException(status_code=503, detail="Scaler no cargado")
    features = preprocess_reading(data)
    return model_store.scaler.transform(features)


@asynccontextmanager
async def lifespan(_: FastAPI):
    model_store.artifacts_path = default_artifacts_path()
    model_store.load()
    yield


app = FastAPI(
    title="predictmaint-ml",
    description="API de inferencia ML (S-1, S-2, RAG) para PredictMaint",
    version="1.0.0",
    lifespan=lifespan,
)


@app.get("/health")
def health() -> dict[str, Any]:
    return {
        "status": "ok",
        "modelosCargados": model_store.loaded_count,
    }


@app.post("/predict", dependencies=[Depends(verify_api_key)])
def predict(reading: SensorReading) -> dict[str, Any]:
    payload = reading.model_dump()
    X = _scale_features(payload)

    modelos_resp: list[dict[str, Any]] = []
    probabilities: list[float] = []

    for name in S1_MODELS:
        model = model_store.s1_models.get(name)
        metrics = model_store.metrics.get("s1", {}).get(name, {})
        if model is None:
            raise HTTPException(status_code=503, detail=f"Modelo {name} no cargado")

        prob_fail = float(model.predict_proba(X)[0][1])
        pred = "FALLA" if prob_fail >= 0.5 else "SIN_FALLA"
        probabilities.append(prob_fail)

        modelos_resp.append(
            {
                "modelo": name,
                "prediccion": pred,
                "probabilidad": round(prob_fail * 100, 1),
                "accuracy": metrics.get("accuracy", 0.0),
                "rocAuc": metrics.get("rocAuc", 0.0),
                "precision": metrics.get("precision", 0.0),
                "recall": metrics.get("recall", 0.0),
                "f1Score": metrics.get("f1Score", 0.0),
                "tn": metrics.get("tn", 0),
                "fp": metrics.get("fp", 0),
                "fn": metrics.get("fn", 0),
                "tp": metrics.get("tp", 0),
                "esLider": False,
            }
        )

    ensemble_avg = round(sum(probabilities) / len(probabilities), 3)
    consenso = "FALLA" if ensemble_avg >= 0.5 else "SIN_FALLA"
    leader_idx = max(range(len(probabilities)), key=lambda i: probabilities[i])
    for idx, item in enumerate(modelos_resp):
        item["esLider"] = idx == leader_idx

    return {
        "ensembleAvg": ensemble_avg,
        "nivelRiesgo": _risk_level(ensemble_avg),
        "consenso": consenso,
        "modelos": modelos_resp,
    }


@app.post("/classify", dependencies=[Depends(verify_api_key)])
def classify(reading: SensorReading) -> dict[str, Any]:
    payload = reading.model_dump()
    X = _scale_features(payload)

    modelos_resp: list[dict[str, Any]] = []
    votes: list[str] = []
    leader_confidence = 0.0
    leader_type = FAULT_TYPES[0]

    for name in S2_MODELS:
        model = model_store.s2_models.get(name)
        metrics = model_store.metrics.get("s2", {}).get(name, {})
        if model is None:
            raise HTTPException(status_code=503, detail=f"Modelo {name} no cargado")

        tipo_predicho = str(model.predict(X)[0])
        votes.append(tipo_predicho)
        proba = model.predict_proba(X)[0]
        classes = list(model.classes_)
        prob_map = {str(cls): float(val) for cls, val in zip(classes, proba)}
        confidence = prob_map.get(tipo_predicho, 0.0) * 100

        modelos_resp.append(
            {
                "modelo": name,
                "tipoPredicho": tipo_predicho,
                "probHdf": round(prob_map.get("HDF", 0.0) * 100, 1),
                "probPwf": round(prob_map.get("PWF", 0.0) * 100, 1),
                "probTwf": round(prob_map.get("TWF", 0.0) * 100, 1),
                "probOsf": round(prob_map.get("OSF", 0.0) * 100, 1),
                "probRnf": round(prob_map.get("RNF", 0.0) * 100, 1),
                "f1Macro": metrics.get("f1Macro", 0.0),
                "f1Weighted": metrics.get("f1Weighted", 0.0),
                "accuracy": metrics.get("accuracy", 0.0),
                "tp": metrics.get("tp", 0),
                "fn": metrics.get("fn", 0),
                "fp": metrics.get("fp", 0),
                "tn": metrics.get("tn", 0),
                "esLider": False,
                "diverge": False,
            }
        )

    agreement = _agreement_label(votes)
    consensus_type = max(set(votes), key=votes.count)
    for item in modelos_resp:
        item["diverge"] = item["tipoPredicho"] != consensus_type
        if item["modelo"] == "lightgbm":
            item["esLider"] = True
            leader_type = item["tipoPredicho"]
            leader_confidence = max(
                item["probHdf"],
                item["probPwf"],
                item["probTwf"],
                item["probOsf"],
                item["probRnf"],
            )

    return {
        "tipoPredicho": leader_type if agreement != "BAJO" else consensus_type,
        "agreement": agreement,
        "confianza": round(leader_confidence, 1),
        "modelos": modelos_resp,
    }


@app.post("/rag", dependencies=[Depends(verify_api_key)])
def rag(request: RagRequest) -> dict[str, Any]:
    try:
        return generate_action_plan(
            tipo_fallo=request.tipoFallo,
            maquina_id=request.maquinaId,
            historial=request.historial,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
