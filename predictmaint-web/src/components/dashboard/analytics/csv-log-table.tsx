'use client';

import { useMemo } from 'react';
import type { NotificationLogEntry } from '@/core/types/api';
import {
  AnalyticsFilterField,
  analyticsSelectClass,
} from '@/components/dashboard/analytics/analytics-filter-controls';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DataTable } from '@/components/ui/data-table';
import { TableSkeleton } from '@/components/ui/skeleton';
import { FAULT_TYPE_ORDER, FAULT_LABELS } from '@/lib/constants/fault-types';
import type { LogPanelFilters } from '@/lib/types/analytics-filters';
import { formatNotificationEstado, formatNotificationMotivo, formatNotificationTime } from '@/lib/utils/analytics';
import { useMachines } from '@/presentation/hooks/useMachines';

const CANAL_OPTIONS = [
  { value: 'email', label: 'Email' },
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'whatsapp_email', label: 'WhatsApp + Email' },
] as const;

const ESTADO_OPTIONS = [
  { value: 'entregado', label: 'Entregado' },
  { value: 'fallido', label: 'Fallido' },
  { value: 'pendiente', label: 'Pendiente' },
] as const;

function matchesTipoFallo(motivo: string | null | undefined, tipoFallo: string): boolean {
  if (!motivo?.trim()) return false;
  const codigo = formatNotificationMotivo(motivo);
  return codigo.toUpperCase() === tipoFallo.toUpperCase();
}

function matchesMaquina(maquinas: string | null | undefined, maquinaId: string): boolean {
  if (!maquinas?.trim()) return false;
  return maquinas.split(/[,;]/).some((m) => m.trim() === maquinaId);
}

export function CsvLogTable({
  items,
  isLoading,
  filters,
  onFiltersChange,
}: {
  items?: NotificationLogEntry[];
  isLoading?: boolean;
  filters: LogPanelFilters;
  onFiltersChange: (next: LogPanelFilters) => void;
}) {
  const machines = useMachines({ poll: false });
  const patch = (partial: Partial<LogPanelFilters>) =>
    onFiltersChange({ ...filters, ...partial });

  const filteredItems = useMemo(() => {
    let rows = items ?? [];
    if (filters.tipoFallo && filters.tipoFallo !== 'todos') {
      rows = rows.filter((r) => matchesTipoFallo(r.motivo, filters.tipoFallo!));
    }
    if (filters.maquinaId) {
      rows = rows.filter((r) => matchesMaquina(r.maquinas, filters.maquinaId!));
    }
    if (filters.estado && filters.estado !== 'todos') {
      rows = rows.filter((r) => r.estado === filters.estado);
    }
    if (filters.canal && filters.canal !== 'todos') {
      rows = rows.filter((r) => r.canal === filters.canal);
    }
    return rows;
  }, [items, filters]);

  return (
    <Card>
      <CardHeader className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
        <CardTitle className="shrink-0">Log de mensajes automáticos</CardTitle>
        <div className="flex flex-wrap items-end gap-3">
          <AnalyticsFilterField label="Tipo de fallo" className="min-w-[10rem]">
            <select
              className={analyticsSelectClass}
              value={filters.tipoFallo ?? 'todos'}
              onChange={(e) =>
                patch({
                  tipoFallo: e.target.value === 'todos' ? undefined : e.target.value,
                })
              }
            >
              <option value="todos">Todos</option>
              {FAULT_TYPE_ORDER.map((tipo) => (
                <option key={tipo} value={tipo}>
                  {tipo} — {FAULT_LABELS[tipo]}
                </option>
              ))}
            </select>
          </AnalyticsFilterField>

          <AnalyticsFilterField label="Máquina" className="min-w-[9rem]">
            <select
              className={analyticsSelectClass}
              value={filters.maquinaId ?? ''}
              onChange={(e) =>
                patch({
                  maquinaId: e.target.value || undefined,
                })
              }
            >
              <option value="">Todas</option>
              {(machines.data ?? []).map((m) => (
                <option key={m.id} value={m.id}>
                  {m.id}
                  {m.nombre ? ` — ${m.nombre}` : ''}
                </option>
              ))}
            </select>
          </AnalyticsFilterField>

          <AnalyticsFilterField label="Estado" className="min-w-[9rem]">
            <select
              className={analyticsSelectClass}
              value={filters.estado ?? 'todos'}
              onChange={(e) =>
                patch({
                  estado: e.target.value === 'todos' ? undefined : e.target.value,
                })
              }
            >
              <option value="todos">Todos</option>
              {ESTADO_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </AnalyticsFilterField>

          <AnalyticsFilterField label="Canal" className="min-w-[9rem]">
            <select
              className={analyticsSelectClass}
              value={filters.canal ?? 'todos'}
              onChange={(e) =>
                patch({
                  canal: e.target.value === 'todos' ? undefined : e.target.value,
                })
              }
            >
              <option value="todos">Todos</option>
              {CANAL_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </AnalyticsFilterField>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <TableSkeleton rows={6} />
        ) : (
          <DataTable
            rows={filteredItems}
            emptyMessage="No hay mensajes registrados con los filtros actuales"
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
