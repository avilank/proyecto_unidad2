'use client';

import { useMemo, useState } from 'react';
import { Topbar } from '@/components/common/topbar';
import { AvailabilityPanel } from '@/components/dashboard/analytics/availability-panel';
import { AnalyticsFiltersBar } from '@/components/dashboard/analytics/analytics-filters-bar';
import { AnalyticsKpiRow } from '@/components/dashboard/analytics/analytics-kpi-row';
import { CsvLogTable } from '@/components/dashboard/analytics/csv-log-table';
import { FaultAnalyticsPanel } from '@/components/dashboard/analytics/fault-analytics-panel';
import { PredictionValidationPanel } from '@/components/dashboard/analytics/prediction-validation-panel';
import { RagEffectivenessPanel } from '@/components/dashboard/analytics/rag-effectiveness-panel';
import { RecurrencePanel } from '@/components/dashboard/analytics/recurrence-panel';
import { ReliabilityPanel } from '@/components/dashboard/analytics/reliability-panel';
import { UnattendedPanel } from '@/components/dashboard/analytics/unattended-panel';
import {
  DEFAULT_LOG_FILTERS,
  DEFAULT_REPORT_FILTERS,
  DEFAULT_VALIDATION_FILTERS,
  mergePredictionFilters,
  type LogPanelFilters,
  type ReportFilters,
  type ValidationPanelFilters,
} from '@/lib/types/analytics-filters';
import {
  useAnalyticsSummary,
  useAvailability,
  useFaultsByType,
  useMachineRecurrence,
  useNotificationLog,
  useReliability,
  useUnattendedOrders,
} from '@/presentation/hooks/useAnalytics';

export function AnalyticsView() {
  const [reportFilters, setReportFilters] = useState<ReportFilters>(DEFAULT_REPORT_FILTERS);
  const [validationFilters, setValidationFilters] = useState<ValidationPanelFilters>(
    DEFAULT_VALIDATION_FILTERS,
  );
  const [logFilters, setLogFilters] = useState<LogPanelFilters>(DEFAULT_LOG_FILTERS);

  const predictionFilters = useMemo(
    () => mergePredictionFilters(reportFilters, validationFilters),
    [reportFilters, validationFilters],
  );

  const summary = useAnalyticsSummary(reportFilters);
  const unattended = useUnattendedOrders(reportFilters);
  const faults = useFaultsByType(reportFilters);
  const recurrence = useMachineRecurrence(7, 2, reportFilters);
  const availability = useAvailability();
  const reliability = useReliability(reportFilters);
  const notificationLog = useNotificationLog(50);

  const logs = notificationLog.data?.items;

  return (
    <div className="flex min-h-full flex-col">
      <Topbar
        flush
        title="Analítica y Reportes"
        subtitle="Seguimiento de alertas • Efectividad del sistema • Log de envíos CSV automáticos"
      />

      <div className="flex flex-1 flex-col gap-6 px-6 py-6">
        <AnalyticsFiltersBar filters={reportFilters} onChange={setReportFilters} />

        <AnalyticsKpiRow summary={summary.data} isLoading={summary.isLoading} />

        <div className="grid gap-4 lg:grid-cols-2">
          <UnattendedPanel
            orders={unattended.data}
            isLoading={unattended.isLoading}
            error={unattended.error}
          />
          <FaultAnalyticsPanel data={faults.data} isLoading={faults.isLoading} />
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <RagEffectivenessPanel summary={summary.data} isLoading={summary.isLoading} />
          <RecurrencePanel data={recurrence.data} isLoading={recurrence.isLoading} ventanaDias={7} minFallos={2} />
        </div>

        <AvailabilityPanel data={availability.data} isLoading={availability.isLoading} />

        <ReliabilityPanel data={reliability.data} isLoading={reliability.isLoading} />

        <PredictionValidationPanel
          filters={predictionFilters}
          panelFilters={validationFilters}
          onPanelFiltersChange={setValidationFilters}
        />

        <CsvLogTable
          items={logs}
          isLoading={notificationLog.isLoading}
          filters={logFilters}
          onFiltersChange={setLogFilters}
        />
      </div>
    </div>
  );
}
