import { Body, Controller, Get, Param, ParseIntPipe, Patch, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ConfigCatalogService } from './config-catalog.service';
import type { DispatchScheduleItem } from './dispatch-schedule.defaults';

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
  patchConfig(@Body() body: Record<string, unknown>) {
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

  @Get('notification-rules')
  @ApiOperation({ summary: 'Reglas de notificación por nivel de riesgo' })
  getNotificationRules() {
    return this.configCatalogService.getNotificationRules();
  }

  @Patch('notification-rules/:nivel')
  @ApiOperation({ summary: 'Actualizar regla de notificación (canal / destinatario)' })
  patchNotificationRule(
    @Param('nivel') nivel: string,
    @Body() body: { recibe?: string; canal?: string },
  ) {
    return this.configCatalogService.patchNotificationRule(nivel, body);
  }

  @Get('escalation-actions')
  @ApiOperation({ summary: 'Acciones escaladas por tipo de fallo' })
  getEscalationActions() {
    return this.configCatalogService.getEscalationActions();
  }

  @Patch('escalation-actions/:tipoFallo')
  @ApiOperation({ summary: 'Actualizar acción escalada de un tipo de fallo' })
  patchEscalationAction(
    @Param('tipoFallo') tipoFallo: string,
    @Body('acciones') acciones: string,
  ) {
    return this.configCatalogService.patchEscalationAction(tipoFallo, acciones);
  }

  @Get('dispatch-schedule')
  @ApiOperation({ summary: 'Horarios de envío' })
  getDispatchSchedule() {
    return this.configCatalogService.getDispatchSchedule();
  }

  @Patch('dispatch-schedule')
  @ApiOperation({ summary: 'Actualizar horarios de envío' })
  patchDispatchSchedule(@Body() body: { items: DispatchScheduleItem[] }) {
    return this.configCatalogService.patchDispatchSchedule(body.items ?? []);
  }
}
