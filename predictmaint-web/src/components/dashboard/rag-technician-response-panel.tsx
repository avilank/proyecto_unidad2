'use client';

import { useState } from 'react';
import { ragService } from '@/application/services/rag.service';
import { orderService } from '@/application/services/order.service';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { EstadoOrden, SolucionTipo } from '@/core/types';

export function RagTechnicianResponsePanel({
  orderId,
  orderEstado,
  ragEstado,
  maquinaId,
  tipoFallo,
  onUpdated,
  onAccept,
  onRejectAndStart,
  onFinalizeManual,
  showRagDecisionStatus = true,
}: {
  orderId: string | null;
  orderEstado: EstadoOrden | string;
  ragEstado: string;
  maquinaId?: string | null;
  tipoFallo?: string | null;
  onUpdated?: () => void;
  /** Aceptar RAG e iniciar orden (p. ej. accept + startOrder). */
  onAccept?: () => Promise<void>;
  /** Rechazar RAG e iniciar orden con el motivo del técnico. */
  onRejectAndStart?: (motivo: string) => Promise<void>;
  /** Finalizar tras análisis manual (solución aplicada + observaciones). */
  onFinalizeManual?: (payload: { solucion: string; observaciones: string }) => Promise<void>;
  /** Muestra badges de plan RAG aceptado/rechazado (detalle de orden); ocultar en panel lateral. */
  showRagDecisionStatus?: boolean;
}) {
  const [rejectComment, setRejectComment] = useState('');
  const [manualSolution, setManualSolution] = useState('');
  const [manualObservations, setManualObservations] = useState('');
  const [confirmAcceptOpen, setConfirmAcceptOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const isFinalized = orderEstado === EstadoOrden.FINALIZADO;
  const isInProgress = orderEstado === EstadoOrden.EN_PROGRESO;
  const canRespond = orderEstado === EstadoOrden.PENDIENTE && ragEstado === 'pendiente';
  const showManualFinalize = isInProgress && ragEstado === 'rechazado' && !isFinalized;

  const runAction = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setActionError(null);
    try {
      await fn();
      onUpdated?.();
    } catch {
      setActionError('No se pudo completar la acción. Intenta de nuevo.');
    } finally {
      setBusy(false);
    }
  };

  const handleAccept = () =>
    runAction(async () => {
      if (!orderId) return;
      if (onAccept) {
        await onAccept();
      } else {
        await ragService.accept(orderId);
      }
      setConfirmAcceptOpen(false);
    });

  const handleReject = () =>
    runAction(async () => {
      if (!orderId) return;
      const motivo = rejectComment.trim();
      if (!motivo) {
        setActionError('Indica por qué rechazas el plan RAG antes de continuar.');
        return;
      }
      if (onRejectAndStart) {
        await onRejectAndStart(motivo);
      } else {
        await ragService.reject(orderId, motivo);
        await orderService.startOrder(orderId);
      }
      setRejectComment('');
    });

  const handleFinalizeManual = () =>
    runAction(async () => {
      if (!orderId) return;
      const solucion = manualSolution.trim();
      const observaciones = manualObservations.trim();
      if (!solucion) {
        setActionError('Indica la solución que aplicaste en planta.');
        return;
      }
      if (!observaciones) {
        setActionError('Describe qué revisaste o qué encontraste durante la intervención.');
        return;
      }
      if (onFinalizeManual) {
        await onFinalizeManual({ solucion, observaciones });
      } else {
        await orderService.registerSolution(orderId, {
          descripcion: solucion,
          solucionTipo: SolucionTipo.RECHAZADA_MANUAL,
          comentario: observaciones,
          esFalla: false,
          esPrediccionCorrecta: false,
          esClasificacionCorrecta: false,
        });
      }
      setManualSolution('');
      setManualObservations('');
    });

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Respuesta del Técnico</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {canRespond && (
            <p className="text-sm font-medium text-warning">Pendiente de respuesta</p>
          )}
          {showRagDecisionStatus && ragEstado === 'aceptado' && !isFinalized && (
            <p className="text-sm font-medium text-success">Recomendaciones RAG aceptadas</p>
          )}
          {showRagDecisionStatus && ragEstado === 'rechazado' && !isFinalized && (
            <p className="text-sm font-medium text-warning">
              Plan RAG rechazado — intervención manual en curso
            </p>
          )}
          {isFinalized && (
            <p className="text-sm font-medium text-success">Orden finalizada</p>
          )}

          {canRespond && (
            <>
              <button
                type="button"
                disabled={busy || !orderId}
                onClick={() => setConfirmAcceptOpen(true)}
                className="flex w-full flex-col items-center rounded-lg bg-success px-4 py-3 text-center text-sm font-semibold text-white transition-colors hover:bg-success/90 disabled:opacity-50"
              >
                <span>Aceptar recomendaciones RAG</span>
              </button>

              <div className="space-y-2">
                <label className="text-xs text-ink-muted" htmlFor="reject-comment-order">
                  Motivo del rechazo
                </label>
                <textarea
                  id="reject-comment-order"
                  rows={3}
                  value={rejectComment}
                  onChange={(e) => setRejectComment(e.target.value)}
                  placeholder="Indica por qué rechazas el plan RAG…"
                  className="w-full rounded-md border border-border bg-bg px-3 py-2 text-sm text-ink placeholder:text-ink-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
                />
                <Button
                  variant="secondary"
                  fullWidth
                  disabled={busy || !orderId || !rejectComment.trim()}
                  onClick={handleReject}
                >
                  Rechazar e iniciar intervención manual
                </Button>
              </div>
            </>
          )}

          {showManualFinalize && (
            <div className="space-y-3">
              <p className="text-xs text-ink-muted">
                Orden en progreso. Registra la solución aplicada y tus observaciones antes de finalizar.
              </p>
              <div className="space-y-2">
                <label className="text-xs text-ink-muted" htmlFor="manual-solution">
                  Solución aplicada
                </label>
                <textarea
                  id="manual-solution"
                  rows={3}
                  value={manualSolution}
                  onChange={(e) => setManualSolution(e.target.value)}
                  placeholder="Ej: Limpieza de sistema de ventilación y recalibración del variador…"
                  className="w-full rounded-md border border-border bg-bg px-3 py-2 text-sm text-ink placeholder:text-ink-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs text-ink-muted" htmlFor="manual-observations">
                  Observaciones de la intervención
                </label>
                <textarea
                  id="manual-observations"
                  rows={3}
                  value={manualObservations}
                  onChange={(e) => setManualObservations(e.target.value)}
                  placeholder="Ej: Se verificó flujo de aire, temperatura estable tras intervención…"
                  className="w-full rounded-md border border-border bg-bg px-3 py-2 text-sm text-ink placeholder:text-ink-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
                />
              </div>
              <button
                type="button"
                disabled={
                  busy || !orderId || !manualSolution.trim() || !manualObservations.trim()
                }
                onClick={handleFinalizeManual}
                className="flex w-full flex-col items-center rounded-lg bg-success px-4 py-3 text-center text-sm font-semibold text-white transition-colors hover:bg-success/90 disabled:opacity-50"
              >
                <span>Finalizar orden</span>
              </button>
            </div>
          )}

          {ragEstado === 'aceptado' && !isFinalized && isInProgress && (
            <p className="text-xs text-ink-muted">
              Orden en progreso. Completa la solución aplicada abajo para finalizar.
            </p>
          )}

          {actionError && <p className="text-sm text-danger">{actionError}</p>}
        </CardContent>
      </Card>

      {confirmAcceptOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          role="presentation"
          onClick={() => !busy && setConfirmAcceptOpen(false)}
        >
          <Card className="w-full max-w-md shadow-pop" onClick={(e) => e.stopPropagation()}>
            <CardHeader>
              <CardTitle>Confirmar acción</CardTitle>
              <p className="text-xs text-ink-muted">
                Orden {orderId} • Máquina {maquinaId ?? '—'} • Fallo {tipoFallo ?? '—'}
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-ink-soft">
                ¿Aceptas las recomendaciones RAG? La orden pasará a{' '}
                <strong className="text-ink">En progreso</strong> y podrás registrar la intervención
                al finalizar.
              </p>
              <div className="flex gap-3">
                <button
                  type="button"
                  disabled={busy}
                  onClick={handleAccept}
                  className="flex-1 rounded-md bg-success px-4 py-2.5 text-sm font-semibold text-white hover:bg-success/90 disabled:opacity-50"
                >
                  Confirmar
                </button>
                <Button
                  variant="secondary"
                  className="flex-1"
                  disabled={busy}
                  onClick={() => setConfirmAcceptOpen(false)}
                >
                  Cancelar
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </>
  );
}
