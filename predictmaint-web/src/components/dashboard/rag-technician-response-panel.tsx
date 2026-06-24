'use client';

import { useState } from 'react';
import { ragService } from '@/application/services/rag.service';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { EstadoOrden } from '@/core/types';

export function RagTechnicianResponsePanel({
  orderId,
  orderEstado,
  ragEstado,
  maquinaId,
  tipoFallo,
  onUpdated,
  onAccept,
}: {
  orderId: string | null;
  orderEstado: EstadoOrden | string;
  ragEstado: string;
  maquinaId?: string | null;
  tipoFallo?: string | null;
  onUpdated?: () => void;
  /** Si se define, reemplaza el accept por defecto (p. ej. aceptar RAG + iniciar orden). */
  onAccept?: () => Promise<void>;
}) {
  const [rejectComment, setRejectComment] = useState('');
  const [confirmAcceptOpen, setConfirmAcceptOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const isFinalized = orderEstado === EstadoOrden.FINALIZADO;
  const canRespond = orderEstado === EstadoOrden.PENDIENTE && ragEstado === 'pendiente';

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
      await ragService.reject(orderId, rejectComment.trim() || undefined);
      setRejectComment('');
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
          {ragEstado === 'aceptado' && !isFinalized && (
            <p className="text-sm font-medium text-success">Recomendaciones RAG aceptadas</p>
          )}
          {ragEstado === 'rechazado' && (
            <p className="text-sm font-medium text-warning">
              Rechazado — análisis manual pendiente
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
                  Comentario (rechazo o análisis manual)
                </label>
                <textarea
                  id="reject-comment-order"
                  rows={3}
                  value={rejectComment}
                  onChange={(e) => setRejectComment(e.target.value)}
                  placeholder="Indica por qué rechazas o qué revisarás manualmente…"
                  className="w-full rounded-md border border-border bg-bg px-3 py-2 text-sm text-ink placeholder:text-ink-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
                />
                <Button variant="secondary" fullWidth disabled={busy || !orderId} onClick={handleReject}>
                  Rechazar / Analizar manualmente
                </Button>
              </div>
            </>
          )}

          {ragEstado === 'aceptado' && !isFinalized && isInProgressLike(orderEstado) && (
            <p className="text-xs text-ink-muted">
              Orden en progreso. Completa la solución aplicada abajo para finalizar.
            </p>
          )}

          {!canRespond && !isFinalized && ragEstado === 'rechazado' && (
            <p className="text-xs text-ink-muted">
              El técnico rechazó el plan. La orden permanece pendiente hasta nueva decisión.
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

function isInProgressLike(estado: EstadoOrden | string) {
  return estado === EstadoOrden.EN_PROGRESO;
}
