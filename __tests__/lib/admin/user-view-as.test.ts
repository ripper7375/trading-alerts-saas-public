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

function cookieFor(adminId: string, userId: string): void {
  mockCookieGet.mockImplementation((name: string) =>
    name === USER_VIEW_AS_COOKIE_NAME
      ? { value: encodeUserViewAsCookie(adminId, userId) }
      : undefined
  );
}

beforeEach(() => {
  jest.resetAllMocks();
  mockUserFindUnique.mockResolvedValue(CUSTOMER);
});

describe('cookie encoding', () => {
  it('round-trips an admin id and a user id', () => {
    expect(
      decodeUserViewAsCookie(encodeUserViewAsCookie('admin_1', 'user_42'))
    ).toEqual({ adminUserId: 'admin_1', userId: 'user_42' });
  });

  it.each([
    [undefined],
    [''],
    ['only-one-part'],
    ['a:b:c'],
    ['admin_1:user 42'],
    ['admin_1:../etc'],
  ])('rejects %p', (value) => {
    expect(decodeUserViewAsCookie(value)).toBeNull();
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
