'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Topbar } from '@/components/common/topbar';
import { RagDetailText } from '@/components/common/rag-detail-text';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useOrder, useOrderTimeline } from '@/presentation/hooks/useOrders';
import { useRagPlan } from '@/presentation/hooks/useRag';
import { orderService } from '@/application/services/order.service';
import { ragService } from '@/application/services/rag.service';
import { useSessionStore } from '@/presentation/stores/sessionStore';
import { EstadoOrden, RolUsuario, SolucionTipo } from '@/core/types';
import { cn } from '@/lib/utils/cn';

function isTechnicianRole(rol?: RolUsuario) {
  return rol === RolUsuario.TECNICO || rol === RolUsuario.TECNICO_SENIOR;
}

export function OrderDetailView({ orderId }: { orderId: string }) {
  const router = useRouter();
  const user = useSessionStore((s) => s.user);
  const isTechnician = isTechnicianRole(user?.rol);
  const order = useOrder(orderId);
  const timeline = useOrderTimeline(orderId);
  const rag = useRagPlan(orderId);
  const [solutionText, setSolutionText] = useState('');
  const [observaciones, setObservaciones] = useState('');
  const [solutionTipo, setSolutionTipo] = useState<SolucionTipo>(SolucionTipo.CON_RAG);
  const [esFalla, setEsFalla] = useState(true);
  const [esPrediccionCorrecta, setEsPrediccionCorrecta] = useState(true);
  const [esClasificacionCorrecta, setEsClasificacionCorrecta] = useState(true);
  const [busy, setBusy] = useState(false);

  const data = order.data;
  const isFinalized = data?.estado === EstadoOrden.FINALIZADO;
  const isPending = data?.estado === EstadoOrden.PENDIENTE;
  const isInProgress = data?.estado === EstadoOrden.EN_PROGRESO;
  const canRegister = isInProgress || (!isTechnician && isPending);
  const backHref = isTechnician ? '/dashboard/my-work' : '/dashboard/orders';
  const backLabel = isTechnician ? '← Mi trabajo' : '← Historial';

  const refresh = () => {
    order.mutate();
    timeline.mutate();
    rag.mutate();
  };

  const runAction = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    try {
      await fn();
      refresh();
    } catch {
      alert('No se pudo completar la acción');
    } finally {
      setBusy(false);
    }
  };

  const handleStart = () => runAction(() => orderService.startOrder(orderId));

  const buildRagSolutionText = () => {
    const acciones = rag.data?.acciones ?? [];
    if (!acciones.length) return 'Intervención según plan RAG (sin acciones detalladas)';
    return acciones.map((a) => `${a.orden}. ${a.titulo}`).join('; ');
  };

  const handleAcceptRagAndFinish = () =>
    runAction(async () => {
      await ragService.accept(orderId);
      await orderService.registerSolution(orderId, {
        descripcion: buildRagSolutionText(),
        solucionTipo: SolucionTipo.CON_RAG,
        comentario: observaciones.trim() || undefined,
        esFalla,
        esPrediccionCorrecta,
        esClasificacionCorrecta,
      });
      setObservaciones('');
      if (isTechnician) router.push('/dashboard/my-work');
    });

  const handleRegisterSolution = () =>
    runAction(async () => {
      if (!solutionText.trim()) return;
      await orderService.registerSolution(orderId, {
        descripcion: solutionText.trim(),
        solucionTipo: solutionTipo,
        comentario: observaciones.trim() || undefined,
        esFalla,
        esPrediccionCorrecta,
        esClasificacionCorrecta,
      });
      setSolutionText('');
      setObservaciones('');
      if (isTechnician) router.push('/dashboard/my-work');
    });

  return (
    <div className="flex min-h-full flex-col">
      <Topbar
        flush
        title={`Orden ${orderId} — Detalle Completo`}
        subtitle={`${data?.maquinaId ?? '—'} · ${data?.tipoFallo ?? '—'} · ${data?.detectadoEn ? new Date(data.detectadoEn).toLocaleDateString('es-PE') : ''}`}
        right={
          <Button variant="secondary" size="sm" onClick={() => router.push(backHref)}>
            {backLabel}
          </Button>
        }
      />

      <div className="flex flex-col gap-4 px-6 pb-6 pt-5">
        {order.isLoading ? (
          <Skeleton className="h-[520px] w-full" />
        ) : (
          <div className="grid gap-4 xl:grid-cols-11">
            <Card className="xl:col-span-2">
              <CardHeader className="px-3 py-3">
                <CardTitle>Timeline de la Orden</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 px-3 py-3">
                {(timeline.data ?? []).map((e) => (
                  <div key={e.id} className="border-l-2 border-accent/40 pl-2">
                    <p className="text-sm font-semibold text-ink">{e.etapa.replace(/_/g, ' ')}</p>
                    <p className="text-xs text-ink-muted">
                      {new Date(e.ocurridoEn).toLocaleString('es-PE')}
                    </p>
                    {e.descripcion && <p className="mt-1 text-xs text-ink-soft">{e.descripcion}</p>}
                  </div>
                ))}
                {!timeline.data?.length && (
                  <p className="text-sm text-ink-muted">Sin eventos registrados</p>
                )}
              </CardContent>
            </Card>

            <Card className="xl:col-span-6">
              <CardHeader>
                <CardTitle>Detalle del Fallo — {data?.tipoFallo ?? '—'}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-wrap gap-2">
                  {data?.tipoFallo && <Badge variant="warning">{data.tipoFallo}</Badge>}
                  {data?.modeloPrediccion && (
                    <Badge>S-1: {prettyModelSlug(data.modeloPrediccion)}</Badge>
                  )}
                  {(data?.modeloClasificacion ?? data?.algoritmoClasificador) && (
                    <Badge>
                      S-2: {prettyModelSlug(data.modeloClasificacion ?? data.algoritmoClasificador!)}
                    </Badge>
                  )}
                  {data?.confianzaPrediccion != null && (
                    <Badge variant="accent">S-1 {data.confianzaPrediccion.toFixed(1)}%</Badge>
                  )}
                  {data?.nivelRiesgo && <Badge variant="high">{data.nivelRiesgo}</Badge>}
                </div>

                <div className="grid gap-2 rounded-md border border-border-soft bg-surface-2 p-3 text-sm md:grid-cols-2">
                  <Info label="Máquina" value={data?.maquinaId ?? '—'} />
                  <Info label="Estado" value={data?.estado?.replace('_', ' ') ?? '—'} />
                  <Info
                    label="Inicio"
                    value={
                      data?.iniciadoEn
                        ? new Date(data.iniciadoEn).toLocaleString('es-PE')
                        : '—'
                    }
                  />
                  <Info
                    label="Término"
                    value={
                      data?.finalizadoEn
                        ? new Date(data.finalizadoEn).toLocaleString('es-PE')
                        : '—'
                    }
                  />
                  <Info label="Técnico" value={data?.tecnico?.nombre ?? 'Sin asignar'} />
                  <Info
                    label="Confianza S-1"
                    value={
                      data?.confianzaPrediccion != null
                        ? `${data.confianzaPrediccion.toFixed(1)}%`
                        : data?.confianzaLider != null
                          ? `${(data.confianzaLider * 100).toFixed(1)}%`
                          : '—'
                    }
                  />
                  <Info
                    label="Tipo de solución"
                    value={formatSolucionTipo(data?.solucionTipo)}
                  />
                  <Info
                    label="Solución aplicada"
                    value={data?.solucionDescripcion ?? '—'}
                  />
                  <Info
                    label="Observaciones técnicas"
                    value={
                      data?.observacionTecnica?.comentario ??
                      data?.observacionesOrden ??
                      '—'
                    }
                  />
                </div>

                {data?.lectura && (
                  <div className="grid gap-2 rounded-md border border-border-soft bg-surface-2 p-3 text-sm md:grid-cols-3">
                    <Info label="Temp. aire" value={`${data.lectura.airTemperature} K`} />
                    <Info label="Temp. proceso" value={`${data.lectura.processTemperature} K`} />
                    <Info label="RPM" value={String(data.lectura.rotationalSpeed)} />
                    <Info label="Torque" value={`${data.lectura.torque} Nm`} />
                    <Info label="Desgaste" value={`${data.lectura.toolWear} min`} />
                  </div>
                )}

                {isFinalized && data?.observacionTecnica && (
                  <div className="rounded-md border border-border-soft bg-surface-2 p-3 text-sm">
                    <p className="mb-2 font-semibold text-ink">Validación del técnico</p>
                    <div className="flex flex-wrap gap-2">
                      <Badge variant={data.observacionTecnica.esFalla ? 'danger' : 'success'}>
                        {data.observacionTecnica.esFalla ? 'Falla confirmada' : 'Sin falla real'}
                      </Badge>
                      <Badge variant={data.observacionTecnica.esPrediccionCorrecta ? 'success' : 'warning'}>
                        S-1 {data.observacionTecnica.esPrediccionCorrecta ? 'correcta' : 'incorrecta'}
                      </Badge>
                      <Badge variant={data.observacionTecnica.esClasificacionCorrecta ? 'success' : 'warning'}>
                        S-2 {data.observacionTecnica.esClasificacionCorrecta ? 'correcta' : 'incorrecta'}
                      </Badge>
                    </div>
                  </div>
                )}

                <div>
                  <p className="mb-2 text-sm font-semibold text-ink">Recomendaciones del RAG</p>
                  <div className="space-y-2">
                    {(rag.data?.acciones ?? []).map((a) => (
                      <div
                        key={a.id ?? a.orden}
                        className="rounded-md border border-border-soft bg-surface-2 p-3 text-sm"
                      >
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-semibold text-ink">
                            {a.orden}. {a.titulo}
                          </p>
                          <Badge variant={ragPriorityVariant(a.prioridad)}>
                            {formatRagPriority(a.prioridad)}
                          </Badge>
                        </div>
                        <RagDetailText text={a.detalle} />
                      </div>
                    ))}
                    {!rag.data?.acciones?.length && (
                      <p className="text-sm text-ink-muted">Sin recomendaciones (S-1 sin falla o sin S-3)</p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="space-y-3 xl:col-span-3">
              <Card>
                <CardHeader>
                  <CardTitle>Registrar Solución Aplicada</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {isPending && isTechnician && (
                    <div className="rounded-md border border-warning/40 bg-warning/10 p-3 text-sm text-ink-soft">
                      Debes iniciar la orden para registrar tiempos y finalizar la intervención.
                      <Button className="mt-3 w-full" disabled={busy} onClick={handleStart}>
                        Iniciar orden
                      </Button>
                    </div>
                  )}

                  {isFinalized ? (
                    <div className="space-y-3 rounded-md border border-border-soft bg-surface-2 p-3 text-sm">
                      <div>
                        <p className="text-xs text-ink-muted">Tipo de solución</p>
                        <p className="font-medium text-ink">{formatSolucionTipo(data?.solucionTipo)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-ink-muted">Descripción</p>
                        <p className="text-ink-soft">{data?.solucionDescripcion ?? '—'}</p>
                      </div>
                      <div>
                        <p className="text-xs text-ink-muted">Observaciones</p>
                        <p className="text-ink-soft">
                          {data?.observacionTecnica?.comentario ?? data?.observacionesOrden ?? '—'}
                        </p>
                      </div>
                    </div>
                  ) : canRegister ? (
                    <>
                      {isInProgress && (rag.data?.acciones?.length ?? 0) > 0 && (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={handleAcceptRagAndFinish}
                          className="flex w-full flex-col items-center rounded-lg bg-accent px-4 py-3 text-center text-sm font-semibold text-white transition-colors hover:bg-accent/90 disabled:opacity-50"
                        >
                          <span>Aceptar plan RAG y finalizar</span>
                          <span className="mt-1 text-xs font-normal opacity-90">
                            Registra término y libera al técnico
                          </span>
                        </button>
                      )}

                      <div className="space-y-2">
                        <p className="text-xs text-ink-muted">Solución usada:</p>
                        <div className="grid grid-cols-1 gap-2">
                          <button
                            type="button"
                            onClick={() => setSolutionTipo(SolucionTipo.CON_RAG)}
                            className={cn(
                              'rounded-md border px-3 py-2 text-left text-xs font-semibold transition-colors',
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
                              'rounded-md border px-3 py-2 text-left text-xs font-semibold transition-colors',
                              solutionTipo === SolucionTipo.PROPIA
                                ? 'border-accent bg-accent/10 text-accent'
                                : 'border-border bg-surface-2 text-ink-muted hover:text-ink',
                            )}
                          >
                            Solución propia
                          </button>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <label className="text-xs text-ink-muted" htmlFor="solution-desc">
                          Descripción de la solución
                        </label>
                        <textarea
                          id="solution-desc"
                          rows={4}
                          value={solutionText}
                          onChange={(e) => setSolutionText(e.target.value)}
                          placeholder="Ej: Se reemplazó la herramienta y se verificó alineación del husillo…"
                          className="w-full rounded-md border border-border bg-bg px-3 py-2 text-sm text-ink placeholder:text-ink-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
                        />
                      </div>

                      <div className="space-y-2">
                        <label className="text-xs text-ink-muted" htmlFor="observaciones">
                          Observaciones técnicas
                        </label>
                        <textarea
                          id="observaciones"
                          rows={3}
                          value={observaciones}
                          onChange={(e) => setObservaciones(e.target.value)}
                          placeholder="Comentarios sobre la intervención, validación del fallo o del modelo…"
                          className="w-full rounded-md border border-border bg-bg px-3 py-2 text-sm text-ink placeholder:text-ink-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
                        />
                      </div>

                      <div className="space-y-2 rounded-md border border-border-soft bg-surface-2 p-3">
                        <p className="text-xs font-semibold text-ink">Validación ML</p>
                        <label className="flex items-center gap-2 text-xs text-ink-soft">
                          <input
                            type="checkbox"
                            className="accent-accent"
                            checked={esFalla}
                            onChange={(e) => setEsFalla(e.target.checked)}
                          />
                          Se confirmó falla real en planta
                        </label>
                        <label className="flex items-center gap-2 text-xs text-ink-soft">
                          <input
                            type="checkbox"
                            className="accent-accent"
                            checked={esPrediccionCorrecta}
                            onChange={(e) => setEsPrediccionCorrecta(e.target.checked)}
                          />
                          Predicción S-1 fue correcta
                        </label>
                        <label className="flex items-center gap-2 text-xs text-ink-soft">
                          <input
                            type="checkbox"
                            className="accent-accent"
                            checked={esClasificacionCorrecta}
                            onChange={(e) => setEsClasificacionCorrecta(e.target.checked)}
                          />
                          Clasificación S-2 fue correcta
                        </label>
                      </div>

                      <button
                        type="button"
                        disabled={busy || !solutionText.trim()}
                        onClick={handleRegisterSolution}
                        className="flex w-full flex-col items-center rounded-lg bg-success px-4 py-3 text-center text-sm font-semibold text-white transition-colors hover:bg-success/90 disabled:opacity-50"
                      >
                        <span>Finalizar Orden</span>
                      </button>

                      <Button
                        fullWidth
                        variant="warning"
                        disabled={busy || isTechnician}
                        onClick={() =>
                          runAction(() =>
                            orderService.escalate(orderId, 'Escalado manual desde historial'),
                          )
                        }
                      >
                        Escalar a Supervisor
                      </Button>
                    </>
                  ) : (
                    <p className="text-sm text-ink-muted">
                      La orden no admite más cambios en este estado.
                    </p>
                  )}

                  {data?.maquinaId && !isTechnician && (
                    <Button
                      fullWidth
                      variant="secondary"
                      onClick={() =>
                        router.push(`/dashboard/analysis/${data.maquinaId}?order=${orderId}`)
                      }
                    >
                      Ver análisis ML
                    </Button>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-ink-muted">{label}</p>
      <p className="font-medium text-ink">{value}</p>
    </div>
  );
}

function formatSolucionTipo(tipo?: SolucionTipo | string | null) {
  switch (tipo) {
    case SolucionTipo.PROPIA:
    case 'propia':
      return 'Solución propia';
    case SolucionTipo.RECHAZADA_MANUAL:
    case 'rechazada_manual':
      return 'Rechazada / manual';
    case SolucionTipo.CON_RAG:
    case 'con_rag':
      return 'Con recomendaciones RAG';
    default:
      return '—';
  }
}

function formatRagPriority(prioridad: string): string {
  switch (prioridad?.toUpperCase()) {
    case 'CRITICO':
      return 'critico';
    case 'MEDIO':
      return 'medio';
    case 'BAJO':
    case 'ALTO':
      return 'bajo';
    default:
      return prioridad?.toLowerCase() ?? '—';
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

function prettyModelSlug(model: string) {
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
