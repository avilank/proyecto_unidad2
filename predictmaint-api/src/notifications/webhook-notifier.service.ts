import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface WebhookNotificationPayload {
  email: string;
  subject: string;
  title: string;
  phone?: string;
  whatsappSummary?: string;
  emailBody?: string;
  pdf?: string;
  filename?: string;
}

@Injectable()
export class WebhookNotifierService {
  private readonly logger = new Logger(WebhookNotifierService.name);

  constructor(private readonly config: ConfigService) {}

  private getWebhookUrl(): string | null {
    const url = this.config.get<string>('notifications.sendEmailWebhook');
    return url?.trim() || null;
  }

  async send(payload: WebhookNotificationPayload): Promise<void> {
    const webhookUrl = this.getWebhookUrl();
    if (!webhookUrl) {
      throw new Error(
        'SEND_EMAIL_WEBHOOK no está configurado. Configura el webhook en .env',
      );
    }

    const body: Record<string, string> = {
      email: payload.email,
      subject: payload.subject,
      title: payload.title,
      pdf: payload.pdf ?? '',
      filename: payload.filename ?? 'notificacion.txt',
    };

    if (payload.phone?.trim()) body.phone = payload.phone.trim();
    if (payload.whatsappSummary?.trim()) {
      body.whatsappSummary = payload.whatsappSummary.trim();
    }
    if (payload.emailBody?.trim()) body.emailBody = payload.emailBody.trim();

    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      this.logger.error(`Webhook HTTP ${res.status}: ${text}`);
      throw new Error(`Webhook HTTP ${res.status}`);
    }

    this.logger.log(
      `Notificación enviada a ${payload.email}${payload.phone ? ` / ${payload.phone}` : ''}`,
    );
  }
}
