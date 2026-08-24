import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { BullModule } from '@nestjs/bull';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { GatewayModule } from './gateway/gateway.module';
import { WorkerModule } from './worker/worker.module';
import { HealthModule } from './health/health.module';
import { PrismaModule } from './prisma/prisma.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),

    PrismaModule,

    // A single REDIS_URL, not separate host/port/password fields -- matches
    // operation-service's own established convention on this same Railway
    // account (every Redis client there is built from REDIS_URL). Railway's
    // managed Redis add-on's individual REDISHOST/REDISPORT/REDISPASSWORD
    // fields did not connect reliably from a freshly-created service in
    // Session 8-2's own live staging deploy; REDIS_URL is the proven path.
    BullModule.forRoot({
      redis: process.env['REDIS_URL'] ?? 'redis://localhost:6379',
    }),

    // In-memory throttler storage is sufficient at this single-instance
    // gateway's actual volume (doc §3.3: one POST per 5-15 min per
    // timeframe) — a Redis-backed throttler store exists for multi-instance
    // deployments this pipeline doesn't need.
    ThrottlerModule.forRoot([
      {
        ttl: 60_000,
        limit: parseInt(process.env['RATE_LIMIT_MAX'] ?? '100', 10),
      },
    ]),

    GatewayModule,
    WorkerModule,
    HealthModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
