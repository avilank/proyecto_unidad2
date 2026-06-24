'use client';

import { cn } from '@/lib/utils/cn';

export type SettingsAccentTone = 'accent' | 'warning' | 'success';

const ACCENT_BAR: Record<SettingsAccentTone, string> = {
  accent: 'bg-accent',
  warning: 'bg-warning',
  success: 'bg-success',
};

export function SettingsAccentPanel({
  children,
  className,
  accent = 'success',
}: {
  children: React.ReactNode;
  className?: string;
  accent?: SettingsAccentTone;
}) {
  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-lg border border-border bg-surface/70',
        className,
      )}
    >
      <div className={cn('absolute inset-x-0 top-0 h-0.5', ACCENT_BAR[accent])} aria-hidden />
      <div className="pt-0.5">{children}</div>
    </div>
  );
}

export function SettingsToggle({
  checked,
  onChange,
  disabled,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <span className="inline-flex h-9 shrink-0 items-center justify-center">
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cn(
          'relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors',
          checked ? 'bg-accent' : 'bg-surface border border-border',
          disabled && 'cursor-not-allowed opacity-50',
        )}
      >
        <span
          className={cn(
            'pointer-events-none absolute top-1/2 h-5 w-5 -translate-y-1/2 rounded-full bg-white shadow transition-transform',
            checked ? 'translate-x-[1.35rem]' : 'translate-x-0.5',
          )}
        />
      </button>
    </span>
  );
}

export function ChannelPill({
  label,
  active,
  tone,
  onClick,
}: {
  label: string;
  active: boolean;
  tone: 'whatsapp' | 'email';
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'inline-flex h-9 items-center rounded-md px-3 text-xs font-semibold transition-colors',
        active
          ? tone === 'whatsapp'
            ? 'bg-success/20 text-success'
            : 'bg-accent/20 text-accent'
          : 'bg-surface-2 text-ink-muted hover:text-ink-soft',
      )}
    >
      {label}
    </button>
  );
}
