import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Cron } from '@nestjs/schedule';
import { InjectModel } from '@nestjs/sequelize';
import { Op } from 'sequelize';
import { EstadoOrden, NivelRiesgo } from '../common/enums';
import {
  ORDER_ESCALATED_EVENT,
  OrderEscalatedPayload,
} from '../common/events/order.events';
import { AnalisisFallo } from '../database/models/analisis-fallo.model';
import { EventoOrden } from '../database/models/evento-orden.model';
import { Maquina } from '../database/models/maquina.model';
import { Orden } from '../database/models/orden.model';
import {
  ConfigCatalogService,
  type TiemposAtencion,
} from '../config-catalog/config-catalog.service';

const ESCALADO_ETAPA = 'escalado';

@Injectable()
export class EscalationService {
  private readonly logger = new Logger(EscalationService.name);

  constructor(
    @InjectModel(Orden) private readonly ordenModel: typeof Orden,
    @InjectModel(EventoOrden) private readonly eventoModel: typeof EventoOrden,
    private readonly configCatalog: ConfigCatalogService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /** Cada minuto: escala al supervisor las órdenes asignadas que superaron su SLA sin atención. */
  @Cron('30 * * * * *')
  async escalateOverdueOrders(): Promise<void> {
    const tiempos = await this.configCatalog.getTiemposAtencion();
    const now = Date.now();

    // Órdenes asignadas pero aún no iniciadas (el técnico "no respondió").
    const pendientes = await this.ordenModel.findAll({
      where: {
        estado: EstadoOrden.PENDIENTE,
        idTecnico: { [Op.ne]: null },
      },
      include: [
        { model: Maquina, attributes: ['codigo'] },
        { model: AnalisisFallo, attributes: ['nivelRiesgo'] },
      ],
    });

    for (const orden of pendientes) {
      const nivel = (orden.analisis?.nivelRiesgo as NivelRiesgo) ?? NivelRiesgo.MEDIUM;
      const sla = tiempos[nivel as keyof TiemposAtencion];
      if (sla == null) continue; // nivel sin SLA (p. ej. LOW)

      const minutosSinAtender = Math.floor(
        (now - new Date(orden.fechaCreacion).getTime()) / 60_000,
      );
      if (minutosSinAtender < sla) continue;

      // Idempotencia: no escalar dos veces la misma orden.
      const yaEscalada = await this.eventoModel.count({
        where: { idOrden: orden.idOrden, etapa: ESCALADO_ETAPA },
      });
      if (yaEscalada > 0) continue;

      await this.eventoModel.create({
        idOrden: orden.idOrden,
        etapa: ESCALADO_ETAPA,
        descripcion: `SLA ${nivel} superado: ${minutosSinAtender} min sin atención (límite ${sla} min). Escalado a supervisor.`,
        actor: 'sistema',
        fechaEvento: new Date(),
      });

      const payload: OrderEscalatedPayload = {
        orderId: orden.codigo,
        maquinaId: orden.maquina?.codigo ?? String(orden.idMaquina),
        nivelRiesgo: nivel,
        minutosSinAtender,
        slaMinutos: sla,
      };
      this.eventEmitter.emit(ORDER_ESCALATED_EVENT, payload);
      this.logger.log(
        `Orden ${orden.codigo} escalada (${minutosSinAtender}/${sla} min, ${nivel})`,
      );
    }
  }
}
