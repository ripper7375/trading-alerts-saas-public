/**
 * @jest-environment node
 */

/**
 * The gate (build step 6 part 5; architecture 4.2 step 1): flag, session, tier, thread,
 * profile, quota, in that order, the first that fails ends the request, and the request is
 * read only after the tier has passed. The user and the tier come from the session and nowhere
 * else; a port that fails fails closed.
 */

import {
  runGate,
  type GateOutcome,
  type GateRequest,
  type RequestRead,
} from '@/lib/intake';

import { PROFILE, makeFake, type FakeOptions2 } from './helpers/ports';

interface Failure {
  code: 'BAD_REQUEST';
}

const TYPED: GateRequest = { kind: 'TYPED', threadId: null };
const INSTANT: GateRequest = { kind: 'INSTANT', threadId: 'thread-1' };

async function gate(
  options: FakeOptions2 = {},
  request: RequestRead<GateRequest, Failure> = { ok: true, request: TYPED }
): Promise<{
  outcome: GateOutcome<GateRequest, Failure>;
  fake: ReturnType<typeof makeFake>;
  reads: { callers: unknown[] };
}> {
  const fake = makeFake(options);
  const reads = { callers: [] as unknown[] };
  const outcome = await runGate<GateRequest, Failure>(
    fake.ports.gate,
    async (caller) => {
      reads.callers.push(caller);
      return request;
    }
  );
  return { outcome, fake, reads };
}

describe('runGate: the order', () => {
  it('refuses first on the flag: nothing else is asked, not even who is calling', async () => {
    const { outcome, fake, reads } = await gate({ enabled: false });
    expect(outcome).toEqual({ ok: false, kind: 'DISABLED' });
    expect(fake.calls.enabled).toBe(1);
    expect(fake.calls.session).toBe(0);
    expect(fake.calls.entitlement).toBe(0);
    expect(fake.calls.thread).toBe(0);
    expect(fake.calls.profile).toBe(0);
    expect(fake.calls.quota).toBe(0);
    expect(reads.callers).toEqual([]);
  });

  it('then the session: no one is signed in', async () => {
    const { outcome, fake, reads } = await gate({ session: null });
    expect(outcome).toEqual({
      ok: false,
      kind: 'REFUSED',
      code: 'NOT_SIGNED_IN',
      tier: null,
      problems: [],
    });
    expect(fake.calls.entitlement).toBe(0);
    expect(reads.callers).toEqual([]);
  });

  it('a session with no user id is no session', async () => {
    const { outcome } = await gate({ session: { userId: '', tier: 'PRO' } });
    expect(outcome).toMatchObject({ kind: 'REFUSED', code: 'NOT_SIGNED_IN' });
  });

  it('a session that cannot be read fails closed as not signed in', async () => {
    const { outcome, fake } = await gate({ session: 'THROWS' });
    expect(outcome).toMatchObject({
      kind: 'REFUSED',
      code: 'NOT_SIGNED_IN',
      tier: null,
      problems: ['SESSION_PORT_ERROR: session store down'],
    });
    expect(fake.calls.entitlement).toBe(0);
  });

  it('then the tier: a Free trader is refused before the request is read', async () => {
    const { outcome, fake, reads } = await gate({
      session: { userId: 'user-free-1', tier: 'FREE' },
      entitlement: false,
    });
    expect(outcome).toEqual({
      ok: false,
      kind: 'REFUSED',
      code: 'TIER_REQUIRED',
      tier: 'FREE',
      problems: [],
    });
    expect(fake.calls.entitlementTiers).toEqual(['FREE']);
    expect(reads.callers).toEqual([]);
    expect(fake.calls.thread).toBe(0);
    expect(fake.calls.profile).toBe(0);
    expect(fake.calls.quota).toBe(0);
  });

  it('only a literal true from the entitlement port lets a trader through', async () => {
    for (const answer of ['yes', 1, {}, undefined, null]) {
      const fake = makeFake();
      const outcome = await runGate<GateRequest, Failure>(
        {
          ...fake.ports.gate,
          entitlement: { allows: () => answer as unknown as boolean },
        },
        async () => ({ ok: true, request: TYPED })
      );
      expect(outcome).toMatchObject({ kind: 'REFUSED', code: 'TIER_REQUIRED' });
    }
  });

  it('an entitlement port that fails fails closed as unavailable', async () => {
    const { outcome, reads } = await gate({ entitlement: 'THROWS' });
    expect(outcome).toMatchObject({
      kind: 'REFUSED',
      code: 'FEATURE_UNAVAILABLE',
      tier: 'PRO',
      problems: ['ENTITLEMENT_PORT_ERROR: entitlements down'],
    });
    expect(reads.callers).toEqual([]);
  });

  it('reads the request once, after the tier, with the caller from the session', async () => {
    const { reads, fake } = await gate({
      session: { userId: 'user-77', tier: 'PRO' },
    });
    expect(reads.callers).toEqual([{ userId: 'user-77', tier: 'PRO' }]);
    expect(fake.calls.entitlement).toBe(1);
  });

  it('a request that cannot be read is the reader’s failure, not a refusal, and nothing after it is asked', async () => {
    const { outcome, fake } = await gate(
      {},
      { ok: false, failure: { code: 'BAD_REQUEST' } }
    );
    expect(outcome).toEqual({
      ok: false,
      kind: 'REQUEST',
      failure: { code: 'BAD_REQUEST' },
      tier: 'PRO',
    });
    expect(fake.calls.thread).toBe(0);
    expect(fake.calls.profile).toBe(0);
    expect(fake.calls.quota).toBe(0);
  });

  it('then the thread (decision D6 (a)): XAUUSD and an optional id', async () => {
    const { outcome, fake } = await gate(
      { thread: 'INVALID' },
      {
        ok: true,
        request: INSTANT,
      }
    );
    expect(outcome).toEqual({
      ok: false,
      kind: 'REFUSED',
      code: 'THREAD_INVALID',
      tier: 'PRO',
      problems: [],
    });
    expect(fake.calls.threadChecks).toEqual([
      { userId: 'user-pro-1', threadId: 'thread-1', symbol: 'XAUUSD' },
    ]);
    expect(fake.calls.profile).toBe(0);
    expect(fake.calls.quota).toBe(0);
  });

  it('a thread port that fails fails closed as unavailable', async () => {
    const { outcome, fake } = await gate({ thread: 'THROWS' });
    expect(outcome).toMatchObject({
      kind: 'REFUSED',
      code: 'FEATURE_UNAVAILABLE',
      problems: ['THREAD_PORT_ERROR: threads down'],
    });
    expect(fake.calls.profile).toBe(0);
  });

  it('then the profile: not confirmed asks the trader to confirm it', async () => {
    const { outcome, fake } = await gate({
      profile: { ok: false, code: 'PROFILE_NOT_SET', detail: 'none' },
    });
    expect(outcome).toEqual({
      ok: false,
      kind: 'REFUSED',
      code: 'PROFILE_NOT_SET',
      tier: 'PRO',
      problems: ['PROFILE_NOT_SET: none'],
    });
    expect(fake.calls.profileUsers).toEqual(['user-pro-1']);
    expect(fake.calls.quota).toBe(0);
  });

  it('a stored profile that no longer passes its validator is asked to be confirmed again', async () => {
    const { outcome, fake } = await gate({
      profile: { ok: false, code: 'PROFILE_UNREADABLE', detail: 'bad' },
    });
    expect(outcome).toMatchObject({
      kind: 'REFUSED',
      code: 'PROFILE_NOT_SET',
      problems: ['PROFILE_UNREADABLE: bad'],
    });
    expect(fake.calls.quota).toBe(0);
  });

  it('a profile database that cannot be read is the feature being unavailable', async () => {
    const { outcome } = await gate({
      profile: { ok: false, code: 'DATABASE_ERROR', detail: 'timeout' },
    });
    expect(outcome).toMatchObject({
      kind: 'REFUSED',
      code: 'FEATURE_UNAVAILABLE',
      problems: ['PROFILE_DATABASE_ERROR: timeout'],
    });
  });

  it('a profile port that fails fails closed as unavailable', async () => {
    const { outcome, fake } = await gate({ profile: 'THROWS' });
    expect(outcome).toMatchObject({
      kind: 'REFUSED',
      code: 'FEATURE_UNAVAILABLE',
      problems: ['PROFILE_PORT_ERROR: profiles down'],
    });
    expect(fake.calls.quota).toBe(0);
  });

  it('last the quota pre-check (decision D5 (A)), for the kind of request', async () => {
    const typed = await gate({ quota: false }, { ok: true, request: TYPED });
    expect(typed.outcome).toEqual({
      ok: false,
      kind: 'REFUSED',
      code: 'QUOTA_INSUFFICIENT',
      tier: 'PRO',
      problems: [],
    });
    expect(typed.fake.calls.quotaRequests).toEqual([
      { userId: 'user-pro-1', tier: 'PRO', kind: 'TYPED' },
    ]);
    const instant = await gate(
      { quota: false },
      { ok: true, request: INSTANT }
    );
    expect(instant.fake.calls.quotaRequests).toEqual([
      { userId: 'user-pro-1', tier: 'PRO', kind: 'INSTANT' },
    ]);
  });

  it('only a literal true from the quota port lets a request through', async () => {
    for (const allowed of ['true', 1, undefined, null]) {
      const fake = makeFake();
      const outcome = await runGate<GateRequest, Failure>(
        {
          ...fake.ports.gate,
          quota: {
            precheck: async () => ({ allowed: allowed as unknown as boolean }),
          },
        },
        async () => ({ ok: true, request: TYPED })
      );
      expect(outcome).toMatchObject({
        kind: 'REFUSED',
        code: 'QUOTA_INSUFFICIENT',
      });
    }
  });

  it('a quota port that fails never lets a request through for free', async () => {
    const { outcome } = await gate({ quota: 'THROWS' });
    expect(outcome).toMatchObject({
      kind: 'REFUSED',
      code: 'FEATURE_UNAVAILABLE',
      problems: ['QUOTA_PORT_ERROR: quota down'],
    });
  });
});

describe('runGate: the first failure decides', () => {
  /** each case breaks one step and everything after it, with everything before it fine */
  const BREAK: Record<string, FakeOptions2> = {
    flag: { enabled: false },
    session: { session: null },
    tier: { entitlement: false },
    thread: { thread: 'INVALID' },
    profile: { profile: { ok: false, code: 'PROFILE_NOT_SET', detail: '' } },
    quota: { quota: false },
  };
  const ORDER = ['flag', 'session', 'tier', 'thread', 'profile', 'quota'];
  const EXPECTED: Record<string, string> = {
    flag: 'DISABLED',
    session: 'NOT_SIGNED_IN',
    tier: 'TIER_REQUIRED',
    thread: 'THREAD_INVALID',
    profile: 'PROFILE_NOT_SET',
    quota: 'QUOTA_INSUFFICIENT',
  };

  it.each(ORDER)(
    'breaking %s and every later step still gives its own answer',
    async (step) => {
      const index = ORDER.indexOf(step);
      const options: FakeOptions2 = {};
      for (const later of ORDER.slice(index))
        Object.assign(options, BREAK[later]);
      const { outcome } = await gate(options);
      const code =
        outcome.ok === false
          ? outcome.kind === 'DISABLED'
            ? 'DISABLED'
            : outcome.kind === 'REFUSED'
              ? outcome.code
              : 'REQUEST'
          : 'OK';
      expect(code).toBe(EXPECTED[step]);
    }
  );

  it('with every step fine, the request goes through with what the ports said', async () => {
    const { outcome, fake } = await gate({}, { ok: true, request: INSTANT });
    expect(outcome).toEqual({
      ok: true,
      caller: { userId: 'user-pro-1', tier: 'PRO' },
      request: INSTANT,
      threadId: 'thread-1',
      profile: PROFILE,
    });
    for (const count of [
      fake.calls.enabled,
      fake.calls.session,
      fake.calls.entitlement,
      fake.calls.thread,
      fake.calls.profile,
      fake.calls.quota,
    ]) {
      expect(count).toBe(1);
    }
  });
});

describe('runGate: a port that throws something that is not an Error', () => {
  it.each([
    ['session', 'SESSION_PORT_ERROR', 'NOT_SIGNED_IN'],
    ['entitlement', 'ENTITLEMENT_PORT_ERROR', 'FEATURE_UNAVAILABLE'],
    ['thread', 'THREAD_PORT_ERROR', 'FEATURE_UNAVAILABLE'],
    ['profile', 'PROFILE_PORT_ERROR', 'FEATURE_UNAVAILABLE'],
    ['quota', 'QUOTA_PORT_ERROR', 'FEATURE_UNAVAILABLE'],
  ] as const)(
    '%s: is an unknown error, never its text',
    async (port, problem, code) => {
      for (const thrown of [
        'secret text',
        42,
        null,
        undefined,
        { message: 'secret' },
      ]) {
        const base = makeFake().ports.gate;
        const failing = (): never => {
          throw thrown;
        };
        const ports = {
          ...base,
          [port]:
            port === 'entitlement'
              ? { allows: failing }
              : port === 'session'
                ? { current: failing }
                : port === 'thread'
                  ? { check: failing }
                  : port === 'profile'
                    ? { read: failing }
                    : { precheck: failing },
        };
        const outcome = await runGate<GateRequest, Failure>(
          ports,
          async () => ({
            ok: true,
            request: TYPED,
          })
        );
        expect(outcome).toMatchObject({
          kind: 'REFUSED',
          code,
          problems: [`${problem}: unknown error`],
        });
      }
    }
  );
});

describe('runGate: who is calling', () => {
  it('takes the user and the tier from the session, whatever the request says', async () => {
    const forged = {
      kind: 'TYPED',
      threadId: null,
      userId: 'victim',
      user: { id: 'victim' },
      tier: 'PRO',
    } as unknown as GateRequest;
    const { fake } = await gate(
      { session: { userId: 'real-user', tier: 'FREE' }, entitlement: true },
      { ok: true, request: forged }
    );
    expect(fake.calls.entitlementTiers).toEqual(['FREE']);
    expect(fake.calls.threadChecks.map((c) => c.userId)).toEqual(['real-user']);
    expect(fake.calls.profileUsers).toEqual(['real-user']);
    expect(fake.calls.quotaRequests).toEqual([
      { userId: 'real-user', tier: 'FREE', kind: 'TYPED' },
    ]);
  });

  it('a GateRequest has no field that could name a user or a tier', () => {
    const request: GateRequest = { kind: 'TYPED', threadId: null };
    expect(Object.keys(request).sort()).toEqual(['kind', 'threadId']);
  });
});
