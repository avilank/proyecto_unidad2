import type { RagPlan } from '@/core/entities';
import type { IRagRepository } from '@/core/interfaces';
import { apiClient } from '@/infrastructure/http/clients/apiClient';

export class RagRepository implements IRagRepository {
  getByOrderId(orderId: string): Promise<RagPlan> {
    return apiClient.get<RagPlan>(`/rag/plan/${orderId}`);
  }
}

export const ragRepository = new RagRepository();

