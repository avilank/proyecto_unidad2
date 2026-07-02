export type DashboardFilters = {
  desde?: string;
  hasta?: string;
  tipoMaquina?: string;
};

export const DEFAULT_DASHBOARD_FILTERS: DashboardFilters = {};

export function dashboardFiltersToParams(
  filters: DashboardFilters,
): Record<string, string> {
  const params: Record<string, string> = {};
  if (filters.desde) params.desde = filters.desde;
  if (filters.hasta) params.hasta = filters.hasta;
  if (filters.tipoMaquina) params.tipoMaquina = filters.tipoMaquina;
  return params;
}

export type ReportFilters = {
  range: 'week' | 'month';
  desde?: string;
  hasta?: string;
  tecnicoId?: number;
  respuestaRag?: string;
};

export type ValidationPanelFilters = {
  tipoFallo?: string;
  decision?: string;
  maquinaId?: string;
};

export type LogPanelFilters = {
  tipoFallo?: string;
  maquinaId?: string;
  estado?: string;
  canal?: string;
};

/** Filtros completos enviados a la API de analítica */
export type AnalyticsFilters = ReportFilters & ValidationPanelFilters & {
  estado?: string;
};

export const DEFAULT_REPORT_FILTERS: ReportFilters = {
  range: 'week',
};

export const DEFAULT_VALIDATION_FILTERS: ValidationPanelFilters = {};

export const DEFAULT_LOG_FILTERS: LogPanelFilters = {};

export const DEFAULT_ANALYTICS_FILTERS: AnalyticsFilters = {
  ...DEFAULT_REPORT_FILTERS,
};

export function analyticsFiltersToParams(
  filters: AnalyticsFilters,
): Record<string, string | number> {
  const params: Record<string, string | number> = { range: filters.range };
  if (filters.desde) params.desde = filters.desde;
  if (filters.hasta) params.hasta = filters.hasta;
  if (filters.tecnicoId) params.tecnicoId = filters.tecnicoId;
  if (filters.tipoFallo && filters.tipoFallo !== 'todos') params.tipoFallo = filters.tipoFallo;
  if (filters.respuestaRag && filters.respuestaRag !== 'todos') {
    params.respuestaRag = filters.respuestaRag;
  }
  if (filters.decision && filters.decision !== 'todos') params.decision = filters.decision;
  if (filters.estado && filters.estado !== 'todos') params.estado = filters.estado;
  if (filters.maquinaId && filters.maquinaId !== 'todos') params.maquinaId = filters.maquinaId;
  return params;
}

export function countActiveReportFilters(filters: ReportFilters): number {
  let n = 0;
  if (filters.desde || filters.hasta) n += 1;
  if (filters.tecnicoId) n += 1;
  if (filters.respuestaRag && filters.respuestaRag !== 'todos') n += 1;
  return n;
}

export function mergePredictionFilters(
  report: ReportFilters,
  validation: ValidationPanelFilters,
): AnalyticsFilters {
  return { ...report, ...validation };
}
