import { Module } from '@nestjs/common';
import { SmtpEmailService } from './smtp-email.service';

@Module({
  providers: [SmtpEmailService],
  exports: [SmtpEmailService],
})
export class EmailModule {}
