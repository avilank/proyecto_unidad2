import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Op } from 'sequelize';
import {
  DecisionPrediccion,
  EstadoOrden,
  NivelRiesgo,
  PrediccionBinaria,
  SolucionTipo,
} from '../common/enums';
import { Alerta } from '../database/models/alerta.model';
import { AnalisisFallo } from '../database/models/analisis-fallo.model';
import { ClasificacionFallo } from '../database/models/clasificacion-fallo.model';
import { LecturaSensor } from '../database/models/lectura-sensor.model';
import { Maquina } from '../database/models/maquina.model';
import { ModeloMl } from '../database/models/modelo-ml.model';
import { Orden } from '../database/models/orden.model';
import { ObservacionTecnica } from '../database/models/observacion-tecnica.model';
import { SolucionAplicada } from '../database/models/solucion-aplicada.model';
import { PrediccionFallo } from '../database/models/prediccion-fallo.model';
import { RespuestaRecomendacion } from '../database/models/respuesta-recomendacion.model';
import { Tecnico } from '../database/models/tecnico.model';
import { TipoFallo } from '../database/models/tipo-fallo.model';
import { Usuario } from '../database/models/usuario.model';
import { findMaquinaByCodigo } from '../common/utils/maquina.util';
import { latestRagEstado } from '../common/utils/rag-estado.util';
import { tecnicoNombre } from '../common/utils/tecnico-display.util';
import { OrdersService } from '../orders/orders.service';
import { ConfigCatalogService } from '../config-catalog/config-catalog.service';
import {
  ParsedAnalyticsFilters,
  resolveDateRange,
} from './dto/analytics-filters.dto';

function tecnicoNombreCorto(nombre: string): string {
  const parts = nombre.trim().split(/\s+/).filter(Boolean);
  if (parts.length < 2) return nombre;
  return `${parts[0][0]}. ${parts[parts.length - 1]}`;
}

function latestSolutionType(orden: Orden): string | null {
  const soluciones = orden.soluciones ?? [];
  if (!soluciones.length) return null;
  const latest = [...soluciones].sort(
    (a, b) => b.fechaRegistro.getTime() - a.fechaRegistro.getTime(),
  )[0];
  return latest.tipoSolucion ?? null;
}

@Injectable()
export class AnalyticsService {
  constructor(
    @InjectModel(Maquina) private readonly maquinaModel: typeof Maquina,
    @InjectModel(Orden) private readonly ordenModel: typeof Orden,
    @InjectModel(ObservacionTecnica)
    private readonly observacionModel: typeof ObservacionTecnica,
    @InjectModel(Alerta) private readonly alertaModel: typeof Alerta,
    @InjectModel(AnalisisFallo) private readonly analisisModel: typeof AnalisisFallo,
    @InjectModel(PrediccionFallo) private readonly prediccionModel: typeof PrediccionFallo,
    @InjectModel(LecturaSensor) private readonly lecturaSensorModel: typeof LecturaSensor,
    @InjectModel(ModeloMl) private readonly modeloMlModel: typeof ModeloMl,
    private readonly ordersService: OrdersService,
    private readonly configCatalog: ConfigCatalogService,
  ) {}

  private startOfDay(d = new Date()) {
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
  }

  private rangeStart(range: string) {
    return resolveDateRange({ range }).from;
  }

  /** Falla real = S-2 clasificó tipo + técnico asignado (intervención humana). */
  private fallaConfirmadaIncludes(tipoFallo?: string) {
    const tipoFalloInclude = tipoFallo
      ? { model: TipoFallo, where: { codigo: tipoFallo }, required: true as const }
      : { model: TipoFallo, required: false as const };

    return [
      { model: SolucionAplicada, required: false },
      { model: RespuestaRecomendacion, required: false },
      { model: ObservacionTecnica, required: false },
      {
        model: AnalisisFallo,
        required: true,
        include: [
          {
            model: ClasificacionFallo,
            where: { esLider: true },
            required: true,
            include: [tipoFalloInclude],
          },
        ],
      },
    ];
  }

  private tecnicoDecision(o: Orden): 'aceptada' | 'rechazada' | null {
    const obs = [...(o.observacionesTecnica ?? [])].sort(
      (a, b) =>
        new Date(b.fechaRegistro).getTime() - new Date(a.fechaRegistro).getTime(),
    )[0];
    if (!obs) return null;
    const rechazada =
      obs.decision === DecisionPrediccion.RECHAZADA ||
      o.estado === EstadoOrden.RECHAZADA ||
      obs.esPrediccionCorrecta === false;
    return rechazada ? 'rechazada' : 'aceptada';
  }

  private applyAnalyticsFilters(
    ordenes: Orden[],
    filters: ParsedAnalyticsFilters,
  ): Orden[] {
    return ordenes.filter((o) => {
      if (filters.tipoFallo) {
        const lider = o.analisis?.clasificaciones?.find((c) => c.esLider);
        if (lider?.tipoFallo?.codigo !== filters.tipoFallo) return false;
      }
      if (filters.respuestaRag) {
        if (latestRagEstado(o.respuestasRag) !== filters.respuestaRag) return false;
      }
      if (filters.decision) {
        if (this.tecnicoDecision(o) !== filters.decision) return false;
      }
      return true;
    });
  }

  private async findOrdenesFallaConfirmada(
    filters: ParsedAnalyticsFilters = { range: 'week' },
  ) {
    const { from, to } = resolveDateRange(filters);
    const where: Record<string, unknown> = {
      fechaCreacion: { [Op.gte]: from, [Op.lte]: to },
    };
    if (filters.tecnicoId) {
      where.idTecnico = filters.tecnicoId;
    } else {
      where.idTecnico = { [Op.ne]: null };
    }
    if (filters.estado) {
      where.estado = filters.estado;
    }

    const rows = await this.ordenModel.findAll({
      where,
      include: this.fallaConfirmadaIncludes(filters.tipoFallo),
      order: [['fechaCreacion', 'DESC']],
    });
    return this.applyAnalyticsFilters(rows, filters);
  }

  async getDashboard(filters: ParsedAnalyticsFilters = { range: 'week' }) {
    const { from, to } =
      filters.desde || filters.hasta
        ? resolveDateRange(filters)
        : { from: this.startOfDay(), to: new Date() };

    const maquinaWhere: Record<string, unknown> = {};
    if (filters.tipoMaquina) {
      maquinaWhere.tipoCalidad = filters.tipoMaquina;
    }

    const maquinasFiltradas = filters.tipoMaquina
      ? await this.maquinaModel.findAll({
          where: maquinaWhere,
          attributes: ['idMaquina'],
        })
      : [];
    const maquinaIds = maquinasFiltradas.map((m) => m.idMaquina);

    const totalMaquinas = filters.tipoMaquina
      ? maquinaIds.length
      : await this.maquinaModel.count();

    const ordenDateWhere: Record<string, unknown> = {
      fechaCreacion: { [Op.gte]: from, [Op.lte]: to },
    };
    if (filters.tipoMaquina) {
      ordenDateWhere.idMaquina =
        maquinaIds.length > 0 ? { [Op.in]: maquinaIds } : -1;
    }

    // Un "evento S-1" = pipeline iniciado en el rango (regla disparada + evaluación ML).
    const ordenesHoy = await this.ordenModel.findAll({
      where: ordenDateWhere,
      attributes: ['idMaquina', 'estado'],
      include: [
        {
          model: AnalisisFallo,
          attributes: ['nivelRiesgo', 'prediccion'],
          required: true,
        },
      ],
    });

    const pipelinesHoy = ordenesHoy.length;
    const maquinasEvaluadasHoy = new Set(ordenesHoy.map((o) => o.idMaquina)).size;

    const fallosPorTipoHoy: Record<string, number> = {
      HDF: 0,
      PWF: 0,
      TWF: 0,
      OSF: 0,
      RNF: 0,
    };
    let criticosHoy = 0;
    let moderadosHoy = 0;

    const ordenesConFalla = await this.ordenModel.findAll({
      where: ordenDateWhere,
      include: [
        {
          model: AnalisisFallo,
          where: { prediccion: PrediccionBinaria.FALLA },
          required: true,
          include: [
            {
              model: ClasificacionFallo,
              where: { esLider: true },
              required: true,
              include: [{ model: TipoFallo, required: true }],
            },
          ],
        },
      ],
    });

    for (const o of ordenesConFalla) {
      const analisis = o.analisis!;
      const lider = analisis.clasificaciones?.[0];
      const codigo = lider?.tipoFallo?.codigo;
      if (!codigo || !(codigo in fallosPorTipoHoy)) continue;

      fallosPorTipoHoy[codigo] += 1;
      if (analisis.nivelRiesgo === NivelRiesgo.CRITICAL) {
        criticosHoy += 1;
      } else if (
        analisis.nivelRiesgo === NivelRiesgo.HIGH ||
        analisis.nivelRiesgo === NivelRiesgo.MEDIUM
      ) {
        moderadosHoy += 1;
      }
    }

    const fallasDetectadasHoy = Object.values(fallosPorTipoHoy).reduce(
      (sum, n) => sum + n,
      0,
    );
    const sinIncidenciaHoy = Math.max(0, pipelinesHoy - fallasDetectadasHoy);

    const alertaWhere: Record<string, unknown> = {
      estado: { [Op.notIn]: ['finalizado'] },
    };
    if (filters.tipoMaquina) {
      alertaWhere.idMaquina =
        maquinaIds.length > 0 ? { [Op.in]: maquinaIds } : -1;
    }

    const alertasActivas = await this.alertaModel.findAll({
      where: alertaWhere,
      attributes: ['nivelRiesgo', 'idMaquina'],
    });
    const alertasCriticas = alertasActivas.filter((a) => a.nivelRiesgo === 'CRITICAL').length;
    const alertasModeradas = alertasActivas.filter((a) =>
      ['HIGH', 'MEDIUM'].includes(a.nivelRiesgo),
    ).length;
    const maquinasConAlerta = new Set(alertasActivas.map((a) => a.idMaquina)).size;
    const sinIncidencia = Math.max(0, totalMaquinas - maquinasConAlerta);

    const preds = await this.prediccionModel.findAll({
      limit: 100,
      include: [{ model: ModeloMl }],
    });
    const precisionFromPreds =
      preds.length > 0
        ? preds.reduce((s, p) => s + Number(p.modeloMl?.accuracy ?? 0), 0) / preds.length
        : 0;

    const defaultS1 = await this.modeloMlModel.findOne({
      where: { esPrediccion: true, esDefault: true },
    });
    const modeloActivoS1 = defaultS1?.nombre ?? 'XGBoost';
    const precisionModelo =
      defaultS1?.accuracy != null
        ? Number(defaultS1.accuracy)
        : Math.round(precisionFromPreds * 10) / 10;

    const tasaFalloGlobal =
      totalMaquinas > 0
        ? Math.round((fallasDetectadasHoy / totalMaquinas) * 1000) / 10
        : 0;

    return {
      totalMaquinas,
      fallosHoy: pipelinesHoy,
      analisisHoy: pipelinesHoy,
      pipelinesHoy,
      maquinasEvaluadasHoy,
      fallasDetectadasHoy,
      criticosHoy,
      moderadosHoy,
      sinIncidenciaHoy,
      alertasActivas: alertasActivas.length,
      alertasCriticas,
      alertasModeradas,
      sinIncidencia,
      fallosPorTipoHoy,
      tasaDeteccion:
        totalMaquinas > 0 ? Math.round((maquinasEvaluadasHoy / totalMaquinas) * 100) / 100 : 0,
      tasaFalloGlobal,
      precisionModelo: Math.round(precisionModelo * 10) / 10,
      modeloActivoS1,
    };
  }

  async getSummary(filters: ParsedAnalyticsFilters = { range: 'week' }) {
    const ordenes = await this.findOrdenesFallaConfirmada(filters);

    let conRag = 0;
    let sinRag = 0;
    let sinAtender = 0;

    for (const o of ordenes) {
      if (o.estado !== EstadoOrden.FINALIZADO) {
        sinAtender += 1;
        continue;
      }
      const tipo = latestSolutionType(o);
      if (tipo === SolucionTipo.CON_RAG) {
        conRag += 1;
      } else if (
        tipo === SolucionTipo.PROPIA ||
        tipo === SolucionTipo.RECHAZADA_MANUAL
      ) {
        sinRag += 1;
      }
    }

    return {
      totalAlertas: ordenes.length,
      conRag,
      sinRag,
      pctConRag: ordenes.length ? Math.round((conRag / ordenes.length) * 100) : 0,
      sinAtender,
      range: filters.range,
    };
  }

  async getFaultsByType(filters: ParsedAnalyticsFilters = { range: 'week' }) {
    const ordenes = await this.findOrdenesFallaConfirmada(filters);
    const counts: Record<string, number> = {};
    for (const o of ordenes) {
      const lider = o.analisis?.clasificaciones?.[0];
      const codigo = lider?.tipoFallo?.codigo ?? 'RNF';
      counts[codigo] = (counts[codigo] ?? 0) + 1;
    }
    return Object.entries(counts).map(([tipoFallo, count]) => ({ tipoFallo, count }));
  }

  async getRecentOrders(limit = 10) {
    const rows = await this.ordenModel.findAll({
      limit,
      order: [['fechaCreacion', 'DESC']],
      include: [
        { model: Maquina },
        {
          model: AnalisisFallo,
          include: [{ model: LecturaSensor }],
        },
      ],
    });
    return rows.map((o) => this.ordersService.toResponse(o));
  }

  async getUnattended(filters: ParsedAnalyticsFilters = { range: 'week' }) {
    const { from, to } = resolveDateRange(filters);
    const where: Record<string, unknown> = {
      estado: EstadoOrden.PENDIENTE,
      fechaCreacion: { [Op.gte]: from, [Op.lte]: to },
    };
    if (filters.tecnicoId) {
      where.idTecnico = filters.tecnicoId;
    }

    const tipoFalloInclude = filters.tipoFallo
      ? { model: TipoFallo, where: { codigo: filters.tipoFallo }, required: true as const }
      : { model: TipoFallo, required: false as const };

    const rows = await this.ordenModel.findAll({
      where,
      limit: 50,
      order: [['fechaCreacion', 'ASC']],
      include: [
        { model: Maquina, attributes: ['codigo'] },
        {
          model: Tecnico,
          include: [{ model: Usuario, attributes: ['nombres', 'apellidos'] }],
        },
        {
          model: AnalisisFallo,
          attributes: ['nivelRiesgo'],
          required: Boolean(filters.tipoFallo),
          include: [
            {
              model: ClasificacionFallo,
              where: { esLider: true },
              required: Boolean(filters.tipoFallo),
              include: [tipoFalloInclude],
            },
          ],
        },
        {
          model: Alerta,
          required: false,
          attributes: ['codigo'],
        },
        {
          model: RespuestaRecomendacion,
          required: false,
          attributes: ['idRespuesta', 'decision', 'fechaRespuesta'],
        },
        { model: ObservacionTecnica, required: false },
      ],
    });

    const now = Date.now();
    return this.applyAnalyticsFilters(rows, filters)
      .filter((o) => !o.respuestasRag?.length)
      .slice(0, 20)
      .map((o) => {
        const nombreTecnico = o.tecnico ? tecnicoNombre(o.tecnico) : 'Sin asignar';
        return {
          id: o.codigo,
          alertaId: o.alertas?.[0]?.codigo ?? null,
          maquinaId: o.maquina?.codigo ?? String(o.idMaquina),
          tecnico: o.tecnico ? tecnicoNombreCorto(nombreTecnico) : 'Sin asignar',
          nivelRiesgo: o.analisis?.nivelRiesgo ?? NivelRiesgo.MEDIUM,
          minutosSinAtender: Math.max(
            0,
            Math.round((now - o.fechaCreacion.getTime()) / 60_000),
          ),
          detectadoEn: o.fechaCreacion.toISOString(),
        };
      });
  }

  async getMachineRecurrence(
    days = 7,
    minFallos = 2,
    filters: ParsedAnalyticsFilters = { range: 'week' },
  ) {
    const { from, to } = filters.desde
      ? resolveDateRange(filters)
      : { from: new Date(Date.now() - days * 24 * 60 * 60 * 1000), to: new Date() };

    const where: Record<string, unknown> = {
      fechaCreacion: { [Op.gte]: from, [Op.lte]: to },
    };
    if (filters.tecnicoId) where.idTecnico = filters.tecnicoId;

    const tipoFalloInclude = filters.tipoFallo
      ? { model: TipoFallo, where: { codigo: filters.tipoFallo }, required: true as const }
      : { model: TipoFallo, required: false as const };

    const ordenes = await this.ordenModel.findAll({
      where,
      include: [
        { model: Maquina, attributes: ['codigo'] },
        {
          model: AnalisisFallo,
          where: { prediccion: PrediccionBinaria.FALLA },
          required: true,
          include: [
            {
              model: ClasificacionFallo,
              where: { esLider: true },
              required: false,
              include: [tipoFalloInclude],
            },
          ],
        },
        { model: RespuestaRecomendacion, required: false },
        { model: ObservacionTecnica, required: false },
      ],
    });

    const filtered = this.applyAnalyticsFilters(ordenes, filters);

    const counts = new Map<string, number>();
    const ventanaDias = Math.max(1, Math.ceil((to.getTime() - from.getTime()) / (24 * 60 * 60 * 1000)));
    for (const o of filtered) {
      const codigo = o.maquina?.codigo;
      if (!codigo) continue;
      counts.set(codigo, (counts.get(codigo) ?? 0) + 1);
    }

    return [...counts.entries()]
      .filter(([, fallos]) => fallos >= minFallos)
      .map(([maquinaId, fallos]) => ({ maquinaId, fallos, ventanaDias: days }))
      .sort((a, b) => b.fallos - a.fallos)
      .slice(0, 10);
  }

  async getRecurrentMachines() {
    // Umbrales configurables (Configuración → Fallos Repetitivos).
    const repCfg = await this.configCatalog.getFallosRepetitivosConfig();
    const ventanaDias = repCfg.umbrales.ventanaDias;
    const umbral = repCfg.umbrales.notificar.veces;
    const from = new Date(Date.now() - ventanaDias * 24 * 60 * 60 * 1000);

    const ordenes = await this.ordenModel.findAll({
      where: { fechaCreacion: { [Op.gte]: from }, idTecnico: { [Op.ne]: null } },
      include: [
        { model: Maquina },
        {
          model: AnalisisFallo,
          include: [{ model: ClasificacionFallo, include: [{ model: TipoFallo }] }],
        },
      ],
    });

    const groups = new Map<string, { maquinaId: string; tipoFallo: string; count: number }>();
    for (const o of ordenes) {
      const lider = o.analisis?.clasificaciones?.find((c) => c.esLider);
      const tipo = lider?.tipoFallo?.codigo;
      const codigo = o.maquina?.codigo;
      if (!tipo || !codigo) continue;
      const key = `${codigo}:${tipo}`;
      const current = groups.get(key) ?? { maquinaId: codigo, tipoFallo: tipo, count: 0 };
      current.count += 1;
      groups.set(key, current);
    }

    return [...groups.values()]
      .filter((g) => g.count >= umbral)
      .sort((a, b) => b.count - a.count)
      .map((g) => ({
        maquinaId: g.maquinaId,
        tipoFallo: g.tipoFallo,
        ocurrencias: g.count,
        ventanaDias,
        escalado: true,
      }));
  }

  /**
   * MTTR (tiempo medio de reparación) y MTBF (tiempo medio entre fallas), por máquina y global.
   * MTTR = promedio de (fechaFin − fechaInicio) en órdenes finalizadas.
   * MTBF = promedio de los intervalos entre detecciones consecutivas de la misma máquina.
   */
  async getReliability(filters: ParsedAnalyticsFilters) {
    const { from, to } = resolveDateRange(filters);

    const where: Record<string, unknown> = {
      fechaCreacion: { [Op.gte]: from, [Op.lte]: to },
      idTecnico: { [Op.ne]: null },
    };
    if (filters.tecnicoId) where.idTecnico = filters.tecnicoId;
    if (filters.maquinaId) {
      const m = await findMaquinaByCodigo(filters.maquinaId);
      if (m) where.idMaquina = m.idMaquina;
    }

    const ordenes = await this.ordenModel.findAll({
      where,
      attributes: ['idMaquina', 'estado', 'fechaCreacion', 'fechaInicio', 'fechaFin'],
      include: [{ model: Maquina, attributes: ['codigo'] }],
      order: [['fechaCreacion', 'ASC']],
    });

    const porMaquinaMap = new Map<string, { repairMs: number[]; detTimes: number[] }>();
    for (const o of ordenes) {
      const codigo = o.maquina?.codigo ?? String(o.idMaquina);
      const entry = porMaquinaMap.get(codigo) ?? { repairMs: [], detTimes: [] };
      entry.detTimes.push(new Date(o.fechaCreacion).getTime());
      if (o.estado === EstadoOrden.FINALIZADO && o.fechaFin) {
        const start = o.fechaInicio ?? o.fechaCreacion;
        const ms = new Date(o.fechaFin).getTime() - new Date(start).getTime();
        if (ms > 0) entry.repairMs.push(ms);
      }
      porMaquinaMap.set(codigo, entry);
    }

    const H = 1000 * 60 * 60;
    const avg = (xs: number[]) =>
      xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null;
    const toH = (ms: number | null) =>
      ms != null ? Math.round((ms / H) * 10) / 10 : null;
    /** MTTR < 1 h: conserva precisión en minutos (evita 3 min → 0.0 h). */
    const toMttrH = (ms: number | null) => {
      if (ms == null) return null;
      if (ms / H < 1) return Math.round(ms / (1000 * 60)) / 60;
      return Math.round((ms / H) * 10) / 10;
    };

    const allRepair: number[] = [];
    const allGaps: number[] = [];

    const porMaquina = [...porMaquinaMap.entries()]
      .map(([maquinaId, e]) => {
        const sorted = [...e.detTimes].sort((a, b) => a - b);
        const gaps: number[] = [];
        for (let i = 1; i < sorted.length; i++) gaps.push(sorted[i] - sorted[i - 1]);
        allRepair.push(...e.repairMs);
        allGaps.push(...gaps);
        return {
          maquinaId,
          mttrHoras: toMttrH(avg(e.repairMs)),
          mtbfHoras: toH(avg(gaps)),
          reparaciones: e.repairMs.length,
          fallas: e.detTimes.length,
        };
      })
      .sort((a, b) => b.fallas - a.fallas);

    return {
      global: {
        mttrHoras: toMttrH(avg(allRepair)),
        mtbfHoras: toH(avg(allGaps)),
        reparaciones: allRepair.length,
        fallas: porMaquina.reduce((s, m) => s + m.fallas, 0),
      },
      porMaquina,
      range: filters.range,
    };
  }

  async getSensorTrend(variable: string, hours: number, maquinaId?: string) {
    const fieldMap: Record<string, keyof LecturaSensor> = {
      airTemperature: 'airTemperature',
      processTemperature: 'processTemperature',
      rotationalSpeed: 'rotationalSpeed',
      rpm: 'rotationalSpeed',
      torque: 'torque',
      toolWear: 'toolWear',
    };
    const field = fieldMap[variable] ?? 'rotationalSpeed';
    const from = new Date(Date.now() - hours * 60 * 60 * 1000);

    const where: Record<string, unknown> = { fechaLectura: { [Op.gte]: from } };
    if (maquinaId) {
      const maquina = await findMaquinaByCodigo(maquinaId);
      if (maquina) where.idMaquina = maquina.idMaquina;
    }

    const rows = await this.lecturaSensorModel.findAll({
      where,
      order: [['fechaLectura', 'ASC']],
      limit: 200,
      include: [{ model: Maquina, attributes: ['codigo'] }],
    });

    return rows.map((row) => ({
      timestamp: row.fechaLectura.toISOString(),
      value: Number(row[field as keyof LecturaSensor] ?? 0),
      maquinaId: row.maquina?.codigo ?? String(row.idMaquina),
    }));
  }

  async getAvailability() {
    const maquinas = await this.maquinaModel.findAll({
      attributes: ['idMaquina', 'codigo'],
      order: [['codigo', 'ASC']],
    });

    const ordenesActivas = await this.ordenModel.findAll({
      where: {
        estado: { [Op.in]: [EstadoOrden.PENDIENTE, EstadoOrden.EN_PROGRESO] },
      },
      attributes: ['idMaquina', 'codigo', 'estado'],
      include: [{ model: Maquina, attributes: ['codigo'] }],
    });

    const maquinasMantenimientoIds = new Set(ordenesActivas.map((o) => o.idMaquina));
    const maquinasEnMantenimiento = maquinasMantenimientoIds.size;
    const maquinasOperativas = Math.max(0, maquinas.length - maquinasEnMantenimiento);
    const detalleMaquinasMantenimiento = [
      ...new Set(
        ordenesActivas.map((o) => o.maquina?.codigo ?? String(o.idMaquina)),
      ),
    ].sort();

    return {
      maquinas: {
        total: maquinas.length,
        operativas: maquinasOperativas,
        enMantenimiento: maquinasEnMantenimiento,
        detalleMantenimiento: detalleMaquinasMantenimiento,
      },
    };
  }

  /**
   * Historial de aciertos del modelo: contrasta la predicción automática
   * (falla / tipo de falla) contra la decisión del técnico (aceptada / rechazada).
   * Solo incluye órdenes con técnico asignado y observación técnica registrada.
   */
  async getPredictionValidation(filters: ParsedAnalyticsFilters = { range: 'month' }) {
    const { from, to } = resolveDateRange(filters);
    const where: Record<string, unknown> = {
      fechaCreacion: { [Op.gte]: from, [Op.lte]: to },
      idTecnico: filters.tecnicoId ? filters.tecnicoId : { [Op.ne]: null },
    };
    if (filters.estado) where.estado = filters.estado;
    if (filters.maquinaId) {
      const maquina = await findMaquinaByCodigo(filters.maquinaId);
      if (maquina) where.idMaquina = maquina.idMaquina;
    }

    const tipoFalloInclude = filters.tipoFallo
      ? { model: TipoFallo, where: { codigo: filters.tipoFallo }, required: true as const }
      : { model: TipoFallo, required: false as const };

    const ordenes = await this.ordenModel.findAll({
      where,
      include: [
        { model: Maquina, attributes: ['codigo'] },
        {
          model: Tecnico,
          include: [{ model: Usuario, attributes: ['nombres', 'apellidos'] }],
        },
        { model: ObservacionTecnica, required: true },
        { model: RespuestaRecomendacion, required: false },
        {
          model: AnalisisFallo,
          required: true,
          include: [
            {
              model: ClasificacionFallo,
              where: { esLider: true },
              required: Boolean(filters.tipoFallo),
              include: [tipoFalloInclude],
            },
          ],
        },
      ],
      order: [['fechaCreacion', 'DESC']],
    });

    const filtered = this.applyAnalyticsFilters(ordenes, filters);

    return filtered.map((o) => {
      const obs = [...(o.observacionesTecnica ?? [])].sort(
        (a, b) =>
          new Date(b.fechaRegistro).getTime() - new Date(a.fechaRegistro).getTime(),
      )[0];
      const lider = o.analisis?.clasificaciones?.find((c) => c.esLider);
      const rechazada =
        obs?.decision === DecisionPrediccion.RECHAZADA ||
        o.estado === EstadoOrden.RECHAZADA ||
        obs?.esPrediccionCorrecta === false;
      const prediccion =
        o.analisis?.prediccion ??
        (lider?.tipoFallo ? PrediccionBinaria.FALLA : PrediccionBinaria.SIN_FALLA);

      return {
        orden: o.codigo,
        maquinaId: o.maquina?.codigo ?? String(o.idMaquina),
        tecnico: o.tecnico ? tecnicoNombre(o.tecnico) : 'Sin asignar',
        prediccion,
        tipoFallo: lider?.tipoFallo?.codigo ?? null,
        decision: rechazada
          ? DecisionPrediccion.RECHAZADA
          : DecisionPrediccion.ACEPTADA,
        esPrediccionCorrecta: obs?.esPrediccionCorrecta ?? null,
        justificacion: rechazada ? (obs?.comentario ?? null) : null,
        estado: o.estado,
        fecha: (obs?.fechaRegistro ?? o.fechaCreacion).toISOString(),
      };
    });
  }

  exportCsv(type: string, range: string) {
    return { type, range, rows: [] };
  }
}
