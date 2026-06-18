import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { SseJwtQueryGuard } from '../common/guards/sse-jwt-query.guard';
import { MonitoringController } from './monitoring.controller';
import { MonitoringSseListener } from './monitoring-sse.listener';
import { MonitoringSseService } from './monitoring-sse.service';

@Module({
  imports: [AuthModule],
  controllers: [MonitoringController],
  providers: [MonitoringSseService, MonitoringSseListener, SseJwtQueryGuard],
  exports: [MonitoringSseService],
})
export class MonitoringModule {}
