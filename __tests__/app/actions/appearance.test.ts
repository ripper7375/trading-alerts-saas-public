/**
 * app/actions/appearance.ts — saveAppearanceAction tests
 *
 * Verifies: cookie is always written (guest support), the DB row is only
 * upserted when authenticated, untrusted input is sanitized before it is
 * ever persisted, and failures are swallowed into { success: false } rather
 * than thrown across the Server Action boundary.
 */
const mockCookieStore = {
  set: jest.fn(),
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

const mockUpsert = jest.fn();
jest.mock('@/lib/db/prisma', () => ({
  __esModule: true,
  prisma: {
    userAppearance: {
      upsert: (...args: unknown[]) => mockUpsert(...args),
    },
  },
}));

import { saveAppearanceAction } from '@/app/actions/appearance';
import {
  APPEARANCE_COOKIE_NAME,
  DEFAULT_APPEARANCE_SETTINGS,
} from '@/lib/appearance/types';

describe('saveAppearanceAction', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetSession.mockResolvedValue(null);
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('always sets the cookie, even when unauthenticated', async () => {
    const result = await saveAppearanceAction(DEFAULT_APPEARANCE_SETTINGS);

    expect(result).toEqual({ success: true });
    expect(mockCookieStore.set).toHaveBeenCalledWith(
      APPEARANCE_COOKIE_NAME,
      JSON.stringify(DEFAULT_APPEARANCE_SETTINGS),
      expect.objectContaining({
        path: '/',
        sameSite: 'lax',
        httpOnly: false,
      })
    );
    expect(mockUpsert).not.toHaveBeenCalled();
  });

  it('upserts the UserAppearance DB row when a session is present', async () => {
    mockGetSession.mockResolvedValue({ user: { id: 'user-1' } });
    const settings = {
      theme: 'light' as const,
      accent: 'blue' as const,
      chartUpColor: '#111111',
      chartDownColor: '#222222',
      gridOpacity: 25,
    };

    const result = await saveAppearanceAction(settings);

    expect(result).toEqual({ success: true });
    expect(mockUpsert).toHaveBeenCalledWith({
      where: { userId: 'user-1' },
      update: settings,
      create: { userId: 'user-1', ...settings },
    });
  });

  it('sanitizes invalid input before it is ever persisted', async () => {
    mockGetSession.mockResolvedValue({ user: { id: 'user-2' } });
    const malformed = {
      theme: 'nonsense',
      accent: 'nonsense',
      chartUpColor: 'red',
      chartDownColor: 'blue',
      gridOpacity: 500,
    } as unknown as Parameters<typeof saveAppearanceAction>[0];

    await saveAppearanceAction(malformed);

    // Invalid enum/color values fall back per-field to the default; an
    // out-of-range but numeric gridOpacity is clamped into [0, 100] rather
    // than replaced outright (see sanitizeAppearanceSettings).
    const sanitized = { ...DEFAULT_APPEARANCE_SETTINGS, gridOpacity: 100 };
    expect(mockUpsert).toHaveBeenCalledWith({
      where: { userId: 'user-2' },
      update: sanitized,
      create: { userId: 'user-2', ...sanitized },
    });
  });

  it('returns { success: false } if persistence throws, instead of throwing', async () => {
    mockGetSession.mockResolvedValue({ user: { id: 'user-3' } });
    mockUpsert.mockRejectedValue(new Error('db down'));

    const result = await saveAppearanceAction(DEFAULT_APPEARANCE_SETTINGS);
    expect(result).toEqual({ success: false });
  });
});
