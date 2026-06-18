import { SequelizeModuleAsyncOptions } from '@nestjs/sequelize';
import { ConfigService } from '@nestjs/config';
import { Dialect } from 'sequelize';
import { models } from '../database/models';

/**
 * Misma convención que lord-academy-services:
 * DATABASE_SYNC=true crea/actualiza tablas al arrancar (solo desarrollo).
 * DATABASE_FORCE=true borra y recrea todo. DATABASE_ALTER=true ajusta columnas.
 */
export const sequelizeConfig: SequelizeModuleAsyncOptions = {
  inject: [ConfigService],
  useFactory: (config: ConfigService) => {
    const url = config.get<string | undefined>('database.url');
    const base = {
      dialect: 'postgres' as Dialect,
      models,
      autoLoadModels: false,
      synchronize: false,
      logging:
        config.get<string>('database.logging') === 'true' ? console.log : false,
      define: {
        underscored: true,
        timestamps: false,
      },
      timezone: 'UTC',
      pool: {
        max: 20,
        min: 0,
        acquire: 30000,
        idle: 10000,
      },
    };

    if (url) {
      return { ...base, uri: url };
    }

    return {
      ...base,
      host: config.get<string>('database.host'),
      port: config.get<number>('database.port'),
      username: config.get<string>('database.username'),
      password: config.get<string>('database.password'),
      database: config.get<string>('database.name'),
    };
  },
};
