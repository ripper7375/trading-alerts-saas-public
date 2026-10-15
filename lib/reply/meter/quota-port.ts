/**
 * The quota port of the gate, and the meter a request holds its units with (build step 7 part 6;
 * architecture 4.2 step 1, 5.6 and 7.3; ADR-050, ADR-072, ADR-073; decisions D2, D3 and D4;
 * acceptance item 5.14 (2)).
 *
 * TWO THINGS LIVE HERE, BOTH OVER ONE `LedgerPort`:
 *
 * 1. `createQuotaPort` is the gate's sixth check (`QuotaPort`, replacing the pass-through of step 6).
 *    It is a PRE-check: it reserves and charges nothing. It asks for the trader's allowance
 *    (`allowanceOf`: units a month for a tier that has the live analyst; none for one that does not;
 *    `null` while `PRO_MONTHLY_UNITS` is unset, which refuses everything, decision D4), reads the
 *    balance, and lets the request through only when the balance reaches the FLOOR, the smallest a
 *    request could cost (`floorUnits`). An empty account is therefore refused before the Understand
 *    call is paid for. A ledger that cannot be read throws, and the gate turns that into
 *    `FEATURE_UNAVAILABLE`: a failing quota service never lets a request through for free.
 *
 * 2. `createMeter` and `runMetered` are what the orchestrator (part 7) uses around the model calls:
 *    HOLD the worst case (`reserve`, the ladder of `reserve-plan.ts`), make the calls, report each
 *    paid call as it finishes, then SETTLE for what was spent, or RELEASE when nothing was. The
 *    hold is granted or refused by the ledger's one atomic statement; when it is refused the model
 *    is NEVER called (5.14 item 2: the model port's call count is zero). A request that fails
 *    after a model call still settles for what was spent; one that fails before any call gives
 *    its units back; one that throws is settled or released first and the error is passed on. The
 *    reply that was paid for is never lost to a ledger error after the call: `runMetered` returns
 *    the value with the settlement's outcome beside it, and the reaper gives back what a crashed
 *    request left held.
 *
 * Pure of I/O: the ledger, the clock and the allowance are all injected; nothing here reads the
 * environment, the network, a database or the time.
 *
 * @module lib/reply/meter/quota-port
 */

import type { QuotaPort, QuotaRequest, RequestKind } from '../contracts/intake';

import { MIN_FLOOR_UNITS, type RequestEstimate } from './estimate';
import {
  reservationLadder,
  summarizeSpend,
  type Spend,
  type SpentCall,
} from './reserve-plan';

// ---------------------------------------------------------------------------
// The ledger, as the meter sees it
// ---------------------------------------------------------------------------

/** A trader's month: `available` is what a new request may still hold. */
export interface Balance {
  limit: number;
  used: number;
  reserved: number;
  available: number;
}

export type ReservationState = 'RESERVED' | 'SETTLED' | 'RELEASED' | 'EXPIRED';

export type LedgerReserve =
  | {
      ok: true;
      /** the request id already had a reservation: nothing more was held */
      replayed: boolean;
      status: ReservationState;
      reservedUnits: number;
      balance: Balance | null;
    }
  | { ok: false; code: 'INSUFFICIENT'; balance: Balance }
  | { ok: false; code: 'REQUEST_ID_TAKEN' | 'USER_NOT_FOUND' | 'BAD_INPUT' };

export type LedgerSettle =
  | {
      ok: true;
      replayed: boolean;
      chargedUnits: number;
      absorbedUnits: number;
      balance: Balance | null;
    }
  | { ok: false; code: 'NOT_FOUND' | 'ALREADY_RELEASED' | 'BAD_INPUT' };

export type LedgerRelease =
  | { ok: true; changed: boolean; status: ReservationState }
  | { ok: false; code: 'NOT_FOUND' | 'BAD_INPUT' };

export interface LedgerPort {
  /** the trader's balance this month; a month with no row yet has the whole allowance */
  balance(query: {
    userId: string;
    nowMs: number;
    allowanceUnits: number;
  }): Promise<Balance>;
  reserve(query: {
    requestId: string;
    userId: string;
    units: number;
    nowMs: number;
    expiresAtMs: number;
    allowanceUnits: number;
  }): Promise<LedgerReserve>;
  settle(query: {
    requestId: string;
    userId: string;
    nowMs: number;
    actualUnits: number | null;
    costMicroUsd: number | null;
    model: string | null;
    promptTokens: number | null;
    completionTokens: number | null;
  }): Promise<LedgerSettle>;
  release(query: {
    requestId: string;
    userId: string;
    nowMs: number;
  }): Promise<LedgerRelease>;
}

/** A reservation lives this long before the reaper may give it back: longer than any request deadline. */
export const DEFAULT_RESERVATION_TTL_MS = 10 * 60 * 1000;

export interface MeterConfig {
  ledger: LedgerPort;
  /** the time, in milliseconds since the epoch */
  now: () => number;
  /**
   * Units a month for a tier: `0` for a tier without the live analyst (the Free tier's demo costs
   * nothing and holds nothing), `null` when the allowance is not configured (refuse everything).
   */
  allowanceOf: (tier: string) => number | null;
  /** the smallest balance a request of this kind could be served with */
  floorOf: (kind: RequestKind) => number;
  reservationTtlMs?: number;
}

// ---------------------------------------------------------------------------
// The gate's port
// ---------------------------------------------------------------------------

/** The floor check of the gate: is there balance for the smallest request? Reserves and charges nothing. */
export function createQuotaPort(
  config: Pick<MeterConfig, 'ledger' | 'now' | 'allowanceOf' | 'floorOf'>
): QuotaPort {
  return {
    async precheck(request: QuotaRequest) {
      const allowance = config.allowanceOf(request.tier);
      if (allowance === null || !(allowance > 0)) return { allowed: false };
      const balance = await config.ledger.balance({
        userId: request.userId,
        nowMs: config.now(),
        allowanceUnits: allowance,
      });
      const floor = Math.max(config.floorOf(request.kind), MIN_FLOOR_UNITS);
      return { allowed: balance.available >= floor };
    },
  };
}

// ---------------------------------------------------------------------------
// The meter
// ---------------------------------------------------------------------------

export interface MeterRequest {
  requestId: string;
  userId: string;
  tier: string;
}

export type MeterReserveRefusal =
  /** the tier has no allowance, or `PRO_MONTHLY_UNITS` is not set: nothing is metered, so nothing runs */
  | { ok: false; code: 'NOT_METERED' }
  /** the worst case does not fit the balance (the smallest hold was refused too) */
  | { ok: false; code: 'INSUFFICIENT'; neededUnits: number; balance: Balance }
  /** a call has no price, so it has no worst case; the request is not run */
  | { ok: false; code: 'PRICE_UNKNOWN'; call: 'understand' | 'answer' }
  | { ok: false; code: 'REQUEST_ID_TAKEN' | 'USER_NOT_FOUND' | 'BAD_REQUEST' };

export type MeterReserveResult =
  | {
      ok: true;
      /** the request id had a reservation already (a retry): the caller must not run the model again */
      replayed: boolean;
      status: ReservationState;
      reservedUnits: number;
      /** whether the hold covers one regeneration (decision D11) */
      regenerationAllowed: boolean;
      balance: Balance | null;
    }
  | MeterReserveRefusal;

export type MeterSettleResult =
  | {
      ok: true;
      replayed: boolean;
      chargedUnits: number;
      absorbedUnits: number;
      spend: Spend;
      balance: Balance | null;
    }
  | { ok: false; code: 'NOTHING_SPENT' | 'LEDGER_ERROR' }
  | { ok: false; code: 'NOT_FOUND' | 'ALREADY_RELEASED' | 'BAD_INPUT' };

export type MeterReleaseResult =
  | { ok: true; changed: boolean; status: ReservationState }
  | { ok: false; code: 'NOT_FOUND' | 'BAD_INPUT' | 'LEDGER_ERROR' };

export interface Meter {
  /** Hold the worst case of a request, or refuse. Never calls a model. */
  reserve(
    request: MeterRequest,
    estimate: RequestEstimate
  ): Promise<MeterReserveResult>;
  /** Charge what the calls cost (at least one call). Idempotent on the request id. */
  settle(
    request: MeterRequest,
    calls: readonly SpentCall[]
  ): Promise<MeterSettleResult>;
  /** Give the hold back with no charge: no model was called. */
  release(request: MeterRequest): Promise<MeterReleaseResult>;
}

export function createMeter(config: MeterConfig): Meter {
  const ttl = config.reservationTtlMs ?? DEFAULT_RESERVATION_TTL_MS;

  return {
    async reserve(request, estimate) {
      if (!estimate.ok) {
        return estimate.code === 'PRICE_UNKNOWN'
          ? { ok: false, code: 'PRICE_UNKNOWN', call: estimate.call }
          : { ok: false, code: 'BAD_REQUEST' };
      }
      const allowance = config.allowanceOf(request.tier);
      if (allowance === null || !(allowance > 0)) {
        return { ok: false, code: 'NOT_METERED' };
      }
      let lastBalance: Balance | null = null;
      for (const hold of reservationLadder(estimate)) {
        const nowMs = config.now();
        const granted = await config.ledger.reserve({
          requestId: request.requestId,
          userId: request.userId,
          units: hold.units,
          nowMs,
          expiresAtMs: nowMs + ttl,
          allowanceUnits: allowance,
        });
        if (granted.ok) {
          return {
            ok: true,
            replayed: granted.replayed,
            status: granted.status,
            reservedUnits: granted.reservedUnits,
            // a retry reports what the stored hold covers, not what the rung that found it was
            // (a regeneration that costs nothing is always covered)
            regenerationAllowed:
              granted.reservedUnits >= estimate.withRegenerationUnits,
            balance: granted.balance,
          };
        }
        if (granted.code === 'INSUFFICIENT') {
          lastBalance = granted.balance;
          continue;
        }
        return {
          ok: false,
          code: granted.code === 'BAD_INPUT' ? 'BAD_REQUEST' : granted.code,
        };
      }
      return {
        ok: false,
        code: 'INSUFFICIENT',
        neededUnits: estimate.baseUnits,
        balance: lastBalance as Balance,
      };
    },

    async settle(request, calls) {
      const spend = summarizeSpend(calls);
      if (spend.calls === 0) return { ok: false, code: 'NOTHING_SPENT' };
      const settled = await config.ledger.settle({
        requestId: request.requestId,
        userId: request.userId,
        nowMs: config.now(),
        actualUnits: spend.actualUnits,
        costMicroUsd: spend.costMicroUsd,
        model: spend.model,
        promptTokens: spend.promptTokens,
        completionTokens: spend.completionTokens,
      });
      if (!settled.ok) return settled;
      return {
        ok: true,
        replayed: settled.replayed,
        chargedUnits: settled.chargedUnits,
        absorbedUnits: settled.absorbedUnits,
        spend,
        balance: settled.balance,
      };
    },

    async release(request) {
      return config.ledger.release({
        requestId: request.requestId,
        userId: request.userId,
        nowMs: config.now(),
      });
    },
  };
}

// ---------------------------------------------------------------------------
// A request that holds, runs and settles
// ---------------------------------------------------------------------------

/** What the caller reports as its paid calls finish. */
export interface SpendRecorder {
  record(call: SpentCall): void;
}

export interface GrantedHold {
  reservedUnits: number;
  regenerationAllowed: boolean;
  balance: Balance | null;
}

export type MeteredRun<T> =
  | {
      ok: true;
      value: T;
      /** what became of the hold: a charge, or null when nothing was spent and the units were released */
      settlement: MeterSettleResult | null;
      release: MeterReleaseResult | null;
    }
  | { ok: false; refusal: MeterReserveRefusal }
  /** the request id already had a reservation: the model was not called */
  | { ok: false; duplicate: { status: ReservationState } };

/**
 * Hold, run, settle. `run` is called ONLY when the hold is granted, and it reports each paid call
 * to the recorder as it finishes. Afterwards the hold is settled for the calls recorded, or
 * released when there were none. A thrown error is passed on after the hold is settled or released.
 * A ledger error after the calls does not lose the value: it comes back in `settlement`.
 */
export async function runMetered<T>(
  meter: Meter,
  request: MeterRequest,
  estimate: RequestEstimate,
  run: (hold: GrantedHold, recorder: SpendRecorder) => Promise<T>
): Promise<MeteredRun<T>> {
  const reserved = await meter.reserve(request, estimate);
  if (!reserved.ok) return { ok: false, refusal: reserved };
  if (reserved.replayed) {
    // the request has been here before: running it again would be a second paid call under one charge
    return { ok: false, duplicate: { status: reserved.status } };
  }

  const calls: SpentCall[] = [];
  const recorder: SpendRecorder = {
    record(call) {
      calls.push({ ...call });
    },
  };

  const finish = async (): Promise<{
    settlement: MeterSettleResult | null;
    release: MeterReleaseResult | null;
  }> => {
    try {
      if (calls.length > 0) {
        return {
          settlement: await meter.settle(request, calls),
          release: null,
        };
      }
      return { settlement: null, release: await meter.release(request) };
    } catch {
      // the ledger could not be reached: the hold stays until the reaper gives it back
      return calls.length > 0
        ? { settlement: { ok: false, code: 'LEDGER_ERROR' }, release: null }
        : { settlement: null, release: { ok: false, code: 'LEDGER_ERROR' } };
    }
  };

  let value: T;
  try {
    value = await run(
      {
        reservedUnits: reserved.reservedUnits,
        regenerationAllowed: reserved.regenerationAllowed,
        balance: reserved.balance,
      },
      recorder
    );
  } catch (error) {
    await finish();
    throw error;
  }
  const done = await finish();
  return { ok: true, value, ...done };
}
