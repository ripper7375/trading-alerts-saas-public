import { Logger } from '@nestjs/common';
import { PrismaService } from '../../src/prisma/prisma.service';
import {
  Timeframe,
  formingBarOpen,
  lastClosedBarOpen,
  TIMEFRAME_SECONDS,
} from '../../src/cycle/slot';
import { CycleReaderService } from '../../src/cycle/read/cycle-reader.service';
import { FakePrisma } from './fake-cycle-store';

/**
 * A small world for the reader specs: a database (the in-memory stand-in of
 * fake-cycle-store.ts) with market_cycles rows, closed bars, the forming bar and
 * statistics, laid out the way the gateway leaves them.
 *
 * 21:00 UTC on 18 Sep 2026 is a refresh slot (M5 and M15 both collected);
 * 21:05 is an M5-only slot, where M15 was last collected at 21:00.
 */
export const REFRESH_SLOT = 1789765200; // 21:00
export const M5_ONLY_SLOT = REFRESH_SLOT + 300; // 21:05
export const M5_CYCLE_ID = 2;
export const M15_CYCLE_ID = 3;

/** Values a test can recognise: the close encodes the open time and the cycle. */
export function barValues(timestamp: number, timeframe: Timeframe) {
  const n = timestamp / TIMEFRAME_SECONDS[timeframe];
  return {
    open: 2600 + (n % 500) * 0.01,
    high: 2601.5 + (n % 500) * 0.01,
    low: 2598.5 + (n % 500) * 0.01,
    close: 2600.75 + (n % 500) * 0.01,
    volume: 100 + (n % 37),
  };
}

export function putBar(
  prisma: FakePrisma,
  timeframe: Timeframe,
  timestamp: number,
  overrides: Partial<{
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
    cycle_id: number;
  }> = {}
): void {
  prisma.upsertBar({
    symbol: 'XAUUSD',
    timeframe,
    timestamp,
    ...barValues(timestamp, timeframe),
    cycle_id: timeframe === 'M5' ? M5_CYCLE_ID : M15_CYCLE_ID,
    ...overrides,
  });
}

/** `count` consecutive bars of a timeframe ending at (and including) `lastOpen`. */
export function putBarsEndingAt(
  prisma: FakePrisma,
  timeframe: Timeframe,
  lastOpen: number,
  count: number
): void {
  for (let i = 0; i < count; i += 1) {
    putBar(
      prisma,
      timeframe,
      lastOpen - (count - 1 - i) * TIMEFRAME_SECONDS[timeframe]
    );
  }
}

/** A forming-bar fixture: values no closed bar has, so any leak is recognisable. */
export const FORMING = {
  open: 7777.11,
  high: 8888.22,
  low: 6666.33,
  close: 7000.44,
  volume: 99991,
} as const;

/**
 * The newest `closed` bars of both timeframes as of `slot`, plus the bar still
 * forming at the slot for each timeframe (with the FORMING values, which no
 * reader may let out except as the one labelled M5 price).
 */
export function putWorld(
  prisma: FakePrisma,
  slot: number,
  options: { closedM5?: number; closedM15?: number; formingM5?: boolean } = {}
): void {
  const { closedM5 = 288 + 12, closedM15 = 96 + 6, formingM5 = true } = options;
  putBarsEndingAt(prisma, 'M5', lastClosedBarOpen('M5', slot), closedM5);
  putBarsEndingAt(prisma, 'M15', lastClosedBarOpen('M15', slot), closedM15);
  if (formingM5) {
    putBar(prisma, 'M5', formingBarOpen('M5', slot), { ...FORMING });
  }
  putBar(prisma, 'M15', formingBarOpen('M15', slot), { ...FORMING });
}

/** A market_cycles row, READY and well-formed unless the test says otherwise. */
export function putCycle(
  prisma: FakePrisma,
  slot: number,
  overrides: Record<string, unknown> = {}
): void {
  prisma.cycles.set(`XAUUSD_${slot}`, {
    id: `cycle_${slot}`,
    symbol: 'XAUUSD',
    slot,
    state: 'READY',
    data_status: 'FRESH',
    attempts: 1,
    manifest_received_at: slot + 61,
    ready_at: slot + 63,
    collector_started_at: slot + 5,
    collector_validated_at: slot + 20,
    m5_collection_cycle_id: M5_CYCLE_ID,
    m15_collection_cycle_id: M15_CYCLE_ID,
    m5_bar_count: 289,
    m15_bar_count: slot % 900 === 0 ? 97 : null,
    m5_newest_bar_ts: slot,
    m15_newest_bar_ts: slot % 900 === 0 ? slot : null,
    m5_export_at: slot - 1,
    m15_export_at: slot % 900 === 0 ? slot - 1 : null,
    check_detail: null,
    terminal_id: 'MT5-A',
    config_hashes: null,
    source_modes: null,
    retuning: false,
    backlog_rows: 0,
    repush_rows_unsent: null,
    closed_bars_digest: null,
    ...overrides,
  });
}

export function putStatistic(
  prisma: FakePrisma,
  source: string,
  timeframe: Timeframe,
  capturedAt: number,
  extra: Record<string, unknown> = {}
): void {
  prisma.stats.push({
    symbol: 'XAUUSD',
    timeframe,
    source,
    captured_at: capturedAt,
    live_bar_ts: capturedAt,
    cycle_id: 1,
    containment_rate: 61.5,
    ...extra,
  });
}

export function buildReader() {
  const prisma = new FakePrisma();
  const reader = new CycleReaderService(prisma as unknown as PrismaService);
  return { prisma, reader };
}

export function silenceLogs(): void {
  jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
  jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
}
