/**
 * The read side and the manifest service against a REAL Postgres.
 *
 * The other specs use an in-memory stand-in for Prisma, which proves the logic but
 * not that the queries mean what the stand-in assumes (the READY filter, the
 * compound unique keys, `select` projections, `orderBy` + `take`, a JSONB column).
 * This spec runs the real services with a real Prisma client.
 *
 * SKIPPED unless BOTH are set:
 *   CYCLE_PG_URL         a postgres URL on localhost or 127.0.0.1 (anything else is refused)
 *   CYCLE_PG_ALLOW_WIPE  "yes": it DELETES every row of market_data_v6, indicator_statistics,
 *                        indicator_configs and market_cycles in that database
 *
 * To run it without Docker, on a throwaway database (see database-traps.md):
 *   1. `npx prisma dev --detach --name <x>` and take the direct TCP URL it prints;
 *   2. create the tables from the gateway's own schema with a scratch Prisma config
 *      OUTSIDE the repo that holds only that local URL:
 *      `prisma migrate diff --config <scratch> --from-empty
 *       --to-schema railway-gateway/prisma/schema.prisma --script`, and apply the SQL
 *      (strip the two dotenv lines it prints first);
 *   3. CYCLE_PG_URL=<that url> CYCLE_PG_ALLOW_WIPE=yes npx jest test/cycle-readers.pg.spec.ts
 *   4. `prisma dev stop <x>` and `prisma dev rm <x>`.
 */
import * as fs from 'fs';
import * as path from 'path';
import { Logger } from '@nestjs/common';
import type { Job, Queue } from 'bull';
import { CycleManifest } from '../src/cycle/cycle-manifest.contract';
import { digestClosedSpine } from '../src/cycle/closed-bars-digest';
import { MANIFEST_THRESHOLDS } from '../src/cycle/manifest-thresholds';
import { CycleReaderService } from '../src/cycle/read/cycle-reader.service';
import { STATISTIC_SOURCES } from '../src/cycle/read/read-types';
import { PrismaService } from '../src/prisma/prisma.service';
import {
  CycleManifestJobData,
  CycleManifestService,
} from '../src/worker/cycle-manifest.service';
import { FakeQueue } from './helpers/fake-cycle-store';

const URL = process.env['CYCLE_PG_URL'] ?? '';
const enabled = URL !== '' && process.env['CYCLE_PG_ALLOW_WIPE'] === 'yes';
if (
  enabled &&
  !/^postgres(ql)?:\/\/[^@]*@(localhost|127\.0\.0\.1):\d+\//.test(URL)
) {
  throw new Error('CYCLE_PG_URL must point at localhost or 127.0.0.1');
}
const suite = enabled ? describe : describe.skip;

const refresh: CycleManifest = JSON.parse(
  fs.readFileSync(
    path.join(__dirname, 'fixtures', 'cycle-manifest-refresh-slot.json'),
    'utf8'
  )
);
const SLOT = refresh.slot;
const ARRIVAL = SLOT + 62;
const STEP = { M5: 300, M15: 900 } as const;
const IDS = {
  M5: refresh.timeframes.M5.collection_cycle_id,
  M15: refresh.timeframes.M15!.collection_cycle_id,
};

const job = (
  manifest: CycleManifest,
  receivedAt: number,
  checks?: number
): Job<CycleManifestJobData> =>
  ({
    name: 'cycle-manifest',
    id: `cycle_manifest_${manifest.symbol}_${manifest.slot}`,
    data: { manifest, receivedAt, ...(checks ? { checks } : {}) },
  }) as unknown as Job<CycleManifestJobData>;

suite('cycle readers and the manifest service on a real Postgres', () => {
  let prisma: PrismaService;
  let sync: FakeQueue;
  let ready: FakeQueue;
  let writer: CycleManifestService;
  let reader: CycleReaderService;

  beforeAll(async () => {
    process.env['DATABASE_URL'] = URL;
    prisma = new PrismaService();
    await prisma.$connect();
  });
  afterAll(async () => {
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    await prisma.$executeRawUnsafe('DELETE FROM indicator_statistics');
    await prisma.$executeRawUnsafe('DELETE FROM indicator_configs');
    await prisma.$executeRawUnsafe('DELETE FROM market_data_v6');
    await prisma.$executeRawUnsafe('DELETE FROM market_cycles');
    await prisma.indicatorConfig.create({
      data: {
        config_hash: 'cfg1',
        source: 'best_fit_a',
        params: {},
        first_seen: 1,
      },
    });
    sync = new FakeQueue();
    ready = new FakeQueue();
    writer = new CycleManifestService(
      prisma,
      sync as unknown as Queue,
      ready as unknown as Queue
    );
    reader = new CycleReaderService(prisma);
  });
  afterEach(() => jest.restoreAllMocks());

  async function landBars(options: { skip?: number[] } = {}) {
    const rows = [];
    for (const timeframe of ['M5', 'M15'] as const) {
      const s = refresh.timeframes[timeframe]!;
      for (let i = 0; i < s.bar_count; i += 1) {
        const timestamp = s.oldest_bar_ts + i * STEP[timeframe];
        if (timeframe === 'M5' && options.skip?.includes(timestamp)) continue;
        rows.push({
          terminal_id: 'push_worker_v5',
          symbol: 'XAUUSD',
          timeframe,
          timestamp,
          open: 2650.1 + (timestamp % 97) * 0.013,
          high: 2651.7 + (timestamp % 97) * 0.013,
          low: 2649.3 + (timestamp % 97) * 0.013,
          close: 2650.55 + (timestamp % 97) * 0.013,
          volume: 100 + (timestamp % 11),
          cycle_id: IDS[timeframe],
          collected_at: SLOT,
        });
      }
    }
    await prisma.marketDataV6.createMany({ data: rows, skipDuplicates: true });
  }

  async function landStatistics(
    only?: (timeframe: string, source: string) => boolean
  ) {
    for (const timeframe of ['M5', 'M15'] as const) {
      const s = refresh.timeframes[timeframe]!;
      for (let i = 0; i < s.statistics_count; i += 1) {
        const source = STATISTIC_SOURCES[i];
        if (only && !only(timeframe, source)) continue;
        await prisma.indicatorStatistic.create({
          data: {
            terminal_id: 'push_worker_v5',
            symbol: 'XAUUSD',
            timeframe,
            source,
            captured_at: SLOT,
            live_bar_ts: s.newest_bar_ts,
            cycle_id: IDS[timeframe],
            config_hash: 'cfg1',
          },
        });
      }
    }
  }

  const cycleRow = async () =>
    (
      await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
        `SELECT * FROM market_cycles WHERE symbol = 'XAUUSD' AND slot = ${SLOT}`
      )
    )[0];

  it('a READY cycle: the newest READY cycle, one day of bars whose digest equals SQL’s, the labelled price, statistics by key', async () => {
    await landBars();
    await landStatistics();
    expect(await writer.handle(job(refresh, ARRIVAL), ARRIVAL + 1)).toEqual({
      outcome: 'ready',
    });

    expect(await reader.getNewestReadyCycle()).toMatchObject({
      slot: SLOT,
      dataStatus: 'FRESH',
      attempts: 2,
      retuning: false,
      m5CollectionCycleId: IDS.M5,
    });

    const day = await reader.getOneDayOhlc(SLOT);
    if (day.status !== 'OK')
      throw new Error(`expected OK, got ${JSON.stringify(day)}`);
    expect(day.bars.M5).toHaveLength(288);
    expect(day.bars.M15).toHaveLength(96);
    expect(day.replay.matches).toBe(true);

    // the same digest worked out from plain SQL, not through the reader's query
    const spine: Record<'M5' | 'M15', never[]> = { M5: [], M15: [] };
    for (const timeframe of ['M5', 'M15'] as const) {
      const rows = await prisma.$queryRawUnsafe<Array<Record<string, number>>>(
        `SELECT timestamp, open, high, low, close, volume FROM market_data_v6
         WHERE symbol = 'XAUUSD' AND timeframe = '${timeframe}' AND timestamp + ${STEP[timeframe]} <= ${SLOT}
         ORDER BY timestamp DESC LIMIT ${timeframe === 'M5' ? 288 : 96}`
      );
      (spine as Record<string, unknown[]>)[timeframe] = rows
        .reverse()
        .map((r) => ({ ...r, volume: Number(r['volume']) }));
    }
    expect(day.replay.digest).toBe(digestClosedSpine(spine as never));

    const stub = await prisma.marketDataV6.findUnique({
      where: {
        symbol_timeframe_timestamp: {
          symbol: 'XAUUSD',
          timeframe: 'M5',
          timestamp: SLOT,
        },
      },
    });
    expect(day.lastPrice).toEqual({
      status: 'OK',
      price: stub!.close,
      barOpenTime: SLOT,
      asOf: refresh.timeframes.M5.export_mtime,
    });
    expect(day.bars.M5.some((b) => b.timestamp === SLOT)).toBe(false);

    const m5 = await reader.getClosedBars('M5', SLOT, 10);
    if (m5.status !== 'OK') throw new Error('expected OK');
    expect(m5.newestOpenTime).toBe(SLOT - 300);

    const stats = await reader.getStatisticsAtSlot('best_fit_a', 'M5', SLOT);
    if (stats.status !== 'OK') throw new Error('expected OK');
    expect(stats.row.captured_at).toBe(SLOT);
    expect(stats.row.source).toBe('best_fit_a');
  });

  it('statistics are looked up by the exact key: an older row never stands in', async () => {
    await landBars();
    await landStatistics();
    await writer.handle(job(refresh, ARRIVAL), ARRIVAL + 1);
    await prisma.indicatorStatistic.create({
      data: {
        terminal_id: 'push_worker_v5',
        symbol: 'XAUUSD',
        timeframe: 'M5',
        source: 'non_b',
        captured_at: SLOT - 300,
        live_bar_ts: SLOT - 300,
        cycle_id: IDS.M5 - 1,
        config_hash: 'cfg1',
      },
    });
    expect(await reader.getStatisticsAtSlot('non_b', 'M5', SLOT)).toMatchObject(
      {
        status: 'STALE',
        reason: 'NO_STATISTICS_AT_SLOT',
      }
    );
  });

  it('the newest row is an older cycle’s copy: PENDING and unreadable, then READY and readable when this cycle’s version lands', async () => {
    await landBars();
    await landStatistics();
    await prisma.marketDataV6.update({
      where: {
        symbol_timeframe_timestamp: {
          symbol: 'XAUUSD',
          timeframe: 'M5',
          timestamp: SLOT,
        },
      },
      data: { cycle_id: IDS.M5 - 1 },
    });

    expect(await writer.handle(job(refresh, ARRIVAL), ARRIVAL + 2)).toEqual({
      outcome: 'waiting',
    });
    expect((await cycleRow())['state']).toBe('PENDING');
    expect(await reader.getOneDayOhlc(SLOT)).toMatchObject({
      status: 'STALE',
      reason: 'CYCLE_NOT_READY',
    });

    await prisma.marketDataV6.update({
      where: {
        symbol_timeframe_timestamp: {
          symbol: 'XAUUSD',
          timeframe: 'M5',
          timestamp: SLOT,
        },
      },
      data: { cycle_id: IDS.M5 },
    });
    const recheck = sync.adds[0].data as CycleManifestJobData;
    expect(
      await writer.handle(
        job(recheck.manifest, recheck.receivedAt, recheck.checks),
        ARRIVAL + 8
      )
    ).toEqual({ outcome: 'ready' });
    expect((await reader.getOneDayOhlc(SLOT)).status).toBe('OK');
  });

  it('INCOMPLETE: every reader says STALE although the bars and statistics are in the tables', async () => {
    await landBars({ skip: [SLOT - 600, SLOT - 900] });
    await landStatistics();
    expect(
      await writer.handle(
        job(refresh, ARRIVAL),
        ARRIVAL + MANIFEST_THRESHOLDS.landedGiveUpAfterSec
      )
    ).toEqual({ outcome: 'incomplete' });
    expect((await cycleRow())['state']).toBe('INCOMPLETE');

    expect(await reader.getNewestReadyCycle()).toBeNull();
    expect(await reader.getOneDayOhlc(SLOT)).toMatchObject({
      status: 'STALE',
      reason: 'CYCLE_NOT_READY',
    });
    expect(await reader.getClosedBars('M5', SLOT, 50)).toMatchObject({
      status: 'STALE',
      reason: 'CYCLE_NOT_READY',
    });
    expect(
      await reader.getStatisticsAtSlot('best_fit_a', 'M5', SLOT)
    ).toMatchObject({
      status: 'STALE',
      reason: 'CYCLE_NOT_READY',
    });
  });

  it('statistics short at READY time: read from the JSONB check_detail as STATISTICS_SHORTFALL for the missing source only', async () => {
    await landBars();
    await landStatistics(
      (timeframe, source) => timeframe !== 'M5' || source === 'best_fit_a'
    );
    expect(
      await writer.handle(
        job(refresh, ARRIVAL),
        ARRIVAL + MANIFEST_THRESHOLDS.statisticsGraceSec
      )
    ).toEqual({ outcome: 'ready' });

    expect(
      await reader.getStatisticsAtSlot('best_fit_a', 'M5', SLOT)
    ).toMatchObject({
      status: 'OK',
      cycle: { checkReason: 'STATISTICS_SHORTFALL' },
    });
    expect(
      await reader.getStatisticsAtSlot('best_fit_b', 'M5', SLOT)
    ).toMatchObject({
      status: 'STALE',
      reason: 'STATISTICS_SHORTFALL',
    });
    expect(
      await reader.getStatisticsAtSlot('non_b', 'M15', SLOT)
    ).toMatchObject({
      status: 'STALE',
      reason: 'NO_STATISTICS_AT_SLOT',
    });
  });

  it('a slot replayed after later cycles returned the same closed bars, the price is no longer the cycle’s', async () => {
    await landBars();
    await landStatistics();
    await writer.handle(job(refresh, ARRIVAL), ARRIVAL + 1);
    const first = await reader.getOneDayOhlc(SLOT);

    await prisma.marketDataV6.createMany({
      data: Array.from({ length: 12 }, (_, i) => ({
        terminal_id: 'push_worker_v5',
        symbol: 'XAUUSD',
        timeframe: 'M5',
        timestamp: SLOT + 300 + i * 300,
        open: 2700,
        high: 2701,
        low: 2699,
        close: 2700.5,
        volume: 50,
        cycle_id: IDS.M5 + 1,
        collected_at: SLOT + 300,
      })),
    });
    await prisma.marketDataV6.update({
      where: {
        symbol_timeframe_timestamp: {
          symbol: 'XAUUSD',
          timeframe: 'M5',
          timestamp: SLOT,
        },
      },
      data: { close: 2655.5, cycle_id: IDS.M5 + 1 },
    });

    const replay = await reader.getOneDayOhlc(SLOT);
    if (first.status !== 'OK' || replay.status !== 'OK')
      throw new Error('expected OK');
    expect(replay.bars).toEqual(first.bars);
    expect(replay.replay.matches).toBe(true);
    expect(replay.lastPrice).toEqual({
      status: 'UNAVAILABLE',
      reason: 'NOT_THIS_CYCLES_PRICE',
    });
  });

  it('the newest READY cycle ignores a newer row that is not READY', async () => {
    await landBars();
    await landStatistics();
    await writer.handle(job(refresh, ARRIVAL), ARRIVAL + 1);
    await prisma.marketCycle.create({
      data: {
        symbol: 'XAUUSD',
        slot: SLOT + 300,
        state: 'PENDING',
        attempts: 1,
        manifest_received_at: SLOT + 361,
      },
    });
    expect((await reader.getNewestReadyCycle())!.slot).toBe(SLOT);
    expect(await reader.getReadyCycle(SLOT + 300)).toBeNull();
  });
});
