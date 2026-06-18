import { registerAs } from '@nestjs/config';

export default registerAs('ml', () => ({
  serviceUrl: process.env.ML_SERVICE_URL ?? 'http://localhost:8000',
  apiKey: process.env.ML_API_KEY ?? 'ml-secret-key',
}));
