'use client';

import useSWR, { mutate as globalMutate } from 'swr';
import { configService, mlModelsService } from '@/application/services/config.service';
import { technicianService } from '@/application/services/technician.service';
import type { EtapaModelo } from '@/core/types';
import type {
  DispatchScheduleItem,
  EscalationAction,
  NotificationRule,
  RepetitiveFaultsConfig,
  TiemposAtencion,
} from '@/lib/types/settings';

export function useSystemConfig() {
  return useSWR('/config', () => configService.getConfig());
}

export function useNotificationRules() {
  return useSWR('/catalog/notification-rules', () =>
    configService.getNotificationRules(),
  );
}

export function useEscalationActions() {
  return useSWR('/catalog/escalation-actions', () =>
    configService.getEscalationActions(),
  );
}

export function useRepetitiveMachines() {
  return useSWR('/repetitive-faults', () => configService.getRepetitiveMachines(), {
    refreshInterval: 30000,
  });
}

export function useMlModels(etapa: EtapaModelo) {
  return useSWR(['/ml-models', etapa], () => mlModelsService.findAll(etapa));
}

export function useDispatchSchedule() {
  return useSWR('/catalog/dispatch-schedule', () => configService.getDispatchSchedule());
}

export function useRagSources() {
  return useSWR('/catalog/rag-sources', () => configService.getRagSources());
}

export function useSettingsMutations() {
  return {
    saveMlSettings: async (payload: {
      umbral_ensemble_falla: number;
      agreement_minimo_s3: string;
    }) => {
      const result = await configService.saveConfig({
        umbral_ensemble_falla: payload.umbral_ensemble_falla,
        agreement_minimo_s3: payload.agreement_minimo_s3,
      });
      await globalMutate('/config', result, false);
      return result;
    },
    saveAlertSettings: async (payload: {
      riesgo_bajo: number;
      riesgo_medio: number;
      riesgo_alto: number;
      riesgo_critico: number;
      tiempos_atencion: TiemposAtencion;
    }) => {
      const result = await configService.saveConfig(payload);
      await globalMutate('/config', result, false);
      return result;
    },
    saveRepetitiveSettings: async (cfg: RepetitiveFaultsConfig) => {
      const result = await configService.saveConfig({ fallos_repetitivos: cfg });
      await globalMutate('/config', result, false);
      return result;
    },
    saveEscalationActions: async (actions: EscalationAction[]) => {
      let last: EscalationAction[] = actions;
      for (const a of actions) {
        last = await configService.saveEscalationAction(a.tipoFallo, a.acciones);
      }
      await globalMutate('/catalog/escalation-actions', last, false);
      return last;
    },
    resolveRepetitiveFault: async (id: number, nota?: string) => {
      const result = await configService.resolveRepetitiveMachine(id, nota);
      await globalMutate('/repetitive-faults');
      return result;
    },
    saveNotificationRules: async (rules: NotificationRule[]) => {
      let last: NotificationRule[] = rules;
      for (const rule of rules) {
        last = await configService.saveNotificationRule(rule.nivel, {
          recibe: rule.recibe,
          canal: rule.canal,
        });
      }
      await globalMutate('/catalog/notification-rules', last, false);
      return last;
    },
    saveDispatchSchedule: async (items: DispatchScheduleItem[]) => {
      const result = await configService.saveDispatchSchedule(items);
      await globalMutate('/catalog/dispatch-schedule', result, false);
      await globalMutate('/config');
      return result;
    },
    patchRagSource: async (id: number, activa: boolean) => {
      const result = await configService.patchRagSource(id, activa);
      await globalMutate('/catalog/rag-sources');
      return result;
    },
    activateModel: async (id: number, etapa: EtapaModelo) => {
      const result = await mlModelsService.activate(id);
      await globalMutate(['/ml-models', etapa]);
      return result;
    },
    updateTechnicianChannels: async (
      id: number,
      prefs: { enviarWssp?: boolean; enviarCorreo?: boolean },
    ) => {
      const result = await technicianService.update(id, prefs);
      await globalMutate('/technicians');
      return result;
    },
  };
}
