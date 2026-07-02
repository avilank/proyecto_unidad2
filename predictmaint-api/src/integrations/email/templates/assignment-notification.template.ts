import { NivelRiesgo } from '../../../common/enums';
import type { AlertMessageInput } from '../../../notifications/alert-message.builder';

export interface AssignmentEmailInput extends AlertMessageInput {
  tecnicoNombre: string;
}

const RISK_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  [NivelRiesgo.CRITICAL]: { bg: '#7f1d1d', text: '#fecaca', label: 'CRÍTICO' },
  [NivelRiesgo.HIGH]: { bg: '#9a3412', text: '#fed7aa', label: 'ALTO' },
  [NivelRiesgo.MEDIUM]: { bg: '#92400e', text: '#fde68a', label: 'MEDIO' },
  [NivelRiesgo.LOW]: { bg: '#1e3a5f', text: '#bfdbfe', label: 'BAJO' },
};

function riskStyle(nivel: string) {
  return RISK_COLORS[nivel] ?? RISK_COLORS[NivelRiesgo.MEDIUM];
}

function formatSensorTable(input: AssignmentEmailInput): string {
  const lectura = input.lectura;
  if (!lectura) {
    return `<p style="margin:0;color:#64748b;font-size:14px">Sin lectura de sensor asociada.</p>`;
  }

  const tempDiff =
    Number(lectura.processTemperature) - Number(lectura.airTemperature);
  const rows = [
    ['Tipo de máquina', lectura.tipoMaquina ?? '—'],
    ['Temperatura aire', `${lectura.airTemperature} K`],
    ['Temperatura proceso', `${lectura.processTemperature} K`],
    ['Diferencia térmica', `${tempDiff.toFixed(1)} K`],
    ['Velocidad (RPM)', lectura.rotationalSpeed.toLocaleString('es-PE')],
    ['Torque', `${lectura.torque} Nm`],
    ['Desgaste herramienta', `${lectura.toolWear} min`],
    [
      'Potencia',
      lectura.powerW != null ? `${Number(lectura.powerW).toLocaleString('es-PE')} W` : '—',
    ],
  ];

  const cells = rows
    .map(
      ([label, value]) => `
        <tr>
          <td style="padding:10px 12px;border-bottom:1px solid #e2e8f0;color:#64748b;font-size:13px;width:42%">${label}</td>
          <td style="padding:10px 12px;border-bottom:1px solid #e2e8f0;color:#0f172a;font-size:13px;font-weight:600">${value}</td>
        </tr>`,
    )
    .join('');

  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden">
      ${cells}
    </table>`;
}

function formatDateShort(date: Date): string {
  const d = date.getDate().toString().padStart(2, '0');
  const m = (date.getMonth() + 1).toString().padStart(2, '0');
  const y = date.getFullYear();
  return `${d}/${m}/${y}`;
}

export function buildAssignmentEmailSubject(input: AssignmentEmailInput): string {
  return `[PredictMaint] Asignación ${input.ordenCodigo} — ${input.maquinaCodigo} — ${input.tipoFalloCodigo}`;
}

export function buildAssignmentEmailHtml(input: AssignmentEmailInput): string {
  const risk = riskStyle(String(input.nivelRiesgo));
  const umbralRep = input.umbralRepetitivo ?? 3;
  const esRepetitivo =
    input.ocurrenciasVentana != null &&
    input.ocurrenciasVentana >= umbralRep &&
    Boolean(input.ventanaDias);

  const repetitivo = esRepetitivo
    ? `<p style="margin:0 0 16px;padding:12px 14px;background:#fff7ed;border-left:4px solid #ea580c;color:#9a3412;font-size:13px;border-radius:4px">
          <strong>Fallo repetitivo:</strong> ${input.ocurrenciasVentana} ocurrencias de ${input.tipoFalloCodigo} en los últimos ${input.ventanaDias} días.
        </p>`
    : '';

  const accion = input.accionPrincipal
    ? `<p style="margin:0 0 8px;font-size:14px;color:#334155"><strong>Acción recomendada:</strong> ${input.accionPrincipal}</p>`
    : '';

  const accionEscalada =
    esRepetitivo && input.accionEscaladaConfig?.trim()
      ? `<p style="margin:16px 0 0;padding:12px 14px;background:#fff7ed;border-left:4px solid #ea580c;border-radius:4px;color:#9a3412;font-size:13px"><strong>⚠️ Acción escalada (${input.tipoFalloCodigo}):</strong> ${input.accionEscaladaConfig.trim()}</p>`
      : '';

  const plan =
    esRepetitivo && input.planEscalado && !input.accionEscaladaConfig?.trim()
      ? `<p style="margin:16px 0 0;padding:12px 14px;background:#eff6ff;border-radius:8px;color:#1d4ed8;font-size:13px">${input.planEscalado}</p>`
      : '';

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${buildAssignmentEmailSubject(input)}</title>
</head>
<body style="margin:0;padding:0;background:#eef2f7;font-family:Segoe UI,Arial,sans-serif">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#eef2f7;padding:24px 12px">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 8px 24px rgba(15,23,42,0.08)">
          <tr>
            <td style="background:linear-gradient(135deg,#0f172a 0%,#1e3a8a 100%);padding:28px 32px">
              <p style="margin:0 0 6px;font-size:12px;letter-spacing:0.08em;text-transform:uppercase;color:#93c5fd">PredictMaint</p>
              <h1 style="margin:0;font-size:22px;line-height:1.3;color:#ffffff">Nueva asignación de mantenimiento</h1>
              <p style="margin:10px 0 0;font-size:14px;color:#cbd5e1">Se le ha asignado automáticamente una orden de intervención.</p>
            </td>
          </tr>
          <tr>
            <td style="padding:28px 32px">
              <p style="margin:0 0 20px;font-size:15px;color:#334155">
                Hola <strong>${input.tecnicoNombre}</strong>,
              </p>
              <p style="margin:0 0 20px;font-size:14px;line-height:1.6;color:#475569">
                El sistema detectó una anomalía y le asignó la siguiente orden. Revise los parámetros del sensor y el tipo de fallo predicho.
              </p>

              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:20px">
                <tr>
                  <td style="padding:14px 16px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="font-size:12px;color:#64748b;padding-bottom:4px">Máquina</td>
                        <td align="right" style="font-size:12px;color:#64748b;padding-bottom:4px">Orden</td>
                      </tr>
                      <tr>
                        <td style="font-size:20px;font-weight:700;color:#0f172a">${input.maquinaCodigo}</td>
                        <td align="right" style="font-size:20px;font-weight:700;color:#2563eb">${input.ordenCodigo}</td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:16px">
                <tr>
                  <td style="padding:12px 14px;background:#fef2f2;border:1px solid #fecaca;border-radius:8px">
                    <p style="margin:0 0 4px;font-size:12px;color:#991b1b;text-transform:uppercase;letter-spacing:0.04em">Tipo de fallo predicho</p>
                    <p style="margin:0;font-size:18px;font-weight:700;color:#b91c1c">${input.tipoFalloCodigo}</p>
                    <p style="margin:4px 0 0;font-size:13px;color:#7f1d1d">${input.tipoFalloNombre}</p>
                  </td>
                  <td width="12"></td>
                  <td style="padding:12px 14px;background:${risk.bg};border-radius:8px;vertical-align:top">
                    <p style="margin:0 0 4px;font-size:12px;color:${risk.text};text-transform:uppercase;letter-spacing:0.04em">Nivel de riesgo</p>
                    <p style="margin:0;font-size:18px;font-weight:700;color:#ffffff">${risk.label}</p>
                  </td>
                </tr>
              </table>

              ${repetitivo}
              ${accion}

              <h2 style="margin:24px 0 12px;font-size:15px;color:#0f172a">Parámetros del sensor</h2>
              ${formatSensorTable(input)}

              ${accionEscalada}

              <table role="presentation" cellpadding="0" cellspacing="0" style="margin:28px auto 0">
                <tr>
                  <td style="border-radius:8px;background:#2563eb">
                    <a href="${input.enlaceAnalisis}" style="display:inline-block;padding:14px 28px;font-size:14px;font-weight:600;color:#ffffff;text-decoration:none">
                      Ver orden en el panel
                    </a>
                  </td>
                </tr>
              </table>

              ${plan}
            </td>
          </tr>
          <tr>
            <td style="padding:18px 32px;background:#f8fafc;border-top:1px solid #e2e8f0">
              <p style="margin:0;font-size:12px;color:#94a3b8;text-align:center">
                PredictMaint · Mantenimiento Predictivo Industrial · ${formatDateShort(new Date())}
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export function buildAssignmentEmailText(input: AssignmentEmailInput): string {
  const lines = [
    `Hola ${input.tecnicoNombre},`,
    '',
    'Se le ha asignado automáticamente una orden de mantenimiento.',
    '',
    `Máquina: ${input.maquinaCodigo}`,
    `Orden: ${input.ordenCodigo}`,
    `Tipo de fallo: ${input.tipoFalloCodigo} — ${input.tipoFalloNombre}`,
    `Nivel de riesgo: ${input.nivelRiesgo}`,
  ];

  if (input.lectura) {
    lines.push(
      '',
      'Parámetros del sensor:',
      `- Temp. aire: ${input.lectura.airTemperature} K`,
      `- Temp. proceso: ${input.lectura.processTemperature} K`,
      `- RPM: ${input.lectura.rotationalSpeed}`,
      `- Torque: ${input.lectura.torque} Nm`,
      `- Desgaste: ${input.lectura.toolWear} min`,
      `- Potencia: ${input.lectura.powerW ?? '—'} W`,
    );
  }

  if (input.accionPrincipal) {
    lines.push('', `Acción recomendada: ${input.accionPrincipal}`);
  }

  lines.push('', `Ver orden: ${input.enlaceAnalisis}`);
  return lines.join('\n');
}
