import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CycleReaderService } from '../read/cycle-reader.service';
import { TIMEFRAMES, Timeframe, isSlot, isTimeframe, slotOf } from '../slot';
import {
  ChannelSource,
  MAX_REASON_LENGTH,
  MAX_SCHEDULE_AHEAD_SEC,
  MAX_SET_BY_LENGTH,
  isChannelSource,
} from './channel-sources';

/** One row of `active_indicator_settings`, as the resolver reports it. */
export interface ActiveIndicator {
  readonly settingId: string;
  readonly timeframe: Timeframe;
  readonly source: ChannelSource;
  /** The setting applies to every slot at or after this one. */
  readonly effectiveSlot: number;
  readonly setBy: string;
  readonly reason: string | null;
  /** Unix seconds the row was written. */
  readonly createdAt: number;
}

export interface SetActiveIndicatorInput {
  readonly timeframe: Timeframe;
  readonly source: ChannelSource;
  /** The first slot the new source applies to: a slot boundary in the future. */
  readonly effectiveSlot: number;
  /** Who is changing it: an admin's id or email. Recorded, never inferred. */
  readonly setBy: string;
  readonly reason?: string | null;
}

export type RefusalReason =
  | 'UNKNOWN_TIMEFRAME'
  | 'UNKNOWN_SOURCE'
  | 'SLOT_NOT_ON_BOUNDARY'
  | 'SLOT_NOT_FUTURE'
  | 'SLOT_TOO_FAR'
  | 'MISSING_SET_BY'
  | 'SET_BY_TOO_LONG'
  | 'REASON_TOO_LONG';

export type SetActiveIndicatorResult =
  | { readonly status: 'SET'; readonly setting: ActiveIndicator }
  | {
      readonly status: 'REFUSED';
      readonly reason: RefusalReason;
      readonly detail: string;
    };

export const SETTING_COLUMNS = {
  id: true,
  timeframe: true,
  source: true,
  effective_slot: true,
  set_by: true,
  reason: true,
  createdAt: true,
} as const;

interface SettingRow {
  id: string;
  timeframe: string;
  source: string;
  effective_slot: number;
  set_by: string;
  reason: string | null;
  createdAt: Date;
}

function toActiveIndicator(row: SettingRow): ActiveIndicator {
  return {
    settingId: row.id,
    timeframe: row.timeframe as Timeframe,
    source: row.source as ChannelSource,
    effectiveSlot: row.effective_slot,
    setBy: row.set_by,
    reason: row.reason,
    createdAt: Math.floor(row.createdAt.getTime() / 1000),
  };
}

/**
 * The active-indicator setting (STACK-D-ARCHITECTURE.md rule 6, ADR-010): ONE
 * channel indicator per timeframe, effective from a named slot, for MCDs, chart
 * and UI together.
 *
 * WHY EVERY CONSUMER FLIPS AT THE SAME TIME. The setting is a step function of the
 * CYCLE'S SLOT, never of a clock: `resolveActiveIndicator(timeframe, slot)` answers
 * for a slot, and every consumer asks about the slot of the cycle it is working on
 * (the sensor worker the cycle-ready job's slot, the renderer and the UI the newest
 * READY cycle's slot, as `GET /api/v1/cycles/current` reports it). A setting
 * effective from slot T therefore applies to the first cycle at or after T and to
 * no earlier one, for every consumer, and a replay of a slot before T gets the
 * source that was active then.
 *
 * APPEND ONLY. A change is a new row; nothing here updates or deletes one
 * (test/active-indicator.spec.ts reads the source to keep it so). Two rows for the
 * same (timeframe, effective slot) are resolved by who wrote last, which is also how
 * a scheduled change is cancelled: write the old source again for that slot.
 *
 * AUDITED. Every row says who set it (`set_by`), why (`reason`) and when
 * (`createdAt`); `listSettings` returns the whole history, and the setter logs.
 */
@Injectable()
export class ActiveIndicatorService {
  private readonly logger = new Logger(ActiveIndicatorService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly cycles: CycleReaderService
  ) {}

  /**
   * The setting in force at a slot: the row with the greatest `effective_slot` at
   * or before it. Null when the timeframe has no setting at all (the migration's
   * starting rows are missing): a consumer must treat that as "unknown", not guess.
   */
  async resolveActiveIndicator(
    timeframe: Timeframe,
    slot: number
  ): Promise<ActiveIndicator | null> {
    if (!isTimeframe(timeframe)) {
      throw new RangeError(`unsupported timeframe: ${String(timeframe)}`);
    }
    if (!isSlot(slot)) {
      throw new RangeError(
        `slot must be a unix time on a 5-minute boundary, got ${String(slot)}`
      );
    }
    const row = await this.prisma.activeIndicatorSetting.findFirst({
      where: { timeframe, effective_slot: { lte: slot } },
      orderBy: [
        { effective_slot: 'desc' },
        { createdAt: 'desc' },
        { id: 'desc' },
      ],
      select: SETTING_COLUMNS,
    });
    return row ? toActiveIndicator(row) : null;
  }

  /** Both timeframes at one slot: what the current-cycle endpoint and the sensor-input loader read. */
  async resolveAll(
    slot: number
  ): Promise<Record<Timeframe, ActiveIndicator | null>> {
    const out = {} as Record<Timeframe, ActiveIndicator | null>;
    for (const timeframe of TIMEFRAMES) {
      out[timeframe] = await this.resolveActiveIndicator(timeframe, slot);
    }
    return out;
  }

  /**
   * The slot a new setting must come AFTER: the later of the current wall-clock slot
   * and the newest READY cycle's slot. A setting effective at or before it could change what a
   * consumer has already been told for a slot it has already served.
   */
  async earliestSettableSlot(now: number): Promise<number> {
    const newest = await this.cycles.getNewestReadyCycle();
    return Math.max(slotOf(now), newest ? newest.slot : 0) + 300;
  }

  /**
   * Append a setting. Refuses, with a reason and without writing, anything that is
   * not a slot in the future (see earliestSettableSlot), not on a slot boundary,
   * more than a week ahead, or for a source or timeframe that does not exist.
   */
  async setActiveIndicator(
    input: SetActiveIndicatorInput,
    now: number = Math.floor(Date.now() / 1000)
  ): Promise<SetActiveIndicatorResult> {
    const refuse = (
      reason: RefusalReason,
      detail: string
    ): SetActiveIndicatorResult => ({ status: 'REFUSED', reason, detail });

    if (!isTimeframe(input.timeframe)) {
      return refuse(
        'UNKNOWN_TIMEFRAME',
        `unknown timeframe ${String(input.timeframe)}`
      );
    }
    if (!isChannelSource(input.source)) {
      return refuse(
        'UNKNOWN_SOURCE',
        `unknown channel source ${String(input.source)}`
      );
    }
    if (typeof input.setBy !== 'string' || input.setBy.trim() === '') {
      return refuse('MISSING_SET_BY', 'a setting must say who set it');
    }
    if (input.setBy.length > MAX_SET_BY_LENGTH) {
      return refuse(
        'SET_BY_TOO_LONG',
        `set_by is longer than ${MAX_SET_BY_LENGTH} characters`
      );
    }
    if (input.reason != null && input.reason.length > MAX_REASON_LENGTH) {
      return refuse(
        'REASON_TOO_LONG',
        `reason is longer than ${MAX_REASON_LENGTH} characters`
      );
    }
    if (
      !Number.isInteger(input.effectiveSlot) ||
      !isSlot(input.effectiveSlot)
    ) {
      return refuse(
        'SLOT_NOT_ON_BOUNDARY',
        `effective slot must be a unix time on a 5-minute boundary, got ${String(input.effectiveSlot)}`
      );
    }
    const earliest = await this.earliestSettableSlot(now);
    if (input.effectiveSlot < earliest) {
      return refuse(
        'SLOT_NOT_FUTURE',
        `effective slot ${input.effectiveSlot} is not in the future: the earliest slot that can still be set is ${earliest}`
      );
    }
    if (input.effectiveSlot > now + MAX_SCHEDULE_AHEAD_SEC) {
      return refuse(
        'SLOT_TOO_FAR',
        `effective slot ${input.effectiveSlot} is more than ${MAX_SCHEDULE_AHEAD_SEC} s ahead`
      );
    }

    const created = await this.prisma.activeIndicatorSetting.create({
      data: {
        timeframe: input.timeframe,
        source: input.source,
        effective_slot: input.effectiveSlot,
        set_by: input.setBy.trim(),
        reason: input.reason ?? null,
      },
      select: SETTING_COLUMNS,
    });
    const setting = toActiveIndicator(created);
    this.logger.log(
      `Active indicator ${setting.timeframe} -> ${setting.source} from slot ${setting.effectiveSlot} ` +
        `(set by ${setting.setBy}${setting.reason ? `: ${setting.reason}` : ''})`
    );
    return { status: 'SET', setting };
  }

  /** The audit trail: every setting ever written, newest effective slot first. */
  async listSettings(
    options: { timeframe?: Timeframe; limit?: number } = {}
  ): Promise<ActiveIndicator[]> {
    const limit = Math.min(Math.max(options.limit ?? 100, 1), 500);
    const rows = await this.prisma.activeIndicatorSetting.findMany({
      where: options.timeframe ? { timeframe: options.timeframe } : {},
      orderBy: [
        { effective_slot: 'desc' },
        { createdAt: 'desc' },
        { id: 'desc' },
      ],
      take: limit,
      select: SETTING_COLUMNS,
    });
    return rows.map(toActiveIndicator);
  }
}
