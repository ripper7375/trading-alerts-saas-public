/**
 * @jest-environment node
 */

/**
 * Who may call the Engine 4 routes, below the routes (build step 5, part 6): the flag,
 * the session, the tier, in that order, with nothing granted by a gap.
 */

import { authorize, isReport2Enabled } from '@/lib/engine4/server/session';
import type { SessionSource } from '@/lib/engine4/server/session';

// The module imports the real session helper (next-auth, the user database) at load time.
jest.mock('@/lib/auth/session', () => ({ getSession: jest.fn() }));

const ON = { ENGINE4_REPORT2_ENABLED: 'true' };

const signedIn =
  (user: { id?: string | null; tier?: string | null }): SessionSource =>
  async () => ({ user });

describe('isReport2Enabled', () => {
  test('is true only for the exact text true', () => {
    expect(isReport2Enabled({ ENGINE4_REPORT2_ENABLED: 'true' })).toBe(true);
    for (const value of [
      undefined,
      '',
      'false',
      'TRUE',
      'True',
      '1',
      'yes',
      'on',
      ' true',
      'true ',
    ]) {
      expect([
        value,
        isReport2Enabled({ ENGINE4_REPORT2_ENABLED: value }),
      ]).toEqual([value, false]);
    }
    expect(isReport2Enabled({})).toBe(false);
  });

  test('reads the process environment by default', () => {
    const before = process.env['ENGINE4_REPORT2_ENABLED'];
    try {
      process.env['ENGINE4_REPORT2_ENABLED'] = 'true';
      expect(isReport2Enabled()).toBe(true);
      delete process.env['ENGINE4_REPORT2_ENABLED'];
      expect(isReport2Enabled()).toBe(false);
    } finally {
      if (before !== undefined) process.env['ENGINE4_REPORT2_ENABLED'] = before;
    }
  });
});

describe('authorize', () => {
  test('flag off: 404 for anybody, and the session is not even asked', async () => {
    const read = jest.fn();
    for (const env of [{}, { ENGINE4_REPORT2_ENABLED: 'false' }]) {
      expect(await authorize(read, env)).toEqual({
        ok: false,
        code: 'FEATURE_DISABLED',
        message: 'Not found',
        tier: null,
      });
    }
    expect(read).not.toHaveBeenCalled();
  });

  test('no session, or no user id: 401', async () => {
    const sources: SessionSource[] = [
      async () => null,
      signedIn({}),
      signedIn({ id: '' }),
      signedIn({ id: null, tier: 'PRO' }),
    ];
    for (const read of sources) {
      expect(await authorize(read, ON)).toMatchObject({
        ok: false,
        code: 'UNAUTHENTICATED',
        tier: null,
      });
    }
  });

  test('a Pro trader is let in with the id and the tier of the session', async () => {
    expect(await authorize(signedIn({ id: 'u1', tier: 'PRO' }), ON)).toEqual({
      ok: true,
      caller: { userId: 'u1', tier: 'PRO' },
    });
  });

  test('a Free trader is 403 and the refusal names the tier for the trace', async () => {
    expect(await authorize(signedIn({ id: 'u1', tier: 'FREE' }), ON)).toEqual({
      ok: false,
      code: 'TIER_REQUIRED',
      message: 'Report 2 is a Pro feature.',
      tier: 'FREE',
    });
  });

  test.each([
    [undefined],
    [null],
    [''],
    ['ADMIN'],
    ['pro'],
    ['PRO '],
    ['TRIAL'],
    ['PRO,FREE'],
  ])('a tier of %p is Free, never Pro', async (tier) => {
    expect(await authorize(signedIn({ id: 'u1', tier }), ON)).toMatchObject({
      ok: false,
      code: 'TIER_REQUIRED',
      tier: 'FREE',
    });
  });

  test('a session lookup that throws is not swallowed into access', async () => {
    const read: SessionSource = async () => {
      throw new Error('boom');
    };
    await expect(authorize(read, ON)).rejects.toThrow('boom');
  });
});
