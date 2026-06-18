import type { AnalyticsSummary } from '@/core/entities';
import type { DashboardApiResponse, FaultByType, RecurrentMachineFault, SensorTrendPoint } from '@/core/types/api';
import type { IAnalyticsRepository } from '@/core/interfaces';
import { apiClient } from '@/infrastructure/http/clients/apiClient';

export class AnalyticsRepository implements IAnalyticsRepository {
  getDashboardKpis(): Promise<DashboardApiResponse> {
    return apiClient.get<DashboardApiResponse>('/analytics/dashboard');
  }

  getSummary(): Promise<AnalyticsSummary> {
    return apiClient.get<AnalyticsSummary>('/analytics/summary');
  }

  getRepetitiveFaults(): Promise<RecurrentMachineFault[]> {
    return apiClient.get<RecurrentMachineFault[]>('/analytics/recurrent-machines');
  }

  getFaultsByType(range = 'week'): Promise<FaultByType[]> {
    return apiClient.get<FaultByType[]>('/analytics/faults-by-type', {
      params: { range },
    });
  }

  getSensorTrend(variable = 'rpm', hours = 24): Promise<SensorTrendPoint[]> {
    return apiClient.get<SensorTrendPoint[]>('/analytics/sensor-trend', {
      params: { variable, hours },
    });
  }
}

export const analyticsRepository = new AnalyticsRepository();
