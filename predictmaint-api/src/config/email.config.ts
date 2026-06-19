import { registerAs } from '@nestjs/config';

export default registerAs('email', () => ({
  host: process.env.MAIL_HOST ?? process.env.SMTP_HOST ?? '',
  port: parseInt(process.env.MAIL_PORT ?? process.env.SMTP_PORT ?? '587', 10),
  user: process.env.MAIL_USER ?? process.env.SMTP_USER ?? '',
  pass: process.env.MAIL_PASS ?? process.env.SMTP_PASS ?? '',
  fromName: process.env.MAIL_FROM_NAME ?? 'PredictMaint',
  fromAddress:
    process.env.MAIL_FROM_ADDRESS ??
    process.env.MAIL_USER ??
    process.env.SMTP_USER ??
    '',
  secure: (process.env.MAIL_SECURE ?? 'false').toLowerCase() === 'true',
}));
