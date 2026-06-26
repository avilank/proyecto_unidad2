'use client';

import { useRouter } from 'next/navigation';
import { CheckCircle2, ClipboardList, Eye } from 'lucide-react';
import { Topbar } from '@/components/common/topbar';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { StatusPill } from '@/components/ui/status-pill';
import { Skeleton } from '@/components/ui/skeleton';
import { useTechnicianBoard } from '@/presentation/hooks/useOrders';
import type { Order } from '@/core/entities';
import { cn } from '@/lib/utils/cn';

export function TechnicianBoardView() {
  const router = useRouter();
  const board = useTechnicianBoard();

  const pendientes = board.data?.pendientes ?? [];
  const completadas = board.data?.completadas ?? [];

  return (
    <div className="flex min-h-full flex-col">
      <Topbar
        flush
        title="Mi trabajo"
        subtitle="Tablero de órdenes · pendientes y completadas"
      />

      <div className="flex flex-col gap-4 px-6 pb-6 pt-5 ">
        {board.isLoading ? (
          <div className="grid gap-4 lg:grid-cols-2">
            <Skeleton className="h-80 w-full" />
            <Skeleton className="h-80 w-full" />
          </div>
        ) : (
          <div className="grid items-start gap-4 lg:grid-cols-2 ">
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
  const columnTone =
    tone === 'warning' ? 'bg-warning/[0.08]' : 'bg-success/[0.08]';

  return (
    <section className={cn('flex flex-col rounded-xl p-5', columnTone)}>
      <div className="mb-4 flex flex-row items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Icon className={cn('h-5 w-5', tone === 'warning' ? 'text-warning' : 'text-success')} />
          <h2 className="text-lg font-semibold text-ink">{title}</h2>
        </div>
        <span
          className={cn(
            'rounded-full px-2.5 py-0.5 text-xs font-bold',
            tone === 'warning' ? 'bg-warning/20 text-warning' : 'bg-success/20 text-success',
          )}
        >
          {count}
        </span>
      </div>
      <div className="flex flex-col gap-3">
        {!hasItems ? (
          <p className="rounded-lg border border-dashed border-border bg-surface px-4 py-10 text-center text-sm text-ink-muted">
            {emptyMessage}
          </p>
        ) : (
          children
        )}
      </div>
    </section>
  );
}

function orderCardStyles(order: Order, variant: 'pending' | 'completed') {
  if (variant === 'completed') {
    return 'border-l-success';
  }
  if (order.estado === 'en_progreso') {
    return 'border-l-accent';
  }
  return 'border-l-warning';
}

function OrderCard({
  order,
  variant,
  onView,
}: {
  order: Order;
  variant: 'pending' | 'completed';
  onView: () => void;
}) {
  return (
    <div
      className={cn(
        'rounded-xl border border-border-soft border-l-4 bg-surface p-4 shadow-card transition-colors',
        orderCardStyles(order, variant),
      )}
    >
      <div className="mb-3 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-semibold text-ink">{order.id}</p>
          <p className="truncate text-sm text-ink-muted">
            {order.maquinaId} · {order.tipoFallo ?? '—'}
          </p>
        </div>
        <div className="flex flex-col items-end gap-1.5">
          <StatusPill status={order.estado} label={order.estado.replace('_', ' ')} />
          {order.ragEstado === 'rechazado' && (
            <Badge variant="warning">Plan rechazado</Badge>
          )}
        </div>
      </div>

      <dl className="mb-3 grid grid-cols-2 gap-2 text-xs">
        <Info label="Riesgo" value={order.nivelRiesgo} highlight={order.nivelRiesgo === 'CRITICAL'} />
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

      {variant === 'pending' && order.estado === 'en_progreso' && order.iniciadoEn && (
        <p className="mb-3 text-xs text-ink-soft">
          En curso desde {new Date(order.iniciadoEn).toLocaleString('es-PE')}
        </p>
      )}

      <Button size="sm" variant="secondary" fullWidth onClick={onView}>
        <Eye className="mr-1.5 h-3.5 w-3.5" />
        {variant === 'pending' ? 'Ver plan RAG' : 'Ver detalle'}
      </Button>
    </div>
  );
}

function Info({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="rounded-lg border border-border-soft bg-surface-2 px-2.5 py-2">
      <dt className="text-[10px] font-semibold uppercase tracking-wide text-ink-muted">{label}</dt>
      <dd className={cn('mt-0.5 font-medium', highlight ? 'text-danger' : 'text-ink')}>{value}</dd>
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
