import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { IsEnum, IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';
import { EstadoOperativo } from '../../common/enums';

export class CreateMachineDto {
  @ApiProperty({ example: 'M-004' })
  @IsString()
  @MaxLength(10)
  id!: string;

  @ApiProperty({ example: 'H' })
  @IsString()
  @MaxLength(1)
  tipo!: string;

  @ApiPropertyOptional({ enum: EstadoOperativo })
  @IsOptional()
  @IsEnum(EstadoOperativo)
  estadoOperativo?: EstadoOperativo;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  horasOperacion?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  tecnicoAsignadoId?: number;
}

export class UpdateMachineDto extends PartialType(CreateMachineDto) {}
