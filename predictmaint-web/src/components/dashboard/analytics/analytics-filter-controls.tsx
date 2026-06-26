'use client';

import { Calendar } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

export const filterSelectClass =
  'h-9 w-full rounded-md border border-border bg-bg px-2 text-sm text-ink focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent';

export const filterFieldClass = 'flex min-w-[140px] flex-col gap-1';

const dateInputClass = cn(
  filterSelectClass,
  'relative pr-9',
  '[&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:inset-0',
  '[&::-webkit-calendar-picker-indicator]:h-full [&::-webkit-calendar-picker-indicator]:w-full',
  '[&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-0',
);

export function ReportFilterSelect({
  label,
  value,
  onChange,
  options,
  className,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  className?: string;
}) {
  return (
    <div className={cn(filterFieldClass, className)}>
      <span className="text-xs text-ink-muted">{label}</span>
      <select className={filterSelectClass} value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map((option) => (
          <option key={option.value || 'all'} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}

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
        className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted"
        aria-hidden
      />
    </div>
  );
}

/** @deprecated Usar ReportFilterSelect o filterFieldClass directamente */
export const analyticsSelectClass = filterSelectClass;

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
    <label className={cn(filterFieldClass, className)}>
      <span className="text-xs text-ink-muted">{label}</span>
      {children}
    </label>
  );
}
