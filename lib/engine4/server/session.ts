/**
 * Who may call the Engine 4 routes: the flag, then the session, then the tier.
 *
 * The order is deliberate. With `ENGINE4_REPORT2_ENABLED` not exactly `true` (the
 * default) the routes answer 404 to EVERYBODY, signed in or not, so a switched-off
 * feature is not even discoverable. Then a request without a session is 401, and a
 * signed-in trader below Pro is 403 (A4: Report 2 is Pro only, through the same
 * tier helper as the AI analyst, `canAccessAiAnalyst`; the entitlement table and
 * the quota are chapter 7).
 *
 * The user id and tier come from the server's session and nowhere else: a body
 * field, a query string or a header can never name a user or a tier.
 *
 * @module lib/engine4/server/session
 */

import { getSession } from '@/lib/auth/session';
import { canAccessAiAnalyst, type Tier } from '@/lib/tier-validation';

import type { Engine4ErrorCode } from './errors';

/** Report 2 is off unless this is exactly the text `true`. */
export function isReport2Enabled(
  env: Readonly<Record<string, string | undefined>> = process.env
): boolean {
  return env['ENGINE4_REPORT2_ENABLED'] === 'true';
}

export interface Engine4Caller {
  userId: string;
  tier: Tier;
}

export type AccessResult =
  | { ok: true; caller: Engine4Caller }
  | {
      ok: false;
      code: Extract<
        Engine4ErrorCode,
        'FEATURE_DISABLED' | 'UNAUTHENTICATED' | 'TIER_REQUIRED'
      >;
      message: string;
      /** the tier of a signed-in caller who was refused, for the trace */
      tier: string | null;
    };

/** The session as far as this module reads it (a test passes its own). */
export interface SessionSource {
  (): Promise<{ user?: { id?: string | null; tier?: string | null } } | null>;
}

export async function authorize(
  readSession: SessionSource = getSession,
  env: Readonly<Record<string, string | undefined>> = process.env
): Promise<AccessResult> {
  if (!isReport2Enabled(env)) {
    return {
      ok: false,
      code: 'FEATURE_DISABLED',
      message: 'Not found',
      tier: null,
    };
  }
  const session = await readSession();
  const userId = session?.user?.id;
  if (typeof userId !== 'string' || userId === '') {
    return {
      ok: false,
      code: 'UNAUTHENTICATED',
      message: 'You must be signed in.',
      tier: null,
    };
  }
  // an unknown or missing tier is treated as Free: access is never granted by a gap
  const tier: Tier = session?.user?.tier === 'PRO' ? 'PRO' : 'FREE';
  const access = canAccessAiAnalyst(tier);
  if (!access.allowed) {
    return {
      ok: false,
      code: 'TIER_REQUIRED',
      message: 'Report 2 is a Pro feature.',
      tier,
    };
  }
  return { ok: true, caller: { userId, tier } };
}
