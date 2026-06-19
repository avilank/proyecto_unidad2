'use client';

import useSWR from 'swr';
import { configService } from '@/application/services/config.service';

export function useConfig() {
  return useSWR('/config', () => configService.getConfig());
}

export function useRagSources() {
  return useSWR('/catalog/rag-sources', () => configService.getRagSources());
}
