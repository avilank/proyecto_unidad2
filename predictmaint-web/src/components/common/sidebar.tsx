'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import type { LucideIcon } from 'lucide-react';
import {
  BarChart3,
  ClipboardList,
  History,
  LayoutDashboard,
  LogOut,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  Radio,
  Settings,
  UserCircle,
  Users,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { Logo } from './logo';
import { ThemeToggle } from './theme-toggle';
import { authService } from '@/application/services/auth.service';
import { useSessionStore } from '@/presentation/stores/sessionStore';
import { useUiStore } from '@/presentation/stores/uiStore';
import { useMediaQuery } from '@/presentation/hooks/useMediaQuery';
import { RolUsuario } from '@/core/types';

export const SIDEBAR_WIDTH_EXPANDED = 220;
export const SIDEBAR_WIDTH_COLLAPSED = 64;

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

function NavItem({
  href,
  label,
  icon: Icon,
  active,
  collapsed,
  onNavigate,
}: {
  href: string;
  label: string;
  icon: LucideIcon;
  active: boolean;
  collapsed: boolean;
  onNavigate?: () => void;
}) {
  return (
    <Link
      href={href}
      title={collapsed ? label : undefined}
      onClick={onNavigate}
      className={cn(
        'relative flex items-center text-sm transition-colors',
        collapsed ? 'justify-center px-0 py-2.5' : 'gap-3 px-4 py-2.5',
        active
          ? 'bg-accent/10 font-semibold text-accent'
          : 'text-ink-soft hover:bg-surface-2 hover:text-ink',
      )}
    >
      {active && (
        <span className="absolute left-0 top-1/2 h-6 w-1 -translate-y-1/2 rounded-r bg-accent" />
      )}
      <Icon className="h-[18px] w-[18px] shrink-0" />
      {!collapsed && <span className="leading-tight">{label}</span>}
    </Link>
  );
}

function SidebarPanel({
  expanded,
  showToggle,
  onToggle,
  onNavigate,
  toggleIcon: ToggleIcon,
  toggleLabel,
}: {
  expanded: boolean;
  showToggle: boolean;
  onToggle?: () => void;
  onNavigate?: () => void;
  toggleIcon: LucideIcon;
  toggleLabel: string;
}) {
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

  const isActive = (href: string) =>
    pathname === href ||
    (href === '/dashboard/monitoring' && pathname.startsWith('/dashboard/analysis')) ||
    (href !== '/dashboard' &&
      href !== '/dashboard/my-work' &&
      pathname.startsWith(href.split('/').slice(0, 3).join('/'))) ||
    (href === '/dashboard/my-work' && pathname.startsWith('/dashboard/orders/'));

  return (
    <div className="flex h-full flex-col bg-bg-deep">
      <div
        className={cn(
          'relative flex shrink-0 border-b border-border-soft py-3.5',
          expanded ? 'items-center gap-1.5 px-2.5' : 'flex-col items-center gap-2 px-2',
        )}
      >
        <div className={cn('min-w-0', expanded && 'flex-1')}>
          <Logo compact={!expanded} sidebar={expanded} />
        </div>
        {showToggle && onToggle && (
          <button
            type="button"
            onClick={onToggle}
            title={toggleLabel}
            aria-label={toggleLabel}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-ink-muted transition-colors hover:bg-surface-2 hover:text-ink"
          >
            <ToggleIcon className="h-[18px] w-[18px]" />
          </button>
        )}
      </div>

      <nav className="friendly-scroll flex-1 overflow-y-auto py-1">
        {nav.map(({ href, label, icon }) => (
          <NavItem
            key={href}
            href={href}
            label={label}
            icon={icon}
            active={isActive(href)}
            collapsed={!expanded}
            onNavigate={onNavigate}
          />
        ))}
      </nav>

      <div className="border-t border-border-soft">
        <NavItem
          href="/dashboard/profile"
          label="Perfil"
          icon={UserCircle}
          active={pathname === '/dashboard/profile'}
          collapsed={!expanded}
          onNavigate={onNavigate}
        />
        {expanded ? (
          <ThemeToggle />
        ) : (
          <div className="flex justify-center py-1">
            <ThemeToggle iconOnly />
          </div>
        )}
      </div>

      <div className={cn('border-t border-border-soft py-3', expanded ? 'px-4' : 'px-2')}>
        {expanded ? (
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
        ) : (
          <div className="flex flex-col items-center gap-2">
            <div
              className="flex h-9 w-9 items-center justify-center rounded-full bg-accent/20 text-xs font-bold text-accent"
              title={user?.nombre ?? user?.email ?? 'Operador'}
            >
              {user?.email?.slice(0, 2).toUpperCase() ?? 'OP'}
            </div>
            <button
              type="button"
              onClick={handleLogout}
              disabled={loggingOut}
              title="Cerrar sesión"
              aria-label="Cerrar sesión"
              className="flex h-8 w-8 items-center justify-center rounded-md text-ink-muted transition-colors hover:bg-surface-2 hover:text-danger disabled:opacity-50"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/** Barra superior móvil con hamburguesa integrada (no flotante) */
export function MobileNavBar() {
  const toggleMobileNav = useUiStore((s) => s.toggleMobileNav);
  const mobileNavOpen = useUiStore((s) => s.mobileNavOpen);

  return (
    <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-border-soft bg-bg px-4 py-3 lg:hidden">
      <button
        type="button"
        onClick={toggleMobileNav}
        aria-label={mobileNavOpen ? 'Cerrar menú' : 'Abrir menú'}
        aria-expanded={mobileNavOpen}
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-ink-muted transition-colors hover:bg-surface-2 hover:text-ink"
      >
        {mobileNavOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </button>
      <Logo className="min-w-0 flex-1" />
    </header>
  );
}

export function Sidebar() {
  const pathname = usePathname();
  const isDesktop = useMediaQuery('(min-width: 1024px)');
  const sidebarExpanded = useUiStore((s) => s.sidebarExpanded);
  const toggleSidebarExpanded = useUiStore((s) => s.toggleSidebarExpanded);
  const mobileNavOpen = useUiStore((s) => s.mobileNavOpen);
  const closeMobileNav = useUiStore((s) => s.closeMobileNav);

  useEffect(() => {
    closeMobileNav();
  }, [pathname, closeMobileNav]);

  useEffect(() => {
    if (isDesktop) closeMobileNav();
  }, [isDesktop, closeMobileNav]);

  const desktopWidth = sidebarExpanded ? SIDEBAR_WIDTH_EXPANDED : SIDEBAR_WIDTH_COLLAPSED;

  return (
    <>
      {/* Desktop: rail completo o solo iconos */}
      <aside
        style={{ width: desktopWidth }}
        className={cn(
          'relative hidden h-screen shrink-0 overflow-hidden border-r border-border lg:block',
          'transition-[width] duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]',
        )}
      >
        <SidebarPanel
          expanded={sidebarExpanded}
          showToggle
          onToggle={toggleSidebarExpanded}
          toggleIcon={sidebarExpanded ? PanelLeftClose : PanelLeftOpen}
          toggleLabel={sidebarExpanded ? 'Contraer menú' : 'Expandir menú'}
        />
      </aside>

      {/* Mobile: overlay + drawer */}
      {mobileNavOpen && (
        <button
          type="button"
          aria-label="Cerrar menú"
          className="fixed inset-0 z-40 bg-ink/40 backdrop-blur-[1px] lg:hidden"
          onClick={closeMobileNav}
        />
      )}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 w-[min(280px,85vw)] border-r border-border shadow-pop lg:hidden',
          'transition-transform duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]',
          mobileNavOpen ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <SidebarPanel
          expanded
          showToggle
          onToggle={closeMobileNav}
          onNavigate={closeMobileNav}
          toggleIcon={X}
          toggleLabel="Cerrar menú"
        />
      </aside>
    </>
  );
}
