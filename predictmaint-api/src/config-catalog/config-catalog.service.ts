import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { AccionEscalada } from '../database/models/accion-escalada.model';
import { ConfiguracionAlertas } from '../database/models/configuracion-alertas.model';
import { FuenteRag } from '../database/models/fuente-rag.model';
import { ReglaNotificacion } from '../database/models/regla-notificacion.model';
import { TipoFallo } from '../database/models/tipo-fallo.model';
import {
  DEFAULT_DISPATCH_SCHEDULE,
  parseDispatchSchedule,
  type DispatchScheduleItem,
} from './dispatch-schedule.defaults';
import {
  formatRagSourceFaultLabel,
} from '../common/utils/rag-source-fault.util';

/** SLA por nivel en minutos (null = no aplica). */
export type TiemposAtencion = {
  LOW: number | null;
  MEDIUM: number | null;
  HIGH: number | null;
  CRITICAL: number | null;
};

const DEFAULT_TIEMPOS_ATENCION: TiemposAtencion = {
  LOW: null,
  MEDIUM: 120,
  HIGH: 30,
  CRITICAL: 15,
};

function parseTiemposAtencion(json?: string | null): TiemposAtencion {
  if (!json) return { ...DEFAULT_TIEMPOS_ATENCION };
  try {
    const raw = JSON.parse(json) as Partial<TiemposAtencion>;
    const norm = (v: unknown): number | null => {
      if (v === null || v === undefined || v === '') return null;
      const n = Number(v);
      return Number.isFinite(n) && n > 0 ? Math.round(n) : null;
    };
    return {
      LOW: norm(raw.LOW),
      MEDIUM: norm(raw.MEDIUM),
      HIGH: norm(raw.HIGH),
      CRITICAL: norm(raw.CRITICAL),
    };
  } catch {
    return { ...DEFAULT_TIEMPOS_ATENCION };
  }
}

/** Config de fallos repetitivos. */
export type FallosRepetitivosConfig = {
  umbrales: {
    marcar: { veces: number; dias: number };
    notificar: { veces: number; dias: number };
    rag: { veces: number; dias: number };
    ventanaDias: number;
  };
  notificaciones: {
    mark: boolean;
    supervisor: boolean;
    rag: boolean;
  };
};

const DEFAULT_FALLOS_REPETITIVOS: FallosRepetitivosConfig = {
  umbrales: {
    marcar: { veces: 2, dias: 7 },
    notificar: { veces: 3, dias: 7 },
    rag: { veces: 2, dias: 7 },
    ventanaDias: 7,
  },
  notificaciones: { mark: true, supervisor: true, rag: true },
};

function parseFallosRepetitivos(json?: string | null): FallosRepetitivosConfig {
  if (!json) return structuredClone(DEFAULT_FALLOS_REPETITIVOS);
  try {
    const raw = JSON.parse(json) as Partial<FallosRepetitivosConfig>;
    const d = DEFAULT_FALLOS_REPETITIVOS;
    const posInt = (v: unknown, fb: number) => {
      const n = Number(v);
      return Number.isFinite(n) && n > 0 ? Math.round(n) : fb;
    };
    const bool = (v: unknown, fb: boolean) => (typeof v === 'boolean' ? v : fb);
    const u = (raw.umbrales ?? {}) as {
      marcar?: { veces?: unknown; dias?: unknown };
      notificar?: { veces?: unknown; dias?: unknown };
      rag?: { veces?: unknown; dias?: unknown };
      ventanaDias?: unknown;
    };
    const n = (raw.notificaciones ?? {}) as {
      mark?: unknown;
      supervisor?: unknown;
      rag?: unknown;
    };
    return {
      umbrales: {
        marcar: {
          veces: posInt(u.marcar?.veces, d.umbrales.marcar.veces),
          dias: posInt(u.marcar?.dias, d.umbrales.marcar.dias),
        },
        notificar: {
          veces: posInt(u.notificar?.veces, d.umbrales.notificar.veces),
          dias: posInt(u.notificar?.dias, d.umbrales.notificar.dias),
        },
        rag: {
          veces: posInt(u.rag?.veces, d.umbrales.rag.veces),
          dias: posInt(u.rag?.dias, d.umbrales.rag.dias),
        },
        ventanaDias: posInt(u.ventanaDias, d.umbrales.ventanaDias),
      },
      notificaciones: {
        mark: bool(n.mark, d.notificaciones.mark),
        supervisor: bool(n.supervisor, d.notificaciones.supervisor),
        rag: bool(n.rag, d.notificaciones.rag),
      },
    };
  } catch {
    return structuredClone(DEFAULT_FALLOS_REPETITIVOS);
  }
}

const RAG_SOURCE_DESCRIPTIONS: Record<string, string> = {
  'Theissler et al. (2021)': 'ML para mantenimiento predictivo, monitoreo de condición y priorización de riesgo.',
  'Pashmforoush et al. (2025)': 'Buenas prácticas de diagnóstico para desgaste, sobrecarga y modos de falla.',
  'Cai et al. (2023)': 'Sensores industriales, análisis de señales y prevención de fallas progresivas.',
  'Araujo et al. (2025)': 'Confiabilidad operacional y mantenimiento preventivo/correctivo en sistemas electromecánicos.',
  'Hesser & Markert (2019)': 'Máquinas herramienta, desgaste de herramienta, vibración y control de proceso.',
  'Jakobs et al. (2026)': 'Gestión de fallas aleatorias, inspección manual y escalamiento técnico seguro.',
};

const DEFAULT_RAG_SOURCES = [
  { titulo: 'Theissler et al. (2021)', autor: 'Theissler et al.', activo: true },
  { titulo: 'Pashmforoush et al. (2025)', autor: 'Pashmforoush et al.', activo: true },
  { titulo: 'Cai et al. (2023)', autor: 'Cai et al.', activo: true },
  { titulo: 'Araujo et al. (2025)', autor: 'Araujo et al.', activo: true },
  { titulo: 'Hesser & Markert (2019)', autor: 'Hesser & Markert', activo: true },
  { titulo: 'Jakobs et al. (2026)', autor: 'Jakobs et al.', activo: true },
] as const;

@Injectable()
export class ConfigCatalogService {
  constructor(
    @InjectModel(ConfiguracionAlertas) private readonly configModel: typeof ConfiguracionAlertas,
    @InjectModel(TipoFallo) private readonly tipoFalloModel: typeof TipoFallo,
    @InjectModel(FuenteRag) private readonly fuenteRagModel: typeof FuenteRag,
    @InjectModel(ReglaNotificacion)
    private readonly reglaNotificacionModel: typeof ReglaNotificacion,
    @InjectModel(AccionEscalada)
    private readonly accionEscaladaModel: typeof AccionEscalada,
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
        tiemposAtencionJson: JSON.stringify(DEFAULT_TIEMPOS_ATENCION),
        fallosRepetitivosJson: JSON.stringify(DEFAULT_FALLOS_REPETITIVOS),
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
      tiempos_atencion: parseTiemposAtencion(cfg.tiemposAtencionJson),
      fallos_repetitivos: parseFallosRepetitivos(cfg.fallosRepetitivosJson),
      horarios_envio: parseDispatchSchedule(cfg.horariosEnvioJson),
    };
  }

  /** Usado por el job de escalamiento. */
  async getTiemposAtencion(): Promise<TiemposAtencion> {
    const cfg = await this.getOrCreateConfig();
    return parseTiemposAtencion(cfg.tiemposAtencionJson);
  }

  /** Usado por el módulo de fallos repetitivos. */
  async getFallosRepetitivosConfig(): Promise<FallosRepetitivosConfig> {
    const cfg = await this.getOrCreateConfig();
    return parseFallosRepetitivos(cfg.fallosRepetitivosJson);
  }

  private static readonly DEFAULT_ESCALATION_ACTIONS = [
    { tipoFallo: 'HDF', acciones: 'Inspección profunda del sistema térmico + evaluar reemplazo' },
    { tipoFallo: 'PWF', acciones: 'Revisión eléctrica completa + certificación del variador' },
    { tipoFallo: 'TWF', acciones: 'Auditoría del ciclo de herramientas + cambio de proveedor' },
    { tipoFallo: 'OSF', acciones: 'Análisis de carga mecánica + revisión de diseño operativo' },
    { tipoFallo: 'RNF', acciones: 'Revisión con especialista externo obligatoria' },
  ];

  async getEscalationActions() {
    let rows = await this.accionEscaladaModel.findAll({
      order: [['tipoFalloCodigo', 'ASC']],
    });
    // Auto-seed si la tabla está vacía (evita el "Cargando…" eterno).
    if (rows.length === 0) {
      await this.accionEscaladaModel.bulkCreate(
        ConfigCatalogService.DEFAULT_ESCALATION_ACTIONS.map((a) => ({
          tipoFalloCodigo: a.tipoFallo,
          accionesAdicionales: a.acciones,
        })),
      );
      rows = await this.accionEscaladaModel.findAll({
        order: [['tipoFalloCodigo', 'ASC']],
      });
    }
    return rows.map((r) => ({
      tipoFallo: r.tipoFalloCodigo,
      acciones: r.accionesAdicionales,
    }));
  }

  /** Texto de acción escalada de un tipo de fallo (para anexar al plan en notificaciones). */
  async getEscalationActionText(tipoFallo: string): Promise<string | null> {
    const row = await this.accionEscaladaModel.findOne({
      where: { tipoFalloCodigo: tipoFallo.toUpperCase() },
    });
    return row?.accionesAdicionales ?? null;
  }

  async patchEscalationAction(tipoFallo: string, acciones: string) {
    const row = await this.accionEscaladaModel.findOne({
      where: { tipoFalloCodigo: tipoFallo.toUpperCase() },
    });
    if (!row) throw new NotFoundException('Acción escalada no encontrada');
    await row.update({ accionesAdicionales: acciones });
    return this.getEscalationActions();
  }

  //actualizar la configuracion
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
    if (values.tiempos_atencion != null) {
      patch.tiemposAtencionJson = JSON.stringify(
        parseTiemposAtencion(JSON.stringify(values.tiempos_atencion)),
      );
    }
    //CONVERTER A JSON
    if (values.fallos_repetitivos != null) {
      patch.fallosRepetitivosJson = JSON.stringify(
        parseFallosRepetitivos(JSON.stringify(values.fallos_repetitivos)),
      );
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
    const t = parseTiemposAtencion(cfg.tiemposAtencionJson);
    const fmt = (min: number | null) => (min == null ? null : `${min}m`);
    return [
      { nivel: 'LOW', min: 0, max: Number(cfg.riesgoBajo), accion: 'Monitorear', tiempoLimite: fmt(t.LOW), escalaA: null },
      { nivel: 'MEDIUM', min: Number(cfg.riesgoBajo), max: Number(cfg.riesgoMedio), accion: 'Notificar', tiempoLimite: fmt(t.MEDIUM), escalaA: 'Supervisor' },
      { nivel: 'HIGH', min: Number(cfg.riesgoMedio), max: Number(cfg.riesgoAlto), accion: 'Inmediata', tiempoLimite: fmt(t.HIGH), escalaA: 'Supervisor' },
      { nivel: 'CRITICAL', min: Number(cfg.riesgoAlto), max: Number(cfg.riesgoCritico), accion: 'Parada', tiempoLimite: fmt(t.CRITICAL), escalaA: 'Jefe planta' },
    ];
  }

  async getRagSources() {
    await this.ensureRagSourcesSeeded();
    const rows = await this.fuenteRagModel.findAll({ order: [['idFuente', 'ASC']] });
    return rows.map((f) => ({
      id: f.idFuente,
      fuente: f.titulo,
      tipoFallo: formatRagSourceFaultLabel(f.titulo),
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
      tipoFallo: formatRagSourceFaultLabel(f.titulo),
      descripcion: RAG_SOURCE_DESCRIPTIONS[f.titulo] ?? f.autor ?? null,
      activa: f.activo,
    };
  }

  private static readonly RISK_ORDER = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];

  private orderNotificationRules(rows: ReglaNotificacion[]) {
    const rank = (nivel: string) => {
      const i = ConfigCatalogService.RISK_ORDER.indexOf(nivel.toUpperCase());
      return i === -1 ? 99 : i;
    };
    return [...rows]
      .sort((a, b) => rank(a.nivel) - rank(b.nivel))
      .map((r) => ({ nivel: r.nivel, recibe: r.recibe, canal: r.canal }));
  }

  async getNotificationRules() {
    const rows = await this.reglaNotificacionModel.findAll();
    return this.orderNotificationRules(rows);
  }

  async patchNotificationRule(
    nivel: string,
    values: { recibe?: string; canal?: string },
  ) {
    const regla = await this.reglaNotificacionModel.findOne({
      where: { nivel: nivel.toUpperCase() },
    });
    if (!regla) throw new NotFoundException('Regla de notificación no encontrada');

    const patch: Partial<ReglaNotificacion> = {};
    if (typeof values.recibe === 'string') patch.recibe = values.recibe.trim();
    if (typeof values.canal === 'string') patch.canal = values.canal.trim();
    await regla.update(patch);

    return this.getNotificationRules();
  }
    private async ensureRagSourcesSeeded(): Promise<void> {
    const count = await this.fuenteRagModel.count();
    if (count > 0) return;
    await this.fuenteRagModel.bulkCreate(
      DEFAULT_RAG_SOURCES.map((item) => ({ ...item })),
    );
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
