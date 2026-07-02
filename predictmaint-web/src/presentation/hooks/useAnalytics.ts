'use client';

import useSWR from 'swr';
import { analyticsService } from '@/application/services/analytics.service';
import type { AnalyticsFilters, DashboardFilters } from '@/lib/types/analytics-filters';

export function useDashboard(
  filters: DashboardFilters = {},
  options?: { poll?: boolean },
) {
  return useSWR(['/analytics/dashboard', filters], () => analyticsService.getDashboard(filters), {
    refreshInterval: options?.poll === false ? 0 : 5000,
  });
}

export function useDashboardKpis() {
  return useDashboard();
}

export function useFaultsByType(filters: AnalyticsFilters) {
  return useSWR(['/analytics/faults-by-type', filters], () =>
    analyticsService.getFaultsByType(filters),
  );
}

export function useSensorTrend(variable = 'rotationalSpeed', hours = 24, maquinaId?: string) {
  return useSWR(['/analytics/sensor-trend', variable, hours, maquinaId ?? 'all'], () =>
    analyticsService.getSensorTrend(variable, hours, maquinaId),
  );
}

export function useAnalyticsSummary(filters: AnalyticsFilters) {
  return useSWR(['/analytics/summary', filters], () => analyticsService.getSummary(filters));
}

export function useUnattendedOrders(filters: AnalyticsFilters) {
  return useSWR(['/analytics/unattended', filters], () => analyticsService.getUnattendedOrders(filters), {
    refreshInterval: 15000,
  });
}

export function useMachineRecurrence(days = 7, minFallos = 2, filters: AnalyticsFilters) {
  return useSWR(['/analytics/machine-recurrence', days, minFallos, filters], () =>
    analyticsService.getMachineRecurrence(days, minFallos, filters),
  );
}

export function useNotificationLog(limit = 50) {
  return useSWR(['/notifications/log', limit], () => analyticsService.getNotificationLog(limit));
}

export function useRecurrentFaults() {
  return useSWR('/analytics/recurrent-machines', () =>
    analyticsService.getRecurrentMachines(),
    { refreshInterval: 30000 },
  );
}

export function useAvailability() {
  return useSWR('/analytics/availability', () => analyticsService.getAvailability(), {
    refreshInterval: 15000,
  });
}

export function usePredictionValidation(filters: AnalyticsFilters) {
  return useSWR(['/analytics/prediction-validation', filters], () =>
    analyticsService.getPredictionValidation(filters),
  );
}

export function useReliability(filters: AnalyticsFilters) {
  return useSWR(['/analytics/reliability', filters], () =>
    analyticsService.getReliability(filters),
  );
}

export const useRepetitiveFaults = useRecurrentFaults;
