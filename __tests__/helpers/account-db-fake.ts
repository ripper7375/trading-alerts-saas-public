/**
 * An in-memory stand-in for the part of the database a session-version bump (CODE-02B) touches:
 * the `User` rows, the `RefreshToken` rows and a transaction.
 *
 * A plain `jest.fn()` per delegate cannot show the two things the order asks for at every site:
 * that the new version and the deleted refresh tokens commit TOGETHER with the security write, and
 * that a failed write leaves the version alone. This fake really applies `{ increment }` to a
 * column, really deletes rows by their `where`, and really rolls a transaction back, so a test can
 * read the rows after the call instead of reading the call.
 *
 * Every statement is written to `log`, prefixed `tx:` when it ran inside `$transaction`, so a test
 * can also show that no security statement ran outside one.
 */

export type Row = Record<string, unknown>;
type Where = Record<string, unknown>;

/** Deep copy that keeps Dates as Dates. */
function clone<T>(value: T): T {
  if (value instanceof Date) return new Date(value) as T;
  if (Array.isArray(value)) return value.map(clone) as T;
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [key, clone(entry)])
    ) as T;
  }
  return value;
}

function matches(row: Row, where: Where): boolean {
  return Object.entries(where).every(([key, condition]) => {
    const value = row[key];
    if (condition instanceof Date) {
      return value instanceof Date && value.getTime() === condition.getTime();
    }
    return value === condition;
  });
}

function isIncrement(value: unknown): value is { increment: number } {
  return (
    typeof value === 'object' &&
    value !== null &&
    !(value instanceof Date) &&
    'increment' in value
  );
}

function applyData(row: Row, data: Row): void {
  for (const [column, value] of Object.entries(data)) {
    if (value === undefined) continue;
    row[column] = isIncrement(value)
      ? Number(row[column] ?? 0) + Number(value.increment)
      : value;
  }
}

function project(row: Row, select?: Record<string, boolean>): Row {
  if (!select) return clone(row);
  return Object.fromEntries(
    Object.entries(select)
      .filter(([, wanted]) => wanted)
      .map(([column]) => [column, clone(row[column])])
  );
}

export interface AccountDbFake {
  /** The delegates a route or service reaches through `prisma` or a transaction client. */
  client: {
    user: {
      findUnique: (args: {
        where: Where;
        select?: Record<string, boolean>;
      }) => Promise<Row | null>;
      findFirst: (args: {
        where: Where;
        select?: Record<string, boolean>;
      }) => Promise<Row | null>;
      update: (args: {
        where: Where;
        data: Row;
        select?: Record<string, boolean>;
      }) => Promise<Row>;
      updateMany: (args: {
        where: Where;
        data: Row;
      }) => Promise<{ count: number }>;
    };
    refreshToken: {
      deleteMany: (args: { where: Where }) => Promise<{ count: number }>;
    };
  };
  /** Interactive transaction: commits when the callback resolves, restores every row when it throws. */
  $transaction: <T>(
    callback: (tx: AccountDbFake['client']) => Promise<T>
  ) => Promise<T>;
  /** Every statement and transaction marker, in order; statements inside a transaction start with `tx:`. */
  log: string[];
  /** The next statement of this kind (for example `user.update`) throws once. */
  failNext: (operation: string, error?: Error) => void;
  /**
   * Runs once, just before the next transaction commits, as another request would: its reads see
   * the rows as they were BEFORE the transaction (read committed), not the transaction's own writes.
   */
  beforeNextCommit: (fn: () => Promise<void>) => void;
  /** The writes (`user.update`, `user.updateMany`, `refreshToken.deleteMany`) that ran outside a transaction. */
  writesOutsideTransaction: () => string[];
  user: (id: string) => Row;
  refreshTokensOf: (userId: string) => Row[];
}

export function createAccountDbFake(
  initial: { users?: Row[]; refreshTokens?: Row[] } = {}
): AccountDbFake {
  const state = {
    users: (initial.users ?? []).map(clone),
    refreshTokens: (initial.refreshTokens ?? []).map(clone),
  };
  const log: string[] = [];
  const failures = new Map<string, Error>();
  let depth = 0;
  let beforeCommit: (() => Promise<void>) | null = null;
  /** While another request reads in the middle of a transaction: the rows as last committed. */
  let committedView: Row[] | null = null;

  function step<T>(operation: string, action: () => T): T {
    log.push(depth > 0 ? `tx:${operation}` : operation);
    const failure = failures.get(operation);
    if (failure) {
      failures.delete(operation);
      throw failure;
    }
    return action();
  }

  const client: AccountDbFake['client'] = {
    user: {
      findUnique: async ({ where, select }) =>
        step('user.findUnique', () => {
          const row = (committedView ?? state.users).find((user) =>
            matches(user, where)
          );
          return row ? project(row, select) : null;
        }),
      findFirst: async ({ where, select }) =>
        step('user.findFirst', () => {
          const row = (committedView ?? state.users).find((user) =>
            matches(user, where)
          );
          return row ? project(row, select) : null;
        }),
      update: async ({ where, data, select }) =>
        step('user.update', () => {
          const row = state.users.find((user) => matches(user, where));
          if (!row) {
            throw Object.assign(new Error('Record to update not found.'), {
              code: 'P2025',
            });
          }
          applyData(row, data);
          return project(row, select);
        }),
      updateMany: async ({ where, data }) =>
        step('user.updateMany', () => {
          const rows = state.users.filter((user) => matches(user, where));
          for (const row of rows) applyData(row, data);
          return { count: rows.length };
        }),
    },
    refreshToken: {
      deleteMany: async ({ where }) =>
        step('refreshToken.deleteMany', () => {
          const before = state.refreshTokens.length;
          state.refreshTokens = state.refreshTokens.filter(
            (token) => !matches(token, where)
          );
          return { count: before - state.refreshTokens.length };
        }),
    },
  };

  const $transaction: AccountDbFake['$transaction'] = async (callback) => {
    const snapshot = {
      users: state.users.map(clone),
      refreshTokens: state.refreshTokens.map(clone),
    };
    log.push('begin');
    depth += 1;
    try {
      const result = await callback(client);
      if (beforeCommit) {
        const concurrent = beforeCommit;
        beforeCommit = null;
        committedView = snapshot.users;
        try {
          await concurrent();
        } finally {
          committedView = null;
        }
      }
      log.push('commit');
      return result;
    } catch (error) {
      state.users = snapshot.users;
      state.refreshTokens = snapshot.refreshTokens;
      log.push('rollback');
      throw error;
    } finally {
      depth -= 1;
    }
  };

  return {
    client,
    $transaction,
    log,
    failNext: (operation, error = new Error(`${operation} failed`)) => {
      failures.set(operation, error);
    },
    beforeNextCommit: (fn) => {
      beforeCommit = fn;
    },
    writesOutsideTransaction: () =>
      log.filter((entry) =>
        ['user.update', 'user.updateMany', 'refreshToken.deleteMany'].includes(
          entry
        )
      ),
    user: (id) => {
      const row = state.users.find((user) => user['id'] === id);
      if (!row) throw new Error(`no user ${id} in the fake`);
      return clone(row);
    },
    refreshTokensOf: (userId) =>
      state.refreshTokens
        .filter((token) => token['userId'] === userId)
        .map(clone),
  };
}
