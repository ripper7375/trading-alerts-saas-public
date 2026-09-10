/**
 * getM5OnM15Preference tests.
 *
 * This is what the download route reads to decide which rendered variant a
 * caller gets, so the failure modes matter more than the happy path: an
 * unreadable preference must degrade to "no overlay", never take the download
 * down with it.
 */

const mockFindUnique = jest.fn();
jest.mock('@/lib/db/prisma', () => ({
  __esModule: true,
  prisma: {
    userPreferences: {
      findUnique: (...args: unknown[]) => mockFindUnique(...args),
    },
  },
}));

import { getM5OnM15Preference } from '@/lib/preferences/server-preferences';

describe('getM5OnM15Preference', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns the stored value when set', async () => {
    mockFindUnique.mockResolvedValue({ preferences: { m5OnM15: true } });
    await expect(getM5OnM15Preference('user-1')).resolves.toBe(true);
  });

  it('returns false when explicitly stored as false', async () => {
    mockFindUnique.mockResolvedValue({ preferences: { m5OnM15: false } });
    await expect(getM5OnM15Preference('user-1')).resolves.toBe(false);
  });

  it('defaults to false for a user who has never toggled it', async () => {
    mockFindUnique.mockResolvedValue({ preferences: { theme: 'dark' } });
    await expect(getM5OnM15Preference('user-1')).resolves.toBe(false);
  });

  it('defaults to false when the user has no preferences row', async () => {
    mockFindUnique.mockResolvedValue(null);
    await expect(getM5OnM15Preference('user-1')).resolves.toBe(false);
  });

  it('ignores a non-boolean stored value rather than coercing it', async () => {
    mockFindUnique.mockResolvedValue({ preferences: { m5OnM15: 'yes' } });
    await expect(getM5OnM15Preference('user-1')).resolves.toBe(false);
  });

  it('degrades to false if the database read throws', async () => {
    mockFindUnique.mockRejectedValue(new Error('connection refused'));
    // A download must not fail because a preferences lookup did.
    await expect(getM5OnM15Preference('user-1')).resolves.toBe(false);
  });

  it('queries by the user id it was given', async () => {
    mockFindUnique.mockResolvedValue(null);
    await getM5OnM15Preference('user-42');

    expect(mockFindUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: 'user-42' } })
    );
  });
});
