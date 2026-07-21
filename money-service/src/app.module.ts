import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { HealthModule } from './health/health.module';
import { PrismaModule } from './prisma/prisma.module';

// Skeleton stage (Session 4A-1, step 1): config -> Prisma -> health only.
// Redis/BullMQ wiring (F15) lands in the next commit; domain modules
// (affiliate/billing/payments/disbursement/scheduler) land in later BUILD
// sessions, 4A-4 onward.
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    HealthModule,
  ],
})
export class AppModule {}
