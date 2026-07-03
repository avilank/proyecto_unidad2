import type { MlModelConfig } from '@/core/entities';
import type { EtapaModelo } from '@/core/types';
import { apiClient } from '@/infrastructure/http/clients/apiClient';

export class MlModelsRepository {
  findAll(etapa?: EtapaModelo): Promise<MlModelConfig[]> {
    return apiClient.get<MlModelConfig[]>('/ml-models', {
      params: etapa ? { etapa } : undefined,
    });
  }

  activate(id: number): Promise<MlModelConfig> {
    return apiClient.patch<MlModelConfig>(`/ml-models/${id}/activate`);
  }

  updateUmbral(id: number, umbral: number): Promise<MlModelConfig> {
    return apiClient.patch<MlModelConfig>(`/ml-models/${id}/umbral`, { umbral });
  }
}

export const mlModelsRepository = new MlModelsRepository();
