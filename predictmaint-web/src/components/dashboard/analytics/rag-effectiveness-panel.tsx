'use client';

import type { AnalyticsSummary } from '@/core/entities';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { buildRagBreakdown } from '@/lib/utils/analytics';

const SEGMENTS = [
  {
    key: 'conRag',
    label: 'RAG',
    color: 'var(--color-success)',
    valueClass: 'text-success',
  },
  {
    key: 'sinRag',
    label: 'Sin RAG',
    color: 'var(--color-warning)',
    valueClass: 'text-warning',
  },
  {
    key: 'sinAtender',
    label: 'Sin atender',
    color: 'var(--color-danger)',
    valueClass: 'text-danger',
  },
] as const;

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
      </CardHeader>
      <CardContent className="space-y-5">
        {isLoading ? (
          <Skeleton className="h-40 w-full" />
        ) : (
          <>
            <p className="text-sm text-ink-muted">
              <span className="font-semibold text-ink">{stats.total}</span> alertas en la semana
            </p>

            <div className="flex h-3 overflow-hidden rounded-full bg-surface-2">
              {SEGMENTS.map((seg) => {
                const value = stats[seg.key];
                const pct = stats.total ? (value / stats.total) * 100 : 0;
                if (pct <= 0) return null;
                return (
                  <div
                    key={seg.key}
                    style={{ width: `${pct}%`, background: seg.color }}
                    title={`${seg.label}: ${value}`}
                  />
                );
              })}
            </div>

            <div className="space-y-3">
              <EffectivenessRow
                color="var(--color-success)"
                valueClass="text-success"
                label="Resueltas con RAG"
                count={stats.conRag}
                pct={stats.pctConRag}
              />
              <EffectivenessRow
                color="var(--color-warning)"
                valueClass="text-warning"
                label="Sin RAG"
                count={stats.sinRag}
                pct={stats.pctSinRag}
              />
              <EffectivenessRow
                color="var(--color-danger)"
                valueClass="text-danger"
                label="Sin atender"
                count={stats.sinAtender}
                pct={stats.pctSinAtender}
              />
            </div>
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
      <div className="flex items-center gap-2">
        <span className="h-2.5 w-2.5 rounded-full" style={{ background: color }} />
        <span className="text-ink-soft">{label}</span>
      </div>
      <span className={`font-semibold tabular-nums ${valueClass}`}>
        {count} ({pct}%)
      </span>
    </div>
  );
}
