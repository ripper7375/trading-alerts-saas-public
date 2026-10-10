/**
 * An in-memory stand-in for the three audit tables, shaped like the delegates of
 * the generated Prisma client that the stores use (`ProfileStoreClient` and
 * `ConsentStoreClient`). It checks nothing the database checks: what the database
 * refuses is shown by the gated spec against a real PostgreSQL. What it does give a
 * unit test is the exact calls the stores make, a `$transaction` that really rolls
 * back, and one switch per failure.
 */

import type {
  ConsentCreateData,
  ConsentStoreClient,
} from '@/lib/engine4/store/consent-store';
import type {
  PreferencesRow,
  ProfileColumns,
  ProfileStoreClient,
  ProfileTx,
} from '@/lib/engine4/store/profile-store';

export type HistoryRow = ProfileColumns & {
  id: string;
  user_id: string | null;
  user_id_hash: string;
  key_version: number;
};

export type PrefsRow = PreferencesRow & { user_id: string };

export interface FakeDb {
  history: HistoryRow[];
  prefs: Map<string, PrefsRow>;
  consents: (ConsentCreateData & { id: string; recorded_at: Date })[];
  /** every delegate call, in order: `history.create`, `prefs.upsert`, ... */
  calls: string[];
  /** a switch per failure */
  failUpsert: boolean;
  failConsentCreate: boolean;
  transactions: number;
}

export function newDb(): FakeDb {
  return {
    history: [],
    prefs: new Map(),
    consents: [],
    calls: [],
    failUpsert: false,
    failConsentCreate: false,
    transactions: 0,
  };
}

export const NOW = new Date('2026-10-10T08:00:00.000Z');

/**
 * What the database does with `select`: only the columns marked `true` come back. A
 * stand-in that returned the whole row would let a `select` list that forgot a column
 * pass every unit test.
 */
function pick<T extends object>(row: T, select: Record<string, boolean>): T {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row)) {
    if (select[key] === true) out[key] = value;
  }
  return out as T;
}

export type FakeClient = ProfileStoreClient &
  ConsentStoreClient & { db: FakeDb };

export function fakeClient(db: FakeDb = newDb()): FakeClient {
  let consentSeq = 0;
  const tx: ProfileTx & ConsentStoreClient = {
    userTradePreferencesHistory: {
      create: async ({ data }) => {
        db.calls.push('history.create');
        db.history.push({ ...data });
        return data;
      },
      findUnique: async ({ where, select }) => {
        db.calls.push('history.findUnique');
        const row = db.history.find((r) => r.id === where.id);
        return row === undefined ? null : pick({ ...row }, select);
      },
    },
    userTradePreferences: {
      findUnique: async ({ where, select }) => {
        db.calls.push('prefs.findUnique');
        const row = db.prefs.get(where.user_id);
        return row === undefined ? null : pick({ ...row }, select);
      },
      upsert: async ({ where, create, update }) => {
        db.calls.push('prefs.upsert');
        if (db.failUpsert) throw new Error('the upsert failed');
        const current = db.prefs.get(where.user_id);
        const next: PrefsRow =
          current === undefined
            ? { ...create, updated_at: NOW }
            : { ...current, ...update, updated_at: NOW };
        db.prefs.set(where.user_id, next);
        return next;
      },
    },
    tradeConsentRecord: {
      create: async ({ data, select }) => {
        db.calls.push('consent.create');
        if (db.failConsentCreate) throw new Error('the create failed');
        consentSeq += 1;
        const row = {
          ...data,
          id: `consent-${consentSeq}`,
          recorded_at: NOW,
        };
        db.consents.push(row);
        return pick({ id: row.id, recorded_at: row.recorded_at }, select);
      },
    },
  };

  return {
    db,
    ...tx,
    $transaction: async <T>(fn: (t: ProfileTx) => Promise<T>): Promise<T> => {
      db.transactions += 1;
      const history = db.history.slice();
      const prefs = new Map(db.prefs);
      try {
        return await fn(tx);
      } catch (error) {
        db.history = history;
        db.prefs = prefs;
        throw error;
      }
    },
  };
}
