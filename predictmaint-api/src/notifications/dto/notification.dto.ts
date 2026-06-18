import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsInt, IsString } from 'class-validator';
import { Canal, TipoEnvio } from '../../common/enums';

export class SendNotificationDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  tecnicoId?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  orderId?: string;

  @ApiProperty({ enum: Canal })
  @IsEnum(Canal)
  canal!: Canal;

  @ApiProperty({ enum: TipoEnvio })
  @IsEnum(TipoEnvio)
  tipoEnvio!: TipoEnvio;
}
