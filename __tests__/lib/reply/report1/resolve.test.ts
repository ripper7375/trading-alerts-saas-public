/**
 * @jest-environment node
 */

/**
 * The placeholder resolver (build step 7 part 5; architecture 5.7). An unknown id fails; a figure
 * is written for the locale in ASCII digits; ids, level names and state codes are never touched.
 */

import { checkNumbers } from '@/lib/reply/checks/number-check';
import { addressableIds } from '@/lib/reply/checks/value-dictionary';
import { LOCALES } from '@/lib/reply/contracts/intake';
import {
  LRI,
  NUMBER_STYLES,
  PDI,
  formatValue,
  resolveLines,
  resolveText,
  styleOf,
} from '@/lib/reply/report1/resolve';
import type { ResolveOptions } from '@/lib/reply/report1/resolve';

import { dictOf, withDigits } from '../checks/helpers/checks-fixtures';
import { GOLDEN_IDS, worldOf } from './helpers/report1-fixtures';

const NNBSP = String.fromCharCode(0x202f);

/** 4,367.25 as each of the 19 locales writes it. */
const PRICE_IN: Readonly<Record<string, string>> = {
  'en-US': '4,367.25',
  'en-GB': '4,367.25',
  ar: `${LRI}4,367.25${PDI}`,
  de: '4.367,25',
  es: '4.367,25',
  fr: `4${NNBSP}367,25`,
  hi: '4,367.25',
  id: '4.367,25',
  it: '4.367,25',
  ja: '4,367.25',
  ko: '4,367.25',
  pt: '4.367,25',
  'pt-BR': '4.367,25',
  th: '4,367.25',
  tr: '4.367,25',
  ur: `${LRI}4,367.25${PDI}`,
  vi: '4.367,25',
  zh: '4,367.25',
  'zh-TW': '4,367.25',
};

const dictionary = dictOf([
  { id: 'LAST_PRICE', value: 4367.25, kind: 'PRICE', addressable: true },
  { id: 'Z1.invalidation', value: 4350.42, kind: 'PRICE', addressable: true },
  { id: 'Z1.stop_distance', value: 16.78, kind: 'DISTANCE', addressable: true },
  { id: 'PROFILE.max_risk_pct', value: 1.5, kind: 'PCT', addressable: true },
  { id: 'PROFILE.target_rrr', value: 2, kind: 'RATIO', addressable: true },
  {
    id: 'Z1.runway_ratio_shown',
    value: 0.14,
    kind: 'RATIO',
    addressable: true,
  },
  { id: 'PROFILE.count', value: 12, kind: 'COUNT', addressable: true },
  { id: 'BIG.count', value: 1234567, kind: 'COUNT', addressable: true },
  {
    id: 'EVENT1.time',
    value: Date.UTC(2026, 8, 18, 21, 30) / 1000,
    kind: 'TIME',
    addressable: true,
  },
  {
    id: 'EVENT2.time',
    value: Date.UTC(2026, 8, 19, 12, 30) / 1000,
    kind: 'TIME',
    addressable: true,
  },
  { id: 'DIST.Z1.low', value: 3.5, kind: 'DISTANCE', addressable: false },
]);

const REFERENCE = Date.UTC(2026, 8, 18, 20, 55) / 1000;
const en: ResolveOptions = { locale: 'en-US', referenceSeconds: REFERENCE };
const ok = (text: string, options: ResolveOptions = en) => {
  const r = resolveText(text, 'text', dictionary, options);
  if (!r.ok) throw new Error(JSON.stringify(r.failures));
  return r.text;
};

describe('the number styles', () => {
  it('cover exactly the 19 locales', () => {
    expect(Object.keys(NUMBER_STYLES).sort()).toEqual([...LOCALES].sort());
    expect(LOCALES).toHaveLength(19);
  });

  it('write a price in the notation of each locale, in ASCII digits', () => {
    expect(Object.keys(PRICE_IN).sort()).toEqual([...LOCALES].sort());
    for (const locale of LOCALES) {
      expect(ok('{LAST_PRICE}', { locale, referenceSeconds: REFERENCE })).toBe(
        PRICE_IN[locale]
      );
    }
  });

  it('never writes a digit of another script, in any locale and for any kind', () => {
    for (const locale of LOCALES) {
      for (const entry of dictionary.entries.filter((e) => e.addressable)) {
        const text = formatValue(entry, {
          locale,
          referenceSeconds: REFERENCE,
        });
        expect(text).not.toBeNull();
        const nonAscii = [...(text as string)].filter(
          (c) => /\p{Nd}/u.test(c) && !/[0-9]/.test(c)
        );
        expect(nonAscii).toEqual([]);
      }
    }
  });

  it('keeps the figure left to right inside right-to-left text: Arabic and Urdu isolate it, no other locale does', () => {
    for (const locale of LOCALES) {
      const text = ok('{LAST_PRICE}', { locale, referenceSeconds: REFERENCE });
      const rtl = locale === 'ar' || locale === 'ur';
      expect(text.startsWith(LRI) && text.endsWith(PDI)).toBe(rtl);
      expect(LRI).toBe(String.fromCharCode(0x2066));
      expect(PDI).toBe(String.fromCharCode(0x2069));
    }
    // the sentence around the figure is untouched
    expect(
      ok('بالقرب من {LAST_PRICE} الآن', {
        locale: 'ar',
        referenceSeconds: null,
      })
    ).toBe(`بالقرب من ${LRI}4,367.25${PDI} الآن`);
  });

  it('formats a locale it does not know like English', () => {
    expect(styleOf('xx')).toEqual(NUMBER_STYLES['en-US']);
    expect(ok('{LAST_PRICE}', { locale: 'xx', referenceSeconds: null })).toBe(
      '4,367.25'
    );
  });
});

describe('what each kind looks like', () => {
  it('writes a price and a distance with two decimals', () => {
    expect(ok('{LAST_PRICE}')).toBe('4,367.25');
    expect(ok('{Z1.invalidation}')).toBe('4,350.42');
    expect(ok('{Z1.stop_distance}')).toBe('16.78');
    expect(
      ok('{Z1.stop_distance}', { locale: 'de', referenceSeconds: null })
    ).toBe('16,78');
  });

  it('writes a percentage and a ratio with up to two decimals and no trailing zero', () => {
    expect(ok('{PROFILE.max_risk_pct}')).toBe('1.5%');
    expect(
      ok('{PROFILE.max_risk_pct}', { locale: 'fr', referenceSeconds: null })
    ).toBe('1,5%');
    expect(ok('{PROFILE.target_rrr}')).toBe('2');
    expect(ok('{Z1.runway_ratio_shown}')).toBe('0.14');
  });

  it('writes a count as a whole number, grouped when it is large', () => {
    expect(ok('{PROFILE.count}')).toBe('12');
    expect(ok('{BIG.count}')).toBe('1,234,567');
    expect(ok('{BIG.count}', { locale: 'de', referenceSeconds: null })).toBe(
      '1.234.567'
    );
  });

  it("writes a time as hh:mm UTC on the cycle's own day and with its date on any other", () => {
    expect(ok('{EVENT1.time}')).toBe('21:30 UTC');
    expect(ok('{EVENT2.time}')).toBe('2026-09-19 12:30 UTC');
    // with no reference day every time carries its date
    expect(
      ok('{EVENT1.time}', { locale: 'en-US', referenceSeconds: null })
    ).toBe('2026-09-18 21:30 UTC');
    // the day boundary is UTC midnight
    const late = dictOf([
      {
        id: 'EVENT1.time',
        value: Date.UTC(2026, 8, 18, 23, 59) / 1000,
        kind: 'TIME',
        addressable: true,
      },
      {
        id: 'EVENT2.time',
        value: Date.UTC(2026, 8, 19, 0, 0) / 1000,
        kind: 'TIME',
        addressable: true,
      },
    ]);
    const both = resolveText('{EVENT1.time} {EVENT2.time}', 't', late, en);
    expect(both).toEqual({
      ok: true,
      text: '23:59 UTC 2026-09-19 00:00 UTC',
      ids: ['EVENT1.time', 'EVENT2.time'],
    });
  });

  it('writes a time of day with no date (seconds since midnight)', () => {
    const clock = dictOf([
      {
        id: 'CLOCK.t',
        value: 21 * 3600 + 5 * 60,
        kind: 'TIME',
        addressable: true,
      },
    ]);
    const r = resolveText('at {CLOCK.t}', 't', clock, en);
    expect(r).toMatchObject({ ok: true, text: 'at 21:05 UTC' });
  });

  it('writes a negative figure with its sign and a zero as zero', () => {
    const d = dictOf([
      { id: 'A.neg', value: -16.78, kind: 'DISTANCE', addressable: true },
      { id: 'A.zero', value: 0, kind: 'PRICE', addressable: true },
      { id: 'A.negzero', value: -0, kind: 'PRICE', addressable: true },
    ]);
    const r = resolveText('{A.neg} {A.zero} {A.negzero}', 't', d, en);
    expect(r).toMatchObject({ ok: true, text: '-16.78 0.00 0.00' });
  });

  it('rounds to what it shows, to the cent', () => {
    const d = dictOf([
      { id: 'A.up', value: 4350.724, kind: 'PRICE', addressable: true },
      { id: 'A.down', value: 4350.726, kind: 'PRICE', addressable: true },
    ]);
    expect(resolveText('{A.up} {A.down}', 't', d, en)).toMatchObject({
      text: '4,350.72 4,350.73',
    });
  });
});

describe('a placeholder that cannot be filled fails the whole text', () => {
  it('fails on an id the dictionary does not know, naming it and the place', () => {
    const r = resolveText(
      'Support at {MCD9.baseline} holds',
      'rationale[1].text',
      dictionary,
      en
    );
    expect(r).toEqual({
      ok: false,
      failures: [
        {
          code: 'UNKNOWN_ID',
          path: 'rationale[1].text',
          id: 'MCD9.baseline',
          detail: '{MCD9.baseline} is not a value of this cycle',
        },
      ],
    });
  });

  it('fails on an id that exists but was never offered to the model', () => {
    const r = resolveText('{DIST.Z1.low} away', 't', dictionary, en);
    expect(r).toMatchObject({
      ok: false,
      failures: [{ code: 'NOT_OFFERED', id: 'DIST.Z1.low' }],
    });
  });

  it('reports every failure of the text, known ids filled or not', () => {
    const r = resolveText(
      '{LAST_PRICE} {NOPE.a} {DIST.Z1.low} {NOPE.b}',
      't',
      dictionary,
      en
    );
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.failures.map((f) => `${f.code}:${f.id}`)).toEqual([
        'UNKNOWN_ID:NOPE.a',
        'NOT_OFFERED:DIST.Z1.low',
        'UNKNOWN_ID:NOPE.b',
      ]);
    }
  });

  it('emits no blank and no partial text: there is no text on failure', () => {
    const r = resolveText(
      'Price {LAST_PRICE} and {MISSING.id}',
      't',
      dictionary,
      en
    );
    expect(r.ok).toBe(false);
    expect('text' in r).toBe(false);
  });

  it.each([
    ['a stray opening brace', 'near {LAST_PRICE and more'],
    ['a stray closing brace', 'near LAST_PRICE} and more'],
    ['an empty placeholder', 'near {} here'],
    ['a nested one', 'near {{LAST_PRICE}}'],
    ['a lower-case head', 'near {last_price}'],
    ['a space inside', 'near {LAST PRICE}'],
  ])('fails on %s and leaves no brace behind', (_name, text) => {
    const r = resolveText(text, 't', dictionary, en);
    expect(r.ok).toBe(false);
    if (!r.ok)
      expect(r.failures.some((f) => f.code === 'BAD_BRACES')).toBe(true);
  });

  it('fails on a figure it cannot write instead of printing nonsense', () => {
    const d = dictOf([
      { id: 'A.huge', value: 1e300, kind: 'PRICE', addressable: true },
      { id: 'A.nan', value: Number.NaN, kind: 'PRICE', addressable: true },
      {
        id: 'A.inf',
        value: Number.POSITIVE_INFINITY,
        kind: 'COUNT',
        addressable: true,
      },
      { id: 'A.when', value: 1e15, kind: 'TIME', addressable: true },
      { id: 'A.before', value: -5, kind: 'TIME', addressable: true },
    ]);
    for (const id of ['A.huge', 'A.nan', 'A.inf', 'A.when', 'A.before']) {
      const r = resolveText(`{${id}}`, 't', d, en);
      expect(r).toMatchObject({
        ok: false,
        failures: [{ code: 'NOT_FORMATTABLE', id }],
      });
    }
  });
});

describe('what the resolver leaves alone', () => {
  it('keeps level names, sensor ids, zone ids and state codes exactly as written', () => {
    const text =
      'MCD2 reads MCD2_UP_IN_CORRIDOR above the baseline at {MCD2.x}; UOEDT and Z1 stay (R1_MACRO_COUNTER_TREND_RALLY)';
    const d = dictOf([{ id: 'MCD2.x', value: 4367.2, addressable: true }]);
    for (const locale of LOCALES) {
      const r = resolveText(text, 't', d, { locale, referenceSeconds: null });
      expect(r.ok).toBe(true);
      if (r.ok) {
        expect(r.text).toContain(
          'MCD2 reads MCD2_UP_IN_CORRIDOR above the baseline at '
        );
        expect(r.text).toContain(
          '; UOEDT and Z1 stay (R1_MACRO_COUNTER_TREND_RALLY)'
        );
      }
    }
  });

  it('returns a text with no placeholder as it is, and an empty one', () => {
    expect(ok('Nothing to fill here')).toBe('Nothing to fill here');
    expect(ok('')).toBe('');
    expect(resolveText('', 't', dictionary, en)).toEqual({
      ok: true,
      text: '',
      ids: [],
    });
  });

  it('fills a repeated id each time and adjacent ids in order', () => {
    expect(ok('{LAST_PRICE}{LAST_PRICE} and {Z1.invalidation}')).toBe(
      '4,367.254,367.25 and 4,350.42'
    );
    const r = resolveText('{LAST_PRICE} {LAST_PRICE}', 't', dictionary, en);
    expect(r).toMatchObject({ ids: ['LAST_PRICE', 'LAST_PRICE'] });
  });

  it('does not read a replacement pattern into the text around a figure', () => {
    expect(ok("cost $& $1 $$ $` $' {LAST_PRICE}")).toBe(
      "cost $& $1 $$ $` $' 4,367.25"
    );
  });

  it('does not change the dictionary or the text it was given', () => {
    const text = 'near {LAST_PRICE}';
    const before = JSON.stringify([...dictionary.byId]);
    ok(text);
    expect(text).toBe('near {LAST_PRICE}');
    expect(JSON.stringify([...dictionary.byId])).toBe(before);
  });
});

describe('lines', () => {
  it('fills a list of lines and keeps their cites', () => {
    const r = resolveLines(
      [
        { text: 'Near {LAST_PRICE}', cites: ['MCD2'] },
        { text: 'No figure', cites: [] },
      ],
      'watch',
      dictionary,
      en
    );
    expect(r).toEqual({
      ok: true,
      lines: [
        { text: 'Near 4,367.25', cites: ['MCD2'] },
        { text: 'No figure', cites: [] },
      ],
    });
  });

  it('reports every failure of every line, with the place of each', () => {
    const r = resolveLines(
      [
        { text: '{GONE.a}', cites: [] },
        { text: 'fine {LAST_PRICE}', cites: [] },
        { text: '{GONE.b} {DIST.Z1.low}', cites: [] },
      ],
      'risks',
      dictionary,
      en
    );
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.failures.map((f) => `${f.path}|${f.code}|${f.id}`)).toEqual([
        'risks[0].text|UNKNOWN_ID|GONE.a',
        'risks[2].text|UNKNOWN_ID|GONE.b',
        'risks[2].text|NOT_OFFERED|DIST.Z1.low',
      ]);
    }
  });

  it('copies the cites rather than sharing them', () => {
    const cites = ['MCD1'];
    const r = resolveLines([{ text: 'x', cites }], 'watch', dictionary, en);
    if (r.ok) {
      r.lines[0]?.cites.push('MCD2');
      expect(cites).toEqual(['MCD1']);
    }
  });
});

describe('what the number check reads back', () => {
  it('finds every resolved figure of the 16 golden cycles in every one of the 19 locales and judges none wrong', async () => {
    let figures = 0;
    for (const id of GOLDEN_IDS) {
      const { dictionary: world } = await worldOf(id.slice(0, 2));
      const ids = addressableIds(world);
      for (const locale of LOCALES) {
        const options = {
          locale,
          referenceSeconds: Date.UTC(2026, 8, 18, 20, 55) / 1000,
        };
        for (const valueId of ids) {
          const entry = world.byId.get(valueId);
          // the check judges a figure that is not an exempt small count: a count of 12 is exempt by design (D13)
          const text = resolveText(
            `See {${valueId}} here`,
            'text',
            world,
            options
          );
          expect(text.ok).toBe(true);
          if (!text.ok || entry === undefined) continue;
          const verdict = checkNumbers(
            [{ path: 'text', text: text.text }],
            world,
            locale
          );
          expect({
            locale,
            valueId,
            violations: verdict.violations.map((v) => v.raw),
          }).toEqual({
            locale,
            valueId,
            violations: [],
          });
          figures += verdict.extracted;
        }
      }
    }
    expect(figures).toBeGreaterThan(1000);
  });

  it('reads the same figure back in the digits of another script as the same value', () => {
    const asArabic = withDigits('4,367.25', 0x0660);
    const verdict = checkNumbers(
      [{ path: 't', text: `near ${asArabic}` }],
      dictionary,
      'ar'
    );
    expect(verdict.violations).toEqual([]);
  });
});

describe('the edges of a figure', () => {
  const one = (
    kind: 'PRICE' | 'DISTANCE' | 'PCT' | 'RATIO' | 'COUNT' | 'TIME',
    value: number
  ) => {
    const d = dictOf([{ id: 'E.v', value, kind, addressable: true }]);
    return resolveText('{E.v}', 't', d, {
      locale: 'en-US',
      referenceSeconds: null,
    });
  };
  const text = (
    kind: Parameters<typeof one>[0],
    value: number
  ): string | null => {
    const r = one(kind, value);
    return r.ok ? r.text : null;
  };

  it('writes the largest figure it can and refuses the first one past it', () => {
    expect(text('PRICE', 999999999999999)).toBe('999,999,999,999,999.00');
    expect(text('PRICE', 1e15)).toBeNull();
    expect(text('PRICE', -999999999999999)).toBe('-999,999,999,999,999.00');
    expect(text('PRICE', -1e15)).toBeNull();
    expect(one('PRICE', 1e15)).toMatchObject({
      ok: false,
      failures: [{ code: 'NOT_FORMATTABLE' }],
    });
  });

  it('writes a percentage with two decimals at most, rounded, and no trailing zero', () => {
    expect(text('PCT', 82.456)).toBe('82.46%');
    expect(text('PCT', 82.4)).toBe('82.4%');
    expect(text('PCT', 82.404)).toBe('82.4%');
    expect(text('PCT', 100)).toBe('100%');
    expect(text('PCT', 0.5)).toBe('0.5%');
    expect(text('PCT', 0)).toBe('0%');
  });

  it('writes a ratio with two decimals at most, rounded, and no trailing zero', () => {
    expect(text('RATIO', 1.4567)).toBe('1.46');
    expect(text('RATIO', 1.5)).toBe('1.5');
    expect(text('RATIO', 1.004)).toBe('1');
    expect(text('RATIO', 10)).toBe('10');
    expect(text('RATIO', 1000.5)).toBe('1,000.5');
  });

  it('writes a count as a whole number, grouped from a thousand', () => {
    expect(text('COUNT', 999)).toBe('999');
    expect(text('COUNT', 1000)).toBe('1,000');
    expect(text('COUNT', 12.4)).toBe('12');
    expect(text('COUNT', 12.6)).toBe('13');
    expect(text('COUNT', 0)).toBe('0');
    expect(text('COUNT', -3)).toBe('-3');
    expect(text('COUNT', -0.4)).toBe('0');
  });

  it('writes the cent that a price rounds to, and a minus only when something is left', () => {
    expect(text('PRICE', -0.001)).toBe('0.00');
    expect(text('PRICE', -0.005)).toBe('-0.01');
    expect(text('DISTANCE', 0.004)).toBe('0.00');
    expect(text('DISTANCE', 1234.5)).toBe('1,234.50');
    expect(text('PCT', -0.001)).toBe('0%');
  });

  it('tells a time of day from the first instant of the second day', () => {
    expect(text('TIME', 86399)).toBe('23:59 UTC'); // seconds since midnight
    expect(text('TIME', 86400)).toBe('1970-01-02 00:00 UTC'); // an instant: 2 Jan 1970
    expect(text('TIME', 0)).toBe('00:00 UTC');
    expect(text('TIME', 60.4)).toBe('00:01 UTC'); // rounded to the second
  });

  it('refuses a time past the last year four digits can name', () => {
    expect(text('TIME', 253402300799)).toBe('9999-12-31 23:59 UTC');
    expect(text('TIME', 253402300800)).toBeNull();
    expect(text('TIME', -1)).toBeNull();
  });
});
