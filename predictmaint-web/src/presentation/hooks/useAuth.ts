'use client';

import { useEffect, useState } from 'react';
import useSWR from 'swr';
import { authService } from '@/application/services/auth.service';
import { useSessionStore } from '@/presentation/stores/sessionStore';

export function useSessionHydrated() {
  const [hydrated, setHydrated] = useState(
    () => useSessionStore.persist.hasHydrated(),
  );

  useEffect(() => {
    if (useSessionStore.persist.hasHydrated()) {
      setHydrated(true);
      return;
    }

    return useSessionStore.persist.onFinishHydration(() => setHydrated(true));
  }, []);

  return hydrated;
}

export function useAuth() {
  const token = useSessionStore((s) => s.token);
  const user = useSessionStore((s) => s.user);
  const setSession = useSessionStore((s) => s.setSession);
  const clearSession = useSessionStore((s) => s.clearSession);

  const { data: profile, error, isLoading, mutate } = useSWR(
    token ? '/auth/profile' : null,
    () => authService.getProfile(),
  );

  return {
    token,
    user: profile ?? user,
    isAuthenticated: Boolean(token),
    isLoading,
    error,
    setSession,
    clearSession,
    refreshProfile: mutate,
  };
}
