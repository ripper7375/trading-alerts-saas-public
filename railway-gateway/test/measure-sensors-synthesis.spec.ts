import { spawnSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import type { CycleReplayReport, ReplayDatabase } from '../src/sensors/replay';
import { EnvelopeValidator } from '../src/sensors/envelope-validator';
import {
  CliOptions,
  SensorRowSource,
  SynthesisRowSource,
  USAGE,
  formatReport,
  loadSynthesisRows,
  measureSensors,
  normalizeJob,
  normalizeReplay,
  parseArgs,
  parseInputJson,
  runMeasureCommand,
} from '../src/sensors/measure-sensors';
import { SYNTHESIS_SAMPLE_COLUMNS } from '../src/sensors/measure-synthesis';
import { SynReadingValidator } from '../src/sensors/syn-validator';
import { tableIsMissing } from '../src/sensors/table-missing';
import {
  sampleReady,
  sampleRows,
  slotOf,
} from './helpers/measure-sensors-world';
import {
  DAY,
  SCALPER,
  synJobs,
  synLog,
  synRows,
  synWorld,
} from './helpers/measure-synthesis-world';

/**
 * The SYN part of the measurement kit as `measure-sensors.ts` wires it (build step 4 part 6): the report, its text, the input file, the
 * command line, the read-only database source and the command. `measure-synthesis.spec.ts` holds the arithmetic on the SYN fixture.
 */

const envelopes = new EnvelopeValidator();
const syn = new SynReadingValidator();
const realScan = (text: string): string[] => {
  const check = envelopes.check(text);
  return check.ok ? [] : check.problems;
};
const realSynScan = (text: string): string[] => {
  const check = syn.check(text);
  return check.ok ? [] : check.problems;
};

const opts = (...argv: string[]): CliOptions => {
  const parsed = parseArgs(argv);
  if ('error' in parsed) throw new Error(parsed.error);
  return parsed;
};
const files =
  (map: Record<string, string>) =>
  (file: string): string => {
    if (!(file in map)) throw new Error(`no such file ${file}`);
    return map[file];
  };

const world = () => synWorld();
const fullInput = () => parseInputJson(JSON.stringify(world())).input;

// ====================================================================== the report

describe('measureSensors with SYN', () => {
  it('has no SYN part when nothing of SYN is given: the report of old, with synthesis null', () => {
    const report = measureSensors({ rows: sampleRows() });
    expect(report.synthesis).toBeNull();
    expect(formatReport(report)).not.toContain('SYN (synthesis)');
    expect(
      measureSensors({ rows: sampleRows(), synthesis: null, log: null })
    ).toEqual(report);
  });

  it('measures the SYN rows beside the sensor rows: the no-match cycle that has no inputs gets the states of the sensors’ rows', () => {
    const report = measureSensors(fullInput(), {
      scan: realScan,
      scanSynthesis: realSynScan,
    });
    expect(report.synthesis).toMatchObject({ rows: 13, cycles: 7 });
    expect(
      report.synthesis?.noMatch.map((n) => [n.slot, n.profile, n.sensorsFrom])
    ).toEqual([
      [slotOf(3), DAY, 'READING'],
      [slotOf(4), SCALPER, 'SENSOR_ROWS'],
    ]);
    expect(report.synthesis?.wording.schema).toEqual({
      ran: true,
      scanned: 13,
      failures: 0,
    });
    // the sensor measurement is what it was
    expect(report.rows).toBe(32);
    expect(report.mcds['MCD0'].rows).toBe(8);
  });

  it('is there when only SYN rows are given, when only a log is given, and when only the jobs carry a SYN part', () => {
    const rowsOnly = measureSensors({
      rows: sampleRows(),
      synthesis: synRows(),
    });
    expect(rowsOnly.synthesis?.refusals.given).toEqual({
      log: false,
      jobs: false,
    });
    expect(rowsOnly.synthesis?.refusals.gaps).toBeNull();

    const logOnly = measureSensors({
      rows: sampleRows(),
      log: fullInput().log,
    });
    expect(logOnly.synthesis).toMatchObject({ rows: 0, cycles: 0 });
    expect(logOnly.synthesis?.refusals.log?.readingRefused).toBe(1);
    expect(formatReport(logOnly)).toContain(
      'SYN (synthesis): no SYN rows in the range'
    );
    // the cycles of the log are still found without SYN rows: nothing to be short of
    expect(logOnly.synthesis?.refusals.gaps).toEqual({
      checked: 0,
      explained: 0,
      unexplained: [],
    });

    const jobsOnly = measureSensors({ rows: sampleRows(), jobs: synJobs() });
    expect(jobsOnly.synthesis?.refusals.jobs).toMatchObject({
      written: 8,
      ranSynthesis: 8,
      readingRefused: 1,
    });

    const plainJobs = measureSensors({
      rows: sampleRows(),
      jobs: normalizedPlainJobs(),
    });
    expect(plainJobs.synthesis).toBeNull();
  });

  it('puts the SYN findings after the sensors’, so the first lines of the list are what they always were', () => {
    const without = measureSensors(
      { rows: sampleRows(), ready: sampleReady(), jobs: normalizedPlainJobs() },
      { scan: realScan }
    );
    const report = measureSensors(fullInput(), {
      scan: realScan,
      scanSynthesis: realSynScan,
    });
    expect(report.findings.slice(0, without.findings.length)).toEqual(
      without.findings
    );
    expect(report.findings.slice(without.findings.length)).toEqual([
      "2 SYN reading(s) matched no rule (NO_MATCH): the cycles and the sensors' states are listed",
      'DAY_TRADER: 1 SYN row(s) have zones the engine dropped (guard problems recorded)',
      'SYN readings were refused in 1 cycle(s): 1 in the log, 1 in the job outcomes (see the refusals below)',
      '1 cycle(s) wrote no SYN rows because synthesis stopped or the tables were missing',
    ]);
  });

  describe('the determinism of the SYN readings', () => {
    const replay = [
      {
        slot: slotOf(0),
        verdict: 'VERIFIED',
        cause: null,
        synthesis: { replayed: 2, verified: 2 },
      },
      {
        slot: slotOf(3),
        verdict: 'LOGIC_DIVERGENCE',
        cause: null,
        synthesis: { replayed: 2, verified: 1 },
      },
      { slot: slotOf(6), verdict: 'VERIFIED', cause: null },
    ];

    it('counts the SYN readings the replays compared and how many were VERIFIED', () => {
      const report = measureSensors({ rows: sampleRows(), replay });
      expect(report.determinism.synthesis).toEqual({
        replayed: 4,
        verified: 3,
      });
      expect(report.determinism.verdict).toBe('NOT_DETERMINISTIC');
      expect(formatReport(report)).toContain(
        'SYN readings replayed: 3 of 4 VERIFIED (reading and zones, byte for byte)'
      );
    });

    it('says nothing about SYN for replays of cycles without SYN rows, and counts zero', () => {
      const report = measureSensors({
        rows: sampleRows(),
        replay: [{ slot: 5, verdict: 'VERIFIED', cause: null }],
      });
      expect(report.determinism.synthesis).toEqual({
        replayed: 0,
        verified: 0,
      });
      expect(formatReport(report)).not.toContain('SYN readings replayed');
    });
  });
});

function normalizedPlainJobs() {
  return parseInputJson(
    JSON.stringify({
      rows: sampleRows(),
      jobs: [
        { outcome: 'WRITTEN', slot: slotOf(0), basis: 'INPUTS', wallMs: 250 },
      ],
    })
  ).input.jobs!;
}

// ====================================================================== the text

describe('formatReport: the SYN section', () => {
  const text = formatReport(
    measureSensors(fullInput(), { scan: realScan, scanSynthesis: realSynScan })
  );
  const section = text.slice(
    text.indexOf('SYN (synthesis)'),
    text.indexOf('Findings')
  );

  it('names the rows, the cycles, the slots, the flag and the rules version', () => {
    expect(section).toContain(
      'SYN (synthesis): 13 rows in 7 cycles, slots 2026-09-18T20:55Z to 2026-09-18T21:30Z; flag shadow 13; rules draft-1'
    );
  });

  it('says how many cycles have a row for every trader type, which one is short and which sensor cycle has none', () => {
    expect(section).toContain(
      'rows per cycle: 6 of 7 cycles have a row for every trader type (DAY_TRADER, SCALPER) (6 x 2 rows, 1 x 1 rows)'
    );
    expect(section).toContain('2026-09-18T21:05Z lacks SCALPER');
    expect(section).toContain(
      '1 cycle(s) with sensor rows after the first SYN row have no SYN row at all'
    );
    expect(section).toContain('2026-09-18T21:20Z has no SYN row');
  });

  it('gives each trader type its status mix with the CAUTIONARY share, bias, archetype, data status and reasons', () => {
    expect(section).toContain(
      'DAY_TRADER rows     7   VALID 2 (28.6%)  CAUTIONARY 4 (57.1%)  INVALID 1 (14.3%)  STALE 0 (0.0%)'
    );
    expect(section).toContain(
      'SCALPER    rows     6   VALID 3 (50.0%)  CAUTIONARY 2 (33.3%)  INVALID 1 (16.7%)  STALE 0 (0.0%)'
    );
    expect(section).toContain(
      'bias: LONG 4, NEUTRAL 1, SHORT 1, STAND_ASIDE 1'
    );
    expect(section).toContain('archetype: C 5, NONE 2');
    expect(section).toContain('data status: FRESH 6, STALE 1');
    expect(section).toContain(
      'reasons on readings that are not VALID: MCD0_DEFECT_M5 x 4, PRIMARY_UNAVAILABLE x 1'
    );
  });

  it('prints the rule-hit histogram per trader type, one rule a line, and marks NO_MATCH', () => {
    expect(section).toContain('rule hits (4 rule(s) decided a reading):');
    expect(section).toMatch(/R1_MACRO_COUNTER_TREND_RALLY +4 \(57\.1%\)\n/);
    expect(section).toMatch(
      /NO_MATCH +1 \(14\.3%\) {3}<- no row of the rules table matched/
    );
    expect(section).toMatch(/R3S_TREND_CONTINUATION_M5 +4 \(66\.7%\)\n/);
    expect(section).toContain('rule hits (3 rule(s) decided a reading):');
  });

  it('prints the zones: by reading, why none, dropped by the engine, per cycle, and the cycles without any', () => {
    expect(section).toContain(
      'readings by number of zones: 3 with 0, 1 with 1, 3 with 2 (4 reading(s) have zones); none because NOT_DIRECTIONAL x 2, NO_ZONE_SOURCES x 1'
    );
    expect(section).toContain(
      'readings by number of zones: 3 with 0, 1 with 1, 1 with 2, 1 with 3 (3 reading(s) have zones)'
    );
    expect(section).toContain(
      '1 reading(s) had zones the engine dropped (guard problems recorded)'
    );
    expect(section).toMatch(
      /zones per cycle \(both types\) +7 +0 +2 +4 +4 +4 +1\.9/
    );
    expect(section).toMatch(
      /SYN step per cycle, ms +7 +40 +46 +54 +54 +54 +46\.6/
    );
    expect(section).toContain('cycles without any zone: 2 of 7');
  });

  it('lists every no-match cycle with the states of the sensors, and says where the states come from', () => {
    expect(section).toContain(
      'NO_MATCH: 2 reading(s) matched no rule, with the states of the sensors:'
    );
    expect(section).toContain(
      '2026-09-18T21:10Z DAY_TRADER FRESH  MCD1 VALID MCD1_UP | MCD2 CAUTIONARY MCD2_UP | MCD3 CAUTIONARY MCD3_UP'
    );
    expect(section).toContain(
      "2026-09-18T21:15Z SCALPER    FRESH  MCD0 VALID MCD0_M15_DEFECT | MCD1 CAUTIONARY MCD1_UP | MCD2 VALID MCD2_UP | MCD3 CAUTIONARY MCD3_UP  (from the sensors' rows)"
    );
  });

  it('prints the wording scan and the refusals from the log and from the job outcomes, and what they said', () => {
    expect(section).toContain(
      "wording: 13 reading(s) read; 0 with a '%', 0 with a banned word, 0 with an advice word, 0 with a summary over 80 characters, 0 unreadable; second look against syn-output/1: 13 scanned, 0 fail"
    );
    expect(section).toContain(
      'refusals in the log: 1 reading(s) refused (SCALPER GATEWAY 1), 1 engine error(s), 1 zone set(s) dropped, 0 cycle(s) without the tables, 0 failed table check(s); 5 line(s), 3 distinct'
    );
    expect(section).toContain(
      'refusals in the job outcomes: 1 reading(s) refused (SCALPER GATEWAY 1), 1 engine error(s), 0 cycle(s) without the tables; 8 of 8 written job(s) ran synthesis'
    );
    expect(section).toContain(
      'what the refusals said: entry_zones_rank_and_id: the rank is not the id x 2; synthesis_readings_zones_text_is_its_count_and_hash: the zones text is not its count or its hash x 2'
    );
    expect(section).toContain(
      'cycles with fewer SYN rows than trader types: 2 looked at, 2 explained by a refusal or an engine error, 0 not explained by anything'
    );
  });

  it('says so when no log and no jobs were given, and when the second look was not run', () => {
    const bare = formatReport(
      measureSensors({ rows: sampleRows(), synthesis: synRows() })
    );
    expect(bare).toContain('refusals: no log and no job outcomes given');
    expect(bare).toContain(
      'second look against syn-output/1: not run (no schema scanner)'
    );
  });

  it('lists the gaps nothing explains by name, and the jobs-only caveat', () => {
    const without = fullInput();
    without.log = without.log!.filter((e) => e.kind !== 'ENGINE_ERROR');
    without.jobs = null;
    const t = formatReport(measureSensors(without));
    expect(t).toContain(
      '2 looked at, 1 explained by a refusal or an engine error, 1 not explained by anything'
    );
    expect(t).toContain(
      '2026-09-18T21:20Z has fewer SYN rows and nothing says why'
    );
    const jobsOnly = fullInput();
    jobsOnly.log = null;
    expect(formatReport(measureSensors(jobsOnly))).toContain(
      '(jobs only: just the slots the jobs cover)'
    );
  });

  it('a list of no-match cycles is cut after twenty entries and says how many more', () => {
    const rows = synRows();
    const many = Array.from({ length: 25 }, (_v, i) => ({
      ...rows[5],
      cycle_slot: slotOf(100 + i),
    }));
    const t = formatReport(
      measureSensors({ rows: sampleRows(), synthesis: many })
    );
    expect(t).toContain('NO_MATCH: 25 reading(s) matched no rule');
    expect(t).toContain('... and 5 more');
  });

  it('shows the states as "no sensor state" and "(no sensor rows)" for a no-match cycle nothing describes', () => {
    const rows = synRows().filter((r) => r.rule_id === 'NO_MATCH');
    const t = formatReport(
      measureSensors({
        rows: [],
        synthesis: rows.map((r) => ({ ...r, reading_json: null })),
      })
    );
    expect(t).toContain('(no sensor rows)');
  });
});

// ====================================================================== the input file

describe('the input file with SYN parts', () => {
  const sample = path.join(
    __dirname,
    'fixtures',
    'measure-synthesis-sample.json'
  );

  it('the sample file is the SYN fixture, so the runbook can point at it', () => {
    expect(JSON.parse(fs.readFileSync(sample, 'utf8'))).toEqual(
      JSON.parse(JSON.stringify(world()))
    );
  });

  it('reads the SYN rows, the log (a list of lines) and the SYN part of every job', () => {
    const { input, droppedRows } = parseInputJson(
      fs.readFileSync(sample, 'utf8')
    );
    expect(droppedRows).toBe(0);
    expect(input.synthesis).toEqual(synRows());
    expect(input.log).toHaveLength(5);
    expect(input.log?.map((e) => e.kind)).toEqual([
      'READING_REFUSED',
      'READING_REFUSED',
      'ENGINE_ERROR',
      'ZONES_DROPPED',
      'ZONES_DROPPED',
    ]);
    expect(input.jobs?.[2].synthesis?.refused).toHaveLength(1);
    expect(input.jobs?.[8].synthesis).toBeUndefined();
  });

  it('reads a log given as one text, and treats anything else as no log', () => {
    const asText = parseInputJson(
      JSON.stringify({ rows: [], log: synLog().join('\n') })
    ).input.log;
    expect(asText).toHaveLength(5);
    expect(
      parseInputJson(JSON.stringify({ rows: [], log: 5 })).input.log
    ).toBeNull();
    expect(
      parseInputJson(
        JSON.stringify({ rows: [], log: [1, 'Slot 5: SYN_ENGINE_ERROR x'] })
      ).input.log
    ).toHaveLength(1);
  });

  it('SYN rows that are not an array are not given; rows that cannot be read are left out', () => {
    expect(
      parseInputJson(JSON.stringify({ rows: [], synthesis: {} })).input
        .synthesis
    ).toBeNull();
    const parsed = parseInputJson(
      JSON.stringify({
        rows: [],
        synthesis: [synRows()[0], { profile: 'x' }, 7],
      })
    );
    expect(parsed.input.synthesis).toHaveLength(1);
  });

  it('a bare array of rows has no SYN part', () => {
    const input = parseInputJson(JSON.stringify(sampleRows())).input;
    expect(input.synthesis).toBeNull();
    expect(input.log).toBeNull();
  });

  it('normalizeJob keeps the SYN part of a Bull job, and normalizeReplay counts the profiles of a replay report', () => {
    const synthesis = {
      readingsInserted: 2,
      readingsExisting: 0,
      zonesInserted: 4,
      zonesExisting: 0,
      refused: [],
      error: null,
    };
    expect(
      normalizeJob({ returnvalue: { outcome: 'WRITTEN', slot: 1, synthesis } })
        ?.synthesis
    ).toEqual(synthesis);
    expect(
      normalizeReplay({
        slot: 5,
        verdict: 'LOGIC_DIVERGENCE',
        cause: null,
        synthesis: {
          profiles: [
            { verdict: 'VERIFIED' },
            { verdict: 'VERIFIED' },
            { verdict: 'LOGIC_DIVERGENCE' },
          ],
        },
      })
    ).toEqual({
      slot: 5,
      verdict: 'LOGIC_DIVERGENCE',
      cause: null,
      synthesis: { replayed: 3, verified: 2 },
    });
    expect(
      normalizeReplay({
        slot: 5,
        verdict: 'VERIFIED',
        synthesis: { profiles: [] },
      })
    ).toEqual({ slot: 5, verdict: 'VERIFIED', cause: null });
    expect(
      normalizeReplay({ slot: 5, verdict: 'VERIFIED', synthesis: 'x' })
    ).toEqual({ slot: 5, verdict: 'VERIFIED', cause: null });
  });
});

describe('the command line with --log', () => {
  it('collects every --log file, in order, and needs a path', () => {
    expect(opts('--db', '--log', 'a.log', '--log', 'b.log').logFiles).toEqual([
      'a.log',
      'b.log',
    ]);
    expect(opts('--file', 'x.json', '--log', 'a.log').logFiles).toEqual([
      'a.log',
    ]);
    expect(opts('--db').logFiles).toEqual([]);
    expect(parseArgs(['--db', '--log'])).toEqual({
      error: '--log needs a path',
    });
  });

  it('the usage names --log, the lines it counts, and the SYN table', () => {
    for (const word of [
      '--log',
      'SYN_READING_REFUSED',
      'SYN_ENGINE_ERROR',
      'SYN_ZONES_DROPPED',
      'SYN_TABLES_MISSING',
      'synthesis_readings',
      'logged, not stored',
    ])
      expect(USAGE).toContain(word);
  });
});

// ====================================================================== the database, read only

describe('loadSynthesisRows: read only', () => {
  const source = (rows: unknown[] = synRows(), fail?: unknown) => {
    const calls: unknown[] = [];
    const src: SynthesisRowSource = {
      synthesisReading: {
        findMany: async (args) => {
          calls.push(args);
          if (fail !== undefined) throw fail;
          return rows;
        },
      },
    };
    return { src, calls };
  };

  it('asks for the rows of the slots the sensors cover, oldest first, with a select of exactly the columns it reads', async () => {
    const { src, calls } = source();
    const loaded = await loadSynthesisRows(src, 'XAUUSD', {
      first: slotOf(0),
      last: slotOf(7),
    });
    expect(loaded.missing).toBe(false);
    expect(loaded.rows).toEqual(synRows());
    expect(calls).toEqual([
      {
        where: {
          symbol: 'XAUUSD',
          cycle_slot: { gte: slotOf(0), lte: slotOf(7) },
        },
        orderBy: { cycle_slot: 'asc' },
        select: SYNTHESIS_SAMPLE_COLUMNS,
      },
    ]);
    // the JSONB copy of the reading is not read: the text is the evidence
    expect(SYNTHESIS_SAMPLE_COLUMNS).not.toHaveProperty('reading');
  });

  it('has one method that reads and nothing that writes', () => {
    const { src } = source();
    expect(Object.keys(src)).toEqual(['synthesisReading']);
    expect(Object.keys(src.synthesisReading)).toEqual(['findMany']);
  });

  it('leaves out rows it cannot use', async () => {
    const { src } = source([synRows()[0], null, { cycle_slot: 'x' }]);
    expect(
      (await loadSynthesisRows(src, 'XAUUSD', { first: 0, last: 1 })).rows
    ).toHaveLength(1);
  });

  it.each([
    ['Prisma P2021', { code: 'P2021' }],
    ['PostgreSQL 42P01', { code: '42P01' }],
    ['a message', new Error('relation "synthesis_readings" does not exist')],
  ])(
    'a database without the table (%s) is "missing", not a failure',
    async (_what, error) => {
      const { src } = source([], error);
      expect(
        await loadSynthesisRows(src, 'XAUUSD', { first: 0, last: 1 })
      ).toEqual({ rows: [], missing: true });
    }
  );

  it('any other failed read is a failure and is thrown', async () => {
    const error = new Error('connection lost');
    const { src } = source([], error);
    await expect(
      loadSynthesisRows(src, 'XAUUSD', { first: 0, last: 1 })
    ).rejects.toBe(error);
  });
});

// ====================================================================== the command

describe('runMeasureCommand with SYN', () => {
  function fakeDatabase(
    options: { synthesis?: unknown[]; fail?: unknown; sensors?: boolean } = {}
  ) {
    const calls: Array<[string, unknown]> = [];
    const slots = [...new Set(sampleRows().map((r) => r.cycle_slot))].sort(
      (a, b) => b - a
    );
    const database = {
      mcdOutput: {
        findMany: async (args: { distinct?: unknown }) => {
          calls.push(['mcdOutput', args]);
          if (options.sensors === false) return [];
          return args.distinct
            ? slots.map((cycle_slot) => ({ cycle_slot }))
            : sampleRows();
        },
      },
      marketCycle: { findMany: async () => sampleReady() },
      marketCycleInput: {},
      synthesisReading: {
        findMany: async (args: unknown) => {
          calls.push(['synthesisReading', args]);
          if (options.fail !== undefined) throw options.fail;
          return options.synthesis ?? synRows();
        },
      },
    } as unknown as SensorRowSource & SynthesisRowSource & ReplayDatabase;
    const close = jest.fn(async () => undefined);
    return {
      database,
      close,
      calls,
      openDatabase: async () => ({ database, close }),
    };
  }

  it('--db reads the SYN rows of the range the sensor rows cover and measures them', async () => {
    const db = fakeDatabase();
    const result = await runMeasureCommand(opts('--db'), {
      readFile: files({}),
      openDatabase: db.openDatabase,
      scanSynthesis: realSynScan,
    });
    const syn = db.calls.filter(([name]) => name === 'synthesisReading');
    expect(syn).toHaveLength(1);
    expect(syn[0][1]).toMatchObject({
      where: {
        symbol: 'XAUUSD',
        cycle_slot: { gte: slotOf(0), lte: slotOf(7) },
      },
    });
    expect(result.report.synthesis).toMatchObject({ rows: 13, cycles: 7 });
    expect(result.report.synthesis?.wording.schema.ran).toBe(true);
    expect(db.close).toHaveBeenCalledTimes(1);
    expect(result.text).toContain('SYN (synthesis): 13 rows in 7 cycles');
  });

  it('asks for no SYN rows when there are no sensor rows to say which slots', async () => {
    const db = fakeDatabase({ sensors: false });
    const result = await runMeasureCommand(opts('--db'), {
      readFile: files({}),
      openDatabase: db.openDatabase,
    });
    expect(db.calls.some(([name]) => name === 'synthesisReading')).toBe(false);
    expect(result.report.synthesis).toBeNull();
  });

  it('a database without the SYN table is measured as before, with a finding that says why, and the log is still counted', async () => {
    const db = fakeDatabase({ fail: { code: 'P2021' } });
    const result = await runMeasureCommand(opts('--db', '--log', 'g.log'), {
      readFile: files({ 'g.log': synLog().join('\n') }),
      openDatabase: db.openDatabase,
    });
    expect(result.report.rows).toBe(32);
    const notice =
      'the database has no synthesis_readings table yet (the migration 20261004000000_add_synthesis_tables is not applied): no SYN row could be measured';
    expect(result.report.notices).toEqual([notice]);
    expect(result.report.findings).not.toContain(notice);
    expect(result.text).toContain(
      `Notices (not findings; --strict ignores them):\n  - ${notice}`
    );
    expect(result.report.synthesis).toMatchObject({ rows: 0 });
    expect(result.report.synthesis?.refusals.log?.readingRefused).toBe(1);
    expect(db.close).toHaveBeenCalledTimes(1);
  });

  it('a database without the SYN table and no log has no SYN part, only the finding', async () => {
    const db = fakeDatabase({ fail: { code: 'P2021' } });
    const result = await runMeasureCommand(opts('--db'), {
      readFile: files({}),
      openDatabase: db.openDatabase,
    });
    expect(result.report.synthesis).toBeNull();
    // the sensor fixture has its own findings; the missing table is a notice, and adds none
    expect(
      result.report.findings.filter((f) => /SYN|synthesis/.test(f))
    ).toEqual([]);
    expect(result.report.notices).toHaveLength(1);
  });

  it('any other failed read fails the command, and the database is closed', async () => {
    const db = fakeDatabase({ fail: new Error('connection lost') });
    await expect(
      runMeasureCommand(opts('--db'), {
        readFile: files({}),
        openDatabase: db.openDatabase,
      })
    ).rejects.toThrow('connection lost');
    expect(db.close).toHaveBeenCalledTimes(1);
  });

  it('--log files are read and their events joined, beside the log a --file carries', async () => {
    const json = JSON.stringify({ ...world(), log: [synLog()[3]] });
    const result = await runMeasureCommand(
      opts('--file', 'in.json', '--log', 'a.log', '--log', 'b.log'),
      {
        readFile: files({
          'in.json': json,
          'a.log': synLog()[1],
          'b.log': synLog()[4],
        }),
      }
    );
    // the engine error of the file, the refusal of a.log, the dropped zones of b.log
    expect(result.report.synthesis?.refusals.log).toMatchObject({
      events: 3,
      readingRefused: 1,
      engineErrors: 1,
      zonesDropped: 1,
    });
  });

  it('--file with SYN rows, jobs and a log gives the same report as measuring the parsed input', async () => {
    const json = JSON.stringify(world());
    const result = await runMeasureCommand(opts('--file', 'in.json'), {
      readFile: files({ 'in.json': json }),
      scan: realScan,
      scanSynthesis: realSynScan,
    });
    expect(result.report).toEqual(
      measureSensors(parseInputJson(json).input, {
        scan: realScan,
        scanSynthesis: realSynScan,
      })
    );
    expect(result.exitCode).toBe(0);
  });

  it('--strict exits 1 for a SYN finding alone', async () => {
    // both trader types of one cycle matched no rule: one complete cycle, two NO_MATCH readings, nothing else to find
    const all = synRows();
    const rows = [all[5], { ...all[6], rule_id: 'NO_MATCH' }];
    const json = JSON.stringify({ rows: [], synthesis: rows });
    const result = await runMeasureCommand(
      opts('--file', 'in.json', '--strict'),
      { readFile: files({ 'in.json': json }) }
    );
    expect(result.report.findings).toEqual([
      "2 SYN reading(s) matched no rule (NO_MATCH): the cycles and the sensors' states are listed",
    ]);
    expect(result.exitCode).toBe(1);
  });

  it('--replay carries the SYN readings the replay compared into the determinism part', async () => {
    const db = fakeDatabase();
    const replaySlots = async (
      _d: ReplayDatabase,
      _s: string,
      slots: number[]
    ) =>
      slots.map(
        (slot, k) =>
          ({
            slot,
            verdict: k === 0 ? 'LOGIC_DIVERGENCE' : 'VERIFIED',
            cause: null,
            synthesis: {
              profiles: [
                { verdict: 'VERIFIED' },
                { verdict: k === 0 ? 'LOGIC_DIVERGENCE' : 'VERIFIED' },
              ],
            },
          }) as unknown as CycleReplayReport
      );
    const result = await runMeasureCommand(opts('--db', '--replay', '3'), {
      readFile: files({}),
      openDatabase: db.openDatabase,
      replaySlots,
    });
    expect(result.report.determinism.synthesis).toEqual({
      replayed: 6,
      verified: 5,
    });
    expect(result.text).toContain('SYN readings replayed: 5 of 6 VERIFIED');
  });

  it('--replay leaves the SYN counts out for a cycle with no SYN rows', async () => {
    const db = fakeDatabase();
    const replaySlots = async (
      _d: ReplayDatabase,
      _s: string,
      slots: number[]
    ) =>
      slots.map(
        (slot) =>
          ({
            slot,
            verdict: 'VERIFIED',
            cause: null,
            synthesis: { profiles: [] },
          }) as unknown as CycleReplayReport
      );
    const result = await runMeasureCommand(opts('--db', '--replay', '2'), {
      readFile: files({}),
      openDatabase: db.openDatabase,
      replaySlots,
    });
    expect(result.report.determinism.synthesis).toEqual({
      replayed: 0,
      verified: 0,
    });
  });
});

// ====================================================================== the script

describe('scripts/measure-sensors.js with SYN', () => {
  const root = path.join(__dirname, '..');
  const sample = path.join(
    __dirname,
    'fixtures',
    'measure-synthesis-sample.json'
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
      scanSynthesis: realSynScan,
    });

  it('prints the report for the SYN sample file, exactly as formatReport does, with the real validators as the second look', () => {
    const r = run('--file', sample);
    expect(r.status).toBe(0);
    expect(r.stdout.trimEnd()).toBe(formatReport(expected()));
    expect(r.stdout).toContain(
      'second look against syn-output/1: 13 scanned, 0 fail'
    );
  });

  it('--json carries the SYN part', () => {
    const r = run('--file', sample, '--json');
    expect(r.status).toBe(0);
    const report = JSON.parse(r.stdout) as ReturnType<typeof expected>;
    expect(report.synthesis?.rows).toBe(13);
    expect(report.synthesis?.noMatch).toHaveLength(2);
    expect(report).toEqual(JSON.parse(JSON.stringify(expected())));
  });

  it('--log counts the refusals of a log file given on the command line', () => {
    const tmp = path.join(
      __dirname,
      'fixtures',
      'measure-synthesis-log.tmp.log'
    );
    const noLog = path.join(
      __dirname,
      'fixtures',
      'measure-synthesis-nolog.tmp.json'
    );
    fs.writeFileSync(tmp, synLog().join('\n'));
    fs.writeFileSync(noLog, JSON.stringify({ ...world(), log: undefined }));
    try {
      const without = run('--file', noLog);
      expect(without.stdout).toContain(
        'refusals in the job outcomes: 1 reading(s) refused'
      );
      expect(without.stdout).not.toContain('refusals in the log');
      const withLog = run('--file', noLog, '--log', tmp);
      expect(withLog.status).toBe(0);
      expect(withLog.stdout).toContain(
        'refusals in the log: 1 reading(s) refused (SCALPER GATEWAY 1), 1 engine error(s), 1 zone set(s) dropped'
      );
      const strict = run('--file', noLog, '--log', tmp, '--strict');
      expect(strict.status).toBe(1);
    } finally {
      fs.unlinkSync(tmp);
      fs.unlinkSync(noLog);
    }
  });

  it('a log file that does not exist is an error, not an empty log', () => {
    const r = run(
      '--file',
      sample,
      '--log',
      path.join(__dirname, 'fixtures', 'no-such.log')
    );
    expect(r.status).toBe(1);
    expect(r.stderr).toContain('measure-sensors:');
  });

  it('--help names --log', () => {
    expect(run('--help').stdout.trimEnd()).toBe(USAGE);
  });
});

// ====================================================================== the table that is not there

describe('tableIsMissing', () => {
  it.each([
    [{ code: 'P2021' }],
    [{ code: '42P01' }],
    [
      {
        meta: { driverAdapterError: { cause: { kind: 'TableDoesNotExist' } } },
      },
    ],
    [new Error('relation "synthesis_readings" does not exist')],
    [
      new Error(
        'table public.entry_zones does not exist in the current database'
      ),
    ],
  ])('%j says the table is not there', (error) => {
    expect(tableIsMissing(error)).toBe(true);
  });

  it.each([
    [null],
    [undefined],
    ['relation "x" does not exist'],
    [42],
    [{}],
    [{ code: 'P1001' }],
    [new Error('connection lost')],
    [{ meta: 'x' }],
    [{ meta: { driverAdapterError: { cause: { kind: 'Other' } } } }],
  ])('%j does not', (error) => {
    expect(tableIsMissing(error)).toBe(false);
  });
});
