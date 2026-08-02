import { Module } from '@nestjs/common';

import { RealtimeGateway } from './realtime.gateway';

/**
 * Realtime delivery module (F8, Session 4B-17). `RedisModule` is
 * `@Global()` (Session 4B-2) — no explicit import needed, matching
 * `DrawingsModule`'s/`AlertsModule`'s own convention.
 *
 * @module realtime/realtime.module
 */
@Module({
  providers: [RealtimeGateway],
})
export class RealtimeModule {}
