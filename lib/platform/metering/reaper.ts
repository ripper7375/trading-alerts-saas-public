/**
 * The reaper of the quota ledger (build step 7 part 6; architecture 7.3; the plan's part 6 risk
 * note: "the reaper favours the trader").
 *
 * A request holds units from the moment it reserves them to the moment it settles or releases
 * them. A request that is killed in between (a function timeout, a crash, a lost connection) never
 * does either, and its units would stay held for the rest of the month. Each reservation has a
 * deadline (`expires_at`, the request deadline plus a margin); this releases every RESERVED row
 * whose deadline is before `nowMs`.
 *
 * ONE STATEMENT, ONE PERIOD. A statement takes the period of the oldest due row and expires that
 * period's due rows (at most `remaining` of them): the rows become EXPIRED and the period's
 * `reserved` goes down by the sum of their units, together or not at all. `reapExpired` repeats the
 * statement, period after period, until it has used its batch or nothing is due. The statement does
 * not take several periods at once because PostgreSQL 18.1 loses the period update of such a
 * statement when it has to follow a concurrent change of that period (the rows became EXPIRED and the
 * units never went back; a load test lost about half of the period updates). With one period in the
 * statement it lost none. See the environment gotchas, "an UPDATE ... FROM a multi-row CTE".
 *
 * It favours the trader: an expired reservation is given back, not charged. What that costs the
 * business is not hidden. A request that was killed after its model call has a cost the ledger
 * never saw, and `request_traces` is where the cost of a call is kept; a late settlement can still
 * charge an EXPIRED row (the store's `settleReservation` accepts it) if the units are still free.
 *
 * Safe to run from several places at once: `FOR UPDATE SKIP LOCKED` hands each run a different
 * set of rows. A run can stop early when every due row it can see is held by somebody else; the
 * next run does the rest. Run it from one scheduler.
 *
 * The caller passes the time and decides how often to run it (the runbook's S4 sets it up); this
 * file reads no clock.
 *
 * @module lib/platform/metering/reaper
 */

import { prisma } from '@/lib/db/prisma';

import type { LedgerClient, LedgerStoreOptions } from './ledger-store';
import { isInstant } from './period';

/** The most rows one call expires; a bigger backlog is finished by the next call. */
export const REAP_BATCH_DEFAULT = 500;
export const REAP_BATCH_MAX = 5_000;

/**
 * $1 now, $2 the most rows this statement expires. The result has one row: how many rows expired
 * and how many units went back. `first_due` picks (and locks) the oldest due row nobody holds; `due`
 * takes the due rows of THAT row's period.
 */
export const REAP_SQL = `WITH args AS (
    SELECT (CAST($1 AS timestamptz) AT TIME ZONE 'UTC') AS "now"
), first_due AS (
    SELECT r."period_id" AS "period_id"
      FROM "ai_usage_reservations" r, args a
     WHERE r."status" = 'RESERVED' AND r."expires_at" < a."now"
     ORDER BY r."expires_at", r."request_id"
     LIMIT 1
       FOR UPDATE OF r SKIP LOCKED
), due AS (
    SELECT r."request_id", r."period_id", r."reserved_units"
      FROM "ai_usage_reservations" r, args a, first_due f
     WHERE r."status" = 'RESERVED' AND r."expires_at" < a."now" AND r."period_id" = f."period_id"
     ORDER BY r."expires_at", r."request_id"
     LIMIT CAST($2 AS integer)
       FOR UPDATE OF r SKIP LOCKED
), marked AS (
    UPDATE "ai_usage_reservations" AS r
       SET "status" = 'EXPIRED',
           "updated_at" = a."now"
      FROM due d, args a
     WHERE r."request_id" = d."request_id"
    RETURNING r."period_id" AS "period_id", r."reserved_units" AS "reserved_units"
), per_period AS (
    SELECT m."period_id" AS "period_id", SUM(m."reserved_units")::integer AS "units", COUNT(*)::integer AS "n"
      FROM marked m
     GROUP BY m."period_id"
), moved AS (
    UPDATE "ai_quota_periods" AS p
       SET "reserved" = p."reserved" - pp."units",
           "updated_at" = a."now"
      FROM per_period pp, args a
     WHERE p."id" = pp."period_id"
    RETURNING p."id" AS "id"
)
SELECT COALESCE(SUM(pp."n"), 0)::integer AS "expired", COALESCE(SUM(pp."units"), 0)::text AS "units_returned"
  FROM per_period pp`;

export interface ReapResult {
  ok: true;
  /** reservations that became EXPIRED */
  expired: number;
  /** units given back to the periods */
  unitsReturned: number;
}

export type ReapOutcome =
  | ReapResult
  | { ok: false; code: 'BAD_INPUT'; problems: ('NOW' | 'BATCH')[] };

/** What one statement says it did. */
function readRow(rows: unknown[]): { expired: number; units: number } {
  const row = rows[0];
  if (typeof row !== 'object' || row === null) {
    throw new Error('ledger: the reaper returned no result row');
  }
  const { expired, units_returned: returned } = row as Record<string, unknown>;
  const count = Number(expired);
  const units = Number(returned);
  if (
    !Number.isSafeInteger(count) ||
    !Number.isSafeInteger(units) ||
    count < 0 ||
    units < 0
  ) {
    throw new Error('ledger: the reaper result is not whole numbers');
  }
  return { expired: count, units };
}

/**
 * Release the reservations whose deadline passed before `nowMs`: at most `batch` of them, a period
 * at a time (one statement per period), oldest deadline first.
 */
export async function reapExpired(
  nowMs: number,
  options: LedgerStoreOptions & { batch?: number } = {}
): Promise<ReapOutcome> {
  const batch = options.batch ?? REAP_BATCH_DEFAULT;
  const problems: ('NOW' | 'BATCH')[] = [];
  if (!isInstant(nowMs)) problems.push('NOW');
  if (!Number.isInteger(batch) || batch < 1 || batch > REAP_BATCH_MAX) {
    problems.push('BATCH');
  }
  if (problems.length > 0) return { ok: false, code: 'BAD_INPUT', problems };
  const client: LedgerClient = options.client ?? prisma;
  const now = new Date(nowMs).toISOString();
  let remaining = batch;
  let expired = 0;
  let unitsReturned = 0;
  while (remaining > 0) {
    const done = readRow(
      await client.$queryRawUnsafe<unknown[]>(REAP_SQL, now, remaining)
    );
    if (done.expired === 0) break;
    expired += done.expired;
    unitsReturned += done.units;
    remaining -= done.expired;
  }
  return { ok: true, expired, unitsReturned };
}
