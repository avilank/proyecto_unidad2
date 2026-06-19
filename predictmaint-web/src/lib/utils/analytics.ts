import type { AnalyticsSummary } from '@/core/entities';
import type { NotificationLogEntry } from '@/core/types/api';

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
  return {
    total,
    conRag,
    sinRag,
    sinAtender,
    pctConRag: summary?.pctConRag ?? calcPct(conRag, total),
    pctSinRag: calcPct(sinRag, total),
    pctSinAtender: calcPct(sinAtender, total),
  };
}

export function countCsvsToday(items: NotificationLogEntry[] | undefined): number {
  if (!items?.length) return 0;
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  return items.filter((item) => new Date(item.enviadoEn) >= start).length;
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
