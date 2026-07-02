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
import {
  OrderCreatedPayload,
  OrderEscalatedPayload,
} from '../common/events/order.events';
import { AnalisisFallo } from '../database/models/analisis-fallo.model';
import { ClasificacionFallo } from '../database/models/clasificacion-fallo.model';
import { LecturaSensor } from '../database/models/lectura-sensor.model';
import { Maquina } from '../database/models/maquina.model';
import { MensajeEnviado } from '../database/models/mensaje-enviado.model';
import { Orden } from '../database/models/orden.model';
import { RecomendacionRag } from '../database/models/recomendacion-rag.model';
import { ReglaNotificacion } from '../database/models/regla-notificacion.model';
import { Rol } from '../database/models/rol.model';
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
import {
  ConfigCatalogService,
  type TiemposAtencion,
} from '../config-catalog/config-catalog.service';
import { SmtpEmailService } from '../integrations/email/smtp-email.service';
import {
  buildAssignmentEmailHtml,
  buildAssignmentEmailSubject,
  buildAssignmentEmailText,
} from '../integrations/email/templates/assignment-notification.template';

const VENTANA_REPETITIVO_DIAS = 7;

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    @InjectModel(Orden) private readonly ordenModel: typeof Orden,
    @InjectModel(Tecnico) private readonly tecnicoModel: typeof Tecnico,
    @InjectModel(Usuario) private readonly usuarioModel: typeof Usuario,
    @InjectModel(MensajeEnviado) private readonly mensajeModel: typeof MensajeEnviado,
    @InjectModel(ReglaNotificacion) private readonly reglaModel: typeof ReglaNotificacion,
    @InjectModel(RecomendacionRag) private readonly recomendacionModel: typeof RecomendacionRag,
    private readonly webhookNotifier: WebhookNotifierService,
    private readonly smtpEmail: SmtpEmailService,
    private readonly configCatalog: ConfigCatalogService,
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
        {
          model: Tecnico,
          attributes: ['idTecnico'],
          include: [{ model: Usuario, attributes: ['nombres', 'apellidos'] }],
        },
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

  /** Interpreta el texto del destinatario configurado en la regla de notificación. */
  private recipientsFromRecibe(recibe?: string): {
    tecnico: boolean;
    supervisor: boolean;
  } {
    const r = (recibe ?? '').toLowerCase();
    return {
      tecnico: r.includes('técnico') || r.includes('tecnico'),
      supervisor: r.includes('supervisor') || r.includes('jefe'),
    };
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
    const regla = await this.reglaModel.findOne({ where: { nivel } });

    // Destinatario configurable (Configuración → Alertas → Reglas de notificación).
    const recipients = this.recipientsFromRecibe(regla?.recibe);
    if (!recipients.tecnico && !recipients.supervisor) {
      this.logger.debug(`Nivel ${nivel}: destinatario "Nadie" — notificación omitida`);
      return;
    }

    const canalRegla = regla?.canal?.toLowerCase() ?? '';
    const allowWhatsapp = canalRegla.includes('whatsapp') || canalRegla.includes('whats');
    const allowEmail = canalRegla.includes('email');
    if (!allowWhatsapp && !allowEmail) {
      this.logger.debug(`Nivel ${nivel}: canal "Sin notificación" — omitido`);
      return;
    }

    // ---- Contexto compartido (sirve para técnico y supervisor) ----
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
      lider?.idTipoFallo,
      orden.idOrden,
    );
    const historial = await this.loadInterventionHistory(
      orden.idMaquina,
      lider?.idTipoFallo,
      orden.idOrden,
    );
    const tiempos = await this.configCatalog.getTiemposAtencion();
    const tiempoLimiteInicioMin = tiempos[nivel as keyof TiemposAtencion] ?? null;

    // Config de fallos repetitivos (Configuración → Fallos Repetitivos).
    // Cada umbral corresponde a una fila del panel de notificaciones.
    const repCfg = await this.configCatalog.getFallosRepetitivosConfig();
    const alcanzaMarcar = ocurrenciasVentana >= repCfg.umbrales.marcar.veces;
    const alcanzaNotificar = ocurrenciasVentana >= repCfg.umbrales.notificar.veces;
    const alcanzaRag = ocurrenciasVentana >= repCfg.umbrales.rag.veces;
    const esRepetitivo = alcanzaMarcar;
    // Toggle "marcar repetitivo": si está apagado, no se muestra el aviso de reincidencia.
    const umbralRepetitivo = repCfg.notificaciones.mark
      ? repCfg.umbrales.marcar.veces
      : Number.MAX_SAFE_INTEGER;
    // Toggle "notificar supervisor": al alcanzar su umbral, también avisa al supervisor.
    if (alcanzaNotificar && repCfg.notificaciones.supervisor) {
      recipients.supervisor = true;
    }

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
      tiempoLimiteInicioMin,
      umbralRepetitivo,
    });

    // Acción escalada (Config → Fallos repetitivos): solo si la falla es repetitiva y el toggle RAG está activo.
    messageInput.accionEscaladaConfig = null;
    if (esRepetitivo && alcanzaRag && repCfg.notificaciones.rag) {
      messageInput.accionEscaladaConfig =
        await this.configCatalog.getEscalationActionText(tipoFalloCodigo);
    }
    if (!esRepetitivo || !repCfg.notificaciones.rag) {
      messageInput.planEscalado = null;
      if (!esRepetitivo) messageInput.accionEscaladaConfig = null;
    }

    if (recipients.tecnico) {
      await this.dispatchToTechnician(
        orden,
        tecnico,
        nivel,
        messageInput,
        allowWhatsapp,
        allowEmail,
        maquinaCodigo,
        tipoFalloCodigo,
        esRepetitivo,
      );
    }
    if (recipients.supervisor) {
      await this.notifySupervisorsForAlert(
        orden,
        messageInput,
        maquinaCodigo,
        tipoFalloCodigo,
        allowWhatsapp,
        allowEmail,
        esRepetitivo,
      );
    }
  }

  private async dispatchToTechnician(
    orden: Orden,
    tecnico: Tecnico,
    nivel: NivelRiesgo,
    messageInput: ReturnType<typeof buildAlertMessageInput>,
    allowWhatsapp: boolean,
    allowEmail: boolean,
    maquinaCodigo: string,
    tipoFalloCodigo: string,
    esRepetitivo: boolean,
  ): Promise<void> {
    const smtpReady = this.smtpEmail.isConfigured();
    const sendWhatsapp = tecnico.enviarWssp !== false && allowWhatsapp;
    const sendEmailSmtp =
      smtpReady && allowEmail && Boolean(tecnico.usuario?.correo?.trim());
    const sendEmailWebhook =
      !smtpReady &&
      allowEmail &&
      (tecnico.enviarCorreo === true || nivel === NivelRiesgo.CRITICAL);

    if (!sendWhatsapp && !sendEmailSmtp && !sendEmailWebhook) {
      this.logger.debug(`Sin canales activos para técnico ${tecnico.idTecnico} nivel ${nivel}`);
      return;
    }

    const email = tecnico.usuario?.correo?.trim();
    const phone = tecnico.usuario?.telefono?.trim();
    if (!email) {
      this.logger.warn(`Técnico ${tecnico.idTecnico} sin correo en usuario`);
      return;
    }

    const whatsappSummary = buildWhatsappSummary(messageInput);
    const assignmentEmailInput = {
      ...messageInput,
      tecnicoNombre: tecnicoNombre(tecnico),
    };
    const emailBody = sendEmailSmtp
      ? buildAssignmentEmailHtml(assignmentEmailInput)
      : buildEmailHtml(messageInput);
    const emailText = sendEmailSmtp
      ? buildAssignmentEmailText(assignmentEmailInput)
      : undefined;
    const subject = sendEmailSmtp
      ? buildAssignmentEmailSubject(assignmentEmailInput)
      : buildEmailSubject(messageInput);

    const needsPhone = Boolean(sendWhatsapp && phone);
    const needsEmail = Boolean(sendEmailSmtp || sendEmailWebhook);
    if (sendWhatsapp && !phone) {
      this.logger.warn(`Técnico ${tecnico.idTecnico} sin teléfono — WhatsApp omitido`);
    }
    if (!needsPhone && !needsEmail) return;

    try {
      if (sendEmailSmtp) {
        this.logger.log(
          `Enviando asignación ORD ${orden.codigo} a ${email} (${tecnicoNombre(tecnico)})`,
        );
        await this.smtpEmail.send({ to: email, subject, html: emailBody, text: emailText });
      }
      if (needsPhone || sendEmailWebhook) {
        await this.webhookNotifier.send({
          email,
          subject,
          title: `Alerta de mantenimiento — ${maquinaCodigo}`,
          phone: needsPhone ? phone : undefined,
          whatsappSummary: needsPhone ? whatsappSummary : undefined,
          emailBody: sendEmailWebhook ? emailBody : undefined,
        });
      }
      await this.mensajeModel.create({
        tecnicoId: tecnico.idTecnico,
        idOrden: orden.idOrden,
        maquinas: maquinaCodigo,
        motivo: tipoFalloCodigo,
        canal: this.resolveCanal(needsPhone, needsEmail),
        tipoEnvio: esRepetitivo ? TipoEnvio.REPETITIVO : TipoEnvio.ALERTA_CRITICA,
        estado: EstadoMensaje.ENTREGADO,
        enviadoEn: new Date(),
      });
    } catch (err) {
      await this.mensajeModel.create({
        tecnicoId: tecnico.idTecnico,
        idOrden: orden.idOrden,
        maquinas: maquinaCodigo,
        motivo: tipoFalloCodigo,
        canal: this.resolveCanal(needsPhone, needsEmail),
        tipoEnvio: TipoEnvio.ALERTA_CRITICA,
        estado: EstadoMensaje.FALLIDO,
        enviadoEn: new Date(),
      });
      throw err;
    }
  }

  private async notifySupervisorsForAlert(
    orden: Orden,
    messageInput: ReturnType<typeof buildAlertMessageInput>,
    maquinaCodigo: string,
    tipoFalloCodigo: string,
    allowWhatsapp: boolean,
    allowEmail: boolean,
    esRepetitivo: boolean,
  ): Promise<void> {
    const supervisores = await this.usuarioModel.findAll({
      where: { estado: 'activo' },
      include: [
        {
          model: Rol,
          required: true,
          where: { nombre: { [Op.in]: ['supervisor', 'jefe_planta'] } },
        },
      ],
    });
    if (!supervisores.length) {
      this.logger.warn(`Orden ${orden.codigo}: sin supervisores activos para notificar`);
      return;
    }

    const smtpReady = this.smtpEmail.isConfigured();
    const whatsappSummary = buildWhatsappSummary(messageInput);
    const emailBody = buildEmailHtml(messageInput);
    const subject = buildEmailSubject(messageInput);

    for (const sup of supervisores) {
      const email = sup.correo?.trim();
      const phone = sup.telefono?.trim();
      const sendW = allowWhatsapp && Boolean(phone);
      const sendE = allowEmail && Boolean(email);
      if (!sendW && !sendE) continue;
      try {
        if (sendE && smtpReady && email) {
          await this.smtpEmail.send({ to: email, subject, html: emailBody });
        }
        if (sendW || (sendE && !smtpReady)) {
          await this.webhookNotifier.send({
            email: email ?? '',
            subject,
            title: `Alerta de mantenimiento — ${maquinaCodigo}`,
            phone: sendW ? phone : undefined,
            whatsappSummary: sendW ? whatsappSummary : undefined,
            emailBody: sendE && !smtpReady ? emailBody : undefined,
          });
        }
        await this.mensajeModel.create({
          tecnicoId: null,
          idOrden: orden.idOrden,
          maquinas: maquinaCodigo,
          motivo: tipoFalloCodigo,
          canal: this.resolveCanal(sendW, sendE),
          tipoEnvio: esRepetitivo ? TipoEnvio.REPETITIVO : TipoEnvio.ALERTA_CRITICA,
          estado: EstadoMensaje.ENTREGADO,
          enviadoEn: new Date(),
        });
      } catch (err) {
        this.logger.error(
          `Notificación supervisor (${email ?? phone}) ORD ${orden.codigo} falló: ${err instanceof Error ? err.message : err}`,
        );
      }
    }
  }

  /** Notifica a supervisores/jefe de planta cuando una orden supera su SLA (escalamiento). */
  async notifyEscalation(payload: OrderEscalatedPayload): Promise<void> {
    const orden = await this.loadOrderContext(payload.orderId);
    const lider = orden.analisis?.clasificaciones?.find((c) => c.esLider);
    const tipoFalloCodigo = lider?.tipoFallo?.codigo ?? '—';
    const tipoFalloNombre = lider?.tipoFallo?.nombre ?? 'Fallo no clasificado';
    const maquinaCodigo = orden.maquina?.codigo ?? payload.maquinaId;

    const supervisores = await this.usuarioModel.findAll({
      where: { estado: 'activo' },
      include: [
        {
          model: Rol,
          required: true,
          where: { nombre: { [Op.in]: ['supervisor', 'jefe_planta'] } },
        },
      ],
    });
    if (!supervisores.length) {
      this.logger.warn(`Escalamiento ${payload.orderId}: sin supervisores activos`);
      return;
    }

    // Técnico que tenía la orden y no la inició a tiempo.
    const tecnico = orden.idTecnico
      ? await this.tecnicoModel.findByPk(orden.idTecnico, { include: [{ model: Usuario }] })
      : null;
    const tecnicoNom = tecnico ? tecnicoNombre(tecnico) : 'Sin técnico asignado';
    const tecnicoTel = tecnico?.usuario?.telefono?.trim();

    const fmtFecha = (d?: Date | null) =>
      d
        ? new Date(d).toLocaleString('es-PE', {
            day: '2-digit',
            month: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
          })
        : '—';
    const detectada = fmtFecha(orden.fechaCreacion);

    const frontendUrl =
      this.config.get<string>('notifications.frontendUrl') ?? 'http://localhost:3000';
    const enlace = `${frontendUrl}/dashboard/orders/${orden.codigo}`;
    const titulo = `🛑 ESCALAMIENTO — ${maquinaCodigo} (${payload.nivelRiesgo})`;

    const resumen = [
      `🛑 *ESCALAMIENTO* — ${maquinaCodigo} (${payload.nivelRiesgo})`,
      `*Motivo:* el técnico asignado no inició la orden dentro del tiempo límite.`,
      '',
      `*Orden:* ${orden.codigo}`,
      `*Fallo:* ${tipoFalloCodigo} — ${tipoFalloNombre}`,
      `*Nivel de riesgo:* ${payload.nivelRiesgo}`,
      `*Técnico asignado:* ${tecnicoNom} — ❌ no inició la orden`,
      ...(tecnicoTel ? [`*Tel. técnico:* ${tecnicoTel}`] : []),
      `*Detectada:* ${detectada}`,
      `*Sin atención:* ${payload.minutosSinAtender} min · límite ${payload.slaMinutos} min`,
      '',
      `*Acción requerida:* reasignar o intervenir esta orden cuanto antes.`,
      `Ver: ${enlace}`,
    ].join('\n');

    const html =
      `<div style="font-family:Arial,sans-serif;color:#1e293b;max-width:560px">` +
      `<h2 style="color:#dc2626;margin:0 0 8px">🛑 ESCALAMIENTO — ${maquinaCodigo} (${payload.nivelRiesgo})</h2>` +
      `<p style="font-weight:600;color:#b91c1c">Motivo: el técnico asignado no inició la orden dentro del tiempo límite.</p>` +
      `<table style="border-collapse:collapse;font-size:14px">` +
      `<tr><td style="padding:4px 12px 4px 0;color:#64748b">Orden</td><td><b>${orden.codigo}</b></td></tr>` +
      `<tr><td style="padding:4px 12px 4px 0;color:#64748b">Máquina</td><td>${maquinaCodigo}</td></tr>` +
      `<tr><td style="padding:4px 12px 4px 0;color:#64748b">Fallo</td><td>${tipoFalloCodigo} — ${tipoFalloNombre}</td></tr>` +
      `<tr><td style="padding:4px 12px 4px 0;color:#64748b">Nivel de riesgo</td><td>${payload.nivelRiesgo}</td></tr>` +
      `<tr><td style="padding:4px 12px 4px 0;color:#64748b">Técnico asignado</td><td><b>${tecnicoNom}</b> — <span style="color:#dc2626">no inició la orden</span></td></tr>` +
      (tecnicoTel ? `<tr><td style="padding:4px 12px 4px 0;color:#64748b">Tel. técnico</td><td>${tecnicoTel}</td></tr>` : '') +
      `<tr><td style="padding:4px 12px 4px 0;color:#64748b">Detectada</td><td>${detectada}</td></tr>` +
      `<tr><td style="padding:4px 12px 4px 0;color:#64748b">Tiempo sin atención</td><td><b>${payload.minutosSinAtender} min</b> (límite ${payload.slaMinutos} min)</td></tr>` +
      `</table>` +
      `<p style="margin-top:12px">Acción requerida: <b>reasignar o intervenir</b> esta orden cuanto antes.</p>` +
      `<p><a href="${enlace}" style="color:#2563eb">Abrir orden en el panel</a></p>` +
      `</div>`;

    for (const sup of supervisores) {
      const email = sup.correo?.trim();
      const phone = sup.telefono?.trim();
      if (!email && !phone) continue;
      try {
        await this.webhookNotifier.send({
          email: email ?? '',
          subject: `Escalamiento ORD ${orden.codigo}`,
          title: titulo,
          phone: phone || undefined,
          whatsappSummary: phone ? resumen : undefined,
          emailBody: email ? html : undefined,
        });
        await this.mensajeModel.create({
          tecnicoId: null,
          idOrden: orden.idOrden,
          maquinas: maquinaCodigo,
          motivo: `ESCALAMIENTO ${tipoFalloCodigo}`,
          canal: this.resolveCanal(Boolean(phone), Boolean(email)),
          tipoEnvio: TipoEnvio.ALERTA_CRITICA,
          estado: EstadoMensaje.ENTREGADO,
          enviadoEn: new Date(),
        });
      } catch (err) {
        this.logger.error(
          `Escalamiento ${orden.codigo} a ${email ?? phone} falló: ${err instanceof Error ? err.message : err}`,
        );
      }
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
    idTipoFallo: number | undefined,
    excludeOrdenId: number,
  ): Promise<number> {
    if (idTipoFallo == null) return 1;

    const from = new Date(Date.now() - VENTANA_REPETITIVO_DIAS * 24 * 60 * 60 * 1000);
    const ordenes = await this.ordenModel.findAll({
      where: {
        idMaquina,
        fechaCreacion: { [Op.gte]: from },
        idOrden: { [Op.ne]: excludeOrdenId },
      },
      attributes: ['idOrden'],
      include: [
        {
          model: AnalisisFallo,
          required: true,
          attributes: ['idAnalisis'],
          include: [
            {
              model: ClasificacionFallo,
              where: { esLider: true, idTipoFallo },
              required: true,
              attributes: ['idClasificacion'],
            },
          ],
        },
      ],
    });

    return ordenes.length + 1;
  }

  private async loadInterventionHistory(
    idMaquina: number,
    idTipoFallo: number | undefined,
    excludeOrdenId: number,
  ) {
    if (idTipoFallo == null) return [];

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
          attributes: ['idAnalisis'],
          include: [
            {
              model: ClasificacionFallo,
              where: { esLider: true, idTipoFallo },
              required: true,
              attributes: ['idClasificacion'],
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
