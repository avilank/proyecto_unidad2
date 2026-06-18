import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectConnection } from '@nestjs/sequelize';
import { Sequelize } from 'sequelize-typescript';
import { DatabaseSeedService } from './database-seed.service';

/**
 * Sync de modelos Sequelize v2 al arrancar (DATABASE_SYNC=true).
 * Seed programático si no hay usuarios (DATABASE_SEED=true).
 */
@Injectable()
export class DatabaseBootstrapService implements OnApplicationBootstrap {
  private readonly logger = new Logger(DatabaseBootstrapService.name);

  constructor(
    @InjectConnection() private readonly sequelize: Sequelize,
    private readonly config: ConfigService,
    private readonly seedService: DatabaseSeedService,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    if (this.config.get<string>('database.sync') === 'true') {
      this.logger.log('Sincronizando tablas v2…');
      await this.sequelize.sync({
        force: this.config.get<string>('database.force') === 'true',
        alter: this.config.get<string>('database.alter') === 'true',
      });
      this.logger.log('Tablas listas.');
    }

    if (this.config.get<string>('database.seed') === 'true') {
      await this.seedService.seedIfEmpty();
    }
  }
}
