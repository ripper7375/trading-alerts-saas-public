import { ThrottlerStorageRedisService } from '@nest-lab/throttler-storage-redis';
import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import Redis from 'ioredis';

import { AlertEngineModule } from './alert-engine/alert-engine.module';
import { AlertsModule } from './alerts/alerts.module';
import { AuthModule } from './auth/auth.module';
import { CacheModule } from './cache/cache.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { LoggingModule } from './common/logging/logging.module';
import { CorrelationIdMiddleware } from './common/middleware/correlation-id.middleware';
import { DrawingsModule } from './drawings/drawings.module';
import { HealthModule } from './health/health.module';
import { NotificationsModule } from './notifications/notifications.module';
import { OutboxModule } from './outbox/outbox.module';
import { PrismaModule } from './prisma/prisma.module';
import { RedisModule } from './redis/redis.module';

// Module order follows railway-gateway's own app.module.ts (reference-notes
// §2): global config -> global Prisma -> global throttler guard -> feature
// modules. Unlike railway-gateway's single-instance in-memory throttler,
// this service runs replicas (plan §5.2), so storage is Redis-backed from
// the start.
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    LoggingModule,
    PrismaModule,
    RedisModule,
    CacheModule,
    ThrottlerModule.forRootAsync({
      useFactory: () => ({
        throttlers: [{ ttl: 60000, limit: 100 }],
        storage: new ThrottlerStorageRedisService(
          new Redis(process.env['REDIS_URL'] ?? 'redis://localhost:6379')
        ),
      }),
    }),
    HealthModule,
    AuthModule,
    OutboxModule,
    AlertEngineModule,
    AlertsModule,
    DrawingsModule,
    NotificationsModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    {
      provide: APP_FILTER,
      useClass: AllExceptionsFilter,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    // Express 5 / path-to-regexp v8 (this repo's installed versions)
    // removed bare '*' wildcard support — '/{*splat}' is the documented
    // replacement, verified against the real installed path-to-regexp to
    // match every path including bare '/'.
    consumer.apply(CorrelationIdMiddleware).forRoutes('/{*splat}');
  }
}
