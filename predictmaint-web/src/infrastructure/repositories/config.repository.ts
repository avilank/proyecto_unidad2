import type { AppConfig, RagSource } from '@/core/entities';
import type { IConfigRepository } from '@/core/interfaces';
import { apiClient } from '@/infrastructure/http/clients/apiClient';

export class ConfigRepository implements IConfigRepository {
  getConfig(): Promise<AppConfig> {
    return apiClient.get<AppConfig>('/config');
  }

  getRagSources(): Promise<RagSource[]> {
    return apiClient.get<RagSource[]>('/catalog/rag-sources');
  }
}

export const configRepository = new ConfigRepository();
