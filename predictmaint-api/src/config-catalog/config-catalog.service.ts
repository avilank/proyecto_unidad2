import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { ConfiguracionAlertas } from '../database/models/configuracion-alertas.model';
import { FuenteRag } from '../database/models/fuente-rag.model';
import { TipoFallo } from '../database/models/tipo-fallo.model';
import {
  DEFAULT_DISPATCH_SCHEDULE,
  parseDispatchSchedule,
  type DispatchScheduleItem,
} from './dispatch-schedule.defaults';

const RAG_SOURCE_DESCRIPTIONS: Record<string, string> = {
  'Theissler et al. (2021)': 'ML para mantenimiento predictivo, monitoreo de condición y priorización de riesgo.',
  'Pashmforoush et al. (2025)': 'Buenas prácticas de diagnóstico para desgaste, sobrecarga y modos de falla.',
  'Cai et al. (2023)': 'Sensores industriales, análisis de señales y prevención de fallas progresivas.',
  'Araujo et al. (2025)': 'Confiabilidad operacional y mantenimiento preventivo/correctivo en sistemas electromecánicos.',
  'Hesser & Markert (2019)': 'Máquinas herramienta, desgaste de herramienta, vibración y control de proceso.',
  'Jakobs et al. (2026)': 'Gestión de fallas aleatorias, inspección manual y escalamiento técnico seguro.',
};

@Injectable()
export class ConfigCatalogService {
  constructor(
    @InjectModel(ConfiguracionAlertas) private readonly configModel: typeof ConfiguracionAlertas,
    @InjectModel(TipoFallo) private readonly tipoFalloModel: typeof TipoFallo,
    @InjectModel(FuenteRag) private readonly fuenteRagModel: typeof FuenteRag,
  ) {}

  private async getOrCreateConfig(): Promise<ConfiguracionAlertas> {
    let cfg = await this.configModel.findOne();
    if (!cfg) {
      cfg = await this.configModel.create({
        riesgoBajo: 0.4,
        riesgoMedio: 0.65,
        riesgoAlto: 0.85,
        riesgoCritico: 1.0,
        tiempoEscalamiento: 30,
        umbralEnsembleFalla: 0.5,
        agreementMinimoS3: 'MEDIO',
        horariosEnvioJson: JSON.stringify(DEFAULT_DISPATCH_SCHEDULE),
        fechaActualizacion: new Date(),
      });
    }
    return cfg;
  }

  async getConfig(_grupo?: string) {
    const cfg = await this.getOrCreateConfig();
    return {
      umbral_ensemble_falla: String(Number(cfg.umbralEnsembleFalla ?? 0.5)),
      agreement_minimo_s3: cfg.agreementMinimoS3 ?? 'MEDIO',
      riesgo_bajo: String(cfg.riesgoBajo),
      riesgo_medio: String(cfg.riesgoMedio),
      riesgo_alto: String(cfg.riesgoAlto),
      riesgo_critico: String(cfg.riesgoCritico),
      tiempo_escalamiento: String(cfg.tiempoEscalamiento),
      horarios_envio: parseDispatchSchedule(cfg.horariosEnvioJson),
    };
  }

  async patchConfig(values: Record<string, unknown>) {
    const cfg = await this.getOrCreateConfig();
    const patch: Partial<ConfiguracionAlertas> = { fechaActualizacion: new Date() };

    if (values.riesgo_bajo != null) patch.riesgoBajo = parseFloat(String(values.riesgo_bajo));
    if (values.riesgo_medio != null) patch.riesgoMedio = parseFloat(String(values.riesgo_medio));
    if (values.riesgo_alto != null) patch.riesgoAlto = parseFloat(String(values.riesgo_alto));
    if (values.riesgo_critico != null) patch.riesgoCritico = parseFloat(String(values.riesgo_critico));
    if (values.tiempo_escalamiento != null) {
      patch.tiempoEscalamiento = parseInt(String(values.tiempo_escalamiento), 10);
    }
    if (values.umbral_ensemble_falla != null) {
      patch.umbralEnsembleFalla = parseFloat(String(values.umbral_ensemble_falla));
    }
    if (values.agreement_minimo_s3 != null) {
      patch.agreementMinimoS3 = String(values.agreement_minimo_s3).toUpperCase();
    }
    if (values.horarios_envio != null) {
      patch.horariosEnvioJson = JSON.stringify(values.horarios_envio);
    }

    await cfg.update(patch);
    return this.getConfig();
  }

  async getFaultTypes() {
    const rows = await this.tipoFalloModel.findAll({ order: [['codigo', 'ASC']] });
    return rows.map((t) => ({
      codigo: t.codigo,
      nombre: t.nombre,
      especialidadRequerida: null,
      recomendacionesBase: t.descripcion ?? null,
    }));
  }

  async getRiskLevels() {
    const cfg = await this.getOrCreateConfig();
    return [
      { nivel: 'LOW', min: 0, max: Number(cfg.riesgoBajo), accion: 'Monitorear', tiempoLimite: null, escalaA: null },
      { nivel: 'MEDIUM', min: Number(cfg.riesgoBajo), max: Number(cfg.riesgoMedio), accion: 'Notificar', tiempoLimite: '2h', escalaA: 'Supervisor' },
      { nivel: 'HIGH', min: Number(cfg.riesgoMedio), max: Number(cfg.riesgoAlto), accion: 'Inmediata', tiempoLimite: '30m', escalaA: 'Supervisor' },
      { nivel: 'CRITICAL', min: Number(cfg.riesgoAlto), max: Number(cfg.riesgoCritico), accion: 'Parada', tiempoLimite: '15m', escalaA: 'Jefe planta' },
    ];
  }

  async getRagSources() {
    const rows = await this.fuenteRagModel.findAll({ order: [['idFuente', 'ASC']] });
    return rows.map((f) => ({
      id: f.idFuente,
      fuente: f.titulo,
      tipoFallo: null,
      descripcion: RAG_SOURCE_DESCRIPTIONS[f.titulo] ?? f.autor ?? null,
      activa: f.activo,
    }));
  }

  async patchRagSource(id: number, activa: boolean) {
    const f = await this.fuenteRagModel.findByPk(id);
    if (!f) throw new NotFoundException('Fuente RAG no encontrada');
    await f.update({ activo: activa });
    return {
      id: f.idFuente,
      fuente: f.titulo,
      tipoFallo: null,
      descripcion: RAG_SOURCE_DESCRIPTIONS[f.titulo] ?? f.autor ?? null,
      activa: f.activo,
    };
  }

  async getDispatchSchedule(): Promise<DispatchScheduleItem[]> {
    const cfg = await this.getOrCreateConfig();
    return parseDispatchSchedule(cfg.horariosEnvioJson);
  }

  async patchDispatchSchedule(items: DispatchScheduleItem[]) {
    const cfg = await this.getOrCreateConfig();
    await cfg.update({
      horariosEnvioJson: JSON.stringify(items),
      fechaActualizacion: new Date(),
    });
    return parseDispatchSchedule(cfg.horariosEnvioJson);
  }
}
