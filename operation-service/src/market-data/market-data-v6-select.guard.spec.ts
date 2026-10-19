import { readdirSync, readFileSync } from 'fs';
import { join, relative } from 'path';

import * as ts from 'typescript';

import { AlertCheckerService } from '../alert-engine/alert-checker.service';
import type { PrismaService } from '../prisma/prisma.service';
import { CENTROID_VARIANTS } from './market-data.schemas';
import { MarketDataService } from './market-data.service';

/**
 * The `market_data_v6` reads must not depend on columns they do not use.
 *
 * A Prisma read with no `select` asks the database for every column of the generated client. One
 * column added to the mirror schema before its migration is applied would then fail the channel
 * proxy (live behind `MIGRATE_MARKET_DATA_CHANNEL`) and send every XAUUSD alert check to Flask, the
 * way `User.deletedAt` broke sign-in on 2026-10-19. Three kinds of evidence, as in the monolith's
 * `__tests__/lib/db/market-data-v6-select-guard.test.ts`:
 *  1. a source guard: every `<x>.marketDataV6.<call>(...)` under `src/` names its columns;
 *  2. each variant's three channel columns are in this service's narrower mirror of the model (a
 *     `select` naming a field the client does not have is a Prisma error, not a `null`);
 *  3. both services run against a database that rejects a read with no `select`, or one naming a
 *     column the database does not have yet.
 */

const SRC = join(__dirname, '..');
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

interface MarketCall {
  line: number;
  method: string;
  hasSelect: boolean;
  hasOmitOrInclude: boolean;
}

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

function productionFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...productionFiles(full));
    else if (entry.name.endsWith('.ts') && !entry.name.endsWith('.spec.ts'))
      out.push(full);
  }
  return out;
}

/** The field names of this service's `model MarketDataV6` mirror. */
function mirrorColumns(): Set<string> {
  const schema = readFileSync(join(SRC, '../prisma/schema.prisma'), 'utf8');
  const block = /^model MarketDataV6 \{([\s\S]*?)^\}/m.exec(schema);
  if (!block) throw new Error('model MarketDataV6 not found');
  const columns = new Set<string>();
  for (const line of block[1]!.split('\n')) {
    const field = /^\s+([a-zA-Z_][a-zA-Z0-9_]*)\s+[A-Z]\w*\??(\s|$)/.exec(line);
    if (field) columns.add(field[1]!);
  }
  return columns;
}

describe('source guard: operation-service names the market_data_v6 columns it reads', () => {
  it('finds the violation in a snippet that has one (the scanner is not blind)', () => {
    const bad = `
      await this.prisma.marketDataV6.findMany({ where: { symbol }, take: 10 });
      await this.prisma.marketDataV6.findFirst({ where: { symbol }, omit: { id: true } });
      await this.prisma.marketDataV6.findFirst({ where: { symbol }, select: { close: true } });
    `;
    expect(
      marketCalls('bad.ts', bad).map((c) => [
        c.method,
        c.hasSelect,
        c.hasOmitOrInclude,
      ])
    ).toEqual([
      ['findMany', false, false],
      ['findFirst', false, true],
      ['findFirst', true, false],
    ]);
  });

  it('every market_data_v6 read under src/ has an explicit select', () => {
    const violations: string[] = [];
    const files = new Set<string>();
    for (const file of productionFiles(SRC)) {
      const rel = relative(SRC, file).replace(/\\/g, '/');
      for (const call of marketCalls(file, readFileSync(file, 'utf8'))) {
        files.add(rel);
        const where = `src/${rel}:${call.line} marketDataV6.${call.method}`;
        if (!call.hasSelect) violations.push(`${where}: no select`);
        if (call.hasOmitOrInclude)
          violations.push(`${where}: omit/include still lists every column`);
      }
    }
    expect([...files]).toEqual(
      expect.arrayContaining([
        'market-data/market-data.service.ts',
        'alert-engine/alert-checker.service.ts',
      ])
    );
    expect(violations).toEqual([]);
  });

  it("every variant's three channel columns are in the mirror schema", () => {
    const columns = mirrorColumns();
    expect(columns.has('timestamp')).toBe(true);
    expect(columns.has('close')).toBe(true);
    for (const variant of CENTROID_VARIANTS) {
      for (const suffix of ['uoedt', 'base_fl', 'loedt']) {
        const column = `${variant}_${suffix}`;
        expect(`${column} ${columns.has(column)}`).toBe(`${column} true`);
      }
    }
  });
});

describe('behaviour: against a database that lacks a column the code knows about', () => {
  /** A column the code knows about and the database does not have yet. */
  const MISSING_COLUMN = 'symbol_future_column';
  const calls: Array<Record<string, unknown>> = [];

  function strictRead(answer: (select: Record<string, true>) => unknown) {
    return jest.fn(async (args: Record<string, unknown>) => {
      calls.push(args);
      const select = args['select'] as Record<string, true> | undefined;
      if (!select || MISSING_COLUMN in select) {
        throw new Error(
          `The column market_data_v6.${MISSING_COLUMN} does not exist in the current database.`
        );
      }
      return answer(select);
    });
  }

  const row = (select: Record<string, true>): Record<string, number> => {
    const out: Record<string, number> = {};
    Object.keys(select).forEach((column, i) => {
      out[column] = column === 'timestamp' ? 100 : 1000 + i;
    });
    return out;
  };

  const prisma = {
    marketDataV6: {
      findMany: strictRead((select) => [row(select)]),
      findFirst: strictRead((select) => row(select)),
    },
  } as unknown as PrismaService;

  beforeEach(() => {
    calls.length = 0;
  });

  it('the strict database really rejects a read with no select (the test can fail)', async () => {
    await expect(
      prisma.marketDataV6.findMany({ where: { symbol: 'XAUUSD' } })
    ).rejects.toThrow(`market_data_v6.${MISSING_COLUMN} does not exist`);
  });

  it.each(CENTROID_VARIANTS.map((variant) => [variant]))(
    'the channel proxy answers the channel of %s',
    async (variant) => {
      const result = await new MarketDataService(prisma).getChannelData(
        'PRO',
        'XAUUSD',
        'M5',
        variant,
        300
      );
      expect(result.points).toEqual([
        { time: 100, upper: 1001, mid: 1002, lower: 1003 },
      ]);
      expect(Object.keys(calls[0]!['select'] as object)).toEqual([
        'timestamp',
        `${variant}_uoedt`,
        `${variant}_base_fl`,
        `${variant}_loedt`,
      ]);
    }
  );

  it('the alert checker still takes the XAUUSD price from market_data_v6, not Flask', async () => {
    const service = new AlertCheckerService(prisma) as unknown as {
      fetchXauusdPriceFromGatewayPipeline: (
        tf: string
      ) => Promise<number | null>;
    };
    await expect(
      service.fetchXauusdPriceFromGatewayPipeline('M5')
    ).resolves.toBe(1000);
    expect(calls[0]!['select']).toEqual({ close: true });
  });
});
