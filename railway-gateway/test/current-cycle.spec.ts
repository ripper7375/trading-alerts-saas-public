import * as fs from 'fs';
import * as path from 'path';
import { BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../src/prisma/prisma.service';
import { ActiveIndicatorService } from '../src/cycle/active-indicator/active-indicator.service';
import {
  CURRENT_CYCLE_CONTRACT,
  buildCurrentCycleBody,
  resolutionSlot,
} from '../src/cycle/active-indicator/current-cycle';
import { isMarketOpenXauusd } from '../src/cycle/market-hours';
import { CycleReaderService } from '../src/cycle/read/cycle-reader.service';
import { parseRequestedSlot } from '../src/gateway/cycles.controller';
import { FakePrisma } from './helpers/fake-cycle-store';
import { REFRESH_SLOT, putCycle } from './helpers/reader-world';

/**
 * The body of GET /api/v1/cycles/current, and the contract fixtures the monolith's
 * tests read as their mock gateway. The fixtures are the REAL output of the
 * builder for a flip of the M5 setting at slot T: the cycle just before T (old
 * source) and the cycle at T (new source). This spec compares the builder's output
 * with the files, so the contract cannot change without the files changing in the
 * same commit; regenerate them deliberately with
 *   WRITE_FIXTURES=yes npx jest test/current-cycle.spec.ts
 */

beforeEach(() => {
  jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
  jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
});
afterEach(() => jest.restoreAllMocks());

// Wednesday 2026-09-16 12:00 UTC: inside the XAUUSD trading week (the shared
// REFRESH_SLOT is Friday 21:00 UTC, after the close)
const T = REFRESH_SLOT - 2 * 86400 - 9 * 3600;
const SLOT = 300;
const FIXTURES = path.join(__dirname, 'fixtures');

async function body(options: {
  cycleSlot: number | null;
  now: number;
  cycleOverrides?: Record<string, unknown>;
  withFlip?: boolean;
  /** `?slot=`: the slot the caller is working on (the VPS renderer). */
  requestedSlot?: number | null;
}) {
  const prisma = new FakePrisma();
  prisma.seedActiveIndicators();
  const cycles = new CycleReaderService(prisma as unknown as PrismaService);
  const indicators = new ActiveIndicatorService(
    prisma as unknown as PrismaService,
    cycles
  );
  if (options.withFlip !== false) {
    await indicators.setActiveIndicator(
      {
        timeframe: 'M5',
        source: 'cherry_a',
        effectiveSlot: T,
        setBy: 'admin@example.test',
        reason: 'rehearsal',
      },
      T - 3600
    );
  }
  if (options.cycleSlot !== null) {
    putCycle(prisma, options.cycleSlot, options.cycleOverrides);
  }
  const cycle = await cycles.getNewestReadyCycle();
  const requestedSlot = options.requestedSlot ?? null;
  return buildCurrentCycleBody({
    now: options.now,
    cycle,
    indicators: await indicators.resolveAll(
      resolutionSlot(options.now, cycle, requestedSlot).slot
    ),
    requestedSlot,
  });
}

describe('the fixtures are what the builder produces (and the market is open for them)', () => {
  const cases = [
    ['cycles-current-before-flip.json', T - SLOT],
    ['cycles-current-after-flip.json', T],
  ] as const;

  // The VPS renderer renders slot T right after the collector validates it, about a
  // minute BEFORE the gateway has T READY: the newest READY cycle is still T - 300.
  it('cycles-current-renderer-before-ready.json: asked for slot T while the newest READY cycle is T - 300', async () => {
    const now = T + 20;
    expect(isMarketOpenXauusd(now)).toBe(true);
    const actual = await body({ cycleSlot: T - SLOT, now, requestedSlot: T });
    const target = path.join(
      FIXTURES,
      'cycles-current-renderer-before-ready.json'
    );
    if (process.env['WRITE_FIXTURES'] === 'yes') {
      fs.writeFileSync(target, JSON.stringify(actual, null, 2) + '\n');
    }
    expect(JSON.parse(fs.readFileSync(target, 'utf8'))).toEqual(actual);
    // the cycle it reports is the gateway's (T - 300), the setting is the one AT T
    expect(actual.cycle!.slot).toBe(T - SLOT);
    expect(actual.activeIndicators).toMatchObject({
      resolvedAtSlot: T,
      basis: 'REQUESTED_SLOT',
    });
    expect(actual.activeIndicators.byTimeframe.M5!.source).toBe('cherry_a');
  });

  it.each(cases)('%s', async (file, cycleSlot) => {
    const now = cycleSlot + 70; // the cycle was ready at slot + 63 s
    expect(isMarketOpenXauusd(now)).toBe(true);
    const actual = await body({ cycleSlot, now });
    const target = path.join(FIXTURES, file);
    if (process.env['WRITE_FIXTURES'] === 'yes') {
      fs.writeFileSync(target, JSON.stringify(actual, null, 2) + '\n');
    }
    expect(JSON.parse(fs.readFileSync(target, 'utf8'))).toEqual(actual);
  });

  it('before the flip M5 is best_fit_a, after it cherry_a; M15 never moves', () => {
    const read = (f: string) =>
      JSON.parse(fs.readFileSync(path.join(FIXTURES, f), 'utf8'));
    const before = read('cycles-current-before-flip.json');
    const after = read('cycles-current-after-flip.json');
    expect(before.activeIndicators.resolvedAtSlot).toBe(T - SLOT);
    expect(after.activeIndicators.resolvedAtSlot).toBe(T);
    expect(before.activeIndicators.byTimeframe.M5.source).toBe('best_fit_a');
    expect(after.activeIndicators.byTimeframe.M5.source).toBe('cherry_a');
    expect(after.activeIndicators.byTimeframe.M5.effectiveSlot).toBe(T);
    expect(before.activeIndicators.byTimeframe.M15.source).toBe('non_b');
    expect(after.activeIndicators.byTimeframe.M15.source).toBe('non_b');
  });
});

describe('the body', () => {
  const now = T + 70;

  it('names its contract and the gateway clock', async () => {
    const b = await body({ cycleSlot: T, now });
    expect(b.contract).toBe(CURRENT_CYCLE_CONTRACT);
    expect(CURRENT_CYCLE_CONTRACT).toBe('cycles-current/1');
    expect(b.now).toBe(now);
  });

  it('reports the newest READY cycle with its own status, attempts and digest', async () => {
    const b = await body({
      cycleSlot: T,
      now,
      cycleOverrides: {
        data_status: 'DELAYED',
        attempts: 2,
        retuning: true,
        closed_bars_digest: 'abc123',
        check_detail: { reason: 'STATISTICS_SHORTFALL' },
      },
    });
    expect(b.cycle).toMatchObject({
      slot: T,
      status: 'DELAYED',
      attempts: 2,
      retuning: true,
      closedBarsDigest: 'abc123',
      checkReason: 'STATISTICS_SHORTFALL',
    });
  });

  it('the timings: slot to ready, the gateway’s share of it, and the VPS clock', async () => {
    const b = await body({
      cycleSlot: T,
      now,
      cycleOverrides: {
        ready_at: T + 63,
        manifest_received_at: T + 41,
        collector_started_at: T + 5,
        collector_validated_at: T + 29,
        m5_export_at: T - 1,
        m15_export_at: null,
      },
    });
    expect(b.cycle!.timings).toEqual({
      readyAt: T + 63,
      manifestReceivedAt: T + 41,
      slotToReadySec: 63,
      gatewaySec: 22,
      collectorStartedAt: T + 5,
      collectorValidatedAt: T + 29,
      m5ExportAt: T - 1,
      m15ExportAt: null,
    });
  });

  it('the data status is rule 7 at the gateway clock: FRESH just after a cycle, with the reason and the age', async () => {
    const b = await body({ cycleSlot: T, now });
    expect(b.dataStatus).toEqual({
      status: 'FRESH',
      reason: 'CYCLE_READY_IN_TIME',
      dataAsOfSlot: T,
      secondsSinceReady: 7,
    });
  });

  it('...DELAYED when the cycle was late, STALE when none has been ready for ten minutes', async () => {
    const late = await body({
      cycleSlot: T,
      now,
      cycleOverrides: { ready_at: T + 200, data_status: 'DELAYED' },
    });
    expect(late.dataStatus.status).toBe('DELAYED');
    const stale = await body({ cycleSlot: T, now: T + 15 * 60 });
    expect(stale.dataStatus).toMatchObject({
      status: 'STALE',
      reason: 'NO_READY_CYCLE_WITHIN_STALE_WINDOW',
    });
  });

  it('...MARKET_CLOSED outside trading hours, whatever the cycles say', async () => {
    const b = await body({ cycleSlot: REFRESH_SLOT, now: REFRESH_SLOT + 70 }); // Friday after the close
    expect(b.dataStatus).toMatchObject({
      status: 'MARKET_CLOSED',
      dataAsOfSlot: REFRESH_SLOT,
    });
  });

  it('no READY cycle: cycle is null, the status is STALE, and the setting is resolved at the wall-clock slot', async () => {
    const b = await body({ cycleSlot: null, now });
    expect(b.cycle).toBeNull();
    expect(b.dataStatus).toMatchObject({
      status: 'STALE',
      reason: 'NO_READY_CYCLE',
      dataAsOfSlot: null,
    });
    expect(b.activeIndicators).toMatchObject({
      resolvedAtSlot: T,
      basis: 'WALL_CLOCK',
    });
    expect(b.activeIndicators.byTimeframe.M5!.source).toBe('cherry_a'); // T is the wall-clock slot, the flip has happened
  });

  it('a PENDING or INCOMPLETE newer cycle is not "current"', async () => {
    const prisma = new FakePrisma();
    prisma.seedActiveIndicators();
    putCycle(prisma, T - SLOT);
    putCycle(prisma, T, {
      state: 'PENDING',
      data_status: null,
      ready_at: null,
    });
    const cycle = await new CycleReaderService(
      prisma as unknown as PrismaService
    ).getNewestReadyCycle();
    expect(cycle!.slot).toBe(T - SLOT);
  });

  it('an unusable READY row is no cycle: null and STALE (a bad row fails closed)', async () => {
    const b = await body({
      cycleSlot: T,
      now,
      cycleOverrides: { ready_at: null },
    });
    expect(b.cycle).toBeNull();
    expect(b.dataStatus.status).toBe('STALE');
  });

  it('a timeframe with no setting is null in the body, not a default', async () => {
    const prisma = new FakePrisma(); // no seed rows
    const cycles = new CycleReaderService(prisma as unknown as PrismaService);
    const indicators = new ActiveIndicatorService(
      prisma as unknown as PrismaService,
      cycles
    );
    const b = buildCurrentCycleBody({
      now,
      cycle: null,
      indicators: await indicators.resolveAll(T),
    });
    expect(b.activeIndicators.byTimeframe).toEqual({ M5: null, M15: null });
  });
});

describe('?slot=: the setting AT the slot the caller is working on', () => {
  const now = T + 20;

  it('resolutionSlot prefers the requested slot over the cycle and over the clock', async () => {
    const prisma = new FakePrisma();
    prisma.seedActiveIndicators();
    putCycle(prisma, T - SLOT);
    const cycle = await new CycleReaderService(
      prisma as unknown as PrismaService
    ).getNewestReadyCycle();
    expect(resolutionSlot(now, cycle, T)).toEqual({
      slot: T,
      basis: 'REQUESTED_SLOT',
    });
    expect(resolutionSlot(now, cycle, null)).toEqual({
      slot: T - SLOT,
      basis: 'CYCLE',
    });
    expect(resolutionSlot(now, cycle)).toEqual({
      slot: T - SLOT,
      basis: 'CYCLE',
    });
    expect(resolutionSlot(now, null, T - 600)).toEqual({
      slot: T - 600,
      basis: 'REQUESTED_SLOT',
    });
    expect(resolutionSlot(now, null)).toEqual({ slot: T, basis: 'WALL_CLOCK' });
  });

  it('a slot of 0 is a request, not "no request"', async () => {
    expect(resolutionSlot(now, null, 0)).toEqual({
      slot: 0,
      basis: 'REQUESTED_SLOT',
    });
  });

  it('the renderer at slot T gets the NEW indicator while the gateway still has T - 300 READY: the same one the sensors use for T', async () => {
    const asked = await body({ cycleSlot: T - SLOT, now, requestedSlot: T });
    const notAsked = await body({ cycleSlot: T - SLOT, now });
    expect(asked.activeIndicators.byTimeframe.M5!.source).toBe('cherry_a');
    expect(notAsked.activeIndicators.byTimeframe.M5!.source).toBe('best_fit_a'); // the default: the cycle's slot
    expect(asked.cycle).toEqual(notAsked.cycle); // the cycle reported is the gateway's either way
  });

  it('asked for the slot BEFORE the change, the old indicator, however late the clock is', async () => {
    const asked = await body({
      cycleSlot: T,
      now: T + 86400,
      requestedSlot: T - SLOT,
    });
    expect(asked.activeIndicators).toMatchObject({
      resolvedAtSlot: T - SLOT,
      basis: 'REQUESTED_SLOT',
    });
    expect(asked.activeIndicators.byTimeframe.M5!.source).toBe('best_fit_a');
  });

  it('the status and the cycle do not depend on the requested slot', async () => {
    const a = await body({ cycleSlot: T - SLOT, now });
    const b = await body({
      cycleSlot: T - SLOT,
      now,
      requestedSlot: T - 10 * SLOT,
    });
    expect(b.dataStatus).toEqual(a.dataStatus);
    expect(b.cycle).toEqual(a.cycle);
  });
});

describe('parseRequestedSlot (the ?slot= of GET /api/v1/cycles/current)', () => {
  // The gateway clock is a second count, not a slot: not on a boundary.
  const NOW = 1789560000 + 299;

  /** The refusal's own message (Nest keeps it in the response body, not in `message`). */
  function refusal(value: unknown, now = NOW): string {
    try {
      parseRequestedSlot(value, now);
    } catch (error) {
      if (error instanceof BadRequestException) {
        const response = error.getResponse() as { message: string[] };
        return response.message.join(' | ');
      }
      throw error;
    }
    throw new Error(`${String(value)} was accepted`);
  }

  it('no parameter is no request (null), not an error', () => {
    expect(parseRequestedSlot(undefined, NOW)).toBeNull();
  });

  it('a slot on a boundary is the request, as a number', () => {
    expect(parseRequestedSlot('1789560000', NOW)).toBe(1789560000);
    expect(parseRequestedSlot('0', NOW)).toBe(0);
  });

  it('a slot exactly as far ahead as the tolerance (600 s) is accepted, one slot more is not', () => {
    // NOW + 301 is 1789560600; the tolerance reaches NOW + 600 = 1789560899
    expect(parseRequestedSlot('1789560600', NOW)).toBe(1789560600);
    expect(refusal('1789560900')).toMatch(/ahead of the gateway clock/);
  });

  it('with the clock on a boundary, the slot exactly at now + 600 s is accepted (the limit is inclusive)', () => {
    const onBoundary = 1789560000;
    expect(parseRequestedSlot(String(onBoundary + 600), onBoundary)).toBe(
      onBoundary + 600
    );
    expect(refusal(String(onBoundary + 900), onBoundary)).toMatch(
      /ahead of the gateway clock/
    );
  });

  it('a millisecond timestamp is told it is not whole seconds (it would be a valid-looking slot a lifetime away)', () => {
    // 1789560000000 is on a 300 boundary: only the digit limit explains it
    expect(refusal('1789560000000')).toBe(
      'slot must be a unix time in whole seconds'
    );
    expect(refusal('17895600000000')).toBe(
      'slot must be a unix time in whole seconds'
    );
  });

  it.each([
    ['text', 'tomorrow'],
    ['empty', ''],
    ['negative', '-300'],
    ['fractional', '300.5'],
    ['exponent', '1e9'],
    ['signed', '+1789560000'],
    ['padded', ' 1789560000'],
    ['an array (the parameter twice)', ['1789560000', '1789559700']],
    ['a number, not a string', 1789560000],
    ['null', null],
  ])('%s is refused as not a unix time in whole seconds', (_label, value) => {
    expect(refusal(value)).toBe('slot must be a unix time in whole seconds');
  });

  it('a slot off the 5-minute boundary is refused as such', () => {
    expect(refusal('1789560001')).toBe('slot must be on a 5-minute boundary');
  });
});
