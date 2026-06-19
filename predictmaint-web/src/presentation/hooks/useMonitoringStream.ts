'use client';

import { useEffect, useRef, useState } from 'react';
import { useSWRConfig } from 'swr';
import { useSessionStore } from '@/presentation/stores/sessionStore';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';
export const MONITORING_INITIAL_BATCH_MS = 15_000;
export const MONITORING_DATA_INTERVAL_MS = 8_000;

export interface MonitoringStreamState {
  isConnected: boolean;
  lastEventAt: string | null;
  isInitialBatchReady: boolean;
  simulatedMachineIds: string[];
  readingTick: number;
}

export function useMonitoringStream(): MonitoringStreamState {
  const token = useSessionStore((s) => s.token);
  const { mutate } = useSWRConfig();
  const [state, setState] = useState<MonitoringStreamState>({
    isConnected: false,
    lastEventAt: null,
    isInitialBatchReady: false,
    simulatedMachineIds: [],
    readingTick: 0,
  });
  const esRef = useRef<EventSource | null>(null);
  const retryRef = useRef(0);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const simulatedRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const batchTimer = setTimeout(() => {
      setState((prev) => ({ ...prev, isInitialBatchReady: true }));
    }, MONITORING_INITIAL_BATCH_MS);

    return () => clearTimeout(batchTimer);
  }, []);

  useEffect(() => {
    if (!token) return;

    const revalidate = () => {
      void mutate('/machines');
      void mutate('/alerts/active');
      void mutate('/analytics/dashboard');
    };

    const registerMachine = (maquinaId?: string) => {
      if (!maquinaId) return;
      simulatedRef.current.add(maquinaId);
      setState((prev) => ({
        ...prev,
        simulatedMachineIds: Array.from(simulatedRef.current),
        readingTick: prev.readingTick + 1,
        lastEventAt: new Date().toISOString(),
      }));
    };

    const connect = () => {
      if (esRef.current) {
        esRef.current.close();
      }

      const url = `${API_URL}/monitoring/stream?token=${encodeURIComponent(token)}`;
      const es = new EventSource(url);
      esRef.current = es;

      es.onopen = () => {
        retryRef.current = 0;
        setState((prev) => ({ ...prev, isConnected: true }));
      };

      es.onmessage = (event) => {
        try {
          const parsed = JSON.parse(event.data) as {
            type?: string;
            data?: { maquinaId?: string };
          };
          if (parsed.type === 'heartbeat') return;

          if (
            parsed.type === 'monitoring:reading' ||
            parsed.type === 'monitoring:alert'
          ) {
            registerMachine(parsed.data?.maquinaId);
          } else {
            setState((prev) => ({
              ...prev,
              lastEventAt: new Date().toISOString(),
            }));
          }

          revalidate();
        } catch {
          // ignorar payloads malformados
        }
      };

      es.onerror = () => {
        setState((prev) => ({ ...prev, isConnected: false }));
        es.close();
        esRef.current = null;

        const delay = Math.min(1000 * 2 ** retryRef.current, 10_000);
        retryRef.current += 1;
        retryTimerRef.current = setTimeout(connect, delay);
      };
    };

    connect();

    const startPollTimer = setTimeout(() => {
      revalidate();
      pollTimerRef.current = setInterval(revalidate, MONITORING_DATA_INTERVAL_MS);
    }, MONITORING_INITIAL_BATCH_MS);

    const simulated = simulatedRef.current;

    return () => {
      if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
      clearTimeout(startPollTimer);
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
      esRef.current?.close();
      esRef.current = null;
      simulated.clear();
      setState((prev) => ({
        isConnected: false,
        lastEventAt: null,
        isInitialBatchReady: prev.isInitialBatchReady,
        simulatedMachineIds: [],
        readingTick: 0,
      }));
    };
  }, [token, mutate]);

  return state;
}
