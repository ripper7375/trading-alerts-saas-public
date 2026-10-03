import { TIMEFRAMES, Timeframe } from '../../cycle/slot';
import type { ChannelMode } from './bundle-types';
import type { Refusal } from './inputs-source';

/**
 * Which tuning a cycle was produced under, as the bundle needs it (rule 9, ADR-015).
 *
 * `market_cycles` keeps `config_hashes` and `source_modes` keyed by timeframe FIRST,
 * `{ "M5": { "best_fit_a": "<hash>" }, "M15": { ... } }`, because the same source can
 * be configured differently on the M5 and the M15 chart. The kit's bundle keys both by
 * SOURCE only (`CycleInputs.config_hash`, `channel_mode`), and the envelope carries the
 * hash of the source an MCD read. Two timeframes that use the SAME source under
 * different tunings cannot both be in one bundle (the plan's S5, Davin's Q13): the
 * loader refuses that cycle instead of changing the kit.
 */

export interface TimeframeTuning {
  hashes: Record<string, string>;
  modes: Record<string, ChannelMode>;
}

export type TuningResult =
  | { ok: true; tuning: Partial<Record<Timeframe, TimeframeTuning>> }
  | { ok: false; detail: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** The contract's mode text as the kit writes it. An explicit comparison: a lookup table would also answer "toString". */
function channelMode(entry: unknown): ChannelMode | undefined {
  if (entry === 'DYNAMIC') return 'dynamic';
  if (entry === 'FROZEN') return 'frozen';
  return undefined;
}

/**
 * The two JSON columns of a READY row as per-timeframe tuning. A column that is NULL
 * is "nothing recorded" (a row from before the promote work), not an error; a column
 * that is not `{ timeframe: { source: value } }` with the contract's values (a
 * non-empty hash, DYNAMIC or FROZEN) is a row that cannot be trusted.
 */
export function readTuning(row: {
  config_hashes: unknown;
  source_modes: unknown;
}): TuningResult {
  const tuning: Partial<Record<Timeframe, TimeframeTuning>> = {};
  const section = (timeframe: Timeframe): TimeframeTuning =>
    (tuning[timeframe] ??= { hashes: {}, modes: {} });

  for (const [column, value] of [
    ['config_hashes', row.config_hashes],
    ['source_modes', row.source_modes],
  ] as const) {
    if (value === null || value === undefined) continue;
    if (!isRecord(value))
      return { ok: false, detail: `${column} is not an object` };
    for (const [timeframe, sources] of Object.entries(value)) {
      if (!(TIMEFRAMES as readonly string[]).includes(timeframe))
        return { ok: false, detail: `${column} has timeframe ${timeframe}` };
      if (!isRecord(sources))
        return { ok: false, detail: `${column}.${timeframe} is not an object` };
      for (const [source, entry] of Object.entries(sources)) {
        if (column === 'config_hashes') {
          if (typeof entry !== 'string' || entry === '')
            return {
              ok: false,
              detail: `${column}.${timeframe}.${source} is not a hash`,
            };
          section(timeframe as Timeframe).hashes[source] = entry;
        } else {
          const mode = channelMode(entry);
          if (mode === undefined)
            return {
              ok: false,
              detail: `${column}.${timeframe}.${source} is not DYNAMIC or FROZEN`,
            };
          section(timeframe as Timeframe).modes[source] = mode;
        }
      }
    }
  }
  return { ok: true, tuning };
}

export interface MergedTuning {
  config_hash: Record<string, string>;
  channel_mode: Record<string, ChannelMode>;
  refusals: Refusal[];
  notes: string[];
}

/**
 * Per-timeframe tuning to the bundle's per-source maps.
 *
 * The rule is: a source's entry is the value the cycle recorded for the timeframe
 * THAT USES the source (the one whose active indicator it is), because that is the
 * value an MCD reading that timeframe must carry.
 *
 *   - A source used by ONE timeframe takes that timeframe's value. What the other
 *     timeframe recorded for the same name is a different chart's indicator and is
 *     ignored (in production every centroid runs on both charts, so this is the
 *     normal case, not a collision).
 *   - A source used by BOTH timeframes with two different values is a COLLISION: a
 *     refusal, and no entry (the bundle cannot say which chart's tuning it means).
 *   - A source no timeframe uses is carried only when every timeframe that recorded
 *     it agrees; when they differ it is left out and noted. No evaluator reads it.
 *   - "Different" needs two recorded values. A timeframe that recorded nothing for a
 *     source it uses is not a conflict; the entry is then absent when the using
 *     timeframe is the one that recorded nothing.
 */
export function mergeTuning(
  usedSources: Partial<Record<Timeframe, string>>,
  perTimeframe: Partial<Record<Timeframe, TimeframeTuning>>
): MergedTuning {
  const config_hash: Record<string, string> = {};
  const channel_mode: Record<string, ChannelMode> = {};
  const refusals: Refusal[] = [];
  const notes: string[] = [];

  const merge = <V extends string>(
    field: 'config_hash' | 'channel_mode',
    pick: (tuning: TimeframeTuning) => Record<string, V>,
    into: Record<string, V>
  ): void => {
    const recorded = {} as Record<Timeframe, Record<string, V> | undefined>;
    const sources = new Set<string>();
    for (const timeframe of TIMEFRAMES) {
      const tuning = perTimeframe[timeframe];
      recorded[timeframe] = tuning ? pick(tuning) : undefined;
      for (const source of Object.keys(recorded[timeframe] ?? {}))
        sources.add(source);
    }
    for (const source of [...sources].sort()) {
      const using = TIMEFRAMES.filter((tf) => usedSources[tf] === source);
      const valuesOf = (timeframes: readonly Timeframe[]) =>
        timeframes.flatMap((tf) => {
          const value = recorded[tf]?.[source];
          return value === undefined ? [] : [[tf, value] as const];
        });
      const scope = using.length > 0 ? using : TIMEFRAMES;
      const values = valuesOf(scope);
      const distinct = new Set(values.map(([, value]) => value));
      if (distinct.size === 1) {
        into[source] = values[0][1];
      } else if (distinct.size > 1 && using.length > 0) {
        refusals.push({
          code: 'SOURCE_COLLISION',
          source,
          field,
          values: Object.fromEntries(values) as Partial<
            Record<Timeframe, string>
          >,
          detail: `M5 and M15 both use ${source} with a different ${field}: ${values.map(([tf, value]) => `${tf} ${value}`).join(', ')}`,
        });
      } else if (distinct.size > 1) {
        notes.push(
          `${field} of ${source} left out: M5 and M15 recorded different values and no timeframe uses it`
        );
      }
    }
  };

  merge('config_hash', (t) => t.hashes, config_hash);
  merge('channel_mode', (t) => t.modes, channel_mode);
  return { config_hash, channel_mode, refusals, notes };
}
