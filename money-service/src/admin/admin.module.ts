/**
 * Admin Module (Session 4A-6, File 2/3)
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
 */

import { Module } from '@nestjs/common';

import { AffiliateConfigService } from '../affiliate/affiliate-config.service';
import { ReportBuilderService } from '../affiliate/report-builder.service';

import { AdminAffiliateReportsController } from './admin-affiliate-reports.controller';
import { AdminAffiliatesController } from './admin-affiliates.controller';
import { AdminAnalyticsController } from './admin-analytics.controller';
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
  ],
})
export class AdminModule {}
