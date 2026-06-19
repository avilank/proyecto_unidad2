import { registerAs } from '@nestjs/config';

export default registerAs('notifications', () => ({
  sendEmailWebhook: process.env.SEND_EMAIL_WEBHOOK ?? '',
  frontendUrl: (process.env.FRONTEND_URL ?? 'http://localhost:3000').replace(/\/$/, ''),
  whatsappToken: process.env.WHATSAPP_TOKEN ?? '',
  smtpHost: process.env.SMTP_HOST ?? '',
  smtpPort: parseInt(process.env.SMTP_PORT ?? '587', 10),
  smtpUser: process.env.SMTP_USER ?? '',
  smtpPass: process.env.SMTP_PASS ?? '',
}));
