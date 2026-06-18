import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { Especialidad, EstadoTecnico, Turno } from '../../common/enums';

export class CreateTechnicianDto {
  @ApiProperty()
  @IsString()
  @MaxLength(120)
  nombre!: string;

  @ApiProperty({ enum: Especialidad })
  @IsEnum(Especialidad)
  especialidad!: Especialidad;

  @ApiProperty({ enum: Turno })
  @IsEnum(Turno)
  turno!: Turno;

  @ApiProperty()
  @IsString()
  telefono!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEmail()
  email?: string;
}

export class UpdateTechnicianDto extends PartialType(CreateTechnicianDto) {
  @ApiPropertyOptional({ enum: EstadoTecnico })
  @IsOptional()
  @IsEnum(EstadoTecnico)
  estado?: EstadoTecnico;
}
