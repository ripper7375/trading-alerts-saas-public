import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  MIN_SAMPLE,
  SeriesQuery,
  keyProblems,
  seriesKeyOf,
} from './state-statistics.series';

/**
 * The ONLY code that reads `state_statistics` (STACK-D-ARCHITECTURE.md section 2.8, ADR-022; build
 * step 3 part 6). A number reaches a prompt only from this table, and only through here, always with
 * the `n` it came from. `test/no-direct-state-statistics-reads.spec.ts` fails if another file reads it.
 *
 * What it answers, for one reading's series, state and horizon:
 *   - `MEASURED`: n is at least 30 and every figure is there. The answer carries `n` and `min_sample`
 *     with the figures; there is no way to get a figure without them.
 *   - `PROVISIONAL`: words only, no figure. The state has fewer than 30 outcomes at this horizon
 *     (`BELOW_MIN_SAMPLE`), or has never been seen in this series (`NO_HISTORY`, n = 0: a new
 *     evaluator MINOR or a changed `config_hash` starts a series, and it starts at nothing), or the
 *     stored row cannot be trusted (`ROW_UNUSABLE`). The gate is applied HERE as well as by the
 *     writer and by the database CHECK: a row with n = 29 and a number in it (a table made without
 *     the migration's CHECK) is still answered in words, and the number is dropped.
 *
 * The series is found from the reading itself (its MCD, `evaluator_version` and `config_hash`): a
 * PATCH of the evaluator reads the same row, a MINOR change reads another. Nothing is read twice,
 * ordered, or taken as "the latest": one exact key, `findUnique` and nothing else (rule 5's spirit).
 *
 * Not wired into any module yet. Nothing in the gateway calls it before the section 5 prompt
 * assembler (build step 5), as with the step 2 read side; a caller registers it where it is used.
 */

export interface MeasuredStatistics {
  status: 'MEASURED';
  /** Occurrences of the state in the series with an outcome at this horizon: at least `min_sample`. */
  n: number;
  min_sample: typeof MIN_SAMPLE;
  horizon_hours: number;
  /** Price units (USD per ounce), bias-aligned: positive is favourable for the state's bias. */
  forward_move: { median: number; q1: number; q3: number };
  /** Price units, never negative. */
  adverse_excursion: { median: number; q3: number };
  /** A fraction from 0 to 1. Null until build step 4 defines the levels and stops it needs. */
  opposing_level_rate: number | null;
  series_notes: string;
}

export type ProvisionalReason =
  | 'NO_HISTORY'
  | 'BELOW_MIN_SAMPLE'
  | 'ROW_UNUSABLE';

export interface ProvisionalStatistics {
  status: 'PROVISIONAL';
  reason: ProvisionalReason;
  /** What the table says (0 when there is no row). The only number in a provisional answer besides the minimum. */
  n: number;
  min_sample: typeof MIN_SAMPLE;
  horizon_hours: number;
  /** English pivot sentence for the prompt: no figure, no percentage, none of the banned words. */
  words: string;
}

export type StatisticsReading = MeasuredStatistics | ProvisionalStatistics;

/** The columns of a stored row this module uses (a `StateStatistic`, without ids and timestamps). */
export interface StoredStatistics {
  n: number;
  forward_move_median: number | null;
  forward_move_q1: number | null;
  forward_move_q3: number | null;
  opposing_level_rate: number | null;
  adverse_excursion_median: number | null;
  adverse_excursion_q3: number | null;
  series_notes: string;
}

/** The query is not shaped like a reading of a real MCD (the caller's mistake, not missing data). */
export class InvalidStatisticsQuery extends Error {
  constructor(readonly problems: string[]) {
    super(`invalid statistics query: ${problems.join('; ')}`);
    this.name = 'InvalidStatisticsQuery';
  }
}

const isNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);

/**
 * The words of a provisional answer. English, the pivot of the 16 languages; no number but `n` and
 * the minimum, no percentage, none of the kit's banned words (a spec runs the kit's own check on
 * every sentence this can produce).
 */
export function provisionalWords(
  reason: ProvisionalReason,
  n: number,
  horizonHours: number
): string {
  switch (reason) {
    case 'NO_HISTORY':
      return `No past occurrence of this state has a measured outcome at the ${horizonHours}-hour horizon yet. Describe it in words only and do not quote a figure.`;
    case 'BELOW_MIN_SAMPLE':
      return `Provisional: past occurrences of this state with a measured outcome at the ${horizonHours}-hour horizon: ${n} of the ${MIN_SAMPLE} needed before a figure is quoted. Describe it in words only and do not quote a figure.`;
    case 'ROW_UNUSABLE':
      return `The stored figures for this state at the ${horizonHours}-hour horizon are incomplete or inconsistent, so none is quoted. Describe it in words only.`;
  }
}

function provisional(
  reason: ProvisionalReason,
  n: number,
  horizonHours: number
): ProvisionalStatistics {
  return {
    status: 'PROVISIONAL',
    reason,
    n,
    min_sample: MIN_SAMPLE,
    horizon_hours: horizonHours,
    words: provisionalWords(reason, n, horizonHours),
  };
}

/**
 * What a stored row (or its absence) is worth. Pure: the gate and the checks that keep a bad row from
 * reaching a prompt live here, so they can be tried without a database.
 */
export function interpretRow(
  row: StoredStatistics | null,
  horizonHours: number
): StatisticsReading {
  if (row === null) return provisional('NO_HISTORY', 0, horizonHours);
  if (!Number.isInteger(row.n) || row.n < 0)
    return provisional('ROW_UNUSABLE', 0, horizonHours);
  // the gate: whatever the figures say, fewer than 30 outcomes are quoted in words
  if (row.n < MIN_SAMPLE)
    return provisional('BELOW_MIN_SAMPLE', row.n, horizonHours);

  const {
    forward_move_q1: q1,
    forward_move_median: median,
    forward_move_q3: q3,
    adverse_excursion_median: adverseMedian,
    adverse_excursion_q3: adverseQ3,
    opposing_level_rate: rate,
  } = row;
  if (
    !isNumber(q1) ||
    !isNumber(median) ||
    !isNumber(q3) ||
    !isNumber(adverseMedian) ||
    !isNumber(adverseQ3) ||
    !(q1 <= median && median <= q3) ||
    !(adverseMedian >= 0 && adverseMedian <= adverseQ3) ||
    !(rate === null || (isNumber(rate) && rate >= 0 && rate <= 1))
  )
    return provisional('ROW_UNUSABLE', row.n, horizonHours);

  return {
    status: 'MEASURED',
    n: row.n,
    min_sample: MIN_SAMPLE,
    horizon_hours: horizonHours,
    forward_move: { median, q1, q3 },
    adverse_excursion: { median: adverseMedian, q3: adverseQ3 },
    opposing_level_rate: rate,
    series_notes: row.series_notes,
  };
}

@Injectable()
export class StateStatisticsReader {
  constructor(private readonly prisma: PrismaService) {}

  /** The statistics of one state of a reading's series at one horizon. Throws `InvalidStatisticsQuery` for a query that names no real row. */
  async read(query: SeriesQuery): Promise<StatisticsReading> {
    let key;
    try {
      key = seriesKeyOf(query);
    } catch (error) {
      throw new InvalidStatisticsQuery([(error as Error).message]);
    }
    const problems = keyProblems(key);
    if (problems.length > 0) throw new InvalidStatisticsQuery(problems);

    const row = await this.prisma.stateStatistic.findUnique({
      where: {
        mcd_id_evaluator_version_series_config_hash_key_state_code_horizon_hours:
          key,
      },
    });
    return interpretRow(row, key.horizon_hours);
  }
}
