import { ModeloMl } from '../../database/models/modelo-ml.model';

const ML_SLUG_TO_NOMBRE: Record<string, string> = {
  xgboost: 'XGBoost',
  random_forest: 'Random Forest',
  regresion_logistica: 'Regresión Logística',
  lightgbm: 'LightGBM',
  decision_tree: 'Decision Tree',
  svm: 'SVM',
};

const ML_NOMBRE_TO_SLUG: Record<string, string> = Object.fromEntries(
  Object.entries(ML_SLUG_TO_NOMBRE).map(([slug, nombre]) => [nombre, slug]),
);

export function mlSlugToNombre(slug: string): string {
  return ML_SLUG_TO_NOMBRE[slug] ?? slug;
}

export function mlNombreToSlug(nombre: string): string {
  return ML_NOMBRE_TO_SLUG[nombre] ?? nombre.toLowerCase().replace(/\s+/g, '_');
}

export async function resolveModeloId(
  slugOrNombre: string,
  etapa: 'S1' | 'S2',
): Promise<number> {
  const nombre = ML_SLUG_TO_NOMBRE[slugOrNombre] ?? slugOrNombre;
  const isS1 = etapa === 'S1';
  const row = await ModeloMl.findOne({
    where: isS1 ? { nombre, esPrediccion: true } : { nombre, esClasificacion: true },
  });
  if (row) return row.idModelo;
  const fallback = await ModeloMl.findOne({
    where: isS1 ? { esPrediccion: true, esDefault: true } : { esClasificacion: true, esDefault: true },
  });
  if (!fallback) throw new Error(`Modelo ML no encontrado: ${slugOrNombre}`);
  return fallback.idModelo;
}

export function modeloSlug(modelo: ModeloMl | undefined, fallback: string): string {
  if (!modelo) return fallback;
  return mlNombreToSlug(modelo.nombre);
}
