import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { EtapaModelo } from '../common/enums';
import { ModeloMl } from '../database/models/modelo-ml.model';
import {
  defaultMetricsPath,
  syncMetricsToCatalog,
  s1CatalogPatch,
  s2CatalogPatch,
  type MlBinaryMetricsPayload,
  type MlMulticlassMetricsPayload,
} from './ml-metrics-sync';

const ML_MODEL_DESCRIPTIONS: Record<string, string> = {
  XGBoost: 'Mayor precisión — Recomendado',
  'Random Forest': 'Robusto ante ruido y outliers',
  'Regresión Logística': 'Alta interpretabilidad',
  LightGBM: 'Óptimo para clases desbalanceadas',
  'Decision Tree': 'Alta interpretabilidad visual',
  SVM: 'Efectivo en alta dimensionalidad',
};

@Injectable()
export class MlModelsService {
  private readonly logger = new Logger(MlModelsService.name);

  constructor(@InjectModel(ModeloMl) private readonly modeloModel: typeof ModeloMl) {}

  async syncMetricsFromArtifacts(filePath = defaultMetricsPath()): Promise<number> {
    const updated = await syncMetricsToCatalog(this.modeloModel, filePath);
    if (updated > 0) {
      this.logger.log(`Métricas ML sincronizadas (${updated} modelos) desde ${filePath}`);
    }
    return updated;
  }

  async applyRuntimeS1Metrics(idModelo: number, metrics: MlBinaryMetricsPayload): Promise<void> {
    await this.modeloModel.update(s1CatalogPatch(metrics), { where: { idModelo } });
  }

  async applyRuntimeS2Metrics(idModelo: number, metrics: MlMulticlassMetricsPayload): Promise<void> {
    await this.modeloModel.update(s2CatalogPatch(metrics), { where: { idModelo } });
  }

  toResponse(m: ModeloMl) {
    return {
      id: m.idModelo,
      etapa: m.esPrediccion ? EtapaModelo.S1 : EtapaModelo.S2,
      modelo: m.nombre,
      accuracy: m.accuracy != null ? Number(m.accuracy) : null,
      metricaPrincipal: m.esPrediccion ? 'AUC' : 'F1-m',
      valorMetrica:
        m.rocAuc != null
          ? Number(m.rocAuc)
          : m.f1Score != null
            ? Number(m.f1Score)
            : null,
      activo: m.esDefault,
      descripcion: ML_MODEL_DESCRIPTIONS[m.nombre] ?? m.version ?? null,
      tn: m.tn ?? null,
      fp: m.fp ?? null,
      fn: m.fn ?? null,
      tp: m.tp ?? null,
    };
  }

  async findAll(etapa?: EtapaModelo) {
    const where =
      etapa === EtapaModelo.S1
        ? { esPrediccion: true }
        : etapa === EtapaModelo.S2
          ? { esClasificacion: true }
          : {};
    const rows = await this.modeloModel.findAll({
      where,
      order: [['idModelo', 'ASC']],
    });
    return rows.map((m) => this.toResponse(m));
  }

  async activate(id: number) {
    const modelo = await this.modeloModel.findByPk(id);
    if (!modelo) throw new NotFoundException('Modelo no encontrado');
    const filter = modelo.esPrediccion
      ? { esPrediccion: true }
      : { esClasificacion: true };
    await this.modeloModel.update({ esDefault: false }, { where: filter });
    await modelo.update({ esDefault: true });
    return this.toResponse(modelo);
  }
}
