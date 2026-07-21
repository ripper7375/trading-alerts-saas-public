import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import compression from 'compression';
import helmet from 'helmet';

import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // Railway sits in front of this service as a reverse proxy — without this,
  // Express's req.ip reports the proxy's address, not the real client's.
  // Added this session because RefreshToken.ipAddress (F23) is the first
  // thing that actually reads request.ip; matters for audit-trail accuracy,
  // not for security-critical decisions.
  app.set('trust proxy', 1);

  app.use(helmet());
  const allowedOrigins = (process.env['ALLOWED_ORIGINS'] ?? '*').split(',');
  app.enableCors({ origin: allowedOrigins, credentials: true });
  app.use(compression());

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    })
  );

  const port = process.env['PORT'] ?? 3001;
  await app.listen(port);
}

bootstrap();
