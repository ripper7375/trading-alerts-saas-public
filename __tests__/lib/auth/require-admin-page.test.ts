/**
 * requireAdminPage() — the page-level admin guard (Next.js remediation T1-e).
 *
 * redirect() is mocked to throw the way the real one does, so a test can tell
 * "the guard redirected" from "the guard returned". React.cache() is mocked to
 * a spy: outside a Server Component render it is a pass-through, so the tests
 * cannot see the de-duplication itself, only that the export is wrapped.
 */
import { describe, it, expect, beforeEach } from '@jest/globals';

// The spy lives inside the factory: cache() runs while session.ts is being
// imported, before any `const mock…` of this file would be initialised.
jest.mock('react', () => {
  const cacheSpy = jest.fn((fn: (...args: never[]) => unknown) => fn);
  return {
    ...jest.requireActual('react'),
    cache: cacheSpy,
    __cacheSpy: cacheSpy,
  };
});

const mockRedirect = jest.fn((url: string) => {
  throw new Error(`NEXT_REDIRECT:${url}`);
});
jest.mock('next/navigation', () => ({
  __esModule: true,
  redirect: (url: string) => mockRedirect(url),
}));

const mockFindUnique = jest.fn();
jest.mock('@/lib/db/prisma', () => ({
  __esModule: true,
  prisma: {
    user: { findUnique: (...args: unknown[]) => mockFindUnique(...args) },
  },
}));

const mockGetServerSession = jest.fn();
jest.mock('next-auth', () => ({
  __esModule: true,
  getServerSession: (...args: unknown[]) => mockGetServerSession(...args),
}));

jest.mock('@/lib/auth/auth-options', () => ({
  __esModule: true,
  authOptions: {},
}));

import { requireAdminPage } from '@/lib/auth/session';
import { clearUserActiveCache } from '@/lib/auth/user-active';

// Read before any test runs: clearAllMocks would erase the calls
const cacheSpy = (jest.requireMock('react') as { __cacheSpy: jest.Mock })
  .__cacheSpy;
const cacheResultsAtImport = cacheSpy.mock.results.map((r) => r.value);

const adminSession = {
  user: { id: 'admin-1', email: 'admin@example.com', role: 'ADMIN' },
  expires: '2099-01-01',
};
const userSession = {
  user: { id: 'user-1', email: 'user@example.com', role: 'USER' },
  expires: '2099-01-01',
};

/** What the database holds for one account; only the selected columns come back, like the client. */
function accountRow(
  overrides: Record<string, unknown> = {}
): Record<string, unknown> {
  return {
    isActive: true,
    deletedAt: null,
    sessionVersion: 0,
    role: 'ADMIN',
    tier: 'PRO',
    twoFactorEnabled: true,
    ...overrides,
  };
}

function serveAccount(row: Record<string, unknown> | null): void {
  mockFindUnique.mockImplementation(
    async (args: { select: Record<string, boolean> }) => {
      if (!row) return null;
      return Object.fromEntries(
        Object.entries(args.select)
          .filter(([, wanted]) => wanted)
          .map(([column]) => [column, row[column]])
      );
    }
  );
}

describe('requireAdminPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetServerSession.mockReset();
    mockFindUnique.mockReset();
    clearUserActiveCache();
  });

  it('is the function that React.cache() returned at module load', () => {
    expect(cacheResultsAtImport).toContain(requireAdminPage);
  });

  it('returns the session of an admin who has two-factor authentication, after one read of the account state', async () => {
    mockGetServerSession.mockResolvedValue(adminSession);
    serveAccount(accountRow());

    await expect(requireAdminPage()).resolves.toBe(adminSession);

    expect(mockFindUnique).toHaveBeenCalledTimes(1);
    expect(mockFindUnique).toHaveBeenCalledWith({
      where: { id: 'admin-1' },
      select: {
        isActive: true,
        deletedAt: true,
        sessionVersion: true,
        role: true,
        tier: true,
        twoFactorEnabled: true,
      },
    });
    expect(mockRedirect).not.toHaveBeenCalled();
  });

  // CODE-09 (WS-8): an ADMIN without two-factor authentication is sent to the page where they
  // switch it on, never shown admin content. /settings/security is not under app/admin.
  describe('an admin without two-factor authentication (CODE-09)', () => {
    it('is redirected to /settings/security', async () => {
      mockGetServerSession.mockResolvedValue(adminSession);
      serveAccount(accountRow({ twoFactorEnabled: false }));

      await expect(requireAdminPage()).rejects.toThrow(
        'NEXT_REDIRECT:/settings/security'
      );

      expect(mockRedirect).toHaveBeenCalledTimes(1);
      expect(mockRedirect).toHaveBeenCalledWith('/settings/security');
    });

    it('is redirected too when the JWT role claim is stale and the database says ADMIN', async () => {
      const stale = {
        user: { id: 'user-2', email: 'new-admin@example.com', role: 'USER' },
        expires: '2099-01-01',
      };
      mockGetServerSession.mockResolvedValue(stale);
      serveAccount(accountRow({ twoFactorEnabled: false }));

      await expect(requireAdminPage()).rejects.toThrow(
        'NEXT_REDIRECT:/settings/security'
      );
    });

    it('does not promote the shared session to ADMIN in memory when it redirects', async () => {
      const stale = {
        user: { id: 'user-2', email: 'new-admin@example.com', role: 'USER' },
        expires: '2099-01-01',
      };
      mockGetServerSession.mockResolvedValue(stale);
      serveAccount(accountRow({ twoFactorEnabled: false }));

      await expect(requireAdminPage()).rejects.toThrow('NEXT_REDIRECT');

      expect(stale.user.role).toBe('USER');
    });

    it('is never returned the session: the only outcomes are a redirect or an error', async () => {
      mockGetServerSession.mockResolvedValue(adminSession);
      for (const flag of [false, undefined, null]) {
        clearUserActiveCache();
        serveAccount(accountRow({ twoFactorEnabled: flag }));

        await expect(requireAdminPage()).rejects.toThrow(
          'NEXT_REDIRECT:/settings/security'
        );
      }
    });

    it('does not turn a USER into a security-settings redirect: the role check still comes first', async () => {
      mockGetServerSession.mockResolvedValue(userSession);
      serveAccount(accountRow({ role: 'USER', twoFactorEnabled: false }));

      await expect(requireAdminPage()).rejects.toThrow(
        'NEXT_REDIRECT:/dashboard?error=forbidden'
      );
    });

    it('treats a token that claims ADMIN for an account that no longer exists as not an admin', async () => {
      mockGetServerSession.mockResolvedValue(adminSession);
      serveAccount(null);

      await expect(requireAdminPage()).rejects.toThrow(
        'NEXT_REDIRECT:/dashboard?error=forbidden'
      );
    });

    it('fails the page when the account state cannot be read: an error, never admin content', async () => {
      const consoleError = jest
        .spyOn(console, 'error')
        .mockImplementation(() => undefined);
      mockGetServerSession.mockResolvedValue(adminSession);
      mockFindUnique.mockRejectedValue(new Error('connection refused'));

      await expect(requireAdminPage()).rejects.toThrow();

      expect(mockRedirect).not.toHaveBeenCalled();
      consoleError.mockRestore();
    });
  });

  it('redirects a signed-out visitor to /login and reads nothing from the database', async () => {
    mockGetServerSession.mockResolvedValue(null);

    await expect(requireAdminPage()).rejects.toThrow('NEXT_REDIRECT:/login');

    expect(mockRedirect).toHaveBeenCalledWith('/login');
    expect(mockFindUnique).not.toHaveBeenCalled();
  });

  it('redirects a session without a user id to /login', async () => {
    mockGetServerSession.mockResolvedValue({
      user: { email: 'x@example.com', role: 'ADMIN' },
      expires: '2099-01-01',
    });

    await expect(requireAdminPage()).rejects.toThrow('NEXT_REDIRECT:/login');

    expect(mockFindUnique).not.toHaveBeenCalled();
  });

  it('redirects to /login when the session cannot be read (getSession returns null)', async () => {
    const consoleError = jest
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    mockGetServerSession.mockRejectedValue(new Error('cookie decode failed'));

    await expect(requireAdminPage()).rejects.toThrow('NEXT_REDIRECT:/login');

    consoleError.mockRestore();
  });

  it('redirects a signed-in non-admin to /dashboard after checking the database', async () => {
    mockGetServerSession.mockResolvedValue(userSession);
    mockFindUnique.mockResolvedValue({ role: 'USER' });
    // (The role lookup answers { role }; the account state is read only for an admin.)

    await expect(requireAdminPage()).rejects.toThrow(
      'NEXT_REDIRECT:/dashboard?error=forbidden'
    );

    expect(mockFindUnique).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      select: { role: true },
    });
  });

  it('redirects when the database has no such user', async () => {
    mockGetServerSession.mockResolvedValue(userSession);
    mockFindUnique.mockResolvedValue(null);

    await expect(requireAdminPage()).rejects.toThrow(
      'NEXT_REDIRECT:/dashboard?error=forbidden'
    );
  });

  it('lets a freshly promoted admin through when the JWT role claim is stale (same fallback as the layout)', async () => {
    const stale = {
      user: { id: 'user-2', email: 'new-admin@example.com', role: 'USER' },
      expires: '2099-01-01',
    };
    mockGetServerSession.mockResolvedValue(stale);
    serveAccount(accountRow({ role: 'ADMIN', twoFactorEnabled: true }));

    const session = await requireAdminPage();

    expect(session.user.role).toBe('ADMIN');
    expect(mockRedirect).not.toHaveBeenCalled();
  });

  it('does not swallow a database error: the page fails, it never shows admin content', async () => {
    mockGetServerSession.mockResolvedValue(userSession);
    mockFindUnique.mockRejectedValue(new Error('connection refused'));

    await expect(requireAdminPage()).rejects.toThrow('connection refused');

    expect(mockRedirect).not.toHaveBeenCalled();
  });
});
