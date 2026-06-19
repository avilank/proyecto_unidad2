import { cva, type VariantProps } from 'class-variance-authority';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { Card, CardContent } from './card';

const kpiVariants = cva('border-t-4', {
  variants: {
    tone: {
      accent: 'border-t-accent',
      danger: 'border-t-danger',
      success: 'border-t-success',
      warning: 'border-t-warning',
    },
  },
  defaultVariants: { tone: 'accent' },
});

const toneStyles = {
  accent: {
    icon: 'bg-accent-soft text-accent',
    value: 'text-accent',
  },
  danger: {
    icon: 'bg-danger-soft text-danger',
    value: 'text-danger',
  },
  success: {
    icon: 'bg-success-soft text-success',
    value: 'text-success',
  },
  warning: {
    icon: 'bg-warning-soft text-warning',
    value: 'text-warning',
  },
} as const;

export interface KpiCardProps extends VariantProps<typeof kpiVariants> {
  icon: LucideIcon;
  value: string | number;
  label: string;
  sublabel?: string;
  className?: string;
}

export function KpiCard({
  icon: Icon,
  value,
  label,
  sublabel,
  tone = 'accent',
  className,
}: KpiCardProps) {
  const colors = toneStyles[tone ?? 'accent'];

  return (
    <Card className={cn(kpiVariants({ tone }), 'h-full', className)}>
      <CardContent className="py-4">
        <div className="flex items-center gap-3">
          <div
            className={cn(
              'flex h-11 w-11 shrink-0 items-center justify-center rounded-md',
              colors.icon,
            )}
          >
            <Icon className="h-5 w-5" strokeWidth={2.25} />
          </div>
          <p className={cn('text-2xl font-bold leading-none', colors.value)}>{value}</p>
        </div>
        <p className="mt-2.5 text-sm font-medium leading-tight text-ink">{label}</p>
        {sublabel ? (
          <p className="mt-1 text-xs text-ink-muted">{sublabel}</p>
        ) : (
          <span className="mt-1 block h-4" aria-hidden />
        )}
      </CardContent>
    </Card>
  );
}
