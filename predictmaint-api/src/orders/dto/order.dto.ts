import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsEnum, IsOptional, IsString } from 'class-validator';
import { EstadoOrden, SolucionTipo } from '../../common/enums';

export class CreateOrderDto {
  @ApiProperty()
  @IsString()
  maquinaId!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  tipoFallo?: string;
}

export class UpdateOrderStatusDto {
  @ApiProperty({ enum: EstadoOrden })
  @IsEnum(EstadoOrden)
  estado!: EstadoOrden;
}

export class RegisterSolutionDto {
  @ApiProperty()
  @IsString()
  descripcion!: string;

  @ApiProperty({ enum: SolucionTipo })
  @IsEnum(SolucionTipo)
  solucionTipo!: SolucionTipo;

  @ApiPropertyOptional({ description: 'Comentario del técnico (observacion_tecnica)' })
  @IsOptional()
  @IsString()
  comentario?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  esFalla?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  esPrediccionCorrecta?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  esClasificacionCorrecta?: boolean;
}

export class EscalateOrderDto {
  @ApiProperty()
  @IsString()
  motivo!: string;
}

export class RejectPredictionDto {
  @ApiProperty({ description: 'Justificación del técnico para rechazar la predicción' })
  @IsString()
  justificacion!: string;
}
