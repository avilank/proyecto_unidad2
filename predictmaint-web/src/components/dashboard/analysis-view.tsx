'use client';

import { useEffect, useMemo, useState } from 'react';
import type { BinaryPrediction, MulticlassPrediction, Order, SensorReading } from '@/core/entities';
import { Topbar } from '@/components/common/topbar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { StatusPill } from '@/components/ui/status-pill';
import { Skeleton } from '@/components/ui/skeleton';
import { useMachine } from '@/presentation/hooks/useMachines';
import { useOrders } from '@/presentation/hooks/useOrders';
import { useBinaryPredictions, useMulticlassPredictions } from '@/presentation/hooks/usePredictions';
import { useRagPlan } from '@/presentation/hooks/useRag';

const UMBRAL_FALLA = 0.5;

const TABS = [
  { key: 's1', label: '1 Predicción de Fallo' },
  { key: 's2', label: '2 Clasificación de Tipo' },
  { key: 's3', label: '3 Recomendaciones RAG' },
] as const;

type TabKey = (typeof TABS)[number]['key'];

function pickDefaultOrder(items: Order[]): Order | null {
  if (!items.length) return null;
  const active = items.find((o) => o.estado === 'pendiente' || o.estado === 'en_progreso');
  if (active) return active;
  const withFault = items.find((o) => o.tipoFallo);
  if (withFault) return withFault;
  return items[0];
}

function riskBadgeVariant(nivel?: string | null) {
  switch (nivel) {
    case 'CRITICAL':
      return 'critical' as const;
    case 'HIGH':
      return 'high' as const;
    case 'MEDIUM':
      return 'warning' as const;
    case 'LOW':
      return 'default' as const;
    default:
      return 'default' as const;
  }
}

export function AnalysisView({
  machineId,
  initialOrderId = null,
}: {
  machineId: string;
  initialOrderId?: string | null;
}) {
  const [tab, setTab] = useState<TabKey>('s1');
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(initialOrderId);

  const machine = useMachine(machineId);
  const orders = useOrders({ maquinaId: machineId, limit: 50 });

  const orderItems = orders.data?.items ?? [];

  const defaultOrder = useMemo(() => pickDefaultOrder(orderItems), [orderItems]);

  useEffect(() => {
    if (initialOrderId && orderItems.some((o) => o.id === initialOrderId)) {
      setSelectedOrderId(initialOrderId);
      return;
    }
    if (!selectedOrderId && defaultOrder) {
      setSelectedOrderId(defaultOrder.id);
    }
  }, [initialOrderId, orderItems, defaultOrder, selectedOrderId]);

  const analysisOrder = useMemo(() => {
    if (!orderItems.length) return null;
    if (selectedOrderId) {
      return orderItems.find((o) => o.id === selectedOrderId) ?? defaultOrder;
    }
    return defaultOrder;
  }, [orderItems, selectedOrderId, defaultOrder]);

  const sensorReading: SensorReading | undefined =
    analysisOrder?.lectura ?? machine.data?.ultimaLectura;

  const binary = useBinaryPredictions(analysisOrder?.id ?? null);
  const multiclass = useMulticlassPredictions(analysisOrder?.id ?? null);
  const rag = useRagPlan(analysisOrder?.id ?? null);

  const ensembleAvg =
    binary.data?.ensembleAvg ?? analysisOrder?.ensembleAvg ?? 0;

  const s1Falla =
    Boolean(analysisOrder?.tipoFallo) ||
    ensembleAvg >= UMBRAL_FALLA ||
    binary.data?.consenso === 'FALLA';

  const s2HasData =
    (multiclass.data?.items?.length ?? 0) > 0 || Boolean(analysisOrder?.tipoFallo);

  const s3HasData = (rag.data?.acciones?.length ?? 0) > 0;

  // Siempre empezar en S-1 al cambiar de orden (sin saltos automáticos entre tabs).
  useEffect(() => {
    setTab('s1');
  }, [analysisOrder?.id]);

  const loading = machine.isLoading || orders.isLoading;

  const tabEnabled = (key: TabKey) => {
    if (key === 's1') return true;
    if (key === 's2') return s1Falla;
    return s1Falla && s2HasData;
  };

  return (
    <div className="flex flex-col gap-4">
      <Topbar
        title={`Análisis de Máquina — ${machineId}`}
        subtitle="Flujo: S-1 predicción → S-2 clasificación (si hay falla) → asignación de técnico → S-3 RAG"
        right={<Badge variant="accent">ANÁLISIS AUTOMÁTICO</Badge>}
      />

      <Card className="border-danger/30 bg-danger/5">
        <CardContent className="flex flex-wrap items-center gap-3 py-3 text-sm">
          <span className="font-semibold text-ink">{machineId}</span>
          {sensorReading?.tipo && (
            <span className="text-ink-muted">Tipo lectura {sensorReading.tipo}</span>
          )}
          {analysisOrder?.nivelRiesgo && (
            <Badge variant={riskBadgeVariant(analysisOrder.nivelRiesgo)}>
              {analysisOrder.nivelRiesgo}
            </Badge>
          )}
          {analysisOrder?.tipoFallo && (
            <Badge variant="danger">{analysisOrder.tipoFallo}</Badge>
          )}
          {ensembleAvg != null && (
            <span className="text-ink-soft">ensemble_avg: {ensembleAvg.toFixed(3)}</span>
          )}
          {analysisOrder?.id && <span className="text-accent">Orden: {analysisOrder.id}</span>}
          {s1Falla && analysisOrder?.tecnico && (
            <span className="text-ink-soft">
              Técnico: <span className="font-semibold text-ink">{analysisOrder.tecnico.nombre}</span>
            </span>
          )}
          {s1Falla && !analysisOrder?.tecnicoId && (
            <Badge variant="default">Técnico: asignación pendiente</Badge>
          )}
          {orderItems.length > 1 && (
            <select
              className="ml-auto rounded-md border border-border bg-surface px-2 py-1 text-xs text-ink"
              value={analysisOrder?.id ?? ''}
              onChange={(e) => setSelectedOrderId(e.target.value)}
            >
              {orderItems.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.id} · {o.tipoFallo ?? 'sin fallo'} · {o.estado}
                </option>
              ))}
            </select>
          )}
          <span className={orderItems.length > 1 ? '' : 'ml-auto'}>
            <StatusPill
              status={analysisOrder?.estado ?? 'pendiente'}
              label={analysisOrder?.estado?.replace('_', ' ')}
            />
          </span>
        </CardContent>
      </Card>

      <PipelineSteps
        s1Done={Boolean(binary.data)}
        s1Falla={s1Falla}
        s2Done={s2HasData}
        tecnicoAsignado={Boolean(analysisOrder?.tecnicoId)}
        s3Done={s3HasData}
      />

      <div className="grid grid-cols-1 gap-2 rounded-lg border border-border bg-surface p-2 md:grid-cols-3">
        {TABS.map((t) => {
          const enabled = tabEnabled(t.key);
          return (
            <button
              key={t.key}
              type="button"
              disabled={!enabled}
              onClick={() => enabled && setTab(t.key)}
              className={`rounded-md px-3 py-2 text-left text-sm font-semibold transition-colors ${
                tab === t.key
                  ? 'bg-accent/15 text-accent'
                  : enabled
                    ? 'text-ink-muted hover:bg-surface-2'
                    : 'cursor-not-allowed text-ink-muted/40'
              }`}
            >
              {t.label}
              {!enabled && t.key !== 's1' && (
                <span className="mt-0.5 block text-[10px] font-normal">
                  {t.key === 's2'
                    ? 'Requiere confirmación S-1 (FALLA)'
                    : 'Requiere S-2 completado'}
                </span>
              )}
              {enabled && t.key === 's2' && s1Falla && (
                <span className="mt-0.5 block text-[10px] font-normal text-success">
                  Falla confirmada — puede clasificar
                </span>
              )}
            </button>
          );
        })}
      </div>

      {!s1Falla && !loading && binary.data && tab === 's1' && (
        <p className="rounded-md border border-border-soft bg-surface-2 px-4 py-2 text-sm text-ink-muted">
          S-1 no confirmó falla (ensemble &lt; {UMBRAL_FALLA}) — el pipeline se detiene aquí. Tabs 2 y 3
          permanecen bloqueados.
        </p>
      )}

      {tab === 's1' && s1Falla && !loading && (
        <p className="rounded-md border border-success/30 bg-success/5 px-4 py-2 text-sm text-ink-soft">
          S-1 confirmó falla. Puede abrir el tab <strong>2 Clasificación</strong> — el sistema ya asignó
          técnico y generó recomendaciones RAG en segundo plano.
        </p>
      )}

      {loading ? (
        <Skeleton className="h-[420px] w-full" />
      ) : (
        <>
          {tab === 's1' && (
            <PredictionTab
              reading={sensorReading}
              data={binary.data ?? undefined}
              isLoading={binary.isLoading}
            />
          )}
          {tab === 's2' && s1Falla && (
            <ClassificationTab
              data={multiclass.data ?? undefined}
              isLoading={multiclass.isLoading}
              tecnico={analysisOrder?.tecnico}
              tecnicoPendiente={s1Falla && !analysisOrder?.tecnicoId}
            />
          )}
          {tab === 's3' && s1Falla && s2HasData && (
            <RagTab
              data={rag.data ?? undefined}
              isLoading={rag.isLoading}
              orderId={analysisOrder?.id ?? null}
            />
          )}
        </>
      )}
    </div>
  );
}

function PredictionTab({
  reading,
  data,
  isLoading,
}: {
  reading?: SensorReading;
  data?: { items: BinaryPrediction[]; ensembleAvg: number | null; consenso: string | null };
  isLoading?: boolean;
}) {
  if (isLoading) return <Skeleton className="h-[380px] w-full" />;

  return (
    <div className="grid gap-4 xl:grid-cols-4">
      <Card className="xl:col-span-1">
        <CardHeader>
          <CardTitle>Datos del sensor</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <Metric label="Tipo Máquina" value={reading?.tipo ?? '—'} />
          <Metric
            label="Temp. Aire"
            value={reading?.airTemperature != null ? `${reading.airTemperature} K` : '—'}
          />
          <Metric
            label="Temp. Proceso"
            value={reading?.processTemperature != null ? `${reading.processTemperature} K` : '—'}
          />
          <Metric
            label="Velocidad"
            value={reading?.rotationalSpeed != null ? `${reading.rotationalSpeed} rpm` : '—'}
          />
          <Metric
            label="Torque"
            value={reading?.torque != null ? `${reading.torque} Nm` : '—'}
          />
          <Metric
            label="Desgaste"
            value={reading?.toolWear != null ? `${reading.toolWear} min` : '—'}
          />
          {data?.consenso && <Metric label="Consenso S-1" value={data.consenso} />}
        </CardContent>
      </Card>

      <div className="grid gap-4 xl:col-span-3 xl:grid-cols-3">
        {(data?.items ?? []).map((p) => (
          <Card key={p.modelo} className={p.esLider ? 'border-accent' : undefined}>
            <CardHeader>
              <CardTitle>{prettyModel(p.modelo)}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex items-center justify-between">
                <Badge variant={p.prediccion === 'FALLA' ? 'danger' : 'success'}>{p.prediccion}</Badge>
                <span className="font-bold text-ink">{p.probabilidad.toFixed(1)}%</span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs text-ink-muted">
                <Metric label="Accuracy" value={fmtNum(p.accuracy)} />
                <Metric label="ROC-AUC" value={fmtRoc(p.rocAuc)} />
                <Metric label="Precision" value={fmtNum(p.precision)} />
                <Metric label="Recall" value={fmtNum(p.recall)} />
                <Metric label="F1" value={fmtNum(p.f1Score)} />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

function PipelineSteps({
  s1Done,
  s1Falla,
  s2Done,
  tecnicoAsignado,
  s3Done,
}: {
  s1Done: boolean;
  s1Falla: boolean;
  s2Done: boolean;
  tecnicoAsignado: boolean;
  s3Done: boolean;
}) {
  const steps = [
    {
      n: 1,
      label: 'S-1 Predicción',
      status: !s1Done ? 'pendiente' : s1Falla ? 'falla' : 'ok',
    },
    {
      n: 2,
      label: 'S-2 Clasificación',
      status: !s1Falla ? 'bloqueado' : s2Done ? 'ok' : 'pendiente',
    },
    {
      n: '→',
      label: 'Asignación técnico',
      status: !s1Falla ? 'bloqueado' : tecnicoAsignado ? 'ok' : 'pendiente',
    },
    {
      n: 3,
      label: 'S-3 RAG',
      status: !s2Done ? 'bloqueado' : s3Done ? 'ok' : 'pendiente',
    },
  ] as const;

  return (
    <div className="flex flex-wrap gap-2 rounded-lg border border-border bg-surface p-3">
      {steps.map((step, i) => (
        <div key={step.label} className="flex items-center gap-2">
          {i > 0 && <span className="text-ink-muted/40">→</span>}
          <div
            className={`rounded-md px-3 py-1.5 text-xs ${
              step.status === 'ok'
                ? 'bg-success/10 text-success'
                : step.status === 'falla'
                  ? 'bg-danger/10 text-danger'
                  : step.status === 'bloqueado'
                    ? 'bg-surface-2 text-ink-muted/50'
                    : 'bg-warning/10 text-warning'
            }`}
          >
            <span className="font-bold">{step.n}</span> {step.label}
            {step.status === 'falla' && ' · FALLA'}
            {step.status === 'bloqueado' && ' · —'}
          </div>
        </div>
      ))}
    </div>
  );
}

function ClassificationTab({
  data,
  isLoading,
  tecnico,
  tecnicoPendiente,
}: {
  data?: {
    items: MulticlassPrediction[];
    tipoPredicho: string | null;
    agreement: string;
    confianza: number | null;
  };
  isLoading?: boolean;
  tecnico?: { id: number; nombre: string; iniciales: string } | null;
  tecnicoPendiente?: boolean;
}) {
  if (isLoading) return <Skeleton className="h-[380px] w-full" />;

  return (
    <div className="space-y-4">
      <div
        className={`rounded-md border px-4 py-3 text-sm ${
          tecnico
            ? 'border-success/30 bg-success/5'
            : tecnicoPendiente
              ? 'border-warning/30 bg-warning/5'
              : 'border-border-soft bg-surface-2'
        }`}
      >
        {tecnico ? (
          <p className="text-ink">
            <strong>Asignación automática:</strong> {tecnico.nombre} ({tecnico.iniciales}) — según
            nivel de riesgo y tipo de fallo.
          </p>
        ) : tecnicoPendiente ? (
          <p className="text-ink-soft">
            <strong>Asignación automática:</strong> sin técnico disponible en este turno. Reintento
            programado por el sistema.
          </p>
        ) : null}
      </div>
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="py-4">
            <Metric label="Tipo Predicho" value={data?.tipoPredicho ?? '—'} />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4">
            <Metric
              label="Confianza"
              value={data?.confianza != null ? `${data.confianza.toFixed(1)}%` : '—'}
            />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4">
            <Metric label="Consenso" value={data?.tipoPredicho ?? '—'} />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4">
            <Metric label="Agreement" value={data?.agreement ?? '—'} />
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        {(data?.items ?? []).map((m) => (
          <Card key={m.modelo} className={m.esLider ? 'border-accent' : undefined}>
            <CardHeader>
              <CardTitle>{prettyModel(m.modelo)}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex items-center justify-between">
                <Badge variant={m.esLider ? 'accent' : 'default'}>
                  Pred: {m.tipoPredicho ?? '—'}
                </Badge>
                {m.diverge && <Badge variant="warning">Diverge</Badge>}
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs text-ink-muted">
                <Metric label="HDF" value={fmtNum(m.probHdf)} />
                <Metric label="PWF" value={fmtNum(m.probPwf)} />
                <Metric label="TWF" value={fmtNum(m.probTwf)} />
                <Metric label="OSF" value={fmtNum(m.probOsf)} />
                <Metric label="RNF" value={fmtNum(m.probRnf)} />
                <Metric label="Acc" value={fmtNum(m.accuracy)} />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

function RagTab({
  data,
  isLoading,
  orderId,
}: {
  data?: {
    acciones?: { orden: number; titulo: string; detalle: string | null; prioridad: string }[];
    estado?: string;
  };
  isLoading?: boolean;
  orderId: string | null;
}) {
  if (isLoading) return <Skeleton className="h-[380px] w-full" />;

  return (
    <div className="grid gap-4 xl:grid-cols-3">
      <Card className="xl:col-span-2">
        <CardHeader>
          <CardTitle>Plan de Acción RAG</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {(data?.acciones ?? []).map((a) => (
            <div key={a.orden} className="rounded-md border border-border-soft bg-surface-2 p-3">
              <p className="text-sm font-semibold text-ink">
                {a.orden}. {a.titulo}
              </p>
              <p className="mt-1 text-sm text-ink-soft">{a.detalle ?? 'Sin detalle'}</p>
            </div>
          ))}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Respuesta del Técnico</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <StatusPill status="pendiente" label="Pendiente de respuesta" />
          <Button fullWidth>Confirmar acción</Button>
          <Button variant="secondary" fullWidth>
            Rechazar / Analizar manualmente
          </Button>
          {orderId && <p className="text-xs text-ink-muted">Orden: {orderId}</p>}
        </CardContent>
      </Card>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[11px] text-ink-muted">{label}</p>
      <p className="font-semibold text-ink">{value}</p>
    </div>
  );
}

function fmtNum(value: number | null | undefined) {
  if (value == null) return '—';
  return `${value.toFixed(1)}%`;
}

function fmtRoc(value: number | null | undefined) {
  if (value == null) return '—';
  return value.toFixed(3);
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
