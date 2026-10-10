/**
 * The consent record (architecture 6.11, ADR-069): one append-only row for every
 * Accept, Modify and Decline of a validated setup, in `trade_consent_records`.
 *
 * The row keeps the whole `ValidatedSetup` as the exact text that was hashed (the
 * database re-derives the SHA-256 and checks that its JSONB copy is the same
 * document), the columns a reader filters on (they must equal the setup's own
 * values; the database checks that too), the synthesis rule and version, the
 * profile snapshot, the badge shown, and the versions of Engine 4, `symbol_specs`,
 * the template and the disclaimer. The user id is stored with its keyed hash and the
 * version of the key; deleting the account sets the id to NULL and keeps the rest.
 *
 * This file only ever INSERTS. A record cannot be corrected, only followed by
 * another one, and the database refuses an UPDATE or a DELETE of it.
 *
 * What it refuses to record, as a result and not an exception (`ok: false`): a setup
 * that was never pinned to a cycle, an Accept of a setup that did not pass its
 * checks, a profile snapshot that is not the trader's or is not the profile the
 * setup was validated against, and any name or version that is empty. A missing key
 * (`AuditKeyError`) and a database error are thrown.
 *
 * @module lib/engine4/store/consent-store
 */

import { createHash } from 'crypto';

import { prisma } from '@/lib/db/prisma';

import { serializeValidatedSetup } from '../validate';
import type { ValidatedSetup } from '../validate';
import { ENGINE4_VERSION } from '../version';
import { profileColumnsOf } from './profile-store';
import type { ProfileColumns } from './profile-store';
import { hashUserId, resolveAuditKey } from './user-hash';
import type { AuditKey } from './user-hash';

export type ConsentAction = 'ACCEPT' | 'MODIFY' | 'DECLINE';

export const CONSENT_ACTIONS: readonly ConsentAction[] = [
  'ACCEPT',
  'MODIFY',
  'DECLINE',
];

export interface ConsentInput {
  userId: string;
  action: ConsentAction;
  symbol: string;
  /** the object `validateSetup` returned, unchanged */
  setup: ValidatedSetup;
  /** the synthesis the setup is pinned to: `synthesis_readings.rule_id` and `.rules_version` */
  synthesis: { ruleId: string; rulesVersion: string };
  /** the history snapshot of the profile the setup was validated against (`readProfile`'s `snapshotId`) */
  profileSnapshotId: string;
  /** the AI badge shown with the setup; it is not part of `ValidatedSetup` */
  badge: string | null;
  templateVersion: string;
  disclaimerVersion: string;
  language: string;
}

type Json = string | number | boolean | null | Json[] | { [key: string]: Json };

/** What `create` takes: the delegate the real generated client fits with no cast; a test passes its own. */
export interface ConsentCreateData {
  user_id: string;
  user_id_hash: string;
  key_version: number;
  action: ConsentAction;
  symbol: string;
  cycle_slot: number;
  synthesis_rule_id: string;
  synthesis_rules_version: string;
  zone_id: string | null;
  side: string | null;
  profile_snapshot_id: string;
  badge: string | null;
  setup_json: string;
  setup: { [key: string]: Json };
  setup_sha256: string;
  engine4_version: string;
  symbol_specs_version: number | null;
  template_version: string;
  disclaimer_version: string;
  language: string;
}

export interface ConsentStoreClient {
  tradeConsentRecord: {
    create(args: {
      data: ConsentCreateData;
      select: { id: true; recorded_at: true };
    }): Promise<{ id: string; recorded_at: Date }>;
  };
  userTradePreferencesHistory: {
    findUnique(args: {
      where: { id: string };
      select: Record<keyof ProfileColumns | 'user_id', true>;
    }): Promise<(ProfileColumns & { user_id: string | null }) | null>;
  };
}

export type ConsentRefusalCode =
  | 'MISSING_FIELD'
  | 'UNKNOWN_ACTION'
  | 'SETUP_NOT_PINNED'
  | 'BAD_SETUP'
  | 'ACCEPT_OF_A_FAILED_SETUP'
  | 'PROFILE_SNAPSHOT_NOT_FOUND'
  | 'PROFILE_SNAPSHOT_NOT_THE_USERS'
  | 'PROFILE_SNAPSHOT_NOT_THE_SETUPS';

export type RecordConsentResult =
  | {
      ok: true;
      id: string;
      recordedAt: Date;
      /** the SHA-256 (hex) of the setup text that was stored */
      setupSha256: string;
    }
  | { ok: false; code: ConsentRefusalCode; detail: string };

export interface RecordConsentOptions {
  client?: ConsentStoreClient;
  key?: AuditKey;
}

/** The largest value of a 32-bit INTEGER column. */
const INT_MAX = 2147483647n;
const WHOLE_NUMBER = /^[1-9][0-9]{0,9}$/;

/** A positive whole number in text that fits an INTEGER column, or null. */
function readInt(text: string | null): number | null {
  if (text === null || !WHOLE_NUMBER.test(text)) return null;
  const value = BigInt(text);
  return value <= INT_MAX ? Number(value) : null;
}

function refuse(code: ConsentRefusalCode, detail: string): RecordConsentResult {
  return { ok: false, code, detail };
}

/** The names the record cannot do without; the database refuses empty ones too. */
function missingField(input: ConsentInput): string | null {
  const required: [string, unknown][] = [
    ['userId', input.userId],
    ['symbol', input.symbol],
    ['synthesis.ruleId', input.synthesis.ruleId],
    ['synthesis.rulesVersion', input.synthesis.rulesVersion],
    ['profileSnapshotId', input.profileSnapshotId],
    ['templateVersion', input.templateVersion],
    ['disclaimerVersion', input.disclaimerVersion],
    ['language', input.language],
  ];
  for (const [name, value] of required) {
    if (typeof value !== 'string' || value.trim() === '') return name;
  }
  return null;
}

/**
 * Append the record of what the trader did with a setup. See the file header for
 * what is refused. The stored text is `serializeValidatedSetup(setup)`, byte for byte.
 */
export async function recordConsent(
  input: ConsentInput,
  options: RecordConsentOptions = {}
): Promise<RecordConsentResult> {
  const missing = missingField(input);
  if (missing !== null) {
    return refuse('MISSING_FIELD', `${missing} is required`);
  }
  if (!CONSENT_ACTIONS.includes(input.action)) {
    return refuse(
      'UNKNOWN_ACTION',
      'the action is not ACCEPT, MODIFY or DECLINE'
    );
  }
  const { setup } = input;
  const cycleSlot = readInt(setup.pinnedSlot);
  if (cycleSlot === null) {
    return refuse(
      'SETUP_NOT_PINNED',
      'the setup is not pinned to a cycle, so there is nothing to record against'
    );
  }
  const specsVersion = readInt(setup.versions.specs);
  if (setup.versions.specs !== null && specsVersion === null) {
    return refuse(
      'BAD_SETUP',
      'the symbol_specs version is not a whole number'
    );
  }
  if (input.action === 'ACCEPT' && !setup.ok) {
    return refuse(
      'ACCEPT_OF_A_FAILED_SETUP',
      'a setup that failed its checks cannot be accepted'
    );
  }

  const client: ConsentStoreClient = options.client ?? prisma;
  const { hash, keyVersion } = hashUserId(
    input.userId,
    options.key ?? resolveAuditKey()
  );

  const snapshot = await client.userTradePreferencesHistory.findUnique({
    where: { id: input.profileSnapshotId },
    select: {
      user_id: true,
      trader_type: true,
      style: true,
      max_risk_pct: true,
      max_leverage: true,
      target_rrr: true,
      equity: true,
      min_sld: true,
      commission: true,
    },
  });
  if (snapshot === null) {
    return refuse(
      'PROFILE_SNAPSHOT_NOT_FOUND',
      'the profile snapshot does not exist'
    );
  }
  if (snapshot.user_id !== input.userId) {
    return refuse(
      'PROFILE_SNAPSHOT_NOT_THE_USERS',
      'the profile snapshot belongs to another user'
    );
  }
  const validatedWith = profileColumnsOf(setup.profile);
  const same =
    snapshot.trader_type === validatedWith.trader_type &&
    snapshot.style === validatedWith.style &&
    snapshot.max_risk_pct === validatedWith.max_risk_pct &&
    snapshot.max_leverage === validatedWith.max_leverage &&
    snapshot.target_rrr === validatedWith.target_rrr &&
    snapshot.equity === validatedWith.equity &&
    snapshot.min_sld === validatedWith.min_sld &&
    snapshot.commission === validatedWith.commission;
  if (!same) {
    return refuse(
      'PROFILE_SNAPSHOT_NOT_THE_SETUPS',
      'the profile snapshot is not the profile the setup was validated against'
    );
  }

  const setupJson = serializeValidatedSetup(setup);
  const setupSha256 = createHash('sha256')
    .update(setupJson, 'utf8')
    .digest('hex');

  const row = await client.tradeConsentRecord.create({
    data: {
      user_id: input.userId,
      user_id_hash: hash,
      key_version: keyVersion,
      action: input.action,
      symbol: input.symbol,
      cycle_slot: cycleSlot,
      synthesis_rule_id: input.synthesis.ruleId,
      synthesis_rules_version: input.synthesis.rulesVersion,
      zone_id: setup.entry.zoneId,
      side: setup.side,
      profile_snapshot_id: input.profileSnapshotId,
      badge: input.badge,
      setup_json: setupJson,
      setup: JSON.parse(setupJson) as { [key: string]: Json },
      setup_sha256: setupSha256,
      engine4_version: ENGINE4_VERSION,
      symbol_specs_version: specsVersion,
      template_version: input.templateVersion,
      disclaimer_version: input.disclaimerVersion,
      language: input.language,
    },
    select: { id: true, recorded_at: true },
  });
  return { ok: true, id: row.id, recordedAt: row.recorded_at, setupSha256 };
}
