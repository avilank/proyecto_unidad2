'use client';

import { RawJsonView } from '@/components/common/RawJsonView';
import { useAnalyticsSummary } from '@/presentation/hooks/useAnalytics';

export default function AnalyticsPage() {
  const summary = useAnalyticsSummary();

  return (
    <RawJsonView
      title="Analítica y Reportes"
      isLoading={summary.isLoading}
      error={summary.error}
      data={summary.data}
    />
  );
}
