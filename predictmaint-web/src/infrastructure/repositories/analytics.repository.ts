import type { AnalyticsSummary } from '@/core/entities';
import type {
  DashboardApiResponse,
  FaultByType,
  AvailabilitySnapshot,
  MachineRecurrence,
  NotificationLogEntry,
  PaginatedResponse,
  RecurrentMachineFault,
  SensorTrendPoint,
  UnattendedOrder,
} from '@/core/types/api';
import type { IAnalyticsRepository } from '@/core/interfaces';
import { apiClient } from '@/infrastructure/http/clients/apiClient';
import { FAULT_TYPE_ORDER } from '@/lib/constants/fault-types';

type FaultByTypeApi = { tipoFallo?: string; tipo?: string; count?: number; total?: number };

export class AnalyticsRepository implements IAnalyticsRepository {
  getDashboardKpis(): Promise<DashboardApiResponse> {
    return apiClient.get<DashboardApiResponse>('/analytics/dashboard');
  }

  getSummary(range = 'week'): Promise<AnalyticsSummary> {
    return apiClient.get<AnalyticsSummary>('/analytics/summary', { params: { range } });
  }

  getRepetitiveFaults(): Promise<RecurrentMachineFault[]> {
    return apiClient.get<RecurrentMachineFault[]>('/analytics/recurrent-machines');
  }

  getMachineRecurrence(days = 7, minFallos = 2): Promise<MachineRecurrence[]> {
    return apiClient.get<MachineRecurrence[]>('/analytics/machine-recurrence', {
      params: { days, minFallos },
    });
  }

  getUnattendedOrders(): Promise<UnattendedOrder[]> {
    return apiClient.get<UnattendedOrder[]>('/analytics/unattended');
  }

  getNotificationLog(limit = 50): Promise<PaginatedResponse<NotificationLogEntry>> {
    return apiClient.get<PaginatedResponse<NotificationLogEntry>>('/notifications/log', {
      params: { limit },
    });
  }

  async getFaultsByType(range = 'week'): Promise<FaultByType[]> {
    const raw = await apiClient.get<FaultByTypeApi[]>('/analytics/faults-by-type', {
      params: { range },
    });
    const counts = new Map<string, number>();
    for (const row of raw) {
      const tipoFallo = row.tipoFallo ?? row.tipo ?? 'RNF';
      const count = row.count ?? row.total ?? 0;
      counts.set(tipoFallo, (counts.get(tipoFallo) ?? 0) + count);
    }
    return FAULT_TYPE_ORDER.map((tipoFallo) => ({
      tipoFallo,
      count: counts.get(tipoFallo) ?? 0,
    }));
  }

  getSensorTrend(variable = 'rpm', hours = 24, maquinaId?: string): Promise<SensorTrendPoint[]> {
    return apiClient.get<SensorTrendPoint[]>('/analytics/sensor-trend', {
      params: { variable, hours, ...(maquinaId ? { maquinaId } : {}) },
    });
  }

  getAvailability(): Promise<AvailabilitySnapshot> {
    return apiClient.get<AvailabilitySnapshot>('/analytics/availability');
  }
}

export const analyticsRepository = new AnalyticsRepository();
