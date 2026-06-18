import type { MachineAnalysis } from '@/core/entities';
import type { IPredictionRepository } from '@/core/interfaces';
import { apiClient } from '@/infrastructure/http/clients/apiClient';

export class PredictionRepository implements IPredictionRepository {
  getByMachineId(machineId: string): Promise<MachineAnalysis> {
    return apiClient.get<MachineAnalysis>(`/predictions/machines/${machineId}`);
  }
}

export const predictionRepository = new PredictionRepository();
