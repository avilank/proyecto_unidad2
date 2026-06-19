'use client';

import Link from 'next/link';
import type { UnattendedOrder } from '@/core/types/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { formatWaitingTime } from '@/lib/utils/analytics';

function buildAlertHref(order: UnattendedOrder): string {
  const params = new URLSearchParams({ order: order.id });
  if (order.alertaId) params.set('alert', order.alertaId);
  return `/dashboard/analysis/${order.maquinaId}?${params.toString()}`;
}

export function UnattendedPanel({
  orders,
  isLoading,
  error,
}: {
  orders?: UnattendedOrder[];
  isLoading?: boolean;
  error?: unknown;
}) {
  return (
    <Card className="h-full min-h-[320px] border-t-4 border-t-danger">
      <CardHeader>
        <CardTitle>Alertas sin atender</CardTitle>
        <p className="text-xs text-ink-muted">Ordenes en Pendiente sin respuesta del tecnico</p>
      </CardHeader>
      <CardContent className="space-y-3">
        {isLoading ? (
          <Skeleton className="h-40 w-full" />
        ) : error ? (
          <p className="py-8 text-center text-sm text-danger">
            No se pudieron cargar las alertas sin atender
          </p>
        ) : !orders?.length ? (
          <p className="py-8 text-center text-sm text-ink-muted">
            No hay ordenes pendientes sin respuesta del tecnico
          </p>
        ) : (
          orders.map((order) => (
            <Link
              key={order.id}
              href={buildAlertHref(order)}
              className="block rounded-lg border border-border-soft bg-surface-2/40 px-4 py-3 transition-colors hover:bg-surface-2"
            >
              <div className="min-w-0 space-y-1.5">
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="font-semibold text-ink">{order.id}</span>
                  <span className="text-ink-muted">{order.maquinaId}</span>
                </div>
                <p className="text-xs">
                  <span className="font-medium text-warning">
                    Sin atender: {formatWaitingTime(order.minutosSinAtender)}
                  </span>
                  <span className="text-ink-muted"> · Tecnico: {order.tecnico}</span>
                </p>
              </div>
            </Link>
          ))
        )}
      </CardContent>
    </Card>
  );
}
