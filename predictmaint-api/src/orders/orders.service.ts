import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Op } from 'sequelize';
import { DecisionPrediccion, EstadoOrden, EstadoAlerta, RolUsuario } from '../common/enums';
import { paginate, PaginationQueryDto } from '../common/dto/pagination.dto';
import { generateOrderCodigo } from '../common/utils/id-generator.util';
import { findMaquinaByCodigo } from '../common/utils/maquina.util';
import { modeloSlug } from '../common/utils/modelo-ml.util';
import { latestRagEstado } from '../common/utils/rag-estado.util';
import { tecnicoIniciales, tecnicoNombre } from '../common/utils/tecnico-display.util';
import { Alerta } from '../database/models/alerta.model';
import { AnalisisFallo } from '../database/models/analisis-fallo.model';
import { ClasificacionFallo } from '../database/models/clasificacion-fallo.model';
import { EventoOrden } from '../database/models/evento-orden.model';
import { LecturaSensor } from '../database/models/lectura-sensor.model';
import { Maquina } from '../database/models/maquina.model';
import { ModeloMl } from '../database/models/modelo-ml.model';
import { Orden } from '../database/models/orden.model';
import { PrediccionFallo } from '../database/models/prediccion-fallo.model';
import { RespuestaRecomendacion } from '../database/models/respuesta-recomendacion.model';
import { SolucionAplicada } from '../database/models/solucion-aplicada.model';
import { ObservacionTecnica } from '../database/models/observacion-tecnica.model';
import { Tecnico } from '../database/models/tecnico.model';
import { TipoFallo } from '../database/models/tipo-fallo.model';
import { Usuario } from '../database/models/usuario.model';
import { MachinesService } from '../machines/machines.service';
import { TechniciansService } from '../technicians/technicians.service';
import {
  ConfigCatalogService,
  type TiemposAtencion,
} from '../config-catalog/config-catalog.service';
import {
  CreateOrderDto,
  EscalateOrderDto,
  ReassignOrderDto,
  RegisterSolutionDto,
  RejectPredictionDto,
  UpdateOrderStatusDto,
} from './dto/order.dto';
import {
  ORDER_CREATED_EVENT,
  OrderCreatedPayload,
} from '../common/events/order.events';
import type { AuthUserPayload } from '../auth/auth.service';

const VALID_TRANSITIONS: Record<EstadoOrden, EstadoOrden[]> = {
  [EstadoOrden.PENDIENTE]: [EstadoOrden.EN_PROGRESO, EstadoOrden.RECHAZADA],
  [EstadoOrden.EN_PROGRESO]: [EstadoOrden.FINALIZADO],
  [EstadoOrden.FINALIZADO]: [],
  [EstadoOrden.RECHAZADA]: [],
};

const ORDER_INCLUDES_BASE = [
  { model: Maquina },
  { model: Tecnico, include: [{ model: Usuario }] },
  {
    model: AnalisisFallo,
    include: [
      { model: LecturaSensor, include: [{ model: Maquina }] },
      { model: PrediccionFallo, include: [{ model: ModeloMl }] },
      {
        model: ClasificacionFallo,
        include: [{ model: TipoFallo }, { model: ModeloMl }],
      },
    ],
  },
  { model: SolucionAplicada },
  { model: ObservacionTecnica },
  { model: RespuestaRecomendacion },
];

function buildOrderIncludes(tipoFallo?: string) {
  const tipoFalloInclude = tipoFallo
    ? { model: TipoFallo, where: { codigo: tipoFallo }, required: true as const }
    : { model: TipoFallo };

  return [
    { model: Maquina },
    { model: Tecnico, include: [{ model: Usuario }] },
    {
      model: AnalisisFallo,
      required: Boolean(tipoFallo),
      include: [
        { model: LecturaSensor, include: [{ model: Maquina }] },
        {
          model: ClasificacionFallo,
          where: { esLider: true },
          required: Boolean(tipoFallo),
          include: [tipoFalloInclude, { model: ModeloMl }],
        },
      ],
    },
    { model: SolucionAplicada },
    { model: ObservacionTecnica },
  ];
}

@Injectable()
export class OrdersService {
  constructor(
    @InjectModel(Orden) private readonly ordenModel: typeof Orden,
    @InjectModel(EventoOrden) private readonly eventoModel: typeof EventoOrden,
    @InjectModel(Maquina) private readonly maquinaModel: typeof Maquina,
    @InjectModel(LecturaSensor) private readonly lecturaModel: typeof LecturaSensor,
    @InjectModel(AnalisisFallo) private readonly analisisModel: typeof AnalisisFallo,
    @InjectModel(Alerta) private readonly alertaModel: typeof Alerta,
    private readonly machinesService: MachinesService,
    private readonly techniciansService: TechniciansService,
    private readonly configCatalog: ConfigCatalogService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  private async getSlaMinutos(nivel?: string): Promise<number | null> {
    const tiempos = await this.configCatalog.getTiemposAtencion();
    const sla = tiempos[(nivel ?? 'MEDIUM') as keyof TiemposAtencion];
    return typeof sla === 'number' && sla > 0 ? sla : null;
  }

  private isElevatedRole(user?: AuthUserPayload): boolean {
    return (
      user?.rol === RolUsuario.SUPERVISOR || user?.rol === RolUsuario.JEFE_PLANTA
    );
  }

  private isTechnicianRole(user?: AuthUserPayload): boolean {
    return (
      user?.rol === RolUsuario.TECNICO || user?.rol === RolUsuario.TECNICO_SENIOR
    );
  }

  private assertCanAccessOrder(order: Orden, user?: AuthUserPayload): void {
    if (!user || this.isElevatedRole(user)) return;
    if (this.isTechnicianRole(user)) {
      if (!user.tecnicoId || order.idTecnico !== user.tecnicoId) {
        throw new ForbiddenException('No tienes acceso a esta orden');
      }
    }
  }

  private applyRoleScope(
    where: Record<string, unknown>,
    user?: AuthUserPayload,
  ): void {
    if (user && this.isTechnicianRole(user) && user.tecnicoId) {
      where.idTecnico = user.tecnicoId;
    }
  }

  private async syncAlertEstadoForOrder(idOrden: number, estado: EstadoAlerta) {
    await this.alertaModel.update(
      { estado },
      {
        where: {
          idOrden,
          estado: { [Op.ne]: EstadoAlerta.FINALIZADO },
        },
      },
    );
  }

  toResponse(o: Orden) {
    const analisis = o.analisis;
    const liderS2 = analisis?.clasificaciones?.find((c) => c.esLider);
    const liderS1 = analisis?.predicciones?.find((p) => p.esLider);
    const ultimaSolucion = o.soluciones?.[o.soluciones.length - 1];
    const ultimaObservacion = [...(o.observacionesTecnica ?? [])].sort(
      (a, b) => new Date(b.fechaRegistro).getTime() - new Date(a.fechaRegistro).getTime(),
    )[0];
    const confianzaLider =
      liderS1?.probabilidad != null
        ? Number(liderS1.probabilidad) / 100
        : analisis?.ensembleAvg != null
          ? Number(analisis.ensembleAvg)
          : null;

    return {
      id: o.codigo,
      maquinaId: o.maquina?.codigo ?? String(o.idMaquina),
      lecturaId: analisis?.idLectura != null ? Number(analisis.idLectura) : null,
      tipoFallo: liderS2?.tipoFallo?.codigo ?? null,
      modeloPrediccion: liderS1?.modeloMl
        ? modeloSlug(liderS1.modeloMl, 'xgboost')
        : null,
      confianzaPrediccion:
        liderS1?.probabilidad != null ? Number(liderS1.probabilidad) : null,
      algoritmoClasificador: liderS2?.modeloMl
        ? modeloSlug(liderS2.modeloMl, liderS2.modeloMl.nombre)
        : null,
      modeloClasificacion: liderS2?.modeloMl
        ? modeloSlug(liderS2.modeloMl, liderS2.modeloMl.nombre)
        : null,
      confianza: liderS2?.confianza != null ? Number(liderS2.confianza) : null,
      confianzaLider,
      ensembleAvg: confianzaLider,
      nivelRiesgo: analisis?.nivelRiesgo ?? 'MEDIUM',
      tecnicoId: o.idTecnico ?? null,
      estado: o.estado,
      solucionDescripcion: ultimaSolucion?.descripcion ?? null,
      solucionTipo: ultimaSolucion?.tipoSolucion ?? null,
      observacionesOrden: o.observaciones ?? null,
      reasignadoMotivo: o.reasignadoMotivo ?? null,
      reasignadoEn: o.reasignadoEn ? o.reasignadoEn.toISOString() : null,
      observacionTecnica: ultimaObservacion
        ? {
            comentario: ultimaObservacion.comentario ?? null,
            esFalla: ultimaObservacion.esFalla ?? null,
            esPrediccionCorrecta: ultimaObservacion.esPrediccionCorrecta ?? null,
            esClasificacionCorrecta: ultimaObservacion.esClasificacionCorrecta ?? null,
            decision: ultimaObservacion.decision ?? null,
            fechaRegistro: ultimaObservacion.fechaRegistro,
          }
        : null,
      detectadoEn: o.fechaCreacion,
      iniciadoEn: o.fechaInicio ?? null,
      finalizadoEn: o.fechaFin ?? null,
      proximoReintentoAsignacion: o.proximoReintentoAsignacion?.toISOString() ?? null,
      intentosAsignacion: o.intentosAsignacion ?? 0,
      ragEstado: latestRagEstado(o.respuestasRag),
      ...(o.maquina && { maquina: this.machinesService.toResponse(o.maquina) }),
      ...(o.tecnico && {
        tecnico: {
          id: o.tecnico.idTecnico,
          nombre: tecnicoNombre(o.tecnico),
          iniciales: tecnicoIniciales(o.tecnico),
        },
      }),
      ...(analisis?.lectura && {
        lectura: this.machinesService.readingToResponse(analisis.lectura),
      }),
    };
  }

  private async findOrderByCodigo(codigo: string): Promise<Orden> {
    const o = await this.ordenModel.findOne({
      where: { codigo },
      include: ORDER_INCLUDES_BASE,
    });
    if (!o) throw new NotFoundException('Orden no encontrada');
    return o;
  }

  private buildWhere(
    query: PaginationQueryDto & {
      estado?: string;
      maquinaId?: string;
      tecnicoId?: number;
      from?: string;
      to?: string;
      search?: string;
      conTecnico?: boolean | string;
    },
  ) {
    const where: Record<string, unknown> = {};
    if (query.estado) where.estado = query.estado;
    if (query.tecnicoId) where.idTecnico = query.tecnicoId;
    if (query.conTecnico === true || query.conTecnico === 'true') {
      where.idTecnico = { [Op.ne]: null };
    }
    if (query.search) where.codigo = { [Op.iLike]: `%${query.search}%` };
    if (query.from || query.to) {
      where.fechaCreacion = {
        ...(query.from && { [Op.gte]: new Date(query.from) }),
        ...(query.to && { [Op.lte]: new Date(query.to) }),
      };
    }
    return where;
  }

  private async resolveMaquinaFilter(
    where: Record<string, unknown>,
    maquinaId?: string,
  ): Promise<void> {
    if (!maquinaId) return;
    const m = await findMaquinaByCodigo(maquinaId);
    if (m) where.idMaquina = m.idMaquina;
  }

  private async countOrders(
    where: Record<string, unknown>,
    includes: ReturnType<typeof buildOrderIncludes>,
  ): Promise<number> {
    return this.ordenModel.count({
      where,
      include: includes,
      distinct: true,
      col: 'id_orden',
    });
  }

  async findAll(
    query: PaginationQueryDto & {
      estado?: string;
      maquinaId?: string;
      tipoFallo?: string;
      tecnicoId?: number;
      algoritmo?: string;
      from?: string;
      to?: string;
      search?: string;
      conTecnico?: boolean | string;
    },
    user?: AuthUserPayload,
  ) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const where = this.buildWhere(query);
    this.applyRoleScope(where, user);
    await this.resolveMaquinaFilter(where, query.maquinaId);

    const includes = buildOrderIncludes(query.tipoFallo);

    const { rows, count } = await this.ordenModel.findAndCountAll({
      where,
      include: includes,
      distinct: true,
      col: 'id_orden',
      offset: (page - 1) * limit,
      limit,
      order: [['fechaCreacion', 'DESC']],
    });

    let items = rows.map((o) => this.toResponse(o));
    if (query.algoritmo) {
      items = items.filter((i) => i.algoritmoClasificador === query.algoritmo);
    }

    const baseWhere = { ...where };
    delete baseWhere.estado;

    const [pendiente, enProgreso, finalizado, rechazada] = await Promise.all([
      this.countOrders({ ...baseWhere, estado: EstadoOrden.PENDIENTE }, includes),
      this.countOrders({ ...baseWhere, estado: EstadoOrden.EN_PROGRESO }, includes),
      this.countOrders({ ...baseWhere, estado: EstadoOrden.FINALIZADO }, includes),
      this.countOrders({ ...baseWhere, estado: EstadoOrden.RECHAZADA }, includes),
    ]);

    return {
      ...paginate(items, count, page, limit),
      summary: { pendiente, enProgreso, finalizado, rechazada },
    };
  }

  async findOne(codigo: string, user?: AuthUserPayload) {
    const o = await this.findOrderByCodigo(codigo);
    this.assertCanAccessOrder(o, user);
    return this.toResponse(o);
  }

  async getTechnicianBoard(user: AuthUserPayload) {
    if (!this.isTechnicianRole(user) || !user.tecnicoId) {
      throw new ForbiddenException('Solo técnicos pueden acceder al tablero');
    }
    const [pendientesRows, completadasRows] = await Promise.all([
      this.ordenModel.findAll({
        where: {
          idTecnico: user.tecnicoId,
          estado: { [Op.in]: [EstadoOrden.PENDIENTE, EstadoOrden.EN_PROGRESO] },
        },
        include: ORDER_INCLUDES_BASE,
        order: [['fechaCreacion', 'DESC']],
      }),
      this.ordenModel.findAll({
        where: {
          idTecnico: user.tecnicoId,
          estado: EstadoOrden.FINALIZADO,
        },
        include: ORDER_INCLUDES_BASE,
        order: [['fechaFin', 'DESC']],
        limit: 30,
      }),
    ]);
    return {
      pendientes: pendientesRows.map((o) => this.toResponse(o)),
      completadas: completadasRows.map((o) => this.toResponse(o)),
    };
  }

  async startOrder(codigo: string, user?: AuthUserPayload) {
    const o = await this.findOrderByCodigo(codigo);
    this.assertCanAccessOrder(o, user);
    if (o.estado !== EstadoOrden.PENDIENTE) {
      throw new ConflictException('La orden ya fue iniciada o finalizada');
    }
    if (!o.idTecnico) {
      throw new BadRequestException('La orden no tiene técnico asignado');
    }
    return this.updateStatus(codigo, { estado: EstadoOrden.EN_PROGRESO }, user, 'tecnico');
  }

  /**
   * El técnico rechaza la predicción automática: registra la justificación como
   * observación técnica (esPrediccionCorrecta = false), cierra la orden en estado
   * 'rechazada' y libera al técnico. Alimenta el historial de aciertos del modelo.
   */
  async rejectPrediction(
    codigo: string,
    dto: RejectPredictionDto,
    user?: AuthUserPayload,
  ) {
    const o = await this.findOrderByCodigo(codigo);
    this.assertCanAccessOrder(o, user);
    if (o.estado !== EstadoOrden.PENDIENTE) {
      throw new ConflictException(
        'Solo se puede rechazar la predicción de una orden pendiente',
      );
    }
    const justificacion = dto.justificacion?.trim();
    if (!justificacion) {
      throw new BadRequestException('La justificación es obligatoria');
    }

    const liderS2 = o.analisis?.clasificaciones?.find((c) => c.esLider);
    const idTipoFallo = liderS2?.idTipoFallo ?? liderS2?.tipoFallo?.idTipoFallo;

    await ObservacionTecnica.create({
      idOrden: o.idOrden,
      idTipoFallo,
      esFalla: false,
      esPrediccionCorrecta: false,
      esClasificacionCorrecta: false,
      decision: DecisionPrediccion.RECHAZADA,
      comentario: justificacion,
      fechaRegistro: new Date(),
    });

    await o.update({
      estado: EstadoOrden.RECHAZADA,
      fechaFin: new Date(),
      observaciones: justificacion,
    });
    await this.syncAlertEstadoForOrder(o.idOrden, EstadoAlerta.FINALIZADO);
    await this.eventoModel.create({
      idOrden: o.idOrden,
      etapa: 'rechazo_prediccion',
      descripcion: `Predicción rechazada: ${justificacion}`,
      actor: 'tecnico',
      fechaEvento: new Date(),
    });
    if (o.idTecnico) {
      await this.techniciansService.releaseIfIdle(o.idTecnico);
    }
    return this.findOne(codigo, user);
  }

  async getTimeline(codigo: string, user?: AuthUserPayload) {
    const o = await this.findOrderByCodigo(codigo);
    this.assertCanAccessOrder(o, user);
    const eventos = await this.eventoModel.findAll({
      where: { idOrden: o.idOrden },
      order: [['fechaEvento', 'ASC']],
    });
    return eventos.map((e) => ({
      id: Number(e.idEvento),
      ordenId: o.codigo,
      etapa: e.etapa,
      descripcion: e.descripcion ?? null,
      actor: e.actor ?? null,
      ocurridoEn: e.fechaEvento,
    }));
  }

  async create(dto: CreateOrderDto) {
    const maquina = await findMaquinaByCodigo(dto.maquinaId);
    if (!maquina) throw new NotFoundException('Máquina no encontrada');

    const lectura = await this.lecturaModel.findOne({
      where: { idMaquina: maquina.idMaquina },
      order: [['fechaLectura', 'DESC']],
    });
    if (!lectura) {
      throw new BadRequestException('La máquina no tiene lecturas registradas');
    }

    const analisis = await this.analisisModel.create({
      idMaquina: maquina.idMaquina,
      idLectura: lectura.idLectura,
      nivelRiesgo: 'MEDIUM',
      fechaAnalisis: new Date(),
    });

    const codigo = await generateOrderCodigo();
    await this.ordenModel.create({
      codigo,
      idAnalisis: analisis.idAnalisis,
      idMaquina: maquina.idMaquina,
      estado: EstadoOrden.PENDIENTE,
      fechaCreacion: new Date(),
    });
    return this.findOne(codigo);
  }

  async updateStatus(
    codigo: string,
    dto: UpdateOrderStatusDto,
    user?: AuthUserPayload,
    actor = 'usuario',
  ) {
    const o = await this.findOrderByCodigo(codigo);
    this.assertCanAccessOrder(o, user);
    const allowed = VALID_TRANSITIONS[o.estado as EstadoOrden];
    if (!allowed.includes(dto.estado)) {
      throw new ConflictException(
        `Transición inválida: ${o.estado} → ${dto.estado}`,
      );
    }
    await o.update({
      estado: dto.estado,
      ...(dto.estado === EstadoOrden.EN_PROGRESO && !o.fechaInicio && { fechaInicio: new Date() }),
      ...(dto.estado === EstadoOrden.FINALIZADO && { fechaFin: new Date() }),
    });
    if (dto.estado === EstadoOrden.EN_PROGRESO) {
      await this.syncAlertEstadoForOrder(o.idOrden, EstadoAlerta.EN_PROGRESO);
    }
    if (dto.estado === EstadoOrden.FINALIZADO) {
      await this.syncAlertEstadoForOrder(o.idOrden, EstadoAlerta.FINALIZADO);
    }
    await this.eventoModel.create({
      idOrden: o.idOrden,
      etapa: dto.estado === EstadoOrden.EN_PROGRESO ? 'en_progreso' : 'finalizado',
      descripcion: `Estado → ${dto.estado}`,
      actor,
      fechaEvento: new Date(),
    });
    if (dto.estado === EstadoOrden.FINALIZADO && o.idTecnico) {
      await this.techniciansService.releaseIfIdle(o.idTecnico);
    }
    return this.findOne(codigo, user);
  }

  async registerSolution(codigo: string, dto: RegisterSolutionDto, user?: AuthUserPayload) {
    const o = await this.findOrderByCodigo(codigo);
    this.assertCanAccessOrder(o, user);
    if (o.estado === EstadoOrden.FINALIZADO) {
      throw new ConflictException('La orden ya está finalizada');
    }
    if (
      this.isTechnicianRole(user) &&
      o.estado === EstadoOrden.PENDIENTE
    ) {
      throw new BadRequestException(
        'Debe iniciar la orden antes de registrar la solución',
      );
    }

    const liderS2 = o.analisis?.clasificaciones?.find((c) => c.esLider);
    const idTipoFallo = liderS2?.idTipoFallo ?? liderS2?.tipoFallo?.idTipoFallo;

    await SolucionAplicada.create({
      idOrden: o.idOrden,
      tipoSolucion: dto.solucionTipo,
      descripcion: dto.descripcion,
      fechaRegistro: new Date(),
    });

    await ObservacionTecnica.create({
      idOrden: o.idOrden,
      idTipoFallo,
      esFalla: dto.esFalla ?? Boolean(liderS2?.tipoFallo),
      esPrediccionCorrecta: dto.esPrediccionCorrecta ?? true,
      esClasificacionCorrecta: dto.esClasificacionCorrecta ?? true,
      decision: DecisionPrediccion.ACEPTADA,
      comentario: dto.comentario?.trim() || dto.descripcion,
      fechaRegistro: new Date(),
    });

    await o.update({
      estado: EstadoOrden.FINALIZADO,
      fechaFin: new Date(),
      ...(!o.fechaInicio && { fechaInicio: new Date() }),
      ...(dto.comentario?.trim()
        ? { observaciones: dto.comentario.trim() }
        : { observaciones: dto.descripcion }),
    });
    await this.syncAlertEstadoForOrder(o.idOrden, EstadoAlerta.FINALIZADO);
    await this.eventoModel.create({
      idOrden: o.idOrden,
      etapa: 'finalizado',
      descripcion: dto.descripcion,
      actor: 'tecnico',
      fechaEvento: new Date(),
    });
    if (o.idTecnico) {
      await this.techniciansService.releaseIfIdle(o.idTecnico);
    }
    return this.findOne(codigo, user);
  }

  async escalate(codigo: string, dto: EscalateOrderDto, user?: AuthUserPayload) {
    const o = await this.findOrderByCodigo(codigo);
    this.assertCanAccessOrder(o, user);
    await this.eventoModel.create({
      idOrden: o.idOrden,
      etapa: 'escalado',
      descripcion: dto.motivo,
      actor: 'sistema',
      fechaEvento: new Date(),
    });
    return this.findOne(codigo, user);
  }

  /** Reasignación de una orden a otro técnico por parte del supervisor/jefe. */
  async reassignOrder(codigo: string, dto: ReassignOrderDto, user?: AuthUserPayload) {
    const o = await this.findOrderByCodigo(codigo);
    if (!this.isElevatedRole(user)) {
      throw new ForbiddenException('Solo un supervisor o jefe de planta puede reasignar');
    }
    if (o.estado === EstadoOrden.FINALIZADO || o.estado === EstadoOrden.RECHAZADA) {
      throw new ConflictException('La orden ya está cerrada; no se puede reasignar');
    }
    if (o.estado !== EstadoOrden.PENDIENTE || o.fechaInicio) {
      throw new ConflictException(
        'Solo se puede reasignar una orden pendiente que aún no ha sido iniciada',
      );
    }
    const sla = await this.getSlaMinutos(o.analisis?.nivelRiesgo);
    if (sla == null) {
      throw new ConflictException(
        'Esta orden no tiene tiempo límite de inicio configurado para su nivel de riesgo',
      );
    }
    const minutosSinAtender = Math.floor(
      (Date.now() - new Date(o.fechaCreacion).getTime()) / 60_000,
    );
    if (minutosSinAtender < sla) {
      throw new ConflictException(
        `Aún no vence el tiempo límite para reasignar (faltan ${sla - minutosSinAtender} min)`,
      );
    }
    const motivo = dto.motivo?.trim();
    if (!motivo) throw new BadRequestException('El motivo de la reasignación es obligatorio');

    const nuevo = await this.techniciansService.assignToOrder(dto.tecnicoId);
    if (!nuevo) throw new NotFoundException('Técnico destino no encontrado');
    if (o.idTecnico === nuevo.idTecnico) {
      throw new ConflictException('La orden ya está asignada a ese técnico');
    }

    const prevTecnicoId = o.idTecnico;
    const now = new Date();
    await o.update({
      idTecnico: nuevo.idTecnico,
      estado: EstadoOrden.PENDIENTE,
      fechaInicio: undefined,
      proximoReintentoAsignacion: undefined,
      reasignadoMotivo: motivo,
      reasignadoEn: now,
    });
    await this.alertaModel.update(
      { idTecnico: nuevo.idTecnico, estado: EstadoAlerta.PENDIENTE },
      { where: { idOrden: o.idOrden, estado: { [Op.ne]: EstadoAlerta.FINALIZADO } } },
    );
    await this.eventoModel.create({
      idOrden: o.idOrden,
      etapa: 'reasignacion',
      descripcion: `Reasignado a ${tecnicoNombre(nuevo)}: ${motivo}`,
      actor: 'supervisor',
      fechaEvento: now,
    });
    if (prevTecnicoId && prevTecnicoId !== nuevo.idTecnico) {
      await this.techniciansService.releaseIfIdle(prevTecnicoId);
    }

    // Notifica al nuevo técnico (reusa el flujo de asignación).
    const payload: OrderCreatedPayload = {
      orderId: o.codigo,
      tecnicoId: nuevo.idTecnico,
      maquinaId: o.maquina?.codigo ?? String(o.idMaquina),
      nivelRiesgo: o.analisis?.nivelRiesgo ?? 'MEDIUM',
    };
    this.eventEmitter.emit(ORDER_CREATED_EVENT, payload);

    return this.findOne(codigo, user);
  }
}
