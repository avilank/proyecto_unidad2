'use client';

import { Calendar } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

export const analyticsSelectClass =
  'h-9 w-full min-w-[9rem] rounded-md border border-border bg-bg px-2.5 text-sm text-ink focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent';

const dateInputClass = cn(
  analyticsSelectClass,
  'relative pr-9 [color-scheme:dark]',
  '[&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:inset-0',
  '[&::-webkit-calendar-picker-indicator]:h-full [&::-webkit-calendar-picker-indicator]:w-full',
  '[&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-0',
);

export function AnalyticsDateInput({
  value,
  onChange,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  className?: string;
}) {
  return (
    <div className={cn('relative', className)}>
      <input
        type="date"
        className={dateInputClass}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      <Calendar
        className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-white"
        aria-hidden
      />
    </div>
  );
}

export function AnalyticsFilterField({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={cn('flex flex-col gap-1', className)}>
      <span className="text-[11px] font-semibold uppercase tracking-wide text-ink-muted">
        {label}
      </span>
      {children}
    </label>
  );
}
