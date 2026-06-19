'use client';

import { Topbar } from '@/components/common/topbar';
import { AvailabilityPanel } from '@/components/dashboard/analytics/availability-panel';
import { AnalyticsKpiRow } from '@/components/dashboard/analytics/analytics-kpi-row';
import { CsvLogTable } from '@/components/dashboard/analytics/csv-log-table';
import { FaultAnalyticsPanel } from '@/components/dashboard/analytics/fault-analytics-panel';
import { RagEffectivenessPanel } from '@/components/dashboard/analytics/rag-effectiveness-panel';
import { RecurrencePanel } from '@/components/dashboard/analytics/recurrence-panel';
import { UnattendedPanel } from '@/components/dashboard/analytics/unattended-panel';
import {
  useAnalyticsSummary,
  useAvailability,
  useFaultsByType,
  useMachineRecurrence,
  useNotificationLog,
  useUnattendedOrders,
} from '@/presentation/hooks/useAnalytics';

export function AnalyticsView() {
  const summary = useAnalyticsSummary('week');
  const unattended = useUnattendedOrders();
  const faults = useFaultsByType('week');
  const recurrence = useMachineRecurrence(7, 2);
  const availability = useAvailability();
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

        <CsvLogTable items={logs} isLoading={notificationLog.isLoading} />
      </div>
    </div>
  );
}
