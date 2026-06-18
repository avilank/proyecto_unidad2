import { Body, Controller, Get, Param, ParseIntPipe, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../common/decorators/public.decorator';
import { PaginationQueryDto } from '../common/dto/pagination.dto';
import { CreateSensorReadingDto } from './dto/create-sensor-reading.dto';
import { SensorReadingsService } from './sensor-readings.service';

@ApiTags('sensor-readings')
@Controller('sensor-readings')
export class SensorReadingsController {
  constructor(private readonly sensorReadingsService: SensorReadingsService) {}

  @Public()
  @Post()
  @ApiOperation({ summary: 'Registrar lectura y ejecutar pipeline (simulador / sensores)' })
  create(@Body() dto: CreateSensorReadingDto) {
    return this.sensorReadingsService.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'Listar lecturas' })
  findAll(@Query() query: PaginationQueryDto & Record<string, string>) {
    return this.sensorReadingsService.findAll({
      ...query,
      machineId: query.machineId,
      from: query.from,
      to: query.to,
    });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener lectura' })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.sensorReadingsService.findOne(id);
  }
}
