/**
 * Read what the offer check needs from the market database about a cycle
 * (architecture 6.4, ADR-059): the synthesis reading Report 1 used (the
 * PINNED cycle), the newest reading of the same profile, the pinned reading's
 * entry zones, the newest price, and the newest ready cycle.
 *
 * - The pinned reading is the one for `pinnedSlot`; without a `pinnedSlot`
 *   (Report 1 is about to be made) the newest reading is the pinned one.
 * - `newest` is the newest reading of the profile, and only when it is from a
 *   LATER cycle than the pinned one; `checkOffer` decides whether it changed.
 * - The price is the newest reading's `reference_price`: the close of the last
 *   closed M5 bar (ADR-086), so it can be five minutes old (assumption A2).
 * - The zones are all-or-nothing, like the structure levels: if any row of
 *   `entry_zones` is unreadable, or the rows are not as many as the reading's
 *   `zone_count`, there are NO zones and the problem says why, so the offer
 *   check answers `NO_ZONES` rather than offering from a partial set.
 * - The live data status is NOT read here. `market_cycles.data_status` is
 *   only FRESH or DELAYED; STALE and MARKET_CLOSED are computed by the gateway
 *   on every read, and Engine 4 asks the gateway (`GET /api/v1/cycles/current`)
 *   rather than keep a second copy of its market-hours rules.
 *
 * Nothing here throws for a database error: each failed read is a problem and
 * a null, and the offer check fails closed on the nulls.
 *
 * @module lib/engine4/read/cycle
 */

import { marketPrisma } from '@/lib/db/market-prisma';

import type { OfferSynthesis } from '../offer';
import { readSeconds } from '../time';
import { Engine4InputError } from '../types';
import { zoneFromEntryRow, type ZoneInput } from '../zone';

const DEFAULT_SYMBOL = 'XAUUSD';
const PROFILES: readonly string[] = ['DAY_TRADER', 'SCALPER'];

/** The columns of a `synthesis_readings` row this reader uses. */
export interface SynthesisRow {
  cycle_slot: number;
  bias: string;
  status: string;
  status_reasons: string[];
  trend_relation: string | null;
  rule_id: string;
  branch_id: string | null;
  retuning_observed: boolean;
  reference_price: number | null;
  zone_count: number;
  flag: string;
}

/** The columns of an `entry_zones` row this reader uses. */
export interface EntryZoneRow {
  zone_id: string;
  rank: number;
  bias: string;
  low: number;
  high: number;
  reference_price: number;
  invalidation_price: number;
  invalidation_basis: string;
  stop_distance: number;
  next_opposing_price: number | null;
  runway: number | null;
  runway_ratio: number | null;
  levels: unknown;
}

/** The columns of a `market_cycles` row this reader uses. */
export interface CycleRow {
  slot: number;
  data_status: string | null;
  retuning: boolean;
  ready_at: number | null;
}

/** The delegates of `marketPrisma` this reader calls: the real ones fit with no cast; a test passes its own. */
export interface CycleClient {
  marketCycle: {
    findFirst(args: {
      where: { symbol: string; state: 'READY' };
      orderBy: { slot: 'desc' };
      select: Record<keyof CycleRow, true>;
    }): Promise<CycleRow | null>;
  };
  synthesisReading: {
    findFirst(args: {
      where: { symbol: string; profile: string; cycle_slot?: number };
      orderBy: { cycle_slot: 'desc' };
      select: Record<keyof SynthesisRow, true>;
    }): Promise<SynthesisRow | null>;
  };
  entryZone: {
    findMany(args: {
      where: { symbol: string; profile: string; cycle_slot: number };
      orderBy: { rank: 'asc' };
      select: Record<keyof EntryZoneRow, true>;
    }): Promise<EntryZoneRow[]>;
  };
}

export interface OfferSnapshotRequest {
  /** DAY_TRADER or SCALPER: the trader's type, which selects the synthesis profile */
  profile: string;
  /** the cycle Report 1 used; absent when Report 1 is about to be made */
  pinnedSlot?: number;
  symbol?: string;
}

export type OfferReadProblemCode =
  | 'DATABASE_ERROR'
  | 'NO_READING'
  | 'PINNED_READING_MISSING'
  | 'READING_UNREADABLE'
  | 'ZONES_UNREADABLE'
  | 'ZONE_COUNT_MISMATCH';

export interface OfferReadProblem {
  code: OfferReadProblemCode;
  detail: string;
}

export interface CycleFacts {
  slot: bigint;
  /** FRESH or DELAYED as stored when the cycle was written: never STALE or MARKET_CLOSED */
  storedDataStatus: string | null;
  retuning: boolean;
  readyAt: bigint | null;
}

export interface OfferSnapshot {
  pinned: OfferSynthesis | null;
  /** the newest reading, when it is from a later cycle than the pinned one */
  newest: OfferSynthesis | null;
  /** the pinned reading's zones, rank order; empty when any was unreadable or missing */
  zones: ZoneInput[];
  /** the newest reading's reference price (A2); null when there is none */
  price: number | null;
  /** the pinned reading's SYN flag (shadow or live), for the caller to judge */
  flag: string | null;
  /** the newest ready cycle, for the caller's own comparisons */
  cycle: CycleFacts | null;
  problems: OfferReadProblem[];
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : 'unknown error';
}

/** A row of `synthesis_readings` as the offer check takes it, or null when a value is not what the column holds. */
function toOfferSynthesis(row: SynthesisRow): OfferSynthesis | null {
  const reasons: unknown = row.status_reasons;
  if (
    typeof row.bias !== 'string' ||
    typeof row.status !== 'string' ||
    !Array.isArray(reasons) ||
    !reasons.every((reason: unknown) => typeof reason === 'string') ||
    (row.trend_relation !== null && typeof row.trend_relation !== 'string') ||
    typeof row.rule_id !== 'string' ||
    (row.branch_id !== null && typeof row.branch_id !== 'string') ||
    typeof row.retuning_observed !== 'boolean'
  ) {
    return null;
  }
  try {
    readSeconds('cycle_slot', row.cycle_slot);
  } catch {
    return null;
  }
  return {
    cycleSlot: row.cycle_slot,
    bias: row.bias,
    status: row.status,
    statusReasons: reasons as string[],
    trendRelation: row.trend_relation,
    ruleId: row.rule_id,
    branchId: row.branch_id,
    retuning: row.retuning_observed,
  };
}

const SYNTHESIS_SELECT = {
  cycle_slot: true,
  bias: true,
  status: true,
  status_reasons: true,
  trend_relation: true,
  rule_id: true,
  branch_id: true,
  retuning_observed: true,
  reference_price: true,
  zone_count: true,
  flag: true,
} as const;

export async function readOfferSnapshot(
  request: OfferSnapshotRequest,
  client: CycleClient = {
    marketCycle: marketPrisma.marketCycle,
    synthesisReading: marketPrisma.synthesisReading,
    entryZone: marketPrisma.entryZone,
  }
): Promise<OfferSnapshot> {
  if (!PROFILES.includes(request.profile)) {
    throw new Engine4InputError(
      'BAD_OPTION',
      'profile is not DAY_TRADER or SCALPER',
      'profile'
    );
  }
  if (request.pinnedSlot !== undefined) {
    readSeconds('pinnedSlot', request.pinnedSlot);
  }
  const symbol = request.symbol ?? DEFAULT_SYMBOL;
  const problems: OfferReadProblem[] = [];
  const problem = (code: OfferReadProblemCode, detail: string): void => {
    problems.push({ code, detail });
  };

  // -- the newest reading of the profile: the newest price, and the candidate for a refresh --
  let newestRow: SynthesisRow | null = null;
  try {
    newestRow = await client.synthesisReading.findFirst({
      where: { symbol, profile: request.profile },
      orderBy: { cycle_slot: 'desc' },
      select: SYNTHESIS_SELECT,
    });
    if (newestRow === null) {
      problem('NO_READING', 'there is no synthesis reading for this profile');
    }
  } catch (error) {
    problem(
      'DATABASE_ERROR',
      `the newest synthesis reading could not be read: ${messageOf(error)}`
    );
  }

  // -- the pinned reading ------------------------------------------------------------------
  let pinnedRow: SynthesisRow | null = newestRow;
  if (request.pinnedSlot !== undefined) {
    pinnedRow = null;
    try {
      pinnedRow = await client.synthesisReading.findFirst({
        where: {
          symbol,
          profile: request.profile,
          cycle_slot: request.pinnedSlot,
        },
        orderBy: { cycle_slot: 'desc' },
        select: SYNTHESIS_SELECT,
      });
      if (pinnedRow === null) {
        problem(
          'PINNED_READING_MISSING',
          `there is no synthesis reading for cycle ${request.pinnedSlot}`
        );
      }
    } catch (error) {
      problem(
        'DATABASE_ERROR',
        `the pinned synthesis reading could not be read: ${messageOf(error)}`
      );
    }
  }
  const pinned = pinnedRow === null ? null : toOfferSynthesis(pinnedRow);
  if (pinnedRow !== null && pinned === null) {
    problem(
      'READING_UNREADABLE',
      'the pinned synthesis reading is not well formed'
    );
  }

  // -- the newest reading, when it is a later cycle ------------------------------------------
  let newest: OfferSynthesis | null = null;
  if (
    request.pinnedSlot !== undefined &&
    newestRow !== null &&
    newestRow.cycle_slot > request.pinnedSlot
  ) {
    newest = toOfferSynthesis(newestRow);
    if (newest === null) {
      problem(
        'READING_UNREADABLE',
        'the newest synthesis reading is not well formed'
      );
    }
  }

  // -- the pinned reading's zones: all or none ------------------------------------------------
  let zones: ZoneInput[] = [];
  if (pinnedRow !== null) {
    try {
      const rows = await client.entryZone.findMany({
        where: {
          symbol,
          profile: request.profile,
          cycle_slot: pinnedRow.cycle_slot,
        },
        orderBy: { rank: 'asc' },
        select: {
          zone_id: true,
          rank: true,
          bias: true,
          low: true,
          high: true,
          reference_price: true,
          invalidation_price: true,
          invalidation_basis: true,
          stop_distance: true,
          next_opposing_price: true,
          runway: true,
          runway_ratio: true,
          levels: true,
        },
      });
      const read = rows.map((row) => zoneFromEntryRow(row));
      if (read.some((zone) => zone === null)) {
        problem('ZONES_UNREADABLE', 'an entry zone row is not well formed');
      } else if (read.length !== pinnedRow.zone_count) {
        problem(
          'ZONE_COUNT_MISMATCH',
          `the reading has ${pinnedRow.zone_count} zones and ${read.length} were found`
        );
      } else {
        zones = read as ZoneInput[];
      }
    } catch (error) {
      problem(
        'DATABASE_ERROR',
        `the entry zones could not be read: ${messageOf(error)}`
      );
    }
  }

  // -- the newest ready cycle ------------------------------------------------------------------
  let cycle: CycleFacts | null = null;
  try {
    const row = await client.marketCycle.findFirst({
      where: { symbol, state: 'READY' },
      orderBy: { slot: 'desc' },
      select: { slot: true, data_status: true, retuning: true, ready_at: true },
    });
    if (row !== null) {
      cycle = {
        slot: readSeconds('slot', row.slot),
        storedDataStatus: row.data_status,
        retuning: row.retuning,
        readyAt:
          row.ready_at === null ? null : readSeconds('ready_at', row.ready_at),
      };
    }
  } catch (error) {
    problem(
      'DATABASE_ERROR',
      `the newest cycle could not be read: ${messageOf(error)}`
    );
  }

  return {
    pinned,
    newest,
    zones,
    price: newestRow === null ? null : newestRow.reference_price,
    flag: pinnedRow === null ? null : pinnedRow.flag,
    cycle,
    problems,
  };
}
