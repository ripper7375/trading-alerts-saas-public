/**
 * @jest-environment node
 *
 * Per-request de-duplication through React.cache() (Next.js remediation T2-a).
 *
 * Outside a Server Component render the real cache() is a pass-through, so a
 * plain unit test cannot see the de-duplication. Here `react`'s cache() is
 * replaced by a memoiser with the semantics that matter: one entry per
 * function and argument list, dropped when `newRender()` is called (React drops
 * it at the end of each server request). The assertions then count how often
 * the underlying reads run inside one "render":
 *
 *   - if a helper loses its cache() wrapper, its count goes from 1 to 2;
 *   - a second render must read again (no state leaks across requests).
 */
import { describe, it, expect, beforeEach } from '@jest/globals';

jest.mock('react', () => {
  let store = new Map<unknown, Map<string, unknown>>();
  const cache = (fn: (...args: never[]) => unknown) =>
    ((...args: unknown[]) => {
      let perFn = store.get(fn);
      if (!perFn) {
        perFn = new Map();
        store.set(fn, perFn);
      }
      const key = JSON.stringify(args);
      if (!perFn.has(key)) {
        perFn.set(key, (fn as (...a: unknown[]) => unknown)(...args));
      }
      return perFn.get(key);
    }) as unknown;
  return {
    ...jest.requireActual('react'),
    cache,
    __newRender: () => {
      store = new Map();
    },
  };
});

const mockGetServerSession = jest.fn();
jest.mock('next-auth', () => ({
  __esModule: true,
  getServerSession: (...args: unknown[]) => mockGetServerSession(...args),
}));
jest.mock('@/lib/auth/auth-options', () => ({
  __esModule: true,
  authOptions: {},
}));
jest.mock('next/navigation', () => ({
  __esModule: true,
  redirect: jest.fn(),
}));

const mockCookies = jest.fn();
const mockHeaders = jest.fn();
jest.mock('next/headers', () => ({
  __esModule: true,
  cookies: () => mockCookies(),
  headers: () => mockHeaders(),
}));

const mockUserFindUnique = jest.fn();
const mockAppearanceFindUnique = jest.fn();
const mockAffiliateFindUnique = jest.fn();
const mockTutorialFindUnique = jest.fn();
jest.mock('@/lib/db/prisma', () => ({
  __esModule: true,
  prisma: {
    user: { findUnique: (...a: unknown[]) => mockUserFindUnique(...a) },
    userAppearance: {
      findUnique: (...a: unknown[]) => mockAppearanceFindUnique(...a),
    },
    affiliateProfile: {
      findUnique: (...a: unknown[]) => mockAffiliateFindUnique(...a),
    },
    tutorialVideo: {
      findUnique: (...a: unknown[]) => mockTutorialFindUnique(...a),
    },
  },
}));

import {
  getSession,
  getAffiliateProfile,
  getUserTier,
  isAdmin,
  isAffiliate,
  requireAuth,
} from '@/lib/auth/session';
import { getServerAppearance } from '@/lib/appearance/server-appearance';
import {
  getServerLanguage,
  getServerLocalePreferences,
} from '@/lib/i18n/server-locale';
import { VIEW_AS_COOKIE_NAME, getAdminViewAs } from '@/lib/affiliate/view-as';
import {
  USER_VIEW_AS_COOKIE_NAME,
  getAdminUserViewAs,
  loadUserViewAsTarget,
} from '@/lib/admin/user-view-as';
import { getPublishedTutorialById } from '@/lib/tutorials/service';

const newRender = (jest.requireMock('react') as { __newRender: () => void })
  .__newRender;

const userSession = {
  user: {
    id: 'user-1',
    email: 'user@example.com',
    role: 'USER',
    tier: 'PRO',
    isAffiliate: true,
  },
  expires: '2099-01-01',
};
const adminSession = {
  user: { id: 'admin-1', email: 'admin@example.com', role: 'ADMIN' },
  expires: '2099-01-01',
};

function cookieStore(entries: Record<string, string> = {}) {
  return {
    get: (name: string) =>
      name in entries ? { value: entries[name] } : undefined,
  };
}

describe('React.cache() de-duplication inside one render', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetServerSession.mockReset();
    mockCookies.mockReset().mockResolvedValue(cookieStore());
    mockHeaders.mockReset().mockResolvedValue({ get: () => null });
    mockUserFindUnique.mockReset();
    mockAppearanceFindUnique.mockReset();
    mockAffiliateFindUnique.mockReset();
    mockTutorialFindUnique.mockReset();
    newRender();
  });

  describe('getSession() and the helpers built on it', () => {
    it('decrypts the session once however many callers ask', async () => {
      mockGetServerSession.mockResolvedValue(userSession);

      const [a, b, c] = await Promise.all([
        getSession(),
        getSession(),
        getSession(),
      ]);

      expect(mockGetServerSession).toHaveBeenCalledTimes(1);
      expect(a).toBe(userSession);
      expect(b).toBe(a);
      expect(c).toBe(a);
    });

    it('shares that one read with requireAuth, isAdmin, isAffiliate and getUserTier', async () => {
      mockGetServerSession.mockResolvedValue(userSession);

      await requireAuth();
      await isAdmin();
      await isAffiliate();
      await getUserTier();

      expect(mockGetServerSession).toHaveBeenCalledTimes(1);
    });

    it('reads again in the next render', async () => {
      mockGetServerSession.mockResolvedValue(userSession);
      await getSession();

      newRender();
      mockGetServerSession.mockResolvedValue(null);

      await expect(getSession()).resolves.toBeNull();
      expect(mockGetServerSession).toHaveBeenCalledTimes(2);
    });
  });

  describe('getAffiliateProfile()', () => {
    it('looks the profile up once per render', async () => {
      mockGetServerSession.mockResolvedValue(userSession);
      mockUserFindUnique.mockResolvedValue({
        id: 'user-1',
        isAffiliate: true,
        name: 'U',
        email: 'user@example.com',
      });
      mockAffiliateFindUnique.mockResolvedValue({
        id: 'aff-1',
        userId: 'user-1',
        totalEarnings: 1,
        pendingCommissions: 2,
        paidCommissions: 3,
      });

      const first = await getAffiliateProfile();
      const second = await getAffiliateProfile();

      expect(first).not.toBeNull();
      expect(second).toBe(first);
      expect(mockUserFindUnique).toHaveBeenCalledTimes(1);
      expect(mockAffiliateFindUnique).toHaveBeenCalledTimes(1);
    });
  });

  describe('getServerAppearance()', () => {
    it('reads the UserAppearance row once for the root layout and the segment layout', async () => {
      mockGetServerSession.mockResolvedValue(userSession);
      mockAppearanceFindUnique.mockResolvedValue({
        theme: 'dark',
        accent: 'gold',
        chartUpColor: '#00ff00',
        chartDownColor: '#ff0000',
        gridOpacity: 0.5,
      });

      const [rootLayout, segmentLayout] = await Promise.all([
        getServerAppearance(),
        getServerAppearance(),
      ]);

      expect(mockAppearanceFindUnique).toHaveBeenCalledTimes(1);
      expect(segmentLayout).toBe(rootLayout);
      expect(mockGetServerSession).toHaveBeenCalledTimes(1);
    });
  });

  describe('getServerLocalePreferences() and getServerLanguage()', () => {
    it('resolve the cookies and headers once between them', async () => {
      const prefs = await getServerLocalePreferences();
      const language = await getServerLanguage();
      const again = await getServerLocalePreferences();

      expect(language).toBe(prefs.language);
      expect(again).toBe(prefs);
      expect(mockCookies).toHaveBeenCalledTimes(1);
      expect(mockHeaders).toHaveBeenCalledTimes(1);
    });

    it('resolve again in the next render', async () => {
      await getServerLocalePreferences();
      newRender();
      await getServerLocalePreferences();

      expect(mockCookies).toHaveBeenCalledTimes(2);
    });
  });

  describe('getAdminViewAs()', () => {
    it('loads the viewed affiliate once per render', async () => {
      mockGetServerSession.mockResolvedValue(adminSession);
      mockCookies.mockResolvedValue(
        cookieStore({ [VIEW_AS_COOKIE_NAME]: 'admin-1:prof-1' })
      );
      mockAffiliateFindUnique.mockResolvedValue({
        id: 'prof-1',
        userId: 'user-9',
        fullName: 'Aff Target',
        status: 'ACTIVE',
        paymentDetails: { iban: 'x' },
        totalEarnings: 0,
        pendingCommissions: 0,
        paidCommissions: 0,
      });
      mockUserFindUnique.mockResolvedValue({ email: 'aff@example.com' });

      const layout = await getAdminViewAs();
      const page = await getAdminViewAs();

      expect(layout).not.toBeNull();
      expect(page).toBe(layout);
      expect(mockAffiliateFindUnique).toHaveBeenCalledTimes(1);
      expect(mockUserFindUnique).toHaveBeenCalledTimes(1);
    });
  });

  describe('loadUserViewAsTarget() and getAdminUserViewAs()', () => {
    const target = {
      id: 'user-9',
      name: 'Target',
      email: 't@example.com',
      tier: 'FREE',
      role: 'USER',
    };

    it('is keyed by the user id string, not by an object reference', async () => {
      mockUserFindUnique.mockResolvedValue(target);

      await loadUserViewAsTarget('user-9');
      await loadUserViewAsTarget('user-9');
      expect(mockUserFindUnique).toHaveBeenCalledTimes(1);

      await loadUserViewAsTarget('user-8');
      expect(mockUserFindUnique).toHaveBeenCalledTimes(2);
    });

    it('getAdminUserViewAs() reaches it with two different session-user objects and the lookup still runs once', async () => {
      mockCookies.mockResolvedValue(
        cookieStore({ [USER_VIEW_AS_COOKIE_NAME]: 'admin-1:user-9' })
      );
      mockUserFindUnique.mockResolvedValue(target);

      const fromLayout = await getAdminUserViewAs({
        id: 'admin-1',
        role: 'ADMIN',
      });
      const fromPage = await getAdminUserViewAs({
        id: 'admin-1',
        role: 'ADMIN',
      });

      expect(fromLayout).toEqual(target);
      expect(fromPage).toBe(fromLayout);
      expect(mockUserFindUnique).toHaveBeenCalledTimes(1);
    });

    it('still checks the role and the cookie on every call, before the cached lookup', async () => {
      mockCookies.mockResolvedValue(
        cookieStore({ [USER_VIEW_AS_COOKIE_NAME]: 'admin-1:user-9' })
      );
      mockUserFindUnique.mockResolvedValue(target);

      // a non-admin and an admin for a different id never reach the lookup,
      // whatever an earlier caller in the render loaded
      await getAdminUserViewAs({ id: 'admin-1', role: 'ADMIN' });
      await expect(
        getAdminUserViewAs({ id: 'user-2', role: 'USER' })
      ).resolves.toBeNull();
      await expect(
        getAdminUserViewAs({ id: 'admin-2', role: 'ADMIN' })
      ).resolves.toBeNull();
      expect(mockUserFindUnique).toHaveBeenCalledTimes(1);
    });
  });

  describe('getPublishedTutorialById()', () => {
    it('runs one query for generateMetadata and the page body', async () => {
      mockTutorialFindUnique.mockResolvedValue({ id: 't-1', status: 'ACTIVE' });

      const forMetadata = await getPublishedTutorialById('t-1');
      const forPage = await getPublishedTutorialById('t-1');

      expect(forPage).toBe(forMetadata);
      expect(mockTutorialFindUnique).toHaveBeenCalledTimes(1);
    });

    it('queries once per id', async () => {
      mockTutorialFindUnique.mockResolvedValue({ id: 'x', status: 'ACTIVE' });

      await getPublishedTutorialById('t-1');
      await getPublishedTutorialById('t-2');

      expect(mockTutorialFindUnique).toHaveBeenCalledTimes(2);
    });

    it('still returns null for a draft, from the cached read', async () => {
      mockTutorialFindUnique.mockResolvedValue({ id: 't-3', status: 'DRAFT' });

      await expect(getPublishedTutorialById('t-3')).resolves.toBeNull();
      await expect(getPublishedTutorialById('t-3')).resolves.toBeNull();
      expect(mockTutorialFindUnique).toHaveBeenCalledTimes(1);
    });
  });
});
