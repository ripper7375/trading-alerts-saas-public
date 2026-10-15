/**
 * Showing the engines' figures in the reader's language (build step 7 part 8).
 *
 * A model's lines arrive with their figures already filled and formatted by the server
 * (`lib/reply/report1/resolve.ts`, `NUMBER_STYLES`). The structured parts of a card (the levels, the
 * zones, the room) are numbers, and they must be written the SAME way the lines around them are, or a
 * reader sees `4.367,25` in a sentence and `4,367.25` in the table under it. So the marks of the 19
 * locales are repeated here (the resolver is server code and cannot be imported into the browser),
 * and `__tests__/components/chat/format.test.ts` holds this table to the resolver's, locale by locale.
 *
 * A gold price is a quote in dollars per ounce, not an amount of money: it is a plain number, never
 * through the converting `formatCurrency()` (policy 08 section 4). A figure inside a right-to-left
 * sentence is wrapped in left-to-right isolates by the caller (`isolate`), and a figure standing alone
 * is drawn in a `<bdi dir="ltr">` (`components/chat/figure.tsx`).
 *
 * @module components/chat/format
 */

interface Style {
  decimal: string;
  group: string;
}

const POINT: Style = { decimal: '.', group: ',' };
const COMMA: Style = { decimal: ',', group: '.' };
const FRENCH: Style = { decimal: ',', group: String.fromCharCode(0x202f) };

/** The number style of each of the 19 locales; a locale not in the table reads like English. */
export const NUMBER_STYLES: Readonly<Record<string, Style>> = {
  'en-US': POINT,
  'en-GB': POINT,
  ar: POINT,
  de: COMMA,
  es: COMMA,
  fr: FRENCH,
  hi: POINT,
  id: COMMA,
  it: COMMA,
  ja: POINT,
  ko: POINT,
  pt: COMMA,
  'pt-BR': COMMA,
  th: POINT,
  tr: COMMA,
  ur: POINT,
  vi: COMMA,
  zh: POINT,
  'zh-TW': POINT,
};

/** The left-to-right isolate and its terminator (Unicode bidirectional isolates). */
export const LRI = String.fromCharCode(0x2066);
export const PDI = String.fromCharCode(0x2069);

function styleOf(locale: string): Style {
  return Object.prototype.hasOwnProperty.call(NUMBER_STYLES, locale)
    ? (NUMBER_STYLES[locale] as Style)
    : POINT;
}

/** A text kept in its own direction inside a sentence of the other one. */
export function isolate(text: string): string {
  return `${LRI}${text}${PDI}`;
}

function written(
  value: number,
  decimals: number,
  locale: string,
  trim: boolean
): string {
  if (!Number.isFinite(value)) return '';
  const fixed = Math.abs(value).toFixed(decimals);
  const [whole = '0', fraction = ''] = fixed.split('.');
  const style = styleOf(locale);
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, style.group);
  const kept = trim ? fraction.replace(/0+$/, '') : fraction;
  const negative = value < 0 && /[1-9]/.test(fixed);
  return `${negative ? '-' : ''}${grouped}${kept === '' ? '' : style.decimal + kept}`;
}

/** A price or a dollar distance: exactly two places, as the server writes it in a line. */
export function formatPrice(value: number, locale: string): string {
  return written(value, 2, locale, false);
}

/** A ratio: up to two places, then the times sign (`1.75×`). */
export function formatRatio(value: number, locale: string): string {
  const text = written(value, 2, locale, true);
  return text === '' ? '' : `${text}×`;
}

/** A whole number with the locale's grouping. */
export function formatCount(value: number, locale: string): string {
  return written(Math.round(value), 0, locale, false);
}

/** A share between 0 and 1 as a whole percent (`42%`); out-of-range input is held to 0 to 100. */
export function formatPercent(share: number, locale: string): string {
  const clamped = Math.min(1, Math.max(0, Number.isFinite(share) ? share : 0));
  return `${formatCount(Math.round(clamped * 100), locale)}%`;
}
