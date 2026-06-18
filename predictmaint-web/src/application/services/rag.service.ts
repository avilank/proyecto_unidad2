import type { RagPlan } from '@/core/entities';
import { ragRepository } from '@/infrastructure/repositories/rag.repository';

export class RagService {
  getByOrderId(orderId: string): Promise<RagPlan> {
    return ragRepository.getByOrderId(orderId);
  }
}

export const ragService = new RagService();
