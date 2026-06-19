'use client';

import { Bell, CheckCircle2, FileSpreadsheet, UserX } from 'lucide-react';
import type { AnalyticsSummary } from '@/core/entities';
import type { NotificationLogEntry } from '@/core/types/api';
import { AnimatedKpiCard } from '@/components/ui/animated-kpi-card';
import { Skeleton } from '@/components/ui/skeleton';
import { countCsvsToday } from '@/lib/utils/analytics';

const KPI_CONFIG = [
  {
    key: 'alertas',
    label: 'Alertas esta semana',
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
  {
    key: 'csv',
    label: 'CSVs enviados hoy',
    icon: FileSpreadsheet,
    tone: 'warning' as const,
    getValue: (_s?: AnalyticsSummary, logs?: NotificationLogEntry[]) => countCsvsToday(logs),
  },
] as const;

export function AnalyticsKpiRow({
  summary,
  logs,
  isLoading,
}: {
  summary?: AnalyticsSummary;
  logs?: NotificationLogEntry[];
  isLoading?: boolean;
}) {
  if (isLoading) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-[108px] w-full rounded-lg" />
        ))}
      </div>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {KPI_CONFIG.map((item, index) => (
        <AnimatedKpiCard
          key={item.key}
          index={index}
          icon={item.icon}
          label={item.label}
          value={item.getValue(summary, logs)}
          tone={item.tone}
        />
      ))}
    </div>
  );
}
