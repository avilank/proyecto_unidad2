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
import {
  CreateOrderDto,
  EscalateOrderDto,
  RegisterSolutionDto,
  UpdateOrderStatusDto,
} from './dto/order.dto';
import { OrdersService } from './orders.service';

@ApiTags('orders')
@Controller('orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Get()
  @ApiOperation({ summary: 'Listar órdenes' })
  findAll(@Query() query: PaginationQueryDto & Record<string, string>) {
    return this.ordersService.findAll({
      ...query,
      tecnicoId: query.tecnicoId ? Number(query.tecnicoId) : undefined,
    });
  }

  @Get(':id/timeline')
  @ApiOperation({ summary: 'Timeline de orden' })
  getTimeline(@Param('id') id: string) {
    return this.ordersService.getTimeline(id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener orden' })
  findOne(@Param('id') id: string) {
    return this.ordersService.findOne(id);
  }

  @Post()
  @ApiOperation({ summary: 'Crear orden' })
  create(@Body() dto: CreateOrderDto) {
    return this.ordersService.create(dto);
  }

  @Patch(':id/status')
  @ApiOperation({ summary: 'Actualizar estado' })
  updateStatus(@Param('id') id: string, @Body() dto: UpdateOrderStatusDto) {
    return this.ordersService.updateStatus(id, dto);
  }

  @Post(':id/solution')
  @ApiOperation({ summary: 'Registrar solución' })
  registerSolution(@Param('id') id: string, @Body() dto: RegisterSolutionDto) {
    return this.ordersService.registerSolution(id, dto);
  }

  @Post(':id/escalate')
  @ApiOperation({ summary: 'Escalar orden' })
  escalate(@Param('id') id: string, @Body() dto: EscalateOrderDto) {
    return this.ordersService.escalate(id, dto);
  }
}
