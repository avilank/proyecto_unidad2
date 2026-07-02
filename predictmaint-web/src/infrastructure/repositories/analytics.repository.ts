import type { AnalyticsSummary } from '@/core/entities';
import type {
  DashboardApiResponse,
  FaultByType,
  AvailabilitySnapshot,
  MachineRecurrence,
  NotificationLogEntry,
  PaginatedResponse,
  PredictionValidationRow,
  RecurrentMachineFault,
  ReliabilityResponse,
  SensorTrendPoint,
  UnattendedOrder,
} from '@/core/types/api';
import type { IAnalyticsRepository } from '@/core/interfaces';
import { apiClient } from '@/infrastructure/http/clients/apiClient';
import type { AnalyticsFilters, DashboardFilters } from '@/lib/types/analytics-filters';
import { analyticsFiltersToParams, dashboardFiltersToParams } from '@/lib/types/analytics-filters';
import { FAULT_TYPE_ORDER } from '@/lib/constants/fault-types';

type FaultByTypeApi = { tipoFallo?: string; tipo?: string; count?: number; total?: number };

export class AnalyticsRepository implements IAnalyticsRepository {
  getDashboardKpis(filters: DashboardFilters = {}): Promise<DashboardApiResponse> {
    return apiClient.get<DashboardApiResponse>('/analytics/dashboard', {
      params: dashboardFiltersToParams(filters),
    });
  }

  getSummary(filters: AnalyticsFilters = { range: 'week' }): Promise<AnalyticsSummary> {
    return apiClient.get<AnalyticsSummary>('/analytics/summary', {
      params: analyticsFiltersToParams(filters),
    });
  }

  getRepetitiveFaults(): Promise<RecurrentMachineFault[]> {
    return apiClient.get<RecurrentMachineFault[]>('/analytics/recurrent-machines');
  }

  getMachineRecurrence(
    days = 7,
    minFallos = 2,
    filters: AnalyticsFilters = { range: 'week' },
  ): Promise<MachineRecurrence[]> {
    return apiClient.get<MachineRecurrence[]>('/analytics/machine-recurrence', {
      params: { days, minFallos, ...analyticsFiltersToParams(filters) },
    });
  }

  getUnattendedOrders(filters: AnalyticsFilters = { range: 'week' }) {
    return apiClient.get<UnattendedOrder[]>('/analytics/unattended', {
      params: analyticsFiltersToParams(filters),
    });
  }

  getNotificationLog(limit = 50): Promise<PaginatedResponse<NotificationLogEntry>> {
    return apiClient.get<PaginatedResponse<NotificationLogEntry>>('/notifications/log', {
      params: { limit },
    });
  }

  async getFaultsByType(filters: AnalyticsFilters = { range: 'week' }): Promise<FaultByType[]> {
    const raw = await apiClient.get<FaultByTypeApi[]>('/analytics/faults-by-type', {
      params: analyticsFiltersToParams(filters),
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

  getReliability(filters: AnalyticsFilters = { range: 'week' }): Promise<ReliabilityResponse> {
    return apiClient.get<ReliabilityResponse>('/analytics/reliability', {
      params: analyticsFiltersToParams(filters),
    });
  }

  getPredictionValidation(filters: AnalyticsFilters = { range: 'month' }): Promise<PredictionValidationRow[]> {
    return apiClient.get<PredictionValidationRow[]>('/analytics/prediction-validation', {
      params: analyticsFiltersToParams(filters),
    });
  }
}

export const analyticsRepository = new AnalyticsRepository();
