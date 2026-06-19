'use client';

import { Bell, CheckCircle2, UserX } from 'lucide-react';
import type { AnalyticsSummary } from '@/core/entities';
import { AnimatedKpiCard } from '@/components/ui/animated-kpi-card';
import { Skeleton } from '@/components/ui/skeleton';

const KPI_CONFIG = [
  {
    key: 'alertas',
    label: 'Fallas confirmadas',
    icon: Bell,
    tone: 'accent' as const,
    getValue: (s?: AnalyticsSummary) => s?.totalAlertas ?? 0,
  },
  {
    key: 'rag',
    label: 'Resueltas con RAG',
    icon: CheckCircle2,
    tone: 'success' as const,
    getValue: (s?: AnalyticsSummary) => s?.conRag ?? 0,
  },
  {
    key: 'sinAtender',
    label: 'Sin atender',
    icon: UserX,
    tone: 'danger' as const,
    getValue: (s?: AnalyticsSummary) => s?.sinAtender ?? 0,
  },
] as const;

export function AnalyticsKpiRow({
  summary,
  isLoading,
}: {
  summary?: AnalyticsSummary;
  isLoading?: boolean;
}) {
  if (isLoading) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-[108px] w-full rounded-lg" />
        ))}
      </div>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {KPI_CONFIG.map((item, index) => (
        <AnimatedKpiCard
          key={item.key}
          index={index}
          icon={item.icon}
          label={item.label}
          value={item.getValue(summary)}
          tone={item.tone}
        />
      ))}
    </div>
  );
}
