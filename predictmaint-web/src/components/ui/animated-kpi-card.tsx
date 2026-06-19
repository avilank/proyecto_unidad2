'use client';

import { useEffect, useRef, useState } from 'react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { KpiCard, type KpiCardProps } from './kpi-card';

export interface AnimatedKpiCardProps extends KpiCardProps {
  index?: number;
  /** Incrementa en cada tick de datos (p. ej. SSE) para habilitar el flash tras el arranque */
  pulseKey?: number;
}

export function AnimatedKpiCard({
  index = 0,
  pulseKey,
  value,
  className,
  ...props
}: AnimatedKpiCardProps) {
  const prev = useRef<{ value: string | number | undefined; pulseKey: number }>({
    value: undefined,
    pulseKey: 0,
  });
  const [flash, setFlash] = useState(false);

  useEffect(() => {
    const hadValue = prev.current.value !== undefined;
    const valueChanged = hadValue && prev.current.value !== value;
    const streamReady = pulseKey == null || pulseKey > 0;

    if (valueChanged && streamReady) {
      setFlash(true);
      const t = setTimeout(() => setFlash(false), 650);
      prev.current = { value, pulseKey: pulseKey ?? 0 };
      return () => clearTimeout(t);
    }

    prev.current = { value, pulseKey: pulseKey ?? 0 };
  }, [value, pulseKey]);

  return (
    <div
      className="h-full min-w-0 animate-slide-in-left"
      style={{ animationDelay: `${index * 80}ms` }}
    >
      <KpiCard
        {...props}
        value={value}
        className={cn('h-full', className, flash && 'animate-value-flash ring-1 ring-accent/40')}
      />
    </div>
  );
}

export interface AnimatedFaultKpiCardProps {
  tipo: string;
  count: number;
  index: number;
  pulseKey?: number;
  icon: LucideIcon;
  tone: KpiCardProps['tone'];
}

export function AnimatedFaultKpiCard({
  tipo,
  count,
  index,
  pulseKey,
  icon,
  tone,
}: AnimatedFaultKpiCardProps) {
  return (
    <AnimatedKpiCard
      index={index + 1}
      pulseKey={pulseKey}
      tone={tone}
      icon={icon}
      value={count}
      label={tipo}
    />
  );
}
