import { Injectable, Logger } from '@nestjs/common';
import { ActiveIndicatorService } from '../../cycle/active-indicator/active-indicator.service';
import { READER_SYMBOL } from '../../cycle/read/read-types';
import { CycleRow, invalidCycleRow } from '../../cycle/read/ready-cycle';
import {
  TIMEFRAMES,
  Timeframe,
  isClosedBar,
  isSlot,
  lastClosedBarOpen,
} from '../../cycle/slot';
import { PrismaService } from '../../prisma/prisma.service';
import {
  BAR_COLUMNS,
  BarRecord,
  CycleInputsBundle,
  REFUSED_DATA_STATUS,
  StatisticsRecord,
  kitIndicatorOf,
  statisticsSourceOf,
  windowBarColumns,
} from './bundle-types';
import {
  ChannelBarRow,
  FetchChannelBars,
  channelBarsFetcher,
} from './channel-bars-query';
import { closedBarsToSupply } from './closed-channel';
import type {
  InputsProvenance,
  InputsSource,
  LoadedInputs,
} from './inputs-source';
import { slotToIso, statsSlots } from './stats-slot';
import { bundleStatisticsRow, jsonValue } from './statistics-fields';
import { TimeframeTuning, mergeTuning, readTuning } from './tuning';

/**
 * The market_cycles columns the loader reads: everything `invalidCycleRow` checks
 * (so a READY row that cannot be trusted is refused here exactly as the readers
 * refuse it) plus the two tuning columns the readers do not need.
 */
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
  config_hashes: true,
  source_modes: true,
} as const;

type ReadyRow = CycleRow & { config_hashes: unknown; source_modes: unknown };

/** What a timeframe's collecting cycle gave: a usable READY row and the tuning it recorded, or the reason it did not. */
type Collecting =
  | {
      usable: true;
      row: ReadyRow;
      tuning: Partial<Record<Timeframe, TimeframeTuning>>;
    }
  | {
      usable: false;
      reason: 'CYCLE_NOT_READY' | 'INVALID_CYCLE_ROW';
      detail: string;
    };

/**
 * The cycle inputs, read from PostgreSQL by the rules of STACK-D-ARCHITECTURE.md
 * section 1.3 (the first of two `InputsSource`s; the other reads stored fixtures).
 *
 *   - Rule 2, closed bars only. Bars are selected at or before the open time of the
 *     last bar that is closed at the slot, and every bar returned is checked again.
 *     The bar still forming at the slot is never selected, whatever the table holds.
 *   - ADR-083, the whole closed channel. The loader asks for as many closed bars as
 *     the channel is long (closed-channel.ts) and does no window arithmetic: the
 *     windows are in MCD1 and MCD2 2.0.1. Fewer bars in the table are handed over
 *     as they are, never padded. Only the columns the evaluators read are carried:
 *     the active indicator's channel on every bar, every candidate's on the last
 *     closed bar (BAR_COLUMNS in bundle-types.ts).
 *   - Rule 5, statistics at the slot. Rows are read by symbol, timeframe and ONE
 *     `captured_at`: the slot the timeframe was last collected at (M15 at 20:55 is
 *     20:45). No ordering by time, no "latest available"; a source with no row at the
 *     slot is a missing key, which the evaluators answer with STALE.
 *   - Rule 6, the setting. `ActiveIndicatorService.resolveAll(slot)`, so the sensors
 *     switch on the same slot as the chart and the UI. A timeframe with no setting is
 *     absent from the bundle (INVALID + NO_SETTING in the evaluators), never guessed.
 *   - Rule 9 and the tuning. `retuning`, `config_hashes` and `source_modes` come from
 *     the READY `market_cycles` row of the cycle that COLLECTED each timeframe; the
 *     data status is the cycle's own. Same source on both timeframes under two
 *     tunings is refused (Q13): the bundle is marked with REFUSED_DATA_STATUS, which
 *     the kit's cycle check turns into INVALID + SANITY_FAILED for every MCD.
 *
 * READY ONLY, like every reader: a row that is PENDING or INCOMPLETE is never
 * consulted, however complete its bars and statistics look. The cycle at the slot
 * must be READY, or the answer is NOT_READY. The cycle that collected M15 may be an
 * earlier slot; when that one is not READY or not trustworthy, M15 is left out of the
 * bundle (no bars, no statistics) and everything that reads M15 answers STALE, the
 * answer `CycleReaderService` gives for the same situation.
 *
 * It writes nothing and caches nothing: the same slot read twice gives the same
 * bundle as long as the tables are unchanged, and the worker stores the bundle it
 * used (market_cycle_inputs) because the indicator columns are refit by later cycles.
 */
@Injectable()
export class DatabaseInputsSource implements InputsSource {
  private readonly logger = new Logger(DatabaseInputsSource.name);
  private readonly fetchBars: FetchChannelBars;

  constructor(
    private readonly prisma: PrismaService,
    private readonly indicators: ActiveIndicatorService
  ) {
    this.fetchBars = channelBarsFetcher(prisma, READER_SYMBOL);
  }

  async loadCycleInputs(symbol: string, slot: number): Promise<LoadedInputs> {
    if (symbol !== READER_SYMBOL) {
      throw new RangeError(
        `this pipeline carries ${READER_SYMBOL} only, got ${String(symbol)}`
      );
    }
    if (!Number.isInteger(slot) || !isSlot(slot)) {
      throw new RangeError(
        `slot must be a unix time on a 5-minute boundary, got ${String(slot)}`
      );
    }

    const collectedAt = statsSlots(slot);
    const rows = await this.prisma.marketCycle.findMany({
      where: {
        symbol,
        slot: { in: [...new Set([collectedAt.M5, collectedAt.M15])] },
        state: 'READY',
      },
      select: CYCLE_COLUMNS,
    });
    const collecting = {} as Record<Timeframe, Collecting>;
    for (const timeframe of TIMEFRAMES) {
      collecting[timeframe] = this.collectingCycle(
        rows as unknown as ReadyRow[],
        collectedAt[timeframe]
      );
    }

    // The cycle at the slot is the cycle being processed: without a usable READY row there is nothing to load.
    const m5 = collecting.M5;
    if (!m5.usable) {
      return {
        status: 'NOT_READY',
        reason: m5.reason,
        slot,
        detail: m5.detail,
      };
    }
    const notes: string[] = [];
    const collected = {} as Record<Timeframe, boolean>;
    for (const timeframe of TIMEFRAMES) {
      const c = collecting[timeframe];
      collected[timeframe] = c.usable;
      if (!c.usable) {
        notes.push(`${timeframe} left out: ${c.detail}`);
        this.logger.warn(
          `Slot ${slot}: ${timeframe} left out of the inputs (${c.detail})`
        );
      }
    }

    const setting = await this.indicators.resolveAll(slot);
    const active: Partial<Record<Timeframe, string>> = {};
    for (const timeframe of TIMEFRAMES) {
      const current = setting[timeframe];
      if (current) active[timeframe] = kitIndicatorOf(current.source);
    }

    const statistics = await this.statisticsAtSlot(
      symbol,
      collected,
      collectedAt
    );

    const activeRows: Partial<Record<Timeframe, StatisticsRecord | undefined>> =
      {};
    for (const timeframe of TIMEFRAMES) {
      const indicator = active[timeframe];
      activeRows[timeframe] =
        indicator === undefined
          ? undefined
          : statistics[timeframe]?.[statisticsSourceOf(indicator)];
    }
    const wanted = closedBarsToSupply(activeRows);
    const requested = {} as Record<Timeframe, number>;
    for (const timeframe of TIMEFRAMES) {
      requested[timeframe] = collected[timeframe] ? wanted[timeframe] : 0;
    }

    const [barsM5, barsM15] = await Promise.all(
      TIMEFRAMES.map((timeframe) =>
        collected[timeframe]
          ? this.closedBars(
              timeframe,
              slot,
              requested[timeframe],
              active[timeframe]
            )
          : Promise.resolve([] as BarRecord[])
      )
    );
    const bars: Record<Timeframe, BarRecord[]> = { M5: barsM5, M15: barsM15 };

    const usedSources: Partial<Record<Timeframe, string>> = {};
    const perTimeframe: Partial<Record<Timeframe, TimeframeTuning>> = {};
    for (const timeframe of TIMEFRAMES) {
      const indicator = active[timeframe];
      if (indicator !== undefined)
        usedSources[timeframe] = statisticsSourceOf(indicator);
      // each timeframe's tuning is what the cycle that collected IT recorded for it
      const c = collecting[timeframe];
      const recorded = c.usable ? c.tuning[timeframe] : undefined;
      if (recorded) perTimeframe[timeframe] = recorded;
    }
    const merged = mergeTuning(usedSources, perTimeframe);
    notes.push(...merged.notes);
    for (const refusal of merged.refusals) {
      this.logger.warn(`Slot ${slot} refused: ${refusal.detail}`);
    }

    const row = m5.row;
    const bundle: CycleInputsBundle = {
      symbol,
      cycle_slot: slotToIso(slot),
      data_status:
        merged.refusals.length > 0
          ? REFUSED_DATA_STATUS
          : (row.data_status as string),
      retuning: row.retuning,
      bars,
      statistics,
      stats_slot: {
        M5: slotToIso(collectedAt.M5),
        M15: slotToIso(collectedAt.M15),
      },
      active_indicator: active,
      config_hash: merged.config_hash,
      channel_mode: merged.channel_mode,
    };
    const provenance: InputsProvenance = {
      origin: 'database',
      slot,
      dataStatus: row.data_status as string,
      retuning: row.retuning,
      statsSlot: collectedAt,
      barCounts: { M5: bars.M5.length, M15: bars.M15.length },
      barsRequested: requested,
      collected,
      refusals: merged.refusals,
      notes,
    };
    return { status: 'OK', bundle, provenance };
  }

  /** The usable READY row that collected a timeframe, with its tuning parsed; otherwise why not. */
  private collectingCycle(rows: ReadyRow[], slot: number): Collecting {
    const row = rows.find((candidate) => candidate.slot === slot);
    if (!row) {
      return {
        usable: false,
        reason: 'CYCLE_NOT_READY',
        detail: `no READY market_cycles row at slot ${slot}`,
      };
    }
    const invalid = invalidCycleRow(row);
    if (invalid !== null) {
      return {
        usable: false,
        reason: 'INVALID_CYCLE_ROW',
        detail: `the READY row at slot ${slot} cannot be trusted: ${invalid}`,
      };
    }
    const tuning = readTuning(row);
    if (!tuning.ok) {
      return {
        usable: false,
        reason: 'INVALID_CYCLE_ROW',
        detail: `the READY row at slot ${slot} has unreadable tuning: ${tuning.detail}`,
      };
    }
    return { usable: true, row, tuning: tuning.tuning };
  }

  /**
   * Rule 5: the rows of every source captured at the slot each collected timeframe was
   * last collected at, by exact `captured_at`. A timeframe with no row is absent, not
   * empty, so the bundle is what the kit's own `to_dict()` would write.
   */
  private async statisticsAtSlot(
    symbol: string,
    collected: Record<Timeframe, boolean>,
    collectedAt: Record<Timeframe, number>
  ): Promise<CycleInputsBundle['statistics']> {
    const out: CycleInputsBundle['statistics'] = {};
    const found = await Promise.all(
      TIMEFRAMES.map((timeframe) =>
        collected[timeframe]
          ? this.prisma.indicatorStatistic.findMany({
              where: {
                symbol,
                timeframe,
                captured_at: collectedAt[timeframe],
              },
              orderBy: { source: 'asc' },
            })
          : Promise.resolve([])
      )
    );
    TIMEFRAMES.forEach((timeframe, index) => {
      const sources: Record<string, StatisticsRecord> = {};
      for (const row of found[index]) {
        if (row.captured_at !== collectedAt[timeframe]) {
          // Unreachable through the query above; here so a changed query cannot hand back another slot's row unnoticed.
          throw new Error(
            `statistics row captured at ${row.captured_at} returned for slot ${collectedAt[timeframe]}`
          );
        }
        sources[row.source] = bundleStatisticsRow(row);
      }
      if (Object.keys(sources).length > 0) out[timeframe] = sources;
    });
    return out;
  }

  /**
   * Rule 2: up to `take` closed bars of a timeframe at the slot, oldest first. The last
   * one carries every candidate's channel (the tier-1 cross-check reads it), the others
   * the open time, the close and the active indicator's channel (BAR_COLUMNS says why).
   * One query per timeframe, so the last bar and the window come from the same read.
   */
  private async closedBars(
    timeframe: Timeframe,
    slot: number,
    take: number,
    activeIndicator: string | undefined
  ): Promise<BarRecord[]> {
    const fetched = await this.fetchBars(
      timeframe,
      lastClosedBarOpen(timeframe, slot),
      take
    );
    const rows = [...fetched].sort((a, b) => a.timestamp - b.timestamp);
    for (const row of rows) {
      if (!isClosedBar(row.timestamp, timeframe, slot)) {
        throw new Error(
          `a still-open ${timeframe} bar (open ${row.timestamp}) was read for slot ${slot}`
        );
      }
    }
    const window = windowBarColumns(activeIndicator);
    return rows.map((row, index) =>
      toBar(row, index === rows.length - 1 ? BAR_COLUMNS : window)
    );
  }
}

/** A table row as a bundle bar with the given columns only: numbers or null. */
function toBar(row: ChannelBarRow, columns: readonly string[]): BarRecord {
  const bar: Record<string, number | null> = {};
  for (const column of columns) {
    bar[column] = jsonValue(row[column], `bar column ${column}`) as
      | number
      | null;
  }
  return bar as BarRecord;
}
