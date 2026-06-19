'use client';

import type { FaultByType } from '@/core/types/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { FAULT_COLORS, FAULT_LABELS, FAULT_TYPE_ORDER } from '@/lib/constants/fault-types';

export function FaultAnalyticsPanel({
  data,
  isLoading,
}: {
  data?: FaultByType[];
  isLoading?: boolean;
}) {
  const rows =
    data && data.length > 0
      ? data
      : FAULT_TYPE_ORDER.map((tipoFallo) => ({ tipoFallo, count: 0 }));

  const max = Math.max(...rows.map((d) => d.count), 1);

  return (
    <Card className="h-full min-h-[320px]">
      <CardHeader>
        <CardTitle>Fallos por tipo — Semana actual</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <Skeleton className="h-40 w-full" />
        ) : (
          rows.map((item) => (
            <div key={item.tipoFallo} className="space-y-1.5">
              <div className="flex items-center justify-between gap-2 text-sm">
                <span className="min-w-0 truncate">
                  <span
                    className="font-bold"
                    style={{ color: FAULT_COLORS[item.tipoFallo] ?? 'var(--color-accent)' }}
                  >
                    {item.tipoFallo}
                  </span>
                  <span className="text-ink-muted">
                    {' '}
                    · {FAULT_LABELS[item.tipoFallo] ?? item.tipoFallo}
                  </span>
                  {item.tipoFallo === 'RNF' && item.count === 0 && (
                    <span className="text-ink-muted"> (sin casos)</span>
                  )}
                </span>
                <span className="shrink-0 font-bold text-ink">{item.count}</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-surface-2">
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: item.count > 0 ? `${(item.count / max) * 100}%` : '0%',
                    background: FAULT_COLORS[item.tipoFallo] ?? 'var(--color-accent)',
                  }}
                />
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
