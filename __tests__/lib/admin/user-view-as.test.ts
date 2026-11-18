/**
 * lib/admin/user-view-as.ts -- admin read-only "view as user".
 *
 * A route may serve another user's data only when BOTH hold: the request
 * opted in with ?view_as=user, AND the caller is an admin holding a cookie
 * minted for their own id that names an existing, non-admin user. Every
 * other combination must fall back to the caller (no opt-in) or be denied
 * (opt-in without a valid view) -- never silently serve the admin's data
 * under a viewed-user banner, and never serve someone else to a non-admin.
 */

const mockCookieGet = jest.fn();
jest.mock('next/headers', () => ({
  __esModule: true,
  cookies: async () => ({ get: (name: string) => mockCookieGet(name) }),
}));

const mockUserFindUnique = jest.fn();
jest.mock('@/lib/db/prisma', () => ({
  __esModule: true,
  prisma: {
    user: { findUnique: (...a: unknown[]) => mockUserFindUnique(...a) },
  },
}));

import {
  USER_VIEW_AS_COOKIE_NAME,
  USER_VIEW_AS_MAX_AGE_SECONDS,
  decodeUserViewAsCookie,
  encodeUserViewAsCookie,
  getAdminUserViewAs,
  isViewAsRequest,
  resolveViewAsSubject,
} from '@/lib/admin/user-view-as';
import {
  isUserViewAsPath,
  withViewAsQuery,
} from '@/lib/admin/user-view-as-paths';
import { signIdPair } from '@/lib/security/signed-value';

/** The clock every test runs on, so cookie ages are exact. */
const NOW_SEC = 1_793_000_000;

const ADMIN = { id: 'admin_1', role: 'ADMIN' };
const CUSTOMER = {
  id: 'user_42',
  name: 'Carol Customer',
  email: 'carol@example.com',
  tier: 'PRO',
  role: 'USER',
};

function req(query = ''): { url: string } {
  return { url: `https://davintrade.app/api/user/login-history${query}` };
}

function cookieWith(value: string): void {
  mockCookieGet.mockImplementation((name: string) =>
    name === USER_VIEW_AS_COOKIE_NAME ? { value } : undefined
  );
}

function cookieFor(
  adminId: string,
  userId: string,
  issuedAtSec: number = NOW_SEC
): void {
  cookieWith(encodeUserViewAsCookie(adminId, userId, issuedAtSec));
}

beforeEach(() => {
  jest.resetAllMocks();
  jest.spyOn(Date, 'now').mockReturnValue(NOW_SEC * 1000);
  mockUserFindUnique.mockResolvedValue(CUSTOMER);
});

describe('cookie encoding', () => {
  it('round-trips an admin id and a user id', () => {
    expect(
      decodeUserViewAsCookie(encodeUserViewAsCookie('admin_1', 'user_42'))
    ).toEqual({ adminUserId: 'admin_1', userId: 'user_42' });
  });

  it('is a signed uview1 value stamped with the issue time', () => {
    expect(encodeUserViewAsCookie('admin_1', 'user_42', NOW_SEC)).toMatch(
      /^uview1:admin_1:user_42:1793000000:[0-9a-f]{64}$/
    );
    expect(encodeUserViewAsCookie('admin_1', 'user_42')).toBe(
      encodeUserViewAsCookie('admin_1', 'user_42', NOW_SEC)
    );
  });

  it.each([
    [undefined],
    [''],
    ['only-one-part'],
    ['a:b:c'],
    ['admin_1:user 42'],
    ['admin_1:../etc'],
    // the unsigned `admin:user` pair of earlier releases
    ['admin_1:user_42'],
  ])('rejects %p', (value) => {
    expect(decodeUserViewAsCookie(value)).toBeNull();
  });

  it('rejects a value whose admin or target was changed after it was signed', () => {
    const value = encodeUserViewAsCookie('admin_1', 'user_42');
    expect(
      decodeUserViewAsCookie(value.replace('user_42', 'user_43'))
    ).toBeNull();
    expect(
      decodeUserViewAsCookie(value.replace('admin_1', 'admin_2'))
    ).toBeNull();
  });

  it('accepts a value up to the end of a view and rejects it one second later', () => {
    const value = encodeUserViewAsCookie('admin_1', 'user_42', NOW_SEC);
    expect(
      decodeUserViewAsCookie(value, NOW_SEC + USER_VIEW_AS_MAX_AGE_SECONDS)
    ).not.toBeNull();
    expect(
      decodeUserViewAsCookie(value, NOW_SEC + USER_VIEW_AS_MAX_AGE_SECONDS + 1)
    ).toBeNull();
  });

  it('rejects a value signed for the affiliate view-as cookie', () => {
    const forAffiliate = signIdPair('aview1', 'admin_1', 'user_42', NOW_SEC);
    expect(decodeUserViewAsCookie(forAffiliate)).toBeNull();
    expect(
      decodeUserViewAsCookie(forAffiliate.replace(/^aview1/, 'uview1'))
    ).toBeNull();
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
        require('@/lib/admin/user-view-as') as typeof import('@/lib/admin/user-view-as');

      expect(production.USER_VIEW_AS_COOKIE_NAME).toBe('__Host-user-view-as');
      const options = production.userViewAsCookieOptions(7200);
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
    expect(USER_VIEW_AS_COOKIE_NAME).toBe('davintrade-admin-view-user');
  });
});

describe('opt-in detection', () => {
  it('reads ?view_as=user from url or nextUrl', () => {
    expect(isViewAsRequest(req('?view_as=user'))).toBe(true);
    expect(
      isViewAsRequest({
        nextUrl: new URL('https://x.test/api/invoices?view_as=user'),
      })
    ).toBe(true);
    expect(isViewAsRequest(req())).toBe(false);
    expect(isViewAsRequest(req('?view_as=admin'))).toBe(false);
    expect(isViewAsRequest({})).toBe(false);
  });

  it('withViewAsQuery appends only when active', () => {
    expect(withViewAsQuery('/api/invoices', false)).toBe('/api/invoices');
    expect(withViewAsQuery('/api/invoices', true)).toBe(
      '/api/invoices?view_as=user'
    );
    expect(withViewAsQuery('/api/x?limit=20', true)).toBe(
      '/api/x?limit=20&view_as=user'
    );
  });

  it('only billing, security and security activity are view-as pages', () => {
    expect(isUserViewAsPath('/settings/billing')).toBe(true);
    expect(isUserViewAsPath('/settings/security')).toBe(true);
    expect(isUserViewAsPath('/settings/security/activity')).toBe(true);
    expect(isUserViewAsPath('/settings/profile')).toBe(false);
    expect(isUserViewAsPath('/settings/account')).toBe(false);
    expect(isUserViewAsPath(null)).toBe(false);
  });
});

describe('getAdminUserViewAs', () => {
  it('returns the viewed user for the admin who started the view', async () => {
    cookieFor('admin_1', 'user_42');
    await expect(getAdminUserViewAs(ADMIN)).resolves.toEqual(CUSTOMER);
  });

  it('ignores the cookie for a non-admin session', async () => {
    cookieFor('user_7', 'user_42');
    await expect(
      getAdminUserViewAs({ id: 'user_7', role: 'USER' })
    ).resolves.toBeNull();
  });

  it("ignores a cookie minted for a different admin's id", async () => {
    cookieFor('admin_2', 'user_42');
    await expect(getAdminUserViewAs(ADMIN)).resolves.toBeNull();
  });

  it('refuses to view an admin account', async () => {
    cookieFor('admin_1', 'admin_9');
    mockUserFindUnique.mockResolvedValue({ ...CUSTOMER, role: 'ADMIN' });
    await expect(getAdminUserViewAs(ADMIN)).resolves.toBeNull();
  });

  it('returns null when the user no longer exists', async () => {
    cookieFor('admin_1', 'user_42');
    mockUserFindUnique.mockResolvedValue(null);
    await expect(getAdminUserViewAs(ADMIN)).resolves.toBeNull();
  });

  it('fails closed on any error', async () => {
    cookieFor('admin_1', 'user_42');
    mockUserFindUnique.mockRejectedValue(new Error('db down'));
    await expect(getAdminUserViewAs(ADMIN)).resolves.toBeNull();
  });

  it('honours a cookie right up to the end of the view', async () => {
    cookieFor('admin_1', 'user_42', NOW_SEC - USER_VIEW_AS_MAX_AGE_SECONDS);
    await expect(getAdminUserViewAs(ADMIN)).resolves.toEqual(CUSTOMER);
  });

  it('ignores a cookie older than a view may last, without loading the user', async () => {
    cookieFor('admin_1', 'user_42', NOW_SEC - USER_VIEW_AS_MAX_AGE_SECONDS - 1);
    await expect(getAdminUserViewAs(ADMIN)).resolves.toBeNull();
    expect(mockUserFindUnique).not.toHaveBeenCalled();
  });

  it('ignores an unsigned cookie that names the right ids', async () => {
    cookieWith('admin_1:user_42');
    await expect(getAdminUserViewAs(ADMIN)).resolves.toBeNull();
    expect(mockUserFindUnique).not.toHaveBeenCalled();
  });

  it('ignores a signed cookie whose target was changed', async () => {
    cookieWith(
      encodeUserViewAsCookie('admin_1', 'user_42', NOW_SEC).replace(
        'user_42',
        'user_43'
      )
    );
    await expect(getAdminUserViewAs(ADMIN)).resolves.toBeNull();
    expect(mockUserFindUnique).not.toHaveBeenCalled();
  });

  it('ignores a cookie signed for the affiliate view', async () => {
    cookieWith(signIdPair('aview1', 'admin_1', 'user_42', NOW_SEC));
    await expect(getAdminUserViewAs(ADMIN)).resolves.toBeNull();
    expect(mockUserFindUnique).not.toHaveBeenCalled();
  });
});

describe('resolveViewAsSubject', () => {
  it('without the opt-in, is always the caller and never reads the cookie', async () => {
    cookieFor('admin_1', 'user_42');
    await expect(resolveViewAsSubject(req(), ADMIN)).resolves.toEqual({
      kind: 'self',
      userId: 'admin_1',
    });
    expect(mockCookieGet).not.toHaveBeenCalled();
  });

  it('with the opt-in and a valid view, is the viewed user', async () => {
    cookieFor('admin_1', 'user_42');
    await expect(
      resolveViewAsSubject(req('?view_as=user'), ADMIN)
    ).resolves.toEqual({
      kind: 'view-as',
      userId: 'user_42',
      target: CUSTOMER,
    });
  });

  it('with the opt-in but no valid view, is denied (not the caller)', async () => {
    mockCookieGet.mockReturnValue(undefined);
    await expect(
      resolveViewAsSubject(req('?view_as=user'), ADMIN)
    ).resolves.toEqual({ kind: 'denied' });
  });

  it('a non-admin adding the opt-in is denied', async () => {
    cookieFor('user_7', 'user_42');
    await expect(
      resolveViewAsSubject(req('?view_as=user'), { id: 'user_7', role: 'USER' })
    ).resolves.toEqual({ kind: 'denied' });
  });
});
