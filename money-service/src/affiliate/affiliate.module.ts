/**
 * Affiliate Module (Session 4A-6, File 2/3)
 *
 * Wires the affiliate dashboard controller together with the services it
 * depends on. `PrismaService` isn't listed here — `PrismaModule` is
 * `@Global()`, already available app-wide (same convention as
 * `CronsModule`/`DlocalModule`/`RiseworksModule`). `JwtAuthGuard`/
 * `AffiliateGuard` aren't listed either — neither has constructor
 * dependencies, so `@UseGuards()` instantiates them directly (same
 * convention as `HealthModule`'s use of `JwtAuthGuard`).
 */

import { Module } from '@nestjs/common';

import { AffiliateDashboardController } from './affiliate-dashboard.controller';
import { ReportBuilderService } from './report-builder.service';

@Module({
  controllers: [AffiliateDashboardController],
  providers: [ReportBuilderService],
})
export class AffiliateModule {}
