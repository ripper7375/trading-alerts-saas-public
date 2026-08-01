import { initOtel } from './otel';

initOtel('operation-service');

import { NestFactory } from '@nestjs/core';

import { AlertCronScheduler } from './alert-engine/alert-cron.scheduler';
import { AlertWorkerService } from './alert-engine/alert-worker.service';
import { AppModule } from './app.module';

/**
 * Alert worker entrypoint — long-running process, separate from main.ts's
 * HTTP process. Deploy as its own Railway service, NOT on serverless.
 * Requires DATABASE_URL and REDIS_URL.
 *
 * Ported from scripts/alert-worker.ts. Unlike source's plain
 * process.on('SIGINT'/'SIGTERM') handlers, shutdown here goes through
 * Nest's own enableShutdownHooks() (L25) — AlertWorkerService,
 * AlertQueueService, RedisService, and PrismaService all drain via their
 * own onModuleDestroy hooks, no separate manual signal handler (which would
 * double-fire alongside Nest's own re-emitted signal).
 *
 * @module main-worker
 */
async function bootstrap(): Promise<void> {
  const app = await NestFactory.createApplicationContext(AppModule);
  app.enableShutdownHooks();

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
