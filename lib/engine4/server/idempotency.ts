/**
 * One submit writes one consent record (plan part 6: "one request id per submit
 * so a double click writes once").
 *
 * The modal makes a `submissionId` ONCE when the trader presses Accept, Modify or
 * Decline, and sends the same id with every retry of that press. The first request
 * to arrive claims the id in Redis (`SET NX`); a second request that arrives while
 * the first is running is told so (409, retry in a moment); one that arrives after it
 * finished gets the SAME answer, with the id of the record the first one made, and
 * writes nothing. An id reused for a DIFFERENT request is refused: each claim keeps a
 * fingerprint of what was asked, and a mismatch is a bug in the client or an attack,
 * never a retry.
 *
 * If the request fails after the claim, the claim is released so the trader can
 * press the button again. A claim that is never released (the server died) expires
 * on its own after two minutes; a finished one is kept for a day.
 *
 * LIMIT, stated plainly: this is a Redis guard, like `lib/idempotency`, and it fails
 * OPEN like that one does (an unreachable Redis lets the request through, logged).
 * What it cannot give is a database guarantee: with Redis down, two presses that
 * race can write two identical rows. The rows are append-only audit rows of the same
 * setup (same `setup_sha256`, same action, the same few seconds), so the cost is noise,
 * not a wrong record. A guarantee needs a `submission_id` column with a unique index on
 * `trade_consent_records`: a change to the part 5 migration, which is a decision for
 * Davin (see the part 6 hand-off).
 *
 * @module lib/engine4/server/idempotency
 */

import { createHash } from 'crypto';

import { getRedisClient } from '@/lib/redis/client';

export const CLAIM_SECONDS = 120;
export const DONE_SECONDS = 86_400;
const PENDING = 'PENDING';
const KEY_PREFIX = 'engine4:consent:v1';

/** The three Redis commands this module uses; the real client fits, a test passes its own. */
export interface RedisLike {
  set(
    key: string,
    value: string,
    mode: 'EX',
    seconds: number,
    condition: 'NX'
  ): Promise<string | null>;
  set(
    key: string,
    value: string,
    mode: 'EX',
    seconds: number
  ): Promise<unknown>;
  get(key: string): Promise<string | null>;
  del(key: string): Promise<unknown>;
}

/** What the first request made, kept so a repeat can be answered without writing. */
export interface StoredOutcome {
  id: string;
  recordedAt: string;
  setupSha256: string;
  action: string;
  cycleSlot: string;
}

export type Claim =
  | { state: 'CLAIMED' }
  | { state: 'IN_FLIGHT' }
  | { state: 'DONE'; outcome: StoredOutcome }
  | { state: 'REUSED' }
  /** Redis could not be used: carry on without the guard */
  | { state: 'UNGUARDED' };

/** A short fingerprint of what a submit asked for. */
export function fingerprintOf(parts: Record<string, unknown>): string {
  return createHash('sha256')
    .update(JSON.stringify(parts), 'utf8')
    .digest('hex');
}

function keyOf(userId: string, submissionId: string): string {
  // the user id is part of the key: one trader's id can never answer another's
  return `${KEY_PREFIX}:${userId}:${submissionId}`;
}

function parseStored(
  text: string
): { fingerprint: string; outcome: StoredOutcome } | null {
  try {
    const value: unknown = JSON.parse(text);
    if (typeof value !== 'object' || value === null) return null;
    const record = value as Record<string, unknown>;
    const outcome = record['outcome'];
    if (typeof record['fingerprint'] !== 'string') return null;
    if (typeof outcome !== 'object' || outcome === null) return null;
    const o = outcome as Record<string, unknown>;
    if (
      typeof o['id'] !== 'string' ||
      typeof o['recordedAt'] !== 'string' ||
      typeof o['setupSha256'] !== 'string' ||
      typeof o['action'] !== 'string' ||
      typeof o['cycleSlot'] !== 'string'
    ) {
      return null;
    }
    return {
      fingerprint: record['fingerprint'],
      outcome: {
        id: o['id'],
        recordedAt: o['recordedAt'],
        setupSha256: o['setupSha256'],
        action: o['action'],
        cycleSlot: o['cycleSlot'],
      },
    };
  } catch {
    return null;
  }
}

function unguarded(error: unknown): Claim {
  console.error(
    '[engine4] submission guard failed, carrying on without it:',
    error instanceof Error ? error.message : error
  );
  return { state: 'UNGUARDED' };
}

export async function claimSubmission(
  userId: string,
  submissionId: string,
  fingerprint: string,
  redis?: RedisLike
): Promise<Claim> {
  try {
    const client = redis ?? (getRedisClient() as unknown as RedisLike);
    const key = keyOf(userId, submissionId);
    const pending = `${PENDING}:${fingerprint}`;
    // two tries: the first claim can expire between our SET and our GET
    for (const _attempt of [1, 2]) {
      const set = await client.set(key, pending, 'EX', CLAIM_SECONDS, 'NX');
      if (set === 'OK') return { state: 'CLAIMED' };
      const held = await client.get(key);
      if (held === null) continue;
      if (held.startsWith(`${PENDING}:`)) {
        return held === pending ? { state: 'IN_FLIGHT' } : { state: 'REUSED' };
      }
      const stored = parseStored(held);
      if (stored === null) return { state: 'REUSED' };
      return stored.fingerprint === fingerprint
        ? { state: 'DONE', outcome: stored.outcome }
        : { state: 'REUSED' };
    }
    return { state: 'IN_FLIGHT' };
  } catch (error) {
    return unguarded(error);
  }
}

/** Keep the outcome for a day so a repeat gets the same answer. Never throws. */
export async function completeSubmission(
  userId: string,
  submissionId: string,
  fingerprint: string,
  outcome: StoredOutcome,
  redis?: RedisLike
): Promise<void> {
  try {
    const client = redis ?? (getRedisClient() as unknown as RedisLike);
    await client.set(
      keyOf(userId, submissionId),
      JSON.stringify({ fingerprint, outcome }),
      'EX',
      DONE_SECONDS
    );
  } catch (error) {
    unguarded(error);
  }
}

/** Let the trader press the button again after a failure. Never throws. */
export async function releaseSubmission(
  userId: string,
  submissionId: string,
  redis?: RedisLike
): Promise<void> {
  try {
    const client = redis ?? (getRedisClient() as unknown as RedisLike);
    await client.del(keyOf(userId, submissionId));
  } catch (error) {
    unguarded(error);
  }
}
