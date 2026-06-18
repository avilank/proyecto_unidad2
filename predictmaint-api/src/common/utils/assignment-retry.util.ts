import { NivelRiesgo } from '../enums';

const DEFAULT_MINUTES: Record<string, number> = {
  [NivelRiesgo.CRITICAL]: 15,
  [NivelRiesgo.HIGH]: 15,
  [NivelRiesgo.MEDIUM]: 30,
  [NivelRiesgo.LOW]: 60,
};

const CONFIG_KEYS: Record<string, string> = {
  [NivelRiesgo.CRITICAL]: 'reintento_asignacion_critical_min',
  [NivelRiesgo.HIGH]: 'reintento_asignacion_high_min',
  [NivelRiesgo.MEDIUM]: 'reintento_asignacion_medium_min',
  [NivelRiesgo.LOW]: 'reintento_asignacion_low_min',
};

export function configKeyForReintento(nivel: NivelRiesgo): string {
  return CONFIG_KEYS[nivel] ?? CONFIG_KEYS[NivelRiesgo.MEDIUM];
}

export function defaultReintentoMinutos(nivel: NivelRiesgo): number {
  return DEFAULT_MINUTES[nivel] ?? 30;
}

/** Mapea texto de especialidad_requerida (tipo_fallo) → enum Especialidad. */
export function specialtyFromFaultLabel(label: string): string | null {
  const lower = label.toLowerCase();
  if (lower.includes('eléctric') || lower.includes('electric')) return 'electrico';
  if (lower.includes('hidrául') || lower.includes('hidraul') || lower.includes('térmic') || lower.includes('termic')) {
    return 'hidraulico';
  }
  if (lower.includes('mecánic') || lower.includes('mecanic')) return 'mecanico';
  if (lower.includes('general')) return 'general';
  return null;
}
