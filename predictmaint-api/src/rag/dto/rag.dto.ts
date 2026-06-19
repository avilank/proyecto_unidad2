import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsBoolean, IsInt, IsOptional, IsString } from 'class-validator';

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

  @ApiPropertyOptional({ type: [Number], description: 'IDs de fuentes RAG a usar en la regeneración' })
  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  fuenteIds?: number[];
}
