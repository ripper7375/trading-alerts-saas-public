import { spawnSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { Logger } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { SynthesisRunResult } from '../src/sensors/cycle-run-result';
import { EnvelopeValidator } from '../src/sensors/envelope-validator';
import { STATUSES, normalizeJob } from '../src/sensors/measure-sensors';
import {
  ADVICE_WORDS,
  BANNED_INFLECTIONS,
  BANNED_WORDS,
  NO_MATCH,
  SUMMARY_MAX_CHARS,
  SYN_PROFILES,
  SYN_STATUSES,
  SYNTHESIS_SAMPLE_COLUMNS,
  SynthesisJob,
  SynthesisSample,
  adviceIn,
  bannedIn,
  bannedInCode,
  measureSynthesis,
  normalizeSynthesisJob,
  normalizeSynthesisRow,
  parseSynthesisLog,
  synthesisFindings,
} from '../src/sensors/measure-synthesis';
import { McdOutputsWriter } from '../src/sensors/mcd-outputs.writer';
import { SynReadingValidator } from '../src/sensors/syn-validator';
import { SynthesisWriter } from '../src/sensors/synthesis.writer';
import { PrismaService } from '../src/prisma/prisma.service';
import { ENGINE_DIR, FIXTURE_SLOTS } from './helpers/cycle-fixtures';
import { sampleRows } from './helpers/measure-sensors-world';
import {
  DAY,
  REFUSAL_PROBLEMS,
  SCALPER,
  SYN_CASES,
  K3_INPUTS,
  readingText,
  slotOf,
  synJobs,
  synLog,
  synRows,
} from './helpers/measure-synthesis-world';
import { pythonAvailable } from './helpers/kit-runner';
import {
  FakeSensorPrisma,
  unitResultWithSynthesis,
} from './helpers/sensors-worker-world';

const validator = new SynReadingValidator();
const realScan = (text: string): string[] => {
  const check = validator.check(text);
  return check.ok ? [] : check.problems;
};

const jobsOf = (): SynthesisJob[] =>
  synJobs().map((j) => ({
    slot: j.slot,
    synthesis: j.synthesis ?? null,
    written: j.outcome === 'WRITTEN',
  }));
const events = () => parseSynthesisLog(synLog().join('\n'));

const measure = (
  over: Partial<Parameters<typeof measureSynthesis>[0]> = {},
  scan: ((t: string) => string[]) | null = realScan
) =>
  measureSynthesis(
    {
      rows: synRows(),
      sensorRows: sampleRows(),
      jobs: jobsOf(),
      log: events(),
      ...over,
    },
    { scan }
  );

/** The world's rows with one reading's JSON changed. */
function withReadingChange(
  index: number,
  change: (reading: Record<string, unknown>) => void
): SynthesisSample[] {
  const rows = synRows();
  const reading = JSON.parse(rows[index].reading_json as string) as Record<
    string,
    unknown
  >;
  change(reading);
  rows[index] = { ...rows[index], reading_json: JSON.stringify(reading) };
  return rows;
}

// ====================================================================== constants

describe('the constants are the Python worker’s', () => {
  const py = (file: string): string =>
    fs.readFileSync(path.join(ENGINE_DIR, ...file.split('/')), 'utf8');

  it('the four statuses are the sensors’ four', () => {
    expect([...SYN_STATUSES]).toEqual([...STATUSES]);
  });

  it('the two trader types and the no-match rule id are those of rules.py', () => {
    const rules = py('mcd_worker/synthesis/rules.py');
    expect(rules).toMatch(/^DAY_TRADER, SCALPER = "DAY_TRADER", "SCALPER"$/m);
    expect(rules).toMatch(/^PROFILES = \(DAY_TRADER, SCALPER\)$/m);
    expect(rules).toMatch(/^NO_MATCH_ID = "NO_MATCH"$/m);
    expect([...SYN_PROFILES]).toEqual(['DAY_TRADER', 'SCALPER']);
    expect(NO_MATCH).toBe('NO_MATCH');
  });

  it('the banned words, their inflections, the advice words and the summary length are those of wording.py', () => {
    const wording = py('mcd_common/wording.py');
    const quoted = (text: string): string[] =>
      [...text.matchAll(/"([A-Z_]+)"/g)].map((m) => m[1]);
    const banned = /BANNED_WORDS = \(([^)]*)\)/.exec(wording);
    expect(quoted(banned![1])).toEqual([...BANNED_WORDS]);
    const advice = /ADVICE_WORDS = \(([^)]*)\)/.exec(wording);
    expect(quoted(advice![1])).toEqual([...ADVICE_WORDS]);
    const block =
      /BANNED_INFLECTIONS: Mapping\[str, tuple\[str, \.\.\.\]\] = MappingProxyType\(\s*\{([\s\S]*?)\}\s*\)/.exec(
        wording
      );
    const inflections: Record<string, string[]> = {};
    for (const m of block![1].matchAll(/"([A-Z_]+)":\s*\(([^)]*)\)/g))
      inflections[m[1]] = quoted(m[2]);
    expect(BANNED_INFLECTIONS).toEqual(inflections);
    expect(Number(/SUMMARY_MAX_CHARS = (\d+)/.exec(wording)![1])).toBe(
      SUMMARY_MAX_CHARS
    );
  });

  const pythonSuite = pythonAvailable() ? describe : describe.skip;
  pythonSuite('the word checks give Python’s answers on a corpus', () => {
    const TEXTS = [
      'A safe and sure thing',
      'This is safely done and surely so',
      'Upgrade the gradient, a gradual measure under pressure',
      'The grade was graded and grading continues',
      'He is confident, with conviction and convictions',
      'Probability and probabilities, but probably likely',
      'A strong buy or a strong sell, even a STRONG_BUYS list',
      'high conviction and HIGH-CONVICTION',
      'Guaranteed, guarantee, guarantees and guaranteeing',
      'You may buy, sell, take profit, hold or see an opportunity',
      'Buyers and sellers hold the line; holdings differ',
      'take-profit and TAKE_PROFIT and take profit',
      'No problem here',
      '',
      'safeguard and safety are allowed',
    ];
    const CODES = [
      'MCD1_UP',
      'R1_SAFE_RALLY',
      'R1_SAFELY_DONE',
      'R2_UPGRADE',
      'R9_HIGH_CONVICTION',
      'R3_BUY_OPPORTUNITY',
      'BREACH_UP',
      'PRIMARY_SURE_THING',
    ];
    it('banned words in a text, advice words in a text, banned words in a code', () => {
      const script = [
        'import json, sys',
        `sys.path.insert(0, ${JSON.stringify(ENGINE_DIR)})`,
        'from mcd_common import wording',
        'data = json.load(sys.stdin)',
        'print(json.dumps({"banned": [wording.banned_in_text(t) for t in data["texts"]],',
        ' "advice": [wording.advice_in_text(t) for t in data["texts"]],',
        ' "code": [wording.banned_in_code(c) for c in data["codes"]]}))',
      ].join('\n');
      const run = spawnSync(
        process.env['SENSOR_PYTHON'] ?? 'python',
        ['-c', script],
        {
          input: JSON.stringify({ texts: TEXTS, codes: CODES }),
          encoding: 'utf8',
        }
      );
      expect(run.status).toBe(0);
      const python = JSON.parse(run.stdout) as {
        banned: string[][];
        advice: string[][];
        code: string[][];
      };
      expect(TEXTS.map(bannedIn)).toEqual(python.banned);
      expect(TEXTS.map(adviceIn)).toEqual(python.advice);
      expect(CODES.map(bannedInCode)).toEqual(python.code);
      // the corpus has hits and non-hits on every side, so the equality means something
      expect(python.banned.flat().length).toBeGreaterThan(8);
      expect(python.advice.flat().length).toBeGreaterThan(4);
      expect(python.code.flat().length).toBeGreaterThan(2);
    });
  });
});

// ====================================================================== normalizing

describe('normalizeSynthesisRow', () => {
  it('reads a row of synthesis_readings', () => {
    const [row] = synRows();
    expect(normalizeSynthesisRow(JSON.parse(JSON.stringify(row)))).toEqual(row);
  });

  it('asks for exactly the columns it reads', () => {
    const row = synRows()[0];
    const keys = Object.keys(SYNTHESIS_SAMPLE_COLUMNS).sort();
    expect(keys).toEqual(Object.keys(row).sort());
  });

  it('needs a numeric slot and a trader type, and fills the rest with UNKNOWN or empty', () => {
    expect(normalizeSynthesisRow(null)).toBeNull();
    expect(normalizeSynthesisRow([])).toBeNull();
    expect(normalizeSynthesisRow({ cycle_slot: '5', profile: DAY })).toBeNull();
    expect(normalizeSynthesisRow({ cycle_slot: 300, profile: '' })).toBeNull();
    expect(normalizeSynthesisRow({ cycle_slot: 300 })).toBeNull();
    expect(normalizeSynthesisRow({ cycle_slot: 300, profile: DAY })).toEqual({
      symbol: null,
      cycle_slot: 300,
      profile: DAY,
      flag: 'UNKNOWN',
      rules_version: 'UNKNOWN',
      rule_id: 'UNKNOWN',
      branch_id: null,
      status: 'UNKNOWN',
      status_reasons: [],
      data_status: 'UNKNOWN',
      archetype: null,
      bias: 'UNKNOWN',
      trend_relation: null,
      stand_aside: false,
      zone_count: 0,
      zones_reason: null,
      guard_problems: [],
      duration_ms: null,
      evaluated_at: null,
      reading_json: null,
    });
  });
});

describe('normalizeSynthesisJob and the SYN part of a job outcome', () => {
  it('reads the summary the writer returns, refused readings included', () => {
    expect(
      normalizeSynthesisJob({
        readingsInserted: 1,
        readingsExisting: 2,
        zonesInserted: 3,
        zonesExisting: 4,
        refused: [
          { profile: SCALPER, source: 'GATEWAY', problems: ['x'] },
          'junk',
        ],
        error: 'SYN_TABLES_MISSING',
      })
    ).toEqual({
      readingsInserted: 1,
      readingsExisting: 2,
      zonesInserted: 3,
      zonesExisting: 4,
      refused: [{ profile: SCALPER, source: 'GATEWAY', problems: ['x'] }],
      error: 'SYN_TABLES_MISSING',
    });
  });

  it('is null for what is not an object, and zero and empty for what is missing', () => {
    expect(normalizeSynthesisJob(undefined)).toBeNull();
    expect(normalizeSynthesisJob('x')).toBeNull();
    expect(normalizeSynthesisJob({})).toEqual({
      readingsInserted: 0,
      readingsExisting: 0,
      zonesInserted: 0,
      zonesExisting: 0,
      refused: [],
      error: null,
    });
  });

  it('normalizeJob keeps the SYN part of a Bull job’s return value, and adds nothing to an outcome without one', () => {
    const [first, , third] = synJobs();
    expect(
      normalizeJob({ returnvalue: { ...first, synthesis: first.synthesis } })
        ?.synthesis
    ).toEqual(first.synthesis);
    expect(normalizeJob({ outcome: 'WRITTEN', slot: 5 })).not.toHaveProperty(
      'synthesis'
    );
    expect(third.synthesis?.refused).toHaveLength(1);
  });
});

// ====================================================================== the log

describe('parseSynthesisLog', () => {
  it('finds the five kinds, with slot, trader type, source and the rest of the line', () => {
    const found = parseSynthesisLog(
      [
        `Slot 300: SYN_READING_REFUSED DAY_TRADER (ENGINE): DAY_TRADER: the engine withheld the reading; WORDING: x contains '%'`,
        `Slot 600: SYN_READING_REFUSED ALL (GATEWAY): synthesis.readings must be a list`,
        `Slot 900: SYN_ENGINE_ERROR synthesis raised in the engine (SYNTHESIS_ERROR); no SYN rows written`,
        `Slot 1200: SYN_ZONES_DROPPED SCALPER reading written, some zones dropped by the engine: ZONES: Z2: x`,
        `Slot 1500: SYN_TABLES_MISSING the tables synthesis_readings and entry_zones are not there`,
        `Slot 1800: SYN_TABLES_CHECK_FAILED could not ask whether the SYN tables exist: connection reset`,
      ].join('\n')
    );
    expect(found).toEqual([
      {
        kind: 'READING_REFUSED',
        slot: 300,
        profile: 'DAY_TRADER',
        source: 'ENGINE',
        detail: `DAY_TRADER: the engine withheld the reading; WORDING: x contains '%'`,
      },
      {
        kind: 'READING_REFUSED',
        slot: 600,
        profile: 'ALL',
        source: 'GATEWAY',
        detail: 'synthesis.readings must be a list',
      },
      {
        kind: 'ENGINE_ERROR',
        slot: 900,
        profile: null,
        source: null,
        detail:
          'synthesis raised in the engine (SYNTHESIS_ERROR); no SYN rows written',
      },
      {
        kind: 'ZONES_DROPPED',
        slot: 1200,
        profile: 'SCALPER',
        source: null,
        detail:
          'reading written, some zones dropped by the engine: ZONES: Z2: x',
      },
      {
        kind: 'TABLES_MISSING',
        slot: 1500,
        profile: null,
        source: null,
        detail: 'the tables synthesis_readings and entry_zones are not there',
      },
      {
        kind: 'TABLES_CHECK_FAILED',
        slot: 1800,
        profile: null,
        source: null,
        detail: 'could not ask whether the SYN tables exist: connection reset',
      },
    ]);
  });

  it('finds a line behind Nest’s prefix, behind a timestamp, and inside Railway’s JSON, and ignores every other line', () => {
    const found = parseSynthesisLog(
      [
        '[Nest] 1  - 10/04/2026, 8:05:00 PM   ERROR [SynthesisWriter] Slot 300: SYN_ENGINE_ERROR x',
        JSON.stringify({
          level: 'error',
          message: 'Slot 600: SYN_ENGINE_ERROR y',
        }),
        JSON.stringify({ msg: 'Slot 900: SYN_ENGINE_ERROR z' }),
        '{"message": 5}',
        '{not json SYN_ENGINE_ERROR',
        'Slot 1200 written; SYN 2 readings and 4 zones new',
        'SYN_UNKNOWN_KIND Slot 1',
        '',
      ].join('\r\n')
    );
    expect(found.map((e) => [e.kind, e.slot, e.detail])).toEqual([
      ['ENGINE_ERROR', 300, 'x'],
      ['ENGINE_ERROR', 600, 'y'],
      ['ENGINE_ERROR', 900, 'z'],
    ]);
  });

  it('a line without a slot is still counted, with no slot', () => {
    expect(parseSynthesisLog('SYN_TABLES_CHECK_FAILED could not ask')).toEqual([
      {
        kind: 'TABLES_CHECK_FAILED',
        slot: null,
        profile: null,
        source: null,
        detail: 'could not ask',
      },
    ]);
  });

  describe('is held to what the gateway really writes', () => {
    let lines: string[];
    let outcomes: SynthesisJob[];
    const [V1, V3, V4] = FIXTURE_SLOTS;

    /** One cycle written by the real writer, on its own database stand-in; its log lines are kept and the outcome it returns is parsed like Bull's. */
    async function written(
      fixture: (typeof FIXTURE_SLOTS)[number],
      change: (section: SynthesisRunResult) => void = () => undefined,
      prisma: FakeSensorPrisma = new FakeSensorPrisma()
    ): Promise<void> {
      const moduleRef = await Test.createTestingModule({
        providers: [
          { provide: PrismaService, useValue: prisma },
          EnvelopeValidator,
          SynReadingValidator,
          SynthesisWriter,
          McdOutputsWriter,
        ],
      }).compile();
      const summary = await moduleRef.get(McdOutputsWriter).writeCycle({
        symbol: 'XAUUSD',
        slot: fixture.slot,
        result: unitResultWithSynthesis(fixture, change),
        evaluatedAt: fixture.slot + 31,
      });
      const job = normalizeJob({
        returnvalue: {
          outcome: 'WRITTEN',
          slot: fixture.slot,
          basis: 'INPUTS',
          wallMs: 1,
          ...summary,
        },
      });
      outcomes.push({
        slot: fixture.slot,
        synthesis: job?.synthesis ?? null,
        written: true,
      });
    }

    beforeAll(async () => {
      lines = [];
      outcomes = [];
      const capture = (...args: unknown[]): void => {
        lines.push(String(args[0]));
      };
      jest.spyOn(Logger.prototype, 'error').mockImplementation(capture);
      jest.spyOn(Logger.prototype, 'warn').mockImplementation(capture);
      jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
      type Section = {
        error: string | null;
        readings: Array<Record<string, unknown>>;
      };
      // a reading the gateway's own checks refuse
      await written(V1, ((s: Section) => {
        s.readings[0]['zones_sha256'] = '0'.repeat(64);
      }) as never);
      // a reading the engine withheld
      await written(V3, ((s: Section) => {
        s.readings[1]['reading_json'] = null;
        s.readings[1]['reading_sha256'] = null;
        s.readings[1]['guard_problems'] = ['WORDING: x'];
      }) as never);
      // synthesis stopped in the engine
      await written(V4, ((s: Section) => {
        s.error = 'SYNTHESIS_ERROR';
        s.readings = [];
      }) as never);
      // zones the engine dropped, the reading written
      await written(V1, ((s: Section) => {
        s.readings[0]['guard_problems'] = [
          'ZONES: Z3: the stop distance is under 13',
        ];
      }) as never);
      // a section that is not a section
      await written(V3, ((s: { readings: unknown }) => {
        s.readings = 'nope';
      }) as never);
      // the tables are not there
      const gone = new FakeSensorPrisma();
      gone.synthesisTablesExist = false;
      await written(V1, undefined, gone);
      // and the question cannot be asked
      const broken = new FakeSensorPrisma();
      broken.tableCheckError = new Error('connection reset');
      await written(V3, undefined, broken);
      jest.restoreAllMocks();
    });

    it('the writers’ own error and warning lines parse into the kinds they are written as, with their slots; a failed table check names no slot', () => {
      const found = parseSynthesisLog(lines.join('\n'));
      const count = (kind: string): number =>
        found.filter((e) => e.kind === kind).length;
      expect(count('READING_REFUSED')).toBe(3);
      expect(count('ENGINE_ERROR')).toBe(1);
      expect(count('ZONES_DROPPED')).toBe(1);
      expect(count('TABLES_MISSING')).toBe(2);
      expect(count('TABLES_CHECK_FAILED')).toBe(1);
      expect(found.filter((e) => e.slot === null).map((e) => e.kind)).toEqual([
        'TABLES_CHECK_FAILED',
      ]);
      const refused = found.filter((e) => e.kind === 'READING_REFUSED');
      expect(refused.map((e) => [e.slot, e.profile, e.source])).toEqual([
        [V1.slot, 'DAY_TRADER', 'GATEWAY'],
        [V3.slot, 'SCALPER', 'ENGINE'],
        [V3.slot, 'ALL', 'GATEWAY'],
      ]);
      expect(refused[1].detail).toContain('the engine withheld the reading');
      expect(found.find((e) => e.kind === 'ENGINE_ERROR')).toMatchObject({
        slot: V4.slot,
      });
      expect(found.find((e) => e.kind === 'ZONES_DROPPED')).toMatchObject({
        slot: V1.slot,
        profile: 'DAY_TRADER',
      });
    });

    it('the outcome a cycle returns carries the same facts, and counting the log and counting the outcomes agree', () => {
      const m = measureSynthesis({
        rows: [],
        sensorRows: [],
        jobs: outcomes,
        log: parseSynthesisLog(lines.join('\n')),
      });
      expect(m.refusals.log).toMatchObject({
        readingRefused: 3,
        engineErrors: 1,
        zonesDropped: 1,
        tablesMissing: 2,
        tablesCheckFailed: 1,
      });
      expect(m.refusals.jobs).toMatchObject({
        written: 7,
        ranSynthesis: 7,
        readingRefused: 3,
        engineErrors: 1,
        tablesMissing: 2,
      });
      expect(m.refusals.log?.byProfileSource).toEqual({
        'ALL GATEWAY': 1,
        'DAY_TRADER GATEWAY': 1,
        'SCALPER ENGINE': 1,
      });
      expect(m.refusals.jobs?.byProfileSource).toEqual(
        m.refusals.log?.byProfileSource
      );
      expect(m.refusals.refusedCycles).toEqual([V1.slot, V3.slot]);
      expect(m.refusals.stoppedCycles).toEqual([V1.slot, V3.slot, V4.slot]);
      expect(m.refusals.unplaced).toBe(0);
    });
  });
});

// ====================================================================== the world, by hand

describe('measureSynthesis on the thirteen SYN rows of the eight cycles', () => {
  const m = measure();

  it('13 rows in 7 cycles (k5 has none), all shadow, all draft-1, slots k0 to k7', () => {
    expect(m).toMatchObject({
      rows: 13,
      cycles: 7,
      firstSlot: slotOf(0),
      lastSlot: slotOf(7),
    });
    expect(m.flags).toEqual({ shadow: 13, live: 0, other: 0 });
    expect(m.rulesVersions).toEqual(['draft-1']);
  });

  it('rows per cycle: six cycles have both trader types, k2 lacks SCALPER, and k5 has a sensor cycle and no SYN row', () => {
    expect(m.rowsPerCycle).toEqual({
      expected: [DAY, SCALPER],
      cycles: 7,
      byRowCount: [
        { value: 2, count: 6 },
        { value: 1, count: 1 },
      ],
      complete: 6,
      short: 1,
      shortCycles: [{ slot: slotOf(2), have: [DAY], missing: [SCALPER] }],
      sensorCyclesWithoutSyn: [slotOf(5)],
      unexpectedRows: 0,
    });
  });

  it('DAY_TRADER: 7 rows; VALID 2 (k0, k3), CAUTIONARY 4 (k1, k2, k4, k7), INVALID 1 (k6): the CAUTIONARY share is 4 of 7', () => {
    const day = m.profiles[DAY];
    expect(day.rows).toBe(7);
    expect(day.status).toEqual({
      VALID: 2,
      CAUTIONARY: 4,
      INVALID: 1,
      STALE: 0,
      other: 0,
    });
    expect(day.share.CAUTIONARY).toBeCloseTo(4 / 7, 10);
    expect(day.share.VALID).toBeCloseTo(2 / 7, 10);
    expect(day.share.other).toBe(0);
  });

  it('SCALPER: 6 rows; VALID 3 (k0, k4, k7), CAUTIONARY 2 (k1, k3), INVALID 1 (k6): the CAUTIONARY share is 2 of 6', () => {
    const s = m.profiles[SCALPER];
    expect(s.rows).toBe(6);
    expect(s.status).toEqual({
      VALID: 3,
      CAUTIONARY: 2,
      INVALID: 1,
      STALE: 0,
      other: 0,
    });
    expect(s.share.CAUTIONARY).toBeCloseTo(1 / 3, 10);
  });

  it('the rule-hit histogram per trader type: most frequent first, equal counts by id, NO_MATCH among them', () => {
    expect(m.profiles[DAY].ruleHits.map((r) => [r.ruleId, r.count])).toEqual([
      ['R1_MACRO_COUNTER_TREND_RALLY', 4],
      ['NO_MATCH', 1],
      ['R0_DATA_CHECK', 1],
      ['R2_EXHAUSTION_SNAPBACK', 1],
    ]);
    expect(m.profiles[DAY].ruleHits[0].share).toBeCloseTo(4 / 7, 10);
    expect(
      m.profiles[SCALPER].ruleHits.map((r) => [r.ruleId, r.count])
    ).toEqual([
      ['R3S_TREND_CONTINUATION_M5', 4],
      ['NO_MATCH', 1],
      ['R0_DATA_CHECK', 1],
    ]);
    expect(m.profiles[DAY].noMatch).toBe(1);
    expect(m.profiles[SCALPER].noMatch).toBe(1);
  });

  it('bias, archetype and data status are counted, a reading with no direction under archetype NONE', () => {
    expect(m.profiles[DAY].bias).toEqual({
      LONG: 4,
      NEUTRAL: 1,
      SHORT: 1,
      STAND_ASIDE: 1,
    });
    expect(m.profiles[DAY].archetype).toEqual({ C: 5, NONE: 2 });
    expect(m.profiles[DAY].dataStatus).toEqual({ FRESH: 6, STALE: 1 });
    expect(m.profiles[SCALPER].bias).toEqual({
      LONG: 4,
      NEUTRAL: 1,
      STAND_ASIDE: 1,
    });
    expect(m.profiles[SCALPER].archetype).toEqual({ C: 4, NONE: 2 });
    expect(m.profiles[SCALPER].dataStatus).toEqual({ FRESH: 5, STALE: 1 });
  });

  it('the reasons on readings that are not VALID are counted, most common first', () => {
    expect(m.profiles[DAY].topReasons).toEqual([
      { code: 'MCD0_DEFECT_M5', count: 4 },
      { code: 'PRIMARY_UNAVAILABLE', count: 1 },
    ]);
    expect(m.profiles[SCALPER].topReasons).toEqual([
      { code: 'MCD0_DEFECT_M5', count: 2 },
      { code: 'PRIMARY_UNAVAILABLE', count: 1 },
    ]);
  });

  it('every no-match cycle, with the states of the sensors: from the reading’s own inputs (k3), or from the sensors’ rows when it has none (k4)', () => {
    expect(m.noMatch).toEqual([
      {
        slot: slotOf(3),
        profile: DAY,
        dataStatus: 'FRESH',
        sensors: Object.fromEntries(
          Object.entries(K3_INPUTS).map(([id, s]) => [
            id,
            `${s.status} ${s.state_code}`,
          ])
        ),
        sensorsFrom: 'READING',
      },
      {
        slot: slotOf(4),
        profile: SCALPER,
        dataStatus: 'FRESH',
        sensors: {
          MCD0: 'VALID MCD0_M15_DEFECT',
          MCD1: 'CAUTIONARY MCD1_UP',
          MCD2: 'VALID MCD2_UP',
          MCD3: 'CAUTIONARY MCD3_UP',
        },
        sensorsFrom: 'SENSOR_ROWS',
      },
    ]);
  });

  it('a no-match cycle with neither inputs nor sensor rows is listed with no states, and says so', () => {
    const r = measure({ sensorRows: [] });
    expect(r.noMatch[1]).toMatchObject({
      slot: slotOf(4),
      sensors: {},
      sensorsFrom: 'NONE',
    });
    expect(r.noMatch[0].sensorsFrom).toBe('READING');
  });

  it('zones per reading: how many readings have 0, 1, 2 or 3 zones, and why the others have none', () => {
    expect(m.profiles[DAY].zoneHistogram).toEqual([
      { value: 0, count: 3 },
      { value: 1, count: 1 },
      { value: 2, count: 3 },
    ]);
    expect(m.profiles[DAY].withZones).toBe(4);
    expect(m.profiles[DAY].zonesReasons).toEqual([
      { code: 'NOT_DIRECTIONAL', count: 2 },
      { code: 'NO_ZONE_SOURCES', count: 1 },
    ]);
    expect(m.profiles[SCALPER].zoneHistogram).toEqual([
      { value: 0, count: 3 },
      { value: 1, count: 1 },
      { value: 2, count: 1 },
      { value: 3, count: 1 },
    ]);
    expect(m.profiles[SCALPER].withZones).toBe(3);
    expect(m.profiles[SCALPER].zonesReasons).toEqual(
      m.profiles[DAY].zonesReasons
    );
  });

  it('zones per cycle, both trader types together: 4 1 0 3 2 0 3, so two cycles have none', () => {
    // sorted 0 0 1 2 3 3 4; nearest-rank p50 is the 4th value, p90 and p99 the 7th
    expect(m.zonesPerCycle).toEqual({
      count: 7,
      min: 0,
      p50: 2,
      p90: 4,
      p99: 4,
      max: 4,
      mean: 13 / 7,
      negative: 0,
    });
    expect(m.cyclesWithoutZones).toBe(2);
  });

  it('the readings with zones the engine dropped: k7 DAY_TRADER', () => {
    expect(m.profiles[DAY].guardRows).toBe(1);
    expect(m.profiles[SCALPER].guardRows).toBe(0);
  });

  it('the time of the SYN step is one figure per cycle (both rows carry the same): 40 42 44 46 48 52 54', () => {
    expect(m.durationMs).toEqual({
      count: 7,
      min: 40,
      p50: 46,
      p90: 54,
      p99: 54,
      max: 54,
      mean: 326 / 7,
      negative: 0,
    });
  });

  it('every reading is clean: no %, no banned or advice word, a short summary, and all 13 pass syn-output/1 on the second look', () => {
    expect(m.wording).toEqual({
      scanned: 13,
      unreadable: 0,
      percent: 0,
      banned: 0,
      advice: 0,
      summaryTooLong: 0,
      schema: { ran: true, scanned: 13, failures: 0 },
      examples: [],
    });
  });

  describe('the refusals, counted from the log and from the job outcomes', () => {
    it('the log: 5 lines, 3 distinct events (the retry and the JSON copy are not new events): one refused reading, one engine error, one zone set dropped', () => {
      expect(m.refusals.log).toEqual({
        events: 5,
        distinct: 3,
        readingRefused: 1,
        engineErrors: 1,
        zonesDropped: 1,
        tablesMissing: 0,
        tablesCheckFailed: 0,
        byProfileSource: { 'SCALPER GATEWAY': 1 },
      });
    });

    it('the outcomes: 8 written jobs ran synthesis; one refused SCALPER (GATEWAY), one stopped in the engine', () => {
      expect(m.refusals.jobs).toEqual({
        written: 8,
        ranSynthesis: 8,
        readingRefused: 1,
        engineErrors: 1,
        tablesMissing: 0,
        byProfileSource: { 'SCALPER GATEWAY': 1 },
      });
    });

    it('what the refusals said: each problem is counted without its trader type prefix, once per source', () => {
      expect(m.refusals.topProblems).toEqual([
        { code: 'entry_zones_rank_and_id: the rank is not the id', count: 2 },
        {
          code: 'synthesis_readings_zones_text_is_its_count_and_hash: the zones text is not its count or its hash',
          count: 2,
        },
      ]);
      expect(REFUSAL_PROBLEMS).toHaveLength(2);
    });

    it('the cycles: k2 had a reading refused, k5 wrote no SYN rows, and both are explained', () => {
      expect(m.refusals.refusedCycles).toEqual([slotOf(2)]);
      expect(m.refusals.stoppedCycles).toEqual([slotOf(5)]);
      expect(m.refusals.unplaced).toBe(0);
      expect(m.refusals.gaps).toEqual({
        checked: 2,
        explained: 2,
        unexplained: [],
      });
    });

    it('with the log alone, or the outcomes alone, the same two gaps are explained', () => {
      expect(measure({ jobs: null }).refusals.gaps).toEqual({
        checked: 2,
        explained: 2,
        unexplained: [],
      });
      expect(measure({ log: null }).refusals.gaps).toEqual({
        checked: 2,
        explained: 2,
        unexplained: [],
      });
      expect(measure({ log: null }).refusals.log).toBeNull();
      expect(measure({ jobs: null }).refusals.jobs).toBeNull();
    });

    it('without either, nothing can be said about gaps (null), and nothing is invented', () => {
      const r = measure({ jobs: null, log: null }).refusals;
      expect(r).toMatchObject({
        given: { log: false, jobs: false },
        log: null,
        jobs: null,
        gaps: null,
        topProblems: [],
      });
      expect(r.refusedCycles).toEqual([]);
    });

    it('a gap no line and no outcome explains is named: the log without the line about k5', () => {
      const without = events().filter((e) => e.kind !== 'ENGINE_ERROR');
      const r = measure({ jobs: null, log: without }).refusals;
      expect(r.gaps).toEqual({
        checked: 2,
        explained: 1,
        unexplained: [slotOf(5)],
      });
    });

    it('with outcomes only, only the slots the jobs cover are looked at: jobs from k3 on do not judge k2', () => {
      const late = jobsOf().filter(
        (j) => j.slot !== null && j.slot >= slotOf(3)
      );
      const r = measure({ log: null, jobs: late }).refusals;
      expect(r.gaps).toEqual({ checked: 1, explained: 1, unexplained: [] });
      expect(r.refusedCycles).toEqual([]);
      const none = measure({ log: null, jobs: [] }).refusals;
      expect(none.gaps).toEqual({ checked: 0, explained: 0, unexplained: [] });
    });

    it('skipped jobs and jobs of a cycle written with SYN off say nothing about SYN', () => {
      const jobs: SynthesisJob[] = [
        { slot: slotOf(1), synthesis: null, written: true },
        { slot: slotOf(2), synthesis: null, written: false },
      ];
      const r = measure({ log: null, jobs }).refusals;
      expect(r.jobs).toMatchObject({
        written: 1,
        ranSynthesis: 0,
        readingRefused: 0,
      });
    });

    it('a missing table is its own count, in the log and in the outcomes, and a log line with no slot is counted but not placed', () => {
      const log = parseSynthesisLog(
        [
          `Slot ${slotOf(2)}: SYN_TABLES_MISSING x`,
          'SYN_TABLES_CHECK_FAILED y',
          'SYN_ENGINE_ERROR z',
        ].join('\n')
      );
      const jobs: SynthesisJob[] = [
        {
          slot: slotOf(3),
          written: true,
          synthesis: {
            readingsInserted: 0,
            readingsExisting: 0,
            zonesInserted: 0,
            zonesExisting: 0,
            refused: [],
            error: 'SYN_TABLES_MISSING',
          },
        },
      ];
      const r = measure({ log, jobs }).refusals;
      expect(r.log).toMatchObject({
        tablesMissing: 1,
        tablesCheckFailed: 1,
        engineErrors: 1,
      });
      expect(r.jobs).toMatchObject({ tablesMissing: 1, engineErrors: 0 });
      expect(r.stoppedCycles).toEqual([slotOf(2), slotOf(3)]);
      // the failed table check is always beside a TABLES_MISSING line that has a slot, so only the engine error is unplaced
      expect(r.unplaced).toBe(1);
    });
  });
});

// ====================================================================== the edges

describe('measureSynthesis at the edges', () => {
  it('no rows: a measurement of nothing, not an error', () => {
    const m = measureSynthesis({
      rows: [],
      sensorRows: [],
      jobs: null,
      log: null,
    });
    expect(m).toMatchObject({
      rows: 0,
      cycles: 0,
      firstSlot: null,
      lastSlot: null,
      profiles: {},
      noMatch: [],
      zonesPerCycle: null,
      durationMs: null,
      cyclesWithoutZones: 0,
    });
    expect(m.rowsPerCycle).toMatchObject({
      cycles: 0,
      complete: 0,
      short: 0,
      sensorCyclesWithoutSyn: [],
    });
    expect(m.wording).toMatchObject({ scanned: 0, schema: { ran: false } });
    expect(synthesisFindings(m)).toEqual([]);
  });

  it('sensor cycles before the first SYN row are not "without SYN": SYN was off then', () => {
    const rows = synRows().filter((r) => r.cycle_slot >= slotOf(3));
    const m = measure({ rows });
    expect(m.rowsPerCycle.sensorCyclesWithoutSyn).toEqual([slotOf(5)]);
    expect(m.rowsPerCycle.cycles).toBe(4);
  });

  it('a different set of expected trader types is honoured, and a row of another type is unexpected', () => {
    const m = measureSynthesis(
      { rows: synRows(), sensorRows: [], jobs: null, log: null },
      { expectedProfiles: [DAY] }
    );
    expect(m.rowsPerCycle).toMatchObject({
      expected: [DAY],
      complete: 7,
      short: 0,
      unexpectedRows: 6,
    });
    expect(synthesisFindings(m)).toContain(
      '6 SYN row(s) belong to a trader type that is not expected'
    );
  });

  it('a status outside the four and a flag that is neither shadow nor live are counted apart and found', () => {
    const rows = synRows();
    rows[0] = { ...rows[0], status: 'BROKEN', flag: 'off' };
    rows[1] = { ...rows[1], flag: 'live' };
    const m = measure({ rows });
    expect(m.profiles[DAY].status).toMatchObject({ other: 1, VALID: 1 });
    expect(m.flags).toEqual({ shadow: 11, live: 1, other: 1 });
    const found = synthesisFindings(m);
    expect(found).toContain(
      'DAY_TRADER: 1 SYN row(s) have a status outside VALID, CAUTIONARY, INVALID, STALE'
    );
    expect(found).toContain(
      '1 SYN row(s) have a flag that is neither shadow nor live'
    );
  });

  it('rows without a numeric slot or a trader type are left out, not counted as zero', () => {
    const rows = synRows();
    const junk = { ...rows[0], cycle_slot: Number.NaN } as SynthesisSample;
    expect(measure({ rows: [...rows, junk] }).rows).toBe(13);
  });

  describe('the wording scan', () => {
    it('a % in a reason is found, with the reading to open', () => {
      const m = measure({
        rows: withReadingChange(0, (r) => {
          r['reasons'] = ['It held 80% of the time'];
        }),
      });
      expect(m.wording).toMatchObject({
        scanned: 13,
        percent: 1,
        banned: 0,
        advice: 0,
      });
      expect(m.wording.examples).toEqual([
        { slot: slotOf(0), profile: DAY, problem: "a '%' in a free text" },
      ]);
    });

    it('a banned word in a text, an inflection of one, and one in the rule id are each found once per reading', () => {
      expect(
        measure({
          rows: withReadingChange(0, (r) => {
            r['reasons'] = ['A safe setup'];
          }),
        }).wording.banned
      ).toBe(1);
      expect(
        measure({
          rows: withReadingChange(0, (r) => {
            r['reasons'] = ['Safely long, with confidence'];
          }),
        }).wording.banned
      ).toBe(1);
      const m = measure({
        rows: withReadingChange(0, (r) => {
          r['rule_id'] = 'R9_HIGH_CONVICTION';
        }),
      });
      expect(m.wording.banned).toBe(1);
      // the id is checked as a code: CONVICTION is a whole part of it, as is HIGH_CONVICTION
      expect(m.wording.examples[0].problem).toBe(
        'banned word CONVICTION, HIGH_CONVICTION'
      );
      // whole words only: UPGRADE, SAFEGUARD and SAFETY are not the banned words
      expect(
        measure({
          rows: withReadingChange(0, (r) => {
            r['reasons'] = ['An upgrade, a safeguard, and safety'];
          }),
        }).wording.banned
      ).toBe(0);
    });

    it('an advice word in a text is found, and "buyers" is not "buy"', () => {
      expect(
        measure({
          rows: withReadingChange(0, (r) => {
            r['reasons'] = ['You may buy here'];
          }),
        }).wording.advice
      ).toBe(1);
      expect(
        measure({
          rows: withReadingChange(0, (r) => {
            r['reasons'] = ['Buyers are active'];
          }),
        }).wording.advice
      ).toBe(0);
    });

    it('a summary of 81 characters is too long, one of 80 is not', () => {
      expect(
        measure({
          rows: withReadingChange(0, (r) => {
            r['summary_line'] = 'x'.repeat(81);
          }),
        }).wording.summaryTooLong
      ).toBe(1);
      expect(
        measure({
          rows: withReadingChange(0, (r) => {
            r['summary_line'] = 'x'.repeat(80);
          }),
        }).wording.summaryTooLong
      ).toBe(0);
    });

    it('a row with no readable reading text is unreadable, and is not scanned', () => {
      const rows = synRows();
      rows[0] = { ...rows[0], reading_json: null };
      rows[1] = { ...rows[1], reading_json: 'not json' };
      rows[2] = { ...rows[2], reading_json: '[]' };
      const m = measure({ rows });
      expect(m.wording).toMatchObject({
        scanned: 10,
        unreadable: 3,
        schema: { ran: true, scanned: 10, failures: 0 },
      });
    });

    it('the second look is the scanner’s: a reading that fails it is counted and named', () => {
      const scan = (text: string): string[] =>
        text.includes('"Z3"') ? ['/zones: bad'] : [];
      const m = measure({}, scan);
      expect(m.wording.schema).toEqual({ ran: true, scanned: 13, failures: 1 });
      expect(m.wording.examples).toEqual([
        {
          slot: slotOf(3),
          profile: SCALPER,
          problem: 'fails syn-output/1: /zones: bad',
        },
      ]);
    });

    it('without a scanner the second look says it was not run', () => {
      expect(measure({}, null).wording.schema).toEqual({
        ran: false,
        scanned: 0,
        failures: 0,
      });
    });

    it('keeps ten examples and counts them all', () => {
      const rows = synRows().map((r) => {
        const reading = JSON.parse(r.reading_json as string) as Record<
          string,
          unknown
        >;
        reading['reasons'] = ['A 5% move'];
        return { ...r, reading_json: JSON.stringify(reading) };
      });
      const m = measure({ rows });
      expect(m.wording.percent).toBe(13);
      expect(m.wording.examples).toHaveLength(10);
    });

    it('the real readings of the engine pass the real scan', () => {
      expect(
        SYN_CASES.every((c) => realScan(readingText(c)).length === 0)
      ).toBe(true);
      expect(readingText(SYN_CASES[0], { rule_id: 'bad' })).toContain(
        '"rule_id":"bad"'
      );
      expect(
        realScan(readingText(SYN_CASES[0], { rule_id: 'bad' }))
      ).not.toEqual([]);
    });
  });
});

// ====================================================================== the findings

describe('synthesisFindings', () => {
  it('on the world: the no-match readings, the dropped zones, the refusals and the stopped cycle, in that order', () => {
    expect(synthesisFindings(measure())).toEqual([
      "2 SYN reading(s) matched no rule (NO_MATCH): the cycles and the sensors' states are listed",
      'DAY_TRADER: 1 SYN row(s) have zones the engine dropped (guard problems recorded)',
      'SYN readings were refused in 1 cycle(s): 1 in the log, 1 in the job outcomes (see the refusals below)',
      '1 cycle(s) wrote no SYN rows because synthesis stopped or the tables were missing',
    ]);
  });

  it('a gap nothing explains is a finding', () => {
    const without = events().filter((e) => e.kind !== 'ENGINE_ERROR');
    expect(synthesisFindings(measure({ jobs: null, log: without }))).toContain(
      '1 cycle(s) have fewer SYN rows than trader types and no log line or job outcome says why'
    );
  });

  it('wording is a finding, one line per kind', () => {
    const rows = withReadingChange(0, (r) => {
      r['reasons'] = ['A safe 5% buy'];
      r['summary_line'] = 'y'.repeat(90);
    });
    const found = synthesisFindings(measure({ rows }));
    expect(found).toEqual(
      expect.arrayContaining([
        "1 SYN reading(s) have a '%' in a free text",
        '1 SYN reading(s) carry a banned word',
        '1 SYN reading(s) carry an advice word',
        '1 SYN reading(s) have a summary longer than 80 characters',
        '1 stored SYN reading(s) fail syn-output/1 on a second look',
      ])
    );
  });

  it('unreadable rows are a finding, and so are log lines that cannot be placed', () => {
    const rows = synRows();
    rows[0] = { ...rows[0], reading_json: null };
    const log = parseSynthesisLog('SYN_ENGINE_ERROR no slot here');
    const found = synthesisFindings(measure({ rows, log, jobs: null }));
    expect(found).toContain('1 SYN row(s) have no readable reading text');
    expect(found).toContain(
      'synthesis stopped or the tables were missing in some cycle(s) the log does not place; 1 log line(s) name no slot'
    );
  });

  it('nothing at all is wrong with a clean run: no findings', () => {
    const rows: SynthesisSample[] = synRows().map((r) => ({
      ...r,
      rule_id:
        r.rule_id === 'NO_MATCH' ? 'R1_MACRO_COUNTER_TREND_RALLY' : r.rule_id,
      guard_problems: [],
    }));
    const k2 = rows.find((r) => r.cycle_slot === slotOf(2)) as SynthesisSample;
    rows.push({ ...k2, profile: SCALPER });
    const m = measureSynthesis(
      { rows, sensorRows: [], jobs: null, log: null },
      { scan: realScan }
    );
    expect(synthesisFindings(m)).toEqual([]);
  });

  it('cycles with fewer SYN rows than trader types are a finding even when no log and no jobs are given, with the way to find out why', () => {
    const m = measure({ jobs: null, log: null });
    expect(synthesisFindings(m)).toContain(
      '2 cycle(s) have fewer SYN rows than trader types (give --log and --jobs or --redis to see whether a refusal or an engine error explains them)'
    );
  });

  it('a failed table check is a finding of its own', () => {
    const log = parseSynthesisLog('SYN_TABLES_CHECK_FAILED could not ask');
    const m = measureSynthesis({ rows: [], sensorRows: [], jobs: null, log });
    expect(synthesisFindings(m)).toEqual([
      '1 check(s) of whether the SYN tables exist failed (the database could not be asked), so the SYN rows of those cycles were left out',
    ]);
  });
});
