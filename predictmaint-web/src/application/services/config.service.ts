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

function toBool(value: unknown, fallback = false): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') return value.toLowerCase() === 'true';
  return fallback;
}

function normalizeRagSource(raw: unknown): import('@/core/entities').RagSource | null {
  if (!raw || typeof raw !== 'object') return null;
  const item = raw as Record<string, unknown>;
  const id = Number(item.id ?? item.idFuente ?? item.id_fuente);
  if (!Number.isFinite(id)) return null;
  const fuente = String(item.fuente ?? item.titulo ?? '').trim();
  if (!fuente) return null;
  return {
    id,
    fuente,
    tipoFallo: (item.tipoFallo as import('@/core/types').TipoFallo | null) ?? null,
    descripcion:
      typeof item.descripcion === 'string'
        ? item.descripcion
        : typeof item.autor === 'string'
          ? item.autor
          : null,
    activa: toBool(item.activa ?? item.activo, true),
  };
}

export class ConfigService {
  getConfig(): Promise<SystemConfigResponse> {
    return configRepository.getConfig();
  }

  async getRagSources(): Promise<import('@/core/entities').RagSource[]> {
    const payload = await configRepository.getRagSources();
    const list = Array.isArray(payload) ? payload : [];
    return list
      .map((item) => normalizeRagSource(item))
      .filter((item): item is import('@/core/entities').RagSource => Boolean(item));
  }

  patchRagSource(id: number, activa: boolean): Promise<import('@/core/entities').RagSource> {
    return configRepository.patchRagSource(id, activa);
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

  updateUmbral(id: number, umbral: number): Promise<MlModelConfig> {
    return mlModelsRepository.updateUmbral(id, umbral);
  }
}

export const configService = new ConfigService();
export const mlModelsService = new MlModelsService();
