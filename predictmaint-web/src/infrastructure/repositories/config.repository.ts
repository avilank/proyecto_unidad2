import type { RagSource } from '@/core/entities';
import type { DispatchScheduleItem, SystemConfigResponse } from '@/lib/types/settings';
import { apiClient } from '@/infrastructure/http/clients/apiClient';

export class ConfigRepository {
  getConfig(): Promise<SystemConfigResponse> {
    return apiClient.get<SystemConfigResponse>('/config');
  }

  patchConfig(body: Record<string, unknown>): Promise<SystemConfigResponse> {
    return apiClient.patch<SystemConfigResponse>('/config', body);
  }

  getRagSources(): Promise<RagSource[]> {
    return apiClient.get<RagSource[]>('/catalog/rag-sources');
  }

  getDispatchSchedule(): Promise<DispatchScheduleItem[]> {
    return apiClient.get<DispatchScheduleItem[]>('/catalog/dispatch-schedule');
  }

  patchDispatchSchedule(items: DispatchScheduleItem[]): Promise<DispatchScheduleItem[]> {
    return apiClient.patch<DispatchScheduleItem[]>('/catalog/dispatch-schedule', { items });
  }
}

export const configRepository = new ConfigRepository();
