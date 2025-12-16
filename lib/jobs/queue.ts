/**
 * Job Queue
 *
 * Simple job queue for scheduling background tasks.
 * Uses setTimeout-based scheduling (can be replaced with BullMQ for production).
 *
 * @module lib/jobs/queue
 */

import { checkAlerts } from './alert-checker';

/**
 * Alert checker interval in milliseconds (60 seconds)
 */
const ALERT_CHECK_INTERVAL = 60 * 1000;

/**
 * Reference to the alert checker interval
 */
let alertCheckInterval: NodeJS.Timeout | null = null;

/**
 * Flag to prevent concurrent runs
 */
let isRunning = false;

/**
 * Start the alert checker job
 *
 * Runs the alert checker immediately and then every 60 seconds.
 */
export function startAlertChecker(): void {
  if (alertCheckInterval) {
    console.log('[JobQueue] Alert checker already running');
    return;
  }

  console.log('[JobQueue] Starting alert checker (every 60 seconds)');

  // Run immediately on start
  runAlertChecker();

  // Then run every 60 seconds
  alertCheckInterval = setInterval(runAlertChecker, ALERT_CHECK_INTERVAL);
}

/**
 * Stop the alert checker job
 */
export function stopAlertChecker(): void {
  if (alertCheckInterval) {
    clearInterval(alertCheckInterval);
    alertCheckInterval = null;
    console.log('[JobQueue] Alert checker stopped');
  }
}

/**
 * Run the alert checker with concurrency protection
 */
async function runAlertChecker(): Promise<void> {
  if (isRunning) {
    console.log('[JobQueue] Alert checker already running, skipping...');
    return;
  }

  isRunning = true;
  const startTime = Date.now();

  try {
    await checkAlerts();
    const duration = Date.now() - startTime;
    console.log(`[JobQueue] Alert check completed in ${duration}ms`);
  } catch (error) {
    console.error('[JobQueue] Alert check failed:', error);
  } finally {
    isRunning = false;
  }
}

/**
 * Check if the alert checker is running
 */
export function isAlertCheckerRunning(): boolean {
  return alertCheckInterval !== null;
}

/**
 * Get the alert checker interval
 */
export function getAlertCheckInterval(): number {
  return ALERT_CHECK_INTERVAL;
}

/**
 * Manually trigger an alert check
 */
export async function triggerAlertCheck(): Promise<void> {
  console.log('[JobQueue] Manually triggering alert check');
  await runAlertChecker();
}

// Re-export checkAlerts for direct use
export { checkAlerts };

/**
 * Job queue status
 */
export interface QueueStatus {
  alertChecker: {
    running: boolean;
    interval: number;
    lastRun?: Date;
  };
}

/**
 * Get the current queue status
 */
export function getQueueStatus(): QueueStatus {
  return {
    alertChecker: {
      running: isAlertCheckerRunning(),
      interval: ALERT_CHECK_INTERVAL,
    },
  };
}

/**
 * Initialize all background jobs
 *
 * Call this on server startup to start all scheduled jobs.
 */
export function initializeJobs(): void {
  console.log('[JobQueue] Initializing background jobs...');

  // Start alert checker in production
  if (process.env.NODE_ENV === 'production') {
    startAlertChecker();
  } else {
    console.log('[JobQueue] Skipping job initialization in development');
    console.log('[JobQueue] Use triggerAlertCheck() to manually run');
  }
}

/**
 * Shutdown all background jobs
 *
 * Call this on server shutdown to gracefully stop all jobs.
 */
export function shutdownJobs(): void {
  console.log('[JobQueue] Shutting down background jobs...');
  stopAlertChecker();
}
