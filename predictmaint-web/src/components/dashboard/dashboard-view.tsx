'use client';

import Link from 'next/link';
import { AlertTriangle, Cpu, Gem, Settings } from 'lucide-react';
import type { Alert, Machine } from '@/core/entities';
import { Topbar } from '@/components/common/topbar';
import { KpiCard } from '@/components/ui/kpi-card';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DataTable } from '@/components/ui/data-table';
import { StatusPill, alertEstadoToPill } from '@/components/ui/status-pill';
import { TableSkeleton } from '@/components/ui/skeleton';
import {
  FaultBreakdownPanel,
  MachineStatusPanel,
  SensorChartPanel,
} from '@/components/dashboard/dashboard-panels';
import { useDashboard, useFaultsByType, useSensorTrend } from '@/presentation/hooks/useAnalytics';
import { useRecentAlerts } from '@/presentation/hooks/useAlerts';
import { useMachines } from '@/presentation/hooks/useMachines';

function formatDate() {
  return new Date().toLocaleDateString('es-PE', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

export function DashboardView() {
  const dashboard = useDashboard();
  const faults = useFaultsByType('week');
  const trend = useSensorTrend('rotationalSpeed', 24);
  const machines = useMachines();
  const alerts = useRecentAlerts(5);

  const d = dashboard.data;
  const machineList = machines.data ?? [];

  return (
    <div className="flex flex-col gap-6">
      <Topbar
        title="Dashboard General"
        subtitle={`${formatDate()} | Turno Mañana`}
        badge={
          d?.alertasActivas
            ? { label: `${d.alertasActivas} Alertas activas`, variant: 'danger' }
            : undefined
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          tone="accent"
          icon={Settings}
          value={d?.totalMaquinas ?? '—'}
          label="Máquinas Monitoreadas"
          sublabel={`${machineList.filter((m) => m.estadoOperativo === 'operacion').length} en operación`}
        />
        <KpiCard
          tone="danger"
          icon={AlertTriangle}
          value={d?.fallosHoy ?? '—'}
          label="Fallos Detectados Hoy"
          sublabel="Según órdenes del día"
        />
        <KpiCard
          tone="success"
          icon={Gem}
          value={d ? `${(d.tasaDeteccion * 100).toFixed(1)}%` : '—'}
          label="Tasa de Fallo Global"
          sublabel="Umbral: 5% OK"
        />
        <KpiCard
          tone="warning"
          icon={Cpu}
          value={d ? `${d.precisionModelo}%` : '—'}
          label="Precisión del Modelo"
          sublabel="XGBoost activo S-1"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-1">
          <SensorChartPanel data={trend.data} isLoading={trend.isLoading} />
        </div>
        <FaultBreakdownPanel data={faults.data} isLoading={faults.isLoading} />
        <MachineStatusPanel machines={machineList} isLoading={machines.isLoading} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Alertas Recientes</CardTitle>
          <Link href="/dashboard/orders" className="text-sm font-medium text-accent hover:underline">
            Ver historial completo →
          </Link>
        </CardHeader>
        <CardContent>
          {alerts.isLoading ? (
            <TableSkeleton />
          ) : (
            <RecentAlertsTable rows={alerts.data ?? []} machines={machineList} />
          )}
        </CardContent>
      </Card>
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
          render: (r) => r.tipoFallo ?? '—',
        },
        {
          key: 'nivel',
          header: 'Nivel',
          render: (r) => r.nivel,
        },
        {
          key: 'conf',
          header: 'Confianza S-1',
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
          render: (r) => (
            <StatusPill status={alertEstadoToPill(r.estado)} />
          ),
        },
      ]}
    />
  );
}
