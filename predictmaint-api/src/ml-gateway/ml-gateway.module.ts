import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import mlConfig from '../config/ml.config';
import { MlGatewayService } from './ml-gateway.service';

@Module({
  imports: [ConfigModule.forFeature(mlConfig)],
  providers: [MlGatewayService],
  exports: [MlGatewayService],
})
export class MlGatewayModule {}
