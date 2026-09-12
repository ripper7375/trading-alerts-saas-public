import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import {
  FX_INDEX_NAMES,
  summarizeDayMetrics,
  computeVolatilityCorridor,
} from './currency-index-corridor-math';

const DEFAULT_LOOKBACK_DAYS = 20;
const FX_INDEX_NAME_LIST: string[] = [...FX_INDEX_NAMES];

/**
 * Currency Index PRO Plan (Phase 1) — the "00:00 MT5 midnight cron" from the
 * spec, built as an idempotent, self-healing tick rather than a
 * wall-clock-exact cron expression.
 *
 * Why not a precise 00:00:15 MT5-server-time cron: MT5's own midnight
 * boundary isn't UTC midnight -- it shifts with Eightcap's US-DST
 * convention, and that offset logic already lives in exactly one place by
 * design (currency_gold_index_engine.py on the VPS), which stamps every
 * CurrencyGoldIndex row with session_open_bar_time specifically so no
 * downstream reader ever has to re-derive the boundary itself. Porting that
 * DST math into TypeScript would duplicate it and risk drift.
 *
 * Instead, this ticks every 5 minutes and asks the data itself "has a new
 * session opened since I last finalized one?" -- reading
 * session_open_bar_time directly rather than computing it. A missed tick or
 * a worker restart just catches up on the next tick; there is nothing to
 * schedule precisely.
 */
@Injectable()
export class CurrencyIndexCorridorAggregatorService {
  private readonly logger = new Logger(
    CurrencyIndexCorridorAggregatorService.name
  );

  constructor(private readonly prisma: PrismaService) {}

  // A failed tick must never crash the worker process -- the other 4
  // ingestion queues (market-data, indicator-statistics, economic-events,
  // currency-gold-indices) share this process and must keep running
  // regardless. Self-heals on the next tick.
  @Cron(CronExpression.EVERY_5_MINUTES)
  async aggregate(): Promise<void> {
    try {
      await this.run();
    } catch (error) {
      this.logger.error('Corridor aggregation tick failed', error as Error);
    }
  }

  async run(): Promise<void> {
    const latestRow = await this.prisma.currencyGoldIndex.findFirst({
      where: { index_name: { in: FX_INDEX_NAME_LIST } },
      orderBy: { session_open_bar_time: 'desc' },
      select: { session_open_bar_time: true },
    });

    // No Lane 4 data pushed yet at all -- nothing to do.
    if (!latestRow) return;

    const latestSessionOpen = latestRow.session_open_bar_time;

    // Idempotent: a corridor for today already exists, so this tick (or an
    // earlier one today) already finalized the prior day and computed
    // today's corridor. No-op rather than recompute every 5 minutes.
    const existingCorridor =
      await this.prisma.dailyVolatilityCorridor.findUnique({
        where: { date: latestSessionOpen },
        select: { id: true },
      });
    if (existingCorridor) return;

    const previousRow = await this.prisma.currencyGoldIndex.findFirst({
      where: {
        index_name: { in: FX_INDEX_NAME_LIST },
        session_open_bar_time: { lt: latestSessionOpen },
      },
      orderBy: { session_open_bar_time: 'desc' },
      select: { session_open_bar_time: true },
    });

    // Bootstrap: this is Lane 4's very first day and no prior session has
    // ever closed. There is a day to finalize on every tick FROM HERE ON,
    // but not yet -- skip finalization and corridor computation entirely
    // rather than divide by zero or fabricate a corridor from zero days.
    if (previousRow) {
      await this.finalizeClosedDay(
        previousRow.session_open_bar_time,
        latestSessionOpen
      );
    }

    await this.computeAndStoreCorridor(latestSessionOpen);
  }

  /** Finalizes DailyCurrencyIndexMetrics for the day that just closed
   * ([dayStart, dayEnd) = [previous session open, new session open)), one
   * upsert per FX index. Upsert, not insert-only: a missed tick that
   * finalizes the same day twice (e.g. after a worker restart) is a true
   * no-op, since the inputs are deterministic given the same closed day's
   * rows. */
  private async finalizeClosedDay(
    dayStart: number,
    dayEnd: number
  ): Promise<void> {
    for (const indexName of FX_INDEX_NAMES) {
      const bars = await this.prisma.currencyGoldIndex.findMany({
        where: {
          index_name: indexName,
          bar_time: { gte: dayStart, lt: dayEnd },
        },
        orderBy: { bar_time: 'asc' },
        select: { bar_time: true, value: true, change_pct: true },
      });

      const summary = summarizeDayMetrics(bars);
      // This index had no data at all that day (e.g. the engine wasn't
      // running yet, or a VPS outage) -- skip rather than fabricate a row.
      if (!summary) continue;

      await this.prisma.dailyCurrencyIndexMetrics.upsert({
        where: {
          date_index_name: { date: dayStart, index_name: indexName },
        },
        create: { date: dayStart, index_name: indexName, ...summary },
        update: summary,
      });
    }
  }

  /** Computes today's DailyVolatilityCorridor from the trailing
   * min(DEFAULT_LOOKBACK_DAYS, available) closed days' metrics, pooled
   * across all 8 indices per the spec's own mu_basket/sigma_basket
   * definition (a flat pool of 8*N excursion points, not 8 per-currency
   * averages). */
  private async computeAndStoreCorridor(today: number): Promise<void> {
    const recentDates = await this.prisma.dailyCurrencyIndexMetrics.findMany({
      where: { date: { lt: today } },
      distinct: ['date'],
      orderBy: { date: 'desc' },
      take: DEFAULT_LOOKBACK_DAYS,
      select: { date: true },
    });

    // No prior closed day has ever been finalized (Lane 4 bootstrap) --
    // nothing to build a corridor from yet.
    if (recentDates.length === 0) return;

    const lookbackDates = recentDates.map((row) => row.date);
    const metrics = await this.prisma.dailyCurrencyIndexMetrics.findMany({
      where: { date: { in: lookbackDates } },
      select: { peak_high_pct: true, peak_low_pct: true },
    });

    const excursions = metrics.map(
      (m) => (m.peak_high_pct + m.peak_low_pct) / 2
    );
    const corridor = computeVolatilityCorridor(excursions);
    if (!corridor) return;

    await this.prisma.dailyVolatilityCorridor.upsert({
      where: { date: today },
      create: {
        date: today,
        lookback_days: lookbackDates.length,
        ...corridor,
      },
      update: {
        lookback_days: lookbackDates.length,
        ...corridor,
      },
    });
  }
}
