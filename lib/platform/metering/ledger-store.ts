/**
 * The quota ledger in the database (build step 7 part 6; `ai_quota_periods` and
 * `ai_usage_reservations`; architecture 5.6 and 7.3, ADR-050, ADR-073; decisions D2 and D3).
 *
 * A unit is one micro-dollar of gateway cost, always a whole number (D2). A trader has one
 * `ai_quota_periods` row per UTC calendar month; a request holds units on it with ONE
 * reservation row keyed by the request id. This file is the only code that writes either table.
 *
 * WHY RAW SQL, AND WHY EACH FUNCTION IS ONE STATEMENT. The allowance check and the hold must be
 * the same act, or two requests racing for the last units could both pass the check and both
 * hold. So the reservation is
 *
 *   UPDATE ai_quota_periods SET reserved = reserved + :n
 *    WHERE id = :id AND used + reserved + :n <= limit      -- checked under the row lock
 *   RETURNING ...
 *
 * and the reservation row is inserted FROM that statement's RETURNING, in the same statement:
 * the row exists exactly when the units were held. PostgreSQL makes the second of two racing
 * requests wait for the first one's row lock, re-read the row and find it full; the first
 * request's INSERT of an existing request id fails on the primary key and takes its hold back
 * with it (the statement is atomic). Settle, release and the reaper are single statements for
 * the same reason: the reservation moves and the period's numbers move together or not at all,
 * with no transaction held across a network round trip (which also makes them safe behind
 * PgBouncer's transaction pooling). The statements are plain text with `$n` parameters, never
 * built from a value; a test reads every one of them for that.
 *
 * WHAT THE FUNCTIONS GUARANTEE
 *  - RESERVE holds `units` or refuses (`INSUFFICIENT`, with the balance). The same request id
 *    again finds the reservation it made (`replayed`), whatever its state now is, and holds
 *    nothing more. Another trader's request id is `REQUEST_ID_TAKEN`, never their row.
 *  - SETTLE is idempotent on the request id: the first settlement charges, every later one
 *    returns that charge unchanged. It charges the cost, up to what the balance has left after
 *    the reservation is given back (`LEAST(actual, limit - used - (reserved - held))`): the
 *    period's arithmetic can never be broken by a settlement, and a settlement can never fail
 *    for want of room. Cost beyond the balance is the business's (it is in `cost_micro_usd`, and
 *    `absorbed_units` reports it). An unknown cost (`actualUnits` null) charges the whole
 *    reservation: a paid call is never free. A RESERVED row settles; so does an EXPIRED one (the
 *    reaper gave its units back, and the late charge takes them again if they are still free).
 *  - RELEASE gives a RESERVED row's units back without a charge (a request that never reached
 *    the model). A row in any other state is left as it is.
 *  - AUDIT recomputes a period's `reserved` and `used` from its reservations: the invariant that
 *    no CHECK can see (the migration's header states it).
 *
 * Time is an argument (`nowMs`), never read here: the SQL has no `now()` and the module no
 * clock, so a test fixes the instant and the month boundary is exact. The ids are made by the
 * database (`gen_random_uuid()`), not by JavaScript.
 *
 * @module lib/platform/metering/ledger-store
 */

import 'server-only';

import { prisma } from '@/lib/db/prisma';

import { isInstant, isMonth } from './period';

// ---------------------------------------------------------------------------
// The bounds: the database's twin (the migration's CHECKs) and the contracts' ids
// ---------------------------------------------------------------------------

/** The most a period may allow, hold or charge: 2,000,000,000 units ($2,000), inside a 32-bit integer. */
export const MAX_LEDGER_UNITS = 2_000_000_000;

export const RESERVATION_STATUSES = [
  'RESERVED',
  'SETTLED',
  'RELEASED',
  'EXPIRED',
] as const;
export type ReservationStatus = (typeof RESERVATION_STATUSES)[number];

/** The shape of a request id (`lib/reply/contracts/fields.ts` ID; a test holds the two equal). */
export const LEDGER_REQUEST_ID = /^[A-Za-z0-9_-]{1,64}$/;
/** The shape of a model slug (`MODEL_SLUG` of the same file). */
export const LEDGER_MODEL_SLUG = /^[A-Za-z0-9][A-Za-z0-9._:/@+-]{0,119}$/;
const USER_ID_MAX = 128;

// ---------------------------------------------------------------------------
// The statements
// ---------------------------------------------------------------------------

const ISO = (column: string, alias: string): string =>
  `to_char(${column}, 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS "${alias}"`;

const PERIOD_COLUMNS = (p: string): string =>
  [
    `${p}."id" AS "id"`,
    `${p}."user_id" AS "user_id"`,
    `${p}."month" AS "month"`,
    `${p}."limit" AS "limit"`,
    `${p}."used" AS "used"`,
    `${p}."reserved" AS "reserved"`,
    ISO(`${p}."created_at"`, 'created_at'),
    ISO(`${p}."updated_at"`, 'updated_at'),
  ].join(', ');

const RESERVATION_COLUMNS = (r: string): string =>
  [
    `${r}."request_id" AS "request_id"`,
    `${r}."user_id" AS "user_id"`,
    `${r}."period_id" AS "period_id"`,
    `${r}."reserved_units" AS "reserved_units"`,
    `${r}."status" AS "status"`,
    `${r}."actual_units" AS "actual_units"`,
    `${r}."cost_micro_usd" AS "cost_micro_usd"`,
    `${r}."model" AS "model"`,
    `${r}."prompt_tokens" AS "prompt_tokens"`,
    `${r}."completion_tokens" AS "completion_tokens"`,
    ISO(`${r}."created_at"`, 'created_at'),
    ISO(`${r}."updated_at"`, 'updated_at'),
    ISO(`${r}."expires_at"`, 'expires_at'),
  ].join(', ');

/** The period's numbers after a statement, for a result that reports the balance. */
const PERIOD_AFTER = (m: string): string =>
  `${m}."period_limit" AS "period_limit", ${m}."period_used" AS "period_used", ${m}."period_reserved" AS "period_reserved"`;

const TS = (n: number): string => `($${n}::timestamptz AT TIME ZONE 'UTC')`;

/**
 * The statements, as text. Exported so a test can read them (no value is ever interpolated) and so
 * the in-memory model of the tests answers by the statement it is asked, not by a guess.
 */
export const LEDGER_SQL = {
  /** $1 user, $2 month, $3 limit, $4 now. Creates the month's row, or raises its limit (never lowers it). */
  ensurePeriod: `INSERT INTO "ai_quota_periods" AS p ("id", "user_id", "month", "limit", "used", "reserved", "created_at", "updated_at")
VALUES (gen_random_uuid()::text, $1::text, $2::text, $3::integer, 0, 0, ${TS(4)}, ${TS(4)})
ON CONFLICT ("user_id", "month") DO UPDATE
   SET "limit" = GREATEST(p."limit", EXCLUDED."limit"),
       "updated_at" = CASE WHEN EXCLUDED."limit" > p."limit" THEN EXCLUDED."updated_at" ELSE p."updated_at" END
RETURNING ${PERIOD_COLUMNS('p')}`,

  /** $1 user, $2 month. */
  readPeriod: `SELECT ${PERIOD_COLUMNS('p')}
  FROM "ai_quota_periods" p
 WHERE p."user_id" = $1::text AND p."month" = $2::text`,

  /** $1 request id. */
  readReservation: `SELECT ${RESERVATION_COLUMNS('r')}
  FROM "ai_usage_reservations" r
 WHERE r."request_id" = $1::text`,

  /** $1 user, $2 period id, $3 units, $4 request id, $5 now, $6 expires at. */
  reserve: `WITH args AS (
    SELECT $1::text AS "user_id", $2::text AS "period_id", $3::integer AS "units", $4::text AS "request_id",
           ${TS(5)} AS "now", ${TS(6)} AS "expires_at"
), bumped AS (
    UPDATE "ai_quota_periods" AS p
       SET "reserved" = p."reserved" + a."units",
           "updated_at" = a."now"
      FROM args a
     WHERE p."id" = a."period_id"
       AND p."user_id" = a."user_id"
       AND p."used"::bigint + p."reserved"::bigint + a."units"::bigint <= p."limit"::bigint
       AND NOT EXISTS (SELECT 1 FROM "ai_usage_reservations" e WHERE e."request_id" = a."request_id")
    RETURNING p."id" AS "period_id", p."user_id" AS "user_id",
              p."limit" AS "period_limit", p."used" AS "period_used", p."reserved" AS "period_reserved"
), made AS (
    INSERT INTO "ai_usage_reservations" ("request_id", "user_id", "period_id", "reserved_units", "status", "created_at", "updated_at", "expires_at")
    SELECT a."request_id", b."user_id", b."period_id", a."units", 'RESERVED', a."now", a."now", a."expires_at"
      FROM bumped b, args a
    RETURNING *
)
SELECT ${RESERVATION_COLUMNS('m')}, ${PERIOD_AFTER('b')}
  FROM made m
  JOIN bumped b ON b."period_id" = m."period_id"`,

  /**
   * $1 request id, $2 user, $3 actual units (null: the whole reservation), $4 cost, $5 model, $6 prompt
   * tokens, $7 completion tokens, $8 now.
   *
   * `calc` works the charge out from the period row `locked` holds, which is the NEWEST version. The
   * UPDATE in `moved` first meets the version its own snapshot sees, which can be older (a release or a
   * reaper run committed while this statement waited for its reservation row), and PostgreSQL checks the
   * CHECK constraints on that first try, before it follows the update chain. A charge that fits the
   * newest numbers can overshoot the older ones and fail `balance_fits_the_limit`, so `moved` caps the
   * charge by the version it updates. On the newest version, which is the one it ends up writing,
   * the cap is the same room `calc` used and takes nothing off.
   */
  settle: `WITH args AS (
    SELECT $1::text AS "request_id", $2::text AS "user_id", $3::integer AS "actual", $4::integer AS "cost",
           $5::text AS "model", $6::integer AS "prompt", $7::integer AS "completion", ${TS(8)} AS "now"
), target AS (
    SELECT r."request_id", r."period_id", r."status" AS "from_status", r."reserved_units"
      FROM "ai_usage_reservations" r, args a
     WHERE r."request_id" = a."request_id" AND r."user_id" = a."user_id" AND r."status" IN ('RESERVED', 'EXPIRED')
       FOR UPDATE OF r
), locked AS (
    SELECT p."id" AS "period_id", p."limit", p."used", p."reserved", t."from_status", t."reserved_units"
      FROM "ai_quota_periods" p
      JOIN target t ON t."period_id" = p."id"
       FOR UPDATE OF p
), calc AS (
    SELECT l."period_id",
           (CASE WHEN l."from_status" = 'RESERVED' THEN l."reserved_units" ELSE 0 END) AS "release",
           LEAST(
               COALESCE(a."actual", l."reserved_units")::bigint,
               GREATEST(
                   l."limit"::bigint - l."used"::bigint
                   - (l."reserved"::bigint - (CASE WHEN l."from_status" = 'RESERVED' THEN l."reserved_units" ELSE 0 END)::bigint),
                   0
               )
           ) AS "charge"
      FROM locked l, args a
), moved AS (
    UPDATE "ai_quota_periods" AS p
       SET "used" = p."used" + LEAST(
               c."charge",
               GREATEST(p."limit"::bigint - p."used"::bigint - (p."reserved"::bigint - c."release"::bigint), 0)
           )::integer,
           "reserved" = p."reserved" - c."release",
           "updated_at" = a."now"
      FROM calc c, args a
     WHERE p."id" = c."period_id"
    RETURNING p."id" AS "period_id", p."limit" AS "period_limit", p."used" AS "period_used", p."reserved" AS "period_reserved"
), settled AS (
    UPDATE "ai_usage_reservations" AS r
       SET "status" = 'SETTLED',
           "actual_units" = c."charge"::integer,
           "cost_micro_usd" = a."cost",
           "model" = a."model",
           "prompt_tokens" = a."prompt",
           "completion_tokens" = a."completion",
           "updated_at" = a."now"
      FROM calc c, args a, target t
     WHERE r."request_id" = t."request_id"
    RETURNING ${RESERVATION_COLUMNS('r')}
)
SELECT s.*, ${PERIOD_AFTER('m')}
  FROM settled s, moved m`,

  /** $1 request id, $2 user, $3 now. */
  release: `WITH args AS (
    SELECT $1::text AS "request_id", $2::text AS "user_id", ${TS(3)} AS "now"
), target AS (
    SELECT r."request_id", r."period_id", r."reserved_units"
      FROM "ai_usage_reservations" r, args a
     WHERE r."request_id" = a."request_id" AND r."user_id" = a."user_id" AND r."status" = 'RESERVED'
       FOR UPDATE OF r
), moved AS (
    UPDATE "ai_quota_periods" AS p
       SET "reserved" = p."reserved" - t."reserved_units",
           "updated_at" = a."now"
      FROM target t, args a
     WHERE p."id" = t."period_id"
    RETURNING p."id" AS "period_id", p."limit" AS "period_limit", p."used" AS "period_used", p."reserved" AS "period_reserved"
), released AS (
    UPDATE "ai_usage_reservations" AS r
       SET "status" = 'RELEASED',
           "updated_at" = a."now"
      FROM target t, args a
     WHERE r."request_id" = t."request_id"
    RETURNING ${RESERVATION_COLUMNS('r')}
)
SELECT s.*, ${PERIOD_AFTER('m')}
  FROM released s, moved m`,

  /** $1 user, $2 month. Sums are text: a bigint would come back as a BigInt. */
  audit: `SELECT p."limit" AS "limit", p."used" AS "used", p."reserved" AS "reserved",
       COALESCE((SELECT SUM(r."reserved_units") FROM "ai_usage_reservations" r WHERE r."period_id" = p."id" AND r."status" = 'RESERVED'), 0)::text AS "held_by_reservations",
       COALESCE((SELECT SUM(r."actual_units") FROM "ai_usage_reservations" r WHERE r."period_id" = p."id" AND r."status" = 'SETTLED'), 0)::text AS "charged_by_settlements"
  FROM "ai_quota_periods" p
 WHERE p."user_id" = $1::text AND p."month" = $2::text`,
} as const;

// ---------------------------------------------------------------------------
// The client and the rows
// ---------------------------------------------------------------------------

/** The part of the database client the ledger uses; the real generated client fits with no cast. */
export interface LedgerClient {
  $queryRawUnsafe<T = unknown>(query: string, ...values: unknown[]): Promise<T>;
}

export interface LedgerStoreOptions {
  client?: LedgerClient;
}

export interface PeriodRow {
  id: string;
  user_id: string;
  month: string;
  limit: number;
  used: number;
  reserved: number;
  created_at: Date;
  updated_at: Date;
}

export interface ReservationRow {
  request_id: string;
  user_id: string;
  period_id: string;
  reserved_units: number;
  status: ReservationStatus;
  actual_units: number | null;
  cost_micro_usd: number | null;
  model: string | null;
  prompt_tokens: number | null;
  completion_tokens: number | null;
  created_at: Date;
  updated_at: Date;
  expires_at: Date;
}

/** A period's numbers: `available` is what a new request may still hold. */
export interface Balance {
  limit: number;
  used: number;
  reserved: number;
  available: number;
}

export function balanceOf(period: {
  limit: number;
  used: number;
  reserved: number;
}): Balance {
  return {
    limit: period.limit,
    used: period.used,
    reserved: period.reserved,
    available: Math.max(period.limit - period.used - period.reserved, 0),
  };
}

type Raw = Record<string, unknown>;

const isRecord = (value: unknown): value is Raw =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

function int(value: unknown, what: string): number {
  const number =
    typeof value === 'bigint'
      ? Number(value)
      : typeof value === 'string' && /^-?\d+$/.test(value)
        ? Number(value)
        : value;
  if (typeof number !== 'number' || !Number.isSafeInteger(number)) {
    throw new Error(`ledger: ${what} is not a whole number`);
  }
  return number;
}

const optionalInt = (value: unknown, what: string): number | null =>
  value === null || value === undefined ? null : int(value, what);

function date(value: unknown, what: string): Date {
  const parsed = typeof value === 'string' ? new Date(value) : null;
  if (parsed === null || Number.isNaN(parsed.getTime())) {
    throw new Error(`ledger: ${what} is not a time`);
  }
  return parsed;
}

function text(value: unknown, what: string): string {
  if (typeof value !== 'string') throw new Error(`ledger: ${what} is not text`);
  return value;
}

export function periodFrom(raw: unknown): PeriodRow {
  if (!isRecord(raw)) throw new Error('ledger: a period row is not an object');
  return {
    id: text(raw['id'], 'id'),
    user_id: text(raw['user_id'], 'user_id'),
    month: text(raw['month'], 'month'),
    limit: int(raw['limit'], 'limit'),
    used: int(raw['used'], 'used'),
    reserved: int(raw['reserved'], 'reserved'),
    created_at: date(raw['created_at'], 'created_at'),
    updated_at: date(raw['updated_at'], 'updated_at'),
  };
}

export function reservationFrom(raw: unknown): ReservationRow {
  if (!isRecord(raw)) {
    throw new Error('ledger: a reservation row is not an object');
  }
  const status = raw['status'];
  if (
    typeof status !== 'string' ||
    !(RESERVATION_STATUSES as readonly string[]).includes(status)
  ) {
    throw new Error('ledger: a reservation has a status that is not known');
  }
  return {
    request_id: text(raw['request_id'], 'request_id'),
    user_id: text(raw['user_id'], 'user_id'),
    period_id: text(raw['period_id'], 'period_id'),
    reserved_units: int(raw['reserved_units'], 'reserved_units'),
    status: status as ReservationStatus,
    actual_units: optionalInt(raw['actual_units'], 'actual_units'),
    cost_micro_usd: optionalInt(raw['cost_micro_usd'], 'cost_micro_usd'),
    model:
      raw['model'] === null || raw['model'] === undefined
        ? null
        : text(raw['model'], 'model'),
    prompt_tokens: optionalInt(raw['prompt_tokens'], 'prompt_tokens'),
    completion_tokens: optionalInt(
      raw['completion_tokens'],
      'completion_tokens'
    ),
    created_at: date(raw['created_at'], 'created_at'),
    updated_at: date(raw['updated_at'], 'updated_at'),
    expires_at: date(raw['expires_at'], 'expires_at'),
  };
}

/** The period's numbers a statement returned beside its row (the row itself was read, and checked to be an object, first). */
function afterFrom(raw: Raw): Balance {
  return balanceOf({
    limit: int(raw['period_limit'], 'period_limit'),
    used: int(raw['period_used'], 'period_used'),
    reserved: int(raw['period_reserved'], 'period_reserved'),
  });
}

// ---------------------------------------------------------------------------
// Errors of the database that mean something here
// ---------------------------------------------------------------------------

/**
 * Whether an error carries a PostgreSQL SQLSTATE. The driver adapter wraps the database's error
 * (Prisma's P2010 with the adapter's own error in `meta` and `cause`), so the state is looked for
 * in the places it can be: `code`, `originalCode`, `meta`, `cause`, and the message.
 */
function hasSqlState(error: unknown, state: string, depth = 0): boolean {
  if (depth > 5 || typeof error !== 'object' || error === null) return false;
  const e = error as Raw;
  for (const key of ['code', 'originalCode', 'sqlState']) {
    if (e[key] === state) return true;
  }
  for (const key of ['meta', 'cause', 'driverAdapterError']) {
    if (hasSqlState(e[key], state, depth + 1)) return true;
  }
  return typeof e['message'] === 'string' && e['message'].includes(state);
}

export const isUniqueViolation = (error: unknown): boolean =>
  hasSqlState(error, '23505') ||
  (typeof error === 'object' &&
    error !== null &&
    (error as Raw)['code'] === 'P2002');

export const isForeignKeyViolation = (error: unknown): boolean =>
  hasSqlState(error, '23503');

// ---------------------------------------------------------------------------
// Input checks
// ---------------------------------------------------------------------------

const isUser = (value: unknown): value is string =>
  typeof value === 'string' && value !== '' && value.length <= USER_ID_MAX;

const isRequestId = (value: unknown): value is string =>
  typeof value === 'string' && LEDGER_REQUEST_ID.test(value);

const isUnits = (value: unknown, min: number): value is number =>
  typeof value === 'number' &&
  Number.isSafeInteger(value) &&
  value >= min &&
  value <= MAX_LEDGER_UNITS;

const iso = (ms: number): string => new Date(ms).toISOString();

export type LedgerInputProblem =
  | 'USER'
  | 'REQUEST_ID'
  | 'MONTH'
  | 'LIMIT'
  | 'UNITS'
  | 'NOW'
  | 'EXPIRY'
  | 'ACTUAL_UNITS'
  | 'COST'
  | 'MODEL'
  | 'TOKENS';

export interface BadInput {
  ok: false;
  code: 'BAD_INPUT';
  problems: LedgerInputProblem[];
}

const bad = (problems: LedgerInputProblem[]): BadInput => ({
  ok: false,
  code: 'BAD_INPUT',
  problems,
});

// ---------------------------------------------------------------------------
// The period
// ---------------------------------------------------------------------------

export interface EnsurePeriodInput {
  userId: string;
  /** `YYYY-MM`, from `monthOf(nowMs)` */
  month: string;
  /** the month's allowance in units; an existing row's limit is raised to it, never lowered */
  limit: number;
  nowMs: number;
}

export type EnsurePeriodResult =
  | { ok: true; period: PeriodRow }
  | { ok: false; code: 'USER_NOT_FOUND' }
  | BadInput;

/** The trader's row for a month: created with `limit` on the first request, raised if `limit` is now higher. */
export async function ensurePeriod(
  input: EnsurePeriodInput,
  options: LedgerStoreOptions = {}
): Promise<EnsurePeriodResult> {
  const problems: LedgerInputProblem[] = [];
  if (!isUser(input.userId)) problems.push('USER');
  if (!isMonth(input.month)) problems.push('MONTH');
  if (!isUnits(input.limit, 0)) problems.push('LIMIT');
  if (!isInstant(input.nowMs)) problems.push('NOW');
  if (problems.length > 0) return bad(problems);
  const client: LedgerClient = options.client ?? prisma;
  try {
    const rows = await client.$queryRawUnsafe<unknown[]>(
      LEDGER_SQL.ensurePeriod,
      input.userId,
      input.month,
      input.limit,
      iso(input.nowMs)
    );
    return { ok: true, period: periodFrom(rows[0]) };
  } catch (error) {
    if (isForeignKeyViolation(error))
      return { ok: false, code: 'USER_NOT_FOUND' };
    throw error;
  }
}

/** The trader's row for a month, or null when none has been made. */
export async function readPeriod(
  userId: string,
  month: string,
  options: LedgerStoreOptions = {}
): Promise<PeriodRow | null> {
  if (!isUser(userId) || !isMonth(month)) return null;
  const client: LedgerClient = options.client ?? prisma;
  const rows = await client.$queryRawUnsafe<unknown[]>(
    LEDGER_SQL.readPeriod,
    userId,
    month
  );
  return rows.length === 0 ? null : periodFrom(rows[0]);
}

// ---------------------------------------------------------------------------
// Reserve
// ---------------------------------------------------------------------------

export interface ReserveInput {
  requestId: string;
  userId: string;
  /** the month of `nowMs` */
  month: string;
  /** the month's allowance (creates the row, or raises its limit) */
  limit: number;
  /** the worst case to hold, at least 1 */
  units: number;
  nowMs: number;
  /** after this instant a RESERVED row is the reaper's */
  expiresAtMs: number;
}

export type ReserveResult =
  | {
      ok: true;
      /** true: the request id had a reservation already (a retry); nothing more was held */
      replayed: boolean;
      reservation: ReservationRow;
      /** the period after the hold; null on a replay */
      balance: Balance | null;
    }
  | { ok: false; code: 'INSUFFICIENT'; balance: Balance }
  | { ok: false; code: 'REQUEST_ID_TAKEN' }
  | { ok: false; code: 'USER_NOT_FOUND' }
  | BadInput;

/** Hold `units` for a request, or refuse with the balance. One atomic statement holds the units and makes the row. */
export async function reserveUnits(
  input: ReserveInput,
  options: LedgerStoreOptions = {}
): Promise<ReserveResult> {
  const problems: LedgerInputProblem[] = [];
  if (!isRequestId(input.requestId)) problems.push('REQUEST_ID');
  if (!isUser(input.userId)) problems.push('USER');
  if (!isMonth(input.month)) problems.push('MONTH');
  if (!isUnits(input.limit, 0)) problems.push('LIMIT');
  if (!isUnits(input.units, 1)) problems.push('UNITS');
  if (!isInstant(input.nowMs)) problems.push('NOW');
  if (!isInstant(input.expiresAtMs) || !(input.expiresAtMs > input.nowMs)) {
    problems.push('EXPIRY');
  }
  if (problems.length > 0) return bad(problems);
  const client: LedgerClient = options.client ?? prisma;

  const ensured = await ensurePeriod(
    {
      userId: input.userId,
      month: input.month,
      limit: input.limit,
      nowMs: input.nowMs,
    },
    { client }
  );
  if (!ensured.ok) return ensured;
  const period = ensured.period;

  /** What a request id that already has a row means to this caller. */
  const existing = async (): Promise<ReserveResult | null> => {
    const rows = await client.$queryRawUnsafe<unknown[]>(
      LEDGER_SQL.readReservation,
      input.requestId
    );
    if (rows.length === 0) return null;
    const reservation = reservationFrom(rows[0]);
    if (reservation.user_id !== input.userId) {
      return { ok: false, code: 'REQUEST_ID_TAKEN' };
    }
    return { ok: true, replayed: true, reservation, balance: null };
  };

  let rows: unknown[];
  try {
    rows = await client.$queryRawUnsafe<unknown[]>(
      LEDGER_SQL.reserve,
      input.userId,
      period.id,
      input.units,
      input.requestId,
      iso(input.nowMs),
      iso(input.expiresAtMs)
    );
  } catch (error) {
    // two requests with one id raced: the second one's hold was taken back with its insert
    if (isUniqueViolation(error)) {
      const found = await existing();
      if (found !== null) return found;
    }
    if (isForeignKeyViolation(error))
      return { ok: false, code: 'USER_NOT_FOUND' };
    throw error;
  }

  if (rows.length > 0) {
    return {
      ok: true,
      replayed: false,
      reservation: reservationFrom(rows[0]),
      balance: afterFrom(rows[0] as Raw),
    };
  }

  // nothing was held: a retry of a request that has its row, or a balance too small
  const found = await existing();
  if (found !== null) return found;
  const fresh = await readPeriod(input.userId, input.month, { client });
  return {
    ok: false,
    code: 'INSUFFICIENT',
    balance: balanceOf(fresh ?? period),
  };
}

// ---------------------------------------------------------------------------
// Settle
// ---------------------------------------------------------------------------

export interface SettleInput {
  requestId: string;
  userId: string;
  /** the cost in units; null charges the whole reservation (the cost is not known, and a paid call is not free) */
  actualUnits: number | null;
  /** the gateway's cost in micro-dollars, null when it could not say */
  costMicroUsd: number | null;
  model: string | null;
  promptTokens: number | null;
  completionTokens: number | null;
  nowMs: number;
}

export type SettleResult =
  | {
      ok: true;
      /** true: the request had been settled already; the first settlement stands */
      replayed: boolean;
      reservation: ReservationRow;
      /** the period after the settlement; null on a replay */
      balance: Balance | null;
      /** units the cost was above what could be charged (the business's, not the trader's); 0 when none or unknown */
      absorbedUnits: number;
    }
  | { ok: false; code: 'NOT_FOUND' }
  | { ok: false; code: 'ALREADY_RELEASED' }
  | BadInput;

/** Settle a reservation for what was spent. Idempotent on the request id. */
export async function settleReservation(
  input: SettleInput,
  options: LedgerStoreOptions = {}
): Promise<SettleResult> {
  const problems: LedgerInputProblem[] = [];
  if (!isRequestId(input.requestId)) problems.push('REQUEST_ID');
  if (!isUser(input.userId)) problems.push('USER');
  if (input.actualUnits !== null && !isUnits(input.actualUnits, 0)) {
    problems.push('ACTUAL_UNITS');
  }
  if (input.costMicroUsd !== null && !isUnits(input.costMicroUsd, 0)) {
    problems.push('COST');
  }
  if (
    input.model !== null &&
    !(typeof input.model === 'string' && LEDGER_MODEL_SLUG.test(input.model))
  ) {
    problems.push('MODEL');
  }
  for (const tokens of [input.promptTokens, input.completionTokens]) {
    if (tokens !== null && !isUnits(tokens, 0)) problems.push('TOKENS');
  }
  if (!isInstant(input.nowMs)) problems.push('NOW');
  if (problems.length > 0) return bad([...new Set(problems)]);
  const client: LedgerClient = options.client ?? prisma;

  const rows = await client.$queryRawUnsafe<unknown[]>(
    LEDGER_SQL.settle,
    input.requestId,
    input.userId,
    input.actualUnits,
    input.costMicroUsd,
    input.model,
    input.promptTokens,
    input.completionTokens,
    iso(input.nowMs)
  );
  if (rows.length > 0) {
    const reservation = reservationFrom(rows[0]);
    const charged = reservation.actual_units ?? 0;
    return {
      ok: true,
      replayed: false,
      reservation,
      balance: afterFrom(rows[0] as Raw),
      absorbedUnits:
        input.actualUnits === null
          ? 0
          : Math.max(input.actualUnits - charged, 0),
    };
  }

  // nothing moved: settled before (a retry), released (never settled), or not this trader's
  const found = await client.$queryRawUnsafe<unknown[]>(
    LEDGER_SQL.readReservation,
    input.requestId
  );
  if (found.length === 0) return { ok: false, code: 'NOT_FOUND' };
  const reservation = reservationFrom(found[0]);
  if (reservation.user_id !== input.userId) {
    return { ok: false, code: 'NOT_FOUND' };
  }
  if (reservation.status === 'SETTLED') {
    return {
      ok: true,
      replayed: true,
      reservation,
      balance: null,
      absorbedUnits: 0,
    };
  }
  // RELEASED is final (it said no model was called)
  if (reservation.status === 'RELEASED') {
    return { ok: false, code: 'ALREADY_RELEASED' };
  }
  // a RESERVED or EXPIRED row is settleable and the statement would have moved it: say so loudly
  throw new Error(
    `ledger: settle moved nothing for a ${reservation.status} reservation`
  );
}

// ---------------------------------------------------------------------------
// Release
// ---------------------------------------------------------------------------

export interface ReleaseInput {
  requestId: string;
  userId: string;
  nowMs: number;
}

export type ReleaseResult =
  | {
      ok: true;
      /** false: the row was not RESERVED (released, settled or expired already), and is as it was */
      changed: boolean;
      reservation: ReservationRow;
      balance: Balance | null;
    }
  | { ok: false; code: 'NOT_FOUND' }
  | BadInput;

/** Give a RESERVED row's units back with no charge (the request never reached the model). */
export async function releaseReservation(
  input: ReleaseInput,
  options: LedgerStoreOptions = {}
): Promise<ReleaseResult> {
  const problems: LedgerInputProblem[] = [];
  if (!isRequestId(input.requestId)) problems.push('REQUEST_ID');
  if (!isUser(input.userId)) problems.push('USER');
  if (!isInstant(input.nowMs)) problems.push('NOW');
  if (problems.length > 0) return bad(problems);
  const client: LedgerClient = options.client ?? prisma;

  const rows = await client.$queryRawUnsafe<unknown[]>(
    LEDGER_SQL.release,
    input.requestId,
    input.userId,
    iso(input.nowMs)
  );
  if (rows.length > 0) {
    return {
      ok: true,
      changed: true,
      reservation: reservationFrom(rows[0]),
      balance: afterFrom(rows[0] as Raw),
    };
  }
  const found = await client.$queryRawUnsafe<unknown[]>(
    LEDGER_SQL.readReservation,
    input.requestId
  );
  if (found.length === 0) return { ok: false, code: 'NOT_FOUND' };
  const reservation = reservationFrom(found[0]);
  if (reservation.user_id !== input.userId) {
    return { ok: false, code: 'NOT_FOUND' };
  }
  return { ok: true, changed: false, reservation, balance: null };
}

// ---------------------------------------------------------------------------
// Audit
// ---------------------------------------------------------------------------

export interface AuditResult {
  /** true when the period's numbers are what its reservations add up to */
  consistent: boolean;
  problems: string[];
  limit: number;
  used: number;
  reserved: number;
  heldByReservations: number;
  chargedBySettlements: number;
}

/** Recompute a period's `reserved` and `used` from its reservations; null when the period does not exist. */
export async function auditPeriod(
  userId: string,
  month: string,
  options: LedgerStoreOptions = {}
): Promise<AuditResult | null> {
  if (!isUser(userId) || !isMonth(month)) return null;
  const client: LedgerClient = options.client ?? prisma;
  const rows = await client.$queryRawUnsafe<unknown[]>(
    LEDGER_SQL.audit,
    userId,
    month
  );
  if (rows.length === 0) return null;
  const row = rows[0] as Raw;
  const limit = int(row['limit'], 'limit');
  const used = int(row['used'], 'used');
  const reserved = int(row['reserved'], 'reserved');
  const held = int(row['held_by_reservations'], 'held_by_reservations');
  const charged = int(row['charged_by_settlements'], 'charged_by_settlements');
  const problems: string[] = [];
  if (reserved !== held) {
    problems.push(
      `reserved ${reserved} is not the ${held} its reservations hold`
    );
  }
  if (used !== charged) {
    problems.push(`used ${used} is not the ${charged} its settlements charged`);
  }
  if (used + reserved > limit) {
    problems.push(
      `used + reserved ${used + reserved} is above the limit ${limit}`
    );
  }
  return {
    consistent: problems.length === 0,
    problems,
    limit,
    used,
    reserved,
    heldByReservations: held,
    chargedBySettlements: charged,
  };
}
