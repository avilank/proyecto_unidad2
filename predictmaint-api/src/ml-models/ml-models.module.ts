import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { ModeloMl } from '../database/models/modelo-ml.model';
import { MlModelsController } from './ml-models.controller';
import { MlModelsService } from './ml-models.service';

@Module({
  imports: [SequelizeModule.forFeature([ModeloMl])],
  controllers: [MlModelsController],
  providers: [MlModelsService],
})
export class MlModelsModule {}
