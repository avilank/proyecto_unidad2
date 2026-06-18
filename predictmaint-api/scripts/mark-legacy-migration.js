'use strict';

const { Sequelize } = require('sequelize');
require('dotenv').config();

const sequelize = new Sequelize(
  process.env.DATABASE_NAME,
  process.env.DATABASE_USER,
  process.env.DATABASE_PASSWORD,
  {
    host: process.env.DATABASE_HOST,
    port: process.env.DATABASE_PORT,
    dialect: 'postgres',
    logging: false,
  },
);

async function main() {
  await sequelize.query(`
    CREATE TABLE IF NOT EXISTS "SequelizeMeta" (
      name VARCHAR(255) NOT NULL PRIMARY KEY
    );
  `);

  const [rows] = await sequelize.query(
    `SELECT name FROM "SequelizeMeta" WHERE name = '20260617000001-create-all-tables.js';`,
  );

  if (!rows.length) {
    await sequelize.query(
      `INSERT INTO "SequelizeMeta" (name) VALUES ('20260617000001-create-all-tables.js');`,
    );
    console.log('Marcada migración legacy como aplicada.');
  } else {
    console.log('Migración legacy ya estaba marcada.');
  }

  await sequelize.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
