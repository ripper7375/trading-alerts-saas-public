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

    BullModule.forRoot({
      redis: {
        host: process.env['REDIS_HOST'] ?? 'localhost',
        port: parseInt(process.env['REDIS_PORT'] ?? '6379', 10),
        password: process.env['REDIS_PASSWORD'] || undefined,
      },
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
