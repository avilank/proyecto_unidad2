import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { PaginationQueryDto } from '../common/dto/pagination.dto';
import { SendNotificationDto } from './dto/notification.dto';
import { NotificationsService } from './notifications.service';

@ApiTags('notifications')
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get('log')
  @ApiOperation({ summary: 'Log de mensajes enviados' })
  getLog(@Query() query: PaginationQueryDto & Record<string, string>) {
    return this.notificationsService.getLog({
      ...query,
      tecnicoId: query.tecnicoId ? Number(query.tecnicoId) : undefined,
    });
  }

  @Post('send')
  @ApiOperation({ summary: 'Enviar notificación (stub)' })
  send(@Body() dto: SendNotificationDto) {
    return this.notificationsService.send(dto);
  }

  @Get('next-dispatch')
  @ApiOperation({ summary: 'Próximo envío programado' })
  getNextDispatch() {
    return this.notificationsService.getNextDispatch();
  }
}
