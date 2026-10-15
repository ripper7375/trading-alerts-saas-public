/** @jest-environment node */
/**
 * Dedicated scratch PostgreSQL only. Never reads DATABASE_URL, DIRECT_URL or Prisma config.
 * Example: WORLD_GOLD_PG_URL=postgres://postgres@127.0.0.1:55436/worldgold_test
 *          WORLD_GOLD_PG_ALLOW_WIPE=yes jest --runInBand postgres.test.ts
 * The explicit gate permits wiping only this migration's table/functions.
 */
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { Pool } from 'pg';
import {
  insertDerivedClose,
  readDerivedCloses,
  type WorldGoldSql,
} from '@/lib/world-gold/store';
import { MARKETS } from '@/lib/world-gold/catalog';
import type { DerivedClose } from '@/lib/world-gold/types';
import { closeFixture } from './fixtures';

jest.mock('@/lib/db/market-prisma', () => ({
  marketPrisma: {
    $queryRaw: jest.fn(),
    $executeRaw: jest.fn(),
    marketDataV6: { findFirst: jest.fn() },
  },
}));

const scratchUrl = process.env['WORLD_GOLD_PG_URL'];
const gatedDescribe =
  scratchUrl && process.env['WORLD_GOLD_PG_ALLOW_WIPE'] === 'yes'
    ? describe
    : describe.skip;
const now = new Date('2026-10-15T12:00:00Z');
const dropOwnObjects = `
  DROP TABLE IF EXISTS public.world_gold_closes;
  DROP FUNCTION IF EXISTS public.world_gold_close_immutable();
  DROP FUNCTION IF EXISTS public.world_gold_prices_valid(JSONB);
`;

gatedDescribe(
  'World gold dedicated PostgreSQL migration and immutable close store',
  () => {
    let pool: Pool | undefined;
    let scratchVerified = false;
    let sql: WorldGoldSql;
    function database(): Pool {
      if (!pool) throw new Error('Scratch PostgreSQL has not been initialized');
      return pool;
    }
    function tagged(strings: TemplateStringsArray): string {
      return strings.reduce(
        (text, chunk, index) =>
          `${text}${index === 0 ? '' : `$${index}`}${chunk}`,
        ''
      );
    }
    async function rawInsert(
      close: DerivedClose,
      replacements: Record<string, unknown> = {}
    ): Promise<void> {
      const epoch = (value: string): number =>
        Math.floor(Date.parse(value) / 1000);
      const row = {
        market_id: close.marketId,
        session_date: close.sessionDate,
        formula_version: close.formulaVersion,
        closed_at: epoch(close.closedAt),
        gold_bar_closed_at: epoch(close.goldBarClosedAt),
        fx_published_at: epoch(close.fxPublishedAt),
        fx_observed_at: epoch(close.fxObservedAt),
        prices: JSON.stringify(close.prices),
        ...replacements,
      };
      await database().query(
        `
      INSERT INTO public.world_gold_closes
        (market_id, session_date, formula_version, closed_at, gold_bar_closed_at, fx_published_at, fx_observed_at, prices)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb)
    `,
        [
          row.market_id,
          row.session_date,
          row.formula_version,
          row.closed_at,
          row.gold_bar_closed_at,
          row.fx_published_at,
          row.fx_observed_at,
          row.prices,
        ]
      );
    }
    beforeAll(async () => {
      // Refuse remote hosts and every database name except the dedicated scratch DB.
      // Validate before creating a connection, including when the explicit wipe gate is set.
      if (!scratchUrl) throw new Error('WORLD_GOLD_PG_URL is required');
      const target = new URL(scratchUrl);
      if (
        !['postgres:', 'postgresql:'].includes(target.protocol) ||
        !['localhost', '127.0.0.1', '[::1]'].includes(target.hostname) ||
        target.pathname !== '/worldgold_test' ||
        target.search ||
        target.hash
      ) {
        throw new Error(
          'World gold PostgreSQL tests require a localhost URL for the dedicated worldgold_test scratch database'
        );
      }
      pool = new Pool({
        connectionString: scratchUrl,
        max: 8,
        connectionTimeoutMillis: 3000,
      });
      const identity = await database().query<{
        database_name: string;
        server_address: string | null;
      }>(
        'SELECT current_database() AS database_name, host(inet_server_addr()) AS server_address'
      );
      expect(identity.rows[0]?.database_name).toBe('worldgold_test');
      expect(['127.0.0.1', '::1']).toContain(identity.rows[0]?.server_address);
      const existingTables = await database().query<{ tablename: string }>(
        "SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> 'world_gold_closes'"
      );
      expect(existingTables.rows).toEqual([]);
      scratchVerified = true;
      await database().query(dropOwnObjects);
      const migration = await readFile(
        path.join(
          process.cwd(),
          'prisma/migrations/20261015000000_add_world_gold_closes/migration.sql'
        ),
        'utf8'
      );
      await database().query(migration);
      sql = {
        query: async <T>(
          strings: TemplateStringsArray,
          ...values: unknown[]
        ): Promise<T> => {
          const result = await database().query(tagged(strings), values);
          return result.rows as T;
        },
        execute: async (
          strings: TemplateStringsArray,
          ...values: unknown[]
        ): Promise<number> => {
          const result = await database().query(tagged(strings), values);
          return result.rowCount ?? 0;
        },
      };
    }, 15000);
    beforeEach(async () => {
      if (scratchVerified)
        await database().query('TRUNCATE TABLE public.world_gold_closes');
    });
    afterAll(async () => {
      try {
        if (scratchVerified) await database().query(dropOwnObjects);
      } finally {
        await pool?.end();
      }
    });

    test('persists and reads every market without storing any raw FX input columns', async () => {
      const fixtures = MARKETS.map((market) => closeFixture(market.id));
      expect(
        await Promise.all(
          fixtures.map((close) => insertDerivedClose(close, sql))
        )
      ).toEqual(fixtures.map(() => true));
      const history = await readDerivedCloses(now, sql);
      expect(history.available).toBe(true);
      expect(history.closes).toHaveLength(10);
      expect(history.closes).toEqual(expect.arrayContaining(fixtures));
      const columns = await database().query<{ column_name: string }>(
        "SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'world_gold_closes' ORDER BY ordinal_position"
      );
      expect(columns.rows.map((row) => row.column_name)).toEqual([
        'market_id',
        'session_date',
        'formula_version',
        'closed_at',
        'gold_bar_closed_at',
        'fx_published_at',
        'fx_observed_at',
        'prices',
        'created_at',
      ]);
    });
    test('concurrent retried close writes insert exactly once and preserve the first values', async () => {
      const close = closeFixture();
      const outcomes = await Promise.all(
        Array.from({ length: 16 }, () => insertDerivedClose(close, sql))
      );
      expect(outcomes.filter(Boolean)).toHaveLength(1);
      expect(outcomes.filter((inserted) => !inserted)).toHaveLength(15);
      const changed = {
        ...close,
        prices: Object.fromEntries(
          Object.keys(close.prices).map((unit) => [unit, 999])
        ),
      };
      expect(await insertDerivedClose(changed, sql)).toBe(false);
      const history = await readDerivedCloses(now, sql);
      expect(history).toEqual({ available: true, closes: [close] });
      expect(
        (
          await database().query(
            'SELECT COUNT(*)::int AS count FROM public.world_gold_closes'
          )
        ).rows[0]?.count
      ).toBe(1);
    });
    test('the primary key also prevents duplicate writes that bypass the store', async () => {
      const close = closeFixture();
      await rawInsert(close);
      await expect(rawInsert(close)).rejects.toMatchObject({ code: '23505' });
    });
    test('database triggers reject updates and deletes while keeping the frozen close unchanged', async () => {
      const close = closeFixture();
      await insertDerivedClose(close, sql);
      await expect(
        database().query(
          'UPDATE public.world_gold_closes SET prices = \'{"oz": 999}\'::jsonb'
        )
      ).rejects.toMatchObject({ code: '55000' });
      await expect(
        database().query('DELETE FROM public.world_gold_closes')
      ).rejects.toMatchObject({ code: '55000' });
      expect(await readDerivedCloses(now, sql)).toEqual({
        available: true,
        closes: [close],
      });
    });
    test.each<[string, Record<string, unknown>]>([
      ['unknown market', { market_id: 'xx' }],
      ['malformed date', { session_date: '2026-1-14' }],
      ['impossible date', { session_date: '2026-02-30' }],
      ['empty formula version', { formula_version: '' }],
      ['overlong formula version', { formula_version: 'x'.repeat(65) }],
      ['negative close time', { closed_at: -1 }],
      ['negative gold time', { gold_bar_closed_at: -1 }],
      ['negative FX publication time', { fx_published_at: -1 }],
      ['empty price object', { prices: '{}' }],
      ['price array', { prices: '[100]' }],
      ['price scalar', { prices: '100' }],
      ['null price payload', { prices: 'null' }],
      ['null price value', { prices: '{"oz":null}' }],
      ['zero price', { prices: '{"oz":0}' }],
      ['negative price', { prices: '{"oz":-1}' }],
      ['text price', { prices: '{"oz":"100"}' }],
      ['boolean price', { prices: '{"oz":true}' }],
    ])(
      'migration rejects %s even when the application validator is bypassed',
      async (_label, replacements) => {
        await expect(
          rawInsert(closeFixture(), replacements)
        ).rejects.toMatchObject({
          code: expect.stringMatching(/^(23514|22007|22008)$/),
        });
      }
    );
    test.each([
      'future gold',
      'stale gold',
      'future FX observation',
      'reversed FX provenance',
      'stale FX',
    ])('migration rejects %s provenance', async (scenario) => {
      const close = closeFixture();
      const cutoff = Math.floor(Date.parse(close.closedAt) / 1000);
      const replacements: Record<string, number> = {
        ...(scenario === 'future gold'
          ? { gold_bar_closed_at: cutoff + 1 }
          : {}),
        ...(scenario === 'stale gold'
          ? { gold_bar_closed_at: cutoff - 901 }
          : {}),
        ...(scenario === 'future FX observation'
          ? { fx_observed_at: cutoff + 1 }
          : {}),
        ...(scenario === 'reversed FX provenance'
          ? { fx_published_at: cutoff - 1, fx_observed_at: cutoff - 2 }
          : {}),
        ...(scenario === 'stale FX' ? { fx_published_at: cutoff - 3901 } : {}),
      };
      await expect(rawInsert(close, replacements)).rejects.toMatchObject({
        code: '23514',
      });
    });
    test('store omits another formula version and malformed unit sets when reading persisted rows', async () => {
      const close = closeFixture();
      await rawInsert(close, { formula_version: 'previous-formula' });
      await rawInsert(close, { prices: '{"unrecognized-unit":100}' });
      expect(await readDerivedCloses(now, sql)).toEqual({
        available: true,
        closes: [],
      });
    });
  }
);
