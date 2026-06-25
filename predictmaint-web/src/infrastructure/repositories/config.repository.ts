import type { RagSource } from '@/core/entities';
import type {
  DispatchScheduleItem,
  EscalationAction,
  NotificationRule,
  RepetitiveMachine,
  SystemConfigResponse,
} from '@/lib/types/settings';
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

  getNotificationRules(): Promise<NotificationRule[]> {
    return apiClient.get<NotificationRule[]>('/catalog/notification-rules');
  }

  patchNotificationRule(
    nivel: string,
    body: { recibe?: string; canal?: string },
  ): Promise<NotificationRule[]> {
    return apiClient.patch<NotificationRule[]>(
      `/catalog/notification-rules/${nivel}`,
      body,
    );
  }

  getEscalationActions(): Promise<EscalationAction[]> {
    return apiClient.get<EscalationAction[]>('/catalog/escalation-actions');
  }

  patchEscalationAction(tipoFallo: string, acciones: string): Promise<EscalationAction[]> {
    return apiClient.patch<EscalationAction[]>(
      `/catalog/escalation-actions/${tipoFallo}`,
      { acciones },
    );
  }

  getRepetitiveMachines(): Promise<{ items: RepetitiveMachine[]; total: number }> {
    return apiClient.get<{ items: RepetitiveMachine[]; total: number }>('/repetitive-faults');
  }

  resolveRepetitiveMachine(id: number, nota?: string): Promise<{ ok: boolean }> {
    return apiClient.post<{ ok: boolean }>(`/repetitive-faults/${id}/resolve`, { nota });
  }

  getDispatchSchedule(): Promise<DispatchScheduleItem[]> {
    return apiClient.get<DispatchScheduleItem[]>('/catalog/dispatch-schedule');
  }

  patchDispatchSchedule(items: DispatchScheduleItem[]): Promise<DispatchScheduleItem[]> {
    return apiClient.patch<DispatchScheduleItem[]>('/catalog/dispatch-schedule', { items });
  }
}

export const configRepository = new ConfigRepository();
