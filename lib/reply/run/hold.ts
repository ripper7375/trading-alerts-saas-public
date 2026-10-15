/**
 * The quota hold of one request, made at the gate and ended after the reply is stored (build step
 * 7 part 7a; architecture 5.6, 5.2; plan parts 6 and 7; decisions D2 to D4, D11 and D23).
 *
 * WHY THE HOLD IS TAKEN AT THE GATE. The Understand call is a real, paid call that runs BEFORE
 * the answer is known to need a model, so the units for the whole request, the Understand call at
 * its ceiling and the answer (and one more answer if the balance allows) at theirs, are held
 * before that call is made. The gate's sixth check, the quota pre-check, is the one moment between
 * "the trader is who they say and may ask" and "money is spent", so the hold is taken there, in a
 * port that WRAPS the gate's own floor check: the floor check runs first and is unchanged, and
 * only when it passes is the worst case held. The six checks of the gate and their order do not
 * change, and nothing in `lib/intake` is edited.
 *
 * WHAT A HOLD IS NOT. A balance that cannot cover the worst case is a refusal with the numbers
 * (`QuotaDetail`), and the model is never called (5.14 item 2). A request id that already has a
 * hold is a duplicate: it is never run a second time. A request nobody can price (no launch
 * model, an unknown price) fails closed as the feature being unavailable, not as a quota
 * refusal: the trader's balance is not the reason.
 *
 * WHAT IT RECORDS. Every paid call is reported as it finishes (`record`), the Understand call
 * through the adapter's hook and the answer calls by the model step. The settlement is the sum
 * of what they cost, up to what the balance has left; with no paid call the hold is released and
 * the trader pays nothing (`settleOrRelease`).
 *
 * THE CLIENT LEAVING. Until a model call has been sent a client that disconnects ends the request
 * and gives the units back (`aborted`); once one has been sent the request is finished, settled
 * and stored, so a reload shows the reply and the trader pays for what was spent.
 *
 * Pure: the ledger is the meter's port; nothing here reads a clock or a database.
 *
 * @module lib/reply/run/hold
 */

import type {
  QuotaPort,
  QuotaRequest,
  UnderstandPort,
} from '../contracts/intake';
import type { ModelCallRole } from '../contracts/trace-fields';
import { estimateRequest } from '../meter/estimate';
import type { RequestBounds } from '../meter/estimate';
import { settleOrRelease } from '../meter/quota-port';
import type {
  HoldOutcome,
  Meter,
  MeterRequest,
  ReservationState,
} from '../meter/quota-port';
import type { SpentCall } from '../meter/reserve-plan';
import { callRecordOf, spentOf, wasSent } from './calls';
import type {
  ModelCallRecord,
  ModelCallOutcome,
} from '../contracts/trace-fields';
import type { ModelCallResult } from '../gateway/types';
import type { QuotaDetail } from './types';

/** Thrown inside a gate port to stop the request; the gate turns it into FEATURE_UNAVAILABLE and the orchestrator reads `Hold`. */
export class HoldStopped extends Error {
  constructor(readonly why: string) {
    super(`the request was stopped at the hold: ${why}`);
    this.name = 'HoldStopped';
  }
}

export interface HoldDeps {
  meter: Meter;
  /** the worst-case bounds of a request of this kind; null when no model can answer */
  bounds: (kind: QuotaRequest['kind']) => RequestBounds | null;
  /** the server's id of the request (set once the body is read) */
  requestId: () => string | null;
  /** the client's connection */
  signal?: AbortSignal;
  /** the mark of a log line (`code`), never a message */
  log: (
    code: string,
    detail?: Readonly<Record<string, string | number>>
  ) => void;
}

export class Hold {
  /** the hold was granted by THIS request */
  held = false;
  regenerationAllowed = false;
  reservedUnits = 0;
  /** set when the worst case did not fit the balance */
  quota: QuotaDetail | null = null;
  /** set when the request id already had a hold: nothing is run */
  duplicate: ReservationState | null = null;
  /** the client left before any model was called */
  aborted = false;
  /** a model call has been sent: from now on the request is finished whatever the client does */
  dispatched = false;
  /** why the hold could not be made, when it was not a refusal of the balance */
  failure: string | null = null;

  /** the paid calls, for the settlement */
  readonly spent: SpentCall[] = [];
  /** every call that was sent, for the trace */
  readonly records: ModelCallRecord[] = [];

  /** the request the hold was taken for; set exactly when `held` */
  private who: MeterRequest | null = null;

  constructor(private readonly deps: HoldDeps) {}

  // ---- the gate -----------------------------------------------------------

  /** The gate's quota port with the hold in it: the floor check first, then the worst case. */
  wrapQuota(inner: QuotaPort): QuotaPort {
    return {
      precheck: async (request) => {
        const floor = await inner.precheck(request);
        if (floor.allowed !== true) return floor;

        if (this.deps.signal?.aborted === true) {
          this.aborted = true;
          throw new HoldStopped('CLIENT_ABORTED');
        }
        const requestId = this.deps.requestId();
        if (requestId === null) {
          this.failure = 'NO_REQUEST_ID';
          throw new HoldStopped(this.failure);
        }
        const bounds = this.deps.bounds(request.kind);
        if (bounds === null) {
          this.failure = 'NO_MODEL';
          throw new HoldStopped(this.failure);
        }
        const estimate = estimateRequest(bounds);
        const who = {
          requestId,
          userId: request.userId,
          tier: request.tier,
        };
        const reserved = await this.deps.meter.reserve(who, estimate);
        if (!reserved.ok) {
          if (reserved.code === 'INSUFFICIENT') {
            this.quota = {
              limitUnits: reserved.balance.limit,
              availableUnits: reserved.balance.available,
              neededUnits: reserved.neededUnits,
            };
            return { allowed: false };
          }
          if (reserved.code === 'NOT_METERED') return { allowed: false };
          this.failure = `HOLD_${reserved.code}`;
          throw new HoldStopped(this.failure);
        }
        if (reserved.replayed) {
          // a retry of a request that is running or finished: it must not run twice
          this.duplicate = reserved.status;
          throw new HoldStopped('DUPLICATE');
        }
        this.who = who;
        this.held = true;
        this.regenerationAllowed = reserved.regenerationAllowed;
        this.reservedUnits = reserved.reservedUnits;
        return { allowed: true };
      },
    };
  }

  // ---- the Understand call --------------------------------------------------

  /** The Understand port with the abort check in front of it; the adapter's hook reports the call. */
  wrapUnderstand(inner: UnderstandPort): UnderstandPort {
    return {
      understand: async (request) => {
        if (this.checkpoint()) throw new HoldStopped('CLIENT_ABORTED');
        this.dispatched = true;
        return inner.understand(request);
      },
    };
  }

  /** The Understand adapter's hook: one result per call it made. */
  onUnderstandCall = (result: ModelCallResult): void => {
    this.report('UNDERSTAND', result);
  };

  // ---- the answer calls --------------------------------------------------------

  /**
   * True when the client has left and no model has been called yet: the request ends here. Once
   * a call has been sent this is false whatever the client does.
   */
  checkpoint(): boolean {
    if (this.dispatched) return false;
    if (this.deps.signal?.aborted === true) {
      this.aborted = true;
      return true;
    }
    return false;
  }

  /** The answer call is about to be sent. */
  markDispatched(): void {
    this.dispatched = true;
  }

  /** A call finished: it goes in the trace, and in the books if it answered. */
  report(
    role: ModelCallRole,
    result: ModelCallResult,
    outcome: ModelCallOutcome = 'OK'
  ): void {
    if (!wasSent(result)) {
      this.deps.log('MODEL_CALL_NOT_SENT', {
        role,
        code: result.ok ? 'OK' : result.code,
      });
      return;
    }
    this.records.push(callRecordOf(role, result, outcome));
    const paid = spentOf(result);
    if (paid !== null) this.spent.push(paid);
  }

  /** Change the outcome of the last recorded call once the reply is read (BAD_JSON, BAD_SCHEMA). */
  reclassifyLast(outcome: ModelCallOutcome): void {
    const last = this.records[this.records.length - 1];
    if (last !== undefined && last.outcome === 'OK') {
      this.records[this.records.length - 1] = { ...last, outcome };
    }
  }

  // ---- the end ----------------------------------------------------------------

  /** Settle the hold for the calls that were paid, or give it back; nothing when no hold was made. */
  async end(): Promise<HoldOutcome> {
    if (this.who === null) return { settlement: null, release: null };
    return settleOrRelease(this.deps.meter, this.who, this.spent);
  }
}
