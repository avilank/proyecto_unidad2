import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';

@Injectable()
export class JobsService {
  private readonly logger = new Logger(JobsService.name);

  @Cron(CronExpression.EVERY_HOUR)
  handleHourlyDispatch() {
    this.logger.debug('[stub] Cron hourly dispatch check');
  }

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  handleDailyReset() {
    this.logger.debug('[stub] Cron daily reset ordenes_hoy');
  }

  @Cron('0 */30 * * * *')
  handleRepetitiveFaultScan() {
    this.logger.debug('[stub] Cron repetitive fault scan');
  }
}
