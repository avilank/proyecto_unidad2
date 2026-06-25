import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { AnalisisFallo } from '../database/models/analisis-fallo.model';
import { ClasificacionFallo } from '../database/models/clasificacion-fallo.model';
import { FalloRepetitivo } from '../database/models/fallo-repetitivo.model';
import { Maquina } from '../database/models/maquina.model';
import { Orden } from '../database/models/orden.model';
import { TipoFallo } from '../database/models/tipo-fallo.model';
import { ConfigCatalogModule } from '../config-catalog/config-catalog.module';
import { RepetitiveFaultsController } from './repetitive-faults.controller';
import { RepetitiveFaultsService } from './repetitive-faults.service';

@Module({
  imports: [
    SequelizeModule.forFeature([
      Orden,
      FalloRepetitivo,
      Maquina,
      AnalisisFallo,
      ClasificacionFallo,
      TipoFallo,
    ]),
    ConfigCatalogModule,
  ],
  controllers: [RepetitiveFaultsController],
  providers: [RepetitiveFaultsService],
})
export class RepetitiveFaultsModule {}
