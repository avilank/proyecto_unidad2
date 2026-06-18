import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { PaginationQueryDto } from '../common/dto/pagination.dto';
import { CreateTechnicianDto, UpdateTechnicianDto } from './dto/technician.dto';
import { TechniciansService } from './technicians.service';

@ApiTags('technicians')
@Controller('technicians')
export class TechniciansController {
  constructor(private readonly techniciansService: TechniciansService) {}

  @Get()
  @ApiOperation({ summary: 'Listar técnicos' })
  findAll(@Query() query: PaginationQueryDto & Record<string, string>) {
    return this.techniciansService.findAll(query);
  }

  @Get('available')
  @ApiOperation({ summary: 'Técnicos disponibles según estrategia' })
  findAvailable(
    @Query('nivelRiesgo') nivelRiesgo?: string,
    @Query('tipoFallo') tipoFallo?: string,
  ) {
    return this.techniciansService.findAvailable(nivelRiesgo, tipoFallo);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener técnico' })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.techniciansService.findOne(id);
  }

  @Post()
  @ApiOperation({ summary: 'Crear técnico' })
  create(@Body() dto: CreateTechnicianDto) {
    return this.techniciansService.create(dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Actualizar técnico' })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateTechnicianDto,
  ) {
    return this.techniciansService.update(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Eliminar técnico' })
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.techniciansService.remove(id);
  }
}
