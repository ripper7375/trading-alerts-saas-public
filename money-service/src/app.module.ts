import { ThrottlerStorageRedisService } from '@nest-lab/throttler-storage-redis';
import { BullModule } from '@nestjs/bullmq';
import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import Redis from 'ioredis';

import { AdminModule } from './admin/admin.module';
import { AffiliateModule } from './affiliate/affiliate.module';
import { CacheModule } from './cache/cache.module';
import { LoggingModule } from './common/logging/logging.module';
import { CorrelationIdMiddleware } from './common/middleware/correlation-id.middleware';
import { CronsModule } from './crons/crons.module';
import { DisbursementModule } from './disbursement/disbursement.module';
import { DlocalModule } from './dlocal/dlocal.module';
import { HealthModule } from './health/health.module';
import { PrismaModule } from './prisma/prisma.module';
import { MONEY_KEY_PREFIX, MONEY_QUEUE_PREFIX } from './queue/queue.constants';
import { RedisModule } from './redis/redis.module';
import { RiseworksModule } from './riseworks/riseworks.module';
import { StripeModule } from './stripe/stripe.module';
import { WiseModule } from './wise/wise.module';

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
    LoggingModule,
    PrismaModule,
    RedisModule,
    CacheModule,
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
    // Session 4A-4 (File 2/4, 3/4): Slice 2 webhook receivers. Unique paths
    // (/v1/webhooks/dlocal, /v1/webhooks/riseworks per F16's /v1 prefix) —
    // not wired to either provider's dashboard yet (Safety Gate, this
    // order's own scope note), so registering these modules carries no live
    // traffic risk until Session 4A-5.
    DlocalModule,
    RiseworksModule,
    // Session 4A-6 (File 2/3): Slice 3 read APIs (affiliate dashboard,
    // admin affiliate/analytics reports). Unique paths under
    // /v1/affiliate/dashboard/* and /v1/admin/* — no live traffic until
    // Session 4A-7 (this order's own Safety Gate).
    AffiliateModule,
    AdminModule,
    // Session 4A-W3a (File 8/10): Wise recipient onboarding backend.
    // Unique paths under /v1/wise/recipients/* — no frontend surface
    // consumes them yet (4A-W3b builds that next), so registering this
    // module carries no live traffic risk.
    WiseModule,
    // Session 4A-9: Slice 4 write-API PORT (Stripe checkout/subscription/
    // webhook, disbursement batch execution). Unique paths under
    // /v1/stripe/*, /v1/payments/dlocal/create (added to the existing
    // DlocalModule), /v1/admin/affiliates/:id/distribute-codes (added to
    // the existing AdminModule), and /v1/disbursement/batches/:id/execute —
    // ZERO live traffic: no feature flag flipped, no URL change, no
    // dashboard/client repointed. Cutover is Session 4A-10.
    StripeModule,
    DisbursementModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    // Express 5 / path-to-regexp v8 (this repo's installed versions)
    // removed bare '*' wildcard support — '/{*splat}' is the documented
    // replacement, verified against the real installed path-to-regexp to
    // match every path including bare '/'. Matches against the raw
    // incoming path (middleware runs before setGlobalPrefix's routing),
    // so this covers /health, /health-auth, and every /v1/* route alike.
    consumer.apply(CorrelationIdMiddleware).forRoutes('/{*splat}');
  }
}
