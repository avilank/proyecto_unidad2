import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { AccionEscalada } from '../database/models/accion-escalada.model';
import { ConfiguracionAlertas } from '../database/models/configuracion-alertas.model';
import { FuenteRag } from '../database/models/fuente-rag.model';
import { ReglaNotificacion } from '../database/models/regla-notificacion.model';
import { TipoFallo } from '../database/models/tipo-fallo.model';
import { CatalogController, ConfigController } from './config-catalog.controller';
import { ConfigCatalogService } from './config-catalog.service';

@Module({
  imports: [
    SequelizeModule.forFeature([
      ConfiguracionAlertas,
      TipoFallo,
      FuenteRag,
      ReglaNotificacion,
      AccionEscalada,
    ]),
  ],
  controllers: [ConfigController, CatalogController],
  providers: [ConfigCatalogService],
  exports: [ConfigCatalogService],
})
export class ConfigCatalogModule {}
