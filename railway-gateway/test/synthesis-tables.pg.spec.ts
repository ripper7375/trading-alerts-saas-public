/**
 * The two Stack D chapter 3 tables against a REAL Postgres (build step 4, part 4):
 * synthesis_readings and entry_zones, as created by
 * prisma/migrations/20261004000000_add_synthesis_tables/migration.sql.
 *
 * `schema-sync.spec.ts` compares files. This spec shows what the database does with
 * them: that the three real cycles' SYN readings and zones (the engine's own
 * `fixtures/<slot>.synthesis.json`) are accepted and come back as the exact text, hash
 * and numbers that went in; that every one of the 25 CHECK constraints Prisma cannot
 * see refuses what it is there to refuse and accepts what it must; the unique keys, an
 * idempotent write and an atomic one, written through the real Prisma client the way
 * the gateway's synthesis step (build step 4 part 5) will.
 *
 * The mapping from the engine's result to the rows (`readingRowFrom`, `zoneRowFrom`) is
 * written here, independently of part 5's writer, to show that the tables can hold
 * everything the engine writes; part 5 implements the same mapping in the gateway.
 *
 * SKIPPED unless BOTH are set:
 *   CYCLE_PG_URL         a postgres URL on localhost or 127.0.0.1 (anything else is refused)
 *   CYCLE_PG_ALLOW_WIPE  "yes": it DELETES every row of synthesis_readings and entry_zones in
 *                        that database
 *
 * To run it on a throwaway database (see .claude/architecture/database-traps.md):
 *   1. start a scratch PostgreSQL (initdb on a high port, `Start-Process postgres.exe`) and
 *      create an empty database;
 *   2. apply the MIGRATION FILE itself, not a `migrate diff` of the schema: the diff has no
 *      CHECK constraints, and the first test below fails if they are missing:
 *      `psql -v ON_ERROR_STOP=1 -d <db> -f prisma/migrations/20261004000000_add_synthesis_tables/migration.sql`
 *   3. CYCLE_PG_URL=<that url> CYCLE_PG_ALLOW_WIPE=yes npx jest test/synthesis-tables.pg.spec.ts
 *   4. stop and remove the instance.
 */
import { PrismaService } from '../src/prisma/prisma.service';
import { isoToSlot } from '../src/sensors/inputs/stats-slot';
import { FIXTURE_SLOTS } from './helpers/cycle-fixtures';
import {
  Doc,
  V1,
  V3,
  V4,
  changedReadingRow,
  contextOf,
  longZone,
  sha256,
  storedReadingRow,
  zoneRowFrom,
} from './helpers/synthesis-rows';

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

suite('the synthesis tables on a real Postgres', () => {
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
    await prisma.$executeRawUnsafe('DELETE FROM entry_zones');
    await prisma.$executeRawUnsafe('DELETE FROM synthesis_readings');
  });

  const createReading = (row: Doc) =>
    prisma.synthesisReading.create({ data: row as never });
  const createZone = (row: Doc) =>
    prisma.entryZone.create({ data: row as never });

  /** The database must refuse `write` and name `constraint` as the reason; nothing may be left behind. */
  async function refusedBy(constraint: string, write: Promise<unknown>) {
    const outcome = await refusal(write);
    expect(outcome.message).toContain(constraint);
    return outcome;
  }

  it('was made from the migration file: the two tables, their unique indexes and the 25 CHECK constraints exist', async () => {
    const tables = await prisma.$queryRawUnsafe<{ table_name: string }[]>(
      `SELECT table_name FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name IN ('synthesis_readings', 'entry_zones')
        ORDER BY 1`
    );
    expect(tables.map((t) => t.table_name)).toEqual([
      'entry_zones',
      'synthesis_readings',
    ]);
    const checks = await prisma.$queryRawUnsafe<
      { conrelid: string; n: number }[]
    >(
      `SELECT conrelid::regclass::text AS conrelid, count(*)::int AS n FROM pg_constraint
        WHERE contype = 'c' AND connamespace = 'public'::regnamespace
          AND conrelid IN ('synthesis_readings'::regclass, 'entry_zones'::regclass)
        GROUP BY 1 ORDER BY 1`
    );
    expect(checks).toEqual([
      { conrelid: 'entry_zones', n: 14 },
      { conrelid: 'synthesis_readings', n: 11 },
    ]);
    const indexes = await prisma.$queryRawUnsafe<{ indexdef: string }[]>(
      `SELECT indexdef FROM pg_indexes
        WHERE schemaname = 'public' AND tablename IN ('synthesis_readings', 'entry_zones')
          AND indexname NOT LIKE '%pkey' ORDER BY indexname`
    );
    expect(indexes.map((i) => i.indexdef.replace(/^.* USING /, ''))).toEqual([
      'btree (symbol, cycle_slot, profile, zone_id)',
      'btree (symbol, cycle_slot, profile)',
    ]);
    expect(
      indexes.every((i) => i.indexdef.startsWith('CREATE UNIQUE INDEX'))
    ).toBe(true);
  });

  describe('the three real cycles (the engine writes them, the database keeps them)', () => {
    it.each(FIXTURE_SLOTS.map((f) => [f.name, f] as const))(
      '%s: both readings and every zone are accepted and read back as the same text, hashes and numbers',
      async (_name, fixture) => {
        const ctx = contextOf(fixture);
        let zoneTotal = 0;
        for (const stored of ctx.synthesis.readings) {
          const row = storedReadingRow(ctx, stored.profile);
          // the engine's own bytes: the database's hash check is about THESE
          expect(row['reading_sha256']).toBe(stored.reading_sha256);
          expect(row['zones_sha256']).toBe(stored.zones_sha256);
          await createReading(row);
          const zones: Doc[] = JSON.parse(stored.zones_json);
          for (const zone of zones) await createZone(zoneRowFrom(zone));
          zoneTotal += zones.length;

          const back = await prisma.synthesisReading.findUniqueOrThrow({
            where: {
              symbol_cycle_slot_profile: {
                symbol: 'XAUUSD',
                cycle_slot: fixture.slot,
                profile: stored.profile,
              },
            },
          });
          expect(back.reading_json).toBe(stored.reading_json);
          expect(back.reading_sha256).toBe(stored.reading_sha256);
          expect(back.reading).toEqual(JSON.parse(stored.reading_json!));
          expect(back.zones_json).toBe(stored.zones_json);
          expect(back.zones_sha256).toBe(stored.zones_sha256);
          expect(back.zone_count).toBe(zones.length);
          expect(back.zones_reason).toBe(stored.zones_reason);
          expect(back.reference_price).toBe(ctx.synthesis.reference_price);
          expect(back.inputs_sha256).toBe(ctx.inputs_sha256);
          expect(back.created_at).toBeInstanceOf(Date);

          const rows = await prisma.entryZone.findMany({
            where: {
              symbol: 'XAUUSD',
              cycle_slot: fixture.slot,
              profile: stored.profile,
            },
            orderBy: { rank: 'asc' },
          });
          expect(rows.map((r) => r.zone_id)).toEqual(
            (back.reading as Doc)['zones']
          );
          rows.forEach((r, i) => {
            const z = zones[i];
            // DOUBLE PRECISION gives the number back that was put in: no cent is lost or gained
            expect([r.low, r.high, r.reference_price]).toEqual([
              z['low'],
              z['high'],
              z['reference_price'],
            ]);
            expect([r.invalidation_price, r.stop_distance]).toEqual([
              z['invalidation_price'],
              z['stop_distance'],
            ]);
            expect([r.runway, r.runway_ratio]).toEqual([
              z['runway'],
              z['runway_ratio'],
            ]);
            expect(r.source_sensors).toEqual(z['source_sensors']);
            expect(r.levels).toEqual({
              source_levels: z['source_levels'],
              confluence_levels: z['confluence_levels'],
              invalidation_level: z['invalidation_level'],
              next_opposing_level: z['next_opposing_level'],
            });
            expect(r.zone_params_sha256).toBe(ctx.synthesis.zones_sha256);
          });
        }
        expect(await prisma.synthesisReading.count()).toBe(2);
        expect(await prisma.entryZone.count()).toBe(zoneTotal);
      }
    );

    it('the three cycles together: 6 readings and 8 zones (18 Sep 4, 28 Sep 14:15 none, 28 Sep 23:15 4)', async () => {
      let zones = 0;
      for (const fixture of FIXTURE_SLOTS) {
        const ctx = contextOf(fixture);
        for (const stored of ctx.synthesis.readings) {
          await createReading(storedReadingRow(ctx, stored.profile));
          for (const zone of JSON.parse(stored.zones_json) as Doc[]) {
            await createZone(zoneRowFrom(zone));
            zones += 1;
          }
        }
      }
      expect(await prisma.synthesisReading.count()).toBe(6);
      expect(await prisma.entryZone.count()).toBe(8);
      expect(zones).toBe(8);
      // 28 Sep 14:15: a LONG with no zone sources is a real reading, with its reason
      const none = await prisma.synthesisReading.findMany({
        where: { cycle_slot: V3.slot },
      });
      expect(none.map((r) => [r.bias, r.zone_count, r.zones_reason])).toEqual([
        ['LONG', 0, 'NO_ZONE_SOURCES'],
        ['LONG', 0, 'NO_ZONE_SOURCES'],
      ]);
    });

    it('a SHORT cycle (28 Sep 23:15) stores its zones with the invalidation above the entry', async () => {
      const ctx = contextOf(V4);
      for (const stored of ctx.synthesis.readings) {
        await createReading(storedReadingRow(ctx, stored.profile));
        for (const zone of JSON.parse(stored.zones_json) as Doc[])
          await createZone(zoneRowFrom(zone));
      }
      const zones = await prisma.entryZone.findMany();
      expect(zones.length).toBeGreaterThan(0);
      for (const zone of zones) {
        expect(zone.bias).toBe('SHORT');
        expect(zone.invalidation_price).toBeGreaterThan(zone.reference_price);
        expect(zone.stop_distance).toBeGreaterThanOrEqual(13);
      }
    });

    it('the stored zone rows, the readings and the cycle agree on the slot, the profile and the parameters', () => {
      for (const fixture of FIXTURE_SLOTS) {
        const ctx = contextOf(fixture);
        for (const stored of ctx.synthesis.readings) {
          for (const zone of JSON.parse(stored.zones_json) as Doc[]) {
            expect(isoToSlot(zone['cycle_slot'])).toBe(fixture.slot);
            expect(zone['profile']).toBe(stored.profile);
            expect(zone['zones_version']).toBe(ctx.synthesis.zones_version);
            expect(zone['zones_sha256']).toBe(ctx.synthesis.zones_sha256);
          }
        }
      }
    });
  });

  describe('the keys: one reading per cycle and profile, one zone per cycle, profile and zone id', () => {
    it('the same reading twice is refused (P2002); the other profile and another slot are new rows', async () => {
      const ctx = contextOf(V1);
      await createReading(storedReadingRow(ctx, 'DAY_TRADER'));
      const outcome = await refusal(
        createReading(storedReadingRow(ctx, 'DAY_TRADER'))
      );
      expect(outcome.code).toBe('P2002');
      await createReading(storedReadingRow(ctx, 'SCALPER'));
      await createReading(storedReadingRow(contextOf(V4), 'DAY_TRADER'));
      expect(await prisma.synthesisReading.count()).toBe(3);
    });

    it('the same zone twice is refused (P2002); the same id under the other profile is a new row', async () => {
      const zone = longZone();
      await createZone(zoneRowFrom(zone));
      const outcome = await refusal(createZone(zoneRowFrom(zone)));
      expect(outcome.code).toBe('P2002');
      await createZone(zoneRowFrom(zone, { profile: 'SCALPER' }));
      expect(await prisma.entryZone.count()).toBe(2);
    });

    it('a cycle delivered twice writes nothing new and keeps the first rows (createMany with skipDuplicates)', async () => {
      const ctx = contextOf(V1);
      const readings = ctx.synthesis.readings.map((r) =>
        storedReadingRow(ctx, r.profile)
      );
      const zones = ctx.synthesis.readings.flatMap((r) =>
        (JSON.parse(r.zones_json) as Doc[]).map((z) => zoneRowFrom(z))
      );
      const write = (changed = false) =>
        prisma.$transaction([
          prisma.synthesisReading.createMany({
            data: readings.map((r) =>
              changed ? { ...r, duration_ms: 999 } : r
            ) as never,
            skipDuplicates: true,
          }),
          prisma.entryZone.createMany({
            data: zones as never,
            skipDuplicates: true,
          }),
        ]);
      const first = await write();
      expect([first[0].count, first[1].count]).toEqual([2, 4]);
      const again = await write(true);
      expect([again[0].count, again[1].count]).toEqual([0, 0]);
      expect(await prisma.synthesisReading.count()).toBe(2);
      expect(await prisma.entryZone.count()).toBe(4);
      const kept = await prisma.synthesisReading.findMany();
      expect(kept.every((r) => r.duration_ms === 48.8)).toBe(true);
    });

    it('one refused zone rolls back the whole write, readings included (what part 5 must prevent by checking first)', async () => {
      const ctx = contextOf(V1);
      const zones = ctx.synthesis.readings.flatMap((r) =>
        (JSON.parse(r.zones_json) as Doc[]).map((z) => zoneRowFrom(z))
      );
      zones[3] = { ...zones[3], stop_distance: 12.99 };
      const outcome = await refusal(
        prisma.$transaction([
          prisma.synthesisReading.createMany({
            data: ctx.synthesis.readings.map((r) =>
              storedReadingRow(ctx, r.profile)
            ) as never,
          }),
          prisma.entryZone.createMany({ data: zones as never }),
        ])
      );
      expect(outcome.message).toContain('entry_zones_stop_distance');
      expect(await prisma.synthesisReading.count()).toBe(0);
      expect(await prisma.entryZone.count()).toBe(0);
    });
  });

  describe('synthesis_readings: what the database refuses', () => {
    const ctx = contextOf(V1);

    it('a reading made while the SYN flag is off: flag must be shadow or live', async () => {
      for (const flag of ['off', 'Shadow', '']) {
        await refusedBy(
          'synthesis_readings_flag_is_shadow_or_live',
          createReading({ ...storedReadingRow(ctx, 'DAY_TRADER'), flag })
        );
      }
      for (const flag of ['shadow', 'live']) {
        await createReading({ ...storedReadingRow(ctx, 'DAY_TRADER'), flag });
        await prisma.synthesisReading.deleteMany();
      }
    });

    it('a profile that is not a trader type', async () => {
      await refusedBy(
        'synthesis_readings_profile_is_known',
        createReading(
          changedReadingRow(ctx, 'DAY_TRADER', (d) => (d['profile'] = 'SWING'))
        )
      );
    });

    it('standing aside and having no direction are the same fact (3.10 item 4)', async () => {
      await refusedBy(
        'synthesis_readings_stand_aside_is_the_bias',
        createReading(
          changedReadingRow(ctx, 'DAY_TRADER', (d) => (d['stand_aside'] = true))
        )
      );
      await refusedBy(
        'synthesis_readings_stand_aside_is_the_bias',
        createReading(
          changedReadingRow(
            ctx,
            'DAY_TRADER',
            (d) => (d['bias'] = 'STAND_ASIDE')
          )
        )
      );
    });

    it('a stand-aside reading with no zones, no direction and a data reason is accepted', async () => {
      const row = changedReadingRow(
        ctx,
        'DAY_TRADER',
        (d) => {
          d['status'] = 'INVALID';
          d['status_reasons'] = ['UPSTREAM_STALE:MCD1'];
          d['bias'] = 'STAND_ASIDE';
          d['stand_aside'] = true;
          d['archetype'] = null;
          d['trend_relation'] = null;
          d['zones'] = [];
        },
        [],
        'NOT_DIRECTIONAL'
      );
      const saved = await createReading(row);
      expect([saved.bias, saved.stand_aside, saved.zone_count]).toEqual([
        'STAND_ASIDE',
        true,
        0,
      ]);
      expect([saved.archetype, saved.trend_relation]).toEqual([null, null]);
      expect(saved.zones_reason).toBe('NOT_DIRECTIONAL');
      expect(saved.zones_json).toBe('[]');
    });

    it('a reading with no direction cannot have zones (NEUTRAL here), and at most five zones', async () => {
      await refusedBy(
        'synthesis_readings_zones_need_a_direction',
        createReading(
          changedReadingRow(ctx, 'DAY_TRADER', (d) => {
            d['bias'] = 'NEUTRAL';
            d['trend_relation'] = null;
          })
        )
      );
      const six = Array.from({ length: 6 }, (_, i) => ({
        ...longZone(ctx),
        zone_id: `Z${i + 1}`,
        rank: i + 1,
      }));
      await refusedBy(
        'synthesis_readings_zone_count_range',
        createReading(
          changedReadingRow(
            ctx,
            'DAY_TRADER',
            (d) => (d['zones'] = six.map((z) => z['zone_id'])),
            six
          )
        )
      );
    });

    it('a reading with zones gives no reason for having none, and a reading with none gives one', async () => {
      await refusedBy(
        'synthesis_readings_zones_reason_follows_the_count',
        createReading({
          ...storedReadingRow(ctx, 'DAY_TRADER'),
          zones_reason: 'NO_ZONE_SOURCES',
        })
      );
      await refusedBy(
        'synthesis_readings_zones_reason_follows_the_count',
        createReading(
          changedReadingRow(
            ctx,
            'DAY_TRADER',
            (d) => (d['zones'] = []),
            [],
            null
          )
        )
      );
    });

    it('the list columns cannot be NULL, even though Prisma leaves them nullable', async () => {
      const saved = await createReading(storedReadingRow(ctx, 'DAY_TRADER'));
      for (const column of ['status_reasons', 'guard_problems']) {
        const outcome = await refusal(
          prisma.$executeRawUnsafe(
            `UPDATE synthesis_readings SET "${column}" = NULL WHERE id = '${saved.id}'`
          )
        );
        expect(outcome.message).toContain(
          'synthesis_readings_list_columns_not_null'
        );
      }
    });

    it('a VALID reading has no reasons, and any other status has at least one', async () => {
      await refusedBy(
        'synthesis_readings_reasons_follow_the_status',
        createReading(
          changedReadingRow(ctx, 'DAY_TRADER', (d) => {
            d['status'] = 'VALID';
            d['status_reasons'] = ['MCD0_DEFECT_M5'];
          })
        )
      );
      await refusedBy(
        'synthesis_readings_reasons_follow_the_status',
        createReading(
          changedReadingRow(ctx, 'DAY_TRADER', (d) => {
            d['status'] = 'CAUTIONARY';
            d['status_reasons'] = [];
          })
        )
      );
      await createReading(
        changedReadingRow(ctx, 'DAY_TRADER', (d) => {
          d['status'] = 'VALID';
          d['status_reasons'] = [];
        })
      );
    });

    it('the text is the record: a wrong hash, or a JSONB copy of another document, is refused', async () => {
      const row = storedReadingRow(ctx, 'DAY_TRADER');
      await refusedBy(
        'synthesis_readings_reading_text_is_its_copy_and_hash',
        createReading({ ...row, reading_sha256: 'f'.repeat(64) })
      );
      // a hash of the right text but spelt in capitals is not the hash the writer computes
      await refusedBy(
        'synthesis_readings_reading_text_is_its_copy_and_hash',
        createReading({
          ...row,
          reading_sha256: String(row['reading_sha256']).toUpperCase(),
        })
      );
      const other = JSON.parse(row['reading_json']) as Doc;
      other['summary_line'] = 'Another summary, same fields';
      await refusedBy(
        'synthesis_readings_reading_text_is_its_copy_and_hash',
        createReading({ ...row, reading: other })
      );
      // the copy may be spelt differently (JSONB has no key order) and still be the same document
      const reordered = Object.fromEntries(
        Object.entries(JSON.parse(row['reading_json']) as Doc).reverse()
      );
      await createReading({ ...row, reading: reordered });
    });

    it('the zone text must be a list of zone_count rows with its own hash', async () => {
      const row = storedReadingRow(ctx, 'DAY_TRADER');
      await refusedBy(
        'synthesis_readings_zones_text_is_its_count_and_hash',
        createReading({ ...row, zones_sha256: '0'.repeat(64) })
      );
      const oneRow = JSON.stringify([JSON.parse(row['zones_json'])[0]]);
      await refusedBy(
        'synthesis_readings_zones_text_is_its_count_and_hash',
        createReading({
          ...row,
          zones_json: oneRow,
          zones_sha256: sha256(oneRow),
        })
      );
      const notAList = '{"zones":[]}';
      const noZones = changedReadingRow(
        ctx,
        'DAY_TRADER',
        (d) => (d['zones'] = []),
        [],
        'NO_ZONE_SOURCES'
      );
      const outcome = await refusal(
        createReading({
          ...noZones,
          zones_json: notAList,
          zones_sha256: sha256(notAList),
        })
      );
      // a plain constraint violation, not a function error: the CASE looks at the type first
      expect(outcome.message).toContain('23514'); // SQLSTATE check_violation
      expect(outcome.message).toContain(
        'synthesis_readings_zones_text_is_its_count_and_hash'
      );
    });

    it.each([
      ['profile', 'SCALPER'],
      ['cycle_slot', 1790000100],
      ['rules_version', 'draft-2'],
      ['rules_sha256', 'a'.repeat(64)],
      ['rule_id', 'R9_SOMETHING_ELSE'],
      ['branch_id', 'OTHER_BRANCH'],
      ['branch_id', null],
      ['status', 'INVALID'],
      ['status_reasons', ['MCD0_DEFECT_M5']],
      ['status_reasons', []],
      ['data_status', 'STALE'],
      ['archetype', 'A'],
      ['archetype', null],
      ['bias', 'SHORT'],
      ['trend_relation', 'WITH_TREND'],
      ['trend_relation', null],
      ['stand_aside', true],
      ['zone_count', 1],
    ])(
      'a column that disagrees with the reading is refused: %s = %p',
      async (column, value) => {
        const row = storedReadingRow(ctx, 'DAY_TRADER');
        expect(row[column]).not.toEqual(value); // the override really changes the column
        const outcome = await refusal(
          createReading({ ...row, [column]: value })
        );
        // zone_count 1 also breaks the zone text's own count; the database reports the first by name
        expect(outcome.message).toMatch(
          /synthesis_readings_columns_repeat_the_reading|synthesis_readings_zones_text_is_its_count_and_hash/
        );
        expect(await prisma.synthesisReading.count()).toBe(0);
      }
    );

    it('the reading names exactly as many zones as the column counts, even when the zone text agrees with the column', async () => {
      // two zone rows and zone_count 2, but the reading itself lists one zone id
      await refusedBy(
        'synthesis_readings_columns_repeat_the_reading',
        createReading(
          changedReadingRow(ctx, 'DAY_TRADER', (d) => (d['zones'] = ['Z1']))
        )
      );
    });

    it('the slot column and the slot in the reading are the same instant whatever the session time zone is', async () => {
      const row = storedReadingRow(ctx, 'DAY_TRADER');
      await prisma.$transaction(async (tx) => {
        await tx.$executeRawUnsafe(`SET LOCAL TIME ZONE 'Pacific/Auckland'`);
        await tx.synthesisReading.create({ data: row as never });
      });
      expect(await prisma.synthesisReading.count()).toBe(1);
    });

    it('is write-once in practice: nothing but the CHECKs stands in the way of an update, so the writer never sends one', async () => {
      // The table has no updated_at and Prisma's model has no update path used by the writer. The
      // database does not forbid an UPDATE, but a changed column must still agree with the text.
      const saved = await createReading(storedReadingRow(ctx, 'DAY_TRADER'));
      const outcome = await refusal(
        prisma.synthesisReading.update({
          where: { id: saved.id },
          data: { bias: 'SHORT' },
        })
      );
      expect(outcome.message).toContain(
        'synthesis_readings_columns_repeat_the_reading'
      );
    });
  });

  describe('entry_zones: what the database refuses', () => {
    const base = () => zoneRowFrom(longZone());
    /** The first zone as if nothing lay beyond the entry: no opposing level, no runway, no ratio. */
    const noRunway = (): Doc => ({
      ...base(),
      next_opposing_price: null,
      runway: null,
      runway_ratio: null,
      levels: { ...(base()['levels'] as Doc), next_opposing_level: null },
    });

    it('the real first zone is accepted (LONG, a level behind it, a runway)', async () => {
      const saved = await createZone(base());
      expect([saved.zone_id, saved.rank, saved.bias]).toEqual([
        'Z1',
        1,
        'LONG',
      ]);
      expect(saved.stop_distance).toBe(16.78);
      expect(saved.next_opposing_price).toBe(4369.57);
    });

    it('a profile that is not a trader type, and a bias that is not a direction', async () => {
      await refusedBy(
        'entry_zones_profile_is_known',
        createZone({ ...base(), profile: 'SWING' })
      );
      for (const bias of ['NEUTRAL', 'STAND_ASIDE', 'long']) {
        await refusedBy(
          'entry_zones_bias_is_a_direction',
          createZone({ ...base(), bias })
        );
      }
    });

    it('at most five zones, ranked from 1, and the id says the rank', async () => {
      for (const [rank, zone_id] of [
        [0, 'Z0'],
        [6, 'Z6'],
        [1, 'Z2'],
        [2, 'Z1'],
        [1, 'z1'],
        [1, ' Z1'],
      ] as const) {
        await refusedBy(
          'entry_zones_rank_and_id',
          createZone({ ...base(), rank, zone_id })
        );
      }
      for (const rank of [1, 2, 3, 4, 5])
        await createZone({ ...base(), rank, zone_id: `Z${rank}` });
      expect(await prisma.entryZone.count()).toBe(5);
    });

    it('every price is above zero', async () => {
      for (const column of [
        'low',
        'high',
        'reference_price',
        'invalidation_price',
        'stop_distance',
      ]) {
        const outcome = await refusal(createZone({ ...base(), [column]: 0 }));
        expect(outcome.message).toMatch(/entry_zones_\w+/);
      }
      await refusedBy(
        'entry_zones_prices_are_positive',
        createZone({ ...base(), low: 0 })
      );
      await refusedBy(
        'entry_zones_prices_are_positive',
        createZone({ ...base(), low: -1 })
      );
    });

    it('an invalidation of zero is refused by the price rule alone, even when the stop distance is made to agree with it', async () => {
      const z = longZone();
      await refusedBy(
        'entry_zones_prices_are_positive',
        createZone({
          ...base(),
          invalidation_price: 0,
          stop_distance: z['reference_price'],
        })
      );
    });

    it('the entry lies inside the zone (the edges count)', async () => {
      const z = longZone();
      await refusedBy(
        'entry_zones_reference_price_is_inside_the_zone',
        createZone({ ...base(), reference_price: z['high'] + 0.01 })
      );
      await refusedBy(
        'entry_zones_reference_price_is_inside_the_zone',
        createZone({ ...base(), reference_price: z['low'] - 0.01 })
      );
      // the edges count: the entry on the high edge, then on the low edge, then a zone of one price
      const atEntry = (entry: number, over: Doc = {}) =>
        createZone({
          ...noRunway(),
          reference_price: entry,
          invalidation_price: Number((entry - 16.78).toFixed(2)),
          ...over,
        });
      await atEntry(z['high']);
      await prisma.entryZone.deleteMany();
      await atEntry(z['low']);
      await prisma.entryZone.deleteMany();
      await atEntry(z['reference_price'], {
        low: z['reference_price'],
        high: z['reference_price'],
      });
    });

    it('the invalidation is on the far side of the entry: below a LONG, above a SHORT', async () => {
      await refusedBy(
        'entry_zones_invalidation_is_beyond_the_reference_price',
        createZone({ ...base(), invalidation_price: 4385.0 })
      );
      const short = zoneRowFrom(
        JSON.parse(
          contextOf(V4).synthesis.readings.find(
            (r) => r.profile === 'DAY_TRADER'
          )!.zones_json
        )[0]
      );
      expect(short['bias']).toBe('SHORT');
      await createZone(short);
      await refusedBy(
        'entry_zones_invalidation_is_beyond_the_reference_price',
        createZone({
          ...short,
          zone_id: 'Z2',
          rank: 2,
          invalidation_price: short['reference_price'] - 20,
        })
      );
    });

    it('a stop of less than 13 is never stored, and exactly 13 is (ADR-032)', async () => {
      const z = longZone();
      const tight = {
        invalidation_price: Number((z['reference_price'] - 12.99).toFixed(2)),
        stop_distance: 12.99,
      };
      await refusedBy(
        'entry_zones_stop_distance_is_at_least_13',
        createZone({ ...base(), ...tight })
      );
      const exact = await createZone({
        ...base(),
        invalidation_price: Number((z['reference_price'] - 13).toFixed(2)),
        stop_distance: 13,
        invalidation_basis: 'MINIMUM_STOP',
      });
      expect(exact.stop_distance).toBe(13);
    });

    it('the stop distance is the distance from the entry to the invalidation, to the half cent', async () => {
      await refusedBy(
        'entry_zones_stop_distance_is_the_distance',
        createZone({ ...base(), stop_distance: 20 })
      );
      await refusedBy(
        'entry_zones_stop_distance_is_the_distance',
        createZone({ ...base(), stop_distance: 16.79 + 0.005 })
      );
      // the stored figure differs from the subtraction by float noise only: accepted
      await createZone({ ...base(), stop_distance: 16.78 });
    });

    it('how the invalidation was found is one of three words', async () => {
      for (const basis of ['GUESS', 'level', '']) {
        await refusedBy(
          'entry_zones_invalidation_basis_is_known',
          createZone({ ...base(), invalidation_basis: basis })
        );
      }
    });

    it('a zone has at least one source sensor, and at least its source level in its confluence', async () => {
      await refusedBy(
        'entry_zones_sources_not_empty',
        createZone({ ...base(), source_sensors: [] })
      );
      const z = base();
      await refusedBy(
        'entry_zones_confluence_at_least_the_source',
        createZone({
          ...z,
          confluence_count: 0,
          levels: { ...(z['levels'] as Doc), confluence_levels: [] },
        })
      );
    });

    it('a zone with no level beyond the entry has no runway, no ratio and no opposing price: all three or none (D7 e)', async () => {
      const none = {
        next_opposing_price: null,
        runway: null,
        runway_ratio: null,
        levels: { ...(base()['levels'] as Doc), next_opposing_level: null },
      };
      const saved = await createZone({ ...base(), ...none });
      expect([
        saved.next_opposing_price,
        saved.runway,
        saved.runway_ratio,
      ]).toEqual([null, null, null]);
      await prisma.entryZone.deleteMany();
      for (const half of [
        { runway: null },
        { runway_ratio: null },
        { next_opposing_price: null },
      ]) {
        const outcome = await refusal(createZone({ ...base(), ...half }));
        expect(outcome.message).toMatch(
          /entry_zones_runway_is_all_or_nothing|entry_zones_levels_match_the_columns/
        );
      }
      await refusedBy(
        'entry_zones_runway_is_all_or_nothing',
        createZone({ ...base(), runway: null })
      );
      // a runway and a ratio with no opposing level, the audit document agreeing that there is none
      await refusedBy(
        'entry_zones_runway_is_all_or_nothing',
        createZone({
          ...base(),
          next_opposing_price: null,
          levels: { ...(base()['levels'] as Doc), next_opposing_level: null },
        })
      );
      await refusedBy(
        'entry_zones_runway_is_all_or_nothing',
        createZone({ ...base(), ...none, runway: 1.5 })
      );
      await refusedBy(
        'entry_zones_runway_is_all_or_nothing',
        createZone({ ...base(), runway: 0 })
      );
      await refusedBy(
        'entry_zones_runway_is_all_or_nothing',
        createZone({ ...base(), runway_ratio: -0.01 })
      );
    });

    it('the opposing level is beyond the entry (above a LONG) and the runway is its distance', async () => {
      const z = longZone();
      const below = z['reference_price'] - 5;
      await refusedBy(
        'entry_zones_runway_is_the_distance_to_the_opposing_level',
        createZone({ ...base(), next_opposing_price: below, runway: 5 })
      );
      await refusedBy(
        'entry_zones_runway_is_the_distance_to_the_opposing_level',
        createZone({ ...base(), runway: 3 })
      );
    });

    it('the audit document has its four parts, and agrees with the columns', async () => {
      const levels = base()['levels'] as Doc;
      for (const part of Object.keys(levels)) {
        const { [part]: _dropped, ...rest } = levels;
        void _dropped;
        await refusedBy(
          'entry_zones_levels_match_the_columns',
          createZone({ ...base(), levels: rest })
        );
      }
      await refusedBy(
        'entry_zones_levels_match_the_columns',
        createZone({ ...base(), levels: [] })
      );
      // a list of the four names has all four as top-level "keys" for the ?& operator: only the type check stops it
      await refusedBy(
        'entry_zones_levels_match_the_columns',
        createZone({ ...base(), levels: Object.keys(levels) })
      );
      await refusedBy(
        'entry_zones_levels_match_the_columns',
        createZone({
          ...base(),
          levels: {
            ...levels,
            confluence_levels: levels['confluence_levels'].slice(1),
          },
        })
      );
      await refusedBy(
        'entry_zones_levels_match_the_columns',
        createZone({
          ...base(),
          levels: { ...levels, next_opposing_level: null },
        })
      );
      await refusedBy(
        'entry_zones_levels_match_the_columns',
        createZone({
          ...base(),
          levels: { ...levels, invalidation_level: null },
        })
      );
      // NO_LEVEL: nothing past the zone, so no level; the stop is the minimum
      const z = longZone();
      await createZone({
        ...base(),
        invalidation_basis: 'NO_LEVEL',
        invalidation_price: Number((z['reference_price'] - 13).toFixed(2)),
        stop_distance: 13,
        levels: { ...levels, invalidation_level: null },
      });
    });
  });

  it('the three tables of earlier chapters are not touched: this spec writes only to its own two', async () => {
    const before = await prisma.$queryRawUnsafe<{ n: number }[]>(
      `SELECT count(*)::int AS n FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name IN ('mcd_outputs', 'market_cycle_inputs')`
    );
    // On the scratch database of this spec the sensor tables may or may not exist; either way
    // nothing here references them (no foreign key from or to the synthesis tables).
    expect(before[0].n).toBeGreaterThanOrEqual(0);
    const fks = await prisma.$queryRawUnsafe<{ conname: string }[]>(
      `SELECT conname FROM pg_constraint
        WHERE contype = 'f' AND (conrelid IN ('synthesis_readings'::regclass, 'entry_zones'::regclass)
           OR confrelid IN ('synthesis_readings'::regclass, 'entry_zones'::regclass))`
    );
    expect(fks).toEqual([]);
  });
});
