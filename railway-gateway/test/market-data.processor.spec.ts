import * as fs from 'fs';
import * as path from 'path';
import { Logger } from '@nestjs/common';
import type { Job } from 'bull';
import { BULL_MODULE_QUEUE_PROCESS } from '@nestjs/bull/dist/bull.constants';
import { MarketDataProcessor } from '../src/worker/market-data.processor';
import { CycleManifestService } from '../src/worker/cycle-manifest.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { SNAPSHOT_COLUMNS } from '../src/worker/point-in-time-snapshot';

/**
 * The single processing loop of market-data-sync (ADR-009).
 *
 * The cycle manifest rides the same queue as the price rows because the queue
 * runs ONE job at a time in arrival order, so a manifest is checked only after
 * the rows queued before it have been written. That ordering is the property the
 * manifest check stands on, and it rests on three facts that are easy to break
 * without any test of the manifest itself noticing:
 *
 *   1. exactly one handler is registered on the queue, with concurrency 1;
 *   2. Bull sums concurrency across named handlers (so a second named handler
 *      for the manifest would mean two loops);
 *   3. Bull falls back to the '*' handler for any job name without its own.
 *
 * (2) and (3) are facts about node_modules/bull, so they are pinned against its
 * source: a Bull upgrade that changes them fails here, with the reason.
 */

const NOW = Math.floor(Date.now() / 1000);

function rowJob(overrides: Record<string, unknown> = {}): Job {
  const data: Record<string, unknown> = {
    terminal_id: 'push_worker_v5',
    symbol: 'XAUUSD',
    timeframe: 'M5',
    timestamp: NOW - 3600, // a bar that closed long ago
    open: 2650,
    high: 2651,
    low: 2649,
    close: 2650.5,
    volume: 100,
    cycle_id: 1,
    collected_at: NOW,
    ...overrides,
  };
  SNAPSHOT_COLUMNS.forEach((column, i) => {
    data[column] = i + 1;
  });
  return { name: 'process', id: 'row-1', data } as unknown as Job;
}

function manifestJob(): Job {
  return {
    name: 'cycle-manifest',
    id: 'cycle_manifest_XAUUSD_1789765200',
    data: { manifest: { symbol: 'XAUUSD', slot: 1789765200 }, receivedAt: 1 },
  } as unknown as Job;
}

function build() {
  const prisma = {
    marketDataV6: { upsert: jest.fn().mockResolvedValue({}) },
    marketDataPointInTime: { createMany: jest.fn().mockResolvedValue({}) },
  };
  const cycleManifests = {
    handle: jest.fn().mockResolvedValue({ outcome: 'ready' }),
  };
  const processor = new MarketDataProcessor(
    prisma as unknown as PrismaService,
    cycleManifests as unknown as CycleManifestService
  );
  return { prisma, cycleManifests, processor };
}

beforeEach(() => {
  jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
});
afterEach(() => jest.restoreAllMocks());

describe('dispatch by job name', () => {
  it('a price row is upserted on its natural key, exactly as before the manifest existed', async () => {
    const { prisma, cycleManifests, processor } = build();
    const job = rowJob();

    const result = await processor.process(job);

    expect(result).toEqual({ success: true });
    expect(prisma.marketDataV6.upsert).toHaveBeenCalledTimes(1);
    expect(prisma.marketDataV6.upsert).toHaveBeenCalledWith({
      where: {
        symbol_timeframe_timestamp: {
          symbol: 'XAUUSD',
          timeframe: 'M5',
          timestamp: job.data.timestamp,
        },
      },
      create: job.data,
      update: job.data,
    });
    expect(cycleManifests.handle).not.toHaveBeenCalled();
  });

  it('a row that closed also freezes its point-in-time snapshot', async () => {
    const { prisma, processor } = build();
    await processor.process(rowJob());
    expect(prisma.marketDataPointInTime.createMany).toHaveBeenCalledTimes(1);
    expect(prisma.marketDataPointInTime.createMany).toHaveBeenCalledWith(
      expect.objectContaining({ skipDuplicates: true })
    );
  });

  it('the forming bar is upserted but never frozen', async () => {
    const { prisma, processor } = build();
    await processor.process(rowJob({ timestamp: NOW - 30 }));
    expect(prisma.marketDataV6.upsert).toHaveBeenCalledTimes(1);
    expect(prisma.marketDataPointInTime.createMany).not.toHaveBeenCalled();
  });

  it('a failing snapshot write still cannot fail the row', async () => {
    const { prisma, processor } = build();
    prisma.marketDataPointInTime.createMany.mockRejectedValueOnce(
      new Error('relation does not exist')
    );
    await expect(processor.process(rowJob())).resolves.toEqual({
      success: true,
    });
  });

  it('a failing upsert still fails the job, so Bull retries it', async () => {
    const { prisma, processor } = build();
    prisma.marketDataV6.upsert.mockRejectedValueOnce(new Error('db down'));
    await expect(processor.process(rowJob())).rejects.toThrow('db down');
  });

  it('a manifest goes to the manifest service with the job, and touches no row table', async () => {
    const { prisma, cycleManifests, processor } = build();
    const job = manifestJob();

    const result = await processor.process(job);

    expect(result).toEqual({ outcome: 'ready' });
    expect(cycleManifests.handle).toHaveBeenCalledTimes(1);
    expect(cycleManifests.handle).toHaveBeenCalledWith(job);
    expect(prisma.marketDataV6.upsert).not.toHaveBeenCalled();
    expect(prisma.marketDataPointInTime.createMany).not.toHaveBeenCalled();
  });

  it('a manifest failure fails the job, so Bull retries it', async () => {
    const { cycleManifests, processor } = build();
    cycleManifests.handle.mockRejectedValueOnce(new Error('redis down'));
    await expect(processor.process(manifestJob())).rejects.toThrow(
      'redis down'
    );
  });

  it('a job name it does not know is refused loudly, never treated as a row', async () => {
    const { prisma, cycleManifests, processor } = build();
    const job = { ...rowJob(), name: 'proces' } as unknown as Job; // a typo, as in the 2026-07-05 audit
    await expect(processor.process(job)).rejects.toThrow(
      'Unknown job type "proces" on market-data-sync'
    );
    expect(prisma.marketDataV6.upsert).not.toHaveBeenCalled();
    expect(cycleManifests.handle).not.toHaveBeenCalled();
  });
});

describe('one loop, in arrival order', () => {
  /** Every @Process registration on the class, read the way @nestjs/bull reads them. */
  function registrations(): Array<{
    method: string;
    options: { name?: string; concurrency?: number };
  }> {
    const proto = MarketDataProcessor.prototype as unknown as Record<
      string,
      unknown
    >;
    return Object.getOwnPropertyNames(proto).flatMap((method) => {
      const options = Reflect.getMetadata(
        BULL_MODULE_QUEUE_PROCESS,
        proto[method] as object
      );
      return options ? [{ method, options }] : [];
    });
  }

  it('the processor registers exactly one handler: the wildcard, with concurrency 1', () => {
    expect(registrations()).toEqual([
      { method: 'process', options: { name: '*', concurrency: 1 } },
    ]);
  });

  const bullQueue = fs.readFileSync(
    path.join(__dirname, '../node_modules/bull/lib/queue.js'),
    'utf8'
  );

  it('Bull starts one processing loop per process() call, per unit of concurrency, summed across names', () => {
    // If this changes, "one wildcard handler" may no longer be the way to stay at one loop.
    expect(bullQueue).toMatch(/while \(concurrency--\) \{\s*promises\.push\(/);
    expect(bullQueue).toMatch(
      /processJobs\(`\$\{handlerName\}:\$\{concurrency\}`/
    );
  });

  it("Bull hands a job to the handler of its name, else to the '*' handler", () => {
    expect(bullQueue).toContain(
      "const handler = this.handlers[job.name] || this.handlers['*'];"
    );
  });

  it('the manifest has no handler of its own (that would be a second loop)', () => {
    const source = fs.readFileSync(
      path.join(__dirname, '../src/worker/market-data.processor.ts'),
      'utf8'
    );
    expect(source.match(/^\s*@Process\(/gm)).toHaveLength(1); // decorator lines, not the comment about them
    expect(
      fs
        .readFileSync(
          path.join(__dirname, '../src/worker/cycle-manifest.service.ts'),
          'utf8'
        )
        .includes('@Process')
    ).toBe(false);
  });
});
