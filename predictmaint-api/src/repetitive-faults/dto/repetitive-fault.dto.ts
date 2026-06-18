import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class ResolveRepetitiveFaultDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  nota?: string;
}
