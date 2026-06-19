'use client';

import useSWR from 'swr';
import { orderService } from '@/application/services/order.service';
import type { OrderQuery } from '@/infrastructure/repositories/order.repository';

export function useOrders(query?: OrderQuery) {
  return useSWR(['/orders', query], () => orderService.findAll(query));
}

export function useOrdersFlat(query?: OrderQuery) {
  return useSWR(['/orders-flat', query], () => orderService.findFlat(query));
}

export function useOrder(id: string | null) {
  return useSWR(id ? `/orders/${id}` : null, () =>
    id ? orderService.findById(id) : null,
  );
}

export function useOrderTimeline(id: string | null) {
  return useSWR(id ? `/orders/${id}/timeline` : null, () =>
    id ? orderService.getTimeline(id) : null,
  );
}

export function useTechnicianBoard() {
  return useSWR('/orders/my-board', () => orderService.getTechnicianBoard());
}

