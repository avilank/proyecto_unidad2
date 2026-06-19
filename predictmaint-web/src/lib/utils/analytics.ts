import type { AnalyticsSummary } from '@/core/entities';

export function formatWaitingTime(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest > 0 ? `${hours} h ${rest} min` : `${hours} h`;
}

export function calcPct(part: number, total: number): number {
  if (!total) return 0;
  return Math.round((part / total) * 100);
}

export function buildRagBreakdown(summary?: AnalyticsSummary) {
  const total = summary?.totalAlertas ?? 0;
  const conRag = summary?.conRag ?? 0;
  const sinRag = summary?.sinRag ?? 0;
  const sinAtender = summary?.sinAtender ?? 0;
  const cerradas = conRag + sinRag;
  return {
    total,
    conRag,
    sinRag,
    sinAtender,
    cerradas,
    abiertas: sinAtender,
    pctConRag: calcPct(conRag, total),
    pctSinRag: calcPct(sinRag, total),
    pctSinAtender: calcPct(sinAtender, total),
    pctRagEntreCerradas: calcPct(conRag, cerradas),
  };
}

export function formatNotificationTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('es-PE', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatNotificationEstado(estado: string): string {
  switch (estado) {
    case 'entregado':
      return 'Entregado';
    case 'fallido':
      return 'Fallido';
    default:
      return 'Pendiente';
  }
}

/** Motivo del log: solo tipo de fallo (sin nivel de riesgo). */
export function formatNotificationMotivo(motivo: string | null | undefined): string {
  if (!motivo?.trim()) return '—';
  const sep = motivo.indexOf(' — ');
  return sep >= 0 ? motivo.slice(0, sep).trim() : motivo.trim();
}

export function recurrenceSeverity(fallos: number, max: number): {
  barColor: string;
  textClass: 'text-success' | 'text-warning' | 'text-danger';
} {
  const ratio = max > 0 ? fallos / max : 0;
  if (ratio >= 0.66) {
    return { barColor: 'var(--color-danger)', textClass: 'text-danger' };
  }
  if (ratio >= 0.33) {
    return { barColor: 'var(--color-warning)', textClass: 'text-warning' };
  }
  return { barColor: 'var(--color-success)', textClass: 'text-success' };
}

export function riskBadgeVariant(
  nivel: string,
): 'critical' | 'high' | 'medium' | 'low' | 'default' {
  switch (nivel.toUpperCase()) {
    case 'CRITICAL':
      return 'critical';
    case 'HIGH':
      return 'high';
    case 'MEDIUM':
      return 'medium';
    case 'LOW':
      return 'low';
    default:
      return 'default';
  }
}
