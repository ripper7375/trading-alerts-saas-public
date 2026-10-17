/**
 * What the platform stores about a reply is the reply that was DELIVERED: a `reply-result/1`
 * (a report, an answer, a fixed answer, an action) or, when the request did not become a
 * reply, the `intake-refusal/1` the trader read. Both the trace store and the message store
 * take it through this one check, so they cannot disagree about what is storable:
 *
 *  - it must pass its own contract (`validateReplyResult` or `validateRefusal`);
 *  - no key anywhere in it may be called like the equity or the commission (ADR-077, the
 *    scan of step 6 reused): the reply is kept for 12 months in a transcript and 7 years in a
 *    trace, so the guard sits at the door of both.
 *
 * Pure.
 *
 * @module lib/platform/delivered
 */

import 'server-only';

import {
  INTAKE_REFUSAL_SCHEMA,
  forbiddenKeyPaths,
  isRecord,
  validateRefusal,
} from '@/lib/reply/contracts/intake';
import type { Issue, IntakeRefusal } from '@/lib/reply/contracts/intake';
import { validateReplyResult } from '@/lib/reply/contracts/result';
import type { ReplyResult, ResultKind } from '@/lib/reply/contracts/result';
import type { ReplyOutcome } from '@/lib/reply/contracts/trace-fields';

export type DeliveredKind = ResultKind | 'REFUSAL';
export type Delivered = ReplyResult | IntakeRefusal;

/** The trace outcome of each thing that can be delivered. */
export const OUTCOME_OF_KIND: Readonly<Record<DeliveredKind, ReplyOutcome>> = {
  REPORT1: 'REPORT1',
  ANSWER: 'ANSWER',
  FIXED_ANSWER: 'FIXED_ANSWER',
  ACTION: 'OPEN_TRADE_SETUP',
  REFUSAL: 'REFUSED',
};

export type DeliveredCheck =
  | {
      ok: true;
      kind: DeliveredKind;
      outcome: ReplyOutcome;
      reply: Delivered;
    }
  | {
      ok: false;
      code: 'INVALID_REPLY' | 'FORBIDDEN_KEY';
      issues: Issue[];
    };

export function inspectDelivered(reply: unknown): DeliveredCheck {
  // The scan comes FIRST: the contracts are strict, so a stray `equity` key would otherwise be
  // reported as a generic unknown key, and a privacy incident must be named as one.
  const forbidden = forbiddenKeyPaths(reply);
  if (forbidden.length > 0) {
    return {
      ok: false,
      code: 'FORBIDDEN_KEY',
      issues: forbidden.map((path) => ({
        path,
        code: 'FORBIDDEN_KEY' as const,
        message: 'a reply never carries the equity or the commission',
      })),
    };
  }
  const isRefusal =
    isRecord(reply) && reply['schema'] === INTAKE_REFUSAL_SCHEMA;
  const checked = isRefusal
    ? validateRefusal(reply)
    : validateReplyResult(reply);
  if (!checked.ok) {
    return { ok: false, code: 'INVALID_REPLY', issues: checked.issues };
  }
  const kind: DeliveredKind = isRefusal
    ? 'REFUSAL'
    : (reply as ReplyResult).kind;
  return {
    ok: true,
    kind,
    outcome: OUTCOME_OF_KIND[kind],
    reply: reply as Delivered,
  };
}
