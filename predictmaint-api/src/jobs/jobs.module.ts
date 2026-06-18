import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { Alerta } from '../database/models/alerta.model';
import { AnalisisFallo } from '../database/models/analisis-fallo.model';
import { ClasificacionFallo } from '../database/models/clasificacion-fallo.model';
import { EventoOrden } from '../database/models/evento-orden.model';
import { Orden } from '../database/models/orden.model';
import { TipoFallo } from '../database/models/tipo-fallo.model';
import { TechniciansModule } from '../technicians/technicians.module';
import { AssignmentRetryService } from './assignment-retry.service';

@Module({
  imports: [
    SequelizeModule.forFeature([
      Orden,
      Alerta,
      EventoOrden,
      ClasificacionFallo,
      AnalisisFallo,
      TipoFallo,
    ]),
    TechniciansModule,
  ],
  providers: [AssignmentRetryService],
})
export class JobsModule {}
