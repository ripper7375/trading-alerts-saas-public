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
  decodeViewAsCookie,
  encodeViewAsCookie,
  getAdminViewAs,
  loadViewAsTarget,
} from '@/lib/affiliate/view-as';

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

beforeEach(() => {
  jest.resetAllMocks();
  mockProfileFindUnique.mockResolvedValue(PROFILE_ROW);
  mockUserFindUnique.mockResolvedValue({ email: 'alice@example.com' });
});

describe('view-as cookie encoding', () => {
  it('round-trips admin id and profile id', () => {
    expect(decodeViewAsCookie(encodeViewAsCookie('admin_1', 'prof_1'))).toEqual(
      { adminUserId: 'admin_1', profileId: 'prof_1' }
    );
  });

  it.each([
    ['empty', ''],
    ['no separator', 'admin_1prof_1'],
    ['extra part', 'a:b:c'],
    ['unsafe characters', 'admin_1:prof 1;drop'],
    ['over-long id', `admin_1:${'x'.repeat(65)}`],
  ])('rejects a %s value', (_label, value) => {
    expect(decodeViewAsCookie(value)).toBeNull();
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

  it('returns null for an unknown profile and never creates one', async () => {
    mockProfileFindUnique.mockResolvedValue(null);
    await expect(loadViewAsTarget('prof_missing')).resolves.toBeNull();
  });
});

describe('getAdminViewAs', () => {
  it('returns the target for an admin with a cookie written for them', async () => {
    mockGetSession.mockResolvedValue(adminSession());
    mockCookieGet.mockReturnValue({ value: 'admin_1:prof_1' });

    const viewAs = await getAdminViewAs();

    expect(mockCookieGet).toHaveBeenCalledWith(VIEW_AS_COOKIE_NAME);
    expect(viewAs?.adminUserId).toBe('admin_1');
    expect(viewAs?.target.profileId).toBe('prof_1');
    expect(viewAs?.profile.paymentDetails).toEqual({});
  });

  it('ignores the cookie for a non-admin', async () => {
    mockGetSession.mockResolvedValue({ user: { id: 'admin_1', role: 'USER' } });
    mockCookieGet.mockReturnValue({ value: 'admin_1:prof_1' });

    await expect(getAdminViewAs()).resolves.toBeNull();
    expect(mockProfileFindUnique).not.toHaveBeenCalled();
  });

  it('ignores a cookie written for a different admin', async () => {
    mockGetSession.mockResolvedValue(adminSession('admin_2'));
    mockCookieGet.mockReturnValue({ value: 'admin_1:prof_1' });

    await expect(getAdminViewAs()).resolves.toBeNull();
  });

  it('returns null for an admin with no cookie', async () => {
    mockGetSession.mockResolvedValue(adminSession());
    mockCookieGet.mockReturnValue(undefined);

    await expect(getAdminViewAs()).resolves.toBeNull();
  });

  it('returns null when the viewed profile no longer exists', async () => {
    mockGetSession.mockResolvedValue(adminSession());
    mockCookieGet.mockReturnValue({ value: 'admin_1:prof_gone' });
    mockProfileFindUnique.mockResolvedValue(null);

    await expect(getAdminViewAs()).resolves.toBeNull();
  });

  it('fails closed on any error', async () => {
    mockGetSession.mockRejectedValue(new Error('session store down'));

    await expect(getAdminViewAs()).resolves.toBeNull();
  });
});
