'use client';

import { Filter, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  AnalyticsFilterField,
  AnalyticsDateInput,
  analyticsSelectClass,
} from '@/components/dashboard/analytics/analytics-filter-controls';
import {
  type ReportFilters,
  DEFAULT_REPORT_FILTERS,
  countActiveReportFilters,
} from '@/lib/types/analytics-filters';
import { useTechnicians } from '@/presentation/hooks/useTechnicians';

export function AnalyticsFiltersBar({
  filters,
  onChange,
}: {
  filters: ReportFilters;
  onChange: (next: ReportFilters) => void;
}) {
  const technicians = useTechnicians();
  const activeCount = countActiveReportFilters(filters);

  const patch = (partial: Partial<ReportFilters>) => onChange({ ...filters, ...partial });

  const reset = () => onChange({ ...DEFAULT_REPORT_FILTERS });

  return (
    <Card className="border-0 bg-surface-2/50 shadow-none">
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 pb-3">
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-accent" />
          <CardTitle className="text-base">Filtros de reporte</CardTitle>
          {activeCount > 0 && (
            <span className="rounded-full bg-accent/15 px-2 py-0.5 text-xs font-semibold text-accent">
              {activeCount} activo{activeCount !== 1 ? 's' : ''}
            </span>
          )}
        </div>
        <Button variant="secondary" size="sm" onClick={reset}>
          <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
          Limpiar
        </Button>
      </CardHeader>
      <CardContent className="grid gap-3 pt-0 sm:grid-cols-2 lg:grid-cols-4">
        <AnalyticsFilterField label="Desde">
          <AnalyticsDateInput
            value={filters.desde ?? ''}
            onChange={(v) => patch({ desde: v || undefined })}
          />
        </AnalyticsFilterField>

        <AnalyticsFilterField label="Hasta">
          <AnalyticsDateInput
            value={filters.hasta ?? ''}
            onChange={(v) => patch({ hasta: v || undefined })}
          />
        </AnalyticsFilterField>

        <AnalyticsFilterField label="Técnico">
          <select
            className={analyticsSelectClass}
            value={filters.tecnicoId ?? ''}
            onChange={(e) =>
              patch({
                tecnicoId: e.target.value ? Number(e.target.value) : undefined,
              })
            }
          >
            <option value="">Todos</option>
            {(technicians.data ?? []).map((t) => (
              <option key={t.id} value={t.id}>
                {t.nombre}
              </option>
            ))}
          </select>
        </AnalyticsFilterField>

        <AnalyticsFilterField label="Plan RAG">
          <select
            className={analyticsSelectClass}
            value={filters.respuestaRag ?? 'todos'}
            onChange={(e) =>
              patch({
                respuestaRag: e.target.value === 'todos' ? undefined : e.target.value,
              })
            }
          >
            <option value="todos">Todos</option>
            <option value="aceptado">Aceptado (captado)</option>
            <option value="rechazado">Rechazado</option>
            <option value="pendiente">Sin respuesta</option>
          </select>
        </AnalyticsFilterField>
      </CardContent>
    </Card>
  );
}
