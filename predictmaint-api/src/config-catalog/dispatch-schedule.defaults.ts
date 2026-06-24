export type DispatchScheduleItem = {
  id: string;
  evento: string;
  descripcion: string;
  hora: string | null;
  activo: boolean;
  auto: boolean;
};

export const DEFAULT_DISPATCH_SCHEDULE: DispatchScheduleItem[] = [
  {
    id: 'turno_inicio',
    evento: 'Inicio de turno siguiente',
    descripcion: 'Resumen turno anterior → técnico entrante',
    hora: '06:00',
    activo: true,
    auto: false,
  },
  {
    id: 'mitad_turno',
    evento: 'Mitad de turno',
    descripcion: 'Estado parcial → supervisor en turno',
    hora: '14:00',
    activo: true,
    auto: false,
  },
  {
    id: 'fin_turno',
    evento: 'Fin de turno',
    descripcion: 'Resumen total antes del cierre',
    hora: '22:00',
    activo: false,
    auto: false,
  },
  {
    id: 'critical',
    evento: 'Alerta CRITICAL inmediata',
    descripcion: 'Instantáneo al detectar riesgo crítico',
    hora: null,
    activo: true,
    auto: true,
  },
];

export function parseDispatchSchedule(raw?: string | null): DispatchScheduleItem[] {
  if (!raw?.trim()) return DEFAULT_DISPATCH_SCHEDULE;
  try {
    const parsed = JSON.parse(raw) as DispatchScheduleItem[];
    if (!Array.isArray(parsed) || !parsed.length) return DEFAULT_DISPATCH_SCHEDULE;
    return parsed;
  } catch {
    return DEFAULT_DISPATCH_SCHEDULE;
  }
}
