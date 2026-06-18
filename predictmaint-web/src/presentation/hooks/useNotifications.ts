'use client';

import useSWR from 'swr';
import { apiClient } from '@/infrastructure/http/clients/apiClient';

export function useNextDispatch() {
  return useSWR('/notifications/next-dispatch', () =>
    apiClient.get<{ proximoEnvio: string; hora: string }>('/notifications/next-dispatch'),
  );
}
