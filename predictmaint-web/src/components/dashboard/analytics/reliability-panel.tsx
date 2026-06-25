'use client';

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import type { ReliabilityMachine, ReliabilityResponse } from '@/core/types/api';

const TOOLTIP_STYLE = {
  background: 'var(--color-surface)',
  border: '1px solid var(--color-border)',
  borderRadius: 8,
  fontSize: 12,
} as const;

/** MTBF: horas o días si el máximo ≥ 48 h. */
function pickMtbfUnit(values: (number | null)[]): { div: number; label: string; decimals: number } {
  const nums = values.filter((v): v is number => v != null);
  const max = nums.length ? Math.max(...nums) : 0;
  return max >= 48
    ? { div: 24, label: 'días', decimals: 1 }
    : { div: 1, label: 'horas', decimals: 1 };
}

/** MTTR: minutos si < 1 h, horas si < 48 h, días si ≥ 48 h. */
function pickMttrUnit(values: (number | null)[]): { div: number; label: string; decimals: number } {
  const nums = values.filter((v): v is number => v != null);
  const max = nums.length ? Math.max(...nums) : 0;
  if (max < 1) return { div: 1 / 60, label: 'min', decimals: 0 };
  if (max >= 48) return { div: 24, label: 'días', decimals: 1 };
  return { div: 1, label: 'horas', decimals: 1 };
}

function fmtMttr(h: number | null): string {
  if (h == null) return '—';
  if (h < 1) return `${Math.round(h * 60)} min`;
  if (h >= 48) return `${Math.round((h / 24) * 10) / 10} d`;
  return `${h} h`;
}

function fmtMtbf(h: number | null): string {
  if (h == null) return '—';
  return h >= 48 ? `${Math.round((h / 24) * 10) / 10} d` : `${h} h`;
}

function MiniMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border-soft bg-surface-2 p-3">
      <p className="text-xs text-ink-muted">{label}</p>
      <p className="mt-1 text-xl font-bold text-ink">{value}</p>
    </div>
  );
}

function ReliabilityBars({
  rows,
  metric,
  color,
  unitLabel,
  div,
  decimals,
}: {
  rows: ReliabilityMachine[];
  metric: 'mttrHoras' | 'mtbfHoras';
  color: string;
  unitLabel: string;
  div: number;
  decimals: number;
}) {
  const data = rows
    .filter((r) => r[metric] != null)
    .map((r) => {
      const raw = (r[metric] as number) / div;
      const valor =
        decimals === 0 ? Math.round(raw) : Math.round(raw * 10) / 10;
      return { maquinaId: r.maquinaId, valor };
    });

  if (data.length === 0) {
    return (
      <p className="py-12 text-center text-sm text-ink-muted">
        Sin datos suficientes en el rango
      </p>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
        <XAxis dataKey="maquinaId" tick={{ fontSize: 11, fill: 'var(--color-ink-muted)' }} />
        <YAxis tick={{ fontSize: 11, fill: 'var(--color-ink-muted)' }} />
        <Tooltip
          contentStyle={TOOLTIP_STYLE}
          cursor={{ fill: 'var(--color-surface-2)' }}
          formatter={(v) => [`${v} ${unitLabel}`, '']}
        />
        <Bar dataKey="valor" name={unitLabel} fill={color} radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function ReliabilityPanel({
  data,
  isLoading,
}: {
  data?: ReliabilityResponse;
  isLoading?: boolean;
}) {
  if (isLoading) return <Skeleton className="h-[420px] w-full" />;

  const rows = data?.porMaquina ?? [];
  const mttrUnit = pickMttrUnit(rows.map((r) => r.mttrHoras));
  const mtbfUnit = pickMtbfUnit(rows.map((r) => r.mtbfHoras));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Confiabilidad — MTTR y MTBF</CardTitle>
        <p className="text-xs text-ink-muted">
          MTTR = tiempo medio de reparación (menos es mejor) · MTBF = tiempo medio entre
          fallas (más es mejor)
        </p>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <MiniMetric label="MTTR global" value={fmtMttr(data?.global.mttrHoras ?? null)} />
          <MiniMetric label="MTBF global" value={fmtMtbf(data?.global.mtbfHoras ?? null)} />
          <MiniMetric label="Reparaciones" value={String(data?.global.reparaciones ?? 0)} />
          <MiniMetric label="Fallas" value={String(data?.global.fallas ?? 0)} />
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <div>
            <p className="mb-2 text-sm font-semibold text-ink">
              MTTR por máquina{' '}
              <span className="text-xs font-normal text-ink-muted">({mttrUnit.label})</span>
            </p>
            <ReliabilityBars
              rows={rows.filter((r) => r.reparaciones > 0)}
              metric="mttrHoras"
              color="var(--color-warning)"
              unitLabel={mttrUnit.label}
              div={mttrUnit.div}
              decimals={mttrUnit.decimals}
            />
          </div>
          <div>
            <p className="mb-2 text-sm font-semibold text-ink">
              MTBF por máquina{' '}
              <span className="text-xs font-normal text-ink-muted">({mtbfUnit.label})</span>
            </p>
            <ReliabilityBars
              rows={rows}
              metric="mtbfHoras"
              color="var(--color-accent)"
              unitLabel={mtbfUnit.label}
              div={mtbfUnit.div}
              decimals={mtbfUnit.decimals}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
