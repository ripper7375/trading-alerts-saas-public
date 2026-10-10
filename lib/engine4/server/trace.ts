/**
 * The request trace fields every Engine 4 route returns (architecture 7.4, plan
 * assumption A5). Chapter 7 writes the `request_traces` row (90 days in
 * PostgreSQL, then archived with the consent records); this chapter only makes the
 * fields available at the one place each route answers, `respond.ts`, so a later
 * writer plugs in there and no route changes.
 *
 * The groups follow 7.4: Request (id, tier, language, the client's submission id),
 * Data (cycle slot, data status, sensor statuses, synthesis rule and version),
 * Risk (the Engine 4 verdicts, validator results, overrides, consent action) and
 * Time (the duration of every stage). A trace carries no user id and no figure the
 * trader typed: the server's own request id is what support opens.
 *
 * Time is measured in whole milliseconds as `bigint` and handed out as a number
 * only through the exact conversion the exactness guard allows.
 *
 * @module lib/engine4/server/trace
 */

import { randomUUID } from 'crypto';

import { ENGINE4_VERSION } from '../version';

export type Engine4Route = 'profile' | 'offer' | 'size' | 'consent';

export interface TraceStage {
  name: string;
  ms: number;
}

export interface TraceSensor {
  mcdId: string;
  status: string;
  /** the reading gave levels */
  available: boolean;
}

export interface TraceData {
  /** the cycle the setup is pinned to, unix seconds as text */
  cycleSlot: string | null;
  /** the live status the gateway gave (FRESH, DELAYED, STALE, MARKET_CLOSED), or null when it could not be obtained */
  dataStatus: string | null;
  /** the slot of the newest ready cycle, as text */
  dataAsOfSlot: string | null;
  sensors: TraceSensor[];
  synthesis: {
    ruleId: string;
    rulesVersion: string;
    branchId: string | null;
    /** shadow or live */
    flag: string;
    bias: string;
    status: string;
    trendRelation: string | null;
  } | null;
  specsVersion: string | null;
  tier1ListVersion: number | null;
  /** codes of the readers' problems (a missing reading, an unreadable zone, a failed hash ...) */
  problems: string[];
}

export interface TraceCheck {
  id: number;
  name: string;
  status: string;
  codes: string[];
}

export interface TraceRisk {
  offerVerdict: string | null;
  offerReasons: string[];
  notices: string[];
  /** the eight checks of 6.10, null when no setup was validated */
  checks: TraceCheck[] | null;
  ok: boolean | null;
  halfRisk: boolean | null;
  /** the trader chose more than the half-risk pre-set */
  override: { preset: string; chosen: string; reasons: string[] } | null;
  badge: string | null;
  /** the SHA-256 of the validated setup, when there is one */
  setupSha256: string | null;
  consentAction: string | null;
  consentRecordId: string | null;
}

export interface RequestTrace {
  requestId: string;
  route: Engine4Route;
  method: string;
  engine4Version: string;
  startedAt: string;
  tier: string | null;
  language: string | null;
  /** the client's id for this submit: one id writes one consent record */
  submissionId: string | null;
  data: TraceData | null;
  risk: TraceRisk | null;
  timings: { totalMs: number; stages: TraceStage[] };
}

export type TraceFields = Partial<
  Pick<RequestTrace, 'tier' | 'language' | 'submissionId' | 'data' | 'risk'>
>;

/** Collects a request's trace fields and times its stages. */
export class TraceBuilder {
  readonly requestId: string;
  private readonly began: bigint;
  private readonly stages: TraceStage[] = [];
  private fields: TraceFields = {};

  constructor(
    readonly route: Engine4Route,
    readonly method: string,
    private readonly clock: () => number = Date.now,
    requestId: string = randomUUID()
  ) {
    this.requestId = requestId;
    this.began = BigInt(this.clock());
  }

  /** Run one stage and record how long it took, whether it succeeded or threw. */
  async stage<T>(name: string, run: () => Promise<T>): Promise<T> {
    const start = BigInt(this.clock());
    try {
      return await run();
    } finally {
      this.stages.push({
        name,
        ms: Number(BigInt(this.clock()) - start),
      });
    }
  }

  /** Add or replace trace fields; the groups already set are replaced as a whole. */
  set(patch: TraceFields): void {
    this.fields = { ...this.fields, ...patch };
  }

  snapshot(): RequestTrace {
    return {
      requestId: this.requestId,
      route: this.route,
      method: this.method,
      engine4Version: ENGINE4_VERSION,
      startedAt: new Date(Number(this.began)).toISOString(),
      tier: this.fields.tier ?? null,
      language: this.fields.language ?? null,
      submissionId: this.fields.submissionId ?? null,
      data: this.fields.data ?? null,
      risk: this.fields.risk ?? null,
      timings: {
        totalMs: Number(BigInt(this.clock()) - this.began),
        stages: this.stages.map((stage) => ({ ...stage })),
      },
    };
  }
}
