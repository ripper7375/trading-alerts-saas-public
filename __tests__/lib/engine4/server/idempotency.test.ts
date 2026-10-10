/**
 * @jest-environment node
 */

/**
 * The submission guard (build step 5, part 6): one submit writes one consent record.
 * A claim is a Redis `SET NX`; a finished one keeps the answer; an id is bound to
 * what was asked, so reusing it for something else is refused; an unreachable Redis
 * lets the request through (the repo`s convention, `lib/idempotency`), and says so.
 */

import {
  CLAIM_SECONDS,
  DONE_SECONDS,
  claimSubmission,
  completeSubmission,
  fingerprintOf,
  releaseSubmission,
} from '@/lib/engine4/server/idempotency';
import type { StoredOutcome } from '@/lib/engine4/server/idempotency';

import { newFakeRedis } from '../../../api/engine4/helpers/redis';

// The module imports the real Redis client at load time; every test passes its own.
jest.mock('@/lib/redis/client', () => ({ getRedisClient: jest.fn() }));

const OUTCOME: StoredOutcome = {
  id: 'consent-1',
  recordedAt: '2026-10-10T08:00:00.000Z',
  setupSha256: 'a'.repeat(64),
  action: 'ACCEPT',
  cycleSlot: '1789764900',
};
const KEY = 'engine4:consent:v1:u1:press-1';
const FP = fingerprintOf({ action: 'ACCEPT' });

afterEach(() => jest.restoreAllMocks());

describe('fingerprintOf', () => {
  test('is a SHA-256 of what was asked, the same for the same asking', () => {
    expect(FP).toMatch(/^[0-9a-f]{64}$/);
    expect(fingerprintOf({ action: 'ACCEPT' })).toBe(FP);
    expect(fingerprintOf({ action: 'DECLINE' })).not.toBe(FP);
    expect(fingerprintOf({ action: 'ACCEPT', extra: 1 })).not.toBe(FP);
  });
});

describe('claimSubmission', () => {
  test('the first request claims the id for two minutes, per trader', async () => {
    const redis = newFakeRedis();
    expect(await claimSubmission('u1', 'press-1', FP, redis)).toEqual({
      state: 'CLAIMED',
    });
    expect(redis.calls).toEqual([`set NX ${KEY}`]);
    expect(redis.store.get(KEY)).toEqual({
      value: `PENDING:${FP}`,
      ttl: CLAIM_SECONDS,
    });
    expect(CLAIM_SECONDS).toBe(120);
  });

  test('a second request while the first runs is IN_FLIGHT', async () => {
    const redis = newFakeRedis();
    await claimSubmission('u1', 'press-1', FP, redis);
    expect(await claimSubmission('u1', 'press-1', FP, redis)).toEqual({
      state: 'IN_FLIGHT',
    });
  });

  test('the same id asked for something else while it runs is REUSED', async () => {
    const redis = newFakeRedis();
    await claimSubmission('u1', 'press-1', FP, redis);
    expect(
      await claimSubmission(
        'u1',
        'press-1',
        fingerprintOf({ action: 'DECLINE' }),
        redis
      )
    ).toEqual({ state: 'REUSED' });
  });

  test('another trader`s identical id is another claim', async () => {
    const redis = newFakeRedis();
    await claimSubmission('u1', 'press-1', FP, redis);
    expect(await claimSubmission('u2', 'press-1', FP, redis)).toEqual({
      state: 'CLAIMED',
    });
    expect([...redis.store.keys()].sort()).toEqual([
      'engine4:consent:v1:u1:press-1',
      'engine4:consent:v1:u2:press-1',
    ]);
  });

  test('after the answer is kept, a repeat gets that answer', async () => {
    const redis = newFakeRedis();
    await claimSubmission('u1', 'press-1', FP, redis);
    await completeSubmission('u1', 'press-1', FP, OUTCOME, redis);
    expect(await claimSubmission('u1', 'press-1', FP, redis)).toEqual({
      state: 'DONE',
      outcome: OUTCOME,
    });
    expect(redis.store.get(KEY)!.ttl).toBe(DONE_SECONDS);
    expect(DONE_SECONDS).toBe(86_400);
  });

  test('after the answer is kept, the same id asked for something else is REUSED, and the answer stands', async () => {
    const redis = newFakeRedis();
    await completeSubmission('u1', 'press-1', FP, OUTCOME, redis);
    expect(
      await claimSubmission(
        'u1',
        'press-1',
        fingerprintOf({ action: 'DECLINE' }),
        redis
      )
    ).toEqual({ state: 'REUSED' });
    expect(await claimSubmission('u1', 'press-1', FP, redis)).toMatchObject({
      state: 'DONE',
    });
  });

  test.each([
    ['not JSON', 'garbage'],
    ['JSON that is not an object', '5'],
    ['JSON null', 'null'],
    ['an outcome missing', JSON.stringify({ fingerprint: FP })],
    [
      'an outcome that is not an object',
      JSON.stringify({ fingerprint: FP, outcome: 'x' }),
    ],
    ['a fingerprint missing', JSON.stringify({ outcome: OUTCOME })],
    ...(
      ['id', 'recordedAt', 'setupSha256', 'action', 'cycleSlot'] as const
    ).map(
      (field) =>
        [
          `an outcome whose ${field} is not text`,
          JSON.stringify({
            fingerprint: FP,
            outcome: { ...OUTCOME, [field]: 5 },
          }),
        ] as [string, string]
    ),
    [
      'an outcome with a field of the wrong type',
      JSON.stringify({ fingerprint: FP, outcome: { ...OUTCOME, id: 5 } }),
    ],
    [
      'an outcome with a field missing',
      JSON.stringify({ fingerprint: FP, outcome: { id: 'x' } }),
    ],
  ])(
    'a stored value that is %s is REUSED, never trusted',
    async (_label, stored) => {
      const redis = newFakeRedis();
      redis.store.set(KEY, { value: stored, ttl: 1 });
      expect(await claimSubmission('u1', 'press-1', FP, redis)).toEqual({
        state: 'REUSED',
      });
    }
  );

  test('a claim that expires between the SET and the GET is taken on the second try', async () => {
    const redis = newFakeRedis();
    redis.store.set(KEY, { value: `PENDING:${FP}`, ttl: 1 });
    const realGet = redis.get;
    let first = true;
    redis.get = async (key) => {
      if (first) {
        first = false;
        redis.expire(key); // gone by the time we look
        return null;
      }
      return realGet(key);
    };
    expect(await claimSubmission('u1', 'press-1', FP, redis)).toEqual({
      state: 'CLAIMED',
    });
  });

  test('a key that keeps vanishing and returning is IN_FLIGHT, not an endless loop', async () => {
    const redis = newFakeRedis();
    redis.set = (async () => null) as typeof redis.set;
    redis.get = async () => null;
    expect(await claimSubmission('u1', 'press-1', FP, redis)).toEqual({
      state: 'IN_FLIGHT',
    });
  });

  test('an unreachable Redis lets the request through and logs why', async () => {
    const quiet = jest
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    const redis = newFakeRedis();
    redis.down = true;
    expect(await claimSubmission('u1', 'press-1', FP, redis)).toEqual({
      state: 'UNGUARDED',
    });
    expect(quiet).toHaveBeenCalledTimes(1);
    expect(String(quiet.mock.calls[0]![0])).toContain(
      'submission guard failed'
    );
  });
});

describe('completeSubmission and releaseSubmission', () => {
  test('release deletes the claim so the press can be tried again', async () => {
    const redis = newFakeRedis();
    await claimSubmission('u1', 'press-1', FP, redis);
    await releaseSubmission('u1', 'press-1', redis);
    expect(redis.store.size).toBe(0);
    expect(redis.calls.at(-1)).toBe(`del ${KEY}`);
    expect(await claimSubmission('u1', 'press-1', FP, redis)).toEqual({
      state: 'CLAIMED',
    });
  });

  test('neither ever throws, even with Redis down', async () => {
    const quiet = jest
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    const redis = newFakeRedis();
    redis.down = true;
    await expect(
      completeSubmission('u1', 'press-1', FP, OUTCOME, redis)
    ).resolves.toBeUndefined();
    await expect(
      releaseSubmission('u1', 'press-1', redis)
    ).resolves.toBeUndefined();
    expect(quiet).toHaveBeenCalledTimes(2);
  });

  test('the kept answer is what a repeat reads back, field for field', async () => {
    const redis = newFakeRedis();
    await completeSubmission('u1', 'press-1', FP, OUTCOME, redis);
    const stored = JSON.parse(redis.store.get(KEY)!.value) as {
      fingerprint: string;
      outcome: StoredOutcome;
    };
    expect(stored).toEqual({ fingerprint: FP, outcome: OUTCOME });
  });
});
