import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { AnalisisFallo } from '../database/models/analisis-fallo.model';
import { ClasificacionFallo } from '../database/models/clasificacion-fallo.model';
import { LecturaSensor } from '../database/models/lectura-sensor.model';
import { ModeloMl } from '../database/models/modelo-ml.model';
import { Orden } from '../database/models/orden.model';
import { PrediccionFallo } from '../database/models/prediccion-fallo.model';
import { TipoFallo } from '../database/models/tipo-fallo.model';
import { MlGatewayModule } from '../ml-gateway/ml-gateway.module';
import { PredictionsController } from './predictions.controller';
import { PredictionsService } from './predictions.service';

@Module({
  imports: [
    SequelizeModule.forFeature([
      Orden,
      PrediccionFallo,
      ClasificacionFallo,
      LecturaSensor,
      AnalisisFallo,
      ModeloMl,
      TipoFallo,
    ]),
    MlGatewayModule,
  ],
  controllers: [PredictionsController],
  providers: [PredictionsService],
})
export class PredictionsModule {}
