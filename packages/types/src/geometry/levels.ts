/**
 * levelsForMark — converts a persisted drawing into the price levels an alert
 * can watch. This is the single source of truth shared by the chart UI and the
 * Phase 4 server worker, guaranteeing both compute identical level prices.
 *
 * TEXT drawings and malformed anchor sets yield an empty list.
 *
 * @module @trading-alerts/types/geometry/levels
 */

import { channelLevels } from './channel';
import {
  DEFAULT_FIB_EXT_RATIOS,
  DEFAULT_FIB_RETRACE_RATIOS,
  fibExtensionLevels,
  fibRetracementLevels,
} from './fib';
import { trendlineValueAt } from './trendline';
import type { AlertLevel, DrawingStyle, MarkSnapshot } from './types';

function readBool(style: DrawingStyle, key: string): boolean {
  return style[key] === true;
}

function readNumber(
  style: DrawingStyle,
  key: string,
  fallback: number
): number {
  const v = style[key];
  return typeof v === 'number' && Number.isFinite(v) ? v : fallback;
}

function readRatios(
  style: DrawingStyle,
  fallback: readonly number[]
): readonly number[] {
  const v = style['levels'];
  if (
    Array.isArray(v) &&
    v.every((x): x is number => typeof x === 'number' && Number.isFinite(x))
  ) {
    return v;
  }
  return fallback;
}

function constLevel(id: string, label: string, price: number): AlertLevel {
  return { id, label, valueAt: (): number => price };
}

export function levelsForMark(snap: MarkSnapshot): AlertLevel[] {
  const { type, anchors, style } = snap;

  switch (type) {
    case 'HLINE': {
      const a = anchors[0];
      if (!a) return [];
      return [constLevel('line', 'Line', a.price)];
    }

    case 'TRENDLINE': {
      const a1 = anchors[0];
      const a2 = anchors[1];
      if (!a1 || !a2) return [];
      const opts = {
        extendLeft: readBool(style, 'extendLeft'),
        extendRight: readBool(style, 'extendRight'),
      };
      return [
        {
          id: 'line',
          label: 'Trendline',
          valueAt: (t: number): number | null =>
            trendlineValueAt(a1, a2, t, opts),
        },
      ];
    }

    case 'CHANNEL': {
      const a1 = anchors[0];
      const a2 = anchors[1];
      if (!a1 || !a2) return [];
      // A drawn channel carries a 3rd anchor on the parallel line; derive the
      // vertical price offset from it. Falls back to style.offset otherwise.
      const a3 = anchors[2];
      let offset = readNumber(style, 'offset', 0);
      if (a3) {
        const base = channelLevels(a1, a2, 0).median(a3.time);
        if (base !== null) offset = a3.price - base;
      }
      const ch = channelLevels(a1, a2, offset);
      return [
        { id: 'channel_top', label: 'Channel Top', valueAt: ch.top },
        { id: 'channel_bottom', label: 'Channel Bottom', valueAt: ch.bottom },
        { id: 'channel_median', label: 'Channel Median', valueAt: ch.median },
      ];
    }

    case 'FIB_RETRACE': {
      const a1 = anchors[0];
      const a2 = anchors[1];
      if (!a1 || !a2) return [];
      const levels = fibRetracementLevels(
        a1,
        a2,
        readRatios(style, DEFAULT_FIB_RETRACE_RATIOS)
      );
      return Object.entries(levels).map(([id, price]) =>
        constLevel(id, id, price)
      );
    }

    case 'FIB_EXT': {
      const a0 = anchors[0];
      const a1 = anchors[1];
      const a2 = anchors[2];
      if (!a0 || !a1 || !a2) return [];
      const levels = fibExtensionLevels(
        a0,
        a1,
        a2,
        readRatios(style, DEFAULT_FIB_EXT_RATIOS)
      );
      return Object.entries(levels).map(([id, price]) =>
        constLevel(id, id, price)
      );
    }

    case 'TEXT':
    default:
      return [];
  }
}
