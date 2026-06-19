import { NivelRiesgo, SolucionTipo } from '../common/enums';
import { LecturaSensor } from '../database/models/lectura-sensor.model';
import { RecomendacionRag } from '../database/models/recomendacion-rag.model';
import { SolucionAplicada } from '../database/models/solucion-aplicada.model';

export interface InterventionHistoryItem {
  fecha: Date;
  ordenCodigo: string;
  resolucion: string;
}

export interface AlertMessageInput {
  maquinaCodigo: string;
  ordenCodigo: string;
  nivelRiesgo: NivelRiesgo | string;
  tipoFalloCodigo: string;
  tipoFalloNombre: string;
  lectura?: LecturaSensor | null;
  accionPrincipal?: string | null;
  planEscalado?: string | null;
  ocurrenciasVentana?: number;
  ventanaDias?: number;
  intervencionesAnteriores?: InterventionHistoryItem[];
  enlaceAnalisis: string;
}

interface FaultMetric {
  label: string;
  value: string;
  threshold: string;
  highlight?: boolean;
}

const VENTANA_REPETITIVO_DIAS = 7;
const UMBRAL_REPETITIVO = 3;

function formatDateShort(date: Date): string {
  const d = date.getDate().toString().padStart(2, '0');
  const m = (date.getMonth() + 1).toString().padStart(2, '0');
  return `${d}/${m}`;
}

function riskEmoji(nivel: string): string {
  if (nivel === NivelRiesgo.CRITICAL || nivel === NivelRiesgo.HIGH) return '🔴';
  if (nivel === NivelRiesgo.MEDIUM) return '🟠';
  return '🟡';
}

function buildFaultMetrics(
  tipoFallo: string,
  lectura?: LecturaSensor | null,
): FaultMetric[] {
  if (!lectura) return [];

  const tempDiff = Number(lectura.processTemperature) - Number(lectura.airTemperature);
  const rpm = lectura.rotationalSpeed;
  const powerW = lectura.powerW != null ? Number(lectura.powerW) : null;
  const toolWear = lectura.toolWear;
  const torque = Number(lectura.torque);

  switch (tipoFallo) {
    case 'HDF':
      return [
        {
          label: 'Diferencia térmica',
          value: `${tempDiff.toFixed(1)}K`,
          threshold: '8.6K',
          highlight: tempDiff > 8.6,
        },
        {
          label: 'RPM',
          value: rpm.toLocaleString('es-PE'),
          threshold: '1,380',
          highlight: rpm < 1380,
        },
      ];
    case 'PWF':
      return powerW != null
        ? [
            {
              label: 'Potencia',
              value: `${powerW.toLocaleString('es-PE')} W`,
              threshold: '3,500 – 9,000 W',
              highlight: powerW < 3500 || powerW > 9000,
            },
          ]
        : [];
    case 'TWF':
      return [
        {
          label: 'Desgaste herramienta',
          value: `${toolWear}`,
          threshold: '200',
          highlight: toolWear >= 200,
        },
      ];
    case 'OSF':
      return [
        {
          label: 'Torque × desgaste',
          value: `${(torque * toolWear).toLocaleString('es-PE')}`,
          threshold: '5,000',
          highlight: torque * toolWear > 5000,
        },
      ];
    default:
      return [
        {
          label: 'RPM',
          value: rpm.toLocaleString('es-PE'),
          threshold: '—',
        },
      ];
  }
}

function formatInterventionLine(item: InterventionHistoryItem): string {
  return `• ${formatDateShort(item.fecha)} ${item.ordenCodigo} ${item.resolucion}`;
}

export function solucionLabel(tipo?: string | null): string {
  if (tipo === SolucionTipo.CON_RAG) return 'Resuelto con RAG';
  if (tipo === SolucionTipo.PROPIA) return 'Resuelto sin RAG';
  if (tipo === SolucionTipo.RECHAZADA_MANUAL) return 'Rechazado manualmente';
  return 'Resuelto';
}

export function solucionFromOrder(soluciones?: SolucionAplicada[]): string {
  const ultima = soluciones?.[soluciones.length - 1];
  return solucionLabel(ultima?.tipoSolucion);
}

export function pickPrimaryAction(acciones: RecomendacionRag[]): string | null {
  if (!acciones.length) return null;
  const sorted = [...acciones].sort((a, b) => a.orden - b.orden);
  const critica = sorted.find((a) => a.prioridad === 'CRITICO');
  return (critica ?? sorted[0]).titulo;
}

export function pickEscalatedPlan(
  nivelRiesgo: string,
  acciones: RecomendacionRag[],
  ocurrencias: number,
): string | null {
  const critica = acciones.find((a) => a.prioridad === 'CRITICO');
  if (critica?.titulo) return `Plan RAG escalado — ${critica.titulo}`;
  if (nivelRiesgo === NivelRiesgo.CRITICAL) {
    return 'Plan RAG escalado — Inspección profunda requerida';
  }
  if (ocurrencias >= UMBRAL_REPETITIVO) {
    return 'Plan RAG escalado — Revisión por fallo repetitivo';
  }
  return null;
}

export function buildAlertMessageInput(params: {
  maquinaCodigo: string;
  ordenCodigo: string;
  nivelRiesgo: string;
  tipoFalloCodigo: string;
  tipoFalloNombre: string;
  lectura?: LecturaSensor | null;
  accionesRag: RecomendacionRag[];
  historial: InterventionHistoryItem[];
  ocurrenciasVentana: number;
  frontendUrl: string;
}): AlertMessageInput {
  return {
    maquinaCodigo: params.maquinaCodigo,
    ordenCodigo: params.ordenCodigo,
    nivelRiesgo: params.nivelRiesgo,
    tipoFalloCodigo: params.tipoFalloCodigo,
    tipoFalloNombre: params.tipoFalloNombre,
    lectura: params.lectura,
    accionPrincipal: pickPrimaryAction(params.accionesRag),
    planEscalado: pickEscalatedPlan(
      params.nivelRiesgo,
      params.accionesRag,
      params.ocurrenciasVentana,
    ),
    ocurrenciasVentana: params.ocurrenciasVentana,
    ventanaDias: VENTANA_REPETITIVO_DIAS,
    intervencionesAnteriores: params.historial,
    enlaceAnalisis: `${params.frontendUrl}/dashboard/orders/${params.ordenCodigo}`,
  };
}

export function buildWhatsappSummary(input: AlertMessageInput): string {
  const lines: string[] = [];
  const emoji = riskEmoji(String(input.nivelRiesgo));

  lines.push(`${emoji} *ALERTA — ${input.maquinaCodigo}*`);

  if (
    input.ocurrenciasVentana != null &&
    input.ocurrenciasVentana >= UMBRAL_REPETITIVO &&
    input.ventanaDias
  ) {
    const ordinal = input.ocurrenciasVentana === 3 ? '3er' : `${input.ocurrenciasVentana}º`;
    lines.push(
      `🟠 *FALLO REPETITIVO — ${ordinal} ${input.tipoFalloCodigo} en ${input.ventanaDias} días*`,
    );
  }

  lines.push('');
  lines.push(`*Fallo:* ${input.tipoFalloCodigo} — ${input.tipoFalloNombre}`);

  if (input.accionPrincipal) {
    lines.push(`*Acción:* ${input.accionPrincipal}`);
  }

  const metrics = buildFaultMetrics(input.tipoFalloCodigo, input.lectura);
  if (metrics.length) {
    lines.push('');
    for (const m of metrics) {
      const prefix = m.highlight ? '🔴 ' : '';
      lines.push(`${prefix}${m.label}: ${m.value} (umbral ${m.threshold})`);
    }
  }

  lines.push('');
  lines.push(`*Orden:* ${input.ordenCodigo}`);

  if (input.intervencionesAnteriores?.length) {
    lines.push('');
    lines.push(`*Intervenciones anteriores (${input.tipoFalloCodigo}):*`);
    for (const item of input.intervencionesAnteriores.slice(0, 5)) {
      lines.push(formatInterventionLine(item));
    }
  }

  lines.push('');
  lines.push('Ver plan escalado y responder:');
  lines.push(input.enlaceAnalisis);

  if (input.planEscalado) {
    lines.push('');
    lines.push(`📘 ${input.planEscalado}`);
  }

  return lines.join('\n');
}

export function buildEmailHtml(input: AlertMessageInput): string {
  const metrics = buildFaultMetrics(input.tipoFalloCodigo, input.lectura);
  const metricRows = metrics
    .map(
      (m) =>
        `<li style="color:${m.highlight ? '#dc2626' : '#334155'}"><strong>${m.label}:</strong> ${m.value} (umbral ${m.threshold})</li>`,
    )
    .join('');

  const historial = (input.intervencionesAnteriores ?? [])
    .slice(0, 5)
    .map((item) => `<li>${formatInterventionLine(item)}</li>`)
    .join('');

  const repetitivo =
    input.ocurrenciasVentana != null && input.ocurrenciasVentana >= UMBRAL_REPETITIVO
      ? `<p style="color:#ea580c;font-weight:600">Fallo repetitivo: ${input.ocurrenciasVentana} ocurrencias de ${input.tipoFalloCodigo} en ${input.ventanaDias} días</p>`
      : '';

  return `
    <div style="font-family:Arial,sans-serif;color:#1e293b;max-width:560px">
      <h2 style="color:#dc2626;margin:0 0 8px">ALERTA — ${input.maquinaCodigo}</h2>
      ${repetitivo}
      <p><strong>Fallo:</strong> ${input.tipoFalloCodigo} — ${input.tipoFalloNombre}</p>
      ${input.accionPrincipal ? `<p><strong>Acción recomendada:</strong> ${input.accionPrincipal}</p>` : ''}
      ${metricRows ? `<ul>${metricRows}</ul>` : ''}
      <p><strong>Orden:</strong> ${input.ordenCodigo}</p>
      ${historial ? `<p><strong>Intervenciones anteriores (${input.tipoFalloCodigo}):</strong></p><ul>${historial}</ul>` : ''}
      <p><a href="${input.enlaceAnalisis}" style="color:#2563eb">Ver plan y responder en el panel</a></p>
      ${input.planEscalado ? `<p style="background:#eff6ff;padding:12px;border-radius:8px;color:#1d4ed8"><strong>${input.planEscalado}</strong></p>` : ''}
    </div>
  `.trim();
}

export function buildEmailSubject(input: AlertMessageInput): string {
  return `ALERTA ${input.nivelRiesgo} — ${input.maquinaCodigo} — ${input.ordenCodigo}`;
}
