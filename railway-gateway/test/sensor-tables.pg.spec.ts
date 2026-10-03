/**
 * The three Stack D chapter 2 tables against a REAL Postgres (build step 3, part 2):
 * mcd_outputs, market_cycle_inputs, state_statistics, as created by
 * prisma/migrations/20261003000000_add_sensor_tables/migration.sql.
 *
 * `schema-sync.spec.ts` compares files. This spec shows what the database does with
 * them: the unique keys, the CHECK constraints Prisma cannot see (no number below
 * n = 30, no row for a flag that is off, no NULL reason list), a Bytes round trip,
 * an idempotent write and an atomic one, written through the real Prisma client the
 * way the sensor worker (part 4) will.
 *
 * SKIPPED unless BOTH are set:
 *   CYCLE_PG_URL         a postgres URL on localhost or 127.0.0.1 (anything else is refused)
 *   CYCLE_PG_ALLOW_WIPE  "yes": it DELETES every row of mcd_outputs, market_cycle_inputs and
 *                        state_statistics in that database
 *
 * To run it on a throwaway database (see database-traps.md):
 *   1. start any local Postgres (`npx prisma dev --detach --name <x>` and its direct TCP URL,
 *      or a scratch cluster from `initdb` on a high port) and create an empty database;
 *   2. apply the MIGRATION FILE itself, not a `migrate diff` of the schema: the diff has no
 *      CHECK constraints, and the first test below fails if they are missing:
 *      `psql -v ON_ERROR_STOP=1 -d <db> -f prisma/migrations/20261003000000_add_sensor_tables/migration.sql`
 *      (or run the file with `pg`);
 *   3. CYCLE_PG_URL=<that url> CYCLE_PG_ALLOW_WIPE=yes npx jest test/sensor-tables.pg.spec.ts
 *   4. stop and remove the instance.
 */
import { createHash } from 'crypto';
import { gunzipSync, gzipSync } from 'zlib';
import { PrismaService } from '../src/prisma/prisma.service';

const URL = process.env['CYCLE_PG_URL'] ?? '';
const enabled = URL !== '' && process.env['CYCLE_PG_ALLOW_WIPE'] === 'yes';
if (
  enabled &&
  !/^postgres(ql)?:\/\/[^@]*@(localhost|127\.0\.0\.1):\d+\//.test(URL)
) {
  throw new Error('CYCLE_PG_URL must point at localhost or 127.0.0.1');
}
const suite = enabled ? describe : describe.skip;

const SLOT = 1790000100; // a multiple of 300
const sha256 = (text: string) =>
  createHash('sha256').update(text).digest('hex');

/** What the database said when it refused a write: Prisma's error code and message. */
async function refusal(
  write: Promise<unknown>
): Promise<{ code: string | undefined; message: string }> {
  try {
    await write;
  } catch (error) {
    const e = error as { code?: string; message?: string };
    return { code: e.code, message: String(e.message) };
  }
  throw new Error('expected the database to refuse this write, but it did not');
}

// Every measured column of state_statistics (all NULL unless n >= 30).
const MEASURED = [
  'forward_move_median',
  'forward_move_q1',
  'forward_move_q3',
  'opposing_level_rate',
  'adverse_excursion_median',
  'adverse_excursion_q3',
] as const;

const series = (over: Record<string, unknown> = {}) => ({
  mcd_id: 'MCD2',
  evaluator_version_series: '2.0',
  config_hash_key: '{"best_fit_a":"h1"}',
  state_code: 'MCD2_UP_IN_CORRIDOR',
  horizon_hours: 2,
  n: 30,
  series_notes: 'FORMING_BAR_FIT: UNVERIFIED',
  ...over,
});

const ENVELOPE_TEXT =
  '{"bias":"LONG","commentary":"M5 uptrend 12.5° above the baseline","mcd_id":"MCD2","status":"VALID"}';

const reading = (over: Record<string, unknown> = {}) => ({
  symbol: 'XAUUSD',
  cycle_slot: SLOT,
  mcd_id: 'MCD2',
  flag: 'shadow',
  evaluator_version: '2.0.1',
  status: 'VALID',
  state_code: 'MCD2_UP_IN_CORRIDOR',
  bias: 'LONG',
  envelope_json: ENVELOPE_TEXT,
  envelope: JSON.parse(ENVELOPE_TEXT),
  envelope_sha256: sha256(ENVELOPE_TEXT),
  evaluator_envelope_sha256: sha256(ENVELOPE_TEXT),
  inputs_sha256: 'a'.repeat(64),
  retuning_observed: false,
  retuning_applied: false,
  runner_version: '1.0.0',
  python_version: '3.11.9',
  duration_ms: 5.25,
  evaluated_at: SLOT + 31,
  ...over,
});

suite('the sensor tables on a real Postgres', () => {
  jest.setTimeout(120_000);
  let prisma: PrismaService;

  beforeAll(async () => {
    process.env['DATABASE_URL'] = URL;
    prisma = new PrismaService();
    await prisma.$connect();
  });
  afterAll(async () => {
    await prisma.$disconnect();
  });
  beforeEach(async () => {
    await prisma.$executeRawUnsafe('DELETE FROM mcd_outputs');
    await prisma.$executeRawUnsafe('DELETE FROM market_cycle_inputs');
    await prisma.$executeRawUnsafe('DELETE FROM state_statistics');
  });

  it('was made from the migration file: the three tables and the three CHECK constraints exist', async () => {
    const tables = await prisma.$queryRawUnsafe<{ table_name: string }[]>(
      `SELECT table_name FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name IN ('mcd_outputs', 'market_cycle_inputs', 'state_statistics')
        ORDER BY 1`
    );
    expect(tables.map((t) => t.table_name)).toEqual([
      'market_cycle_inputs',
      'mcd_outputs',
      'state_statistics',
    ]);
    const checks = await prisma.$queryRawUnsafe<{ conname: string }[]>(
      `SELECT conname FROM pg_constraint
        WHERE contype = 'c' AND connamespace = 'public'::regnamespace
          AND conname IN ('state_statistics_n_gate', 'mcd_outputs_flag_is_shadow_or_live',
                          'mcd_outputs_reason_lists_not_null')
        ORDER BY 1`
    );
    expect(checks.map((c) => c.conname)).toEqual([
      'mcd_outputs_flag_is_shadow_or_live',
      'mcd_outputs_reason_lists_not_null',
      'state_statistics_n_gate',
    ]);
  });

  describe('state_statistics: no number below n = 30 (ADR-022)', () => {
    it.each(MEASURED)(
      'n = 29 with %s set is refused by the database',
      async (column) => {
        const outcome = await refusal(
          prisma.stateStatistic.create({
            data: series({ n: 29, [column]: 1.5 }) as never,
          })
        );
        expect(outcome.message).toContain('state_statistics_n_gate');
        expect(await prisma.stateStatistic.count()).toBe(0);
      }
    );

    it('n = 29 with every measured column set is refused, and n = 30 with every one set is accepted', async () => {
      const all = Object.fromEntries(MEASURED.map((c) => [c, 1.5]));
      await refusal(
        prisma.stateStatistic.create({
          data: series({ n: 29, ...all }) as never,
        })
      );
      const accepted = await prisma.stateStatistic.create({
        data: series({ n: 30, ...all }) as never,
      });
      expect(accepted.n).toBe(30);
      expect(accepted.forward_move_median).toBe(1.5);
    });

    it('n = 29 with no number is accepted: a state below 30 keeps its count and nothing else', async () => {
      const row = await prisma.stateStatistic.create({
        data: series({ n: 29 }) as never,
      });
      expect(row.n).toBe(29);
      for (const column of MEASURED) expect(row[column]).toBeNull();
    });

    it('n = 30 with no number is accepted: the gate allows a number at 30, it does not demand one', async () => {
      const row = await prisma.stateStatistic.create({
        data: series({ n: 30 }) as never,
      });
      expect(row.n).toBe(30);
      expect(row.opposing_level_rate).toBeNull();
    });

    it('n = 0 with a number is refused', async () => {
      await refusal(
        prisma.stateStatistic.create({
          data: series({ n: 0, forward_move_q1: 1 }) as never,
        })
      );
    });

    it('the gate also holds on update: a row cannot drop below 30 and keep its number', async () => {
      const row = await prisma.stateStatistic.create({
        data: series({ n: 30, forward_move_median: 2 }) as never,
      });
      const outcome = await refusal(
        prisma.stateStatistic.update({ where: { id: row.id }, data: { n: 29 } })
      );
      expect(outcome.message).toContain('state_statistics_n_gate');
      expect(
        (await prisma.stateStatistic.findUnique({ where: { id: row.id } }))!.n
      ).toBe(30);
    });

    it('a series is recomputed in place: the same key upserts from a bare count to numbers as n grows', async () => {
      const where = {
        mcd_id_evaluator_version_series_config_hash_key_state_code_horizon_hours:
          {
            mcd_id: 'MCD2',
            evaluator_version_series: '2.0',
            config_hash_key: '{"best_fit_a":"h1"}',
            state_code: 'MCD2_UP_IN_CORRIDOR',
            horizon_hours: 2,
          },
      };
      const first = await prisma.stateStatistic.upsert({
        where,
        create: series({ n: 12 }) as never,
        update: { n: 12 },
      });
      expect(first.n).toBe(12);
      const later = await prisma.stateStatistic.upsert({
        where,
        create: series({ n: 31 }) as never,
        update: {
          n: 31,
          forward_move_median: 2.25,
          forward_move_q1: 1,
          forward_move_q3: 3,
        },
      });
      expect(later.id).toBe(first.id);
      expect(later.n).toBe(31);
      expect(later.forward_move_median).toBe(2.25);
      expect(later.updated_at.getTime()).toBeGreaterThanOrEqual(
        first.updated_at.getTime()
      );
      expect(await prisma.stateStatistic.count()).toBe(1);
    });

    it('the series key: the same key twice is refused (P2002); another horizon, MINOR or config_hash_key is a new row', async () => {
      await prisma.stateStatistic.create({ data: series() as never });
      const outcome = await refusal(
        prisma.stateStatistic.create({ data: series({ n: 31 }) as never })
      );
      expect(outcome.code).toBe('P2002');
      await prisma.stateStatistic.create({
        data: series({ horizon_hours: 12 }) as never,
      });
      await prisma.stateStatistic.create({
        data: series({ evaluator_version_series: '2.1' }) as never,
      });
      await prisma.stateStatistic.create({
        data: series({ config_hash_key: '{"best_fit_a":"h2"}' }) as never,
      });
      expect(await prisma.stateStatistic.count()).toBe(4);
    });
  });

  describe('mcd_outputs: one append-only row per symbol, slot and MCD', () => {
    it('a reading round-trips: the envelope text byte for byte, the JSONB copy equal to it, empty lists by default', async () => {
      await prisma.mcdOutput.create({ data: reading() as never });
      const row = (await prisma.mcdOutput.findFirst())!;
      expect(row.envelope_json).toBe(ENVELOPE_TEXT);
      expect(row.envelope).toEqual(JSON.parse(ENVELOPE_TEXT));
      expect(row.inherited_reasons).toEqual([]);
      expect(row.guard_problems).toEqual([]);
      expect(row.cycle_slot).toBe(SLOT);
      expect(row.duration_ms).toBe(5.25);
      expect(row.created_at).toBeInstanceOf(Date);
    });

    it('lists of codes round-trip in order', async () => {
      await prisma.mcdOutput.create({
        data: reading({
          status: 'CAUTIONARY',
          inherited_reasons: ['MCD0_DEFECT_M5', 'MCD0_DEFECT_M15'],
          guard_problems: ['RAISED: ValueError: x'],
        }) as never,
      });
      const row = (await prisma.mcdOutput.findFirst())!;
      expect(row.inherited_reasons).toEqual([
        'MCD0_DEFECT_M5',
        'MCD0_DEFECT_M15',
      ]);
      expect(row.guard_problems).toEqual(['RAISED: ValueError: x']);
    });

    it('an INVALID reading with no state, no bias and no inputs hash is accepted', async () => {
      const row = await prisma.mcdOutput.create({
        data: reading({
          status: 'INVALID',
          state_code: null,
          bias: null,
          inputs_sha256: null,
        }) as never,
      });
      expect(row.state_code).toBeNull();
      expect(row.bias).toBeNull();
      expect(row.inputs_sha256).toBeNull();
    });

    it('the same (symbol, cycle_slot, mcd_id) twice is refused (P2002); another MCD or another slot is a new row', async () => {
      await prisma.mcdOutput.create({ data: reading() as never });
      const outcome = await refusal(
        prisma.mcdOutput.create({ data: reading({ flag: 'live' }) as never })
      );
      expect(outcome.code).toBe('P2002');
      await prisma.mcdOutput.create({
        data: reading({ mcd_id: 'MCD1' }) as never,
      });
      await prisma.mcdOutput.create({
        data: reading({ cycle_slot: SLOT + 300 }) as never,
      });
      expect(await prisma.mcdOutput.count()).toBe(3);
    });

    it('a cycle delivered twice writes nothing new: skipDuplicates keeps the first row as it was', async () => {
      await prisma.mcdOutput.createMany({
        data: [reading(), reading({ mcd_id: 'MCD1' })] as never,
      });
      const again = await prisma.mcdOutput.createMany({
        data: [
          reading({
            status: 'INVALID',
            state_code: null,
            bias: null,
            flag: 'live',
          }),
          reading({ mcd_id: 'MCD1', flag: 'live' }),
        ] as never,
        skipDuplicates: true,
      });
      expect(again.count).toBe(0);
      const rows = await prisma.mcdOutput.findMany({
        orderBy: { mcd_id: 'asc' },
      });
      expect(rows).toHaveLength(2);
      expect(rows.every((r) => r.flag === 'shadow')).toBe(true);
      expect(rows.find((r) => r.mcd_id === 'MCD2')!.status).toBe('VALID');
    });

    it.each(['off', 'Shadow', 'LIVE', ''])(
      'flag %j is refused: only shadow and live rows exist',
      async (flag) => {
        const outcome = await refusal(
          prisma.mcdOutput.create({ data: reading({ flag }) as never })
        );
        expect(outcome.message).toContain('mcd_outputs_flag_is_shadow_or_live');
      }
    );

    it.each(['shadow', 'live'])('flag %s is accepted', async (flag) => {
      const row = await prisma.mcdOutput.create({
        data: reading({ flag }) as never,
      });
      expect(row.flag).toBe(flag);
    });

    it.each(['inherited_reasons', 'guard_problems'])(
      'a NULL %s is refused: "no reasons" is an empty array (Prisma leaves the column nullable)',
      async (column) => {
        const outcome = await refusal(
          prisma.$executeRawUnsafe(
            `INSERT INTO mcd_outputs (id, symbol, cycle_slot, mcd_id, flag, evaluator_version, status,
               envelope_json, envelope, envelope_sha256, evaluator_envelope_sha256, retuning_observed,
               retuning_applied, runner_version, python_version, duration_ms, evaluated_at, ${column})
             VALUES ('raw1', 'XAUUSD', ${SLOT}, 'MCD0', 'shadow', '1.0.0', 'VALID', '{}', '{}', 'h', 'h',
               false, false, '1.0.0', '3.11.9', 1, 1, NULL)`
          )
        );
        expect(outcome.message).toContain('mcd_outputs_reason_lists_not_null');
      }
    );

    it('a cycle is written whole or not at all: one refused row rolls back the rows before it', async () => {
      const outcome = await refusal(
        prisma.$transaction(async (tx) => {
          await tx.mcdOutput.create({
            data: reading({ mcd_id: 'MCD0' }) as never,
          });
          await tx.mcdOutput.create({
            data: reading({ mcd_id: 'MCD1' }) as never,
          });
          await tx.mcdOutput.create({
            data: reading({ mcd_id: 'MCD2', flag: 'off' }) as never,
          });
        })
      );
      expect(outcome.message).toContain('mcd_outputs_flag_is_shadow_or_live');
      expect(await prisma.mcdOutput.count()).toBe(0);
    });

    it('a transaction that completes writes every row of the cycle', async () => {
      await prisma.$transaction(
        ['MCD0', 'MCD1', 'MCD2', 'MCD3'].map((mcd_id) =>
          prisma.mcdOutput.create({ data: reading({ mcd_id }) as never })
        )
      );
      const rows = await prisma.mcdOutput.findMany({
        where: { symbol: 'XAUUSD', cycle_slot: SLOT },
        orderBy: { mcd_id: 'asc' },
      });
      expect(rows.map((r) => r.mcd_id)).toEqual([
        'MCD0',
        'MCD1',
        'MCD2',
        'MCD3',
      ]);
    });
  });

  describe('market_cycle_inputs: the frozen bundle of a cycle', () => {
    const bundleText =
      '{"cycle_slot":"2026-09-18T20:55Z","symbol":"XAUUSD","unit":"°"}';
    const input = (over: Record<string, unknown> = {}) => ({
      symbol: 'XAUUSD',
      cycle_slot: SLOT,
      bundle_gz: gzipSync(Buffer.from(bundleText, 'utf8')),
      bundle_encoding: 'gzip',
      bundle_bytes: Buffer.byteLength(bundleText, 'utf8'),
      inputs_sha256: sha256(bundleText),
      retuning_observed: false,
      ...over,
    });

    it('the compressed bytes round-trip: gunzip gives the canonical text back, and its SHA-256 and length are the stored ones', async () => {
      await prisma.marketCycleInput.create({ data: input() as never });
      const row = (await prisma.marketCycleInput.findFirst())!;
      const text = gunzipSync(Buffer.from(row.bundle_gz)).toString('utf8');
      expect(text).toBe(bundleText);
      expect(sha256(text)).toBe(row.inputs_sha256);
      expect(Buffer.byteLength(text, 'utf8')).toBe(row.bundle_bytes);
      expect(row.bundle_encoding).toBe('gzip');
    });

    it('a second bundle for the same slot is refused (P2002) and skipDuplicates keeps the first, byte for byte', async () => {
      const first = input();
      await prisma.marketCycleInput.create({ data: first as never });
      const other = input({
        bundle_gz: gzipSync(Buffer.from('{"refit":true}', 'utf8')),
        inputs_sha256: sha256('{"refit":true}'),
        retuning_observed: true,
      });
      expect(
        (
          await refusal(
            prisma.marketCycleInput.create({ data: other as never })
          )
        ).code
      ).toBe('P2002');
      const again = await prisma.marketCycleInput.createMany({
        data: [other] as never,
        skipDuplicates: true,
      });
      expect(again.count).toBe(0);
      const row = (await prisma.marketCycleInput.findFirst())!;
      expect(Buffer.from(row.bundle_gz).equals(first.bundle_gz)).toBe(true);
      expect(row.retuning_observed).toBe(false);
    });

    it('retention by cycle_slot removes old bundles and keeps the readings made from them (no foreign key)', async () => {
      const old = SLOT - 91 * 86400;
      await prisma.marketCycleInput.create({
        data: input({ cycle_slot: old }) as never,
      });
      await prisma.marketCycleInput.create({ data: input() as never });
      await prisma.mcdOutput.create({
        data: reading({
          cycle_slot: old,
          inputs_sha256: sha256(bundleText),
        }) as never,
      });
      const removed = await prisma.marketCycleInput.deleteMany({
        where: { cycle_slot: { lt: SLOT - 90 * 86400 } },
      });
      expect(removed.count).toBe(1);
      expect(await prisma.marketCycleInput.count()).toBe(1);
      expect(await prisma.mcdOutput.count()).toBe(1);
    });

    describe('the retention delete is served by the cycle_slot index', () => {
      // Part 7 rewrote this: the first version asked the planner for a plan on whatever the table held, and
      // the answer depended on the table's statistics and on the PostgreSQL version (version 18 can also scan
      // the (symbol, cycle_slot) unique index without naming symbol: a "skip scan"). It now proves two things
      // that do not depend on either.
      const INDEX = 'market_cycle_inputs_cycle_slot_idx';
      const RIVAL = 'market_cycle_inputs_symbol_cycle_slot_key';

      it('the index exists, on cycle_slot alone', async () => {
        const rows = await prisma.$queryRawUnsafe<{ indexdef: string }[]>(
          `SELECT indexdef FROM pg_indexes
            WHERE schemaname = 'public' AND tablename = 'market_cycle_inputs' AND indexname = '${INDEX}'`
        );
        expect(rows).toHaveLength(1);
        expect(rows[0].indexdef).toMatch(/USING btree \(cycle_slot\)$/);
      });

      /** Thrown to roll the transaction back, carrying the plan out of it. */
      class PlanTaken extends Error {
        constructor(readonly plan: string) {
          super('rolled back on purpose');
        }
      }

      /**
       * The plan of the delete the writer runs (`marketCycleInput.deleteMany`), taken in a transaction that is ALWAYS
       * rolled back, so the table, its indexes and its statistics are left as they were. Sequential scans are switched
       * off, and the unique index is dropped inside the transaction so that no other index can answer a predicate on
       * `cycle_slot`: whatever the statistics say, the only way left to find those rows is the index under test.
       * `seed` rows are inserted and analysed first, so the plan is also taken on a table that holds rows.
       */
      async function retentionPlan(seed: number): Promise<string> {
        try {
          await prisma.$transaction(async (tx) => {
            await tx.$executeRawUnsafe(`DROP INDEX ${RIVAL}`);
            if (seed > 0) {
              await tx.$executeRawUnsafe(
                `INSERT INTO market_cycle_inputs
                   (id, symbol, cycle_slot, bundle_gz, bundle_encoding, bundle_bytes, inputs_sha256, retuning_observed)
                 SELECT 'plan' || g, 'XAUUSD', ${SLOT} - 120 * 86400 + g * 300, '\\x00'::bytea, 'gzip', 1, 'h', false
                   FROM generate_series(1, ${seed}) g`
              );
              await tx.$executeRawUnsafe('ANALYZE market_cycle_inputs');
            }
            await tx.$executeRawUnsafe('SET LOCAL enable_seqscan = off');
            const rows = await tx.$queryRawUnsafe<{ 'QUERY PLAN': string }[]>(
              `EXPLAIN DELETE FROM market_cycle_inputs WHERE cycle_slot < ${SLOT - 90 * 86400}`
            );
            throw new PlanTaken(rows.map((r) => r['QUERY PLAN']).join('\n'));
          });
        } catch (error) {
          if (error instanceof PlanTaken) return error.plan;
          throw error;
        }
        throw new Error('the transaction was not rolled back');
      }

      it.each([[0], [2000]])(
        'the delete finds its rows through the index, with %i rows in the table',
        async (seed) => {
          const plan = await retentionPlan(seed);
          expect(plan).toContain(INDEX);
          expect(plan).not.toContain('Seq Scan');
        }
      );

      it('the plan check leaves nothing behind: the unique index is back, no row was added', async () => {
        await retentionPlan(50);
        const rival = await prisma.$queryRawUnsafe<{ indexname: string }[]>(
          `SELECT indexname FROM pg_indexes WHERE schemaname = 'public' AND indexname = '${RIVAL}'`
        );
        expect(rival).toHaveLength(1);
        expect(await prisma.marketCycleInput.count()).toBe(0);
      });
    });
  });
});
