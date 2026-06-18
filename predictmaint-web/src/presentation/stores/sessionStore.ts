import type { User } from '@/core/entities';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { setApiTokenGetter } from '@/infrastructure/http/clients/apiClient';

interface SessionState {
  token: string | null;
  user: User | null;
  setSession: (token: string, user: User) => void;
  clearSession: () => void;
}

export const useSessionStore = create<SessionState>()(
  persist(
    (set) => ({
      token: null,
      user: null,
      setSession: (token, user) => set({ token, user }),
      clearSession: () => set({ token: null, user: null }),
    }),
    { name: 'predictmaint-session' },
  ),
);

setApiTokenGetter(() => useSessionStore.getState().token);
