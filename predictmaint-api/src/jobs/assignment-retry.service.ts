import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Cron } from '@nestjs/schedule';
import { InjectModel } from '@nestjs/sequelize';
import { Op } from 'sequelize';
import { addMinutes } from '../common/utils/shift.util';
import { EstadoOrden, NivelRiesgo } from '../common/enums';
import {
  ORDER_CREATED_EVENT,
  OrderCreatedPayload,
} from '../common/events/order.events';
import { tecnicoNombre } from '../common/utils/tecnico-display.util';
import { Alerta } from '../database/models/alerta.model';
import { AnalisisFallo } from '../database/models/analisis-fallo.model';
import { ClasificacionFallo } from '../database/models/clasificacion-fallo.model';
import { EventoOrden } from '../database/models/evento-orden.model';
import { Maquina } from '../database/models/maquina.model';
import { Orden } from '../database/models/orden.model';
import { TipoFallo } from '../database/models/tipo-fallo.model';
import { TechniciansService } from '../technicians/technicians.service';

@Injectable()
export class AssignmentRetryService {
  private readonly logger = new Logger(AssignmentRetryService.name);

  constructor(
    @InjectModel(Orden) private readonly ordenModel: typeof Orden,
    @InjectModel(Alerta) private readonly alertaModel: typeof Alerta,
    @InjectModel(EventoOrden) private readonly eventoModel: typeof EventoOrden,
    @InjectModel(ClasificacionFallo) private readonly clasificacionModel: typeof ClasificacionFallo,
    private readonly techniciansService: TechniciansService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  @Cron('0 * * * * *')
  async retryPendingAssignments(): Promise<void> {
    const now = new Date();
    const pending = await this.ordenModel.findAll({
      where: {
        idTecnico: { [Op.is]: null },
        estado: EstadoOrden.PENDIENTE,
        proximoReintentoAsignacion: { [Op.lte]: now },
      },
      include: [
        { model: Maquina },
        {
          model: AnalisisFallo,
          include: [
            {
              model: ClasificacionFallo,
              include: [{ model: TipoFallo }],
            },
          ],
        },
      ],
    });

    for (const order of pending) {
      const s2Count = order.analisis?.clasificaciones?.length ?? 0;
      if (s2Count === 0) continue;

      const lider = order.analisis?.clasificaciones?.find((c) => c.esLider);
      const tipoFallo = lider?.tipoFallo?.codigo;

      const tecnico = await this.techniciansService.assignForOrder(
        (order.analisis?.nivelRiesgo as NivelRiesgo) ?? NivelRiesgo.MEDIUM,
        tipoFallo,
      );

      if (tecnico) {
        await order.update({
          idTecnico: tecnico.idTecnico,
          proximoReintentoAsignacion: null,
        });
        await this.alertaModel.update(
          { idTecnico: tecnico.idTecnico },
          { where: { idOrden: order.idOrden } },
        );
        await this.eventoModel.create({
          idOrden: order.idOrden,
          etapa: 'respuesta_tecnico',
          descripcion: `Reintento: asignado a ${tecnicoNombre(tecnico)}`,
          actor: 'sistema',
          fechaEvento: now,
        });

        const payload: OrderCreatedPayload = {
          orderId: order.codigo,
          tecnicoId: tecnico.idTecnico,
          maquinaId: order.maquina?.codigo ?? String(order.idMaquina),
          nivelRiesgo:
            (order.analisis?.nivelRiesgo as NivelRiesgo) ?? NivelRiesgo.MEDIUM,
        };
        this.eventEmitter.emit(ORDER_CREATED_EVENT, payload);

        this.logger.log(`Orden ${order.codigo} asignada`);
        continue;
      }

      const minutos = await this.techniciansService.getReintentoMinutos(
        (order.analisis?.nivelRiesgo as NivelRiesgo) ?? NivelRiesgo.MEDIUM,
      );
      const intentos = (order.intentosAsignacion ?? 0) + 1;
      await order.update({
        proximoReintentoAsignacion: addMinutes(now, minutos),
        intentosAsignacion: intentos,
      });
      await this.eventoModel.create({
        idOrden: order.idOrden,
        etapa: 'reintento_asignacion',
        descripcion: `Reintento ${intentos}: sin técnico. Próximo intento en ${minutos} min`,
        actor: 'sistema',
        fechaEvento: now,
      });
    }
  }
}
