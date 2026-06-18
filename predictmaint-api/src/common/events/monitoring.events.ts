export const MONITORING_READING_EVENT = 'monitoring.reading';
export const MONITORING_ALERT_EVENT = 'monitoring.alert';

export interface MonitoringReadingPayload {
  maquinaId: string;
  reading: unknown;
  skipped?: string;
  cooldownMinutosRestantes?: number;
}

export interface MonitoringAlertPayload {
  maquinaId: string;
  alert?: unknown;
  order?: unknown;
}
