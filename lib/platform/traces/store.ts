/**
 * The trace writer (architecture 7.4, ADR-075; build step 7 decisions D16 and D17): ONE row
 * per answer in `request_traces`, written ONCE at the end of the request.
 *
 * What it refuses, as a result and not an exception (`ok: false`), before the database sees
 * anything:
 *  - a trace that fails `validateReplyTrace` (every group is a strict object: there is no
 *    field a question could be written into);
 *  - a reply that fails its contract, or is not the kind the outcome says, or belongs to
 *    another request, thread or intent, or is written in another locale (`REPLY_MISMATCH`);
 *  - a key called like the equity or the commission anywhere in the trace groups or in the
 *    delivered reply (ADR-077, the scan of step 6 reused). Report 2 is NOT scanned: it is
 *    Engine 4's validated setup, and it carries the trader's own equity and commission by
 *    design (the consent record keeps the same figures); it never reaches a model;
 *  - the user id inside any group or report: it lives in its own column, which the
 *    database sets to NULL when the account is deleted, and a copy would outlive it
 *    (`USER_ID_IN_TRACE`; a CHECK of the migration refuses it too).
 * A missing audit key (`AuditKeyError`) and a database error are thrown.
 *
 * What it writes: the filter columns projected from the groups (the database checks each
 * equals its group's value), the seven groups as JSONB, the delivered reply as the exact
 * canonical JSON text with its SHA-256 (the database re-derives the hash), and the keyed hash
 * of the user id with the version of the key. Report 2, the risk group and the consent action
 * are attached later by `attachRisk`, which takes Report 2 as the exact text Engine 4
 * serializes (so its hash is the consent record's `setup_sha256`) and requires the risk group
 * to name that hash; the database refuses every other UPDATE and every DELETE of an
 * unarchived row, and `store-guard.test.ts` keeps this file from trying.
 *
 * @module lib/platform/traces/store
 */

import 'server-only';

import { createHash } from 'crypto';

import { prisma } from '@/lib/db/prisma';
import {
  canonicalJson,
  forbiddenKeyPaths,
  isRecord,
  secondsOfSlot,
} from '@/lib/reply/contracts/intake';
import type { Issue } from '@/lib/reply/contracts/intake';
import {
  validateReplyTrace,
  validateRiskGroup,
} from '@/lib/reply/contracts/trace-fields';
import type {
  ReplyTrace,
  TraceRiskGroup,
} from '@/lib/reply/contracts/trace-fields';

import { inspectDelivered } from '../delivered';
import type { Delivered } from '../delivered';
import { hashTraceUser, resolveAuditKey } from './hash';
import type { AuditKey } from './hash';

type Json = string | number | boolean | null | Json[] | { [key: string]: Json };
type JsonObject = { [key: string]: Json };

/** What `create` takes: the delegate the real generated client fits with no cast; a test passes its own. */
export interface TraceCreateData {
  request_id: string;
  client_request_id: string;
  user_id: string;
  user_id_hash: string;
  key_version: number;
  thread_id: string | null;
  tier: string;
  locale: string;
  intent: string;
  cycle_slot: number | null;
  data_status: string | null;
  model: string | null;
  units_charged: number;
  regenerations: number;
  number_violations: number;
  wording_violations: number;
  outcome: string;
  total_ms: number;
  request_group: JsonObject;
  data_group: JsonObject;
  knowledge_group: JsonObject;
  model_group: JsonObject;
  checks_group: JsonObject;
  /** omitted, never null: Prisma sets a JSON column to NULL by leaving it out */
  risk_group?: JsonObject;
  time_group: JsonObject;
  reply_json: string | null;
  reply_sha256: string | null;
  consent_action: string | null;
}

/** The columns the database lets change after the row exists (the risk attachment). */
export interface RiskUpdateData {
  risk_group: JsonObject;
  report2_json: string | null;
  report2_sha256: string | null;
  consent_action: string | null;
}

/** A row as `readTrace` returns it. The groups are `unknown`: read them with the contract's types. */
export interface StoredTrace {
  request_id: string;
  client_request_id: string;
  user_id: string | null;
  user_id_hash: string;
  key_version: number;
  thread_id: string | null;
  tier: string;
  locale: string;
  intent: string;
  cycle_slot: number | null;
  data_status: string | null;
  model: string | null;
  units_charged: number;
  regenerations: number;
  number_violations: number;
  wording_violations: number;
  outcome: string;
  total_ms: number;
  request_group: unknown;
  data_group: unknown;
  knowledge_group: unknown;
  model_group: unknown;
  checks_group: unknown;
  risk_group: unknown;
  time_group: unknown;
  reply_json: string | null;
  reply_sha256: string | null;
  report2_json: string | null;
  report2_sha256: string | null;
  consent_action: string | null;
  created_at: Date;
  archived_at: Date | null;
  archive_ref: string | null;
}

export interface TraceStoreClient {
  requestTrace: {
    create(args: {
      data: TraceCreateData;
      select: { request_id: true };
    }): Promise<{ request_id: string }>;
    updateMany(args: {
      where: { request_id: string; user_id: string };
      data: RiskUpdateData;
    }): Promise<{ count: number }>;
    findUnique(args: {
      where: { request_id: string };
    }): Promise<StoredTrace | null>;
  };
}

export interface TraceStoreOptions {
  client?: TraceStoreClient;
  key?: AuditKey;
}

export type TraceRefusalCode =
  | 'MISSING_USER'
  | 'INVALID_TRACE'
  | 'INVALID_REPLY'
  | 'REPLY_MISMATCH'
  | 'FORBIDDEN_KEY'
  | 'USER_ID_IN_TRACE';

export type WriteTraceResult =
  | {
      ok: true;
      requestId: string;
      /** the SHA-256 (hex) of the reply text that was stored; null for an ERROR outcome */
      replySha256: string | null;
    }
  | { ok: false; code: TraceRefusalCode; issues: Issue[] };

export interface WriteTraceInput {
  userId: string;
  trace: ReplyTrace;
  /** the reply that was delivered; null exactly when the outcome is ERROR */
  reply: Delivered | null;
}

/** SHA-256 of a text as UTF-8 (a string is hashed as UTF-8 by default), the way the database hashes it. */
const sha256 = (text: string): string =>
  createHash('sha256').update(text).digest('hex');

/** Does any of the texts hold the user id? Each is read on its own: a match across two is no leak. */
const carries = (userId: string, ...texts: (string | null)[]): boolean =>
  texts.some((text) => text !== null && text.includes(userId));

function refuse(
  code: TraceRefusalCode,
  message: string,
  issues: Issue[] = [{ path: '', code: 'INCONSISTENT', message }]
): Extract<WriteTraceResult, { ok: false }> {
  return { ok: false, code, issues };
}

const asJson = (value: unknown): JsonObject => value as JsonObject;

/** The groups of a trace, as the text a CHECK or a scan reads. */
function groupText(trace: ReplyTrace): string {
  return JSON.stringify([
    trace.request,
    trace.data,
    trace.knowledge,
    trace.model,
    trace.checks,
    trace.risk,
    trace.time,
  ]);
}

/**
 * Write the trace of one answer. See the file header for what is refused. The row's
 * filter columns are copied from the groups, never worked out a second time.
 */
export async function writeTrace(
  input: WriteTraceInput,
  options: TraceStoreOptions = {}
): Promise<WriteTraceResult> {
  const { userId, trace } = input;
  if (typeof userId !== 'string' || userId === '') {
    return refuse('MISSING_USER', 'a trace belongs to a user');
  }
  // The scan comes before the contract: the groups are strict, so a stray `equity` key would
  // otherwise be reported as a generic unknown key, and a privacy incident must be named as one.
  const forbidden = forbiddenKeyPaths(trace);
  if (forbidden.length > 0) {
    return {
      ok: false,
      code: 'FORBIDDEN_KEY',
      issues: forbidden.map((path) => ({
        path,
        code: 'FORBIDDEN_KEY' as const,
        message: 'a trace never carries the equity or the commission',
      })),
    };
  }
  const checked = validateReplyTrace(trace);
  if (!checked.ok) {
    return { ok: false, code: 'INVALID_TRACE', issues: checked.issues };
  }

  const { request, data, model, checks, time } = trace;
  let replyJson: string | null = null;
  if (trace.outcome === 'ERROR') {
    if (input.reply !== null) {
      return refuse('REPLY_MISMATCH', 'an ERROR outcome has no reply');
    }
  } else {
    if (input.reply === null) {
      return refuse(
        'REPLY_MISMATCH',
        `a ${trace.outcome} outcome needs the reply that was delivered`
      );
    }
    const delivered = inspectDelivered(input.reply);
    if (!delivered.ok) {
      return {
        ok: false,
        code:
          delivered.code === 'FORBIDDEN_KEY'
            ? 'FORBIDDEN_KEY'
            : 'INVALID_REPLY',
        issues: delivered.issues,
      };
    }
    if (delivered.outcome !== trace.outcome) {
      return refuse(
        'REPLY_MISMATCH',
        `the outcome is ${trace.outcome} and the reply is a ${delivered.kind}`
      );
    }
    if (delivered.reply.reply_locale !== request.reply_locale) {
      return refuse(
        'REPLY_MISMATCH',
        'the reply is written in another locale than the trace says'
      );
    }
    if ('provenance' in delivered.reply) {
      const { provenance, thread_id: threadId, intent } = delivered.reply;
      if (
        provenance.request_id !== request.request_id ||
        threadId !== request.thread_id ||
        intent !== request.intent
      ) {
        return refuse(
          'REPLY_MISMATCH',
          'the reply belongs to another request, thread or intent'
        );
      }
    }
    replyJson = canonicalJson(delivered.reply);
  }

  if (carries(userId, groupText(trace), replyJson)) {
    return refuse(
      'USER_ID_IN_TRACE',
      'the user id lives in its own column, never inside a group or a reply'
    );
  }

  const client: TraceStoreClient = options.client ?? prisma;
  const { hash, keyVersion } = hashTraceUser(
    userId,
    options.key ?? resolveAuditKey()
  );

  const row: TraceCreateData = {
    request_id: request.request_id,
    client_request_id: request.client_request_id,
    user_id: userId,
    user_id_hash: hash,
    key_version: keyVersion,
    thread_id: request.thread_id,
    tier: request.tier,
    locale: request.reply_locale,
    intent: request.intent,
    cycle_slot: secondsOfSlot(data.cycle_slot),
    data_status: data.data_status,
    model: model.model,
    units_charged: model.units_charged,
    regenerations: checks.regenerations,
    number_violations: checks.numbers.violations,
    wording_violations: checks.wording.violations,
    outcome: trace.outcome,
    total_ms: time.total_ms,
    request_group: asJson(request),
    data_group: asJson(data),
    knowledge_group: asJson(trace.knowledge),
    model_group: asJson(model),
    checks_group: asJson(checks),
    ...(trace.risk === null ? {} : { risk_group: asJson(trace.risk) }),
    time_group: asJson(time),
    reply_json: replyJson,
    reply_sha256: replyJson === null ? null : sha256(replyJson),
    consent_action: trace.risk?.consent_action ?? null,
  };
  await client.requestTrace.create({ data: row, select: { request_id: true } });
  return {
    ok: true,
    requestId: request.request_id,
    replySha256: row.reply_sha256,
  };
}

// ---------------------------------------------------------------------------
// The risk attachment (Section 6)
// ---------------------------------------------------------------------------

export interface AttachRiskInput {
  /** the trader: the row is found by request id AND user id, so no one attaches to another's trace */
  userId: string;
  requestId: string;
  risk: TraceRiskGroup;
  /**
   * Report 2 as TEXT: the exact `serializeValidatedSetup` text of Engine 4's validated setup
   * (`validated-setup/1`), the same text the consent record hashes, so `report2_sha256` here
   * is that record's `setup_sha256` and the two can be matched. Null to attach the group alone.
   */
  report2Json: string | null;
}

export type AttachRiskResult =
  | { ok: true; report2Sha256: string | null }
  | {
      ok: false;
      code:
        | 'MISSING_USER'
        | 'INVALID_RISK'
        | 'INVALID_REPORT2'
        | 'USER_ID_IN_TRACE'
        | 'NOT_FOUND';
      issues: Issue[];
    };

/**
 * Attach the risk group, Report 2 and the consent action to the trace of a request (decision
 * D16; Section 6 calls it, wiring Engine 4's routes is a later change). The database lets
 * exactly these columns change, and only while the row is not archived. `NOT_FOUND` is
 * also the answer for a request that is another user's: existence is not leaked.
 */
export async function attachRisk(
  input: AttachRiskInput,
  options: Pick<TraceStoreOptions, 'client'> = {}
): Promise<AttachRiskResult> {
  const { userId, requestId, risk, report2Json } = input;
  const fail = (
    code: Exclude<AttachRiskResult, { ok: true }>['code'],
    message: string,
    issues: Issue[] = [{ path: '', code: 'INCONSISTENT', message }]
  ): AttachRiskResult => ({ ok: false, code, issues });

  if (typeof userId !== 'string' || userId === '') {
    return fail('MISSING_USER', 'a trace belongs to a user');
  }
  const checked = validateRiskGroup(risk);
  if (!checked.ok) {
    return { ok: false, code: 'INVALID_RISK', issues: checked.issues };
  }
  if (report2Json !== null) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(report2Json);
    } catch {
      return fail('INVALID_REPORT2', 'Report 2 is JSON text');
    }
    if (!isRecord(parsed) || parsed['schema'] !== 'validated-setup/1') {
      return fail('INVALID_REPORT2', 'Report 2 is a validated-setup/1 object');
    }
    if (risk.setup_sha256 !== sha256(report2Json)) {
      return {
        ok: false,
        code: 'INVALID_RISK',
        issues: [
          {
            path: 'setup_sha256',
            code: 'INCONSISTENT',
            message:
              'the risk group must name the hash of the Report 2 it came with',
          },
        ],
      };
    }
  }
  if (carries(userId, JSON.stringify(risk), report2Json)) {
    return fail(
      'USER_ID_IN_TRACE',
      'the user id lives in its own column, never inside a group or a report'
    );
  }

  const client: TraceStoreClient = options.client ?? prisma;
  const updated = await client.requestTrace.updateMany({
    where: { request_id: requestId, user_id: userId },
    data: {
      risk_group: asJson(risk),
      report2_json: report2Json,
      report2_sha256: report2Json === null ? null : sha256(report2Json),
      consent_action: risk.consent_action,
    },
  });
  if (updated.count === 0) {
    return fail('NOT_FOUND', 'there is no such trace for this user');
  }
  return {
    ok: true,
    report2Sha256: report2Json === null ? null : sha256(report2Json),
  };
}

// ---------------------------------------------------------------------------
// Reading
// ---------------------------------------------------------------------------

/** One trace by its request id: what support opens. */
export async function readTrace(
  requestId: string,
  options: Pick<TraceStoreOptions, 'client'> = {}
): Promise<StoredTrace | null> {
  const client: TraceStoreClient = options.client ?? prisma;
  return client.requestTrace.findUnique({ where: { request_id: requestId } });
}
