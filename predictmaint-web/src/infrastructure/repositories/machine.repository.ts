import type { Machine } from '@/core/entities';
import type { PaginatedResponse } from '@/core/types/api';
import type { IMachineRepository } from '@/core/interfaces';
import { apiClient } from '@/infrastructure/http/clients/apiClient';

export class MachineRepository implements IMachineRepository {
  async findAll(): Promise<Machine[]> {
    const res = await apiClient.get<PaginatedResponse<Machine> | Machine[]>('/machines', {
      params: { limit: 100 },
    });
    return Array.isArray(res) ? res : res.items;
  }

  findById(id: string): Promise<Machine> {
    return apiClient.get<Machine>(`/machines/${id}`);
  }
}

export const machineRepository = new MachineRepository();
