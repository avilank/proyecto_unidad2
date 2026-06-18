import type { MachineAnalysis } from '@/core/entities';
import { predictionRepository } from '@/infrastructure/repositories/prediction.repository';

export class PredictionService {
  getByMachineId(machineId: string): Promise<MachineAnalysis> {
    return predictionRepository.getByMachineId(machineId);
  }
}

export const predictionService = new PredictionService();
