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

@Injectable()
export class PredictionsService {
  constructor(
    @InjectModel(Orden) private readonly ordenModel: typeof Orden,
    @InjectModel(PrediccionFallo) private readonly prediccionModel: typeof PrediccionFallo,
    @InjectModel(ClasificacionFallo) private readonly clasificacionModel: typeof ClasificacionFallo,
    @InjectModel(LecturaSensor) private readonly lecturaModel: typeof LecturaSensor,
    @InjectModel(AnalisisFallo) private readonly analisisModel: typeof AnalisisFallo,
    private readonly mlGateway: MlGatewayService,
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
    return {
      modelo: modeloSlug(p.modeloMl, 'xgboost') as ModeloBinario,
      prediccion: p.prediccion,
      probabilidad: Number(p.probabilidad),
      accuracy: p.modeloMl?.accuracy != null ? Number(p.modeloMl.accuracy) : null,
      rocAuc: p.modeloMl?.rocAuc != null ? Number(p.modeloMl.rocAuc) : null,
      precision: p.modeloMl?.precisionScore != null ? Number(p.modeloMl.precisionScore) : null,
      recall: p.modeloMl?.recallScore != null ? Number(p.modeloMl.recallScore) : null,
      f1Score: p.modeloMl?.f1Score != null ? Number(p.modeloMl.f1Score) : null,
      tn: p.tn ?? null,
      fp: p.fp ?? null,
      fn: p.fn ?? null,
      tp: p.tp ?? null,
      esLider: p.esLider,
    };
  }

  private multiToResponse(c: ClasificacionFallo) {
    return {
      modelo: modeloSlug(c.modeloMl, 'lightgbm') as ModeloMulticlase,
      tipoPredicho: c.tipoFallo?.codigo ?? null,
      probHdf: c.probHdf != null ? Number(c.probHdf) : null,
      probPwf: c.probPwf != null ? Number(c.probPwf) : null,
      probTwf: c.probTwf != null ? Number(c.probTwf) : null,
      probOsf: c.probOsf != null ? Number(c.probOsf) : null,
      probRnf: c.probRnf != null ? Number(c.probRnf) : null,
      f1Macro: c.modeloMl?.f1Score != null ? Number(c.modeloMl.f1Score) : null,
      f1Weighted: null,
      accuracy: c.modeloMl?.accuracy != null ? Number(c.modeloMl.accuracy) : null,
      tp: null,
      fn: null,
      fp: null,
      tn: null,
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
    return {
      items: preds.map((p) => this.binToResponse(p)),
      ensembleAvg:
        orden.analisis!.ensembleAvg != null
          ? Number(orden.analisis!.ensembleAvg)
          : null,
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
        await this.prediccionModel.create({
          idAnalisis: orden.idAnalisis,
          idModelo,
          prediccion: m.prediccion as PredBinEnum,
          probabilidad: m.probabilidad,
          confianza: m.probabilidad,
          esLider: m.esLider ?? false,
          tn: m.tn,
          fp: m.fp,
          fn: m.fn,
          tp: m.tp,
        });
      }
      await this.analisisModel.update(
        { ensembleAvg: result.ensembleAvg, nivelRiesgo: result.nivelRiesgo },
        { where: { idAnalisis: orden.idAnalisis } },
      );
      return this.getBinary(orderCodigo);
    }

    await this.clasificacionModel.destroy({ where: { idAnalisis: orden.idAnalisis } });
    const result = await this.mlGateway.classify(features);
    for (const m of result.modelos) {
      const idModelo = await resolveModeloId(m.modelo, 'S2');
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
      });
    }
    return this.getMulticlass(orderCodigo);
  }
}
