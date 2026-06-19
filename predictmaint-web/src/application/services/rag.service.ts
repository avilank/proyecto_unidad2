import type { RagPlan } from '@/core/entities';
import { ragRepository } from '@/infrastructure/repositories/rag.repository';

export class RagService {
  getByOrderId(orderId: string): Promise<RagPlan> {
    return ragRepository.getByOrderId(orderId);
  }

  regenerate(orderId: string, payload?: { escalado?: boolean; fuenteIds?: number[] }): Promise<RagPlan> {
    return ragRepository.regenerate(orderId, payload);
  }

  accept(orderId: string): Promise<RagPlan> {
    return ragRepository.accept(orderId);
  }

  reject(orderId: string, motivo?: string): Promise<RagPlan> {
    return ragRepository.reject(orderId, motivo);
  }
}

export const ragService = new RagService();
