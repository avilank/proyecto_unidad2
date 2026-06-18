import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { ModeloMl } from '../database/models/modelo-ml.model';
import { MlModelsController } from './ml-models.controller';
import { MlMetricsBootstrapService } from './ml-metrics-bootstrap.service';
import { MlModelsService } from './ml-models.service';

@Module({
  imports: [SequelizeModule.forFeature([ModeloMl])],
  controllers: [MlModelsController],
  providers: [MlModelsService, MlMetricsBootstrapService],
  exports: [MlModelsService],
})
export class MlModelsModule {}
