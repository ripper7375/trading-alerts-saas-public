import { ThrottlerStorageRedisService } from '@nest-lab/throttler-storage-redis';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import Redis from 'ioredis';

import { AlertEngineModule } from './alert-engine/alert-engine.module';
import { AuthModule } from './auth/auth.module';
import { LoggingModule } from './common/logging/logging.module';
import { HealthModule } from './health/health.module';
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
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
