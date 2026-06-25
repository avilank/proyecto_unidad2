import type { MlModelConfig } from '@/core/entities';
import type { EtapaModelo } from '@/core/types';
import type {
  DispatchScheduleItem,
  EscalationAction,
  NotificationRule,
  RepetitiveMachine,
  SystemConfigResponse,
} from '@/lib/types/settings';
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

  getNotificationRules(): Promise<NotificationRule[]> {
    return configRepository.getNotificationRules();
  }

  saveNotificationRule(
    nivel: string,
    body: { recibe?: string; canal?: string },
  ): Promise<NotificationRule[]> {
    return configRepository.patchNotificationRule(nivel, body);
  }

  getEscalationActions(): Promise<EscalationAction[]> {
    return configRepository.getEscalationActions();
  }

  saveEscalationAction(tipoFallo: string, acciones: string): Promise<EscalationAction[]> {
    return configRepository.patchEscalationAction(tipoFallo, acciones);
  }

  getRepetitiveMachines(): Promise<{ items: RepetitiveMachine[]; total: number }> {
    return configRepository.getRepetitiveMachines();
  }

  resolveRepetitiveMachine(id: number, nota?: string): Promise<{ ok: boolean }> {
    return configRepository.resolveRepetitiveMachine(id, nota);
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
