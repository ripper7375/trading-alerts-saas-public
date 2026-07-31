import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import Redis from 'ioredis';

import { PrismaService } from '../prisma/prisma.service';
import { AlertQueueService } from './alert-queue.service';
import { DispatcherService } from './dispatcher.service';
import { evaluatePriceEvent, type Dispatch } from './evaluator';
import { createRedisStateStore, type RedisLike } from './state';
import type { AlertWatch, PriceEvent } from './types';
import { buildWatch, type DrawingAlertRow } from './watches';

/**
 * Alert worker — subscribes to the Redis price feed, maintains an in-memory
 * watch cache (invalidated on `alerts:changed`), and evaluates each price
 * event.
 *
 * Requires two DEDICATED Redis connections: one subscriber (pub/sub mode
 * can't run normal commands) and one for state operations — matching
 * source's own topology exactly, not the shared RedisService (that's for
 * the dispatcher's one-off publish calls, a different use case).
 *
 * Env:
 *   REDIS_URL                 (required)
 *   EVAL_ON_FINAL_BAR_ONLY    'true' to act only on closed bars (default off)
 *   ALERT_USE_QUEUE           'false' to bypass BullMQ and dispatch directly
 *
 * Not auto-started: `start()` is called explicitly, only by
 * main-worker.ts's bootstrap — same double-consumer safety rationale as
 * AlertCronScheduler (File 10), since this provider lives in the shared
 * app.module.ts module graph.
 *
 * @module alert-engine/alert-worker.service
 */
@Injectable()
export class AlertWorkerService implements OnModuleDestroy {
  private readonly logger = new Logger(AlertWorkerService.name);

  private subscriber: Redis | null = null;
  private ops: Redis | null = null;
  private cache = new Map<string, AlertWatch[]>();
  private running = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly alertQueue: AlertQueueService,
    private readonly dispatcher: DispatcherService
  ) {}

  async start(): Promise<void> {
    if (this.running) return;
    const url = process.env['REDIS_URL'];
    if (!url) throw new Error('REDIS_URL is required for the alert worker');

    this.subscriber = new Redis(url);
    this.ops = new Redis(url);
    const state = createRedisStateStore(this.ops as unknown as RedisLike);
    const finalOnly = process.env['EVAL_ON_FINAL_BAR_ONLY'] === 'true';

    // Durable fire delivery via BullMQ (default on); falls back to direct
    // dispatch.
    const useQueue = process.env['ALERT_USE_QUEUE'] !== 'false';
    const directDispatch: Dispatch = (fire) => this.dispatcher.dispatch(fire);
    if (useQueue) {
      this.alertQueue.startWorker(
        directDispatch,
        Number(process.env['ALERT_FIRE_CONCURRENCY'] ?? 10)
      );
    }
    const dispatch: Dispatch = useQueue
      ? (fire) => this.alertQueue.enqueueFire(fire)
      : directDispatch;

    await this.reload();
    await this.subscriber.psubscribe('prices:*');
    await this.subscriber.subscribe('alerts:changed');

    this.subscriber.on('pmessage', (_pattern, _channel, message) => {
      void this.handlePrice(message, state, dispatch, finalOnly);
    });
    this.subscriber.on('message', (channel) => {
      if (channel === 'alerts:changed') void this.reload();
    });

    this.running = true;
    this.logger.log(
      `subscribed to prices:* and alerts:changed (queue: ${useQueue ? 'on' : 'off'})`
    );
  }

  async reload(): Promise<void> {
    const rows = await this.prisma.drawingAlert.findMany({
      where: { alert: { isActive: true } },
      include: { drawing: true, alert: true },
    });
    const next = new Map<string, AlertWatch[]>();
    for (const row of rows as unknown as DrawingAlertRow[]) {
      const watch = buildWatch(row);
      if (!watch) continue;
      const key = `${watch.symbol}|${watch.timeframe}`;
      const list = next.get(key) ?? [];
      list.push(watch);
      next.set(key, list);
    }
    this.cache = next;
    this.logger.log(`watches loaded: ${rows.length} rows`);
  }

  private async handlePrice(
    message: string,
    state: ReturnType<typeof createRedisStateStore>,
    dispatch: Dispatch,
    finalOnly: boolean
  ): Promise<void> {
    let ev: PriceEvent;
    try {
      ev = JSON.parse(message) as PriceEvent;
    } catch {
      return;
    }
    if (finalOnly && !ev.final) return;
    const list = this.cache.get(`${ev.symbol}|${ev.timeframe}`);
    if (!list || list.length === 0) return;
    try {
      await evaluatePriceEvent(ev, list, state, dispatch);
    } catch (error) {
      this.logger.error('evaluation error:', error);
    }
  }

  async stop(): Promise<void> {
    if (this.subscriber) await this.subscriber.quit();
    if (this.ops) await this.ops.quit();
    this.subscriber = null;
    this.ops = null;
    this.running = false;
  }

  isRunning(): boolean {
    return this.running;
  }

  /** Drained automatically on SIGTERM/SIGINT via app.enableShutdownHooks()
   * in main-worker.ts (L25) - no separate manual signal handler needed. A
   * no-op in the HTTP process, where start() was never called. */
  async onModuleDestroy(): Promise<void> {
    await this.stop();
  }
}
