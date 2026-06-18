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

export function useSensorTrend(variable = 'rotationalSpeed', hours = 24) {
  return useSWR(['/analytics/sensor-trend', variable, hours], () =>
    analyticsService.getSensorTrend(variable, hours),
  );
}

export function useAnalyticsSummary() {
  return useSWR('/analytics/summary', () => analyticsService.getSummary());
}

export function useRecurrentFaults() {
  return useSWR('/analytics/recurrent-machines', () =>
    analyticsService.getRecurrentMachines(),
    { refreshInterval: 30000 },
  );
}

export const useRepetitiveFaults = useRecurrentFaults;
