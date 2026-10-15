/**
 * @jest-environment node
 */

/**
 * Edges of `scripts/reply/measure-units.js` that the mutation check found no test for (build step 7
 * part 6): exact percentiles at scale, rounding, ordering on ties and with the input in either
 * order, the default range of --db, every flag read in a row, the figures of the text report, the
 * indent of the JSON and the command run as a program.
 */

import { spawnSync } from 'child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join, resolve } from 'path';

import { proQuotaUnits } from '@/lib/reply/meter/units';

const mockQueries: { sql: string; values?: unknown[] }[] = [];
jest.mock('pg', () => ({
  Client: class {
    async connect() {}
    async query(sql: string, values?: unknown[]) {
      mockQueries.push({ sql, values });
      return { rows: [] };
    }
    async end() {}
  },
}));

const script = require('../../../../scripts/reply/measure-units.js') as {
  analyse: (rows: unknown[], options?: Record<string, unknown>) => any;
  buys: (report: any, units: number) => any[];
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

interface Row {
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
}

let seconds = 0;
const trace = (o: Row) => ({
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
    tokens: o.tokens ?? { prompt: 8000, completion: 1200, cached: 4000 },
    cost_micro_usd: o.cost === undefined ? (o.units ?? 0) : o.cost,
    fallback_used: o.fallback ?? false,
  },
  checks_group: { regenerations: o.regenerations ?? 0 },
});

describe('percentile and spread, at scale and at the edges', () => {
  const thousand = Array.from({ length: 1_000 }, (_v, i) => i + 1);

  it('over 1 to 1,000 the percentiles are the values of those ranks', () => {
    expect(script.percentile(thousand, 50)).toBe(500);
    expect(script.percentile(thousand, 90)).toBe(900);
    expect(script.percentile(thousand, 95)).toBe(950);
    expect(script.percentile(thousand, 99)).toBe(990);
    expect(script.percentile(thousand, 100)).toBe(1_000);
  });

  it('the 0th percentile is the smallest value, not the one before it', () => {
    expect(script.percentile([7, 8, 9], 0)).toBe(7);
    expect(script.percentile([7, 8, 9], 1)).toBe(7);
  });

  it('the mean is rounded to the nearest unit', () => {
    expect(script.spread([1, 2]).mean).toBe(2);
    expect(script.spread([1, 1, 2]).mean).toBe(1);
    expect(script.spread([1, 1, 1, 2]).mean).toBe(1);
    expect(script.spread([1, 2, 2]).mean).toBe(2);
  });
});

describe('the proposal agrees with the TypeScript at its edges', () => {
  const cases: [number, number][] = [
    [2_000.000001, 1],
    [2_000, 1],
    [0.000001, 1],
    [0.0000001, 0.5],
    [29, 0.0000001],
    [0.000249, 1],
    [1_000, 0.000249],
    [29, 1.0000001],
  ];
  it.each(cases)('price %p share %p', (priceUsd, share) => {
    const a = script.proposal(priceUsd, share);
    const b = proQuotaUnits({ priceUsd, share });
    expect(a.ok).toBe(b.ok);
    if (a.ok && b.ok) expect(a.units).toBe(b.units);
    if (!a.ok && !b.ok) expect(a.code).toBe(b.code);
  });

  it('a price of one micro-dollar is a price and an allowance of one unit is an allowance', () => {
    expect(script.proposal(0.000001, 1)).toEqual({ ok: true, units: 1 });
  });
});

describe('normalise does not fail on a column that is not an object', () => {
  it.each(['null', 'true', '5', '[1,2]', '"text"', 'not json', ''])(
    'a model_group of %j',
    (text) => {
      const row = script.normalise({
        ...trace({ id: 'a' }),
        model_group: text,
        checks_group: text,
      });
      expect(row).toMatchObject({
        requestId: 'a',
        costMicroUsd: null,
        promptTokens: null,
        regenerated: false,
      });
    }
  );

  it('a missing intent and outcome read as empty, and the row is a first message', () => {
    const { intent, outcome, ...rest } = trace({ id: 'a' });
    expect(intent).toBeDefined();
    expect(outcome).toBeDefined();
    const row = script.normalise(rest);
    expect(row).toMatchObject({ intent: '', outcome: '' });
    expect(script.analyse([rest]).groups[0].kind).toBe('FIRST_MESSAGE');
  });
});

describe('analyse: ties, order and rounding', () => {
  const at = '2026-10-15T10:00:00.000Z';

  it('two questions of one thread at one instant: the smaller request id is the first, whichever way they arrive', () => {
    for (const order of [
      ['tie-a', 'tie-b'],
      ['tie-b', 'tie-a'],
    ]) {
      const rows = order.map((id) =>
        trace({ id, thread: 'T', at, units: id === 'tie-a' ? 100 : 900 })
      );
      const groups = script.analyse(rows).groups;
      const first = groups.find((g: any) => g.kind === 'FIRST_MESSAGE');
      expect(first.units.max).toBe(100);
      expect(groups.find((g: any) => g.kind === 'FOLLOW_UP').units.max).toBe(
        900
      );
    }
  });

  it('the dearest requests of equal cost are ordered by request id, whichever way they arrive', () => {
    for (const ids of [
      ['a', 'z'],
      ['z', 'a'],
    ]) {
      const rows = ids.map((id) =>
        trace({ id, thread: `t-${id}`, units: 900 })
      );
      expect(
        script
          .analyse(rows, { outliers: 2 })
          .outliers.map((o: any) => o.requestId)
      ).toEqual(['a', 'z']);
    }
    expect(
      script
        .analyse(
          [
            trace({ id: 'low', thread: 't1', units: 5 }),
            trace({ id: 'high', thread: 't2', units: 50 }),
          ],
          { outliers: 2 }
        )
        .outliers.map((o: any) => o.requestId)
    ).toEqual(['high', 'low']);
  });

  it('lists five of the dearest by default', () => {
    const rows = Array.from({ length: 7 }, (_v, i) =>
      trace({ id: `r${i}`, thread: `t${i}`, units: 100 + i })
    );
    expect(script.analyse(rows).outliers).toHaveLength(5);
    expect(script.parseArgs(['--traces', 'x']).outliers).toBe(5);
  });

  it('the groups are in a fixed order whichever way the rows come: kind first, then model by name', () => {
    const rows = [
      trace({ id: '1', thread: 't1', model: 'vendor/c', units: 1 }),
      trace({ id: '2', thread: 't2', model: 'vendor/a', units: 1 }),
      trace({ id: '3', thread: 't3', model: 'vendor/b', units: 1 }),
      trace({
        id: '4',
        intent: 'INSTANT_M5_INSPECT',
        model: 'vendor/a',
        units: 1,
      }),
      trace({
        id: '5',
        thread: 't2',
        model: 'vendor/a',
        units: 1,
        at: '2026-10-16T00:00:00.000Z',
      }),
    ];
    for (const ordered of [rows, [...rows].reverse()]) {
      expect(
        script.analyse(ordered).groups.map((g: any) => `${g.kind}|${g.model}`)
      ).toEqual([
        'FIRST_MESSAGE|vendor/a',
        'FIRST_MESSAGE|vendor/b',
        'FIRST_MESSAGE|vendor/c',
        'FOLLOW_UP|vendor/a',
        'INSTANT|vendor/a',
      ]);
    }
  });

  it('a trace exactly at the start of the range is in it', () => {
    const rows = [
      trace({
        id: 'a',
        thread: 'ta',
        units: 1,
        at: '2026-10-05T00:00:00.000Z',
      }),
    ];
    expect(
      script.analyse(rows, { sinceMs: Date.UTC(2026, 9, 5) }).measured
    ).toBe(1);
  });

  it('the cost is null when no request said what it cost', () => {
    const report = script.analyse([
      trace({ id: '1', thread: 't1', units: 5, cost: null }),
      trace({ id: '2', thread: 't2', units: 5, cost: null }),
    ]);
    expect(report.groups[0]).toMatchObject({
      costMicroUsd: null,
      costKnown: 0,
    });
  });

  it('the shares are rounded to three places: two thirds is 0.667', () => {
    const rows = [
      trace({
        id: '1',
        thread: 't1',
        units: 1,
        tokens: { prompt: 3, completion: 1, cached: 2 },
        regenerations: 1,
        fallback: true,
      }),
      trace({
        id: '2',
        thread: 't2',
        units: 1,
        tokens: { prompt: 3, completion: 1, cached: 0 },
        regenerations: 1,
        fallback: true,
      }),
      trace({
        id: '3',
        thread: 't3',
        units: 1,
        tokens: { prompt: 3, completion: 1, cached: 0 },
      }),
    ];
    // cached 2 of 9 prompt tokens; regenerated and fallback 2 of 3
    expect(script.analyse(rows).groups[0]).toMatchObject({
      cachedShare: 0.222,
      regeneratedShare: 0.667,
      fallbackShare: 0.667,
    });
    const two = script.analyse([
      trace({
        id: '1',
        thread: 't1',
        units: 1,
        tokens: { prompt: 3, completion: 1, cached: 2 },
      }),
    ]);
    expect(two.groups[0].cachedShare).toBe(0.667);
  });

  it('even one unit spent with no model reply is counted as paid and not delivered', () => {
    const report = script.analyse([
      trace({ id: 'x', model: null, outcome: 'ERROR', units: 1 }),
      trace({ id: 'y', model: null, units: 0 }),
    ]);
    expect(report.paidNotDelivered).toEqual({ n: 1, units: 1 });
  });
});

/** Every order of a list. */
function permutations<T>(items: T[]): T[][] {
  if (items.length <= 1) return [items];
  return items.flatMap((item, i) =>
    permutations([...items.slice(0, i), ...items.slice(i + 1)]).map((rest) => [
      item,
      ...rest,
    ])
  );
}

describe('every ordering rule gives one answer from every arrival order', () => {
  const at = '2026-10-15T10:00:00.000Z';

  it('four questions of one thread at one instant: the request ids, in order, whichever order they arrive', () => {
    for (const order of permutations(['a', 'b', 'c', 'd'])) {
      const rows = order.map((id) =>
        trace({ id, thread: 'T', at, units: id.charCodeAt(0) })
      );
      const kinds = script.analyse(rows).groups;
      expect(kinds.find((g: any) => g.kind === 'FIRST_MESSAGE').units.max).toBe(
        'a'.charCodeAt(0)
      );
      expect(kinds.find((g: any) => g.kind === 'FOLLOW_UP').n).toBe(3);
    }
  });

  it('five requests of equal cost: the dearest list is in order of request id, from any arrival order', () => {
    for (const order of permutations(['c', 'a', 'e', 'b', 'd'])) {
      const rows = order.map((id) =>
        trace({ id, thread: `t-${id}`, units: 500 })
      );
      expect(
        script
          .analyse(rows, { outliers: 5 })
          .outliers.map((o: any) => o.requestId)
      ).toEqual(['a', 'b', 'c', 'd', 'e']);
    }
  });

  it('three models in each of two kinds: the kind first, then the model name, from any arrival order', () => {
    const base = [
      trace({ id: '1', thread: 't1', model: 'vendor/c' }),
      trace({ id: '2', thread: 't2', model: 'vendor/a' }),
      trace({ id: '3', thread: 't3', model: 'vendor/b' }),
      trace({ id: '4', intent: 'INSTANT_M5_INSPECT', model: 'vendor/b' }),
      trace({ id: '5', intent: 'INSTANT_M15_INSPECT', model: 'vendor/a' }),
    ];
    for (const order of permutations(base)) {
      expect(
        script.analyse(order).groups.map((g: any) => `${g.kind}|${g.model}`)
      ).toEqual([
        'FIRST_MESSAGE|vendor/a',
        'FIRST_MESSAGE|vendor/b',
        'FIRST_MESSAGE|vendor/c',
        'INSTANT|vendor/a',
        'INSTANT|vendor/b',
      ]);
    }
  });

  it('a share of all is exactly one: every request regenerated, fell back and was cached', () => {
    const rows = ['1', '2', '3'].map((id) =>
      trace({
        id,
        thread: `t${id}`,
        units: 1,
        regenerations: 1,
        fallback: true,
        tokens: { prompt: 10, completion: 1, cached: 10 },
      })
    );
    expect(script.analyse(rows).groups[0]).toMatchObject({
      regeneratedShare: 1,
      fallbackShare: 1,
      cachedShare: 1,
    });
  });
});

describe('what an allowance buys', () => {
  it('is the allowance over the median and over the 90th percentile, cut down; a median of one is a median', () => {
    const one = script.analyse([trace({ id: 'a', thread: 't', units: 1 })]);
    expect(script.buys(one, 7)).toEqual([
      { kind: 'FIRST_MESSAGE', model: 'vendor/model-a', atP50: 7, atP90: 7 },
    ]);
    const three = script.analyse([trace({ id: 'a', thread: 't', units: 3 })]);
    expect(script.buys(three, 10)[0]).toMatchObject({ atP50: 3, atP90: 3 });
  });
});

describe('the command', () => {
  let dir: string;
  beforeAll(() => {
    dir = mkdtempSync(join(tmpdir(), 'measure-units-edges-'));
  });
  afterAll(() => {
    rmSync(dir, { recursive: true, force: true });
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
  const file = (name: string, rows: unknown[]) => {
    const path = join(dir, name);
    writeFileSync(path, JSON.stringify(rows));
    return path;
  };

  it('reads every flag in a row', () => {
    const options = script.parseArgs([
      '--traces',
      'f.json',
      '--url',
      'u',
      '--since',
      '2026-10-01',
      '--until',
      '2026-11-01',
      '--model',
      'vendor/m',
      '--outliers',
      '3',
      '--price',
      '29',
      '--share',
      '0.5',
      '--json',
    ]);
    expect(options).toMatchObject({
      traces: 'f.json',
      url: 'u',
      since: '2026-10-01',
      until: '2026-11-01',
      model: 'vendor/m',
      outliers: 3,
      price: 29,
      share: 0.5,
      json: true,
    });
    expect(script.parseArgs(['-h']).help).toBe(true);
    expect(script.parseArgs(['--help']).help).toBe(true);
  });

  it('--outliers takes 0 and 100, and refuses what is outside them', () => {
    expect(
      script.parseArgs(['--traces', 'f', '--outliers', '0']).outliers
    ).toBe(0);
    expect(
      script.parseArgs(['--traces', 'f', '--outliers', '100']).outliers
    ).toBe(100);
    expect(() =>
      script.parseArgs(['--traces', 'f', '--outliers', '101'])
    ).toThrow(/--outliers/);
    expect(() =>
      script.parseArgs(['--traces', 'f', '--outliers', '-1'])
    ).toThrow(/--outliers/);
  });

  it('--db without a range reads everything: from 1970 to the year 9000', async () => {
    mockQueries.length = 0;
    await run(['--db', '--url', 'postgresql://u@127.0.0.1:5432/x']);
    expect(mockQueries[1]!.values).toEqual([
      '1970-01-01T00:00:00.000Z',
      '9000-01-01T00:00:00.000Z',
    ]);
  });

  it('prints the JSON with an indent of two spaces', async () => {
    const path = file('indent.json', [
      trace({ id: 'a', thread: 't', units: 5 }),
    ]);
    const { out } = await run(['--traces', path, '--json']);
    expect(out[0]).toContain('\n  "traces": 1');
    // exactly the text JSON.stringify makes with an indent of two: no other indent, no compact form
    expect(out[0]).toBe(JSON.stringify(JSON.parse(out[0] as string), null, 2));
  });

  it('prints an unknown figure as a dash, and money with six decimals', async () => {
    const path = file('text.json', [
      trace({
        id: 'a',
        thread: 't',
        units: 5,
        tokens: { prompt: null, completion: null, cached: null },
        cost: null,
      }),
      trace({ id: 'b', model: null, outcome: 'ERROR', units: 375 }),
    ]);
    const { out } = await run(['--traces', path]);
    const text = out.join('\n');
    expect(text).toMatch(
      /PAID, NOT DELIVERED: 1 request\(s\), 375 units \(\$0\.000375\)/
    );
    // the token table: four unknown percentiles, an unknown cached share, no cost known
    expect(text).toMatch(
      /FIRST_MESSAGE\s+vendor\/model-a\s+-\s+-\s+-\s+-\s+-\s+0\/1/
    );
  });

  describe('run as a program', () => {
    const program = (args: string[]) =>
      spawnSync(process.execPath, [SCRIPT_PATH, ...args], {
        encoding: 'utf8',
        windowsHide: true,
        timeout: 60_000,
      });

    it('--help exits 0 and prints the text', () => {
      const result = program(['--help']);
      expect(result.status).toBe(0);
      expect(result.stdout).toMatch(/WHAT IT IS FOR/);
    });

    it('no argument exits 2 with a message on the error stream and nothing on the output', () => {
      const result = program([]);
      expect(result.status).toBe(2);
      expect(result.stderr).toMatch(/exactly one of --traces/);
      expect(result.stdout).toBe('');
    });

    it('a file of traces exits 0, and one with nothing measured exits 1', () => {
      const good = program([
        '--traces',
        file('prog.json', [trace({ id: 'a', thread: 't', units: 5 })]),
        '--json',
      ]);
      expect(good.status).toBe(0);
      expect(JSON.parse(good.stdout).measured).toBe(1);
      const empty = program(['--traces', file('empty.json', [])]);
      expect(empty.status).toBe(1);
    });
  });
});
