/**
 * A rehearsed promote against a REAL Postgres (build step 2 parts 9 and 10).
 *
 * promote-retuning.spec.ts proves the rules with an in-memory stand-in for
 * Prisma. This spec runs the same service on the real tables, for what a stand-in
 * can only assume: that "the latest cycle before the slot" and "is there a newer
 * one" mean what the code needs (`lt` / `gt` with an `orderBy`), that the JSON
 * columns of cycle_events and market_cycles round-trip what was written, that
 * `createMany({ skipDuplicates })` on the unique `dedupe_key` really writes a
 * repeat once and a plain `create` really refuses it, that the flag written
 * on a PENDING row is what the next manifest reads, and (Option A, part 10) that
 * the window count means what the code needs: the `gte`/`lte` on the open time,
 * the `lt` on `cycle_id`, the timeframe and the symbol, and the latest PROMOTE at
 * or before the slot (`lte` with `orderBy` desc) really is the one it picks.
 *
 * SKIPPED unless BOTH are set (the same gate as cycle-readers.pg.spec.ts):
 *   CYCLE_PG_URL         a postgres URL on localhost or 127.0.0.1 (anything else is refused)
 *   CYCLE_PG_ALLOW_WIPE  "yes": it DELETES every row of market_data_v6, indicator_statistics,
 *                        indicator_configs, market_cycles and cycle_events in that database
 *
 * To run it without Docker, on a throwaway database, see the header of
 * cycle-readers.pg.spec.ts and database-traps.md. Do not run it at the same time
 * as cycle-readers.pg.spec.ts: both wipe the same tables.
 */
import { Logger } from '@nestjs/common';
import type { Job, Queue } from 'bull';
import { CycleManifest } from '../src/cycle/cycle-manifest.contract';
import { CycleReaderService } from '../src/cycle/read/cycle-reader.service';
import { STATISTIC_SOURCES } from '../src/cycle/read/read-types';
import { preTuningBarsWhere } from '../src/cycle/retuning';
import { PrismaService } from '../src/prisma/prisma.service';
import {
  CycleManifestJobData,
  CycleManifestService,
  CycleReadyJobData,
} from '../src/worker/cycle-manifest.service';
import { FakeQueue } from './helpers/fake-cycle-store';
import { B, S, Tuning, manifestAt } from './helpers/promote-world';

const URL = process.env['CYCLE_PG_URL'] ?? '';
const enabled = URL !== '' && process.env['CYCLE_PG_ALLOW_WIPE'] === 'yes';
if (
  enabled &&
  !/^postgres(ql)?:\/\/[^@]*@(localhost|127\.0\.0\.1):\d+\//.test(URL)
) {
  throw new Error('CYCLE_PG_URL must point at localhost or 127.0.0.1');
}
const suite = enabled ? describe : describe.skip;

const STEP = { M5: 300, M15: 900 } as const;

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

const barRow = (
  symbol: string,
  timeframe: 'M5' | 'M15',
  timestamp: number,
  cycleId: number,
  collectedAt: number
) => ({
  terminal_id: 'push_worker_v5',
  symbol,
  timeframe,
  timestamp,
  open: 2650.1 + (timestamp % 97) * 0.013,
  high: 2651.7 + (timestamp % 97) * 0.013,
  low: 2649.3 + (timestamp % 97) * 0.013,
  close: 2650.55 + (timestamp % 97) * 0.013,
  volume: 100 + (timestamp % 11),
  cycle_id: cycleId,
  collected_at: collectedAt,
});

interface Delivery {
  land?: boolean;
  checks?: number;
  /** 'all': the 3,000-bar window and the bar below it re-pushed under this cycle; a number: that many of the oldest bars of the window. */
  window?: 'all' | number;
}

suite('promote and RETUNING on a real Postgres', () => {
  // A rehearsed promote lands eight slots of bars and statistics, one query at a time.
  jest.setTimeout(120_000);
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
    await prisma.$executeRawUnsafe('DELETE FROM cycle_events');
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

  /**
   * The bars and statistics a manifest describes, as the gateway's row and
   * statistics lanes would have stored them. A row that is already there is
   * OVERWRITTEN, including its cycle_id, as the gateway's upsert does: that is how
   * a cycle's priority set moves its newest rows to the new cycle.
   */
  async function land(m: CycleManifest): Promise<void> {
    const rows = [];
    for (const timeframe of ['M5', 'M15'] as const) {
      const s = m.timeframes[timeframe];
      if (!s) continue;
      for (let i = 0; i < s.bar_count; i += 1) {
        rows.push(
          barRow(
            'XAUUSD',
            timeframe,
            s.oldest_bar_ts + i * STEP[timeframe],
            s.collection_cycle_id,
            m.slot
          )
        );
      }
    }
    await prisma.marketDataV6.createMany({ data: rows, skipDuplicates: true });
    for (const timeframe of ['M5', 'M15'] as const) {
      const s = m.timeframes[timeframe];
      if (!s) continue;
      await prisma.marketDataV6.updateMany({
        where: {
          symbol: 'XAUUSD',
          timeframe,
          timestamp: { gte: s.oldest_bar_ts, lte: s.newest_bar_ts },
        },
        data: { cycle_id: s.collection_cycle_id, collected_at: m.slot },
      });
      for (let i = 0; i < s.statistics_count; i += 1) {
        await prisma.indicatorStatistic.create({
          data: {
            terminal_id: 'push_worker_v5',
            symbol: 'XAUUSD',
            timeframe,
            source: STATISTIC_SOURCES[i],
            captured_at: m.slot,
            live_bar_ts: s.newest_bar_ts,
            cycle_id: s.collection_cycle_id,
            config_hash: 'cfg1',
          },
        });
      }
    }
  }

  /** The collector's first full push: 3,001 bars ending at the manifest's newest bar, under its cycle id. */
  async function seedWindow(m: CycleManifest): Promise<void> {
    const s = m.timeframes.M5;
    const rows = [];
    for (let i = 0; i <= 3000; i += 1) {
      rows.push(
        barRow(
          'XAUUSD',
          'M5',
          s.newest_bar_ts - i * 300,
          s.collection_cycle_id,
          m.slot
        )
      );
    }
    await prisma.marketDataV6.createMany({ data: rows, skipDuplicates: true });
  }

  /** The push worker sending the window again: existing rows take the cycle's id. */
  async function pushWindow(
    m: CycleManifest,
    window: 'all' | number
  ): Promise<void> {
    const s = m.timeframes.M5;
    const first = s.newest_bar_ts - 2999 * 300; // the collector's window
    const lowest = window === 'all' ? first - 300 : first;
    const highest =
      window === 'all' ? s.newest_bar_ts : first + (window - 1) * 300;
    await prisma.marketDataV6.updateMany({
      where: {
        symbol: 'XAUUSD',
        timeframe: 'M5',
        timestamp: { gte: lowest, lte: highest },
      },
      data: { cycle_id: s.collection_cycle_id },
    });
  }

  async function deliver(m: CycleManifest, options: Delivery = {}) {
    if (options.land !== false) await land(m);
    if (options.window !== undefined) await pushWindow(m, options.window);
    const receivedAt = m.slot + 62;
    return writer.handle(job(m, receivedAt, options.checks), receivedAt + 1);
  }

  /** The first cycle: the whole window, written once. */
  async function baseline(o: Tuning = {}) {
    const m = manifestAt(S(0), o);
    await seedWindow(m);
    return deliver(m);
  }

  const cycles = () =>
    prisma.$queryRawUnsafe<
      Array<{
        slot: number;
        state: string;
        retuning: boolean;
        data_status: string | null;
        repush_rows_unsent: number | null;
        terminal_id: string | null;
      }>
    >(
      `SELECT slot, state, retuning, data_status, repush_rows_unsent, terminal_id
       FROM market_cycles WHERE symbol = 'XAUUSD' ORDER BY slot`
    );
  const events = () =>
    prisma.cycleEvent.findMany({ orderBy: { effective_slot: 'asc' } });

  /** The count a READY cycle's log line reports, or null when it did not count. */
  function leftInWindow(slot: number): number | null {
    const calls = (Logger.prototype.log as unknown as jest.Mock).mock
      .calls as unknown[][];
    const line = calls
      .map((c) => String(c[0]))
      .find((l) => l.startsWith(`Cycle XAUUSD ${slot} READY`));
    const found = line?.match(/(\d+) pre-promote M5 bars left in the window/);
    return found ? Number(found[1]) : null;
  }

  /**
   * The same sequence as the in-memory spec (see its comment for the arithmetic):
   * the sender's `repush` is unrelated to the window on purpose.
   */
  const plan: Array<{
    k: number;
    o: Tuning;
    window?: 'all' | number;
    retuning: boolean;
    left: number | null;
  }> = [
    { k: 0, o: { repush: 0 }, retuning: false, left: null },
    { k: 1, o: { repush: 0 }, retuning: false, left: null },
    { k: 2, o: { ...B, repush: 5600 }, retuning: true, left: null },
    { k: 3, o: { ...B, repush: 0 }, window: 1000, retuning: true, left: 1711 },
    { k: 4, o: { ...B, repush: 600 }, window: 2000, retuning: true, left: 709 },
    {
      k: 5,
      o: { ...B, repush: 4000 },
      window: 'all',
      retuning: false,
      left: 0,
    },
    { k: 6, o: { ...B, repush: 0 }, retuning: false, left: null },
    { k: 7, o: { ...B, repush: 0 }, retuning: false, left: null },
  ];

  it('a rehearsed promote: RETUNING, then not, on the real tables, with both events and the stamp the readers see', async () => {
    await seedWindow(manifestAt(S(0), plan[0].o));
    for (const step of plan) {
      expect(
        await deliver(manifestAt(S(step.k), step.o), { window: step.window })
      ).toEqual({ outcome: 'ready' });
      // the count the gateway made against the real rows
      expect([step.k, leftInWindow(S(step.k))]).toEqual([step.k, step.left]);
    }

    expect(
      (await cycles()).map((c) => [c.slot, c.state, c.retuning, c.data_status])
    ).toEqual(plan.map((step) => [S(step.k), 'READY', step.retuning, 'FRESH']));
    // the sender's own count is stored as sent and plays no part
    expect((await cycles()).map((c) => c.repush_rows_unsent)).toEqual([
      0, 0, 5600, 0, 600, 4000, 0, 0,
    ]);
    expect(
      ready
        .named('cycle-ready')
        .map((a) => (a.data as CycleReadyJobData).retuning)
    ).toEqual(plan.map((step) => step.retuning));

    const all = await events();
    expect(
      all.map((e) => [e.event_type, e.effective_slot, e.dedupe_key])
    ).toEqual([
      ['PROMOTE', S(2), `XAUUSD_PROMOTE_${S(2)}`],
      ['RETUNE_COMPLETE', S(5), `XAUUSD_RETUNE_COMPLETE_${S(5)}`],
    ]);

    // the JSON columns hold what the manifest said, and read back equal
    const promoted = manifestAt(S(2), { ...B, repush: 5600 });
    const before = manifestAt(S(1), { repush: 0 });
    const [promote, complete] = all;
    expect(promote.terminal_id).toBe('MT5-B');
    expect(promote.config_hashes).toStrictEqual({
      M5: promoted.timeframes.M5.config_hashes,
    });
    expect(promote.source_modes).toStrictEqual({
      M5: promoted.timeframes.M5.source_modes,
    });
    expect(promote.detail).toMatchObject({
      previous: {
        slot: S(1),
        terminal_id: 'MT5-A',
        config_hashes: { M5: before.timeframes.M5.config_hashes },
      },
      new: { slot: S(2), terminal_id: 'MT5-B' },
      changed: {
        terminal: { previous: 'MT5-A', current: 'MT5-B' },
        config_hashes: { M5: ['best_fit_a', 'non_b', 'sr_levels'] },
      },
    });
    // the end names the promote it measured against and what it counted
    expect(complete.detail).toStrictEqual({
      promote_slot: S(2),
      promote_m5_collection_cycle_id: 3,
      window_old_rows: 0,
      window_from: S(5) - 900000,
      window_to: S(5),
      verified_at_slot: S(5),
    });

    // the stamp the readers show: RETUNING until the verified manifest that finds the window clean
    expect(await reader.getReadyCycle(S(2))).toMatchObject({ retuning: true });
    expect(await reader.getReadyCycle(S(4))).toMatchObject({ retuning: true });
    expect(await reader.getReadyCycle(S(5))).toMatchObject({
      retuning: false,
    });
    expect(await reader.getNewestReadyCycle()).toMatchObject({
      slot: S(7),
      retuning: false,
    });
  });

  it('the window count means what the code needs: the open-time bounds, M5 only, this symbol only, cycle_id below the promote', async () => {
    const slot = S(2);
    const FROM = slot - 3000 * 300;
    const planted: Array<[string, 'M5' | 'M15', number, number]> = [
      // symbol, timeframe, open time, cycle_id
      ['XAUUSD', 'M5', FROM, 1], // first second of the window: counted
      ['XAUUSD', 'M5', FROM - 300, 1], // one bar below it
      ['XAUUSD', 'M5', FROM + 300, 1], // counted
      ['XAUUSD', 'M5', slot - 600, 1], // counted
      ['XAUUSD', 'M5', slot, 1], // the slot itself: counted
      ['XAUUSD', 'M5', slot + 300, 1], // after the slot
      ['XAUUSD', 'M15', slot - 900, 1], // another timeframe
      ['EURUSD', 'M5', slot - 1200, 1], // another symbol
      ['XAUUSD', 'M5', slot - 1500, 5], // at the promote cycle: not old
      ['XAUUSD', 'M5', slot - 1800, 6], // above it: not old
      ['XAUUSD', 'M5', slot - 2100, 4], // just below it: counted
      ['XAUUSD', 'M5', slot - 2400, 0], // counted
    ];
    await prisma.marketDataV6.createMany({
      data: planted.map(([symbol, timeframe, timestamp, cycleId]) =>
        barRow(symbol, timeframe, timestamp, cycleId, slot)
      ),
    });
    expect(
      await prisma.marketDataV6.count({
        where: preTuningBarsWhere('XAUUSD', slot, 5),
      })
    ).toBe(6);
  });

  it('measures against the latest PROMOTE at or before the slot, on the real events table', async () => {
    // two episodes: B promoted at S(1) and finished at S(2), then back to A at S(4)
    await baseline();
    await deliver(manifestAt(S(1), B), { window: 'all' });
    await deliver(manifestAt(S(2), B)); // finds the window clean: ends
    await deliver(manifestAt(S(3), B));
    await deliver(manifestAt(S(4))); // the second promote, cycle id 5
    await deliver(manifestAt(S(5)), { window: 'all' }); // ends it
    const all = await events();
    expect(all.map((e) => [e.event_type, e.effective_slot])).toEqual([
      ['PROMOTE', S(1)],
      ['RETUNE_COMPLETE', S(2)],
      ['PROMOTE', S(4)],
      ['RETUNE_COMPLETE', S(5)],
    ]);
    // the second end was measured against the SECOND promote (orderBy desc), not the first
    expect(all[3].detail).toMatchObject({
      promote_slot: S(4),
      promote_m5_collection_cycle_id: 5,
      window_old_rows: 0,
    });
    expect((await cycles()).map((c) => c.retuning)).toEqual([
      false,
      true,
      false,
      false,
      true,
      false,
    ]);
  });

  it('the unique dedupe_key: a repeat is written once with skipDuplicates and refused without it', async () => {
    await baseline();
    await deliver(manifestAt(S(1), { ...B, repush: 0 }));
    expect((await events()).map((e) => e.dedupe_key)).toEqual([
      `XAUUSD_PROMOTE_${S(1)}`,
    ]);

    const [existing] = await events();
    const copy = {
      symbol: existing.symbol,
      event_type: existing.event_type,
      effective_slot: existing.effective_slot,
      dedupe_key: existing.dedupe_key,
    };
    expect(
      await prisma.cycleEvent.createMany({ data: [copy], skipDuplicates: true })
    ).toEqual({ count: 0 });
    await expect(
      prisma.cycleEvent.create({ data: copy })
    ).rejects.toMatchObject({ code: 'P2002' });
    expect(await events()).toHaveLength(1);
  });

  it('looking again at a manifest that is still waiting, and the retry after it lands, write the PROMOTE once', async () => {
    await baseline();
    const promote = manifestAt(S(2), { ...B, repush: 700 });

    expect(await deliver(promote, { land: false })).toEqual({
      outcome: 'waiting',
    });
    // a PENDING row already carries the flag
    expect((await cycles()).map((c) => [c.slot, c.state, c.retuning])).toEqual([
      [S(0), 'READY', false],
      [S(2), 'PENDING', true],
    ]);
    expect(await deliver(promote, { land: false, checks: 1 })).toEqual({
      outcome: 'waiting',
    });
    expect(await deliver(promote, { checks: 2 })).toEqual({ outcome: 'ready' });
    expect((await events()).map((e) => e.event_type)).toEqual(['PROMOTE']);
    expect((await cycles()).map((c) => c.retuning)).toEqual([false, true]);
  });

  it('a PENDING predecessor that never resolved still makes its successor RETUNING, measured against its cycle id', async () => {
    await baseline();
    await deliver(manifestAt(S(2), { ...B, repush: 700 }), { land: false });
    await deliver(manifestAt(S(3), { ...B, repush: 300 }));
    expect((await cycles()).map((c) => [c.state, c.retuning])).toEqual([
      ['READY', false],
      ['PENDING', true],
      ['READY', true],
    ]);
    expect((await events()).map((e) => e.effective_slot)).toEqual([S(2)]);
    expect(leftInWindow(S(3))).toBeGreaterThan(0);
  });

  it('a manifest that arrives behind a newer one writes no second PROMOTE', async () => {
    await baseline();
    await deliver(manifestAt(S(3), { ...B, repush: 700 }));
    await deliver(manifestAt(S(2), { ...B, repush: 900 })); // late
    await deliver(manifestAt(S(1))); // late, old tuning
    expect((await events()).map((e) => e.effective_slot)).toEqual([S(3)]);
    expect((await cycles()).map((c) => [c.slot, c.retuning])).toEqual([
      [S(0), false],
      [S(1), false],
      [S(2), true],
      [S(3), true],
    ]);
  });

  it('a sender that does not report a count is stored as NULL and still ends a RETUNING: the gateway counts', async () => {
    await baseline();
    await deliver(manifestAt(S(1), B));
    await deliver(manifestAt(S(2), B), { window: 'all' });
    await deliver(manifestAt(S(3), B));
    const rows = await cycles();
    expect(rows.map((c) => c.repush_rows_unsent)).toEqual([
      null,
      null,
      null,
      null,
    ]);
    expect(rows.map((c) => c.retuning)).toEqual([false, true, false, false]);
    expect((await events()).map((e) => e.event_type)).toEqual([
      'PROMOTE',
      'RETUNE_COMPLETE',
    ]);
  });
});
