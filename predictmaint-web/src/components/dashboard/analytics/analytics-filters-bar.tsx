'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  AnalyticsDateInput,
  AnalyticsFilterField,
  ReportFilterSelect,
} from '@/components/dashboard/analytics/analytics-filter-controls';
import {
  type ReportFilters,
  DEFAULT_REPORT_FILTERS,
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

  const patch = (partial: Partial<ReportFilters>) => onChange({ ...filters, ...partial });

  const reset = () => onChange({ ...DEFAULT_REPORT_FILTERS });

  return (
    <Card>
      <CardContent className="flex flex-wrap items-end gap-3 py-3">
        <AnalyticsFilterField label="Desde" className="min-w-[150px]">
          <AnalyticsDateInput
            value={filters.desde ?? ''}
            onChange={(v) => patch({ desde: v || undefined })}
          />
        </AnalyticsFilterField>

        <AnalyticsFilterField label="Hasta" className="min-w-[150px]">
          <AnalyticsDateInput
            value={filters.hasta ?? ''}
            onChange={(v) => patch({ hasta: v || undefined })}
          />
        </AnalyticsFilterField>

        <ReportFilterSelect
          label="Técnico"
          value={filters.tecnicoId != null ? String(filters.tecnicoId) : ''}
          onChange={(value) =>
            patch({
              tecnicoId: value ? Number(value) : undefined,
            })
          }
          options={[
            { value: '', label: 'Todos los técnicos' },
            ...(technicians.data ?? []).map((t) => ({
              value: String(t.id),
              label: t.nombre,
            })),
          ]}
        />

        <ReportFilterSelect
          label="Plan RAG"
          value={filters.respuestaRag ?? ''}
          onChange={(value) =>
            patch({
              respuestaRag: value || undefined,
            })
          }
          options={[
            { value: '', label: 'Todos' },
            { value: 'aceptado', label: 'Aceptado (captado)' },
            { value: 'rechazado', label: 'Rechazado' },
            { value: 'pendiente', label: 'Sin respuesta' },
          ]}
        />

        <div className="flex gap-2 pb-1">
          <Button variant="secondary" size="sm" onClick={reset}>
            Limpiar
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
