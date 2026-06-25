"""
Simulador por etapas: en cada etapa una máquina distinta tendrá un fallo confirmado
(S-1 + tipo de fallo); el resto del tiempo todas las máquinas reciben lecturas normales.
Excluye la última máquina con fallo y las que ya tienen pipeline activo.
"""

from __future__ import annotations

import argparse
import csv
import json
import math
import random
import time
import urllib.error
import urllib.request
from datetime import datetime, timezone
from pathlib import Path
from typing import Literal
from urllib.parse import urlparse

FaultOutcome = Literal["confirmed", "cooldown", "pipeline", "failed", "error"]

API_URL = "http://localhost:3001/sensor-readings"
DEMO_EMAIL = "operador@planta.pe"
DEMO_PASSWORD = "password123"
CSV_PATH = Path(__file__).resolve().parent.parent / "ai4i2020.csv"
MACHINE_IDS = ["M-001", "M-002", "M-003", "M-004", "M-005"]
MACHINE_TYPES = {
    "M-001": "H",
    "M-002": "M",
    "M-003": "L",
    "M-004": "H",
    "M-005": "M",
}


def triggers_rule(air, proc, rpm, torque, wear):
    diff = proc - air
    power = torque * rpm * 2 * math.pi / 60
    if diff > 8.6 or rpm < 1380:
        return True
    if power < 3500 or power > 9000:
        return True
    if wear >= 200:
        return True
    if torque * wear > 5000:
        return True
    return False


def row_to_payload(row: dict) -> dict:
    return {
        "tipo": row["Type"].strip(),
        "airTemperature": float(row["Air temperature [K]"]),
        "processTemperature": float(row["Process temperature [K]"]),
        "rotationalSpeed": int(float(row["Rotational speed [rpm]"])),
        "torque": float(row["Torque [Nm]"]),
        "toolWear": int(float(row["Tool wear [min]"])),
    }


def load_pools(csv_path: Path) -> tuple[list[dict], list[dict], list[dict]]:
    trigger_pool: list[dict] = []
    failure_trigger_pool: list[dict] = []
    normal_pool: list[dict] = []
    with csv_path.open(newline="", encoding="utf-8") as f:
        for row in csv.DictReader(f):
            payload = row_to_payload(row)
            is_failure = row.get("Machine failure", "0").strip() in ("1", "1.0")
            if triggers_rule(
                payload["airTemperature"],
                payload["processTemperature"],
                payload["rotationalSpeed"],
                payload["torque"],
                payload["toolWear"],
            ):
                trigger_pool.append(payload)
                if is_failure:
                    failure_trigger_pool.append(payload)
            else:
                normal_pool.append(payload)
    return trigger_pool, failure_trigger_pool, normal_pool


def pool_for_tipo(pool: list[dict], tipo: str) -> list[dict]:
    filtered = [r for r in pool if r["tipo"] == tipo]
    return filtered if filtered else pool


def api_base_from_url(url: str) -> str:
    parsed = urlparse(url)
    return f"{parsed.scheme}://{parsed.netloc}"


def http_json(
    url: str,
    *,
    method: str = "GET",
    payload: dict | None = None,
    token: str | None = None,
    timeout: float = 30,
) -> dict | list:
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    data = json.dumps(payload).encode() if payload is not None else None
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return json.loads(resp.read())


def login_demo(api_base: str, email: str, password: str) -> str | None:
    try:
        body = http_json(
            f"{api_base}/auth/login",
            method="POST",
            payload={"email": email, "password": password},
        )
        return body.get("accessToken")
    except (urllib.error.URLError, json.JSONDecodeError, AttributeError):
        return None


def fetch_blocked_machines(api_base: str, token: str | None) -> set[str]:
    if not token:
        return set()
    try:
        body = http_json(f"{api_base}/orders?limit=100", token=token)
        items = body.get("items", []) if isinstance(body, dict) else body
        blocked: set[str] = set()
        for order in items:
            if order.get("estado") != "finalizado":
                machine_id = order.get("maquinaId")
                if machine_id:
                    blocked.add(machine_id)
        return blocked
    except (urllib.error.URLError, json.JSONDecodeError, TypeError):
        return set()


def post_reading(payload: dict, api_url: str) -> dict:
    req = urllib.request.Request(
        api_url,
        data=json.dumps(payload).encode(),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=60) as resp:
        return json.loads(resp.read())


def pick_fault_candidates(
    excluded: str | None,
    blocked: set[str],
    rng: random.Random,
) -> list[str]:
    eligible = [m for m in MACHINE_IDS if m != excluded and m not in blocked]
    rng.shuffle(eligible)
    return eligible


def is_confirmed_fault(result: dict) -> bool:
    if result.get("skipped"):
        return False
    order = result.get("order") or {}
    return bool(order.get("tipoFallo"))


def sleep_between(min_delay: float, max_delay: float, rng: random.Random) -> None:
    time.sleep(rng.uniform(min_delay, max_delay))


def log_reading(
    tick: int,
    stage: int,
    total_stages: int,
    maquina_id: str,
    mode: str,
    result: dict,
) -> None:
    skipped = result.get("skipped")
    cooldown = result.get("cooldownMinutosRestantes")
    order = result.get("order") or {}
    alert = result.get("alert") or {}

    prefix = f"[E{stage}/{total_stages} · #{tick}] {maquina_id} {mode}"
    if skipped:
        extra = f" cooldown={cooldown}min" if cooldown else ""
        print(f"{prefix} → omitido ({skipped}{extra})")
        return

    if mode == "FALLO":
        print(
            f"{prefix} → orden={order.get('id', '—')} alerta={alert.get('id', '—')} "
            f"nivel={order.get('nivelRiesgo', '—')} fallo={order.get('tipoFallo', '—')} "
            f"tecnico={order.get('tecnicoId', '—')}"
        )
    else:
        print(f"{prefix} → lectura normal OK")


def send_reading(
    tick: int,
    stage: int,
    total_stages: int,
    maquina_id: str,
    row: dict,
    api_url: str,
    mode: str,
) -> dict | None:
    payload = {
        "maquinaId": maquina_id,
        **row,
        "capturadoEn": datetime.now(timezone.utc).isoformat(),
    }
    try:
        result = post_reading(payload, api_url)
    except urllib.error.URLError as exc:
        print(f"[E{stage}/{total_stages} · #{tick}] {maquina_id} error de conexión: {exc}")
        return None

    log_reading(tick, stage, total_stages, maquina_id, mode, result)
    return result


def send_fault_once(
    tick: int,
    stage: int,
    total_stages: int,
    fault_machine: str,
    failure_triggers: list[dict],
    fallback_triggers: list[dict],
    api_url: str,
    rng: random.Random,
) -> tuple[int, dict | None, FaultOutcome]:
    candidates = failure_triggers or fallback_triggers
    if not candidates:
        print(f"[E{stage}/{total_stages}] Sin filas de fallo para {fault_machine}")
        return tick, None, "failed"

    row = rng.choice(candidates)
    tick += 1
    result = send_reading(
        tick, stage, total_stages, fault_machine, row, api_url, "FALLO"
    )
    if result is None:
        return tick, None, "error"
    if is_confirmed_fault(result):
        return tick, result, "confirmed"

    skipped = result.get("skipped")
    if skipped == "pipeline_activo":
        return tick, result, "pipeline"
    if skipped == "cooldown":
        cooldown = result.get("cooldownMinutosRestantes")
        extra = f" ({cooldown} min restantes)" if cooldown else ""
        print(f"    ↳ {fault_machine} en cooldown{extra}")
        return tick, result, "cooldown"

    print(f"    ↳ {fault_machine}: regla disparada pero S-1 no confirmó falla")
    return tick, result, "failed"


def run_stage(
    stage: int,
    total_stages: int,
    fault_candidates: list[str],
    normal_pool: list[dict],
    trigger_pool: list[dict],
    failure_trigger_pool: list[dict],
    args: argparse.Namespace,
    rng: random.Random,
    tick_start: int,
    blocked_pipeline: set[str],
    blocked_cooldown: set[str],
) -> tuple[int, FaultOutcome, str | None]:
    normals_before = rng.randint(args.min_normal, args.max_normal)
    print(
        f"\n{'=' * 60}\n"
        f"ETAPA {stage}/{total_stages} · 1 fallo confirmado al cierre\n"
        f"  Candidatas: {', '.join(fault_candidates)}\n"
        f"  {normals_before} lecturas normales en la flota antes del evento de fallo\n"
        f"{'=' * 60}"
    )

    tick = tick_start

    for _ in range(normals_before):
        machine = rng.choice(MACHINE_IDS)
        m_tipo = MACHINE_TYPES.get(machine, "M")
        row = rng.choice(pool_for_tipo(normal_pool, m_tipo))
        tick += 1
        if send_reading(tick, stage, total_stages, machine, row, args.api_url, "normal") is None:
            return tick, "error", None
        sleep_between(args.min_delay, args.max_delay, rng)

    for idx, fault_machine in enumerate(fault_candidates):
        if idx > 0:
            print(f"  → siguiente candidata para fallo: {fault_machine}")

        tipo = MACHINE_TYPES.get(fault_machine, "M")
        triggers_tipo = pool_for_tipo(trigger_pool, tipo)
        failure_triggers_tipo = pool_for_tipo(failure_trigger_pool, tipo)

        tick, _, outcome = send_fault_once(
            tick,
            stage,
            total_stages,
            fault_machine,
            failure_triggers_tipo,
            triggers_tipo,
            args.api_url,
            rng,
        )
        if outcome == "confirmed":
            print(f"--- Etapa {stage} finalizada · fallo confirmado en {fault_machine} ---")
            return tick, "confirmed", fault_machine
        if outcome == "error":
            return tick, "error", None
        if outcome == "pipeline":
            blocked_pipeline.add(fault_machine)
            print(f"  {fault_machine} con pipeline activo; probando otra candidata…")
            continue
        if outcome in ("cooldown", "failed"):
            blocked_cooldown.add(fault_machine)
            if outcome == "cooldown":
                print(f"  {fault_machine} no disponible por cooldown; probando otra candidata…")
            else:
                print(f"  {fault_machine} descartada; probando otra candidata…")
            continue

    print(f"--- Etapa {stage} fallida · ninguna candidata confirmó fallo ---")
    return tick, "failed", None


def main():
    parser = argparse.ArgumentParser(
        description="Simulador por etapas: una máquina con fallo por etapa, resto lecturas normales",
    )
    parser.add_argument(
        "--stages",
        "--etapas",
        type=int,
        default=len(MACHINE_IDS),
        dest="stages",
        help="Cantidad de etapas (una máquina con fallo por etapa)",
    )
    parser.add_argument(
        "--min-normal",
        type=int,
        default=4,
        help="Mínimo de lecturas normales en la flota antes del fallo en cada etapa",
    )
    parser.add_argument(
        "--max-normal",
        type=int,
        default=10,
        help="Máximo de lecturas normales en la flota antes del fallo en cada etapa",
    )
    parser.add_argument(
        "--initial-delay",
        type=float,
        default=3.0,
        help="Segundos de espera antes del primer envío (batch inicial)",
    )
    parser.add_argument(
        "--min-delay",
        type=float,
        default=1.5,
        help="Segundos mínimos entre envíos",
    )
    parser.add_argument(
        "--max-delay",
        type=float,
        default=3.0,
        help="Segundos máximos entre envíos",
    )
    parser.add_argument("--seed", type=int, default=None, help="Semilla para reproducir secuencia")
    parser.add_argument(
        "--fault-retries",
        type=int,
        default=8,
        help="Máximo de máquinas candidatas a probar por etapa hasta confirmar fallo",
    )
    parser.add_argument("--api-url", type=str, default=API_URL, help="URL del endpoint sensor-readings")
    parser.add_argument("--demo-email", type=str, default=DEMO_EMAIL, help="Usuario demo para consultar órdenes activas")
    parser.add_argument(
        "--demo-password",
        type=str,
        default=DEMO_PASSWORD,
        help="Contraseña demo para consultar órdenes activas",
    )
    args = parser.parse_args()

    if args.min_normal < 0 or args.max_normal < args.min_normal:
        raise SystemExit("--min-normal debe ser >= 0 y --max-normal >= --min-normal")
    if args.stages < 1:
        raise SystemExit("--stages debe ser >= 1")
    if args.fault_retries < 1:
        raise SystemExit("--fault-retries debe ser >= 1")
    if args.stages > len(MACHINE_IDS):
        raise SystemExit(
            f"--stages no puede superar {len(MACHINE_IDS)} "
            "(una máquina distinta con pipeline libre por etapa)"
        )

    rng = random.Random(args.seed)

    trigger_pool, failure_trigger_pool, normal_pool = load_pools(CSV_PATH)
    if not trigger_pool:
        raise SystemExit("No hay filas en el CSV que disparen reglas RN-0x")
    if not normal_pool:
        raise SystemExit("No hay filas normales en el CSV")

    print(
        f"Modo ETAPAS · {args.stages} etapa(s) · máquinas {', '.join(MACHINE_IDS)}\n"
        f"Pool: {len(trigger_pool)} trigger · {len(failure_trigger_pool)} fallo real · "
        f"{len(normal_pool)} normal · batch inicial {args.initial_delay}s · "
        f"frecuencia {args.min_delay}-{args.max_delay}s · "
        f"reintentos candidatas {args.fault_retries} · API {args.api_url}"
    )

    if args.initial_delay > 0:
        print(f"\nEsperando batch inicial ({args.initial_delay:.0f}s) antes del primer envío…")
        time.sleep(args.initial_delay)

    last_fault: str | None = None
    blocked_pipeline: set[str] = set()
    blocked_cooldown: set[str] = set()
    tick = 0
    stages_ok = 0
    api_base = api_base_from_url(args.api_url)
    token = login_demo(api_base, args.demo_email, args.demo_password)
    if token:
        pre_blocked = fetch_blocked_machines(api_base, token)
        if pre_blocked:
            blocked_pipeline |= pre_blocked
            print(f"Máquinas con pipeline activo (API): {', '.join(sorted(pre_blocked))}")
    else:
        print("Aviso: sin token demo; solo se excluyen pipelines de esta ejecución")

    for stage in range(1, args.stages + 1):
        blocked = blocked_pipeline | blocked_cooldown | fetch_blocked_machines(api_base, token)
        fault_candidates = pick_fault_candidates(last_fault, blocked, rng)
        fault_candidates = fault_candidates[: args.fault_retries]
        if not fault_candidates:
            print(
                f"\nNo hay máquinas disponibles para etapa {stage}: "
                f"pipeline activo en {', '.join(sorted(blocked)) or '—'}"
            )
            break

        tick, outcome, fault_machine = run_stage(
            stage,
            args.stages,
            fault_candidates,
            normal_pool,
            trigger_pool,
            failure_trigger_pool,
            args,
            rng,
            tick,
            blocked_pipeline,
            blocked_cooldown,
        )
        if outcome != "confirmed" or not fault_machine:
            break

        stages_ok += 1
        last_fault = fault_machine
        blocked_pipeline.add(fault_machine)
        if stage < args.stages:
            sleep_between(args.min_delay, args.max_delay, rng)

    print(
        f"\nSimulación completada · {stages_ok}/{args.stages} etapa(s) con fallo confirmado · "
        f"{tick} lecturas enviadas"
    )


if __name__ == "__main__":
    main()
