'use client';

import useSWR, { mutate as globalMutate } from 'swr';
import { configService, mlModelsService } from '@/application/services/config.service';
import { technicianService } from '@/application/services/technician.service';
import type { EtapaModelo } from '@/core/types';
import type { DispatchScheduleItem } from '@/lib/types/settings';

export function useSystemConfig() {
  return useSWR('/config', () => configService.getConfig());
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
