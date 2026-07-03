import type { AnalyticsSummary } from '@/core/entities';
import type { AnalyticsFilters, DashboardFilters } from '@/lib/types/analytics-filters';
import type {
  DashboardApiResponse,
  FaultByType,
  MachineRecurrence,
  NotificationLogEntry,
  PaginatedResponse,
  RecurrentMachineFault,
} from '@/core/types/api';
import { analyticsRepository } from '@/infrastructure/repositories/analytics.repository';

export class AnalyticsService {
  getDashboard(filters: DashboardFilters = {}): Promise<DashboardApiResponse> {
    return analyticsRepository.getDashboardKpis(filters);
  }

  getSummary(filters: AnalyticsFilters = { range: 'week' }): Promise<AnalyticsSummary> {
    return analyticsRepository.getSummary(filters);
  }

  getRecurrentMachines(): Promise<RecurrentMachineFault[]> {
    return analyticsRepository.getRepetitiveFaults();
  }

  getMachineRecurrence(
    days = 7,
    minFallos = 2,
    filters: AnalyticsFilters = { range: 'week' },
  ): Promise<MachineRecurrence[]> {
    return analyticsRepository.getMachineRecurrence(days, minFallos, filters);
  }

  getUnattendedOrders(filters: AnalyticsFilters = { range: 'week' }) {
    return analyticsRepository.getUnattendedOrders(filters);
  }

  getNotificationLog(limit = 50): Promise<PaginatedResponse<NotificationLogEntry>> {
    return analyticsRepository.getNotificationLog(limit);
  }

  getFaultsByType(filters: AnalyticsFilters = { range: 'week' }): Promise<FaultByType[]> {
    return analyticsRepository.getFaultsByType(filters);
  }

  getSensorTrend(variable = 'rotationalSpeed', hours = 24, maquinaId?: string) {
    return analyticsRepository.getSensorTrend(variable, hours, maquinaId);
  }

  getAvailability() {
    return analyticsRepository.getAvailability();
  }

  getPredictionValidation(filters: AnalyticsFilters = { range: 'month' }) {
    return analyticsRepository.getPredictionValidation(filters);
  }

  getValidationSummary(filters: AnalyticsFilters = { range: 'month' }) {
    return analyticsRepository.getValidationSummary(filters);
  }

  getReliability(filters: AnalyticsFilters = { range: 'week' }) {
    return analyticsRepository.getReliability(filters);
  }
}

export const analyticsService = new AnalyticsService();
