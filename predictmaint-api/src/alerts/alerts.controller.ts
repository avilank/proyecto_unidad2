import { Body, Controller, Get, Param, Patch, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { PaginationQueryDto } from '../common/dto/pagination.dto';
import { UpdateAlertStatusDto } from './dto/alert.dto';
import { AlertsService } from './alerts.service';

@ApiTags('alerts')
@Controller('alerts')
export class AlertsController {
  constructor(private readonly alertsService: AlertsService) {}

  @Get('active')
  @ApiOperation({ summary: 'Alertas activas' })
  findActive() {
    return this.alertsService.findActive();
  }

  @Get()
  @ApiOperation({ summary: 'Listar alertas' })
  findAll(@Query() query: PaginationQueryDto & Record<string, string>) {
    return this.alertsService.findAll(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener alerta' })
  findOne(@Param('id') id: string) {
    return this.alertsService.findOne(id);
  }

  @Patch(':id/status')
  @ApiOperation({ summary: 'Actualizar estado de alerta' })
  updateStatus(@Param('id') id: string, @Body() dto: UpdateAlertStatusDto) {
    return this.alertsService.updateStatus(id, dto.estado);
  }
}
