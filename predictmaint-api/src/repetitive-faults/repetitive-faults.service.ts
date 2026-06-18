import { Injectable } from '@nestjs/common';
import { PaginationQueryDto } from '../common/dto/pagination.dto';

@Injectable()
export class RepetitiveFaultsService {
  async findAll(_query?: PaginationQueryDto & Record<string, string>) {
    return { items: [], total: 0 };
  }

  async findOne(_id: number) {
    return null;
  }

  async getHistory(_maquinaId: string, _tipoFallo?: string) {
    return [];
  }

  async resolve(_id: number, _nota?: string) {
    return { ok: true, stub: true };
  }
}
