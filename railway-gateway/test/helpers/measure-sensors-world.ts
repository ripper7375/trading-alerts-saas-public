import { slotToIso } from '../../src/sensors/inputs/stats-slot';
import type {
  JobSample,
  ReadySample,
  ReplaySample,
  SensorRowSample,
} from '../../src/sensors/measure-sensors';

/**
 * A fixture for the sensor measurement kit (build step 3 part 7): eight cycles of four MCDs
 * (32 `mcd_outputs` rows), the READY `market_cycles` slots they came from, the outcomes of the
 * `cycle-ready` jobs, and three replay verdicts, with numbers chosen so that every figure in the
 * report can be worked out by hand. `measure-sensors.spec.ts` states each expected value with its
 * working. The table below is the whole dataset.
 *
 *   MCD0 is the gate. MCD1 uses the M15 channel, MCD2 the M5 channel, MCD3 both (the registries'
 *   `uses_channel`). Only a VALID MCD0 defect marks the channel MCDs, and only a VALID or
 *   CAUTIONARY reading is marked (mcd_worker/inheritance.py).
 *
 *   k  MCD0 reading                          MCD1                MCD2                  MCD3
 *   0  VALID  ALL_QUALIFIED                  VALID               VALID                 VALID
 *   1  VALID  M5_M15_DEFECT                  CAUT  D15           CAUT  D5              CAUT  U1 U2 D5 D15
 *   2  VALID  M5_M15_DEFECT                  CAUT  D15           INVALID INSUFF_BARS   INVALID UNAVAIL:MCD2
 *   3  VALID  M5_DEFECT                      VALID               CAUT  D5              CAUT  U2 D5
 *   4  VALID  M15_DEFECT                     CAUT  D15           VALID                 CAUT  U1 D15
 *   5  STALE  DATA_STALE                     VALID               STALE DATA_STALE      INVALID UNAVAIL:MCD2
 *   6  VALID  M5_M15_DEFECT                  CAUT  D15           CAUT  D5              INVALID EVALUATOR_ERROR (RAISED)
 *   7  INVALID EVALUATOR_ERROR (SCHEMA,      VALID               VALID                 VALID
 *      WORDING)
 *
 *   D5, D15 = MCD0_DEFECT_M5, MCD0_DEFECT_M15; U1, U2 = UPSTREAM_CAUTIONARY:MCD1 / :MCD2.
 *
 *   duration_ms of each row, by k:
 *     MCD0   4    5    6    4    3    2    5    3
 *     MCD1  20   22   24   26   28   30   32   34
 *     MCD2  40   44   48   52   56   60   64   68
 *     MCD3 100  110  120  130  140  150  160 1200
 *
 *   ready_at - slot = 60 + 2k (60 62 64 66 68 70 72 74)
 *   evaluated_at - ready_at  = 1 1 2 2 3 3 5 40   (cycle 7 waited through retries)
 *   job wall time of cycle k, ms: 250 260 280 300 330 350 380 1500
 *
 *   Jobs: the eight WRITTEN ones above, two SKIPPED_OLD (the slots after k = 7 that have a READY
 *   row and no reading), one NOTHING_ENABLED (a slot before k = 0).
 */
export const FIRST_SLOT = 1789764900;
export const SLOT_SECONDS = 300;
export const slotOf = (k: number): number => FIRST_SLOT + SLOT_SECONDS * k;

// prettier-ignore
type Reading = { status: string; state: string | null; bias: string | null; reasons: string[]; guard?: string[] };

const NONE: Reading = {
  status: 'INVALID',
  state: null,
  bias: null,
  reasons: [],
};
const reading = (
  status: string,
  state: string | null,
  reasons: string[] = [],
  guard: string[] = []
): Reading => ({
  status,
  state,
  bias: state === null ? null : 'NEUTRAL',
  reasons,
  guard,
});

const D5 = 'MCD0_DEFECT_M5';
const D15 = 'MCD0_DEFECT_M15';
const U1 = 'UPSTREAM_CAUTIONARY:MCD1';
const U2 = 'UPSTREAM_CAUTIONARY:MCD2';
const UNAVAIL2 = 'UPSTREAM_UNAVAILABLE:MCD2';

const MCD0_BOTH = 'MCD0_M5_M15_DEFECT';

// prettier-ignore
const CYCLES: Array<Record<'MCD0' | 'MCD1' | 'MCD2' | 'MCD3', Reading>> = [
  { MCD0: reading('VALID', 'MCD0_ALL_QUALIFIED'), MCD1: reading('VALID', 'MCD1_UP'), MCD2: reading('VALID', 'MCD2_UP'), MCD3: reading('VALID', 'MCD3_UP') },
  { MCD0: reading('VALID', MCD0_BOTH), MCD1: reading('CAUTIONARY', 'MCD1_UP', [D15]), MCD2: reading('CAUTIONARY', 'MCD2_UP', [D5]), MCD3: reading('CAUTIONARY', 'MCD3_UP', [U1, U2, D5, D15]) },
  { MCD0: reading('VALID', MCD0_BOTH), MCD1: reading('CAUTIONARY', 'MCD1_UP', [D15]), MCD2: reading('INVALID', null, ['INSUFFICIENT_BARS']), MCD3: reading('INVALID', null, [UNAVAIL2]) },
  { MCD0: reading('VALID', 'MCD0_M5_DEFECT'), MCD1: reading('VALID', 'MCD1_UP'), MCD2: reading('CAUTIONARY', 'MCD2_UP', [D5]), MCD3: reading('CAUTIONARY', 'MCD3_UP', [U2, D5]) },
  { MCD0: reading('VALID', 'MCD0_M15_DEFECT'), MCD1: reading('CAUTIONARY', 'MCD1_UP', [D15]), MCD2: reading('VALID', 'MCD2_UP'), MCD3: reading('CAUTIONARY', 'MCD3_UP', [U1, D15]) },
  { MCD0: reading('STALE', null, ['DATA_STALE']), MCD1: reading('VALID', 'MCD1_UP'), MCD2: reading('STALE', null, ['DATA_STALE']), MCD3: reading('INVALID', null, [UNAVAIL2]) },
  { MCD0: reading('VALID', MCD0_BOTH), MCD1: reading('CAUTIONARY', 'MCD1_UP', [D15]), MCD2: reading('CAUTIONARY', 'MCD2_UP', [D5]), MCD3: reading('INVALID', null, ['EVALUATOR_ERROR'], ['RAISED: ZeroDivisionError: division by zero']) },
  { MCD0: reading('INVALID', null, ['EVALUATOR_ERROR'], ["SCHEMA: /levels: must NOT have more than 12 items", "WORDING: commentary contains '%'"]), MCD1: reading('VALID', 'MCD1_UP'), MCD2: reading('VALID', 'MCD2_UP'), MCD3: reading('VALID', 'MCD3_UP') },
];

// prettier-ignore
const DURATIONS: Record<string, number[]> = {
  MCD0: [4, 5, 6, 4, 3, 2, 5, 3],
  MCD1: [20, 22, 24, 26, 28, 30, 32, 34],
  MCD2: [40, 44, 48, 52, 56, 60, 64, 68],
  MCD3: [100, 110, 120, 130, 140, 150, 160, 1200],
};

export const READY_OFFSETS = [60, 62, 64, 66, 68, 70, 72, 74];
export const START_DELAYS = [1, 1, 2, 2, 3, 3, 5, 40];
export const WALL_MS = [250, 260, 280, 300, 330, 350, 380, 1500];

export const MCD_IDS = ['MCD0', 'MCD1', 'MCD2', 'MCD3'] as const;

/**
 * The text of a stored envelope. It is a complete, schema-valid `mcd-output/1` document (the specs run the real
 * Ajv validator over it), though not in canonical text form: the kit only parses it.
 */
export function envelopeText(
  mcd: string,
  slot: number,
  status: string,
  state: string | null,
  bias: string | null,
  reasons: string[]
): string {
  return JSON.stringify({
    schema_version: 'mcd-output/1',
    mcd_id: mcd,
    evaluator_version: mcd === 'MCD0' ? '1.0.0' : '2.0.1',
    cycle_slot: slotToIso(slot),
    last_closed_bar: {
      M5: slotToIso(slot - SLOT_SECONDS),
      M15: slotToIso(slot - SLOT_SECONDS),
    },
    active_indicator: { M5: 'best_fit_a', M15: 'non_b' },
    config_hash: { best_fit_a: 'h1', non_b: 'h2' },
    status,
    status_reasons: reasons,
    state_code: state,
    regime_status: state === null ? null : 'TEST_REGIME',
    bias,
    levels: [],
    depends_on: mcd === 'MCD3' ? ['MCD1', 'MCD2'] : [],
    summary_line: `${mcd} ${status}`,
    commentary: `${mcd} reading in a test world`,
    details: {},
  });
}

/** The 32 rows, oldest slot first and MCD0 first in each slot, as `mcd_outputs` would return them. */
export function sampleRows(): SensorRowSample[] {
  const rows: SensorRowSample[] = [];
  CYCLES.forEach((cycle, k) => {
    const slot = slotOf(k);
    for (const mcd of MCD_IDS) {
      const r = cycle[mcd];
      rows.push({
        symbol: 'XAUUSD',
        cycle_slot: slot,
        mcd_id: mcd,
        flag: 'shadow',
        evaluator_version: mcd === 'MCD0' ? '1.0.0' : '2.0.1',
        status: r.status,
        state_code: r.state,
        bias: r.bias,
        inherited_reasons: r.reasons.filter((c) =>
          c.startsWith('MCD0_DEFECT_')
        ),
        guard_problems: r.guard ?? [],
        retuning_observed: false,
        retuning_applied: false,
        duration_ms: DURATIONS[mcd][k],
        evaluated_at: slot + READY_OFFSETS[k] + START_DELAYS[k],
        envelope_json: envelopeText(
          mcd,
          slot,
          r.status,
          r.state,
          r.bias,
          r.reasons
        ),
      });
    }
  });
  return rows;
}

/** READY market_cycles rows: the eight cycles above, then two more that have no reading. */
export function sampleReady(): ReadySample[] {
  const ready: ReadySample[] = [];
  for (let k = 0; k < 10; k += 1) {
    ready.push({
      slot: slotOf(k),
      ready_at: slotOf(k) + (k < 8 ? READY_OFFSETS[k] : 70),
    });
  }
  return ready;
}

/** The job outcomes: eight WRITTEN, two SKIPPED_OLD (slots 8 and 9), one NOTHING_ENABLED (slot -1). */
export function sampleJobs(): JobSample[] {
  const jobs: JobSample[] = WALL_MS.map((wallMs, k) => ({
    outcome: 'WRITTEN',
    slot: slotOf(k),
    basis: 'INPUTS',
    wallMs,
    ageSeconds: null,
  }));
  jobs.push(
    {
      outcome: 'SKIPPED_OLD',
      slot: slotOf(8),
      basis: null,
      wallMs: null,
      ageSeconds: 700,
    },
    {
      outcome: 'SKIPPED_OLD',
      slot: slotOf(9),
      basis: null,
      wallMs: null,
      ageSeconds: 1000,
    },
    {
      outcome: 'NOTHING_ENABLED',
      slot: slotOf(-1),
      basis: null,
      wallMs: null,
      ageSeconds: null,
    }
  );
  return jobs;
}

export function sampleReplay(): ReplaySample[] {
  return [0, 3, 6].map((k) => ({
    slot: slotOf(k),
    verdict: 'VERIFIED',
    cause: null,
  }));
}
