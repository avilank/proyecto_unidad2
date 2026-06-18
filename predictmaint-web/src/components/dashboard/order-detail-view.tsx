'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Topbar } from '@/components/common/topbar';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { useOrder, useOrderTimeline } from '@/presentation/hooks/useOrders';
import { useRagPlan } from '@/presentation/hooks/useRag';
import { orderService } from '@/application/services/order.service';
import { EstadoOrden, SolucionTipo } from '@/core/types';

export function OrderDetailView({ orderId }: { orderId: string }) {
  const router = useRouter();
  const order = useOrder(orderId);
  const timeline = useOrderTimeline(orderId);
  const rag = useRagPlan(orderId);
  const [solutionText, setSolutionText] = useState('');
  const [busy, setBusy] = useState(false);

  const data = order.data;

  const refresh = () => {
    order.mutate();
    timeline.mutate();
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

  return (
    <div className="flex flex-col gap-4">
      <Topbar
        title={`Orden ${orderId} — Detalle Completo`}
        subtitle={`${data?.maquinaId ?? '—'} · ${data?.tipoFallo ?? '—'} · ${data?.detectadoEn ? new Date(data.detectadoEn).toLocaleDateString('es-PE') : ''}`}
        right={
          <Button variant="secondary" size="sm" onClick={() => router.push('/dashboard/orders')}>
            ← Historial
          </Button>
        }
      />

      {order.isLoading ? (
        <Skeleton className="h-[520px] w-full" />
      ) : (
        <div className="grid gap-4 xl:grid-cols-5">
          <Card className="xl:col-span-1">
            <CardHeader>
              <CardTitle>Timeline de la Orden</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {(timeline.data ?? []).map((e) => (
                <div key={e.id} className="border-l-2 border-accent/40 pl-3">
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

          <Card className="xl:col-span-3">
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
                {data?.confianza != null && (
                  <Badge variant="accent">S-2 {data.confianza.toFixed(1)}%</Badge>
                )}
                {data?.nivelRiesgo && <Badge variant="high">{data.nivelRiesgo}</Badge>}
              </div>

              <div className="grid gap-2 rounded-md border border-border-soft bg-surface-2 p-3 text-sm md:grid-cols-2">
                <Info label="Máquina" value={data?.maquinaId ?? '—'} />
                <Info label="Estado" value={data?.estado?.replace('_', ' ') ?? '—'} />
                <Info label="Técnico" value={data?.tecnico?.nombre ?? 'Sin asignar'} />
                <Info
                  label="Confianza S-2"
                  value={data?.confianza != null ? `${data.confianza.toFixed(1)}%` : '—'}
                />
                <Info
                  label="Confianza S-1 (líder)"
                  value={
                    data?.confianzaPrediccion != null
                      ? `${data.confianzaPrediccion.toFixed(1)}%`
                      : data?.confianzaLider != null
                        ? `${(data.confianzaLider * 100).toFixed(1)}%`
                        : '—'
                  }
                />
                <Info
                  label="Solución"
                  value={data?.solucionDescripcion ?? '—'}
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

              <div>
                <p className="mb-2 text-sm font-semibold text-ink">Recomendaciones RAG generadas</p>
                <div className="space-y-2">
                  {(rag.data?.acciones ?? []).map((a) => (
                    <div
                      key={a.id ?? a.orden}
                      className="rounded-md border border-border-soft bg-surface-2 p-3 text-sm"
                    >
                      <p className="font-semibold text-ink">
                        {a.orden}. {a.titulo}
                      </p>
                      <p className="text-ink-soft">{a.detalle}</p>
                    </div>
                  ))}
                  {!rag.data?.acciones?.length && (
                    <p className="text-sm text-ink-muted">Sin recomendaciones (S-1 sin falla o sin S-3)</p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="space-y-4 xl:col-span-1">
            <Card>
              <CardHeader>
                <CardTitle>Acciones</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {data?.estado === EstadoOrden.PENDIENTE && (
                  <Button
                    fullWidth
                    variant="secondary"
                    disabled={busy}
                    onClick={() =>
                      runAction(() =>
                        orderService.updateStatus(orderId, EstadoOrden.EN_PROGRESO),
                      )
                    }
                  >
                    Marcar En Progreso
                  </Button>
                )}
                <Input
                  label="Descripción solución"
                  placeholder="Acciones realizadas…"
                  value={solutionText}
                  onChange={(e) => setSolutionText(e.target.value)}
                />
                <Button
                  fullWidth
                  disabled={busy || !solutionText.trim() || data?.estado === EstadoOrden.FINALIZADO}
                  onClick={() =>
                    runAction(() =>
                      orderService.registerSolution(orderId, {
                        descripcion: solutionText.trim(),
                        solucionTipo: SolucionTipo.CON_RAG,
                      }),
                    )
                  }
                >
                  Registrar Solución y Cerrar
                </Button>
                <Button
                  fullWidth
                  variant="warning"
                  disabled={busy}
                  onClick={() =>
                    runAction(() =>
                      orderService.escalate(orderId, 'Escalado manual desde historial'),
                    )
                  }
                >
                  Escalar a Supervisor
                </Button>
                {data?.maquinaId && (
                  <Button
                    fullWidth
                    variant="secondary"
                    onClick={() => router.push(`/dashboard/analysis/${data.maquinaId}?order=${orderId}`)}
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
