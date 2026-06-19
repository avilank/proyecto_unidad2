import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { Alerta } from '../database/models/alerta.model';
import { AnalisisFallo } from '../database/models/analisis-fallo.model';
import { ClasificacionFallo } from '../database/models/clasificacion-fallo.model';
import { LecturaSensor } from '../database/models/lectura-sensor.model';
import { Maquina } from '../database/models/maquina.model';
import { ModeloMl } from '../database/models/modelo-ml.model';
import { Orden } from '../database/models/orden.model';
import { ObservacionTecnica } from '../database/models/observacion-tecnica.model';
import { PrediccionFallo } from '../database/models/prediccion-fallo.model';
import { TipoFallo } from '../database/models/tipo-fallo.model';
import { Tecnico } from '../database/models/tecnico.model';
import { Especialidad } from '../database/models/especialidad.model';
import { Usuario } from '../database/models/usuario.model';
import { RespuestaRecomendacion } from '../database/models/respuesta-recomendacion.model';
import { OrdersModule } from '../orders/orders.module';
import { AnalyticsController } from './analytics.controller';
import { AnalyticsService } from './analytics.service';

@Module({
  imports: [
    SequelizeModule.forFeature([
      Maquina,
      Orden,
      ObservacionTecnica,
      Alerta,
      PrediccionFallo,
      AnalisisFallo,
      ClasificacionFallo,
      TipoFallo,
      LecturaSensor,
      ModeloMl,
      Tecnico,
      Usuario,
      Especialidad,
      RespuestaRecomendacion,
    ]),
    OrdersModule,
  ],
  controllers: [AnalyticsController],
  providers: [AnalyticsService],
})
export class AnalyticsModule {}
