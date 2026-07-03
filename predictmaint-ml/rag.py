"""Motor RAG ligero: recupera fuentes autorizadas y genera planes S-3."""

from __future__ import annotations

import json
import logging
import os
from typing import Any

logger = logging.getLogger("uvicorn.error")


def _rag_log(message: str) -> None:
    print(f"[RAG] {message}", flush=True)
    logger.info("RAG %s", message)

DEFAULT_RAG_SOURCES: list[dict[str, str]] = [
    {
        "titulo": "Theissler et al. (2021)",
        "autor": "Theissler et al.",
        "descripcion": (
            "Revision de mantenimiento predictivo industrial con ML: monitoreo de condicion, "
            "anomalias multivariables y priorizacion de intervenciones."
        ),
        "url": "https://doi.org/10.1016/j.ress.2020.107457",
    },
    {
        "titulo": "Pashmforoush et al. (2025)",
        "autor": "Pashmforoush et al.",
        "descripcion": (
            "Buenas practicas de mantenimiento predictivo para desgaste, sobrecarga y modos de "
            "falla en equipos rotativos y de manufactura."
        ),
        "url": "https://www.sciencedirect.com/topics/engineering/predictive-maintenance",
    },
    {
        "titulo": "Cai et al. (2023)",
        "autor": "Cai et al.",
        "descripcion": (
            "Integracion de sensores industriales, diagnostico basado en datos y criterios de "
            "decision para prevenir fallas progresivas."
        ),
        "url": "https://www.mdpi.com/journal/sensors/special_issues/predictive_maintenance",
    },
    {
        "titulo": "Araujo et al. (2025)",
        "autor": "Araujo et al.",
        "descripcion": (
            "Analisis de confiabilidad y mantenimiento preventivo/correctivo para sistemas "
            "electromecanicos con enfoque en riesgo operacional."
        ),
        "url": "https://www.sciencedirect.com/journal/reliability-engineering-and-system-safety",
    },
    {
        "titulo": "Hesser & Markert (2019)",
        "autor": "Hesser & Markert",
        "descripcion": (
            "Diagnostico de condicion en maquinas herramienta: desgaste de herramienta, "
            "vibracion, husillo, parametros de corte y control de calidad."
        ),
        "url": "https://www.sciencedirect.com/topics/engineering/tool-wear",
    },
    {
        "titulo": "Jakobs et al. (2026)",
        "autor": "Jakobs et al.",
        "descripcion": (
            "Gestion de incertidumbre operacional: fallas aleatorias, inspeccion manual, "
            "aislamiento seguro y escalamiento tecnico."
        ),
        "url": "https://www.iso.org/standard/62085.html",
    },
]

FAULT_SOURCES: dict[str, list[str]] = {
    "HDF": ["Theissler et al. (2021)", "Cai et al. (2023)", "Pashmforoush et al. (2025)"],
    "PWF": ["Theissler et al. (2021)", "Araujo et al. (2025)", "Cai et al. (2023)"],
    "TWF": ["Pashmforoush et al. (2025)", "Hesser & Markert (2019)", "Cai et al. (2023)"],
    "OSF": ["Pashmforoush et al. (2025)", "Araujo et al. (2025)", "Cai et al. (2023)"],
    "RNF": ["Jakobs et al. (2026)"],
}

FAULT_PROFILES: dict[str, dict[str, Any]] = {
    "HDF": {
        "nombre": "Heat Dissipation Failure",
        "riesgo": "Sobrecalentamiento por disipacion insuficiente.",
        "tiempo_limite": "6-12 horas",
        "estandar": "PM-STD-THERM-01: parada controlada, bloqueo/etiquetado y estabilizacion termica antes de intervenir.",
        "herramientas": "termometro infrarrojo, camara termica, multimetro, kit de limpieza de ventilacion, EPP termico.",
    },
    "PWF": {
        "nombre": "Power Failure",
        "riesgo": "Potencia fuera de rango, posible falla electrica o sobreconsumo.",
        "tiempo_limite": "6-18 horas",
        "estandar": "PM-STD-ELEC-02: aislamiento electrico, verificacion de tension cero y prueba de carga controlada.",
        "herramientas": "multimetro True RMS, pinza amperimetrica, analizador de potencia, destornilladores aislados, EPP dielectrico.",
    },
    "TWF": {
        "nombre": "Tool Wear Failure",
        "riesgo": "Desgaste critico de herramienta con riesgo de mala calidad, vibracion o dano del husillo.",
        "tiempo_limite": "24-48 horas",
        "estandar": "PM-STD-TOOL-03: cambio seguro de herramienta, verificacion dimensional y registro CMMS obligatorio.",
        "herramientas": "calibrador, comparador, llave dinamometrica, kit de herramienta de corte, reloj palpador, EPP mecanico.",
    },
    "OSF": {
        "nombre": "Overstrain Failure",
        "riesgo": "Sobreesfuerzo mecanico por torque y desgaste acumulado.",
        "tiempo_limite": "6-24 horas",
        "estandar": "PM-STD-MECH-04: reduccion de carga, inspeccion de rodamientos/acoples y prueba de vibracion antes de reinicio.",
        "herramientas": "torquimetro, acelerometro o vibrometro, estetoscopio mecanico, extractor de rodamientos, lubricante industrial.",
    },
    "RNF": {
        "nombre": "Random Failure",
        "riesgo": "Falla no deterministica; requiere diagnostico humano antes de liberar la maquina.",
        "tiempo_limite": "6 horas",
        "estandar": "PM-STD-SAFE-05: aislamiento preventivo, inspeccion de especialista y autorizacion de supervisor.",
        "herramientas": "checklist de inspeccion, multimetro, camara termica, vibrometro, tablet CMMS, EPP completo.",
    },
}

ESCALATION_BY_PRIORITY: dict[str, tuple[int, int]] = {
    "CRITICO": (6, 12),
    "MEDIO": (12, 24),
    "BAJO": (24, 48),
}

"""acciones recomendadas para cada tipo de falla"""
FAULT_ACTION_PLANS: dict[str, list[dict[str, str]]] = {
    "HDF": [
        {
            "prioridad": "CRITICO",
            "titulo": "Verificación del sistema de enfriamiento",
            "detalle": (
                "Detener la máquina antes de 30 min si la diferencia térmica supera 8.6 K. "
                "Inspeccionar refrigeración, flujo de aire y estado del variador de velocidad."
            ),
        },
        {
            "prioridad": "BAJO",
            "titulo": "Calibración del variador y sensores térmicos",
            "detalle": (
                "Verificar lecturas de temperatura de proceso y ambiente. "
                "Recalibrar sensores y confirmar que la velocidad rotacional no esté por debajo de 1380 rpm."
            ),
        },
        {
            "prioridad": "MEDIO",
            "titulo": "Monitoreo post-intervención",
            "detalle": (
                "Registrar diferencia térmica y rpm tras la intervención. "
                "Programar revisión preventiva del sistema térmico en 48 h."
            ),
        },
    ],
    "PWF": [
        {
            "prioridad": "CRITICO",
            "titulo": "Revisión del sistema eléctrico y potencia",
            "detalle": (
                "Verificar que la potencia derivada esté entre 3500 y 9000 W. "
                "Inspeccionar conexiones eléctricas, variador y alimentación trifásica."
            ),
        },
        {
            "prioridad": "BAJO",
            "titulo": "Diagnóstico del variador de frecuencia",
            "detalle": (
                "Medir corriente y voltaje en bornes del motor. "
                "Revisar parámetros del variador y buscar picos de consumo anómalos."
            ),
        },
        {
            "prioridad": "MEDIO",
            "titulo": "Certificación eléctrica post-reparación",
            "detalle": (
                "Documentar valores de potencia y torque tras la corrección. "
                "Programar prueba de carga controlada antes de reanudar producción."
            ),
        },
    ],
    "TWF": [
        {
            "prioridad": "CRITICO",
            "titulo": "Reemplazo de herramienta y verificación de desgaste",
            "detalle": (
                "Detener operación si el desgaste supera 200 min. "
                "Reemplazar herramienta y verificar alineación del husillo."
            ),
        },
        {
            "prioridad": "BAJO",
            "titulo": "Auditoría del ciclo de herramientas",
            "detalle": (
                "Registrar tiempo de uso y condiciones de corte. "
                "Ajustar parámetros de avance y profundidad para extender vida útil."
            ),
        },
        {
            "prioridad": "MEDIO",
            "titulo": "Registro y seguimiento de desgaste",
            "detalle": (
                "Actualizar historial de cambios de herramienta en el CMMS. "
                "Programar inspección visual cada 50 min de operación."
            ),
        },
    ],
    "OSF": [
        {
            "prioridad": "CRITICO",
            "titulo": "Reducción inmediata de carga mecánica",
            "detalle": (
                "Reducir carga del eje y verificar producto torque × desgaste. "
                "Inspeccionar rodamientos y acoplamientos por señales de sobre-esfuerzo."
            ),
        },
        {
            "prioridad": "BAJO",
            "titulo": "Revisión de diseño operativo",
            "detalle": (
                "Evaluar parámetros de operación vs. capacidad nominal de la máquina. "
                "Ajustar velocidad y torque para evitar recurrencia."
            ),
        },
        {
            "prioridad": "MEDIO",
            "titulo": "Análisis de vibración y rodamientos",
            "detalle": (
                "Realizar medición de vibración en puntos críticos. "
                "Documentar hallazgos y planificar mantenimiento correctivo."
            ),
        },
    ],
}

RNF_MANUAL_INSPECTION: list[dict[str, str]] = [
    {
        "prioridad": "CRITICO",
        "titulo": "Inspección manual obligatoria",
        "detalle": (
            "- Urgencia: Critica — Fallo aleatorio (RNF) sin patron determinista; requiere validacion humana antes de liberar la maquina.\n"
            "- Tiempo limite: 6 horas, antes de reanudar cualquier ciclo productivo.\n"
            "- Estandar interno: PM-STD-SAFE-05 (aislamiento, bloqueo/etiquetado e inspeccion de especialista).\n"
            "- Herramientas: checklist de inspeccion, multimetro, camara termica, vibrometro, tablet CMMS y EPP completo.\n"
            "- Accion recomendada: Escalar a inspeccion manual con especialista externo y no autorizar reinicio hasta cierre formal.\n"
            "- Justificacion tecnica: Un RNF no puede resolverse solo con reglas automaticas; la intervencion humana evita diagnosticos errados y reduce riesgo de seguridad."
        ),
    },
]


def _env_bool(name: str, default: bool = False) -> bool:
    raw = os.getenv(name)
    if raw is None:
        return default
    return raw.strip().lower() in {"1", "true", "yes", "y", "on"}


def _source_title(source: dict[str, Any]) -> str:
    return str(source.get("titulo") or source.get("fuente") or "").strip()


def _source_fault_codes(source: dict[str, Any]) -> list[str]:
    raw = source.get("tipoFallo") or source.get("tipo_fallo") or ""
    if not raw:
        return []
    tokens = [token.strip().upper() for token in str(raw).replace("/", ",").split(",") if token.strip()]
    if "TODOS" in tokens or "ALL" in tokens:
        return ["HDF", "PWF", "TWF", "OSF"]
    return tokens


def _source_applies_to_fault(source: dict[str, Any], fault: str) -> bool:
    fault_code = fault.strip().upper()
    if not fault_code:
        return True

    explicit_codes = _source_fault_codes(source)
    if explicit_codes:
        return fault_code in explicit_codes

    title = _source_title(source)
    preferred = FAULT_SOURCES.get(fault_code, [])
    if preferred:
        return title in preferred

    return True


def _normalize_sources(fuentes: list[dict[str, Any]] | None) -> list[dict[str, str]]:
    if fuentes is not None:
        if not fuentes:
            return []

        normalized: list[dict[str, str]] = []
        for source in fuentes:
            title = _source_title(source)
            if not title:
                continue
            fallback = next((item for item in DEFAULT_RAG_SOURCES if item["titulo"] == title), {})
            normalized.append(
                {
                    "titulo": title,
                    "autor": str(source.get("autor") or source.get("descripcion") or fallback.get("autor", "")),
                    "descripcion": str(source.get("descripcion") or fallback.get("descripcion", "")),
                    "url": str(source.get("url") or fallback.get("url", "")),
                    "tipoFallo": str(source.get("tipoFallo") or source.get("tipo_fallo") or ""),
                }
            )
        return normalized

    return DEFAULT_RAG_SOURCES


def _select_sources(fault: str, fuentes: list[dict[str, Any]] | None) -> list[dict[str, str]]:
    available = _normalize_sources(fuentes)
    matched = [item for item in available if _source_applies_to_fault(item, fault)]
    if not matched:
        return []

    preferred = FAULT_SOURCES.get(fault, [])
    by_title = {item["titulo"]: item for item in matched}
    ordered = [by_title[title] for title in preferred if title in by_title]
    extras = [item for item in matched if item["titulo"] not in {source["titulo"] for source in ordered}]
    return ordered + extras


def _fallback_sources(fault: str, fuentes: list[dict[str, Any]] | None = None) -> list[str]:
    return [source["titulo"] for source in _select_sources(fault, fuentes)]


def _priority_label(prioridad: str) -> str:
    labels = {
        "CRITICO": "Critica",
        "BAJO": "Baja",
        "MEDIO": "Moderada",
        "ALTO": "Baja",
    }
    return labels.get(prioridad.upper(), prioridad)


def _tiempo_limite_por_prioridad(prioridad: str, fault: str) -> str:
    key = prioridad.upper()
    lo, hi = ESCALATION_BY_PRIORITY.get(key, (12, 24))
    if fault == "RNF":
        return "6 horas"
    if lo == hi:
        return f"{lo} horas"
    return f"{lo}-{hi} horas"


def _build_bullet_detail(
    *,
    urgencia: str,
    tiempo_limite: str,
    estandar: str,
    herramientas: str,
    accion: str,
    justificacion: str,
    escalado: bool = False,
) -> str:
    lines = [
        f"- Urgencia: {urgencia}",
        f"- Tiempo limite: {tiempo_limite}",
        f"- Estandar interno: {estandar}",
        f"- Herramientas: {herramientas}",
        f"- Accion recomendada: {accion}",
        f"- Justificacion tecnica: {justificacion}",
    ]
    if escalado:
        lines.append(
            "- Escalamiento: Existe historial de reincidencia; documentar evidencia y notificar al supervisor de mantenimiento."
        )
    return "\n".join(lines)


def _format_detail(action_detail: str, fault: str, prioridad: str, escalado: bool) -> str:
    profile = FAULT_PROFILES[fault]
    detail = action_detail.strip()
    return _build_bullet_detail(
        urgencia=f"{_priority_label(prioridad)} — {profile['riesgo']}",
        tiempo_limite=f"{_tiempo_limite_por_prioridad(prioridad, fault)} antes de que el problema escale o afecte continuidad operativa.",
        estandar=profile["estandar"],
        herramientas=profile["herramientas"],
        accion=detail,
        justificacion=(
            f"La intervencion reduce el riesgo asociado a {profile['nombre']} y evita que la condicion detectada "
            "derive en dano mayor, perdida de calidad o parada no programada."
        ),
        escalado=escalado,
    )


def _template_plan(
    fault: str,
    maquina_id: str,
    escalado: bool,
    fuentes: list[dict[str, Any]] | None = None,
) -> dict[str, Any]:
    base_plan = FAULT_ACTION_PLANS.get(fault)
    if not base_plan:
        raise ValueError(f"Tipo de fallo no soportado: {fault}")

    acciones = []
    for idx, action in enumerate(base_plan):
        detail = action["detalle"].replace("M-001", maquina_id)
        acciones.append(
            {
                "orden": idx + 1,
                "prioridad": action["prioridad"],
                "titulo": action["titulo"],
                "detalle": _format_detail(detail, fault, action["prioridad"], escalado and idx == len(base_plan) - 1),
            }
        )

    return {
        "tipoFallo": fault,
        "escalado": escalado,
        "acciones": acciones,
        "fuentes": _fallback_sources(fault, fuentes),
    }


def _llm_enabled() -> bool:
    api_key = _provider_api_key()
    return _env_bool("RAG_USE_LLM", True) and bool(api_key)


def _masked_key(api_key: str | None) -> str:
    if not api_key:
        return "missing"
    if len(api_key) <= 12:
        return "***"
    return f"{api_key[:7]}...{api_key[-4:]}"


def _provider_api_key() -> str | None:
    explicit_key = os.getenv("OPENROUTER_API_KEY") or os.getenv("OPENAI_API_KEY")
    if explicit_key:
        return explicit_key

    legacy_key = os.getenv("API_KEY")
    if legacy_key and legacy_key.startswith(("sk-or-", "sk-")):
        return legacy_key
    return None


def _reference_guide_without_titles(fault: str) -> list[dict[str, str]]:
    base_plan = FAULT_ACTION_PLANS.get(fault, RNF_MANUAL_INSPECTION)
    return [
        {
            "enfoque_tecnico": action["detalle"],
        }
        for action in base_plan
    ]


VALID_PRIORITIES = frozenset({"CRITICO", "BAJO", "MEDIO"})


def _normalize_priority(value: str) -> str:
    raw = value.strip().upper()
    aliases = {
        "CRITICA": "CRITICO",
        "CRÍTICO": "CRITICO",
        "CRÍTICA": "CRITICO",
        "ALTA": "BAJO",
        "ALTO": "BAJO",
        "BAJA": "BAJO",
        "MEDIA": "MEDIO",
    }
    return aliases.get(raw, raw)


def _extract_llm_priority(action: dict[str, Any], orden: int) -> str:
    prioridad = _normalize_priority(str(action.get("prioridad") or ""))
    if prioridad not in VALID_PRIORITIES:
        raise ValueError(
            f"El LLM no devolvio prioridad valida (CRITICO, BAJO o MEDIO) para la recomendacion RAG #{orden}"
        )
    return prioridad


def _extract_llm_title(action: dict[str, Any], fault: str, maquina_id: str, orden: int) -> str:
    titulo = str(action.get("titulo") or "").strip()
    if not titulo:
        raise ValueError(f"El LLM no devolvio titulo para la recomendacion RAG #{orden}")

    template_titles = {
        item["titulo"].strip().lower()
        for item in FAULT_ACTION_PLANS.get(fault, [])
    }
    if titulo.lower() in template_titles:
        raise ValueError(f"El LLM copio un titulo de plantilla en la recomendacion RAG #{orden}")

    return titulo[:120]


def _build_prompt(
    fault: str,
    maquina_id: str,
    escalado: bool,
    selected_sources: list[dict[str, str]],
) -> str:
    profile = FAULT_PROFILES[fault]
    return json.dumps(
        {
            "rol": "Experto en mantenimiento predictivo industrial CNC",
            "objetivo": "Generar 3 recomendaciones del RAG (S-3) personalizadas para la maquina y el tipo de fallo.",
            "instrucciones": [
                "Usa SOLO las fuentes autorizadas incluidas en contexto_fuentes.",
                "Devuelve exactamente 3 recomendaciones del RAG, ordenadas por urgencia operacional.",
                "Cada recomendacion debe incluir prioridad, titulo y detalle generados por ti.",
                "El campo prioridad debe ser exactamente uno de estos valores: CRITICO, BAJO o MEDIO.",
                "Tu debes decidir la prioridad de cada recomendacion segun el riesgo operacional, el tipo de fallo y la maquina.",
                "La recomendacion #1 debe ser la mas urgente; asigna prioridad coherente con esa urgencia.",
                "El campo titulo debe ser corto (maximo 80 caracteres), profesional y especifico para la maquina y el fallo.",
                f"Personaliza los titulos para la maquina {maquina_id} y el fallo {fault}.",
                "El titulo debe sonar como nombre de recomendacion RAG, no como texto generico ni copiado.",
                "NO copies literalmente los titulos de guia_tecnica_referencia.",
                "El campo detalle debe ser texto multilinea con guiones, NO un parrafo continuo.",
                "Cada detalle debe tener exactamente estas lineas en este orden:",
                "- Urgencia: ...",
                "- Tiempo limite: ...",
                "- Estandar interno: ...",
                "- Herramientas: ...",
                "- Accion recomendada: ...",
                "- Justificacion tecnica: ...",
                "La justificacion tecnica debe tener 2-3 oraciones: explicar por que conviene esa accion, que riesgo operacional evita, que componente protege y que pasa si no se ejecuta a tiempo.",
                "El tiempo limite debe expresarse en horas entre 6 y 48 segun la urgencia: CRITICO 6-12h, MEDIO 12-24h, BAJO 24-48h. Usa tiempoLimiteBase como referencia. No uses minutos ni valores fuera de ese rango.",
                "La accion recomendada debe ser concreta, secuencial y orientada a planta (que hacer, en que orden y que verificar).",
                "Redacta en espanol claro para un tecnico de planta, con argumentos concretos, tecnicos y profesionales.",
                "No inventes codigos de fuente. No incluyas texto fuera del JSON.",
            ],
            "formato_respuesta": {
                "acciones": [
                    {
                        "orden": 1,
                        "prioridad": "CRITICO | BAJO | MEDIO",
                        "titulo": "Recomendacion RAG personalizada para la maquina",
                        "detalle": "- Urgencia: Critica — ...\n- Tiempo limite: ...\n- Estandar interno: ...\n- Herramientas: ...\n- Accion recomendada: ...\n- Justificacion tecnica: ...",
                    }
                ]
            },
            "contexto_falla": {
                "tipoFallo": fault,
                "nombre": profile["nombre"],
                "maquinaId": maquina_id,
                "riesgo": profile["riesgo"],
                "tiempoLimiteBase": profile["tiempo_limite"],
                "estandarInterno": profile["estandar"],
                "herramientasBase": profile["herramientas"],
                "historialReincidencia": escalado,
            },
            "contexto_fuentes": selected_sources,
            "guia_tecnica_referencia": _reference_guide_without_titles(fault),
        },
        ensure_ascii=False,
    )


def _generate_with_llm(
    fault: str,
    maquina_id: str,
    escalado: bool,
    fuentes: list[dict[str, Any]] | None,
) -> dict[str, Any]:
    try:
        from openai import OpenAI
    except ImportError as exc:  # pragma: no cover - fallback runtime path
        raise RuntimeError("Dependencia openai no instalada") from exc

    api_key = _provider_api_key()
    if not api_key:
        raise RuntimeError("API key LLM no configurada")

    """provider y base_url para la API de OpenAI"""

    provider = os.getenv("RAG_PROVIDER", "openrouter").strip().lower()
    base_url = os.getenv("OPENAI_BASE_URL")
    if provider == "openrouter" and not base_url:
        base_url = "https://openrouter.ai/api/v1"

    timeout_sec = float(os.getenv("RAG_TIMEOUT_SEC", "20"))
    client_kwargs: dict[str, Any] = {
        "api_key": api_key,
        "timeout": timeout_sec,
    }
    if base_url:
        client_kwargs["base_url"] = base_url
    if provider == "openrouter":
        client_kwargs["default_headers"] = {
            "HTTP-Referer": os.getenv("OPENROUTER_SITE_URL", "http://localhost:3000"),
            "X-Title": os.getenv("OPENROUTER_APP_NAME", "PredictMaint"),
        }
    if not _env_bool("RAG_SSL_VERIFY", True):
        import httpx

        _rag_log("LLM SSL verification disabled by RAG_SSL_VERIFY=false")
        client_kwargs["http_client"] = httpx.Client(verify=False, timeout=timeout_sec)

    selected_sources = _select_sources(fault, fuentes)
    model = os.getenv("RAG_MODEL", "openai/gpt-4o-mini")
    _rag_log(
        "LLM request -> "
        f"provider={provider} model={model} base_url={base_url or 'default'} "
        f"key={_masked_key(api_key)} fault={fault} machine={maquina_id} "
        f"sources={[source['titulo'] for source in selected_sources]}"
    )

    client = OpenAI(**client_kwargs)
    completion = client.chat.completions.create(
        model=model,
        temperature=float(os.getenv("RAG_TEMPERATURE", "0.2")),
        response_format={"type": "json_object"},
        messages=[
            {
                "role": "system",
                "content": (
                    "Eres un asistente RAG de mantenimiento industrial. "
                    "Responde solo JSON valido. "
                    "Genera prioridad, titulos y detalles originales para cada recomendacion del RAG. "
                    "La prioridad solo puede ser CRITICO, BAJO o MEDIO. "
                    "El detalle debe usar guiones en lineas separadas y argumentar tecnicamente la recomendacion."
                ),
            },
            {"role": "user", "content": _build_prompt(fault, maquina_id, escalado, selected_sources)},
        ],
    )

    content = completion.choices[0].message.content or "{}"
    _rag_log(
        "OpenRouter OK -> "
        f"provider={provider} model={model} response_id={getattr(completion, 'id', 'n/a')} "
        f"tokens={getattr(getattr(completion, 'usage', None), 'total_tokens', 'n/a')}"
    )
    payload = json.loads(content)
    actions = payload.get("acciones")
    if not isinstance(actions, list) or len(actions) != 3:
        raise ValueError("El LLM no devolvio exactamente 3 acciones")

    normalized_actions = []
    for idx, action in enumerate(actions):
        if not isinstance(action, dict):
            raise ValueError("Accion RAG invalida")
        prioridad = _extract_llm_priority(action, idx + 1)
        titulo = _extract_llm_title(action, fault, maquina_id, idx + 1)
        detalle = str(action.get("detalle") or "").strip()
        if not detalle:
            raise ValueError(f"El LLM no devolvio detalle para la recomendacion RAG #{idx + 1}")
        normalized_actions.append(
            {
                "orden": idx + 1,
                "prioridad": prioridad,
                "titulo": titulo,
                "detalle": _ensure_operational_detail(detalle, fault, prioridad, escalado and idx == 2),
            }
        )

    return {
        "tipoFallo": fault,
        "escalado": escalado,
        "acciones": normalized_actions,
        "fuentes": [source["titulo"] for source in selected_sources],
    }


def _ensure_operational_detail(detail: str, fault: str, prioridad: str, escalado: bool) -> str:
    profile = FAULT_PROFILES[fault]
    normalized = detail.strip()
    lower = normalized.lower()

    if normalized.startswith("- ") or "\n- " in normalized:
        lines = [line.strip() for line in normalized.splitlines() if line.strip()]
        if escalado and not any("escalamiento" in line.lower() for line in lines):
            lines.append(
                "- Escalamiento: Existe historial de reincidencia; documentar evidencia y notificar al supervisor de mantenimiento."
            )
        return "\n".join(lines)

    accion = normalized
    justificacion = (
        f"Esta accion mitiga el riesgo de {profile['nombre']} en la maquina y reduce la probabilidad de que la falla "
        "progrese hacia dano estructural, mala calidad o parada no programada."
    )
    if "justificacion" in lower or "porque" in lower or "riesgo" in lower:
        parts = [part.strip() for part in normalized.split(".") if part.strip()]
        if len(parts) > 1:
            accion = parts[0]
            justificacion = ". ".join(parts[1:])

    return _build_bullet_detail(
        urgencia=f"{_priority_label(prioridad)} — {profile['riesgo']}",
        tiempo_limite=f"{_tiempo_limite_por_prioridad(prioridad, fault)} antes de que el problema escale o afecte continuidad operativa.",
        estandar=profile["estandar"],
        herramientas=profile["herramientas"],
        accion=accion,
        justificacion=justificacion,
        escalado=escalado,
    )

def generate_action_plan(
    tipo_fallo: str,
    maquina_id: str,
    historial: list[Any] | None = None,
    fuentes: list[dict[str, Any]] | None = None,
    escalado: bool | None = None,
) -> dict[str, Any]:
    """Genera plan S-3 con RAG ligero. Si el LLM falla, devuelve plan local."""
    # --- Entrada: normalizar tipo de fallo y flag de reincidencia ---
    fault = tipo_fallo.upper()
    is_escalated = bool(historial) if escalado is None else bool(escalado)

    # --- Caso RNF: falla aleatoria → solo inspección manual, nunca LLM ---
    if fault == "RNF":
        _rag_log("fallback local -> fault=RNF reason=manual_inspection_required")
        acciones = [
            {**action, "orden": idx + 1, "detalle": action["detalle"].replace("M-001", maquina_id)}
            for idx, action in enumerate(RNF_MANUAL_INSPECTION)
        ]
        return {
            "tipoFallo": fault,
            "escalado": is_escalated,
            "acciones": acciones,
            "fuentes": _fallback_sources(fault, fuentes),
        }

    # --- Validación: rechazar tipos de fallo desconocidos ---
    if fault not in FAULT_ACTION_PLANS:
        raise ValueError(f"Tipo de fallo no soportado: {fault}")

    # --- Fallback local: LLM desactivado por configuración (RAG_USE_LLM=false) ---
    if not _env_bool("RAG_USE_LLM", True):
        _rag_log(f"fallback local -> reason=RAG_USE_LLM_disabled fault={fault} machine={maquina_id}")
        return _template_plan(fault, maquina_id, is_escalated, fuentes)

    # --- Fallback local: sin API key de OpenRouter/OpenAI ---
    if not _provider_api_key():
        _rag_log(f"fallback local -> reason=missing_openrouter_api_key fault={fault} machine={maquina_id}")
        return _template_plan(fault, maquina_id, is_escalated, fuentes)

    # --- Camino preferido: OpenRouter/GPT; si falla → plantillas FAULT_ACTION_PLANS ---
    try:
        return _generate_with_llm(fault, maquina_id, is_escalated, fuentes)
    except Exception as exc:
        # --- Mensaje en consola---
        _rag_log(
            "fallback local -> "
            f"provider={os.getenv('RAG_PROVIDER', 'openrouter')} "
            f"model={os.getenv('RAG_MODEL', 'openai/gpt-4o-mini')} "
            f"fault={fault} machine={maquina_id} error={type(exc).__name__}: {exc}"
        )
        logger.exception(
            "RAG fallback local -> provider=%s model=%s fault=%s machine=%s error=%s: %s",
            os.getenv("RAG_PROVIDER", "openrouter"),
            os.getenv("RAG_MODEL", "openai/gpt-4o-mini"),
            fault,
            maquina_id,
            type(exc).__name__,
            exc,
        )
        # --- Fallback local: plantillas FAULT_ACTION_PLANS ---
        return _template_plan(fault, maquina_id, is_escalated, fuentes)
