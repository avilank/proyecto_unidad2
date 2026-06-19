'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Sidebar } from './sidebar';
import { useSessionStore } from '@/presentation/stores/sessionStore';

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const token = useSessionStore((s) => s.token);

  useEffect(() => {
    if (!token) {
      router.replace('/login');
    }
  }, [token, router]);

  if (!token) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-bg">
        <p className="text-ink-soft">Cargando sesión…</p>
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-bg">
      <Sidebar />
      <div className="friendly-scroll min-h-0 min-w-0 flex-1 overflow-y-auto">
        <main className="w-full">{children}</main>
      </div>
    </div>
  );
}
