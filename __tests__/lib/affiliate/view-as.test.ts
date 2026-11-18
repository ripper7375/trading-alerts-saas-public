/**
 * Admin "view as affiliate" resolver tests (lib/affiliate/view-as.ts)
 *
 * The resolver decides whose data the affiliate dashboard serves, so the
 * cases that matter are the refusals: a non-admin, a cookie written for a
 * different admin, a malformed cookie, a missing profile, and any error must
 * all resolve to `null` (normal affiliate checks apply). Bank data must never
 * come back.
 */

const mockGetSession = jest.fn();
jest.mock('@/lib/auth/session', () => ({
  __esModule: true,
  getSession: () => mockGetSession(),
}));

const mockCookieGet = jest.fn();
jest.mock('next/headers', () => ({
  __esModule: true,
  cookies: async () => ({ get: (name: string) => mockCookieGet(name) }),
}));

const mockProfileFindUnique = jest.fn();
const mockUserFindUnique = jest.fn();
jest.mock('@/lib/db/prisma', () => ({
  __esModule: true,
  prisma: {
    affiliateProfile: {
      findUnique: (...args: unknown[]) => mockProfileFindUnique(...args),
    },
    user: {
      findUnique: (...args: unknown[]) => mockUserFindUnique(...args),
    },
  },
}));

import {
  VIEW_AS_COOKIE_NAME,
  VIEW_AS_MAX_AGE_SECONDS,
  decodeViewAsCookie,
  encodeViewAsCookie,
  getAdminViewAs,
  loadViewAsTarget,
  viewAsCookieOptions,
} from '@/lib/affiliate/view-as';
import { signIdPair } from '@/lib/security/signed-value';

/** The clock every test runs on, so cookie ages are exact. */
const NOW_SEC = 1_793_000_000;

const PROFILE_ROW = {
  id: 'prof_1',
  userId: 'user_aff',
  fullName: 'Alice Affiliate',
  country: 'TH',
  paymentMethod: 'WISE',
  paymentDetails: { iban: 'GB00 SECRET', accountHolder: 'Alice' },
  status: 'ACTIVE',
  totalEarnings: '120.50',
  pendingCommissions: '20',
  paidCommissions: '100.5',
};

function adminSession(id = 'admin_1'): unknown {
  return { user: { id, role: 'ADMIN' } };
}

function viewCookie(
  adminId = 'admin_1',
  profileId = 'prof_1',
  issuedAtSec = NOW_SEC
): { value: string } {
  return { value: encodeViewAsCookie(adminId, profileId, issuedAtSec) };
}

beforeEach(() => {
  jest.resetAllMocks();
  jest.spyOn(Date, 'now').mockReturnValue(NOW_SEC * 1000);
  mockProfileFindUnique.mockResolvedValue(PROFILE_ROW);
  mockUserFindUnique.mockResolvedValue({ email: 'alice@example.com' });
});

describe('view-as cookie encoding', () => {
  it('round-trips admin id and profile id', () => {
    expect(decodeViewAsCookie(encodeViewAsCookie('admin_1', 'prof_1'))).toEqual(
      { adminUserId: 'admin_1', profileId: 'prof_1' }
    );
  });

  it('is a signed aview1 value stamped with the issue time', () => {
    expect(encodeViewAsCookie('admin_1', 'prof_1', NOW_SEC)).toMatch(
      /^aview1:admin_1:prof_1:1793000000:[0-9a-f]{64}$/
    );
    expect(encodeViewAsCookie('admin_1', 'prof_1')).toBe(
      encodeViewAsCookie('admin_1', 'prof_1', NOW_SEC)
    );
  });

  it.each([
    ['empty', ''],
    ['no separator', 'admin_1prof_1'],
    ['extra part', 'a:b:c'],
    ['unsafe characters', 'admin_1:prof 1;drop'],
    ['over-long id', `admin_1:${'x'.repeat(65)}`],
    ['unsigned pair of earlier releases', 'admin_1:prof_1'],
  ])('rejects a %s value', (_label, value) => {
    expect(decodeViewAsCookie(value)).toBeNull();
  });

  it('rejects a value whose admin or profile was changed after it was signed', () => {
    const value = encodeViewAsCookie('admin_1', 'prof_1');
    expect(decodeViewAsCookie(value.replace('prof_1', 'prof_2'))).toBeNull();
    expect(decodeViewAsCookie(value.replace('admin_1', 'admin_2'))).toBeNull();
  });

  it('accepts a value up to the end of a view and rejects it one second later', () => {
    const value = encodeViewAsCookie('admin_1', 'prof_1', NOW_SEC);
    expect(
      decodeViewAsCookie(value, NOW_SEC + VIEW_AS_MAX_AGE_SECONDS)
    ).not.toBeNull();
    expect(
      decodeViewAsCookie(value, NOW_SEC + VIEW_AS_MAX_AGE_SECONDS + 1)
    ).toBeNull();
  });

  it('rejects a value signed for the user view-as cookie', () => {
    const forUser = signIdPair('uview1', 'admin_1', 'prof_1', NOW_SEC);
    expect(decodeViewAsCookie(forUser)).toBeNull();
    expect(decodeViewAsCookie(forUser.replace(/^uview1/, 'aview1'))).toBeNull();
  });
});

describe('production cookie', () => {
  const env = process.env as Record<string, string | undefined>;
  const nodeEnv = env['NODE_ENV'];

  afterEach(() => {
    env['NODE_ENV'] = nodeEnv;
  });

  it('is named with the __Host- prefix and meets its rules: Secure, Path=/, no Domain', () => {
    env['NODE_ENV'] = 'production';
    jest.isolateModules(() => {
      const production =
        require('@/lib/affiliate/view-as') as typeof import('@/lib/affiliate/view-as');

      expect(production.VIEW_AS_COOKIE_NAME).toBe('__Host-affiliate-view-as');
      const options = production.viewAsCookieOptions(7200);
      expect(options).toEqual({
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: true,
        maxAge: 7200,
      });
      expect(options).not.toHaveProperty('domain');
    });
  });

  it('keeps the plain name outside production, where a Secure cookie would not be stored', () => {
    expect(VIEW_AS_COOKIE_NAME).toBe('davintrade-admin-view-as');
    expect(viewAsCookieOptions(7200).secure).toBe(false);
  });
});

describe('loadViewAsTarget', () => {
  it('returns the profile with payment details removed and numbers coerced', async () => {
    const loaded = await loadViewAsTarget('prof_1');

    expect(loaded?.target).toEqual({
      profileId: 'prof_1',
      userId: 'user_aff',
      fullName: 'Alice Affiliate',
      email: 'alice@example.com',
      status: 'ACTIVE',
    });
    expect(loaded?.profile.paymentDetails).toEqual({});
    expect(JSON.stringify(loaded)).not.toContain('SECRET');
    expect(loaded?.profile.totalEarnings).toBe(120.5);
  });

  it('does not carry the encrypted payment column either (WS-11)', async () => {
    mockProfileFindUnique.mockResolvedValue({
      ...PROFILE_ROW,
      paymentDetailsEncrypted: 'v1:aa:bb:CIPHERTEXT-MARKER',
    });

    const loaded = await loadViewAsTarget('prof_1');

    expect(loaded?.profile.paymentDetails).toEqual({});
    expect(loaded?.profile).not.toHaveProperty('paymentDetailsEncrypted');
    expect(JSON.stringify(loaded)).not.toContain('CIPHERTEXT-MARKER');
  });

  it('returns null for an unknown profile and never creates one', async () => {
    mockProfileFindUnique.mockResolvedValue(null);
    await expect(loadViewAsTarget('prof_missing')).resolves.toBeNull();
  });
});

describe('getAdminViewAs', () => {
  it('returns the target for an admin with a cookie written for them', async () => {
    mockGetSession.mockResolvedValue(adminSession());
    mockCookieGet.mockReturnValue(viewCookie());

    const viewAs = await getAdminViewAs();

    expect(mockCookieGet).toHaveBeenCalledWith(VIEW_AS_COOKIE_NAME);
    expect(viewAs?.adminUserId).toBe('admin_1');
    expect(viewAs?.target.profileId).toBe('prof_1');
    expect(viewAs?.profile.paymentDetails).toEqual({});
  });

  it('ignores the cookie for a non-admin', async () => {
    mockGetSession.mockResolvedValue({ user: { id: 'admin_1', role: 'USER' } });
    mockCookieGet.mockReturnValue(viewCookie());

    await expect(getAdminViewAs()).resolves.toBeNull();
    expect(mockProfileFindUnique).not.toHaveBeenCalled();
  });

  it('ignores a cookie written for a different admin', async () => {
    mockGetSession.mockResolvedValue(adminSession('admin_2'));
    mockCookieGet.mockReturnValue(viewCookie());

    await expect(getAdminViewAs()).resolves.toBeNull();
  });

  it('returns null for an admin with no cookie', async () => {
    mockGetSession.mockResolvedValue(adminSession());
    mockCookieGet.mockReturnValue(undefined);

    await expect(getAdminViewAs()).resolves.toBeNull();
  });

  it('returns null when the viewed profile no longer exists', async () => {
    mockGetSession.mockResolvedValue(adminSession());
    mockCookieGet.mockReturnValue(viewCookie('admin_1', 'prof_gone'));
    mockProfileFindUnique.mockResolvedValue(null);

    await expect(getAdminViewAs()).resolves.toBeNull();
  });

  it('honours a cookie right up to the end of the view', async () => {
    mockGetSession.mockResolvedValue(adminSession());
    mockCookieGet.mockReturnValue(
      viewCookie('admin_1', 'prof_1', NOW_SEC - VIEW_AS_MAX_AGE_SECONDS)
    );

    await expect(getAdminViewAs()).resolves.not.toBeNull();
  });

  it('ignores a cookie older than a view may last, without loading the profile', async () => {
    mockGetSession.mockResolvedValue(adminSession());
    mockCookieGet.mockReturnValue(
      viewCookie('admin_1', 'prof_1', NOW_SEC - VIEW_AS_MAX_AGE_SECONDS - 1)
    );

    await expect(getAdminViewAs()).resolves.toBeNull();
    expect(mockProfileFindUnique).not.toHaveBeenCalled();
  });

  it('ignores an unsigned cookie that names the right ids', async () => {
    mockGetSession.mockResolvedValue(adminSession());
    mockCookieGet.mockReturnValue({ value: 'admin_1:prof_1' });

    await expect(getAdminViewAs()).resolves.toBeNull();
    expect(mockProfileFindUnique).not.toHaveBeenCalled();
  });

  it('ignores a signed cookie whose profile was changed', async () => {
    mockGetSession.mockResolvedValue(adminSession());
    mockCookieGet.mockReturnValue({
      value: viewCookie().value.replace('prof_1', 'prof_2'),
    });

    await expect(getAdminViewAs()).resolves.toBeNull();
    expect(mockProfileFindUnique).not.toHaveBeenCalled();
  });

  it('ignores a cookie signed for the user view', async () => {
    mockGetSession.mockResolvedValue(adminSession());
    mockCookieGet.mockReturnValue({
      value: signIdPair('uview1', 'admin_1', 'prof_1', NOW_SEC),
    });

    await expect(getAdminViewAs()).resolves.toBeNull();
    expect(mockProfileFindUnique).not.toHaveBeenCalled();
  });

  it('fails closed on any error', async () => {
    mockGetSession.mockRejectedValue(new Error('session store down'));

    await expect(getAdminViewAs()).resolves.toBeNull();
  });
});
