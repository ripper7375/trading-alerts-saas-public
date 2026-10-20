import { DEFAULT_EMAIL_LOCALE, type EmailLocale } from './i18n';

type RecipientLocaleResolver = (email: string) => Promise<EmailLocale>;

let recipientLocaleResolver: RecipientLocaleResolver | null = null;

/**
 * Registers how to find the locale of a recipient. Called once at start-up by
 * `EmailLocaleService`; until then (and in tests) e-mail is written in English.
 */
export function setRecipientLocaleResolver(
  resolver: RecipientLocaleResolver | null
): void {
  recipientLocaleResolver = resolver;
}

/**
 * The locale to write an e-mail to `to` in: the one given, else the
 * recipient's own. Never throws; English is the floor.
 */
export async function localeFor(
  to: string,
  locale: EmailLocale | undefined
): Promise<EmailLocale> {
  if (locale) return locale;
  try {
    return recipientLocaleResolver
      ? await recipientLocaleResolver(to)
      : DEFAULT_EMAIL_LOCALE;
  } catch {
    return DEFAULT_EMAIL_LOCALE;
  }
}
