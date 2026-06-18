import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils/cn';

const pillVariants = cva(
  'inline-flex items-center rounded-md px-2.5 py-1 text-xs font-bold uppercase tracking-wide',
  {
    variants: {
      status: {
        normal: 'bg-success/15 text-success',
        alerta: 'bg-warning/15 text-warning',
        fallo: 'bg-danger/15 text-danger',
        pendiente: 'bg-warning/15 text-warning',
        en_progreso: 'bg-accent/15 text-accent',
        finalizado: 'bg-success/15 text-success',
        analizando: 'bg-purple-500/15 text-purple-400',
        clasificando: 'bg-purple-500/15 text-purple-400',
        operacion: 'bg-success/15 text-success',
        mantenimiento: 'bg-ink-muted/15 text-ink-muted',
      },
    },
    defaultVariants: { status: 'normal' },
  },
);

const LABELS: Record<string, string> = {
  normal: 'NORMAL',
  alerta: 'ALERTA',
  fallo: 'FALLO',
  pendiente: 'Pendiente',
  en_progreso: 'En Progreso',
  finalizado: 'Finalizado',
  analizando: 'Analizando',
  clasificando: 'Clasificando',
  operacion: 'NORMAL',
  mantenimiento: 'Mantenimiento',
};

export interface StatusPillProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof pillVariants> {
  label?: string;
}

export function StatusPill({ status, label, className, ...props }: StatusPillProps) {
  const key = status ?? 'normal';
  return (
    <span className={cn(pillVariants({ status: key as never }), className)} {...props}>
      {label ?? LABELS[key] ?? key}
    </span>
  );
}

export function machineStatusToPill(estado: string): StatusPillProps['status'] {
  switch (estado) {
    case 'operacion':
      return 'normal';
    case 'alerta':
      return 'alerta';
    case 'fallo':
      return 'fallo';
    case 'mantenimiento':
      return 'mantenimiento';
    default:
      return 'normal';
  }
}

export function alertEstadoToPill(estado: string): StatusPillProps['status'] {
  switch (estado) {
    case 'pendiente':
      return 'pendiente';
    case 'en_progreso':
      return 'en_progreso';
    case 'finalizado':
      return 'finalizado';
    case 'analizando':
      return 'analizando';
    case 'clasificando':
      return 'clasificando';
    default:
      return 'pendiente';
  }
}
