import type { Machine } from '@/core/entities';
import { machineRepository } from '@/infrastructure/repositories/machine.repository';

export class MachineService {
  findAll(): Promise<Machine[]> {
    return machineRepository.findAll();
  }

  findById(id: string): Promise<Machine> {
    return machineRepository.findById(id);
  }
}

export const machineService = new MachineService();
