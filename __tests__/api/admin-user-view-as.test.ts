/**
 * /api/admin/users/view-as route tests
 *
 * POST starts a read-only view of a user (sets the cookie), DELETE stops it.
 * Both are admin-only and origin-checked. Admin accounts and the caller's
 * own account can't be viewed.
 */

jest.mock('next/server', () => ({
  __esModule: true,
  NextResponse: {
    json: (data: unknown, init?: { status?: number }) => ({
      json: async () => data,
      status: init?.status || 200,
    }),
  },
}));

const mockCookieSet = jest.fn();
jest.mock('next/headers', () => ({
  __esModule: true,
  cookies: async () => ({
    set: (...args: unknown[]) => mockCookieSet(...args),
  }),
}));

const mockValidateOrigin = jest.fn();
jest.mock('@/lib/csrf', () => ({
  __esModule: true,
  validateOrigin: () => mockValidateOrigin(),
  csrfErrorResponse: () => ({
    status: 403,
    json: async () => ({ error: 'Invalid request origin' }),
  }),
}));

const mockRequireAdmin = jest.fn();
jest.mock('@/lib/auth/session', () => ({
  __esModule: true,
  requireAdmin: () => mockRequireAdmin(),
}));

const mockUserFindUnique = jest.fn();
jest.mock('@/lib/db/prisma', () => ({
  __esModule: true,
  prisma: {
    user: { findUnique: (...a: unknown[]) => mockUserFindUnique(...a) },
  },
}));

import { AuthError } from '@/lib/auth/errors';
import { USER_VIEW_AS_COOKIE_NAME } from '@/lib/admin/user-view-as';
import { DELETE, POST } from '@/app/api/admin/users/view-as/route';

type PostReq = Parameters<typeof POST>[0];

function postReq(body: unknown): PostReq {
  return { json: async () => body } as unknown as PostReq;
}

const ADMIN_SESSION = { user: { id: 'admin_1', role: 'ADMIN' } };
const CUSTOMER = {
  id: 'user_42',
  name: 'Carol Customer',
  email: 'carol@example.com',
  tier: 'FREE',
  role: 'USER',
};

beforeEach(() => {
  jest.resetAllMocks();
  jest.spyOn(console, 'info').mockImplementation(() => undefined);
  mockValidateOrigin.mockResolvedValue(true);
  mockRequireAdmin.mockResolvedValue(ADMIN_SESSION);
  mockUserFindUnique.mockResolvedValue(CUSTOMER);
});

describe('POST', () => {
  it('sets a cookie naming the admin and the user, and points at billing', async () => {
    const res = await POST(postReq({ userId: 'user_42' }));
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchObject({
      target: { id: 'user_42', tier: 'FREE' },
      redirectTo: '/settings/billing',
    });
    expect(mockCookieSet).toHaveBeenCalledWith(
      USER_VIEW_AS_COOKIE_NAME,
      'admin_1:user_42',
      expect.objectContaining({ httpOnly: true, sameSite: 'lax', path: '/' })
    );
  });

  it('refuses a cross-origin request before any auth check', async () => {
    mockValidateOrigin.mockResolvedValue(false);
    const res = await POST(postReq({ userId: 'user_42' }));
    expect(res.status).toBe(403);
    expect(mockRequireAdmin).not.toHaveBeenCalled();
    expect(mockCookieSet).not.toHaveBeenCalled();
  });

  it('refuses a non-admin', async () => {
    mockRequireAdmin.mockRejectedValue(
      new AuthError('Admin required', 'ADMIN_REQUIRED', 403)
    );
    const res = await POST(postReq({ userId: 'user_42' }));
    expect(res.status).toBe(403);
    expect(mockCookieSet).not.toHaveBeenCalled();
  });

  it('400s without a userId', async () => {
    const res = await POST(postReq({}));
    expect(res.status).toBe(400);
    expect(mockCookieSet).not.toHaveBeenCalled();
  });

  it("refuses the admin's own account", async () => {
    const res = await POST(postReq({ userId: 'admin_1' }));
    expect(res.status).toBe(400);
    expect(mockCookieSet).not.toHaveBeenCalled();
  });

  it('404s for an admin account, same as an unknown id', async () => {
    mockUserFindUnique.mockResolvedValue({ ...CUSTOMER, role: 'ADMIN' });
    const adminTarget = await POST(postReq({ userId: 'admin_9' }));
    mockUserFindUnique.mockResolvedValue(null);
    const unknown = await POST(postReq({ userId: 'nobody' }));

    expect(adminTarget.status).toBe(404);
    expect(unknown.status).toBe(404);
    await expect(adminTarget.json()).resolves.toEqual(await unknown.json());
    expect(mockCookieSet).not.toHaveBeenCalled();
  });
});

describe('DELETE', () => {
  it('expires the cookie with the attributes it was set with', async () => {
    const res = await DELETE();
    expect(res.status).toBe(200);
    expect(mockCookieSet).toHaveBeenCalledWith(
      USER_VIEW_AS_COOKIE_NAME,
      '',
      expect.objectContaining({ httpOnly: true, path: '/', maxAge: 0 })
    );
  });

  it('refuses a cross-origin request', async () => {
    mockValidateOrigin.mockResolvedValue(false);
    const res = await DELETE();
    expect(res.status).toBe(403);
    expect(mockCookieSet).not.toHaveBeenCalled();
  });
});
