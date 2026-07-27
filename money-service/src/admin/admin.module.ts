/**
 * Admin Module (Session 4A-6, File 2/3; extended Session 4A-9, File 7/10)
 *
 * Wires the 3 admin controllers together with every service they
 * (directly or transitively) depend on. `PrismaService` isn't listed
 * here — `PrismaModule` is `@Global()` (same convention as every other
 * domain module). `ReportBuilderService`/`AffiliateConfigService` are
 * re-declared as providers here rather than imported from
 * `AffiliateModule` — matches this repo's existing convention of each
 * module independently providing what it needs (see `DlocalModule` and
 * `CronsModule`, both of which already re-declare `AffiliateConfigService`
 * rather than sharing a single exported instance).
 *
 * 4A-9 adds `AdminCodeDistributionService` (+ its own
 * `CodeGeneratorService` dependency) and `IdempotencyInterceptor`/
 * `IdempotencyStore` for the new POST /admin/affiliates/:id/distribute-codes
 * route on the already-registered `AdminAffiliatesController` -- unlike
 * this order's brand-new controllers (deferred to File 10/10), this module
 * needed updating immediately since the controller it extends is already
 * wired into AppModule.
 */

import { Module } from '@nestjs/common';

import { AffiliateConfigService } from '../affiliate/affiliate-config.service';
import { CodeGeneratorService } from '../affiliate/code-generator.service';
import { ReportBuilderService } from '../affiliate/report-builder.service';
import { IdempotencyInterceptor } from '../common/idempotency/idempotency.interceptor';
import { IdempotencyStore } from '../common/idempotency/idempotency.store';

import { AdminAffiliateReportsController } from './admin-affiliate-reports.controller';
import { AdminAffiliatesController } from './admin-affiliates.controller';
import { AdminAnalyticsController } from './admin-analytics.controller';
import { AdminCodeDistributionService } from './admin-code-distribution.service';
import { AdminAffiliateManagementService } from './affiliate-management.service';

@Module({
  controllers: [
    AdminAffiliatesController,
    AdminAffiliateReportsController,
    AdminAnalyticsController,
  ],
  providers: [
    AdminAffiliateManagementService,
    ReportBuilderService,
    AffiliateConfigService,
    AdminCodeDistributionService,
    CodeGeneratorService,
    IdempotencyInterceptor,
    IdempotencyStore,
  ],
})
export class AdminModule {}
