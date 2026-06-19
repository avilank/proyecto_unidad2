import type { Alert } from '@/core/entities';
import { FAULT_LABELS } from '@/lib/constants/fault-types';

const MODEL_LABELS: Record<string, string> = {
  xgboost: 'XGBoost',
  random_forest: 'Random Forest',
  regresion_logistica: 'Regresión Logística',
  lightgbm: 'LightGBM',
  decision_tree: 'Decision Tree',
  svm: 'SVM',
};

export type MachineDashboardStatus = 'normal' | 'alerta' | 'fallo';

const MACHINE_STATUS_RANK: Record<MachineDashboardStatus, number> = {
  fallo: 0,
  alerta: 1,
  normal: 2,
};

export function getCurrentTurn(date = new Date()): string {
  const hour = date.getHours();
  if (hour >= 6 && hour < 14) return 'Turno Mañana';
  if (hour >= 14 && hour < 22) return 'Turno Tarde';
  return 'Turno Noche';
}

export function formatDashboardDate(date = new Date()): string {
  return date.toLocaleDateString('es-PE', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

export function formatModelLabel(slugOrName?: string | null): string {
  if (!slugOrName) return '—';
  return MODEL_LABELS[slugOrName] ?? slugOrName;
}

export function formatFaultTypeCell(tipo?: string | null): string {
  if (!tipo) return '—';
  const label = FAULT_LABELS[tipo];
  return label ? `${tipo} - ${label}` : tipo;
}

export function deriveMachineDashboardStatus(
  machineId: string,
  activeAlerts: Alert[],
): MachineDashboardStatus {
  const alert = activeAlerts
    .filter((a) => a.maquinaId === machineId && a.estado !== 'finalizado')
    .sort((a, b) => new Date(b.creadoEn).getTime() - new Date(a.creadoEn).getTime())[0];

  if (!alert) return 'normal';
  if (alert.tipoFallo || alert.nivel === 'CRITICAL') return 'fallo';
  return 'alerta';
}

export function sortMachinesByDashboardStatus<
  T extends { id: string; tipo: string },
>(machines: T[], activeAlerts: Alert[]): Array<T & { status: MachineDashboardStatus }> {
  return [...machines]
    .map((m) => ({
      ...m,
      status: deriveMachineDashboardStatus(m.id, activeAlerts),
    }))
    .sort((a, b) => {
      const byStatus = MACHINE_STATUS_RANK[a.status] - MACHINE_STATUS_RANK[b.status];
      if (byStatus !== 0) return byStatus;
      return a.id.localeCompare(b.id);
    });
}

export function buildFallosPorTipoHoy(
  fallosPorTipoHoy?: Record<string, number>,
): { tipoFallo: string; count: number }[] {
  const source = fallosPorTipoHoy ?? {};
  return ['HDF', 'PWF', 'TWF', 'OSF'].map((tipoFallo) => ({
    tipoFallo,
    count: source[tipoFallo] ?? 0,
  }));
}

export function calcTasaFalloGlobal(
  fallasDetectadasHoy?: number,
  totalMaquinas?: number,
): number | null {
  if (totalMaquinas == null || totalMaquinas <= 0) return null;
  if (fallasDetectadasHoy == null) return null;
  return (fallasDetectadasHoy / totalMaquinas) * 100;
}
