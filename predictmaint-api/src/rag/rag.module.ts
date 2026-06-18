import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { AnalisisFallo } from '../database/models/analisis-fallo.model';
import { ClasificacionFallo } from '../database/models/clasificacion-fallo.model';
import { EventoOrden } from '../database/models/evento-orden.model';
import { FuenteRag } from '../database/models/fuente-rag.model';
import { Maquina } from '../database/models/maquina.model';
import { Orden } from '../database/models/orden.model';
import { RecomendacionRag } from '../database/models/recomendacion-rag.model';
import { RespuestaRecomendacion } from '../database/models/respuesta-recomendacion.model';
import { TipoFallo } from '../database/models/tipo-fallo.model';
import { MlGatewayModule } from '../ml-gateway/ml-gateway.module';
import { RagController } from './rag.controller';
import { RagService } from './rag.service';

@Module({
  imports: [
    SequelizeModule.forFeature([
      RecomendacionRag,
      FuenteRag,
      Orden,
      EventoOrden,
      ClasificacionFallo,
      AnalisisFallo,
      TipoFallo,
      Maquina,
      RespuestaRecomendacion,
    ]),
    MlGatewayModule,
  ],
  controllers: [RagController],
  providers: [RagService],
})
export class RagModule {}
