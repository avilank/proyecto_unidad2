import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';
import { EstadoAlerta } from '../../common/enums';

export class UpdateAlertStatusDto {
  @ApiProperty({ enum: EstadoAlerta })
  @IsEnum(EstadoAlerta)
  estado!: EstadoAlerta;
}
