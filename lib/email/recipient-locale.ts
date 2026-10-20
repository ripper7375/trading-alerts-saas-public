/**
 * Which language and formats an e-mail to one person is written in.
 *
 * Order, field by field: what the person saved in Settings -> Language &
 * Region (`UserPreferences.preferences`), then the cookies and the IP-derived
 * timezone of the request that triggered the mail, then English and UTC. The
 * saved choice comes first on purpose: a sign-in alert or a password reset is
 * sent to the account owner, and the browser that triggered it may be someone
 * else's.
 *
 * Never throws: an e-mail is worth sending in English rather than not at all.
 *
 * @module lib/email/recipient-locale
 */

import 'server-only';

import { cookies, headers } from 'next/headers';

import { prisma } from '@/lib/db/prisma';
import { IP_TIMEZONE_HEADERS } from '@/lib/i18n/locale-resolver';

import {
  EMAIL_HINT_COOKIES,
  normalizeEmailLanguage,
  resolveEmailLocale,
  type EmailLocale,
  type EmailLocaleHint,
} from './i18n';

function formatsHint(value: string | undefined): EmailLocaleHint {
  const [dateFormat, timeFormat] = (value ?? '').split('.');
  return { dateFormat, timeFormat };
}

/** The locale cookies and IP timezone of the request in flight, if any. */
export async function requestEmailLocaleHint(): Promise<EmailLocaleHint> {
  try {
    const jar = await cookies();
    const requestHeaders = await headers();
    const detectedTimezone = IP_TIMEZONE_HEADERS.map((name) =>
      requestHeaders.get(name)
    ).find((value) => !!value);

    return {
      language: jar.get(EMAIL_HINT_COOKIES.language)?.value,
      timezone: jar.get(EMAIL_HINT_COOKIES.timezone)?.value ?? detectedTimezone,
      ...formatsHint(jar.get(EMAIL_HINT_COOKIES.formats)?.value),
    };
  } catch {
    // Not inside a request (a webhook retry, a cron, a test).
    return {};
  }
}

/** What the account with this address saved in Settings, if anything. */
export async function savedEmailLocaleHint(
  email: string
): Promise<EmailLocaleHint> {
  try {
    const row = await prisma.userPreferences.findFirst({
      where: { user: { email } },
      select: { preferences: true },
    });
    const stored = (row?.preferences ?? {}) as Record<string, unknown>;
    return {
      language: stored['language'],
      timezone: stored['timezone'],
      dateFormat: stored['dateFormat'],
      timeFormat: stored['timeFormat'],
    };
  } catch (error) {
    console.error('[Email] Could not read saved language preferences:', error);
    return {};
  }
}

/** The locale an e-mail to `email` is written in. */
export async function emailLocaleForRecipient(
  email: string
): Promise<EmailLocale> {
  const [saved, request] = await Promise.all([
    savedEmailLocaleHint(email),
    requestEmailLocaleHint(),
  ]);
  return resolveEmailLocale(saved, request);
}

/**
 * Remember the language and formats of the browser the account is using, but
 * only when the account has not got a language saved yet.
 *
 * Mail that no request triggers (a Stripe receipt, a commission notice) can
 * only read what is saved, and most people never press Save in Settings: they
 * pick a country in the header or land on one that was detected. Called at
 * sign-in, this gives them a starting point. It never replaces a saved
 * language, so an explicit choice made in Settings always wins.
 */
export async function rememberAccountLocaleIfAbsent(
  userId: string
): Promise<void> {
  try {
    const hint = await requestEmailLocaleHint();
    // Nothing worth saving when the request carried no language of its own.
    if (!normalizeEmailLanguage(hint.language)) return;
    const request = resolveEmailLocale(hint);

    const row = await prisma.userPreferences.findUnique({
      where: { userId },
      select: { preferences: true },
    });
    const stored = (row?.preferences ?? {}) as Record<string, unknown>;
    if (typeof stored['language'] === 'string' && stored['language']) return;

    const preferences = {
      ...stored,
      language: request.language,
      ...(request.dateFormat && request.timeFormat
        ? { dateFormat: request.dateFormat, timeFormat: request.timeFormat }
        : {}),
      ...(request.timezone && !stored['timezone']
        ? { timezone: request.timezone }
        : {}),
    };
    await prisma.userPreferences.upsert({
      where: { userId },
      create: { userId, preferences },
      update: { preferences },
    });
  } catch (error) {
    console.error('[Email] Could not remember the account language:', error);
  }
}
