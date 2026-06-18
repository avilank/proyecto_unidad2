import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { MlModelsService } from './ml-models.service';

@Injectable()
export class MlMetricsBootstrapService implements OnApplicationBootstrap {
  private readonly logger = new Logger(MlMetricsBootstrapService.name);

  constructor(private readonly mlModelsService: MlModelsService) {}

  async onApplicationBootstrap(): Promise<void> {
    try {
      const updated = await this.mlModelsService.syncMetricsFromArtifacts();
      if (updated === 0) {
        this.logger.warn(
          'No se sincronizaron métricas ML (metrics.json ausente o modelos no encontrados)',
        );
      }
    } catch (err) {
      this.logger.warn(`Sync métricas ML omitido: ${(err as Error).message}`);
    }
  }
}
