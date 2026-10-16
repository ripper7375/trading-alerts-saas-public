import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { ValidationPipe, Logger } from '@nestjs/common';
import helmet from 'helmet';
import compression from 'compression';
import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const logger = new Logger('Bootstrap');

  // Railway sits in front of this service as a reverse proxy: without this,
  // req.ip is the proxy's address and ThrottlerGuard puts every caller in ONE
  // bucket. With it, callers are throttled by their real address. The
  // API-key-authenticated ingestion POSTs (the Vultr VPS pushes bursts from a
  // single IP) opt out with @SkipThrottle() in src/gateway, so this change does
  // not start throttling them.
  app.set('trust proxy', 1);

  // Drain on SIGTERM/SIGINT: Nest closes the HTTP server, then runs
  // onApplicationShutdown (PrismaService disconnects there). useProcessExit
  // ends the process with process.exit(0) afterwards instead of re-sending the
  // signal to ourselves.
  app.enableShutdownHooks(undefined, { useProcessExit: true });

  app.use(helmet());
  app.enableCors({
    origin: process.env['ALLOWED_ORIGINS']?.split(',') ?? '*',
  });
  app.use(compression());

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    })
  );

  const port = process.env['PORT'] ?? 3003;
  await app.listen(port);
  logger.log(`Gateway running on port ${port}`);
}

bootstrap();
