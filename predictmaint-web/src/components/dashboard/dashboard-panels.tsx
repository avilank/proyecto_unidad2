'use client';

import Link from 'next/link';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { FAULT_COLORS, FAULT_LABELS } from '@/lib/constants/fault-types';

interface TrendPoint {
  timestamp: string;
  value: number;
  maquinaId?: string;
}

export function SensorChartPanel({
  data,
  isLoading,
}: {
  data?: TrendPoint[];
  isLoading?: boolean;
}) {
  const chartData =
    data?.map((d, i) => ({
      name: new Date(d.timestamp).toLocaleTimeString('es-PE', {
        hour: '2-digit',
        minute: '2-digit',
      }),
      value: d.value,
      key: i,
    })) ?? [];

  return (
    <Card className="h-full min-h-[280px]">
      <CardHeader>
        <CardTitle>Variables de Sensor — Últimas 24h</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-[200px] w-full" />
        ) : chartData.length === 0 ? (
          <p className="py-16 text-center text-sm text-ink-muted">Sin lecturas recientes</p>
        ) : (
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
              <XAxis dataKey="name" tick={{ fill: 'var(--color-ink-muted)', fontSize: 10 }} />
              <YAxis tick={{ fill: 'var(--color-ink-muted)', fontSize: 10 }} />
              <Tooltip
                contentStyle={{
                  background: 'var(--color-surface)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 8,
                }}
              />
              <ReferenceLine y={75} stroke="var(--color-danger)" strokeDasharray="4 4" label="Umbral" />
              <Bar dataKey="value" fill="var(--color-accent)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
        <div className="mt-3 flex flex-wrap gap-3 text-xs text-ink-muted">
          <span>Temp Aire</span>
          <span>Temp Proceso</span>
          <span>RPM</span>
          <span>Torque</span>
        </div>
      </CardContent>
    </Card>
  );
}

export function FaultBreakdownPanel({
  data,
  isLoading,
}: {
  data?: { tipoFallo: string; count: number }[];
  isLoading?: boolean;
}) {
  const max = Math.max(...(data?.map((d) => d.count) ?? [1]), 1);

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle>Tipos de Fallo — Hoy</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <Skeleton className="h-32 w-full" />
        ) : !data?.length ? (
          <p className="text-sm text-ink-muted">Sin fallos registrados</p>
        ) : (
          data.map((item) => (
            <div key={item.tipoFallo} className="space-y-1">
              <div className="flex justify-between text-sm">
                <span className="font-semibold text-ink">{item.tipoFallo}</span>
                <span className="text-ink-muted">{FAULT_LABELS[item.tipoFallo] ?? item.tipoFallo}</span>
                <span className="font-bold text-ink">{item.count}</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-surface-2">
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${(item.count / max) * 100}%`,
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

export function MachineStatusPanel({
  machines,
  isLoading,
}: {
  machines?: { id: string; tipo: string; estadoOperativo: string }[];
  isLoading?: boolean;
}) {
  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle>Estado de Máquinas</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {isLoading ? (
          <Skeleton className="h-32 w-full" />
        ) : (
          machines?.map((m) => (
            <Link
              key={m.id}
              href={`/dashboard/analysis/${m.id}`}
              className="flex items-center justify-between rounded-md border border-border-soft px-3 py-2 transition-colors hover:bg-surface-2"
            >
              <div>
                <span className="font-semibold text-ink">{m.id}</span>
                <span className="ml-2 text-xs text-ink-muted">Tipo {m.tipo}</span>
              </div>
              <MachineStatusBadge estado={m.estadoOperativo} />
            </Link>
          ))
        )}
      </CardContent>
    </Card>
  );
}

function MachineStatusBadge({ estado }: { estado: string }) {
  const map: Record<string, { label: string; className: string }> = {
    operacion: { label: 'NORMAL', className: 'bg-success/15 text-success' },
    alerta: { label: 'ALERTA', className: 'bg-warning/15 text-warning' },
    fallo: { label: 'FALLO', className: 'bg-danger/15 text-danger' },
    mantenimiento: { label: 'MANT.', className: 'bg-ink-muted/15 text-ink-muted' },
  };
  const s = map[estado] ?? map.operacion;
  return (
    <span className={`rounded-md px-2 py-0.5 text-xs font-bold ${s.className}`}>
      {s.label}
    </span>
  );
}
