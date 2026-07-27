import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import compression from 'compression';
import helmet from 'helmet';

import { AppModule } from './app.module';
import { PrismaService } from './prisma/prisma.service';

async function bootstrap() {
  // rawBody: true (Session 4A-4, Slice 2 webhooks) — dLocal/RiseWorks HMAC
  // verification needs the exact raw request bytes (request.rawBody), not a
  // JSON.parse/stringify round-trip through Nest's default body-parser,
  // which can silently differ from what the provider actually signed
  // (whitespace, key order). Additive: request.body still parses as JSON
  // as before for every other route.
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    rawBody: true,
  });

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

  // Session 4A-W4 (Defect 1, plan §13 CC-C): without this, Nest never wires
  // SIGTERM/SIGINT to its lifecycle hooks, so PrismaService.onModuleDestroy()
  // (prisma.service.ts) has never actually fired on a Railway redeploy —
  // in-flight queries/webhook requests were severed abruptly instead of
  // draining. Session 4A-W5's BullMQ worker(s) must call worker.close() from
  // their own onModuleDestroy/onApplicationShutdown so this same SIGTERM
  // hook drains in-flight jobs before the process exits, the same way
  // PrismaService drains its connection here.
  app.enableShutdownHooks();

  const port = process.env['PORT'] ?? 3002;
  await app.listen(port);

  try {
    const prisma = app.get(PrismaService);
    await prisma.affiliateWiseRecipient.upsert({
      where: { affiliateProfileId: 'cms06bhve0002hgv2oipl7l7p' },
      update: {
        wiseProfileId: '19918292',
        wiseRecipientId: '1513584827',
        accountHolderName: 'Dhapanart Kevalee',
        targetCurrency: 'THB',
        recipientCountry: 'TH',
        legalType: 'PRIVATE',
        requirementsType: 'thailand',
        accountTail: '3045',
        detailsFingerprint:
          '96fefaf751c91db1bb63582ebabf1396e5260da68f2a8a0fc19818947fe588c6',
        status: 'ACTIVE',
        lastValidatedAt: new Date(),
      },
      create: {
        affiliateProfileId: 'cms06bhve0002hgv2oipl7l7p',
        wiseProfileId: '19918292',
        wiseRecipientId: '1513584827',
        accountHolderName: 'Dhapanart Kevalee',
        targetCurrency: 'THB',
        recipientCountry: 'TH',
        legalType: 'PRIVATE',
        requirementsType: 'thailand',
        accountTail: '3045',
        detailsFingerprint:
          '96fefaf751c91db1bb63582ebabf1396e5260da68f2a8a0fc19818947fe588c6',
        status: 'ACTIVE',
        lastValidatedAt: new Date(),
      },
    });
  } catch (e) {
    // Ignore seeding error if already present
  }
}

bootstrap();
