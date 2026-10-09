import { slotToIso } from '../../src/sensors/inputs/stats-slot';
import type { JobSample } from '../../src/sensors/measure-sensors';
import type { SynthesisSample } from '../../src/sensors/measure-synthesis';
import { refusalLine } from '../../src/sensors/synthesis.writer';
import {
  sampleJobs,
  sampleReady,
  sampleRows,
  slotOf,
} from './measure-sensors-world';

/**
 * A fixture for the SYN part of the measurement kit (build step 4 part 6): the SYN rows of the same eight cycles the sensor fixture
 * (`measure-sensors-world.ts`) has, with numbers chosen so that every figure can be worked out by hand, plus the log lines and the job
 * outcomes that account for the readings that are missing. `measure-synthesis.spec.ts` states each expected value with its working.
 * Every reading text is a complete, schema-valid `syn-output/1` document (the specs run the real Ajv validator over it).
 *
 *   k  DAY_TRADER                                           SCALPER
 *   0  R1_MACRO_COUNTER_TREND_RALLY  VALID    LONG   2 zones R3S_TREND_CONTINUATION_M5 VALID    LONG   2 zones
 *   1  R1_MACRO_COUNTER_TREND_RALLY  CAUT     LONG   1 zone  R3S_TREND_CONTINUATION_M5 CAUT     LONG   0 (NO_ZONE_SOURCES)
 *   2  R2_EXHAUSTION_SNAPBACK        CAUT     SHORT  0 (NO_ZONE_SOURCES)      no row: the gateway refused it
 *   3  NO_MATCH                      VALID    NEUTRAL 0 (NOT_DIRECTIONAL)     R3S_TREND_CONTINUATION_M5 CAUT LONG 3 zones
 *   4  R1_MACRO_COUNTER_TREND_RALLY  CAUT     LONG   2 zones R3S ... NO_MATCH VALID NEUTRAL 0 (NOT_DIRECTIONAL)
 *   5  no rows at all: synthesis stopped in the engine
 *   6  R0_DATA_CHECK                 INVALID  STAND_ASIDE 0 (NOT_DIRECTIONAL) the same
 *   7  R1_MACRO_COUNTER_TREND_RALLY  CAUT     LONG   2 zones (one dropped) R3S_TREND_CONTINUATION_M5 VALID LONG 1 zone
 *
 *   The reading of k3 DAY_TRADER names the states of the sensors it read in `inputs`; the NO_MATCH reading of k4 SCALPER has none, so
 *   the report takes the states from the sensors' rows. duration_ms of the SYN step of cycle k: 40 42 44 46 48 - 52 54, on both rows.
 *   evaluated_at = slot + 65.
 */

export { slotOf };

const R1 = 'R1_MACRO_COUNTER_TREND_RALLY';
const R2 = 'R2_EXHAUSTION_SNAPBACK';
const R3S = 'R3S_TREND_CONTINUATION_M5';
const R0 = 'R0_DATA_CHECK';
const NO_MATCH = 'NO_MATCH';

export const DAY = 'DAY_TRADER';
export const SCALPER = 'SCALPER';
export const RULES_SHA256 =
  '42694707a43d65a4ec1b535f60cbc163f3a8a616ec47af87ddaa8daf3773d06e';
const SENSOR_HASH = 'a'.repeat(64);

interface SynCase {
  k: number;
  profile: string;
  rule: string;
  branch: string | null;
  status: string;
  bias: string;
  zones: number;
  zonesReason: string | null;
  data?: string;
  guard?: string[];
  /** The reading names the sensors' states in `inputs`. */
  inputs?: boolean;
}

const c = (
  k: number,
  profile: string,
  rule: string,
  branch: string | null,
  status: string,
  bias: string,
  zones: number,
  zonesReason: string | null,
  extra: Partial<SynCase> = {}
): SynCase => ({
  k,
  profile,
  rule,
  branch,
  status,
  bias,
  zones,
  zonesReason,
  inputs: true,
  ...extra,
});

// prettier-ignore
export const SYN_CASES: SynCase[] = [
  c(0, DAY, R1, 'BREACH_UP', 'VALID', 'LONG', 2, null),
  c(0, SCALPER, R3S, 'M5_UPTREND', 'VALID', 'LONG', 2, null),
  c(1, DAY, R1, 'BREACH_UP', 'CAUTIONARY', 'LONG', 1, null),
  c(1, SCALPER, R3S, 'M5_UPTREND', 'CAUTIONARY', 'LONG', 0, 'NO_ZONE_SOURCES'),
  c(2, DAY, R2, 'MCD2_SPIKE_DOWN', 'CAUTIONARY', 'SHORT', 0, 'NO_ZONE_SOURCES'),
  c(3, DAY, NO_MATCH, null, 'VALID', 'NEUTRAL', 0, 'NOT_DIRECTIONAL'),
  c(3, SCALPER, R3S, 'M5_UPTREND', 'CAUTIONARY', 'LONG', 3, null),
  c(4, DAY, R1, 'BREACH_UP', 'CAUTIONARY', 'LONG', 2, null),
  c(4, SCALPER, NO_MATCH, null, 'VALID', 'NEUTRAL', 0, 'NOT_DIRECTIONAL', { inputs: false }),
  c(6, DAY, R0, 'PRIMARY_UNAVAILABLE', 'INVALID', 'STAND_ASIDE', 0, 'NOT_DIRECTIONAL', { data: 'STALE' }),
  c(6, SCALPER, R0, 'PRIMARY_UNAVAILABLE', 'INVALID', 'STAND_ASIDE', 0, 'NOT_DIRECTIONAL', { data: 'STALE' }),
  c(7, DAY, R1, 'BREACH_UP', 'CAUTIONARY', 'LONG', 2, null, { guard: ['ZONES: Z3: the stop distance is under 13'] }),
  c(7, SCALPER, R3S, 'M5_UPTREND', 'VALID', 'LONG', 1, null),
];

export const SYN_DURATIONS: Record<number, number> = {
  0: 40,
  1: 42,
  2: 44,
  3: 46,
  4: 48,
  6: 52,
  7: 54,
};

/** The states the reading of k3 DAY_TRADER names for the sensors it read. */
export const K3_INPUTS: Record<string, { status: string; state_code: string }> =
  {
    MCD1: { status: 'VALID', state_code: 'MCD1_UP' },
    MCD2: { status: 'CAUTIONARY', state_code: 'MCD2_UP' },
    MCD3: { status: 'CAUTIONARY', state_code: 'MCD3_UP' },
  };

function inputsOf(sc: SynCase): Record<string, unknown> {
  if (!sc.inputs) return {};
  const states =
    sc.k === 3
      ? K3_INPUTS
      : {
          MCD1: { status: 'CAUTIONARY', state_code: 'MCD1_UP' },
          MCD2: { status: 'VALID', state_code: 'MCD2_UP' },
        };
  return Object.fromEntries(
    Object.entries(states).map(([id, s]) => [
      id,
      {
        ...s,
        regime_status: 'TEST_REGIME',
        bias: 'NEUTRAL',
        envelope_sha256: SENSOR_HASH,
      },
    ])
  );
}

const directional = (bias: string): boolean =>
  bias === 'LONG' || bias === 'SHORT';

/** The canonical-looking text of a schema-valid `syn-output/1` reading. */
export function readingText(
  sc: SynCase,
  overrides: Record<string, unknown> = {}
): string {
  const stand = sc.bias === 'STAND_ASIDE';
  const reading = {
    schema_version: 'syn-output/1',
    mcd_id: 'SYN',
    profile: sc.profile,
    cycle_slot: slotToIso(slotOf(sc.k)),
    rules_version: 'draft-1',
    rules_sha256: RULES_SHA256,
    rule_id: sc.rule,
    branch_id: sc.branch,
    status: sc.status,
    status_reasons:
      sc.status === 'VALID'
        ? []
        : sc.status === 'INVALID'
          ? ['PRIMARY_UNAVAILABLE']
          : ['MCD0_DEFECT_M5'],
    data_status: sc.data ?? 'FRESH',
    archetype: directional(sc.bias) ? 'C' : null,
    bias: sc.bias,
    trend_relation: directional(sc.bias) ? 'WITH_TREND' : null,
    stand_aside: stand,
    inputs: inputsOf(sc),
    reasons: [
      sc.rule === NO_MATCH
        ? 'No rule matched this combination of sensor states'
        : `The rule ${sc.rule} decided this reading`,
    ],
    zones: Array.from({ length: sc.zones }, (_v, i) => `Z${i + 1}`),
    summary_line:
      sc.rule === NO_MATCH
        ? 'No rule matched, NEUTRAL'
        : `Reading of the cycle, ${sc.bias}`,
    ...overrides,
  };
  return JSON.stringify(reading);
}

/** The rows `synthesis_readings` would hold for the table above, oldest cycle first. */
export function synRows(): SynthesisSample[] {
  return SYN_CASES.map((sc) => ({
    symbol: 'XAUUSD',
    cycle_slot: slotOf(sc.k),
    profile: sc.profile,
    flag: 'shadow',
    rules_version: 'draft-1',
    rule_id: sc.rule,
    branch_id: sc.branch,
    status: sc.status,
    status_reasons:
      sc.status === 'VALID'
        ? []
        : sc.status === 'INVALID'
          ? ['PRIMARY_UNAVAILABLE']
          : ['MCD0_DEFECT_M5'],
    data_status: sc.data ?? 'FRESH',
    archetype: directional(sc.bias) ? 'C' : null,
    bias: sc.bias,
    trend_relation: directional(sc.bias) ? 'WITH_TREND' : null,
    stand_aside: sc.bias === 'STAND_ASIDE',
    zone_count: sc.zones,
    zones_reason: sc.zonesReason,
    guard_problems: sc.guard ?? [],
    duration_ms: SYN_DURATIONS[sc.k],
    evaluated_at: slotOf(sc.k) + 65,
    reading_json: readingText(sc),
  }));
}

// ---------------------------------------------------------------- what the gateway logged and returned

export const REFUSAL_PROBLEMS = [
  'SCALPER: synthesis_readings_zones_text_is_its_count_and_hash: the zones text is not its count or its hash',
  'SCALPER zone 1: entry_zones_rank_and_id: the rank is not the id',
];

/** The gateway's log for the cycles above: the producers' own lines for k2, k5 and k7, a retry, one of them wrapped in Railway's JSON, and noise. */
export function synLog(): string[] {
  const k2 = refusalLine(slotOf(2), {
    profile: SCALPER,
    source: 'GATEWAY',
    problems: REFUSAL_PROBLEMS,
  });
  const dropped = `Slot ${slotOf(7)}: SYN_ZONES_DROPPED DAY_TRADER reading written, some zones dropped by the engine: ZONES: Z3: the stop distance is under 13`;
  return [
    '[Nest] 1  - 10/04/2026, 8:00:00 PM     LOG [CycleReadyProcessor] a line about something else',
    `[Nest] 1  - 10/04/2026, 8:05:00 PM   ERROR [SynthesisWriter] ${k2}`,
    `[Nest] 1  - 10/04/2026, 8:05:30 PM   ERROR [SynthesisWriter] ${k2}`,
    `[Nest] 1  - 10/04/2026, 8:20:00 PM   ERROR [SynthesisWriter] Slot ${slotOf(5)}: SYN_ENGINE_ERROR synthesis raised in the engine (SYNTHESIS_ERROR); no SYN rows written, the sensors' rows are unaffected`,
    `[Nest] 1  - 10/04/2026, 8:35:00 PM    WARN [SynthesisWriter] ${dropped}`,
    JSON.stringify({
      level: 'warn',
      message: dropped,
      timestamp: '2026-10-04T20:35:01Z',
    }),
    `Slot ${slotOf(7)} written (INPUTS): MCD0 VALID; 4 new, 0 already there, 120 ms; SYN 2 readings and 3 zones new, 0 already there`,
  ];
}

/** The eight WRITTEN outcomes of the sensor fixture with their SYN part, the two skipped jobs and the one with every MCD off. */
export function synJobs(): JobSample[] {
  const ok = (readings: number, zones: number) => ({
    readingsInserted: readings,
    readingsExisting: 0,
    zonesInserted: zones,
    zonesExisting: 0,
    refused: [],
    error: null,
  });
  const synthesis = [
    ok(2, 4),
    ok(2, 1),
    {
      readingsInserted: 1,
      readingsExisting: 0,
      zonesInserted: 0,
      zonesExisting: 0,
      refused: [
        { profile: SCALPER, source: 'GATEWAY', problems: REFUSAL_PROBLEMS },
      ],
      error: null,
    },
    ok(2, 3),
    ok(2, 2),
    {
      readingsInserted: 0,
      readingsExisting: 0,
      zonesInserted: 0,
      zonesExisting: 0,
      refused: [],
      error: 'SYNTHESIS_ERROR',
    },
    ok(2, 0),
    ok(2, 3),
  ];
  return sampleJobs().map((job, i) =>
    i < 8 ? { ...job, synthesis: synthesis[i] } : job
  );
}

/**
 * The input file of the SYN fixture, as `scripts/measure-sensors.js --file` reads it: the sensor fixture's rows and READY cycles, the SYN
 * rows, the job outcomes with their SYN part, and the gateway's log. `test/fixtures/measure-synthesis-sample.json` is this, written out.
 */
export function synWorld() {
  return {
    rows: sampleRows(),
    ready: sampleReady(),
    jobs: synJobs(),
    synthesis: synRows(),
    log: synLog(),
  };
}
