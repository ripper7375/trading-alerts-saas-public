import { Module } from '@nestjs/common';

import { DrawingsController } from './drawings.controller';
import { DrawingsService } from './drawings.service';

/**
 * Chart drawings CRUD domain module (Session 4B-8). `PrismaModule`/
 * `RedisModule` are `@Global()` (established Session 4B-1/4B-2) — no
 * explicit import needed, matching `AlertsModule`'s own convention.
 *
 * @module drawings/drawings.module
 */
@Module({
  controllers: [DrawingsController],
  providers: [DrawingsService],
})
export class DrawingsModule {}
