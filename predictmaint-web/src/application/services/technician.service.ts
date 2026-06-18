import type {

  CreateTechnicianPayload,

  Technician,

  UpdateTechnicianPayload,

} from '@/core/entities';

import { technicianRepository } from '@/infrastructure/repositories/technician.repository';



export class TechnicianService {

  findAll(): Promise<Technician[]> {

    return technicianRepository.findAll();

  }



  findById(id: number): Promise<Technician> {

    return technicianRepository.findById(id);

  }



  create(payload: CreateTechnicianPayload): Promise<Technician> {

    return technicianRepository.create(payload);

  }



  update(id: number, payload: UpdateTechnicianPayload): Promise<Technician> {

    return technicianRepository.update(id, payload);

  }



  remove(id: number): Promise<{ ok: boolean }> {

    return technicianRepository.remove(id);

  }

}



export const technicianService = new TechnicianService();

