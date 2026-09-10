/**
 * requireChartDownload tests.
 *
 * The interesting case is the stale JWT: `checkFeatureAccess` reads the token
 * only, so a user who has just upgraded to PRO still carries `tier: 'FREE'` and
 * would be refused a feature they have paid for. This gate re-queries the
 * database before refusing, mirroring `requireAffiliate`.
 */

const mockGetSession = jest.fn();
jest.mock('@/lib/auth/session', () => ({
  __esModule: true,
  getSession: () => mockGetSession(),
}));

const mockFindUnique = jest.fn();
jest.mock('@/lib/db/prisma', () => ({
  __esModule: true,
  prisma: {
    user: {
      findUnique: (...args: unknown[]) => mockFindUnique(...args),
    },
  },
}));

import { requireChartDownload } from '@/lib/auth/permissions';

function session(tier: 'FREE' | 'PRO') {
  return { user: { id: 'user-1', tier, role: 'USER', isAffiliate: false } };
}

describe('requireChartDownload', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('rejects an unauthenticated caller with 401', async () => {
    mockGetSession.mockResolvedValue(null);

    await expect(requireChartDownload()).rejects.toMatchObject({
      statusCode: 401,
    });
    expect(mockFindUnique).not.toHaveBeenCalled();
  });

  it('allows a PRO caller without touching the database', async () => {
    mockGetSession.mockResolvedValue(session('PRO'));

    await expect(requireChartDownload()).resolves.toBeUndefined();
    // The common path must stay free of an extra query.
    expect(mockFindUnique).not.toHaveBeenCalled();
  });

  it('allows a just-upgraded user whose token still says FREE', async () => {
    mockGetSession.mockResolvedValue(session('FREE'));
    mockFindUnique.mockResolvedValue({ tier: 'PRO' });

    await expect(requireChartDownload()).resolves.toBeUndefined();
    expect(mockFindUnique).toHaveBeenCalledTimes(1);
  });

  it('rejects a genuine FREE user with 403 after one lookup', async () => {
    mockGetSession.mockResolvedValue(session('FREE'));
    mockFindUnique.mockResolvedValue({ tier: 'FREE' });

    await expect(requireChartDownload()).rejects.toMatchObject({
      statusCode: 403,
      code: 'PRO_REQUIRED',
    });
    // The fallback must not become an always-query or a retry loop.
    expect(mockFindUnique).toHaveBeenCalledTimes(1);
  });

  it('rejects with 403 when the user row has vanished', async () => {
    mockGetSession.mockResolvedValue(session('FREE'));
    mockFindUnique.mockResolvedValue(null);

    await expect(requireChartDownload()).rejects.toMatchObject({
      statusCode: 403,
    });
  });

  it('surfaces a database failure as 500, not as a silent allow', async () => {
    mockGetSession.mockResolvedValue(session('FREE'));
    mockFindUnique.mockRejectedValue(new Error('connection refused'));

    await expect(requireChartDownload()).rejects.toMatchObject({
      statusCode: 500,
    });
  });
});
