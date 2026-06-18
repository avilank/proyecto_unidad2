import { Body, Controller, Get, Param, ParseIntPipe, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { PaginationQueryDto } from '../common/dto/pagination.dto';
import { ResolveRepetitiveFaultDto } from './dto/repetitive-fault.dto';
import { RepetitiveFaultsService } from './repetitive-faults.service';

@ApiTags('repetitive-faults')
@Controller('repetitive-faults')
export class RepetitiveFaultsController {
  constructor(private readonly repetitiveFaultsService: RepetitiveFaultsService) {}

  @Get()
  @ApiOperation({ summary: 'Listar fallos repetitivos' })
  findAll(@Query() query: PaginationQueryDto & Record<string, string>) {
    return this.repetitiveFaultsService.findAll(query);
  }

  @Get(':maquinaId/history')
  @ApiOperation({ summary: 'Historial de intervenciones' })
  getHistory(
    @Param('maquinaId') maquinaId: string,
    @Query('tipoFallo') tipoFallo?: string,
  ) {
    return this.repetitiveFaultsService.getHistory(maquinaId, tipoFallo);
  }

  @Post(':id/resolve')
  @ApiOperation({ summary: 'Resolver fallo repetitivo' })
  resolve(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ResolveRepetitiveFaultDto,
  ) {
    return this.repetitiveFaultsService.resolve(id, dto.nota);
  }
}
