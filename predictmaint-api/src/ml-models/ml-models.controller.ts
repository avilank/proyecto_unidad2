import { Controller, Get, Param, ParseIntPipe, Patch, Query } from '@nestjs/common';
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
}
