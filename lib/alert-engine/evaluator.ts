/**
 * Evaluates a price event against the active watches and dispatches fires.
 *
 * Per watch: compute the level price at the bar time, detect a cross/touch,
 * persist the new "previous" price (restart-safe), then gate on cooldown and
 * one-shot before dispatching. Pure orchestration over injected state +
 * dispatcher — no Redis/Prisma imports here.
 *
 * @module lib/alert-engine/evaluator
 */

import { detectCross } from './detect';
import type { AlertStateStore } from './state';
import type { AlertWatch, FireEvent, PriceEvent } from './types';

export type Dispatch = (fire: FireEvent) => Promise<void>;

export async function evaluatePriceEvent(
  ev: PriceEvent,
  watches: AlertWatch[],
  state: AlertStateStore,
  dispatch: Dispatch
): Promise<void> {
  for (const w of watches) {
    if (w.symbol !== ev.symbol || w.timeframe !== ev.timeframe) continue;

    const level = w.valueAt(ev.time);
    if (level === null || !Number.isFinite(level)) continue;

    const prevKey = `alert:prev:${w.alertId}:${w.levelId}`;
    const prev = await state.getPrev(prevKey);

    const crossed = detectCross(
      prev,
      ev.close,
      ev.low,
      ev.high,
      level,
      w.tolerance,
      w.direction
    );
    await state.setPrev(prevKey, ev.close);
    if (!crossed) continue;

    const cooldownKey = `alert:cd:${w.alertId}:${w.levelId}`;
    if (await state.isOnCooldown(cooldownKey)) continue;

    const firedKey = `alert:fired:${w.alertId}`;
    if (w.oneShot && (await state.isFired(firedKey))) continue;

    if (w.cooldownSec > 0) await state.setCooldown(cooldownKey, w.cooldownSec);
    if (w.oneShot) await state.setFired(firedKey);

    await dispatch({
      alertId: w.alertId,
      userId: w.userId,
      symbol: w.symbol,
      timeframe: w.timeframe,
      levelId: w.levelId,
      levelPrice: level,
      touchPrice: ev.close,
      time: ev.time,
      oneShot: w.oneShot,
    });
  }
}
