/**
 * syncLocaleCookiesAction: writes the locale cookies from the server so
 * Server Components re-render after a language or format change. Every
 * value is re-validated, since a Server Action accepts any input.
 *
 * @module __tests__/app/actions/locale.test
 */

const mockSet = jest.fn();
jest.mock('next/headers', () => ({
  cookies: () => Promise.resolve({ set: mockSet }),
}));

// Only reached when a change is to be remembered on the account.
const mockGetServerSession = jest.fn();
jest.mock('next-auth', () => ({
  getServerSession: (...args: unknown[]) => mockGetServerSession(...args),
}));
jest.mock('@/lib/auth/auth-options', () => ({ authOptions: {} }));
const mockFindUnique = jest.fn();
const mockUpsert = jest.fn();
jest.mock('@/lib/db/prisma', () => ({
  prisma: {
    userPreferences: {
      findUnique: (...args: unknown[]) => mockFindUnique(...args),
      upsert: (...args: unknown[]) => mockUpsert(...args),
    },
  },
}));

import { syncLocaleCookiesAction } from '@/app/actions/locale';

const valid = {
  language: 'th',
  currency: 'GBP',
  dateFormat: 'MDY' as const,
  timeFormat: '12h' as const,
  timezone: 'Asia/Tokyo',
  timezoneSetByUser: true,
};

const written = (): Record<string, { value: string; maxAge: number }> =>
  Object.fromEntries(
    mockSet.mock.calls.map(([name, value, opts]) => [
      name,
      { value, maxAge: (opts as { maxAge: number }).maxAge },
    ])
  );

describe('syncLocaleCookiesAction', () => {
  beforeEach(() => mockSet.mockClear());

  it('writes the language, currency, formats and a user-picked timezone', async () => {
    await expect(syncLocaleCookiesAction(valid)).resolves.toEqual({
      success: true,
    });
    expect(written()).toEqual({
      'davintrade-locale': { value: 'th', maxAge: 31536000 },
      'davintrade-currency': { value: 'GBP', maxAge: 31536000 },
      'davintrade-formats': { value: 'MDY.12h', maxAge: 31536000 },
      // Raw: cookies().set() encodes the value itself.
      'davintrade-timezone': { value: 'Asia/Tokyo', maxAge: 31536000 },
    });
    for (const [, , opts] of mockSet.mock.calls) {
      expect(opts).toMatchObject({
        path: '/',
        sameSite: 'lax',
        httpOnly: false,
      });
    }
  });

  it('clears the timezone cookie while the timezone is IP-detected', async () => {
    await syncLocaleCookiesAction({ ...valid, timezoneSetByUser: false });
    expect(written()['davintrade-timezone']).toEqual({ value: '', maxAge: 0 });
  });

  it.each([
    ['an unknown language', { language: "x'+alert(1)+'" }],
    ['a currency without a rate', { currency: 'CNY' }],
    ['a bad date format', { dateFormat: 'XYZ' }],
    ['a bad time format', { timeFormat: '13h' }],
    ['an invalid user timezone', { timezone: 'Mars/Olympus' }],
  ])('writes nothing for %s', async (_label, bad) => {
    await expect(
      syncLocaleCookiesAction({ ...valid, ...(bad as object) } as typeof valid)
    ).resolves.toEqual({ success: false });
    expect(mockSet).not.toHaveBeenCalled();
  });
});

describe('syncLocaleCookiesAction: remembering the choice on the account', () => {
  beforeEach(() => {
    mockSet.mockClear();
    mockGetServerSession.mockReset();
    mockFindUnique.mockReset();
    mockUpsert.mockReset();
    mockFindUnique.mockResolvedValue(null);
    mockUpsert.mockResolvedValue({});
  });

  it('touches no account when the change was only detected', async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: 'u1' } });
    await expect(syncLocaleCookiesAction(valid)).resolves.toEqual({
      success: true,
    });
    await syncLocaleCookiesAction({ ...valid, saveToAccount: false });
    expect(mockGetServerSession).not.toHaveBeenCalled();
    expect(mockUpsert).not.toHaveBeenCalled();
  });

  it('saves the language, formats, currency and a pinned timezone for a signed-in user', async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: 'u1' } });
    mockFindUnique.mockResolvedValue({ preferences: { theme: 'dark' } });

    await expect(
      syncLocaleCookiesAction({
        ...valid,
        currency: 'gbp',
        saveToAccount: true,
      })
    ).resolves.toEqual({ success: true });

    const preferences = {
      theme: 'dark',
      language: 'th',
      currency: 'GBP',
      dateFormat: 'MDY',
      timeFormat: '12h',
      timezone: 'Asia/Tokyo',
    };
    expect(mockUpsert).toHaveBeenCalledWith({
      where: { userId: 'u1' },
      create: { userId: 'u1', preferences },
      update: { preferences },
    });
  });

  it('does not save an IP-detected timezone as if the user had chosen it', async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: 'u1' } });
    mockFindUnique.mockResolvedValue({
      preferences: { timezone: 'Europe/Rome' },
    });

    await syncLocaleCookiesAction({
      ...valid,
      timezoneSetByUser: false,
      saveToAccount: true,
    });

    expect(mockUpsert.mock.calls[0]?.[0].update.preferences.timezone).toBe(
      'Europe/Rome'
    );
  });

  it('saves nothing for a visitor who is not signed in', async () => {
    mockGetServerSession.mockResolvedValue(null);
    await expect(
      syncLocaleCookiesAction({ ...valid, saveToAccount: true })
    ).resolves.toEqual({ success: true });
    expect(mockUpsert).not.toHaveBeenCalled();
  });

  it('still writes the cookies when the account cannot be saved', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    mockGetServerSession.mockResolvedValue({ user: { id: 'u1' } });
    mockUpsert.mockRejectedValue(new Error('db down'));

    await expect(
      syncLocaleCookiesAction({ ...valid, saveToAccount: true })
    ).resolves.toEqual({ success: true });
    expect(mockSet).toHaveBeenCalled();
  });

  it('saves nothing when the values do not validate', async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: 'u1' } });
    await syncLocaleCookiesAction({
      ...valid,
      language: 'klingon',
      saveToAccount: true,
    });
    expect(mockUpsert).not.toHaveBeenCalled();
  });
});
