import type { AppConfig } from '@/core/entities';
import { configRepository } from '@/infrastructure/repositories/config.repository';

export class ConfigService {
  getConfig(): Promise<AppConfig> {
    return configRepository.getConfig();
  }
}

export const configService = new ConfigService();
