"""Motor RAG base: plan de acción por tipo de fallo."""

from __future__ import annotations

from typing import Any

FAULT_SOURCES: dict[str, list[str]] = {
    "HDF": [
        "Theissler et al. (2021)",
        "Cai et al. (2023)",
        "Pashmforoush et al. (2025)",
    ],
    "PWF": [
        "Theissler et al. (2021)",
        "Araujo et al. (2025)",
        "Cai et al. (2023)",
    ],
    "TWF": [
        "Pashmforoush et al. (2025)",
        "Hesser & Markert (2019)",
        "Cai et al. (2023)",
    ],
    "OSF": [
        "Pashmforoush et al. (2025)",
        "Araujo et al. (2025)",
        "Cai et al. (2023)",
    ],
    "RNF": ["Jakobs et al. (2026)"],
}

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
            "prioridad": "ALTO",
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
            "prioridad": "ALTO",
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
            "prioridad": "ALTO",
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
            "prioridad": "ALTO",
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
            "Fallo aleatorio (RNF): no se genera plan RAG automático. "
            "Escalar a inspección manual con especialista externo antes de reanudar operación."
        ),
    },
]


def generate_action_plan(
    tipo_fallo: str,
    maquina_id: str,
    historial: list[Any] | None = None,
) -> dict[str, Any]:
    """Genera plan S-3 según tipo de fallo. RNF solo devuelve inspección manual."""
    fault = tipo_fallo.upper()
    escalado = bool(historial)

    if fault == "RNF":
        acciones = [
            {**action, "orden": idx + 1, "detalle": action["detalle"].replace("M-001", maquina_id)}
            for idx, action in enumerate(RNF_MANUAL_INSPECTION)
        ]
        return {
            "tipoFallo": fault,
            "escalado": escalado,
            "acciones": acciones,
            "fuentes": FAULT_SOURCES.get(fault, []),
        }

    base_plan = FAULT_ACTION_PLANS.get(fault)
    if not base_plan:
        raise ValueError(f"Tipo de fallo no soportado: {fault}")

    acciones = []
    for idx, action in enumerate(base_plan):
        detalle = action["detalle"].replace("M-001", maquina_id)
        if escalado and idx == len(base_plan) - 1:
            detalle += " Plan escalado por historial de reincidencia: aplicar acciones adicionales de Config 5."
        acciones.append(
            {
                "orden": idx + 1,
                "prioridad": action["prioridad"],
                "titulo": action["titulo"],
                "detalle": detalle,
            }
        )

    return {
        "tipoFallo": fault,
        "escalado": escalado,
        "acciones": acciones,
        "fuentes": FAULT_SOURCES.get(fault, []),
    }
