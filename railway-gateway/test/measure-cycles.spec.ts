import { execFileSync, spawnSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import {
  CYCLE_SAMPLE_COLUMNS,
  CycleRowSource,
  CycleSample,
  DEFAULT_LAST_CYCLES,
  MeasureReport,
  USAGE,
  distribution,
  formatReport,
  loadRows,
  measureCycles,
  normalizeRow,
  parseArgs,
  parseRowsJson,
  percentile,
} from '../src/cycle/measure-cycles';
import { FIRST_SLOT, sampleRows } from './helpers/measure-world';

/**
 * The measurement kit (build step 2 part 10). Every number below is worked out by
 * hand from the table in test/helpers/measure-world.ts; the working is in the
 * comments, so a failure says which arithmetic is wrong, the code or the table.
 */

describe('percentile (nearest rank)', () => {
  const v = [15, 20, 35, 40, 50];

  it('is the value at rank ceil(p / 100 * n), counting from 1', () => {
    expect(percentile(v, 30)).toBe(20); // ceil(1.5) = 2
    expect(percentile(v, 40)).toBe(20); // ceil(2.0) = 2: an exact rank is that rank, not the next
    expect(percentile(v, 50)).toBe(35); // ceil(2.5) = 3
    expect(percentile(v, 90)).toBe(50); // ceil(4.5) = 5
    expect(percentile(v, 100)).toBe(50);
  });

  it('never goes below rank 1 or above rank n', () => {
    expect(percentile(v, 0)).toBe(15);
    expect(percentile(v, 1)).toBe(15);
    expect(percentile(v, 99.99)).toBe(50);
    expect(percentile(v, 250)).toBe(50);
  });

  it('is the one value for one value, and null for none', () => {
    expect(percentile([7], 50)).toBe(7);
    expect(percentile([7], 99)).toBe(7);
    expect(percentile([], 50)).toBeNull();
  });
});

describe('distribution', () => {
  it('is null for no values', () => {
    expect(distribution([])).toBeNull();
  });

  it('sorts a copy: the input keeps its order and the result does not depend on it', () => {
    const input = [30, 10, 20];
    expect(distribution(input)).toEqual(distribution([10, 20, 30]));
    expect(input).toEqual([30, 10, 20]);
  });

  it('gives count, min, p50, p90, p99, max, mean and how many are below 0', () => {
    expect(distribution([-4, 0, 2, 6])).toEqual({
      count: 4,
      min: -4,
      p50: 0, // rank ceil(2) = 2
      p90: 6, // rank ceil(3.6) = 4
      p99: 6,
      max: 6,
      mean: 1, // 4 / 4
      negative: 1,
    });
  });

  it('one value is every percentile', () => {
    expect(distribution([42])).toEqual({
      count: 1,
      min: 42,
      p50: 42,
      p90: 42,
      p99: 42,
      max: 42,
      mean: 42,
      negative: 0,
    });
  });

  it('on 1 to 100 the percentiles are 50, 90 and 99: p99 is not p98 (they only differ from 51 values up)', () => {
    const d = distribution(Array.from({ length: 100 }, (_, i) => i + 1))!;
    expect([d.p50, d.p90, d.p99]).toEqual([50, 90, 99]);
    expect([d.min, d.max, d.mean, d.count]).toEqual([1, 100, 50.5, 100]);
  });

  it('counts only values below zero as negative (zero is not)', () => {
    expect(distribution([0, 0, 0])!.negative).toBe(0);
    expect(distribution([-1, -1, 0])!.negative).toBe(2);
  });
});

describe('measureCycles on the twelve-row fixture', () => {
  // computed in a hook, not in the describe body: a throw there would fail the
  // whole suite at load time instead of failing the tests that depend on it
  let report: MeasureReport;
  beforeAll(() => {
    report = measureCycles(sampleRows());
  });

  it('counts the cycles and finds the slots they span', () => {
    expect(report.cycles).toBe(12);
    expect(report.skipped).toBe(0);
    expect(report.firstSlot).toBe(FIRST_SLOT);
    expect(report.lastSlot).toBe(FIRST_SLOT + 3300); // 11 slots of 300 s after the first
  });

  it('splits the cycles into FRESH, DELAYED, INCOMPLETE and PENDING, and counts RETUNING on top', () => {
    expect(report.status).toEqual({
      FRESH: 9, // rows 0 to 8
      DELAYED: 1, // row 9
      INCOMPLETE: 1, // row 10
      PENDING: 1, // row 11
      RETUNING: 4, // rows 3, 4, 5 and 11: the flag overlaps the other four
    });
  });

  it('slot to ready: ready_at - slot over the ten READY cycles', () => {
    // 60 62 64 66 68 70 72 74 76 200, sum 812
    expect(report.slotToReady).toEqual({
      count: 10,
      min: 60,
      p50: 68, // rank ceil(5.0) = 5
      p90: 76, // rank ceil(9.0) = 9
      p99: 200, // rank ceil(9.9) = 10
      max: 200,
      mean: 81.2,
      negative: 0,
    });
  });

  it('ingestion delay: manifest_received_at - slot over all twelve cycles, READY or not', () => {
    // sorted: 59 60 61 63 64 67 68 71 72 75 130 190, sum 980
    expect(report.ingestionDelay).toEqual({
      count: 12,
      min: 59,
      p50: 67, // rank 6
      p90: 130, // rank ceil(10.8) = 11
      p99: 190, // rank ceil(11.88) = 12
      max: 190,
      mean: 980 / 12,
      negative: 0,
    });
  });

  it('gateway processing: ready_at - manifest_received_at over the READY cycles only', () => {
    // slot to ready minus ingestion, per row: 1 2 1 2 1 2 1 2 1 10 -> sorted 1 1 1 1 1 2 2 2 2 10
    expect(report.gatewayProcessing).toEqual({
      count: 10,
      min: 1,
      p50: 1, // rank 5
      p90: 2, // rank 9
      p99: 10,
      max: 10,
      mean: 2.3, // (5 + 8 + 10) / 10
      negative: 0,
    });
  });

  it('newest bar age at the slot, M5: slot - newest bar open, on every cycle', () => {
    // nine 0 (rows 0 to 6, 10, 11) and three 300 (rows 7, 8, 9)
    expect(report.newestBarAge.M5).toEqual({
      count: 12,
      min: 0,
      p50: 0, // rank 6
      p90: 300, // rank 11
      p99: 300,
      max: 300,
      mean: 75, // 900 / 12
      negative: 0,
    });
    expect(report.newestBarAgeValues.M5).toEqual([
      { value: 0, count: 9 },
      { value: 300, count: 3 },
    ]);
  });

  it('newest bar age, M15: only the refresh slots (rows 1, 4, 7, 10) have one', () => {
    // 0 0 300 0 -> sorted 0 0 0 300
    expect(report.newestBarAge.M15).toEqual({
      count: 4,
      min: 0,
      p50: 0, // rank 2
      p90: 300, // rank ceil(3.6) = 4
      p99: 300,
      max: 300,
      mean: 75,
      negative: 0,
    });
    expect(report.newestBarAgeValues.M15).toEqual([
      { value: 0, count: 3 },
      { value: 300, count: 1 },
    ]);
  });

  it('export lag: when the M5 export was written against the slot, and how many were before it', () => {
    // sorted: -1 -1 -1 2 3 3 3 4 4 5 5 6, sum 32
    expect(report.exportLag).toEqual({
      count: 12,
      min: -1,
      p50: 3, // rank 6
      p90: 5, // rank 11
      p99: 6,
      max: 6,
      mean: 32 / 12,
      negative: 3, // rows 0, 5, 10
    });
  });

  it('collector: validated after the slot (one clock), and the manifest after validation (two clocks)', () => {
    // validated after slot: 20 22 ... 42
    expect(report.collector.validatedAfterSlot).toEqual({
      count: 12,
      min: 20,
      p50: 30, // rank 6
      p90: 40, // rank 11
      p99: 42,
      max: 42,
      mean: 31, // (20 + 42) / 2
      negative: 0,
    });
    // recv - valid per row: 39 38 39 38 39 38 39 38 39 152 90 19
    // sorted: 19 38 38 38 38 39 39 39 39 39 90 152, sum 608
    expect(report.collector.manifestAfterValidated).toEqual({
      count: 12,
      min: 19,
      p50: 39, // rank 6
      p90: 90, // rank 11
      p99: 152,
      max: 152,
      mean: 608 / 12,
      negative: 0,
    });
  });

  it('checks the READY cycles against the ADR-012 deadlines by the attempts they needed', () => {
    // one attempt: rows 0 to 7 and 9 (60 62 64 66 68 70 72 74 200), the deadline is 120 s: 8 within
    expect(report.deadlines.firstTry).toEqual({
      deadlineSec: 120,
      count: 9,
      within: 8,
      over: 1,
      shareWithin: 8 / 9,
    });
    // two attempts: row 8 (76 s), the deadline is 240 s
    expect(report.deadlines.retried).toEqual({
      deadlineSec: 240,
      count: 1,
      within: 1,
      over: 0,
      shareWithin: 1,
    });
  });

  it('RETUNING: rows 3 to 5 are one episode of 900 s, row 11 another of 300 s, and it is still on', () => {
    expect(report.retuning).toEqual({
      cycles: 4,
      episodes: 2,
      episodeSeconds: {
        count: 2,
        min: 300,
        p50: 300, // rank 1
        p90: 900, // rank 2
        p99: 900,
        max: 900,
        mean: 600,
        negative: 0,
      },
      open: true,
    });
  });

  it('cycles by terminal', () => {
    expect(report.terminals).toEqual({ 'MT5-A': 3, 'MT5-B': 9 });
  });

  it('does not depend on the order the rows arrive in, and does not change them', () => {
    const rows = sampleRows().reverse();
    const before = JSON.stringify(rows);
    expect(measureCycles(rows)).toEqual(report);
    expect(JSON.stringify(rows)).toBe(before);
  });
});

describe('measureCycles at the edges', () => {
  it('has nothing to say about no cycles, and still prints', () => {
    const r = measureCycles([]);
    expect(r.cycles).toBe(0);
    expect(r.firstSlot).toBeNull();
    expect(r.lastSlot).toBeNull();
    expect(r.slotToReady).toBeNull();
    expect(r.retuning).toEqual({
      cycles: 0,
      episodes: 0,
      episodeSeconds: null,
      open: false,
    });
    expect(r.deadlines.firstTry.shareWithin).toBeNull();
    expect(() => formatReport(r)).not.toThrow();
  });

  it('skips a row with no numeric slot and says how many', () => {
    const rows = [
      ...sampleRows().slice(0, 3),
      { ...sampleRows()[3], slot: Number.NaN },
      { ...sampleRows()[4], slot: null as unknown as number },
    ];
    const r = measureCycles(rows);
    expect(r.cycles).toBe(3);
    expect(r.skipped).toBe(2);
  });

  it('a READY row without ready_at is not part of any READY measure', () => {
    const rows = sampleRows();
    rows[0] = { ...rows[0], ready_at: null };
    const r = measureCycles(rows);
    expect(r.slotToReady!.count).toBe(9);
    expect(r.gatewayProcessing!.count).toBe(9);
    expect(r.status.FRESH).toBe(8);
  });

  it('a negative duration is counted as negative (a clock behind, or an export before the slot)', () => {
    const rows = sampleRows();
    rows[2] = { ...rows[2], manifest_received_at: rows[2].slot - 5 };
    expect(measureCycles(rows).ingestionDelay!.negative).toBe(1);
    expect(measureCycles(rows).ingestionDelay!.min).toBe(-5);
  });

  it('missing values drop out of a measure instead of counting as zero', () => {
    const rows = sampleRows().map((r) => ({
      ...r,
      m5_newest_bar_ts: null,
      m5_export_at: null,
    }));
    const r = measureCycles(rows);
    expect(r.newestBarAge.M5).toBeNull();
    expect(r.exportLag).toBeNull();
    expect(r.newestBarAgeValues.M5).toEqual([]);
    expect(r.slotToReady!.count).toBe(10);
  });

  it('a row with no attempts count is in neither deadline group', () => {
    const rows = sampleRows();
    rows[0] = { ...rows[0], attempts: null };
    const r = measureCycles(rows);
    expect(r.deadlines.firstTry.count).toBe(8);
    expect(r.deadlines.retried.count).toBe(1);
  });

  it('counts INCOMPLETE and PENDING separately (unequal counts, so swapping them shows)', () => {
    const rows = [
      ...sampleRows(), // one INCOMPLETE, one PENDING
      { ...sampleRows()[10], slot: FIRST_SLOT + 300 * 12 }, // a second INCOMPLETE
    ];
    const r = measureCycles(rows);
    expect(r.status.INCOMPLETE).toBe(2);
    expect(r.status.PENDING).toBe(1);
  });

  describe('the newest-bar ages by value', () => {
    const withAges = (ages: number[]): CycleSample[] =>
      ages.map((age, k) => ({
        ...sampleRows()[0],
        slot: FIRST_SLOT + 300 * k,
        m5_newest_bar_ts: FIRST_SLOT + 300 * k - age,
      }));

    it('most common first, and on a tie the smaller value first', () => {
      // 300 arrives first, so only an explicit tie-break puts 0 before it
      expect(
        measureCycles(withAges([300, 300, 0, 0, 900])).newestBarAgeValues.M5
      ).toEqual([
        { value: 0, count: 2 },
        { value: 300, count: 2 },
        { value: 900, count: 1 },
      ]);
    });

    it('lists at most eight values: ten distinct ones give the first eight', () => {
      const values = measureCycles(
        withAges([0, 1, 2, 3, 4, 5, 6, 7, 8, 9])
      ).newestBarAgeValues.M5.map((v) => v.value);
      expect(values).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
    });
  });

  it('lists the terminals in name order, whatever order the rows come in', () => {
    const rows = sampleRows().map((r, k) => ({
      ...r,
      terminal_id: k < 2 ? 'MT5-B' : 'MT5-A', // MT5-B is met first
    }));
    expect(Object.keys(measureCycles(rows).terminals)).toEqual([
      'MT5-B',
      'MT5-A',
    ]); // the report object keeps first-seen order
    expect(formatReport(measureCycles(rows))).toContain(
      'Cycles by terminal: MT5-A 10, MT5-B 2'
    );
  });

  it('a row with no terminal is counted as "unknown"', () => {
    const rows = sampleRows();
    rows[0] = { ...rows[0], terminal_id: null };
    expect(measureCycles(rows).terminals).toEqual({
      unknown: 1,
      'MT5-A': 2,
      'MT5-B': 9,
    });
  });

  it('uses the thresholds it is given, not only the ones in force', () => {
    const r = measureCycles(sampleRows(), {
      readyDeadlineSec: 65,
      readyDeadlineWithRetriesSec: 70,
      staleAfterSec: 600,
    });
    // first-try values 60 62 64 66 ... : those at or below 65 are 60, 62 and 64
    expect(r.deadlines.firstTry).toMatchObject({
      deadlineSec: 65,
      within: 3,
      over: 6,
    });
    expect(r.deadlines.retried).toMatchObject({
      deadlineSec: 70,
      within: 0,
      over: 1,
    }); // 76 s is over 70
  });

  it('a value exactly at the deadline is within it', () => {
    const rows = sampleRows();
    const r = measureCycles(rows, {
      readyDeadlineSec: 64,
      readyDeadlineWithRetriesSec: 76,
      staleAfterSec: 600,
    });
    expect(r.deadlines.firstTry.within).toBe(3); // 60 62 64
    expect(r.deadlines.retried.within).toBe(1); // 76
  });

  it('uses the ADR-012 starting values by default (2 min, 4 min with retries)', () => {
    const r = measureCycles([]);
    expect(r.deadlines.firstTry.deadlineSec).toBe(120);
    expect(r.deadlines.retried.deadlineSec).toBe(240);
  });

  describe('RETUNING episodes', () => {
    const at = (k: number, retuning: boolean): CycleSample => ({
      ...sampleRows()[0],
      slot: FIRST_SLOT + 300 * k,
      retuning,
    });
    const episodes = (flags: boolean[]) =>
      measureCycles(flags.map((f, k) => at(k, f))).retuning;

    it('none when no cycle is RETUNING', () => {
      expect(episodes([false, false, false])).toEqual({
        cycles: 0,
        episodes: 0,
        episodeSeconds: null,
        open: false,
      });
    });

    it('one cycle is an episode of one slot', () => {
      const r = episodes([false, true, false]);
      expect(r.episodes).toBe(1);
      expect(r.episodeSeconds!.max).toBe(300);
      expect(r.open).toBe(false);
    });

    it('a run is one episode, and a gap between runs makes two', () => {
      const r = episodes([true, true, true, false, true, true]);
      expect(r.episodes).toBe(2);
      expect(r.cycles).toBe(5);
      expect(r.episodeSeconds).toMatchObject({ min: 600, max: 900 });
      expect(r.open).toBe(true);
    });

    it('a run that ends before the newest cycle is not open', () => {
      expect(episodes([true, true, false]).open).toBe(false);
    });

    it('a stretch with no rows between two flagged ones (a weekend) stays one episode and counts the whole stretch', () => {
      const rows = [
        { ...at(0, true) },
        { ...at(1, true) },
        { ...at(500, true) },
      ];
      const r = measureCycles(rows).retuning;
      expect(r.episodes).toBe(1);
      expect(r.episodeSeconds!.max).toBe(300 * 500 + 300);
    });
  });
});

describe('formatReport', () => {
  let text: string;
  beforeAll(() => {
    text = formatReport(measureCycles(sampleRows()));
  });

  it('says how many cycles, which slots and how they split', () => {
    // FIRST_SLOT 1789764900 is 2026-09-18T20:55:00Z; the last is 55 minutes later
    expect(text).toContain(
      'Cycle measurement: 12 cycles, slots 2026-09-18T20:55:00Z to 2026-09-18T21:50:00Z'
    );
    expect(text).toMatch(
      /Status: FRESH 9, DELAYED 1, INCOMPLETE 1, PENDING 1; RETUNING 4 \(overlaps the others\)/
    );
  });

  it('prints each distribution on one line with its count, percentiles and mean', () => {
    const cells = (label: string) =>
      (text.match(new RegExp(`^${label}\\s+(.*)$`, 'm')) ?? [])[1]
        ?.trim()
        .split(/\s+/);
    expect(cells('slot to ready \\(READY\\)')).toEqual([
      '10',
      '60',
      '68',
      '76',
      '200',
      '200',
      '81.2',
    ]);
    expect(cells('slot to manifest received')?.slice(0, 6)).toEqual([
      '12',
      '59',
      '67',
      '130',
      '190',
      '190',
    ]);
    expect(cells('gateway: received to ready')).toEqual([
      '10',
      '1',
      '1',
      '2',
      '10',
      '10',
      '2.3',
    ]);
    expect(cells('newest M5 bar age at the slot')?.slice(0, 6)).toEqual([
      '12',
      '0',
      '0',
      '300',
      '300',
      '300',
    ]);
  });

  it('flags a measure with values below zero', () => {
    expect(text).toMatch(/^M5 export written, vs slot .*\(3 below 0\)$/m);
    expect(text).not.toMatch(/^slot to ready \(READY\).*below 0/m);
  });

  it('prints the newest-bar ages by value, which is what settles the stub question', () => {
    expect(text).toContain('0 s x 9, 300 s x 3');
    expect(text).toContain('0 s x 3, 300 s x 1');
    expect(text).toContain('the stub of the bar that just opened');
  });

  it('prints the ADR-012 deadlines with the share within them', () => {
    expect(text).toContain('deadline 120 s: 8 of 9 within (88.9%), 1 over');
    expect(text).toContain('deadline 240 s: 1 of 1 within (100.0%), 0 over');
  });

  it('prints RETUNING episodes and the terminals', () => {
    expect(text).toContain(
      'RETUNING: 4 cycles in 2 episodes, the newest cycle is still RETUNING'
    );
    expect(text).toContain('Cycles by terminal: MT5-A 3, MT5-B 9');
  });

  it('names the cycles it skipped', () => {
    const r = measureCycles([
      ...sampleRows(),
      { ...sampleRows()[0], slot: Number.NaN },
    ]);
    expect(formatReport(r)).toContain('(1 rows without a slot skipped)');
  });
});

describe('normalizeRow and parseRowsJson', () => {
  const good = sampleRows()[1];

  it('keeps a well-formed row exactly', () => {
    expect(normalizeRow(JSON.parse(JSON.stringify(good)))).toEqual(good);
  });

  it('turns anything that is not a number into null, and anything but true into not RETUNING', () => {
    const r = normalizeRow({
      slot: 600,
      state: 7,
      ready_at: '123',
      manifest_received_at: Number.NaN,
      retuning: 'yes',
      attempts: null,
      terminal_id: 5,
    })!;
    expect(r.state).toBe('UNKNOWN');
    expect(r.ready_at).toBeNull();
    expect(r.manifest_received_at).toBeNull();
    expect(r.retuning).toBe(false);
    expect(r.attempts).toBeNull();
    expect(r.terminal_id).toBeNull();
  });

  it('rejects what has no numeric slot', () => {
    for (const bad of [null, 5, 'x', [], {}, { slot: '600' }]) {
      expect(normalizeRow(bad)).toBeNull();
    }
  });

  it('reads an array of rows, or an object with a rows array, and drops rows without a slot', () => {
    const rows = [good, { state: 'READY' }, 7];
    expect(parseRowsJson(JSON.stringify(rows))).toEqual([good]);
    expect(parseRowsJson(JSON.stringify({ rows }))).toEqual([good]);
  });

  it('says what is wrong with an input that is not rows', () => {
    expect(() => parseRowsJson('{nope')).toThrow(/not valid JSON/);
    expect(() => parseRowsJson('{"a": 1}')).toThrow(
      /array of market_cycles rows/
    );
    expect(() => parseRowsJson('42')).toThrow(/array of market_cycles rows/);
    expect(() => parseRowsJson('null')).toThrow(/array of market_cycles rows/);
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

  it('has defaults: XAUUSD, text output, no bounds', () => {
    expect(parseArgs(['--db'])).toEqual({
      help: false,
      file: null,
      db: true,
      symbol: 'XAUUSD',
      since: null,
      until: null,
      last: null,
      json: false,
    });
  });

  it('reads every option', () => {
    expect(
      parseArgs([
        '--file',
        'cycles.json',
        '--symbol',
        'EURUSD',
        '--since',
        '1790985600',
        '--until',
        '2026-10-04T00:00:00Z',
        '--last',
        '100',
        '--json',
      ])
    ).toEqual({
      help: false,
      file: 'cycles.json',
      db: false,
      symbol: 'EURUSD',
      since: 1790985600,
      until: 1790985600 + 86400,
      last: 100,
      json: true,
    });
  });

  it('reads an ISO date as unix seconds: 2026-10-03T00:00:00Z is 1790985600', () => {
    const o = parseArgs(['--db', '--since', '2026-10-03T00:00:00Z']);
    expect((o as { since: number }).since).toBe(1790985600);
  });

  it('refuses what it cannot read, with a reason', () => {
    expect(parseArgs(['--db', '--since', 'yesterday'])).toEqual({
      error: '--since needs unix seconds or an ISO date',
    });
    expect(parseArgs(['--db', '--until'])).toEqual({
      error: '--until needs unix seconds or an ISO date',
    });
    expect(parseArgs(['--db', '--last', '0'])).toEqual({
      error: '--last needs a positive whole number',
    });
    expect(parseArgs(['--db', '--last', '1.5'])).toEqual({
      error: '--last needs a positive whole number',
    });
    expect(parseArgs(['--db', '--last'])).toEqual({
      error: '--last needs a positive whole number',
    });
    expect(parseArgs(['--file'])).toEqual({ error: '--file needs a path' });
    expect(parseArgs(['--db', '--symbol'])).toEqual({
      error: '--symbol needs a symbol',
    });
    expect(parseArgs(['--db', '--frobnicate'])).toEqual({
      error: 'unknown argument --frobnicate',
    });
    expect(parseArgs(['--db', '--since', '200', '--until', '100'])).toEqual({
      error: '--since is after --until',
    });
  });

  it('accepts --since equal to --until', () => {
    expect(
      parseArgs(['--db', '--since', '100', '--until', '100'])
    ).toMatchObject({
      since: 100,
      until: 100,
    });
  });

  it('--help needs nothing else', () => {
    expect(parseArgs(['--help'])).toMatchObject({ help: true });
    expect(parseArgs(['-h'])).toMatchObject({ help: true });
  });
});

describe('loadRows: read only', () => {
  /** A source that records the one call it allows; `marketCycle` has no other method. */
  function source(rows: unknown[]) {
    const calls: unknown[] = [];
    const src: CycleRowSource = {
      marketCycle: {
        findMany: async (args) => {
          calls.push(args);
          return rows;
        },
      },
    };
    return { src, calls };
  }
  const newestFirst = () => sampleRows().reverse();
  const defaults = { symbol: 'XAUUSD', since: null, until: null, last: null };

  it('asks for the newest 576 cycles of the symbol when no bound is given, and hands them back oldest first', async () => {
    const { src, calls } = source(newestFirst());
    const rows = await loadRows(src, defaults);
    expect(calls).toEqual([
      {
        where: { symbol: 'XAUUSD' },
        orderBy: { slot: 'desc' },
        take: DEFAULT_LAST_CYCLES,
        select: CYCLE_SAMPLE_COLUMNS,
      },
    ]);
    expect(DEFAULT_LAST_CYCLES).toBe(576);
    expect(rows.map((r) => r.slot)).toEqual(sampleRows().map((r) => r.slot));
  });

  it('asks for the symbol it is given, not a fixed one', async () => {
    const { src, calls } = source([]);
    await loadRows(src, { ...defaults, symbol: 'EURUSD', last: 3 });
    expect(calls[0]).toMatchObject({ where: { symbol: 'EURUSD' }, take: 3 });
    await loadRows(src, { ...defaults, symbol: 'EURUSD', since: 100 });
    expect(calls[1]).toMatchObject({
      where: { symbol: 'EURUSD', slot: { gte: 100 } },
    });
  });

  it('--last sets the count', async () => {
    const { src, calls } = source([]);
    await loadRows(src, { ...defaults, last: 10 });
    expect(calls[0]).toMatchObject({ take: 10 });
  });

  it('--since and --until bound the slot, and take everything in the range', async () => {
    const { src, calls } = source([]);
    await loadRows(src, { ...defaults, since: 100, until: 900 });
    expect(calls[0]).toEqual({
      where: { symbol: 'XAUUSD', slot: { gte: 100, lte: 900 } },
      orderBy: { slot: 'desc' },
      select: CYCLE_SAMPLE_COLUMNS,
    });
  });

  it('one bound alone is only that bound', async () => {
    const a = source([]);
    await loadRows(a.src, { ...defaults, since: 100 });
    expect(a.calls[0]).toMatchObject({
      where: { symbol: 'XAUUSD', slot: { gte: 100 } },
    });
    const b = source([]);
    await loadRows(b.src, { ...defaults, until: 900 });
    expect(b.calls[0]).toMatchObject({
      where: { symbol: 'XAUUSD', slot: { lte: 900 } },
    });
    expect('take' in (a.calls[0] as object)).toBe(false);
  });

  it('a range and --last together: the newest N of the range', async () => {
    const { src, calls } = source([]);
    await loadRows(src, { ...defaults, since: 100, last: 5 });
    expect(calls[0]).toMatchObject({
      where: { slot: { gte: 100 } },
      take: 5,
    });
  });

  it('selects exactly the columns the kit reads, and no others', () => {
    expect(Object.keys(CYCLE_SAMPLE_COLUMNS).sort()).toEqual(
      Object.keys(sampleRows()[0]).sort()
    );
    expect(Object.values(CYCLE_SAMPLE_COLUMNS).every((v) => v === true)).toBe(
      true
    );
  });

  it('drops rows it cannot read', async () => {
    const { src } = source([null, { state: 'READY' }, ...newestFirst()]);
    expect(await loadRows(src, defaults)).toHaveLength(12);
  });

  it('exposes no way to write: the source type has findMany and nothing else', () => {
    const { src } = source([]);
    expect(Object.keys(src)).toEqual(['marketCycle']);
    expect(Object.keys(src.marketCycle)).toEqual(['findMany']);
  });
});

describe('the sample file and the command line', () => {
  const root = path.join(__dirname, '..');
  const sample = path.join(__dirname, 'fixtures', 'measure-cycles-sample.json');
  const run = (...args: string[]) =>
    spawnSync(
      process.execPath,
      [path.join(root, 'scripts', 'measure-cycles.js'), ...args],
      { cwd: root, encoding: 'utf8', env: { ...process.env, DATABASE_URL: '' } }
    );

  it('the sample file is the fixture, so the runbook can point at it', () => {
    expect(JSON.parse(fs.readFileSync(sample, 'utf8'))).toEqual(sampleRows());
  });

  it('prints the report for a file, exactly as formatReport does', () => {
    const r = run('--file', sample);
    expect(r.status).toBe(0);
    expect(r.stdout.trimEnd()).toBe(formatReport(measureCycles(sampleRows())));
  });

  it('--json prints the report as JSON', () => {
    const r = run('--file', sample, '--json');
    expect(r.status).toBe(0);
    expect(JSON.parse(r.stdout)).toEqual(
      JSON.parse(JSON.stringify(measureCycles(sampleRows())))
    );
  });

  it('a symbol that is not in the file leaves nothing to measure', () => {
    const r = run('--file', sample, '--symbol', 'EURUSD');
    expect(r.status).toBe(0);
    expect(r.stdout).toContain('Cycle measurement: 0 cycles');
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
    const tmp = path.join(__dirname, 'fixtures', 'measure-cycles-bad.tmp.json');
    fs.writeFileSync(tmp, '{"x": 1}');
    try {
      const r = run('--file', tmp);
      expect(r.status).toBe(1);
      expect(r.stderr).toContain('array of market_cycles rows');
    } finally {
      fs.unlinkSync(tmp);
    }
  });

  it('the script is plain JavaScript outside the TypeScript build (tsconfig compiles scripts/**/*.ts)', () => {
    // A .ts file under scripts/ would change the build's output layout
    // (dist/main.js to dist/src/main.js) and break `node dist/main`.
    const ts = fs
      .readdirSync(path.join(root, 'scripts'))
      .filter((f) => f.endsWith('.ts'));
    expect(ts).toEqual([]);
    expect(
      execFileSync(process.execPath, [
        '-c',
        path.join(root, 'scripts', 'measure-cycles.js'),
      ]).length
    ).toBe(0);
  });
});
