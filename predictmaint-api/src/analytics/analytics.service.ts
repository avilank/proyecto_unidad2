import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Op } from 'sequelize';
import { EstadoOrden, NivelRiesgo, PrediccionBinaria } from '../common/enums';
import { Alerta } from '../database/models/alerta.model';
import { AnalisisFallo } from '../database/models/analisis-fallo.model';
import { ClasificacionFallo } from '../database/models/clasificacion-fallo.model';
import { LecturaSensor } from '../database/models/lectura-sensor.model';
import { Maquina } from '../database/models/maquina.model';
import { ModeloMl } from '../database/models/modelo-ml.model';
import { Orden } from '../database/models/orden.model';
import { PrediccionFallo } from '../database/models/prediccion-fallo.model';
import { RespuestaRecomendacion } from '../database/models/respuesta-recomendacion.model';
import { TipoFallo } from '../database/models/tipo-fallo.model';
import { OrdersService } from '../orders/orders.service';

@Injectable()
export class AnalyticsService {
  constructor(
    @InjectModel(Maquina) private readonly maquinaModel: typeof Maquina,
    @InjectModel(Orden) private readonly ordenModel: typeof Orden,
    @InjectModel(Alerta) private readonly alertaModel: typeof Alerta,
    @InjectModel(AnalisisFallo) private readonly analisisModel: typeof AnalisisFallo,
    @InjectModel(PrediccionFallo) private readonly prediccionModel: typeof PrediccionFallo,
    private readonly ordersService: OrdersService,
  ) {}

  private startOfDay(d = new Date()) {
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
  }

  private rangeStart(range: string) {
    const now = new Date();
    const days = range === 'month' ? 30 : 7;
    return new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
  }

  async getDashboard() {
    const startDay = this.startOfDay();
    const totalMaquinas = await this.maquinaModel.count();

    // Un "evento S-1" = pipeline iniciado hoy (regla disparada + evaluación ML).
    const ordenesHoy = await this.ordenModel.findAll({
      where: { fechaCreacion: { [Op.gte]: startDay } },
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
      where: { fechaCreacion: { [Op.gte]: startDay } },
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

    const alertasActivas = await this.alertaModel.findAll({
      where: { estado: { [Op.notIn]: ['finalizado'] } },
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
    const precision =
      preds.length > 0
        ? preds.reduce((s, p) => s + Number(p.modeloMl?.accuracy ?? 0), 0) / preds.length
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
      precisionModelo: Math.round(precision * 10) / 10,
    };
  }

  async getSummary(range: string) {
    const from = this.rangeStart(range);
    const ordenes = await this.ordenModel.findAll({
      where: { fechaCreacion: { [Op.gte]: from } },
    });
    const orderIds = ordenes.map((o) => o.idOrden);
    const respuestas = orderIds.length
      ? await RespuestaRecomendacion.findAll({
          where: { idOrden: orderIds, decision: 'aceptado' },
        })
      : [];
    const conRag = respuestas.length;
    const sinAtender = ordenes.filter((o) => o.estado === EstadoOrden.PENDIENTE).length;

    return {
      totalAlertas: ordenes.length,
      conRag,
      sinRag: ordenes.length - conRag,
      pctConRag: ordenes.length ? Math.round((conRag / ordenes.length) * 100) : 0,
      sinAtender,
      range,
    };
  }

  async getFaultsByType(range: string) {
    const from = this.rangeStart(range);
    const ordenes = await this.ordenModel.findAll({
      where: { fechaCreacion: { [Op.gte]: from } },
      include: [
        {
          model: AnalisisFallo,
          include: [{ model: ClasificacionFallo, include: [{ model: TipoFallo }] }],
        },
      ],
    });
    const counts: Record<string, number> = {};
    for (const o of ordenes) {
      const lider = o.analisis?.clasificaciones?.find((c) => c.esLider);
      const codigo = lider?.tipoFallo?.codigo ?? 'RNF';
      counts[codigo] = (counts[codigo] ?? 0) + 1;
    }
    return Object.entries(counts).map(([tipo, total]) => ({ tipo, total }));
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

  async getUnattended() {
    const rows = await this.ordenModel.findAll({
      where: { estado: EstadoOrden.PENDIENTE },
      limit: 20,
      order: [['fechaCreacion', 'DESC']],
    });
    return rows.map((o) => ({ id: o.codigo, maquinaId: o.idMaquina, estado: o.estado }));
  }

  async getRecurrentMachines() {
    const ventanaDias = 7;
    const umbral = 3;
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

  async getSensorTrend(_variable: string, _hours: number) {
    return [];
  }

  exportCsv(type: string, range: string) {
    return { type, range, rows: [] };
  }
}
