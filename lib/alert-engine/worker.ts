/**
 * Alert worker — subscribes to the Redis price feed, maintains an in-memory
 * watch cache (invalidated on `alerts:changed`), and evaluates each price event.
 *
 * Requires two Redis connections: one dedicated subscriber (pub/sub mode can't
 * run normal commands) and one for state operations.
 *
 * Env:
 *   REDIS_URL                 (required)
 *   EVAL_ON_FINAL_BAR_ONLY    'true' to act only on closed bars (default off)
 *
 * @module lib/alert-engine/worker
 */

import Redis from 'ioredis';

import { prisma } from '@/lib/db/prisma';

import { createPrismaDispatcher } from './dispatcher';
import { evaluatePriceEvent } from './evaluator';
import { createRedisStateStore, type RedisLike } from './state';
import type { AlertWatch, PriceEvent } from './types';
import { buildWatch, type DrawingAlertRow } from './watches';

export interface AlertWorkerHandle {
  reload(): Promise<void>;
  stop(): Promise<void>;
}

export async function startAlertWorker(): Promise<AlertWorkerHandle> {
  const url = process.env['REDIS_URL'];
  if (!url) throw new Error('REDIS_URL is required for the alert worker');

  const subscriber = new Redis(url);
  const ops = new Redis(url);
  const state = createRedisStateStore(ops as unknown as RedisLike);
  const dispatch = createPrismaDispatcher();
  const finalOnly = process.env['EVAL_ON_FINAL_BAR_ONLY'] === 'true';

  // symbol|timeframe -> watches
  let cache = new Map<string, AlertWatch[]>();

  async function reload(): Promise<void> {
    const rows = await prisma.drawingAlert.findMany({
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
    cache = next;
    console.info(`[alert-worker] watches loaded: ${rows.length} rows`);
  }

  async function handlePrice(message: string): Promise<void> {
    let ev: PriceEvent;
    try {
      ev = JSON.parse(message) as PriceEvent;
    } catch {
      return;
    }
    if (finalOnly && !ev.final) return;
    const list = cache.get(`${ev.symbol}|${ev.timeframe}`);
    if (!list || list.length === 0) return;
    try {
      await evaluatePriceEvent(ev, list, state, dispatch);
    } catch (error) {
      console.error('[alert-worker] evaluation error:', error);
    }
  }

  await reload();
  await subscriber.psubscribe('prices:*');
  await subscriber.subscribe('alerts:changed');

  subscriber.on('pmessage', (_pattern, _channel, message) => {
    void handlePrice(message);
  });
  subscriber.on('message', (channel) => {
    if (channel === 'alerts:changed') void reload();
  });

  console.info('[alert-worker] subscribed to prices:* and alerts:changed');

  return {
    reload,
    async stop() {
      await subscriber.quit();
      await ops.quit();
    },
  };
}
