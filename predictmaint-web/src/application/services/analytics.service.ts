import type { AnalyticsSummary } from '@/core/entities';
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
  getDashboard(): Promise<DashboardApiResponse> {
    return analyticsRepository.getDashboardKpis();
  }

  getSummary(range = 'week'): Promise<AnalyticsSummary> {
    return analyticsRepository.getSummary(range);
  }

  getRecurrentMachines(): Promise<RecurrentMachineFault[]> {
    return analyticsRepository.getRepetitiveFaults();
  }

  getMachineRecurrence(days = 7, minFallos = 2): Promise<MachineRecurrence[]> {
    return analyticsRepository.getMachineRecurrence(days, minFallos);
  }

  getUnattendedOrders() {
    return analyticsRepository.getUnattendedOrders();
  }

  getNotificationLog(limit = 50): Promise<PaginatedResponse<NotificationLogEntry>> {
    return analyticsRepository.getNotificationLog(limit);
  }

  getFaultsByType(range = 'week'): Promise<FaultByType[]> {
    return analyticsRepository.getFaultsByType(range);
  }

  getSensorTrend(variable = 'rotationalSpeed', hours = 24, maquinaId?: string) {
    return analyticsRepository.getSensorTrend(variable, hours, maquinaId);
  }

  getAvailability() {
    return analyticsRepository.getAvailability();
  }
}

export const analyticsService = new AnalyticsService();
