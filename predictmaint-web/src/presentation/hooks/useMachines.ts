'use client';

import useSWR from 'swr';
import { machineService } from '@/application/services/machine.service';

const LIVE_REFRESH_MS = 5000;

export function useMachines(options?: { poll?: boolean }) {
  return useSWR('/machines', () => machineService.findAll(), {
    refreshInterval: options?.poll === false ? 0 : LIVE_REFRESH_MS,
  });
}

export function useMachine(id: string | null) {
  return useSWR(id ? `/machines/${id}` : null, () =>
    id ? machineService.findById(id) : null,
  );
}
