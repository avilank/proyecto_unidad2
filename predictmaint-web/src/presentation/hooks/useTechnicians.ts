'use client';



import useSWR from 'swr';

import { technicianService } from '@/application/services/technician.service';

import type {

  CreateTechnicianPayload,

  UpdateTechnicianPayload,

} from '@/core/entities';



export function useTechnicians() {

  return useSWR('/technicians', () => technicianService.findAll(), {

    refreshInterval: 10000,

  });

}



export function useTechnician(id: number | null) {

  return useSWR(id ? `/technicians/${id}` : null, () =>

    id ? technicianService.findById(id) : null,

  );

}



export function useTechnicianMutations() {

  const { mutate } = useTechnicians();



  const refresh = () => mutate();



  return {

    create: async (payload: CreateTechnicianPayload) => {

      const created = await technicianService.create(payload);

      await refresh();

      return created;

    },

    update: async (id: number, payload: UpdateTechnicianPayload) => {

      const updated = await technicianService.update(id, payload);

      await refresh();

      return updated;

    },

    remove: async (id: number) => {

      const result = await technicianService.remove(id);

      await refresh();

      return result;

    },

  };

}

