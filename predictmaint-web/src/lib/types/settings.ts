export type DispatchScheduleItem = {
  id: string;
  evento: string;
  descripcion: string;
  hora: string | null;
  activo: boolean;
  auto: boolean;
};

export type TiemposAtencion = {
  LOW: number | null;
  MEDIUM: number | null;
  HIGH: number | null;
  CRITICAL: number | null;
};

export type RepetitiveThreshold = { veces: number; dias: number };

export type RepetitiveFaultsConfig = {
  umbrales: {
    marcar: RepetitiveThreshold;
    notificar: RepetitiveThreshold;
    rag: RepetitiveThreshold;
    ventanaDias: number;
  };
  notificaciones: {
    mark: boolean;
    supervisor: boolean;
    rag: boolean;
  };
};

export const DEFAULT_REPETITIVE_CONFIG: RepetitiveFaultsConfig = {
  umbrales: {
    marcar: { veces: 2, dias: 7 },
    notificar: { veces: 3, dias: 7 },
    rag: { veces: 2, dias: 7 },
    ventanaDias: 7,
  },
  notificaciones: { mark: true, supervisor: true, rag: true },
};

export type EscalationAction = { tipoFallo: string; acciones: string };

export type RepetitiveMachine = {
  id: number;
  maquinaId: string;
  tipoFallo: string | null;
  ocurrencias: number;
  ventanaDias: number;
  estado: string;
  nivel: string | null;
  ultimaAccion: string | null;
  supervisorNotificado: boolean;
  ultimaOcurrenciaEn: string | null;
};

export type SystemConfigResponse = {
  umbral_ensemble_falla: string;
  agreement_minimo_s3: string;
  riesgo_bajo: string;
  riesgo_medio: string;
  riesgo_alto: string;
  riesgo_critico: string;
  tiempo_escalamiento: string;
  tiempos_atencion: TiemposAtencion;
  fallos_repetitivos: RepetitiveFaultsConfig;
  horarios_envio: DispatchScheduleItem[];
};

export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export type NotificationRule = {
  nivel: RiskLevel | string;
  recibe: string;
  canal: string;
};

/** Opciones de canal que el backend de notificaciones interpreta por substring. */
export const CHANNEL_OPTIONS: { value: string; label: string }[] = [
  { value: '—', label: 'Sin notificación' },
  { value: 'WhatsApp', label: 'WhatsApp' },
  { value: 'Email', label: 'Email' },
  { value: 'WhatsApp + Email', label: 'WhatsApp + Email' },
];

/** Destinatarios posibles por nivel (gobiernan a quién se notifica). */
export const RECIBE_OPTIONS: string[] = [
  'Nadie',
  'Técnico asignado',
  'Técnico + Supervisor',
  'Supervisor',
];

/** Normaliza cualquier texto de destinatario a una de las opciones canónicas. */
export function normalizeRecibe(recibe: string | null | undefined): string {
  const r = (recibe ?? '').toLowerCase();
  const tec = r.includes('técnico') || r.includes('tecnico');
  const sup = r.includes('supervisor') || r.includes('jefe');
  if (tec && sup) return 'Técnico + Supervisor';
  if (tec) return 'Técnico asignado';
  if (sup) return 'Supervisor';
  return 'Nadie';
}

/** Normaliza cualquier texto de canal a una de las opciones canónicas. */
export function normalizeChannel(canal: string | null | undefined): string {
  const c = (canal ?? '').toLowerCase();
  const wsp = c.includes('whats');
  const email = c.includes('email') || c.includes('correo');
  if (wsp && email) return 'WhatsApp + Email';
  if (wsp) return 'WhatsApp';
  if (email) return 'Email';
  return '—';
}

export type AgreementMinimo = 'BAJO' | 'MEDIO' | 'ALTO';

export const AGREEMENT_OPTIONS: { value: AgreementMinimo; label: string; hint: string }[] = [
  { value: 'BAJO', label: 'BAJO', hint: '1/3' },
  { value: 'MEDIO', label: 'MEDIO', hint: '2/3' },
  { value: 'ALTO', label: 'ALTO', hint: '3/3' },
];

export const DATASET_INFO = {
  titulo: 'Dataset — AI4I 2020',
  subtitulo: 'Kaggle · CC BY-NC-SA 4.0 · Stephan Matzka',
  leftColumn: [
    ['Total registros', '10,000'],
    ['Tasa de fallo', '3.4%'],
    ['HDF', '115 casos'],
    ['TWF', '46 casos'],
    ['RNF', '5 casos'],
  ] as const,
  rightColumn: [
    ['Variables', '14'],
    ['Tipo de problema', 'Clasificación'],
    ['PWF', '95 casos'],
    ['OSF', '98 casos'],
  ] as const,
};
