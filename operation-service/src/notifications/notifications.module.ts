import { Module } from '@nestjs/common';

import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';

/**
 * Notifications domain module (Session 4B-9). `PrismaModule` is `@Global()`
 * (established Session 4B-1/4B-2) — no explicit import needed, matching
 * `AlertsModule`/`DrawingsModule`'s own convention.
 *
 * @module notifications/notifications.module
 */
@Module({
  controllers: [NotificationsController],
  providers: [NotificationsService],
})
export class NotificationsModule {}
