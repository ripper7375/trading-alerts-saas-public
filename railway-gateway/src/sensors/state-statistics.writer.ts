import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  KEY_FIELDS,
  SERIES_NOTES,
  StateStatisticsRow,
  rowProblems,
} from './state-statistics.series';

/**
 * Writes the rows of `state_statistics` (STACK-D-ARCHITECTURE.md section 2.8, ADR-022; build step 3
 * part 6). The rows come from the Python engine (`mcd_worker/statistics`): a row is one series, state
 * and horizon, recomputed in place as the history grows, so this is an upsert on the series key.
 *
 * Three rules, each held twice (here, and by the database):
 *   - the gate: below n = 30 a row has no number. A row that breaks it is refused here with the
 *     reason; `state_statistics_n_gate` refuses it again if anything else ever writes the table;
 *   - one transaction per call: every row of the batch is written or none is, and a batch is
 *     refused whole when any row in it is wrong (nothing is repaired, nothing is dropped);
 *   - the series notes are the writer's: every row carries `SERIES_NOTES`, whatever the caller sends.
 *
 * It never READS the table (the reader is the only code that does, and a repo guard checks it), so
 * it cannot say whether a row was created or updated: it says how many it wrote.
 *
 * `opposing_level_rate` is written as NULL on both paths. Build step 4 defines the levels and stops
 * it needs and will change this file; until then an upsert that left the column alone would keep a
 * number the gate forbids below n = 30.
 */

export interface StateStatisticsWriteSummary {
  /** Rows this call wrote (created or updated). */
  rows: number;
}

/** Nothing was written: what is wrong with the batch, one line each. */
export class StateStatisticsRefused extends Error {
  constructor(readonly problems: string[]) {
    super(`state statistics refused, nothing written: ${problems.join('; ')}`);
    this.name = 'StateStatisticsRefused';
  }
}

const seriesLabel = (row: Record<string, unknown>) =>
  KEY_FIELDS.map((key) => String(row[key])).join(' | ');

@Injectable()
export class StateStatisticsWriter {
  constructor(private readonly prisma: PrismaService) {}

  /** Everything wrong with `rows` that can be seen without the database. Empty list = they may be written. */
  problems(rows: unknown): string[] {
    if (!Array.isArray(rows)) return ['the rows are not a list'];
    const problems: string[] = [];
    const seen = new Map<string, number>();
    rows.forEach((row: unknown, index: number) => {
      const found = rowProblems(row);
      for (const problem of found) problems.push(`row ${index}: ${problem}`);
      if (found.length === 0) {
        const label = seriesLabel(row as Record<string, unknown>);
        const first = seen.get(label);
        if (first !== undefined)
          problems.push(
            `row ${index}: the same series, state and horizon as row ${first} (${label})`
          );
        else seen.set(label, index);
      }
    });
    return problems;
  }

  async writeRows(
    rows: StateStatisticsRow[]
  ): Promise<StateStatisticsWriteSummary> {
    const problems = this.problems(rows);
    if (problems.length > 0) throw new StateStatisticsRefused(problems);
    if (rows.length === 0) return { rows: 0 };

    const statements = rows.map((row) => {
      const figures = {
        n: row.n,
        forward_move_median: row.forward_move_median,
        forward_move_q1: row.forward_move_q1,
        forward_move_q3: row.forward_move_q3,
        adverse_excursion_median: row.adverse_excursion_median,
        adverse_excursion_q3: row.adverse_excursion_q3,
        opposing_level_rate: null,
        series_notes: SERIES_NOTES,
      };
      return this.prisma.stateStatistic.upsert({
        where: {
          mcd_id_evaluator_version_series_config_hash_key_state_code_horizon_hours:
            {
              mcd_id: row.mcd_id,
              evaluator_version_series: row.evaluator_version_series,
              config_hash_key: row.config_hash_key,
              state_code: row.state_code,
              horizon_hours: row.horizon_hours,
            },
        },
        // a null is written EXPLICITLY on update: Prisma leaves an `undefined` field alone, and a row
        // that falls back below n = 30 must lose its numbers or the database refuses it
        update: figures,
        create: {
          mcd_id: row.mcd_id,
          evaluator_version_series: row.evaluator_version_series,
          config_hash_key: row.config_hash_key,
          state_code: row.state_code,
          horizon_hours: row.horizon_hours,
          ...figures,
        },
      });
    });
    await this.prisma.$transaction(statements);
    return { rows: rows.length };
  }
}
