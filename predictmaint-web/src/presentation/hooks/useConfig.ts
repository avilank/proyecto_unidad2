'use client';

import useSWR from 'swr';
import { configService } from '@/application/services/config.service';

export function useConfig() {
  return useSWR('/config', () => configService.getConfig());
}
