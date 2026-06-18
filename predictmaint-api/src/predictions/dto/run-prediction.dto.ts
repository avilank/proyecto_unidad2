import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';
import { EtapaModelo } from '../../common/enums';

export class RunPredictionDto {
  @ApiProperty({ enum: EtapaModelo })
  @IsEnum(EtapaModelo)
  etapa!: EtapaModelo;
}
