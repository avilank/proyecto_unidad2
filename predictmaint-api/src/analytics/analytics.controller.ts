import { Controller, Get, Query, Res } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { AnalyticsService } from './analytics.service';

@ApiTags('analytics')
@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('dashboard')
  @ApiOperation({ summary: 'KPIs del dashboard' })
  getDashboard() {
    return this.analyticsService.getDashboard();
  }

  @Get('summary')
  @ApiOperation({ summary: 'Resumen de efectividad' })
  getSummary(@Query('range') range = 'week') {
    return this.analyticsService.getSummary(range);
  }

  @Get('faults-by-type')
  @ApiOperation({ summary: 'Fallos por tipo' })
  getFaultsByType(@Query('range') range = 'week') {
    return this.analyticsService.getFaultsByType(range);
  }

  @Get('unattended')
  @ApiOperation({ summary: 'Órdenes sin atender' })
  getUnattended() {
    return this.analyticsService.getUnattended();
  }

  @Get('recurrent-machines')
  @ApiOperation({ summary: 'Máquinas con fallos recurrentes' })
  getRecurrentMachines() {
    return this.analyticsService.getRecurrentMachines();
  }

  @Get('sensor-trend')
  @ApiOperation({ summary: 'Serie temporal de sensores' })
  getSensorTrend(
    @Query('variable') variable = 'rotationalSpeed',
    @Query('hours') hours = '24',
    @Query('maquinaId') maquinaId?: string,
  ) {
    return this.analyticsService.getSensorTrend(variable, Number(hours), maquinaId);
  }

  @Get('export')
  @ApiOperation({ summary: 'Exportar CSV (stub)' })
  export(
    @Query('type') type = 'csv',
    @Query('range') range = 'week',
    @Res() res: Response,
  ) {
    const data = this.analyticsService.exportCsv(type, range);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="export-stub.csv"');
    res.send(`stub,${type},${range}\n${JSON.stringify(data)}\n`);
  }
}
