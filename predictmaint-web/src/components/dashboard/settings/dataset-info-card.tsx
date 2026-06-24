'use client';

import { DATASET_INFO } from '@/lib/types/settings';
import { SettingsAccentPanel } from '@/components/dashboard/settings/settings-controls';

function StatRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-6 py-2.5">
      <span className="text-xs text-ink-muted">{label}</span>
      <span className="shrink-0 text-sm font-semibold text-ink">{value}</span>
    </div>
  );
}

export function DatasetInfoCard() {
  return (
    <SettingsAccentPanel accent="success">
      <div className="flex flex-col gap-3 px-5 pb-5 pt-4 sm:flex-row sm:items-start sm:justify-between">
        <h3 className="text-base font-bold text-ink">{DATASET_INFO.titulo}</h3>
        <p className="text-xs text-ink-muted sm:text-right">{DATASET_INFO.subtitulo}</p>
      </div>

      <div className="mx-5 border-t border-border-soft" />

      <div className="grid gap-x-12 px-5 pb-5 pt-3 sm:grid-cols-2">
        <div>
          {DATASET_INFO.leftColumn.map(([label, value]) => (
            <StatRow key={label} label={label} value={value} />
          ))}
        </div>
        <div>
          {DATASET_INFO.rightColumn.map(([label, value]) => (
            <StatRow key={label} label={label} value={value} />
          ))}
        </div>
      </div>
    </SettingsAccentPanel>
  );
}
