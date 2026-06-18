import type { Alert } from '@/core/entities';
import type { PaginatedResponse } from '@/core/types/api';
import type { IAlertRepository } from '@/core/interfaces';
import { apiClient } from '@/infrastructure/http/clients/apiClient';

export class AlertRepository implements IAlertRepository {
  async findAll(): Promise<Alert[]> {
    const res = await apiClient.get<PaginatedResponse<Alert> | Alert[]>('/alerts', {
      params: { limit: 50 },
    });
    return Array.isArray(res) ? res : res.items;
  }

  findActive(): Promise<Alert[]> {
    return apiClient.get<Alert[]>('/alerts/active');
  }

  async findRecent(limit = 10): Promise<Alert[]> {
    const res = await apiClient.get<PaginatedResponse<Alert>>('/alerts', {
      params: { limit, page: 1 },
    });
    return res.items;
  }
}

export const alertRepository = new AlertRepository();
