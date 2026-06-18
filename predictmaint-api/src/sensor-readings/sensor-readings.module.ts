import { Module, forwardRef } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { Alerta } from '../database/models/alerta.model';
import { AnalisisFallo } from '../database/models/analisis-fallo.model';
import { ClasificacionFallo } from '../database/models/clasificacion-fallo.model';
import { ConfiguracionAlertas } from '../database/models/configuracion-alertas.model';
import { EventoOrden } from '../database/models/evento-orden.model';
import { FuenteRag } from '../database/models/fuente-rag.model';
import { LecturaSensor } from '../database/models/lectura-sensor.model';
import { Maquina } from '../database/models/maquina.model';
import { Orden } from '../database/models/orden.model';
import { PrediccionFallo } from '../database/models/prediccion-fallo.model';
import { RecomendacionRag } from '../database/models/recomendacion-rag.model';
import { TipoFallo } from '../database/models/tipo-fallo.model';
import { MlGatewayModule } from '../ml-gateway/ml-gateway.module';
import { MlModelsModule } from '../ml-models/ml-models.module';
import { AlertsModule } from '../alerts/alerts.module';
import { MachinesModule } from '../machines/machines.module';
import { OrdersModule } from '../orders/orders.module';
import { TechniciansModule } from '../technicians/technicians.module';
import { SensorReadingsController } from './sensor-readings.controller';
import { SensorReadingsService } from './sensor-readings.service';

@Module({
  imports: [
    SequelizeModule.forFeature([
      LecturaSensor,
      Maquina,
      AnalisisFallo,
      Alerta,
      Orden,
      EventoOrden,
      PrediccionFallo,
      ClasificacionFallo,
      RecomendacionRag,
      FuenteRag,
      TipoFallo,
      ConfiguracionAlertas,
    ]),
    MlGatewayModule,
    MlModelsModule,
    MachinesModule,
    forwardRef(() => AlertsModule),
    forwardRef(() => OrdersModule),
    TechniciansModule,
  ],
  controllers: [SensorReadingsController],
  providers: [SensorReadingsService],
  exports: [SensorReadingsService],
})
export class SensorReadingsModule {}
