import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import compression from 'compression';
import helmet from 'helmet';

import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

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
