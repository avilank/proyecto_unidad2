import { cn } from '@/lib/utils/cn';

export function Logo({ className }: { className?: string }) {
  return (
    <div className={cn('flex items-center gap-3', className)}>
      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-accent">
        <span className="text-sm font-bold text-white">P</span>
      </div>
      <div>
        <p className="text-sm font-bold text-ink">PredictMaint</p>
        <p className="text-[10px] text-ink-muted">Mantenimiento Predictivo Industrial</p>
      </div>
    </div>
  );
}
