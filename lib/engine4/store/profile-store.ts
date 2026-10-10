/**
 * The trader's profile in the database (architecture 6.2, 6.11): the CURRENT
 * profile in `user_trade_preferences` (one row per user) and an append-only
 * snapshot of every change in `user_trade_preferences_history`.
 *
 * The profile is validated by `validateProfile` before anything is written, so
 * the figures stored are the canonical decimal text the engine returns, never a
 * float and never rounded. A change writes the snapshot and moves the current row
 * to it in ONE transaction, with the keyed hash of the user id (`user-hash.ts`)
 * and the version of the key beside it. Saving the profile the trader already has
 * writes nothing and returns the snapshot it already is: a snapshot is a change,
 * and the consent record carries its own time.
 *
 * The history is never updated or deleted from here (the database refuses it, and
 * `store-guard.test.ts` keeps this file from trying).
 *
 * @module lib/engine4/store/profile-store
 */

import { randomUUID } from 'crypto';

import { prisma } from '@/lib/db/prisma';

import { validateProfile } from '../profile';
import type { ProfileIssue, TraderProfile, TraderProfileInput } from '../types';
import { hashUserId, resolveAuditKey } from './user-hash';
import type { AuditKey } from './user-hash';

/** The eight metrics as the tables hold them (canonical decimal text). */
export interface ProfileColumns {
  trader_type: string;
  style: string;
  max_risk_pct: string;
  max_leverage: string;
  target_rrr: string;
  equity: string;
  min_sld: string;
  commission: string;
}

export interface PreferencesRow extends ProfileColumns {
  snapshot_id: string;
  updated_at: Date;
}

/** The delegates a transaction uses; the real generated client fits with no cast, a test passes its own. */
export interface ProfileTx {
  userTradePreferencesHistory: {
    create(args: {
      data: ProfileColumns & {
        id: string;
        user_id: string;
        user_id_hash: string;
        key_version: number;
      };
    }): Promise<unknown>;
  };
  userTradePreferences: {
    findUnique(args: {
      where: { user_id: string };
      select: Record<keyof PreferencesRow, true>;
    }): Promise<PreferencesRow | null>;
    upsert(args: {
      where: { user_id: string };
      create: ProfileColumns & { user_id: string; snapshot_id: string };
      update: ProfileColumns & { snapshot_id: string };
    }): Promise<unknown>;
  };
}

export interface ProfileStoreClient extends ProfileTx {
  $transaction<T>(fn: (tx: ProfileTx) => Promise<T>): Promise<T>;
}

export interface StoredProfile {
  profile: TraderProfile;
  /** the history snapshot this profile was written as; a consent record names it */
  snapshotId: string;
  updatedAt: Date;
}

/**
 * A row the CHECK constraints would not have let in was found. It cannot happen
 * through this code or through SQL; it means the table was changed behind both.
 */
export class StoredProfileError extends Error {
  readonly issues: ProfileIssue[];

  constructor(userId: string, issues: ProfileIssue[]) {
    super(
      `the stored profile of user ${userId} is not a valid profile: ${issues
        .map((issue) => `${issue.field} ${issue.code}`)
        .join(', ')}`
    );
    this.name = 'StoredProfileError';
    this.issues = issues;
  }
}

const SELECT_PREFERENCES = {
  snapshot_id: true,
  trader_type: true,
  style: true,
  max_risk_pct: true,
  max_leverage: true,
  target_rrr: true,
  equity: true,
  min_sld: true,
  commission: true,
  updated_at: true,
} as const;

/** A profile as the columns of the three tables hold it. */
export function profileColumnsOf(profile: TraderProfile): ProfileColumns {
  return {
    trader_type: profile.traderType,
    style: profile.style,
    max_risk_pct: profile.maxRiskPct,
    max_leverage: profile.maxLeverage,
    target_rrr: profile.targetRrr,
    equity: profile.equity,
    min_sld: profile.minSld,
    commission: profile.commission,
  };
}

function sameColumns(a: ProfileColumns, b: ProfileColumns): boolean {
  return (
    a.trader_type === b.trader_type &&
    a.style === b.style &&
    a.max_risk_pct === b.max_risk_pct &&
    a.max_leverage === b.max_leverage &&
    a.target_rrr === b.target_rrr &&
    a.equity === b.equity &&
    a.min_sld === b.min_sld &&
    a.commission === b.commission
  );
}

/** A stored row, read back through the same validator that wrote it. */
export function profileFromColumns(
  userId: string,
  row: ProfileColumns
): TraderProfile {
  const checked = validateProfile({
    traderType: row.trader_type,
    style: row.style,
    maxRiskPct: row.max_risk_pct,
    maxLeverage: row.max_leverage,
    targetRrr: row.target_rrr,
    equity: row.equity,
    minSld: row.min_sld,
    commission: row.commission,
  });
  if (!checked.ok) throw new StoredProfileError(userId, checked.issues);
  return checked.profile;
}

/** The trader's current profile, or null when none was ever saved. */
export async function readProfile(
  userId: string,
  client: ProfileStoreClient = prisma
): Promise<StoredProfile | null> {
  const row = await client.userTradePreferences.findUnique({
    where: { user_id: userId },
    select: SELECT_PREFERENCES,
  });
  if (row === null) return null;
  return {
    profile: profileFromColumns(userId, row),
    snapshotId: row.snapshot_id,
    updatedAt: row.updated_at,
  };
}

export type SaveProfileResult =
  | {
      ok: true;
      profile: TraderProfile;
      snapshotId: string;
      /** false: the trader already had exactly this profile and nothing was written */
      changed: boolean;
    }
  | { ok: false; code: 'INVALID_PROFILE'; issues: ProfileIssue[] };

export interface SaveProfileOptions {
  client?: ProfileStoreClient;
  /** the key to hash with; the environment's by default */
  key?: AuditKey;
  /** the id of a new snapshot; a random UUID by default */
  newId?: () => string;
}

/**
 * Validate a profile and save it as the trader's current one. A profile that fails
 * `validateProfile` is returned with every problem and nothing is written. A missing
 * or malformed key (`AuditKeyError`) and a database error are thrown: an audit row
 * that cannot be written must not be passed over quietly. The key is resolved before
 * the database is touched, so a deployment without one fails on every call.
 */
export async function saveProfile(
  userId: string,
  candidate: Partial<TraderProfileInput>,
  options: SaveProfileOptions = {}
): Promise<SaveProfileResult> {
  const checked = validateProfile(candidate);
  if (!checked.ok) {
    return { ok: false, code: 'INVALID_PROFILE', issues: checked.issues };
  }
  const profile = checked.profile;
  const columns = profileColumnsOf(profile);
  const client: ProfileStoreClient = options.client ?? prisma;
  const { hash, keyVersion } = hashUserId(
    userId,
    options.key ?? resolveAuditKey()
  );
  const snapshotId = (options.newId ?? randomUUID)();

  return client.$transaction(async (tx): Promise<SaveProfileResult> => {
    const current = await tx.userTradePreferences.findUnique({
      where: { user_id: userId },
      select: SELECT_PREFERENCES,
    });
    if (current !== null && sameColumns(current, columns)) {
      return {
        ok: true,
        profile,
        snapshotId: current.snapshot_id,
        changed: false,
      };
    }
    await tx.userTradePreferencesHistory.create({
      data: {
        id: snapshotId,
        user_id: userId,
        user_id_hash: hash,
        key_version: keyVersion,
        ...columns,
      },
    });
    await tx.userTradePreferences.upsert({
      where: { user_id: userId },
      create: { user_id: userId, snapshot_id: snapshotId, ...columns },
      update: { snapshot_id: snapshotId, ...columns },
    });
    return { ok: true, profile, snapshotId, changed: true };
  });
}
