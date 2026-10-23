/**
 * The live-row upsert returns the id only (Unit U), against a REAL Postgres.
 *
 * `market-data.processor.spec.ts` pins the call with a mock. This spec shows what the call does to a
 * real database: the REAL `MarketDataProcessor` with the REAL `PrismaService` runs one fixed, serial
 * job sequence TWICE on an emptied pair of tables, once as shipped and once through a thin delegating
 * wrapper that strips `select` from the upsert's arguments (the call as it was before the projection).
 * What the database holds afterwards, and what each job reported, must be identical.
 *
 * The sequence: a new closed bar; the same key redelivered; the same key in a second cycle with changed
 * indicator values and `cycle_id`; a second closed bar (M15) and its redelivery; a forming bar and its
 * redelivery; a bar whose live upsert the database refuses; a closed bar whose snapshot insert the
 * database refuses. The two refusals are real: two triggers this spec creates on the scratch database.
 *
 * It proves persisted rows and job outcomes. It does NOT prove speed, write cost, or production behaviour:
 * the projection narrows the row the upsert RETURNS, nothing the upsert WRITES.
 *
 * SKIPPED unless BOTH are set:
 *   CYCLE_PG_URL         a postgres URL on localhost or 127.0.0.1 (anything else is refused)
 *   CYCLE_PG_ALLOW_WIPE  "yes": it DELETES every row of market_data_v6 and market_data_point_in_time
 *                        in that database, and creates and drops two triggers on them
 *
 * To run it without Docker, on a throwaway PostgreSQL 18 cluster (see database-traps.md): `initdb`, start
 * `postgres.exe` with `Start-Process` (hidden, never `pg_ctl start` in a tool call), create the tables
 * with `prisma migrate diff --config <scratch config outside the repo> --from-empty
 * --to-schema railway-gateway/prisma/schema.prisma --script` (keep the text from `-- CreateSchema`),
 * then CYCLE_PG_URL=postgres://postgres@127.0.0.1:<port>/<db> CYCLE_PG_ALLOW_WIPE=yes
 *      npx jest test/market-data.processor.pg.spec.ts --runInBand
 */
import { Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { Job } from 'bull';
import { MarketDataDto } from '../src/gateway/dto/market-data.dto';
import { PrismaService } from '../src/prisma/prisma.service';
import { CycleManifestService } from '../src/worker/cycle-manifest.service';
import { MarketDataProcessor } from '../src/worker/market-data.processor';
import { SNAPSHOT_COLUMNS } from '../src/worker/point-in-time-snapshot';

const URL = process.env['CYCLE_PG_URL'] ?? '';
const enabled = URL !== '' && process.env['CYCLE_PG_ALLOW_WIPE'] === 'yes';
if (
  enabled &&
  !/^postgres(ql)?:\/\/[^@]*@(localhost|127\.0\.0\.1):\d+\//.test(URL)
) {
  throw new Error('CYCLE_PG_URL must point at localhost or 127.0.0.1');
}
const suite = enabled ? describe : describe.skip;

jest.setTimeout(120_000);

type Row = Record<string, unknown>;
type Outcome =
  | { status: 'resolved'; value: unknown }
  | { status: 'rejected'; refusedByTheDatabase: boolean };

interface Run {
  /** The `select` each live upsert was called with, in call order. */
  selects: unknown[];
  /** How many fields each live upsert resolved with, in call order. */
  fieldsReturned: number[];
  outcomes: Record<string, Outcome>;
  live: Row[];
  pit: Row[];
  warnings: string[];
}

const REFUSAL = 'unit-u forced failure';
const FAIL_SYMBOL = 'UNITU_FAIL'; // the live upsert is refused
const PIT_FAIL_SYMBOL = 'UNITU_PIT'; // the live upsert lands, the snapshot insert is refused

// A fixed clock, so a snapshot's `first_seen_at` and age are the same in both runs.
const NOW_SEC = 1_700_000_000;
const NOW_MS = NOW_SEC * 1000;

const model = (
  Prisma as unknown as {
    dmmf: {
      datamodel: {
        models: Array<{
          name: string;
          fields: Array<{ name: string; kind: string; type: string }>;
        }>;
      };
    };
  }
).dmmf.datamodel.models.find((m) => m.name === 'MarketDataV6')!;
const GENERATED = new Set(['id', 'createdAt', 'updatedAt']);
const CONTRACT_FIELDS = model.fields.filter(
  (f) => f.kind !== 'object' && !GENERATED.has(f.name)
);

interface Key {
  symbol: string;
  timeframe: 'M5' | 'M15';
  timestamp: number;
}

/** One value for every contract field of the table; `variant` shifts every indicator value. */
function payload(key: Key, cycleId: number, variant: number): MarketDataDto {
  const data: Record<string, unknown> = {};
  CONTRACT_FIELDS.forEach((field, i) => {
    if (field.name === 'terminal_id') data[field.name] = 'push_worker_v5';
    else if (field.name === 'symbol') data[field.name] = key.symbol;
    else if (field.name === 'timeframe') data[field.name] = key.timeframe;
    else if (field.name === 'timestamp') data[field.name] = key.timestamp;
    else if (field.name === 'cycle_id') data[field.name] = cycleId;
    else if (field.name === 'collected_at')
      data[field.name] = NOW_SEC + cycleId;
    else if (field.type === 'Int') data[field.name] = i + 1 + variant * 1000;
    else if (field.type === 'Float')
      data[field.name] = i + 0.5 + variant * 1000;
    else if (field.type === 'String')
      data[field.name] = `s_${field.name}_${variant}`;
    else throw new Error(`unexpected field type ${field.type} (${field.name})`);
  });
  return data as unknown as MarketDataDto;
}

const BAR_A: Key = {
  symbol: 'XAUUSD',
  timeframe: 'M5',
  timestamp: NOW_SEC - 3600,
};
const BAR_B: Key = {
  symbol: 'XAUUSD',
  timeframe: 'M15',
  timestamp: NOW_SEC - 7200,
};
const BAR_C: Key = {
  symbol: 'XAUUSD',
  timeframe: 'M5',
  timestamp: NOW_SEC - 30,
}; // still forming
const BAR_D: Key = {
  symbol: FAIL_SYMBOL,
  timeframe: 'M5',
  timestamp: NOW_SEC - 3000,
};
const BAR_E: Key = {
  symbol: PIT_FAIL_SYMBOL,
  timeframe: 'M5',
  timestamp: NOW_SEC - 2400,
};

/** The fixed, serial sequence. `name` is how a test finds the outcome. */
const SEQUENCE: Array<{ name: string; data: MarketDataDto }> = [
  { name: 'A1 new closed bar, cycle 1', data: payload(BAR_A, 1, 0) },
  { name: 'A2 same key redelivered', data: payload(BAR_A, 1, 0) },
  {
    name: 'A3 same key, second cycle, changed values',
    data: payload(BAR_A, 2, 1),
  },
  { name: 'B1 new closed bar (M15)', data: payload(BAR_B, 2, 0) },
  { name: 'B2 closed bar again', data: payload(BAR_B, 2, 0) },
  { name: 'C1 forming bar', data: payload(BAR_C, 2, 0) },
  { name: 'C2 forming bar, next cycle', data: payload(BAR_C, 3, 1) },
  { name: 'D1 live upsert refused', data: payload(BAR_D, 3, 0) },
  { name: 'E1 snapshot insert refused', data: payload(BAR_E, 3, 0) },
];

const FIRST_A = payload(BAR_A, 1, 0);
const SECOND_A = payload(BAR_A, 2, 1);

const without = (row: Row, drop: string[]): Row =>
  Object.fromEntries(Object.entries(row).filter(([k]) => !drop.includes(k)));
const keyOf = (row: Row) =>
  `${row['symbol']}|${row['timeframe']}|${row['timestamp']}`;

suite('the live-row upsert returns the id only, on a real Postgres', () => {
  let prisma: PrismaService;
  let shipped: Run;
  let stripped: Run;

  /** Run the whole sequence once. `strip` removes `select` from the upsert's arguments. */
  async function runSequence(strip: boolean): Promise<Run> {
    await prisma.$executeRawUnsafe('DELETE FROM market_data_point_in_time');
    await prisma.$executeRawUnsafe('DELETE FROM market_data_v6');

    const selects: unknown[] = [];
    const fieldsReturned: number[] = [];
    const warnings: string[] = [];
    jest.spyOn(Logger.prototype, 'warn').mockImplementation((message) => {
      warnings.push(String(message));
    });

    // A delegating view of the real client. It passes every argument through untouched except, when
    // `strip` is set, `select`; it records what it saw and what came back. Nothing else is replaced.
    const view = {
      marketDataV6: {
        upsert: async (args: Record<string, unknown>) => {
          selects.push(args['select']);
          const { select: _select, ...rest } = args;
          const result = await prisma.marketDataV6.upsert(
            (strip ? rest : args) as never
          );
          fieldsReturned.push(Object.keys(result as object).length);
          return result;
        },
      },
      marketDataPointInTime: prisma.marketDataPointInTime,
    };
    const processor = new MarketDataProcessor(
      view as unknown as PrismaService,
      {
        handle: async () => {
          throw new Error('a row job must not reach the manifest service');
        },
      } as unknown as CycleManifestService
    );

    const outcomes: Record<string, Outcome> = {};
    for (const step of SEQUENCE) {
      const job = {
        name: 'process',
        id: step.name,
        data: step.data,
      } as unknown as Job;
      try {
        outcomes[step.name] = {
          status: 'resolved',
          value: await processor.process(job),
        };
      } catch (error) {
        outcomes[step.name] = {
          status: 'rejected',
          refusedByTheDatabase: String((error as Error).message).includes(
            REFUSAL
          ),
        };
      }
    }
    jest.restoreAllMocks();
    jest.spyOn(Date, 'now').mockReturnValue(NOW_MS);

    const live = await prisma.$queryRawUnsafe<Row[]>(
      'SELECT * FROM market_data_v6 ORDER BY symbol, timeframe, timestamp'
    );
    const pit = await prisma.$queryRawUnsafe<Row[]>(
      'SELECT * FROM market_data_point_in_time ORDER BY symbol, timeframe, timestamp'
    );
    return {
      selects,
      fieldsReturned,
      outcomes,
      live: live.map((r) => without(r, ['id', 'createdAt', 'updatedAt'])),
      pit: pit.map((r) => without(r, ['id', 'createdAt'])),
      warnings,
    };
  }

  beforeAll(async () => {
    jest.spyOn(Date, 'now').mockReturnValue(NOW_MS);
    process.env['DATABASE_URL'] = URL;
    prisma = new PrismaService();
    await prisma.$connect();

    await prisma.$executeRawUnsafe(
      `CREATE OR REPLACE FUNCTION unit_u_refuse() RETURNS trigger AS $$ BEGIN RAISE EXCEPTION '${REFUSAL}'; END; $$ LANGUAGE plpgsql`
    );
    await prisma.$executeRawUnsafe(
      'DROP TRIGGER IF EXISTS unit_u_refuse_live ON market_data_v6'
    );
    await prisma.$executeRawUnsafe(
      `CREATE TRIGGER unit_u_refuse_live BEFORE INSERT OR UPDATE ON market_data_v6 FOR EACH ROW WHEN (NEW.symbol = '${FAIL_SYMBOL}') EXECUTE FUNCTION unit_u_refuse()`
    );
    await prisma.$executeRawUnsafe(
      'DROP TRIGGER IF EXISTS unit_u_refuse_pit ON market_data_point_in_time'
    );
    await prisma.$executeRawUnsafe(
      `CREATE TRIGGER unit_u_refuse_pit BEFORE INSERT ON market_data_point_in_time FOR EACH ROW WHEN (NEW.symbol = '${PIT_FAIL_SYMBOL}') EXECUTE FUNCTION unit_u_refuse()`
    );

    shipped = await runSequence(false);
    stripped = await runSequence(true);
  });

  afterAll(async () => {
    jest.restoreAllMocks();
    await prisma.$executeRawUnsafe(
      'DROP TRIGGER IF EXISTS unit_u_refuse_live ON market_data_v6'
    );
    await prisma.$executeRawUnsafe(
      'DROP TRIGGER IF EXISTS unit_u_refuse_pit ON market_data_point_in_time'
    );
    await prisma.$executeRawUnsafe('DROP FUNCTION IF EXISTS unit_u_refuse()');
    await prisma.$disconnect();
  });

  describe('what the projection changes', () => {
    // Every job calls the upsert once; the refused one throws, so it adds no entry to `fieldsReturned`.
    const RESOLVED_UPSERTS = SEQUENCE.length - 1;

    it('the shipped processor asks for the id only on every live upsert, and gets one field back', () => {
      expect(shipped.selects).toEqual(SEQUENCE.map(() => ({ id: true })));
      expect(shipped.fieldsReturned).toEqual(Array(RESOLVED_UPSERTS).fill(1));
    });

    it('the control: with `select` stripped the same upserts return the whole row (106 fields)', () => {
      // the wrapper saw `select` on every call, and removed it before the database call
      expect(stripped.selects).toEqual(SEQUENCE.map(() => ({ id: true })));
      expect(model.fields.filter((f) => f.kind !== 'object')).toHaveLength(106);
      expect(stripped.fieldsReturned).toEqual(
        Array(RESOLVED_UPSERTS).fill(106)
      );
    });
  });

  describe('what it must not change', () => {
    it('the persisted live rows are equal with and without the projection', () => {
      expect(shipped.live).toEqual(stripped.live);
    });

    it('the persisted point-in-time rows are equal with and without the projection', () => {
      expect(shipped.pit).toEqual(stripped.pit);
    });

    it('every job reports the same outcome with and without the projection', () => {
      expect(shipped.outcomes).toEqual(stripped.outcomes);
      expect(Object.keys(shipped.outcomes)).toEqual(
        SEQUENCE.map((s) => s.name)
      );
    });

    it('the warnings are the same with and without the projection', () => {
      expect(shipped.warnings).toEqual(stripped.warnings);
    });
  });

  const RUNS: Array<[string, () => Run]> = [
    ['as shipped', () => shipped],
    ['without the projection', () => stripped],
  ];

  describe.each(RUNS)('the database after the sequence, %s', (_label, run) => {
    it('holds exactly one live row per natural key, and none for the refused bar', () => {
      const keys = run().live.map(keyOf);
      expect(new Set(keys).size).toBe(keys.length);
      expect(keys.sort()).toEqual(
        [BAR_A, BAR_B, BAR_C, BAR_E]
          .map((k) => `${k.symbol}|${k.timeframe}|${k.timestamp}`)
          .sort()
      );
    });

    it('the repeated key holds the SECOND payload and the second cycle_id', () => {
      const row = run().live.find(
        (r) => keyOf(r) === `XAUUSD|M5|${BAR_A.timestamp}`
      )!;
      expect(row).toEqual(SECOND_A);
      expect(row['cycle_id']).toBe(2);
      expect(row['collected_at']).toBe(NOW_SEC + 2);
    });

    it('a closed bar froze once, with its FIRST payload, and its redelivery did not freeze it again', () => {
      const frozen = run().pit.filter((r) => r['symbol'] === 'XAUUSD');
      const a = frozen.filter((r) => r['timeframe'] === 'M5');
      const b = frozen.filter((r) => r['timeframe'] === 'M15');
      expect(a).toHaveLength(1);
      expect(b).toHaveLength(1);
      expect(a[0]).toMatchObject({
        timestamp: BAR_A.timestamp,
        cycle_id: 1,
        collected_at: NOW_SEC + 1,
        first_seen_at: NOW_SEC,
        snapshot_age_bars: 12,
      });
      for (const column of SNAPSHOT_COLUMNS) {
        expect(a[0][column]).toBe((FIRST_A as unknown as Row)[column]);
      }
      expect(b[0]).toMatchObject({
        timestamp: BAR_B.timestamp,
        snapshot_age_bars: 8,
      });
    });

    it('the forming bar is rewritten in place and never frozen', () => {
      const row = run().live.find((r) => r['timestamp'] === BAR_C.timestamp)!;
      expect(row['cycle_id']).toBe(3);
      expect(run().pit.some((r) => r['timestamp'] === BAR_C.timestamp)).toBe(
        false
      );
    });

    it('a refused live upsert rejects the job and leaves neither a live row nor a snapshot', () => {
      expect(run().outcomes['D1 live upsert refused']).toEqual({
        status: 'rejected',
        refusedByTheDatabase: true,
      });
      expect(run().live.some((r) => r['symbol'] === FAIL_SYMBOL)).toBe(false);
      expect(run().pit.some((r) => r['symbol'] === FAIL_SYMBOL)).toBe(false);
    });

    it('a refused snapshot insert does not fail the row: the job succeeds, the row lands, one warning is logged', () => {
      expect(run().outcomes['E1 snapshot insert refused']).toEqual({
        status: 'resolved',
        value: { success: true },
      });
      expect(run().live.some((r) => r['symbol'] === PIT_FAIL_SYMBOL)).toBe(
        true
      );
      expect(run().pit.some((r) => r['symbol'] === PIT_FAIL_SYMBOL)).toBe(
        false
      );
      expect(run().warnings).toHaveLength(1);
      expect(run().warnings[0]).toContain('Point-in-time snapshot skipped');
    });

    it('every job that was not refused resolves with { success: true }', () => {
      for (const step of SEQUENCE.filter((s) => !s.name.startsWith('D1'))) {
        expect(run().outcomes[step.name]).toEqual({
          status: 'resolved',
          value: { success: true },
        });
      }
    });
  });
});
