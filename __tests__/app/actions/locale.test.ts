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
