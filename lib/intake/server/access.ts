/**
 * Who may call the intake routes, and the real edges behind the pipeline's ports.
 *
 * The flag, the session, the tier, the thread, the profile and the quota are decided by
 * `runGate` (`lib/intake/gate.ts`); this file supplies what it asks. Each adapter is small and
 * does one thing, so a test (or the dev preview) can replace any of them:
 *
 *  - the FLAG is `INTAKE_ENABLED`, exactly the text `true`, and nothing else turns it on (decision
 *    D16). Off is the default and it is set nowhere: both routes answer 404 to everybody. The
 *    instant-prompt buttons have their own flag, `INTAKE_INSTANT_PROMPTS_ENABLED`, which the UI
 *    reads (part 10); it is not a second lock on the route;
 *  - the SESSION is the server's session and the only source of the user id and the tier. An
 *    unknown or missing tier is Free: access is never granted by a gap (the Engine 4 rule);
 *  - the TIER is `canAccessAiAnalyst`, the same helper Engine 4 uses; chapter 7's entitlement
 *    table replaces it behind the same port;
 *  - the THREAD (decision D6 (a)): the request is for XAUUSD and may carry a thread id. No chat
 *    store exists, so the adapter checks that an id is well formed and nothing more; no table;
 *  - the PROFILE is `readProfileProjection`: six of the eight metrics, never the equity or the
 *    commission;
 *  - the QUOTA (decision D5 (A)) is "not metered, allow": there are no units to count until step
 *    7. The runbook forbids turning `INTAKE_ENABLED` on in production before step 7 meters;
 *  - the INTERFACE LOCALE is the language cookie the app already sets, read on the server. A
 *    request body never names a language;
 *  - the REPLIES are the `intake.refusal.*` keys of the dictionaries (part 3), in the locale of
 *    the reply; a locale that has no text for a key falls back to the English of the registry.
 *
 * Server code only: it reads a session, a database, the network and the environment.
 *
 * @module lib/intake/server/access
 */

import { getSession } from '@/lib/auth/session';
import { getServerLanguage } from '@/lib/i18n/server-locale';
import { canAccessAiAnalyst } from '@/lib/tier-validation';

import type {
  EntitlementPort,
  GatePorts,
  ProfilePort,
  QuotaPort,
  SessionPort,
  ThreadPort,
} from '../gate';
import {
  createKnowledgeClient,
  knowledgeConfigFromEnv,
} from '../knowledge-client';
import { THREAD_ID } from '../packet';
import type { IntakePorts } from '../pipeline';
import { readUpcomingEvents } from '../read/events';
import { readProfileProjection } from '../read/profile';
import { readSnapshot } from '../read/snapshot';
import {
  createModelUnderstandPort,
  understandConfigFromEnv,
} from '../text/understand-model';
import { replyText } from './reply';

export type Env = Readonly<Record<string, string | undefined>>;

/** The intake routes are off unless this is exactly the text `true`. */
export function isIntakeEnabled(env: Env = process.env): boolean {
  return env['INTAKE_ENABLED'] === 'true';
}

/** The Panel C buttons render only when this is exactly the text `true` (the UI reads it; part 10). */
export function isInstantPromptsEnabled(env: Env = process.env): boolean {
  return env['INTAKE_INSTANT_PROMPTS_ENABLED'] === 'true';
}

/** The session as far as this module reads it (a test passes its own). */
export interface SessionSource {
  (): Promise<{ user?: { id?: string | null; tier?: string | null } } | null>;
}

export function sessionPort(read: SessionSource = getSession): SessionPort {
  return {
    async current() {
      const session = await read();
      const userId = session?.user?.id;
      if (typeof userId !== 'string' || userId === '') return null;
      // an unknown or missing tier is treated as Free: access is never granted by a gap
      return { userId, tier: session?.user?.tier === 'PRO' ? 'PRO' : 'FREE' };
    },
  };
}

export const entitlementPort: EntitlementPort = {
  allows: (tier) => canAccessAiAnalyst(tier === 'PRO' ? 'PRO' : 'FREE').allowed,
};

/** No chat store exists yet (decision D6 (a)): an id is accepted when it is well formed. */
export const threadPort: ThreadPort = {
  async check({ threadId }) {
    return threadId === null || THREAD_ID.test(threadId)
      ? { ok: true, threadId }
      : { ok: false };
  },
};

export const profilePort: ProfilePort = {
  read: (userId) => readProfileProjection(userId),
};

/** Not metered until step 7 (decision D5 (A)). */
export const passThroughQuota: QuotaPort = {
  async precheck() {
    return { allowed: true };
  },
};

export function gatePorts(
  env: Env = process.env,
  read: SessionSource = getSession
): GatePorts {
  return {
    enabled: () => isIntakeEnabled(env),
    session: sessionPort(read),
    entitlement: entitlementPort,
    thread: threadPort,
    profile: profilePort,
    quota: passThroughQuota,
  };
}

/** The real ports of the pipeline. A test builds its own and passes it to the route. */
export function productionPorts(env: Env = process.env): IntakePorts {
  return {
    gate: gatePorts(env),
    interfaceLocale: () => getServerLanguage(),
    reply: replyText,
    understand: createModelUnderstandPort(understandConfigFromEnv(env)),
    snapshot: (request) => readSnapshot(request),
    events: (request) => readUpcomingEvents(request),
    knowledge: createKnowledgeClient(knowledgeConfigFromEnv(env)),
    now: () => Date.now(),
  };
}
