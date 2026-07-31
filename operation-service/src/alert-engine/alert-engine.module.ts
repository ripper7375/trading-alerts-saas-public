import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';

import { AlertCheckerService } from './alert-checker.service';
import { AlertCronScheduler } from './alert-cron.scheduler';
import { AlertQueueService } from './alert-queue.service';
import { AlertWorkerService } from './alert-worker.service';
import { DispatcherService } from './dispatcher.service';
import { NotifyBridgeService } from './notify-bridge.service';

/**
 * Alert engine domain module — registers every injectable piece of the
 * ported alert engine (Files 7-10, 12). PrismaModule/RedisModule are
 * @Global(), so no explicit import is needed here for those.
 *
 * Providers here do NOT auto-start anything (no OnModuleInit/@Cron auto-run
 * side effects that touch Redis/DB) merely from being constructed - only
 * `@Interval()` on AlertCronScheduler fires unconditionally, and its handler
 * is internally gated (see that file's own header). AlertWorkerService's
 * subscriber loop and AlertQueueService's BullMQ worker are both started by
 * explicit method calls only main-worker.ts makes. This module can
 * therefore be safely imported into the shared app.module.ts (used by both
 * the HTTP process and the worker process) without double-consuming.
 *
 * @module alert-engine/alert-engine.module
 */
@Module({
  imports: [ScheduleModule.forRoot()],
  providers: [
    DispatcherService,
    NotifyBridgeService,
    AlertQueueService,
    AlertCheckerService,
    AlertCronScheduler,
    AlertWorkerService,
  ],
  exports: [AlertWorkerService, AlertCronScheduler, AlertQueueService],
})
export class AlertEngineModule {}
