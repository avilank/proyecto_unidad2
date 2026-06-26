import { cn } from '@/lib/utils/cn';

export function Logo({
  className,
  compact = false,
  sidebar = false,
}: {
  className?: string;
  compact?: boolean;
  sidebar?: boolean;
}) {
  const mark = (
    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent">
      <span className="text-sm font-bold text-white">P</span>
    </div>
  );

  if (compact) {
    return <div className={cn('flex items-center justify-center', className)}>{mark}</div>;
  }

  return (
    <div className={cn('flex items-center gap-3', className)}>
      {mark}
      <div className="min-w-0">
        <p className="truncate text-sm font-bold text-ink">PredictMaint</p>
        {!sidebar && (
          <p className="truncate text-[10px] text-ink-muted">Mantenimiento Predictivo Industrial</p>
        )}
      </div>
    </div>
  );
}
