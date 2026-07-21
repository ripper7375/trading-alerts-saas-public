import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import compression from 'compression';
import helmet from 'helmet';

import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  app.set('trust proxy', 1);

  app.use(helmet());
  // Unlike operation-service (server-side proxied, F30 — CORS unnecessary),
  // money-service is called directly from the browser per blueprint §5.4
  // ("data hooks point at NEXT_PUBLIC_MONEY_API_URL"), so it needs a real
  // CORS allowlist. ALLOWED_ORIGINS must be set to the Vercel origin(s) only
  // — no wildcard fallback, unlike railway-gateway/operation-service's '*'
  // default, since this service is reachable from arbitrary browsers.
  const allowedOrigins = (process.env['ALLOWED_ORIGINS'] ?? '').split(',');
  app.enableCors({ origin: allowedOrigins, credentials: true });
  app.use(compression());

  // F16: public URL scheme is `<api.domain/v1 + money.domain/v1>` — this
  // service's own routes are versioned under /v1. /health and /health-auth
  // stay unprefixed so Railway's healthcheck config doesn't need to know
  // about API versioning.
  app.setGlobalPrefix('v1', { exclude: ['health', 'health-auth'] });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    })
  );

  const port = process.env['PORT'] ?? 3002;
  await app.listen(port);
}

bootstrap();
