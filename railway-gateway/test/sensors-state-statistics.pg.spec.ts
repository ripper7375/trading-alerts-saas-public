/**
 * The n >= 30 gate and the state statistics writer and reader against a REAL Postgres (build step 3
 * part 6): `state_statistics` as created by
 * prisma/migrations/20261003000000_add_sensor_tables/migration.sql, written through the real Prisma
 * client by the real writer, and read back by the real reader.
 *
 * `sensors-state-statistics-*.spec.ts` show what the code sends to a Prisma that is lazy and
 * transactional and refuses what the CHECK refuses. This spec asks the database itself: that
 * `state_statistics_n_gate` refuses n = 29 with a number and accepts n = 30, that the writer's explicit
 * nulls are what let a row fall back below 30, that the unique key keeps series apart, that a batch is
 * atomic, and that a figure comes back from DOUBLE PRECISION as the same number.
 *
 * It reads the table directly on purpose: tests are not code that runs, and the repo guard
 * (`no-direct-state-statistics-reads.spec.ts`) scans the source folders only.
 *
 * SKIPPED unless BOTH are set:
 *   CYCLE_PG_URL         a postgres URL on localhost or 127.0.0.1 (anything else is refused)
 *   CYCLE_PG_ALLOW_WIPE  "yes": it DELETES every row of state_statistics in that database
 *
 * To run it on a throwaway database (see database-traps.md):
 *   1. a scratch cluster from `initdb` on a high port, and an empty database;
 *   2. apply the MIGRATION FILE itself (it creates the three sensor tables and their CHECKs and needs
 *      nothing else): `psql -v ON_ERROR_STOP=1 -d <db> -f prisma/migrations/20261003000000_add_sensor_tables/migration.sql`;
 *   3. CYCLE_PG_URL=<that url> CYCLE_PG_ALLOW_WIPE=yes npx jest test/sensors-state-statistics.pg.spec.ts
 *   4. stop and remove the instance.
 */
import { PrismaService } from '../src/prisma/prisma.service';
import {
  StateStatisticsRefused,
  StateStatisticsWriter,
} from '../src/sensors/state-statistics.writer';
import {
  StateStatisticsReader,
  provisionalWords,
} from '../src/sensors/state-statistics.reader';
import {
  SERIES_NOTES,
  StateStatisticsRow,
  seriesKeyOf,
} from '../src/sensors/state-statistics.series';
import {
  CONFIG_KEY,
  FIGURES,
  provisionalRow,
  readGolden,
  row,
} from './helpers/state-statistics-world';

const URL = process.env['CYCLE_PG_URL'] ?? '';
const enabled = URL !== '' && process.env['CYCLE_PG_ALLOW_WIPE'] === 'yes';
if (
  enabled &&
  !/^postgres(ql)?:\/\/[^@]*@(localhost|127\.0\.0\.1):\d+\//.test(URL)
) {
  throw new Error('CYCLE_PG_URL must point at localhost or 127.0.0.1');
}
const suite = enabled ? describe : describe.skip;

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

// every measured column of state_statistics (all NULL unless n >= 30)
const MEASURED = [...FIGURES, 'opposing_level_rate'] as const;

/** A row as the model wants it for a direct write (the writer adds the notes itself). */
const direct = (over: Record<string, unknown> = {}) => ({
  ...row(),
  series_notes: SERIES_NOTES,
  ...over,
});

suite(
  'state_statistics on a real Postgres: the gate, the writer and the reader',
  () => {
    jest.setTimeout(120_000);
    let prisma: PrismaService;
    let writer: StateStatisticsWriter;
    let reader: StateStatisticsReader;

    beforeAll(async () => {
      process.env['DATABASE_URL'] = URL;
      prisma = new PrismaService();
      await prisma.$connect();
      writer = new StateStatisticsWriter(prisma);
      reader = new StateStatisticsReader(prisma);
    });
    afterAll(async () => {
      await prisma.$disconnect();
    });
    beforeEach(async () => {
      await prisma.$executeRawUnsafe('DELETE FROM state_statistics');
    });

    const countRows = () => prisma.stateStatistic.count();
    const byKey = (
      r: Pick<
        StateStatisticsRow,
        | 'mcd_id'
        | 'evaluator_version_series'
        | 'config_hash_key'
        | 'state_code'
        | 'horizon_hours'
      >
    ) =>
      prisma.stateStatistic.findUnique({
        where: {
          mcd_id_evaluator_version_series_config_hash_key_state_code_horizon_hours:
            {
              mcd_id: r.mcd_id,
              evaluator_version_series: r.evaluator_version_series,
              config_hash_key: r.config_hash_key,
              state_code: r.state_code,
              horizon_hours: r.horizon_hours,
            },
        },
      });

    describe('the database CHECK state_statistics_n_gate (ADR-022)', () => {
      it('exists, and says n >= 30', async () => {
        const found = await prisma.$queryRawUnsafe<{ definition: string }[]>(
          `SELECT pg_get_constraintdef(oid) AS definition FROM pg_constraint
          WHERE conname = 'state_statistics_n_gate' AND contype = 'c'`
        );
        expect(found).toHaveLength(1);
        expect(found[0].definition).toContain('n >= 30');
      });

      it.each(MEASURED)('refuses n = 29 with %s alone set', async (field) => {
        const outcome = await refusal(
          prisma.stateStatistic.create({
            data: {
              ...direct({ n: 29 }),
              ...Object.fromEntries(MEASURED.map((f) => [f, null])),
              [field]: 1.5,
            } as never,
          })
        );
        expect(outcome.message).toContain('state_statistics_n_gate');
        expect(await countRows()).toBe(0);
      });

      it('refuses n = 29 with every figure', async () => {
        const outcome = await refusal(
          prisma.stateStatistic.create({ data: direct({ n: 29 }) as never })
        );
        expect(outcome.message).toContain('state_statistics_n_gate');
      });

      it('refuses n = 0 with a figure', async () => {
        const outcome = await refusal(
          prisma.stateStatistic.create({ data: direct({ n: 0 }) as never })
        );
        expect(outcome.message).toContain('state_statistics_n_gate');
      });

      it('accepts n = 29 with no figure: a count and no number', async () => {
        const made = await prisma.stateStatistic.create({
          data: direct({
            n: 29,
            ...Object.fromEntries(MEASURED.map((f) => [f, null])),
          }) as never,
        });
        expect(made.n).toBe(29);
      });

      it('accepts n = 30 with its figures', async () => {
        const made = await prisma.stateStatistic.create({
          data: direct({ n: 30 }) as never,
        });
        expect(made.n).toBe(30);
        expect(made.forward_move_median).toBe(1.25);
      });

      it('refuses an UPDATE from n = 30 down to 29 that keeps its figures', async () => {
        const made = await prisma.stateStatistic.create({
          data: direct({ n: 30 }) as never,
        });
        const outcome = await refusal(
          prisma.stateStatistic.update({
            where: { id: made.id },
            data: { n: 29 },
          })
        );
        expect(outcome.message).toContain('state_statistics_n_gate');
        expect(
          (await prisma.stateStatistic.findUnique({ where: { id: made.id } }))!
            .n
        ).toBe(30);
      });

      it('lets n = 30 hold no figure: the database alone does not demand them, the writer and the reader do', async () => {
        const made = await prisma.stateStatistic.create({
          data: direct({
            n: 30,
            ...Object.fromEntries(MEASURED.map((f) => [f, null])),
          }) as never,
        });
        expect(made.forward_move_median).toBeNull();
        await expect(
          writer.writeRows([row({ n: 30, forward_move_median: null })])
        ).rejects.toBeInstanceOf(StateStatisticsRefused);
      });
    });

    describe('the writer', () => {
      it("writes the engine's own rows: figures at n >= 30, a bare count below", async () => {
        const golden = readGolden().result.rows;
        expect(await writer.writeRows(golden)).toEqual({ rows: golden.length });
        expect(await countRows()).toBe(golden.length);
        for (const expected of golden) {
          const stored = await byKey(expected);
          expect(stored).not.toBeNull();
          expect(stored).toMatchObject({
            ...expected,
            series_notes: SERIES_NOTES,
          });
        }
        // the gate, asked of the table: no row below 30 holds a number, and every row from 30 holds all five
        const below = await prisma.$queryRawUnsafe<{ bad: bigint }[]>(
          `SELECT count(*) AS bad FROM state_statistics
          WHERE n < 30 AND (forward_move_median IS NOT NULL OR forward_move_q1 IS NOT NULL OR forward_move_q3 IS NOT NULL
                            OR opposing_level_rate IS NOT NULL OR adverse_excursion_median IS NOT NULL OR adverse_excursion_q3 IS NOT NULL)`
        );
        expect(Number(below[0].bad)).toBe(0);
        const above = await prisma.$queryRawUnsafe<{ bad: bigint }[]>(
          `SELECT count(*) AS bad FROM state_statistics
          WHERE n >= 30 AND (forward_move_median IS NULL OR forward_move_q1 IS NULL OR forward_move_q3 IS NULL
                             OR adverse_excursion_median IS NULL OR adverse_excursion_q3 IS NULL)`
        );
        expect(Number(above[0].bad)).toBe(0);
        const gated = golden.filter((r) => r.n >= 30).length;
        const bare = golden.filter((r) => r.n < 30).length;
        expect(gated).toBeGreaterThanOrEqual(5);
        expect(bare).toBeGreaterThanOrEqual(5);
      });

      it('n = 29 is stored without a number and n = 30 with them, through the writer', async () => {
        await writer.writeRows([
          provisionalRow(29, { state_code: 'MCD2_CHANNEL_DOWN' }),
          row({ n: 30 }),
        ]);
        const twentyNine = await byKey(
          provisionalRow(29, { state_code: 'MCD2_CHANNEL_DOWN' })
        );
        expect(twentyNine!.n).toBe(29);
        for (const field of MEASURED) expect(twentyNine![field]).toBeNull();
        const thirty = await byKey(row());
        expect(thirty!.n).toBe(30);
        expect(thirty!.forward_move_q3).toBe(3);
      });

      it('stores every figure as the same number it was given (DOUBLE PRECISION round trip)', async () => {
        const awkward = row({
          n: 41,
          forward_move_q1: -4.93,
          forward_move_median: 4.335,
          forward_move_q3: 5.8075,
          adverse_excursion_median: 0.30000000000000004,
          adverse_excursion_q3: 123456.789012345,
        });
        await writer.writeRows([awkward]);
        const stored = await byKey(awkward);
        for (const field of FIGURES)
          expect(stored![field]).toBe(awkward[field]);
      });

      it('recomputes a row in place: the same key, new figures, later updated_at, same created_at', async () => {
        await writer.writeRows([row({ n: 30, forward_move_median: 1.25 })]);
        const first = (await byKey(row()))!;
        await new Promise((resolve) => setTimeout(resolve, 20));
        await writer.writeRows([
          row({ n: 44, forward_move_median: 2.5, forward_move_q3: 7 }),
        ]);
        const second = (await byKey(row()))!;
        expect(await countRows()).toBe(1);
        expect(second.id).toBe(first.id);
        expect([
          second.n,
          second.forward_move_median,
          second.forward_move_q3,
        ]).toEqual([44, 2.5, 7]);
        expect(second.created_at.getTime()).toBe(first.created_at.getTime());
        expect(second.updated_at.getTime()).toBeGreaterThan(
          first.updated_at.getTime()
        );
      });

      it('a row that falls back below 30 loses its numbers: the explicit nulls are what the CHECK needs', async () => {
        await writer.writeRows([row({ n: 35 })]);
        await writer.writeRows([provisionalRow(12)]);
        const stored = (await byKey(row()))!;
        expect(stored.n).toBe(12);
        for (const field of MEASURED) expect(stored[field]).toBeNull();
      });

      it('a row that climbs from 29 to 30 gains its numbers', async () => {
        await writer.writeRows([provisionalRow(29)]);
        await writer.writeRows([row({ n: 30 })]);
        const stored = (await byKey(row()))!;
        expect(stored.n).toBe(30);
        expect(stored.forward_move_q1).toBe(-0.5);
      });

      it('overwrites an opposing-level rate left by something else with NULL', async () => {
        await writer.writeRows([row({ n: 31 })]);
        await prisma.$executeRawUnsafe(
          `UPDATE state_statistics SET opposing_level_rate = 0.5`
        );
        await writer.writeRows([row({ n: 32 })]);
        expect((await byKey(row()))!.opposing_level_rate).toBeNull();
      });

      it('puts the forming-bar note on every row it writes and rewrites it on update', async () => {
        await writer.writeRows(readGolden().result.rows);
        await prisma.$executeRawUnsafe(
          `UPDATE state_statistics SET series_notes = 'all verified'`
        );
        await writer.writeRows(readGolden().result.rows);
        const notes = await prisma.$queryRawUnsafe<{ series_notes: string }[]>(
          `SELECT DISTINCT series_notes FROM state_statistics`
        );
        expect(notes).toEqual([
          { series_notes: 'FORMING_BAR_FIT: UNVERIFIED' },
        ]);
      });

      it('a batch the writer refuses leaves the table empty', async () => {
        await expect(
          writer.writeRows([
            row({ state_code: 'MCD2_A' }),
            row({ state_code: 'MCD2_B', n: 29 }),
          ])
        ).rejects.toBeInstanceOf(StateStatisticsRefused);
        expect(await countRows()).toBe(0);
      });

      it('a batch the DATABASE refuses rolls back every row of it', async () => {
        // the writer's own check should make this impossible; the real transaction shows what happens if a row slips past it
        const gate = jest.spyOn(writer, 'problems').mockReturnValue([]);
        const outcome = await refusal(
          writer.writeRows([
            row({ state_code: 'MCD2_A' }),
            row({ state_code: 'MCD2_B' }),
            row({ state_code: 'MCD2_C', n: 29 }),
          ])
        );
        gate.mockRestore();
        expect(outcome.message).toContain('state_statistics_n_gate');
        expect(await countRows()).toBe(0);
      });

      it('a batch that updates one row and fails on another leaves the first row as it was', async () => {
        await writer.writeRows([
          row({ state_code: 'MCD2_A', n: 40, forward_move_median: 1 }),
        ]);
        const gate = jest.spyOn(writer, 'problems').mockReturnValue([]);
        await refusal(
          writer.writeRows([
            row({ state_code: 'MCD2_A', n: 50, forward_move_median: 9 }),
            row({ state_code: 'MCD2_B', n: 29 }),
          ])
        );
        gate.mockRestore();
        const kept = (await byKey(row({ state_code: 'MCD2_A' })))!;
        expect([kept.n, kept.forward_move_median]).toEqual([40, 1]);
        expect(await countRows()).toBe(1);
      });
    });

    describe('series are kept apart by the unique key', () => {
      const reading = {
        mcdId: 'MCD2',
        evaluatorVersion: '2.0.1',
        configHash: { best_fit_a: 'h1' },
        stateCode: 'MCD2_CHANNEL_UP',
        horizonHours: 2,
      };
      const rowFor = (over: Partial<typeof reading>, n = 40) =>
        n >= 30
          ? row({ ...seriesKeyOf({ ...reading, ...over }), n })
          : provisionalRow(n, seriesKeyOf({ ...reading, ...over }));

      it('has the unique index the writer upserts on', async () => {
        const index = await prisma.$queryRawUnsafe<{ indexname: string }[]>(
          `SELECT indexname FROM pg_indexes WHERE tablename = 'state_statistics' AND indexname = 'state_statistics_series_key'`
        );
        expect(index).toHaveLength(1);
      });

      it('a patch release writes to the same row', async () => {
        await writer.writeRows([rowFor({ evaluatorVersion: '2.0.1' }, 30)]);
        await writer.writeRows([rowFor({ evaluatorVersion: '2.0.7' }, 33)]);
        expect(await countRows()).toBe(1);
        expect((await prisma.stateStatistic.findFirst())!.n).toBe(33);
      });

      it('a minor release starts a new row and leaves the old one as it was', async () => {
        await writer.writeRows([rowFor({ evaluatorVersion: '2.0.1' }, 40)]);
        await writer.writeRows([rowFor({ evaluatorVersion: '2.1.0' }, 5)]);
        expect(await countRows()).toBe(2);
        const old = (await byKey(rowFor({ evaluatorVersion: '2.0.1' })))!;
        const fresh = (await byKey(rowFor({ evaluatorVersion: '2.1.0' }, 5)))!;
        expect([old.n, old.forward_move_median]).toEqual([40, 1.25]);
        expect([fresh.n, fresh.forward_move_median]).toEqual([5, null]);
      });

      it('a changed config_hash starts a new row', async () => {
        await writer.writeRows([
          rowFor({}, 40),
          rowFor({ configHash: { best_fit_a: 'h2' } }, 31),
        ]);
        expect(await countRows()).toBe(2);
      });

      it('the two horizons, two states and two MCDs are separate rows', async () => {
        await writer.writeRows([
          rowFor({}),
          rowFor({ horizonHours: 12 }),
          rowFor({ stateCode: 'MCD2_CHANNEL_DOWN' }),
          rowFor({ mcdId: 'MCD1', stateCode: 'MCD1_TREND_UP' }),
        ]);
        expect(await countRows()).toBe(4);
      });

      it('the database refuses a second row for a key even if the writer is bypassed', async () => {
        await prisma.stateStatistic.create({ data: direct() as never });
        const outcome = await refusal(
          prisma.stateStatistic.create({ data: direct({ n: 31 }) as never })
        );
        expect(outcome.code).toBe('P2002');
      });
    });

    describe('the reader', () => {
      const asReading = (r: StateStatisticsRow) => ({
        mcdId: r.mcd_id,
        evaluatorVersion: `${r.evaluator_version_series}.3`,
        configHash: JSON.parse(r.config_hash_key) as Record<string, string>,
        stateCode: r.state_code,
        horizonHours: r.horizon_hours,
      });

      it("answers every one of the engine's rows as the writer stored it: figures with their n from 30, words below", async () => {
        const golden = readGolden().result.rows;
        await writer.writeRows(golden);
        let measured = 0;
        let provisional = 0;
        for (const expected of golden) {
          const answer = await reader.read(asReading(expected));
          if (expected.n >= 30) {
            measured += 1;
            expect(answer).toEqual({
              status: 'MEASURED',
              n: expected.n,
              min_sample: 30,
              horizon_hours: expected.horizon_hours,
              forward_move: {
                median: expected.forward_move_median,
                q1: expected.forward_move_q1,
                q3: expected.forward_move_q3,
              },
              adverse_excursion: {
                median: expected.adverse_excursion_median,
                q3: expected.adverse_excursion_q3,
              },
              opposing_level_rate: null,
              series_notes: SERIES_NOTES,
            });
          } else {
            provisional += 1;
            expect(answer).toEqual({
              status: 'PROVISIONAL',
              reason: 'BELOW_MIN_SAMPLE',
              n: expected.n,
              min_sample: 30,
              horizon_hours: expected.horizon_hours,
              words: provisionalWords(
                'BELOW_MIN_SAMPLE',
                expected.n,
                expected.horizon_hours
              ),
            });
          }
        }
        expect(measured).toBeGreaterThanOrEqual(5);
        expect(provisional).toBeGreaterThanOrEqual(5);
      });

      it('n = 29 is provisional and n = 30 is measured, through the database', async () => {
        await writer.writeRows([
          provisionalRow(29, { state_code: 'MCD2_CHANNEL_DOWN' }),
          row({ n: 30 }),
        ]);
        const reading = asReading(row());
        expect(
          await reader.read({ ...reading, stateCode: 'MCD2_CHANNEL_DOWN' })
        ).toMatchObject({
          status: 'PROVISIONAL',
          n: 29,
        });
        expect(await reader.read(reading)).toMatchObject({
          status: 'MEASURED',
          n: 30,
        });
      });

      it('a state never seen in the series is NO_HISTORY with n = 0', async () => {
        await writer.writeRows([row()]);
        expect(
          await reader.read({
            ...asReading(row()),
            stateCode: 'MCD2_CHANNEL_DOWN',
          })
        ).toMatchObject({
          status: 'PROVISIONAL',
          reason: 'NO_HISTORY',
          n: 0,
        });
      });

      it('a patch release reads the row, a minor release and a changed config_hash start at nothing', async () => {
        await writer.writeRows([row()]);
        const reading = asReading(row());
        expect(
          (await reader.read({ ...reading, evaluatorVersion: '2.0.9' })).status
        ).toBe('MEASURED');
        expect(
          await reader.read({ ...reading, evaluatorVersion: '2.1.0' })
        ).toMatchObject({ reason: 'NO_HISTORY' });
        expect(
          await reader.read({ ...reading, configHash: { best_fit_a: 'h2' } })
        ).toMatchObject({
          reason: 'NO_HISTORY',
        });
      });

      it('holds the rule the database does not: n = 30 with a figure missing is unusable, not measured', async () => {
        await prisma.stateStatistic.create({
          data: direct({ n: 30, forward_move_q3: null }) as never,
        });
        expect(await reader.read(asReading(row()))).toMatchObject({
          status: 'PROVISIONAL',
          reason: 'ROW_UNUSABLE',
          n: 30,
        });
      });

      it('reads the config_hash in any key order', async () => {
        const key = seriesKeyOf({
          mcdId: 'MCD3',
          evaluatorVersion: '2.0.0',
          configHash: { best_fit_a: 'h1', non_b: 'h9' },
          stateCode: 'MCD3_ALIGNED_UP',
          horizonHours: 2,
        });
        await writer.writeRows([row(key)]);
        const answer = await reader.read({
          mcdId: 'MCD3',
          evaluatorVersion: '2.0.4',
          configHash: { non_b: 'h9', best_fit_a: 'h1' },
          stateCode: 'MCD3_ALIGNED_UP',
          horizonHours: 2,
        });
        expect(answer.status).toBe('MEASURED');
        expect(CONFIG_KEY).toBe('{"best_fit_a":"h1"}');
      });
    });
  }
);
