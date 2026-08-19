/**
 * lib/appearance/server-appearance.ts tests
 *
 * Verifies the SSR resolution hierarchy: authenticated DB record -> cookie
 * -> DEFAULT_APPEARANCE_SETTINGS, and that untrusted input (cookie/DB) is
 * always sanitized rather than trusted blindly.
 */
const mockCookieStore = {
  get: jest.fn(),
};

jest.mock('next/headers', () => ({
  __esModule: true,
  cookies: jest.fn(() => Promise.resolve(mockCookieStore)),
}));

const mockGetSession = jest.fn();
jest.mock('@/lib/auth/session', () => ({
  __esModule: true,
  getSession: () => mockGetSession(),
}));

const mockFindUnique = jest.fn();
jest.mock('@/lib/db/prisma', () => ({
  __esModule: true,
  prisma: {
    userAppearance: {
      findUnique: (...args: unknown[]) => mockFindUnique(...args),
    },
  },
}));

import { getServerAppearance } from '@/lib/appearance/server-appearance';
import { DEFAULT_APPEARANCE_SETTINGS } from '@/lib/appearance/types';

describe('getServerAppearance', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCookieStore.get.mockReturnValue(undefined);
    mockGetSession.mockResolvedValue(null);
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('returns DEFAULT_APPEARANCE_SETTINGS when unauthenticated and no cookie is present', async () => {
    const result = await getServerAppearance();
    expect(result).toEqual(DEFAULT_APPEARANCE_SETTINGS);
  });

  it('returns cookie-derived settings when unauthenticated with a cookie', async () => {
    mockCookieStore.get.mockReturnValue({
      value: encodeURIComponent(
        JSON.stringify({
          theme: 'light',
          accent: 'blue',
          chartUpColor: '#123456',
          chartDownColor: '#654321',
          gridOpacity: 40,
        })
      ),
    });

    const result = await getServerAppearance();
    expect(result).toEqual({
      theme: 'light',
      accent: 'blue',
      chartUpColor: '#123456',
      chartDownColor: '#654321',
      gridOpacity: 40,
    });
  });

  it("prefers the authenticated user's database record over the cookie", async () => {
    mockGetSession.mockResolvedValue({ user: { id: 'user-1' } });
    mockFindUnique.mockResolvedValue({
      theme: 'dark',
      accent: 'emerald',
      chartUpColor: '#00ff00',
      chartDownColor: '#ff0000',
      gridOpacity: 20,
    });
    mockCookieStore.get.mockReturnValue({
      value: encodeURIComponent(
        JSON.stringify({
          theme: 'light',
          accent: 'blue',
          chartUpColor: '#000000',
          chartDownColor: '#ffffff',
          gridOpacity: 90,
        })
      ),
    });

    const result = await getServerAppearance();

    expect(result).toEqual({
      theme: 'dark',
      accent: 'emerald',
      chartUpColor: '#00ff00',
      chartDownColor: '#ff0000',
      gridOpacity: 20,
    });
    expect(mockFindUnique).toHaveBeenCalledWith({
      where: { userId: 'user-1' },
    });
  });

  it('falls back to the cookie when authenticated but no DB record exists yet', async () => {
    mockGetSession.mockResolvedValue({ user: { id: 'user-2' } });
    mockFindUnique.mockResolvedValue(null);
    mockCookieStore.get.mockReturnValue({
      value: encodeURIComponent(
        JSON.stringify({
          theme: 'system',
          accent: 'purple',
          chartUpColor: '#111111',
          chartDownColor: '#222222',
          gridOpacity: 55,
        })
      ),
    });

    const result = await getServerAppearance();
    expect(result.theme).toBe('system');
    expect(result.accent).toBe('purple');
    expect(result.gridOpacity).toBe(55);
  });

  it('sanitizes an invalid/malformed DB record rather than trusting it blindly', async () => {
    mockGetSession.mockResolvedValue({ user: { id: 'user-3' } });
    mockFindUnique.mockResolvedValue({
      theme: 'not-a-theme',
      accent: 'not-an-accent',
      chartUpColor: 'not-a-hex-color',
      chartDownColor: '#zzzzzz',
      gridOpacity: 999,
    });

    const result = await getServerAppearance();
    // Invalid enum/color values fall back per-field to the default; an
    // out-of-range but numeric gridOpacity is clamped into [0, 100] rather
    // than replaced outright (see sanitizeAppearanceSettings).
    expect(result).toEqual({
      ...DEFAULT_APPEARANCE_SETTINGS,
      gridOpacity: 100,
    });
  });

  it('falls back to the cookie/defaults when the DB lookup throws', async () => {
    mockGetSession.mockResolvedValue({ user: { id: 'user-4' } });
    mockFindUnique.mockRejectedValue(new Error('connection refused'));

    const result = await getServerAppearance();
    expect(result).toEqual(DEFAULT_APPEARANCE_SETTINGS);
  });

  it('falls back to defaults when the cookie value is malformed JSON', async () => {
    mockCookieStore.get.mockReturnValue({ value: 'not-json' });
    const result = await getServerAppearance();
    expect(result).toEqual(DEFAULT_APPEARANCE_SETTINGS);
  });
});
