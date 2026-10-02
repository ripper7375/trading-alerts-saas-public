import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  SpineBar,
  digestClosedSpine,
  loadClosedSpine,
} from '../closed-bars-digest';
import { closedBarsFetcher } from '../closed-bars-query';
import {
  Timeframe,
  formingBarOpen,
  isClosedBar,
  isSlot,
  isTimeframe,
  lastClosedBarOpen,
  lastCollectedSlot,
} from '../slot';
import { ONE_DAY_CLOSED_BARS } from '../windows';
import { CycleRow, statisticsShortfallFor, toReaderCycle } from './ready-cycle';
import {
  ClosedBarsResult,
  LastPrice,
  MAX_CLOSED_BARS_PER_READ,
  OneDayOhlcResult,
  READER_SYMBOL,
  ReaderCycle,
  StaleReason,
  StaleResult,
  StatisticSource,
  StatisticsAtSlotResult,
  isStatisticSource,
} from './read-types';

/** The market_cycles columns the readers need, and no others. */
const CYCLE_COLUMNS = {
  slot: true,
  data_status: true,
  ready_at: true,
  attempts: true,
  retuning: true,
  closed_bars_digest: true,
  check_detail: true,
  m5_export_at: true,
  m15_export_at: true,
  m5_collection_cycle_id: true,
  manifest_received_at: true,
  collector_started_at: true,
  collector_validated_at: true,
} as const;

type CycleLookup =
  | { cycle: ReaderCycle; checkDetail: unknown }
  | { reason: 'CYCLE_NOT_READY' | 'INVALID_CYCLE_ROW'; detail: string };

function assertSlotArgument(slot: number): void {
  if (!isSlot(slot)) {
    throw new RangeError(
      `slot must be a unix time on a 5-minute boundary, got ${String(slot)}`
    );
  }
}

/**
 * The read side of build step 2 (STACK-D-ARCHITECTURE.md section 1.3 rules 2 to 5;
 * section 1.7 handoffs to sections 2 and 5): the only sanctioned way for Stack D
 * to read bars, the one-day window and statistics for a cycle.
 *
 * Three properties hold for every function here, and each is tested:
 *
 *   1. READY ONLY. A reader looks at `market_cycles` only through a query that
 *      filters `state = 'READY'`, and answers STALE when the slot's cycle is not
 *      READY. Rows of a cycle that is PENDING or INCOMPLETE are never read, even
 *      though the bars and statistics of a half-landed cycle may be sitting in
 *      the tables. The cycle consulted for a timeframe is the one that COLLECTED
 *      it (rule 5): for M15 on an M5-only slot that is the last quarter hour.
 *   2. NO STILL-OPEN BAR. Bars are selected at or before `lastClosedBarOpen`
 *      (rule 2) and every bar returned is re-checked with `isClosedBar`; the
 *      forming bar's close leaves only as the labelled last price (rule 3).
 *   3. NO "LATEST AVAILABLE". Statistics are looked up by the exact key
 *      (symbol, timeframe, source, captured_at = the slot the timeframe was last
 *      collected). There is no ordering and no fallback; a missing row is STALE.
 *      test/no-latest-statistics.spec.ts keeps it that way across Stack D code.
 *
 * Data conditions come back as `status: 'STALE'` with a reason; caller bugs (a slot
 * that is not on a slot boundary, an unknown timeframe or source, a window size out
 * of range) throw, because a wrong window is still a valid window and nothing else
 * would notice.
 */
@Injectable()
export class CycleReaderService {
  private readonly logger = new Logger(CycleReaderService.name);
  private readonly symbol = READER_SYMBOL;

  constructor(private readonly prisma: PrismaService) {}

  /** The READY cycle at a slot, or null when there is none (or its row cannot be trusted). */
  async getReadyCycle(slot: number): Promise<ReaderCycle | null> {
    assertSlotArgument(slot);
    const found = await this.lookupCycle(slot);
    return 'cycle' in found ? found.cycle : null;
  }

  /**
   * The newest READY cycle: the one place that answers "which slot is current".
   * Only READY rows are considered, so a PENDING or INCOMPLETE newer row never
   * hides it. If the newest READY row is unusable the answer is null (fail closed),
   * not the one before it.
   */
  async getNewestReadyCycle(): Promise<ReaderCycle | null> {
    const row = await this.prisma.marketCycle.findFirst({
      where: { symbol: this.symbol, state: 'READY' },
      orderBy: { slot: 'desc' },
      select: CYCLE_COLUMNS,
    });
    if (!row) return null;
    const cycle = toReaderCycle(row as CycleRow);
    if (!cycle) {
      this.logger.warn(`Newest READY cycle at slot ${row.slot} is unusable`);
    }
    return cycle;
  }

  /**
   * The newest `n` bars of a timeframe that are closed at the slot (rule 2),
   * oldest first. STALE when the cycle that collected the timeframe is not READY
   * or when fewer than `n` closed bars exist.
   */
  async getClosedBars(
    timeframe: Timeframe,
    slot: number,
    n: number
  ): Promise<ClosedBarsResult> {
    if (!isTimeframe(timeframe)) {
      throw new RangeError(`unsupported timeframe: ${String(timeframe)}`);
    }
    assertSlotArgument(slot);
    if (!Number.isInteger(n) || n < 1 || n > MAX_CLOSED_BARS_PER_READ) {
      throw new RangeError(
        `n must be an integer from 1 to ${MAX_CLOSED_BARS_PER_READ}, got ${String(n)}`
      );
    }

    const collectedSlot = lastCollectedSlot(timeframe, slot);
    const found = await this.lookupCycle(collectedSlot);
    if (!('cycle' in found)) {
      return this.stale(found.reason, found.detail, {
        slot,
        timeframe,
        collectedSlot,
      });
    }

    const fetched = await closedBarsFetcher(this.prisma, this.symbol)(
      timeframe,
      lastClosedBarOpen(timeframe, slot),
      n
    );
    const bars = [...fetched].sort((a, b) => a.timestamp - b.timestamp);
    this.assertAllClosed(bars, timeframe, slot);
    if (bars.length < n) {
      return this.stale(
        'INSUFFICIENT_CLOSED_BARS',
        `${timeframe} has ${bars.length} closed bars at slot ${slot}, ${n} asked for`,
        { slot, timeframe, collectedSlot }
      );
    }
    return {
      status: 'OK',
      timeframe,
      slot,
      collectedSlot,
      bars,
      newestOpenTime: bars[bars.length - 1].timestamp,
      cycle: found.cycle,
    };
  }

  /**
   * One day of OHLC for the prompt (rule 4): the newest 288 closed M5 bars and 96
   * closed M15 bars at the slot, plus the forming bar's close as one labelled last
   * price (rule 3). It also reports whether the closed bars still hash to the
   * digest stored when the cycle was declared ready.
   */
  async getOneDayOhlc(slot: number): Promise<OneDayOhlcResult> {
    assertSlotArgument(slot);

    const m5Found = await this.lookupCycle(slot);
    if (!('cycle' in m5Found)) {
      return this.stale(m5Found.reason, m5Found.detail, {
        slot,
        timeframe: 'M5',
        collectedSlot: slot,
      });
    }
    const m15Slot = lastCollectedSlot('M15', slot);
    const m15Found =
      m15Slot === slot ? m5Found : await this.lookupCycle(m15Slot);
    if (!('cycle' in m15Found)) {
      return this.stale(m15Found.reason, m15Found.detail, {
        slot,
        timeframe: 'M15',
        collectedSlot: m15Slot,
      });
    }

    const spine = await loadClosedSpine(
      closedBarsFetcher(this.prisma, this.symbol),
      slot
    );
    for (const timeframe of ['M5', 'M15'] as const) {
      this.assertAllClosed(spine[timeframe], timeframe, slot);
      if (spine[timeframe].length < ONE_DAY_CLOSED_BARS[timeframe]) {
        return this.stale(
          'INSUFFICIENT_CLOSED_BARS',
          `${timeframe} has ${spine[timeframe].length} closed bars at slot ${slot}, ` +
            `one day is ${ONE_DAY_CLOSED_BARS[timeframe]}`,
          { slot, timeframe, collectedSlot: lastCollectedSlot(timeframe, slot) }
        );
      }
    }

    const digest = digestClosedSpine(spine);
    const cycleDigest = m5Found.cycle.closedBarsDigest;
    return {
      status: 'OK',
      slot,
      bars: { M5: spine.M5, M15: spine.M15 },
      lastPrice: await this.lastPrice(slot, m5Found.cycle),
      replay: {
        digest,
        cycleDigest,
        matches: cycleDigest === null ? null : cycleDigest === digest,
      },
      cycle: m5Found.cycle,
      m15Cycle: m15Found.cycle,
    };
  }

  /**
   * The statistics row for a source at the slot its timeframe was last collected
   * (rule 5), by exact key. STALE, with a reason, when the cycle that collected
   * the timeframe is not READY or when there is no row at that slot: never the
   * newest row of that source, however recent. A row that is there is returned
   * even when the cycle recorded a shortfall for OTHER sources; the shortfall is
   * the reason only when this row is the one that is missing.
   */
  async getStatisticsAtSlot(
    source: StatisticSource,
    timeframe: Timeframe,
    slot: number
  ): Promise<StatisticsAtSlotResult> {
    if (!isStatisticSource(source)) {
      throw new RangeError(`unknown statistics source: ${String(source)}`);
    }
    if (!isTimeframe(timeframe)) {
      throw new RangeError(`unsupported timeframe: ${String(timeframe)}`);
    }
    assertSlotArgument(slot);

    const collectedSlot = lastCollectedSlot(timeframe, slot);
    const found = await this.lookupCycle(collectedSlot);
    if (!('cycle' in found)) {
      return this.stale(found.reason, found.detail, {
        slot,
        timeframe,
        collectedSlot,
      });
    }

    const row = await this.prisma.indicatorStatistic.findUnique({
      where: {
        symbol_timeframe_source_captured_at: {
          symbol: this.symbol,
          timeframe,
          source,
          captured_at: collectedSlot,
        },
      },
    });
    if (!row) {
      const shortfall = statisticsShortfallFor(found.checkDetail, timeframe);
      return this.stale(
        shortfall ? 'STATISTICS_SHORTFALL' : 'NO_STATISTICS_AT_SLOT',
        `no ${source} ${timeframe} statistics captured at ${collectedSlot}` +
          (shortfall
            ? ', and that cycle went READY recording a shortfall'
            : ''),
        { slot, timeframe, collectedSlot }
      );
    }
    if (row.captured_at !== collectedSlot) {
      // Unreachable through the key above; here so a changed query cannot hand
      // back a row from another slot without anyone noticing.
      throw new Error(
        `statistics row captured at ${row.captured_at} returned for slot ${collectedSlot}`
      );
    }
    return {
      status: 'OK',
      source,
      timeframe,
      slot,
      collectedSlot,
      row,
      cycle: found.cycle,
    };
  }

  // ---------------------------------------------------------------- internals

  /** The ONE query on market_cycles by slot, and it only ever selects READY rows. */
  private async lookupCycle(slot: number): Promise<CycleLookup> {
    const row = await this.prisma.marketCycle.findFirst({
      where: { symbol: this.symbol, slot, state: 'READY' },
      select: CYCLE_COLUMNS,
    });
    if (!row) {
      return {
        reason: 'CYCLE_NOT_READY',
        detail: `no READY market_cycles row at slot ${slot}`,
      };
    }
    const cycle = toReaderCycle(row as CycleRow);
    if (!cycle) {
      return {
        reason: 'INVALID_CYCLE_ROW',
        detail: `the READY row at slot ${slot} cannot be trusted`,
      };
    }
    return { cycle, checkDetail: row.check_detail };
  }

  /**
   * Rule 3: the still-open M5 bar as ONE labelled price. Selects `close` and the
   * identity of the row, never the bar's open, high, low or volume. It is this
   * cycle's price only while the row is still the version this cycle wrote: a
   * later cycle rewrites it with the closed bar's final values.
   */
  private async lastPrice(
    slot: number,
    cycle: ReaderCycle
  ): Promise<LastPrice> {
    const barOpenTime = formingBarOpen('M5', slot);
    const row = await this.prisma.marketDataV6.findUnique({
      where: {
        symbol_timeframe_timestamp: {
          symbol: this.symbol,
          timeframe: 'M5',
          timestamp: barOpenTime,
        },
      },
      select: { timestamp: true, close: true, cycle_id: true },
    });
    if (!row)
      return { status: 'UNAVAILABLE', reason: 'FORMING_BAR_NOT_IN_TABLE' };
    if (
      cycle.m5CollectionCycleId === null ||
      row.cycle_id !== cycle.m5CollectionCycleId
    ) {
      return { status: 'UNAVAILABLE', reason: 'NOT_THIS_CYCLES_PRICE' };
    }
    return {
      status: 'OK',
      price: row.close,
      barOpenTime: row.timestamp,
      asOf: cycle.m5ExportAt,
    };
  }

  /** Belt and braces behind the query's own filter: a still-open bar must never get out. */
  private assertAllClosed(
    bars: readonly SpineBar[],
    timeframe: Timeframe,
    slot: number
  ): void {
    for (const bar of bars) {
      if (!isClosedBar(bar.timestamp, timeframe, slot)) {
        throw new Error(
          `a still-open ${timeframe} bar (open ${bar.timestamp}) was read for slot ${slot}`
        );
      }
    }
  }

  private stale(
    reason: StaleReason,
    detail: string,
    where: { slot: number; timeframe?: Timeframe; collectedSlot?: number }
  ): StaleResult {
    return { status: 'STALE', reason, detail, ...where };
  }
}
