/**
 * The switches of the chat route (build step 7 part 7a; plan decisions D8 and D21).
 *
 * `REPLY_ENABLED` turns the route on, and ONLY the exact text `true` does: any other value, a
 * missing variable, `TRUE`, `1`, `yes`, leaves the route answering 404 to everybody. It is set
 * nowhere, so nothing built so far is reachable (the runbook's S8 and S9 turn it on).
 *
 * `REPLY_ALLOWED_USER_IDS` is the staging switch of D21: a comma-separated list of user ids. When
 * the variable exists only those traders have the analyst, whatever their tier, for a week on the
 * owner's own account before anyone else; the others are treated as having no analyst (the same
 * refusal a Free trader gets). A variable that exists and lists nobody lets nobody in: a
 * mistake here fails closed. When it does not exist the tier alone decides (S9 removes it).
 *
 * Pure reads of an env object the caller passes: this file reads no `process.env` of its own. It is
 * also where the allow-list meets the session (`allowListSession`), so the chat routes that need only
 * the staging switch do not load the ports (the gateway, storage, the ledger).
 *
 * @module lib/reply/server/flags
 */

import type { SessionPort } from '../contracts/intake';

export type Env = Readonly<Record<string, string | undefined>>;

export const REPLY_ENABLED_ENV = 'REPLY_ENABLED';
export const REPLY_ALLOWED_USER_IDS_ENV = 'REPLY_ALLOWED_USER_IDS';

/** A user id as the allow-list may name it: what a session carries, no separators. */
const USER_ID = /^[A-Za-z0-9_.@:-]{1,128}$/;

export function isReplyEnabled(env: Env): boolean {
  return env[REPLY_ENABLED_ENV] === 'true';
}

/** The allow-list, or null when there is none (the variable does not exist). Entries that are not user ids are dropped. */
export function allowedUserIds(env: Env): ReadonlySet<string> | null {
  const raw = env[REPLY_ALLOWED_USER_IDS_ENV];
  if (raw === undefined) return null;
  return new Set(
    raw
      .split(',')
      .map((id) => id.trim())
      .filter((id) => USER_ID.test(id))
  );
}

/** May this trader have the analyst, as far as the staging switch goes? */
export function passesAllowList(env: Env, userId: string): boolean {
  const list = allowedUserIds(env);
  return list === null || list.has(userId);
}

/** The session with the staging allow-list in front of it: a trader who is not on it has no analyst. */
export function allowListSession(inner: SessionPort, env: Env): SessionPort {
  return {
    async current() {
      const session = await inner.current();
      if (session === null) return null;
      return passesAllowList(env, session.userId)
        ? session
        : { userId: session.userId, tier: 'FREE' };
    },
  };
}
