/**
 * Showing Report 2's figures in the viewer's language (build step 5, part 7).
 *
 * The template (`lib/engine4/templates/report2.ts`) hands over each figure as exact
 * decimal text, already rounded for display. This file only DRESSES it for the
 * viewer: the digits, the grouping and the decimal mark of their language, the
 * currency symbol, the time in their zone and format. A JavaScript number appears
 * here, between the rounded text and `Intl`, and nowhere else: no money maths ever
 * passes through it, and a value of at most two decimals below 10^15 survives the
 * trip exactly.
 *
 * Money is the trader's account currency, US dollars, shown UNCONVERTED with
 * `formatChargedAmount` (`docs/policies/08-locale-i18n-compliance.md` section 4:
 * `formatCurrency()` converts to the viewer's currency and drops decimals above
 * 1,000, which would misstate an exact risk). Gold's price is a quote in dollars per
 * ounce, not an amount of money, and is shown as a plain number.
 *
 * @module components/report2/format
 */

import { formatChargedAmount } from '@/lib/billing/invoice-amounts';
import { Rational } from '@/lib/engine4';
import type { Shown } from '@/lib/engine4/templates/report2';
import { readWire } from '@/lib/engine4/templates/wire';

/** The BCP 47 tag `Intl` gets for an app language (Portuguese of Portugal is `pt-PT`, as everywhere else in the app). */
export function localeOf(language: string): string {
  return language === 'pt' ? 'pt-PT' : language || 'en-US';
}

function decimalsOf(text: string): number {
  const dot = text.indexOf('.');
  return dot === -1 ? 0 : text.length - dot - 1;
}

function plain(text: string, places: number, locale: string): string {
  try {
    return new Intl.NumberFormat(locale, {
      minimumFractionDigits: places,
      maximumFractionDigits: places,
    }).format(Number(text));
  } catch {
    return text;
  }
}

/** The multiplication sign, after the number: 1.75×. */
const TIMES = '×';

export interface FigureContext {
  language: string;
  /** `useLocale().formatDateTime`: the viewer's timezone, date format and time format */
  formatDateTime: (utc: number | string | Date) => string;
}

/** One figure, dressed. Unknown or unreadable text is shown as it came. */
export function formatFigure(shown: Shown, ctx: FigureContext): string {
  const locale = localeOf(ctx.language);
  switch (shown.kind) {
    case 'price':
      return plain(shown.text, 2, locale);
    case 'money':
      return formatChargedAmount(Number(shown.text), 'USD', ctx.language);
    case 'lot':
      return plain(shown.text, decimalsOf(shown.text), locale);
    case 'ratio':
    case 'multiple':
      return `${plain(shown.text, 2, locale)}${TIMES}`;
    case 'percent_free': {
      try {
        const fraction = readWire(shown.text)
          .mul(Rational.fromFraction(1n, 100n))
          .toDecimal(6);
        return new Intl.NumberFormat(locale, {
          style: 'percent',
          minimumFractionDigits: 0,
          maximumFractionDigits: 2,
        }).format(Number(fraction));
      } catch {
        return `${shown.text}%`;
      }
    }
    case 'percent': {
      // 1.5 means 1.5%: shift the point two places exactly, then let Intl add the sign
      try {
        const fraction = readWire(shown.text)
          .mul(Rational.fromFraction(1n, 100n))
          .toDecimal(4);
        return new Intl.NumberFormat(locale, {
          style: 'percent',
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        }).format(Number(fraction));
      } catch {
        return `${shown.text}%`;
      }
    }
    case 'time':
      return ctx.formatDateTime(new Date(Number(shown.text) * 1000));
    case 'raw':
      return shown.text;
    default:
      return shown.text;
  }
}

/** First Strong Isolate and Pop Directional Isolate: a figure inside a sentence keeps its own direction. */
const FSI = '⁨';
const PDI = '⁩';

/** Wrap text so that right-to-left sentences cannot reorder it (a level name, a price, a time). */
export function isolate(text: string): string {
  return `${FSI}${text}${PDI}`;
}
