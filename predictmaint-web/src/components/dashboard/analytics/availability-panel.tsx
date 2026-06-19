'use client';

import type { AvailabilitySnapshot } from '@/core/types/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { calcPct } from '@/lib/utils/analytics';
import {
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
} from 'recharts';

const MACHINE_COLORS = {
  operativas: 'var(--color-success)',
  enMantenimiento: 'var(--color-warning)',
};

export function AvailabilityPanel({
  data,
  isLoading,
}: {
  data?: AvailabilitySnapshot;
  isLoading?: boolean;
}) {
  if (isLoading) {
    return <Skeleton className="h-[360px] w-full max-w-xl" />;
  }

  if (!data) return null;

  const machineChart = [
    { name: 'Operativas', value: data.maquinas.operativas, key: 'operativas' },
    { name: 'En mantenimiento', value: data.maquinas.enMantenimiento, key: 'enMantenimiento' },
  ].filter((d) => d.value > 0);

  const total = data.maquinas.total;
  const hasData = total > 0 && machineChart.length > 0;

  return (
    <Card className="h-full min-h-[360px] max-w-xl">
      <CardHeader>
        <CardTitle>Disponibilidad de máquinas</CardTitle>
        <p className="text-xs text-ink-muted">
          En mantenimiento = orden pendiente o en progreso
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {!hasData ? (
          <p className="py-12 text-center text-sm text-ink-muted">Sin máquinas registradas</p>
        ) : (
          <>
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie
                  data={machineChart}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={52}
                  outerRadius={78}
                  paddingAngle={2}
                >
                  {machineChart.map((entry) => (
                    <Cell
                      key={entry.key}
                      fill={MACHINE_COLORS[entry.key as keyof typeof MACHINE_COLORS]}
                    />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    background: 'var(--color-surface)',
                    border: '1px solid var(--color-border)',
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                  formatter={(value, name) => [
                    `${Number(value ?? 0)} (${calcPct(Number(value ?? 0), total)}%)`,
                    String(name),
                  ]}
                />
                <Legend
                  verticalAlign="bottom"
                  height={36}
                  formatter={(value) => (
                    <span className="text-xs text-ink-soft">{value}</span>
                  )}
                />
              </PieChart>
            </ResponsiveContainer>

            <div className="space-y-2 border-t border-border-soft pt-3">
              {[
                {
                  label: 'Operativas',
                  count: data.maquinas.operativas,
                  color: MACHINE_COLORS.operativas,
                },
                {
                  label: 'En mantenimiento',
                  count: data.maquinas.enMantenimiento,
                  color: MACHINE_COLORS.enMantenimiento,
                },
              ].map((item) => (
                <div
                  key={item.label}
                  className="flex items-center justify-between gap-2 text-sm"
                >
                  <div className="flex items-center gap-2">
                    <span
                      className="h-2.5 w-2.5 rounded-full"
                      style={{ background: item.color }}
                    />
                    <span className="text-ink-soft">{item.label}</span>
                  </div>
                  <span className="font-semibold tabular-nums text-ink">
                    {item.count} · {calcPct(item.count, total)}%
                  </span>
                </div>
              ))}
            </div>

            <p className="text-xs text-ink-muted">
              {data.maquinas.detalleMantenimiento.length > 0
                ? `En mantenimiento: ${data.maquinas.detalleMantenimiento.join(', ')}`
                : 'Ninguna máquina con orden activa'}
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
}
