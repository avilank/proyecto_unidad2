import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import {
  EtapaModelo,
  ModeloBinario,
  ModeloMulticlase,
  PrediccionBinaria as PredBinEnum,
} from '../common/enums';
import { modeloSlug, resolveModeloId } from '../common/utils/modelo-ml.util';
import { AnalisisFallo } from '../database/models/analisis-fallo.model';
import { ClasificacionFallo } from '../database/models/clasificacion-fallo.model';
import { LecturaSensor } from '../database/models/lectura-sensor.model';
import { ModeloMl } from '../database/models/modelo-ml.model';
import { Orden } from '../database/models/orden.model';
import { PrediccionFallo } from '../database/models/prediccion-fallo.model';
import { TipoFallo } from '../database/models/tipo-fallo.model';
import { MlGatewayService } from '../ml-gateway/ml-gateway.service';
import { MlModelsService } from '../ml-models/ml-models.service';
import {
  s1PredictionPatch,
  s2PredictionPatch,
} from '../ml-models/ml-metrics-sync';

@Injectable()
export class PredictionsService {
  constructor(
    @InjectModel(Orden) private readonly ordenModel: typeof Orden,
    @InjectModel(PrediccionFallo) private readonly prediccionModel: typeof PrediccionFallo,
    @InjectModel(ClasificacionFallo) private readonly clasificacionModel: typeof ClasificacionFallo,
    @InjectModel(LecturaSensor) private readonly lecturaModel: typeof LecturaSensor,
    @InjectModel(AnalisisFallo) private readonly analisisModel: typeof AnalisisFallo,
    private readonly mlGateway: MlGatewayService,
    private readonly mlModelsService: MlModelsService,
  ) {}

  private async getOrderContext(orderCodigo: string) {
    const orden = await this.ordenModel.findOne({
      where: { codigo: orderCodigo },
      include: [{ model: AnalisisFallo }],
    });
    if (!orden?.analisis) throw new NotFoundException('Orden no encontrada');
    return orden;
  }

  private binToResponse(p: PrediccionFallo) {
    const num = (v: unknown) => (v != null ? Number(v) : null);
    return {
      modelo: modeloSlug(p.modeloMl, 'xgboost') as ModeloBinario,
      prediccion: p.prediccion,
      probabilidad: Number(p.probabilidad),
      accuracy: num(p.accuracy) ?? num(p.modeloMl?.accuracy),
      rocAuc: num(p.rocAuc) ?? num(p.modeloMl?.rocAuc),
      precision: num(p.precisionScore) ?? num(p.modeloMl?.precisionScore),
      recall: num(p.recallScore) ?? num(p.modeloMl?.recallScore),
      f1Score: num(p.f1Score) ?? num(p.modeloMl?.f1Score),
      tn: p.tn ?? p.modeloMl?.tn ?? null,
      fp: p.fp ?? p.modeloMl?.fp ?? null,
      fn: p.fn ?? p.modeloMl?.fn ?? null,
      tp: p.tp ?? p.modeloMl?.tp ?? null,
      esLider: p.esLider,
    };
  }

  private multiToResponse(c: ClasificacionFallo) {
    const num = (v: unknown) => (v != null ? Number(v) : null);
    return {
      modelo: modeloSlug(c.modeloMl, 'lightgbm') as ModeloMulticlase,
      tipoPredicho: c.tipoFallo?.codigo ?? null,
      probHdf: c.probHdf != null ? Number(c.probHdf) : null,
      probPwf: c.probPwf != null ? Number(c.probPwf) : null,
      probTwf: c.probTwf != null ? Number(c.probTwf) : null,
      probOsf: c.probOsf != null ? Number(c.probOsf) : null,
      probRnf: c.probRnf != null ? Number(c.probRnf) : null,
      f1Macro: num(c.metricF1Macro) ?? num(c.modeloMl?.f1Score),
      f1Weighted: num(c.metricF1Weighted) ?? num(c.modeloMl?.f1Weighted),
      accuracy: num(c.metricAccuracy) ?? num(c.modeloMl?.accuracy),
      tp: c.metricTp ?? c.modeloMl?.tp ?? null,
      fn: c.metricFn ?? c.modeloMl?.fn ?? null,
      fp: c.metricFp ?? c.modeloMl?.fp ?? null,
      tn: c.metricTn ?? c.modeloMl?.tn ?? null,
      esLider: c.esLider,
      diverge: c.diverge,
    };
  }

  async getBinary(orderCodigo: string) {
    const orden = await this.getOrderContext(orderCodigo);
    const preds = await this.prediccionModel.findAll({
      where: { idAnalisis: orden.idAnalisis },
      include: [{ model: ModeloMl }],
    });
    const lider = preds.find((p) => p.esLider);
    const confianzaLider =
      lider?.probabilidad != null
        ? Number(lider.probabilidad) / 100
        : orden.analisis!.ensembleAvg != null
          ? Number(orden.analisis!.ensembleAvg)
          : null;
    return {
      items: preds.map((p) => this.binToResponse(p)),
      modeloLider: lider ? modeloSlug(lider.modeloMl, 'xgboost') : null,
      confianzaLider,
      ensembleAvg: confianzaLider,
      nivelRiesgo: orden.analisis!.nivelRiesgo,
      consenso: lider?.prediccion ?? preds[0]?.prediccion ?? null,
    };
  }

  async getMulticlass(orderCodigo: string) {
    const orden = await this.getOrderContext(orderCodigo);
    const preds = await this.clasificacionModel.findAll({
      where: { idAnalisis: orden.idAnalisis },
      include: [{ model: ModeloMl }, { model: TipoFallo }],
    });
    const lider = preds.find((p) => p.esLider);
    const agreement = preds.filter(
      (p) => p.tipoFallo?.codigo === lider?.tipoFallo?.codigo,
    ).length;
    const agreementLabel =
      agreement >= 3 ? 'ALTO' : agreement >= 2 ? 'MEDIO' : 'BAJO';
    return {
      items: preds.map((p) => this.multiToResponse(p)),
      modeloLider: lider ? modeloSlug(lider.modeloMl, 'lightgbm') : null,
      tipoPredicho: lider?.tipoFallo?.codigo ?? null,
      agreement: agreementLabel,
      confianza: lider?.confianza != null ? Number(lider.confianza) : null,
    };
  }

  async run(orderCodigo: string, etapa: EtapaModelo) {
    const orden = await this.getOrderContext(orderCodigo);
    const lectura = await this.lecturaModel.findByPk(orden.analisis!.idLectura);
    if (!lectura) throw new NotFoundException('Lectura no encontrada');

    const features = {
      type: lectura.tipoMaquina,
      airTemperature: Number(lectura.airTemperature),
      processTemperature: Number(lectura.processTemperature),
      rotationalSpeed: lectura.rotationalSpeed,
      torque: Number(lectura.torque),
      toolWear: lectura.toolWear,
    };

    if (etapa === EtapaModelo.S1) {
      await this.prediccionModel.destroy({ where: { idAnalisis: orden.idAnalisis } });
      const result = await this.mlGateway.predict(features);
      for (const m of result.modelos) {
        const idModelo = await resolveModeloId(m.modelo, 'S1');
        await this.mlModelsService.applyRuntimeS1Metrics(idModelo, m);
        await this.prediccionModel.create({
          idAnalisis: orden.idAnalisis,
          idModelo,
          prediccion: m.prediccion as PredBinEnum,
          probabilidad: m.probabilidad,
          confianza: m.probabilidad,
          esLider: m.esLider ?? false,
          ...s1PredictionPatch(m),
        });
      }
      await this.analisisModel.update(
        {
          ensembleAvg: result.confianzaLider ?? result.ensembleAvg,
          nivelRiesgo: result.nivelRiesgo,
        },
        { where: { idAnalisis: orden.idAnalisis } },
      );
      return this.getBinary(orderCodigo);
    }

    await this.clasificacionModel.destroy({ where: { idAnalisis: orden.idAnalisis } });
    const result = await this.mlGateway.classify(features);
    for (const m of result.modelos) {
      const idModelo = await resolveModeloId(m.modelo, 'S2');
      await this.mlModelsService.applyRuntimeS2Metrics(idModelo, m);
      const tipo = await TipoFallo.findOne({ where: { codigo: m.tipoPredicho } });
      if (!tipo) continue;
      await this.clasificacionModel.create({
        idAnalisis: orden.idAnalisis,
        idTipoFallo: tipo.idTipoFallo,
        idModelo,
        confianza: result.confianza,
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
    return this.getMulticlass(orderCodigo);
  }
}
