import type { Alert } from '@/core/entities';
import { alertRepository } from '@/infrastructure/repositories/alert.repository';

export class AlertService {
  findAll(): Promise<Alert[]> {
    return alertRepository.findAll();
  }

  findActive(): Promise<Alert[]> {
    return alertRepository.findActive();
  }

  findRecent(limit?: number): Promise<Alert[]> {
    return alertRepository.findRecent(limit);
  }
}

export const alertService = new AlertService();
