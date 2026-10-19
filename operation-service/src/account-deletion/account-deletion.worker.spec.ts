import { Logger } from '@nestjs/common';

import type { PrismaService } from '../prisma/prisma.service';
import { AccountDeletionWorker } from './account-deletion.worker';
import { BillingCanceller } from './billing-canceller';

/**
 * The worker against an in-memory database that really applies the `where` clauses it is given
 * (equality, lte, gt, OR, the two relation filters on DrawingAlert) and really rolls a transaction
 * back. A plain jest.fn() per delegate cannot show that a request under 24 h is left alone or that
 * the User row survives; this can.
 */
type Row = Record<string, unknown>;
type Where = Record<string, unknown>;

const HOUR = 60 * 60 * 1000;
const NOW = new Date('2026-10-20T12:00:00.000Z');

/** Deep copy that keeps Dates as Dates (structuredClone returns outer-realm Dates under Jest). */
function cloneRows<T>(value: T): T {
  if (value instanceof Date) return new Date(value) as T;
  if (Array.isArray(value)) return value.map(cloneRows) as T;
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([k, v]) => [k, cloneRows(v)])
    ) as T;
  }
  return value;
}

class FakeDb {
  tables: Record<string, Row[]> = {
    accountDeletionRequest: [],
    user: [],
    account: [],
    payment: [],
    commission: [],
    alert: [],
    drawing: [],
    drawingAlert: [],
    notification: [],
    session: [],
    refreshToken: [],
    userSession: [],
  };
  failOn: string | null = null;
  /** What `updatedAt` is stamped with: the test sets it to the time of the run it drives. */
  clock: Date = NOW;
  /** Runs once, right after the next findMany: lets a test interleave another actor. */
  afterFindMany: (() => void) | null = null;

  private matches(row: Row, where: Where): boolean {
    return Object.entries(where).every(([key, cond]) => {
      if (key === 'OR') {
        return (cond as Where[]).some((branch) => this.matches(row, branch));
      }
      if (key === 'alert') {
        return this.tables['alert']!.some(
          (a) => a['id'] === row['alertId'] && this.matches(a, cond as Where)
        );
      }
      if (key === 'drawing') {
        return this.tables['drawing']!.some(
          (d) => d['id'] === row['drawingId'] && this.matches(d, cond as Where)
        );
      }
      const value = row[key];
      if (
        cond !== null &&
        typeof cond === 'object' &&
        !(cond instanceof Date)
      ) {
        const op = cond as Record<string, Date>;
        if ('lte' in op) return value instanceof Date && value <= op['lte']!;
        if ('gt' in op) return value instanceof Date && value > op['gt']!;
        throw new Error(`unsupported operator ${Object.keys(op).join(',')}`);
      }
      return value === cond;
    });
  }

  delegate(name: string) {
    const rows = () => this.tables[name]!;
    return {
      findMany: async (args: { where: Where; take?: number }) => {
        const found = rows().filter((r) => this.matches(r, args.where));
        found.sort(
          (a, b) =>
            ((a['confirmedAt'] as Date | undefined)?.getTime() ?? 0) -
            ((b['confirmedAt'] as Date | undefined)?.getTime() ?? 0)
        );
        const result = found
          .slice(0, args.take ?? found.length)
          .map((r) => ({ ...r }));
        const hook = this.afterFindMany;
        this.afterFindMany = null;
        hook?.();
        return result;
      },
      findUnique: async (args: { where: { userId?: string; id?: string } }) => {
        const key = args.where.userId !== undefined ? 'userId' : 'id';
        const found = rows().find((r) => r[key] === args.where[key]);
        return found ? { ...found } : null;
      },
      updateMany: async (args: { where: Where; data: Row }) => {
        this.maybeFail(`${name}.updateMany`);
        const hit = rows().filter((r) => this.matches(r, args.where));
        for (const r of hit) {
          Object.assign(r, args.data);
          if (name === 'accountDeletionRequest') {
            r['updatedAt'] = new Date(this.clock);
          }
        }
        return { count: hit.length };
      },
      deleteMany: async (args: { where: Where }) => {
        this.maybeFail(`${name}.deleteMany`);
        const keep = rows().filter((r) => !this.matches(r, args.where));
        const count = rows().length - keep.length;
        this.tables[name] = keep;
        return { count };
      },
    };
  }

  private maybeFail(op: string): void {
    if (this.failOn === op) throw new Error(`injected failure at ${op}`);
  }

  client(): PrismaService {
    const client: Record<string, unknown> = {
      $transaction: async (callback: (tx: unknown) => Promise<unknown>) => {
        const before = cloneRows(this.tables);
        try {
          return await callback(client);
        } catch (error) {
          this.tables = before; // all or nothing
          throw error;
        }
      },
    };
    for (const name of Object.keys(this.tables)) {
      Object.defineProperty(client, name, {
        get: () => this.delegate(name),
      });
    }
    return client as unknown as PrismaService;
  }
}

function seed(
  db: FakeDb,
  userId: string,
  confirmedHoursAgo: number,
  status = 'CONFIRMED'
) {
  const confirmedAt = new Date(NOW.getTime() - confirmedHoursAgo * HOUR);
  db.tables['accountDeletionRequest']!.push({
    id: `req-${userId}`,
    userId,
    token: `token-of-${userId}`,
    status,
    confirmedAt,
    updatedAt: confirmedAt,
  });
  db.tables['user']!.push({
    id: userId,
    email: `${userId}@private.example`,
    name: `Name of ${userId}`,
    isActive: false,
    deletedAt: null,
  });
  db.tables['account']!.push({ id: `acc-${userId}`, userId });
  db.tables['payment']!.push({ id: `pay-${userId}`, userId });
  db.tables['commission']!.push({ id: `com-${userId}`, userId });
  db.tables['alert']!.push(
    { id: `alert-${userId}-1`, userId },
    { id: `alert-${userId}-2`, userId }
  );
  db.tables['drawing']!.push({ id: `drw-${userId}`, userId });
  db.tables['drawingAlert']!.push({
    id: `da-${userId}`,
    drawingId: `drw-${userId}`,
    alertId: `alert-${userId}-1`,
  });
  db.tables['notification']!.push(
    { id: `n-${userId}-1`, userId },
    { id: `n-${userId}-2`, userId }
  );
  db.tables['session']!.push({ id: `s-${userId}`, userId });
  db.tables['refreshToken']!.push({ id: `rt-${userId}`, userId });
  db.tables['userSession']!.push({
    id: `us-${userId}`,
    userId,
    isActive: true,
  });
}

function untouched(db: FakeDb, userId: string): boolean {
  return (
    db.tables['alert']!.some((r) => r['userId'] === userId) &&
    db.tables['drawing']!.some((r) => r['userId'] === userId) &&
    db.tables['notification']!.some((r) => r['userId'] === userId) &&
    db.tables['drawingAlert']!.some((r) => r['id'] === `da-${userId}`) &&
    db.tables['user']!.find((r) => r['id'] === userId)!['deletedAt'] === null
  );
}

function requestStatus(db: FakeDb, userId: string): unknown {
  return db.tables['accountDeletionRequest']!.find(
    (r) => r['userId'] === userId
  )!['status'];
}

describe('AccountDeletionWorker', () => {
  let db: FakeDb;
  let cancelForUser: jest.Mock;
  let worker: AccountDeletionWorker;
  let logCalls: unknown[][];

  beforeEach(() => {
    db = new FakeDb();
    cancelForUser = jest
      .fn()
      .mockResolvedValue({ stripeSubscriptionsCanceled: 1 });
    const billing = { cancelForUser } as unknown as BillingCanceller;
    worker = new AccountDeletionWorker(db.client(), billing);

    logCalls = [];
    for (const level of ['log', 'warn', 'error'] as const) {
      jest
        .spyOn(Logger.prototype, level)
        .mockImplementation((...args: unknown[]) => {
          logCalls.push(args);
        });
    }
  });

  afterEach(() => jest.restoreAllMocks());

  describe('which requests it picks up', () => {
    it('skips a request confirmed under 24 h ago and touches nothing of the user', async () => {
      seed(db, 'u-recent', 23);

      const summary = await worker.processDueRequests(NOW);

      expect(summary).toEqual({ due: 0, completed: 0, skipped: 0, failed: 0 });
      expect(cancelForUser).not.toHaveBeenCalled();
      expect(requestStatus(db, 'u-recent')).toBe('CONFIRMED');
      expect(untouched(db, 'u-recent')).toBe(true);
    });

    it('picks up a request confirmed exactly 24 h ago', async () => {
      seed(db, 'u-edge', 24);

      const summary = await worker.processDueRequests(NOW);

      expect(summary.completed).toBe(1);
    });

    it('ignores PENDING, CANCELLED and COMPLETED requests however old', async () => {
      seed(db, 'u-pending', 100, 'PENDING');
      seed(db, 'u-cancelled', 100, 'CANCELLED');
      seed(db, 'u-completed', 100, 'COMPLETED');

      const summary = await worker.processDueRequests(NOW);

      expect(summary.due).toBe(0);
      expect(cancelForUser).not.toHaveBeenCalled();
      expect(untouched(db, 'u-cancelled')).toBe(true);
    });

    it('handles only batchSize requests per run, oldest first', async () => {
      seed(db, 'u-old', 50);
      seed(db, 'u-mid', 40);
      seed(db, 'u-new', 30);

      const summary = await worker.processDueRequests(NOW, 2);

      expect(summary.due).toBe(2);
      expect(requestStatus(db, 'u-old')).toBe('COMPLETED');
      expect(requestStatus(db, 'u-mid')).toBe('COMPLETED');
      expect(requestStatus(db, 'u-new')).toBe('CONFIRMED');
    });
  });

  describe('a request that is due', () => {
    beforeEach(() => {
      seed(db, 'u1', 25);
      // Another user's data must survive.
      seed(db, 'bystander', 1);
    });

    it('cancels billing for that user before it removes anything', async () => {
      cancelForUser.mockImplementation(async () => {
        // At the moment billing is stopped the artifacts are still there.
        expect(db.tables['alert']!.some((r) => r['userId'] === 'u1')).toBe(
          true
        );
        return { stripeSubscriptionsCanceled: 1 };
      });

      await worker.processDueRequests(NOW);

      expect(cancelForUser).toHaveBeenCalledTimes(1);
      expect(cancelForUser).toHaveBeenCalledWith('u1');
    });

    it('deletes the live artifacts: drawing alerts, alerts, drawings, notifications', async () => {
      await worker.processDueRequests(NOW);

      const gone = (table: string) =>
        db.tables[table]!.filter((r) => r['userId'] === 'u1').length;
      expect(gone('alert')).toBe(0);
      expect(gone('drawing')).toBe(0);
      expect(gone('notification')).toBe(0);
      expect(db.tables['drawingAlert']!.some((r) => r['id'] === 'da-u1')).toBe(
        false
      );
    });

    it('signs the user out again (sessions, refresh tokens, device sessions)', async () => {
      await worker.processDueRequests(NOW);

      expect(db.tables['session']!.some((r) => r['userId'] === 'u1')).toBe(
        false
      );
      expect(db.tables['refreshToken']!.some((r) => r['userId'] === 'u1')).toBe(
        false
      );
      expect(
        db.tables['userSession']!.find((r) => r['userId'] === 'u1')!['isActive']
      ).toBe(false);
    });

    it('keeps the User row for the admin: isActive false, deletedAt stamped', async () => {
      await worker.processDueRequests(NOW);

      const user = db.tables['user']!.find((r) => r['id'] === 'u1');
      expect(user).toBeDefined();
      expect(user).toMatchObject({
        id: 'u1',
        email: 'u1@private.example',
        isActive: false,
        deletedAt: NOW,
      });
    });

    it('keeps Account, Payment and Commission (accounting and admin inspection)', async () => {
      await worker.processDueRequests(NOW);

      for (const table of ['account', 'payment', 'commission']) {
        expect(db.tables[table]!.some((r) => r['userId'] === 'u1')).toBe(true);
      }
    });

    it('marks the request COMPLETED with the time', async () => {
      const summary = await worker.processDueRequests(NOW);

      expect(summary).toEqual({ due: 1, completed: 1, skipped: 0, failed: 0 });
      const request = db.tables['accountDeletionRequest']!.find(
        (r) => r['userId'] === 'u1'
      );
      expect(request).toMatchObject({ status: 'COMPLETED', completedAt: NOW });
    });

    it('leaves every other user alone', async () => {
      await worker.processDueRequests(NOW);

      expect(untouched(db, 'bystander')).toBe(true);
      expect(requestStatus(db, 'bystander')).toBe('CONFIRMED');
      expect(cancelForUser).not.toHaveBeenCalledWith('bystander');
    });

    it('logs ids and counts only: no address, no name, no token', async () => {
      await worker.processDueRequests(NOW);

      const logged = JSON.stringify(logCalls);
      expect(logged).toContain('req-u1');
      expect(logged).not.toContain('@');
      expect(logged).not.toContain('private.example');
      expect(logged).not.toContain('Name of');
      expect(logged).not.toContain('token-of-');
    });
  });

  describe('when billing cannot be cancelled', () => {
    it('removes nothing, releases the request for the next run and does not stop the others', async () => {
      seed(db, 'u-billing', 30);
      seed(db, 'u-fine', 26);
      cancelForUser.mockImplementation(async (userId: string) => {
        if (userId === 'u-billing') throw new Error('stripe is down');
        return { stripeSubscriptionsCanceled: 0 };
      });

      const summary = await worker.processDueRequests(NOW);

      expect(summary).toEqual({ due: 2, completed: 1, skipped: 0, failed: 1 });
      expect(untouched(db, 'u-billing')).toBe(true);
      expect(requestStatus(db, 'u-billing')).toBe('CONFIRMED');
      expect(requestStatus(db, 'u-fine')).toBe('COMPLETED');
    });

    it('picks the same request up again on the next run and completes it once billing works', async () => {
      seed(db, 'u1', 30);
      cancelForUser.mockRejectedValueOnce(new Error('stripe is down'));

      await worker.processDueRequests(NOW);
      expect(requestStatus(db, 'u1')).toBe('CONFIRMED');

      const second = await worker.processDueRequests(NOW);
      expect(second.completed).toBe(1);
      expect(requestStatus(db, 'u1')).toBe('COMPLETED');
    });
  });

  describe('when the database step fails after billing was cancelled', () => {
    it('rolls everything back, keeps the claim and completes after the claim goes stale', async () => {
      seed(db, 'u1', 30);
      db.failOn = 'notification.deleteMany';

      const first = await worker.processDueRequests(NOW);

      expect(first.failed).toBe(1);
      expect(untouched(db, 'u1')).toBe(true); // alerts, drawings and drawing alerts came back
      expect(requestStatus(db, 'u1')).toBe('PROCESSING');

      // Soon after: still claimed, not taken over.
      db.failOn = null;
      const soon = await worker.processDueRequests(
        new Date(NOW.getTime() + 10 * 60 * 1000)
      );
      expect(soon.due).toBe(0);

      // Past the stale window: taken over, billing asked again (idempotent), completed.
      const later = await worker.processDueRequests(
        new Date(NOW.getTime() + 31 * 60 * 1000)
      );
      expect(later.completed).toBe(1);
      expect(cancelForUser).toHaveBeenCalledTimes(2);
      expect(requestStatus(db, 'u1')).toBe('COMPLETED');
    });
  });

  describe('races with a cancel or another worker', () => {
    it('does nothing when the request is cancelled between the search and the claim', async () => {
      seed(db, 'u1', 30);
      db.afterFindMany = () => {
        db.tables['accountDeletionRequest']![0]!['status'] = 'CANCELLED';
      };

      const summary = await worker.processDueRequests(NOW);

      expect(summary).toEqual({ due: 1, completed: 0, skipped: 1, failed: 0 });
      expect(cancelForUser).not.toHaveBeenCalled();
      expect(untouched(db, 'u1')).toBe(true);
      expect(requestStatus(db, 'u1')).toBe('CANCELLED');
    });

    it('does nothing when another worker claimed the request first', async () => {
      seed(db, 'u1', 30);
      db.afterFindMany = () => {
        const request = db.tables['accountDeletionRequest']![0]!;
        request['status'] = 'PROCESSING';
        request['updatedAt'] = new Date(NOW); // a fresh claim, not a stale one
      };

      const summary = await worker.processDueRequests(NOW);

      expect(summary.skipped).toBe(1);
      expect(cancelForUser).not.toHaveBeenCalled();
      expect(untouched(db, 'u1')).toBe(true);
    });

    it('takes over a PROCESSING claim older than 30 minutes (a crashed worker)', async () => {
      seed(db, 'u1', 30, 'PROCESSING');
      db.tables['accountDeletionRequest']![0]!['updatedAt'] = new Date(
        NOW.getTime() - 31 * 60 * 1000
      );

      const summary = await worker.processDueRequests(NOW);

      expect(summary.completed).toBe(1);
      expect(requestStatus(db, 'u1')).toBe('COMPLETED');
    });

    it('leaves a PROCESSING claim younger than 30 minutes to the worker that holds it', async () => {
      seed(db, 'u1', 30, 'PROCESSING');
      db.tables['accountDeletionRequest']![0]!['updatedAt'] = new Date(
        NOW.getTime() - 5 * 60 * 1000
      );

      const summary = await worker.processDueRequests(NOW);

      expect(summary.due).toBe(0);
      expect(cancelForUser).not.toHaveBeenCalled();
    });
  });

  describe('a request whose user row is already gone', () => {
    it('still completes the request and cancels nothing it cannot find', async () => {
      seed(db, 'u-ghost', 30);
      db.tables['user'] = [];

      const summary = await worker.processDueRequests(NOW);

      expect(summary.completed).toBe(1);
      expect(requestStatus(db, 'u-ghost')).toBe('COMPLETED');
    });
  });
});
