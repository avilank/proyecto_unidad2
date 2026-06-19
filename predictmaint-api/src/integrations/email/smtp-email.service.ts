import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import nodemailer, { type Transporter } from 'nodemailer';

export interface SendEmailPayload {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

@Injectable()
export class SmtpEmailService {
  private readonly logger = new Logger(SmtpEmailService.name);
  private transporter: Transporter | null = null;

  constructor(private readonly config: ConfigService) {
    this.bootstrap();
  }

  private bootstrap(): void {
    const host = this.config.get<string>('email.host')?.trim();
    const user = this.config.get<string>('email.user')?.trim();
    const pass = this.config.get<string>('email.pass')?.trim();

    if (!host || !user || !pass) {
      this.logger.warn(
        'SMTP no configurado (MAIL_HOST / MAIL_USER / MAIL_PASS). Los correos de asignación no se enviarán.',
      );
      return;
    }

    const port = this.config.get<number>('email.port') ?? 587;
    const secure = this.config.get<boolean>('email.secure') ?? false;

    this.transporter = nodemailer.createTransport({
      host,
      port,
      secure,
      auth: { user, pass },
    });
  }

  isConfigured(): boolean {
    return this.transporter != null;
  }

  async send(payload: SendEmailPayload): Promise<void> {
    if (!this.transporter) {
      throw new Error(
        'SMTP no configurado. Define MAIL_HOST, MAIL_USER y MAIL_PASS en predictmaint-api/.env',
      );
    }

    const fromName = this.config.get<string>('email.fromName') ?? 'PredictMaint';
    const fromAddress =
      this.config.get<string>('email.fromAddress')?.trim() ||
      this.config.get<string>('email.user')?.trim();

    await this.transporter.sendMail({
      from: `"${fromName}" <${fromAddress}>`,
      to: payload.to,
      subject: payload.subject,
      html: payload.html,
      text: payload.text,
    });

    this.logger.log(`Correo enviado a ${payload.to} — ${payload.subject}`);
  }
}
