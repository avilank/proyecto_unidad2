import { Controller, MessageEvent, Sse, UseGuards } from '@nestjs/common';
import { Observable } from 'rxjs';
import { Public } from '../common/decorators/public.decorator';
import { SseJwtQueryGuard } from '../common/guards/sse-jwt-query.guard';
import { MonitoringSseService } from './monitoring-sse.service';

@Controller('monitoring')
export class MonitoringController {
  constructor(private readonly monitoringSseService: MonitoringSseService) {}

  @Public()
  @UseGuards(SseJwtQueryGuard)
  @Sse('stream')
  stream(): Observable<MessageEvent> {
    return this.monitoringSseService.getStream();
  }
}
