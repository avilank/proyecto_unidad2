import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { ORDER_CREATED_EVENT, OrderCreatedPayload } from '../common/events/order.events';
import { NotificationsService } from './notifications.service';

@Injectable()
export class OrderNotificationListener {
  private readonly logger = new Logger(OrderNotificationListener.name);

  constructor(private readonly notificationsService: NotificationsService) {}

  @OnEvent(ORDER_CREATED_EVENT, { async: true })
  async handleOrderCreated(payload: OrderCreatedPayload): Promise<void> {
    if (!payload.tecnicoId) {
      this.logger.debug(
        `Orden ${payload.orderId} sin técnico asignado — notificación omitida`,
      );
      return;
    }

    try {
      await this.notificationsService.notifyTechnicianAssignment(payload);
    } catch (err) {
      this.logger.error(
        `Error al notificar orden ${payload.orderId}: ${err instanceof Error ? err.message : err}`,
      );
    }
  }
}
