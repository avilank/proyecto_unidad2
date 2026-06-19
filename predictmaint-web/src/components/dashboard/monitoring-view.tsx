'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { Alert, Machine } from '@/core/entities';
import { Topbar } from '@/components/common/topbar';
import { KpiCard } from '@/components/ui/kpi-card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useActiveAlerts } from '@/presentation/hooks/useAlerts';
import { useMachines } from '@/presentation/hooks/useMachines';
import { useDashboard, useRecurrentFaults } from '@/presentation/hooks/useAnalytics';
import {
  MONITORING_DATA_INTERVAL_MS,
  MONITORING_INITIAL_BATCH_MS,
  useMonitoringStream,
} from '@/presentation/hooks/useMonitoringStream';
import { useNextDispatch } from '@/presentation/hooks/useNotifications';
import {
  emptyFaultCounts,
  FAULT_ICONS,
  FAULT_KPI_TONE,
  FAULT_TYPE_ORDER,
} from '@/lib/constants/fault-types';
import { cn } from '@/lib/utils/cn';
import { Radio, X } from 'lucide-react';

const ALERT_PREVIEW_COUNT = 3;

const FLOW_STEPS = [
  {
    n: 1,
    title: 'Sensor supera umbral',
    desc: 'Regla RN-01 a RN-04 disparada por lectura simulada',
    color: 'bg-purple-500',
  },
  {
    n: 2,
    title: 'S-1 ejecuta 3 modelos',
    desc: 'El modelo con mayor confianza decide la predicción',
    color: 'bg-purple-500',
  },
  {
    n: 3,
    title: 'S-2 identifica tipo',
    desc: 'Clasificación HDF / PWF / TWF / OSF / RNF',
    color: 'bg-purple-500',
  },
  {
    n: 4,
    title: 'Técnico asignado',
    desc: 'Por tipo de fallo, turno y disponibilidad',
    color: 'bg-warning',
  },
  {
    n: 5,
    title: 'Orden + notificación',
    desc: 'Orden creada y mensaje al técnico asignado',
    color: 'bg-success',
  },
];

const CARD_BG_FAULT = 'rgba(245, 158, 11, 0.06)';
const CARD_BORDER_FAULT = 'rgba(245, 158, 11, 0.35)';
const CARD_BORDER_OK = 'rgba(255, 255, 255, 0.12)';
const METRIC_BG_FAULT = 'rgba(245, 158, 11, 0.1)';
const METRIC_BG_NEUTRAL = 'rgba(255, 255, 255, 0.025)';

export function MonitoringView() {
  const stream = useMonitoringStream();
  const machines = useMachines({ poll: false });
  const alerts = useActiveAlerts({ poll: false });
  const dashboard = useDashboard({ poll: false });
  const recurrent = useRecurrentFaults();
  const dispatch = useNextDispatch();
  const [clock, setClock] = useState('');
  const [alertsModalOpen, setAlertsModalOpen] = useState(false);

  useEffect(() => {
    const tick = () =>
      setClock(
        new Date().toLocaleTimeString('es-PE', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        }),
      );
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  const machineList = machines.data ?? [];
  const alertList = alerts.data ?? [];
  const alertsByMachine = useMemo(() => {
    const map = new Map<string, Alert>();
    for (const a of alertList) {
      const prev = map.get(a.maquinaId);
      if (!prev || new Date(a.creadoEn) > new Date(prev.creadoEn)) {
        map.set(a.maquinaId, a);
      }
    }
    return map;
  }, [alertList]);

  const sortedMachines = useMemo(() => {
    const simulatedSet = new Set(stream.simulatedMachineIds);
    const inSimulation = machineList.filter(
      (m) => m.ultimaLectura != null || simulatedSet.has(m.id),
    );

    return [...inSimulation].sort((a, b) => {
      const fa = hasActiveFault(alertsByMachine.get(a.id)) ? 1 : 0;
      const fb = hasActiveFault(alertsByMachine.get(b.id)) ? 1 : 0;
      if (fb !== fa) return fb - fa;

      const ta = a.ultimaLectura?.capturadoEn
        ? new Date(a.ultimaLectura.capturadoEn).getTime()
        : 0;
      const tb = b.ultimaLectura?.capturadoEn
        ? new Date(b.ultimaLectura.capturadoEn).getTime()
        : 0;
      return tb - ta;
    });
  }, [machineList, alertsByMachine, stream.simulatedMachineIds]);

  const alertsWithTechnician = alertList.filter((a) => a.tecnicoId != null);

  const faultAlertsWithTechnician = useMemo(() => {
    return [...alertsWithTechnician].sort(
      (a, b) => new Date(b.creadoEn).getTime() - new Date(a.creadoEn).getTime(),
    );
  }, [alertsWithTechnician]);

  const previewAlerts = faultAlertsWithTechnician.slice(0, ALERT_PREVIEW_COUNT);

  const kpis = dashboard.data;
  const pipelinesHoy = kpis?.pipelinesHoy ?? kpis?.analisisHoy ?? kpis?.fallosHoy ?? 0;
  const maquinasEvaluadasHoy = kpis?.maquinasEvaluadasHoy ?? 0;
  const fallosPorTipo = useMemo(() => {
    const base = emptyFaultCounts();
    const fromApi = kpis?.fallosPorTipoHoy;
    if (fromApi) {
      for (const tipo of FAULT_TYPE_ORDER) {
        base[tipo] = fromApi[tipo] ?? 0;
      }
    }
    return base;
  }, [kpis?.fallosPorTipoHoy]);
  const fallasDetectadasHoy = useMemo(
    () => FAULT_TYPE_ORDER.reduce((sum, tipo) => sum + fallosPorTipo[tipo], 0),
    [fallosPorTipo],
  );
  const sinIncidenciaHoy = Math.max(0, pipelinesHoy - fallasDetectadasHoy);

  const topRecurrent = recurrent.data?.[0];

  const loading = machines.isLoading || alerts.isLoading;

  return (
    <div className="flex flex-col gap-6 pb-20">
      <Topbar
        title="Monitoreo en Tiempo Real"
        subtitle="Lectura por evento de sensor · S-1 y S-2 automáticos · Asignación tras confirmar tipo de fallo"
        right={
          <div className="flex items-center gap-3">
            <Badge variant={stream.isConnected ? 'success' : 'default'} className="gap-1 text-[10px]">
              <span
                className={`h-2 w-2 rounded-full ${stream.isConnected ? 'animate-pulse bg-success' : 'bg-ink-muted'}`}
              />
              SSE {stream.isConnected ? 'ON' : 'OFF'}
            </Badge>
            <Badge variant="success" className="gap-1">
              <span className="h-2 w-2 animate-pulse rounded-full bg-success" />
              EN VIVO
            </Badge>
            <span className="font-mono text-lg font-bold text-ink">{clock}</span>
          </div>
        }
      />

      <p className="rounded-lg border border-border-soft bg-surface px-4 py-3 text-sm text-ink-soft">
        Hoy (desde 00:00):{' '}
        <strong className="text-ink">{pipelinesHoy}</strong> eventos S-1 en{' '}
        <strong className="text-ink">{maquinasEvaluadasHoy || machineList.length}</strong> máquinas
        · <span className="text-warning">{fallasDetectadasHoy} fallas detectadas</span> ·{' '}
        <span className="text-success">{sinIncidenciaHoy} sin incidencia</span>
      </p>

      <p className="rounded-lg  bg-accent/5 px-4 py-2 text-xs text-ink-soft">
        Próximo mensaje automático:{' '}
        {dispatch.data ? (
          <>
            <span className="font-semibold text-accent">{dispatch.data.proximoEnvio}</span>{' '}
            {dispatch.data.hora}
          </>
        ) : (
          <>
            Inicio turno <span className="font-semibold text-accent">06:00 am</span> → Cada técnico
            recibe solo sus máquinas asignadas
          </>
        )}
      </p>

      <div className="grid grid-cols-2 items-stretch gap-4 sm:grid-cols-3 xl:grid-cols-6">
        <div className="h-full min-w-0">
          <KpiCard
            tone="accent"
            icon={Radio}
            value={kpis?.totalMaquinas ?? machineList.length}
            label="Máquinas activas"
            className="h-full"
          />
        </div>
        {FAULT_TYPE_ORDER.map((tipo, index) => (
          <FaultTypeKpiCard
            key={tipo}
            tipo={tipo}
            count={fallosPorTipo[tipo]}
            index={index}
            pulseKey={stream.readingTick}
          />
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-5">
        <div className="space-y-4 xl:col-span-3">
          <Card>
            <CardHeader>
              <CardTitle>Máquinas — Monitoreo en vivo</CardTitle>
              <p className="text-xs text-ink-muted">
                Batch inicial {MONITORING_INITIAL_BATCH_MS / 1000}s · lecturas cada{' '}
                {MONITORING_DATA_INTERVAL_MS / 1000}s · solo máquinas con lecturas del simulador
              </p>
            </CardHeader>
            <CardContent className="space-y-3 p-6 pt-0">
                {loading && !stream.isInitialBatchReady ? (
                  <Skeleton className="h-48 w-full" />
                ) : !stream.isInitialBatchReady ? (
                  <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-accent/40 bg-accent/5 py-12 text-center">
                    <span className="inline-flex h-3 w-3 animate-pulse rounded-full bg-accent" />
                    <p className="text-sm font-medium text-ink">
                      Esperando batch inicial ({MONITORING_INITIAL_BATCH_MS / 1000}s)…
                    </p>
                    <p className="text-xs text-ink-muted">
                      Las cards aparecerán cuando lleguen lecturas del simulador
                    </p>
                  </div>
                ) : sortedMachines.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-border-soft py-10 text-center">
                    <p className="text-sm text-ink-muted">
                      Aún no hay máquinas en la simulación
                    </p>
                    <p className="mt-1 text-xs text-ink-muted">
                      Ejecuta el simulador para ver las cards entrar en tiempo real
                    </p>
                  </div>
                ) : (
                  sortedMachines.map((m, index) => (
                    <MachineLiveCard
                      key={m.id}
                      machine={m}
                      alert={alertsByMachine.get(m.id)}
                      index={index}
                      readingTick={stream.readingTick}
                    />
                  ))
                )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4 xl:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Flujo de asignación automática</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {FLOW_STEPS.map((step) => (
                <div key={step.n} className="flex gap-3">
                  <div
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white ${step.color}`}
                  >
                    {step.n}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-ink">{step.title}</p>
                    <p className="text-xs text-ink-muted">{step.desc}</p>
                  </div>
                  <Badge variant="accent" className="h-fit text-[10px]">
                    AUTO
                  </Badge>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Alertas activas con técnico asignado</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {alerts.isLoading ? (
                <Skeleton className="h-32 w-full" />
              ) : previewAlerts.length === 0 ? (
                <p className="text-sm text-ink-muted">
                  Sin fallas detectadas con técnico asignado
                </p>
              ) : (
                previewAlerts.map((a) => <ActiveAlertCard key={a.id} alert={a} />)
              )}
              <p className="border-t border-border-soft pt-2 text-[11px] text-ink-muted">
                Mensaje enviado automáticamente al técnico al confirmar fallo.
              </p>
              {faultAlertsWithTechnician.length > 0 && (
                <Button
                  variant="secondary"
                  fullWidth
                  size="sm"
                  onClick={() => setAlertsModalOpen(true)}
                >
                  Ver más ({faultAlertsWithTechnician.length})
                </Button>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {alertsModalOpen && (
        <AlertsListModal
          alerts={faultAlertsWithTechnician}
          onClose={() => setAlertsModalOpen(false)}
        />
      )}

      {topRecurrent && (
        <div className="rounded-lg border border-warning/50 bg-warning/10 px-4 py-3 text-sm">
          <p className="font-semibold text-warning">
            FALLO REPETITIVO detectado — {topRecurrent.maquinaId}
          </p>
          <p className="mt-1 text-ink-soft">
            {topRecurrent.ocurrencias}º {topRecurrent.tipoFallo} en {topRecurrent.ventanaDias} días
            · Supervisor notificado · Plan RAG escalado
          </p>
        </div>
      )}
    </div>
  );
}

function FaultTypeKpiCard({
  tipo,
  count,
  index,
  pulseKey,
}: {
  tipo: string;
  count: number;
  index: number;
  pulseKey: number;
}) {
  const prev = useRef({ count, pulseKey });
  const [flash, setFlash] = useState(false);
  const Icon = FAULT_ICONS[tipo] ?? Radio;

  useEffect(() => {
    if (prev.current.count !== count && pulseKey > 0) {
      setFlash(true);
      const t = setTimeout(() => setFlash(false), 650);
      prev.current = { count, pulseKey };
      return () => clearTimeout(t);
    }
    prev.current = { count, pulseKey };
  }, [count, pulseKey]);

  return (
    <div
      className="h-full min-w-0 animate-slide-in-left"
      style={{ animationDelay: `${(index + 1) * 80}ms` }}
    >
      <KpiCard
        tone={FAULT_KPI_TONE[tipo] ?? 'accent'}
        icon={Icon}
        value={count}
        label={tipo}
        className={cn('h-full', flash && 'animate-value-flash ring-1 ring-accent/40')}
      />
    </div>
  );
}

function MachineLiveCard({
  machine,
  alert,
  index,
  readingTick,
}: {
  machine: Machine;
  alert?: Alert;
  index: number;
  readingTick: number;
}) {
  const fault = hasActiveFault(alert);
  const rpm = machine.kpis?.rotationalSpeed ?? machine.ultimaLectura?.rotationalSpeed;
  const torque = machine.kpis?.torque ?? machine.ultimaLectura?.torque;
  const wear = machine.kpis?.toolWear ?? machine.desgasteActual;
  const note = buildAlertNote(machine, alert);
  const readingKey = machine.ultimaLectura?.capturadoEn ?? String(readingTick);

  return (
    <div
      className="group relative overflow-hidden rounded-xl p-4 mt-6 transition-colors duration-300 animate-slide-in-left"
      style={{
        animationDelay: `${index * 100}ms`,
        border: `1px solid ${fault ? CARD_BORDER_FAULT : CARD_BORDER_OK}`,
        ...(fault ? { backgroundColor: CARD_BG_FAULT } : {}),
      }}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-mono text-lg font-bold tracking-tight text-ink">
              {machine.id}
            </span>
            <span className="rounded-md bg-black/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-ink-muted">
              Tipo {machine.tipo}
            </span>
          </div>
          <p className="mt-1 text-xs text-ink-soft">{note}</p>
        </div>
        <MachineAlertBadge alert={alert} />
      </div>

      <div className="mt-1 grid grid-cols-3 gap-2">
        <LiveMetric
          label="RPM"
          value={rpm}
          format={(v) => v.toLocaleString('es-PE', { maximumFractionDigits: 0 })}
          readingKey={readingKey}
          fault={fault}
        />
        <LiveMetric
          label="Torque"
          value={torque}
          format={(v) => `${v.toFixed(1)} Nm`}
          readingKey={readingKey}
          fault={fault}
        />
        <LiveMetric
          label="Desgaste"
          value={wear}
          format={(v) => `${v} min`}
          readingKey={readingKey}
          fault={fault}
        />
      </div>

      {alert?.tecnico && (
        <div className="mt-1 flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-warning/20 text-xs font-bold text-warning">
            {alert.tecnico.iniciales}
          </span>
          <span className="text-sm font-medium text-ink">{alert.tecnico.nombre}</span>
        </div>
      )}

      {fault && alert && (
        <Link
          href={
            alert.ordenId ?? alert.orderId
              ? `/dashboard/analysis/${machine.id}?order=${alert.ordenId ?? alert.orderId}`
              : `/dashboard/analysis/${machine.id}`
          }
          className="mt-1 inline-block"
        >
          <Button variant="warning" size="sm">
            Ver análisis →
          </Button>
        </Link>
      )}
    </div>
  );
}

function LiveMetric({
  label,
  value,
  format,
  readingKey,
  fault,
}: {
  label: string;
  value?: number | null;
  format: (v: number) => string;
  readingKey: string;
  fault?: boolean;
}) {
  const prev = useRef<{ value?: number | null; key: string }>({ value, key: readingKey });
  const [flash, setFlash] = useState(false);

  useEffect(() => {
    const changed =
      prev.current.key !== readingKey &&
      value != null &&
      prev.current.value !== value;
    if (changed) {
      setFlash(true);
      const t = setTimeout(() => setFlash(false), 650);
      prev.current = { value, key: readingKey };
      return () => clearTimeout(t);
    }
    prev.current = { value, key: readingKey };
  }, [value, readingKey]);

  return (
    <div
      className={cn('rounded-lg px-3 py-2 transition-colors', flash && 'ring-1 ring-accent/40')}
      style={{
        backgroundColor: flash
          ? 'rgba(48, 156, 228, 0.2)'
          : fault
            ? METRIC_BG_FAULT
            : METRIC_BG_NEUTRAL,
      }}
    >
      <p className="text-[10px] font-semibold uppercase tracking-wider text-ink-muted">
        {label}
      </p>
      <p
        className={`mt-0.5 font-mono text-base font-bold tabular-nums transition-colors ${
          flash ? 'text-accent' : 'text-ink'
        }`}
      >
        {value != null ? format(value) : '—'}
      </p>
    </div>
  );
}

function ActiveAlertCard({ alert }: { alert: Alert }) {
  const ruleLabel = [alert.reglaCodigo, alert.tipoFallo].filter(Boolean).join(' — ');

  return (
    <div className="rounded-lg border border-warning/50 bg-surface p-4">
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-sm font-bold text-ink">{alert.id}</span>
        <Badge variant="warning">Falla detectada</Badge>
      </div>
      <p className="mt-1 text-xs text-ink-muted">
        {alert.maquinaId} · {timeAgo(alert.creadoEn)}
        {ruleLabel ? ` · ${ruleLabel}` : ''}
      </p>
      {alert.tecnico && (
        <p className="mt-1 text-xs text-ink-soft">Técnico: {alert.tecnico.nombre}</p>
      )}
      {alert.confianzaLider != null && (
        <>
          <p className="mt-2 text-2xl font-bold text-ink">
            {(Number(alert.confianzaLider) * 100).toFixed(1)}%
          </p>
          <p className="text-xs text-ink-muted">
            Confianza S-1
            {alert.modeloPrediccion ? ` · ${prettyModel(alert.modeloPrediccion)}` : ''}
          </p>
        </>
      )}
      {alert.modeloClasificacion && alert.tipoFallo && (
        <p className="mt-1 text-xs text-ink-soft">
          S-2: {alert.tipoFallo} · {prettyModel(alert.modeloClasificacion)}
        </p>
      )}
      {(alert.ordenId ?? alert.orderId) && (
        <Link
          href={`/dashboard/analysis/${alert.maquinaId}?order=${alert.ordenId ?? alert.orderId}`}
        >
          <Button variant="warning" fullWidth size="sm" className="mt-3">
            Ver análisis completo →
          </Button>
        </Link>
      )}
    </div>
  );
}

function AlertsListModal({
  alerts,
  onClose,
}: {
  alerts: Alert[];
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      onClick={onClose}
      role="presentation"
    >
      <Card
        className="flex max-h-[85vh] w-full max-w-2xl flex-col border-accent/50 shadow-pop"
        onClick={(e) => e.stopPropagation()}
      >
        <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
          <div>
            <CardTitle>Todas las alertas activas</CardTitle>
            <p className="mt-1 text-sm text-ink-muted">
              Fallas detectadas con técnico asignado
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-ink-muted transition-colors hover:bg-surface-2 hover:text-ink"
            aria-label="Cerrar"
          >
            <X className="h-5 w-5" />
          </button>
        </CardHeader>
        <CardContent className="overflow-y-auto space-y-3">
          {alerts.length === 0 ? (
            <p className="text-sm text-ink-muted">No hay alertas para mostrar</p>
          ) : (
            alerts.map((a) => <ActiveAlertCard key={a.id} alert={a} />)
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function hasActiveFault(alert?: Alert): boolean {
  return Boolean(alert && alert.estado !== 'finalizado');
}

function MachineAlertBadge({ alert }: { alert?: Alert }) {
  if (hasActiveFault(alert)) {
    return <Badge variant="warning">Falla detectada</Badge>;
  }
  return <Badge variant="success">Sin incidencia</Badge>;
}

function buildAlertNote(machine: Machine, alert?: Alert): string {
  const last = machine.ultimaLectura?.capturadoEn;
  const time = last
    ? new Date(last).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' })
    : '—';

  if (!hasActiveFault(alert)) {
    return `Sin incidencia · Última lectura: ${time}`;
  }

  const parts = ['Falla detectada'];
  if (alert?.tipoFallo) parts.push(alert.tipoFallo);
  if (alert?.reglaCodigo) parts.push(alert.reglaCodigo);
  if (alert?.tecnico) parts.push(`Téc: ${shortName(alert.tecnico.nombre)}`);
  parts.push(`Actualizado: ${time}`);
  return parts.join(' · ');
}

function shortName(full: string): string {
  const parts = full.trim().split(/\s+/);
  if (parts.length < 2) return full;
  return `${parts[0][0]}. ${parts[parts.length - 1]}`;
}

function timeAgo(iso: string): string {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return 'hace un momento';
  if (mins < 60) return `hace ${mins} min`;
  const hrs = Math.floor(mins / 60);
  return `hace ${hrs} h`;
}

function prettyModel(model: string) {
  const map: Record<string, string> = {
    xgboost: 'XGBoost',
    random_forest: 'Random Forest',
    regresion_logistica: 'Reg. Logística',
    lightgbm: 'LightGBM',
    decision_tree: 'Decision Tree',
    svm: 'SVM',
  };
  return map[model] ?? model;
}
