import { BadRequestException, Body, Controller, Get, Param, ParseIntPipe, Patch, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { EtapaModelo } from '../common/enums';
import { MlModelsService } from './ml-models.service';

@ApiTags('ml-models')
@Controller('ml-models')
export class MlModelsController {
  constructor(private readonly mlModelsService: MlModelsService) {}

  @Get()
  @ApiOperation({ summary: 'Listar modelos ML' })
  findAll(@Query('etapa') etapa?: EtapaModelo) {
    return this.mlModelsService.findAll(etapa);
  }

  @Patch(':id/activate')
  @ApiOperation({ summary: 'Activar modelo por etapa' })
  activate(@Param('id', ParseIntPipe) id: number) {
    return this.mlModelsService.activate(id);
  }

  @Patch(':id/umbral')
  @ApiOperation({ summary: 'Actualizar umbral de clasificación S-1' })
  updateUmbral(
    @Param('id', ParseIntPipe) id: number,
    @Body('umbral') umbral: number,
  ) {
    const value = Number(umbral);
    if (Number.isNaN(value) || value < 0.1 || value > 0.9) {
      throw new BadRequestException('El umbral debe estar entre 0.10 y 0.90');
    }
    return this.mlModelsService.updateUmbral(id, value);
  }
}
