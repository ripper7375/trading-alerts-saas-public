/**
 * Publishes an `alerts:changed` event so the Phase 4 alert worker can refresh
 * its in-memory watch cache after a drawing/alert mutation.
 *
 * Best-effort: a no-op when REDIS_URL is unset (e.g. before Phase 4 is wired),
 * and never throws — alert/drawing API calls must not fail because Redis is
 * unavailable.
 *
 * @module lib/drawing/invalidate
 */

import { getRedisClient } from '@/lib/redis/client';

export interface AlertsChangedPayload {
  symbol: string;
  timeframe: string;
  alertId?: string;
  drawingId?: string;
  reason: string;
}

export async function publishAlertsChanged(
  payload: AlertsChangedPayload
): Promise<void> {
  if (!process.env['REDIS_URL']) return;
  try {
    await getRedisClient().publish('alerts:changed', JSON.stringify(payload));
  } catch (error) {
    console.error(
      'publishAlertsChanged failed:',
      error instanceof Error ? error.message : error
    );
  }
}
