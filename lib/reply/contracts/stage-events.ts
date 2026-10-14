/**
 * The stream of `POST /api/chat/message` (ADR-054, plan decision D24): NDJSON, one JSON
 * object per line. Stage events say where the request is while the reply is made; then
 * exactly ONE terminal event ends the stream, and it is the last line:
 *
 *  - `result`: the whole checked reply (`reply-result/1`);
 *  - `refusal`: the request did not become a reply (`intake-refusal/1`, the same contract
 *    the intake path uses: a code, the stage that refused, a fixed reply in the reader's
 *    language);
 *  - `error`: something failed on our side after the stream began, with the request id
 *    support opens. A quota refusal's balance is added with the ledger (part 6).
 *
 * The reply is never streamed token by token: a number that fails its check must not be
 * shown and retracted. The stages are progress, not content.
 *
 * Pure.
 *
 * @module lib/reply/contracts/stage-events
 */

import {
  Issues,
  bool,
  canonicalJson,
  exactObject,
  hasOwn,
  isRecord,
  oneOf,
  validateRefusal,
} from './intake';
import type { Issue, IntakeRefusal } from './intake';
import { idText, intIn } from './fields';
import { validateReplyResult } from './result';
import type { ReplyResult } from './result';

/** The stages a client can show, in the order they run (plan section 4). */
export const REPLY_STAGES = [
  'GATE',
  'UNDERSTAND',
  'DATA',
  'CONTEXT',
  'MODEL',
  'CHECKS',
] as const;
export type ReplyStage = (typeof REPLY_STAGES)[number];

export const STAGE_STATUSES = ['STARTED', 'DONE', 'SKIPPED'] as const;
export type StageStatus = (typeof STAGE_STATUSES)[number];

/** What can fail on our side once the stream has begun. */
export const REPLY_ERROR_CODES = [
  'INTERNAL',
  /** the ledger could not be reached: the request fails closed, never free */
  'LEDGER_UNAVAILABLE',
  /** the reply was made and charged but could not be stored; the request id is logged */
  'PERSISTENCE_FAILED',
] as const;
export type ReplyErrorCode = (typeof REPLY_ERROR_CODES)[number];

export const EVENT_TYPES = ['stage', 'result', 'refusal', 'error'] as const;
export type EventType = (typeof EVENT_TYPES)[number];

export interface StageEvent {
  type: 'stage';
  stage: ReplyStage;
  status: StageStatus;
  /** whole milliseconds, on DONE; null otherwise */
  ms: number | null;
}

export interface ResultEvent {
  type: 'result';
  request_id: string;
  result: ReplyResult;
}

export interface RefusalEvent {
  type: 'refusal';
  request_id: string;
  refusal: IntakeRefusal;
}

export interface ErrorEvent {
  type: 'error';
  request_id: string;
  code: ReplyErrorCode;
  /** whether the same request may be sent again (it carries the same client_request_id) */
  retryable: boolean;
}

export type TerminalEvent = ResultEvent | RefusalEvent | ErrorEvent;
export type StreamEvent = StageEvent | TerminalEvent;

export type EventValidation =
  | { ok: true; event: StreamEvent }
  | { ok: false; issues: Issue[] };

/** The longest stage time a client believes: ten minutes. */
export const MAX_STAGE_MS = 600_000;

export function isTerminal(event: StreamEvent): event is TerminalEvent {
  return event.type !== 'stage';
}

/** One event, checked. */
export function validateStreamEvent(value: unknown): EventValidation {
  const issues = new Issues();
  const type =
    typeof value === 'object' && value !== null
      ? (value as Record<string, unknown>)['type']
      : undefined;
  const known = EVENT_TYPES.find((candidate) => candidate === type);
  if (known === undefined) {
    // the other keys mean nothing for a type we do not know: say only what is wrong with the type
    if (!isRecord(value)) {
      issues.add('', 'WRONG_TYPE', 'must be an object');
    } else if (!hasOwn(value, 'type')) {
      issues.add('type', 'REQUIRED', 'is required');
    } else {
      oneOf(value['type'], 'type', EVENT_TYPES, issues);
    }
    return { ok: false, issues: issues.list };
  }
  const keys: Record<EventType, readonly string[]> = {
    stage: ['type', 'stage', 'status', 'ms'],
    result: ['type', 'request_id', 'result'],
    refusal: ['type', 'request_id', 'refusal'],
    error: ['type', 'request_id', 'code', 'retryable'],
  };
  // a known type means the value is an object, so there is always a record to read
  const record = exactObject(value, '', keys[known], issues) as Record<
    string,
    unknown
  >;

  switch (known) {
    case 'stage': {
      oneOf(record['stage'], 'stage', REPLY_STAGES, issues);
      const status = oneOf(record['status'], 'status', STAGE_STATUSES, issues);
      if (status === 'DONE') {
        intIn(record['ms'], 'ms', issues, MAX_STAGE_MS);
      } else if (status !== undefined && record['ms'] !== null) {
        issues.add('ms', 'INCONSISTENT', `a ${status} stage has no time yet`);
      }
      break;
    }
    case 'result': {
      const requestId = idText(record['request_id'], 'request_id', issues);
      const result = validateReplyResult(record['result']);
      if (!result.ok) {
        for (const issue of result.issues) {
          issues.add(
            `result${issue.path === '' ? '' : `.${issue.path}`}`,
            issue.code,
            issue.message
          );
        }
      } else if (
        requestId !== undefined &&
        result.value.provenance.request_id !== requestId
      ) {
        issues.add(
          'result.provenance.request_id',
          'INCONSISTENT',
          'must be the request id of the event'
        );
      }
      break;
    }
    case 'refusal': {
      idText(record['request_id'], 'request_id', issues);
      const refusal = validateRefusal(record['refusal']);
      if (!refusal.ok) {
        for (const issue of refusal.issues) {
          issues.add(
            `refusal${issue.path === '' ? '' : `.${issue.path}`}`,
            issue.code,
            issue.message
          );
        }
      }
      break;
    }
    case 'error':
      idText(record['request_id'], 'request_id', issues);
      oneOf(record['code'], 'code', REPLY_ERROR_CODES, issues);
      bool(record['retryable'], 'retryable', issues);
      break;
  }

  return issues.any
    ? { ok: false, issues: issues.list }
    : { ok: true, event: record as unknown as StreamEvent };
}

// ---------------------------------------------------------------------------
// The stream as a whole
// ---------------------------------------------------------------------------

/**
 * The order rules of a stream. Stages run in the order of `REPLY_STAGES`; a stage is
 * STARTED once and then DONE, or SKIPPED on its own; a stage that was STARTED may be left
 * open only by the terminal event that follows it (the request ended inside it). Exactly
 * one terminal event, and it is last.
 */
export function validateStreamOrder(events: readonly StreamEvent[]): Issue[] {
  const issues = new Issues();
  if (events.length === 0) {
    issues.add('', 'TOO_SHORT', 'a stream has at least its terminal event');
    return issues.list;
  }
  const last = events.length - 1;
  // the position of the latest stage that began (stages never go back)
  let highest = 0;
  // true while a stage has been STARTED and not yet DONE; present (false) once it is finished or skipped
  const running = new Map<ReplyStage, boolean>();

  events.forEach((event, index) => {
    const here = `[${index}]`;
    if (isTerminal(event)) {
      if (index !== last) {
        issues.add(here, 'INCONSISTENT', 'nothing may follow a terminal event');
      }
      return;
    }
    const position = REPLY_STAGES.indexOf(event.stage);
    const seen = running.get(event.stage);
    if (event.status === 'DONE') {
      if (seen !== true) {
        issues.add(
          here,
          'INCONSISTENT',
          `${event.stage} is done without being started`
        );
      }
      running.set(event.stage, false);
      return;
    }
    // STARTED and SKIPPED both begin a stage: once, in order, with nothing else still open
    if (seen !== undefined) {
      issues.add(
        here,
        'DUPLICATE',
        event.status === 'STARTED'
          ? `${event.stage} is started twice`
          : `${event.stage} is skipped after it began`
      );
    }
    if (position < highest) {
      issues.add(
        here,
        'NOT_SORTED',
        `${event.stage} comes after a later stage`
      );
    }
    const stillOpen = [...running].find(([, isOpen]) => isOpen)?.[0];
    if (stillOpen !== undefined) {
      issues.add(here, 'INCONSISTENT', `${stillOpen} is still open`);
    }
    highest = Math.max(highest, position);
    running.set(event.stage, event.status === 'STARTED');
  });

  const terminals = events.filter(isTerminal).length;
  if (terminals === 0) {
    issues.add('', 'REQUIRED', 'the stream has no terminal event');
  } else if (terminals > 1) {
    issues.add('', 'DUPLICATE', 'the stream has more than one terminal event');
  } else if (!isTerminal(events[last] as StreamEvent)) {
    issues.add(
      `[${last}]`,
      'INCONSISTENT',
      'the last event must be the terminal one'
    );
  }
  return issues.list;
}

// ---------------------------------------------------------------------------
// NDJSON framing
// ---------------------------------------------------------------------------

/** One event as one line: canonical JSON (keys in order) and a newline. */
export function encodeEvent(event: StreamEvent): string {
  return `${canonicalJson(event)}\n`;
}

export type StreamDecoding =
  | { ok: true; events: StreamEvent[] }
  | { ok: false; issues: Issue[]; events: StreamEvent[] };

/**
 * The events of the complete text of a response: every line a JSON object that passes
 * `validateStreamEvent`, then the order rules. A blank line, a line that is not JSON and a
 * text that does not end in a newline are reported (a half line is a cut stream).
 */
export function decodeStream(body: string): StreamDecoding {
  const issues = new Issues();
  const events: StreamEvent[] = [];
  if (body !== '' && !body.endsWith('\n')) {
    issues.add(
      '',
      'BAD_FORMAT',
      'the last line has no newline: the stream was cut'
    );
  }
  const lines = body.split('\n');
  if (lines[lines.length - 1] === '') lines.pop();
  lines.forEach((line, index) => {
    const here = `[${index}]`;
    let parsed: unknown;
    try {
      parsed = JSON.parse(line);
    } catch {
      issues.add(here, 'BAD_FORMAT', 'is not JSON');
      return;
    }
    const checked = validateStreamEvent(parsed);
    if (checked.ok) {
      events.push(checked.event);
    } else {
      for (const issue of checked.issues) {
        issues.add(
          `${here}${issue.path === '' ? '' : `.${issue.path}`}`,
          issue.code,
          issue.message
        );
      }
    }
  });
  if (!issues.any) {
    for (const issue of validateStreamOrder(events)) {
      issues.add(issue.path, issue.code, issue.message);
    }
  }
  return issues.any
    ? { ok: false, issues: issues.list, events }
    : { ok: true, events };
}
