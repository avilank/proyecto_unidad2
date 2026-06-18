const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../../.env') });

function buildConfig() {
  if (process.env.DATABASE_URL) {
    return {
      url: process.env.DATABASE_URL,
      dialect: 'postgres',
      logging: false,
    };
  }

  return {
    dialect: 'postgres',
    host: process.env.DATABASE_HOST || 'localhost',
    port: parseInt(process.env.DATABASE_PORT || '5432', 10),
    username: process.env.DATABASE_USER || 'postgres',
    password: String(process.env.DATABASE_PASSWORD ?? ''),
    database: process.env.DATABASE_NAME || 'predictmaint',
    logging: false,
  };
}

const shared = buildConfig();

module.exports = {
  development: shared,
  test: shared,
  production: shared,
};
