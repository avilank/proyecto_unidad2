'use client';

import { useEffect, useState } from 'react';
import { Moon, Sun } from 'lucide-react';
import { useTheme } from '@teispace/next-themes';

export function ThemeToggle({ iconOnly = false }: { iconOnly?: boolean }) {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const isDark = theme === 'dark';
  const label = !mounted ? 'Tema' : isDark ? 'Modo claro' : 'Modo oscuro';
  const Icon = mounted && isDark ? Sun : Moon;

  if (iconOnly) {
    return (
      <button
        type="button"
        onClick={() => setTheme(isDark ? 'light' : 'dark')}
        className="flex h-9 w-9 items-center justify-center rounded-md border border-border bg-surface text-ink-soft transition-colors hover:bg-surface-2 hover:text-ink"
        aria-label={label}
        title={label}
      >
        <Icon className="h-4 w-4" />
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
      className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-ink-soft transition-colors hover:bg-surface-2 hover:text-ink"
      aria-label={label}
    >
      <Icon className="h-4 w-4 shrink-0" />
      <span className="leading-tight">{label}</span>
    </button>
  );
}
