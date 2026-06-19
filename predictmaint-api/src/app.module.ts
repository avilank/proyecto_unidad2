import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ScheduleModule } from '@nestjs/schedule';
import { SequelizeModule } from '@nestjs/sequelize';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import authConfig from './config/auth.config';
import databaseConfig from './config/database.config';
import mlConfig from './config/ml.config';
import notificationsConfig from './config/notifications.config';
import { sequelizeConfig } from './config/sequelize.config';
import { DatabaseModule } from './database/database.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { TechniciansModule } from './technicians/technicians.module';
import { MachinesModule } from './machines/machines.module';
import { SensorReadingsModule } from './sensor-readings/sensor-readings.module';
import { OrdersModule } from './orders/orders.module';
import { AlertsModule } from './alerts/alerts.module';
import { PredictionsModule } from './predictions/predictions.module';
import { RagModule } from './rag/rag.module';
import { RepetitiveFaultsModule } from './repetitive-faults/repetitive-faults.module';
import { NotificationsModule } from './notifications/notifications.module';
import { MlModelsModule } from './ml-models/ml-models.module';
import { ConfigCatalogModule } from './config-catalog/config-catalog.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { MlGatewayModule } from './ml-gateway/ml-gateway.module';
import { JobsModule } from './jobs/jobs.module';
import { MonitoringModule } from './monitoring/monitoring.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [databaseConfig, authConfig, mlConfig, notificationsConfig],
    }),
    EventEmitterModule.forRoot(),
    ScheduleModule.forRoot(),
    SequelizeModule.forRootAsync(sequelizeConfig),
    DatabaseModule,
    AuthModule,
    UsersModule,
    TechniciansModule,
    MachinesModule,
    SensorReadingsModule,
    OrdersModule,
    AlertsModule,
    PredictionsModule,
    RagModule,
    RepetitiveFaultsModule,
    NotificationsModule,
    MlModelsModule,
    ConfigCatalogModule,
    AnalyticsModule,
    MlGatewayModule,
    JobsModule,
    MonitoringModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
  ],
})
export class AppModule {}
