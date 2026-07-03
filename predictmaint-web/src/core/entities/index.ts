import type {
  Especialidad,
  EstadoAlerta,
  EstadoFalloRepetitivo,
  EstadoOperativo,
  EstadoOrden,
  EstadoPlanRag,
  EstadoTecnico,
  EtapaModelo,
  EtapaOrden,
  ModeloS1,
  ModeloS2,
  NivelRiesgo,
  PrediccionBinariaResultado,
  PrioridadAccion,
  RolUsuario,
  SolucionTipo,
  TipoCalidadMaquina,
  TipoFallo,
  Turno,
} from '@/core/types';

export interface User {
  id: number;
  email: string;
  nombre?: string;
  rol: RolUsuario;
  tecnicoId: number | null;
  activo: boolean;
  creadoEn: string;
}

export interface AuthTokens {
  accessToken: string;
}

export interface LoginResponse {
  accessToken: string;
  user: {
    id: number;
    nombre: string;
    rol: RolUsuario;
    tecnicoId: number | null;
  };
}

export interface Technician {
  id: number;
  nombre: string;
  iniciales: string;
  especialidad: Especialidad;
  turno: Turno;
  estado: EstadoTecnico;
  telefono: string;
  email: string | null;
  nivelExperiencia: number;
  ordenesHoy: number;
  maquinas: string[];
  activo?: boolean;
  enviarWssp?: boolean;
  enviarCorreo?: boolean;
}

export interface CreateTechnicianPayload {
  nombre: string;
  especialidad: Especialidad;
  turno: Turno;
  telefono: string;
  email?: string;
}

export interface UpdateTechnicianPayload extends Partial<CreateTechnicianPayload> {
  estado?: EstadoTecnico;
  enviarWssp?: boolean;
  enviarCorreo?: boolean;
}

export interface Machine {
  id: string;
  nombre?: string;
  tipo: TipoCalidadMaquina;
  estadoOperativo: EstadoOperativo;
  horasOperacion: number;
  desgasteActual: number;
  ultimoMantenimiento: string | null;
  proximaRevision: string | null;
  tecnicoAsignadoId: number | null;
  ultimaLectura?: SensorReading;
  kpis?: {
    powerW: number;
    toolWear: number;
    rotationalSpeed: number;
    torque?: number;
  };
}

export interface SensorReading {
  id: number;
  maquinaId: string;
  productId: string | null;
  tipo: TipoCalidadMaquina;
  airTemperature: number;
  processTemperature: number;
  rotationalSpeed: number;
  torque: number;
  toolWear: number;
  powerW: number | null;
  capturadoEn: string;
}

export interface Order {
  id: string;
  maquinaId: string;
  lecturaId: number | null;
  tipoFallo: TipoFallo | null;
  modeloPrediccion?: string | null;
  confianzaPrediccion?: number | null;
  algoritmoClasificador: string | null;
  modeloClasificacion?: string | null;
  confianza: number | null;
  confianzaLider?: number | null;
  ensembleAvg: number | null;
  nivelRiesgo: NivelRiesgo;
  tecnicoId: number | null;
  tecnico?: { id: number; nombre: string; iniciales: string } | null;
  estado: EstadoOrden;
  solucionDescripcion: string | null;
  solucionTipo: SolucionTipo | null;
  observacionesOrden?: string | null;
  reasignadoMotivo?: string | null;
  reasignadoEn?: string | null;
  observacionTecnica?: {
    comentario: string | null;
    esFalla: boolean | null;
    esPrediccionCorrecta: boolean | null;
    esClasificacionCorrecta: boolean | null;
    decision?: string | null;
    fechaRegistro: string;
  } | null;
  detectadoEn: string;
  iniciadoEn: string | null;
  finalizadoEn: string | null;
  proximoReintentoAsignacion?: string | null;
  intentosAsignacion?: number;
  ragEstado?: 'pendiente' | 'aceptado' | 'rechazado';
  lectura?: SensorReading;
}

export interface OrderEvent {
  id: number;
  ordenId: string;
  etapa: EtapaOrden;
  descripcion: string | null;
  actor: string | null;
  ocurridoEn: string;
}

export interface OrderDetail extends Order {
  eventos?: OrderEvent[];
  lectura?: SensorReading;
}

export interface Alert {
  id: string;
  ordenId: string | null;
  orderId?: string | null;
  maquinaId: string;
  nivel: NivelRiesgo;
  reglaCodigo: string | null;
  tipoFallo: TipoFallo | null;
  modeloPrediccion?: string | null;
  confianzaPrediccion?: number | null;
  modeloClasificacion?: string | null;
  confianzaLider?: number | null;
  ensembleAvg: number | null;
  tecnicoId: number | null;
  tecnico?: { id: number; nombre: string; iniciales: string } | null;
  proximoReintentoAsignacion?: string | null;
  estado: EstadoAlerta;
  ragEstado?: 'pendiente' | 'aceptado' | 'rechazado';
  notificacionEnviada: boolean;
  creadoEn: string;
}

export interface BinaryPrediction {
  id: number;
  ordenId: string;
  modelo: ModeloS1;
  prediccion: PrediccionBinariaResultado;
  probabilidad: number;
  accuracy: number | null;
  rocAuc: number | null;
  precision: number | null;
  recall: number | null;
  f1Score: number | null;
  esLider: boolean;
}

export interface MulticlassPrediction {
  id: number;
  ordenId: string;
  modelo: ModeloS2;
  tipoPredicho: TipoFallo;
  probHdf: number | null;
  probPwf: number | null;
  probTwf: number | null;
  probOsf: number | null;
  probRnf: number | null;
  f1Macro: number | null;
  accuracy: number | null;
  esLider: boolean;
  diverge: boolean;
}

export interface MachineAnalysis {
  maquinaId: string;
  prediccionesBinarias: BinaryPrediction[];
  prediccionesMulticlase: MulticlassPrediction[];
  ensembleAvg: number | null;
  agreement: string | null;
}

export interface RagAction {
  id: number;
  planId: number;
  orden: number;
  prioridad: PrioridadAccion;
  titulo: string;
  detalle: string | null;
}

export interface RagPlan {
  id: number;
  ordenId: string;
  orderId?: string;
  tipoFallo: TipoFallo;
  modeloOrigen: string | null;
  escalado: boolean;
  estado: EstadoPlanRag;
  generadoEn: string;
  acciones?: RagAction[];
  fuentes?: string[];
}

export interface RagSource {
  id: number;
  fuente: string;
  tipoFallo: TipoFallo | null;
  descripcion: string | null;
  activa: boolean;
}

export interface RepetitiveFault {
  id: number;
  maquinaId: string;
  tipoFallo: TipoFallo;
  ocurrencias: number;
  ventanaDias: number;
  estado: EstadoFalloRepetitivo;
  ultimaAccion: string | null;
  nivel: string | null;
  supervisorNotificado: boolean;
  ultimaOcurrenciaEn: string | null;
}

export interface DashboardKpis {
  maquinasActivas: number;
  alertasAbiertas: number;
  ordenesPendientes: number;
  ordenesFinalizadasHoy: number;
}

export interface AnalyticsSummary {
  totalAlertas: number;
  conRag: number;
  sinRag: number;
  pctConRag: number;
  sinAtender: number;
  range?: string;
}

export interface MlModelConfig {
  id: number;
  etapa: EtapaModelo;
  modelo: string;
  accuracy: number;
  metricaPrincipal: string | null;
  valorMetrica: number | null;
  activo: boolean;
  descripcion: string | null;
  umbral?: number;
}

export interface AppConfig {
  umbralEnsemble: number;
  agreementMinimo: string;
  modelosMl: MlModelConfig[];
}
