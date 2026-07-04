'use client';

import { useEffect, useMemo, useState } from 'react';
import type { BinaryPrediction, MulticlassPrediction, Order, SensorReading } from '@/core/entities';
import { Topbar } from '@/components/common/topbar';
import { RagDetailText } from '@/components/common/rag-detail-text';
import { RagRegenerateButton, RagSourcesFooter } from '@/components/dashboard/rag-plan-footer';
import { RagTechnicianResponsePanel } from '@/components/dashboard/rag-technician-response-panel';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { StatusPill } from '@/components/ui/status-pill';
import { Skeleton } from '@/components/ui/skeleton';
import { useMachine } from '@/presentation/hooks/useMachines';
import { useOrders } from '@/presentation/hooks/useOrders';
import { useBinaryPredictions, useMulticlassPredictions } from '@/presentation/hooks/usePredictions';
import { useRagPlan } from '@/presentation/hooks/useRag';
import { EstadoOrden } from '@/core/types';
import { KpiCard } from '@/components/ui/kpi-card';
import { FAULT_ICONS, FAULT_KPI_TONE, FAULT_LABELS } from '@/lib/constants/fault-types';
import { formatModelLabel } from '@/lib/utils/dashboard';
import { cn } from '@/lib/utils/cn';
import { useSystemConfig, useMlModels } from '@/presentation/hooks/useSettings';
import { EtapaModelo } from '@/core/types';
import { Activity, Gauge, ShieldCheck, Target } from 'lucide-react';
import { ExportPdfButton } from '@/components/dashboard/export-pdf-button';
import {
  downloadRagRecommendationPdf,
  downloadS1AnalysisPdf,
  downloadS2ClassificationPdf,
} from '@/lib/utils/analysis-pdf';

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
  const systemConfig = useSystemConfig();
  const s1Models = useMlModels(EtapaModelo.S1);
  const umbralFallback =
    parseFloat(systemConfig.data?.umbral_ensemble_falla ?? '0.5') || 0.5;

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

  const confianzaLider =
    binary.data?.confianzaLider ??
    (binary.data?.ensembleAvg != null ? binary.data.ensembleAvg : null) ??
    (analysisOrder?.confianzaLider != null ? analysisOrder.confianzaLider : null) ??
    (analysisOrder?.ensembleAvg != null ? analysisOrder.ensembleAvg : null);

  const modeloPrediccion =
    binary.data?.modeloLider ?? analysisOrder?.modeloPrediccion ?? null;

  const umbralFalla = useMemo(() => {
    if (!modeloPrediccion || !s1Models.data?.length) return umbralFallback;
    const displayName = formatModelLabel(modeloPrediccion);
    const match = s1Models.data.find(
      (m) => m.modelo === displayName || m.modelo.toLowerCase() === modeloPrediccion.toLowerCase(),
    );
    return match?.umbral ?? umbralFallback;
  }, [modeloPrediccion, s1Models.data, umbralFallback]);

  const s1Falla =
    Boolean(analysisOrder?.tipoFallo) ||
    (confianzaLider != null && confianzaLider >= umbralFalla) ||
    binary.data?.consenso === 'FALLA';

  const s2HasData =
    (multiclass.data?.items?.length ?? 0) > 0 || Boolean(analysisOrder?.tipoFallo);

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
    <div className="flex min-h-full flex-col">
      <Topbar
        className="pt-6 pb-6"
        flush
        title={`Análisis de Máquina — ${machineId}`}
        // subtitle="Flujo: S-1 predicción → S-2 clasificación (si hay falla) → asignación de técnico → S-3 RAG"
        right={<Badge variant="accent">ANÁLISIS AUTOMÁTICO</Badge>}
      />

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-y border-analysis-bar-border bg-analysis-bar px-6 py-2.5 text-sm">
        <span className="font-semibold text-ink">{machineId}</span>
        {sensorReading?.tipo && (
          <span className="text-ink-muted">Tipo lectura {sensorReading.tipo}</span>
        )}
        {analysisOrder?.nivelRiesgo && (
          <Badge variant={riskBadgeVariant(analysisOrder.nivelRiesgo)}>
            {analysisOrder.nivelRiesgo}
          </Badge>
        )}
        {analysisOrder?.tipoFallo && <Badge variant="danger">{analysisOrder.tipoFallo}</Badge>}
        {confianzaLider != null && (
          <span className="text-ink-soft">
            S-1: {modeloPrediccion ? `${prettyModel(modeloPrediccion)} · ` : ''}
            {(confianzaLider * 100).toFixed(1)}%
          </span>
        )}
        {multiclass.data?.modeloLider && analysisOrder?.tipoFallo && (
          <span className="text-ink-soft">
            S-2: {prettyModel(multiclass.data.modeloLider)} · {analysisOrder.tipoFallo}
          </span>
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
      </div>

      <div className="flex bg-bg ">
        {TABS.map((t) => {
          const enabled = tabEnabled(t.key);
          const active = tab === t.key;
          return (
            <button
              key={t.key}
              type="button"
              disabled={!enabled}
              onClick={() => enabled && setTab(t.key)}
              className={cn(
                'min-w-0 flex-1 px-4 py-3 text-center text-sm font-semibold transition-colors',
                active
                  ? 'border-b-2 border-b-accent bg-surface/40 text-accent'
                  : enabled
                    ? 'border-b-2 border-b-transparent text-ink-muted hover:bg-surface/30 hover:text-ink'
                    : 'cursor-not-allowed border-b-2 border-b-transparent text-ink-muted/40',
              )}
            >
              {t.label}
              {!enabled && t.key !== 's1' && (
                <span className="mt-0.5 block text-[10px] font-normal">
                  {t.key === 's2'
                    ? 'Requiere confirmación S-1 (FALLA)'
                    : 'Requiere S-2 completado'}
                </span>
              )}
              {/* {enabled && t.key === 's2' && s1Falla && (
                <span className="mt-0.5 block text-[10px] font-normal text-success">
                  Falla confirmada — puede clasificar
                </span>
              )} */}
            </button>
          );
        })}
      </div>

      <div className="flex flex-col gap-4 px-6 py-5">
      {!s1Falla && !loading && binary.data && tab === 's1' && (
        <p className="rounded-md bg-surface-2 px-4 py-2 text-sm text-ink-muted">
          S-1 no confirmó falla
          {modeloPrediccion
            ? ` — ${prettyModel(modeloPrediccion)} quedó bajo su umbral (${umbralFalla.toFixed(2)})`
            : ` — probabilidad bajo umbral (${umbralFalla.toFixed(2)})`}
          . El pipeline se detiene aquí; tabs 2 y 3 permanecen bloqueados.
        </p>
      )}

      {tab === 's1' && s1Falla && !loading && (
        <p className="rounded-md bg-success/5 px-4 py-2 text-sm text-ink-soft">
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
              pdfContext={{
                maquinaId: machineId,
                orderId: analysisOrder?.id,
                nivelRiesgo: analysisOrder?.nivelRiesgo,
              }}
              umbralFalla={umbralFalla}
            />
          )}
          {tab === 's2' && s1Falla && (
            <ClassificationTab
              data={multiclass.data ?? undefined}
              isLoading={multiclass.isLoading}
              tecnico={analysisOrder?.tecnico}
              tecnicoPendiente={s1Falla && !analysisOrder?.tecnicoId}
              pdfContext={{
                maquinaId: machineId,
                orderId: analysisOrder?.id,
                nivelRiesgo: analysisOrder?.nivelRiesgo,
              }}
            />
          )}
          {tab === 's3' && s1Falla && s2HasData && (
            <RagTab
              data={rag.data ?? undefined}
              isLoading={rag.isLoading}
              orderId={analysisOrder?.id ?? null}
              order={analysisOrder}
              pdfContext={{
                maquinaId: machineId,
                orderId: analysisOrder?.id,
                nivelRiesgo: analysisOrder?.nivelRiesgo,
              }}
              multiclassMeta={{
                modeloLider: multiclass.data?.modeloLider ?? null,
                agreement: multiclass.data?.agreement ?? null,
                confianza: multiclass.data?.confianza ?? null,
              }}
              onRegenerated={() => {
                rag.mutate();
                orders.mutate();
              }}
            />
          )}
        </>
      )}
      </div>
    </div>
  );
}

function PredictionTab({
  reading,
  data,
  isLoading,
  pdfContext,
  umbralFalla,
}: {
  reading?: SensorReading;
  data?: {
    items: BinaryPrediction[];
    modeloLider: string | null;
    confianzaLider: number | null;
    ensembleAvg: number | null;
    consenso: string | null;
  };
  isLoading?: boolean;
  pdfContext: { maquinaId: string; orderId?: string | null; nivelRiesgo?: string | null };
  umbralFalla?: number;
}) {
  if (isLoading) return <Skeleton className="h-[380px] w-full" />;

  const lider = data?.items.find((p) => p.esLider) ?? data?.items[0];
  const confianza =
    data?.confianzaLider ??
    (lider?.probabilidad != null ? lider.probabilidad / 100 : null);

  const canExport = (data?.items?.length ?? 0) > 0;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-end gap-2">
        <ExportPdfButton
          label="Exportar análisis S-1 (PDF)"
          disabled={!canExport}
          onClick={() => {
            if (!data?.items?.length) return;
            downloadS1AnalysisPdf({
              ctx: pdfContext,
              reading,
              items: data.items,
              modeloLider: data.modeloLider,
              confianzaLider: confianza,
              consenso: data.consenso,
              umbralFalla,
            });
          }}
        />
      </div>

      {lider && (
        <div className="rounded-md bg-accent/5 px-4 py-3 text-sm">
          <p className="font-semibold text-ink">
            Modelo líder S-1: {prettyModel(data?.modeloLider ?? lider.modelo)}
          </p>
          <p className="mt-1 text-ink-muted">
            Predicción <strong>{lider.prediccion}</strong>
            {confianza != null ? ` · ${(confianza * 100).toFixed(1)}% confianza` : ''}
            {data?.consenso ? ` · decisión: ${data.consenso}` : ''}
          </p>
        </div>
      )}

    <div className="grid gap-4 xl:grid-cols-4">
      <Card className="border-0 bg-surface-2 shadow-none xl:col-span-1">
        <CardHeader className="border-b-0">
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
          {data?.consenso && <Metric label="Decisión S-1" value={data.consenso} />}
        </CardContent>
      </Card>

      <div className="grid gap-4 xl:col-span-3 xl:grid-cols-3">
        {(data?.items ?? []).map((p) => (
          <BinaryModelCard key={p.modelo} prediction={p} />
        ))}
      </div>
    </div>
    </div>
  );
}

function prettyPrediccion(prediccion: string) {
  return prediccion.replace(/_/g, ' ');
}

function BinaryModelCard({ prediction: p }: { prediction: BinaryPrediction }) {
  const isFalla = p.prediccion === 'FALLA';
  const pct = Math.min(100, Math.max(0, p.probabilidad));

  return (
    <Card
      className={cn(
        'border-0 bg-surface-2 shadow-none',
        p.esLider && 'ring-1 ring-accent/25',
      )}
    >
      <CardHeader className="border-b-0 pb-2">
        <CardTitle className="flex flex-col gap-0.5">
          <span>{prettyModel(p.modelo)}</span>
          {p.esLider && (
            <span className="text-[10px] font-medium uppercase tracking-wide text-accent">
              Mayor confianza
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 pt-0 text-sm">
        <div className="space-y-2">
          <div
            className={cn(
              'flex items-center justify-between rounded-lg px-3 py-2',
              isFalla ? 'bg-danger/15' : 'bg-success/15',
            )}
          >
            <span
              className={cn(
                'text-sm font-semibold',
                isFalla ? 'text-danger' : 'text-success',
              )}
            >
              {prettyPrediccion(p.prediccion)}
            </span>
            <span className="text-sm font-bold text-ink">{pct.toFixed(1)}%</span>
          </div>
          <div className="h-2.5 w-full overflow-hidden rounded-full bg-[#1a1f2e]">
            <div
              className={cn(
                'h-full rounded-full transition-all duration-500',
                isFalla ? 'bg-danger' : 'bg-success',
              )}
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>

        <div className="space-y-2 pt-3">
          <p className="text-xs text-ink-muted">Métricas</p>
          <div className="grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
            <Metric label="Accuracy" value={fmtNum(p.accuracy)} />
            <Metric label="ROC-AUC" value={fmtRoc(p.rocAuc)} />
            <Metric label="Precision" value={fmtNum(p.precision)} />
            <Metric label="Recall" value={fmtNum(p.recall)} />
            <Metric label="F1-Score" value={fmtNum(p.f1Score)} className="col-span-2" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function ClassificationTab({
  data,
  isLoading,
  tecnico,
  tecnicoPendiente,
  pdfContext,
}: {
  data?: {
    items: MulticlassPrediction[];
    modeloLider: string | null;
    tipoPredicho: string | null;
    agreement: string;
    confianza: number | null;
  };
  isLoading?: boolean;
  tecnico?: { id: number; nombre: string; iniciales: string } | null;
  tecnicoPendiente?: boolean;
  pdfContext: { maquinaId: string; orderId?: string | null; nivelRiesgo?: string | null };
}) {
  if (isLoading) return <Skeleton className="h-[380px] w-full" />;

  const lider = data?.items.find((m) => m.esLider);
  const items = data?.items ?? [];
  const canExport = items.length > 0;
  const tipoPredicho = data?.tipoPredicho ?? lider?.tipoPredicho ?? '—';
  const modeloLider = data?.modeloLider ?? lider?.modelo ?? null;

  const voteCounts = items.reduce<Record<string, number>>((acc, m) => {
    if (m.tipoPredicho) acc[m.tipoPredicho] = (acc[m.tipoPredicho] ?? 0) + 1;
    return acc;
  }, {});
  const consensusEntry = Object.entries(voteCounts).sort((a, b) => b[1] - a[1])[0];
  const consensusType = consensusEntry?.[0] ?? '—';
  const consensusCount = consensusEntry?.[1] ?? 0;
  const modelTotal = items.length || 3;
  const divergentModels = items.filter((m) => m.diverge).map((m) => prettyModel(m.modelo));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-end gap-2">
        <ExportPdfButton
          label="Exportar clasificación S-2 (PDF)"
          disabled={!canExport}
          onClick={() => {
            if (!data?.items?.length) return;
            downloadS2ClassificationPdf({
              ctx: pdfContext,
              items: data.items,
              modeloLider: data.modeloLider,
              tipoPredicho: data.tipoPredicho,
              agreement: data.agreement,
              confianza: data.confianza,
              tecnico: tecnico ?? undefined,
              tecnicoPendiente,
            });
          }}
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          icon={FAULT_ICONS[tipoPredicho] ?? Target}
          tone={FAULT_KPI_TONE[tipoPredicho] ?? 'accent'}
          value={tipoPredicho}
          label=""
          sublabel={FAULT_LABELS[tipoPredicho]}
        />
        <KpiCard
          icon={Gauge}
          tone="warning"
          value={data?.confianza != null ? `${data.confianza.toFixed(1)}%` : '—'}
          label=""
          sublabel={
            modeloLider ? `${prettyModel(modeloLider)} — mayor confianza` : 'Modelo líder S-2'
          }
        />
        <KpiCard
          icon={Activity}
          tone={FAULT_KPI_TONE[consensusType] ?? 'warning'}
          value={consensusType}
          label=""
          sublabel={`${consensusCount} de ${modelTotal} modelos coinciden`}
        />
        <KpiCard
          icon={ShieldCheck}
          tone={agreementTone(data?.agreement)}
          value={data?.agreement ?? '—'}
          label=""
          sublabel={
            divergentModels.length
              ? `${consensusCount}/${modelTotal} coinciden · ${divergentModels.join(', ')} diverge`
              : `${consensusCount}/${modelTotal} coinciden`
          }
        />
      </div>

      <div
        className={`rounded-md px-4 py-3 text-sm ${
          tecnico
            ? ' border-success/30 bg-success/5'
            : tecnicoPendiente
              ? ' border-warning/30 bg-warning/5'
              : ' border-border-soft bg-surface-2'
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

      <div className="grid gap-4 xl:grid-cols-3">
        {(data?.items ?? []).map((m) => (
          <Card key={m.modelo} className={m.esLider ? 'border-accent' : undefined}>
            <CardHeader>
              <CardTitle className="flex items-center justify-between gap-2">
                {prettyModel(m.modelo)}
                {m.esLider && <Badge variant="accent">Líder</Badge>}
              </CardTitle>
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
  order,
  multiclassMeta,
  pdfContext,
  onRegenerated,
}: {
  data?: {
    acciones?: { orden: number; titulo: string; detalle: string | null; prioridad: string }[];
    fuentes?: string[];
    estado?: string;
    tipoFallo?: string;
    escalado?: boolean;
  };
  isLoading?: boolean;
  orderId: string | null;
  order?: Order | null;
  pdfContext: { maquinaId: string; orderId?: string | null; nivelRiesgo?: string | null };
  multiclassMeta?: {
    modeloLider: string | null;
    agreement: string | null;
    confianza: number | null;
  };
  onRegenerated?: () => void;
}) {
  const tipoFallo = data?.tipoFallo ?? order?.tipoFallo ?? '—';
  const orderEstado = order?.estado ?? EstadoOrden.PENDIENTE;
  const ragEstado = data?.estado ?? 'pendiente';

  if (isLoading) return <Skeleton className="h-[380px] w-full" />;

  const metaParts = [
    'Plan generado automáticamente',
    tipoFallo !== '—' ? `Tipo ${tipoFallo}` : null,
    multiclassMeta?.modeloLider
      ? `${prettyModel(multiclassMeta.modeloLider)}${multiclassMeta.confianza != null ? ` ${multiclassMeta.confianza.toFixed(1)}%` : ''}`
      : null,
    multiclassMeta?.agreement ? `Agreement ${multiclassMeta.agreement}` : null,
  ].filter(Boolean);

  const canExport = (data?.acciones?.length ?? 0) > 0 || tipoFallo !== '—';

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        {metaParts.length > 0 ? (
          <p className="text-xs text-accent">{metaParts.join(' • ')}</p>
        ) : (
          <span />
        )}
        <ExportPdfButton
          label="Exportar recomendación RAG (PDF)"
          disabled={!canExport}
          onClick={() => {
            downloadRagRecommendationPdf({
              ctx: pdfContext,
              order,
              tipoFallo: tipoFallo !== '—' ? tipoFallo : 'RNF',
              estado: ragEstado,
              escalado: data?.escalado,
              acciones: data?.acciones ?? [],
              fuentes: data?.fuentes,
              multiclassMeta,
            });
          }}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader>
            <CardTitle>Plan de Acción RAG — {tipoFallo}</CardTitle>
            <p className="text-xs text-ink-muted">
              Basado en el historial de {order?.maquinaId ?? 'la máquina'} y tipo de fallo{' '}
              {tipoFallo} confirmado
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            {(data?.acciones ?? []).map((a) => (
              <div key={a.orden} className="flex gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent text-sm font-bold text-white">
                  {a.orden}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-semibold text-ink">{a.titulo}</p>
                    <Badge variant={ragPriorityVariant(a.prioridad)}>
                      {formatRagPriority(a.prioridad)}
                    </Badge>
                  </div>
                  <RagDetailText text={a.detalle} />
                </div>
              </div>
            ))}
            <div className="space-y-4">
              <RagSourcesFooter fuentes={data?.fuentes} />
              <RagRegenerateButton
                orderId={orderId}
                fullWidth
                onRegenerated={onRegenerated}
              />
            </div>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <RagTechnicianResponsePanel
            orderId={orderId}
            orderEstado={orderEstado}
            ragEstado={ragEstado}
            maquinaId={order?.maquinaId}
            tipoFallo={tipoFallo !== '—' ? tipoFallo : order?.tipoFallo}
            onUpdated={onRegenerated}
            showRagDecisionStatus={false}
          />

          {/* <Card>
            <CardHeader>
              <CardTitle>Registrar Solución Aplicada</CardTitle>
              <p className="text-xs text-ink-muted">Completa cuando la intervención finalice</p>
            </CardHeader>
            <CardContent className="space-y-3">
              {isFinalized ? (
                <div className="space-y-2 rounded-md border border-border-soft bg-surface-2 p-3 text-sm">
                  <p className="text-xs text-ink-muted">Tipo de solución</p>
                  <p className="font-medium text-ink">
                    {order?.solucionTipo === SolucionTipo.PROPIA
                      ? 'Solución propia'
                      : order?.solucionTipo === SolucionTipo.RECHAZADA_MANUAL
                        ? 'Rechazada / manual'
                        : 'Con recomendaciones RAG'}
                  </p>
                  <p className="mt-2 text-xs text-ink-muted">Descripción</p>
                  <p className="text-ink-soft">{order?.solucionDescripcion ?? '—'}</p>
                </div>
              ) : canRegisterSolution ? (
                <>
                  <div className="space-y-2">
                    <label className="text-xs text-ink-muted" htmlFor="solution-desc">
                      Descripción de la solución
                    </label>
                    <textarea
                      id="solution-desc"
                      rows={4}
                      value={solutionText}
                      onChange={(e) => setSolutionText(e.target.value)}
                      placeholder="Ej: Se limpió el sistema de refrigeración…"
                      className="w-full rounded-md border border-border bg-bg px-3 py-2 text-sm text-ink placeholder:text-ink-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
                    />
                  </div>

                  <div className="space-y-2">
                    <p className="text-xs text-ink-muted">Solución usada:</p>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setSolutionTipo(SolucionTipo.CON_RAG)}
                        className={cn(
                          'rounded-md border px-3 py-2 text-xs font-semibold transition-colors',
                          solutionTipo === SolucionTipo.CON_RAG
                            ? 'border-accent bg-accent/10 text-accent'
                            : 'border-border bg-surface-2 text-ink-muted hover:text-ink',
                        )}
                      >
                        Con recomendaciones RAG
                      </button>
                      <button
                        type="button"
                        onClick={() => setSolutionTipo(SolucionTipo.PROPIA)}
                        className={cn(
                          'rounded-md border px-3 py-2 text-xs font-semibold transition-colors',
                          solutionTipo === SolucionTipo.PROPIA
                            ? 'border-accent bg-accent/10 text-accent'
                            : 'border-border bg-surface-2 text-ink-muted hover:text-ink',
                        )}
                      >
                        Solución propia
                      </button>
                    </div>
                  </div>

                  <button
                    type="button"
                    disabled={busy || !orderId || !solutionText.trim()}
                    onClick={handleRegisterSolution}
                    className="flex w-full flex-col items-center rounded-lg bg-success px-4 py-3 text-center text-sm font-semibold text-white transition-colors hover:bg-success/90 disabled:opacity-50"
                  >
                    <span>Registrar y Finalizar Orden</span>
                    <span className="mt-1 text-[11px] font-normal opacity-90">
                      → Estado: Finalizado
                    </span>
                  </button>
                </>
              ) : (
                <p className="text-sm text-ink-muted">
                  Acepta las recomendaciones RAG para habilitar el registro de solución.
                </p>
              )}
            </CardContent>
          </Card> */}

          {/* Fuentes RAG configurables — oculto por ahora (no está en diseño Figma actual)
          <Card>
            <CardHeader>
              <CardTitle>Fuentes RAG</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="rounded-md border border-border-soft bg-surface-2 p-3">
                <p className="text-sm font-semibold text-ink">Fuentes RAG disponibles</p>
                <p className="mt-1 text-xs text-ink-muted">
                  Selecciona las fuentes que el LLM puede usar al regenerar el plan.
                </p>
                <div className="mt-3 space-y-2">
                  {activeSources.map((source) => (
                    <label key={source.id} className="flex items-start gap-2 text-xs text-ink-soft">
                      <input
                        type="checkbox"
                        className="mt-0.5 accent-accent"
                        checked={selectedSourceIds.includes(source.id)}
                        onChange={() => toggleSource(source.id)}
                      />
                      <span>
                        <span className="font-semibold text-ink">{source.fuente}</span>
                        {source.descripcion ? ` · ${source.descripcion}` : ''}
                      </span>
                    </label>
                  ))}
                  {!sources.isLoading && activeSources.length === 0 && (
                    <p className="text-xs text-ink-muted">No hay fuentes activas configuradas.</p>
                  )}
                </div>
              </div>
              <Button
                variant="secondary"
                fullWidth
                disabled={!orderId || selectedSourceIds.length === 0 || isRegenerating}
                onClick={handleRegenerate}
              >
                {isRegenerating ? 'Regenerando...' : 'Regenerar con fuentes'}
              </Button>
              {regenerateError && <p className="text-xs text-danger">{regenerateError}</p>}
            </CardContent>
          </Card>
          */}
        </div>
      </div>
    </div>
  );
}

function formatRagPriority(prioridad: string): string {
  switch (prioridad?.toUpperCase()) {
    case 'CRITICO':
      return 'Crítica';
    case 'MEDIO':
      return 'Moderada';
    case 'BAJO':
    case 'ALTO':
      return 'Baja';
    default:
      return prioridad ?? '—';
  }
}

function ragPriorityVariant(prioridad: string): 'critical' | 'low' | 'medium' | 'default' {
  switch (prioridad?.toUpperCase()) {
    case 'CRITICO':
      return 'critical';
    case 'BAJO':
    case 'ALTO':
      return 'low';
    case 'MEDIO':
      return 'medium';
    default:
      return 'default';
  }
}

function Metric({
  label,
  value,
  className,
}: {
  label: string;
  value: string;
  className?: string;
}) {
  return (
    <div className={className}>
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

function agreementTone(
  agreement: string | null | undefined,
): 'accent' | 'danger' | 'success' | 'warning' {
  switch (agreement?.toUpperCase()) {
    case 'ALTO':
      return 'success';
    case 'MEDIO':
      return 'warning';
    case 'BAJO':
      return 'danger';
    default:
      return 'accent';
  }
}
