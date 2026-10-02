import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Job, Queue } from 'bull';
import { PrismaService } from '../prisma/prisma.service';
import { CycleManifest } from '../cycle/cycle-manifest.contract';
import {
  digestClosedSpine,
  loadClosedSpine,
} from '../cycle/closed-bars-digest';
import { cycleStatus, CycleDataStatus } from '../cycle/data-status';
import {
  CheckDetail,
  LandedCount,
  cycleAttempts,
  decideManifest,
  listTimeframes,
} from '../cycle/manifest-decision';
import { closedBarsFetcher } from '../cycle/closed-bars-query';
import { pendingCycleRow } from '../cycle/manifest-row';
import { MANIFEST_THRESHOLDS } from '../cycle/manifest-thresholds';
import {
  CycleEventRow,
  PROMOTE_EVENT,
  PreviousCycle,
  RetuneStep,
  WindowCount,
  continuesRetuning,
  preTuningBarsWhere,
  promoteEvent,
  retuneCompleteEvent,
  retuneStep,
  retuningOnceVerified,
} from '../cycle/retuning';
import { Timeframe } from '../cycle/slot';
import {
  CYCLE_MANIFEST_JOB,
  CYCLE_READY_JOB,
  CYCLE_READY_QUEUE,
  LANE_JOB_OPTIONS,
  MARKET_DATA_QUEUE,
  cycleReadyJobId,
  manifestRecheckJobId,
} from './cycle-queues';

/** What the controller enqueues, and what a re-check carries forward. */
export interface CycleManifestJobData {
  manifest: CycleManifest;
  /** Unix seconds, gateway clock, when the manifest arrived (market_cycles.manifest_received_at). */
  receivedAt: number;
  /** How many times this manifest has been looked at again; absent on the first look. */
  checks?: number;
}

/** The cycle-ready signal: what build step 3's sensor worker is told. */
export interface CycleReadyJobData {
  symbol: string;
  slot: number;
  readyAt: number;
  attempts: number;
  dataStatus: CycleDataStatus;
  closedBarsDigest: string;
  /**
   * Whether the cycle is RETUNING (rule 9, ADR-015): a promote has happened and
   * the re-pushed window is not yet complete, so the window mixes old and new
   * tuning and sensors report CAUTIONARY. Same value as market_cycles.retuning.
   */
  retuning: boolean;
}

/** The RETUNING verdict for one look at a manifest, and what it was reached from. */
interface RetuneContext {
  step: RetuneStep;
  /** The latest cycle before this one: what the manifest was compared with. Null for the first cycle. */
  previous: PreviousCycle | null;
  /**
   * A newer cycle is already recorded: this manifest arrived behind it (the
   * sender delivers newest slot first, so a retried older one can). It still
   * gets its own flag, but writes no events: the newer manifest has already
   * been judged against the cycles before it, and a second PROMOTE for one
   * physical promote would be a false record.
   */
  late: boolean;
  /**
   * What the gateway counted in the window of this slot: set only for a RETUNING
   * that continues from the cycle before, and null when there was no promote to
   * measure against (retuning.ts, rule 4).
   */
  window: WindowCount | null;
}

/** The columns of an earlier cycle the RETUNING rules read (retuning.ts). */
const PREVIOUS_CYCLE_COLUMNS = {
  slot: true,
  terminal_id: true,
  config_hashes: true,
  source_modes: true,
  retuning: true,
} as const;

export type ManifestOutcome =
  | 'ready'
  | 'waiting'
  | 'incomplete'
  | 'already-ready'
  | 'already-incomplete';

/**
 * Handles one cycle manifest (ADR-009): persist it, check it against what landed,
 * and either write the cycle as READY and announce it once, wait and look again,
 * or give up and record why.
 *
 * Runs inside MarketDataProcessor's single wildcard handler, so it executes
 * strictly after every job queued before it (see cycle-queues.ts). Every step is
 * safe to repeat, because Bull may run a job again after a failure and the sender
 * may deliver the same manifest twice:
 *
 *   - the PENDING row is inserted ON CONFLICT DO NOTHING on (symbol, slot);
 *   - a row that is no longer PENDING is left exactly as it is, and announces
 *     nothing;
 *   - the cycle-ready job is keyed by the slot, and the PENDING -> READY
 *     transition is a conditional update, so only one call can complete it.
 */
@Injectable()
export class CycleManifestService {
  private readonly logger = new Logger(CycleManifestService.name);

  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue(MARKET_DATA_QUEUE) private readonly syncQueue: Queue,
    @InjectQueue(CYCLE_READY_QUEUE) private readonly readyQueue: Queue
  ) {}

  async handle(
    job: Job<CycleManifestJobData>,
    nowSec: number = Math.floor(Date.now() / 1000)
  ): Promise<{ outcome: ManifestOutcome }> {
    const { manifest, receivedAt, checks = 0 } = job.data;
    const key = { symbol: manifest.symbol, slot: manifest.slot };

    await this.prisma.marketCycle.createMany({
      data: [pendingCycleRow(manifest, receivedAt)],
      skipDuplicates: true,
    });
    const row = await this.prisma.marketCycle.findUnique({
      where: { symbol_slot: key },
      select: { state: true },
    });
    if (!row) {
      // Not reachable unless the table is not what the schema says: loud, and retried.
      throw new Error(
        `market_cycles has no row for ${key.symbol} ${key.slot} right after inserting it`
      );
    }
    if (row.state !== 'PENDING') {
      return {
        outcome: row.state === 'READY' ? 'already-ready' : 'already-incomplete',
      };
    }

    // Judged on every look, from the same earlier cycles, so a re-check or a
    // retried job reaches the same verdict and the writes below can repeat. The
    // one input that moves between looks is the window count (Option A). It
    // falls as rows are re-pushed; it can rise only if a delayed retry of a
    // pre-promote row job lands late and overwrites a re-pushed row, which is
    // then honestly pre-promote again. Either way the READY commit below uses
    // the verdict of the look that declared the cycle.
    const retune = await this.judgeRetuning(manifest);
    if (retune.step.promote && !retune.late) {
      await this.writeEvent(
        promoteEvent(manifest, retune.step.promote, retune.previous!)
      );
      this.logger.log(
        `Promote detected at ${key.symbol} ${key.slot}: ` +
          JSON.stringify(retune.step.promote)
      );
    }
    if (retune.step.retuning) {
      // Written now, not only at READY: a row that never gets that far (its job
      // exhausted its retries) must still tell the next manifest it was RETUNING.
      await this.prisma.marketCycle.updateMany({
        where: { ...key, state: 'PENDING' },
        data: { retuning: true },
      });
    }

    const ageSec = Math.max(0, nowSec - receivedAt);
    const slotAgeSec = nowSec - manifest.slot;

    // A stale manifest is decided without touching the data tables.
    const counts =
      slotAgeSec > MANIFEST_THRESHOLDS.staleManifestAfterSec
        ? {}
        : await this.landedCounts(manifest);
    const decision = decideManifest({ manifest, counts, ageSec, slotAgeSec });

    if (decision.action === 'wait') {
      await this.syncQueue.add(
        CYCLE_MANIFEST_JOB,
        { ...job.data, checks: checks + 1 },
        {
          ...LANE_JOB_OPTIONS,
          jobId: manifestRecheckJobId(key.symbol, key.slot, checks + 1),
          delay: MANIFEST_THRESHOLDS.recheckDelayMs,
        }
      );
      return { outcome: 'waiting' };
    }

    if (decision.action === 'incomplete') {
      await this.prisma.marketCycle.updateMany({
        where: { ...key, state: 'PENDING' },
        data: {
          state: 'INCOMPLETE',
          check_detail: asJson(decision.detail),
          // Never verified, so a RETUNING it continues is not over.
          retuning: retune.step.retuning,
        },
      });
      this.logger.warn(
        `Cycle ${key.symbol} ${key.slot} INCOMPLETE (${decision.reason}); ` +
          JSON.stringify(decision.detail.timeframes)
      );
      return { outcome: 'incomplete' };
    }

    return this.declareReady(manifest, decision.detail, nowSec, retune);
  }

  /**
   * Rules 1 to 4 of retuning.ts for this manifest, from the earlier cycles in
   * the table (of any state: what a cycle said about its terminal and tuning is
   * a fact about the sender, whether or not its rows landed) and, while a
   * RETUNING carries on, from what is in the window right now (Option A).
   */
  private async judgeRetuning(manifest: CycleManifest): Promise<RetuneContext> {
    const { symbol, slot } = manifest;
    const previous = await this.previousCycle(symbol, slot);
    let step = retuneStep(manifest, previous);
    let window: WindowCount | null = null;
    if (continuesRetuning(step)) {
      // The only case that needs the count: one query, and only while RETUNING.
      window = await this.countWindow(manifest);
      step = retuneStep(manifest, previous, window);
    }
    // Only worth a query when there is an event to write.
    const late =
      step.promote || step.completesWhenVerified
        ? await this.hasNewerCycle(symbol, slot)
        : false;
    return { step, previous, late, window };
  }

  /**
   * How many M5 rows of the window still hold pre-promote values (ADR-015,
   * Option A): those whose `cycle_id` is older than the cycle of the latest
   * promote at or before this slot. Null when no such promote can be found, which
   * the rules read as "not counted", never as 0.
   */
  private async countWindow(
    manifest: CycleManifest
  ): Promise<WindowCount | null> {
    const { symbol, slot } = manifest;
    const promote = await this.prisma.cycleEvent.findFirst({
      where: {
        symbol,
        event_type: PROMOTE_EVENT,
        effective_slot: { lte: slot },
      },
      orderBy: { effective_slot: 'desc' },
      select: { effective_slot: true },
    });
    const promoteCycle = promote
      ? await this.prisma.marketCycle.findUnique({
          where: { symbol_slot: { symbol, slot: promote.effective_slot } },
          select: { m5_collection_cycle_id: true },
        })
      : null;
    const promoteCycleId = promoteCycle?.m5_collection_cycle_id ?? null;
    if (!promote || promoteCycleId === null) {
      this.logger.warn(
        `Cycle ${symbol} ${slot} continues a RETUNING but no promote cycle id ` +
          `can be found to measure the window against; it stays RETUNING`
      );
      return null;
    }
    const oldRows = await this.prisma.marketDataV6.count({
      where: preTuningBarsWhere(symbol, slot, promoteCycleId),
    });
    return {
      promoteSlot: promote.effective_slot,
      promoteCycleId,
      oldRows,
    };
  }

  /** The latest cycle before the slot, whatever its state. */
  private previousCycle(
    symbol: string,
    slot: number
  ): Promise<PreviousCycle | null> {
    return this.prisma.marketCycle.findFirst({
      where: { symbol, slot: { lt: slot } },
      orderBy: { slot: 'desc' },
      select: PREVIOUS_CYCLE_COLUMNS,
    });
  }

  private async hasNewerCycle(symbol: string, slot: number): Promise<boolean> {
    const newer = await this.prisma.marketCycle.findFirst({
      where: { symbol, slot: { gt: slot } },
      select: { slot: true },
    });
    return newer !== null;
  }

  /** Append an event; a repeat of the same event (same dedupe_key) writes nothing. */
  private async writeEvent(event: CycleEventRow): Promise<void> {
    await this.prisma.cycleEvent.createMany({
      data: [{ ...event, detail: asJson(event.detail) }],
      skipDuplicates: true,
    });
  }

  /** What the gateway can find, per timeframe the manifest describes. */
  private async landedCounts(
    manifest: CycleManifest
  ): Promise<Partial<Record<Timeframe, LandedCount>>> {
    const counts: Partial<Record<Timeframe, LandedCount>> = {};
    for (const timeframe of listTimeframes(manifest)) {
      const section = manifest.timeframes[timeframe]!;
      counts[timeframe] = {
        bars: await this.prisma.marketDataV6.count({
          where: {
            symbol: manifest.symbol,
            timeframe,
            timestamp: {
              gte: section.oldest_bar_ts,
              lte: section.newest_bar_ts,
            },
          },
        }),
        statistics: await this.prisma.indicatorStatistic.count({
          where: {
            symbol: manifest.symbol,
            timeframe,
            captured_at: manifest.slot,
          },
        }),
        // Which cycle wrote the newest row. A count cannot tell this cycle's
        // version of it from an older cycle's copy (windows overlap), and the
        // newest row is the one that changes every cycle.
        newestCycleId: await this.newestRowCycleId(
          manifest.symbol,
          timeframe,
          section.newest_bar_ts
        ),
      };
    }
    return counts;
  }

  private async newestRowCycleId(
    symbol: string,
    timeframe: Timeframe,
    timestamp: number
  ): Promise<number | null> {
    const row = await this.prisma.marketDataV6.findUnique({
      where: { symbol_timeframe_timestamp: { symbol, timeframe, timestamp } },
      select: { cycle_id: true },
    });
    return row ? row.cycle_id : null;
  }

  private async declareReady(
    manifest: CycleManifest,
    detail: CheckDetail | null,
    nowSec: number,
    retune: RetuneContext
  ): Promise<{ outcome: ManifestOutcome }> {
    const { symbol, slot } = manifest;
    const attempts = cycleAttempts(manifest);
    // Never before the slot itself: a gateway clock a little behind the VPS must
    // not produce a negative slot-to-ready time (cycleStatus refuses one).
    const readyAt = Math.max(nowSec, slot);
    const dataStatus = cycleStatus({ slot, readyAt, attempts });

    const closedBarsDigest = digestClosedSpine(
      await loadClosedSpine(closedBarsFetcher(this.prisma, symbol), slot)
    );

    // This is the verified manifest: it ends a RETUNING whose window is re-pushed.
    const retuning = retuningOnceVerified(retune.step);

    // Everything the cycle owes the record is written BEFORE the PENDING -> READY
    // update below, because that update is the commit point: once it has happened
    // a retried job finds a READY row and returns early, so an event not yet
    // written by then would never be. The event is idempotent on its dedupe_key.
    if (retune.step.completesWhenVerified && !retune.late) {
      // completesWhenVerified is only ever true with a count in hand.
      await this.writeEvent(retuneCompleteEvent(manifest, retune.window!));
      this.logger.log(`Retune complete at ${symbol} ${slot}`);
    }

    // Announce first, mark ready second. If the second step fails the whole job
    // is retried and announces again under the same job id, which Bull ignores
    // while the first is still there. The other order could mark a cycle READY
    // and never announce it, and nothing would ever notice.
    const payload: CycleReadyJobData = {
      symbol,
      slot,
      readyAt,
      attempts,
      dataStatus,
      closedBarsDigest,
      retuning,
    };
    await this.readyQueue.add(CYCLE_READY_JOB, payload, {
      ...LANE_JOB_OPTIONS,
      jobId: cycleReadyJobId(symbol, slot),
    });

    const { count } = await this.prisma.marketCycle.updateMany({
      where: { symbol, slot, state: 'PENDING' },
      data: {
        state: 'READY',
        data_status: dataStatus,
        ready_at: readyAt,
        closed_bars_digest: closedBarsDigest,
        retuning,
        ...(detail ? { check_detail: asJson(detail) } : {}),
      },
    });
    this.logger.log(
      `Cycle ${symbol} ${slot} READY (${dataStatus}, ${readyAt - slot}s after the slot` +
        `${detail ? `, ${detail.reason}` : ''}${retuning ? ', RETUNING' : ''}` +
        `${retune.window ? `, ${retune.window.oldRows} pre-promote M5 bars left in the window` : ''})` +
        `${count === 0 ? ' [already marked]' : ''}`
    );
    return { outcome: 'ready' };
  }
}

/** Prisma's JSON columns want a plain JSON value, not a class instance. */
function asJson(value: CheckDetail | Record<string, unknown>): object {
  return JSON.parse(JSON.stringify(value)) as object;
}
