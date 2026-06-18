"""
Simulador por etapas: en cada etapa una máquina tendrá fallo al final;
el resto del tiempo todas las máquinas (incluida esa) reciben lecturas normales.
La siguiente etapa elige otra máquina al azar, excluyendo la última con fallo.
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

API_URL = "http://localhost:3001/sensor-readings"
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


def load_pools(csv_path: Path) -> tuple[list[dict], list[dict]]:
    trigger_pool: list[dict] = []
    normal_pool: list[dict] = []
    with csv_path.open(newline="", encoding="utf-8") as f:
        for row in csv.DictReader(f):
            payload = row_to_payload(row)
            if triggers_rule(
                payload["airTemperature"],
                payload["processTemperature"],
                payload["rotationalSpeed"],
                payload["torque"],
                payload["toolWear"],
            ):
                trigger_pool.append(payload)
            else:
                normal_pool.append(payload)
    return trigger_pool, normal_pool


def pool_for_tipo(pool: list[dict], tipo: str) -> list[dict]:
    filtered = [r for r in pool if r["tipo"] == tipo]
    return filtered if filtered else pool


def post_reading(payload: dict, api_url: str) -> dict:
    req = urllib.request.Request(
        api_url,
        data=json.dumps(payload).encode(),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=60) as resp:
        return json.loads(resp.read())


def pick_fault_machine(excluded: str | None, rng: random.Random) -> str:
    eligible = [m for m in MACHINE_IDS if m != excluded]
    if not eligible:
        eligible = list(MACHINE_IDS)
    return rng.choice(eligible)


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


def run_stage(
    stage: int,
    total_stages: int,
    fault_machine: str,
    normal_pool: list[dict],
    trigger_pool: list[dict],
    args: argparse.Namespace,
    rng: random.Random,
    tick_start: int,
) -> tuple[int, bool]:
    tipo = MACHINE_TYPES.get(fault_machine, "M")
    normals_tipo = pool_for_tipo(normal_pool, tipo)
    triggers_tipo = pool_for_tipo(trigger_pool, tipo)

    normals_before = rng.randint(args.min_normal, args.max_normal)
    print(
        f"\n{'=' * 60}\n"
        f"ETAPA {stage}/{total_stages} · fallo programado en {fault_machine} (tipo {tipo})\n"
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
            return tick, False
        sleep_between(args.min_delay, args.max_delay, rng)

    tick += 1
    fault_row = rng.choice(triggers_tipo)
    if send_reading(tick, stage, total_stages, fault_machine, fault_row, args.api_url, "FALLO") is None:
        return tick, False

    print(f"--- Etapa {stage} finalizada · fallo registrado en {fault_machine} ---")
    return tick, True


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
        "--min-delay",
        type=float,
        default=25.0,
        help="Segundos mínimos entre envíos",
    )
    parser.add_argument(
        "--max-delay",
        type=float,
        default=60.0,
        help="Segundos máximos entre envíos",
    )
    parser.add_argument("--seed", type=int, default=None, help="Semilla para reproducir secuencia")
    parser.add_argument("--api-url", type=str, default=API_URL, help="URL del endpoint sensor-readings")
    args = parser.parse_args()

    if args.min_normal < 0 or args.max_normal < args.min_normal:
        raise SystemExit("--min-normal debe ser >= 0 y --max-normal >= --min-normal")
    if args.stages < 1:
        raise SystemExit("--stages debe ser >= 1")

    rng = random.Random(args.seed)

    trigger_pool, normal_pool = load_pools(CSV_PATH)
    if not trigger_pool:
        raise SystemExit("No hay filas en el CSV que disparen reglas RN-0x")
    if not normal_pool:
        raise SystemExit("No hay filas normales en el CSV")

    print(
        f"Modo ETAPAS · {args.stages} etapa(s) · máquinas {', '.join(MACHINE_IDS)}\n"
        f"Pool: {len(trigger_pool)} fallo · {len(normal_pool)} normal · "
        f"delay {args.min_delay}-{args.max_delay}s · API {args.api_url}"
    )

    last_fault: str | None = None
    tick = 0

    for stage in range(1, args.stages + 1):
        fault_machine = pick_fault_machine(last_fault, rng)
        tick, ok = run_stage(
            stage,
            args.stages,
            fault_machine,
            normal_pool,
            trigger_pool,
            args,
            rng,
            tick,
        )
        if not ok:
            break

        last_fault = fault_machine
        if stage < args.stages:
            sleep_between(args.min_delay, args.max_delay, rng)

    print(f"\nSimulación completada · {args.stages} etapa(s) · {tick} lecturas enviadas")


if __name__ == "__main__":
    main()
