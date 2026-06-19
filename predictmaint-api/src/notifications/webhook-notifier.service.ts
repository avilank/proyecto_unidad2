import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface WebhookNotificationPayload {
  email: string;
  subject: string;
  title: string;
  phone?: string;
  whatsappSummary?: string;
  emailBody?: string;
  /** Nombre del adjunto para n8n ($binary.archivo_pdf). */
  attachmentFilename?: string;
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

    const form = new FormData();
    form.append('email', payload.email);
    form.append('subject', payload.subject);
    form.append('title', payload.title);

    if (payload.phone?.trim()) {
      form.append('phone', payload.phone.trim());
    }
    if (payload.whatsappSummary?.trim()) {
      form.append('whatsappSummary', payload.whatsappSummary.trim());
    }

    const htmlBody = payload.emailBody?.trim() ?? '';
    if (htmlBody) {
      form.append('emailBody', htmlBody);
      form.append('message', htmlBody);
      form.append('includeEmail', 'true');

      const filename = payload.attachmentFilename ?? 'notificacion.html';
      form.append(
        'archivo_pdf',
        new Blob([htmlBody], { type: 'text/html;charset=utf-8' }),
        filename,
      );
    } else {
      form.append('includeEmail', 'false');
    }

    const res = await fetch(webhookUrl, {
      method: 'POST',
      body: form,
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
