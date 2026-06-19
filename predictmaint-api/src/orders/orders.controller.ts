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
import { UserContext } from '../common/decorators/user-context.decorator';
import type { AuthUserPayload } from '../auth/auth.service';
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
  findAll(
    @Query() query: PaginationQueryDto & Record<string, string>,
    @UserContext() user: AuthUserPayload,
  ) {
    return this.ordersService.findAll(
      {
        ...query,
        tecnicoId: query.tecnicoId ? Number(query.tecnicoId) : undefined,
      },
      user,
    );
  }

  @Get('my-board')
  @ApiOperation({ summary: 'Tablero del técnico — orden activa asignada' })
  getTechnicianBoard(@UserContext() user: AuthUserPayload) {
    return this.ordersService.getTechnicianBoard(user);
  }

  @Get(':id/timeline')
  @ApiOperation({ summary: 'Timeline de orden' })
  getTimeline(
    @Param('id') id: string,
    @UserContext() user: AuthUserPayload,
  ) {
    return this.ordersService.getTimeline(id, user);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener orden' })
  findOne(@Param('id') id: string, @UserContext() user: AuthUserPayload) {
    return this.ordersService.findOne(id, user);
  }

  @Post()
  @ApiOperation({ summary: 'Crear orden' })
  create(@Body() dto: CreateOrderDto) {
    return this.ordersService.create(dto);
  }

  @Post(':id/start')
  @ApiOperation({ summary: 'Iniciar orden (técnico)' })
  startOrder(@Param('id') id: string, @UserContext() user: AuthUserPayload) {
    return this.ordersService.startOrder(id, user);
  }

  @Patch(':id/status')
  @ApiOperation({ summary: 'Actualizar estado' })
  updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateOrderStatusDto,
    @UserContext() user: AuthUserPayload,
  ) {
    return this.ordersService.updateStatus(id, dto, user);
  }

  @Post(':id/solution')
  @ApiOperation({ summary: 'Registrar solución' })
  registerSolution(
    @Param('id') id: string,
    @Body() dto: RegisterSolutionDto,
    @UserContext() user: AuthUserPayload,
  ) {
    return this.ordersService.registerSolution(id, dto, user);
  }

  @Post(':id/escalate')
  @ApiOperation({ summary: 'Escalar orden' })
  escalate(
    @Param('id') id: string,
    @Body() dto: EscalateOrderDto,
    @UserContext() user: AuthUserPayload,
  ) {
    return this.ordersService.escalate(id, dto, user);
  }
}
