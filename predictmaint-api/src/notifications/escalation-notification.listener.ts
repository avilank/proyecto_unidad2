import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import {
  ORDER_ESCALATED_EVENT,
  OrderEscalatedPayload,
} from '../common/events/order.events';
import { NotificationsService } from './notifications.service';

@Injectable()
export class EscalationNotificationListener {
  private readonly logger = new Logger(EscalationNotificationListener.name);

  constructor(private readonly notificationsService: NotificationsService) {}

  @OnEvent(ORDER_ESCALATED_EVENT, { async: true })
  async handleOrderEscalated(payload: OrderEscalatedPayload): Promise<void> {
    try {
      await this.notificationsService.notifyEscalation(payload);
    } catch (err) {
      this.logger.error(
        `Error al notificar escalamiento ${payload.orderId}: ${err instanceof Error ? err.message : err}`,
      );
    }
  }
}
