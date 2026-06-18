import { cn } from '@/lib/utils/cn';
import { Badge } from '@/components/ui/badge';

export interface TopbarProps {
  title: string;
  subtitle?: string;
  badge?: { label: string; variant?: 'danger' | 'warning' | 'accent' };
  right?: React.ReactNode;
  className?: string;
}

export function Topbar({ title, subtitle, badge, right, className }: TopbarProps) {
  return (
    <header
      className={cn(
        'flex flex-wrap items-start justify-between gap-4 border-b border-border-soft pb-6',
        className,
      )}
    >
      <div>
        <h1 className="text-2xl font-bold text-ink">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-ink-muted">{subtitle}</p>}
      </div>
      <div className="flex items-center gap-3">
        {right}
        {badge && <Badge variant={badge.variant ?? 'danger'}>{badge.label}</Badge>}
      </div>
    </header>
  );
}
