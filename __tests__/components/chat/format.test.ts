/**
 * @jest-environment node
 */

/**
 * Figures in the reader's language (build step 7 part 8): `components/chat/format.ts` repeats the
 * number styles of the server's resolver (`lib/reply/report1/resolve.ts`), which is server code. A
 * table that drifted would show `4.367,25` in a sentence and `4,367.25` in the table under it, so the
 * styles are held to the resolver's here, locale by locale, and every figure is compared with what the
 * resolver itself writes for the same number.
 */

import {
  LRI,
  NUMBER_STYLES,
  PDI,
  formatCount,
  formatPercent,
  formatPrice,
  formatRatio,
  isolate,
} from '@/components/chat/format';
import {
  LRI as SERVER_LRI,
  NUMBER_STYLES as SERVER_STYLES,
  PDI as SERVER_PDI,
  formatValue,
} from '@/lib/reply/report1/resolve';
import { LOCALES } from '@/lib/reply/contracts/intake';

const entry = (kind: 'PRICE' | 'RATIO' | 'COUNT', value: number) => ({
  id: 'X',
  kind,
  value,
  tolerance: 0,
  addressable: true,
});

/** What the server writes with the isolates it adds in a right-to-left locale taken off. */
const bare = (text: string | null): string =>
  (text ?? '').split(SERVER_LRI).join('').split(SERVER_PDI).join('');

describe('the number styles', () => {
  it('are the resolver’s, locale by locale, for all 19', () => {
    expect(Object.keys(NUMBER_STYLES).sort()).toEqual([...LOCALES].sort());
    for (const locale of LOCALES) {
      expect({ locale, style: NUMBER_STYLES[locale] }).toEqual({
        locale,
        style: SERVER_STYLES[locale],
      });
    }
  });

  it('the direction isolates are the resolver’s', () => {
    expect(LRI).toBe(SERVER_LRI);
    expect(PDI).toBe(SERVER_PDI);
  });
});

describe('a price, a distance', () => {
  const VALUES = [
    0, 0.5, 4.2, 12.345, 999.995, 4367.25, 4378.31, 12345.6789, 1234567.8, -3.5,
    -0.001,
  ];

  it.each([...LOCALES])(
    '%s: the same text the resolver writes in a line',
    (locale) => {
      for (const value of VALUES) {
        expect({ value, text: formatPrice(value, locale) }).toEqual({
          value,
          text: bare(formatValue(entry('PRICE', value), { locale })),
        });
      }
    }
  );

  it('writes two places and the marks of the language', () => {
    expect(formatPrice(4367.25, 'en-US')).toBe('4,367.25');
    expect(formatPrice(4367.25, 'de')).toBe('4.367,25');
    expect(formatPrice(4367.25, 'fr')).toBe('4 367,25');
    expect(formatPrice(4367.2, 'en-GB')).toBe('4,367.20');
  });

  it('a value that is not a number is nothing, never "NaN"', () => {
    expect(formatPrice(Number.NaN, 'en-US')).toBe('');
    expect(formatPrice(Number.POSITIVE_INFINITY, 'en-US')).toBe('');
  });

  it('a locale that is not one of the 19 reads like English', () => {
    expect(formatPrice(4367.25, 'xx')).toBe('4,367.25');
  });
});

describe('a ratio, a count, a share', () => {
  it('a ratio is up to two places and the times sign', () => {
    expect(formatRatio(1.75, 'en-US')).toBe('1.75×');
    expect(formatRatio(2, 'en-US')).toBe('2×');
    expect(formatRatio(0.5, 'de')).toBe('0,5×');
    expect(formatRatio(Number.NaN, 'en-US')).toBe('');
  });

  it.each([...LOCALES])('%s: a ratio equals the resolver’s', (locale) => {
    for (const value of [0.5, 1.75, 2, 12.5]) {
      expect(formatRatio(value, locale)).toBe(
        `${bare(formatValue(entry('RATIO', value), { locale }))}×`
      );
    }
  });

  it('a count has the grouping of the language', () => {
    expect(formatCount(555, 'en-US')).toBe('555');
    expect(formatCount(1234567, 'en-US')).toBe('1,234,567');
    expect(formatCount(1234567, 'de')).toBe('1.234.567');
    expect(formatCount(2.6, 'en-US')).toBe('3');
  });

  it.each([...LOCALES])('%s: a count equals the resolver’s', (locale) => {
    for (const value of [0, 7, 555, 12345]) {
      expect(formatCount(value, locale)).toBe(
        bare(formatValue(entry('COUNT', value), { locale }))
      );
    }
  });

  it('a share is a whole percent, held between 0 and 100', () => {
    expect(formatPercent(0.5, 'en-US')).toBe('50%');
    expect(formatPercent(0, 'en-US')).toBe('0%');
    expect(formatPercent(1, 'en-US')).toBe('100%');
    expect(formatPercent(0.004, 'en-US')).toBe('0%');
    expect(formatPercent(1.7, 'en-US')).toBe('100%');
    expect(formatPercent(-0.2, 'en-US')).toBe('0%');
    expect(formatPercent(Number.NaN, 'en-US')).toBe('0%');
  });
});

describe('isolating', () => {
  it('wraps a text in a left-to-right isolate', () => {
    expect(isolate('4,367.25')).toBe(`${LRI}4,367.25${PDI}`);
  });
});
