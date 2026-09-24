/**
 * /api/admin/affiliates/view-as route tests
 *
 * GET searches affiliates, POST starts a read-only view (sets the cookie),
 * DELETE stops it. All three are admin-only; POST/DELETE are origin-checked.
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

const mockLoadViewAsTarget = jest.fn();
jest.mock('@/lib/affiliate/view-as', () => {
  const actual = jest.requireActual('@/lib/affiliate/view-as');
  return {
    __esModule: true,
    ...actual,
    loadViewAsTarget: (id: string) => mockLoadViewAsTarget(id),
  };
});

const mockUserFindMany = jest.fn();
const mockCodeFindMany = jest.fn();
const mockProfileFindMany = jest.fn();
const mockProfileCount = jest.fn();
jest.mock('@/lib/db/prisma', () => ({
  __esModule: true,
  prisma: {
    user: { findMany: (...a: unknown[]) => mockUserFindMany(...a) },
    affiliateCode: { findMany: (...a: unknown[]) => mockCodeFindMany(...a) },
    affiliateProfile: {
      findMany: (...a: unknown[]) => mockProfileFindMany(...a),
      count: (...a: unknown[]) => mockProfileCount(...a),
    },
  },
}));

import { AuthError } from '@/lib/auth/errors';
import { VIEW_AS_COOKIE_NAME } from '@/lib/affiliate/view-as';
import { DELETE, GET, POST } from '@/app/api/admin/affiliates/view-as/route';

type Req = Parameters<typeof GET>[0];

function getRequest(query = ''): Req {
  return {
    nextUrl: new URL(`http://localhost/api/admin/affiliates/view-as${query}`),
  } as unknown as Req;
}

function postRequest(body: unknown): Req {
  return { json: async () => body } as unknown as Req;
}

const forbidden = new AuthError('no', 'ADMIN_REQUIRED', 403);

beforeEach(() => {
  jest.resetAllMocks();
  mockValidateOrigin.mockResolvedValue(true);
  mockRequireAdmin.mockResolvedValue({
    user: { id: 'admin_1', role: 'ADMIN' },
  });
  jest.spyOn(console, 'info').mockImplementation(() => undefined);
});

describe('POST (start viewing)', () => {
  it('sets a cookie bound to the admin and the chosen profile', async () => {
    mockLoadViewAsTarget.mockResolvedValue({
      target: { profileId: 'prof_1', fullName: 'Alice' },
      profile: {},
    });

    const res = await POST(postRequest({ profileId: 'prof_1' }));

    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({
      redirectTo: '/affiliate/dashboard',
    });
    expect(mockCookieSet).toHaveBeenCalledWith(
      VIEW_AS_COOKIE_NAME,
      'admin_1:prof_1',
      expect.objectContaining({ httpOnly: true, maxAge: 7200 })
    );
  });

  it('refuses a non-admin without setting anything', async () => {
    mockRequireAdmin.mockRejectedValue(forbidden);

    const res = await POST(postRequest({ profileId: 'prof_1' }));

    expect(res.status).toBe(403);
    expect(mockCookieSet).not.toHaveBeenCalled();
  });

  it('refuses a cross-origin request', async () => {
    mockValidateOrigin.mockResolvedValue(false);

    const res = await POST(postRequest({ profileId: 'prof_1' }));

    expect(res.status).toBe(403);
    expect(mockRequireAdmin).not.toHaveBeenCalled();
    expect(mockCookieSet).not.toHaveBeenCalled();
  });

  it('returns 404 for an unknown affiliate', async () => {
    mockLoadViewAsTarget.mockResolvedValue(null);

    const res = await POST(postRequest({ profileId: 'prof_missing' }));

    expect(res.status).toBe(404);
    expect(mockCookieSet).not.toHaveBeenCalled();
  });

  it('returns 400 without a profileId', async () => {
    const res = await POST(postRequest({}));
    expect(res.status).toBe(400);
  });
});

describe('DELETE (stop viewing)', () => {
  it('expires the cookie with the same attributes it was set with', async () => {
    const res = await DELETE();

    expect(res.status).toBe(200);
    expect(mockCookieSet).toHaveBeenCalledWith(
      VIEW_AS_COOKIE_NAME,
      '',
      expect.objectContaining({ httpOnly: true, path: '/', maxAge: 0 })
    );
  });

  it('refuses a non-admin', async () => {
    mockRequireAdmin.mockRejectedValue(forbidden);
    const res = await DELETE();
    expect(res.status).toBe(403);
  });
});

describe('GET (search)', () => {
  it('matches name, owner email and promo code, and returns list rows', async () => {
    mockUserFindMany
      .mockResolvedValueOnce([{ id: 'user_aff' }]) // email search
      .mockResolvedValueOnce([{ id: 'user_aff', email: 'alice@example.com' }]); // owners
    mockCodeFindMany
      .mockResolvedValueOnce([{ affiliateProfileId: 'prof_1' }]) // code search
      .mockResolvedValueOnce([
        { affiliateProfileId: 'prof_1', code: 'ALICE10' },
      ]); // active codes
    mockProfileFindMany.mockResolvedValue([
      {
        id: 'prof_1',
        userId: 'user_aff',
        fullName: 'Alice Affiliate',
        country: 'TH',
        status: 'ACTIVE',
        createdAt: new Date('2026-01-01'),
        totalEarnings: '120.5',
        pendingCommissions: '20',
        totalCodesUsed: 3,
      },
    ]);
    mockProfileCount.mockResolvedValue(1);

    const res = await GET(getRequest('?search=alice'));
    const body = await res.json();

    const where = mockProfileFindMany.mock.calls[0][0].where;
    expect(where.OR).toEqual([
      { fullName: { contains: 'alice', mode: 'insensitive' } },
      { userId: { in: ['user_aff'] } },
      { id: { in: ['prof_1'] } },
    ]);
    expect(body.affiliates).toEqual([
      expect.objectContaining({
        profileId: 'prof_1',
        email: 'alice@example.com',
        activeCode: 'ALICE10',
        totalEarnings: 120.5,
      }),
    ]);
    expect(body.pagination).toMatchObject({ total: 1, totalPages: 1 });
  });

  it('refuses a non-admin', async () => {
    mockRequireAdmin.mockRejectedValue(forbidden);
    const res = await GET(getRequest());
    expect(res.status).toBe(403);
    expect(mockProfileFindMany).not.toHaveBeenCalled();
  });

  it('rejects an unknown status filter', async () => {
    const res = await GET(getRequest('?status=HACKED'));
    expect(res.status).toBe(400);
  });
});
