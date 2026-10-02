import * as fs from 'fs';
import * as path from 'path';
import { Global, Logger, Module } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { Job, Queue } from 'bull';
import { PrismaService } from '../src/prisma/prisma.service';
import { CycleManifest } from '../src/cycle/cycle-manifest.contract';
import { MANIFEST_THRESHOLDS } from '../src/cycle/manifest-thresholds';
import { CycleReadModule } from '../src/cycle/read/cycle-read.module';
import { CycleReaderService } from '../src/cycle/read/cycle-reader.service';
import { READER_SYMBOL, STATISTIC_SOURCES } from '../src/cycle/read/read-types';
import {
  CycleManifestJobData,
  CycleManifestService,
} from '../src/worker/cycle-manifest.service';
import {
  FakePrisma,
  FakeQueue,
  landBars,
  landStatistics,
} from './helpers/fake-cycle-store';

/**
 * The read side wired the way it will run, and through the cycle the gateway
 * really writes: CycleManifestService declares a cycle READY (or does not), and the
 * readers say what a sensor or the prompt assembler would see.
 */

beforeEach(() => {
  jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
  jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
});
afterEach(() => jest.restoreAllMocks());

const refresh: CycleManifest = JSON.parse(
  fs.readFileSync(
    path.join(__dirname, 'fixtures', 'cycle-manifest-refresh-slot.json'),
    'utf8'
  )
);
const SLOT = refresh.slot;
const ARRIVAL = SLOT + 62;

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

function world() {
  const prisma = new FakePrisma();
  const sync = new FakeQueue();
  const ready = new FakeQueue();
  const writer = new CycleManifestService(
    prisma as unknown as PrismaService,
    sync as unknown as Queue,
    ready as unknown as Queue
  );
  const reader = new CycleReaderService(prisma as unknown as PrismaService);
  return { prisma, sync, ready, writer, reader };
}

describe('wiring', () => {
  it('CycleReadModule provides the reader through Nest, over the global PrismaService', async () => {
    const prisma = new FakePrisma();
    @Global()
    @Module({
      providers: [{ provide: PrismaService, useValue: prisma }],
      exports: [PrismaService],
    })
    class FakePrismaModule {}

    const moduleRef = await Test.createTestingModule({
      imports: [FakePrismaModule, CycleReadModule],
    }).compile();
    const reader = moduleRef.get(CycleReaderService);
    expect(reader).toBeInstanceOf(CycleReaderService);
    expect(await reader.getNewestReadyCycle()).toBeNull(); // an empty database: nothing is current
    await moduleRef.close();
  });

  it('the readers read one symbol, the one the gateway accepts', () => {
    const dto = fs.readFileSync(
      path.join(__dirname, '../src/gateway/dto/indicator-statistic.dto.ts'),
      'utf8'
    );
    expect(dto).toContain(`@IsIn(['${READER_SYMBOL}'])`);
  });

  it('the statistics sources are exactly the ones the gateway accepts (a typo would read as "no row" forever)', () => {
    const dto = fs.readFileSync(
      path.join(__dirname, '../src/gateway/dto/indicator-statistic.dto.ts'),
      'utf8'
    );
    const list = [...dto.matchAll(/@IsIn\(\[([^\]]*)\]\)/g)]
      .map((m) => [...m[1].matchAll(/'([^']+)'/g)].map((s) => s[1]))
      .find((names) => names.includes('best_fit_a'));
    expect(list).toBeDefined();
    expect([...STATISTIC_SOURCES]).toEqual(list);
  });
});

describe('a cycle the gateway declared READY, read back', () => {
  async function readyCycle() {
    const w = world();
    landBars(w.prisma, refresh);
    landStatistics(w.prisma, refresh);
    expect(await w.writer.handle(job(refresh, ARRIVAL), ARRIVAL + 1)).toEqual({
      outcome: 'ready',
    });
    return w;
  }

  it('is the newest READY cycle, with the status the gateway gave it', async () => {
    const { reader } = await readyCycle();
    expect(await reader.getNewestReadyCycle()).toMatchObject({
      slot: SLOT,
      dataStatus: 'FRESH',
      attempts: 2,
      readyAt: ARRIVAL + 1,
      retuning: false,
      m5ExportAt: refresh.timeframes.M5.export_mtime,
      m5CollectionCycleId: refresh.timeframes.M5.collection_cycle_id,
    });
  });

  it('its one day of closed bars still hashes to the digest the gateway stored (replay matches)', async () => {
    const { reader, prisma } = await readyCycle();
    const result = await reader.getOneDayOhlc(SLOT);
    if (result.status !== 'OK')
      throw new Error(`expected OK, got ${result.status}`);
    expect(result.bars.M5).toHaveLength(288);
    expect(result.bars.M15).toHaveLength(96);
    expect(result.replay.matches).toBe(true);
    expect(result.replay.digest).toBe(
      prisma.cycle('XAUUSD', SLOT)!['closed_bars_digest']
    );
  });

  it('the forming bar is the labelled last price: this cycle’s row, the export time as the label', async () => {
    const { reader, prisma } = await readyCycle();
    const result = await reader.getOneDayOhlc(SLOT);
    if (result.status !== 'OK') throw new Error('expected OK');
    const stub = prisma.bars.find(
      (b) => b.timeframe === 'M5' && b.timestamp === SLOT
    )!;
    expect(result.lastPrice).toEqual({
      status: 'OK',
      price: stub.close,
      barOpenTime: SLOT,
      asOf: refresh.timeframes.M5.export_mtime,
    });
    expect(result.bars.M5.some((b) => b.timestamp === SLOT)).toBe(false);
  });

  it('M5 and M15 closed bars come from the READY cycle the same way as the one-day window', async () => {
    const { reader } = await readyCycle();
    const m5 = await reader.getClosedBars('M5', SLOT, 288);
    const m15 = await reader.getClosedBars('M15', SLOT, 96);
    const day = await reader.getOneDayOhlc(SLOT);
    if (m5.status !== 'OK' || m15.status !== 'OK' || day.status !== 'OK') {
      throw new Error('expected OK');
    }
    expect(m5.bars).toEqual(day.bars.M5);
    expect(m15.bars).toEqual(day.bars.M15);
  });

  it('statistics: the source that landed at the slot is returned, one that did not is STALE (never an older one)', async () => {
    const { reader, prisma } = await readyCycle();
    const got = await reader.getStatisticsAtSlot('best_fit_a', 'M5', SLOT);
    expect(got).toMatchObject({ status: 'OK', collectedSlot: SLOT });
    // an older row of a source that is missing now must not stand in
    prisma.stats.push({
      symbol: 'XAUUSD',
      timeframe: 'M5',
      source: 'non_b',
      captured_at: SLOT - 300,
    });
    expect(await reader.getStatisticsAtSlot('non_b', 'M5', SLOT)).toMatchObject(
      {
        status: 'STALE',
        reason: 'NO_STATISTICS_AT_SLOT',
      }
    );
  });

  it('after later cycles upsert, the slot replays the same bars and a later READY cycle is the newest', async () => {
    const { reader, prisma } = await readyCycle();
    const first = await reader.getOneDayOhlc(SLOT);

    // the next cycle: its newer bars, and the stub rewritten with its final values
    const next = SLOT + 300;
    for (let i = 0; i < 12; i += 1) {
      prisma.upsertBar({
        symbol: 'XAUUSD',
        timeframe: 'M5',
        timestamp: next + i * 300,
        open: 2700,
        high: 2701,
        low: 2699,
        close: 2700.5,
        volume: 50,
        cycle_id: refresh.timeframes.M5.collection_cycle_id + 1,
      });
    }
    prisma.cycles.set(`XAUUSD_${next}`, {
      ...prisma.cycle('XAUUSD', SLOT)!,
      slot: next,
      ready_at: next + 70,
    });

    const replay = await reader.getOneDayOhlc(SLOT);
    if (first.status !== 'OK' || replay.status !== 'OK')
      throw new Error('expected OK');
    expect(replay.bars).toEqual(first.bars);
    expect(replay.replay.matches).toBe(true);
    expect((await reader.getNewestReadyCycle())!.slot).toBe(next);
  });
});

describe('a cycle the gateway did NOT declare READY is not readable, whatever is in the tables', () => {
  it('rows missing: INCOMPLETE, so every reader says STALE although most of the bars and statistics landed', async () => {
    const { prisma, writer, reader } = world();
    landBars(prisma, refresh, { skip: [SLOT - 600, SLOT - 900] });
    landStatistics(prisma, refresh);
    const limit = MANIFEST_THRESHOLDS.landedGiveUpAfterSec;
    expect(await writer.handle(job(refresh, ARRIVAL), ARRIVAL + limit)).toEqual(
      {
        outcome: 'incomplete',
      }
    );

    expect(await reader.getNewestReadyCycle()).toBeNull();
    expect(await reader.getOneDayOhlc(SLOT)).toMatchObject({
      status: 'STALE',
      reason: 'CYCLE_NOT_READY',
    });
    expect(await reader.getClosedBars('M5', SLOT, 100)).toMatchObject({
      status: 'STALE',
      reason: 'CYCLE_NOT_READY',
    });
    expect(
      await reader.getStatisticsAtSlot('best_fit_a', 'M5', SLOT)
    ).toMatchObject({ status: 'STALE', reason: 'CYCLE_NOT_READY' });
  });

  it('this cycle’s newest row has not landed yet: PENDING, not readable; READY and readable once it does', async () => {
    const { prisma, sync, writer, reader } = world();
    landBars(prisma, refresh);
    landStatistics(prisma, refresh);
    const newest = prisma.bars.find(
      (b) => b.timeframe === 'M5' && b.timestamp === SLOT
    )!;
    newest.cycle_id = refresh.timeframes.M5.collection_cycle_id - 1; // the last cycle's copy

    expect(await writer.handle(job(refresh, ARRIVAL), ARRIVAL + 2)).toEqual({
      outcome: 'waiting',
    });
    expect(await reader.getOneDayOhlc(SLOT)).toMatchObject({
      status: 'STALE',
      reason: 'CYCLE_NOT_READY',
    });

    newest.cycle_id = refresh.timeframes.M5.collection_cycle_id; // the retried row lands
    const recheck = sync.adds[0].data as CycleManifestJobData;
    expect(
      await writer.handle(
        job(recheck.manifest, recheck.receivedAt, recheck.checks),
        ARRIVAL + 8
      )
    ).toEqual({ outcome: 'ready' });
    expect((await reader.getOneDayOhlc(SLOT)).status).toBe('OK');
  });

  it('statistics short at READY time: the cycle is readable, the missing source is STALE with the shortfall, the others are fine', async () => {
    const { prisma, writer, reader } = world();
    landBars(prisma, refresh);
    landStatistics(prisma, refresh);
    // best_fit_b and cherry_a never land for M5; best_fit_a did
    prisma.stats = prisma.stats.filter(
      (s) => !(s.timeframe === 'M5' && s.source !== 'best_fit_a')
    );
    const grace = MANIFEST_THRESHOLDS.statisticsGraceSec;
    expect(await writer.handle(job(refresh, ARRIVAL), ARRIVAL + grace)).toEqual(
      {
        outcome: 'ready',
      }
    );

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
    // the M15 statistics all landed: a miss there is just a missing row
    expect(
      await reader.getStatisticsAtSlot('non_b', 'M15', SLOT)
    ).toMatchObject({
      status: 'STALE',
      reason: 'NO_STATISTICS_AT_SLOT',
    });
    // and the bars of a cycle with a statistics shortfall are still readable
    expect((await reader.getOneDayOhlc(SLOT)).status).toBe('OK');
  });
});
