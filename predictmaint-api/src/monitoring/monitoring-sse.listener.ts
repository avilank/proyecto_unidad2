import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import {
  MONITORING_ALERT_EVENT,
  MONITORING_READING_EVENT,
  MonitoringAlertPayload,
  MonitoringReadingPayload,
} from '../common/events/monitoring.events';
import { MonitoringSseService } from './monitoring-sse.service';

@Injectable()
export class MonitoringSseListener {
  constructor(private readonly monitoringSse: MonitoringSseService) {}

  @OnEvent(MONITORING_READING_EVENT)
  onReading(payload: MonitoringReadingPayload): void {
    this.monitoringSse.broadcast('monitoring:reading', payload);
  }

  @OnEvent(MONITORING_ALERT_EVENT)
  onAlert(payload: MonitoringAlertPayload): void {
    this.monitoringSse.broadcast('monitoring:alert', payload);
  }
}
