/**
 * @jest-environment node
 */

/**
 * `scripts/reply/measure-units.js` (build step 7 part 6; runbook S3; architecture 7.3): units and
 * tokens per message kind and model, read from the traces. The percentiles in the first group were
 * worked out on paper (nearest rank over ten known values); the rest holds the classification of a
 * message, the read-only promise, and that the proposal of ADR-073 is the same number the
 * TypeScript `proQuotaUnits` gives.
 */

import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join, resolve } from 'path';

import { proQuotaUnits } from '@/lib/reply/meter/units';

const mockQueries: { sql: string; values?: unknown[] }[] = [];
const mockClientOptions: Record<string, unknown>[] = [];
let mockRows: unknown[] = [];
let mockConnectError: Error | null = null;
jest.mock('pg', () => ({
  Client: class {
    constructor(options: Record<string, unknown>) {
      mockClientOptions.push(options);
    }
    async connect() {
      if (mockConnectError !== null) throw mockConnectError;
    }
    async query(sql: string, values?: unknown[]) {
      mockQueries.push({ sql, values });
      return { rows: sql.startsWith('SELECT') ? mockRows : [] };
    }
    async end() {}
  },
}));

const script = require('../../../../scripts/reply/measure-units.js') as {
  KINDS: string[];
  READ_SQL: string;
  analyse: (rows: unknown[], options?: Record<string, unknown>) => any;
  buys: (report: any, units: number) => any[];
  classify: (rows: any[]) => any[];
  main: (
    argv: string[],
    io?: { out: (s: string) => void; err: (s: string) => void },
    env?: Record<string, string | undefined>
  ) => Promise<number>;
  normalise: (row: unknown) => any;
  parseArgs: (argv: string[]) => any;
  percentile: (sorted: number[], p: number) => number | null;
  proposal: (price: number, share: number) => any;
  spread: (values: (number | null)[]) => any;
};

const SCRIPT_PATH = resolve(
  __dirname,
  '../../../../scripts/reply/measure-units.js'
);

interface TraceOptions {
  id: string;
  thread?: string | null;
  intent?: string;
  model?: string | null;
  units?: number;
  outcome?: string;
  at?: string;
  tokens?: Record<string, number | null>;
  cost?: number | null;
  fallback?: boolean;
  regenerations?: number;
  extra?: Record<string, unknown>;
}

let seconds = 0;
const trace = (o: TraceOptions) => ({
  request_id: o.id,
  thread_id: o.thread ?? null,
  intent: o.intent ?? 'DIRECTION',
  model: o.model === undefined ? 'vendor/model-a' : o.model,
  units_charged: o.units ?? 0,
  outcome: o.outcome ?? 'REPORT1',
  created_at:
    o.at ??
    new Date(Date.UTC(2026, 9, 15, 10, 0, (seconds += 1))).toISOString(),
  model_group: {
    model: o.model === undefined ? 'vendor/model-a' : o.model,
    tokens: o.tokens ?? { prompt: 8000, completion: 1200, cached: 4000 },
    cost_micro_usd: o.cost === undefined ? (o.units ?? 0) : o.cost,
    fallback_used: o.fallback ?? false,
  },
  checks_group: { regenerations: o.regenerations ?? 0 },
  ...(o.extra ?? {}),
});

/** Ten threads of one first message each, with units 100 to 1,000 in a scrambled order. */
const TEN = [700, 100, 1000, 400, 900, 200, 600, 300, 800, 500].map(
  (units, i) => trace({ id: `ten-${i}`, thread: `thread-${i}`, units })
);

describe('percentile (nearest rank): worked out on paper over 100, 200 ... 1,000', () => {
  const ten = [100, 200, 300, 400, 500, 600, 700, 800, 900, 1000];
  it.each([
    [50, 500], // rank ceil(5.0) = 5
    [90, 900], // rank ceil(9.0) = 9
    [95, 1000], // rank ceil(9.5) = 10
    [99, 1000], // rank ceil(9.9) = 10
    [10, 100], // rank 1
    [11, 200], // rank ceil(1.1) = 2
    [100, 1000],
    [1, 100],
  ])('the %dth percentile is %d', (p, expected) => {
    expect(script.percentile(ten, p)).toBe(expected);
  });

  it('is a value that occurred, for one value and for none', () => {
    expect(script.percentile([42], 50)).toBe(42);
    expect(script.percentile([42], 99)).toBe(42);
    expect(script.percentile([], 50)).toBeNull();
  });

  it('spread gives n, mean, max and the percentiles, and ignores unknown values', () => {
    expect(script.spread([300, 100, null, 200])).toEqual({
      n: 3,
      mean: 200,
      max: 300,
      p: { p50: 200, p90: 300, p95: 300, p99: 300 },
    });
    expect(script.spread([null, null])).toEqual({
      n: 0,
      mean: null,
      max: null,
      p: {},
    });
  });
});

describe('normalise', () => {
  it('reads the columns and the JSON groups, including groups sent as text', () => {
    const row = trace({
      id: 'a',
      thread: 't',
      units: 5,
      cost: 7,
      fallback: true,
      regenerations: 1,
    });
    expect(
      script.normalise({ ...row, model_group: JSON.stringify(row.model_group) })
    ).toMatchObject({
      requestId: 'a',
      threadId: 't',
      model: 'vendor/model-a',
      units: 5,
      costMicroUsd: 7,
      promptTokens: 8000,
      completionTokens: 1200,
      cachedTokens: 4000,
      fallbackUsed: true,
      regenerated: true,
    });
  });

  it('turns what it cannot read into nulls and drops what it cannot use', () => {
    expect(
      script.normalise({ ...trace({ id: 'a' }), model_group: 'not json' })
    ).toMatchObject({
      costMicroUsd: null,
      promptTokens: null,
    });
    expect(
      script.normalise({ ...trace({ id: 'a' }), model: '' }).model
    ).toBeNull();
    expect(
      script.normalise({ ...trace({ id: 'a' }), thread_id: '' }).threadId
    ).toBeNull();
    for (const bad of [
      null,
      'row',
      [],
      { ...trace({ id: 'a' }), request_id: undefined },
      { ...trace({ id: 'a' }), units_charged: -1 },
      { ...trace({ id: 'a' }), units_charged: 1.5 },
      { ...trace({ id: 'a' }), units_charged: 'many' },
      { ...trace({ id: 'a' }), created_at: 'yesterday' },
    ]) {
      expect(script.normalise(bad)).toBeNull();
    }
  });
});

describe('classify: first message, follow-up, instant', () => {
  const at = (n: number) =>
    new Date(Date.UTC(2026, 9, 15, 10, n)).toISOString();
  const rows = [
    trace({ id: 'f2', thread: 'A', at: at(2) }),
    trace({ id: 'f1', thread: 'A', at: at(1) }),
    trace({ id: 'f3', thread: 'A', at: at(3) }),
    trace({ id: 'i1', thread: 'A', intent: 'INSTANT_M5_INSPECT', at: at(0) }),
    trace({ id: 'solo', thread: 'B', at: at(5) }),
    trace({ id: 'nothread', thread: null, at: at(6) }),
    trace({ id: 'nothread2', thread: null, at: at(7) }),
    trace({
      id: 'onlyinstant',
      thread: 'C',
      intent: 'INSTANT_M15_INSPECT',
      at: at(8),
    }),
    trace({ id: 'tie-b', thread: 'D', at: at(9) }),
    trace({ id: 'tie-a', thread: 'D', at: at(9) }),
  ].map((r) => script.normalise(r));

  const kinds = Object.fromEntries(
    script.classify(rows).map((r) => [r.requestId, r.kind])
  );

  it('the earliest typed question of a thread is its first message, whatever order the rows come in', () => {
    expect(kinds['f1']).toBe('FIRST_MESSAGE');
    expect(kinds['f2']).toBe('FOLLOW_UP');
    expect(kinds['f3']).toBe('FOLLOW_UP');
    expect(kinds['solo']).toBe('FIRST_MESSAGE');
  });

  it('an instant prompt is an instant prompt, even when it opened the thread, and never makes a typed question a follow-up', () => {
    expect(kinds['i1']).toBe('INSTANT');
    expect(kinds['onlyinstant']).toBe('INSTANT');
  });

  it('a trace with no thread is a first message each time', () => {
    expect(kinds['nothread']).toBe('FIRST_MESSAGE');
    expect(kinds['nothread2']).toBe('FIRST_MESSAGE');
  });

  it('two questions at one instant are ordered by request id', () => {
    expect(kinds['tie-a']).toBe('FIRST_MESSAGE');
    expect(kinds['tie-b']).toBe('FOLLOW_UP');
  });

  it('knows the three kinds', () => {
    expect(script.KINDS).toEqual(['FIRST_MESSAGE', 'FOLLOW_UP', 'INSTANT']);
  });
});

describe('analyse', () => {
  it('gives the percentiles of ten first messages, as worked out on paper', () => {
    const report = script.analyse(TEN);
    expect(report.traces).toBe(10);
    expect(report.measured).toBe(10);
    expect(report.groups).toHaveLength(1);
    expect(report.groups[0]).toMatchObject({
      kind: 'FIRST_MESSAGE',
      model: 'vendor/model-a',
      n: 10,
      unitsCharged: 5500,
      units: {
        n: 10,
        mean: 550,
        max: 1000,
        p: { p50: 500, p90: 900, p95: 1000, p99: 1000 },
      },
      promptTokens: { p: { p50: 8000 } },
      completionTokens: { p: { p50: 1200 } },
      costMicroUsd: 5500,
      costKnown: 10,
      cachedShare: 0.5,
      regeneratedShare: 0,
      fallbackShare: 0,
    });
  });

  it('groups by kind and by model, in a fixed order', () => {
    const report = script.analyse([
      trace({ id: 'i', thread: 'A', intent: 'INSTANT_M5_INSPECT', units: 300 }),
      trace({ id: 'b2', thread: 'B', model: 'vendor/model-b', units: 2000 }),
      trace({
        id: 'a1',
        thread: 'A',
        units: 1000,
        at: '2026-10-15T09:00:00.000Z',
      }),
      trace({
        id: 'a2',
        thread: 'A',
        units: 600,
        at: '2026-10-15T09:05:00.000Z',
      }),
      trace({
        id: 'a3',
        thread: 'A',
        units: 800,
        at: '2026-10-15T09:10:00.000Z',
      }),
    ]);
    expect(
      report.groups.map((g: any) => `${g.kind}|${g.model}|${g.n}`)
    ).toEqual([
      'FIRST_MESSAGE|vendor/model-a|1',
      'FIRST_MESSAGE|vendor/model-b|1',
      'FOLLOW_UP|vendor/model-a|2',
      'INSTANT|vendor/model-a|1',
    ]);
    expect(report.groups[2].units).toMatchObject({
      mean: 700,
      max: 800,
      p: { p50: 600, p90: 800 },
    });
  });

  it('counts the outcomes and the rows it cannot read', () => {
    const report = script.analyse([
      ...TEN.slice(0, 2),
      trace({ id: 'r', model: null, outcome: 'REFUSED', units: 0 }),
      { nonsense: true },
      null,
    ]);
    expect(report.outcomes).toEqual({ REFUSED: 1, REPORT1: 2 });
    expect(report.unreadable).toBe(2);
    expect(report.traces).toBe(3);
    expect(report.measured).toBe(2);
  });

  it('lists apart what was spent with no model reply to show for it', () => {
    const report = script.analyse([
      trace({ id: 'ok', units: 500 }),
      trace({ id: 'died', model: null, outcome: 'ERROR', units: 250 }),
      trace({ id: 'fixed', model: null, outcome: 'FIXED_ANSWER', units: 125 }),
      trace({ id: 'free', model: null, outcome: 'REFUSED', units: 0 }),
    ]);
    expect(report.paidNotDelivered).toEqual({ n: 2, units: 375 });
    // and they do not pull down the percentiles of delivered answers
    expect(report.groups[0].units.p.p50).toBe(500);
  });

  it('keeps the cost, the regeneration and the fallback shares by hand: 1 of 4 regenerated, 2 of 4 fell back', () => {
    const report = script.analyse([
      trace({ id: '1', thread: 't1', units: 100, regenerations: 1, cost: 90 }),
      trace({ id: '2', thread: 't2', units: 100, fallback: true, cost: null }),
      trace({ id: '3', thread: 't3', units: 100, fallback: true, cost: 110 }),
      trace({ id: '4', thread: 't4', units: 100, cost: 100 }),
    ]);
    expect(report.groups[0]).toMatchObject({
      n: 4,
      regeneratedShare: 0.25,
      fallbackShare: 0.5,
      costMicroUsd: 300,
      costKnown: 3,
    });
  });

  it('reports no cached share when no request said how much was cached', () => {
    const report = script.analyse([
      trace({
        id: '1',
        thread: 't1',
        units: 10,
        tokens: { prompt: 100, completion: 10, cached: null },
      }),
    ]);
    expect(report.groups[0].cachedShare).toBeNull();
  });

  it('can be limited to one model, and to a range of dates', () => {
    const rows = [
      trace({
        id: 'a',
        thread: 'ta',
        units: 1,
        at: '2026-10-01T00:00:00.000Z',
      }),
      trace({
        id: 'b',
        thread: 'tb',
        units: 2,
        model: 'vendor/model-b',
        at: '2026-10-10T00:00:00.000Z',
      }),
      trace({
        id: 'c',
        thread: 'tc',
        units: 3,
        at: '2026-10-20T00:00:00.000Z',
      }),
    ];
    expect(script.analyse(rows, { model: 'vendor/model-b' }).measured).toBe(1);
    const since = Date.UTC(2026, 9, 5);
    const until = Date.UTC(2026, 9, 20);
    expect(script.analyse(rows, { sinceMs: since }).measured).toBe(2);
    expect(script.analyse(rows, { untilMs: until }).measured).toBe(2);
    expect(
      script.analyse(rows, { sinceMs: since, untilMs: until }).measured
    ).toBe(1);
    // the end of the range is exclusive
    expect(
      script.analyse(rows, { untilMs: Date.UTC(2026, 9, 20) }).traces
    ).toBe(2);
  });

  it('lists the dearest requests first, by units and then by id, as many as asked', () => {
    const rows = [
      trace({ id: 'z', units: 900 }),
      trace({ id: 'a', units: 900 }),
      trace({ id: 'm', units: 100 }),
      trace({ id: 'x', units: 5_000 }),
    ];
    expect(
      script
        .analyse(rows, { outliers: 3 })
        .outliers.map((o: any) => o.requestId)
    ).toEqual(['x', 'a', 'z']);
    expect(script.analyse(rows, { outliers: 0 }).outliers).toEqual([]);
    expect(script.analyse(rows).outliers).toHaveLength(4);
  });

  it('is empty, not an error, for no traces', () => {
    expect(script.analyse([])).toMatchObject({
      traces: 0,
      measured: 0,
      groups: [],
      outliers: [],
    });
  });
});

describe('the proposal of ADR-073 is the number the TypeScript gives', () => {
  const prices = [29, 29.99, 49, 4.35, 10.000001, 100, 1, 0.5, 2000];
  const shares = [0.1, 0.25, 0.333333, 0.35, 0.5, 0.75, 1, 0.000001];

  it.each(prices.flatMap((p) => shares.map((s) => [p, s] as const)))(
    'price %p share %p',
    (priceUsd, share) => {
      const fromScript = script.proposal(priceUsd, share);
      const fromCode = proQuotaUnits({ priceUsd, share });
      expect(fromScript.ok).toBe(fromCode.ok);
      if (fromScript.ok && fromCode.ok)
        expect(fromScript.units).toBe(fromCode.units);
      if (!fromScript.ok && !fromCode.ok)
        expect(fromScript.code).toBe(fromCode.code);
    }
  );

  it.each([
    [0, 0.5],
    [-1, 0.5],
    [Number.NaN, 0.5],
    [29, 0],
    [29, 1.01],
    [29, Number.NaN],
    [3000, 1],
  ])(
    'refuses price %p share %p the way the TypeScript does',
    (priceUsd, share) => {
      const a = script.proposal(priceUsd, share);
      const b = proQuotaUnits({ priceUsd, share });
      expect(a.ok).toBe(false);
      expect(a.code).toBe((b as { code: string }).code);
    }
  );

  it('says how many messages an allowance buys at the median and the 90th percentile', () => {
    const report = script.analyse(TEN);
    expect(script.buys(report, 5_500_000)).toEqual([
      {
        kind: 'FIRST_MESSAGE',
        model: 'vendor/model-a',
        atP50: 11_000,
        atP90: 6_111,
      },
    ]);
  });

  it('does not divide by a median of zero', () => {
    const report = script.analyse([trace({ id: 'free', units: 0 })]);
    expect(script.buys(report, 1_000)).toEqual([
      {
        kind: 'FIRST_MESSAGE',
        model: 'vendor/model-a',
        atP50: null,
        atP90: null,
      },
    ]);
  });
});

describe('the command', () => {
  let dir: string;
  beforeAll(() => {
    dir = mkdtempSync(join(tmpdir(), 'measure-units-'));
  });
  afterAll(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  function io() {
    const out: string[] = [];
    const err: string[] = [];
    return {
      out,
      err,
      io: { out: (s: string) => out.push(s), err: (s: string) => err.push(s) },
    };
  }
  const file = (name: string, text: string): string => {
    const path = join(dir, name);
    writeFileSync(path, text);
    return path;
  };

  it('prints the help and exits 0', async () => {
    const c = io();
    expect(await script.main(['--help'], c.io)).toBe(0);
    expect(c.out.join('\n')).toMatch(/WHAT IT IS FOR/);
    expect(c.out.join('\n')).toMatch(/READ ONLY/);
    expect(c.out.join('\n')).toMatch(/--traces <file>/);
  });

  it('reads a JSON array, prints the tables and exits 0', async () => {
    const c = io();
    const path = file('array.json', JSON.stringify(TEN));
    expect(await script.main(['--traces', path], c.io)).toBe(0);
    const text = c.out.join('\n');
    expect(text).toMatch(/1 unit = 1 micro-dollar/);
    expect(text).toMatch(/traces read 10, written by a model 10, unreadable 0/);
    expect(text).toMatch(
      /FIRST_MESSAGE\s+vendor\/model-a\s+10\s+500\s+900\s+1000\s+1000\s+1000\s+550/
    );
    expect(text).toMatch(/PAID, NOT DELIVERED: 0 request/);
    expect(c.err).toEqual([]);
  });

  it('reads one JSON object a line, with a byte order mark and blank lines', async () => {
    const c = io();
    const body = `${TEN.map((r) => JSON.stringify(r)).join('\r\n\r\n')}\r\n`;
    const path = file('lines.ndjson', String.fromCharCode(0xfeff) + body);
    expect(await script.main(['--traces', path, '--json'], c.io)).toBe(0);
    expect(JSON.parse(c.out.join('\n')).measured).toBe(10);
  });

  it('prints a JSON document of the same figures, with the proposal null when none was asked for', async () => {
    const c = io();
    const path = file('json.json', JSON.stringify(TEN));
    expect(
      await script.main(['--traces', path, '--json', '--outliers', '2'], c.io)
    ).toBe(0);
    const doc = JSON.parse(c.out.join('\n'));
    expect(doc.groups[0].units.p.p50).toBe(500);
    expect(doc.outliers).toHaveLength(2);
    expect(doc.proposal).toBeNull();
  });

  it('with --price and --share prints the allowance and what it buys', async () => {
    const c = io();
    const path = file('price.json', JSON.stringify(TEN));
    expect(
      await script.main(
        ['--traces', path, '--price', '29', '--share', '0.35'],
        c.io
      )
    ).toBe(0);
    const text = c.out.join('\n');
    expect(text).toMatch(/PRO_MONTHLY_UNITS = 10150000/);
    expect(text).toMatch(/messages at p50/);
    expect(text).toMatch(/this script sets nothing/);
    const j = io();
    await script.main(
      ['--traces', path, '--price', '29', '--share', '0.35', '--json'],
      j.io
    );
    expect(JSON.parse(j.out.join('\n')).proposal).toMatchObject({
      units: 10_150_000,
      priceUsd: 29,
      share: 0.35,
    });
  });

  it('exits 1 when no trace was written by a model: nothing to measure', async () => {
    const c = io();
    const path = file(
      'empty.json',
      JSON.stringify([trace({ id: 'r', model: null, outcome: 'REFUSED' })])
    );
    expect(await script.main(['--traces', path], c.io)).toBe(1);
    const e = io();
    expect(await script.main(['--traces', file('none.json', '[]')], e.io)).toBe(
      1
    );
  });

  it.each([
    [[], /exactly one of --traces/],
    [['--db', '--traces', 'x'], /exactly one of --traces/],
    [['--traces'], /needs a value/],
    [['--traces', 'x', '--bogus'], /unknown option --bogus/],
    [['--traces', 'x', '--price', '29'], /--price and --share go together/],
    [['--traces', 'x', '--share', '0.5'], /--price and --share go together/],
    [['--traces', 'x', '--outliers', '-1'], /--outliers must be/],
    [['--traces', 'x', '--outliers', '1.5'], /--outliers must be/],
    [['--traces', 'x', '--outliers', '101'], /--outliers must be/],
    [['--traces', 'x', '--since', '2026-13-45'], /not a real date/],
    [['--traces', 'x', '--since', 'last week'], /must be a date/],
    [['--traces', 'x', '--until', '2026/10/01'], /must be a date/],
  ])('exits 2 for %j', async (argv, message) => {
    const c = io();
    expect(await script.main(argv as string[], c.io)).toBe(2);
    expect(c.err.join('\n')).toMatch(message);
    expect(c.out).toEqual([]);
  });

  it('exits 2 for a file that cannot be read or is not JSON', async () => {
    const missing = io();
    expect(
      await script.main(['--traces', join(dir, 'nope.json')], missing.io)
    ).toBe(2);
    expect(missing.err.join('\n')).toMatch(/could not read the traces/);
    const broken = io();
    expect(
      await script.main(['--traces', file('broken.json', '[{"a":')], broken.io)
    ).toBe(2);
    const notArray = io();
    expect(
      await script.main(
        ['--traces', file('line.ndjson', 'not json at all')],
        notArray.io
      )
    ).toBe(2);
  });

  it('exits 2 for an allowance it cannot use', async () => {
    const c = io();
    const path = file('big.json', JSON.stringify(TEN));
    expect(
      await script.main(
        ['--traces', path, '--price', '3000', '--share', '1'],
        c.io
      )
    ).toBe(2);
    expect(c.err.join('\n')).toMatch(/above the ledger bound/);
    const d = io();
    expect(
      await script.main(
        ['--traces', path, '--price', '0', '--share', '0.5'],
        d.io
      )
    ).toBe(2);
    expect(d.err.join('\n')).toMatch(/--price is not usable/);
  });

  it('prints no user id, hash, question or reply, whatever the rows hold', async () => {
    const c = io();
    const rows = TEN.map((r, i) => ({
      ...r,
      user_id: 'cm0secretuser00000000000001',
      user_id_hash: 'f'.repeat(64),
      reply_json: '{"answer":"the secret reply"}',
      request_group: { question: 'my secret question' },
      thread_id: `secret-thread-${i}`,
    }));
    const path = file('secret.json', JSON.stringify(rows));
    for (const flags of [[], ['--json']]) {
      c.out.length = 0;
      await script.main(['--traces', path, ...flags], c.io);
      const text = c.out.join('\n');
      expect(text).not.toMatch(
        /cm0secretuser|ffffffff|secret reply|secret question|secret-thread/
      );
    }
  });
});

describe('--db: read only', () => {
  beforeEach(() => {
    mockConnectError = null;
    mockQueries.length = 0;
    mockClientOptions.length = 0;
    mockRows = TEN;
  });

  const run = async (
    argv: string[],
    env: Record<string, string | undefined> = {}
  ) => {
    const out: string[] = [];
    const err: string[] = [];
    const code = await script.main(
      argv,
      { out: (s) => out.push(s), err: (s) => err.push(s) },
      env
    );
    return { code, out, err };
  };

  it('opens a READ ONLY transaction, runs the one SELECT with the range as parameters, and rolls back', async () => {
    const { code } = await run([
      '--db',
      '--url',
      'postgresql://u@127.0.0.1:5432/x',
      '--since',
      '2026-10-01',
      '--until',
      '2026-11-01',
    ]);
    expect(code).toBe(0);
    expect(mockQueries.map((q) => q.sql)).toEqual([
      'BEGIN READ ONLY',
      script.READ_SQL,
      'ROLLBACK',
    ]);
    expect(mockQueries[1]!.values).toEqual([
      '2026-10-01T00:00:00.000Z',
      '2026-11-01T00:00:00.000Z',
    ]);
  });

  it('the statement is a single SELECT of the trace table and nothing that writes', () => {
    expect(script.READ_SQL.trimStart().startsWith('SELECT')).toBe(true);
    expect(script.READ_SQL).not.toMatch(
      /\b(INSERT|UPDATE|DELETE|TRUNCATE|DROP|ALTER|CREATE|GRANT)\b/i
    );
    expect(script.READ_SQL).not.toContain(';');
    expect(script.READ_SQL).toContain('FROM "request_traces"');
    // it asks for no user column at all
    expect(script.READ_SQL).not.toMatch(
      /user_id|reply_json|report2|request_group/
    );
  });

  it('reads the URL from --url, else from DATABASE_PUBLIC_URL, and never from the pooled DATABASE_URL', async () => {
    await run(['--db'], {
      DATABASE_PUBLIC_URL: 'postgresql://u@127.0.0.1:5432/pub',
    });
    expect(mockClientOptions[0]!['connectionString']).toBe(
      'postgresql://u@127.0.0.1:5432/pub'
    );
    const none = await run(['--db'], {
      DATABASE_URL: 'postgresql://u@127.0.0.1:5432/pooled',
    });
    expect(none.code).toBe(2);
    expect(none.err.join('\n')).toMatch(/needs --url or DATABASE_PUBLIC_URL/);
    expect(mockClientOptions).toHaveLength(1);
  });

  it('uses TLS for a server that is not on this machine, and none for one that is', async () => {
    await run(['--db', '--url', 'postgresql://u:p@db.example.internal:5432/x']);
    await run(['--db', '--url', 'postgresql://u@localhost:5432/x']);
    expect(mockClientOptions[0]!['ssl']).toEqual({ rejectUnauthorized: false });
    expect(mockClientOptions[1]!['ssl']).toBeUndefined();
  });

  it('exits 2 when the database cannot be reached, without printing the password of the URL', async () => {
    mockConnectError = new Error('connect ECONNREFUSED 127.0.0.1:5432');
    try {
      const { code, err, out } = await run([
        '--db',
        '--url',
        'postgresql://user:hunter2@127.0.0.1:5432/x',
      ]);
      expect(code).toBe(2);
      expect(err.join(' ')).toMatch(
        /could not read the traces: connect ECONNREFUSED/
      );
      expect([...err, ...out].join(' ')).not.toContain('hunter2');
      expect(mockQueries).toEqual([]);
    } finally {
      mockConnectError = null;
    }
  });
});

describe('the script writes nothing', () => {
  const source = readFileSync(SCRIPT_PATH, 'utf8');
  const code = source.slice(source.indexOf('*/') + 2);

  it('uses no function of the file system that writes, and no statement that changes the database', () => {
    expect(code).not.toMatch(
      /writeFile|appendFile|createWriteStream|mkdir|unlink|rmSync|rename|copyFile/
    );
    expect(code).not.toMatch(/\b(INSERT|UPDATE|DELETE|TRUNCATE)\b/);
    expect(code).not.toMatch(/process\.env\.DATABASE_URL\b/);
  });

  it('says in its header that it is read only and what it prints', () => {
    expect(source).toMatch(/READ ONLY\. It only SELECTs/);
    expect(source).toMatch(
      /never prints a user id, a hash, a[\s*]+question or a reply/
    );
  });
});
