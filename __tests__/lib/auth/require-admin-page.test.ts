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

describe('requireAdminPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetServerSession.mockReset();
    mockFindUnique.mockReset();
  });

  it('is the function that React.cache() returned at module load', () => {
    expect(cacheResultsAtImport).toContain(requireAdminPage);
  });

  it('returns the session of an admin without a database lookup', async () => {
    mockGetServerSession.mockResolvedValue(adminSession);

    await expect(requireAdminPage()).resolves.toBe(adminSession);

    expect(mockFindUnique).not.toHaveBeenCalled();
    expect(mockRedirect).not.toHaveBeenCalled();
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
    mockFindUnique.mockResolvedValue({ role: 'ADMIN' });

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
