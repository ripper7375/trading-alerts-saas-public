/**
 * The channel indicators an admin can make active (ADR-010, rule 6).
 *
 * One channel indicator per timeframe: the seven centroid-regression variants and
 * the fractal EDT. Every one of them runs on both charts and a cycle with any of
 * them missing is rejected, so every source always has data for every slot; "active"
 * therefore cannot be inferred from the data and is a setting.
 *
 * A copy of the list in the `active_indicator_settings.source` comment of the
 * Prisma schema and of the monolith's `CENTROID_VARIANTS` (plus `fractal_edt`);
 * test/active-indicator.spec.ts pins it to both, so a source added in one place and
 * not the others fails there.
 */
export const CHANNEL_SOURCES = [
  'best_fit_a',
  'best_fit_b',
  'cherry_a',
  'cherry_b',
  'most_recent',
  'non_a',
  'non_b',
  'fractal_edt',
] as const;
export type ChannelSource = (typeof CHANNEL_SOURCES)[number];

export function isChannelSource(value: unknown): value is ChannelSource {
  return (
    typeof value === 'string' &&
    (CHANNEL_SOURCES as readonly string[]).includes(value)
  );
}

/** A schedule further ahead than this is a mistake (a millisecond timestamp, a wrong year), not a plan. */
export const MAX_SCHEDULE_AHEAD_SEC = 7 * 24 * 60 * 60;

export const MAX_SET_BY_LENGTH = 200;
export const MAX_REASON_LENGTH = 500;
