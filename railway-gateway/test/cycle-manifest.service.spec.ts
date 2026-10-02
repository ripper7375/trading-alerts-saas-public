import * as fs from 'fs';
import * as path from 'path';
import { Logger } from '@nestjs/common';
import type { Job, Queue } from 'bull';
import { PrismaService } from '../src/prisma/prisma.service';
import { CycleManifest } from '../src/cycle/cycle-manifest.contract';
import { digestClosedSpine } from '../src/cycle/closed-bars-digest';
import { MANIFEST_THRESHOLDS } from '../src/cycle/manifest-thresholds';
import { ONE_DAY_CLOSED_BARS } from '../src/cycle/windows';
import {
  CycleManifestJobData,
  CycleManifestService,
} from '../src/worker/cycle-manifest.service';
import {
  FakePrisma,
  BAR_SECONDS,
  FakeQueue,
  landBars,
  landStatistics,
} from './helpers/fake-cycle-store';

/**
 * CycleManifestService (ADR-009): persist the manifest, check it against what
 * landed, then write the cycle READY and announce it ONCE, wait and look again, or
 * give up and say why.
 *
 * The manifests are the real sender's (scripts/generate_cycle_manifest_fixtures.py).
 * The database is an in-memory stand-in (test/helpers/fake-cycle-store.ts), so
 * these tests are about the decisions and the idempotency, which is where the
 * risk is; the queries themselves were checked against a real Postgres once (see
 * the part 4 hand-off).
 *
 * Section 1.8 items this carries:
 *   - "One market_cycles row per slot": duplicates, retries and re-checks all
 *     end in one row and one ready job.
 *   - "Newest bars first under backlog" depends on this running behind the rows;
 *     the single-loop guarantee is pinned in market-data.processor.spec.ts.
 */

function fixture(name: string): CycleManifest {
  return JSON.parse(
    fs.readFileSync(path.join(__dirname, 'fixtures', name), 'utf8')
  );
}

const refresh = fixture('cycle-manifest-refresh-slot.json'); // slot 21:00, M5 needed 2 attempts
const plain = fixture('cycle-manifest-plain-slot.json'); // slot 20:55, M5 only, 1 attempt
const closed = fixture('cycle-manifest-closed-newest.json'); // M5 288 sent (1 quarantined), M15 96

const STEP = BAR_SECONDS;

function build() {
  const prisma = new FakePrisma();
  const sync = new FakeQueue();
  const ready = new FakeQueue();
  const service = new CycleManifestService(
    prisma as unknown as PrismaService,
    sync as unknown as Queue,
    ready as unknown as Queue
  );
  return { prisma, sync, ready, service };
}

function job(
  manifest: CycleManifest,
  receivedAt: number,
  checks?: number
): Job<CycleManifestJobData> {
  return {
    name: 'cycle-manifest',
    id: `cycle_manifest_${manifest.symbol}_${manifest.slot}`,
    data: { manifest, receivedAt, ...(checks ? { checks } : {}) },
  } as unknown as Job<CycleManifestJobData>;
}

/** The digest worked out from the table by hand: closed at the slot, newest 288 / 96, oldest first. */
function expectedDigest(prisma: FakePrisma, slot: number): string {
  const spine = { M5: [] as any[], M15: [] as any[] };
  for (const tf of ['M5', 'M15'] as const) {
    spine[tf] = prisma.bars
      .filter((b) => b.timeframe === tf && b.timestamp + STEP[tf] <= slot)
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, ONE_DAY_CLOSED_BARS[tf])
      .sort((a, b) => a.timestamp - b.timestamp);
  }
  return digestClosedSpine(spine);
}

beforeEach(() => {
  jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
  jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
});
afterEach(() => jest.restoreAllMocks());

const RECEIVED_AFTER = 62; // the sender's manifest reaches the gateway about a minute after the slot

describe('everything has landed', () => {
  it('writes the cycle READY with its status, timing and digest, and announces it once', async () => {
    const { prisma, sync, ready, service } = build();
    landBars(prisma, refresh);
    landStatistics(prisma, refresh);
    const receivedAt = refresh.slot + RECEIVED_AFTER;

    const result = await service.handle(
      job(refresh, receivedAt),
      receivedAt + 1
    );

    expect(result).toEqual({ outcome: 'ready' });
    const row = prisma.cycle('XAUUSD', refresh.slot)!;
    expect(row['state']).toBe('READY');
    expect(row['ready_at']).toBe(receivedAt + 1);
    expect(row['data_status']).toBe('FRESH'); // 63 s after the slot, inside the 4-minute retry deadline
    expect(row['attempts']).toBe(2);
    expect(row['closed_bars_digest']).toBe(
      expectedDigest(prisma, refresh.slot)
    );
    expect(row['check_detail']).toBeNull();
    expect(row['manifest_received_at']).toBe(receivedAt);

    expect(ready.adds).toHaveLength(1);
    expect(sync.adds).toHaveLength(0);
  });

  it('announces on the cycle-ready queue, keyed by the slot, with what step 3 needs', async () => {
    const { prisma, ready, service } = build();
    landBars(prisma, refresh);
    landStatistics(prisma, refresh);
    const receivedAt = refresh.slot + RECEIVED_AFTER;
    await service.handle(job(refresh, receivedAt), receivedAt + 1);

    const [add] = ready.adds;
    expect(add.name).toBe('cycle-ready');
    expect(add.opts.jobId).toBe(`XAUUSD_${refresh.slot}`);
    expect(add.data).toEqual({
      symbol: 'XAUUSD',
      slot: refresh.slot,
      readyAt: receivedAt + 1,
      attempts: 2,
      dataStatus: 'FRESH',
      closedBarsDigest: expectedDigest(prisma, refresh.slot),
      retuning: false,
    });
    // the same retry policy as every other lane
    expect(add.opts).toMatchObject({
      attempts: 3,
      removeOnComplete: 100,
      removeOnFail: 500,
    });
  });

  it('the digest covers one day of CLOSED bars: the forming bar and anything older than 288 / 96 are not in it', async () => {
    const m5 = refresh.timeframes.M5;
    const formingTs = refresh.slot; // the bar that opens at the slot is still forming
    const belowWindowTs = m5.oldest_bar_ts - 30 * 300;
    const insideWindowTs = refresh.slot - 10 * 300;

    // the digest the real service writes, for a table altered by `change`
    async function digestAfter(
      change?: (find: (ts: number) => { close: number }) => void
    ): Promise<string> {
      const { prisma, service } = build();
      landBars(prisma, refresh, { older: 60 }); // 60 extra bars below the window
      landStatistics(prisma, refresh);
      change?.(
        (ts) =>
          prisma.bars.find((b) => b.timeframe === 'M5' && b.timestamp === ts)!
      );
      const receivedAt = refresh.slot + RECEIVED_AFTER;
      await service.handle(job(refresh, receivedAt), receivedAt + 1);
      return prisma.cycle('XAUUSD', refresh.slot)![
        'closed_bars_digest'
      ] as string;
    }

    const base = await digestAfter();
    expect(base).toMatch(/^[0-9a-f]{64}$/);

    // the forming bar IS in the table (and was waited for), but not in the digest...
    expect(await digestAfter((find) => (find(formingTs).close += 5))).toBe(
      base
    );
    // ...nor is a bar below the 288-bar window...
    expect(await digestAfter((find) => (find(belowWindowTs).close += 5))).toBe(
      base
    );
    // ...while a closed bar inside the window is.
    expect(
      await digestAfter((find) => (find(insideWindowTs).close += 5))
    ).not.toBe(base);
  });

  it('an M5-only slot is checked and written without M15', async () => {
    const { prisma, ready, service } = build();
    landBars(prisma, plain);
    landStatistics(prisma, plain);
    const receivedAt = plain.slot + RECEIVED_AFTER;
    expect(
      await service.handle(job(plain, receivedAt), receivedAt + 1)
    ).toEqual({
      outcome: 'ready',
    });
    const row = prisma.cycle('XAUUSD', plain.slot)!;
    expect(row['m15_bar_count']).toBeNull();
    expect(row['m15_export_at']).toBeNull();
    expect(prisma.calls.barCount).toBe(1); // M5 only
    expect(prisma.calls.barFindUnique).toBe(1);
    expect(prisma.calls.statCount).toBe(1);
    expect(ready.adds).toHaveLength(1);
  });

  it('starts from the manifest: every column the mapping sets is on the row', async () => {
    const { prisma, service } = build();
    landBars(prisma, refresh);
    landStatistics(prisma, refresh);
    const receivedAt = refresh.slot + RECEIVED_AFTER;
    await service.handle(job(refresh, receivedAt), receivedAt + 1);
    const row = prisma.cycle('XAUUSD', refresh.slot)!;
    expect(row).toMatchObject({
      symbol: 'XAUUSD',
      slot: refresh.slot,
      terminal_id: refresh.mt5_terminal,
      backlog_rows: refresh.backlog_rows,
      m5_bar_count: 289,
      m15_bar_count: 97,
      m5_export_at: refresh.timeframes.M5.export_mtime,
      collector_started_at: refresh.timeframes.M5.started_at,
      repush_rows_unsent: refresh.repush_rows_unsent,
      retuning: false,
    });
    expect(Object.keys(row['config_hashes'] as object)).toEqual(['M5', 'M15']);
  });
});

describe('the data status of a ready cycle (ADR-012)', () => {
  async function readyAfter(manifest: CycleManifest, seconds: number) {
    const { prisma, ready, service } = build();
    landBars(prisma, manifest);
    landStatistics(prisma, manifest);
    // arrival at slot + 60; the cycle becomes ready `seconds` after the slot
    await service.handle(
      job(manifest, manifest.slot + 60),
      manifest.slot + seconds
    );
    return {
      status: prisma.cycle('XAUUSD', manifest.slot)!['data_status'],
      readyAt: prisma.cycle('XAUUSD', manifest.slot)!['ready_at'],
      announced: ready.adds[0]?.data.dataStatus,
    };
  }

  it('a first-try cycle: FRESH up to and including 2 minutes, DELAYED after', async () => {
    expect((await readyAfter(plain, 120)).status).toBe('FRESH');
    expect((await readyAfter(plain, 121)).status).toBe('DELAYED');
  });

  it('a retried cycle gets 4 minutes: FRESH up to and including 240 s, DELAYED after', async () => {
    expect(refresh.timeframes.M5.attempts).toBe(2);
    expect((await readyAfter(refresh, 121)).status).toBe('FRESH');
    expect((await readyAfter(refresh, 240)).status).toBe('FRESH');
    expect((await readyAfter(refresh, 241)).status).toBe('DELAYED');
  });

  it('the announcement carries the same status as the row', async () => {
    const r = await readyAfter(plain, 200);
    expect(r.status).toBe('DELAYED');
    expect(r.announced).toBe('DELAYED');
  });

  it('a gateway clock behind the slot is ready AT the slot, not before it', async () => {
    const r = await readyAfter(plain, -30);
    expect(r.readyAt).toBe(plain.slot);
    expect(r.status).toBe('FRESH');
  });
});

describe('the rows have not all landed yet', () => {
  it('waits: leaves the cycle PENDING and queues a delayed re-check behind the other jobs', async () => {
    const { prisma, sync, ready, service } = build();
    landBars(prisma, refresh, { skip: [refresh.slot - 600] });
    landStatistics(prisma, refresh);
    const receivedAt = refresh.slot + RECEIVED_AFTER;

    const result = await service.handle(
      job(refresh, receivedAt),
      receivedAt + 3
    );

    expect(result).toEqual({ outcome: 'waiting' });
    expect(prisma.cycle('XAUUSD', refresh.slot)!['state']).toBe('PENDING');
    expect(ready.adds).toHaveLength(0);
    expect(sync.adds).toHaveLength(1);
    const [recheck] = sync.adds;
    expect(recheck.name).toBe('cycle-manifest');
    expect(recheck.opts).toMatchObject({
      jobId: `cycle_manifest_XAUUSD_${refresh.slot}_check_1`,
      delay: MANIFEST_THRESHOLDS.recheckDelayMs,
      attempts: 3,
    });
    // the re-check carries the manifest and the ORIGINAL arrival time forward
    expect(recheck.data).toEqual({ manifest: refresh, receivedAt, checks: 1 });
  });

  it('looks again, and becomes READY once the missing row lands, announcing exactly once', async () => {
    const { prisma, sync, ready, service } = build();
    landBars(prisma, refresh, { skip: [refresh.slot - 600] });
    landStatistics(prisma, refresh);
    const receivedAt = refresh.slot + RECEIVED_AFTER;

    await service.handle(job(refresh, receivedAt), receivedAt + 1);
    expect(sync.adds).toHaveLength(1);

    // the retried row job finishes
    prisma.upsertBar({
      ...prisma.bars[0],
      timeframe: 'M5',
      timestamp: refresh.slot - 600,
    });
    const recheck = sync.adds[0].data as CycleManifestJobData;
    const result = await service.handle(
      job(recheck.manifest, recheck.receivedAt, recheck.checks),
      receivedAt + 7
    );

    expect(result).toEqual({ outcome: 'ready' });
    expect(prisma.cycle('XAUUSD', refresh.slot)!['state']).toBe('READY');
    expect(ready.adds).toHaveLength(1);
    expect(prisma.cycles.size).toBe(1);
  });

  it('counts the re-checks: each carries the next number and its own job id', async () => {
    const { prisma, sync, service } = build();
    landBars(prisma, refresh, { skip: [refresh.slot - 600] });
    landStatistics(prisma, refresh);
    const receivedAt = refresh.slot + RECEIVED_AFTER;
    let current = job(refresh, receivedAt);
    for (let n = 1; n <= 4; n += 1) {
      await service.handle(current, receivedAt + n * 5);
      const next = sync.adds[n - 1];
      expect(next.opts.jobId).toBe(
        `cycle_manifest_XAUUSD_${refresh.slot}_check_${n}`
      );
      current = job(
        refresh,
        receivedAt,
        (next.data as CycleManifestJobData).checks
      );
    }
    expect(
      sync.adds.map((a) => (a.data as CycleManifestJobData).checks)
    ).toEqual([1, 2, 3, 4]);
  });

  it('gives up at exactly the limit: INCOMPLETE, with what was expected against what landed', async () => {
    const { prisma, sync, ready, service } = build();
    landBars(prisma, refresh, {
      skip: [refresh.slot - 600, refresh.slot - 900],
    });
    landStatistics(prisma, refresh);
    const receivedAt = refresh.slot + RECEIVED_AFTER;
    const limit = MANIFEST_THRESHOLDS.landedGiveUpAfterSec;

    expect(
      (await service.handle(job(refresh, receivedAt), receivedAt + limit - 1))
        .outcome
    ).toBe('waiting');
    const result = await service.handle(
      job(refresh, receivedAt),
      receivedAt + limit
    );

    expect(result).toEqual({ outcome: 'incomplete' });
    const row = prisma.cycle('XAUUSD', refresh.slot)!;
    expect(row['state']).toBe('INCOMPLETE');
    expect(row['data_status']).toBeNull();
    expect(row['ready_at']).toBeNull();
    expect(row['check_detail']).toMatchObject({
      reason: 'LANDED_ROWS_MISSING',
      ageSec: limit,
      timeframes: {
        M5: { bars: { expected: 289, landed: 287 } },
        M15: { bars: { expected: 97, landed: 97 } },
      },
    });
    expect(ready.adds).toHaveLength(0);
    expect(sync.adds).toHaveLength(1); // only the re-check from the first call: none after giving up
  });

  it('an INCOMPLETE cycle is not revived by a late duplicate', async () => {
    const { prisma, ready, service } = build();
    const receivedAt = refresh.slot + RECEIVED_AFTER;
    await service.handle(job(refresh, receivedAt), receivedAt + 500); // nothing landed: incomplete
    landBars(prisma, refresh);
    landStatistics(prisma, refresh);
    const again = await service.handle(
      job(refresh, receivedAt),
      receivedAt + 600
    );
    expect(again).toEqual({ outcome: 'already-incomplete' });
    expect(prisma.cycle('XAUUSD', refresh.slot)!['state']).toBe('INCOMPLETE');
    expect(ready.adds).toHaveLength(0);
  });
});

describe('quarantined rows', () => {
  it('are not waited for: the gateway rejected them, so they will never be there', async () => {
    const { prisma, ready, service } = build();
    landBars(prisma, closed, {
      skip: [closed.timeframes.M5.newest_bar_ts - 300],
    }); // 287 + 96 land
    landStatistics(prisma, closed);
    const receivedAt = closed.slot + RECEIVED_AFTER;
    expect(
      (await service.handle(job(closed, receivedAt), receivedAt + 1)).outcome
    ).toBe('ready');
    expect(ready.adds).toHaveLength(1);
  });

  it('but a second missing row is still noticed', async () => {
    const { prisma, service } = build();
    const m5 = closed.timeframes.M5;
    landBars(prisma, closed, {
      skip: [m5.newest_bar_ts - 300, m5.newest_bar_ts - 600],
    }); // 286
    landStatistics(prisma, closed);
    const receivedAt = closed.slot + RECEIVED_AFTER;
    expect(
      (await service.handle(job(closed, receivedAt), receivedAt + 1)).outcome
    ).toBe('waiting');
  });
});

describe("the newest row is an older cycle's copy (decision 1 of part 4)", () => {
  // Windows overlap, so counting rows cannot tell this cycle's newest row from the
  // copy an earlier cycle left. Every promoted row carries its collection cycle.
  const newestRow = (
    prisma: FakePrisma,
    timeframe: 'M5' | 'M15',
    manifest: CycleManifest
  ) =>
    prisma.bars.find(
      (b) =>
        b.timeframe === timeframe &&
        b.timestamp === manifest.timeframes[timeframe]!.newest_bar_ts
    )!;
  const m5Id = refresh.timeframes.M5.collection_cycle_id;

  it('waits although every row is counted, and becomes READY once this cycle’s version lands', async () => {
    const { prisma, sync, ready, service } = build();
    landBars(prisma, refresh);
    landStatistics(prisma, refresh);
    newestRow(prisma, 'M5', refresh).cycle_id = m5Id - 1; // the previous cycle's copy
    const receivedAt = refresh.slot + RECEIVED_AFTER;

    expect(
      await service.handle(job(refresh, receivedAt), receivedAt + 3)
    ).toEqual({ outcome: 'waiting' });
    expect(prisma.cycle('XAUUSD', refresh.slot)!['state']).toBe('PENDING');
    expect(ready.adds).toHaveLength(0);
    expect(sync.adds).toHaveLength(1);

    newestRow(prisma, 'M5', refresh).cycle_id = m5Id; // the retried row job lands
    const recheck = sync.adds[0].data as CycleManifestJobData;
    expect(
      await service.handle(
        job(recheck.manifest, recheck.receivedAt, recheck.checks),
        receivedAt + 8
      )
    ).toEqual({ outcome: 'ready' });
    expect(ready.adds).toHaveLength(1);
  });

  it('gives up INCOMPLETE at the limit, naming the newest row and both cycle ids', async () => {
    const { prisma, ready, service } = build();
    landBars(prisma, refresh);
    landStatistics(prisma, refresh);
    newestRow(prisma, 'M5', refresh).cycle_id = m5Id - 1;
    const receivedAt = refresh.slot + RECEIVED_AFTER;
    const limit = MANIFEST_THRESHOLDS.landedGiveUpAfterSec;

    expect(
      (await service.handle(job(refresh, receivedAt), receivedAt + limit - 1))
        .outcome
    ).toBe('waiting');
    expect(
      await service.handle(job(refresh, receivedAt), receivedAt + limit)
    ).toEqual({ outcome: 'incomplete' });

    const row = prisma.cycle('XAUUSD', refresh.slot)!;
    expect(row['state']).toBe('INCOMPLETE');
    expect(row['check_detail']).toMatchObject({
      reason: 'NEWEST_ROW_NOT_CURRENT',
      timeframes: {
        M5: {
          bars: { expected: 289, landed: 289 }, // every row was there
          newest: { minCycleId: m5Id, cycleId: m5Id - 1 },
        },
      },
    });
    expect(ready.adds).toHaveLength(0);
  });

  it('accepts a later cycle’s version of the row (a re-push after a retune)', async () => {
    const { prisma, ready, service } = build();
    landBars(prisma, refresh);
    landStatistics(prisma, refresh);
    newestRow(prisma, 'M5', refresh).cycle_id = m5Id + 40;
    const receivedAt = refresh.slot + RECEIVED_AFTER;
    expect(
      (await service.handle(job(refresh, receivedAt), receivedAt + 1)).outcome
    ).toBe('ready');
    expect(ready.adds).toHaveLength(1);
  });

  it('reads the newest row of EACH timeframe the manifest carries', async () => {
    const { prisma, service } = build();
    landBars(prisma, refresh);
    landStatistics(prisma, refresh);
    newestRow(prisma, 'M15', refresh).cycle_id =
      refresh.timeframes.M15!.collection_cycle_id - 1;
    const receivedAt = refresh.slot + RECEIVED_AFTER;
    expect(
      (await service.handle(job(refresh, receivedAt), receivedAt + 1)).outcome
    ).toBe('waiting');
    expect(prisma.calls.barFindUnique).toBe(2); // M5 and M15
  });

  it('a newest row the gateway rejected leaves no READY cycle: it is not there to be current', async () => {
    const { prisma, ready, service } = build();
    const m5 = closed.timeframes.M5;
    landBars(prisma, closed, { skip: [m5.newest_bar_ts] }); // 287 + 96 land: the count is satisfied
    landStatistics(prisma, closed);
    const receivedAt = closed.slot + RECEIVED_AFTER;
    expect(
      (await service.handle(job(closed, receivedAt), receivedAt + 1)).outcome
    ).toBe('waiting');
    expect(
      (
        await service.handle(
          job(closed, receivedAt),
          receivedAt + MANIFEST_THRESHOLDS.landedGiveUpAfterSec
        )
      ).outcome
    ).toBe('incomplete');
    expect(prisma.cycle('XAUUSD', closed.slot)!['check_detail']).toMatchObject({
      reason: 'NEWEST_ROW_NOT_CURRENT',
      timeframes: { M5: { newest: { cycleId: null } } },
    });
    expect(ready.adds).toHaveLength(0);
  });
});

describe('statistics travel on their own queue', () => {
  it('waits a short grace for them, then goes ahead WITHOUT them and says so', async () => {
    const { prisma, sync, ready, service } = build();
    landBars(prisma, plain); // no statistics landed
    const receivedAt = plain.slot + RECEIVED_AFTER;
    const grace = MANIFEST_THRESHOLDS.statisticsGraceSec;

    expect(
      (await service.handle(job(plain, receivedAt), receivedAt + grace - 1))
        .outcome
    ).toBe('waiting');
    expect(prisma.cycle('XAUUSD', plain.slot)!['state']).toBe('PENDING');

    expect(
      (await service.handle(job(plain, receivedAt), receivedAt + grace)).outcome
    ).toBe('ready');
    const row = prisma.cycle('XAUUSD', plain.slot)!;
    expect(row['state']).toBe('READY');
    expect(row['check_detail']).toMatchObject({
      reason: 'STATISTICS_SHORTFALL',
      timeframes: { M5: { statistics: { expected: 3, landed: 0 } } },
    });
    expect(ready.adds).toHaveLength(1);
    expect(sync.adds).toHaveLength(1); // the one re-check before the grace ran out
  });

  it('is ready at once when they have landed (no grace is spent)', async () => {
    const { prisma, sync, service } = build();
    landBars(prisma, plain);
    landStatistics(prisma, plain);
    const receivedAt = plain.slot + RECEIVED_AFTER;
    expect(
      (await service.handle(job(plain, receivedAt), receivedAt + 1)).outcome
    ).toBe('ready');
    expect(sync.adds).toHaveLength(0);
  });
});

describe('a stale manifest', () => {
  it('is INCOMPLETE and never touches the data tables or announces anything', async () => {
    const { prisma, sync, ready, service } = build();
    landBars(prisma, refresh);
    landStatistics(prisma, refresh);
    const receivedAt =
      refresh.slot + MANIFEST_THRESHOLDS.staleManifestAfterSec + 10;
    const result = await service.handle(job(refresh, receivedAt), receivedAt);
    expect(result).toEqual({ outcome: 'incomplete' });
    expect(prisma.cycle('XAUUSD', refresh.slot)!['check_detail']).toMatchObject(
      {
        reason: 'STALE_MANIFEST',
      }
    );
    expect(prisma.calls.barCount).toBe(0);
    expect(prisma.calls.barFindUnique).toBe(0);
    expect(prisma.calls.statCount).toBe(0);
    expect(ready.adds).toHaveLength(0);
    expect(sync.adds).toHaveLength(0);
  });
});

describe('one row per slot, one announcement per slot (section 1.8)', () => {
  it('the same manifest delivered twice, after the first is READY: nothing changes', async () => {
    const { prisma, ready, service } = build();
    landBars(prisma, refresh);
    landStatistics(prisma, refresh);
    const receivedAt = refresh.slot + RECEIVED_AFTER;
    await service.handle(job(refresh, receivedAt), receivedAt + 1);
    const before = { ...prisma.cycle('XAUUSD', refresh.slot)! };

    const again = await service.handle(
      job(refresh, receivedAt + 40),
      receivedAt + 90
    );

    expect(again).toEqual({ outcome: 'already-ready' });
    expect(prisma.cycles.size).toBe(1);
    expect(prisma.cycle('XAUUSD', refresh.slot)).toEqual(before); // ready_at and digest untouched
    expect(ready.adds).toHaveLength(1);
  });

  it('even when Bull has forgotten the first announcement (its job id was removed)', async () => {
    const { prisma, ready, service } = build();
    ready.dedupe = false; // a queue that no longer knows the id: only the database state can stop a repeat
    landBars(prisma, refresh);
    landStatistics(prisma, refresh);
    const receivedAt = refresh.slot + RECEIVED_AFTER;
    await service.handle(job(refresh, receivedAt), receivedAt + 1);
    await service.handle(job(refresh, receivedAt), receivedAt + 2);
    await service.handle(job(refresh, receivedAt), receivedAt + 3);
    expect(ready.adds).toHaveLength(1);
  });

  it('the first manifest for a slot wins: a different payload for the same slot overwrites nothing', async () => {
    const { prisma, service } = build();
    landBars(prisma, refresh);
    landStatistics(prisma, refresh);
    const receivedAt = refresh.slot + RECEIVED_AFTER;
    await service.handle(job(refresh, receivedAt), receivedAt + 1);
    const different: CycleManifest = {
      ...refresh,
      backlog_rows: 1,
      mt5_terminal: 'MT5-B',
    };
    await service.handle(job(different, receivedAt + 5), receivedAt + 9);
    const row = prisma.cycle('XAUUSD', refresh.slot)!;
    expect(row['terminal_id']).toBe(refresh.mt5_terminal);
    expect(row['backlog_rows']).toBe(refresh.backlog_rows);
  });

  it('inserts the PENDING row with skipDuplicates, never a plain insert', async () => {
    const { prisma, service } = build();
    landBars(prisma, plain);
    landStatistics(prisma, plain);
    const receivedAt = plain.slot + RECEIVED_AFTER;
    await service.handle(job(plain, receivedAt), receivedAt + 1);
    await service.handle(job(plain, receivedAt), receivedAt + 1); // would throw a unique violation otherwise
    expect(prisma.calls.createMany).toBe(2);
    expect(prisma.cycles.size).toBe(1);
  });

  it('different slots are independent cycles with their own announcements', async () => {
    const { prisma, ready, service } = build();
    for (const m of [plain, refresh]) {
      landBars(prisma, m);
      landStatistics(prisma, m);
    }
    await service.handle(job(plain, plain.slot + 60), plain.slot + 61);
    await service.handle(job(refresh, refresh.slot + 60), refresh.slot + 61);
    expect(prisma.cycles.size).toBe(2);
    expect(ready.adds.map((a) => a.opts.jobId)).toEqual([
      `XAUUSD_${plain.slot}`,
      `XAUUSD_${refresh.slot}`,
    ]);
  });
});

describe('failures are retried, and a retry finishes the job', () => {
  it('a Redis that fails on the announcement leaves the cycle PENDING, and the retry announces it once', async () => {
    const { prisma, ready, service } = build();
    landBars(prisma, refresh);
    landStatistics(prisma, refresh);
    const receivedAt = refresh.slot + RECEIVED_AFTER;
    ready.failNext = new Error('redis down');

    await expect(
      service.handle(job(refresh, receivedAt), receivedAt + 1)
    ).rejects.toThrow('redis down');
    expect(prisma.cycle('XAUUSD', refresh.slot)!['state']).toBe('PENDING'); // never READY without an announcement
    expect(ready.adds).toHaveLength(0);

    await service.handle(job(refresh, receivedAt), receivedAt + 3); // Bull's retry
    expect(prisma.cycle('XAUUSD', refresh.slot)!['state']).toBe('READY');
    expect(ready.adds).toHaveLength(1);
  });

  it('a database that fails on the READY write is retried: the announcement repeats under the same id', async () => {
    const { prisma, ready, service } = build();
    landBars(prisma, refresh);
    landStatistics(prisma, refresh);
    const receivedAt = refresh.slot + RECEIVED_AFTER;
    prisma.failNext.updateMany = new Error('connection lost');

    await expect(
      service.handle(job(refresh, receivedAt), receivedAt + 1)
    ).rejects.toThrow('connection lost');
    expect(prisma.cycle('XAUUSD', refresh.slot)!['state']).toBe('PENDING');
    expect(ready.adds).toHaveLength(1); // announced, not yet marked ready

    await service.handle(job(refresh, receivedAt), receivedAt + 3);
    expect(prisma.cycle('XAUUSD', refresh.slot)!['state']).toBe('READY');
    expect(ready.adds).toHaveLength(1); // the retry's announcement was ignored: same job id
    expect(ready.adds[0].opts.jobId).toBe(`XAUUSD_${refresh.slot}`);
  });

  it('a failed insert fails the job loudly instead of carrying on', async () => {
    const { prisma, service } = build();
    prisma.failNext.createMany = new Error(
      'relation "market_cycles" does not exist'
    );
    await expect(
      service.handle(job(plain, plain.slot + 60), plain.slot + 61)
    ).rejects.toThrow('does not exist');
  });

  it('losing the PENDING -> READY race to another call is not an error', async () => {
    const { prisma, ready, service } = build();
    landBars(prisma, plain);
    landStatistics(prisma, plain);
    prisma.updateManyReports = 0;
    const result = await service.handle(
      job(plain, plain.slot + 60),
      plain.slot + 61
    );
    expect(result).toEqual({ outcome: 'ready' });
    expect(ready.adds).toHaveLength(1);
  });

  it('only ever updates a row that is still PENDING (a conditional update, never a blind one)', async () => {
    const { prisma, service } = build();
    landBars(prisma, plain);
    landStatistics(prisma, plain);
    const spy = jest.spyOn(prisma.marketCycle, 'updateMany');
    await service.handle(job(plain, plain.slot + 60), plain.slot + 61);
    expect(spy).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { symbol: 'XAUUSD', slot: plain.slot, state: 'PENDING' },
      })
    );
  });
});
