'use client';

import type { ValidationStageSummary } from '@/core/types/api';
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

const STAGE_COLORS = {
  aprobados: 'var(--color-success)',
  rechazados: 'var(--color-danger)',
};

export function ValidationStagePiePanel({
  title,
  subtitle,
  data,
  isLoading,
}: {
  title: string;
  subtitle: string;
  data?: ValidationStageSummary;
  isLoading?: boolean;
}) {
  if (isLoading) {
    return <Skeleton className="h-[360px] w-full" />;
  }

  const chartData = data
    ? [
        { name: 'Aprobados', value: data.aprobados, key: 'aprobados' as const },
        { name: 'Rechazados', value: data.rechazados, key: 'rechazados' as const },
      ].filter((d) => d.value > 0)
    : [];

  const total = data?.total ?? 0;
  const hasData = total > 0 && chartData.length > 0;

  return (
    <Card className="h-full min-h-[360px]">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <p className="text-xs text-ink-muted">{subtitle}</p>
      </CardHeader>
      <CardContent className="space-y-4">
        {!hasData ? (
          <p className="py-12 text-center text-sm text-ink-muted">
            Sin validaciones del técnico en el rango seleccionado
          </p>
        ) : (
          <>
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie
                  data={chartData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={52}
                  outerRadius={78}
                  paddingAngle={2}
                >
                  {chartData.map((entry) => (
                    <Cell key={entry.key} fill={STAGE_COLORS[entry.key]} />
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
                  label: 'Aprobados',
                  count: data!.aprobados,
                  color: STAGE_COLORS.aprobados,
                },
                {
                  label: 'Rechazados',
                  count: data!.rechazados,
                  color: STAGE_COLORS.rechazados,
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
              {total} {total === 1 ? 'orden validada' : 'órdenes validadas'} en el rango
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
}
