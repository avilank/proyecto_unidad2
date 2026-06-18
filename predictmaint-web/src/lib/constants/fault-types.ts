import type { LucideIcon } from 'lucide-react';
import { Flame, Gauge, Shuffle, Wrench, Zap } from 'lucide-react';
import type { TipoFallo } from '@/core/types';

export const FAULT_TYPE_ORDER: TipoFallo[] = ['HDF', 'PWF', 'TWF', 'OSF', 'RNF'];

export const FAULT_COLORS: Record<string, string> = {
  HDF: 'var(--color-danger)',
  PWF: 'var(--color-warning)',
  TWF: 'var(--color-accent)',
  OSF: 'var(--color-success)',
  RNF: 'var(--color-ink-muted)',
};

export const FAULT_LABELS: Record<string, string> = {
  HDF: 'Heat Dissipation',
  PWF: 'Power Failure',
  TWF: 'Tool Wear',
  OSF: 'Overstrain',
  RNF: 'Random',
};

export const FAULT_KPI_TONE: Record<
  string,
  'accent' | 'danger' | 'success' | 'warning'
> = {
  HDF: 'danger',
  PWF: 'warning',
  TWF: 'accent',
  OSF: 'success',
  RNF: 'accent',
};

export const FAULT_ICONS: Record<string, LucideIcon> = {
  HDF: Flame,
  PWF: Zap,
  TWF: Wrench,
  OSF: Gauge,
  RNF: Shuffle,
};

export function emptyFaultCounts(): Record<TipoFallo, number> {
  return { HDF: 0, PWF: 0, TWF: 0, OSF: 0, RNF: 0 };
}
