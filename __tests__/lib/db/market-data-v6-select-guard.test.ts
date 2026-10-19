/**
 * @jest-environment node
 */
/**
 * The monolith's `market_data_v6` reads must not depend on columns they do not use.
 *
 * A Prisma read with no `select` asks the database for every column of the generated client:
 * over a hundred on `MarketDataV6`. One indicator column added to the schema before its migration
 * is applied would then fail every such read ("The column ... does not exist in the current
 * database"), the same way `User.deletedAt` broke sign-in on 2026-10-19
 * (`.claude/architecture/database-traps.md`). With a `select`, only a read that really uses the
 * new column can fail on it.
 *
 * Three kinds of evidence:
 *  1. A source guard: every `<x>.marketDataV6.<call>(...)` under `app/` and `lib/` names its columns.
 *  2. The channel columns each source names are real `MarketDataV6` columns (a `select` with a
 *     misspelt column is a Prisma error, where a whole-row read only gave `null`).
 *  3. Behaviour: the channel route, for every channel source, against a database that REJECTS a
 *     read that does not name its columns, or that names a column the database does not have yet.
 */

import fs from 'fs';
import path from 'path';

import ts from 'typescript';

import {
  CHANNEL_SOURCES,
  channelColumns,
} from '@/lib/active-indicator/sources';

const ROOT = process.cwd();

const PRISMA_METHODS = new Set([
  'findUnique',
  'findUniqueOrThrow',
  'findFirst',
  'findFirstOrThrow',
  'findMany',
  'create',
  'createManyAndReturn',
  'update',
  'updateManyAndReturn',
  'upsert',
  'delete',
]);

function sourceFilesUnder(relDir: string): string[] {
  const out: string[] = [];
  const walk = (dir: string): void => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (/\.tsx?$/.test(entry.name)) out.push(full);
    }
  };
  walk(path.join(ROOT, relDir));
  return out;
}

interface MarketCall {
  line: number;
  method: string;
  hasSelect: boolean;
  hasOmitOrInclude: boolean;
}

/** Every `<anything>.marketDataV6.<prisma method>(...)` in a source text. */
function marketCalls(fileName: string, text: string): MarketCall[] {
  const sf = ts.createSourceFile(fileName, text, ts.ScriptTarget.Latest, true);
  const calls: MarketCall[] = [];
  const visit = (node: ts.Node): void => {
    if (
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression) &&
      PRISMA_METHODS.has(node.expression.name.text) &&
      ts.isPropertyAccessExpression(node.expression.expression) &&
      node.expression.expression.name.text === 'marketDataV6'
    ) {
      const arg = node.arguments[0];
      const names =
        arg && ts.isObjectLiteralExpression(arg)
          ? arg.properties.map((p) => p.name?.getText(sf))
          : [];
      calls.push({
        line: sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1,
        method: node.expression.name.text,
        hasSelect: names.includes('select'),
        hasOmitOrInclude: names.includes('omit') || names.includes('include'),
      });
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return calls;
}

/** The field names of `model MarketDataV6` (no field has an `@map`, so they are the column names). */
function schemaColumns(): Set<string> {
  const schema = fs.readFileSync(
    path.join(ROOT, 'prisma/market-data/schema.prisma'),
    'utf8'
  );
  const block = /^model MarketDataV6 \{([\s\S]*?)^\}/m.exec(schema);
  if (!block) throw new Error('model MarketDataV6 not found');
  const columns = new Set<string>();
  for (const line of block[1]!.split('\n')) {
    const field = /^\s+([a-zA-Z_][a-zA-Z0-9_]*)\s+[A-Z]\w*\??(\s|$)/.exec(line);
    if (field) columns.add(field[1]!);
  }
  return columns;
}

describe('source guard: the monolith names the market_data_v6 columns it reads', () => {
  const guarded = [...sourceFilesUnder('app'), ...sourceFilesUnder('lib')];
  const rel = (file: string): string =>
    path.relative(ROOT, file).replace(/\\/g, '/');

  it('finds the violation in a snippet that has one (the scanner is not blind)', () => {
    const bad = `
      await marketPrisma.marketDataV6.findMany({ where: { symbol }, take: 10 });
      await client.marketDataV6.findFirst({ where: { symbol }, omit: { id: true } });
      await this.prisma.marketDataV6.findUnique({ where: { id }, select: { close: true } });
      await prisma.marketDataV6.count({ where: { symbol } });
    `;
    const calls = marketCalls('bad.ts', bad);
    expect(
      calls.map((c) => [c.method, c.hasSelect, c.hasOmitOrInclude])
    ).toEqual([
      ['findMany', false, false],
      ['findFirst', false, true],
      ['findUnique', true, false],
      // count returns a number, not a row: it is not a whole-row read
    ]);
  });

  it('every market_data_v6 read under app/ and lib/ has an explicit select', () => {
    const violations: string[] = [];
    const files = new Set<string>();
    for (const file of guarded) {
      for (const call of marketCalls(file, fs.readFileSync(file, 'utf8'))) {
        files.add(rel(file));
        const where = `${rel(file)}:${call.line} marketDataV6.${call.method}`;
        if (!call.hasSelect) violations.push(`${where}: no select`);
        if (call.hasOmitOrInclude)
          violations.push(`${where}: omit/include still lists every column`);
      }
    }
    // the guard is looking at the readers it is meant to (not an empty glob)
    expect([...files]).toEqual(
      expect.arrayContaining([
        'app/api/market-data/channel/route.ts',
        'lib/engine4/read/bars.ts',
        'lib/reply/read/day-bars.ts',
        'lib/world-gold/store.ts',
      ])
    );
    expect(violations).toEqual([]);
  });

  it('every channel source names three real MarketDataV6 columns', () => {
    const columns = schemaColumns();
    expect(columns.size).toBeGreaterThan(100);
    expect(columns.has('timestamp')).toBe(true);
    for (const source of CHANNEL_SOURCES) {
      const { upper, mid, lower } = channelColumns(source);
      for (const column of [upper, mid, lower]) {
        expect(`${source}: ${column} ${columns.has(column)}`).toBe(
          `${source}: ${column} true`
        );
      }
    }
  });
});

// ─── Behaviour ───────────────────────────────────────────────────────────────

/** A column the code knows about and the database does not have yet. */
const MISSING_COLUMN = 'zigzag_category';

const strictCalls: Array<Record<string, unknown>> = [];

/** Reads fail like Prisma and Postgres would: a whole-row read, or a column that is not there. */
jest.mock('@/lib/db/market-prisma', () => ({
  __esModule: true,
  marketPrisma: {
    marketDataV6: {
      findMany: jest.fn(async (args: Record<string, unknown>) => {
        strictCalls.push(args);
        const select = args['select'] as Record<string, true> | undefined;
        const missing = (): Error =>
          new Error(
            `The column market_data_v6.${MISSING_COLUMN} does not exist in the current database.`
          );
        if (!select) throw missing();
        if (MISSING_COLUMN in select) throw missing();
        const row: Record<string, number> = {};
        Object.keys(select).forEach((column, i) => {
          row[column] = column === 'timestamp' ? 100 : 1000 + i;
        });
        return [row];
      }),
    },
  },
}));

const mockGetServerSession = jest.fn();
jest.mock('next-auth', () => ({
  __esModule: true,
  getServerSession: (...args: unknown[]) => mockGetServerSession(...args),
}));
jest.mock('@/lib/auth/auth-options', () => ({
  __esModule: true,
  authOptions: {},
}));
jest.mock('next/server', () => ({
  __esModule: true,
  NextResponse: {
    json: (data: unknown, init?: { status?: number }) => ({
      json: async () => data,
      status: init?.status ?? 200,
    }),
  },
}));
jest.mock('@/lib/operation-service/flags', () => ({
  __esModule: true,
  shouldUseOperationServiceForMarketDataChannel: () => false,
}));

let activeSource: string | null = null;
jest.mock('@/lib/active-indicator/flags', () => ({
  __esModule: true,
  shouldResolveActiveIndicatorFromGateway: () => activeSource !== null,
}));
jest.mock('@/lib/active-indicator/resolve', () => ({
  __esModule: true,
  resolveActiveChannel: async () => ({
    source: activeSource,
    effectiveSlot: 0,
    resolvedAtSlot: 0,
    basis: 'CYCLE',
  }),
}));

import { marketPrisma } from '@/lib/db/market-prisma';

describe('behaviour: the channel route against a database that lacks a column the code knows about', () => {
  beforeEach(() => {
    strictCalls.length = 0;
    activeSource = null;
    mockGetServerSession.mockResolvedValue({
      user: { id: 'user-1', tier: 'PRO' },
    });
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
  });
  afterEach(() => jest.restoreAllMocks());

  async function call(query: string): Promise<{
    status: number;
    data: { success: boolean; points?: unknown[] };
  }> {
    const { GET } = await import('@/app/api/market-data/channel/route');
    const response = (await GET({
      url: `http://localhost/api/market-data/channel${query}`,
    } as never)) as unknown as {
      status: number;
      json: () => Promise<{ success: boolean; points?: unknown[] }>;
    };
    return { status: response.status, data: await response.json() };
  }

  it('the strict database really rejects a read with no select (the test can fail)', async () => {
    await expect(
      marketPrisma.marketDataV6.findMany({
        where: { symbol: 'XAUUSD' },
      } as never)
    ).rejects.toThrow(`market_data_v6.${MISSING_COLUMN} does not exist`);
  });

  it.each(CHANNEL_SOURCES.map((source) => [source]))(
    'answers 200 with the channel of %s (the active setting)',
    async (source) => {
      activeSource = source;
      const { status, data } = await call('?timeframe=M5');
      expect(status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.points).toEqual([
        { time: 100, upper: 1001, mid: 1002, lower: 1003 },
      ]);
      const { upper, mid, lower } = channelColumns(source);
      expect(strictCalls).toHaveLength(1);
      expect(Object.keys(strictCalls[0]!['select'] as object)).toEqual([
        'timestamp',
        upper,
        mid,
        lower,
      ]);
    }
  );

  it('answers 200 for a variant asked in the query string (the setting is off)', async () => {
    const { status, data } = await call('?timeframe=M15&variant=cherry_b');
    expect(status).toBe(200);
    expect(data.points).toHaveLength(1);
  });
});
