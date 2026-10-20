/**
 * @jest-environment node
 */
/**
 * Which language and formats an e-mail is written in: normalising what a
 * stored row, a cookie or a header carries, and the order they are trusted in.
 */
import {
  DEFAULT_EMAIL_LOCALE,
  EMAIL_HINT_COOKIES,
  EMAIL_HINT_HEADERS,
  emailHintFromCookieHeader,
  emailHintFromHeaders,
  emailHintToHeaders,
  normalizeEmailLanguage,
  normalizeEmailTimezone,
  resolveEmailLocale,
} from '@/lib/email/i18n/languages';
import {
  FORMATS_COOKIE,
  LOCALE_COOKIE,
  TIMEZONE_COOKIE,
} from '@/lib/i18n/locale-resolver';

describe('normalizeEmailLanguage', () => {
  it.each([
    ['th', 'th'],
    ['pt-BR', 'pt-BR'],
    ['PT-br', 'pt-BR'],
    ['en-US', 'en-US'],
    ['en-GB', 'en-GB'],
    ['en-AU', 'en-GB'],
    ['en', 'en-GB'],
    ['es-MX', 'es'],
    ['pt-PT', 'pt'],
    ['pt_BR', 'pt-BR'],
    ['zh-CN', 'zh'],
    ['zh-Hans', 'zh'],
    ['zh-TW', 'zh-TW'],
    ['zh-Hant-HK', 'zh-TW'],
    ['de-AT', 'de'],
    ['  ja  ', 'ja'],
  ])('%s -> %s', (input, expected) => {
    expect(normalizeEmailLanguage(input)).toBe(expected);
  });

  it.each([undefined, null, '', 42, {}, 'xx', 'klingon', 'a'.repeat(80)])(
    'refuses %p',
    (input) => {
      expect(normalizeEmailLanguage(input)).toBeNull();
    }
  );
});

describe('normalizeEmailTimezone', () => {
  it('accepts an IANA zone and refuses anything else', () => {
    expect(normalizeEmailTimezone('Asia/Bangkok')).toBe('Asia/Bangkok');
    expect(normalizeEmailTimezone('UTC')).toBe('UTC');
    expect(normalizeEmailTimezone('Not/AZone')).toBeUndefined();
    expect(normalizeEmailTimezone('')).toBeUndefined();
    expect(normalizeEmailTimezone(5)).toBeUndefined();
  });
});

describe('resolveEmailLocale', () => {
  it('is English and UTC when nothing is known', () => {
    expect(resolveEmailLocale()).toEqual(DEFAULT_EMAIL_LOCALE);
    expect(resolveEmailLocale(null, undefined, {})).toEqual({
      language: 'en-US',
    });
  });

  it('takes the first valid value of each field, in order', () => {
    const saved = { language: 'th', dateFormat: 'DMY' };
    const request = {
      language: 'de',
      timezone: 'Europe/Berlin',
      dateFormat: 'MDY',
      timeFormat: '12h',
    };
    expect(resolveEmailLocale(saved, request)).toEqual({
      language: 'th',
      timezone: 'Europe/Berlin',
      dateFormat: 'DMY',
      timeFormat: '12h',
    });
  });

  it('skips a value that does not validate instead of stopping at it', () => {
    expect(
      resolveEmailLocale(
        { language: 'klingon', timezone: 'Mars/Base', dateFormat: 'XYZ' },
        { language: 'fr', timezone: 'Europe/Paris', dateFormat: 'DMY' }
      )
    ).toEqual({ language: 'fr', timezone: 'Europe/Paris', dateFormat: 'DMY' });
  });
});

describe('request hints', () => {
  it('reads the three cookies the app writes', () => {
    expect(
      emailHintFromCookieHeader(
        'a=b; davintrade-locale=ar; davintrade-formats=YMD.24h; davintrade-timezone=Asia%2FDubai; c=d'
      )
    ).toEqual({
      language: 'ar',
      timezone: 'Asia/Dubai',
      dateFormat: 'YMD',
      timeFormat: '24h',
    });
  });

  it('copes with no cookie header, a malformed one and a bad escape', () => {
    expect(emailHintFromCookieHeader(null)).toEqual({});
    expect(emailHintFromCookieHeader('')).toEqual({});
    expect(
      emailHintFromCookieHeader('garbage; =x; davintrade-locale=%E0%A4%A')
    ).toEqual(expect.objectContaining({ language: '%E0%A4%A' }));
    // ...and the junk value is then refused when the hint is used
    expect(
      resolveEmailLocale(
        emailHintFromCookieHeader('davintrade-locale=%E0%A4%A')
      ).language
    ).toBe('en-US');
  });

  it('uses the same cookie names as the app', () => {
    expect(EMAIL_HINT_COOKIES.language).toBe(LOCALE_COOKIE);
    expect(EMAIL_HINT_COOKIES.formats).toBe(FORMATS_COOKIE);
    expect(EMAIL_HINT_COOKIES.timezone).toBe(TIMEZONE_COOKIE);
  });

  it('forwards only validated values as headers, and reads them back', () => {
    const headers = emailHintToHeaders({
      language: 'pt-BR',
      timezone: 'America/Sao_Paulo',
      dateFormat: 'DMY',
      timeFormat: '24h',
    });
    expect(headers).toEqual({
      [EMAIL_HINT_HEADERS.language]: 'pt-BR',
      [EMAIL_HINT_HEADERS.timezone]: 'America/Sao_Paulo',
      [EMAIL_HINT_HEADERS.formats]: 'DMY.24h',
    });
    expect(
      emailHintFromHeaders((name) => (headers as Record<string, string>)[name])
    ).toEqual({
      language: 'pt-BR',
      timezone: 'America/Sao_Paulo',
      dateFormat: 'DMY',
      timeFormat: '24h',
    });
  });

  it('forwards nothing that could carry anything but a locale', () => {
    expect(
      emailHintToHeaders({
        language: 'th\r\nx-evil: 1',
        timezone: '<script>',
        dateFormat: 'DMY',
      })
    ).toEqual({});
  });
});
