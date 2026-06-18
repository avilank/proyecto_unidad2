import type { PaginatedResponse } from '@/core/types/api';

import type {

  CreateTechnicianPayload,

  Technician,

  UpdateTechnicianPayload,

} from '@/core/entities';

import type { ITechnicianRepository } from '@/core/interfaces';

import { apiClient } from '@/infrastructure/http/clients/apiClient';



export class TechnicianRepository implements ITechnicianRepository {

  async findAll(): Promise<Technician[]> {

    const res = await apiClient.get<PaginatedResponse<Technician> | Technician[]>('/technicians', {

      params: { limit: 100 },

    });

    return Array.isArray(res) ? res : res.items;

  }



  findById(id: number): Promise<Technician> {

    return apiClient.get<Technician>(`/technicians/${id}`);

  }



  create(payload: CreateTechnicianPayload): Promise<Technician> {

    return apiClient.post<Technician>('/technicians', payload);

  }



  update(id: number, payload: UpdateTechnicianPayload): Promise<Technician> {

    return apiClient.patch<Technician>(`/technicians/${id}`, payload);

  }



  remove(id: number): Promise<{ ok: boolean }> {

    return apiClient.delete<{ ok: boolean }>(`/technicians/${id}`);

  }

}



export const technicianRepository = new TechnicianRepository();

