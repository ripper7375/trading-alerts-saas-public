/**
 * The e-mail text catalog: one object per locale, looked up by key, with the
 * English text as the per-key fallback (a key that is somehow missing renders
 * in English rather than blank). Pure: see `languages.ts`.
 */

import {
  isRtlEmailLanguage,
  type EmailLanguage,
  type EmailLocale,
} from './languages';
import { ar } from './messages/ar';
import { de } from './messages/de';
import { enGB } from './messages/en-GB';
import {
  enUS,
  type EmailMessageKey,
  type EmailMessages,
} from './messages/en-US';
import { es } from './messages/es';
import { fr } from './messages/fr';
import { hi } from './messages/hi';
import { id } from './messages/id';
import { it } from './messages/it';
import { ja } from './messages/ja';
import { ko } from './messages/ko';
import { pt } from './messages/pt';
import { ptBR } from './messages/pt-BR';
import { th } from './messages/th';
import { tr } from './messages/tr';
import { ur } from './messages/ur';
import { vi } from './messages/vi';
import { zh } from './messages/zh';
import { zhTW } from './messages/zh-TW';

export type { EmailMessageKey, EmailMessages };

export const EMAIL_CATALOGS: Record<EmailLanguage, EmailMessages> = {
  'en-US': enUS,
  'en-GB': enGB,
  es,
  de,
  pt,
  'pt-BR': ptBR,
  it,
  ja,
  ar,
  fr,
  ko,
  zh,
  'zh-TW': zhTW,
  ur,
  hi,
  vi,
  id,
  th,
  tr,
};

/** Already-safe HTML a caller built itself (a link, say). Never user input. */
export class RawHtml {
  constructor(readonly html: string) {}
}

export function raw(html: string): RawHtml {
  return new RawHtml(html);
}

export type EmailVars = Record<string, string | number | RawHtml>;

/** Escapes text that goes into HTML content or an attribute. */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * A value that keeps its own direction inside a right-to-left sentence or
 * table (`<bdi>` isolates it from the text around it).
 */
export function isolate(value: string): string {
  return `<bdi>${escapeHtml(value)}</bdi>`;
}

/** Static catalog text: markup characters only, so apostrophes stay readable. */
function escapeStatic(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/** The catalog text for `key`, falling back to English. */
export function message(locale: EmailLocale, key: EmailMessageKey): string {
  return EMAIL_CATALOGS[locale.language]?.[key] ?? enUS[key];
}

function fill(
  template: string,
  vars: EmailVars,
  escapeValue: (value: string) => string
): string {
  return template.replace(/\{(\w+)\}/g, (whole, name: string) => {
    const value = vars[name];
    if (value === undefined) return whole;
    if (value instanceof RawHtml) return value.html;
    return escapeValue(String(value));
  });
}

/**
 * Text for a subject line or a plain-text part: placeholders filled, `**`
 * markers dropped, nothing escaped.
 */
export function plain(
  locale: EmailLocale,
  key: EmailMessageKey,
  vars: EmailVars = {}
): string {
  return fill(message(locale, key).replace(/\*\*/g, ''), vars, (v) => v);
}

/**
 * Text for an HTML body: the static text and every value are escaped (a value
 * wrapped in `raw()` is trusted as given) and `**bold**` becomes `<strong>`.
 */
export function html(
  locale: EmailLocale,
  key: EmailMessageKey,
  vars: EmailVars = {}
): string {
  const withMarkup = escapeStatic(message(locale, key)).replace(
    /\*\*(.+?)\*\*/g,
    '<strong>$1</strong>'
  );
  // In a right-to-left language a value written in Latin letters or digits (a
  // date, an amount, a name) is isolated, so the reading order of the sentence
  // around it cannot reorder it.
  return fill(
    withMarkup,
    vars,
    isRtlEmailLanguage(locale.language) ? isolate : escapeHtml
  );
}
