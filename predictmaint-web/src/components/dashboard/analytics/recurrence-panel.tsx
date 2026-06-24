'use client';

import type { MachineRecurrence } from '@/core/types/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { recurrenceSeverity } from '@/lib/utils/analytics';

export function RecurrencePanel({
  data,
  isLoading,
  ventanaDias = 7,
  minFallos = 2,
}: {
  data?: MachineRecurrence[];
  isLoading?: boolean;
  ventanaDias?: number;
  minFallos?: number;
}) {
  const rows = data ?? [];
  const max = Math.max(...rows.map((d) => d.fallos), 1);

  return (
    <Card className="h-full min-h-[320px]">
      <CardHeader>
        <div>
          <CardTitle>Máquinas con más fallos recurrentes</CardTitle>
          {/* <p className="mt-1 text-xs text-ink-muted">
            Esta semana · solo máquinas con {minFallos} o más fallos confirmados
          </p> */}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <Skeleton className="h-40 w-full" />
        ) : rows.length === 0 ? (
          <p className="py-8 text-center text-sm text-ink-muted">
            Ninguna máquina alcanzó {minFallos} fallos en los últimos {ventanaDias} días
          </p>
        ) : (
          rows.map((item) => {
            const severity = recurrenceSeverity(item.fallos, max);
            return (
              <div key={item.maquinaId} className="space-y-1.5">
                <div className="flex items-center justify-between gap-2 text-sm">
                  <span className="font-semibold text-ink">{item.maquinaId}</span>
                  <span className={`font-semibold tabular-nums ${severity.textClass}`}>
                    {item.fallos} fallos
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-surface-2">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${(item.fallos / max) * 100}%`,
                      background: severity.barColor,
                    }}
                  />
                </div>
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}
