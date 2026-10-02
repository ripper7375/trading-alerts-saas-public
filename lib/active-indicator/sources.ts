/**
 * The channel indicators an admin can make active (STACK-D-ARCHITECTURE.md rule 6,
 * ADR-010): the seven centroid-regression variants and the fractal EDT.
 *
 * The gateway owns the setting and validates it
 * (`railway-gateway/src/cycle/active-indicator/channel-sources.ts`, pinned to this
 * list by the gateway's `active-indicator.spec.ts`); this module only types the
 * answer and says which `market_data_v6` columns hold each source's channel lines.
 *
 * @module lib/active-indicator/sources
 */

import { CENTROID_VARIANTS, type CentroidVariant } from '@/types/indicator';

export const CHANNEL_SOURCES = [...CENTROID_VARIANTS, 'fractal_edt'] as const;
export type ChannelSource = CentroidVariant | 'fractal_edt';

export function isChannelSource(value: unknown): value is ChannelSource {
  return (
    typeof value === 'string' &&
    (CHANNEL_SOURCES as readonly string[]).includes(value)
  );
}

/** The two timeframes the pipeline carries. */
export const ACTIVE_INDICATOR_TIMEFRAMES = ['M5', 'M15'] as const;
export type ActiveIndicatorTimeframe =
  (typeof ACTIVE_INDICATOR_TIMEFRAMES)[number];

export function isActiveIndicatorTimeframe(
  value: unknown
): value is ActiveIndicatorTimeframe {
  return (
    typeof value === 'string' &&
    (ACTIVE_INDICATOR_TIMEFRAMES as readonly string[]).includes(value)
  );
}

/**
 * The market_data_v6 columns of a source's channel: upper EDT, the base fit line,
 * lower EDT. The centroid variants share one naming (`<variant>_uoedt`,
 * `<variant>_base_fl`, `<variant>_loedt`); the fractal EDT names them differently
 * (`fractal_uoedt`, `fractal_best_fl`, `fractal_loedt`).
 */
export function channelColumns(source: ChannelSource): {
  upper: string;
  mid: string;
  lower: string;
} {
  if (source === 'fractal_edt') {
    return {
      upper: 'fractal_uoedt',
      mid: 'fractal_best_fl',
      lower: 'fractal_loedt',
    };
  }
  return {
    upper: `${source}_uoedt`,
    mid: `${source}_base_fl`,
    lower: `${source}_loedt`,
  };
}
