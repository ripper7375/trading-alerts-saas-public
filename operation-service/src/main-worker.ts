import { initOtel } from './otel';

initOtel('operation-service');

import { NestFactory } from '@nestjs/core';

import { AlertCronScheduler } from './alert-engine/alert-cron.scheduler';
import { AlertWorkerService } from './alert-engine/alert-worker.service';
import { AppModule } from './app.module';
import { PinoLoggerService } from './common/logging/logging.service';

/**
 * Alert worker entrypoint — long-running process, separate from main.ts's
 * HTTP process. Deploy as its own Railway service, NOT on serverless.
 * Requires DATABASE_URL and REDIS_URL.
 *
 * Ported from scripts/alert-worker.ts. Unlike source's plain
 * process.on('SIGINT'/'SIGTERM') handlers, shutdown here goes through
 * Nest's own shutdown hooks (enableShutdownHooks) — AlertWorkerService,
 * AlertQueueService, RedisService, and PrismaService all drain via their
 * own onModuleDestroy hooks, no separate manual signal handler (which would
 * double-fire alongside Nest's own re-emitted signal).
 *
 * @module main-worker
 */
async function bootstrap(): Promise<void> {
  const app = await NestFactory.createApplicationContext(AppModule, {
    bufferLogs: true,
  });
  app.useLogger(app.get(PinoLoggerService));
  // useProcessExit: end with process.exit(0) once the hooks are done, like
  // main.ts. By default Nest removes its listeners and re-sends the signal to
  // the process, so the worker would end by being killed with the signal. This
  // is an application context (no HTTP server, nothing to drain besides the
  // hooks), so exiting right after the hooks is safe.
  app.enableShutdownHooks(undefined, { useProcessExit: true });

  const worker = app.get(AlertWorkerService);
  const scheduler = app.get(AlertCronScheduler);

  await worker.start();
  scheduler.enable();

  console.warn('[alert-worker] running');
}

void bootstrap().catch((error) => {
  console.error('[alert-worker] fatal:', error);
  process.exit(1);
});
