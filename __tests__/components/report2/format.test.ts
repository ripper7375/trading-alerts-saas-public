/**
 * @jest-environment node
 */

/**
 * Dressing Report 2's figures for the viewer (build step 5, part 7). The template
 * hands over exact decimal text already rounded for display; these functions only
 * apply the digits, grouping, decimal mark, currency sign and time of the viewer.
 */

import { formatFigure, isolate, localeOf } from '@/components/report2/format';

const ctx = (language: string) => ({
  language,
  formatDateTime: (utc: number | string | Date) =>
    `T:${new Date(utc).toISOString()}`,
});

const nbsp = ' ';

describe('localeOf', () => {
  test('Portuguese of Portugal is pt-PT, like everywhere else in the app', () => {
    expect(localeOf('pt')).toBe('pt-PT');
    expect(localeOf('pt-BR')).toBe('pt-BR');
    expect(localeOf('ar')).toBe('ar');
    expect(localeOf('')).toBe('en-US');
  });
});

describe('prices (gold in dollars an ounce, not an amount of money)', () => {
  test.each([
    ['en-US', '4367.20', '4,367.20'],
    ['en-GB', '4367.20', '4,367.20'],
    ['de', '4367.20', '4.367,20'],
    ['fr', '4367.20', `4${' '}367,20`],
    ['es', '4367.20', '4367,20'],
    ['ja', '4367.20', '4,367.20'],
    ['hi', '4367.20', '4,367.20'],
    ['en-US', '0.25', '0.25'],
    ['en-US', '12.00', '12.00'],
  ])('%s shows %s as %s', (language, text, shown) => {
    expect(formatFigure({ kind: 'price', text }, ctx(language))).toBe(shown);
  });

  test('is never converted to the viewer’s currency', () => {
    expect(
      formatFigure({ kind: 'price', text: '4367.20' }, ctx('ja'))
    ).not.toMatch(/[¥￥$€]/);
  });
});

describe('money (the account’s dollars, shown unconverted)', () => {
  test('keeps its cents above 1,000, which the shared formatCurrency would drop', () => {
    expect(
      formatFigure({ kind: 'money', text: '10000.00' }, ctx('en-US'))
    ).toBe('$10,000.00');
    expect(formatFigure({ kind: 'money', text: '68.28' }, ctx('en-US'))).toBe(
      '$68.28'
    );
    expect(formatFigure({ kind: 'money', text: '1234.56' }, ctx('en-US'))).toBe(
      '$1,234.56'
    );
  });

  test('is dollars in every language: the sign and the digits follow the language, the amount does not change', () => {
    expect(formatFigure({ kind: 'money', text: '75.00' }, ctx('de'))).toBe(
      `75,00${nbsp}$`
    );
    expect(formatFigure({ kind: 'money', text: '75.00' }, ctx('en-GB'))).toBe(
      'US$75.00'
    );
    expect(formatFigure({ kind: 'money', text: '75.00' }, ctx('ja'))).toMatch(
      /\$75\.00/
    );
    // no language turns 75 dollars into 75 of something else
    for (const language of [
      'de',
      'fr',
      'es',
      'ja',
      'ko',
      'zh',
      'zh-TW',
      'ar',
      'ur',
      'hi',
      'th',
      'tr',
      'vi',
      'id',
      'it',
      'pt',
      'pt-BR',
    ]) {
      const shown = formatFigure(
        { kind: 'money', text: '75.00' },
        ctx(language)
      );
      expect(shown).toMatch(/\$|USD|US/);
    }
  });
});

describe('lots, ratios and leverage', () => {
  test('a lot keeps exactly the places it has', () => {
    expect(formatFigure({ kind: 'lot', text: '0.04' }, ctx('en-US'))).toBe(
      '0.04'
    );
    expect(formatFigure({ kind: 'lot', text: '0.015' }, ctx('en-US'))).toBe(
      '0.015'
    );
    expect(formatFigure({ kind: 'lot', text: '1.00' }, ctx('en-US'))).toBe(
      '1.00'
    );
    expect(formatFigure({ kind: 'lot', text: '0.04' }, ctx('de'))).toBe('0,04');
  });

  test('an RRR and a leverage multiple carry the multiplication sign', () => {
    expect(formatFigure({ kind: 'ratio', text: '1.75' }, ctx('en-US'))).toBe(
      '1.75×'
    );
    expect(formatFigure({ kind: 'multiple', text: '5.00' }, ctx('en-US'))).toBe(
      '5.00×'
    );
    expect(formatFigure({ kind: 'ratio', text: '1.75' }, ctx('de'))).toBe(
      '1,75×'
    );
  });
});

describe('percentages', () => {
  test('1.5 means 1.5 per cent: the point is moved two places exactly and Intl adds the sign', () => {
    expect(formatFigure({ kind: 'percent', text: '0.75' }, ctx('en-US'))).toBe(
      '0.75%'
    );
    expect(formatFigure({ kind: 'percent', text: '1.50' }, ctx('en-US'))).toBe(
      '1.50%'
    );
    expect(formatFigure({ kind: 'percent', text: '0.68' }, ctx('en-US'))).toBe(
      '0.68%'
    );
    expect(formatFigure({ kind: 'percent', text: '5.69' }, ctx('en-US'))).toBe(
      '5.69%'
    );
  });

  test('follows the language’s own placement of the sign', () => {
    expect(formatFigure({ kind: 'percent', text: '0.75' }, ctx('de'))).toBe(
      `0,75${nbsp}%`
    );
    expect(formatFigure({ kind: 'percent', text: '0.75' }, ctx('tr'))).toBe(
      '%0,75'
    );
  });
});

describe('times and technical names', () => {
  test('a time (unix seconds as text) goes through the viewer’s own date and time format', () => {
    expect(
      formatFigure({ kind: 'time', text: '1789764900' }, ctx('en-US'))
    ).toBe(`T:${new Date(1789764900 * 1000).toISOString()}`);
  });

  test('a technical name (a level, an id, a reason code) is shown as it is', () => {
    expect(formatFigure({ kind: 'raw', text: 'M15 sr_2' }, ctx('ar'))).toBe(
      'M15 sr_2'
    );
  });
});

describe('isolate', () => {
  test('wraps text in first-strong isolate marks so a right-to-left sentence cannot reorder it', () => {
    expect(isolate('4,367.20')).toBe('⁨4,367.20⁩');
  });
});

describe('percentages with only the places they need', () => {
  test('5 is 5%, not 5.00%', () => {
    expect(
      formatFigure({ kind: 'percent_free', text: '5' }, ctx('en-US'))
    ).toBe('5%');
    expect(
      formatFigure({ kind: 'percent_free', text: '2.5' }, ctx('en-US'))
    ).toBe('2.5%');
    expect(
      formatFigure({ kind: 'percent_free', text: '0.75' }, ctx('en-US'))
    ).toBe('0.75%');
  });

  test('follows each language’s own sign and placement', () => {
    expect(formatFigure({ kind: 'percent_free', text: '5' }, ctx('de'))).toBe(
      `5${nbsp}%`
    );
    expect(formatFigure({ kind: 'percent_free', text: '5' }, ctx('tr'))).toBe(
      '%5'
    );
    expect(
      formatFigure({ kind: 'percent_free', text: '5' }, ctx('fr'))
    ).toMatch(/^5\s%$/);
    expect(
      formatFigure({ kind: 'percent_free', text: '5' }, ctx('ar'))
    ).toMatch(/5|٥/);
  });
});
