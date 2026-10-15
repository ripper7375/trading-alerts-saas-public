/**
 * The gate (architecture 4.2 step 1, plan part 5, decisions D5 (A) and D6 (a)).
 *
 * Six checks, in this order, cheapest first, and the first that fails ends the request:
 *
 *   1. the feature flag        off: the routes do not exist, for anybody (a 404, not a refusal)
 *   2. the session             NOT_SIGNED_IN
 *   3. the tier                TIER_REQUIRED (`EntitlementPort`; the entitlement table of 7.3)
 *   4. the thread              THREAD_INVALID (`ThreadPort`, decision D6 (a): XAUUSD, an optional
 *                              thread id, no table until the chat exists)
 *   5. the profile confirmed   PROFILE_NOT_SET (the six-field projection, never the equity)
 *   6. the quota pre-check     QUOTA_INSUFFICIENT (`QuotaPort`; since build step 7 part 6 the floor
 *                              check of the quota ledger, `lib/reply/meter/quota-port.ts`)
 *
 * The first three need nothing from the request, so the request is read between the third and
 * the fourth: a request that is not signed in, or not Pro, never has its body read. The user and
 * the tier come from the SESSION and nowhere else: `GateRequest` has no field that could carry
 * either, and what a body says about them never reaches this file.
 *
 * A port that fails (an exception) fails CLOSED: the session as "not signed in", every other as
 * `FEATURE_UNAVAILABLE`. Access is never granted by a gap, and a failing quota service never
 * lets a request through for free. The failure is named in `problems` for the trace.
 *
 * Nothing here knows a database, Redis, the session library or a clock: the adapters that do
 * live in `server/access.ts`. Nothing here writes: the quota check is a PRE-check, so a request
 * refused or failed later charges nothing.
 *
 * Pure: no I/O of its own, no clock, no randomness.
 *
 * @module lib/intake/gate
 */

import { PACKET_SYMBOL, type PacketProfile } from './packet';
import type { RefusalCode } from './refusal';

/** The refusals the gate can give, in the order it decides them (`GATE_ORDER` of the refusal file, plus the fail-closed code). */
export type GateRefusalCode = Extract<
  RefusalCode,
  | 'NOT_SIGNED_IN'
  | 'TIER_REQUIRED'
  | 'THREAD_INVALID'
  | 'PROFILE_NOT_SET'
  | 'QUOTA_INSUFFICIENT'
  | 'FEATURE_UNAVAILABLE'
>;

export type RequestKind = 'TYPED' | 'INSTANT';

// ---------------------------------------------------------------------------
// The ports
// ---------------------------------------------------------------------------

/** Who is calling, as the session says. The tier is a plain word here; the entitlement port reads it. */
export interface GateSession {
  userId: string;
  tier: string;
}

export interface SessionPort {
  /** the signed-in caller, or null */
  current(): Promise<GateSession | null>;
}

export interface EntitlementPort {
  /** may a trader of this tier use the AI analyst (the live analyst of the entitlement table, `config/entitlements.ts`) */
  allows(tier: string): boolean | Promise<boolean>;
}

export interface ThreadCheck {
  userId: string;
  /** the chat thread the request names, if any */
  threadId: string | null;
  /** the thread is for this symbol and no other */
  symbol: typeof PACKET_SYMBOL;
}

export type ThreadVerdict =
  | { ok: true; threadId: string | null }
  | { ok: false };

export interface ThreadPort {
  check(check: ThreadCheck): Promise<ThreadVerdict>;
}

/** What the profile port answers: `read/profile.ts`'s `ProfileRead`, written out so this file imports no reader. */
export type ProfileGateRead =
  | { ok: true; profile: PacketProfile }
  | {
      ok: false;
      code: 'PROFILE_NOT_SET' | 'PROFILE_UNREADABLE' | 'DATABASE_ERROR';
      detail: string;
    };

export interface ProfilePort {
  read(userId: string): Promise<ProfileGateRead>;
}

export interface QuotaRequest {
  userId: string;
  tier: string;
  kind: RequestKind;
}

export interface QuotaVerdict {
  allowed: boolean;
}

export interface QuotaPort {
  /**
   * Is there balance for a request of this kind? A PRE-check: it reserves and charges nothing.
   * The units follow the model's actual cost (ADR-050, ADR-073); the hold and the charge are the
   * meter's (`lib/reply/meter/quota-port.ts`), made around the model calls and not by this gate.
   */
  precheck(request: QuotaRequest): Promise<QuotaVerdict>;
}

export interface GatePorts {
  /** the feature flag: true only when `INTAKE_ENABLED` is exactly `true` */
  enabled(): boolean;
  session: SessionPort;
  entitlement: EntitlementPort;
  thread: ThreadPort;
  profile: ProfilePort;
  quota: QuotaPort;
}

// ---------------------------------------------------------------------------
// The run
// ---------------------------------------------------------------------------

/** What the gate needs to know of the request: the kind, and the thread it names. Nothing about WHO. */
export interface GateRequest {
  kind: RequestKind;
  threadId: string | null;
}

export type RequestRead<R extends GateRequest, F> =
  | { ok: true; request: R }
  | { ok: false; failure: F };

export interface GateCaller {
  userId: string;
  tier: string;
}

export type GateOutcome<R extends GateRequest, F> =
  | {
      ok: true;
      caller: GateCaller;
      request: R;
      /** the thread the thread port accepted */
      threadId: string | null;
      profile: PacketProfile;
    }
  | { ok: false; kind: 'DISABLED' }
  | {
      ok: false;
      kind: 'REFUSED';
      code: GateRefusalCode;
      /** the tier of a caller who got as far as having one, for the trace */
      tier: string | null;
      /** what failed behind the refusal, for the trace and the log; never shown to the trader */
      problems: string[];
    }
  | {
      ok: false;
      kind: 'REQUEST';
      /** whatever the reader of the request returned: a malformed body is not a refusal of the gate */
      failure: F;
      tier: string;
    };

function refused<R extends GateRequest, F>(
  code: GateRefusalCode,
  tier: string | null,
  problems: string[] = []
): GateOutcome<R, F> {
  return { ok: false, kind: 'REFUSED', code, tier, problems };
}

const messageOf = (error: unknown): string =>
  error instanceof Error ? error.message : 'unknown error';

/**
 * Decide whether a request may run. `readRequest` is called once, after the tier check, with
 * the caller; it reads the body and returns the request or its own failure.
 */
export async function runGate<R extends GateRequest, F>(
  ports: GatePorts,
  readRequest: (caller: GateCaller) => Promise<RequestRead<R, F>>
): Promise<GateOutcome<R, F>> {
  // 1. the flag: with it off nothing else is asked, not even who is calling
  if (!ports.enabled()) return { ok: false, kind: 'DISABLED' };

  // 2. the session
  let session: GateSession | null;
  try {
    session = await ports.session.current();
  } catch (error) {
    return refused('NOT_SIGNED_IN', null, [
      `SESSION_PORT_ERROR: ${messageOf(error)}`,
    ]);
  }
  if (
    session === null ||
    typeof session.userId !== 'string' ||
    session.userId === ''
  ) {
    return refused('NOT_SIGNED_IN', null);
  }
  const caller: GateCaller = { userId: session.userId, tier: session.tier };

  // 3. the tier
  let allowed: boolean;
  try {
    allowed = (await ports.entitlement.allows(caller.tier)) === true;
  } catch (error) {
    return refused('FEATURE_UNAVAILABLE', caller.tier, [
      `ENTITLEMENT_PORT_ERROR: ${messageOf(error)}`,
    ]);
  }
  if (!allowed) return refused('TIER_REQUIRED', caller.tier);

  // the request is read only now
  const read = await readRequest(caller);
  if (!read.ok) {
    return {
      ok: false,
      kind: 'REQUEST',
      failure: read.failure,
      tier: caller.tier,
    };
  }
  const request = read.request;

  // 4. the thread
  let thread;
  try {
    thread = await ports.thread.check({
      userId: caller.userId,
      threadId: request.threadId,
      symbol: PACKET_SYMBOL,
    });
  } catch (error) {
    return refused('FEATURE_UNAVAILABLE', caller.tier, [
      `THREAD_PORT_ERROR: ${messageOf(error)}`,
    ]);
  }
  if (!thread.ok) return refused('THREAD_INVALID', caller.tier);

  // 5. the profile
  let profile: ProfileGateRead;
  try {
    profile = await ports.profile.read(caller.userId);
  } catch (error) {
    return refused('FEATURE_UNAVAILABLE', caller.tier, [
      `PROFILE_PORT_ERROR: ${messageOf(error)}`,
    ]);
  }
  if (!profile.ok) {
    // not set, or stored in a form that no longer passes its own validator: confirming it again
    // fixes both. A database that cannot be read is the feature being unavailable.
    return profile.code === 'DATABASE_ERROR'
      ? refused('FEATURE_UNAVAILABLE', caller.tier, [
          `PROFILE_DATABASE_ERROR: ${profile.detail}`,
        ])
      : refused('PROFILE_NOT_SET', caller.tier, [
          `${profile.code}: ${profile.detail}`,
        ]);
  }

  // 6. the quota pre-check
  let quota: QuotaVerdict;
  try {
    quota = await ports.quota.precheck({
      userId: caller.userId,
      tier: caller.tier,
      kind: request.kind,
    });
  } catch (error) {
    return refused('FEATURE_UNAVAILABLE', caller.tier, [
      `QUOTA_PORT_ERROR: ${messageOf(error)}`,
    ]);
  }
  if (quota.allowed !== true) return refused('QUOTA_INSUFFICIENT', caller.tier);

  return {
    ok: true,
    caller,
    request,
    threadId: thread.threadId,
    profile: profile.profile,
  };
}
