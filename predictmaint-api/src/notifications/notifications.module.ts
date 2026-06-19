import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { AnalisisFallo } from '../database/models/analisis-fallo.model';
import { ClasificacionFallo } from '../database/models/clasificacion-fallo.model';
import { LecturaSensor } from '../database/models/lectura-sensor.model';
import { Maquina } from '../database/models/maquina.model';
import { MensajeEnviado } from '../database/models/mensaje-enviado.model';
import { Orden } from '../database/models/orden.model';
import { RecomendacionRag } from '../database/models/recomendacion-rag.model';
import { ReglaNotificacion } from '../database/models/regla-notificacion.model';
import { SolucionAplicada } from '../database/models/solucion-aplicada.model';
import { Tecnico } from '../database/models/tecnico.model';
import { TipoFallo } from '../database/models/tipo-fallo.model';
import { Usuario } from '../database/models/usuario.model';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { OrderNotificationListener } from './order-notification.listener';
import { WebhookNotifierService } from './webhook-notifier.service';

@Module({
  imports: [
    SequelizeModule.forFeature([
      Orden,
      Tecnico,
      Usuario,
      MensajeEnviado,
      ReglaNotificacion,
      RecomendacionRag,
      Maquina,
      AnalisisFallo,
      ClasificacionFallo,
      LecturaSensor,
      TipoFallo,
      SolucionAplicada,
    ]),
  ],
  controllers: [NotificationsController],
  providers: [
    NotificationsService,
    WebhookNotifierService,
    OrderNotificationListener,
  ],
  exports: [NotificationsService],
})
export class NotificationsModule {}
