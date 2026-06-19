export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
}

export interface OrdersPaginatedResponse<T> extends PaginatedResponse<T> {
  summary?: {
    pendiente: number;
    enProgreso: number;
    finalizado: number;
  };
}

export interface DashboardApiResponse {
  totalMaquinas: number;
  fallosHoy: number;
  analisisHoy?: number;
  pipelinesHoy?: number;
  maquinasEvaluadasHoy?: number;
  fallasDetectadasHoy?: number;
  criticosHoy?: number;
  moderadosHoy?: number;
  sinIncidenciaHoy?: number;
  alertasActivas: number;
  alertasCriticas?: number;
  alertasModeradas?: number;
  sinIncidencia?: number;
  fallosPorTipoHoy?: Record<string, number>;
  tasaDeteccion: number;
  tasaFalloGlobal?: number;
  precisionModelo: number;
  modeloActivoS1?: string;
}

export interface RecurrentMachineFault {
  maquinaId: string;
  tipoFallo: string;
  ocurrencias: number;
  ventanaDias: number;
  escalado?: boolean;
}

export interface FaultByType {
  tipoFallo: string;
  count: number;
}

export interface SensorTrendPoint {
  timestamp: string;
  value: number;
  maquinaId: string;
}
