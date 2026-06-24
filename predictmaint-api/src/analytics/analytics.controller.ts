import { Controller, Get, Query, Res } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { AnalyticsService } from './analytics.service';
import { parseAnalyticsFilters } from './dto/analytics-filters.dto';

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
  getSummary(@Query() query: Record<string, string>) {
    return this.analyticsService.getSummary(parseAnalyticsFilters(query));
  }

  @Get('faults-by-type')
  @ApiOperation({ summary: 'Fallos por tipo' })
  getFaultsByType(@Query() query: Record<string, string>) {
    return this.analyticsService.getFaultsByType(parseAnalyticsFilters(query));
  }

  @Get('unattended')
  @ApiOperation({ summary: 'Órdenes sin atender' })
  getUnattended(@Query() query: Record<string, string>) {
    return this.analyticsService.getUnattended(parseAnalyticsFilters(query));
  }

  @Get('recurrent-machines')
  @ApiOperation({ summary: 'Máquinas con fallos recurrentes' })
  getRecurrentMachines() {
    return this.analyticsService.getRecurrentMachines();
  }

  @Get('machine-recurrence')
  @ApiOperation({ summary: 'Ranking de máquinas por fallos en ventana temporal' })
  getMachineRecurrence(
    @Query('days') days = '7',
    @Query('minFallos') minFallos = '2',
    @Query() query: Record<string, string>,
  ) {
    return this.analyticsService.getMachineRecurrence(
      Number(days),
      Number(minFallos),
      parseAnalyticsFilters(query),
    );
  }

  @Get('availability')
  @ApiOperation({ summary: 'Disponibilidad de máquinas' })
  getAvailability() {
    return this.analyticsService.getAvailability();
  }

  @Get('prediction-validation')
  @ApiOperation({ summary: 'Historial: predicción vs. decisión del técnico' })
  getPredictionValidation(@Query() query: Record<string, string>) {
    return this.analyticsService.getPredictionValidation(parseAnalyticsFilters(query));
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
