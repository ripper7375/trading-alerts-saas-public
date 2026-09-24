/**
 * Server-side locale resolution (`resolvePreferences`).
 *
 * The language comes from the URL prefix or cookie and brings its country's
 * formats and currency; the currency cookie refines it (Thai with GBP); the
 * timezone is the user's own pick, else the IP-detected zone, never the
 * country's.
 *
 * @module __tests__/lib/i18n/locale-resolver.test
 */

import {
  preferenceCookieStrings,
  resolvePreferences,
} from '@/lib/i18n/locale-resolver';

describe('resolvePreferences', () => {
  it('defaults to the UK when nothing is known', () => {
    expect(resolvePreferences({})).toMatchObject({
      countryCode: 'GB',
      language: 'en-GB',
      currency: 'GBP',
      timezone: 'Europe/London',
      timezoneSetByUser: false,
    });
  });

  it('uses the IP-detected timezone instead of the country default', () => {
    const prefs = resolvePreferences({
      cookieLanguage: 'th',
      detectedTimezone: 'Europe/London',
    });
    expect(prefs).toMatchObject({
      language: 'th',
      currency: 'THB',
      timezone: 'Europe/London',
      timezoneSetByUser: false,
    });
  });

  it("prefers the user's own timezone over the detected one", () => {
    expect(
      resolvePreferences({
        cookieLanguage: 'en-GB',
        cookieTimezone: 'Asia/Tokyo',
        detectedTimezone: 'Europe/London',
      })
    ).toMatchObject({ timezone: 'Asia/Tokyo', timezoneSetByUser: true });
  });

  it('ignores a timezone that is not a real IANA zone', () => {
    expect(
      resolvePreferences({
        cookieLanguage: 'en-GB',
        cookieTimezone: 'Mars/Olympus',
        detectedTimezone: 'Not/AZone',
      })
    ).toMatchObject({ timezone: 'Europe/London', timezoneSetByUser: false });
  });

  it('honours the currency cookie (Thai with GBP)', () => {
    expect(
      resolvePreferences({ cookieLanguage: 'th', cookieCurrency: 'GBP' })
    ).toMatchObject({ language: 'th', currency: 'GBP' });
  });

  it('drops a currency cookie without a rate (withdrawn CNY)', () => {
    expect(
      resolvePreferences({ cookieLanguage: 'th', cookieCurrency: 'CNY' })
    ).toMatchObject({ currency: 'THB' });
  });

  it('lets a URL country prefix bring its own currency', () => {
    expect(
      resolvePreferences({ countryPrefix: 'th', cookieCurrency: 'GBP' })
    ).toMatchObject({ language: 'th', currency: 'THB' });
  });
});

describe('preferenceCookieStrings', () => {
  const base = {
    countryCode: 'TH',
    language: 'th',
    timezone: 'Europe/London',
    dateFormat: 'DMY' as const,
    timeFormat: '24h' as const,
    currency: 'GBP',
  };

  it('writes the currency and a user-picked timezone', () => {
    const [currency, timezone] = preferenceCookieStrings({
      ...base,
      timezoneSetByUser: true,
    });
    expect(currency).toMatch(/^davintrade-currency=GBP;/);
    expect(timezone).toMatch(/^davintrade-timezone=Europe%2FLondon;/);
  });

  it('clears the timezone cookie while the timezone is IP-detected', () => {
    const [, timezone] = preferenceCookieStrings({
      ...base,
      timezoneSetByUser: false,
    });
    expect(timezone).toMatch(/^davintrade-timezone=;.*max-age=0/);
  });
});
