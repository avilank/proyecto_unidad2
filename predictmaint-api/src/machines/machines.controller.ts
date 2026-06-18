import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { PaginationQueryDto } from '../common/dto/pagination.dto';
import { CreateMachineDto, UpdateMachineDto } from './dto/machine.dto';
import { MachinesService } from './machines.service';

@ApiTags('machines')
@Controller('machines')
export class MachinesController {
  constructor(private readonly machinesService: MachinesService) {}

  @Get()
  @ApiOperation({ summary: 'Listar máquinas' })
  findAll(@Query() query: PaginationQueryDto & Record<string, string>) {
    return this.machinesService.findAll(query);
  }

  @Get(':id/readings')
  @ApiOperation({ summary: 'Lecturas de una máquina' })
  getReadings(@Param('id') id: string, @Query() query: Record<string, string>) {
    return this.machinesService.getReadings(id, {
      from: query.from,
      to: query.to,
      limit: query.limit ? Number(query.limit) : undefined,
    });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener máquina' })
  findOne(@Param('id') id: string) {
    return this.machinesService.findOne(id);
  }

  @Post()
  @ApiOperation({ summary: 'Crear máquina' })
  create(@Body() dto: CreateMachineDto) {
    return this.machinesService.create(dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Actualizar máquina' })
  update(@Param('id') id: string, @Body() dto: UpdateMachineDto) {
    return this.machinesService.update(id, dto);
  }
}
