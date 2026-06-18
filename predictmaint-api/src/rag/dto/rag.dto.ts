import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class RejectRagPlanDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  motivo?: string;
}

export class RegenerateRagPlanDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  escalado?: boolean;
}
