import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString } from 'class-validator';
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
}

export class EscalateOrderDto {
  @ApiProperty()
  @IsString()
  motivo!: string;
}
