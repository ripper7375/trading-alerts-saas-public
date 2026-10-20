/**
 * Languages and locale preferences for e-mail.
 *
 * This folder is pure on purpose (no `server-only`, no Prisma, no Next.js): it
 * is mirrored byte-for-byte into `operation-service/src/email/i18n/` (that
 * service deploys on its own and cannot import `lib/`), and the mirror is held
 * by `__tests__/lib/email/i18n/mirror.test.ts`. Edit it here, then copy it over.
 *
 * An e-mail has no browser, so the reader's language, timezone and date / time
 * format come from (1) what the user saved in Settings -> Language & Region,
 * then (2) the `davintrade-*` cookies of the request that triggered the mail,
 * then (3) English and UTC, which is what every e-mail used before this existed.
 */

/** The 19 locales of `lib/i18n/languages.ts`, in the same order. */
export const EMAIL_LANGUAGES = [
  'en-US',
  'en-GB',
  'es',
  'de',
  'pt',
  'pt-BR',
  'it',
  'ja',
  'ar',
  'fr',
  'ko',
  'zh',
  'zh-TW',
  'ur',
  'hi',
  'vi',
  'id',
  'th',
  'tr',
] as const;

export type EmailLanguage = (typeof EMAIL_LANGUAGES)[number];

export const DEFAULT_EMAIL_LANGUAGE: EmailLanguage = 'en-US';

export type EmailDateFormat = 'MDY' | 'DMY' | 'YMD';
export type EmailTimeFormat = '12h' | '24h';

const DATE_FORMATS: readonly EmailDateFormat[] = ['MDY', 'DMY', 'YMD'];
const TIME_FORMATS: readonly EmailTimeFormat[] = ['12h', '24h'];

/** The reader of one e-mail. Only `language` is always known. */
export interface EmailLocale {
  language: EmailLanguage;
  /** IANA zone the times are shown in; UTC when absent. */
  timezone?: string;
  dateFormat?: EmailDateFormat;
  timeFormat?: EmailTimeFormat;
}

export const DEFAULT_EMAIL_LOCALE: EmailLocale = {
  language: DEFAULT_EMAIL_LANGUAGE,
};

/** Unvalidated locale values from a stored row, a cookie or a header. */
export interface EmailLocaleHint {
  language?: unknown;
  timezone?: unknown;
  dateFormat?: unknown;
  timeFormat?: unknown;
}

const RTL_LANGUAGES: readonly EmailLanguage[] = ['ar', 'ur'];

export function isRtlEmailLanguage(language: EmailLanguage): boolean {
  return RTL_LANGUAGES.includes(language);
}

const BASE_LANGUAGES: Record<string, EmailLanguage> = {
  es: 'es',
  de: 'de',
  it: 'it',
  ja: 'ja',
  ar: 'ar',
  fr: 'fr',
  ko: 'ko',
  ur: 'ur',
  hi: 'hi',
  vi: 'vi',
  id: 'id',
  th: 'th',
  tr: 'tr',
};

/**
 * A supported language for `value`, or null. Accepts the exact codes
 * (`pt-BR`), any casing, and the regional forms a browser or a header may
 * carry (`zh-Hant-HK`, `es-MX`, `en-AU`).
 */
export function normalizeEmailLanguage(value: unknown): EmailLanguage | null {
  if (typeof value !== 'string') return null;
  const code = value.trim().replace(/_/g, '-');
  if (!code || code.length > 35) return null;

  const exact = EMAIL_LANGUAGES.find(
    (l) => l.toLowerCase() === code.toLowerCase()
  );
  if (exact) return exact;

  const parts = code.toLowerCase().split('-');
  const base = parts[0] ?? '';
  const rest = parts.slice(1);

  if (base === 'en') return rest[0] === 'us' ? 'en-US' : 'en-GB';
  if (base === 'pt') return rest.includes('br') ? 'pt-BR' : 'pt';
  if (base === 'zh') {
    return rest.some((p) => ['tw', 'hk', 'mo', 'hant'].includes(p))
      ? 'zh-TW'
      : 'zh';
  }
  return BASE_LANGUAGES[base] ?? null;
}

/** `timezone` when this runtime can format in it, else undefined. */
export function normalizeEmailTimezone(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const zone = value.trim();
  if (!zone || zone.length > 64) return undefined;
  try {
    new Intl.DateTimeFormat('en-GB', { timeZone: zone });
    return zone;
  } catch {
    return undefined;
  }
}

export function normalizeEmailDateFormat(
  value: unknown
): EmailDateFormat | undefined {
  return DATE_FORMATS.find((f) => f === value);
}

export function normalizeEmailTimeFormat(
  value: unknown
): EmailTimeFormat | undefined {
  return TIME_FORMATS.find((f) => f === value);
}

/**
 * The locale to write in. Hints are tried in order, field by field: the first
 * valid value wins, so `[saved, request]` lets the request fill only what the
 * user never saved.
 */
export function resolveEmailLocale(
  ...hints: Array<EmailLocaleHint | null | undefined>
): EmailLocale {
  let language: EmailLanguage | null = null;
  let timezone: string | undefined;
  let dateFormat: EmailDateFormat | undefined;
  let timeFormat: EmailTimeFormat | undefined;

  for (const hint of hints) {
    if (!hint) continue;
    language ??= normalizeEmailLanguage(hint.language);
    timezone ??= normalizeEmailTimezone(hint.timezone);
    dateFormat ??= normalizeEmailDateFormat(hint.dateFormat);
    timeFormat ??= normalizeEmailTimeFormat(hint.timeFormat);
  }

  return {
    language: language ?? DEFAULT_EMAIL_LANGUAGE,
    ...(timezone ? { timezone } : {}),
    ...(dateFormat ? { dateFormat } : {}),
    ...(timeFormat ? { timeFormat } : {}),
  };
}

// ─── Request hints ──────────────────────────────────────────────────────────

/** The cookies the app writes (`lib/i18n/locale-resolver.ts`). */
export const EMAIL_HINT_COOKIES = {
  language: 'davintrade-locale',
  formats: 'davintrade-formats',
  timezone: 'davintrade-timezone',
} as const;

/** The headers the Next.js app forwards to operation-service. */
export const EMAIL_HINT_HEADERS = {
  language: 'x-email-language',
  formats: 'x-email-formats',
  timezone: 'x-email-timezone',
} as const;

function splitFormats(value: string | null | undefined): EmailLocaleHint {
  const [dateFormat, timeFormat] = (value ?? '').split('.');
  return { dateFormat, timeFormat };
}

function decode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

/** Locale hint from a raw `Cookie` header. */
export function emailHintFromCookieHeader(
  cookieHeader: string | null | undefined
): EmailLocaleHint {
  if (!cookieHeader) return {};
  const jar = new Map<string, string>();
  for (const pair of cookieHeader.split(';')) {
    const at = pair.indexOf('=');
    if (at < 0) continue;
    jar.set(pair.slice(0, at).trim(), decode(pair.slice(at + 1).trim()));
  }
  return {
    language: jar.get(EMAIL_HINT_COOKIES.language),
    timezone: jar.get(EMAIL_HINT_COOKIES.timezone),
    ...splitFormats(jar.get(EMAIL_HINT_COOKIES.formats)),
  };
}

/** Locale hint from the headers {@link emailHintToHeaders} forwarded. */
export function emailHintFromHeaders(
  get: (name: string) => string | null | undefined
): EmailLocaleHint {
  return {
    language: get(EMAIL_HINT_HEADERS.language) ?? undefined,
    timezone: get(EMAIL_HINT_HEADERS.timezone) ?? undefined,
    ...splitFormats(get(EMAIL_HINT_HEADERS.formats)),
  };
}

/**
 * Headers that carry a hint to operation-service. Only values that validate
 * are forwarded, so a header can never smuggle anything else through.
 */
export function emailHintToHeaders(
  hint: EmailLocaleHint
): Record<string, string> {
  const headers: Record<string, string> = {};
  const language = normalizeEmailLanguage(hint.language);
  const timezone = normalizeEmailTimezone(hint.timezone);
  const dateFormat = normalizeEmailDateFormat(hint.dateFormat);
  const timeFormat = normalizeEmailTimeFormat(hint.timeFormat);
  if (language) headers[EMAIL_HINT_HEADERS.language] = language;
  if (timezone) headers[EMAIL_HINT_HEADERS.timezone] = timezone;
  if (dateFormat && timeFormat) {
    headers[EMAIL_HINT_HEADERS.formats] = `${dateFormat}.${timeFormat}`;
  }
  return headers;
}
