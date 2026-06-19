import type { RagPlan } from '@/core/entities';
import type { IRagRepository } from '@/core/interfaces';
import { apiClient } from '@/infrastructure/http/clients/apiClient';

export class RagRepository implements IRagRepository {
  getByOrderId(orderId: string): Promise<RagPlan> {
    return apiClient.get<RagPlan>(`/rag/plan/${orderId}`);
  }

  regenerate(orderId: string, payload?: { escalado?: boolean; fuenteIds?: number[] }): Promise<RagPlan> {
    return apiClient.post<RagPlan>(`/rag/plan/${orderId}/regenerate`, payload ?? {});
  }
}

export const ragRepository = new RagRepository();

