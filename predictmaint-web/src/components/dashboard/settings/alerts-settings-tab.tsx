'use client';

import { Badge } from '@/components/ui/badge';
import { SettingsAccentPanel } from '@/components/dashboard/settings/settings-controls';
import {
  CHANNEL_OPTIONS,
  RECIBE_OPTIONS,
  type NotificationRule,
  type RiskLevel,
  type TiemposAtencion,
} from '@/lib/types/settings';
import { cn } from '@/lib/utils/cn';

const RISK_META: {
  level: RiskLevel;
  variant: 'low' | 'medium' | 'high' | 'critical';
  borderClass: string;
}[] = [
  { level: 'LOW', variant: 'low', borderClass: 'border-risk-low text-risk-low' },
  { level: 'MEDIUM', variant: 'medium', borderClass: 'border-accent text-accent' },
  { level: 'HIGH', variant: 'high', borderClass: 'border-risk-high text-risk-high' },
  { level: 'CRITICAL', variant: 'critical', borderClass: 'border-risk-critical text-risk-critical' },
];

const ATTENTION_META: {
  level: RiskLevel;
  variant: 'low' | 'medium' | 'high' | 'critical';
  escalatesTo: string;
  borderClass: string;
  editable: boolean;
}[] = [
  { level: 'LOW', variant: 'low', escalatesTo: '—', borderClass: 'border-risk-low text-risk-low', editable: false },
  { level: 'MEDIUM', variant: 'medium', escalatesTo: 'Supervisor', borderClass: 'border-accent text-accent', editable: true },
  { level: 'HIGH', variant: 'high', escalatesTo: 'Supervisor + Jefe de planta', borderClass: 'border-risk-high text-risk-high', editable: true },
  { level: 'CRITICAL', variant: 'critical', escalatesTo: 'Supervisor + Jefe de planta', borderClass: 'border-risk-critical text-risk-critical', editable: true },
];

const SELECT_CLASS =
  'h-9 rounded-md border border-border bg-bg px-2.5 text-sm text-ink focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent';

export type ThresholdMap = Record<RiskLevel, number>;

/** Niveles cuyo umbral rompe la monotonía 0 < LOW < MEDIUM < HIGH < CRITICAL ≤ 1. */
export function invalidThresholdLevels(t: ThresholdMap): Set<RiskLevel> {
  const invalid = new Set<RiskLevel>();
  const order: RiskLevel[] = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
  let prev = 0;
  for (const level of order) {
    const v = t[level];
    if (!(v > prev) || v > 1) invalid.add(level);
    else prev = v;
  }
  return invalid;
}

function rangeOf(level: RiskLevel, t: ThresholdMap): string {
  const lower = level === 'LOW' ? 0 : level === 'MEDIUM' ? t.LOW : level === 'HIGH' ? t.MEDIUM : t.HIGH;
  return `${lower.toFixed(2)} — ${t[level].toFixed(2)}`;
}

function PanelHeader({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="flex flex-col gap-2 px-5 pb-4 pt-4 sm:flex-row sm:items-start sm:justify-between">
      <h3 className="text-base font-bold text-ink">{title}</h3>
      <p className="max-w-xs text-xs text-ink-muted sm:text-right">{subtitle}</p>
    </div>
  );
}

function RiskBadge({ level, variant }: { level: RiskLevel; variant: 'low' | 'medium' | 'high' | 'critical' }) {
  return (
    <Badge variant={variant} className="min-w-[4.5rem] justify-center font-bold uppercase tracking-wide">
      {level}
    </Badge>
  );
}

export function AlertsSettingsTab({
  thresholds,
  tiemposAtencion,
  notificationRules,
  onThresholdsChange,
  onTiemposAtencionChange,
  onNotificationRulesChange,
}: {
  thresholds: ThresholdMap;
  tiemposAtencion: TiemposAtencion;
  notificationRules: NotificationRule[];
  onThresholdsChange: (next: ThresholdMap) => void;
  onTiemposAtencionChange: (next: TiemposAtencion) => void;
  onNotificationRulesChange: (next: NotificationRule[]) => void;
}) {
  const invalid = invalidThresholdLevels(thresholds);

  const updateThreshold = (level: RiskLevel, value: string) => {
    const parsed = parseFloat(value);
    if (!Number.isNaN(parsed)) onThresholdsChange({ ...thresholds, [level]: parsed });
  };

  const updateTiempoAtencion = (level: RiskLevel, value: string) => {
    const parsed = parseInt(value, 10);
    onTiemposAtencionChange({
      ...tiemposAtencion,
      [level]: Number.isNaN(parsed) || parsed <= 0 ? null : parsed,
    });
  };

  const updateRule = (nivel: string, partial: Partial<NotificationRule>) => {
    onNotificationRulesChange(
      notificationRules.map((r) => (r.nivel === nivel ? { ...r, ...partial } : r)),
    );
  };

  return (
    <div className="grid gap-4 lg:grid-cols-2 lg:items-start">
      <div className="flex flex-col gap-4">
        <SettingsAccentPanel accent="accent">
          <PanelHeader
            title="Niveles de riesgo — ensemble_avg"
            subtitle="Define el umbral superior de cada nivel según el consenso de modelos"
          />
          <div className="mx-5 border-t border-border-soft" />
          <div className="space-y-3 px-5 pb-5 pt-4">
            {RISK_META.map((row) => (
              <div
                key={row.level}
                className="flex flex-col gap-3 rounded-lg border border-border bg-surface-2/35 p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  <RiskBadge level={row.level} variant={row.variant} />
                  <p className="font-mono text-xs text-ink-soft">{rangeOf(row.level, thresholds)}</p>
                </div>
                <input
                  type="number"
                  min={0}
                  max={1}
                  step={0.01}
                  value={thresholds[row.level]}
                  onChange={(e) => updateThreshold(row.level, e.target.value)}
                  className={cn(
                    'h-9 w-20 shrink-0 rounded-md border bg-bg px-2.5 text-center text-sm font-semibold [color-scheme:dark]',
                    invalid.has(row.level) ? 'border-danger text-danger' : row.borderClass,
                  )}
                />
              </div>
            ))}
            {invalid.size > 0 && (
              <p className="text-xs font-medium text-danger">
                Los umbrales deben crecer en orden: 0 &lt; LOW &lt; MEDIUM &lt; HIGH &lt; CRITICAL ≤ 1.
              </p>
            )}
          </div>
        </SettingsAccentPanel>

        <SettingsAccentPanel accent="success">
          <PanelHeader
            title="Reglas de notificación automática"
            subtitle="Quién recibe y por qué canal según el nivel de riesgo"
          />
          <div className="mx-5 border-t border-border-soft" />
          <div className="divide-y divide-border-soft px-5 pb-5">
            {notificationRules.length === 0 ? (
              <p className="py-6 text-center text-sm text-ink-muted">Cargando reglas…</p>
            ) : (
              notificationRules.map((rule) => (
                <div
                  key={rule.nivel}
                  className="flex flex-col gap-3 py-4 first:pt-4 last:pb-0 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="flex items-center gap-3">
                    <RiskBadge
                      level={rule.nivel as RiskLevel}
                      variant={rule.nivel.toLowerCase() as 'low' | 'medium' | 'high' | 'critical'}
                    />
                    <select
                      value={rule.recibe}
                      onChange={(e) => updateRule(rule.nivel, { recibe: e.target.value })}
                      className={cn(SELECT_CLASS, 'w-48')}
                    >
                      {RECIBE_OPTIONS.map((opt) => (
                        <option key={opt} value={opt}>
                          {opt}
                        </option>
                      ))}
                    </select>
                  </div>
                  <select
                    value={rule.canal}
                    onChange={(e) => updateRule(rule.nivel, { canal: e.target.value })}
                    className={cn(SELECT_CLASS, 'shrink-0')}
                  >
                    {CHANNEL_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
              ))
            )}
          </div>
        </SettingsAccentPanel>
      </div>

      <div className="flex flex-col gap-4">
        <SettingsAccentPanel accent="warning">
          <PanelHeader
            title="Tiempo límite de atención"
            subtitle="Si el técnico no responde a tiempo → escala al supervisor"
          />
          <div className="mx-5 border-t border-border-soft" />
          <div className="space-y-4 px-5 pb-5 pt-4">
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-muted">
                SLA por nivel — escalamiento automático
              </p>
              <div className="space-y-3">
                {ATTENTION_META.map((row) => {
                  const value = tiemposAtencion[row.level];
                  return (
                    <div
                      key={row.level}
                      className="flex flex-col gap-3 rounded-lg border border-border bg-surface-2/35 p-4 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="flex min-w-0 items-start gap-3">
                        <RiskBadge level={row.level} variant={row.variant} />
                        <div>
                          <p className="text-sm font-medium text-ink">
                            {value != null ? `${value} min` : 'No aplica'}
                          </p>
                          <p className="mt-0.5 text-xs text-ink-muted">→ Escala a: {row.escalatesTo}</p>
                        </div>
                      </div>
                      {row.editable ? (
                        <div className="flex shrink-0 items-center gap-2">
                          <input
                            type="number"
                            min={1}
                            max={1440}
                            step={1}
                            value={value ?? ''}
                            placeholder="min"
                            onChange={(e) => updateTiempoAtencion(row.level, e.target.value)}
                            className={cn(
                              'h-9 w-24 rounded-md border bg-bg px-2.5 text-center text-sm font-semibold [color-scheme:dark]',
                              row.borderClass,
                            )}
                          />
                          <span className="text-sm text-ink-muted">min</span>
                        </div>
                      ) : (
                        <span
                          className={cn(
                            'inline-flex h-9 shrink-0 items-center rounded-md border px-4 text-sm font-semibold',
                            row.borderClass,
                          )}
                        >
                          No aplica
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
              <p className="mt-2 text-xs text-ink-muted">
                Si una orden asignada supera estos minutos sin ser iniciada, el sistema la
                escala automáticamente al supervisor.
              </p>
            </div>
          </div>
        </SettingsAccentPanel>
      </div>
    </div>
  );
}
