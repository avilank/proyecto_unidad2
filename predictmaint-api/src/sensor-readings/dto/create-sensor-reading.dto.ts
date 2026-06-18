import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsInt,
  IsNumber,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateSensorReadingDto {
  @ApiProperty({ example: 'M-001' })
  @IsString()
  @MaxLength(10)
  maquinaId!: string;

  @ApiProperty({ example: 'H' })
  @IsString()
  @MaxLength(1)
  tipo!: string;

  @ApiProperty()
  @IsNumber()
  @Min(295)
  @Max(305)
  airTemperature!: number;

  @ApiProperty()
  @IsNumber()
  @Min(295)
  @Max(315)
  processTemperature!: number;

  @ApiProperty()
  @IsInt()
  @Min(1168)
  @Max(2886)
  rotationalSpeed!: number;

  @ApiProperty()
  @IsNumber()
  @Min(3.8)
  @Max(76.6)
  torque!: number;

  @ApiProperty()
  @IsInt()
  @Min(0)
  @Max(253)
  toolWear!: number;

  @ApiPropertyOptional()
  @IsDateString()
  capturadoEn?: string;
}
