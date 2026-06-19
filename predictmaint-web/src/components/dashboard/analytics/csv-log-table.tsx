'use client';

import type { NotificationLogEntry } from '@/core/types/api';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DataTable } from '@/components/ui/data-table';
import { TableSkeleton } from '@/components/ui/skeleton';
import { formatNotificationEstado, formatNotificationMotivo, formatNotificationTime } from '@/lib/utils/analytics';

export function CsvLogTable({
  items,
  isLoading,
}: {
  items?: NotificationLogEntry[];
  isLoading?: boolean;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Log de mensajes automáticos</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <TableSkeleton rows={6} />
        ) : (
          <DataTable
            rows={items ?? []}
            emptyMessage="No hay mensajes registrados"
            columns={[
              {
                key: 'hora',
                header: 'Hora',
                render: (row) => formatNotificationTime(row.enviadoEn),
              },
              {
                key: 'tecnico',
                header: 'Técnico',
                render: (row) => row.tecnico ?? '—',
              },
              {
                key: 'maquinas',
                header: 'Máquinas',
                render: (row) => row.maquinas ?? '—',
              },
              {
                key: 'motivo',
                header: 'Motivo',
                render: (row) => formatNotificationMotivo(row.motivo),
              },
              {
                key: 'canal',
                header: 'Canal',
                render: (row) => row.canal.toUpperCase(),
              },
              {
                key: 'estado',
                header: 'Estado',
                render: (row) => (
                  <Badge variant={row.estado === 'entregado' ? 'success' : 'default'}>
                    {formatNotificationEstado(row.estado)}
                  </Badge>
                ),
              },
            ]}
          />
        )}
      </CardContent>
    </Card>
  );
}
