import { Module } from '@nestjs/common';
import { DatabaseBootstrapService } from './database-bootstrap.service';
import { DatabaseSeedService } from './database-seed.service';

@Module({
  providers: [DatabaseBootstrapService, DatabaseSeedService],
})
export class DatabaseModule {}