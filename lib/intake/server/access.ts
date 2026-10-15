/**
 * Who may call the intake routes, and the real edges behind the pipeline's ports.
 *
 * The flag, the session, the tier, the thread, the profile and the quota are decided by
 * `runGate` (`lib/intake/gate.ts`); this file supplies what it asks. Each adapter is small and
 * does one thing, so a test (or the dev preview) can replace any of them:
 *
 *  - the FLAG is `INTAKE_ENABLED`, exactly the text `true`, and nothing else turns it on (decision
 *    D16). Off is the default and it is set nowhere: both routes answer 404 to everybody. The
 *    instant prompts (the chart's Market Context badges) have their own flag, `INTAKE_INSTANT_PROMPTS_ENABLED`, which the UI
 *    reads (part 10); it is not a second lock on the route;
 *  - the SESSION is the server's session and the only source of the user id and the tier. An
 *    unknown or missing tier is Free: access is never granted by a gap (the Engine 4 rule);
 *  - the TIER is the entitlement table (`config/entitlements.ts`, architecture 7.3, ADR-074),
 *    read through `lib/platform/entitlements.ts`: the live analyst is the `MONTHLY_UNITS` value of
 *    `ai_chat_and_report1`, which only Pro has (the Free tier's recorded demo is not the analyst);
 *  - the THREAD (build step 7 part 7a): the request is for XAUUSD and may carry a thread id, which
 *    must be a thread of THIS trader for this symbol, read from the chat store. Another trader's
 *    thread, a thread that does not exist and a malformed id are the same `THREAD_INVALID` (the
 *    store puts the user id in the `where`, so existence is never leaked). It replaces the
 *    format-only check of step 6 (decision D6 (a)), which had no store to ask;
 *  - the PROFILE is `readProfileProjection`: six of the eight metrics, never the equity or the
 *    commission;
 *  - the QUOTA (build step 7 part 6; decisions D2, D3, D4) is the floor check of the quota ledger
 *    (`lib/reply/meter/quota-port.ts`): enough balance for the smallest possible request, or the
 *    request is refused before the Understand call is paid for. The allowance is
 *    `PRO_MONTHLY_UNITS`; while it is unset the port refuses everything (fail closed), and the
 *    Free tier has no allowance. It replaces the pass-through of step 6;
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
import { createThreadPort } from '@/lib/platform/chat/thread-port';
import { canUseAiChat, quotaModeOf } from '@/lib/platform/entitlements';
import { createLedgerPort } from '@/lib/platform/metering/ledger-port';
import {
  disabledModelsFromEnv,
  findModel,
  pickerModels,
  planLaunch,
} from '@/lib/reply/gateway/registry';
import { floorUnits } from '@/lib/reply/meter/estimate';
import { createQuotaPort, type LedgerPort } from '@/lib/reply/meter/quota-port';
import { proMonthlyUnitsFromEnv } from '@/lib/reply/meter/units';

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
import type { IntakePorts } from '../pipeline';
import { readUpcomingEvents } from '../read/events';
import { readProfileProjection } from '../read/profile';
import { readSnapshot } from '../read/snapshot';
import {
  createModelUnderstandPort,
  understandConfigFromEnv,
} from '../text/understand-model';
import { isInstantPromptsEnabled, isIntakeEnabled, type Env } from './flags';
import { replyText } from './reply';

// The two flags live in `flags.ts` so a page can read one without this file's imports.
export { isInstantPromptsEnabled, isIntakeEnabled, type Env };

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
  allows: (tier) => canUseAiChat(tier),
};

/** The thread must be the trader's own, for this symbol (the chat store; see the header). */
export const threadPort: ThreadPort = createThreadPort();

export const profilePort: ProfilePort = {
  read: (userId) => readProfileProjection(userId),
};

/**
 * The quota: the floor check over the quota ledger (build step 7 part 6). The allowance of a tier
 * with the live analyst is `PRO_MONTHLY_UNITS`, and while that is unset the port refuses every
 * request (decision D4). The floor is the cheapest reservation any request could make, from the
 * registry's dated prices; while nothing is priced it is one unit, so an empty account is refused
 * all the same. The ledger is read when a request arrives, never when the port is made.
 */
export function quotaPort(
  env: Env = process.env,
  options: { ledger?: LedgerPort; now?: () => number } = {}
): QuotaPort {
  const units = proMonthlyUnitsFromEnv(env);
  const disabled = disabledModelsFromEnv(env);
  const understandSlug = env['INTAKE_UNDERSTAND_MODEL'];
  return createQuotaPort({
    ledger: options.ledger ?? createLedgerPort(),
    now: options.now ?? (() => Date.now()),
    allowanceOf: (tier) => (quotaModeOf(tier) === 'MONTHLY_UNITS' ? units : 0),
    floorOf: (kind) => {
      const launch = planLaunch(disabled);
      const answerModels = [
        ...pickerModels('PRO', disabled),
        ...(launch.primary === null ? [] : [launch.primary]),
        ...(launch.fallback === null ? [] : [launch.fallback]),
      ];
      return floorUnits({
        kind,
        understandModel:
          typeof understandSlug === 'string'
            ? (findModel(understandSlug) ?? null)
            : null,
        answerModels,
      });
    },
  });
}

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
    quota: quotaPort(env),
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
