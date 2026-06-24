import type { MlModelConfig } from '@/core/entities';
import type { EtapaModelo } from '@/core/types';
import type { DispatchScheduleItem, SystemConfigResponse } from '@/lib/types/settings';
import { configRepository } from '@/infrastructure/repositories/config.repository';
import { mlModelsRepository } from '@/infrastructure/repositories/ml-models.repository';

export class ConfigService {
  getConfig(): Promise<SystemConfigResponse> {
    return configRepository.getConfig();
  }

  getRagSources(): Promise<import('@/core/entities').RagSource[]> {
    return configRepository.getRagSources();
  }

  saveConfig(body: Record<string, unknown>): Promise<SystemConfigResponse> {
    return configRepository.patchConfig(body);
  }

  getDispatchSchedule(): Promise<DispatchScheduleItem[]> {
    return configRepository.getDispatchSchedule();
  }

  saveDispatchSchedule(items: DispatchScheduleItem[]): Promise<DispatchScheduleItem[]> {
    return configRepository.patchDispatchSchedule(items);
  }
}

export class MlModelsService {
  findAll(etapa?: EtapaModelo): Promise<MlModelConfig[]> {
    return mlModelsRepository.findAll(etapa);
  }

  activate(id: number): Promise<MlModelConfig> {
    return mlModelsRepository.activate(id);
  }
}

export const configService = new ConfigService();
export const mlModelsService = new MlModelsService();
