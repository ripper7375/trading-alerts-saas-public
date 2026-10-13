/**
 * The trader's profile as the packet carries it (plan finding F11, decision D9 c, ADR-077,
 * architecture 5.4): SIX of the eight metrics.
 *
 * The stored profile (`lib/engine4/store/profile-store.ts`) has eight: type, style, Max RPT,
 * Max leverage, target RRR, equity, Min SLD and commission. A prompt never sees the equity
 * balance or the commission, so the projection is built field by field and the profile is
 * never spread into it: a field added to the profile later cannot reach a packet by accident.
 * The packet validator refuses a key that looks like either of the two, at any depth, and
 * `__tests__/lib/intake/read/profile.test.ts` scans every projection for them.
 *
 * Nothing here throws. A trader with no profile is `PROFILE_NOT_SET`; a stored profile that
 * no longer passes its own validator is `PROFILE_UNREADABLE`; a database error is
 * `DATABASE_ERROR`. The gate (part 5) turns the first into the refusal that asks the trader
 * to confirm a profile.
 *
 * Imported BY PATH, never through the `lib/intake` barrel.
 *
 * @module lib/intake/read/profile
 */

import {
  StoredProfileError,
  readProfile,
  type StoredProfile,
} from '@/lib/engine4/store/profile-store';

import { TRADING_STYLES, type PacketProfile } from '../packet';
import { TRADER_TYPES } from '../roster';

const DECIMAL = /^(0|[1-9][0-9]*)(\.[0-9]+)?$/;

export type ProfileProblemCode =
  | 'PROFILE_NOT_SET'
  | 'PROFILE_UNREADABLE'
  | 'DATABASE_ERROR';

export type ProfileRead =
  | { ok: true; profile: PacketProfile }
  | { ok: false; code: ProfileProblemCode; detail: string };

export interface ProfileDeps {
  readProfile(userId: string): Promise<StoredProfile | null>;
}

const defaultDeps: ProfileDeps = {
  readProfile: (userId) => readProfile(userId),
};

const fail = (code: ProfileProblemCode, detail: string): ProfileRead => ({
  ok: false,
  code,
  detail,
});

/** The six fields of a stored profile a prompt may see, or why it cannot be used. */
export function projectProfile(stored: StoredProfile): ProfileRead {
  const p = stored.profile;
  const traderType = (TRADER_TYPES as readonly string[]).includes(p.traderType)
    ? p.traderType
    : undefined;
  const style = (TRADING_STYLES as readonly string[]).includes(p.style)
    ? p.style
    : undefined;
  const decimals = [p.maxRiskPct, p.maxLeverage, p.targetRrr, p.minSld];
  if (
    traderType === undefined ||
    style === undefined ||
    !decimals.every((value) => typeof value === 'string' && DECIMAL.test(value))
  ) {
    return fail('PROFILE_UNREADABLE', 'the stored profile is not well formed');
  }
  return {
    ok: true,
    profile: {
      trader_type: traderType,
      style,
      max_risk_pct: p.maxRiskPct,
      max_leverage: p.maxLeverage,
      target_rrr: p.targetRrr,
      min_sld: p.minSld,
    },
  };
}

export async function readProfileProjection(
  userId: string,
  deps: ProfileDeps = defaultDeps
): Promise<ProfileRead> {
  let stored: StoredProfile | null;
  try {
    stored = await deps.readProfile(userId);
  } catch (error) {
    if (error instanceof StoredProfileError) {
      return fail(
        'PROFILE_UNREADABLE',
        'the stored profile fails its own validator'
      );
    }
    return fail(
      'DATABASE_ERROR',
      `the profile could not be read: ${error instanceof Error ? error.message : 'unknown error'}`
    );
  }
  if (stored === null) {
    return fail('PROFILE_NOT_SET', 'the trader has not confirmed a profile');
  }
  return projectProfile(stored);
}
