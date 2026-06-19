import type { AppConfig, RagSource } from '@/core/entities';
import { configRepository } from '@/infrastructure/repositories/config.repository';

export class ConfigService {
  getConfig(): Promise<AppConfig> {
    return configRepository.getConfig();
  }

  getRagSources(): Promise<RagSource[]> {
    return configRepository.getRagSources();
  }
}

export const configService = new ConfigService();
