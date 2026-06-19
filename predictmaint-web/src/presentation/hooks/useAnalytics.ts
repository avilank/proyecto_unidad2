'use client';

import useSWR from 'swr';
import { analyticsService } from '@/application/services/analytics.service';

export function useDashboard(options?: { poll?: boolean }) {
  return useSWR('/analytics/dashboard', () => analyticsService.getDashboard(), {
    refreshInterval: options?.poll === false ? 0 : 5000,
  });
}

export function useDashboardKpis() {
  return useDashboard();
}

export function useFaultsByType(range = 'week') {
  return useSWR(['/analytics/faults-by-type', range], () =>
    analyticsService.getFaultsByType(range),
  );
}

export function useSensorTrend(variable = 'rotationalSpeed', hours = 24, maquinaId?: string) {
  return useSWR(['/analytics/sensor-trend', variable, hours, maquinaId ?? 'all'], () =>
    analyticsService.getSensorTrend(variable, hours, maquinaId),
  );
}

export function useAnalyticsSummary(range = 'week') {
  return useSWR(['/analytics/summary', range], () => analyticsService.getSummary(range));
}

export function useUnattendedOrders() {
  return useSWR('/analytics/unattended', () => analyticsService.getUnattendedOrders(), {
    refreshInterval: 15000,
  });
}

export function useMachineRecurrence(days = 7, minFallos = 2) {
  return useSWR(['/analytics/machine-recurrence', days, minFallos], () =>
    analyticsService.getMachineRecurrence(days, minFallos),
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

export function usePredictionValidation(range = 'month') {
  return useSWR(['/analytics/prediction-validation', range], () =>
    analyticsService.getPredictionValidation(range),
  );
}

export const useRepetitiveFaults = useRecurrentFaults;
