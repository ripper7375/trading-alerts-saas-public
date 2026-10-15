/**
 * An in-memory model of the quota ledger's two tables, answering the store's statements.
 *
 * The store (`lib/platform/metering/ledger-store.ts`) speaks to the database in nine statements.
 * This model receives the same text and the same `$n` parameters and answers by the statement it
 * is asked (it compares with `LEDGER_SQL` and `REAP_SQL`, so a statement the store sends that the
 * model does not know is an error, never a silent pass). It applies what each statement does and
 * what the migration's CHECK constraints would refuse, so the always-run tests show the state
 * machine and the arithmetic. It is a MODEL, not the database: that the real PostgreSQL does the
 * same on every scenario is shown by `__tests__/reply/ledger.pg.spec.ts`, which runs the SAME
 * scenarios (`ledger-scenarios.ts`) against a real server, and what only a real server can show
 * (eight racing requests for the last units, a deleted user) is only there.
 *
 * It is single-threaded, so it cannot race; the statements are atomic in it by being plain code.
 */

import {
  LEDGER_SQL,
  type LedgerClient,
} from '@/lib/platform/metering/ledger-store';
import { REAP_SQL } from '@/lib/platform/metering/reaper';

export interface ModelPeriod {
  id: string;
  user_id: string;
  month: string;
  limit: number;
  used: number;
  reserved: number;
  created_at: Date;
  updated_at: Date;
}

export interface ModelReservation {
  request_id: string;
  user_id: string;
  period_id: string;
  reserved_units: number;
  status: 'RESERVED' | 'SETTLED' | 'RELEASED' | 'EXPIRED';
  actual_units: number | null;
  cost_micro_usd: number | null;
  model: string | null;
  prompt_tokens: number | null;
  completion_tokens: number | null;
  created_at: Date;
  updated_at: Date;
  expires_at: Date;
}

/** What a failed CHECK or key looks like to the store: PostgreSQL's SQLSTATE in `code`. */
export class ModelDatabaseError extends Error {
  constructor(
    readonly code: string,
    message: string
  ) {
    super(message);
  }
}

const MAX = 2_000_000_000;
const iso = (d: Date): string => d.toISOString();
const at = (value: unknown): Date => new Date(String(value));

const periodRow = (p: ModelPeriod) => ({
  id: p.id,
  user_id: p.user_id,
  month: p.month,
  limit: p.limit,
  used: p.used,
  reserved: p.reserved,
  created_at: iso(p.created_at),
  updated_at: iso(p.updated_at),
});

const reservationRow = (r: ModelReservation) => ({
  request_id: r.request_id,
  user_id: r.user_id,
  period_id: r.period_id,
  reserved_units: r.reserved_units,
  status: r.status,
  actual_units: r.actual_units,
  cost_micro_usd: r.cost_micro_usd,
  model: r.model,
  prompt_tokens: r.prompt_tokens,
  completion_tokens: r.completion_tokens,
  created_at: iso(r.created_at),
  updated_at: iso(r.updated_at),
  expires_at: iso(r.expires_at),
});

const after = (p: ModelPeriod) => ({
  period_limit: p.limit,
  period_used: p.used,
  period_reserved: p.reserved,
});

export class LedgerModel implements LedgerClient {
  readonly users = new Set<string>();
  readonly periods = new Map<string, ModelPeriod>();
  readonly reservations = new Map<string, ModelReservation>();
  /** every statement received, in order, as the text and its parameters */
  readonly calls: { sql: string; values: unknown[] }[] = [];
  private counter = 0;
  /** make the next statement of this text fail with this SQLSTATE (a raced insert, a gone user) */
  failNext: { sql: string; code: string } | null = null;

  addUser(id: string): string {
    this.users.add(id);
    return id;
  }

  /** What deleting a User does: the periods and their reservations go with it (ON DELETE CASCADE). */
  deleteUser(id: string): void {
    this.users.delete(id);
    for (const [key, p] of this.periods) {
      if (p.user_id === id) this.periods.delete(key);
    }
    for (const [key, r] of this.reservations) {
      if (r.user_id === id) this.reservations.delete(key);
    }
  }

  private periodKey = (user: string, month: string): string =>
    `${user}|${month}`;

  private periodById(id: string): ModelPeriod | undefined {
    return [...this.periods.values()].find((p) => p.id === id);
  }

  /** The migration's CHECK constraints on a period. */
  private checkPeriod(p: ModelPeriod): void {
    if (!/^[0-9]{4}-(0[1-9]|1[0-2])$/.test(p.month)) {
      throw new ModelDatabaseError(
        '23514',
        'ai_quota_periods_month_is_a_month'
      );
    }
    if (p.limit < 0 || p.limit > MAX) {
      throw new ModelDatabaseError(
        '23514',
        'ai_quota_periods_limit_is_bounded'
      );
    }
    if (p.used < 0) {
      throw new ModelDatabaseError(
        '23514',
        'ai_quota_periods_used_is_not_negative'
      );
    }
    if (p.reserved < 0) {
      throw new ModelDatabaseError(
        '23514',
        'ai_quota_periods_reserved_is_not_negative'
      );
    }
    if (p.used + p.reserved > p.limit) {
      throw new ModelDatabaseError(
        '23514',
        'ai_quota_periods_balance_fits_the_limit'
      );
    }
  }

  async $queryRawUnsafe<T = unknown>(
    sql: string,
    ...values: unknown[]
  ): Promise<T> {
    this.calls.push({ sql, values });
    if (this.failNext !== null && this.failNext.sql === sql) {
      const { code } = this.failNext;
      this.failNext = null;
      throw new ModelDatabaseError(code, `model failure ${code}`);
    }
    return this.run(sql, values) as T;
  }

  private run(sql: string, v: unknown[]): unknown[] {
    switch (sql) {
      case LEDGER_SQL.ensurePeriod:
        return this.ensurePeriod(v);
      case LEDGER_SQL.readPeriod: {
        const p = this.periods.get(this.periodKey(String(v[0]), String(v[1])));
        return p === undefined ? [] : [periodRow(p)];
      }
      case LEDGER_SQL.readReservation: {
        const r = this.reservations.get(String(v[0]));
        return r === undefined ? [] : [reservationRow(r)];
      }
      case LEDGER_SQL.reserve:
        return this.reserve(v);
      case LEDGER_SQL.settle:
        return this.settle(v);
      case LEDGER_SQL.release:
        return this.release(v);
      case LEDGER_SQL.audit:
        return this.audit(v);
      case REAP_SQL:
        return this.reap(v);
      default:
        throw new Error(
          `the model does not know this statement: ${sql.slice(0, 80)}`
        );
    }
  }

  private ensurePeriod(v: unknown[]): unknown[] {
    const [user, month, limit, now] = [
      String(v[0]),
      String(v[1]),
      Number(v[2]),
      at(v[3]),
    ];
    if (!this.users.has(user)) {
      throw new ModelDatabaseError('23503', 'ai_quota_periods_user_id_fkey');
    }
    const key = this.periodKey(user, month);
    const existing = this.periods.get(key);
    if (existing === undefined) {
      this.counter += 1;
      const p: ModelPeriod = {
        id: `period-${String(this.counter).padStart(6, '0')}`,
        user_id: user,
        month,
        limit,
        used: 0,
        reserved: 0,
        created_at: now,
        updated_at: now,
      };
      this.checkPeriod(p);
      this.periods.set(key, p);
      return [periodRow(p)];
    }
    if (limit > existing.limit) {
      existing.limit = limit;
      existing.updated_at = now;
    }
    return [periodRow(existing)];
  }

  private reserve(v: unknown[]): unknown[] {
    const [user, periodId, units, requestId, now, expires] = [
      String(v[0]),
      String(v[1]),
      Number(v[2]),
      String(v[3]),
      at(v[4]),
      at(v[5]),
    ];
    const p = this.periodById(periodId);
    if (p === undefined || p.user_id !== user) return [];
    if (this.reservations.has(requestId)) return [];
    if (p.used + p.reserved + units > p.limit) return [];
    if (!(expires > now)) {
      throw new ModelDatabaseError(
        '23514',
        'ai_usage_reservations_expires_after_it_began'
      );
    }
    p.reserved += units;
    p.updated_at = now;
    this.checkPeriod(p);
    const r: ModelReservation = {
      request_id: requestId,
      user_id: user,
      period_id: p.id,
      reserved_units: units,
      status: 'RESERVED',
      actual_units: null,
      cost_micro_usd: null,
      model: null,
      prompt_tokens: null,
      completion_tokens: null,
      created_at: now,
      updated_at: now,
      expires_at: expires,
    };
    this.reservations.set(requestId, r);
    return [{ ...reservationRow(r), ...after(p) }];
  }

  private settle(v: unknown[]): unknown[] {
    const requestId = String(v[0]);
    const user = String(v[1]);
    const actual = v[2] === null ? null : Number(v[2]);
    const now = at(v[7]);
    const r = this.reservations.get(requestId);
    if (
      r === undefined ||
      r.user_id !== user ||
      (r.status !== 'RESERVED' && r.status !== 'EXPIRED')
    ) {
      return [];
    }
    const p = this.periodById(r.period_id) as ModelPeriod;
    const release = r.status === 'RESERVED' ? r.reserved_units : 0;
    const room = Math.max(p.limit - p.used - (p.reserved - release), 0);
    const charge = Math.min(actual ?? r.reserved_units, room);
    p.used += charge;
    p.reserved -= release;
    p.updated_at = now;
    this.checkPeriod(p);
    r.status = 'SETTLED';
    r.actual_units = charge;
    r.cost_micro_usd = v[3] === null ? null : Number(v[3]);
    r.model = v[4] === null ? null : String(v[4]);
    r.prompt_tokens = v[5] === null ? null : Number(v[5]);
    r.completion_tokens = v[6] === null ? null : Number(v[6]);
    r.updated_at = now;
    return [{ ...reservationRow(r), ...after(p) }];
  }

  private release(v: unknown[]): unknown[] {
    const requestId = String(v[0]);
    const user = String(v[1]);
    const now = at(v[2]);
    const r = this.reservations.get(requestId);
    if (r === undefined || r.user_id !== user || r.status !== 'RESERVED') {
      return [];
    }
    const p = this.periodById(r.period_id) as ModelPeriod;
    p.reserved -= r.reserved_units;
    p.updated_at = now;
    this.checkPeriod(p);
    r.status = 'RELEASED';
    r.updated_at = now;
    return [{ ...reservationRow(r), ...after(p) }];
  }

  private audit(v: unknown[]): unknown[] {
    const p = this.periods.get(this.periodKey(String(v[0]), String(v[1])));
    if (p === undefined) return [];
    const mine = [...this.reservations.values()].filter(
      (r) => r.period_id === p.id
    );
    const sum = (
      rows: ModelReservation[],
      f: (r: ModelReservation) => number
    ) => String(rows.reduce((total, r) => total + f(r), 0));
    return [
      {
        limit: p.limit,
        used: p.used,
        reserved: p.reserved,
        held_by_reservations: sum(
          mine.filter((r) => r.status === 'RESERVED'),
          (r) => r.reserved_units
        ),
        charged_by_settlements: sum(
          mine.filter((r) => r.status === 'SETTLED'),
          (r) => r.actual_units ?? 0
        ),
      },
    ];
  }

  private reap(v: unknown[]): unknown[] {
    const now = at(v[0]);
    const batch = Number(v[1]);
    const byDeadline = (
      a: { expires_at: Date; request_id: string },
      b: { expires_at: Date; request_id: string }
    ): number =>
      a.expires_at.getTime() - b.expires_at.getTime() ||
      (a.request_id < b.request_id ? -1 : 1);
    const overdue = [...this.reservations.values()]
      .filter((r) => r.status === 'RESERVED' && r.expires_at < now)
      .sort(byDeadline);
    // one statement, one period: the period of the oldest due row, and only that period's due rows
    const first = overdue[0];
    const due =
      first === undefined
        ? []
        : overdue
            .filter((r) => r.period_id === first.period_id)
            .slice(0, batch);
    let units = 0;
    for (const r of due) {
      const p = this.periodById(r.period_id) as ModelPeriod;
      p.reserved -= r.reserved_units;
      p.updated_at = now;
      this.checkPeriod(p);
      r.status = 'EXPIRED';
      r.updated_at = now;
      units += r.reserved_units;
    }
    return [{ expired: due.length, units_returned: String(units) }];
  }
}
