/**
 * Dates, times and money for e-mail, in the reader's own language, timezone,
 * date format and time format. Pure: see `languages.ts`.
 *
 * The numeric forms (`20/10/2026 14:30`) mirror `lib/i18n/format-datetime.ts`,
 * which the app uses on screen, so a time in an e-mail reads exactly like the
 * same time in Settings. With no saved formats the date is written out in the
 * reader's language instead (`Tuesday, October 20, 2026 at 02:30 PM UTC`).
 */

import type { EmailLocale } from './languages';

const DEFAULT_ZONE = 'UTC';

/** Gregorian calendar and Latin digits, whatever the language defaults to. */
function intlTag(locale: EmailLocale): string {
  return `${locale.language}-u-ca-gregory-nu-latn`;
}

function zoneOf(locale: EmailLocale): string {
  return locale.timezone ?? DEFAULT_ZONE;
}

function parts(
  date: Date,
  timeZone: string,
  options: Intl.DateTimeFormatOptions
): Record<string, string> {
  let formatted: Intl.DateTimeFormatPart[];
  try {
    formatted = new Intl.DateTimeFormat('en-GB', {
      ...options,
      timeZone,
    }).formatToParts(date);
  } catch {
    formatted = new Intl.DateTimeFormat('en-GB', {
      ...options,
      timeZone: DEFAULT_ZONE,
    }).formatToParts(date);
  }
  return Object.fromEntries(formatted.map((p) => [p.type, p.value]));
}

function numericDate(
  date: Date,
  timeZone: string,
  dateFormat: 'MDY' | 'DMY' | 'YMD'
): string {
  const p = parts(date, timeZone, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
  const day = p['day'] ?? '';
  const month = p['month'] ?? '';
  const year = p['year'] ?? '';
  if (dateFormat === 'DMY') return `${day}/${month}/${year}`;
  if (dateFormat === 'YMD') return `${year}-${month}-${day}`;
  return `${month}/${day}/${year}`;
}

function numericTime(
  date: Date,
  timeZone: string,
  timeFormat: '12h' | '24h'
): string {
  const twelve = timeFormat === '12h';
  const p = parts(date, timeZone, {
    hour: twelve ? 'numeric' : '2-digit',
    minute: '2-digit',
    hourCycle: twelve ? 'h12' : 'h23',
  });
  const time = `${p['hour'] ?? ''}:${p['minute'] ?? ''}`;
  return twelve
    ? `${time} ${(p['dayPeriod'] ?? '').toUpperCase()}`.trim()
    : time;
}

/** `UTC`, `GMT+7`, `EST`: the zone's short name in the reader's language. */
function zoneLabel(date: Date, locale: EmailLocale): string {
  const timeZone = zoneOf(locale);
  try {
    const label = new Intl.DateTimeFormat(intlTag(locale), {
      timeZone,
      timeZoneName: 'short',
    })
      .formatToParts(date)
      .find((p) => p.type === 'timeZoneName')?.value;
    return label ?? timeZone;
  } catch {
    return timeZone;
  }
}

function valid(date: Date): boolean {
  return !Number.isNaN(date.getTime());
}

/** A moment, e.g. when a sign-in happened or when a link expires. */
export function formatEmailDateTime(date: Date, locale: EmailLocale): string {
  if (!valid(date)) return '--';
  const timeZone = zoneOf(locale);

  if (locale.dateFormat && locale.timeFormat) {
    return `${numericDate(date, timeZone, locale.dateFormat)} ${numericTime(
      date,
      timeZone,
      locale.timeFormat
    )} ${zoneLabel(date, locale)}`;
  }

  return new Intl.DateTimeFormat(intlTag(locale), {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    ...(locale.timeFormat
      ? { hourCycle: locale.timeFormat === '12h' ? 'h12' : 'h23' }
      : {}),
    timeZone,
    timeZoneName: 'short',
  } as Intl.DateTimeFormatOptions).format(date);
}

/** A calendar day, e.g. the next billing date. */
export function formatEmailDate(date: Date, locale: EmailLocale): string {
  if (!valid(date)) return '--';
  const timeZone = zoneOf(locale);

  if (locale.dateFormat) {
    return numericDate(date, timeZone, locale.dateFormat);
  }

  return new Intl.DateTimeFormat(intlTag(locale), {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone,
  }).format(date);
}

/**
 * A USD amount in the reader's number format. The money charged is always USD
 * (Stripe / dLocal), so e-mail never converts it: it only writes it the way the
 * reader's language does (`29,00 $` in German, `US$29.00` in Chinese).
 *
 * English keeps the bare `$`. `minimumFractionDigits: 0` gives `$29` for a
 * whole price and `$29.50` for a fractional one; pass 2 for a statement line.
 */
export function formatEmailUsd(
  amount: number,
  locale: EmailLocale,
  minimumFractionDigits: 0 | 2 = 2
): string {
  const english = locale.language === 'en-US' || locale.language === 'en-GB';
  const fractionDigits =
    minimumFractionDigits === 0 && Number.isInteger(amount) ? 0 : 2;
  try {
    return new Intl.NumberFormat(
      english ? 'en-US' : `${locale.language}-u-nu-latn`,
      {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: fractionDigits,
        maximumFractionDigits: fractionDigits,
      }
    ).format(amount);
  } catch {
    return `$${amount.toFixed(fractionDigits)}`;
  }
}
