import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { RunPredictionDto } from './dto/run-prediction.dto';
import { PredictionsService } from './predictions.service';

@ApiTags('predictions')
@Controller('predictions')
export class PredictionsController {
  constructor(private readonly predictionsService: PredictionsService) {}

  @Get('binary/:orderId')
  @ApiOperation({ summary: 'Predicciones binarias S-1' })
  getBinary(@Param('orderId') orderId: string) {
    return this.predictionsService.getBinary(orderId);
  }

  @Get('multiclass/:orderId')
  @ApiOperation({ summary: 'Predicciones multiclase S-2' })
  getMulticlass(@Param('orderId') orderId: string) {
    return this.predictionsService.getMulticlass(orderId);
  }

  @Post('run/:orderId')
  @ApiOperation({ summary: 'Re-ejecutar inferencia' })
  run(@Param('orderId') orderId: string, @Body() dto: RunPredictionDto) {
    return this.predictionsService.run(orderId, dto.etapa);
  }
}
