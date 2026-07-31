/**
 * Alert worker entrypoint — long-running process.
 *
 * Run (tsx reads tsconfig paths natively):
 *   tsx scripts/alert-worker.ts
 *
 * Deploy as its own service (Railway/Docker), NOT on serverless. Requires
 * DATABASE_URL and REDIS_URL.
 *
 * @module scripts/alert-worker
 */

import { startAlertWorker } from '@/lib/alert-engine/worker';
import { shouldUseOperationServiceForAlerts } from '@/lib/operation-service/flags';

async function main(): Promise<void> {
  if (shouldUseOperationServiceForAlerts()) {
    console.warn(
      '[alert-worker] bypassed: MIGRATE_ALERT_ENGINE=true (alerts evaluating on operation-service)'
    );
    process.exit(0);
  }

  const handle = await startAlertWorker();
  console.warn('[alert-worker] running');

  const shutdown = (): void => {
    void handle.stop().finally(() => process.exit(0));
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

void main().catch((error) => {
  console.error('[alert-worker] fatal:', error);
  process.exit(1);
});
