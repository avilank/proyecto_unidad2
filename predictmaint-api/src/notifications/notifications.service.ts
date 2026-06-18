import { Injectable } from '@nestjs/common';
import { PaginationQueryDto } from '../common/dto/pagination.dto';
import { SendNotificationDto } from './dto/notification.dto';

@Injectable()
export class NotificationsService {
  async findAll() {
    return [];
  }

  async getSchedule() {
    return [];
  }

  async getLog(_query: PaginationQueryDto & { tecnicoId?: number }) {
    return { items: [], total: 0 };
  }

  async send(_dto: SendNotificationDto) {
    return { ok: true, stub: true };
  }

  async getNextDispatch() {
    return null;
  }
}
