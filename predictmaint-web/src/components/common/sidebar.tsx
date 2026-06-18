'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  BarChart3,
  History,
  LayoutDashboard,
  Radio,
  Settings,
  Users,
} from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { Logo } from './logo';
import { useSessionStore } from '@/presentation/stores/sessionStore';

const NAV = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/dashboard/monitoring', label: 'Monitoreo en Tiempo Real', icon: Radio },
  { href: '/dashboard/orders', label: 'Historial', icon: History },
  { href: '/dashboard/technicians', label: 'Gestión de Técnicos', icon: Users },
  { href: '/dashboard/analytics', label: 'Analítica y Reportes', icon: BarChart3 },
  { href: '/dashboard/settings', label: 'Configuración', icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();
  const user = useSessionStore((s) => s.user);

  return (
    <aside className="flex h-screen w-[220px] shrink-0 flex-col border-r border-border bg-bg-deep">
      <div className="border-b border-border-soft p-5">
        <Logo />
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto p-3">
        {NAV.map(({ href, label, icon: Icon }) => {
          const active =
            pathname === href ||
            (href === '/dashboard/monitoring' && pathname.startsWith('/dashboard/analysis')) ||
            (href !== '/dashboard' && pathname.startsWith(href.split('/').slice(0, 3).join('/')));
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'relative flex items-center gap-3 rounded-md px-3 py-2.5 text-sm transition-colors',
                active
                  ? 'bg-accent/10 font-semibold text-accent'
                  : 'text-ink-soft hover:bg-surface-2 hover:text-ink',
              )}
            >
              {active && (
                <span className="absolute left-0 top-1/2 h-6 w-1 -translate-y-1/2 rounded-r bg-accent" />
              )}
              <Icon className="h-4 w-4 shrink-0" />
              <span className="leading-tight">{label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-border-soft p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-accent/20 text-xs font-bold text-accent">
            {user?.email?.slice(0, 2).toUpperCase() ?? 'OP'}
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-ink">
              {user?.nombre ?? user?.email ?? 'Operador'}
            </p>
            <p className="truncate text-xs text-ink-muted capitalize">
              {user?.rol?.replace('_', ' ') ?? 'Supervisor'}
            </p>
          </div>
        </div>
      </div>
    </aside>
  );
}
