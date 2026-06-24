'use client';

import type { AnalyticsSummary } from '@/core/entities';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { buildRagBreakdown } from '@/lib/utils/analytics';

const SEGMENTS = [
  {
    key: 'conRag' as const,
    label: 'Cerradas con plan RAG',
    shortLabel: 'Con RAG',
    color: 'var(--color-success)',
    valueClass: 'text-success',
  },
  {
    key: 'sinRag' as const,
    label: 'Cerradas con solución propia',
    shortLabel: 'Solución propia',
    color: 'var(--color-warning)',
    valueClass: 'text-warning',
  },
  {
    key: 'sinAtender' as const,
    label: 'Pendientes o en curso',
    shortLabel: 'Abiertas',
    color: 'var(--color-danger)',
    valueClass: 'text-danger',
  },
];

export function RagEffectivenessPanel({
  summary,
  isLoading,
}: {
  summary?: AnalyticsSummary;
  isLoading?: boolean;
}) {
  const stats = buildRagBreakdown(summary);

  return (
    <Card className="h-full min-h-[320px]">
      <CardHeader>
        <CardTitle>Efectividad del sistema</CardTitle>
        {/* <p className="text-xs text-ink-muted">
            Solo fallas con S-2 y técnico asignado · cada orden en una sola categoría (suman 100 %)
        </p> */}
      </CardHeader>
      <CardContent className="space-y-5">
        {isLoading ? (
          <Skeleton className="h-40 w-full" />
        ) : stats.total === 0 ? (
          <p className="py-8 text-center text-sm text-ink-muted">
            Sin órdenes registradas esta semana
          </p>
        ) : (
          <>
            <p className="text-sm text-ink-soft">
              <span className="font-semibold text-ink">{stats.total}</span> fallas confirmadas ·{' '}
              <span className="text-success">{stats.cerradas} cerradas</span> ·{' '}
              <span className="text-danger">{stats.abiertas} abiertas</span>
            </p>

            <div className="flex h-3 overflow-hidden rounded-full bg-surface-2">
              {SEGMENTS.map((seg) => {
                const value = stats[seg.key];
                const pct = stats.total ? (value / stats.total) * 100 : 0;
                if (value <= 0) return null;
                return (
                  <div
                    key={seg.key}
                    style={{ width: `${pct}%`, background: seg.color }}
                    title={`${seg.shortLabel}: ${value} (${Math.round(pct)}%)`}
                  />
                );
              })}
            </div>

            <div className="space-y-3">
              {SEGMENTS.map((seg) => (
                <EffectivenessRow
                  key={seg.key}
                  color={seg.color}
                  valueClass={seg.valueClass}
                  label={seg.label}
                  count={stats[seg.key]}
                  pct={stats.total ? Math.round((stats[seg.key] / stats.total) * 100) : 0}
                />
              ))}
            </div>

            {stats.cerradas > 0 && (
              <p className="rounded-md border border-border-soft bg-surface-2 px-3 py-2 text-xs text-ink-muted">
                De las <strong className="text-ink">{stats.cerradas}</strong> órdenes cerradas,{' '}
                <strong className="text-success">{stats.pctRagEntreCerradas}%</strong> siguieron el
                plan RAG ({stats.conRag} de {stats.cerradas}).
              </p>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

function EffectivenessRow({
  color,
  valueClass,
  label,
  count,
  pct,
}: {
  color: string;
  valueClass: string;
  label: string;
  count: number;
  pct: number;
}) {
  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      <div className="flex min-w-0 items-center gap-2">
        <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: color }} />
        <span className="text-ink-soft">{label}</span>
      </div>
      <span className={`shrink-0 font-semibold tabular-nums ${valueClass}`}>
        {count} · {pct}%
      </span>
    </div>
  );
}
