'use client';

import useSWR from 'swr';
import { alertService } from '@/application/services/alert.service';

const LIVE_REFRESH_MS = 5000;

export function useAlerts() {
  return useSWR('/alerts', () => alertService.findAll());
}

export function useActiveAlerts(options?: { poll?: boolean }) {
  return useSWR('/alerts/active', () => alertService.findActive(), {
    refreshInterval: options?.poll === false ? 0 : LIVE_REFRESH_MS,
  });
}

export function useRecentAlerts(limit = 10, options?: { poll?: boolean }) {
  return useSWR(['/alerts/recent', limit], () => alertService.findRecent(limit), {
    refreshInterval: options?.poll === false ? 0 : LIVE_REFRESH_MS,
  });
}
