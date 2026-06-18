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
  tone,
  className,
}: KpiCardProps) {
  return (
    <Card className={cn(kpiVariants({ tone }), className)}>
      <CardContent className="flex items-start gap-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-surface-2 text-ink-soft">
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <p className="text-2xl font-bold text-ink">{value}</p>
          <p className="text-sm font-medium text-ink">{label}</p>
          {sublabel && <p className="mt-1 text-xs text-ink-muted">{sublabel}</p>}
        </div>
      </CardContent>
    </Card>
  );
}
