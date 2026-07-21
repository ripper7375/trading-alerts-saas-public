import { ThrottlerStorageRedisService } from '@nest-lab/throttler-storage-redis';
import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import Redis from 'ioredis';

import { CronsModule } from './crons/crons.module';
import { HealthModule } from './health/health.module';
import { PrismaModule } from './prisma/prisma.module';
import { MONEY_KEY_PREFIX, MONEY_QUEUE_PREFIX } from './queue/queue.constants';

// F15 (DECISION-LOG.md): the SAME shared Railway Redis instance
// operation-service's ThrottlerModule already uses (not a dedicated
// instance) — separated only by per-service key/queue prefixes so the two
// services' keys never collide in that one Redis. ThrottlerModule mirrors
// operation-service's own Redis-backed setup (this service runs replicas
// too); BullModule.forRoot is registered here with the 'money' queue prefix
// so future domain-module sessions (4A-4 onward) can `registerQueue()`
// without re-deciding the namespace.
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    ThrottlerModule.forRootAsync({
      useFactory: () => ({
        throttlers: [{ ttl: 60000, limit: 100 }],
        storage: new ThrottlerStorageRedisService(
          new Redis(process.env['REDIS_URL'] ?? 'redis://localhost:6379', {
            keyPrefix: MONEY_KEY_PREFIX,
          })
        ),
      }),
    }),
    BullModule.forRoot({
      connection: { url: process.env['REDIS_URL'] ?? 'redis://localhost:6379' },
      prefix: MONEY_QUEUE_PREFIX,
    }),
    // Session 4A-2 (File 4/6): registers Nest's cron scheduling registry
    // once for the whole app, per Nest's own convention. NOTE: the moment
    // this app actually boots somewhere with a real DATABASE_URL, every
    // @Cron() in CronsModule starts firing live on its own schedule — see
    // this order's Deviations for why that isn't the same thing as this
    // code merely existing/being committed.
    ScheduleModule.forRoot(),
    HealthModule,
    CronsModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
