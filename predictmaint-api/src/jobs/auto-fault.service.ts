import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import { InjectModel } from '@nestjs/sequelize';
import { Op } from 'sequelize';
import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';
import { EstadoOrden } from '../common/enums';
import { Maquina } from '../database/models/maquina.model';
import { Orden } from '../database/models/orden.model';

interface FailureRow {
  type: string; // calidad de la fila (L/M/H)
  fault: string; // tipo de falla del dataset (HDF/PWF/TWF/OSF/RNF)
  isFailure: boolean; // 1 si el dataset marca fallo real
  airTemperature: number;
  processTemperature: number;
  rotationalSpeed: number;
  torque: number;
  toolWear: number;
}

const FAULT_TYPES = ['HDF', 'PWF', 'TWF', 'OSF', 'RNF'];
// one-hot del dataset: índice → tipo
const FAULT_COLS: [number, string][] = [
  [9, 'TWF'],
  [10, 'HDF'],
  [11, 'PWF'],
  [12, 'OSF'],
  [13, 'RNF'],
];

/**
 * Generador automático de fallas (demo): cada N minutos inyecta una falla en una máquina
 * SIN orden activa, reusando el pipeline real (/sensor-readings). Sesga el tipo de falla por
 * máquina (tipo dominante con prob. DEMO_AUTOFAULT_BIAS) para que los fallos repetitivos
 * aparezcan de forma confiable, sin verse 100% artificial. NO completa órdenes (eso es manual).
 *
 * Se activa con DEMO_AUTOFAULT_ENABLED=true.
 */
@Injectable()
export class AutoFaultService implements OnModuleInit {
  private readonly logger = new Logger(AutoFaultService.name);
  private rowsByFault = new Map<string, FailureRow[]>();
  private mildRowsByFault = new Map<string, FailureRow[]>();
  private hardRowsByFault = new Map<string, FailureRow[]>();
  private allRows: FailureRow[] = [];
  private lastFire = 0;

  constructor(
    @InjectModel(Orden) private readonly ordenModel: typeof Orden,
    @InjectModel(Maquina) private readonly maquinaModel: typeof Maquina,
    private readonly config: ConfigService,
  ) {}

  private get enabled(): boolean {
    return (process.env.DEMO_AUTOFAULT_ENABLED ?? 'false').toLowerCase() === 'true';
  }
  private get intervalMin(): number {
    const n = Number(process.env.DEMO_AUTOFAULT_MIN ?? '30');
    return Number.isFinite(n) && n > 0 ? n : 30;
  }
  /** Probabilidad de usar el tipo de falla dominante de la máquina (0–1). */
  private get bias(): number {
    const n = Number(process.env.DEMO_AUTOFAULT_BIAS ?? '0.7');
    return Number.isFinite(n) && n >= 0 && n <= 1 ? n : 0.7;
  }
  /** Máximo de órdenes activas a la vez; si se supera, no genera (anti-saturación). */
  private get maxActivas(): number {
    const n = Number(process.env.DEMO_AUTOFAULT_MAX_ACTIVAS ?? '3');
    return Number.isFinite(n) && n > 0 ? n : 3;
  }
  /** Prob. de inyectar una fila "fuerte" (fallo real) vs una "suave". */
  private get hardRate(): number {
    const n = Number(process.env.DEMO_AUTOFAULT_HARD_RATE ?? '0.45');
    return Number.isFinite(n) && n >= 0 && n <= 1 ? n : 0.45;
  }

  onModuleInit(): void {
    if (!this.enabled) return;
    this.loadFailureRows();
  }

  private csvPath(): string | null {
    const candidates = [
      process.env.DEMO_DATASET_PATH,
      resolve(process.cwd(), '..', 'ai4i2020.csv'),
      resolve(process.cwd(), 'ai4i2020.csv'),
      resolve(process.cwd(), '..', 'predictmaint-ml', 'ai4i2020.csv'),
    ].filter(Boolean) as string[];
    return candidates.find((p) => existsSync(p)) ?? null;
  }

  private triggersRule(r: FailureRow): boolean {
    const diff = r.processTemperature - r.airTemperature;
    const power = (r.torque * r.rotationalSpeed * 2 * Math.PI) / 60;
    return (
      diff > 8.6 ||
      r.rotationalSpeed < 1380 ||
      power < 3500 ||
      power > 9000 ||
      r.toolWear >= 200 ||
      r.torque * r.toolWear > 5000
    );
  }

  private loadFailureRows(): void {
    const path = this.csvPath();
    if (!path) {
      this.logger.warn('AutoFault: dataset ai4i2020.csv no encontrado; deshabilitado');
      return;
    }
    try {
      const lines = readFileSync(path, 'utf-8').split(/\r?\n/).filter(Boolean);
      for (let i = 1; i < lines.length; i++) {
        const c = lines[i].split(',');
        if (c.length < 14) continue;
        const isFailure = c[8].trim() === '1';
        let fault = 'RNF';
        for (const [idx, name] of FAULT_COLS) {
          if (c[idx]?.trim() === '1') {
            fault = name;
            break;
          }
        }
        const row: FailureRow = {
          type: c[2].trim(),
          fault,
          isFailure,
          airTemperature: parseFloat(c[3]),
          processTemperature: parseFloat(c[4]),
          rotationalSpeed: Math.round(parseFloat(c[5])),
          torque: parseFloat(c[6]),
          toolWear: Math.round(parseFloat(c[7])),
        };
        if (!this.triggersRule(row)) continue;
        this.allRows.push(row);
        const list = this.rowsByFault.get(fault) ?? [];
        list.push(row);
        this.rowsByFault.set(fault, list);
        const bucket = isFailure ? this.hardRowsByFault : this.mildRowsByFault;
        const listBySeverity = bucket.get(fault) ?? [];
        listBySeverity.push(row);
        bucket.set(fault, listBySeverity);
      }
      const resumen = FAULT_TYPES.map((t) => `${t}:${this.rowsByFault.get(t)?.length ?? 0}`).join(' ');
      const resumenHard = FAULT_TYPES.map((t) => `${t}:${this.hardRowsByFault.get(t)?.length ?? 0}`).join(' ');
      const resumenMild = FAULT_TYPES.map((t) => `${t}:${this.mildRowsByFault.get(t)?.length ?? 0}`).join(' ');
      this.logger.log(
        `AutoFault activo · ${this.allRows.length} filas (${resumen}) · hard(${resumenHard}) mild(${resumenMild}) · intervalo ${this.intervalMin} min · sesgo ${this.bias} · hardRate ${this.hardRate}`,
      );
    } catch (err) {
      this.logger.warn(`AutoFault: error leyendo dataset: ${(err as Error).message}`);
    }
  }

  private pick<T>(arr: T[]): T {
    return arr[Math.floor(Math.random() * arr.length)];
  }

  /** Tipo de falla dominante (determinista) de una máquina por su código. */
  private dominantFault(codigo: string): string {
    let h = 0;
    for (const ch of codigo) h = (h + ch.charCodeAt(0)) % 9973;
    return FAULT_TYPES[h % FAULT_TYPES.length];
  }

  @Cron('15 * * * * *')
  async tick(): Promise<void> {
    if (!this.enabled || this.allRows.length === 0) return;
    const now = Date.now();
    if (now - this.lastFire < this.intervalMin * 60_000) return;

    // Órdenes activas (para guardarraíl y para saber qué máquinas están ocupadas).
    const activas = await this.ordenModel.findAll({
      where: { estado: { [Op.in]: [EstadoOrden.PENDIENTE, EstadoOrden.EN_PROGRESO] } },
      attributes: ['idMaquina'],
    });

    // Guardarraíl: no saturar. (No actualiza lastFire → reintenta cuando se libere.)
    if (activas.length >= this.maxActivas) {
      this.logger.debug(
        `AutoFault: ${activas.length} órdenes activas ≥ máx ${this.maxActivas}; espera`,
      );
      return;
    }

    const ocupadas = new Set(activas.map((o) => o.idMaquina));
    const maquinas = await this.maquinaModel.findAll({
      attributes: ['codigo', 'idMaquina'],
    });
    const libres = maquinas.filter((m) => !ocupadas.has(m.idMaquina));
    if (libres.length === 0) {
      this.logger.debug('AutoFault: ninguna máquina libre en este momento');
      return;
    }

    const maquina = this.pick(libres);
    // Sesgo: tipo dominante de la máquina con prob. `bias`, si no uno al azar.
    const tipoFalla =
      Math.random() < this.bias ? this.dominantFault(maquina.codigo) : this.pick(FAULT_TYPES);
    const hardPool = this.hardRowsByFault.get(tipoFalla) ?? [];
    const mildPool = this.mildRowsByFault.get(tipoFalla) ?? [];
    const useHard = Math.random() < this.hardRate;
    const bySeverityPool = useHard
      ? (hardPool.length ? hardPool : mildPool)
      : (mildPool.length ? mildPool : hardPool);
    const pool = bySeverityPool.length
      ? bySeverityPool
      : (this.rowsByFault.get(tipoFalla)?.length ? this.rowsByFault.get(tipoFalla)! : this.allRows);
    const row = this.pick(pool);

    const payload = {
      maquinaId: maquina.codigo,
      tipo: row.type,
      airTemperature: row.airTemperature,
      processTemperature: row.processTemperature,
      rotationalSpeed: row.rotationalSpeed,
      torque: row.torque,
      toolWear: row.toolWear,
      capturadoEn: new Date().toISOString(),
    };

    const port = this.config.get<number>('PORT') ?? process.env.PORT ?? 3001;
    try {
      const res = await fetch(`http://localhost:${port}/sensor-readings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      this.lastFire = now;
      if (res.ok) {
        this.logger.log(
          `AutoFault → falla en ${maquina.codigo} (intención ${tipoFalla}, fila ${row.fault}, ${row.isFailure ? 'hard' : 'mild'})`,
        );
      } else {
        this.logger.warn(`AutoFault: /sensor-readings respondió ${res.status}`);
      }
    } catch (err) {
      this.logger.warn(`AutoFault: error al inyectar lectura: ${(err as Error).message}`);
    }
  }
}
