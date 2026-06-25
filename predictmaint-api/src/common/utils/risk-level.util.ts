import { NivelRiesgo } from '../enums';

export interface RiskThresholds {
  bajo: number;
  medio: number;
  alto: number;
}

/**
 * Mapea un score del modelo (0-1) a un nivel de riesgo según los umbrales
 * configurados en `configuracion_alertas`. Los umbrales son límites superiores:
 * LOW < bajo ≤ MEDIUM < medio ≤ HIGH < alto ≤ CRITICAL.
 */
export function nivelRiesgoFromScore(
  score: number,
  t: RiskThresholds,
): NivelRiesgo {
  if (score < t.bajo) return NivelRiesgo.LOW;
  if (score < t.medio) return NivelRiesgo.MEDIUM;
  if (score < t.alto) return NivelRiesgo.HIGH;
  return NivelRiesgo.CRITICAL;
}

/** Lee umbrales de un registro de configuración con defaults seguros. */
export function riskThresholdsFromConfig(cfg?: {
  riesgoBajo?: number;
  riesgoMedio?: number;
  riesgoAlto?: number;
} | null): RiskThresholds {
  return {
    bajo: Number(cfg?.riesgoBajo) || 0.4,
    medio: Number(cfg?.riesgoMedio) || 0.65,
    alto: Number(cfg?.riesgoAlto) || 0.85,
  };
}
