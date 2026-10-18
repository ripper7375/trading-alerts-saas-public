/**
 * The retention plan (architecture 7.5, ADR-076; build step 7 decisions D17 and D18).
 *
 *  - TRACES: 90 days live in PostgreSQL, then archived, and the archive keeps them 7 years.
 *    A live row is due for the archive when it is 90 days old and has not been archived.
 *    Its live copy may be deleted when it is archived AND 90 days old, never before: the
 *    database trigger of `request_traces` refuses a DELETE of an unarchived row, and this
 *    planner never offers one. Until the archive exists (D17: its writer is built when the
 *    vault exists) every row stays, which is the point.
 *  - CHAT MESSAGES: 12 months from each message's own time; a trader's delete removes a
 *    thread at once (the store), an account deletion removes everything (the foreign key).
 *
 * `planRetention` is PURE: it reads rows and a clock the caller gives, and says which ids to
 * archive, which live copies to delete and which messages to delete. No job calls it in
 * step 7; the archive and the job come with the vault (runbook S7). A row that cannot be
 * judged (created in the future, archived before it existed) is a `problem`, never an action.
 *
 * @module lib/platform/traces/retention
 */

import 'server-only';

/** Days a trace stays in PostgreSQL before it is due for the archive. */
export const TRACE_LIVE_DAYS = 90;
/** Years the archive keeps a trace (ADR-076). */
export const TRACE_ARCHIVE_YEARS = 7;
/** Months a chat message is kept (decision D18). */
export const CHAT_RETENTION_MONTHS = 12;

const DAY_MS = 86_400_000;

/** `date` plus `months` calendar months in UTC; a day that does not exist is clamped (31 Jan + 1 month is 28 or 29 Feb). */
export function addUtcMonths(date: Date, months: number): Date {
  // `Date.UTC` carries a month outside 0 to 11 into the year, so no division is needed
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth() + months;
  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  return new Date(
    Date.UTC(
      year,
      month,
      Math.min(date.getUTCDate(), lastDay),
      date.getUTCHours(),
      date.getUTCMinutes(),
      date.getUTCSeconds(),
      date.getUTCMilliseconds()
    )
  );
}

/** When a chat message made at `createdAt` expires. */
export function messageExpiry(createdAt: Date): Date {
  return addUtcMonths(createdAt, CHAT_RETENTION_MONTHS);
}

/** The date a trace made at `createdAt` must be kept until, in the write-once archive. */
export function traceArchiveUntil(createdAt: Date): Date {
  return addUtcMonths(createdAt, TRACE_ARCHIVE_YEARS * 12);
}

export interface TraceRetentionRow {
  requestId: string;
  createdAt: Date;
  archivedAt: Date | null;
}

export interface MessageRetentionRow {
  id: string;
  expiresAt: Date;
}

export type RetentionProblemCode =
  | 'CREATED_IN_THE_FUTURE'
  | 'ARCHIVED_BEFORE_CREATED'
  | 'ARCHIVED_IN_THE_FUTURE'
  | 'INVALID_DATE';

export interface RetentionProblem {
  kind: 'TRACE' | 'MESSAGE';
  id: string;
  code: RetentionProblemCode;
}

export interface RetentionInput {
  now: Date;
  traces: readonly TraceRetentionRow[];
  messages: readonly MessageRetentionRow[];
  /** at most this many ids per list, oldest first; a job works in batches */
  limit?: number;
}

export interface RetentionPlan {
  /** requests to write to the archive: 90 days old and not archived yet, oldest first */
  archive: { requestId: string; keepUntil: Date }[];
  /** requests whose live copy may now be deleted: archived and 90 days old, oldest first */
  deleteLive: string[];
  /** chat messages past their expiry, oldest first */
  deleteMessages: string[];
  /** how many traces need nothing yet */
  traceKept: number;
  problems: RetentionProblem[];
}

const valid = (date: Date): boolean => Number.isFinite(date.getTime());

/** What is due, given the rows and the clock. Never mutates its input. */
export function planRetention(input: RetentionInput): RetentionPlan {
  const { now } = input;
  if (!valid(now)) throw new RangeError('now is not a valid date');
  const limit = input.limit ?? Number.POSITIVE_INFINITY;
  if (!(limit >= 1)) throw new RangeError('limit is at least 1');
  const cutoff = now.getTime() - TRACE_LIVE_DAYS * DAY_MS;

  const problems: RetentionProblem[] = [];
  const archive: { requestId: string; keepUntil: Date; at: number }[] = [];
  const deleteLive: { requestId: string; at: number }[] = [];
  let kept = 0;

  for (const row of input.traces) {
    const created = row.createdAt.getTime();
    if (
      !valid(row.createdAt) ||
      (row.archivedAt !== null && !valid(row.archivedAt))
    ) {
      problems.push({ kind: 'TRACE', id: row.requestId, code: 'INVALID_DATE' });
      continue;
    }
    if (created > now.getTime()) {
      problems.push({
        kind: 'TRACE',
        id: row.requestId,
        code: 'CREATED_IN_THE_FUTURE',
      });
      continue;
    }
    if (row.archivedAt !== null) {
      if (row.archivedAt.getTime() < created) {
        problems.push({
          kind: 'TRACE',
          id: row.requestId,
          code: 'ARCHIVED_BEFORE_CREATED',
        });
        continue;
      }
      if (row.archivedAt.getTime() > now.getTime()) {
        problems.push({
          kind: 'TRACE',
          id: row.requestId,
          code: 'ARCHIVED_IN_THE_FUTURE',
        });
        continue;
      }
    }
    if (created > cutoff) {
      kept += 1;
    } else if (row.archivedAt === null) {
      archive.push({
        requestId: row.requestId,
        keepUntil: traceArchiveUntil(row.createdAt),
        at: created,
      });
    } else {
      deleteLive.push({ requestId: row.requestId, at: created });
    }
  }

  const expired: { id: string; at: number }[] = [];
  for (const message of input.messages) {
    if (!valid(message.expiresAt)) {
      problems.push({ kind: 'MESSAGE', id: message.id, code: 'INVALID_DATE' });
    } else if (message.expiresAt.getTime() <= now.getTime()) {
      expired.push({ id: message.id, at: message.expiresAt.getTime() });
    }
  }

  const oldest = <T extends { at: number }>(
    rows: T[],
    key: (row: T) => string
  ): T[] =>
    [...rows]
      .sort((a, b) => a.at - b.at || (key(a) < key(b) ? -1 : 1))
      .slice(0, limit);

  return {
    archive: oldest(archive, (r) => r.requestId).map(
      ({ requestId, keepUntil }) => ({
        requestId,
        keepUntil,
      })
    ),
    deleteLive: oldest(deleteLive, (r) => r.requestId).map((r) => r.requestId),
    deleteMessages: oldest(expired, (r) => r.id).map((r) => r.id),
    traceKept: kept,
    problems,
  };
}
