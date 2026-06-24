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
}

export const mlModelsRepository = new MlModelsRepository();
