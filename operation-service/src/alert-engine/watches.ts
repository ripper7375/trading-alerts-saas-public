/**
 * Builds AlertWatch objects from persisted DrawingAlert + Drawing rows, using
 * the SAME shared geometry (`levelsForMark`) the chart uses — so the server
 * evaluates exactly the level the user sees drawn.
 *
 * @module alert-engine/watches
 */

import { levelsForMark } from '@trading-alerts/types/geometry';
import type { MarkSnapshot } from '@trading-alerts/types/geometry';

import type { AlertWatch, Direction } from './types';

export interface DrawingAlertRow {
  id: string;
  alertId: string;
  targetLevel: string;
  direction: string;
  tolerance: number;
  cooldownSec: number;
  oneShot: boolean;
  drawing: {
    id: string;
    userId: string;
    symbol: string;
    timeframe: string;
    type: string;
    anchors: unknown;
    style: unknown;
  };
}

function normalizeDirection(d: string): Direction {
  return d === 'cross_up' || d === 'cross_down' ? d : 'either';
}

/** Returns a watch, or null if the target level no longer exists on the drawing. */
export function buildWatch(row: DrawingAlertRow): AlertWatch | null {
  const snapshot = {
    id: row.drawing.id,
    type: row.drawing.type,
    anchors: row.drawing.anchors,
    style: row.drawing.style,
  } as unknown as MarkSnapshot;

  const level = levelsForMark(snapshot).find((l) => l.id === row.targetLevel);
  if (!level) return null;

  return {
    alertId: row.alertId,
    drawingAlertId: row.id,
    userId: row.drawing.userId,
    symbol: row.drawing.symbol,
    timeframe: row.drawing.timeframe,
    levelId: row.targetLevel,
    valueAt: level.valueAt,
    direction: normalizeDirection(row.direction),
    tolerance: row.tolerance,
    cooldownSec: row.cooldownSec,
    oneShot: row.oneShot,
  };
}
