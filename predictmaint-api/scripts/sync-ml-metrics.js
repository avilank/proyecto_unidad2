/**
 * Sincroniza predictmaint-ml/artifacts/metrics.json → modelos_ml
 *
 * Uso:
 *   node scripts/sync-ml-metrics.js
 *   ML_METRICS_PATH=../predictmaint-ml/artifacts/metrics.json node scripts/sync-ml-metrics.js
 */
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const { Sequelize, DataTypes } = require('sequelize');
const { readFileSync, existsSync } = require('fs');
const { resolve } = require('path');

const SLUG_TO_NOMBRE = {
  regresion_logistica: 'Regresión Logística',
  random_forest: 'Random Forest',
  xgboost: 'XGBoost',
  decision_tree: 'Decision Tree',
  lightgbm: 'LightGBM',
  svm: 'SVM',
};

function metricsPath() {
  if (process.env.ML_METRICS_PATH) return resolve(process.env.ML_METRICS_PATH);
  return resolve(__dirname, '../../predictmaint-ml/artifacts/metrics.json');
}

async function main() {
  const filePath = metricsPath();
  if (!existsSync(filePath)) {
    console.error(`No se encontró metrics.json en ${filePath}`);
    process.exit(1);
  }

  const data = JSON.parse(readFileSync(filePath, 'utf-8'));
  const sequelize = new Sequelize(
    process.env.DATABASE_NAME || process.env.DB_NAME || 'predictmaint',
    process.env.DATABASE_USER || process.env.DB_USER || 'predictmaint',
    process.env.DATABASE_PASSWORD ?? process.env.DB_PASSWORD ?? '',
    {
      host: process.env.DATABASE_HOST || process.env.DB_HOST || 'localhost',
      port: Number(process.env.DATABASE_PORT || process.env.DB_PORT || 5432),
      dialect: 'postgres',
      logging: false,
    },
  );

  const ModeloMl = sequelize.define(
    'ModeloMl',
    {
      idModelo: { type: DataTypes.INTEGER, primaryKey: true, field: 'id_modelo' },
      nombre: DataTypes.STRING,
      esPrediccion: { type: DataTypes.BOOLEAN, field: 'es_prediccion' },
      esClasificacion: { type: DataTypes.BOOLEAN, field: 'es_clasificacion' },
      accuracy: DataTypes.DECIMAL,
      rocAuc: { type: DataTypes.DECIMAL, field: 'roc_auc' },
      precisionScore: { type: DataTypes.DECIMAL, field: 'precision_score' },
      recallScore: { type: DataTypes.DECIMAL, field: 'recall_score' },
      f1Score: { type: DataTypes.DECIMAL, field: 'f1_score' },
      f1Weighted: { type: DataTypes.DECIMAL, field: 'f1_weighted' },
      tn: DataTypes.INTEGER,
      fp: DataTypes.INTEGER,
      fn: DataTypes.INTEGER,
      tp: DataTypes.INTEGER,
    },
    { tableName: 'modelos_ml', timestamps: false },
  );

  let updated = 0;

  for (const [slug, metrics] of Object.entries(data.s1 || {})) {
    const nombre = SLUG_TO_NOMBRE[slug];
    if (!nombre) continue;
    const [count] = await ModeloMl.update(
      {
        accuracy: metrics.accuracy,
        rocAuc: metrics.rocAuc,
        precisionScore: metrics.precision,
        recallScore: metrics.recall,
        f1Score: metrics.f1Score,
        tn: metrics.tn,
        fp: metrics.fp,
        fn: metrics.fn,
        tp: metrics.tp,
      },
      { where: { nombre, esPrediccion: true } },
    );
    if (count) {
      updated += count;
      console.log(`S-1 ${nombre}: accuracy=${metrics.accuracy}% rocAuc=${metrics.rocAuc}`);
    }
  }

  for (const [slug, metrics] of Object.entries(data.s2 || {})) {
    const nombre = SLUG_TO_NOMBRE[slug];
    if (!nombre) continue;
    const [count] = await ModeloMl.update(
      {
        accuracy: metrics.accuracy,
        f1Score: metrics.f1Macro,
        f1Weighted: metrics.f1Weighted,
        tp: metrics.tp,
        fn: metrics.fn,
        fp: metrics.fp,
        tn: metrics.tn,
      },
      { where: { nombre, esClasificacion: true } },
    );
    if (count) {
      updated += count;
      console.log(`S-2 ${nombre}: accuracy=${metrics.accuracy}% f1Macro=${metrics.f1Macro}`);
    }
  }

  await sequelize.close();
  console.log(`\nSync completado · ${updated} modelo(s) actualizado(s)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
