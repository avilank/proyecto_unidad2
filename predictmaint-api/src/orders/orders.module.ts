import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { AnalisisFallo } from '../database/models/analisis-fallo.model';
import { ClasificacionFallo } from '../database/models/clasificacion-fallo.model';
import { EventoOrden } from '../database/models/evento-orden.model';
import { LecturaSensor } from '../database/models/lectura-sensor.model';
import { Maquina } from '../database/models/maquina.model';
import { ModeloMl } from '../database/models/modelo-ml.model';
import { Alerta } from '../database/models/alerta.model';
import { Orden } from '../database/models/orden.model';
import { SolucionAplicada } from '../database/models/solucion-aplicada.model';
import { ObservacionTecnica } from '../database/models/observacion-tecnica.model';
import { Tecnico } from '../database/models/tecnico.model';
import { TipoFallo } from '../database/models/tipo-fallo.model';
import { Usuario } from '../database/models/usuario.model';
import { MachinesModule } from '../machines/machines.module';
import { TechniciansModule } from '../technicians/technicians.module';
import { ConfigCatalogModule } from '../config-catalog/config-catalog.module';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';

@Module({
  imports: [
    SequelizeModule.forFeature([
      Orden,
      Alerta,
      EventoOrden,
      Maquina,
      AnalisisFallo,
      LecturaSensor,
      Tecnico,
      Usuario,
      ClasificacionFallo,
      TipoFallo,
      ModeloMl,
      SolucionAplicada,
      ObservacionTecnica,
    ]),
    MachinesModule,
    TechniciansModule,
    ConfigCatalogModule,
  ],
  controllers: [OrdersController],
  providers: [OrdersService],
  exports: [OrdersService],
})
export class OrdersModule {}
