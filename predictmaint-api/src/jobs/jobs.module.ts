import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { Alerta } from '../database/models/alerta.model';
import { AnalisisFallo } from '../database/models/analisis-fallo.model';
import { ClasificacionFallo } from '../database/models/clasificacion-fallo.model';
import { EventoOrden } from '../database/models/evento-orden.model';
import { Maquina } from '../database/models/maquina.model';
import { Orden } from '../database/models/orden.model';
import { TipoFallo } from '../database/models/tipo-fallo.model';
import { TechniciansModule } from '../technicians/technicians.module';
import { ConfigCatalogModule } from '../config-catalog/config-catalog.module';
import { AssignmentRetryService } from './assignment-retry.service';
import { EscalationService } from './escalation.service';
import { AutoFaultService } from './auto-fault.service';

@Module({
  imports: [
    SequelizeModule.forFeature([
      Orden,
      Alerta,
      EventoOrden,
      ClasificacionFallo,
      AnalisisFallo,
      TipoFallo,
      Maquina,
    ]),
    TechniciansModule,
    ConfigCatalogModule,
  ],
  providers: [AssignmentRetryService, EscalationService, AutoFaultService],
})
export class JobsModule {}
