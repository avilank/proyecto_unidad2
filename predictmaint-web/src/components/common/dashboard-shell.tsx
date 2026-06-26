'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { MobileNavBar, Sidebar } from './sidebar';
import { useSessionHydrated } from '@/presentation/hooks/useAuth';
import { useSessionStore } from '@/presentation/stores/sessionStore';
import { RolUsuario } from '@/core/types';

function isTechnicianRole(rol?: RolUsuario) {
  return rol === RolUsuario.TECNICO || rol === RolUsuario.TECNICO_SENIOR;
}

function isTechnicianAllowedPath(pathname: string) {
  return (
    pathname === '/dashboard/my-work' ||
    pathname === '/dashboard/profile' ||
    pathname.startsWith('/dashboard/orders/')
  ); 
}

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const hydrated = useSessionHydrated();
  const token = useSessionStore((s) => s.token);
  const user = useSessionStore((s) => s.user);

  useEffect(() => {
    if (!hydrated) return;
    if (!token) {
      router.replace('/login');
      return;
    }
    if (isTechnicianRole(user?.rol) && !isTechnicianAllowedPath(pathname)) {
      router.replace('/dashboard/my-work');
    }
  }, [hydrated, token, router, user?.rol, pathname]);

  if (!hydrated || !token) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-bg">
        <p className="text-ink-soft">Cargando sesión…</p>
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-bg">
      <Sidebar />
      <div className="friendly-scroll flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto">
        <MobileNavBar />
        <main className="w-full flex-1">{children}</main>
      </div>
    </div>
  );
}
