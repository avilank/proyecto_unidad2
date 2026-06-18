require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const { Sequelize } = require('sequelize');

const PASSWORD_HASH =
  '$2b$10$FCywzye.uD3YVdILNKo.te09gVSMP0clcaRciOpVXpnxjPuRaM7iS';

async function main() {
  const seq = new Sequelize({
    dialect: 'postgres',
    host: process.env.DATABASE_HOST || 'localhost',
    port: parseInt(process.env.DATABASE_PORT || '5432', 10),
    username: process.env.DATABASE_USER || 'postgres',
    password: String(process.env.DATABASE_PASSWORD ?? ''),
    database: process.env.DATABASE_NAME || 'mantto_bd',
    logging: false,
  });

  await seq.query(
    `UPDATE usuario SET password_hash = :hash WHERE email = 'operador@planta.pe'`,
    { replacements: { hash: PASSWORD_HASH } },
  );
  console.log('Contraseña demo actualizada → password123');
  await seq.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
