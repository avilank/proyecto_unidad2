'use client';

import useSWR from 'swr';
import { orderService } from '@/application/services/order.service';

export function useBinaryPredictions(orderId: string | null) {
  return useSWR(orderId ? `/predictions/binary/${orderId}` : null, () =>
    orderId ? orderService.getBinaryPredictions(orderId) : null,
  );
}

export function useMulticlassPredictions(orderId: string | null) {
  return useSWR(orderId ? `/predictions/multiclass/${orderId}` : null, () =>
    orderId ? orderService.getMulticlassPredictions(orderId) : null,
  );
}

