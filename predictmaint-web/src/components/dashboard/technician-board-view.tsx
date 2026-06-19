'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { CheckCircle2, ClipboardList, Eye, Play, ThumbsDown, X } from 'lucide-react';
import { Topbar } from '@/components/common/topbar';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { StatusPill } from '@/components/ui/status-pill';
import { Skeleton } from '@/components/ui/skeleton';
import { useTechnicianBoard } from '@/presentation/hooks/useOrders';
import { orderService } from '@/application/services/order.service';
import type { Order } from '@/core/entities';
import { EstadoOrden } from '@/core/types';
import { cn } from '@/lib/utils/cn';

export function TechnicianBoardView() {
  const router = useRouter();
  const board = useTechnicianBoard();
  const [startingId, setStartingId] = useState<string | null>(null);
  const [rejectOrder, setRejectOrder] = useState<Order | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [rejecting, setRejecting] = useState(false);

  const pendientes = board.data?.pendientes ?? [];
  const completadas = board.data?.completadas ?? [];

  const handleStart = async (orderId: string) => {
    setStartingId(orderId);
    try {
      await orderService.startOrder(orderId);
      await board.mutate();
    } catch {
      alert('No se pudo iniciar la orden');
    } finally {
      setStartingId(null);
    }
  };

  const closeRejectModal = () => {
    if (rejecting) return;
    setRejectOrder(null);
    setRejectReason('');
  };

  const handleReject = async () => {
    if (!rejectOrder || !rejectReason.trim()) return;
    setRejecting(true);
    try {
      await orderService.rejectPrediction(rejectOrder.id, rejectReason.trim());
      await board.mutate();
      setRejectOrder(null);
      setRejectReason('');
    } catch {
      alert('No se pudo rechazar la predicción');
    } finally {
      setRejecting(false);
    }
  };

  return (
    <div className="flex min-h-full flex-col">
      <Topbar
        flush
        title="Mi trabajo"
        subtitle="Tablero de órdenes · pendientes y completadas"
      />

      <div className="flex flex-col gap-4 px-6 pb-6 pt-5">
        {board.isLoading ? (
          <div className="grid gap-4 lg:grid-cols-2">
            <Skeleton className="h-80 w-full" />
            <Skeleton className="h-80 w-full" />
          </div>
        ) : (
          <div className="grid items-start gap-4 lg:grid-cols-2">
            <BoardColumn
              title="Pendientes"
              icon={ClipboardList}
              count={pendientes.length}
              tone="warning"
              emptyMessage="No tienes órdenes pendientes ni en progreso."
            >
              {pendientes.map((order) => (
                <OrderCard
                  key={order.id}
                  order={order}
                  variant="pending"
                  busy={startingId === order.id}
                  onStart={() => handleStart(order.id)}
                  onReject={() => setRejectOrder(order)}
                  onView={() => router.push(`/dashboard/orders/${order.id}`)}
                />
              ))}
            </BoardColumn>

            <BoardColumn
              title="Completadas"
              icon={CheckCircle2}
              count={completadas.length}
              tone="success"
              emptyMessage="Aún no has finalizado ninguna orden."
            >
              {completadas.map((order) => (
                <OrderCard
                  key={order.id}
                  order={order}
                  variant="completed"
                  onView={() => router.push(`/dashboard/orders/${order.id}`)}
                />
              ))}
            </BoardColumn>
          </div>
        )}
      </div>

      {rejectOrder && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={closeRejectModal}
        >
          <Card
            className="w-full max-w-md"
            onClick={(e: React.MouseEvent) => e.stopPropagation()}
          >
            <CardHeader className="flex flex-row items-start justify-between gap-2">
              <div>
                <CardTitle>Rechazar predicción</CardTitle>
                <p className="mt-1 text-sm text-ink-muted">
                  Orden {rejectOrder.id} · {rejectOrder.maquinaId}
                  {rejectOrder.tipoFallo ? ` · ${rejectOrder.tipoFallo}` : ''}
                </p>
              </div>
              <button
                type="button"
                disabled={rejecting}
                onClick={closeRejectModal}
                className="rounded-md p-1 text-ink-muted transition-colors hover:text-ink disabled:opacity-50"
                aria-label="Cerrar"
              >
                <X className="h-5 w-5" />
              </button>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-ink-soft">
                Indica por qué la predicción no corresponde a una falla real. La orden
                quedará marcada como rechazada y volverás a estar disponible.
              </p>
              <textarea
                rows={4}
                autoFocus
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="Ej: La máquina opera dentro de parámetros normales; la lectura fue un pico transitorio del sensor…"
                className="w-full rounded-md border border-border bg-bg px-3 py-2 text-sm text-ink placeholder:text-ink-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
              />
              <div className="flex gap-2">
                <Button
                  variant="secondary"
                  className="flex-1"
                  disabled={rejecting}
                  onClick={closeRejectModal}
                >
                  Cancelar
                </Button>
                <Button
                  variant="danger"
                  className="flex-1"
                  disabled={rejecting || !rejectReason.trim()}
                  onClick={handleReject}
                >
                  Confirmar rechazo
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

function BoardColumn({
  title,
  icon: Icon,
  count,
  tone,
  emptyMessage,
  children,
}: {
  title: string;
  icon: typeof ClipboardList;
  count: number;
  tone: 'warning' | 'success';
  emptyMessage: string;
  children: React.ReactNode;
}) {
  const hasItems = count > 0;
  const toneClasses =
    tone === 'warning'
      ? 'border-warning/30 bg-warning/5'
      : 'border-success/30 bg-success/5';

  return (
    <Card className={cn('flex flex-col', toneClasses)}>
      <CardHeader className="flex flex-row items-center justify-between gap-2 pb-3">
        <div className="flex items-center gap-2">
          <Icon className={cn('h-5 w-5', tone === 'warning' ? 'text-warning' : 'text-success')} />
          <CardTitle className="text-lg">{title}</CardTitle>
        </div>
        <span
          className={cn(
            'rounded-full px-2.5 py-0.5 text-xs font-bold',
            tone === 'warning' ? 'bg-warning/20 text-warning' : 'bg-success/20 text-success',
          )}
        >
          {count}
        </span>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 pt-0">
        {!hasItems ? (
          <p className="rounded-md border border-dashed border-border-soft px-4 py-10 text-center text-sm text-ink-muted">
            {emptyMessage}
          </p>
        ) : (
          children
        )}
      </CardContent>
    </Card>
  );
}

function OrderCard({
  order,
  variant,
  busy,
  onStart,
  onReject,
  onView,
}: {
  order: Order;
  variant: 'pending' | 'completed';
  busy?: boolean;
  onStart?: () => void;
  onReject?: () => void;
  onView: () => void;
}) {
  const isPending = order.estado === EstadoOrden.PENDIENTE;
  const isInProgress = order.estado === EstadoOrden.EN_PROGRESO;

  return (
    <div className="rounded-lg border border-border-soft bg-bg p-4 shadow-sm">
      <div className="mb-3 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-semibold text-ink">{order.id}</p>
          <p className="truncate text-sm text-ink-muted">
            {order.maquinaId} · {order.tipoFallo ?? '—'}
          </p>
        </div>
        <StatusPill status={order.estado} label={order.estado.replace('_', ' ')} />
      </div>

      <dl className="mb-3 grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
        <Info label="Riesgo" value={order.nivelRiesgo} />
        <Info
          label="Detectado"
          value={new Date(order.detectadoEn).toLocaleString('es-PE', {
            day: '2-digit',
            month: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
          })}
        />
        {variant === 'pending' && (
          <Info
            label="Inicio"
            value={
              order.iniciadoEn
                ? new Date(order.iniciadoEn).toLocaleString('es-PE', {
                    day: '2-digit',
                    month: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit',
                  })
                : 'Sin iniciar'
            }
          />
        )}
        {variant === 'completed' && (
          <>
            <Info
              label="Inicio"
              value={
                order.iniciadoEn
                  ? new Date(order.iniciadoEn).toLocaleString('es-PE', {
                      day: '2-digit',
                      month: '2-digit',
                      hour: '2-digit',
                      minute: '2-digit',
                    })
                  : '—'
              }
            />
            <Info
              label="Término"
              value={
                order.finalizadoEn
                  ? new Date(order.finalizadoEn).toLocaleString('es-PE', {
                      day: '2-digit',
                      month: '2-digit',
                      hour: '2-digit',
                      minute: '2-digit',
                    })
                  : '—'
              }
            />
            <Info label="Duración" value={formatDuration(order)} />
          </>
        )}
      </dl>

      {variant === 'pending' && isInProgress && order.iniciadoEn && (
        <p className="mb-3 text-xs text-ink-soft">
          En curso desde {new Date(order.iniciadoEn).toLocaleString('es-PE')}
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        {variant === 'pending' && isPending && onStart && (
          <Button size="sm" disabled={busy} onClick={onStart}>
            <Play className="mr-1.5 h-3.5 w-3.5" />
            Iniciar
          </Button>
        )}
        {variant === 'pending' && isPending && onReject && (
          <Button size="sm" variant="danger" disabled={busy} onClick={onReject}>
            <ThumbsDown className="mr-1.5 h-3.5 w-3.5" />
            Rechazar predicción
          </Button>
        )}
        <Button size="sm" variant="secondary" onClick={onView}>
          <Eye className="mr-1.5 h-3.5 w-3.5" />
          {variant === 'pending' ? 'Ver plan RAG' : 'Ver detalle'}
        </Button>
      </div>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-ink-muted">{label}</dt>
      <dd className="font-medium text-ink">{value}</dd>
    </div>
  );
}

function formatDuration(order: Order): string {
  if (!order.iniciadoEn || !order.finalizadoEn) return '—';
  const ms = new Date(order.finalizadoEn).getTime() - new Date(order.iniciadoEn).getTime();
  if (ms < 0) return '—';
  const totalMinutes = Math.floor(ms / 60_000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes} min`;
  return '< 1 min';
}
