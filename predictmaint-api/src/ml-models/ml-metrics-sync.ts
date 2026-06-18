import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import type { ModeloMl } from '../database/models/modelo-ml.model';
import { mlSlugToNombre } from '../common/utils/modelo-ml.util';

export interface MetricsFile {
  s1?: Record<string, S1MetricsEntry>;
  s2?: Record<string, S2MetricsEntry>;
}

export interface S1MetricsEntry {
  accuracy?: number;
  rocAuc?: number;
  precision?: number;
  recall?: number;
  f1Score?: number;
  tn?: number;
  fp?: number;
  fn?: number;
  tp?: number;
}

export interface S2MetricsEntry {
  accuracy?: number;
  f1Macro?: number;
  f1Weighted?: number;
  tp?: number;
  fn?: number;
  fp?: number;
  tn?: number;
}

export interface MlBinaryMetricsPayload {
  accuracy?: number;
  rocAuc?: number;
  precision?: number;
  recall?: number;
  f1Score?: number;
  tn?: number;
  fp?: number;
  fn?: number;
  tp?: number;
}

export interface MlMulticlassMetricsPayload {
  accuracy?: number;
  f1Macro?: number;
  f1Weighted?: number;
  tp?: number;
  fn?: number;
  fp?: number;
  tn?: number;
}

export function defaultMetricsPath(): string {
  const envPath = process.env.ML_METRICS_PATH;
  if (envPath) return resolve(envPath);
  return resolve(__dirname, '../../../predictmaint-ml/artifacts/metrics.json');
}

export function loadMetricsFile(filePath = defaultMetricsPath()): MetricsFile | null {
  if (!existsSync(filePath)) return null;
  return JSON.parse(readFileSync(filePath, 'utf-8')) as MetricsFile;
}

export function s1CatalogPatch(metrics: S1MetricsEntry) {
  return {
    accuracy: metrics.accuracy ?? null,
    rocAuc: metrics.rocAuc ?? null,
    precisionScore: metrics.precision ?? null,
    recallScore: metrics.recall ?? null,
    f1Score: metrics.f1Score ?? null,
    tn: metrics.tn ?? null,
    fp: metrics.fp ?? null,
    fn: metrics.fn ?? null,
    tp: metrics.tp ?? null,
  };
}

export function s2CatalogPatch(metrics: S2MetricsEntry) {
  return {
    accuracy: metrics.accuracy ?? null,
    f1Score: metrics.f1Macro ?? null,
    f1Weighted: metrics.f1Weighted ?? null,
    tp: metrics.tp ?? null,
    fn: metrics.fn ?? null,
    fp: metrics.fp ?? null,
    tn: metrics.tn ?? null,
  };
}

export function s1PredictionPatch(metrics: MlBinaryMetricsPayload) {
  return s1CatalogPatch(metrics);
}

export function s2PredictionPatch(metrics: MlMulticlassMetricsPayload) {
  return {
    metricAccuracy: metrics.accuracy ?? null,
    metricF1Macro: metrics.f1Macro ?? null,
    metricF1Weighted: metrics.f1Weighted ?? null,
    metricTp: metrics.tp ?? null,
    metricFn: metrics.fn ?? null,
    metricFp: metrics.fp ?? null,
    metricTn: metrics.tn ?? null,
  };
}

export async function syncMetricsToCatalog(
  modeloModel: typeof ModeloMl,
  filePath = defaultMetricsPath(),
): Promise<number> {
  const data = loadMetricsFile(filePath);
  if (!data) return 0;

  let updated = 0;

  for (const [slug, metrics] of Object.entries(data.s1 ?? {})) {
    const nombre = mlSlugToNombre(slug);
    const [count] = await modeloModel.update(s1CatalogPatch(metrics), {
      where: { nombre, esPrediccion: true },
    });
    if (count) updated += count;
  }

  for (const [slug, metrics] of Object.entries(data.s2 ?? {})) {
    const nombre = mlSlugToNombre(slug);
    const [count] = await modeloModel.update(s2CatalogPatch(metrics), {
      where: { nombre, esClasificacion: true },
    });
    if (count) updated += count;
  }

  return updated;
}
