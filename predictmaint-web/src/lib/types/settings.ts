export type DispatchScheduleItem = {
  id: string;
  evento: string;
  descripcion: string;
  hora: string | null;
  activo: boolean;
  auto: boolean;
};

export type SystemConfigResponse = {
  umbral_ensemble_falla: string;
  agreement_minimo_s3: string;
  riesgo_bajo: string;
  riesgo_medio: string;
  riesgo_alto: string;
  riesgo_critico: string;
  tiempo_escalamiento: string;
  horarios_envio: DispatchScheduleItem[];
};

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
