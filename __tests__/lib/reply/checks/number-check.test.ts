/**
 * @jest-environment node
 */

import {
  checkNumbers,
  emptyClassCounts,
  failedLiterals,
  flagAll,
  flagUnverified,
} from '@/lib/reply/checks/number-check';
import type { NumberViolation } from '@/lib/reply/checks/number-check';
import {
  notVerifiedMark,
  WORDING_LANGUAGES,
} from '@/lib/reply/checks/wording-lists';
import { report1Texts } from '@/lib/reply/contracts/report1';
import { NUMBER_CLASSES } from '@/lib/reply/contracts/trace-fields';

import { STORED_REPORTS } from '../helpers/fixtures';
import { CORPUS_LOCALES, CORPUS } from './helpers/corpus';
import {
  NBSP,
  NOTATIONS,
  SCRIPTS,
  THIN_NBSP,
  dictOf,
  fixtureFor,
  withDigits,
} from './helpers/checks-fixtures';

const text = (value: string, path = 'headline') => [{ path, text: value }];

describe('a planted wrong price', () => {
  it.each(NOTATIONS.map((n) => [n.name, n.text] as const))(
    'is caught in %s: %s',
    async (_name, written) => {
      const { dictionary } = await fixtureFor('01');
      const result = checkNumbers(
        text(`Support near ${written}, not the usual level`),
        dictionary,
        'en-US'
      );
      expect(result.extracted).toBe(1);
      expect(result.matched).toBe(0);
      expect(result.violations).toHaveLength(1);
      expect(result.violations[0]).toMatchObject({
        raw: written,
        class: 'PRICE',
        syntax: 'BARE',
      });
      expect(result.needsRegeneration).toBe(true);
      expect(result.classes.PRICE).toBe(1);
    }
  );

  it.each(
    SCRIPTS.flatMap((script) =>
      NOTATIONS.map((n) => [script.name, n.name, script.zero, n.text] as const)
    )
  )('is caught in %s digits, %s', async (_script, _notation, zero, written) => {
    const { dictionary } = await fixtureFor('01');
    const shown = withDigits(written, zero);
    const result = checkNumbers(
      text(`Support near ${shown} now`),
      dictionary,
      'ar'
    );
    expect(result.violations).toHaveLength(1);
    expect(result.violations[0]?.raw).toBe(shown);
    expect(result.violations[0]?.class).toBe('PRICE');
  });

  it('is caught with the example of architecture 5.8: 4350.72 against 4350.22', () => {
    const dictionary = dictOf([{ id: 'MCD2.LOEDT', value: 4350.22 }]);
    const wrong = checkNumbers(
      text('support near 4350.72'),
      dictionary,
      'en-US'
    );
    expect(wrong.violations.map((v) => v.raw)).toEqual(['4350.72']);
    const right = checkNumbers(
      text('support near 4350.22'),
      dictionary,
      'en-US'
    );
    expect(right.violations).toEqual([]);
  });

  it('is told apart from the same price when it is right, in the same sentence', async () => {
    const { dictionary } = await fixtureFor('01');
    const result = checkNumbers(
      text('Support near 4350.16 and then 4350.72, with a stop 16.78 away'),
      dictionary,
      'en-US'
    );
    expect(result.extracted).toBe(3);
    expect(result.matched).toBe(2);
    expect(result.matchRate).toBeCloseTo(2 / 3, 10);
    expect(failedLiterals(result)).toEqual(['4350.72']);
  });
});

describe('the same facts in every locale', () => {
  const sentences: Record<string, string> = {
    'en-US': 'Support at {P} and a stop distance of ${D} at 20:55 UTC',
    'en-GB': 'Support at {P} and a stop distance of ${D} at 20:55 UTC',
    es: 'Soporte en {P} y una distancia de stop de {D} $ a las 20:55 UTC',
    de: 'Unterstützung bei {P} und ein Stopp-Abstand von {D} $ um 20:55 UTC',
    pt: 'Suporte em {P} e distância de stop de US$ {D} às 20:55 UTC',
    'pt-BR': 'Suporte em {P} e distância de stop de US$ {D} às 20:55 UTC',
    it: 'Supporto a {P} e distanza di stop di {D} $ alle 20:55 UTC',
    ja: '{P}付近で支持、ストップ幅は{D}ドル、時刻は20:55UTC',
    ar: 'الدعم عند {P} ومسافة الوقف {D} دولار عند 20:55 بتوقيت UTC',
    fr: 'Support à {P} et une distance de stop de {D} $ à 20:55 UTC',
    ko: '지지선 {P}, 스톱 거리 {D}달러, 20:55 UTC',
    zh: '支撑位在{P}，止损距离{D}美元，时间20:55 UTC',
    'zh-TW': '支撐位在{P}，停損距離{D}美元，時間20:55 UTC',
    ur: 'سپورٹ {P} پر اور اسٹاپ فاصلہ {D} ڈالر، وقت 20:55 UTC',
    hi: 'समर्थन {P} पर और स्टॉप दूरी {D} डॉलर, समय 20:55 UTC',
    vi: 'Hỗ trợ tại {P} và khoảng cách dừng {D} đô la lúc 20:55 UTC',
    id: 'Dukungan di {P} dan jarak stop {D} dolar pada 20:55 UTC',
    th: 'แนวรับที่ {P} ระยะหยุด {D} ดอลลาร์ เวลา 20:55 UTC',
    tr: 'Destek {P} ve stop mesafesi {D} dolar, saat 20:55 UTC',
  };

  /** The notation and the digits each locale writes numbers in. */
  const writing: Record<
    string,
    { price: (n: string) => string; zero: number }
  > = {
    'en-US': { price: () => '4,350.16', zero: 0x30 },
    'en-GB': { price: () => '4,350.16', zero: 0x30 },
    es: { price: () => '4.350,16', zero: 0x30 },
    de: { price: () => '4.350,16', zero: 0x30 },
    pt: { price: () => '4.350,16', zero: 0x30 },
    'pt-BR': { price: () => '4.350,16', zero: 0x30 },
    it: { price: () => '4.350,16', zero: 0x30 },
    ja: { price: () => '4350.16', zero: 0xff10 },
    ar: { price: () => '4٬350٫16', zero: 0x0660 },
    fr: { price: () => `4${THIN_NBSP}350,16`, zero: 0x30 },
    ko: { price: () => '4,350.16', zero: 0x30 },
    zh: { price: () => '4350.16', zero: 0x30 },
    'zh-TW': { price: () => '4350.16', zero: 0x30 },
    ur: { price: () => '4350٫16', zero: 0x06f0 },
    hi: { price: () => '4,350.16', zero: 0x0966 },
    vi: { price: () => '4.350,16', zero: 0x30 },
    id: { price: () => '4.350,16', zero: 0x30 },
    th: { price: () => '4,350.16', zero: 0x0e50 },
    tr: { price: () => '4.350,16', zero: 0x30 },
  };

  const make = (locale: string, price: string, distance: string): string => {
    const style = writing[locale];
    const sentence = sentences[locale];
    if (style === undefined || sentence === undefined) throw new Error(locale);
    const decimal = style.zero === 0x0660 || style.zero === 0x06f0 ? '٫' : null;
    const shown = (n: string): string =>
      withDigits(n, style.zero).replace(/[.]/g, (m) => decimal ?? m);
    const dist = [
      'es',
      'de',
      'pt',
      'pt-BR',
      'it',
      'fr',
      'vi',
      'id',
      'tr',
    ].includes(locale)
      ? distance.replace('.', ',')
      : distance;
    return sentence
      .replace('{P}', style.zero === 0x30 ? price : shown(price))
      .replace('{D}', style.zero === 0x30 ? dist : shown(dist));
  };

  it('has a sentence for each of the 19 locales', () => {
    expect(Object.keys(sentences)).toHaveLength(19);
    expect(CORPUS_LOCALES.map((l) => l.locale).sort()).toEqual(
      Object.keys(sentences).sort()
    );
  });

  it.each(Object.keys(sentences))(
    '%s: the true numbers pass',
    async (locale) => {
      const { dictionary } = await fixtureFor('01');
      const style = writing[locale];
      const price = style === undefined ? '' : style.price('4350.16');
      const result = checkNumbers(
        text(make(locale, price, '16.78')),
        dictionary,
        locale
      );
      expect({
        locale,
        violations: result.violations.map((v) => v.raw),
      }).toEqual({
        locale,
        violations: [],
      });
      expect(result.extracted).toBe(3);
      expect(result.matched).toBe(3);
      expect(result.matchRate).toBe(1);
    }
  );

  it.each(Object.keys(sentences))(
    '%s: a wrong price in the same sentence is the one flagged',
    async (locale) => {
      const { dictionary } = await fixtureFor('01');
      const style = writing[locale];
      const price = style === undefined ? '' : style.price('4350.72');
      const wrongPrice = price.replace('16', '72');
      const result = checkNumbers(
        text(make(locale, wrongPrice, '16.78')),
        dictionary,
        locale
      );
      expect({
        locale,
        violations: result.violations.map((v) => v.class),
      }).toEqual({
        locale,
        violations: ['PRICE'],
      });
      expect(result.matched).toBe(2);
    }
  );
});

describe('what is not judged (decision D13)', () => {
  it('lets a reply with small counts, ordinals, identifiers and a placeholder through', async () => {
    const { dictionary } = await fixtureFor('01');
    const result = checkNumbers(
      [
        ...text(
          'M5 holds {MCD2.baseline} for the 3rd bar, and Z1 has 2 sensors behind it'
        ),
        ...text(
          'R1_MACRO_COUNTER_TREND_RALLY on MCD2_UP_IN_CORRIDOR at sr_1 (n=42)',
          'watch[0].text'
        ),
      ],
      dictionary,
      'en-US'
    );
    expect(result.extracted).toBe(0);
    expect(result.exempt).toBe(2);
    expect(result.violations).toEqual([]);
    expect(result.matchRate).toBe(1);
    expect(result.needsRegeneration).toBe(false);
  });

  it('judges a small number that is a percentage, an amount or a multiple', () => {
    const dictionary = dictOf([{ id: 'MCD2.LOEDT', value: 4350.22 }]);
    const result = checkNumbers(
      text('There is a 82% chance, a $5 stop and a 7x move'),
      dictionary,
      'en-US'
    );
    expect(result.violations.map((v) => [v.raw, v.class])).toEqual([
      ['82', 'PCT'],
      ['5', 'DISTANCE'],
      ['7', 'RATIO'],
    ]);
  });

  it('judges the percentage a language writes with a word', async () => {
    const { dictionary } = await fixtureFor('01');
    expect(
      checkNumbers(
        text('mit 82 Prozent Wahrscheinlichkeit'),
        dictionary,
        'de'
      ).violations.map((v) => v.class)
    ).toEqual(['PCT']);
    expect(
      checkNumbers(
        text('yüzde 82 olasılıkla'),
        dictionary,
        'tr'
      ).violations.map((v) => v.class)
    ).toEqual(['PCT']);
    expect(
      checkNumbers(text('概率为百分之82'), dictionary, 'zh').violations.map(
        (v) => v.class
      )
    ).toEqual(['PCT']);
    expect(
      checkNumbers(
        text('mit 82 Prozent Wahrscheinlichkeit'),
        dictionary,
        'en-US'
      ).violations
    ).toEqual([]);
  });

  it('judges a number of three digits, which is no longer a count', async () => {
    const { dictionary } = await fixtureFor('01');
    const result = checkNumbers(text('about 150 pips'), dictionary, 'en-US');
    expect(result.violations.map((v) => [v.raw, v.class])).toEqual([
      ['150', 'COUNT'],
    ]);
  });

  it('does not judge the date of a timestamp but judges its time', async () => {
    const { dictionary } = await fixtureFor('01');
    const good = checkNumbers(
      text('data as of 2026-09-18T20:55:00Z'),
      dictionary,
      'en-US'
    );
    expect(good.violations).toEqual([]);
    expect(good.extracted).toBe(1);
    const bad = checkNumbers(
      text('data as of 2026-09-18T19:12:00Z'),
      dictionary,
      'en-US'
    );
    expect(bad.violations.map((v) => [v.raw, v.class])).toEqual([
      ['19:12:00', 'TIME'],
    ]);
  });

  it('judges the percentage that equals the profile, and the one that does not', async () => {
    const { dictionary } = await fixtureFor('01');
    expect(
      checkNumbers(text('risk of 1.5%'), dictionary, 'en-US').violations
    ).toEqual([]);
    expect(
      checkNumbers(text('risk of 1.6%'), dictionary, 'en-US').violations
    ).toHaveLength(1);
  });
});

describe('the result', () => {
  it('counts every violation by its class, and the classes add up', async () => {
    const { dictionary } = await fixtureFor('01');
    const result = checkNumbers(
      text(
        'Price 4350.72 and 99.99 away, 82% likely, 1:7.5, at 03:17, about 777 bars'
      ),
      dictionary,
      'en-US'
    );
    expect(Object.keys(result.classes).sort()).toEqual(
      [...NUMBER_CLASSES].sort()
    );
    expect(Object.values(result.classes).reduce((a, b) => a + b, 0)).toBe(
      result.violations.length
    );
    expect(result.classes).toEqual({
      PRICE: 1,
      DISTANCE: 1,
      PCT: 1,
      RATIO: 1,
      TIME: 1,
      COUNT: 1,
    });
    expect(result.extracted).toBe(result.matched + result.violations.length);
  });

  it('keeps the path and the span of each violation', async () => {
    const { dictionary } = await fixtureFor('01');
    const texts = [
      { path: 'headline', text: 'fine' },
      { path: 'rationale[1].text', text: 'near 4350.72 now' },
    ];
    const result = checkNumbers(texts, dictionary, 'en-US');
    expect(result.violations[0]).toMatchObject({
      path: 'rationale[1].text',
      start: 5,
      end: 12,
      raw: '4350.72',
    });
  });

  it('names a failed literal once, as the model wrote it', async () => {
    const { dictionary } = await fixtureFor('01');
    const result = checkNumbers(
      text('4350.72 then 4350.72 and 4351.99'),
      dictionary,
      'en-US'
    );
    expect(result.violations).toHaveLength(3);
    expect(failedLiterals(result)).toEqual(['4350.72', '4351.99']);
  });

  it('gives the same answer twice', async () => {
    const { dictionary } = await fixtureFor('01');
    const input = text('Support 4350.72, risk 82%, stop 16.78');
    expect(checkNumbers(input, dictionary, 'en-US')).toEqual(
      checkNumbers(input, dictionary, 'en-US')
    );
  });

  it('is clean for a reply with no number at all', async () => {
    const { dictionary } = await fixtureFor('01');
    const result = checkNumbers(
      text('No numbers here at all'),
      dictionary,
      'en-US'
    );
    expect(result).toMatchObject({
      extracted: 0,
      exempt: 0,
      matched: 0,
      matchRate: 1,
      needsRegeneration: false,
    });
    expect(result.classes).toEqual(emptyClassCounts());
  });

  it('takes the three stored reports of the fixture set with nothing to flag', async () => {
    for (const [prefix, report] of STORED_REPORTS) {
      const { dictionary } = await fixtureFor(prefix);
      const result = checkNumbers(report1Texts(report), dictionary, 'en-US');
      expect({ prefix, violations: result.violations }).toEqual({
        prefix,
        violations: [],
      });
    }
  });
});

describe('flagging', () => {
  const violation = (
    raw: string,
    source: string,
    syntax: NumberViolation['syntax'] = 'BARE'
  ): NumberViolation => {
    const start = source.indexOf(raw);
    return {
      path: 'p',
      raw,
      start,
      end: start + raw.length,
      syntax,
      class: 'PRICE',
      readings: [],
    };
  };

  it('replaces a literal by the mark, in place', () => {
    const source = 'Support near 4350.72 today';
    expect(
      flagUnverified(source, [violation('4350.72', source)], '—, not verified')
    ).toBe('Support near —, not verified today');
  });

  it('replaces several, from the end, so every span stays true', () => {
    const source = 'from 4350.72 to 4399.5 and 4401.1';
    const all = ['4350.72', '4399.5', '4401.1'].map((raw) =>
      violation(raw, source)
    );
    expect(flagUnverified(source, all, 'X')).toBe('from X to X and X');
    expect(flagUnverified(source, [...all].reverse(), 'X')).toBe(
      'from X to X and X'
    );
  });

  it('takes the dollar sign that belongs to the number, and the percent sign', () => {
    const money = 'a stop $0.50 away';
    expect(
      flagUnverified(money, [violation('0.50', money, 'MONEY')], 'X')
    ).toBe('a stop X away');
    const spaced = 'a stop $ 0.50 away';
    expect(
      flagUnverified(spaced, [violation('0.50', spaced, 'MONEY')], 'X')
    ).toBe('a stop X away');
    const percent = 'a 82% chance';
    expect(
      flagUnverified(percent, [violation('82', percent, 'PERCENT')], 'X')
    ).toBe('a X chance');
    const spacedPercent = 'a 82 % chance';
    expect(
      flagUnverified(
        spacedPercent,
        [violation('82', spacedPercent, 'PERCENT')],
        'X'
      )
    ).toBe('a X chance');
    const arabic = 'احتمال ٨٢٪ فقط';
    expect(
      flagUnverified(arabic, [violation('٨٢', arabic, 'PERCENT')], 'X')
    ).toBe('احتمال X فقط');
  });

  it('leaves a text with no violation as it is', () => {
    expect(flagUnverified('nothing here', [], 'X')).toBe('nothing here');
  });

  it('does not replace twice a span that overlaps the one after it', () => {
    const source = '$ 5 %';
    const a = violation('5', source, 'MONEY');
    const b = violation('5', source, 'PERCENT');
    expect(flagUnverified(source, [a, b], 'X')).toBe('X');
  });

  it('flags the texts by path with the mark of the language of the reply', async () => {
    const { dictionary } = await fixtureFor('01');
    const texts = [
      { path: 'headline', text: 'Preis 4.350,72 und ein Abstand' },
      { path: 'rationale[0].text', text: 'Ohne Zahl' },
    ];
    const result = checkNumbers(texts, dictionary, 'de');
    const flagged = flagAll(texts, result.violations, 'de');
    expect(flagged[0]?.text).toBe(
      `Preis ${notVerifiedMark('de')} und ein Abstand`
    );
    expect(flagged[1]).toBe(texts[1]);
    expect(notVerifiedMark('de')).toBe('—, nicht verifiziert');
  });

  it('writes the mark in the language of each of the 19 locales and in no other', async () => {
    const { dictionary } = await fixtureFor('01');
    const seen = new Set<string>();
    for (const { locale, language } of CORPUS_LOCALES) {
      const texts = [{ path: 'headline', text: 'level 4350.72 here' }];
      const flagged = flagAll(
        texts,
        checkNumbers(texts, dictionary, locale).violations,
        locale
      );
      expect(flagged[0]?.text).toContain(notVerifiedMark(locale));
      expect(flagged[0]?.text).not.toContain('4350.72');
      seen.add(notVerifiedMark(locale));
      expect(CORPUS[language]).toBeDefined();
    }
    expect(seen.size).toBe(WORDING_LANGUAGES.length);
  });

  it('does not let a no-break space in the text move a span', () => {
    const source = `a${NBSP}stop at 4350.72${NBSP}now`;
    const start = source.indexOf('4350.72');
    expect(
      flagUnverified(
        source,
        [{ ...violation('4350.72', source), start, end: start + 7 }],
        'X'
      )
    ).toBe(`a${NBSP}stop at X${NBSP}now`);
  });
});

describe('flagging, edge by edge', () => {
  const v = (
    start: number,
    end: number,
    raw: string,
    syntax: NumberViolation['syntax'] = 'BARE'
  ): NumberViolation => ({
    path: 'p',
    raw,
    start,
    end,
    syntax,
    class: 'PRICE',
    readings: [],
  });
  const at = (code: number): string => String.fromCodePoint(code);

  it('replaces two spans that touch', () => {
    expect(
      flagUnverified('abcdef', [v(0, 3, 'abc'), v(3, 6, 'def')], 'X')
    ).toBe('XX');
    expect(
      flagUnverified('abcdef', [v(3, 6, 'def'), v(0, 3, 'abc')], 'X')
    ).toBe('XX');
  });

  it('skips only the span that would reach into the one after it', () => {
    expect(
      flagUnverified('abcdef', [v(0, 4, 'abcd'), v(3, 6, 'def')], 'X')
    ).toBe('abcX');
  });

  it('takes the dollar sign of every script and the percent sign of every script', () => {
    for (const sign of ['$', at(0xff04), at(0xfe69)]) {
      const source = 'stop ' + sign + '5 away';
      const start = source.indexOf('5');
      expect(
        flagUnverified(source, [v(start, start + 1, '5', 'MONEY')], 'X')
      ).toBe('stop X away');
      const spaced = 'stop ' + sign + ' 5 away';
      const s2 = spaced.indexOf('5');
      expect(flagUnverified(spaced, [v(s2, s2 + 1, '5', 'MONEY')], 'X')).toBe(
        'stop X away'
      );
    }
    for (const sign of ['%', at(0x066a), at(0xff05), at(0xfe6a)]) {
      const source = 'about 82' + sign + ' only';
      const start = source.indexOf('82');
      expect(
        flagUnverified(source, [v(start, start + 2, '82', 'PERCENT')], 'X')
      ).toBe('about X only');
      const spaced = 'about 82 ' + sign + ' only';
      expect(
        flagUnverified(spaced, [v(start, start + 2, '82', 'PERCENT')], 'X')
      ).toBe('about X only');
    }
  });

  it('does not take a sign that is not next to the number', () => {
    const source = '$ and 5 and %';
    const start = source.indexOf('5');
    expect(flagUnverified(source, [v(start, start + 1, '5')], 'X')).toBe(
      '$ and X and %'
    );
    const two = 'a $  5';
    expect(flagUnverified(two, [v(5, 6, '5')], 'X')).toBe('a $  X');
  });

  it('returns the texts it was not asked about as they were', async () => {
    const { dictionary } = await fixtureFor('01');
    const texts = [{ path: 'headline', text: 'level 4350.72' }];
    const flagged = flagAll(
      texts,
      checkNumbers(texts, dictionary, 'en-US').violations,
      'en-US'
    );
    expect(flagged[0]?.text).toBe('level —, not verified');
    expect(flagAll(texts, [], 'en-US')[0]).toBe(texts[0]);
    const other = {
      ...checkNumbers(texts, dictionary, 'en-US').violations[0],
      path: 'elsewhere',
    } as NumberViolation;
    expect(flagAll(texts, [other], 'en-US')[0]).toBe(texts[0]);
  });
});
