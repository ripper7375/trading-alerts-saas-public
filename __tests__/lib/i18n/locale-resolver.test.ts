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

  it("honours the user's date and time format (Thai with MM/DD, 12-hour)", () => {
    expect(
      resolvePreferences({ cookieLanguage: 'th', cookieFormats: 'MDY.12h' })
    ).toMatchObject({ language: 'th', dateFormat: 'MDY', timeFormat: '12h' });
  });

  it('ignores a malformed formats cookie', () => {
    expect(
      resolvePreferences({ cookieLanguage: 'th', cookieFormats: 'XYZ.13h' })
    ).toMatchObject({ dateFormat: 'DMY', timeFormat: '24h' });
  });

  it.each(['zh', 'zh-TW', 'es', 'pt'])(
    'keeps %s, a language with no country, instead of falling back to English, priced in USD',
    (language) => {
      expect(resolvePreferences({ cookieLanguage: language })).toMatchObject({
        language,
        countryCode: 'GB',
        currency: 'USD',
        dateFormat: 'DMY',
      });
      // The user's own currency still wins.
      expect(
        resolvePreferences({ cookieLanguage: language, cookieCurrency: 'THB' })
      ).toMatchObject({ language, currency: 'THB' });
    }
  );

  it("resolves Hindi to India's formats and currency", () => {
    expect(resolvePreferences({ cookieLanguage: 'hi' })).toMatchObject({
      language: 'hi',
      countryCode: 'IN',
      currency: 'INR',
    });
  });

  // The language reaches <html lang> and an inline script in app/layout.tsx.
  it.each(["x'+alert(1)+'", '</script><img src=x onerror=alert(1)>', 'xx', ''])(
    'ignores an unknown language cookie (%j)',
    (cookieLanguage) => {
      expect(resolvePreferences({ cookieLanguage })).toMatchObject({
        language: 'en-GB',
        countryCode: 'GB',
      });
    }
  );
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

  const cookie = (cookies: string[], name: string): string | undefined =>
    cookies.find((c) => c.startsWith(`${name}=`));

  it('writes the currency, formats and a user-picked timezone', () => {
    const cookies = preferenceCookieStrings({
      ...base,
      timezoneSetByUser: true,
    });
    expect(cookie(cookies, 'davintrade-currency')).toMatch(/=GBP;/);
    expect(cookie(cookies, 'davintrade-formats')).toMatch(/=DMY\.24h;/);
    expect(cookie(cookies, 'davintrade-timezone')).toMatch(/=Europe%2FLondon;/);
  });

  it('clears the timezone cookie while the timezone is IP-detected', () => {
    const cookies = preferenceCookieStrings({
      ...base,
      timezoneSetByUser: false,
    });
    expect(cookie(cookies, 'davintrade-timezone')).toMatch(/=;.*max-age=0/);
  });
});
