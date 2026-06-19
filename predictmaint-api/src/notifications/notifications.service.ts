import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/sequelize';
import { Op } from 'sequelize';
import { PaginationQueryDto, paginate } from '../common/dto/pagination.dto';
import {
  Canal,
  EstadoMensaje,
  EstadoOrden,
  NivelRiesgo,
  TipoEnvio,
} from '../common/enums';
import { OrderCreatedPayload } from '../common/events/order.events';
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
import { tecnicoNombre } from '../common/utils/tecnico-display.util';
import {
  buildAlertMessageInput,
  buildEmailHtml,
  buildEmailSubject,
  buildWhatsappSummary,
  solucionFromOrder,
} from './alert-message.builder';
import { SendNotificationDto } from './dto/notification.dto';
import { WebhookNotifierService } from './webhook-notifier.service';

const VENTANA_REPETITIVO_DIAS = 7;

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    @InjectModel(Orden) private readonly ordenModel: typeof Orden,
    @InjectModel(Tecnico) private readonly tecnicoModel: typeof Tecnico,
    @InjectModel(MensajeEnviado) private readonly mensajeModel: typeof MensajeEnviado,
    @InjectModel(ReglaNotificacion) private readonly reglaModel: typeof ReglaNotificacion,
    @InjectModel(RecomendacionRag) private readonly recomendacionModel: typeof RecomendacionRag,
    private readonly webhookNotifier: WebhookNotifierService,
    private readonly config: ConfigService,
  ) {}

  async findAll() {
    const rows = await this.reglaModel.findAll({ order: [['nivel', 'ASC']] });
    return rows.map((r) => ({
      nivel: r.nivel,
      recibe: r.recibe,
      canal: r.canal,
    }));
  }

  async getSchedule() {
    return [];
  }

  async getLog(query: PaginationQueryDto & { tecnicoId?: number }) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const where: Record<string, unknown> = {};
    if (query.tecnicoId) where.tecnicoId = query.tecnicoId;

    const { rows, count } = await this.mensajeModel.findAndCountAll({
      where,
      include: [
        { model: Orden, attributes: ['codigo'] },
        { model: Tecnico, attributes: ['idTecnico', 'nombres', 'apellidos'] },
      ],
      offset: (page - 1) * limit,
      limit,
      order: [['enviadoEn', 'DESC']],
    });

    return paginate(
      rows.map((m) => ({
        id: Number(m.id),
        tecnicoId: m.tecnicoId ?? null,
        tecnico: m.tecnico ? tecnicoNombre(m.tecnico) : null,
        ordenId: m.orden?.codigo ?? null,
        maquinas: m.maquinas ?? null,
        motivo: m.motivo ?? null,
        canal: m.canal,
        tipoEnvio: m.tipoEnvio ?? null,
        estado: m.estado,
        enviadoEn: m.enviadoEn,
      })),
      count,
      page,
      limit,
    );
  }

  async send(dto: SendNotificationDto) {
    if (!dto.orderId || !dto.tecnicoId) {
      return { ok: false, error: 'orderId y tecnicoId son requeridos' };
    }

    const orden = await this.ordenModel.findOne({
      where: { codigo: dto.orderId },
      include: [
        { model: Maquina },
        {
          model: AnalisisFallo,
          include: [{ model: LecturaSensor }],
        },
      ],
    });
    if (!orden?.analisis) throw new NotFoundException('Orden no encontrada');

    await this.notifyTechnicianAssignment({
      orderId: dto.orderId,
      tecnicoId: dto.tecnicoId,
      maquinaId: orden.maquina?.codigo ?? String(orden.idMaquina),
      nivelRiesgo: orden.analisis.nivelRiesgo ?? NivelRiesgo.MEDIUM,
    });

    return { ok: true };
  }

  async getNextDispatch() {
    return null;
  }

  async notifyTechnicianAssignment(payload: OrderCreatedPayload): Promise<void> {
    const orden = await this.loadOrderContext(payload.orderId);
    const tecnico = await this.tecnicoModel.findByPk(payload.tecnicoId, {
      include: [{ model: Usuario }],
    });

    if (!tecnico?.usuario) {
      this.logger.warn(`Técnico ${payload.tecnicoId} sin usuario asociado`);
      return;
    }

    const nivel = (payload.nivelRiesgo ?? orden.analisis?.nivelRiesgo ?? NivelRiesgo.MEDIUM) as NivelRiesgo;
    if (nivel === NivelRiesgo.LOW) {
      this.logger.debug(`Nivel LOW — notificación omitida para ${payload.orderId}`);
      return;
    }

    const regla = await this.reglaModel.findOne({ where: { nivel } });
    const canalRegla = regla?.canal?.toLowerCase() ?? '';
    const allowWhatsapp = canalRegla.includes('whatsapp') || canalRegla.includes('whats');
    const allowEmail = canalRegla.includes('email');

    const sendWhatsapp = tecnico.enviarWssp !== false && allowWhatsapp;
    const sendEmail =
      allowEmail && (tecnico.enviarCorreo === true || nivel === NivelRiesgo.CRITICAL);

    if (!sendWhatsapp && !sendEmail) {
      this.logger.debug(
        `Sin canales activos para técnico ${payload.tecnicoId} nivel ${nivel}`,
      );
      return;
    }

    const lider = orden.analisis?.clasificaciones?.find((c) => c.esLider);
    const tipoFalloCodigo = lider?.tipoFallo?.codigo ?? '—';
    const tipoFalloNombre = lider?.tipoFallo?.nombre ?? 'Fallo no clasificado';
    const maquinaCodigo = orden.maquina?.codigo ?? payload.maquinaId;

    const accionesRag = lider
      ? await this.recomendacionModel.findAll({
          where: { idClasificacion: lider.idClasificacion },
          order: [['orden', 'ASC']],
        })
      : [];

    const ocurrenciasVentana = await this.countOccurrencesInWindow(
      orden.idMaquina,
      tipoFalloCodigo,
      orden.idOrden,
    );
    const historial = await this.loadInterventionHistory(
      orden.idMaquina,
      tipoFalloCodigo,
      orden.idOrden,
    );

    const frontendUrl = this.config.get<string>('notifications.frontendUrl') ?? 'http://localhost:3000';
    const messageInput = buildAlertMessageInput({
      maquinaCodigo,
      ordenCodigo: orden.codigo,
      nivelRiesgo: nivel,
      tipoFalloCodigo,
      tipoFalloNombre,
      lectura: orden.analisis?.lectura,
      accionesRag,
      historial,
      ocurrenciasVentana,
      frontendUrl,
    });

    const email = tecnico.usuario.correo?.trim();
    const phone = tecnico.usuario.telefono?.trim();

    if (!email) {
      this.logger.warn(`Técnico ${payload.tecnicoId} sin correo en usuario`);
      return;
    }

    const whatsappSummary = buildWhatsappSummary(messageInput);
    const emailBody = buildEmailHtml(messageInput);
    const subject = buildEmailSubject(messageInput);

    const needsPhone = Boolean(sendWhatsapp && phone);
    const needsEmail = Boolean(sendEmail);

    if (sendWhatsapp && !phone) {
      this.logger.warn(`Técnico ${payload.tecnicoId} sin teléfono — WhatsApp omitido`);
    }

    if (!needsPhone && !needsEmail) {
      return;
    }

    try {
      await this.webhookNotifier.send({
        email,
        subject,
        title: `Alerta de mantenimiento — ${maquinaCodigo}`,
        phone: needsPhone ? phone : undefined,
        whatsappSummary: needsPhone ? whatsappSummary : undefined,
        emailBody: needsEmail ? emailBody : undefined,
      });

      const canal = this.resolveCanal(needsPhone, needsEmail);
      await this.mensajeModel.create({
        tecnicoId: tecnico.idTecnico,
        idOrden: orden.idOrden,
        maquinas: maquinaCodigo,
        motivo: `${tipoFalloCodigo} — ${nivel}`,
        canal,
        tipoEnvio: ocurrenciasVentana >= 3 ? TipoEnvio.REPETITIVO : TipoEnvio.ALERTA_CRITICA,
        estado: EstadoMensaje.ENTREGADO,
        enviadoEn: new Date(),
      });
    } catch (err) {
      await this.mensajeModel.create({
        tecnicoId: tecnico.idTecnico,
        idOrden: orden.idOrden,
        maquinas: maquinaCodigo,
        motivo: `${tipoFalloCodigo} — ${nivel}`,
        canal: this.resolveCanal(needsPhone, needsEmail),
        tipoEnvio: TipoEnvio.ALERTA_CRITICA,
        estado: EstadoMensaje.FALLIDO,
        enviadoEn: new Date(),
      });
      throw err;
    }
  }

  private resolveCanal(sendWhatsapp: boolean, sendEmail: boolean): Canal {
    if (sendWhatsapp && sendEmail) return Canal.WHATSAPP_EMAIL;
    if (sendEmail) return Canal.EMAIL;
    return Canal.WHATSAPP;
  }

  private async loadOrderContext(orderCodigo: string): Promise<Orden> {
    const orden = await this.ordenModel.findOne({
      where: { codigo: orderCodigo },
      include: [
        { model: Maquina },
        {
          model: AnalisisFallo,
          include: [
            { model: LecturaSensor },
            {
              model: ClasificacionFallo,
              include: [{ model: TipoFallo }],
            },
          ],
        },
      ],
    });
    if (!orden) throw new NotFoundException(`Orden ${orderCodigo} no encontrada`);
    return orden;
  }

  private async countOccurrencesInWindow(
    idMaquina: number,
    tipoFallo: string,
    excludeOrdenId: number,
  ): Promise<number> {
    if (tipoFallo === '—') return 1;

    const from = new Date(Date.now() - VENTANA_REPETITIVO_DIAS * 24 * 60 * 60 * 1000);
    const ordenes = await this.ordenModel.findAll({
      where: {
        idMaquina,
        fechaCreacion: { [Op.gte]: from },
        idOrden: { [Op.ne]: excludeOrdenId },
      },
      include: [
        {
          model: AnalisisFallo,
          required: true,
          include: [
            {
              model: ClasificacionFallo,
              where: { esLider: true },
              required: true,
              include: [{ model: TipoFallo, where: { codigo: tipoFallo }, required: true }],
            },
          ],
        },
      ],
    });

    return ordenes.length + 1;
  }

  private async loadInterventionHistory(
    idMaquina: number,
    tipoFallo: string,
    excludeOrdenId: number,
  ) {
    if (tipoFallo === '—') return [];

    const from = new Date(Date.now() - VENTANA_REPETITIVO_DIAS * 24 * 60 * 60 * 1000);
    const ordenes = await this.ordenModel.findAll({
      where: {
        idMaquina,
        estado: EstadoOrden.FINALIZADO,
        fechaCreacion: { [Op.gte]: from },
        idOrden: { [Op.ne]: excludeOrdenId },
      },
      include: [
        { model: SolucionAplicada },
        {
          model: AnalisisFallo,
          required: true,
          include: [
            {
              model: ClasificacionFallo,
              where: { esLider: true },
              required: true,
              include: [{ model: TipoFallo, where: { codigo: tipoFallo }, required: true }],
            },
          ],
        },
      ],
      order: [['fechaCreacion', 'DESC']],
      limit: 5,
    });

    return ordenes.map((o) => ({
      fecha: o.fechaFin ?? o.fechaCreacion,
      ordenCodigo: o.codigo,
      resolucion: solucionFromOrder(o.soluciones),
    }));
  }
}
