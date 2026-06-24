'use client';

import { useMemo, useState } from 'react';
import { Eye, X } from 'lucide-react';
import type { PredictionValidationRow } from '@/core/types/api';
import {
  AnalyticsFilterField,
  analyticsSelectClass,
} from '@/components/dashboard/analytics/analytics-filter-controls';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DataTable } from '@/components/ui/data-table';
import { TableSkeleton } from '@/components/ui/skeleton';
import { FAULT_TYPE_ORDER, FAULT_LABELS } from '@/lib/constants/fault-types';
import type { AnalyticsFilters, ValidationPanelFilters } from '@/lib/types/analytics-filters';
import { useMachines } from '@/presentation/hooks/useMachines';
import { usePredictionValidation } from '@/presentation/hooks/useAnalytics';
import { cn } from '@/lib/utils/cn';

function formatFecha(iso: string): string {
  try {
    return new Date(iso).toLocaleString('es-PE');
  } catch {
    return iso;
  }
}

function Metric({
  label,
  value,
  tone,
}: {
  label: string;
  value: string | number;
  tone?: 'success' | 'danger' | 'accent';
}) {
  const toneClass =
    tone === 'success'
      ? 'text-success'
      : tone === 'danger'
        ? 'text-danger'
        : tone === 'accent'
          ? 'text-accent'
          : 'text-ink';
  return (
    <div className="rounded-md border border-border-soft bg-surface-2 p-3">
      <p className="text-xs text-ink-muted">{label}</p>
      <p className={cn('mt-1 text-2xl font-bold', toneClass)}>{value}</p>
    </div>
  );
}

export function PredictionValidationPanel({
  filters,
  panelFilters,
  onPanelFiltersChange,
}: {
  filters: AnalyticsFilters;
  panelFilters: ValidationPanelFilters;
  onPanelFiltersChange: (next: ValidationPanelFilters) => void;
}) {
  const machines = useMachines({ poll: false });
  const { data, isLoading } = usePredictionValidation(filters);
  const [detalle, setDetalle] = useState<PredictionValidationRow | null>(null);

  const patch = (partial: Partial<ValidationPanelFilters>) =>
    onPanelFiltersChange({ ...panelFilters, ...partial });

  const stats = useMemo(() => {
    const rows = data ?? [];
    const total = rows.length;
    const aceptadas = rows.filter((r) => r.decision === 'aceptada').length;
    const rechazadas = total - aceptadas;
    const pctAcertadas = total ? Math.round((aceptadas / total) * 100) : 0;
    return { total, aceptadas, rechazadas, pctAcertadas };
  }, [data]);

  return (
    <Card>
      <CardHeader className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
        <CardTitle className="shrink-0">
          Validación de predicciones — Modelo vs. Técnico
        </CardTitle>
        <div className="flex flex-wrap items-end gap-3">
          <AnalyticsFilterField label="Tipo de fallo" className="min-w-[10rem]">
            <select
              className={analyticsSelectClass}
              value={panelFilters.tipoFallo ?? 'todos'}
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

          <AnalyticsFilterField label="Decisión" className="min-w-[9rem]">
            <select
              className={analyticsSelectClass}
              value={panelFilters.decision ?? 'todos'}
              onChange={(e) =>
                patch({
                  decision: e.target.value === 'todos' ? undefined : e.target.value,
                })
              }
            >
              <option value="todos">Todos</option>
              <option value="aceptada">Aceptados</option>
              <option value="rechazada">Rechazados</option>
            </select>
          </AnalyticsFilterField>

          <AnalyticsFilterField label="Máquina" className="min-w-[9rem]">
            <select
              className={analyticsSelectClass}
              value={panelFilters.maquinaId ?? ''}
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
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Metric label="Predicciones validadas" value={stats.total} />
          <Metric label="Aceptadas" value={stats.aceptadas} tone="success" />
          <Metric label="Rechazadas" value={stats.rechazadas} tone="danger" />
          <Metric label="% acertadas" value={`${stats.pctAcertadas}%`} tone="accent" />
        </div>

        {isLoading ? (
          <TableSkeleton rows={6} />
        ) : (
          <DataTable
            rows={data ?? []}
            emptyMessage="No hay predicciones validadas con los filtros actuales"
            columns={[
              {
                key: 'orden',
                header: 'Orden',
                render: (row) => <span className="font-medium text-ink">{row.orden}</span>,
              },
              {
                key: 'maquina',
                header: 'Máquina',
                render: (row) => row.maquinaId,
              },
              {
                key: 'tecnico',
                header: 'Técnico',
                render: (row) => row.tecnico,
              },
              {
                key: 'prediccion',
                header: 'Predicción',
                render: (row) => (
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Badge variant={row.prediccion === 'FALLA' ? 'danger' : 'success'}>
                      {row.prediccion === 'FALLA' ? 'Falla' : 'Sin falla'}
                    </Badge>
                    {row.tipoFallo && <Badge variant="warning">{row.tipoFallo}</Badge>}
                  </div>
                ),
              },
              {
                key: 'decision',
                header: '¿Aceptó / Rechazó?',
                render: (row) => (
                  <Badge variant={row.decision === 'rechazada' ? 'danger' : 'success'}>
                    {row.decision === 'rechazada' ? 'Rechazó' : 'Aceptó'}
                  </Badge>
                ),
              },
              {
                key: 'justificacion',
                header: 'Justificación',
                render: (row) =>
                  row.decision === 'rechazada' ? (
                    <button
                      type="button"
                      onClick={() => setDetalle(row)}
                      title="Ver justificación del rechazo"
                      className="inline-flex items-center gap-1 rounded-md border border-border bg-surface-2 px-2 py-1 text-xs font-semibold text-ink-soft transition-colors hover:text-ink"
                    >
                      <Eye className="h-4 w-4" />
                      Ver
                    </button>
                  ) : (
                    <span className="text-ink-muted">—</span>
                  ),
              },
            ]}
          />
        )}
      </CardContent>

      {detalle && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setDetalle(null)}
        >
          <Card
            className="w-full max-w-md"
            onClick={(e: React.MouseEvent) => e.stopPropagation()}
          >
            <CardHeader className="flex flex-row items-start justify-between gap-2">
              <div>
                <CardTitle>Justificación del rechazo</CardTitle>
                <p className="mt-1 text-sm text-ink-muted">
                  Orden {detalle.orden} · {detalle.tecnico}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setDetalle(null)}
                className="rounded-md p-1 text-ink-muted transition-colors hover:text-ink"
                aria-label="Cerrar"
              >
                <X className="h-5 w-5" />
              </button>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex flex-wrap gap-2">
                <Badge variant={detalle.prediccion === 'FALLA' ? 'danger' : 'success'}>
                  Predicción: {detalle.prediccion === 'FALLA' ? 'Falla' : 'Sin falla'}
                </Badge>
                {detalle.tipoFallo && <Badge variant="warning">{detalle.tipoFallo}</Badge>}
              </div>
              <div className="rounded-md border border-border-soft bg-surface-2 p-3 text-sm text-ink-soft">
                {detalle.justificacion ?? 'Sin justificación registrada'}
              </div>
              <p className="text-xs text-ink-muted">{formatFecha(detalle.fecha)}</p>
            </CardContent>
          </Card>
        </div>
      )}
    </Card>
  );
}
