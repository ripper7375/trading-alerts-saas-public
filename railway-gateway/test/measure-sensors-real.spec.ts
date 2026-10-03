import * as fs from 'fs';
import * as path from 'path';
import Redis from 'ioredis-mock';
import type { CycleReplayReport, ReplayDatabase } from '../src/sensors/replay';
import { EnvelopeValidator } from '../src/sensors/envelope-validator';
import {
  CYCLE_BUDGET_MS,
  CliOptions,
  GUARD_CATEGORIES,
  JobQueueReader,
  MCD0_DEFECT_TIMEFRAMES,
  MCD_BUDGET_MS,
  RedisReader,
  STATUSES,
  SensorRowSample,
  SensorRowSource,
  USES_CHANNEL,
  defectReason,
  formatReport,
  loadJobOutcomes,
  measureSensors,
  parseArgs,
  redisJobReader,
  runMeasureCommand,
} from '../src/sensors/measure-sensors';
import {
  ENGINE_DIR,
  FIXTURE_SLOTS,
  REPO_ROOT,
  readFixtureCycle,
} from './helpers/cycle-fixtures';
import {
  sampleJobs,
  sampleReady,
  sampleReplay,
  sampleRows,
  slotOf,
} from './helpers/measure-sensors-world';

/**
 * The measurement kit against what is real: the three stored cycles the Python runner made (v1, v3 and v4), the real
 * schema validator, the Python sources and registries the kit's constants are copied from, a Redis that speaks Bull's
 * keys, and the command that wires them. `measure-sensors.spec.ts` holds the arithmetic on a table that can be checked
 * by hand.
 *
 * Like six other gateway specs, the pins below read files outside the package (the Python engine, the standard), so a
 * copy of `railway-gateway/` alone fails them; the Railway build runs no tests.
 */

const validator = new EnvelopeValidator();
const realScan = (text: string): string[] => {
  const check = validator.check(text);
  return check.ok ? [] : check.problems;
};

/** The rows `mcd_outputs` would hold for the three stored cycles. */
function realRows(): SensorRowSample[] {
  const rows: SensorRowSample[] = [];
  for (const fixture of FIXTURE_SLOTS) {
    const cycle = readFixtureCycle(fixture);
    for (const r of cycle.results) {
      rows.push({
        symbol: 'XAUUSD',
        cycle_slot: fixture.slot,
        mcd_id: r.mcd_id,
        flag: r.flag,
        evaluator_version: r.evaluator_version,
        status: r.status,
        state_code: r.state_code,
        bias: r.bias,
        inherited_reasons: r.inherited_reasons,
        guard_problems: r.guard_problems,
        retuning_observed: cycle.retuning.observed,
        retuning_applied: cycle.retuning.applied,
        duration_ms: 2.5,
        evaluated_at: fixture.slot + 75,
        envelope_json: r.envelope_json,
      });
    }
  }
  return rows;
}

const read = (file: string): string => fs.readFileSync(file, 'utf8');

describe('the three real stored cycles (v1, v3 and v4), with the real schema validator', () => {
  const report = () => measureSensors({ rows: realRows() }, { scan: realScan });

  it('measures 12 rows in 3 cycles: MCD0 VALID, and the three channel MCDs CAUTIONARY on every one', () => {
    const r = report();
    expect(r.rows).toBe(12);
    expect(r.cycles).toBe(3);
    expect(r.mcds['MCD0'].status).toMatchObject({ VALID: 3, CAUTIONARY: 0 });
    for (const id of ['MCD1', 'MCD2', 'MCD3']) {
      expect(r.mcds[id].status).toMatchObject({ VALID: 0, CAUTIONARY: 3 });
    }
  });

  it('MCD0 flags M5 and M15 on all three real cycles (plan finding S3)', () => {
    const z = report().mcd0;
    expect(z).toMatchObject({
      judged: 3,
      both: 3,
      m5Flagged: 3,
      m15Flagged: 3,
      allQualified: 0,
    });
    expect(z.rate).toEqual({ m5: 1, m15: 1, both: 1, any: 1 });
  });

  it('the reasons on the MCD3 readings are the four it carries on each cycle', () => {
    expect(report().mcds['MCD3'].topReasons).toEqual([
      { code: 'MCD0_DEFECT_M15', count: 3 },
      { code: 'MCD0_DEFECT_M5', count: 3 },
      { code: 'UPSTREAM_CAUTIONARY:MCD1', count: 3 },
      { code: 'UPSTREAM_CAUTIONARY:MCD2', count: 3 },
    ]);
  });

  it('nothing is wrong with them: no EVALUATOR_ERROR, no guard problem, every envelope passes the schema, no percent sign', () => {
    const r = report();
    expect(r.violations.evaluatorError).toBe(0);
    expect(r.violations.guardRows).toBe(0);
    expect(r.violations.rescan).toEqual({
      ran: true,
      scanned: 12,
      schemaFailures: 0,
      percentInText: 0,
      unreadable: 0,
    });
    expect(r.findings).toEqual([]);
  });

  it('the inheritance rule agrees with MCD0 on the real readings: 4 marks required per cycle (MCD1 M15, MCD2 M5, MCD3 both), 12 in all, none missing', () => {
    expect(report().inheritance).toEqual({
      cyclesWithValidDefect: 3,
      expectedMarks: 12,
      missing: 0,
      unexplained: 0,
      mismatches: [],
      unknownMcds: [],
    });
  });

  it('a real envelope with its MCD0 mark taken out is a missing mark, named by slot, MCD and timeframe', () => {
    const rows = realRows().map((r) => {
      if (r.cycle_slot !== FIXTURE_SLOTS[0].slot || r.mcd_id !== 'MCD1')
        return r;
      const doc = JSON.parse(r.envelope_json as string) as {
        status_reasons: string[];
      };
      doc.status_reasons = doc.status_reasons.filter(
        (c) => c !== defectReason('M15')
      );
      return {
        ...r,
        envelope_json: JSON.stringify(doc),
        inherited_reasons: r.inherited_reasons.filter(
          (c) => c !== defectReason('M15')
        ),
      };
    });
    const i = measureSensors({ rows }).inheritance;
    expect(i.mismatches).toEqual([
      {
        slot: FIXTURE_SLOTS[0].slot,
        mcd: 'MCD1',
        timeframe: 'M15',
        kind: 'MISSING',
      },
    ]);
  });

  it('a real envelope with a required field removed fails the second look, and one with a percent sign in its commentary is found', () => {
    const rows = realRows();
    const broken = JSON.parse(rows[1].envelope_json as string) as Record<
      string,
      unknown
    >;
    delete broken['mcd_id'];
    rows[1] = { ...rows[1], envelope_json: JSON.stringify(broken) };
    const chatty = JSON.parse(rows[2].envelope_json as string) as Record<
      string,
      unknown
    >;
    chatty['commentary'] = 'the channel held 80% of the time';
    rows[2] = { ...rows[2], envelope_json: JSON.stringify(chatty) };
    const r = measureSensors({ rows }, { scan: realScan });
    expect(r.violations.rescan).toMatchObject({
      scanned: 12,
      schemaFailures: 1,
      percentInText: 1,
    });
    expect(r.findings).toEqual([
      '1 stored envelope(s) fail the schema on a second look',
      "1 stored envelope(s) have a '%' in a free text",
    ]);
  });
});

describe("the kit's constants are the ones in the Python worker, the registries and the standard", () => {
  it('MCD0_DEFECT_TIMEFRAMES is DEFECT_TIMEFRAMES of mcd_worker/inheritance.py, state for state', () => {
    const source = read(path.join(ENGINE_DIR, 'mcd_worker', 'inheritance.py'));
    const block = /DEFECT_TIMEFRAMES[^=]*=\s*\{([^}]*)\}/.exec(source);
    expect(block).not.toBeNull();
    const python: Record<string, string[]> = {};
    for (const m of (block as RegExpExecArray)[1].matchAll(
      /"(MCD0_[A-Z0-9_]+)":\s*\(([^)]*)\)/g
    )) {
      python[m[1]] = [...m[2].matchAll(/"([A-Z0-9]+)"/g)].map((t) => t[1]);
    }
    expect(Object.keys(python)).toHaveLength(4);
    expect(MCD0_DEFECT_TIMEFRAMES).toEqual(python);
  });

  it('and its states are the states of the MCD0 register', () => {
    const registry = read(path.join(ENGINE_DIR, 'mcd0', 'mcd0_registry.yaml'));
    const codes = [...registry.matchAll(/^\s*- code: (MCD0_[A-Z0-9_]+)\s*$/gm)]
      .map((m) => m[1])
      .sort();
    expect(Object.keys(MCD0_DEFECT_TIMEFRAMES).sort()).toEqual(codes);
  });

  it('USES_CHANNEL is the uses_channel of every registry, and no registry is missing from it', () => {
    const found: Record<string, string[]> = {};
    for (const dir of fs.readdirSync(ENGINE_DIR)) {
      const m = /^mcd(\d+)$/.exec(dir);
      if (m === null) continue;
      const file = path.join(ENGINE_DIR, dir, `${dir}_registry.yaml`);
      if (!fs.existsSync(file)) continue;
      const uses = /^uses_channel:\s*\[([^\]]*)\]/m.exec(read(file));
      expect(uses).not.toBeNull();
      found[`MCD${m[1]}`] = ((uses as RegExpExecArray)[1].match(/[A-Z0-9]+/g) ??
        []) as string[];
    }
    expect(Object.keys(found).sort()).toEqual(Object.keys(USES_CHANNEL).sort());
    expect(USES_CHANNEL).toEqual(found);
  });

  it('the mark is the code the kit builds: MCD0_DEFECT_<TF>, and EVALUATOR_ERROR is a reason code', () => {
    const codes = read(path.join(ENGINE_DIR, 'mcd_common', 'reason_codes.py'));
    expect(codes).toContain('code = f"MCD0_DEFECT_{timeframe}"');
    for (const tf of ['M5', 'M15']) {
      expect(codes).toContain(`"${defectReason(tf)}"`);
    }
    expect(codes).toContain('EVALUATOR_ERROR = "EVALUATOR_ERROR"');
  });

  it('GUARD_CATEGORIES are the prefixes the output guards and the runner put on a problem', () => {
    const sources = ['guards.py', 'cycle_runner.py']
      .map((f) => read(path.join(ENGINE_DIR, 'mcd_worker', f)))
      .join('\n');
    const prefixes = new Set(
      [...sources.matchAll(/\bf?"([A-Z]+): /g)].map((m) => m[1])
    );
    expect([...prefixes].sort()).toEqual([...GUARD_CATEGORIES].sort());
  });

  it('STATUSES are the four of the envelope schema', () => {
    const schema = JSON.parse(
      read(
        path.join(__dirname, '..', 'src', 'sensors', 'mcd-output-1.schema.json')
      )
    ) as {
      properties: { status: { enum: string[] } };
    };
    expect([...STATUSES]).toEqual(schema.properties.status.enum);
  });

  it('the budgets are the ones the standard states: one evaluation 1 s, the whole cycle 30 s', () => {
    const standard = read(
      path.join(REPO_ROOT, 'docs', 'MCD-DEVELOPMENT-STANDARD.md')
    );
    expect(standard).toMatch(
      /one evaluation ≤ 1 s on the worker; the whole cycle[^.]*≤ 30 s\s+after the cycle-ready signal/
    );
    expect(MCD_BUDGET_MS).toBe(1000);
    expect(CYCLE_BUDGET_MS).toBe(30_000);
  });
});

describe("redisJobReader: Bull's own keys, read with three read commands", () => {
  const OUTCOME = (slot: number, extra: Record<string, unknown> = {}) =>
    JSON.stringify({
      outcome: 'WRITTEN',
      slot,
      basis: 'INPUTS',
      wallMs: 250,
      ...extra,
    });

  async function seeded(queue = 'cycle-ready', prefix = 'bull') {
    const redis = new Redis();
    await redis.flushall();
    const key = (part: string) => `${prefix}:${queue}:${part}`;
    // finished jobs, by finish time: 1 oldest ... 5 newest
    for (const [score, id] of [
      [100, '1'],
      [200, '2'],
      [300, '3'],
      [400, '4'],
      [500, '5'],
    ] as const) {
      await redis.zadd(key('completed'), score, id);
    }
    await redis.hset(key('1'), {
      data: '{}',
      returnvalue: OUTCOME(slotOf(1)),
      finishedOn: '100',
    });
    await redis.hset(key('2'), {
      returnvalue: JSON.stringify({
        outcome: 'SKIPPED_OLD',
        slot: slotOf(2),
        ageSeconds: 900,
      }),
    });
    // job 3 was removed by Bull's retention: no hash; job 4 has a return value that is not JSON
    await redis.hset(key('4'), { returnvalue: 'not json' });
    await redis.hset(key('5'), {
      returnvalue: OUTCOME(slotOf(5), { wallMs: 500 }),
    });
    await redis.zadd(key('failed'), 1, '8');
    await redis.zadd(key('failed'), 2, '9');
    return redis;
  }

  /** Every method called on the client, by name. */
  function watched(redis: InstanceType<typeof Redis>) {
    const called = new Set<string>();
    const proxy = new Proxy(redis, {
      get(target, prop, receiver) {
        const value = Reflect.get(target, prop, receiver) as unknown;
        if (typeof value === 'function' && typeof prop === 'string') {
          called.add(prop);
          return (value as (...a: unknown[]) => unknown).bind(target);
        }
        return value;
      },
    });
    return { client: proxy as unknown as RedisReader, called };
  }

  it('reads the finished jobs newest first, and skips one with no hash or no JSON return value', async () => {
    const reader = redisJobReader(watched(await seeded()).client);
    const found = (await reader.getCompleted(0, 99)) as Array<{
      returnvalue: { slot: number };
    }>;
    expect(found.map((j) => j.returnvalue.slot)).toEqual([
      slotOf(5),
      slotOf(2),
      slotOf(1),
    ]);
  });

  it('honours the range it is given: the newest one only', async () => {
    const reader = redisJobReader(watched(await seeded()).client);
    const found = (await reader.getCompleted(0, 0)) as Array<{
      returnvalue: { slot: number };
    }>;
    expect(found.map((j) => j.returnvalue.slot)).toEqual([slotOf(5)]);
  });

  it('counts the failed jobs', async () => {
    expect(
      await redisJobReader(watched(await seeded()).client).getFailedCount()
    ).toBe(2);
  });

  it('uses only read commands: ZREVRANGE, HGET and ZCARD', async () => {
    const { client, called } = watched(await seeded());
    const reader = redisJobReader(client);
    await reader.getCompleted();
    await reader.getFailedCount();
    expect([...called].sort()).toEqual(['hget', 'zcard', 'zrevrange']);
  });

  it('reads the queue and the prefix it is told to, and nothing of another queue', async () => {
    const redis = await seeded('other-queue', 'custom');
    const { client } = watched(redis);
    expect(await redisJobReader(client).getCompleted()).toEqual([]);
    expect(await redisJobReader(client).getFailedCount()).toBe(0);
    const reader = redisJobReader(client, 'other-queue', 'custom');
    expect(await reader.getCompleted()).toHaveLength(3);
    expect(await reader.getFailedCount()).toBe(2);
  });

  it('loadJobOutcomes turns them into job samples and carries the failed count', async () => {
    const loaded = await loadJobOutcomes(
      redisJobReader(watched(await seeded()).client)
    );
    expect(loaded.failed).toBe(2);
    expect(loaded.jobs).toEqual([
      {
        outcome: 'WRITTEN',
        slot: slotOf(5),
        basis: 'INPUTS',
        wallMs: 500,
        ageSeconds: null,
      },
      {
        outcome: 'SKIPPED_OLD',
        slot: slotOf(2),
        basis: null,
        wallMs: null,
        ageSeconds: 900,
      },
      {
        outcome: 'WRITTEN',
        slot: slotOf(1),
        basis: 'INPUTS',
        wallMs: 250,
        ageSeconds: null,
      },
    ]);
  });

  it('loadJobOutcomes drops what is not an outcome of this worker', async () => {
    const queue: JobQueueReader = {
      getCompleted: async () => [
        null,
        'text',
        { returnvalue: 'text' },
        { returnvalue: { slot: 1 } },
        { returnvalue: { outcome: 'WRITTEN', slot: slotOf(1), wallMs: 5 } },
      ],
      getFailedCount: async () => 0,
    };
    const loaded = await loadJobOutcomes(queue);
    expect(loaded.jobs).toEqual([
      {
        outcome: 'WRITTEN',
        slot: slotOf(1),
        basis: null,
        wallMs: 5,
        ageSeconds: null,
      },
    ]);
  });

  it('by default the reader returns the newest 100 finished jobs: Bull keeps 100, and 101 are asked for to show where it stops', async () => {
    const redis = new Redis();
    await redis.flushall();
    for (let id = 1; id <= 101; id += 1) {
      await redis.zadd('bull:cycle-ready:completed', id, String(id));
      await redis.hset(`bull:cycle-ready:${id}`, {
        returnvalue: JSON.stringify({ outcome: 'WRITTEN', slot: id * 300 }),
      });
    }
    const reader = redisJobReader(redis as unknown as RedisReader);
    const found = (await reader.getCompleted()) as Array<{
      returnvalue: { slot: number };
    }>;
    expect(found).toHaveLength(100);
    expect(found[0].returnvalue.slot).toBe(101 * 300); // the newest first
    expect(found[99].returnvalue.slot).toBe(2 * 300); // the oldest of the 100
  });

  it('asks the queue for the last 100 completed jobs: what Bull keeps (removeOnComplete: 100)', async () => {
    const calls: unknown[][] = [];
    const queue: JobQueueReader = {
      getCompleted: async (...args) => {
        calls.push(args);
        return [];
      },
      getFailedCount: async () => 0,
    };
    await loadJobOutcomes(queue);
    expect(calls).toEqual([[0, 99]]);
  });
});

describe('runMeasureCommand', () => {
  const sampleText = JSON.stringify({
    rows: sampleRows(),
    ready: sampleReady(),
    jobs: sampleJobs(),
    replay: sampleReplay(),
    failedJobs: 2,
  });
  const opts = (...argv: string[]): CliOptions => {
    const parsed = parseArgs(argv);
    if ('error' in parsed) throw new Error(parsed.error);
    return parsed;
  };
  const files = (map: Record<string, string>) => (file: string) => {
    if (!(file in map)) throw new Error(`unexpected read of ${file}`);
    return map[file];
  };

  describe('from a file', () => {
    it('reads one file, measures it and prints the text report', async () => {
      const result = await runMeasureCommand(opts('--file', 'a.json'), {
        readFile: files({ 'a.json': sampleText }),
        scan: realScan,
      });
      const expected = measureSensors(
        {
          rows: sampleRows(),
          ready: sampleReady(),
          jobs: sampleJobs(),
          replay: sampleReplay(),
          failedJobs: 2,
        },
        { scan: realScan }
      );
      expect(result.report).toEqual(expected);
      expect(result.text).toBe(formatReport(expected));
      expect(result.exitCode).toBe(0);
    });

    it('--json prints the report as JSON', async () => {
      const result = await runMeasureCommand(
        opts('--file', 'a.json', '--json'),
        { readFile: files({ 'a.json': sampleText }) }
      );
      expect(JSON.parse(result.text)).toEqual(
        JSON.parse(JSON.stringify(result.report))
      );
    });

    it('--strict exits 1 on a finding and 0 on none', async () => {
      const deps = { readFile: files({ 'a.json': sampleText }) };
      expect(
        (await runMeasureCommand(opts('--file', 'a.json', '--strict'), deps))
          .exitCode
      ).toBe(1);
      expect(
        (await runMeasureCommand(opts('--file', 'a.json'), deps)).exitCode
      ).toBe(0);
      const clean = JSON.stringify({
        rows: sampleRows().filter((r) => r.cycle_slot <= slotOf(4)),
      });
      const result = await runMeasureCommand(
        opts('--file', 'c.json', '--strict'),
        { readFile: files({ 'c.json': clean }) }
      );
      expect(result.report.findings).toEqual([]);
      expect(result.exitCode).toBe(0);
    });

    it('keeps the rows of the symbol asked for and counts the rows it dropped as skipped', async () => {
      const text = JSON.stringify({
        rows: [
          ...sampleRows(),
          { cycle_slot: 'x' },
          { ...sampleRows()[0], symbol: 'EURUSD' },
        ],
      });
      const result = await runMeasureCommand(opts('--file', 'a.json'), {
        readFile: files({ 'a.json': text }),
      });
      expect(result.report.rows).toBe(32); // the EURUSD row is not measured
      expect(result.report.skippedRows).toBe(1); // the row with no slot
      expect(
        (
          await runMeasureCommand(
            opts('--file', 'a.json', '--symbol', 'EURUSD'),
            { readFile: files({ 'a.json': text }) }
          )
        ).report.rows
      ).toBe(1);
    });

    it('--jobs and --replay-file replace what the file holds, and --expect is passed on', async () => {
      const jobs = JSON.stringify([
        { outcome: 'SKIPPED_OLD', slot: 1, ageSeconds: 700 },
      ]);
      const replay = JSON.stringify([{ slot: 1, verdict: 'LOGIC_DIVERGENCE' }]);
      const result = await runMeasureCommand(
        opts(
          '--file',
          'a.json',
          '--jobs',
          'j.json',
          '--replay-file',
          'r.json',
          '--expect',
          'MCD0,MCD1'
        ),
        {
          readFile: files({
            'a.json': sampleText,
            'j.json': jobs,
            'r.json': replay,
          }),
        }
      );
      expect(result.report.jobs?.given).toBe(1);
      expect(result.report.jobs?.skippedOld).toBe(1);
      expect(result.report.determinism.verdict).toBe('NOT_DETERMINISTIC');
      expect(result.report.rowsPerCycle.expected).toEqual(['MCD0', 'MCD1']);
      expect(result.report.rowsPerCycle.expectedFrom).toBe('GIVEN');
    });

    it('has no second look unless it is given a scanner', async () => {
      const result = await runMeasureCommand(opts('--file', 'a.json'), {
        readFile: files({ 'a.json': sampleText }),
      });
      expect(result.report.violations.rescan.ran).toBe(false);
    });

    it('does not open a database or a queue for a file', async () => {
      const deps = {
        readFile: files({ 'a.json': sampleText }),
        openDatabase: jest.fn(),
        openQueue: jest.fn(),
        replaySlots: jest.fn(),
      };
      await runMeasureCommand(opts('--file', 'a.json'), deps);
      expect(deps.openDatabase).not.toHaveBeenCalled();
      expect(deps.openQueue).not.toHaveBeenCalled();
      expect(deps.replaySlots).not.toHaveBeenCalled();
    });

    it('passes a bad file on as an error', async () => {
      await expect(
        runMeasureCommand(opts('--file', 'a.json'), {
          readFile: files({ 'a.json': '{"x": 1}' }),
        })
      ).rejects.toThrow(/array of mcd_outputs rows/);
    });
  });

  describe('from the database', () => {
    function fakeDatabase(options: { fail?: boolean } = {}) {
      const calls: string[] = [];
      const slots = [...new Set(sampleRows().map((r) => r.cycle_slot))].sort(
        (a, b) => b - a
      );
      const database = {
        mcdOutput: {
          findMany: async (args: { distinct?: unknown }) => {
            if (options.fail) throw new Error('connection lost');
            calls.push(args.distinct ? 'slots' : 'rows');
            return args.distinct
              ? slots.map((cycle_slot) => ({ cycle_slot }))
              : sampleRows();
          },
        },
        marketCycle: {
          findMany: async () => {
            calls.push('ready');
            return sampleReady();
          },
        },
        marketCycleInput: {},
      } as unknown as SensorRowSource & ReplayDatabase;
      const close = jest.fn(async () => undefined);
      return {
        database,
        close,
        calls,
        openDatabase: async () => ({ database, close }),
      };
    }

    it('loads the rows and the READY cycles, measures them, and closes the database', async () => {
      const db = fakeDatabase();
      const result = await runMeasureCommand(opts('--db'), {
        readFile: files({}),
        openDatabase: db.openDatabase,
      });
      expect(db.calls).toEqual(['slots', 'rows', 'ready']);
      expect(result.report.rows).toBe(32);
      expect(result.report.rowsPerCycle.readyCycles).toBe(10);
      expect(result.report.jobs).toBeNull();
      expect(result.report.determinism.verdict).toBe('NOT_CHECKED');
      expect(db.close).toHaveBeenCalledTimes(1);
    });

    it('closes the database when the read fails, and passes the failure on', async () => {
      const db = fakeDatabase({ fail: true });
      await expect(
        runMeasureCommand(opts('--db'), {
          readFile: files({}),
          openDatabase: db.openDatabase,
        })
      ).rejects.toThrow('connection lost');
      expect(db.close).toHaveBeenCalledTimes(1);
    });

    it('needs openDatabase to be wired', async () => {
      await expect(
        runMeasureCommand(opts('--db'), { readFile: files({}) })
      ).rejects.toThrow('no database to read');
    });

    it('--replay N replays the newest N cycles, oldest first, from the same database, and measures the verdicts', async () => {
      const db = fakeDatabase();
      const replaySlots = jest.fn(
        async (_database: ReplayDatabase, _symbol: string, slots: number[]) =>
          slots.map(
            (slot) =>
              ({ slot, verdict: 'VERIFIED', cause: null }) as CycleReplayReport
          )
      );
      const result = await runMeasureCommand(opts('--db', '--replay', '3'), {
        readFile: files({}),
        openDatabase: db.openDatabase,
        replaySlots,
      });
      expect(replaySlots).toHaveBeenCalledTimes(1);
      const [database, symbol, slots] = replaySlots.mock.calls[0];
      expect(database).toBe(db.database);
      expect(symbol).toBe('XAUUSD');
      expect(slots).toEqual([slotOf(5), slotOf(6), slotOf(7)]);
      expect(result.report.determinism).toMatchObject({
        verdict: 'DETERMINISTIC',
        checked: 3,
      });
      expect(db.close).toHaveBeenCalledTimes(1);
    });

    it('--replay uses the cause the replay gave, and a divergence is a finding', async () => {
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
              verdict: k === 0 ? 'LOGIC_DIVERGENCE' : 'NOT_REPLAYABLE',
              cause: k === 0 ? null : 'NO_STORED_BUNDLE',
            }) as CycleReplayReport
        );
      const result = await runMeasureCommand(
        opts('--db', '--replay', '2', '--strict'),
        {
          readFile: files({}),
          openDatabase: db.openDatabase,
          replaySlots,
        }
      );
      expect(result.report.determinism.verdict).toBe('NOT_DETERMINISTIC');
      expect(result.report.determinism.attention).toEqual([
        { slot: slotOf(6), verdict: 'LOGIC_DIVERGENCE', cause: null },
        {
          slot: slotOf(7),
          verdict: 'NOT_REPLAYABLE',
          cause: 'NO_STORED_BUNDLE',
        },
      ]);
      expect(result.exitCode).toBe(1);
    });

    it('--replay needs a replayer to be wired, and closes the database first', async () => {
      const db = fakeDatabase();
      await expect(
        runMeasureCommand(opts('--db', '--replay', '2'), {
          readFile: files({}),
          openDatabase: db.openDatabase,
        })
      ).rejects.toThrow('no replayer to run');
      expect(db.close).toHaveBeenCalledTimes(1);
    });

    it('--replay-file gives the verdicts without a replayer', async () => {
      const db = fakeDatabase();
      const replay = JSON.stringify([{ slot: slotOf(7), verdict: 'VERIFIED' }]);
      const result = await runMeasureCommand(
        opts('--db', '--replay-file', 'r.json'),
        {
          readFile: files({ 'r.json': replay }),
          openDatabase: db.openDatabase,
        }
      );
      expect(result.report.determinism.verdict).toBe('DETERMINISTIC');
    });

    it('--redis reads the outcomes and the failed count from the queue, and closes it', async () => {
      const db = fakeDatabase();
      const close = jest.fn(async () => undefined);
      const queue: JobQueueReader = {
        getCompleted: async () => [
          {
            returnvalue: { outcome: 'SKIPPED_OLD', slot: 300, ageSeconds: 900 },
          },
        ],
        getFailedCount: async () => 4,
      };
      const result = await runMeasureCommand(opts('--db', '--redis'), {
        readFile: files({}),
        openDatabase: db.openDatabase,
        openQueue: async () => ({ queue, close }),
      });
      expect(result.report.jobs).toMatchObject({
        given: 1,
        skippedOld: 1,
        failed: 4,
      });
      expect(close).toHaveBeenCalledTimes(1);
    });

    it('--redis closes the queue when a read fails, and needs openQueue to be wired', async () => {
      const close = jest.fn(async () => undefined);
      const queue: JobQueueReader = {
        getCompleted: async () => {
          throw new Error('redis is down');
        },
        getFailedCount: async () => 0,
      };
      await expect(
        runMeasureCommand(opts('--db', '--redis'), {
          readFile: files({}),
          openDatabase: fakeDatabase().openDatabase,
          openQueue: async () => ({ queue, close }),
        })
      ).rejects.toThrow('redis is down');
      expect(close).toHaveBeenCalledTimes(1);
      await expect(
        runMeasureCommand(opts('--db', '--redis'), {
          readFile: files({}),
          openDatabase: fakeDatabase().openDatabase,
        })
      ).rejects.toThrow('no queue to read');
    });

    it('--jobs gives no failed count: it is unknown, not zero', async () => {
      const jobs = JSON.stringify([
        { outcome: 'WRITTEN', slot: slotOf(7), wallMs: 100 },
      ]);
      const result = await runMeasureCommand(opts('--db', '--jobs', 'j.json'), {
        readFile: files({ 'j.json': jobs }),
        openDatabase: fakeDatabase().openDatabase,
      });
      expect(result.report.jobs?.failed).toBeNull();
      expect(result.text).not.toContain('failed');
    });

    it('--jobs reads the outcomes from a file instead of the queue', async () => {
      const jobs = JSON.stringify([
        { outcome: 'WRITTEN', slot: slotOf(7), wallMs: 100 },
      ]);
      const result = await runMeasureCommand(opts('--db', '--jobs', 'j.json'), {
        readFile: files({ 'j.json': jobs }),
        openDatabase: fakeDatabase().openDatabase,
        openQueue: jest.fn(),
      });
      expect(result.report.jobs?.given).toBe(1);
    });
  });
});
