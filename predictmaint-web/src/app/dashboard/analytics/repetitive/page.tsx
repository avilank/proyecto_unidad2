'use client';

import { RawJsonView } from '@/components/common/RawJsonView';
import { useRepetitiveFaults } from '@/presentation/hooks/useAnalytics';

export default function RepetitiveAnalyticsPage() {
  const faults = useRepetitiveFaults();

  return (
    <RawJsonView
      title="Analítica — Fallos Repetitivos"
      isLoading={faults.isLoading}
      error={faults.error}
      data={faults.data}
    />
  );
}
