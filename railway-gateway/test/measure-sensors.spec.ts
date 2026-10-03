import { execFileSync, spawnSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import {
  CYCLE_BUDGET_MS,
  DEFAULT_LAST_CYCLES,
  MCD_BUDGET_MS,
  MeasureSensorsReport,
  SENSOR_ROW_COLUMNS,
  SensorMeasureInput,
  SensorRowSample,
  SensorRowSource,
  USAGE,
  formatReport,
  guardCategory,
  loadSensorRows,
  measureDeterminism,
  measureSensors,
  normalizeJob,
  normalizeReady,
  normalizeReplay,
  normalizeRow,
  parseArgs,
  parseInputJson,
  parseJobsJson,
  parseReplayJson,
} from '../src/sensors/measure-sensors';
import { EnvelopeValidator } from '../src/sensors/envelope-validator';
import {
  FIRST_SLOT,
  envelopeText,
  sampleJobs,
  sampleReady,
  sampleReplay,
  sampleRows,
  slotOf,
} from './helpers/measure-sensors-world';

/**
 * The sensor measurement kit (build step 3 part 7). Every number below is worked out by hand from
 * the table in test/helpers/measure-sensors-world.ts; the working is in the comments, so a failure
 * says which arithmetic is wrong, the code or the table.
 */

const world = (): SensorMeasureInput => ({
  rows: sampleRows(),
  ready: sampleReady(),
  jobs: sampleJobs(),
  replay: sampleReplay(),
  failedJobs: 2,
});

/** The first five cycles: no guard problem, no EVALUATOR_ERROR, nothing over a budget. */
const cleanWorld = (): SensorMeasureInput => {
  const last = slotOf(4);
  return {
    rows: sampleRows().filter((r) => r.cycle_slot <= last),
    ready: sampleReady().filter((r) => r.slot <= last),
    jobs: sampleJobs().filter(
      (j) => j.slot !== null && j.slot <= last && j.slot >= FIRST_SLOT
    ),
    replay: sampleReplay().filter((r) => r.slot <= last),
    failedJobs: 0,
  };
};

const rowAt = (
  rows: SensorRowSample[],
  k: number,
  mcd: string
): SensorRowSample => {
  const found = rows.find(
    (r) => r.cycle_slot === slotOf(k) && r.mcd_id === mcd
  );
  if (found === undefined) throw new Error(`no row ${mcd} at k = ${k}`);
  return found;
};

const withRow = (
  rows: SensorRowSample[],
  k: number,
  mcd: string,
  change: Partial<SensorRowSample>
): SensorRowSample[] =>
  rows.map((r) =>
    r.cycle_slot === slotOf(k) && r.mcd_id === mcd ? { ...r, ...change } : r
  );

const without = (rows: SensorRowSample[], k: number): SensorRowSample[] =>
  rows.filter((r) => r.cycle_slot !== slotOf(k));

const validator = new EnvelopeValidator();
const realScan = (text: string): string[] => {
  const check = validator.check(text);
  return check.ok ? [] : check.problems;
};

describe('the budgets', () => {
  it('are the standard 11.2 starting values: 1 s for one evaluation, 30 s for the cycle', () => {
    expect(MCD_BUDGET_MS).toBe(1000);
    expect(CYCLE_BUDGET_MS).toBe(30_000);
    expect(DEFAULT_LAST_CYCLES).toBe(576);
  });
});

describe('guardCategory', () => {
  it.each([
    ['SCHEMA: /levels: must be array', 'SCHEMA'],
    ['IDENTITY: mcd_id is "MCD9", expected "MCD1"', 'IDENTITY'],
    ['REASONS: a VALID reading has reasons', 'REASONS'],
    ['REGISTER: state "X" is not in the register of MCD1', 'REGISTER'],
    ["WORDING: commentary contains '%'", 'WORDING'],
    ['RAISED: ValueError: x', 'RAISED'],
  ])('%s is %s', (problem, category) => {
    expect(guardCategory(problem)).toBe(category);
  });

  it('anything else is OTHER: an unknown prefix, no prefix, another case', () => {
    expect(guardCategory('FUTURE: something')).toBe('OTHER');
    expect(guardCategory('no colon at all')).toBe('OTHER');
    expect(guardCategory('schema: lower case')).toBe('OTHER');
    expect(guardCategory('')).toBe('OTHER');
  });
});

describe('measureDeterminism', () => {
  const verdicts = (...v: string[]) =>
    measureDeterminism(
      v.map((verdict, k) => ({ slot: slotOf(k), verdict, cause: null }))
    ).verdict;

  it('no replay at all is NOT_CHECKED, null or empty', () => {
    expect(measureDeterminism(null).verdict).toBe('NOT_CHECKED');
    expect(measureDeterminism(undefined).verdict).toBe('NOT_CHECKED');
    expect(measureDeterminism([]).verdict).toBe('NOT_CHECKED');
    expect(measureDeterminism([]).checked).toBe(0);
  });

  it('every cycle VERIFIED is DETERMINISTIC, and one VERIFIED beside cycles that could not be replayed still is', () => {
    expect(verdicts('VERIFIED')).toBe('DETERMINISTIC');
    expect(verdicts('VERIFIED', 'VERIFIED', 'VERIFIED')).toBe('DETERMINISTIC');
    expect(verdicts('VERIFIED', 'NOT_REPLAYABLE')).toBe('DETERMINISTIC');
  });

  it('only cycles that could not be replayed prove nothing: INCONCLUSIVE', () => {
    expect(verdicts('NOT_REPLAYABLE')).toBe('INCONCLUSIVE');
    expect(verdicts('NOT_REPLAYABLE', 'NOT_REPLAYABLE')).toBe('INCONCLUSIVE');
  });

  it('a version difference is the expected result of a deploy: VERSION_CHANGED, not a defect', () => {
    expect(verdicts('VERSION_MISMATCH')).toBe('VERSION_CHANGED');
    expect(verdicts('VERIFIED', 'VERSION_MISMATCH', 'NOT_REPLAYABLE')).toBe(
      'VERSION_CHANGED'
    );
  });

  it('damaged stored data is its own finding, and weighs more than a version change', () => {
    expect(verdicts('TAMPERED_BUNDLE')).toBe('STORED_DATA_DAMAGED');
    expect(verdicts('VERIFIED', 'STORED_READING_CORRUPT')).toBe(
      'STORED_DATA_DAMAGED'
    );
    expect(verdicts('VERSION_MISMATCH', 'TAMPERED_BUNDLE')).toBe(
      'STORED_DATA_DAMAGED'
    );
  });

  it('one LOGIC_DIVERGENCE makes it NOT_DETERMINISTIC whatever else there is', () => {
    expect(verdicts('LOGIC_DIVERGENCE')).toBe('NOT_DETERMINISTIC');
    expect(verdicts('VERIFIED', 'VERIFIED', 'LOGIC_DIVERGENCE')).toBe(
      'NOT_DETERMINISTIC'
    );
    expect(verdicts('TAMPERED_BUNDLE', 'LOGIC_DIVERGENCE')).toBe(
      'NOT_DETERMINISTIC'
    );
    expect(verdicts('VERSION_MISMATCH', 'LOGIC_DIVERGENCE')).toBe(
      'NOT_DETERMINISTIC'
    );
  });

  it('a verdict the kit does not know proves nothing, even beside VERIFIED ones, and is listed', () => {
    expect(verdicts('SOMETHING_NEW')).toBe('INCONCLUSIVE');
    expect(verdicts('VERIFIED', 'SOMETHING_NEW')).toBe('INCONCLUSIVE');
    expect(verdicts('VERIFIED', 'toString')).toBe('INCONCLUSIVE');
    // but a known defect still outweighs it
    expect(verdicts('SOMETHING_NEW', 'LOGIC_DIVERGENCE')).toBe(
      'NOT_DETERMINISTIC'
    );
    expect(verdicts('SOMETHING_NEW', 'VERSION_MISMATCH')).toBe(
      'VERSION_CHANGED'
    );
  });

  it('counts the verdicts and lists the cycles that were not VERIFIED, with their cause', () => {
    const d = measureDeterminism([
      { slot: slotOf(0), verdict: 'VERIFIED', cause: null },
      { slot: slotOf(1), verdict: 'NOT_REPLAYABLE', cause: 'NO_STORED_BUNDLE' },
      { slot: slotOf(2), verdict: 'VERIFIED', cause: null },
      { slot: slotOf(3), verdict: 'LOGIC_DIVERGENCE', cause: null },
    ]);
    expect(d.checked).toBe(4);
    expect(d.counts).toEqual({
      VERIFIED: 2,
      NOT_REPLAYABLE: 1,
      LOGIC_DIVERGENCE: 1,
    });
    expect(d.attention).toEqual([
      { slot: slotOf(1), verdict: 'NOT_REPLAYABLE', cause: 'NO_STORED_BUNDLE' },
      { slot: slotOf(3), verdict: 'LOGIC_DIVERGENCE', cause: null },
    ]);
  });
});

describe('measureSensors on the eight-cycle fixture', () => {
  // computed in a hook, not in the describe body: a throw there would fail the whole suite at load
  // time instead of failing the tests that depend on it
  let report: MeasureSensorsReport;
  beforeAll(() => {
    report = measureSensors(world(), { scan: realScan });
  });

  it('counts the rows and the cycles and finds the slots they span', () => {
    expect(report.rows).toBe(32);
    expect(report.skippedRows).toBe(0);
    expect(report.cycles).toBe(8);
    expect(report.firstSlot).toBe(FIRST_SLOT);
    expect(report.lastSlot).toBe(FIRST_SLOT + 2100); // 7 slots of 300 s after the first
  });

  it('lists the MCDs in number order', () => {
    expect(Object.keys(report.mcds)).toEqual(['MCD0', 'MCD1', 'MCD2', 'MCD3']);
  });

  it('status mix per MCD, counted from the table', () => {
    const counts = (id: string) => {
      const s = report.mcds[id].status;
      return [s.VALID, s.CAUTIONARY, s.INVALID, s.STALE, s.other];
    };
    expect(counts('MCD0')).toEqual([6, 0, 1, 1, 0]); // k0 to k4 and k6 VALID; k7 INVALID; k5 STALE
    expect(counts('MCD1')).toEqual([4, 4, 0, 0, 0]); // VALID at k0 k3 k5 k7; CAUTIONARY at k1 k2 k4 k6
    expect(counts('MCD2')).toEqual([3, 3, 1, 1, 0]); // VALID k0 k4 k7; CAUTIONARY k1 k3 k6; INVALID k2; STALE k5
    expect(counts('MCD3')).toEqual([2, 3, 3, 0, 0]); // VALID k0 k7; CAUTIONARY k1 k3 k4; INVALID k2 k5 k6
  });

  it('each status as a share of the rows of that MCD (each MCD has 8)', () => {
    expect(report.mcds['MCD0'].share).toEqual({
      VALID: 0.75,
      CAUTIONARY: 0,
      INVALID: 0.125,
      STALE: 0.125,
      other: 0,
    });
    expect(report.mcds['MCD1'].share).toEqual({
      VALID: 0.5,
      CAUTIONARY: 0.5,
      INVALID: 0,
      STALE: 0,
      other: 0,
    });
    expect(report.mcds['MCD2'].share).toEqual({
      VALID: 0.375,
      CAUTIONARY: 0.375,
      INVALID: 0.125,
      STALE: 0.125,
      other: 0,
    });
    expect(report.mcds['MCD3'].share).toEqual({
      VALID: 0.25,
      CAUTIONARY: 0.375,
      INVALID: 0.375,
      STALE: 0,
      other: 0,
    });
  });

  it('rows, flags and evaluator versions per MCD', () => {
    for (const id of ['MCD0', 'MCD1', 'MCD2', 'MCD3']) {
      expect(report.mcds[id].rows).toBe(8);
      expect(report.mcds[id].flags).toEqual({ shadow: 8, live: 0, other: 0 });
    }
    expect(report.mcds['MCD0'].evaluatorVersions).toEqual(['1.0.0']);
    expect(report.mcds['MCD3'].evaluatorVersions).toEqual(['2.0.1']);
  });

  it('the reasons on readings that are not VALID, most common first, a tie in code order, at most five', () => {
    expect(report.mcds['MCD0'].topReasons).toEqual([
      { code: 'DATA_STALE', count: 1 },
      { code: 'EVALUATOR_ERROR', count: 1 },
    ]);
    expect(report.mcds['MCD1'].topReasons).toEqual([
      { code: 'MCD0_DEFECT_M15', count: 4 },
    ]);
    expect(report.mcds['MCD2'].topReasons).toEqual([
      { code: 'MCD0_DEFECT_M5', count: 3 }, // k1 k3 k6
      { code: 'DATA_STALE', count: 1 },
      { code: 'INSUFFICIENT_BARS', count: 1 },
    ]);
    // MCD3: U1 at k1 k4, U2 at k1 k3, D5 at k1 k3, D15 at k1 k4, UNAVAIL at k2 k5: five codes with 2 each;
    // EVALUATOR_ERROR (once, k6) is the sixth and is cut
    expect(report.mcds['MCD3'].topReasons).toEqual([
      { code: 'MCD0_DEFECT_M15', count: 2 },
      { code: 'MCD0_DEFECT_M5', count: 2 },
      { code: 'UPSTREAM_CAUTIONARY:MCD1', count: 2 },
      { code: 'UPSTREAM_CAUTIONARY:MCD2', count: 2 },
      { code: 'UPSTREAM_UNAVAILABLE:MCD2', count: 2 },
    ]);
  });

  it('MCD0 flag rate: six readings name a state, two do not', () => {
    // judged k0 k1 k2 k3 k4 k6; no state: k5 (STALE) and k7 (INVALID)
    expect(report.mcd0).toEqual({
      rows: 8,
      judged: 6,
      noState: 2,
      unknownState: 0,
      allQualified: 1, // k0
      m5Only: 1, // k3
      m15Only: 1, // k4
      both: 3, // k1 k2 k6
      m5Flagged: 4, // 3 + 1
      m15Flagged: 4, // 3 + 1
      rate: { m5: 4 / 6, m15: 4 / 6, both: 3 / 6, any: 5 / 6 },
    });
  });

  it('EVALUATOR_ERROR readings: MCD0 at k7 and MCD3 at k6', () => {
    expect(report.violations.evaluatorError).toBe(2);
    expect(report.mcds['MCD0'].evaluatorError).toBe(1);
    expect(report.mcds['MCD3'].evaluatorError).toBe(1);
    expect(report.mcds['MCD1'].evaluatorError).toBe(0);
  });

  it('guard problems: two rows, one with a SCHEMA and a WORDING problem and one RAISED', () => {
    expect(report.violations.guardRows).toBe(2);
    expect(report.violations.guardByCategory).toEqual({
      SCHEMA: 1,
      IDENTITY: 0,
      REASONS: 0,
      REGISTER: 0,
      WORDING: 1,
      RAISED: 1,
      OTHER: 0,
    });
    expect(report.violations.schema).toBe(1);
    expect(report.violations.wording).toBe(1);
  });

  it('the second look at every stored envelope: 32 scanned by the real schema validator, nothing found', () => {
    expect(report.violations.rescan).toEqual({
      ran: true,
      scanned: 32,
      schemaFailures: 0,
      percentInText: 0,
      unreadable: 0,
    });
  });

  it('milliseconds per MCD against the 1 s budget: only MCD3 at k7 (1200 ms) is over it', () => {
    // MCD0 2 3 3 4 4 5 5 6, sum 32
    expect(report.mcds['MCD0'].durationMs).toEqual({
      count: 8,
      min: 2,
      p50: 4,
      /* rank 4 */ p90: 6,
      /* rank ceil(7.2) = 8 */ p99: 6,
      max: 6,
      mean: 4,
      negative: 0,
    });
    // MCD1 20 22 ... 34, sum 216
    expect(report.mcds['MCD1'].durationMs).toMatchObject({
      min: 20,
      p50: 26,
      p90: 34,
      max: 34,
      mean: 27,
    });
    // MCD2 40 44 ... 68, sum 432
    expect(report.mcds['MCD2'].durationMs).toMatchObject({
      min: 40,
      p50: 52,
      p90: 68,
      max: 68,
      mean: 54,
    });
    // MCD3 100 110 120 130 140 150 160 1200, sum 2110
    expect(report.mcds['MCD3'].durationMs).toEqual({
      count: 8,
      min: 100,
      p50: 130,
      p90: 1200,
      p99: 1200,
      max: 1200,
      mean: 263.75,
      negative: 0,
    });
    expect(
      ['MCD0', 'MCD1', 'MCD2', 'MCD3'].map((id) => report.mcds[id].overBudget)
    ).toEqual([0, 0, 0, 1]);
  });

  it('per cycle, the MCDs summed: 164 181 198 212 227 242 261 1305 ms, none over 30 s', () => {
    // k0 4+20+40+100, k1 5+22+44+110, k2 6+24+48+120, k3 4+26+52+130, k4 3+28+56+140, k5 2+30+60+150,
    // k6 5+32+64+160, k7 3+34+68+1200; the sum of the eight is 2790
    expect(report.timing.computeMs).toEqual({
      count: 8,
      min: 164,
      p50: 212,
      p90: 1305,
      p99: 1305,
      max: 1305,
      mean: 348.75,
      negative: 0,
    });
    expect(report.timing.computeOver).toBe(0);
    expect(report.timing.perMcdBudgetMs).toBe(1000);
    expect(report.timing.cycleBudgetMs).toBe(30_000);
  });

  it('signal to start: evaluated_at - ready_at is 1 1 2 2 3 3 5 40 seconds', () => {
    // the sum is 57 s
    expect(report.timing.startDelayMs).toEqual({
      count: 8,
      min: 1000,
      p50: 2000,
      p90: 40_000,
      p99: 40_000,
      max: 40_000,
      mean: 7125,
      negative: 0,
    });
  });

  it('signal to done uses the job wall time when there is one: 1250 1260 2280 2300 3330 3350 5380 41500 ms, one over 30 s', () => {
    // delay + wall: 1000+250, 1000+260, 2000+280, 2000+300, 3000+330, 3000+350, 5000+380, 40000+1500; sum 60650
    expect(report.timing.signalToDoneMs).toEqual({
      count: 8,
      min: 1250,
      p50: 2300,
      p90: 41_500,
      p99: 41_500,
      max: 41_500,
      mean: 7581.25,
      negative: 0,
    });
    expect(report.timing.signalToDoneOver).toBe(1);
    expect(report.timing.signalToDoneBasis).toEqual({ jobWall: 8, compute: 0 });
  });

  it('rows per cycle: every cycle has the four expected rows', () => {
    expect(report.rowsPerCycle.expected).toEqual([
      'MCD0',
      'MCD1',
      'MCD2',
      'MCD3',
    ]);
    expect(report.rowsPerCycle.expectedFrom).toBe('NEWEST_CYCLE');
    expect(report.rowsPerCycle.byRowCount).toEqual([{ value: 4, count: 8 }]);
    expect(report.rowsPerCycle.complete).toBe(8);
    expect(report.rowsPerCycle.short).toBe(0);
    expect(report.rowsPerCycle.shortCycles).toEqual([]);
    expect(report.rowsPerCycle.unexpectedRows).toBe(0);
  });

  it('READY cycles: ten, none lacking a row before the newest reading, two after it (in flight)', () => {
    expect(report.rowsPerCycle.readyCycles).toBe(10);
    expect(report.rowsPerCycle.readyWithoutRows).toEqual([]);
    expect(report.rowsPerCycle.readyAfterLastRow).toBe(2);
  });

  it('jobs: eleven outcomes, eight written, two skipped as too old, one with every MCD off; two failed', () => {
    expect(report.jobs).toEqual({
      given: 11,
      written: 8,
      skippedOld: 2,
      nothingEnabled: 1,
      other: 0,
      basis: { INPUTS: 8 },
      skippedAgeSeconds: {
        count: 2,
        min: 700,
        p50: 700,
        /* rank 1 */ p90: 1000,
        p99: 1000,
        max: 1000,
        mean: 850,
        negative: 0,
      },
      // 250 260 280 300 330 350 380 1500, sum 3650
      wallMs: {
        count: 8,
        min: 250,
        p50: 300,
        p90: 1500,
        p99: 1500,
        max: 1500,
        mean: 456.25,
        negative: 0,
      },
      failed: 2,
    });
  });

  it('determinism: three replayed cycles, all VERIFIED', () => {
    expect(report.determinism).toEqual({
      verdict: 'DETERMINISTIC',
      checked: 3,
      counts: { VERIFIED: 3 },
      attention: [],
    });
  });

  it('inheritance: five cycles have a VALID MCD0 defect, eleven marks are required and every one is there', () => {
    // k1: MCD1 M15, MCD2 M5, MCD3 M5 and M15 = 4; k2: MCD1 only (MCD2 and MCD3 are INVALID, not marked) = 1;
    // k3: MCD2 M5, MCD3 M5 = 2; k4: MCD1 M15, MCD3 M15 = 2; k6: MCD1 M15, MCD2 M5 (MCD3 INVALID) = 2
    expect(report.inheritance).toEqual({
      cyclesWithValidDefect: 5,
      expectedMarks: 11,
      missing: 0,
      unexplained: 0,
      mismatches: [],
      unknownMcds: [],
    });
  });

  it('says what a person should look at, one line each, and nothing else', () => {
    expect(report.findings).toEqual([
      '2 reading(s) carry EVALUATOR_ERROR (the shadow stage needs none)',
      '2 row(s) have guard problems recorded (a reading was replaced)',
      'MCD3: 1 reading(s) took longer than 1000 ms',
      '1 cycle(s) took more than 30 s from the cycle-ready signal to done',
    ]);
  });

  it('does not depend on the order the rows arrive in, and does not change them', () => {
    const input = world();
    input.rows.reverse();
    const before = JSON.stringify(input.rows);
    expect(measureSensors(input, { scan: realScan })).toEqual(report);
    expect(JSON.stringify(input.rows)).toBe(before);
  });
});

describe('measureSensors: the clean first five cycles', () => {
  it('has no finding at all', () => {
    const r = measureSensors(cleanWorld(), { scan: realScan });
    expect(r.cycles).toBe(5);
    expect(r.rows).toBe(20);
    expect(r.findings).toEqual([]);
    expect(formatReport(r)).toContain('Findings: none');
  });
});

describe('measureSensors at the edges', () => {
  it('has nothing to say about no rows, and still prints', () => {
    const r = measureSensors({ rows: [] });
    expect(r.rows).toBe(0);
    expect(r.cycles).toBe(0);
    expect(r.firstSlot).toBeNull();
    expect(r.lastSlot).toBeNull();
    expect(r.mcds).toEqual({});
    expect(r.mcd0.rate).toEqual({ m5: null, m15: null, both: null, any: null });
    expect(r.timing.computeMs).toBeNull();
    expect(r.timing.signalToDoneMs).toBeNull();
    expect(r.rowsPerCycle.expected).toEqual([]);
    expect(r.rowsPerCycle.readyCycles).toBeNull();
    expect(r.jobs).toBeNull();
    expect(r.determinism.verdict).toBe('NOT_CHECKED');
    expect(r.findings).toEqual([]);
    expect(() => formatReport(r)).not.toThrow();
  });

  it('skips a row with no numeric slot or no MCD id and says how many', () => {
    const rows = [
      ...sampleRows().slice(0, 4),
      { ...sampleRows()[4], cycle_slot: Number.NaN },
      { ...sampleRows()[5], cycle_slot: null as unknown as number },
      { ...sampleRows()[6], mcd_id: undefined as unknown as string },
    ];
    const r = measureSensors({ rows });
    expect(r.rows).toBe(4);
    expect(r.skippedRows).toBe(3);
    expect(formatReport(r)).toContain(
      '(3 rows without a slot or an MCD skipped)'
    );
  });

  it('a status outside the four is counted under other, a flag that is neither shadow nor live under flags.other, and both are findings', () => {
    let rows = withRow(sampleRows(), 0, 'MCD1', { status: 'WEIRD' });
    rows = withRow(rows, 1, 'MCD1', { flag: 'off' });
    const r = measureSensors({ rows });
    expect(r.mcds['MCD1'].status).toEqual({
      VALID: 3,
      CAUTIONARY: 4,
      INVALID: 0,
      STALE: 0,
      other: 1,
    });
    expect(r.mcds['MCD1'].share.other).toBe(0.125);
    expect(r.mcds['MCD1'].flags).toEqual({ shadow: 7, live: 0, other: 1 });
    expect(r.findings).toContain(
      'MCD1: 1 row(s) have a status outside VALID, CAUTIONARY, INVALID, STALE'
    );
    expect(r.findings).toContain(
      'MCD1: 1 row(s) have a flag that is neither shadow nor live'
    );
  });

  it('counts live rows beside shadow rows and lists several evaluator versions', () => {
    let rows = withRow(sampleRows(), 0, 'MCD2', { flag: 'live' });
    rows = withRow(rows, 1, 'MCD2', { evaluator_version: '2.1.0' });
    const m = measureSensors({ rows }).mcds['MCD2'];
    expect(m.flags).toEqual({ shadow: 7, live: 1, other: 0 });
    expect(m.evaluatorVersions).toEqual(['2.0.1', '2.1.0']);
  });

  it('puts MCD10 after MCD9, by the number', () => {
    const slot = slotOf(0);
    const base = sampleRows()[0];
    const rows = ['MCD10', 'MCD2', 'MCD9', 'MCD0'].map((mcd_id) => ({
      ...base,
      mcd_id,
      cycle_slot: slot,
    }));
    expect(Object.keys(measureSensors({ rows }).mcds)).toEqual([
      'MCD0',
      'MCD2',
      'MCD9',
      'MCD10',
    ]);
  });

  it('the reasons of a VALID reading are not counted among the reasons for not being VALID', () => {
    const rows = withRow(sampleRows(), 0, 'MCD1', {
      envelope_json: envelopeText(
        'MCD1',
        slotOf(0),
        'VALID',
        'MCD1_UP',
        'NEUTRAL',
        ['SOMETHING']
      ),
    });
    expect(measureSensors({ rows }).mcds['MCD1'].topReasons).toEqual([
      { code: 'MCD0_DEFECT_M15', count: 4 },
    ]);
  });

  it('MCD0: a CAUTIONARY reading that names a state is judged, an unknown state is counted apart', () => {
    let rows = withRow(sampleRows(), 0, 'MCD0', {
      status: 'CAUTIONARY',
      state_code: 'MCD0_M15_DEFECT',
    });
    rows = withRow(rows, 1, 'MCD0', { state_code: 'MCD0_SOMETHING_NEW' });
    const z = measureSensors({ rows }).mcd0;
    expect(z.judged).toBe(5); // k0 (now M15), k2, k3, k4, k6; k1 is unknown; k5 and k7 have no state
    expect(z.unknownState).toBe(1);
    expect(z.noState).toBe(2);
    expect(z.m15Only).toBe(2); // k0 and k4
    expect(z.allQualified).toBe(0);
    expect(measureSensors({ rows }).findings).toContain(
      'MCD0: 1 row(s) have a state the kit does not know'
    );
  });

  it('a state called constructor or toString is unknown, not a hit on the object itself', () => {
    const rows = withRow(sampleRows(), 0, 'MCD0', {
      state_code: 'constructor',
    });
    expect(measureSensors({ rows }).mcd0.unknownState).toBe(1);
  });

  describe('guard problems and the second look', () => {
    it('a row counts once per category however many problems of it there are, and unknown prefixes go to OTHER', () => {
      const rows = withRow(sampleRows(), 0, 'MCD1', {
        guard_problems: ['SCHEMA: a', 'SCHEMA: b', 'REGISTER: c', 'FUTURE: d'],
      });
      const v = measureSensors({ rows }).violations;
      expect(v.guardRows).toBe(3); // the two of the table and this one
      expect(v.guardByCategory.SCHEMA).toBe(2); // k7 MCD0 and this row, once
      expect(v.guardByCategory.REGISTER).toBe(1);
      expect(v.guardByCategory.OTHER).toBe(1);
    });

    it('runs the scanner on every envelope text and counts the rows it complains about', () => {
      const bad = rowAt(sampleRows(), 2, 'MCD2').envelope_json;
      const calls: string[] = [];
      const v = measureSensors(world(), {
        scan: (text) => {
          calls.push(text);
          return text === bad ? ['<root>: nope'] : [];
        },
      }).violations;
      expect(calls).toHaveLength(32);
      expect(v.rescan).toMatchObject({
        ran: true,
        scanned: 32,
        schemaFailures: 1,
      });
      expect(
        measureSensors(world(), { scan: (text) => (text === bad ? ['x'] : []) })
          .findings
      ).toContain('1 stored envelope(s) fail the schema on a second look');
    });

    it('does not scan a row that has no envelope text, and says it is unreadable', () => {
      const rows = withRow(sampleRows(), 0, 'MCD0', { envelope_json: null });
      const r = measureSensors({ rows }, { scan: () => [] });
      expect(r.violations.rescan.scanned).toBe(31);
      expect(r.violations.rescan.unreadable).toBe(1);
      expect(r.findings).toContain('1 row(s) have no readable envelope text');
    });

    it.each([['not json'], ['[]'], ['"text"'], ['42'], ['null']])(
      'envelope text %j is unreadable',
      (text) => {
        const rows = withRow(sampleRows(), 0, 'MCD0', { envelope_json: text });
        expect(measureSensors({ rows }).violations.rescan.unreadable).toBe(1);
      }
    );

    it('without a scanner the second look says it did not run, and still counts what needs no schema', () => {
      const r = measureSensors(world());
      expect(r.violations.rescan).toEqual({
        ran: false,
        scanned: 0,
        schemaFailures: 0,
        percentInText: 0,
        unreadable: 0,
      });
      expect(formatReport(r)).toContain(
        'second look at every stored envelope: not run (no schema scanner)'
      );
    });

    const withText = (change: Record<string, unknown>) => {
      const row = rowAt(sampleRows(), 0, 'MCD1');
      const doc = JSON.parse(row.envelope_json as string) as Record<
        string,
        unknown
      >;
      return withRow(sampleRows(), 0, 'MCD1', {
        envelope_json: JSON.stringify({ ...doc, ...change }),
      });
    };

    it.each([
      ['commentary', { commentary: 'share rose 3%' }],
      ['summary_line', { summary_line: '50% done' }],
      [
        'a level name',
        { levels: [{ name: 'half % level', tf: 'M5', price: 1 }] },
      ],
      ['a text inside details', { details: { a: { b: ['x', 'y 1%'] } } }],
    ])('a percent sign in %s is found', (_label, change) => {
      const v = measureSensors({ rows: withText(change) }).violations;
      expect(v.rescan.percentInText).toBe(1);
      expect(measureSensors({ rows: withText(change) }).findings).toContain(
        "1 stored envelope(s) have a '%' in a free text"
      );
    });

    it('a percent sign somewhere that is not a free text (a reason code, a number) is not counted', () => {
      const v = measureSensors({
        rows: withText({ details: { rate: 5 }, status_reasons: ['A%'] }),
      }).violations;
      expect(v.rescan.percentInText).toBe(0);
    });
  });

  describe('timing', () => {
    it('a reading of exactly 1000 ms is within the budget, 1000.5 ms is not', () => {
      let rows = withRow(sampleRows(), 0, 'MCD1', { duration_ms: 1000 });
      expect(measureSensors({ rows }).mcds['MCD1'].overBudget).toBe(0);
      rows = withRow(sampleRows(), 0, 'MCD1', { duration_ms: 1000.5 });
      expect(measureSensors({ rows }).mcds['MCD1'].overBudget).toBe(1);
    });

    it('a cycle that spent exactly 30 s in the MCDs is within its budget, a millisecond more is not', () => {
      // k0's other three MCDs take 4 + 20 + 40 = 64 ms; MCD3 takes 29936 ms, then 29937
      let rows = withRow(sampleRows(), 0, 'MCD3', { duration_ms: 29_936 });
      expect(measureSensors({ rows }).timing.computeOver).toBe(0);
      rows = withRow(sampleRows(), 0, 'MCD3', { duration_ms: 29_937 });
      const r = measureSensors({ rows });
      expect(r.timing.computeOver).toBe(1);
      expect(r.findings).toContain(
        '1 cycle(s) spent more than 30 s in the MCDs'
      );
    });

    it('signal to done of exactly 30 s is within, a millisecond more is not (no jobs: the summed times)', () => {
      // k0: delay 1 s, compute 164 ms -> 1164 ms; raise MCD3 by 28836 -> 30000
      const input = {
        rows: withRow(sampleRows(), 0, 'MCD3', { duration_ms: 100 + 28_836 }),
        ready: sampleReady(),
      };
      const base = measureSensors(input).timing;
      expect(base.signalToDoneMs?.max).toBe(41_305); // k7 is the long one
      expect(base.signalToDoneOver).toBe(1);
      const input2 = {
        rows: withRow(sampleRows(), 0, 'MCD3', { duration_ms: 100 + 28_837 }),
        ready: sampleReady(),
      };
      expect(measureSensors(input2).timing.signalToDoneOver).toBe(2);
    });

    it('without jobs the cycle falls back to the summed times: 1164 1181 2198 2212 3227 3242 5261 41305 ms', () => {
      const t = measureSensors({
        rows: sampleRows(),
        ready: sampleReady(),
      }).timing;
      // delay + compute; the sum of the eight is 59790
      expect(t.signalToDoneMs).toEqual({
        count: 8,
        min: 1164,
        p50: 2212,
        p90: 41_305,
        p99: 41_305,
        max: 41_305,
        mean: 7473.75,
        negative: 0,
      });
      expect(t.signalToDoneBasis).toEqual({ jobWall: 0, compute: 8 });
    });

    it('mixes the two bases cycle by cycle', () => {
      const jobs = sampleJobs().filter(
        (j) => j.outcome === 'WRITTEN' && (j.slot as number) <= slotOf(3)
      );
      const t = measureSensors({
        rows: sampleRows(),
        ready: sampleReady(),
        jobs,
      }).timing;
      expect(t.signalToDoneBasis).toEqual({ jobWall: 4, compute: 4 });
    });

    it('a job that was not WRITTEN gives no wall time', () => {
      const jobs = sampleJobs().map((j) => ({
        ...j,
        outcome: j.outcome === 'WRITTEN' ? 'SKIPPED_OLD' : j.outcome,
      }));
      const t = measureSensors({
        rows: sampleRows(),
        ready: sampleReady(),
        jobs,
      }).timing;
      expect(t.signalToDoneBasis).toEqual({ jobWall: 0, compute: 8 });
    });

    it('without READY rows there is no signal to start and no signal to done, only the summed times', () => {
      const t = measureSensors({ rows: sampleRows() }).timing;
      expect(t.startDelayMs).toBeNull();
      expect(t.signalToDoneMs).toBeNull();
      expect(t.computeMs?.count).toBe(8);
    });

    it('a READY row without ready_at, or a row without evaluated_at, leaves that cycle out', () => {
      const ready = sampleReady().map((r) =>
        r.slot === slotOf(0) ? { ...r, ready_at: null } : r
      );
      expect(
        measureSensors({ rows: sampleRows(), ready }).timing.startDelayMs?.count
      ).toBe(7);
      const rows = sampleRows().map((r) =>
        r.cycle_slot === slotOf(1) ? { ...r, evaluated_at: null } : r
      );
      expect(
        measureSensors({ rows, ready: sampleReady() }).timing.startDelayMs
          ?.count
      ).toBe(7);
    });

    it('a cycle starts when its first row was written: a row added later does not move it', () => {
      const rows = withRow(sampleRows(), 0, 'MCD3', {
        evaluated_at: slotOf(0) + 60 + 1 + 500,
      });
      const d = measureSensors({ rows, ready: sampleReady() }).timing
        .startDelayMs;
      expect(d?.min).toBe(1000);
      // cycle 7 (40 s) is the longest; a start taken from the LATEST row would make cycle 0 the longest (501 s)
      expect(d?.max).toBe(40_000);
    });

    it('a cycle with a row that has no time has no summed time (no honest sum)', () => {
      const rows = withRow(sampleRows(), 0, 'MCD2', { duration_ms: null });
      const t = measureSensors({ rows, ready: sampleReady() }).timing;
      expect(t.computeMs?.count).toBe(7);
      expect(t.signalToDoneMs?.count).toBe(7);
      expect(measureSensors({ rows }).mcds['MCD2'].durationMs?.count).toBe(7);
    });

    it('a negative start delay (a clock behind) is counted as negative', () => {
      const ready = sampleReady().map((r) =>
        r.slot === slotOf(2)
          ? { ...r, ready_at: (r.ready_at as number) + 10 }
          : r
      );
      const d = measureSensors({ rows: sampleRows(), ready }).timing
        .startDelayMs;
      expect(d?.negative).toBe(1);
      expect(d?.min).toBe(-8000); // delay 2 s minus 10 s
    });
  });

  describe('rows per cycle', () => {
    it('expects the MCDs of the newest cycle: a newest cycle with three rows expects three', () => {
      const rows = sampleRows().filter(
        (r) => !(r.cycle_slot === slotOf(7) && r.mcd_id === 'MCD3')
      );
      const rpc = measureSensors({ rows }).rowsPerCycle;
      expect(rpc.expected).toEqual(['MCD0', 'MCD1', 'MCD2']);
      expect(rpc.complete).toBe(8);
      expect(rpc.unexpectedRows).toBe(7); // the MCD3 rows of the seven older cycles
      expect(rpc.byRowCount).toEqual([
        { value: 4, count: 7 },
        { value: 3, count: 1 },
      ]);
    });

    it('a given list overrides it, and a cycle without a listed MCD is short', () => {
      const rpc = measureSensors(
        { rows: sampleRows() },
        { expectedMcds: ['MCD0', 'MCD1', 'MCD2', 'MCD3', 'MCD4'] }
      ).rowsPerCycle;
      expect(rpc.expectedFrom).toBe('GIVEN');
      expect(rpc.complete).toBe(0);
      expect(rpc.short).toBe(8);
      expect(rpc.shortCycles[0]).toEqual({
        slot: slotOf(0),
        have: ['MCD0', 'MCD1', 'MCD2', 'MCD3'],
        missing: ['MCD4'],
      });
    });

    it('an empty given list is no list: the newest cycle decides', () => {
      const rpc = measureSensors(
        { rows: sampleRows() },
        { expectedMcds: [] }
      ).rowsPerCycle;
      expect(rpc.expectedFrom).toBe('NEWEST_CYCLE');
      expect(rpc.expected).toHaveLength(4);
    });

    it('lists a cycle that lacks a row, which MCDs it has and which it lacks, and counts cycles by row count', () => {
      let rows = sampleRows().filter(
        (r) => !(r.cycle_slot === slotOf(2) && r.mcd_id === 'MCD2')
      );
      rows = rows.filter(
        (r) =>
          !(
            r.cycle_slot === slotOf(5) &&
            (r.mcd_id === 'MCD1' || r.mcd_id === 'MCD3')
          )
      );
      const r = measureSensors({ rows });
      expect(r.rowsPerCycle.short).toBe(2);
      expect(r.rowsPerCycle.complete).toBe(6);
      expect(r.rowsPerCycle.shortCycles).toEqual([
        { slot: slotOf(2), have: ['MCD0', 'MCD1', 'MCD3'], missing: ['MCD2'] },
        { slot: slotOf(5), have: ['MCD0', 'MCD2'], missing: ['MCD1', 'MCD3'] },
      ]);
      // most cycles first, and on a tie the smaller row count first
      expect(r.rowsPerCycle.byRowCount).toEqual([
        { value: 4, count: 6 },
        { value: 2, count: 1 },
        { value: 3, count: 1 },
      ]);
      expect(r.findings).toContain('2 cycle(s) lack a row of an expected MCD');
      expect(formatReport(r)).toContain('2026-09-18T21:05Z lacks MCD2');
    });

    it('READY cycles before the newest reading that have no row are listed, those after it are only counted', () => {
      const r = measureSensors({
        rows: without(sampleRows(), 3),
        ready: sampleReady(),
      });
      expect(r.rowsPerCycle.readyCycles).toBe(10);
      expect(r.rowsPerCycle.readyWithoutRows).toEqual([slotOf(3)]);
      expect(r.rowsPerCycle.readyAfterLastRow).toBe(2);
      expect(r.findings).toContain(
        '1 READY cycle(s) before the newest reading have no row at all'
      );
      expect(formatReport(r)).toContain('2026-09-18T21:10Z has no row');
    });

    it('READY cycles counted once each, and a READY row without ready_at still exists', () => {
      const ready = [...sampleReady(), ...sampleReady()].map((r) => ({
        ...r,
        ready_at: null,
      }));
      expect(
        measureSensors({ rows: sampleRows(), ready }).rowsPerCycle.readyCycles
      ).toBe(10);
    });

    it('with READY rows but no readings at all, every READY cycle is after the last reading', () => {
      const rpc = measureSensors({
        rows: [],
        ready: sampleReady(),
      }).rowsPerCycle;
      expect(rpc.readyWithoutRows).toEqual([]);
      expect(rpc.readyAfterLastRow).toBe(10);
    });

    it('without READY rows the READY counts are null, not zero', () => {
      const rpc = measureSensors({ rows: sampleRows() }).rowsPerCycle;
      expect(rpc.readyCycles).toBeNull();
      expect(rpc.readyWithoutRows).toBeNull();
      expect(rpc.readyAfterLastRow).toBeNull();
    });

    it('tells the reader when READY rows were not given', () => {
      expect(formatReport(measureSensors({ rows: sampleRows() }))).toContain(
        'READY cycles: not given'
      );
    });
  });

  describe('jobs', () => {
    it('are not measured, and the report says how to give them, when none were given', () => {
      expect(measureSensors({ rows: sampleRows() }).jobs).toBeNull();
      expect(formatReport(measureSensors({ rows: sampleRows() }))).toContain(
        'Jobs: no outcomes given'
      );
    });

    it('an empty list is given and empty: zero of everything, no distributions', () => {
      expect(measureSensors({ rows: sampleRows(), jobs: [] }).jobs).toEqual({
        given: 0,
        written: 0,
        skippedOld: 0,
        nothingEnabled: 0,
        other: 0,
        basis: {},
        skippedAgeSeconds: null,
        wallMs: null,
        failed: null,
      });
    });

    it('groups the written jobs by what they were made from, and counts an outcome it does not know', () => {
      const jobs = [
        {
          outcome: 'WRITTEN',
          slot: slotOf(0),
          basis: 'INPUTS',
          wallMs: 100,
          ageSeconds: null,
        },
        {
          outcome: 'WRITTEN',
          slot: slotOf(1),
          basis: 'STALE_CYCLE_NOT_READY',
          wallMs: 200,
          ageSeconds: null,
        },
        {
          outcome: 'WRITTEN',
          slot: slotOf(2),
          basis: 'STALE_INVALID_CYCLE_ROW',
          wallMs: null,
          ageSeconds: null,
        },
        {
          outcome: 'WRITTEN',
          slot: slotOf(3),
          basis: null,
          wallMs: 400,
          ageSeconds: null,
        },
        {
          outcome: 'SOMETHING_NEW',
          slot: null,
          basis: null,
          wallMs: null,
          ageSeconds: null,
        },
      ];
      const j = measureSensors({
        rows: sampleRows(),
        jobs,
        failedJobs: 0,
      }).jobs;
      expect(j?.written).toBe(4);
      expect(j?.other).toBe(1);
      expect(j?.basis).toEqual({
        INPUTS: 1,
        STALE_CYCLE_NOT_READY: 1,
        STALE_INVALID_CYCLE_ROW: 1,
        UNKNOWN: 1,
      });
      expect(j?.wallMs?.count).toBe(3); // 100 200 400; one has none
      expect(j?.failed).toBe(0);
    });

    it('a skipped job with no age adds none, and a written job with an age adds none to the skipped ages', () => {
      const jobs = [
        {
          outcome: 'SKIPPED_OLD',
          slot: slotOf(8),
          basis: null,
          wallMs: null,
          ageSeconds: null,
        },
        {
          outcome: 'SKIPPED_OLD',
          slot: slotOf(9),
          basis: null,
          wallMs: null,
          ageSeconds: 800,
        },
        {
          outcome: 'WRITTEN',
          slot: slotOf(7),
          basis: 'INPUTS',
          wallMs: 100,
          ageSeconds: 5,
        },
      ];
      const j = measureSensors({ rows: sampleRows(), jobs }).jobs;
      expect(j?.skippedOld).toBe(2);
      expect(j?.skippedAgeSeconds).toMatchObject({
        count: 1,
        min: 800,
        max: 800,
      });
    });

    it('only written jobs give wall times and only skipped ones give ages', () => {
      const j = measureSensors(world()).jobs;
      expect(j?.wallMs?.count).toBe(8);
      expect(j?.skippedAgeSeconds?.count).toBe(2);
    });
  });

  describe('MCD0 inheritance', () => {
    const marks = (rows: SensorRowSample[]) =>
      measureSensors({ rows }).inheritance;
    const strip = (
      rows: SensorRowSample[],
      k: number,
      mcd: string,
      code: string
    ) => {
      const row = rowAt(rows, k, mcd);
      const doc = JSON.parse(row.envelope_json as string) as {
        status_reasons: string[];
      };
      doc.status_reasons = doc.status_reasons.filter((c) => c !== code);
      return withRow(rows, k, mcd, {
        envelope_json: JSON.stringify(doc),
        inherited_reasons: row.inherited_reasons.filter((c) => c !== code),
      });
    };

    it('a mark that is missing from a channel MCD is found, with the slot, the MCD and the timeframe', () => {
      const rows = strip(sampleRows(), 1, 'MCD1', 'MCD0_DEFECT_M15');
      const i = marks(rows);
      expect(i.missing).toBe(1);
      expect(i.unexplained).toBe(0);
      expect(i.mismatches).toEqual([
        { slot: slotOf(1), mcd: 'MCD1', timeframe: 'M15', kind: 'MISSING' },
      ]);
      expect(measureSensors({ rows }).findings).toContain(
        '1 MCD0 mark(s) are missing from a channel MCD'
      );
    });

    it('MCD3 needs both marks: one of the two missing is one mismatch for that timeframe', () => {
      const i = marks(strip(sampleRows(), 1, 'MCD3', 'MCD0_DEFECT_M5'));
      expect(i.mismatches).toEqual([
        { slot: slotOf(1), mcd: 'MCD3', timeframe: 'M5', kind: 'MISSING' },
      ]);
    });

    it('either the envelope or inherited_reasons showing the mark is enough', () => {
      const row = rowAt(sampleRows(), 1, 'MCD1');
      const doc = JSON.parse(row.envelope_json as string) as {
        status_reasons: string[];
      };
      doc.status_reasons = [];
      const onlyColumn = withRow(sampleRows(), 1, 'MCD1', {
        envelope_json: JSON.stringify(doc),
      });
      expect(marks(onlyColumn).missing).toBe(0);
      const onlyEnvelope = withRow(sampleRows(), 1, 'MCD1', {
        inherited_reasons: [],
      });
      expect(marks(onlyEnvelope).missing).toBe(0);
    });

    it('a mark that MCD0 did not call for is unexplained: on a cycle with no defect', () => {
      const rows = withRow(sampleRows(), 0, 'MCD1', {
        inherited_reasons: ['MCD0_DEFECT_M15'],
      });
      const i = marks(rows);
      expect(i.unexplained).toBe(1);
      expect(i.mismatches).toEqual([
        { slot: slotOf(0), mcd: 'MCD1', timeframe: 'M15', kind: 'UNEXPLAINED' },
      ]);
      expect(measureSensors({ rows }).findings).toContain(
        '1 MCD0 mark(s) have no MCD0 defect behind them'
      );
    });

    it('a mark on a timeframe the MCD does not use is unexplained even when MCD0 flagged it', () => {
      // k1: MCD0 flags both; MCD1 uses M15 only, so MCD0_DEFECT_M5 on it is not required
      const i = marks(
        withRow(sampleRows(), 1, 'MCD1', {
          inherited_reasons: ['MCD0_DEFECT_M15', 'MCD0_DEFECT_M5'],
        })
      );
      expect(i.mismatches).toEqual([
        { slot: slotOf(1), mcd: 'MCD1', timeframe: 'M5', kind: 'UNEXPLAINED' },
      ]);
    });

    it('only a VALID MCD0 propagates: a CAUTIONARY, STALE or INVALID MCD0 with a mark behind it is unexplained, and a channel MCD without it is fine', () => {
      for (const status of ['CAUTIONARY', 'STALE', 'INVALID']) {
        const gate = withRow(sampleRows(), 1, 'MCD0', { status });
        // the table's marks on k1 now have no VALID MCD0 behind them
        const i = marks(gate);
        expect(i.cyclesWithValidDefect).toBe(4);
        expect(i.missing).toBe(0);
        expect(i.unexplained).toBe(4); // MCD1 M15, MCD2 M5, MCD3 M5 and M15
      }
    });

    it('only a VALID or CAUTIONARY channel reading is marked: an INVALID or STALE one that lacks the mark is fine, one that carries it is not', () => {
      // k2: MCD2 is INVALID and MCD0 flags M5 and M15: no mark required, none present
      expect(marks(sampleRows()).missing).toBe(0);
      const i = marks(
        withRow(sampleRows(), 2, 'MCD2', {
          inherited_reasons: ['MCD0_DEFECT_M5'],
        })
      );
      expect(i.mismatches).toEqual([
        { slot: slotOf(2), mcd: 'MCD2', timeframe: 'M5', kind: 'UNEXPLAINED' },
      ]);
    });

    it('MCD0 itself is not marked: a mark on the gate is unexplained', () => {
      const i = marks(
        withRow(sampleRows(), 1, 'MCD0', {
          inherited_reasons: ['MCD0_DEFECT_M5'],
        })
      );
      expect(i.mismatches).toEqual([
        { slot: slotOf(1), mcd: 'MCD0', timeframe: 'M5', kind: 'UNEXPLAINED' },
      ]);
    });

    it('a cycle with no MCD0 row has no defect, so no mark is required', () => {
      const rows = sampleRows().filter(
        (r) => !(r.cycle_slot === slotOf(1) && r.mcd_id === 'MCD0')
      );
      const i = marks(rows);
      expect(i.cyclesWithValidDefect).toBe(4);
      expect(i.expectedMarks).toBe(7); // 11 - 4 of k1
      expect(i.unexplained).toBe(4); // k1's marks now have no MCD0 behind them
    });

    it('an MCD the kit has no uses_channel for is skipped and named, not checked', () => {
      const base = rowAt(sampleRows(), 1, 'MCD1');
      const extra: SensorRowSample = {
        ...base,
        mcd_id: 'MCD4',
        inherited_reasons: ['MCD0_DEFECT_M5'],
      };
      const r = measureSensors({ rows: [...sampleRows(), extra] });
      expect(r.inheritance.unknownMcds).toEqual(['MCD4']);
      expect(r.inheritance.unexplained).toBe(0);
      expect(r.findings).toContain(
        'no uses_channel is known for MCD4: their marks were not checked'
      );
    });

    it('a state of MCD0 the kit does not know marks nobody', () => {
      const i = marks(
        withRow(sampleRows(), 1, 'MCD0', { state_code: 'MCD0_SOMETHING_NEW' })
      );
      expect(i.cyclesWithValidDefect).toBe(4);
      expect(i.unexplained).toBe(4);
    });

    it('lists mismatches in slot order, then MCD order, a missing mark before an unexplained one', () => {
      let rows = strip(sampleRows(), 4, 'MCD1', 'MCD0_DEFECT_M15');
      rows = withRow(rows, 4, 'MCD1', {
        inherited_reasons: ['MCD0_DEFECT_M5'],
      });
      rows = withRow(rows, 0, 'MCD2', {
        inherited_reasons: ['MCD0_DEFECT_M5'],
      });
      expect(marks(rows).mismatches).toEqual([
        { slot: slotOf(0), mcd: 'MCD2', timeframe: 'M5', kind: 'UNEXPLAINED' },
        { slot: slotOf(4), mcd: 'MCD1', timeframe: 'M15', kind: 'MISSING' },
        { slot: slotOf(4), mcd: 'MCD1', timeframe: 'M5', kind: 'UNEXPLAINED' },
      ]);
    });

    it('lists them in the same order whatever order the rows arrive in', () => {
      let rows = withRow(sampleRows(), 1, 'MCD1', {
        inherited_reasons: ['MCD0_DEFECT_M15', 'MCD0_DEFECT_M5'],
      });
      // cycle 1 now has two mismatches, MCD1's (unexplained M5) and MCD2's (missing M5): their order is the MCD order
      rows = strip(rows, 1, 'MCD2', 'MCD0_DEFECT_M5');
      rows = withRow(rows, 3, 'MCD1', {
        inherited_reasons: ['MCD0_DEFECT_M5'],
      });
      rows = withRow(rows, 0, 'MCD1', {
        inherited_reasons: ['MCD0_DEFECT_M15'],
      });
      rows = withRow(rows, 5, 'MCD2', {
        inherited_reasons: ['MCD0_DEFECT_M5'],
      });
      const sorted = marks(rows).mismatches;
      expect(
        sorted.map((m) => `${m.slot - FIRST_SLOT}:${m.mcd}:${m.timeframe}`)
      ).toEqual([
        '0:MCD1:M15',
        '300:MCD1:M5',
        '300:MCD2:M5',
        '900:MCD1:M5',
        '1500:MCD2:M5',
      ]);
      expect(marks([...rows].reverse()).mismatches).toEqual(sorted);
      const shuffled = [...rows].sort(
        (a, b) =>
          ((a.cycle_slot * 7 + a.mcd_id.length * 3) % 11) -
          ((b.cycle_slot * 7 + b.mcd_id.length * 3) % 11)
      );
      expect(marks(shuffled).mismatches).toEqual(sorted);
    });
  });

  describe('findings', () => {
    it.each([
      ['NOT_DETERMINISTIC', ['LOGIC_DIVERGENCE'], true],
      ['STORED_DATA_DAMAGED', ['TAMPERED_BUNDLE'], true],
      ['INCONCLUSIVE', ['NOT_REPLAYABLE'], true],
      ['VERSION_CHANGED', ['VERSION_MISMATCH'], false],
      ['DETERMINISTIC', ['VERIFIED'], false],
    ])('a %s replay %j: finding is %s', (verdict, list, flagged) => {
      const input = cleanWorld();
      input.replay = list.map((v, k) => ({
        slot: slotOf(k),
        verdict: v,
        cause: null,
      }));
      const r = measureSensors(input, { scan: realScan });
      expect(r.determinism.verdict).toBe(verdict);
      expect(r.findings).toEqual(flagged ? [`replay: ${verdict}`] : []);
    });

    it('no replay is not a finding (it was not asked for)', () => {
      const input = cleanWorld();
      input.replay = null;
      expect(measureSensors(input, { scan: realScan }).findings).toEqual([]);
    });
  });
});

describe('formatReport', () => {
  let text: string;
  beforeAll(() => {
    text = formatReport(measureSensors(world(), { scan: realScan }));
  });
  // the first line that starts with the label and goes on with a number: the status mix lines start the same way
  const cells = (label: string) =>
    (text.match(new RegExp(`^${label}\\s+(\\d.*)$`, 'm')) ?? [])[1]
      ?.trim()
      .split(/\s+/);

  it('says how many cycles and rows, which slots, and which MCDs it expects', () => {
    expect(text).toContain(
      'Sensor measurement: 8 cycles, 32 rows, slots 2026-09-18T20:55Z to 2026-09-18T21:30Z'
    );
    expect(text).toContain(
      'Expected MCDs per cycle: MCD0, MCD1, MCD2, MCD3 (those of the newest cycle)'
    );
  });

  it('prints the status mix of each MCD with counts and shares', () => {
    expect(text).toContain(
      'MCD0  rows     8   VALID 6 (75.0%)  CAUTIONARY 0 (0.0%)  INVALID 1 (12.5%)  STALE 1 (12.5%)   flag shadow 8, evaluator 1.0.0'
    );
    expect(text).toContain(
      'MCD3  rows     8   VALID 2 (25.0%)  CAUTIONARY 3 (37.5%)  INVALID 3 (37.5%)  STALE 0 (0.0%)   flag shadow 8, evaluator 2.0.1'
    );
    expect(text).toContain(
      'reasons on readings that are not VALID: MCD0_DEFECT_M15 x 4'
    );
  });

  it('prints the MCD0 flag rate for M5, M15 and both', () => {
    expect(text).toContain(
      'MCD0 flag rate (over 6 readings that name a state; 2 INVALID or STALE have none)'
    );
    expect(text).toContain(
      'M5 flagged 4 (66.7%)   M15 flagged 4 (66.7%)   both 3 (50.0%)   either 5 (83.3%)   none 1'
    );
    expect(text).toContain('(M5 only 1, M15 only 1;');
  });

  it('prints the errors and the violations', () => {
    expect(text).toContain('EVALUATOR_ERROR readings: 2');
    expect(text).toContain(
      'rows with guard problems: 2 (SCHEMA 1, WORDING 1, RAISED 1)'
    );
    expect(text).toContain(
      'schema violations recorded: 1   wording violations recorded: 1'
    );
    expect(text).toContain(
      "second look at every stored envelope: 32 scanned, 0 fail the schema, 0 have a '%' in a free text, 0 unreadable"
    );
  });

  it('prints each MCD time on one line, with the count of readings over 1 s', () => {
    expect(cells('  MCD3')?.slice(0, 7)).toEqual([
      '8',
      '100',
      '130',
      '1200',
      '1200',
      '1200',
      '263.8',
    ]);
    expect(text).toMatch(/^ {2}MCD3 .*   1$/m);
    expect(text).toMatch(/^ {2}MCD0 .*   0$/m);
    expect(text).toContain(
      'Milliseconds per MCD (nearest-rank percentiles), budget 1000 ms (standard 11.2)'
    );
  });

  it('prints the cycle times in seconds with two decimals, with the count over 30 s', () => {
    expect(cells('  MCDs, summed \\(lower bound\\)')?.slice(0, 7)).toEqual([
      '8',
      '0.16',
      '0.21',
      '1.31',
      '1.31',
      '1.31',
      '0.35',
    ]);
    expect(cells('  signal to start')).toEqual([
      '8',
      '1.00',
      '2.00',
      '40.00',
      '40.00',
      '40.00',
      '7.13',
    ]);
    expect(cells('  signal to done')?.slice(0, 7)).toEqual([
      '8',
      '1.25',
      '2.30',
      '41.50',
      '41.50',
      '41.50',
      '7.58',
    ]);
    expect(text).toMatch(/^ {2}signal to done .* 1$/m);
    expect(text).toContain(
      'Seconds per cycle, budget 30 s after the cycle-ready signal (standard 11.2)'
    );
    expect(text).toContain(
      "signal to done = signal to start + the job's wall time for 8 cycle(s), + the MCDs' summed time for 0"
    );
  });

  it('prints the rows per cycle, the READY cycles, the jobs, the determinism and the inheritance', () => {
    expect(text).toContain(
      'Rows per cycle: 8 of 8 cycles have a row for every expected MCD (8 x 4 rows)'
    );
    expect(text).toContain(
      'READY cycles in the range: 10; 0 before the newest reading have no row; 2 after it (in flight, or the worker is behind)'
    );
    expect(text).toContain(
      'Jobs: 11 outcomes: 8 written, 2 skipped as too old, 1 with every MCD off; 2 failed'
    );
    expect(text).toContain('written from: INPUTS 8');
    expect(text).toContain(
      'Determinism: DETERMINISTIC (3 cycle(s) replayed: 3 VERIFIED)'
    );
    expect(text).toContain(
      'MCD0 inheritance: 5 cycle(s) with a VALID defect, 11 mark(s) required, 0 missing, 0 without a defect behind them'
    );
  });

  it('prints the findings', () => {
    expect(text).toContain('Findings (4):');
    expect(text).toContain(
      '  - 2 reading(s) carry EVALUATOR_ERROR (the shadow stage needs none)'
    );
  });

  it('tells the reader what to do when no replay was run', () => {
    const r = measureSensors({ rows: sampleRows() });
    expect(formatReport(r)).toContain(
      'Determinism: NOT_CHECKED (no replay was run; give --replay N or --replay-file)'
    );
  });

  it('lists at most twenty mismatches and says how many more', () => {
    const rows = sampleRows().map((r) =>
      r.mcd_id === 'MCD0'
        ? r
        : { ...r, inherited_reasons: ['MCD0_DEFECT_M5', 'MCD0_DEFECT_M15'] }
    );
    const r = measureSensors({ rows });
    const t = formatReport(r);
    const listed = t
      .split('\n')
      .filter((l) =>
        /^ {4}2026-\S+ MCD\d (M5|M15) (MISSING|UNEXPLAINED)$/.test(l)
      );
    expect(listed).toHaveLength(20);
    expect(t).toContain(`... and ${r.inheritance.mismatches.length - 20} more`);
  });

  it('shows how many readings had a negative time as a note on the line', () => {
    const ready = sampleReady().map((r) =>
      r.slot === slotOf(2) ? { ...r, ready_at: (r.ready_at as number) + 10 } : r
    );
    expect(formatReport(measureSensors({ rows: sampleRows(), ready }))).toMatch(
      /signal to start .*\(1 below 0\)/
    );
  });
});

describe('formatReport: the lines that appear only when there is something to say', () => {
  const quiet = () =>
    formatReport(
      measureSensors({
        rows: sampleRows().filter(
          (r) => r.mcd_id === 'MCD2' && r.status === 'VALID'
        ),
      })
    );

  it('a report with only VALID readings has no reasons line, no guard categories and no unexpected rows', () => {
    const text = quiet();
    expect(text).not.toContain('reasons on readings that are not VALID');
    expect(text).toMatch(/^ {2}rows with guard problems: 0$/m);
    expect(text).not.toContain('not expected');
    expect(text).toContain(
      'Rows per cycle: 3 of 3 cycles have a row for every expected MCD (3 x 1 rows)'
    );
  });

  it('a report of nothing at all has no row-count list after "Rows per cycle"', () => {
    expect(formatReport(measureSensors({ rows: [] }))).toMatch(
      /^Rows per cycle: 0 of 0 cycles have a row for every expected MCD$/m
    );
  });

  it('says how many rows belong to an MCD that is not expected, when there are some', () => {
    const rows = sampleRows().filter(
      (r) => !(r.cycle_slot === slotOf(7) && r.mcd_id === 'MCD3')
    );
    expect(formatReport(measureSensors({ rows }))).toContain(
      '7 row(s) belong to an MCD that is not expected'
    );
  });

  describe('a list is cut after twenty entries and says how many more', () => {
    // n cycles that each lack MCD9: n short cycles to list
    const shortCycles = (n: number) => {
      const base = sampleRows()[0];
      const rows = Array.from({ length: n }, (_, k) => ({
        ...base,
        cycle_slot: slotOf(k),
      }));
      return formatReport(
        measureSensors({ rows }, { expectedMcds: ['MCD0', 'MCD9'] })
      );
    };
    const listed = (text: string) =>
      text.split('\n').filter((l) => /^ {4}2026-\S+ lacks MCD9$/.test(l));

    it('exactly twenty are all listed and nothing is said about more', () => {
      const text = shortCycles(20);
      expect(listed(text)).toHaveLength(20);
      expect(text).not.toContain('... and');
    });

    it('twenty-one list twenty and say one more', () => {
      const text = shortCycles(21);
      expect(listed(text)).toHaveLength(20);
      expect(text).toContain('    ... and 1 more');
    });
  });

  it('the jobs line has no failed count unless one was given (zero is a count)', () => {
    const withFailed = (failedJobs: number | null) =>
      formatReport(
        measureSensors({ rows: sampleRows(), jobs: sampleJobs(), failedJobs })
      );
    expect(withFailed(null)).toMatch(
      /^Jobs: 11 outcomes: .*with every MCD off$/m
    );
    expect(withFailed(0)).toContain('with every MCD off; 0 failed');
  });

  it('has no "written from" line when no job was written', () => {
    const jobs = sampleJobs().filter((j) => j.outcome !== 'WRITTEN');
    const text = formatReport(measureSensors({ rows: sampleRows(), jobs }));
    expect(text).not.toContain('written from');
    expect(text).toContain('Jobs: 3 outcomes: 0 written, 2 skipped as too old');
  });

  it('names only the flags that are on: an MCD with live rows only shows live, not "shadow 0"', () => {
    const rows = sampleRows().map((r) =>
      r.mcd_id === 'MCD1' ? { ...r, flag: 'live' } : r
    );
    const text = formatReport(measureSensors({ rows }));
    expect(text).toContain('flag live 8, evaluator 2.0.1');
    expect(text).not.toMatch(/shadow 0|live 0|other 0/);
  });

  it('a level that is not an object, or has no name, is not a text and does not stop the scan', () => {
    const row = rowAt(sampleRows(), 0, 'MCD1');
    const doc = JSON.parse(row.envelope_json as string) as Record<
      string,
      unknown
    >;
    doc['levels'] = [
      null,
      'text',
      7,
      { price: 1 },
      { name: 5 },
      { name: 'half % level' },
    ];
    const rows = withRow(sampleRows(), 0, 'MCD1', {
      envelope_json: JSON.stringify(doc),
    });
    expect(measureSensors({ rows }).violations.rescan.percentInText).toBe(1);
  });

  it('READY cycles with no row are listed in slot order whatever order they arrive in', () => {
    const ready = [7, 3, 5, 1, 0, 6, 2, 4].map((k) => ({
      slot: slotOf(k),
      ready_at: slotOf(k) + 60,
    }));
    const rows = without(without(sampleRows(), 1), 3);
    const r = measureSensors({ rows, ready });
    expect(r.rowsPerCycle.readyWithoutRows).toEqual([slotOf(1), slotOf(3)]);
  });
});

describe('normalizeRow, normalizeReady, normalizeJob, normalizeReplay', () => {
  const good = sampleRows()[5];

  it('keeps a well-formed row exactly', () => {
    expect(normalizeRow(JSON.parse(JSON.stringify(good)))).toEqual(good);
  });

  it('turns what is not the right type into null, an empty list, UNKNOWN or false', () => {
    const r = normalizeRow({
      cycle_slot: 600,
      mcd_id: 'MCD1',
      flag: 5,
      status: null,
      state_code: 7,
      inherited_reasons: 'x',
      guard_problems: [1, 'ok', null],
      retuning_observed: 'yes',
      duration_ms: '12',
      evaluated_at: Number.NaN,
      envelope_json: 3,
    }) as SensorRowSample;
    expect(r.flag).toBe('UNKNOWN');
    expect(r.status).toBe('UNKNOWN');
    expect(r.evaluator_version).toBe('UNKNOWN');
    expect(r.state_code).toBeNull();
    expect(r.inherited_reasons).toEqual([]);
    expect(r.guard_problems).toEqual(['ok']);
    expect(r.retuning_observed).toBe(false);
    expect(r.retuning_applied).toBe(false);
    expect(r.duration_ms).toBeNull();
    expect(r.evaluated_at).toBeNull();
    expect(r.envelope_json).toBeNull();
  });

  it('rejects what has no numeric slot or no MCD id', () => {
    for (const bad of [
      null,
      5,
      'x',
      [],
      {},
      { cycle_slot: '600', mcd_id: 'MCD1' },
      { cycle_slot: 600 },
      { cycle_slot: 600, mcd_id: '' },
      { cycle_slot: Number.NaN, mcd_id: 'MCD1' },
    ]) {
      expect(normalizeRow(bad)).toBeNull();
    }
  });

  it('a ready row needs a numeric slot, and ready_at may be missing', () => {
    expect(normalizeReady({ slot: 300, ready_at: 360 })).toEqual({
      slot: 300,
      ready_at: 360,
    });
    expect(normalizeReady({ slot: 300 })).toEqual({
      slot: 300,
      ready_at: null,
    });
    expect(normalizeReady({ slot: '300' })).toBeNull();
    expect(normalizeReady(null)).toBeNull();
  });

  it('a job is an outcome object or a Bull job holding one, and needs an outcome', () => {
    const outcome = {
      outcome: 'WRITTEN',
      slot: 300,
      basis: 'INPUTS',
      wallMs: 250,
      ageSeconds: 3,
    };
    expect(normalizeJob(outcome)).toEqual(outcome);
    expect(normalizeJob({ id: '7', returnvalue: outcome })).toEqual(outcome);
    expect(normalizeJob({ outcome: 'SKIPPED_OLD', slot: 'x' })).toEqual({
      outcome: 'SKIPPED_OLD',
      slot: null,
      basis: null,
      wallMs: null,
      ageSeconds: null,
    });
    expect(normalizeJob({ returnvalue: 'text' })).toBeNull();
    expect(normalizeJob({ slot: 1 })).toBeNull();
    expect(normalizeJob([])).toBeNull();
  });

  it('a replay sample needs a numeric slot and a verdict, and keeps the cause', () => {
    expect(
      normalizeReplay({
        slot: 300,
        verdict: 'NOT_REPLAYABLE',
        cause: 'NO_STORED_BUNDLE',
        summary: 'x',
      })
    ).toEqual({
      slot: 300,
      verdict: 'NOT_REPLAYABLE',
      cause: 'NO_STORED_BUNDLE',
    });
    expect(normalizeReplay({ slot: 300, verdict: 'VERIFIED' })).toEqual({
      slot: 300,
      verdict: 'VERIFIED',
      cause: null,
    });
    expect(normalizeReplay({ slot: '300', verdict: 'VERIFIED' })).toBeNull();
    expect(normalizeReplay({ slot: 300 })).toBeNull();
    expect(normalizeReplay(7)).toBeNull();
  });
});

describe('parseInputJson, parseJobsJson, parseReplayJson', () => {
  const sample = path.join(
    __dirname,
    'fixtures',
    'measure-sensors-sample.json'
  );

  it('reads the sample file: rows, READY rows, jobs, replay verdicts and the failed count', () => {
    const { input, droppedRows } = parseInputJson(
      fs.readFileSync(sample, 'utf8')
    );
    expect(droppedRows).toBe(0);
    expect(input).toEqual(world());
  });

  it('reads a bare array as rows only, and drops rows it cannot use, counting them', () => {
    const parsed = parseInputJson(
      JSON.stringify([...sampleRows().slice(0, 3), { mcd_id: 'MCD1' }, 7])
    );
    expect(parsed.input.rows).toHaveLength(3);
    expect(parsed.droppedRows).toBe(2);
    expect(parsed.input.ready).toBeNull();
    expect(parsed.input.jobs).toBeNull();
    expect(parsed.input.replay).toBeNull();
    expect(parsed.input.failedJobs).toBeNull();
  });

  it('an object with only rows has no other lists, and a list that is not an array is none', () => {
    const parsed = parseInputJson(
      JSON.stringify({ rows: [], ready: 'x', jobs: {}, failedJobs: 'many' })
    );
    expect(parsed.input.ready).toBeNull();
    expect(parsed.input.jobs).toBeNull();
    expect(parsed.input.failedJobs).toBeNull();
  });

  it('says what is wrong with an input that is not rows', () => {
    expect(() => parseInputJson('{nope')).toThrow(/not valid JSON/);
    expect(() => parseInputJson('{"a": 1}')).toThrow(
      /array of mcd_outputs rows/
    );
    expect(() => parseInputJson('42')).toThrow(/array of mcd_outputs rows/);
    expect(() => parseInputJson('null')).toThrow(/array of mcd_outputs rows/);
    expect(() => parseInputJson('{"rows": "x"}')).toThrow(
      /array of mcd_outputs rows/
    );
  });

  it('reads job outcomes from an array or from an object with a jobs array', () => {
    const jobs = sampleJobs();
    expect(parseJobsJson(JSON.stringify(jobs))).toEqual(jobs);
    expect(parseJobsJson(JSON.stringify({ jobs }))).toEqual(jobs);
    expect(
      parseJobsJson(JSON.stringify([{ returnvalue: jobs[0] }, 5]))
    ).toEqual([jobs[0]]);
    expect(() => parseJobsJson('{"x": 1}')).toThrow(/array of job outcomes/);
    expect(() => parseJobsJson('nope')).toThrow(/not valid JSON/);
  });

  it('reads replay verdicts from the array replay-cycle.js prints, or from an object with a replay array', () => {
    const reports = [
      {
        slot: 300,
        verdict: 'VERIFIED',
        cause: null,
        summary: 'all equal',
        mcds: [],
      },
      { slot: 600, verdict: 'NOT_REPLAYABLE', cause: 'NO_STORED_BUNDLE' },
    ];
    expect(parseReplayJson(JSON.stringify(reports))).toEqual([
      { slot: 300, verdict: 'VERIFIED', cause: null },
      { slot: 600, verdict: 'NOT_REPLAYABLE', cause: 'NO_STORED_BUNDLE' },
    ]);
    expect(parseReplayJson(JSON.stringify({ replay: reports }))).toHaveLength(
      2
    );
    expect(() => parseReplayJson('{"x": 1}')).toThrow(
      /array of replay reports/
    );
    expect(() => parseReplayJson('nope')).toThrow(/not valid JSON/);
  });
});

describe('parseArgs', () => {
  it('needs exactly one of --db and --file', () => {
    expect(parseArgs([])).toEqual({
      error: 'give exactly one of --db and --file',
    });
    expect(parseArgs(['--db', '--file', 'x.json'])).toEqual({
      error: 'give exactly one of --db and --file',
    });
  });

  it('has defaults: XAUUSD, text output, no bounds, no jobs, no replay, not strict', () => {
    expect(parseArgs(['--db'])).toEqual({
      help: false,
      file: null,
      db: true,
      symbol: 'XAUUSD',
      since: null,
      until: null,
      last: null,
      expect: null,
      jobsFile: null,
      redis: false,
      replay: 0,
      replayFile: null,
      json: false,
      strict: false,
    });
  });

  it('reads every option', () => {
    expect(
      parseArgs([
        '--db',
        '--symbol',
        'EURUSD',
        '--since',
        '1790985600',
        '--until',
        '2026-10-04T00:00:00Z',
        '--last',
        '100',
        '--expect',
        'MCD0, MCD1,MCD1',
        '--redis',
        '--replay',
        '3',
        '--json',
        '--strict',
      ])
    ).toEqual({
      help: false,
      file: null,
      db: true,
      symbol: 'EURUSD',
      since: 1790985600,
      until: 1790985600 + 86400,
      last: 100,
      expect: ['MCD0', 'MCD1'],
      jobsFile: null,
      redis: true,
      replay: 3,
      replayFile: null,
      json: true,
      strict: true,
    });
    expect(
      parseArgs([
        '--file',
        'a.json',
        '--jobs',
        'j.json',
        '--replay-file',
        'r.json',
      ])
    ).toMatchObject({
      file: 'a.json',
      jobsFile: 'j.json',
      replayFile: 'r.json',
      db: false,
    });
  });

  it('reads an ISO date as unix seconds', () => {
    const o = parseArgs(['--db', '--since', '2026-10-03T00:00:00Z']);
    expect((o as { since: number }).since).toBe(1790985600);
  });

  it('refuses what it cannot read, with a reason', () => {
    const err = (argv: string[]) => parseArgs(argv);
    expect(err(['--db', '--since', 'yesterday'])).toEqual({
      error: '--since needs unix seconds or an ISO date',
    });
    expect(err(['--db', '--until'])).toEqual({
      error: '--until needs unix seconds or an ISO date',
    });
    expect(err(['--db', '--last', '0'])).toEqual({
      error: '--last needs a positive whole number',
    });
    expect(err(['--db', '--last', '1.5'])).toEqual({
      error: '--last needs a positive whole number',
    });
    expect(err(['--db', '--replay', '0'])).toEqual({
      error: '--replay needs a positive whole number',
    });
    expect(err(['--db', '--replay'])).toEqual({
      error: '--replay needs a positive whole number',
    });
    expect(err(['--file'])).toEqual({ error: '--file needs a path' });
    expect(err(['--file', 'a.json', '--jobs'])).toEqual({
      error: '--jobs needs a path',
    });
    expect(err(['--file', 'a.json', '--replay-file'])).toEqual({
      error: '--replay-file needs a path',
    });
    expect(err(['--db', '--symbol'])).toEqual({
      error: '--symbol needs a symbol',
    });
    expect(err(['--db', '--frobnicate'])).toEqual({
      error: 'unknown argument --frobnicate',
    });
    expect(err(['--db', '--since', '200', '--until', '100'])).toEqual({
      error: '--since is after --until',
    });
    for (const list of ['', 'MCD', 'mcd1', 'MCD1,,MCD2', 'MCD1;MCD2']) {
      expect(err(['--db', '--expect', list])).toEqual({
        error: '--expect needs a comma-separated list like MCD0,MCD1,MCD2,MCD3',
      });
    }
    expect(err(['--db', '--expect'])).toEqual({
      error: '--expect needs a comma-separated list like MCD0,MCD1,MCD2,MCD3',
    });
  });

  it('refuses options that cannot go together or need the database', () => {
    expect(parseArgs(['--db', '--jobs', 'j.json', '--redis'])).toEqual({
      error: 'give at most one of --jobs and --redis',
    });
    expect(
      parseArgs(['--db', '--replay', '2', '--replay-file', 'r.json'])
    ).toEqual({
      error: 'give at most one of --replay and --replay-file',
    });
    expect(parseArgs(['--file', 'a.json', '--redis'])).toEqual({
      error: '--redis and --replay need --db',
    });
    expect(parseArgs(['--file', 'a.json', '--replay', '2'])).toEqual({
      error: '--redis and --replay need --db',
    });
  });

  it('accepts --since equal to --until', () => {
    expect(
      parseArgs(['--db', '--since', '100', '--until', '100'])
    ).toMatchObject({ since: 100, until: 100 });
  });

  it('--help needs nothing else', () => {
    expect(parseArgs(['--help'])).toMatchObject({ help: true });
    expect(parseArgs(['-h'])).toMatchObject({ help: true });
  });
});

describe('loadSensorRows: read only', () => {
  /** A source that records every call; it has `findMany` on two tables and nothing else. */
  function source(
    opts: { slots?: number[]; rows?: unknown[]; ready?: unknown[] } = {}
  ) {
    const calls: Array<{ table: string; args: Record<string, unknown> }> = [];
    const src: SensorRowSource = {
      mcdOutput: {
        findMany: async (args) => {
          calls.push({
            table: 'mcdOutput',
            args: JSON.parse(JSON.stringify(args)) as Record<string, unknown>,
          });
          if (args.distinct)
            return (opts.slots ?? []).map((cycle_slot) => ({ cycle_slot }));
          return opts.rows ?? [];
        },
      },
      marketCycle: {
        findMany: async (args) => {
          calls.push({
            table: 'marketCycle',
            args: JSON.parse(JSON.stringify(args)) as Record<string, unknown>,
          });
          return opts.ready ?? [];
        },
      },
    };
    return { src, calls };
  }
  const defaults = { symbol: 'XAUUSD', since: null, until: null, last: null };

  it('counts the newest 576 CYCLES (distinct slots), then reads those rows and the READY cycles from the oldest of them', async () => {
    const { src, calls } = source({
      slots: [slotOf(7), slotOf(6), slotOf(5)],
      rows: sampleRows(),
      ready: sampleReady(),
    });
    const loaded = await loadSensorRows(src, defaults);
    expect(calls).toEqual([
      {
        table: 'mcdOutput',
        args: {
          where: { symbol: 'XAUUSD' },
          orderBy: { cycle_slot: 'desc' },
          distinct: ['cycle_slot'],
          take: 576,
          select: { cycle_slot: true },
        },
      },
      {
        table: 'mcdOutput',
        args: {
          where: { symbol: 'XAUUSD', cycle_slot: { gte: slotOf(5) } },
          orderBy: { cycle_slot: 'asc' },
          select: JSON.parse(JSON.stringify(SENSOR_ROW_COLUMNS)),
        },
      },
      {
        table: 'marketCycle',
        args: {
          where: { symbol: 'XAUUSD', state: 'READY', slot: { gte: slotOf(5) } },
          orderBy: { slot: 'asc' },
          select: { slot: true, ready_at: true },
        },
      },
    ]);
    expect(loaded.rows).toHaveLength(32);
    expect(loaded.ready).toHaveLength(10);
  });

  it('--last sets the count of cycles', async () => {
    const { src, calls } = source({ slots: [slotOf(1)] });
    await loadSensorRows(src, { ...defaults, last: 10 });
    expect(calls[0].args).toMatchObject({ take: 10 });
  });

  it('--since and --until alone bound the slot and take every cycle of the range, with no count', async () => {
    const { src, calls } = source();
    await loadSensorRows(src, { ...defaults, since: 100, until: 900 });
    expect(calls).toHaveLength(2);
    expect(calls[0]).toEqual({
      table: 'mcdOutput',
      args: {
        where: { symbol: 'XAUUSD', cycle_slot: { gte: 100, lte: 900 } },
        orderBy: { cycle_slot: 'asc' },
        select: JSON.parse(JSON.stringify(SENSOR_ROW_COLUMNS)),
      },
    });
    expect(calls[1].args).toMatchObject({
      where: { symbol: 'XAUUSD', state: 'READY', slot: { gte: 100, lte: 900 } },
    });
  });

  it('one bound alone is only that bound', async () => {
    const a = source();
    await loadSensorRows(a.src, { ...defaults, since: 100 });
    expect(a.calls[0].args).toMatchObject({
      where: { symbol: 'XAUUSD', cycle_slot: { gte: 100 } },
    });
    const b = source();
    await loadSensorRows(b.src, { ...defaults, until: 900 });
    expect(b.calls[0].args).toMatchObject({
      where: { symbol: 'XAUUSD', cycle_slot: { lte: 900 } },
    });
    expect('take' in b.calls[0].args).toBe(false);
    // and nothing else is in the range: a missing bound is absent, not null
    expect((b.calls[0].args as { where: unknown }).where).toEqual({
      symbol: 'XAUUSD',
      cycle_slot: { lte: 900 },
    });
    expect((a.calls[0].args as { where: unknown }).where).toEqual({
      symbol: 'XAUUSD',
      cycle_slot: { gte: 100 },
    });
  });

  it('a slot entry it cannot read does not pull the range down to zero', async () => {
    const { src, calls } = source({ slots: [] });
    src.mcdOutput.findMany = async (args) => {
      calls.push({
        table: 'mcdOutput',
        args: JSON.parse(JSON.stringify(args)) as Record<string, unknown>,
      });
      return args.distinct
        ? ['junk', null, { cycle_slot: slotOf(5) }, { cycle_slot: 'x' }]
        : [];
    };
    await loadSensorRows(src, defaults);
    expect(calls[1].args).toMatchObject({
      where: { symbol: 'XAUUSD', cycle_slot: { gte: slotOf(5) } },
    });
  });

  it('a range and --last together: the newest N cycles of the range, the READY cycles from the oldest of them to the end of the range', async () => {
    const { src, calls } = source({ slots: [800, 700] });
    await loadSensorRows(src, { ...defaults, since: 100, until: 900, last: 2 });
    expect(calls[0].args).toMatchObject({
      where: { symbol: 'XAUUSD', cycle_slot: { gte: 100, lte: 900 } },
      take: 2,
    });
    expect(calls[1].args).toMatchObject({
      where: { symbol: 'XAUUSD', cycle_slot: { gte: 700, lte: 900 } },
    });
    expect(calls[2].args).toMatchObject({
      where: { slot: { gte: 700, lte: 900 } },
    });
  });

  it('asks for the symbol it is given, not a fixed one', async () => {
    const { src, calls } = source({ slots: [slotOf(1)] });
    await loadSensorRows(src, { ...defaults, symbol: 'EURUSD' });
    expect(
      calls.every(
        (c) => (c.args.where as { symbol: string }).symbol === 'EURUSD'
      )
    ).toBe(true);
  });

  it('with no cycle at all it reads nothing more', async () => {
    const { src, calls } = source({ slots: [] });
    expect(await loadSensorRows(src, defaults)).toEqual({
      rows: [],
      ready: [],
    });
    expect(calls).toHaveLength(1);
  });

  it('selects exactly the columns the kit reads, and no others', () => {
    expect(Object.keys(SENSOR_ROW_COLUMNS).sort()).toEqual(
      Object.keys(sampleRows()[0]).sort()
    );
    expect(Object.values(SENSOR_ROW_COLUMNS).every((v) => v === true)).toBe(
      true
    );
  });

  it('drops rows it cannot read', async () => {
    const { src } = source({
      slots: [1],
      rows: [null, { mcd_id: 'MCD1' }, ...sampleRows()],
      ready: [null, { slot: 'x' }, ...sampleReady()],
    });
    const loaded = await loadSensorRows(src, defaults);
    expect(loaded.rows).toHaveLength(32);
    expect(loaded.ready).toHaveLength(10);
  });

  it('exposes no way to write: the source has findMany on two tables and nothing else', () => {
    const { src } = source();
    expect(Object.keys(src).sort()).toEqual(['marketCycle', 'mcdOutput']);
    expect(Object.keys(src.mcdOutput)).toEqual(['findMany']);
    expect(Object.keys(src.marketCycle)).toEqual(['findMany']);
  });
});

describe('the sample file and the command line', () => {
  const root = path.join(__dirname, '..');
  const sample = path.join(
    __dirname,
    'fixtures',
    'measure-sensors-sample.json'
  );
  const run = (...args: string[]) =>
    spawnSync(
      process.execPath,
      [path.join(root, 'scripts', 'measure-sensors.js'), ...args],
      {
        cwd: root,
        encoding: 'utf8',
        env: { ...process.env, DATABASE_URL: '', REDIS_URL: '' },
      }
    );
  const expected = () =>
    measureSensors(parseInputJson(fs.readFileSync(sample, 'utf8')).input, {
      scan: realScan,
    });

  it('the sample file is the fixture, so the runbook can point at it', () => {
    expect(JSON.parse(fs.readFileSync(sample, 'utf8'))).toEqual(
      JSON.parse(JSON.stringify(world()))
    );
  });

  it('prints the report for a file, exactly as formatReport does, with the real schema validator as the second look', () => {
    const r = run('--file', sample);
    expect(r.status).toBe(0);
    expect(r.stdout.trimEnd()).toBe(formatReport(expected()));
    expect(r.stdout).toContain(
      'second look at every stored envelope: 32 scanned, 0 fail the schema'
    );
  });

  it('--json prints the report as JSON', () => {
    const r = run('--file', sample, '--json');
    expect(r.status).toBe(0);
    expect(JSON.parse(r.stdout)).toEqual(
      JSON.parse(JSON.stringify(expected()))
    );
  });

  it('--strict exits 1 when the report has a finding, and 0 when it has none', () => {
    const strict = run('--file', sample, '--strict');
    expect(strict.status).toBe(1);
    expect(strict.stdout).toContain('Findings (4):');
    const tmp = path.join(
      __dirname,
      'fixtures',
      'measure-sensors-clean.tmp.json'
    );
    fs.writeFileSync(tmp, JSON.stringify(cleanWorld()));
    try {
      const clean = run('--file', tmp, '--strict');
      expect(clean.status).toBe(0);
      expect(clean.stdout).toContain('Findings: none');
    } finally {
      fs.unlinkSync(tmp);
    }
  });

  it('--expect, --jobs and --replay-file are honoured', () => {
    const jobsTmp = path.join(
      __dirname,
      'fixtures',
      'measure-sensors-jobs.tmp.json'
    );
    const replayTmp = path.join(
      __dirname,
      'fixtures',
      'measure-sensors-replay.tmp.json'
    );
    fs.writeFileSync(
      jobsTmp,
      JSON.stringify([
        { returnvalue: { outcome: 'SKIPPED_OLD', slot: 300, ageSeconds: 900 } },
      ])
    );
    fs.writeFileSync(
      replayTmp,
      JSON.stringify([
        { slot: slotOf(0), verdict: 'LOGIC_DIVERGENCE', cause: null },
      ])
    );
    try {
      const r = run(
        '--file',
        sample,
        '--expect',
        'MCD0,MCD1,MCD2,MCD3,MCD4',
        '--jobs',
        jobsTmp,
        '--replay-file',
        replayTmp
      );
      expect(r.status).toBe(0);
      expect(r.stdout).toContain('(given)');
      expect(r.stdout).toContain(
        'Jobs: 1 outcomes: 0 written, 1 skipped as too old'
      );
      expect(r.stdout).toContain(
        'Determinism: NOT_DETERMINISTIC (1 cycle(s) replayed: 1 LOGIC_DIVERGENCE)'
      );
      expect(r.stdout).toContain('8 cycle(s) lack a row of an expected MCD');
    } finally {
      fs.unlinkSync(jobsTmp);
      fs.unlinkSync(replayTmp);
    }
  });

  it('a symbol that is not in the file leaves nothing to measure', () => {
    const r = run('--file', sample, '--symbol', 'EURUSD');
    expect(r.status).toBe(0);
    expect(r.stdout).toContain('Sensor measurement: 0 cycles, 0 rows');
  });

  it('exits 2 with the usage on a bad argument, 0 on --help', () => {
    const bad = run('--nope');
    expect(bad.status).toBe(2);
    expect(bad.stderr).toContain('unknown argument --nope');
    expect(bad.stderr).toContain('Usage:');
    const help = run('--help');
    expect(help.status).toBe(0);
    expect(help.stdout.trimEnd()).toBe(USAGE);
  });

  it('exits 1 and says why when --db has no DATABASE_URL, without touching a database', () => {
    const r = run('--db');
    expect(r.status).toBe(1);
    expect(r.stderr).toContain('DATABASE_URL is not set');
  });

  it('exits 1 on a file that is not rows', () => {
    const tmp = path.join(
      __dirname,
      'fixtures',
      'measure-sensors-bad.tmp.json'
    );
    fs.writeFileSync(tmp, '{"x": 1}');
    try {
      const r = run('--file', tmp);
      expect(r.status).toBe(1);
      expect(r.stderr).toContain('array of mcd_outputs rows');
    } finally {
      fs.unlinkSync(tmp);
    }
  });

  it('the script is plain JavaScript outside the TypeScript build (tsconfig compiles scripts/**/*.ts)', () => {
    // A .ts file under scripts/ would change the build's output layout (dist/main.js to dist/src/main.js)
    // and break `node dist/main`.
    const ts = fs
      .readdirSync(path.join(root, 'scripts'))
      .filter((f) => f.endsWith('.ts'));
    expect(ts).toEqual([]);
    expect(
      execFileSync(process.execPath, [
        '-c',
        path.join(root, 'scripts', 'measure-sensors.js'),
      ]).length
    ).toBe(0);
  });
});
