'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';
import {
  BarChart3,
  ClipboardList,
  History,
  LayoutDashboard,
  LogOut,
  Radio,
  Settings,
  Users,
} from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { Logo } from './logo';
import { authService } from '@/application/services/auth.service';
import { useSessionStore } from '@/presentation/stores/sessionStore';
import { RolUsuario } from '@/core/types';

const SUPERVISOR_NAV = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/dashboard/monitoring', label: 'Monitoreo en Tiempo Real', icon: Radio },
  { href: '/dashboard/orders', label: 'Historial', icon: History },
  { href: '/dashboard/technicians', label: 'Gestión de Técnicos', icon: Users },
  { href: '/dashboard/analytics', label: 'Analítica y Reportes', icon: BarChart3 },
  { href: '/dashboard/settings', label: 'Configuración', icon: Settings },
];

const TECHNICIAN_NAV = [
  { href: '/dashboard/my-work', label: 'Mi trabajo', icon: ClipboardList },
];

function isTechnicianRole(rol?: RolUsuario) {
  return rol === RolUsuario.TECNICO || rol === RolUsuario.TECNICO_SENIOR;
}

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const user = useSessionStore((s) => s.user);
  const clearSession = useSessionStore((s) => s.clearSession);
  const [loggingOut, setLoggingOut] = useState(false);
  const nav = isTechnicianRole(user?.rol) ? TECHNICIAN_NAV : SUPERVISOR_NAV;

  const handleLogout = async () => {
    if (loggingOut) return;
    setLoggingOut(true);
    try {
      await authService.logout();
    } catch {
      // Limpia la sesión local aunque falle el endpoint.
    } finally {
      clearSession();
      router.replace('/login');
      setLoggingOut(false);
    }
  };

  return (
    <aside className="flex h-screen w-[220px] shrink-0 flex-col border-r border-border bg-bg-deep">
      <div className="border-b border-border-soft px-4 py-4">
        <Logo />
      </div>

      <nav className="friendly-scroll flex-1 overflow-y-auto">
        {nav.map(({ href, label, icon: Icon }) => {
          const active =
            pathname === href ||
            (href === '/dashboard/monitoring' && pathname.startsWith('/dashboard/analysis')) ||
            (href !== '/dashboard' &&
              href !== '/dashboard/my-work' &&
              pathname.startsWith(href.split('/').slice(0, 3).join('/'))) ||
            (href === '/dashboard/my-work' && pathname.startsWith('/dashboard/orders/'));
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'relative flex items-center gap-3 px-4 py-2.5 text-sm transition-colors',
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

      <div className="border-t border-border-soft px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent/20 text-xs font-bold text-accent">
            {user?.email?.slice(0, 2).toUpperCase() ?? 'OP'}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-ink">
              {user?.nombre ?? user?.email ?? 'Operador'}
            </p>
            <p className="truncate text-xs capitalize text-ink-muted">
              {user?.rol?.replace('_', ' ') ?? 'Supervisor'}
            </p>
          </div>
          <button
            type="button"
            onClick={handleLogout}
            disabled={loggingOut}
            title="Cerrar sesión"
            aria-label="Cerrar sesión"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-ink-muted transition-colors hover:bg-surface-2 hover:text-danger disabled:opacity-50"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
        {/* <button
          type="button"
          onClick={() => void handleLogout()}
          className="mt-3 flex w-full items-center gap-2 rounded-md px-2 py-2 text-sm text-ink-soft transition-colors hover:bg-surface-2 hover:text-ink"
        >
          <LogOut className="h-4 w-4 shrink-0" />
          Cerrar sesión
        </button> */}
      </div>
    </aside>
  );
}
