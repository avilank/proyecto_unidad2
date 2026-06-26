'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, Cpu, Gem, Settings } from 'lucide-react';
import type { Alert, Machine } from '@/core/entities';
import { Topbar } from '@/components/common/topbar';
import { AnimatedKpiCard } from '@/components/ui/animated-kpi-card';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { DataTable } from '@/components/ui/data-table';
import { StatusPill, alertEstadoToPill } from '@/components/ui/status-pill';
import { TableSkeleton } from '@/components/ui/skeleton';
import {
  FaultBreakdownPanel,
  MachineStatusPanel,
  SensorChartPanel,
} from '@/components/dashboard/dashboard-panels';
import { useDashboard, useSensorTrend } from '@/presentation/hooks/useAnalytics';
import { useActiveAlerts, useRecentAlerts } from '@/presentation/hooks/useAlerts';
import { useMachines } from '@/presentation/hooks/useMachines';
import { FAULT_LABELS, FAULT_TYPE_ORDER } from '@/lib/constants/fault-types';
import { EstadoAlerta } from '@/core/types';
import {
  buildFallosPorTipoHoy,
  calcTasaFalloGlobal,
  formatDashboardDate,
  formatFaultTypeCell,
  formatModelLabel,
  getCurrentTurn,
} from '@/lib/utils/dashboard';

const compactSelectClass =
  'min-w-0 rounded-md border border-border-soft bg-surface-2 px-3 py-1.5 text-xs text-ink';

const ALERT_FETCH_LIMIT = 50;
const ALGORITHM_OPTIONS = [
  { value: 'xgboost', label: 'XGBoost' },
  { value: 'random_forest', label: 'Random Forest' },
  { value: 'regresion_logistica', label: 'Regresión Logística' },
  { value: 'lightgbm', label: 'LightGBM' },
  { value: 'decision_tree', label: 'Decision Tree' },
  { value: 'svm', label: 'SVM' },
];

const ALERT_ESTADO_OPTIONS = [
  { value: EstadoAlerta.ANALIZANDO, label: 'Analizando' },
  { value: EstadoAlerta.CLASIFICANDO, label: 'Clasificando' },
  { value: EstadoAlerta.PENDIENTE, label: 'Pendiente' },
  { value: EstadoAlerta.EN_PROGRESO, label: 'En progreso' },
  { value: EstadoAlerta.FINALIZADO, label: 'Finalizado' },
];

type RecentAlertFilters = {
  tipoFallo: string;
  maquinaId: string;
  algoritmo: string;
  estado: string;
};

const DEFAULT_ALERT_FILTERS: RecentAlertFilters = {
  tipoFallo: '',
  maquinaId: '',
  algoritmo: '',
  estado: '',
};

export function DashboardView() {
  const dashboard = useDashboard();
  const [sensorVariable, setSensorVariable] = useState('rotationalSpeed');
  const [sensorMaquinaId, setSensorMaquinaId] = useState('');
  const trend = useSensorTrend(sensorVariable, 24, sensorMaquinaId || undefined);
  const machines = useMachines();
  const activeAlerts = useActiveAlerts();
  const alerts = useRecentAlerts(ALERT_FETCH_LIMIT);
  const [alertFilters, setAlertFilters] = useState<RecentAlertFilters>(DEFAULT_ALERT_FILTERS);

  const d = dashboard.data;
  const machineList = machines.data ?? [];
  const alertList = activeAlerts.data ?? [];

  const fallosHoy = useMemo(() => buildFallosPorTipoHoy(d?.fallosPorTipoHoy), [d?.fallosPorTipoHoy]);

  const tasaFallo =
    d?.tasaFalloGlobal ??
    calcTasaFalloGlobal(d?.fallasDetectadasHoy, d?.totalMaquinas) ??
    null;

  const operacionCount = machineList.filter((m) => m.estadoOperativo === 'operacion').length;

  const filteredAlerts = useMemo(() => {
    const rows = alerts.data ?? [];
    return rows.filter((row) => {
      if (alertFilters.tipoFallo && row.tipoFallo !== alertFilters.tipoFallo) return false;
      if (alertFilters.maquinaId && row.maquinaId !== alertFilters.maquinaId) return false;
      if (alertFilters.algoritmo && row.modeloPrediccion !== alertFilters.algoritmo) return false;
      if (alertFilters.estado && row.estado !== alertFilters.estado) return false;
      return true;
    });
  }, [alerts.data, alertFilters]);

  const patchAlertFilters = (partial: Partial<RecentAlertFilters>) =>
    setAlertFilters((prev) => ({ ...prev, ...partial }));

  const hasActiveAlertFilters = Object.values(alertFilters).some(Boolean);
  const clearAlertFilters = () => setAlertFilters(DEFAULT_ALERT_FILTERS);

  return (
    <div className="flex min-h-full flex-col">
      <Topbar
        flush
        title="Dashboard General"
        subtitle={`${formatDashboardDate()} | ${getCurrentTurn()}`}
        badge={
          d?.alertasActivas
            ? { label: `${d.alertasActivas} Alertas activas`, variant: 'danger' }
            : undefined
        }
      />

      <div className="flex flex-col gap-6 px-6 pb-6 pt-5">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <AnimatedKpiCard
          index={0}
          tone="accent"
          icon={Settings}
          value={d?.totalMaquinas ?? '—'}
          label="Máquinas Monitoreadas"
          sublabel={`${operacionCount || d?.totalMaquinas || 0} en operación`}
        />
        <AnimatedKpiCard
          index={1}
          tone="danger"
          icon={AlertTriangle}
          value={d?.fallasDetectadasHoy ?? d?.fallosHoy ?? '—'}
          label="Fallos Detectados Hoy"
          sublabel={`${d?.criticosHoy ?? 0} criticos / ${d?.moderadosHoy ?? 0} moderados`}
        />
        <AnimatedKpiCard
          index={2}
          tone="success"
          icon={Gem}
          value={tasaFallo != null ? `${tasaFallo.toFixed(1)}%` : '—'}
          label="Tasa de Fallo Global"
          sublabel={tasaFallo != null && tasaFallo <= 5 ? 'Umbral: 5% OK' : 'Umbral: 5% superado'}
        />
        <AnimatedKpiCard
          index={3}
          tone="warning"
          icon={Cpu}
          value={d ? `${d.precisionModelo}%` : '—'}
          label="Precisión del Modelo"
          sublabel={`${d?.modeloActivoS1 ?? 'XGBoost'} activo S-1`}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="sm:col-span-2">
          <SensorChartPanel
            data={trend.data}
            isLoading={trend.isLoading}
            variable={sensorVariable}
            onVariableChange={setSensorVariable}
            machines={machineList}
            maquinaId={sensorMaquinaId}
            onMaquinaChange={setSensorMaquinaId}
          />
        </div>
        <FaultBreakdownPanel data={fallosHoy} isLoading={dashboard.isLoading} />
        <MachineStatusPanel
          machines={machineList}
          activeAlerts={alertList}
          isLoading={machines.isLoading || activeAlerts.isLoading}
        />
      </div>

      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 space-y-0">
          <div className="flex flex-wrap items-center gap-3">
            <CardTitle>Alertas Recientes</CardTitle>
            <Link
              href="/dashboard/orders"
              className="text-xs font-medium text-accent hover:underline"
            >
              Ver historial completo
            </Link>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <select
              className={compactSelectClass}
              value={alertFilters.tipoFallo}
              onChange={(e) => patchAlertFilters({ tipoFallo: e.target.value })}
              aria-label="Tipo de fallo"
            >
              <option value="">Todos los fallos</option>
              {FAULT_TYPE_ORDER.map((tipo) => (
                <option key={tipo} value={tipo}>
                  {tipo} — {FAULT_LABELS[tipo]}
                </option>
              ))}
            </select>
            <select
              className={compactSelectClass}
              value={alertFilters.maquinaId}
              onChange={(e) => patchAlertFilters({ maquinaId: e.target.value })}
              aria-label="Máquina"
            >
              <option value="">Todas las máquinas</option>
              {machineList.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.id} · Tipo {m.tipo}
                </option>
              ))}
            </select>
            <select
              className={compactSelectClass}
              value={alertFilters.algoritmo}
              onChange={(e) => patchAlertFilters({ algoritmo: e.target.value })}
              aria-label="Algoritmo"
            >
              <option value="">Todos los algoritmos</option>
              {ALGORITHM_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            <select
              className={compactSelectClass}
              value={alertFilters.estado}
              onChange={(e) => patchAlertFilters({ estado: e.target.value })}
              aria-label="Estado"
            >
              <option value="">Todos los estados</option>
              {ALERT_ESTADO_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            <Button
              variant="secondary"
              size="sm"
              className="h-[30px] px-3 text-xs"
              onClick={clearAlertFilters}
              disabled={!hasActiveAlertFilters}
            >
              Limpiar
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {alerts.isLoading ? (
            <TableSkeleton />
          ) : (
            <RecentAlertsTable rows={filteredAlerts} machines={machineList} />
          )}
        </CardContent>
      </Card>
      </div>
    </div>
  );
}

function RecentAlertsTable({
  rows,
  machines,
}: {
  rows: Alert[];
  machines: Machine[];
}) {
  const machineType = (id: string) => machines.find((m) => m.id === id)?.tipo ?? '—';

  return (
    <DataTable
      rows={rows}
      emptyMessage="No hay alertas recientes"
      columns={[
        {
          key: 'maquina',
          header: 'Máquina',
          render: (r) => (
            <span>
              <strong className="text-ink">{r.maquinaId}</strong>
              <span className="ml-1 text-ink-muted">Tipo {machineType(r.maquinaId)}</span>
            </span>
          ),
        },
        {
          key: 'tipo',
          header: 'Tipo Fallo',
          render: (r) => formatFaultTypeCell(r.tipoFallo),
        },
        {
          key: 'algoritmo',
          header: 'Algoritmo',
          render: (r) => formatModelLabel(r.modeloPrediccion),
        },
        {
          key: 'conf',
          header: 'Confianza',
          render: (r) => {
            if (r.confianzaPrediccion != null) return `${r.confianzaPrediccion.toFixed(1)}%`;
            if (r.confianzaLider != null) return `${(Number(r.confianzaLider) * 100).toFixed(1)}%`;
            if (r.ensembleAvg != null) return `${(Number(r.ensembleAvg) * 100).toFixed(1)}%`;
            return '—';
          },
        },
        {
          key: 'hora',
          header: 'Hora',
          render: (r) =>
            new Date(r.creadoEn).toLocaleTimeString('es-PE', {
              hour: '2-digit',
              minute: '2-digit',
            }),
        },
        {
          key: 'estado',
          header: 'Estado',
          render: (r) => <StatusPill status={alertEstadoToPill(r.estado)} />,
        },
      ]}
    />
  );
}
