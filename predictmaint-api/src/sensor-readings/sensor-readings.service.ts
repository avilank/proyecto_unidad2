import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectModel } from '@nestjs/sequelize';
import { Op } from 'sequelize';
import {
  EstadoAlerta,
  EstadoOrden,
  NivelRiesgo,
  PrediccionBinaria as PredBinEnum,
} from '../common/enums';
import { ORDER_CREATED_EVENT, OrderCreatedPayload } from '../common/events/order.events';
import {
  MONITORING_ALERT_EVENT,
  MONITORING_READING_EVENT,
} from '../common/events/monitoring.events';
import { paginate, PaginationQueryDto } from '../common/dto/pagination.dto';
import { addMinutes } from '../common/utils/shift.util';
import { generateAlertCodigo, generateOrderCodigo } from '../common/utils/id-generator.util';
import { calculatePowerW } from '../common/utils/power.util';
import { evaluateSensorRules } from '../common/utils/sensor-rules.util';
import { findMaquinaByCodigo } from '../common/utils/maquina.util';
import { resolveTipoFalloByMinAgreement } from '../common/utils/classify-fault.util';
import { resolveModeloId } from '../common/utils/modelo-ml.util';
import { tecnicoNombre } from '../common/utils/tecnico-display.util';
import {
  COOLDOWN_EVALUACION_MINUTOS_DEFAULT,
  UMBRAL_ENSEMBLE_FALLA_DEFAULT,
} from '../config/constants.config';
import { Alerta } from '../database/models/alerta.model';
import { AnalisisFallo } from '../database/models/analisis-fallo.model';
import { ClasificacionFallo } from '../database/models/clasificacion-fallo.model';
import { ConfiguracionAlertas } from '../database/models/configuracion-alertas.model';
import { EventoOrden } from '../database/models/evento-orden.model';
import { FuenteRag } from '../database/models/fuente-rag.model';
import { LecturaSensor } from '../database/models/lectura-sensor.model';
import { Maquina } from '../database/models/maquina.model';
import { Orden } from '../database/models/orden.model';
import { PrediccionFallo } from '../database/models/prediccion-fallo.model';
import { RecomendacionRag } from '../database/models/recomendacion-rag.model';
import { TipoFallo } from '../database/models/tipo-fallo.model';
import { MlGatewayService, MlPredictFeatures, MlRagSource } from '../ml-gateway/ml-gateway.service';
import { MlModelsService } from '../ml-models/ml-models.service';
import {
  s1PredictionPatch,
  s2PredictionPatch,
} from '../ml-models/ml-metrics-sync';
import { AlertsService } from '../alerts/alerts.service';
import { MachinesService } from '../machines/machines.service';
import { OrdersService } from '../orders/orders.service';
import { TechniciansService } from '../technicians/technicians.service';
import { CreateSensorReadingDto } from './dto/create-sensor-reading.dto';

@Injectable()
export class SensorReadingsService {
  constructor(
    @InjectModel(LecturaSensor) private readonly lecturaModel: typeof LecturaSensor,
    @InjectModel(Maquina) private readonly maquinaModel: typeof Maquina,
    @InjectModel(AnalisisFallo) private readonly analisisModel: typeof AnalisisFallo,
    @InjectModel(Alerta) private readonly alertaModel: typeof Alerta,
    @InjectModel(Orden) private readonly ordenModel: typeof Orden,
    @InjectModel(EventoOrden) private readonly eventoModel: typeof EventoOrden,
    @InjectModel(PrediccionFallo) private readonly prediccionModel: typeof PrediccionFallo,
    @InjectModel(ClasificacionFallo) private readonly clasificacionModel: typeof ClasificacionFallo,
    @InjectModel(RecomendacionRag) private readonly recomendacionModel: typeof RecomendacionRag,
    @InjectModel(FuenteRag) private readonly fuenteRagModel: typeof FuenteRag,
    @InjectModel(TipoFallo) private readonly tipoFalloModel: typeof TipoFallo,
    @InjectModel(ConfiguracionAlertas) private readonly configAlertasModel: typeof ConfiguracionAlertas,
    private readonly mlGateway: MlGatewayService,
    private readonly mlModelsService: MlModelsService,
    private readonly machinesService: MachinesService,
    private readonly alertsService: AlertsService,
    private readonly ordersService: OrdersService,
    private readonly techniciansService: TechniciansService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async findAll(
    query: PaginationQueryDto & {
      machineId?: string;
      from?: string;
      to?: string;
    },
  ) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const where: Record<string, unknown> = {};

    if (query.machineId) {
      const maquina = await findMaquinaByCodigo(query.machineId);
      if (maquina) where.idMaquina = maquina.idMaquina;
    }
    if (query.from || query.to) {
      where.fechaLectura = {
        ...(query.from && { [Op.gte]: new Date(query.from) }),
        ...(query.to && { [Op.lte]: new Date(query.to) }),
      };
    }

    const { rows, count } = await this.lecturaModel.findAndCountAll({
      where,
      include: [{ model: Maquina }],
      offset: (page - 1) * limit,
      limit,
      order: [['fechaLectura', 'DESC']],
    });

    return paginate(
      rows.map((r) => this.machinesService.readingToResponse(r)),
      count,
      page,
      limit,
    );
  }

  async findOne(id: number) {
    const r = await this.lecturaModel.findByPk(id, { include: [{ model: Maquina }] });
    if (!r) throw new NotFoundException('Lectura no encontrada');
    return this.machinesService.readingToResponse(r);
  }

  private async getUmbralFalla(): Promise<number> {
    const cfg = await this.configAlertasModel.findOne();
    if (!cfg) return UMBRAL_ENSEMBLE_FALLA_DEFAULT;
    const dedicated = Number(cfg.umbralEnsembleFalla);
    if (!Number.isNaN(dedicated) && dedicated > 0) return dedicated;
    return Number(cfg.riesgoMedio) || UMBRAL_ENSEMBLE_FALLA_DEFAULT;
  }

  private async getAgreementMinimo(): Promise<string> {
    const cfg = await this.configAlertasModel.findOne();
    return cfg?.agreementMinimoS3 ?? 'MEDIO';
  }

  private getCooldownMinutos(): number {
    const raw = process.env.EVALUACION_COOLDOWN_MINUTOS;
    if (raw) {
      const parsed = parseInt(raw, 10);
      if (!Number.isNaN(parsed) && parsed >= 0) return parsed;
    }
    return COOLDOWN_EVALUACION_MINUTOS_DEFAULT;
  }

  private async shouldSkipPipeline(idMaquina: number): Promise<{
    skip: boolean;
    reason?: 'pipeline_activo' | 'cooldown';
    order?: Orden;
    cooldownMinutosRestantes?: number;
  }> {
    const pipelineActivo = await this.ordenModel.findOne({
      where: {
        idMaquina,
        estado: { [Op.ne]: EstadoOrden.FINALIZADO },
      },
      order: [['fechaCreacion', 'DESC']],
    });
    if (pipelineActivo) {
      return { skip: true, reason: 'pipeline_activo', order: pipelineActivo };
    }

    const cooldownMin = this.getCooldownMinutos();
    if (cooldownMin <= 0) return { skip: false };

    const ultimoAnalisis = await this.analisisModel.findOne({
      where: { idMaquina },
      order: [['fechaAnalisis', 'DESC']],
    });
    if (!ultimoAnalisis) return { skip: false };

    const elapsedMs = Date.now() - ultimoAnalisis.fechaAnalisis.getTime();
    const cooldownMs = cooldownMin * 60 * 1000;
    if (elapsedMs >= cooldownMs) return { skip: false };

    const orden = await this.ordenModel.findOne({
      where: { idAnalisis: ultimoAnalisis.idAnalisis },
    });
    return {
      skip: true,
      reason: 'cooldown',
      order: orden ?? undefined,
      cooldownMinutosRestantes: Math.ceil((cooldownMs - elapsedMs) / 60000),
    };
  }

  private async persistRagPlan(
    clasificacionId: number,
    tipoFallo: string,
    maquinaCodigo: string,
  ): Promise<void> {
    const fuentes = await this.getActiveRagSources();
    const ragResult = await this.mlGateway.rag({
      tipoFallo,
      maquinaId: maquinaCodigo,
      historial: [],
      fuentes,
    });

    for (const acc of ragResult.acciones) {
      let fuenteId: number | undefined;
      if (ragResult.fuentes[acc.orden - 1]) {
        const titulo = ragResult.fuentes[acc.orden - 1];
        let fuente = await this.fuenteRagModel.findOne({ where: { titulo } });
        if (!fuente) {
          fuente = await this.fuenteRagModel.create({ titulo, activo: true });
        }
        fuenteId = fuente.idFuente;
      }

      await this.recomendacionModel.create({
        idClasificacion: clasificacionId,
        idFuente: fuenteId,
        orden: acc.orden,
        titulo: acc.titulo,
        prioridad: acc.prioridad,
        recomendacion: acc.detalle,
      });
    }
  }

  private async getActiveRagSources(): Promise<MlRagSource[]> {
    const rows = await this.fuenteRagModel.findAll({
      where: { activo: true },
      order: [['idFuente', 'ASC']],
    });

    return rows.map((f) => ({
      id: f.idFuente,
      titulo: f.titulo,
      autor: f.autor ?? null,
      url: f.url ?? null,
      descripcion: f.autor ?? null,
    }));
  }

  private async scheduleAssignmentRetry(
    order: Orden,
    alert: Alerta,
    nivelRiesgo: NivelRiesgo,
    now: Date,
  ): Promise<void> {
    const minutos = await this.techniciansService.getReintentoMinutos(nivelRiesgo);
    await order.update({
      proximoReintentoAsignacion: addMinutes(now, minutos),
      intentosAsignacion: 1,
    });
    await this.eventoModel.create({
      idOrden: order.idOrden,
      etapa: 'asignacion_pendiente',
      descripcion: `Sin técnico disponible. Reintento en ${minutos} min`,
      actor: 'sistema',
      fechaEvento: now,
    });
    await alert.update({ estado: EstadoAlerta.PENDIENTE });
  }

  private emitMonitoringReading(
    maquinaId: string,
    reading: unknown,
    extra?: { skipped?: string; cooldownMinutosRestantes?: number },
  ): void {
    this.eventEmitter.emit(MONITORING_READING_EVENT, {
      maquinaId,
      reading,
      ...extra,
    });
  }

  private emitMonitoringAlert(maquinaId: string, alert?: unknown, order?: unknown): void {
    this.eventEmitter.emit(MONITORING_ALERT_EVENT, { maquinaId, alert, order });
  }

  async create(dto: CreateSensorReadingDto) {
    const maquina = await findMaquinaByCodigo(dto.maquinaId);
    if (!maquina) throw new NotFoundException('Máquina no encontrada');

    const powerW = calculatePowerW(dto.torque, dto.rotationalSpeed);
    const reading = await this.lecturaModel.create({
      idMaquina: maquina.idMaquina,
      tipoMaquina: dto.tipo,
      airTemperature: dto.airTemperature,
      processTemperature: dto.processTemperature,
      rotationalSpeed: dto.rotationalSpeed,
      torque: dto.torque,
      toolWear: dto.toolWear,
      powerW,
      fechaLectura: dto.capturadoEn ? new Date(dto.capturadoEn) : new Date(),
    });
    reading.maquina = maquina;

    const readingResp = this.machinesService.readingToResponse(reading);
    const triggered = evaluateSensorRules({
      airTemperature: dto.airTemperature,
      processTemperature: dto.processTemperature,
      rotationalSpeed: dto.rotationalSpeed,
      torque: dto.torque,
      toolWear: dto.toolWear,
    });

    if (!triggered) {
      this.emitMonitoringReading(dto.maquinaId, readingResp);
      return { reading: readingResp };
    }

    const gate = await this.shouldSkipPipeline(maquina.idMaquina);
    if (gate.skip) {
      this.emitMonitoringReading(dto.maquinaId, readingResp, {
        skipped: gate.reason,
        cooldownMinutosRestantes: gate.cooldownMinutosRestantes,
      });
      return {
        reading: readingResp,
        skipped: gate.reason,
        cooldownMinutosRestantes: gate.cooldownMinutosRestantes,
        order: gate.order
          ? await this.ordersService.findOne(gate.order.codigo)
          : undefined,
      };
    }

    const alertCodigo = await generateAlertCodigo();
    const orderCodigo = await generateOrderCodigo();
    const now = new Date();

    const analisis = await this.analisisModel.create({
      idMaquina: maquina.idMaquina,
      idLectura: reading.idLectura,
      reglaDisparada: triggered.reglaCodigo,
      fechaAnalisis: now,
    });

    const order = await this.ordenModel.create({
      codigo: orderCodigo,
      idAnalisis: analisis.idAnalisis,
      idMaquina: maquina.idMaquina,
      estado: EstadoOrden.PENDIENTE,
      fechaCreacion: now,
      intentosAsignacion: 0,
    });

    const alert = await this.alertaModel.create({
      codigo: alertCodigo,
      idAnalisis: analisis.idAnalisis,
      idMaquina: maquina.idMaquina,
      idOrden: order.idOrden,
      nivelRiesgo: NivelRiesgo.MEDIUM,
      reglaDisparada: triggered.reglaCodigo,
      estado: EstadoAlerta.ANALIZANDO,
      fechaAlerta: now,
    });

    await this.eventoModel.create({
      idOrden: order.idOrden,
      etapa: 'deteccion_s1',
      descripcion: `Regla ${triggered.reglaCodigo} activada`,
      actor: 'sistema',
      fechaEvento: now,
    });

    const features: MlPredictFeatures = {
      type: dto.tipo,
      airTemperature: dto.airTemperature,
      processTemperature: dto.processTemperature,
      rotationalSpeed: dto.rotationalSpeed,
      torque: dto.torque,
      toolWear: dto.toolWear,
    };

    const predictResult = await this.mlGateway.predict(features);
    const nivelRiesgo = (predictResult.nivelRiesgo as NivelRiesgo) ?? NivelRiesgo.MEDIUM;
    const scoreLider = predictResult.confianzaLider ?? predictResult.ensembleAvg;
    const liderS1 = predictResult.modelos.find((m) => m.esLider);

    for (const m of predictResult.modelos) {
      const idModelo = await resolveModeloId(m.modelo, 'S1');
      await this.mlModelsService.applyRuntimeS1Metrics(idModelo, m);
      await this.prediccionModel.create({
        idAnalisis: analisis.idAnalisis,
        idModelo,
        prediccion: m.prediccion as PredBinEnum,
        probabilidad: m.probabilidad,
        confianza: m.probabilidad,
        esLider: m.esLider ?? false,
        ...s1PredictionPatch(m),
      });
    }

    await analisis.update({
      ensembleAvg: scoreLider,
      nivelRiesgo,
      prediccion: liderS1?.prediccion,
    });
    await alert.update({ nivelRiesgo, estado: EstadoAlerta.ANALIZANDO });

    const umbral = await this.getUmbralFalla();
    const s1Falla = scoreLider >= umbral;

    let tipoFalloFinal = triggered.tipoFallo;
    let tecnico = null;

    if (!s1Falla) {
      await analisis.update({ prediccion: PredBinEnum.SIN_FALLA });
      await alert.update({ estado: EstadoAlerta.FINALIZADO });
      await order.update({ estado: EstadoOrden.FINALIZADO, fechaFin: now });
      await this.eventoModel.create({
        idOrden: order.idOrden,
        etapa: 'finalizado',
        descripcion: 'S-1 sin confirmación de falla — regla descartada por ML',
        actor: 'sistema',
        fechaEvento: now,
      });
    } else {
      await alert.update({ estado: EstadoAlerta.CLASIFICANDO });

      const classifyResult = await this.mlGateway.classify(features);
      const agreementMinimo = await this.getAgreementMinimo();
      const votes = classifyResult.modelos.map((m) => m.tipoPredicho);
      const resolved = resolveTipoFalloByMinAgreement(votes, agreementMinimo);
      tipoFalloFinal = resolved.tipo ?? triggered.tipoFallo ?? classifyResult.tipoPredicho;

      for (const m of classifyResult.modelos) {
        const idModelo = await resolveModeloId(m.modelo, 'S2');
        await this.mlModelsService.applyRuntimeS2Metrics(idModelo, m);
        const tipoModelo = await this.tipoFalloModel.findOne({
          where: { codigo: m.tipoPredicho },
        });
        if (!tipoModelo) continue;
        await this.clasificacionModel.create({
          idAnalisis: analisis.idAnalisis,
          idTipoFallo: tipoModelo.idTipoFallo,
          idModelo,
          confianza: m.confianza ?? classifyResult.confianza,
          probHdf: m.probHdf,
          probPwf: m.probPwf,
          probTwf: m.probTwf,
          probOsf: m.probOsf,
          probRnf: m.probRnf,
          esLider: m.esLider ?? false,
          diverge: m.diverge ?? false,
          fechaClasificacion: new Date(),
          ...s2PredictionPatch(m),
        });
      }

      await analisis.update({
        agreement: resolved.agreement,
        prediccion: 'FALLA',
      });

      const liderClas = await this.clasificacionModel.findOne({
        where: { idAnalisis: analisis.idAnalisis, esLider: true },
      });
      if (liderClas) {
        await this.persistRagPlan(liderClas.idClasificacion, tipoFalloFinal, dto.maquinaId);
      }

      await this.eventoModel.create({
        idOrden: order.idOrden,
        etapa: 'clasificacion_s2',
        descripcion: `Clasificación S-2: ${tipoFalloFinal} (agreement ${resolved.agreement}, ${resolved.winnerVotes}/3)`,
        actor: 'sistema',
        fechaEvento: new Date(),
      });

      await this.eventoModel.create({
        idOrden: order.idOrden,
        etapa: 'rag_s3',
        descripcion: 'Recomendaciones RAG generadas',
        actor: 'sistema',
        fechaEvento: new Date(),
      });

      await alert.update({ estado: EstadoAlerta.PENDIENTE });

      tecnico = await this.techniciansService.assignForOrder(nivelRiesgo, tipoFalloFinal);

      if (tecnico) {
        await order.update({ idTecnico: tecnico.idTecnico });
        await alert.update({ idTecnico: tecnico.idTecnico });
        await this.eventoModel.create({
          idOrden: order.idOrden,
          etapa: 'respuesta_tecnico',
          descripcion: `Asignado a ${tecnicoNombre(tecnico)}`,
          actor: 'sistema',
          fechaEvento: new Date(),
        });
      } else {
        await this.scheduleAssignmentRetry(order, alert, nivelRiesgo, new Date());
      }
    }

    if (s1Falla) {
      const payload: OrderCreatedPayload = {
        orderId: orderCodigo,
        tecnicoId: tecnico?.idTecnico,
        maquinaId: dto.maquinaId,
        nivelRiesgo,
      };
      this.eventEmitter.emit(ORDER_CREATED_EVENT, payload);
    }

    const alertResp = await this.alertsService.findOne(alertCodigo);
    const orderResp = await this.ordersService.findOne(orderCodigo);

    this.emitMonitoringReading(dto.maquinaId, readingResp);
    this.emitMonitoringAlert(dto.maquinaId, alertResp, orderResp);

    return {
      reading: readingResp,
      alert: alertResp,
      order: orderResp,
    };
  }
}
