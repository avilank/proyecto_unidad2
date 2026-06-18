'use client';

import useSWR from 'swr';
import { ragService } from '@/application/services/rag.service';

export function useRagPlan(orderId: string | null) {
  return useSWR(orderId ? `/rag/plans/${orderId}` : null, () =>
    orderId ? ragService.getByOrderId(orderId) : null,
  );
}
