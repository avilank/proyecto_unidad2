'use client';

import { useMemo, useState } from 'react';
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
import type { Alert } from '@/core/entities';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { StatusPill } from '@/components/ui/status-pill';
import { FAULT_COLORS, FAULT_LABELS, FAULT_TYPE_ORDER } from '@/lib/constants/fault-types';
import {
  sortMachinesByDashboardStatus,
  type MachineDashboardStatus,
} from '@/lib/utils/dashboard';

interface TrendPoint {
  timestamp: string;
  value: number;
  maquinaId?: string;
}

const SENSOR_VARIABLES = [
  { key: 'rotationalSpeed', label: 'RPM', color: 'var(--color-accent)' },
  { key: 'airTemperature', label: 'Temp Aire', color: 'var(--color-warning)' },
  { key: 'processTemperature', label: 'Temp Proceso', color: 'var(--color-danger)' },
  { key: 'torque', label: 'Torque', color: 'var(--color-success)' },
  { key: 'toolWear', label: 'Desgaste', color: 'var(--color-ink-soft)' },
] as const;

const SENSOR_THRESHOLD: Record<string, number> = {
  rotationalSpeed: 1800,
  airTemperature: 305,
  processTemperature: 310,
  torque: 45,
  toolWear: 200,
};

export function SensorChartPanel({
  data,
  isLoading,
  variable = 'rotationalSpeed',
  onVariableChange,
  machines = [],
  maquinaId = '',
  onMaquinaChange,
}: {
  data?: TrendPoint[];
  isLoading?: boolean;
  variable?: string;
  onVariableChange?: (variable: string) => void;
  machines?: { id: string; tipo: string }[];
  maquinaId?: string;
  onMaquinaChange?: (maquinaId: string) => void;
}) {
  const [internalVariable, setInternalVariable] = useState('rotationalSpeed');
  const [internalMaquinaId, setInternalMaquinaId] = useState('');
  const selected = onVariableChange ? variable : internalVariable;
  const setSelected = onVariableChange ?? setInternalVariable;
  const selectedMachine = onMaquinaChange ? maquinaId : internalMaquinaId;
  const setSelectedMachine = onMaquinaChange ?? setInternalMaquinaId;

  const chartData =
    data?.map((d, i) => ({
      name: new Date(d.timestamp).toLocaleTimeString('es-PE', {
        hour: '2-digit',
        minute: '2-digit',
      }),
      value: d.value,
      maquinaId: d.maquinaId,
      key: i,
    })) ?? [];

  const threshold = SENSOR_THRESHOLD[selected] ?? 75;
  const activeMeta = SENSOR_VARIABLES.find((v) => v.key === selected) ?? SENSOR_VARIABLES[0];

  return (
    <Card className="h-full min-h-[320px]">
      <CardHeader className="flex-col items-stretch gap-2.5 space-y-0">
        <CardTitle>Variables de Sensor — Últimas 24h</CardTitle>
        <div className="grid w-full grid-cols-2 gap-2">
          <select
            value={selectedMachine}
            onChange={(e) => setSelectedMachine(e.target.value)}
            className="min-w-0 w-full rounded-md border border-border-soft bg-surface-2 px-3 py-1.5 text-xs text-ink"
            aria-label="Máquina"
          >
            <option value="">Todas las máquinas</option>
            {machines.map((m) => (
              <option key={m.id} value={m.id}>
                {m.id} · Tipo {m.tipo}
              </option>
            ))}
          </select>
          <select
            value={selected}
            onChange={(e) => setSelected(e.target.value)}
            className="min-w-0 w-full rounded-md border border-border-soft bg-surface-2 px-3 py-1.5 text-xs text-ink"
            aria-label="Variable de sensor"
          >
            {SENSOR_VARIABLES.map((item) => (
              <option key={item.key} value={item.key}>
                {item.label}
              </option>
            ))}
          </select>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-[220px] w-full" />
        ) : chartData.length === 0 ? (
          <div className="flex h-[220px] flex-col items-center justify-center rounded-md border border-dashed border-border-soft bg-surface-2/40">
            <p className="text-sm text-ink-muted">Sin lecturas recientes</p>
            <p className="mt-1 text-xs text-ink-muted">Ejecuta el simulador para generar datos</p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={220}>
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
                formatter={(value, _name, item) => {
                  const payload = item?.payload as { maquinaId?: string } | undefined;
                  const machineLabel = payload?.maquinaId ? ` · ${payload.maquinaId}` : '';
                  return [
                    typeof value === 'number' ? `${value.toFixed(1)}${machineLabel}` : '—',
                    activeMeta.label,
                  ];
                }}
              />
              <ReferenceLine
                y={threshold}
                stroke="var(--color-danger)"
                strokeDasharray="4 4"
                label={{
                  value: 'Umbral fallo',
                  position: 'insideTopRight',
                  fill: 'var(--color-danger)',
                  fontSize: 10,
                }}
              />
              <Bar dataKey="value" fill={activeMeta.color} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
        <div className="mt-4 flex flex-wrap gap-4 text-xs text-ink-muted">
          {SENSOR_VARIABLES.map((item) => (
            <span key={item.key} className="inline-flex items-center gap-1.5">
              <span
                className="h-2 w-2 rounded-full"
                style={{ background: item.color }}
                aria-hidden
              />
              {item.label}
            </span>
          ))}
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
  const rows =
    data && data.length > 0
      ? data
      : FAULT_TYPE_ORDER.filter((t) => t !== 'RNF').map((tipoFallo) => ({
          tipoFallo,
          count: 0,
        }));

  const max = Math.max(...rows.map((d) => d.count), 1);

  return (
    <Card className="h-full min-h-[320px]">
      <CardHeader>
        <CardTitle>Tipos de Fallo — Hoy</CardTitle>
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

export function MachineStatusPanel({
  machines,
  activeAlerts,
  isLoading,
}: {
  machines?: { id: string; tipo: string }[];
  activeAlerts?: Alert[];
  isLoading?: boolean;
}) {
  const sortedMachines = useMemo(
    () => sortMachinesByDashboardStatus(machines ?? [], activeAlerts ?? []),
    [machines, activeAlerts],
  );

  return (
    <Card className="h-full min-h-[320px]">
      <CardHeader>
        <CardTitle>Estado de Máquinas</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {isLoading ? (
          <Skeleton className="h-40 w-full" />
        ) : (
          sortedMachines.map((m) => (
            <Link
              key={m.id}
              href={`/dashboard/analysis/${m.id}`}
              className="flex items-center justify-between rounded-md border border-border-soft px-3 py-2 transition-colors hover:bg-surface-2"
            >
              <div>
                <span className="font-semibold text-ink">{m.id}</span>
                <span className="ml-2 text-xs text-ink-muted">Tipo {m.tipo}</span>
              </div>
              <MachineDashboardBadge status={m.status} />
            </Link>
          ))
        )}
      </CardContent>
    </Card>
  );
}

function MachineDashboardBadge({ status }: { status: MachineDashboardStatus }) {
  const map: Record<
    MachineDashboardStatus,
    { label: string; pill: 'normal' | 'alerta' | 'fallo' }
  > = {
    normal: { label: 'NORMAL', pill: 'normal' },
    alerta: { label: 'ALERTA', pill: 'alerta' },
    fallo: { label: 'FALLO', pill: 'fallo' },
  };
  const item = map[status];
  return <StatusPill status={item.pill} label={item.label} />;
}

export function MachineStatusBadge({ estado }: { estado: string }) {
  const map: Record<string, { label: string; pill: 'normal' | 'alerta' | 'fallo' | 'mantenimiento' }> =
    {
      operacion: { label: 'NORMAL', pill: 'normal' },
      alerta: { label: 'ALERTA', pill: 'alerta' },
      fallo: { label: 'FALLO', pill: 'fallo' },
      mantenimiento: { label: 'MANT.', pill: 'mantenimiento' },
    };
  const s = map[estado] ?? map.operacion;
  return <StatusPill status={s.pill} label={s.label} />;
}
