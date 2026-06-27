/**
 * Durable fire queue (BullMQ).
 *
 * Decouples detection from delivery: the evaluator enqueues a fire job and a
 * BullMQ worker runs the dispatcher with retries/backoff, so a transient DB or
 * Redis hiccup doesn't drop an alert. A deterministic jobId dedupes duplicate
 * fires for the same alert/level/bar.
 *
 * @module lib/alert-engine/queue
 */

import { Queue, Worker, type ConnectionOptions, type Job } from 'bullmq';

import type { Dispatch } from './evaluator';
import type { FireEvent } from './types';

const QUEUE_NAME = 'alert-fire';

/**
 * Build BullMQ connection options from a REDIS_URL. BullMQ needs
 * `maxRetriesPerRequest: null`; passing options (not an ioredis instance)
 * avoids cross-package type/version mismatches.
 */
function makeConnection(url: string): ConnectionOptions {
  const u = new URL(url);
  const db = u.pathname.length > 1 ? Number(u.pathname.slice(1)) : undefined;
  return {
    host: u.hostname,
    port: u.port ? Number(u.port) : 6379,
    username: u.username || undefined,
    password: u.password || undefined,
    maxRetriesPerRequest: null,
    ...(typeof db === 'number' && Number.isFinite(db) ? { db } : {}),
    ...(u.protocol === 'rediss:' ? { tls: {} } : {}),
  };
}

export function createFireQueue(url: string): Queue {
  return new Queue(QUEUE_NAME, { connection: makeConnection(url) });
}

export async function enqueueFire(
  queue: Queue,
  fire: FireEvent
): Promise<void> {
  await queue.add('fire', fire, {
    jobId: `${fire.alertId}:${fire.time}:${fire.levelId}`,
    attempts: 5,
    backoff: { type: 'exponential', delay: 1000 },
    removeOnComplete: 1000,
    removeOnFail: 5000,
  });
}

export function startFireWorker(
  url: string,
  dispatch: Dispatch,
  concurrency = 10
): Worker {
  return new Worker(
    QUEUE_NAME,
    async (job: Job): Promise<void> => {
      await dispatch(job.data as FireEvent);
    },
    { connection: makeConnection(url), concurrency }
  );
}
