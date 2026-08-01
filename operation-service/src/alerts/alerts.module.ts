import { Module } from '@nestjs/common';

import { AlertsController } from './alerts.controller';
import { AlertsService } from './alerts.service';
import { LineAlertsController } from './line-alerts.controller';
import { LineAlertsService } from './line-alerts.service';

/**
 * Alerts CRUD domain module (Session 4B-5). `PrismaModule`/`RedisModule` are
 * `@Global()` (established Session 4B-1/4B-2) — no explicit import needed.
 *
 * @module alerts/alerts.module
 */
@Module({
  controllers: [AlertsController, LineAlertsController],
  providers: [AlertsService, LineAlertsService],
})
export class AlertsModule {}
