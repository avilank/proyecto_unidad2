/**
 * Limpia datos operativos del simulador (lecturas, análisis, órdenes, alertas…)
 * sin borrar usuarios, técnicos, máquinas ni configuración.
 *
 * Uso:
 *   node scripts/reset-demo-day.js --yes           # solo eventos de hoy (desde 00:00)
 *   node scripts/reset-demo-day.js --all --yes     # todo el historial operativo
 *   node scripts/reset-demo-day.js --dry-run       # muestra conteos sin borrar
 */
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const { Sequelize } = require('sequelize');

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const scopeAll = args.includes('--all');

/** Tablas del pipeline v2; las opcionales pueden no existir en BD legacy. */
const CORE_TABLES = [
  'eventos_orden',
  'respuesta_recomendacion',
  'soluciones_aplicadas',
  'observacion_tecnica',
  'alertas',
  'recomendaciones_rag',
  'clasificaciones_fallo',
  'prediccion_fallo',
  'ordenes_mantenimiento',
  'analisis_fallos',
  'lecturas_sensor',
  'audit_logs',
];

const OPTIONAL_TABLES = ['fallo_repetitivo', 'mensaje_enviado'];

function startOfDay() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

async function tableExists(seq, table) {
  const [[row]] = await seq.query(
    `SELECT EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = :table
    ) AS exists`,
    { replacements: { table } },
  );
  return Boolean(row?.exists);
}

async function resolveTables(seq) {
  const existing = [];
  for (const t of [...CORE_TABLES, ...OPTIONAL_TABLES]) {
    if (await tableExists(seq, t)) existing.push(t);
    else console.log(`  (omitida: ${t} no existe en esta BD)`);
  }
  return existing;
}

async function columnExists(seq, table, column) {
  const [[row]] = await seq.query(
    `SELECT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = :table AND column_name = :column
    ) AS exists`,
    { replacements: { table, column } },
  );
  return Boolean(row?.exists);
}

async function resetTechnicians(seq, transaction) {
  if (!(await tableExists(seq, 'tecnicos'))) return;

  if (await columnExists(seq, 'tecnicos', 'disponibilidad')) {
    const [, meta] = await seq.query(
      `UPDATE tecnicos SET disponibilidad = 'disponible' WHERE disponibilidad = 'en_intervencion'`,
      { transaction },
    );
    console.log(`  ✓ técnicos liberados: ${meta?.rowCount ?? 0}`);
    return;
  }

  if (await columnExists(seq, 'tecnicos', 'estado')) {
    const [, meta] = await seq.query(
      `UPDATE tecnicos SET estado = 'disponible' WHERE estado = 'en_intervencion'`,
      { transaction },
    );
    console.log(`  ✓ técnicos liberados: ${meta?.rowCount ?? 0}`);
  }
}

async function countTable(seq, table, whereSql = '', replacements = {}) {
  if (!(await tableExists(seq, table))) return 0;
  const where = whereSql ? ` WHERE ${whereSql}` : '';
  const [[{ count }]] = await seq.query(`SELECT COUNT(*)::int AS count FROM ${table}${where}`, {
    replacements,
  });
  return count;
}

async function deleteToday(seq, startDay, transaction, existingTables) {
  const rep = { startDay };
  const has = (name) => existingTables.includes(name);

  const steps = [];

  if (has('eventos_orden')) {
    steps.push({
      label: 'eventos_orden',
      sql: `DELETE FROM eventos_orden WHERE id_orden IN (
        SELECT id_orden FROM ordenes_mantenimiento WHERE fecha_creacion >= :startDay
      )`,
    });
  }
  if (has('respuesta_recomendacion')) {
    steps.push({
      label: 'respuesta_recomendacion',
      sql: `DELETE FROM respuesta_recomendacion WHERE id_orden IN (
        SELECT id_orden FROM ordenes_mantenimiento WHERE fecha_creacion >= :startDay
      )`,
    });
  }
  if (has('soluciones_aplicadas')) {
    steps.push({
      label: 'soluciones_aplicadas',
      sql: `DELETE FROM soluciones_aplicadas WHERE id_orden IN (
        SELECT id_orden FROM ordenes_mantenimiento WHERE fecha_creacion >= :startDay
      )`,
    });
  }
  if (has('observacion_tecnica')) {
    steps.push({
      label: 'observacion_tecnica',
      sql: `DELETE FROM observacion_tecnica WHERE id_orden IN (
        SELECT id_orden FROM ordenes_mantenimiento WHERE fecha_creacion >= :startDay
      )`,
    });
  }
  if (has('alertas')) {
    steps.push({
      label: 'alertas',
      sql: `DELETE FROM alertas WHERE id_orden IN (
          SELECT id_orden FROM ordenes_mantenimiento WHERE fecha_creacion >= :startDay
        ) OR id_analisis IN (
          SELECT id_analisis FROM analisis_fallos WHERE fecha_analisis >= :startDay
        )`,
    });
  }
  if (has('recomendaciones_rag')) {
    steps.push({
      label: 'recomendaciones_rag',
      sql: `DELETE FROM recomendaciones_rag WHERE id_clasificacion IN (
        SELECT id_clasificacion FROM clasificaciones_fallo WHERE id_analisis IN (
          SELECT id_analisis FROM analisis_fallos WHERE fecha_analisis >= :startDay
        )
      )`,
    });
  }
  if (has('clasificaciones_fallo')) {
    steps.push({
      label: 'clasificaciones_fallo',
      sql: `DELETE FROM clasificaciones_fallo WHERE id_analisis IN (
        SELECT id_analisis FROM analisis_fallos WHERE fecha_analisis >= :startDay
      )`,
    });
  }
  if (has('prediccion_fallo')) {
    steps.push({
      label: 'prediccion_fallo',
      sql: `DELETE FROM prediccion_fallo WHERE id_analisis IN (
        SELECT id_analisis FROM analisis_fallos WHERE fecha_analisis >= :startDay
      )`,
    });
  }
  if (has('ordenes_mantenimiento')) {
    steps.push({
      label: 'ordenes_mantenimiento',
      sql: `DELETE FROM ordenes_mantenimiento WHERE fecha_creacion >= :startDay`,
    });
  }
  if (has('analisis_fallos')) {
    steps.push({
      label: 'analisis_fallos',
      sql: `DELETE FROM analisis_fallos WHERE fecha_analisis >= :startDay`,
    });
  }
  if (has('lecturas_sensor')) {
    steps.push({
      label: 'lecturas_sensor',
      sql: `DELETE FROM lecturas_sensor WHERE fecha_lectura >= :startDay`,
    });
  }
  if (has('fallo_repetitivo')) {
    steps.push({
      label: 'fallo_repetitivo',
      sql: `DELETE FROM fallo_repetitivo WHERE ultima_ocurrencia_en >= :startDay`,
    });
  }
  if (has('mensaje_enviado')) {
    steps.push({
      label: 'mensaje_enviado',
      sql: `DELETE FROM mensaje_enviado WHERE enviado_en >= :startDay`,
    });
  }
  if (has('audit_logs')) {
    steps.push({
      label: 'audit_logs',
      sql: `DELETE FROM audit_logs WHERE fecha_registro >= :startDay`,
    });
  }

  for (const step of steps) {
    if (dryRun) {
      console.log(`  [dry-run] ${step.label}`);
      continue;
    }
    const [, meta] = await seq.query(step.sql, { replacements: rep, transaction });
    console.log(`  ✓ ${step.label}: ${meta?.rowCount ?? '?'} filas`);
  }

  if (!dryRun) {
    await resetTechnicians(seq, transaction);
  }
}

async function deleteAll(seq, transaction, existingTables) {
  if (dryRun) {
    for (const t of existingTables) {
      const n = await countTable(seq, t);
      console.log(`  [dry-run] ${t}: ${n} filas`);
    }
    return;
  }

  if (existingTables.length === 0) {
    console.log('  (no hay tablas operativas que limpiar)');
    return;
  }

  await seq.query(
    `TRUNCATE TABLE ${existingTables.join(', ')} RESTART IDENTITY CASCADE`,
    { transaction },
  );
  console.log(`  ✓ TRUNCATE ${existingTables.length} tablas operativas`);

  await resetTechnicians(seq, transaction);
}

async function main() {
  const seq = new Sequelize({
    dialect: 'postgres',
    host: process.env.DATABASE_HOST || 'localhost',
    port: parseInt(process.env.DATABASE_PORT || '5432', 10),
    username: process.env.DATABASE_USER || 'postgres',
    password: String(process.env.DATABASE_PASSWORD ?? ''),
    database: process.env.DATABASE_NAME || 'mantto_bd_v2',
    logging: false,
  });

  const startDay = startOfDay();
  const mode = scopeAll
    ? 'TODO el historial operativo'
    : `eventos de hoy (desde ${startDay.toLocaleString('es-PE')})`;

  console.log(`PredictMaint — reset demo`);
  console.log(`  BD: ${process.env.DATABASE_NAME} @ ${process.env.DATABASE_HOST}`);
  console.log(`  Alcance: ${mode}`);
  if (dryRun) console.log('  Modo: dry-run (sin cambios)');

  if (!dryRun && !args.includes('--yes')) {
    console.log('\n  Agrega --yes para confirmar el borrado.');
    console.log('  Ejemplo: node scripts/reset-demo-day.js --yes');
    console.log('           node scripts/reset-demo-day.js --all --yes');
    await seq.close();
    process.exit(1);
  }

  console.log('');
  const existingTables = await resolveTables(seq);
  console.log('');

  const before = {
    lecturas: await countTable(seq, 'lecturas_sensor'),
    analisis: await countTable(seq, 'analisis_fallos'),
    ordenes: await countTable(seq, 'ordenes_mantenimiento'),
    alertas: await countTable(seq, 'alertas'),
  };
  console.log('Antes:', before);

  if (dryRun) {
    if (scopeAll) await deleteAll(seq, null, existingTables);
    else await deleteToday(seq, startDay, null, existingTables);
    await seq.close();
    return;
  }

  await seq.transaction(async (transaction) => {
    if (scopeAll) {
      await deleteAll(seq, transaction, existingTables);
    } else {
      await deleteToday(seq, startDay, transaction, existingTables);
    }
  });

  const after = {
    lecturas: await countTable(seq, 'lecturas_sensor'),
    analisis: await countTable(seq, 'analisis_fallos'),
    ordenes: await countTable(seq, 'ordenes_mantenimiento'),
    alertas: await countTable(seq, 'alertas'),
  };
  console.log('Después:', after);
  console.log('\nListo. Reinicia el simulador para generar eventos nuevos.');

  await seq.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
