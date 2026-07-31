import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { Queue, Worker, type ConnectionOptions, type Job } from 'bullmq';

import type { Dispatch } from './evaluator';
import type { FireEvent } from './types';

/**
 * Durable fire queue (BullMQ).
 *
 * Decouples detection from delivery: the evaluator enqueues a fire job and a
 * BullMQ worker runs the dispatcher with retries/backoff, so a transient DB
 * or Redis hiccup doesn't drop an alert. A deterministic jobId dedupes
 * duplicate fires for the same alert/level/bar.
 *
 * Queue name: `op.alerts.fire` (CC-E namespace) — renamed from the
 * monolith's bare `alert-fire`, this service's exactly-one-consumer queue.
 *
 * @module alert-engine/alert-queue.service
 */
const QUEUE_NAME = 'op.alerts.fire';

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

@Injectable()
export class AlertQueueService implements OnModuleDestroy {
  private readonly logger = new Logger(AlertQueueService.name);
  private readonly url: string;
  private readonly queue: Queue;
  private worker: Worker | null = null;

  constructor() {
    this.url = process.env['REDIS_URL'] ?? 'redis://localhost:6379';
    this.queue = new Queue(QUEUE_NAME, {
      connection: makeConnection(this.url),
    });
  }

  async enqueueFire(fire: FireEvent): Promise<void> {
    await this.queue.add('fire', fire, {
      jobId: `${fire.alertId}:${fire.time}:${fire.levelId}`,
      attempts: 5,
      backoff: { type: 'exponential', delay: 1000 },
      removeOnComplete: 1000,
      removeOnFail: 5000,
    });
  }

  /** Starts the fire worker. Called explicitly by main-worker.ts only —
   * never auto-started on construction, so this service can be safely
   * registered in the HTTP process's module graph without double-consuming
   * (CC-C: exactly-one-consumer). */
  startWorker(dispatch: Dispatch, concurrency = 10): Worker {
    if (this.worker) return this.worker;
    this.worker = new Worker(
      QUEUE_NAME,
      async (job: Job): Promise<void> => {
        await dispatch(job.data as FireEvent);
      },
      { connection: makeConnection(this.url), concurrency }
    );
    return this.worker;
  }

  async onModuleDestroy(): Promise<void> {
    if (this.worker) {
      await this.worker.close();
      this.worker = null;
    }
    await this.queue.close();
    this.logger.log('queue closed');
  }
}
