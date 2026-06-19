import type { AnalyticsSummary } from '@/core/entities';
import type {
  DashboardApiResponse,
  FaultByType,
  RecurrentMachineFault,
} from '@/core/types/api';
import { analyticsRepository } from '@/infrastructure/repositories/analytics.repository';

export class AnalyticsService {
  getDashboard(): Promise<DashboardApiResponse> {
    return analyticsRepository.getDashboardKpis();
  }

  getSummary(): Promise<AnalyticsSummary> {
    return analyticsRepository.getSummary();
  }

  getRecurrentMachines(): Promise<RecurrentMachineFault[]> {
    return analyticsRepository.getRepetitiveFaults();
  }

  getFaultsByType(range = 'week'): Promise<FaultByType[]> {
    return analyticsRepository.getFaultsByType(range);
  }

  getSensorTrend(variable = 'rotationalSpeed', hours = 24, maquinaId?: string) {
    return analyticsRepository.getSensorTrend(variable, hours, maquinaId);
  }
}

export const analyticsService = new AnalyticsService();
