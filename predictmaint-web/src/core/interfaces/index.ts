import type {
  Alert,
  AnalyticsSummary,
  AppConfig,
  BinaryPrediction,
  LoginResponse,
  Machine,
  MachineAnalysis,
  MulticlassPrediction,
  Order,
  OrderDetail,
  OrderEvent,
  RagPlan,
  RagSource,
  Technician,
  User,
} from '@/core/entities';
import type { DashboardApiResponse, RecurrentMachineFault } from '@/core/types/api';

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface IAuthRepository {
  login(credentials: LoginCredentials): Promise<LoginResponse>;
  getProfile(): Promise<User>;
  logout(): Promise<void>;
}

export interface IMachineRepository {
  findAll(): Promise<Machine[]>;
  findById(id: string): Promise<Machine>;
}

export interface IOrderRepository {
  findAll(query?: Record<string, unknown>): Promise<import('@/core/types/api').OrdersPaginatedResponse<Order>>;
  findById(id: string): Promise<OrderDetail>;
  getTimeline(id: string): Promise<OrderEvent[]>;
  getBinaryPredictions(orderId: string): Promise<{
    items: BinaryPrediction[];
    modeloLider: string | null;
    confianzaLider: number | null;
    ensembleAvg: number | null;
    nivelRiesgo: string;
    consenso: string | null;
  }>;
  getMulticlassPredictions(orderId: string): Promise<{
    items: MulticlassPrediction[];
    modeloLider: string | null;
    tipoPredicho: string | null;
    agreement: string;
    confianza: number | null;
  }>;
}

export interface IAlertRepository {
  findAll(): Promise<Alert[]>;
  findRecent(limit?: number): Promise<Alert[]>;
}

export interface IPredictionRepository {
  getByMachineId(machineId: string): Promise<MachineAnalysis>;
}

export interface IRagRepository {
  getByOrderId(orderId: string): Promise<RagPlan>;
  regenerate(orderId: string, payload?: { escalado?: boolean; fuenteIds?: number[] }): Promise<RagPlan>;
}

export interface ITechnicianRepository {
  findAll(): Promise<Technician[]>;
  findById(id: number): Promise<Technician>;
  create(payload: import('@/core/entities').CreateTechnicianPayload): Promise<Technician>;
  update(id: number, payload: import('@/core/entities').UpdateTechnicianPayload): Promise<Technician>;
  remove(id: number): Promise<{ ok: boolean }>;
}

export interface IAnalyticsRepository {
  getDashboardKpis(): Promise<DashboardApiResponse>;
  getSummary(): Promise<AnalyticsSummary>;
  getRepetitiveFaults(): Promise<RecurrentMachineFault[]>;
  getFaultsByType(range?: string): Promise<{ tipoFallo: string; count: number }[]>;
  getSensorTrend(
    variable?: string,
    hours?: number,
  ): Promise<{ timestamp: string; value: number; maquinaId: string }[]>;
}

export interface IConfigRepository {
  getConfig(): Promise<AppConfig>;
  getRagSources(): Promise<RagSource[]>;
}

