import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { ConfiguracionAlertas } from '../database/models/configuracion-alertas.model';
import { FuenteRag } from '../database/models/fuente-rag.model';
import { TipoFallo } from '../database/models/tipo-fallo.model';

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

  async getConfig(_grupo?: string) {
    const cfg = await this.configModel.findOne();
    if (!cfg) return {};
    return {
      umbral_ensemble_falla: String(Number(cfg.riesgoMedio)),
      riesgo_bajo: String(cfg.riesgoBajo),
      riesgo_medio: String(cfg.riesgoMedio),
      riesgo_alto: String(cfg.riesgoAlto),
      riesgo_critico: String(cfg.riesgoCritico),
      tiempo_escalamiento: String(cfg.tiempoEscalamiento),
    };
  }

  async patchConfig(values: Record<string, string>) {
    const cfg = await this.configModel.findOne();
    if (!cfg) throw new NotFoundException('Configuración no encontrada');
    await cfg.update({
      ...(values.riesgo_bajo && { riesgoBajo: parseFloat(values.riesgo_bajo) }),
      ...(values.riesgo_medio && { riesgoMedio: parseFloat(values.riesgo_medio) }),
      ...(values.riesgo_alto && { riesgoAlto: parseFloat(values.riesgo_alto) }),
      ...(values.riesgo_critico && { riesgoCritico: parseFloat(values.riesgo_critico) }),
      ...(values.tiempo_escalamiento && {
        tiempoEscalamiento: parseInt(values.tiempo_escalamiento, 10),
      }),
      fechaActualizacion: new Date(),
    });
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
    const cfg = await this.configModel.findOne();
    if (!cfg) return [];
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

  async getDispatchSchedule() {
    return [];
  }
}
