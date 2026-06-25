import { PrioridadAccion } from '../enums';
import type { MlRagAction } from '../../ml-gateway/ml-gateway.service';

const PRIORITY_RANK: Record<string, number> = {
  CRITICO: 3,
  MEDIO: 2,
  BAJO: 1,
};

const PRIORITY_LABEL: Record<PrioridadAccion, string> = {
  [PrioridadAccion.CRITICO]: 'Crítica',
  [PrioridadAccion.MEDIO]: 'Moderada',
  [PrioridadAccion.BAJO]: 'Baja',
};

type FaultContext = {
  descripcion: string;
  impacto: string;
  riesgoSiNoActua: string;
  herramientas: string;
  revisiones: string;
  escalamiento: string;
  estandar: string;
};

const FAULT_CONTEXT: Record<string, FaultContext> = {
  HDF: {
    descripcion:
      'Sobrecalentamiento por disipación insuficiente en el sistema térmico (diferencia térmica por encima del umbral operativo).',
    impacto:
      'El calor acumulado degrada el variador, sensores y componentes mecánicos adyacentes; la máquina pierde estabilidad térmica y puede activar protecciones de parada.',
    riesgoSiNoActua:
      'Si se continúa operando, el fallo puede escalar a daño en bobinado del motor, apagado térmico del variador, mala calidad dimensional en piezas y parada no programada con alto costo de reparación.',
    herramientas: 'Cámara térmica, termómetro IR, multímetro y kit de limpieza de ventilación.',
    revisiones:
      'Flujo de aire, filtros y ductos, variador de frecuencia, sensores de temperatura de proceso y ambiente, rpm y diferencia térmica.',
    escalamiento: '6-12 horas',
    estandar:
      'PM-STD-THERM-01: parada controlada, bloqueo/etiquetado (LOTO) y estabilización térmica antes de intervenir.',
  },
  PWF: {
    descripcion:
      'Desviación de potencia eléctrica fuera del rango operativo seguro (consumo anómalo del accionamiento).',
    impacto:
      'La potencia irregular indica sobrecarga o falla eléctrica incipiente; el variador y el motor trabajan fuera de su curva de eficiencia y generan estrés adicional.',
    riesgoSiNoActua:
      'Postergar la intervención puede provocar disparo del variador, daño en aislamiento del motor, fluctuaciones de torque y paradas abruptas en línea de producción.',
    herramientas: 'Pinza amperimétrica, multímetro True RMS, analizador de potencia y EPP dieléctrico.',
    revisiones:
      'Conexiones eléctricas, alimentación trifásica, bornes del motor, parámetros del variador, torque y consumo bajo carga.',
    escalamiento: '6-18 horas',
    estandar:
      'PM-STD-ELEC-02: aislamiento eléctrico, verificación de tensión cero y prueba de carga controlada antes de reinicio.',
  },
  TWF: {
    descripcion:
      'Desgaste crítico de herramienta de corte que compromete calidad, vibración y vida útil del husillo.',
    impacto:
      'Una herramienta desgastada incrementa la fuerza de corte, eleva vibraciones y puede dañar el portaherramientas o generar piezas fuera de tolerancia.',
    riesgoSiNoActua:
      'Operar sin cambio oportuno puede causar rotura de herramienta, daño en husillo, rechazo masivo de piezas y tiempo extra de reproceso o scrap.',
    herramientas: 'Calibrador, llave dinamométrica, reloj comparador y kit de herramienta de corte.',
    revisiones:
      'Desgaste acumulado vs umbral del tipo de máquina, alineación del husillo, parámetros de avance/profundidad y registro en CMMS.',
    escalamiento: '24-48 horas',
    estandar:
      'PM-STD-TOOL-03: cambio seguro de herramienta, verificación dimensional y registro obligatorio del ciclo de vida.',
  },
  OSF: {
    descripcion:
      'Sobreesfuerzo mecánico por carga y torque acumulados por encima de la capacidad nominal del eje.',
    impacto:
      'La combinación torque × desgaste indica que la máquina opera al límite mecánico; rodamientos y acoplamientos absorben esfuerzos que aceleran la fatiga.',
    riesgoSiNoActua:
      'Ignorar la condición puede derivar en falla de rodamientos, deformación de ejes, vibración crítica y parada prolongada por reparación estructural.',
    herramientas: 'Torquímetro, vibrometro, estetoscopio mecánico y lubricante industrial.',
    revisiones:
      'Rodamientos, acoplamientos, balance de carga, vibración en puntos críticos y parámetros de operación vs capacidad nominal.',
    escalamiento: '6-24 horas',
    estandar:
      'PM-STD-MECH-04: reducción de carga, inspección de rodamientos/acoples y prueba de vibración antes de reinicio.',
  },
  RNF: {
    descripcion:
      'Falla aleatoria sin patrón determinista claro; requiere validación humana antes de liberar la máquina.',
    impacto:
      'El modelo no puede aislar una causa única con confianza suficiente; la intervención automática podría enmascarar un riesgo de seguridad o un modo de falla no previsto.',
    riesgoSiNoActua:
      'Reiniciar sin inspección especializada expone a fallos repetitivos, incidentes de seguridad y diagnósticos erróneos que prolongan el tiempo fuera de servicio.',
    herramientas: 'Checklist de inspección, multímetro, cámara térmica, vibrometro y tablet CMMS.',
    revisiones:
      'Inspección integral de seguridad, registro fotográfico de hallazgos, validación de especialista y autorización formal de reinicio.',
    escalamiento: '6 horas',
    estandar:
      'PM-STD-SAFE-05: aislamiento preventivo, inspección de especialista y autorización de supervisor antes de reanudar producción.',
  },
};

function minutesToHuman(minutes: number): string {
  if (minutes <= 0) return 'Inmediato';
  if (minutes < 60) return `${minutes} minutos`;
  const hours = Math.ceil(minutes / 60);
  if (hours < 24) return `${hours} ${hours === 1 ? 'hora' : 'horas'}`;
  const days = Math.ceil(hours / 24);
  return `${days} ${days === 1 ? 'día' : 'días'}`;
}

const MIN_ESCALATION_HOURS = 6;
const MAX_ESCALATION_HOURS = 48;

function hoursToHuman(hours: number): string {
  if (hours >= 24 && hours % 24 === 0) {
    const days = hours / 24;
    return `${days} ${days === 1 ? 'día' : 'días'}`;
  }
  return `${hours} ${hours === 1 ? 'hora' : 'horas'}`;
}

function clampHours(hours: number): number {
  return Math.min(Math.max(hours, MIN_ESCALATION_HOURS), MAX_ESCALATION_HOURS);
}

function parseHoursValue(text: string): number | null {
  const lower = text.toLowerCase().trim();
  if (/inmediato/.test(lower)) return MIN_ESCALATION_HOURS;

  const dayMatch = lower.match(/(\d+)\s*d[ií]as?/);
  if (dayMatch) return Number(dayMatch[1]) * 24;

  const hourMatch = lower.match(/(\d+)\s*horas?/);
  if (hourMatch) return Number(hourMatch[1]);

  const minMatch = lower.match(/(\d+)\s*min/);
  if (minMatch) return Math.ceil(Number(minMatch[1]) / 60);

  const hMatch = lower.match(/\b(\d+)\s*h\b/);
  if (hMatch) return Number(hMatch[1]);

  return null;
}

function normalizeEscalationTime(text: string): string {
  const stripped = text.split(/\s+(?:—|-)\s+|\s+antes de/i)[0].trim();

  const rangeMatch = stripped.match(/(\d+)\s*-\s*(\d+)\s*(horas?|h\b|d[ií]as?)/i);
  if (rangeMatch) {
    let lo = Number(rangeMatch[1]);
    let hi = Number(rangeMatch[2]);
    const unit = rangeMatch[3].toLowerCase();
    if (unit.startsWith('d')) {
      lo *= 24;
      hi *= 24;
    }
    lo = clampHours(lo);
    hi = clampHours(Math.max(hi, lo));
    if (lo === hi) return hoursToHuman(lo);
    return `${hoursToHuman(lo)} - ${hoursToHuman(hi)}`;
  }

  const single = parseHoursValue(stripped);
  if (single !== null) {
    return hoursToHuman(clampHours(single));
  }

  return hoursToHuman(12);
}

function normalizeTimeUnits(text: string): string {
  const range = text.replace(/(\d+)\s*-\s*(\d+)\s*min/gi, (_, a: string, b: string) => {
    return `${minutesToHuman(Number(a))} - ${minutesToHuman(Number(b))}`;
  });
  return range.replace(/(\d+)\s*min\b/gi, (_, value: string) => minutesToHuman(Number(value)));
}

function normalizeLine(line: string): string {
  return line.replace(/^[-•*]\s*/, '').trim();
}

function extractField(detalle: string, fieldPattern: string): string | null {
  for (const line of detalle.split('\n')) {
    const cleaned = normalizeLine(line);
    const match = cleaned.match(new RegExp(`^${fieldPattern}\\s*:\\s*(.+)$`, 'i'));
    if (match?.[1]) return normalizeTimeUnits(match[1].trim());
  }
  return null;
}

function looksLikeTimeLimit(text: string): boolean {
  const lower = text.toLowerCase();
  return (
    /inmediato/.test(lower) ||
    /\d+\s*(min|hora|d[ií]a)/.test(lower) ||
    /corto plazo/.test(lower)
  );
}

function extractTimeLimit(detalle: string): string | null {
  const raw = extractField(detalle, 'Tiempo l[ií]mite');
  if (!raw) return null;
  return raw.split(/\s+(?:—|-)\s+|\s+antes de/i)[0].trim();
}

function extractAction(detalle: string): string {
  const fromField = extractField(detalle, 'Acci[oó]n recomendada');
  if (fromField) return fromField;
  const lines = detalle
    .split('\n')
    .map(normalizeLine)
    .filter(Boolean)
    .filter((line) => !/^(Urgencia|Tiempo|Estandar|Herramientas|Justificaci)/i.test(line));
  return lines[0] ?? 'Ejecutar intervención según protocolo de planta.';
}

function extractTools(detalle: string): string[] {
  const raw = extractField(detalle, 'Herramientas');
  if (!raw) return [];
  return raw
    .split(/[,;]/)
    .map((t) => t.trim())
    .filter(Boolean);
}

function extractJustification(detalle: string): string | null {
  return extractField(detalle, 'Justificaci[oó]n t[eé]cnica');
}

function extractUrgency(detalle: string): string | null {
  return extractField(detalle, 'Urgencia');
}

function highestPriority(acciones: MlRagAction[]): PrioridadAccion {
  const selected = acciones
    .map((a) => String(a.prioridad || '').toUpperCase())
    .sort((a, b) => (PRIORITY_RANK[b] ?? 0) - (PRIORITY_RANK[a] ?? 0))[0];
  if (selected === PrioridadAccion.CRITICO) return PrioridadAccion.CRITICO;
  if (selected === PrioridadAccion.MEDIO) return PrioridadAccion.MEDIO;
  return PrioridadAccion.BAJO;
}

function priorityLabel(prioridad: string): string {
  const key = prioridad.toUpperCase() as PrioridadAccion;
  return PRIORITY_LABEL[key] ?? prioridad;
}

function sortActionsByPriority(acciones: MlRagAction[]): MlRagAction[] {
  return [...acciones].sort(
    (a, b) =>
      (PRIORITY_RANK[String(b.prioridad).toUpperCase()] ?? 0) -
      (PRIORITY_RANK[String(a.prioridad).toUpperCase()] ?? 0),
  );
}

function mergeUniqueTools(base: string, acciones: MlRagAction[]): string {
  const items = new Set<string>();
  base
    .split(/[,;]/)
    .map((t) => t.trim())
    .filter(Boolean)
    .forEach((t) => items.add(t));
  for (const action of acciones) {
    extractTools(action.detalle ?? '').forEach((t) => items.add(t));
  }
  return Array.from(items).join(', ');
}

function resolveEscalationTime(fault: string, acciones: MlRagAction[]): string {
  const ctx = FAULT_CONTEXT[fault] ?? FAULT_CONTEXT.RNF;
  const ordered = sortActionsByPriority(acciones);
  const candidates = [
    ...ordered.map((a) => extractTimeLimit(a.detalle ?? '')),
    ctx.escalamiento,
  ].filter(Boolean) as string[];

  for (const candidate of candidates) {
    if (looksLikeTimeLimit(candidate)) {
      return normalizeEscalationTime(candidate);
    }
  }
  return normalizeEscalationTime(ctx.escalamiento);
}

function buildCombinedJustification(
  fault: string,
  acciones: MlRagAction[],
  ctx: FaultContext,
): string {
  const parts = acciones
    .map((a) => extractJustification(a.detalle ?? ''))
    .filter(Boolean) as string[];

  const unique = Array.from(new Set(parts));
  if (unique.length >= 2) {
    return `${unique[0]} Además, ${unique[1].charAt(0).toLowerCase()}${unique[1].slice(1)}`;
  }
  if (unique.length === 1) {
    return `${unique[0]} ${ctx.riesgoSiNoActua}`;
  }
  return `${ctx.impacto} ${ctx.riesgoSiNoActua}`;
}

export function buildGeneralRecommendation(
  tipoFallo: string,
  acciones: MlRagAction[],
  escalado: boolean,
): { titulo: string; prioridad: PrioridadAccion; detalle: string } {
  const fault = tipoFallo.toUpperCase();
  const ctx = FAULT_CONTEXT[fault] ?? FAULT_CONTEXT.RNF;
  const prioridad = highestPriority(acciones);
  const ordered = sortActionsByPriority(acciones);
  const escalationTime = resolveEscalationTime(fault, ordered);
  const herramientas = mergeUniqueTools(ctx.herramientas, ordered);
  const justificacion = buildCombinedJustification(fault, ordered, ctx);

  const detailLines = [
    `Prioridad: ${PRIORITY_LABEL[prioridad]} (determinada por el motor RAG según riesgo operacional y severidad del tipo ${fault})`,
    `Tiempo para escalamiento: ${escalationTime} — intervención requerida antes de que el fallo progrese a parada no programada o daño estructural`,
    `Descripción del fallo: ${ctx.descripcion} ${ctx.impacto}`,
    `Riesgo si no se interviene: ${ctx.riesgoSiNoActua}`,
    `Estándar interno: ${ctx.estandar}`,
    `Herramientas a llevar: ${herramientas}`,
    `Qué revisar: ${ctx.revisiones}`,
  ];

  ordered.forEach((action, index) => {
    const stepAction = extractAction(action.detalle ?? '');
    const stepJust = extractJustification(action.detalle ?? '');
    const urgency = extractUrgency(action.detalle ?? '');
    const why = stepJust ? ` Motivo: ${stepJust}` : '';
    const urg = urgency ? ` (${urgency})` : '';
    detailLines.push(
      `Paso ${index + 1} (${priorityLabel(String(action.prioridad))})${urg}: ${action.titulo}. Acción: ${stepAction}.${why}`,
    );
  });

  detailLines.push(`Justificación técnica: ${justificacion}`);

  if (escalado) {
    detailLines.push(
      'Escalamiento por reincidencia: esta máquina presenta historial reciente del mismo tipo de fallo; documentar evidencia fotográfica, registrar hallazgos en CMMS y notificar al supervisor de mantenimiento para seguimiento.',
    );
  }

  return {
    titulo: `Recomendación general ${fault} — intervención técnica guiada`,
    prioridad,
    detalle: detailLines.map((line) => `- ${line}`).join('\n'),
  };
}
