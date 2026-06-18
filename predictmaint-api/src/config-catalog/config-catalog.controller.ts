import { Body, Controller, Get, Param, ParseIntPipe, Patch, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ConfigCatalogService } from './config-catalog.service';

@ApiTags('config')
@Controller()
export class ConfigController {
  constructor(private readonly configCatalogService: ConfigCatalogService) {}

  @Get('config')
  @ApiOperation({ summary: 'Obtener configuración' })
  getConfig(@Query('grupo') grupo?: string) {
    return this.configCatalogService.getConfig(grupo);
  }

  @Patch('config')
  @ApiOperation({ summary: 'Actualizar configuración' })
  patchConfig(@Body() body: Record<string, string>) {
    return this.configCatalogService.patchConfig(body);
  }
}

@ApiTags('catalog')
@Controller('catalog')
export class CatalogController {
  constructor(private readonly configCatalogService: ConfigCatalogService) {}

  @Get('fault-types')
  @ApiOperation({ summary: 'Catálogo tipos de fallo' })
  getFaultTypes() {
    return this.configCatalogService.getFaultTypes();
  }

  @Get('risk-levels')
  @ApiOperation({ summary: 'Catálogo niveles de riesgo' })
  getRiskLevels() {
    return this.configCatalogService.getRiskLevels();
  }

  @Get('rag-sources')
  @ApiOperation({ summary: 'Catálogo fuentes RAG' })
  getRagSources() {
    return this.configCatalogService.getRagSources();
  }

  @Patch('rag-sources/:id')
  @ApiOperation({ summary: 'Activar/desactivar fuente RAG' })
  patchRagSource(
    @Param('id', ParseIntPipe) id: number,
    @Body('activa') activa: boolean,
  ) {
    return this.configCatalogService.patchRagSource(id, activa);
  }

  @Get('dispatch-schedule')
  @ApiOperation({ summary: 'Horarios de envío' })
  getDispatchSchedule() {
    return this.configCatalogService.getDispatchSchedule();
  }
}
