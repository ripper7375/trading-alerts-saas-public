/**
 * @jest-environment node
 */

import { readFileSync } from 'fs';
import { join } from 'path';

import {
  FORM_STATUSES,
  GLOSSARY,
  LOCALES,
  createSpotter,
  foldCase,
  familyOfLocale,
  glossaryHints,
  matchKey,
  normalizeQuestion,
  parseGlossary,
  spotTerms,
  termById,
  type Glossary,
  type GlossaryHit,
  type Issue,
} from '@/lib/intake';

const FILE = join(
  __dirname,
  '..',
  '..',
  '..',
  '..',
  'config',
  'intake',
  'glossary.v1.json'
);
const raw = (): any => JSON.parse(readFileSync(FILE, 'utf8'));

const issuesOf = (value: unknown): Issue[] => {
  const result = parseGlossary(value);
  if (result.ok) throw new Error('the glossary was accepted');
  return result.issues;
};
const summary = (value: unknown): string[] =>
  issuesOf(value).map((issue) => `${issue.path} ${issue.code}`);

/** A glossary of the given terms, each `id: [english, { locale: [canonical, ...variants] }]`. */
function mini(
  terms: Record<string, [string, Record<string, string[]>]>
): Glossary {
  const glossary = {
    schema: 'glossary/1',
    version: '0.0.1-test',
    terms: Object.entries(terms).map(([id, [en, forms]]) => ({
      id,
      en,
      en_variants: [],
      definition: `The test term ${id}.`,
      owners: ['SYN'],
      never_translate: false,
      forms: Object.fromEntries(
        Object.entries({
          // a term needs an en-US form; one that no test text contains, unless the test gives its own
          'en-US': [`placeholder ${id}`],
          ...forms,
        }).map(([locale, [canonical, ...variants]]) => [
          locale,
          { canonical, variants, status: 'draft' },
        ])
      ),
    })),
  };
  const parsed = parseGlossary(glossary);
  if (!parsed.ok) throw new Error(JSON.stringify(parsed.issues));
  return parsed.glossary;
}

const spotIn = (glossary: Glossary, text: string): [string, string][] =>
  createSpotter(glossary)
    .spot(normalizeQuestion(text).text)
    .map((hit) => [hit.terms.map((t) => t.id).join('+'), hit.matched]);

// ---------------------------------------------------------------------------------------
// The committed file
// ---------------------------------------------------------------------------------------

describe('the committed glossary', () => {
  it('is a valid glossary/1 file, equal to the one the module loaded', () => {
    const parsed = parseGlossary(raw());
    expect(parsed.ok).toBe(true);
    expect(GLOSSARY).toEqual(raw());
  });

  it('uses the same words as Report 2 for stop loss and entry', () => {
    // the Report 2 dictionary rows `report2.stop.heading` and `report2.entry.heading`
    const dictionaries = (locale: string): Record<string, string> =>
      JSON.parse(
        readFileSync(
          join(
            __dirname,
            '..',
            '..',
            '..',
            '..',
            'lib',
            'i18n',
            'dictionaries',
            `${locale}.json`
          ),
          'utf8'
        )
      ) as Record<string, string>;
    const stop = termById(GLOSSARY, 'stop_loss');
    const entry = termById(GLOSSARY, 'entry');
    for (const locale of Object.keys(stop?.forms ?? {})) {
      const dictionary = dictionaries(locale);
      expect(stop?.forms[locale]?.canonical.toLowerCase()).toBe(
        (dictionary['report2.stop.heading'] as string).toLowerCase()
      );
      expect(entry?.forms[locale]?.canonical.toLowerCase()).toBe(
        (dictionary['report2.entry.heading'] as string).toLowerCase()
      );
    }
  });

  it('has the status values the contract allows', () => {
    expect([...FORM_STATUSES]).toEqual(['draft', 'approved']);
  });

  it('names its owners as sensors or domains the roster and the corpus have', () => {
    for (const term of GLOSSARY.terms) {
      for (const owner of term.owners) {
        expect(owner).toMatch(/^(MCD[0-3]|SYN|D[1-5])$/);
      }
    }
  });
});

// ---------------------------------------------------------------------------------------
// The validator
// ---------------------------------------------------------------------------------------

describe('parseGlossary', () => {
  const break_ = (change: (glossary: any) => void): unknown => {
    const glossary = raw();
    change(glossary);
    return glossary;
  };

  it('accepts the committed file and returns it', () => {
    const parsed = parseGlossary(raw());
    expect(parsed.ok && parsed.glossary.terms).toEqual(GLOSSARY.terms);
  });

  it.each([
    ['not an object', 'glossary', ['', 'WRONG_TYPE']],
    ['null', null, ['', 'WRONG_TYPE']],
    ['a list', [], ['', 'WRONG_TYPE']],
  ])('refuses %s', (_name, value, [path, code]) => {
    expect(summary(value)).toEqual([`${path} ${code}`]);
  });

  it.each(['schema', 'version', 'terms'])(
    'refuses a glossary without %s',
    (key) => {
      expect(summary(break_((g) => delete g[key]))).toContain(
        `${key} REQUIRED`
      );
    }
  );

  it('refuses an extra key, a wrong schema id, a bad version and no terms', () => {
    expect(summary(break_((g) => (g.extra = 1)))).toEqual([
      'extra UNKNOWN_KEY',
    ]);
    expect(summary(break_((g) => (g.schema = 'glossary/2')))).toEqual([
      'schema NOT_ONE_OF',
    ]);
    expect(summary(break_((g) => (g.version = '')))).toEqual([
      'version TOO_SHORT',
    ]);
    expect(summary(break_((g) => (g.version = ' 1')))).toEqual([
      'version BAD_FORMAT',
    ]);
    expect(summary(break_((g) => (g.terms = [])))).toEqual(['terms TOO_SHORT']);
    expect(summary(break_((g) => (g.terms = {})))).toEqual([
      'terms WRONG_TYPE',
    ]);
  });

  it.each([
    'id',
    'en',
    'en_variants',
    'definition',
    'owners',
    'never_translate',
    'forms',
  ])('refuses a term without %s', (key) => {
    expect(summary(break_((g) => delete g.terms[2][key]))).toContain(
      `terms[2].${key} REQUIRED`
    );
  });

  it('refuses an extra key in a term and in a form', () => {
    expect(summary(break_((g) => (g.terms[0].note = 'x')))).toEqual([
      'terms[0].note UNKNOWN_KEY',
    ]);
    expect(summary(break_((g) => (g.terms[0].forms.es.note = 'x')))).toEqual([
      'terms[0].forms.es.note UNKNOWN_KEY',
    ]);
    expect(summary(break_((g) => delete g.terms[0].forms.es.status))).toEqual([
      'terms[0].forms.es.status REQUIRED',
    ]);
  });

  it('refuses a bad term id and a repeated one', () => {
    for (const id of ['Buy', '1buy', 'buy-it', '', 'a'.repeat(41)]) {
      expect(
        summary(break_((g) => (g.terms[0].id = id))).length
      ).toBeGreaterThan(0);
    }
    expect(summary(break_((g) => (g.terms[1].id = 'buy')))).toEqual([
      'terms[1].id DUPLICATE',
    ]);
    expect(
      parseGlossary(break_((g) => (g.terms[0].id = 'a'.repeat(40)))).ok
    ).toBe(true);
  });

  it('refuses an English form that two terms share, whatever its case or spelling', () => {
    expect(summary(break_((g) => (g.terms[1].en = 'BUY')))).toEqual([
      'terms[1].en DUPLICATE',
    ]);
    expect(summary(break_((g) => (g.terms[1].en = 'ｂｕｙ')))).toEqual([
      'terms[1].en DUPLICATE',
    ]);
  });

  it('refuses a bad definition, bad English wordings and bad owners', () => {
    expect(summary(break_((g) => (g.terms[0].definition = '')))).toEqual([
      'terms[0].definition TOO_SHORT',
    ]);
    expect(
      summary(break_((g) => (g.terms[0].definition = 'x'.repeat(301))))
    ).toEqual(['terms[0].definition TOO_LONG']);
    expect(
      parseGlossary(break_((g) => (g.terms[0].definition = 'x'.repeat(300)))).ok
    ).toBe(true);
    expect(summary(break_((g) => (g.terms[0].en_variants = 'x')))).toEqual([
      'terms[0].en_variants WRONG_TYPE',
    ]);
    expect(summary(break_((g) => (g.terms[0].en_variants = [1])))).toEqual([
      'terms[0].en_variants[0] WRONG_TYPE',
    ]);
    expect(
      summary(break_((g) => (g.terms[0].en_variants = Array(13).fill('x'))))
    ).toEqual(['terms[0].en_variants TOO_MANY']);
    expect(summary(break_((g) => (g.terms[0].owners = [])))).toEqual([
      'terms[0].owners TOO_SHORT',
    ]);
    expect(
      summary(break_((g) => (g.terms[0].owners = ['SYN', 'SYN'])))
    ).toEqual(['terms[0].owners[1] DUPLICATE']);
    for (const owner of ['MCD16', 'mcd1', 'D0', 'D6', 'MCD', 'SYN2', '']) {
      expect(
        summary(break_((g) => (g.terms[0].owners = [owner]))).length
      ).toBeGreaterThan(0);
    }
    for (const owner of ['MCD0', 'MCD15', 'D1', 'D5', 'SYN']) {
      expect(
        parseGlossary(break_((g) => (g.terms[0].owners = [owner]))).ok
      ).toBe(true);
    }
    expect(
      summary(
        break_((g) => (g.terms[0].owners = ['SYN', 'D1', 'D2', 'D3', 'D4']))
      )
    ).toEqual(['terms[0].owners TOO_MANY']);
    expect(summary(break_((g) => (g.terms[0].never_translate = 'no')))).toEqual(
      ['terms[0].never_translate WRONG_TYPE']
    );
  });

  it('needs the forms to be an object with en-US and only locales', () => {
    expect(summary(break_((g) => (g.terms[0].forms = [])))).toEqual([
      'terms[0].forms WRONG_TYPE',
    ]);
    expect(summary(break_((g) => delete g.terms[0].forms['en-US']))).toEqual([
      'terms[0].forms.en-US REQUIRED',
    ]);
    for (const locale of ['xx', 'zh-CN', 'EN', 'en_US', 'fr-FR', '__proto__']) {
      expect(
        summary(
          break_((g) => {
            g.terms[0].forms = JSON.parse(
              JSON.stringify({
                'en-US': g.terms[0].forms['en-US'],
                [locale]: g.terms[0].forms.es,
              })
            );
          })
        )
      ).toEqual([`terms[0].forms.${locale} NOT_ONE_OF`]);
    }
  });

  it('refuses a bad status, a bad canonical form and bad variants', () => {
    expect(
      summary(break_((g) => (g.terms[0].forms.es.status = 'final')))
    ).toEqual(['terms[0].forms.es.status NOT_ONE_OF']);
    expect(
      summary(break_((g) => (g.terms[0].forms.es.canonical = '')))
    ).toEqual(['terms[0].forms.es.canonical TOO_SHORT']);
    expect(summary(break_((g) => (g.terms[0].forms.es.canonical = 5)))).toEqual(
      ['terms[0].forms.es.canonical WRONG_TYPE']
    );
    expect(
      summary(break_((g) => (g.terms[0].forms.es.canonical = 'x'.repeat(81))))
    ).toEqual(['terms[0].forms.es.canonical TOO_LONG']);
    expect(
      parseGlossary(
        break_((g) => (g.terms[0].forms.es.canonical = 'x'.repeat(80)))
      ).ok
    ).toBe(true);
    expect(
      summary(break_((g) => (g.terms[0].forms.es.variants = 'x')))
    ).toEqual(['terms[0].forms.es.variants WRONG_TYPE']);
    expect(
      summary(break_((g) => (g.terms[0].forms.es.variants = [''])))
    ).toEqual(['terms[0].forms.es.variants[0] TOO_SHORT']);
    expect(
      summary(
        break_(
          (g) =>
            (g.terms[0].forms.es.variants = Array.from(
              { length: 13 },
              (_, i) => `venta${i}`
            ))
        )
      )
    ).toEqual(['terms[0].forms.es.variants TOO_MANY']);
  });

  it('refuses a form of one character, once normalised', () => {
    expect(
      summary(break_((g) => (g.terms[0].forms.ja.canonical = '買')))
    ).toEqual(['terms[0].forms.ja.canonical TOO_SHORT']);
    expect(
      summary(
        break_((g) => (g.terms[0].forms.ja.variants = ['金', '\u200b買']))
      )
    ).toEqual([
      'terms[0].forms.ja.variants[0] TOO_SHORT',
      'terms[0].forms.ja.variants[1] TOO_SHORT',
    ]);
    expect(
      parseGlossary(break_((g) => (g.terms[0].forms.ja.canonical = '買い'))).ok
    ).toBe(true);
  });

  it('refuses a form that is spelled like another form of the same locale', () => {
    // the same term twice, and two terms
    expect(
      summary(
        break_((g) => (g.terms[0].forms['en-US'].variants = ['BUYS', 'buys']))
      )
    ).toEqual(['terms[0].forms.en-US.variants[1] DUPLICATE']);
    expect(
      summary(break_((g) => (g.terms[0].forms['en-US'].variants = ['buy'])))
    ).toEqual(['terms[0].forms.en-US.variants[0] DUPLICATE']);
    expect(
      summary(break_((g) => (g.terms[1].forms['en-US'].variants = ['Ｂuy'])))
    ).toEqual(['terms[1].forms.en-US.variants[0] DUPLICATE']);
    // another locale may spell it the same way
    expect(
      parseGlossary(
        break_((g) => (g.terms[1].forms.es.variants = ['comprar2']))
      ).ok
    ).toBe(true);
    expect(GLOSSARY.terms[0]?.forms['es']?.canonical).toBe(
      GLOSSARY.terms[0]?.forms['pt']?.canonical
    );
  });

  it('keeps a never-translated term to its one English spelling', () => {
    const at = raw().terms.findIndex((term: any) => term.id === 'uoedt');
    expect(at).toBeGreaterThanOrEqual(0);
    expect(
      summary(break_((g) => (g.terms[at].forms['en-US'].canonical = 'uoedt')))
    ).toEqual([`terms[${at}].forms.en-US.canonical INCONSISTENT`]);
    expect(
      summary(
        break_((g) => (g.terms[at].forms['en-US'].variants = ['UOEDT-line']))
      )
    ).toEqual([`terms[${at}].forms.en-US.variants[0] INCONSISTENT`]);
    expect(
      parseGlossary(
        break_((g) => {
          g.terms[at].forms.es = {
            canonical: 'UOEDT',
            variants: [],
            status: 'draft',
          };
        })
      ).ok
    ).toBe(true);
  });

  it('reports every problem, not only the first, and stops at 60', () => {
    const many = break_((g) => {
      g.terms = g.terms.slice(0, 12);
      for (const term of g.terms) term.owners = [];
    });
    expect(issuesOf(many)).toHaveLength(12);
    const worse = break_((g) => {
      g.terms = g.terms.slice(0, 12);
      for (const term of g.terms) {
        term.owners = [];
        term.definition = '';
        term.en_variants = 'x';
        term.forms = [];
      }
    });
    expect(issuesOf(worse)).toHaveLength(48);
    const flood = break_((g) => {
      g.terms = Array.from({ length: 100 }, () => ({}));
    });
    expect(issuesOf(flood)).toHaveLength(60);
  });

  it('accepts up to 400 terms and refuses 401', () => {
    const base = raw();
    const make = (count: number): unknown => ({
      ...base,
      terms: Array.from({ length: count }, (_, i) => ({
        ...base.terms[0],
        id: `t${i}`,
        en: `term number ${i}`,
        forms: {
          'en-US': {
            canonical: `term number ${i}`,
            variants: [],
            status: 'draft',
          },
        },
      })),
    });
    expect(parseGlossary(make(400)).ok).toBe(true);
    expect(summary(make(401))).toEqual(['terms TOO_MANY']);
  });
});

// ---------------------------------------------------------------------------------------
// Case
// ---------------------------------------------------------------------------------------

describe('foldCase and matchKey', () => {
  it('lowers the case without changing the length of the text', () => {
    expect(foldCase('Buy GOLD')).toBe('buy gold');
    expect(foldCase('Σ')).toBe('σ');
    expect(foldCase('İ')).toBe('İ'); // its lower case is two characters, so it is kept
    expect(foldCase('İstanbul').length).toBe('İstanbul'.length);
    for (const text of ['ÀÉÎ', 'ǅ', 'Ǆ', 'ẞ', '𐐀', 'abc']) {
      expect(foldCase(text).length).toBe(text.length);
    }
  });

  it('makes one key of spellings that differ in case, width and invisible characters', () => {
    expect(matchKey('Stop-Loss')).toBe('stop-loss');
    expect(matchKey('ＳＴＯＰ\u200b loss')).toBe('stop loss');
    expect(matchKey('  stop   loss ')).toBe('stop loss');
  });
});

// ---------------------------------------------------------------------------------------
// Spotting, per language
// ---------------------------------------------------------------------------------------

describe('spotting the committed terms', () => {
  const QUESTIONS: [string, string, [string, string][]][] = [
    [
      'en',
      'Should I buy gold now?',
      [
        ['buy', 'buy'],
        ['gold', 'gold'],
      ],
    ],
    [
      'es',
      '¿Debo comprar oro ahora?',
      [
        ['buy', 'comprar'],
        ['gold', 'oro'],
      ],
    ],
    [
      'de',
      'Soll ich jetzt Gold kaufen?',
      [
        ['gold', 'Gold'],
        ['buy', 'kaufen'],
      ],
    ],
    [
      'pt',
      'Devo comprar ouro agora?',
      [
        ['buy', 'comprar'],
        ['gold', 'ouro'],
      ],
    ],
    [
      'it',
      'Devo comprare oro adesso?',
      [
        ['buy', 'comprare'],
        ['gold', 'oro'],
      ],
    ],
    [
      'ja',
      '今ゴールドを買うべきですか?',
      [
        ['gold', 'ゴールド'],
        ['buy', '買う'],
      ],
    ],
    [
      'ja',
      'ゴールドを買う',
      [
        ['gold', 'ゴールド'],
        ['buy', '買う'],
      ],
    ],
    [
      'ar',
      'هل أشتري الذهب الآن؟',
      [
        ['buy', 'أشتري'],
        ['gold', 'ذهب'],
      ],
    ],
    [
      'fr',
      "Dois-je acheter de l'or maintenant ?",
      [
        ['buy', 'acheter'],
        ['gold', "l'or"],
      ],
    ],
    [
      'ko',
      '지금 골드를 매수해야 하나요?',
      [
        ['gold', '골드'],
        ['buy', '매수'],
      ],
    ],
    [
      'zh',
      '现在应该买入黄金吗?',
      [
        ['buy', '买入'],
        ['gold', '黄金'],
      ],
    ],
    [
      'zh-TW',
      '現在應該買入黃金嗎?',
      [
        ['buy', '買入'],
        ['gold', '黃金'],
      ],
    ],
    [
      'ur',
      'کیا مجھے ابھی سونا خریدنا چاہیے؟',
      [
        ['gold', 'سونا'],
        ['buy', 'خریدنا'],
      ],
    ],
    [
      'hi',
      'क्या मुझे अभी सोना खरीदना चाहिए?',
      [
        ['gold', 'सोना'],
        ['buy', 'खरीदना'],
      ],
    ],
    [
      'vi',
      'Tôi có nên mua vàng bây giờ không?',
      [
        ['buy', 'mua'],
        ['gold', 'vàng'],
      ],
    ],
    [
      'id',
      'Apakah saya harus beli emas sekarang?',
      [
        ['buy', 'beli'],
        ['gold', 'emas'],
      ],
    ],
    [
      'th',
      'ตอนนี้ควรซื้อทองไหม',
      [
        ['buy', 'ซื้อ'],
        ['gold', 'ทอง'],
      ],
    ],
    [
      'tr',
      'Şimdi altın satın almak doğru mu?',
      [
        ['gold', 'altın'],
        ['buy', 'satın almak'],
      ],
    ],
  ];

  it.each(QUESTIONS)(
    'finds the terms of a %s question: %s',
    (_language, question, expected) => {
      const hits = spotTerms(normalizeQuestion(question).text);
      expect(
        hits.map((hit): [string, string] => [
          hit.terms.map((t) => t.id).join('+'),
          hit.matched,
        ])
      ).toEqual(expected);
    }
  );

  it('says where each hit is, in the text that was searched', () => {
    const text = normalizeQuestion(
      'Where is the stop loss and the take profit for the buy?'
    ).text;
    const hits = spotTerms(text);
    expect(hits.map((hit) => hit.terms[0]?.id)).toEqual([
      'stop_loss',
      'take_profit',
      'buy',
    ]);
    for (const hit of hits)
      expect(text.slice(hit.start, hit.end)).toBe(hit.matched);
    expect(hits.map((hit) => hit.start)).toEqual(
      [...hits.map((hit) => hit.start)].sort((a, b) => a - b)
    );
  });

  it('finds the six sell and stop loss words in the other languages too', () => {
    const cases: [string, string, string][] = [
      ['vender oro', 'sell', 'vender'],
      ['verkaufen', 'sell', 'verkaufen'],
      ['売り', 'sell', '売り'],
      ['بيع الذهب', 'sell', 'بيع'],
      ['매도', 'sell', '매도'],
      ['卖出', 'sell', '卖出'],
      ['賣出', 'sell', '賣出'],
      ['फरोख्त बेचना', 'sell', 'बेचना'],
      ['ขาย', 'sell', 'ขาย'],
      ['止损', 'stop_loss', '止损'],
      ['停損', 'stop_loss', '停損'],
      ['損切り', 'stop_loss', '損切り'],
      ['손절', 'stop_loss', '손절'],
      ['cắt lỗ', 'stop_loss', 'cắt lỗ'],
      ['zarar durdur', 'stop_loss', 'zarar durdur'],
      ['وقف الخسارة', 'stop_loss', 'وقف الخسارة'],
      ['स्टॉप लॉस', 'stop_loss', 'स्टॉप लॉस'],
    ];
    for (const [question, id, matched] of cases) {
      const hits = spotTerms(normalizeQuestion(question).text);
      expect({
        question,
        found: hits.find((hit) => hit.terms[0]?.id === id)?.matched,
      }).toEqual({
        question,
        found: matched,
      });
    }
  });

  it('finds the form of a Thai term that NFKC rewrites, because forms are normalised too', () => {
    // จุดทำกำไร has sara am (U+0E33); NFKC writes it as nikhahit + sara aa
    const question = 'จุดทำกำไรอยู่ที่ไหน';
    expect(normalizeQuestion(question).text).not.toBe(question);
    const hits = spotTerms(normalizeQuestion(question).text);
    expect(hits.map((hit) => hit.terms[0]?.id)).toEqual(['take_profit']);
  });

  it('ignores case and keeps the case of the text in the hit', () => {
    expect(spotTerms('BUY Gold')).toMatchObject([
      { matched: 'BUY' },
      { matched: 'Gold' },
    ]);
    expect(spotTerms('uoedt')).toMatchObject([
      { terms: [{ id: 'uoedt' }], matched: 'uoedt' },
    ]);
    expect(spotTerms('Ｂuy')).toEqual([]); // not normalised: the caller normalises first
  });

  it('finds the level names, which are never translated, in any language', () => {
    expect(
      spotTerms('where are the UOEDT, the baseline and the LOEDT?').map(
        (h) => h.terms[0]?.id
      )
    ).toEqual(['uoedt', 'baseline', 'loedt']);
    expect(spotTerms('请解释UOEDT').map((h) => h.matched)).toEqual(['UOEDT']);
    expect(spotTerms('UOEDTとは?').map((h) => h.matched)).toEqual(['UOEDT']);
    expect(spotTerms('ما هو الـ LOEDT').map((h) => h.matched)).toEqual([
      'LOEDT',
    ]);
    expect(spotTerms('baselines')).toEqual([]);
    expect(spotTerms('sr_baseline')).toEqual([]);
  });

  it('puts the languages of a hit on the hit', () => {
    const [hit] = spotTerms('stop loss');
    expect(hit?.terms).toEqual([
      {
        id: 'stop_loss',
        languages: ['en', 'es', 'de', 'pt', 'it', 'fr', 'vi', 'id', 'tr'],
      },
    ]);
    // the bare French "or" is not a form: it is also the English and French word "or"
    expect(spotTerms('or')).toEqual([]);
    const [gold] = spotTerms("l'or");
    expect(gold?.terms).toEqual([{ id: 'gold', languages: ['fr'] }]);
    const [oro] = spotTerms('oro');
    expect(oro?.terms[0]?.languages).toEqual(['es', 'it']);
    // a level name is written the same in every language, so every language has it
    const [uoedt] = spotTerms('UOEDT');
    expect(uoedt?.terms[0]?.languages).toEqual([
      ...new Set(LOCALES.map(familyOfLocale)),
    ]);
  });
});

// ---------------------------------------------------------------------------------------
// Spotting, the rules of each script
// ---------------------------------------------------------------------------------------

describe('how a form is bounded, by script', () => {
  const g = mini({
    gold: [
      'gold',
      {
        'en-US': ['gold'],
        ja: ['ゴールド'],
        th: ['ทอง', 'ทองคำ'],
        ko: ['골드'],
        ar: ['ذهب'],
        hi: ['सोना'],
      },
    ],
    sl: ['stop loss', { 'en-US': ['stop loss', 'stop-loss'] }],
    tp: ['take profit', { 'en-US': ['take profit'] }],
    profit: ['profit', { 'en-US': ['profit'] }],
    zh: ['zhang', { zh: ['涨势', '涨'.concat('幅')] }],
  });

  describe('a Latin form is a whole word', () => {
    it.each([
      ['gold', [['gold', 'gold']]],
      ['Gold!', [['gold', 'Gold']]],
      ['(gold)', [['gold', 'gold']]],
      ['gold-plated', [['gold', 'gold']]],
      [
        'the gold, the gold.',
        [
          ['gold', 'gold'],
          ['gold', 'gold'],
        ],
      ],
      ['goldfish', []],
      ['digold', []],
      ['gold5', []],
      ['5gold', []],
      ['gold_', []],
      ['_gold', []],
      ['golden', []],
      ['gold́', []], // a combining mark continues the word
      ['gold 5', [['gold', 'gold']]],
    ] as [string, [string, string][]][])('%s', (text, expected) => {
      expect(spotIn(g, text)).toEqual(expected);
    });

    it('is bounded by the script, not by every letter: a Latin word next to Chinese, Japanese or Thai text counts', () => {
      expect(spotIn(g, '我想gold')).toEqual([['gold', 'gold']]);
      expect(spotIn(g, 'gold我想')).toEqual([['gold', 'gold']]);
      expect(spotIn(g, 'ทองgold')).toEqual([
        ['gold', 'ทอง'],
        ['gold', 'gold'],
      ]);
      expect(spotIn(g, 'ذهبgold')).toEqual([
        ['gold', 'ذهب'],
        ['gold', 'gold'],
      ]);
    });
  });

  describe('the longest form wins at a place, and hits never overlap', () => {
    it('takes take profit, not profit', () => {
      expect(spotIn(g, 'take profit')).toEqual([['tp', 'take profit']]);
      expect(spotIn(g, 'a profit, a take profit')).toEqual([
        ['profit', 'profit'],
        ['tp', 'take profit'],
      ]);
    });

    it('takes the earlier hit when two overlap', () => {
      const h = mini({
        a: ['alpha beta', { 'en-US': ['alpha beta'] }],
        b: ['beta gamma', { 'en-US': ['beta gamma'] }],
      });
      expect(spotIn(h, 'alpha beta gamma')).toEqual([['a', 'alpha beta']]);
      expect(spotIn(h, 'x beta gamma')).toEqual([['b', 'beta gamma']]);
    });

    it('treats a hyphen and a space as different spellings', () => {
      expect(spotIn(g, 'stop-loss and stop loss')).toEqual([
        ['sl', 'stop-loss'],
        ['sl', 'stop loss'],
      ]);
      expect(spotIn(g, 'stop  loss')).toEqual([['sl', 'stop loss']]); // white space is folded first
    });

    it('lets two terms share a spelling in different languages and reports both', () => {
      const h = mini({
        buy: ['buy', { es: ['al'] }],
        take: ['take', { tr: ['al'] }],
      });
      const [hit] = createSpotter(h).spot('al');
      expect(hit?.terms).toEqual([
        { id: 'buy', languages: ['es'] },
        { id: 'take', languages: ['tr'] },
      ]);
    });

    it('lists one language once, however many locales of it have the form', () => {
      const h = mini({
        ok: [
          'okay',
          {
            'en-US': ['okay'],
            'en-GB': ['okay'],
            pt: ['okay'],
            'pt-BR': ['okay'],
          },
        ],
      });
      expect(createSpotter(h).spot('okay')[0]?.terms).toEqual([
        { id: 'ok', languages: ['en', 'pt'] },
      ]);
    });
  });

  describe('Chinese, Japanese and Thai have no spaces, so no boundary is looked for', () => {
    it('finds a form inside a run of text, and the longest of two', () => {
      // the hit is the NORMALISED text: NFKC writes the sara am of ทองคำ as two characters
      expect(spotIn(g, 'ราคาทองคำวันนี้')).toEqual([
        ['gold', 'ทองคำ'.normalize('NFKC')],
      ]);
      expect(spotIn(g, 'ราคาทองวันนี้')).toEqual([['gold', 'ทอง']]);
      expect(spotIn(g, '今日のゴールド相場')).toEqual([['gold', 'ゴールド']]);
      expect(spotIn(g, '涨势和涨幅')).toEqual([
        ['zh', '涨势'],
        ['zh', '涨幅'],
      ]);
    });

    it('also finds it inside a longer word: that is what the script offers (a known limit)', () => {
      expect(spotIn(g, 'ทองแดง')).toEqual([['gold', 'ทอง']]);
      expect(spotIn(g, 'ゴールドラッシュ')).toEqual([['gold', 'ゴールド']]);
    });
  });

  describe('Korean attaches its particles to a noun, so a form is the start of a word', () => {
    it.each([
      ['골드', [['gold', '골드']]],
      ['골드를 사고', [['gold', '골드']]],
      ['골드가', [['gold', '골드']]],
      ['지금 골드는', [['gold', '골드']]],
      ['황골드', []],
      ['a골드', [['gold', '골드']]], // a Latin letter is not part of a Korean word
    ] as [string, [string, string][]][])('%s', (text, expected) => {
      expect(spotIn(g, text)).toEqual(expected);
    });
  });

  describe('Arabic and Urdu: the clitics that attach to the start of a word', () => {
    it.each([
      ['ذهب', [['gold', 'ذهب']]],
      ['الذهب', [['gold', 'ذهب']]], // the
      ['والذهب', [['gold', 'ذهب']]], // and the
      ['وذهب', [['gold', 'ذهب']]], // and
      ['بالذهب', [['gold', 'ذهب']]], // with the
      ['بذهب', [['gold', 'ذهب']]], // with
      ['للذهب', [['gold', 'ذهب']]], // for the
      ['لذهب', [['gold', 'ذهب']]], // for
      ['كالذهب', [['gold', 'ذهب']]], // like the
      ['فالذهب', [['gold', 'ذهب']]], // so the
      ['سذهب', [['gold', 'ذهب']]], // will
      ['وبالذهب', [['gold', 'ذهب']]], // and with the
      ['فللذهب', [['gold', 'ذهب']]], // so for the
      ['سعر الذهب اليوم', [['gold', 'ذهب']]],
      ['مذهب', []], // a doctrine: م is not a clitic
      ['ذهبي', []], // golden
      ['الذهبية', []],
      ['ذهبت', []], // she went
      ['وذهبت', []],
      ['ذهب1', []],
      ['ذهب،', [['gold', 'ذهب']]],
      ['شذهب', []],
    ] as [string, [string, string][]][])('%s', (text, expected) => {
      expect(spotIn(g, text)).toEqual(expected);
    });
  });

  describe('Devanagari: whole words, with their vowel signs', () => {
    it.each([
      ['सोना', [['gold', 'सोना']]],
      ['सोना कितना है', [['gold', 'सोना']]],
      ['सोनाली', []],
      ['असोना', []],
      ['सोना।', [['gold', 'सोना']]],
    ] as [string, [string, string][]][])('%s', (text, expected) => {
      expect(spotIn(g, text)).toEqual(expected);
    });
  });

  it('refuses nothing and finds nothing in an empty text or a text with no term', () => {
    expect(spotIn(g, '')).toEqual([]);
    expect(spotIn(g, 'hello world')).toEqual([]);
    expect(createSpotter(g).spot('')).toEqual([]);
  });

  it('does not take a regular-expression character in a form for a pattern', () => {
    const h = mini({
      a: [
        'a.b',
        {
          'en-US': [
            'a.b',
            'c++',
            '(x)',
            'p|q',
            '[z]',
            'm/n',
            'u*v',
            'w?',
            '$5',
            '^up',
            'back\\slash',
            '{1,2}',
          ],
        },
      ],
    });
    expect(spotIn(h, 'a.b')).toEqual([['a', 'a.b']]);
    expect(spotIn(h, 'axb')).toEqual([]);
    expect(spotIn(h, 'p|q')).toEqual([['a', 'p|q']]);
    expect(spotIn(h, 'p or q')).toEqual([]);
    expect(
      spotIn(h, 'm/n and (x) and [z] and u*v and back\\slash and {1,2}')
    ).toHaveLength(6);
    expect(spotIn(h, 'uuv')).toEqual([]);
    expect(spotIn(h, '^up')).toEqual([['a', '^up']]);
  });

  it('is not slow on long texts', () => {
    const long = `${'x '.repeat(20000)}gold ${'ا'.repeat(20000)} ${'ทอง'.repeat(5000)}`;
    const hits = createSpotter(g).spot(long);
    expect(hits.length).toBeGreaterThan(5000);
  });
});

// ---------------------------------------------------------------------------------------
// Size
// ---------------------------------------------------------------------------------------

describe('a glossary at the size the real one will have, and far above it', () => {
  /** `terms` terms, each in every locale, with a canonical form and one variant in the script of the locale. */
  function big(terms: number): Glossary {
    const scripts: Record<string, string> = {
      latin: 'abcdefghijklmnopqrstuvwxyz',
      arabic: 'ابتثجحخدذرزسشصضطظعغفقكلمنهوي',
      han: '买卖黄金止损盈利趋势支撑阻力入场出场',
      thai: 'กขคงจฉชซญดตถทนบปผฝพฟภมยรลวศษสหอ',
      hangul: '가나다라마바사아자차카타파하',
      devanagari: 'कखगघचछजझटठडढणतथदधनपफबभमयरलवशसह',
    };
    const byLocale: Record<string, string> = {
      'en-US': 'latin',
      es: 'latin',
      de: 'latin',
      pt: 'latin',
      it: 'latin',
      fr: 'latin',
      vi: 'latin',
      id: 'latin',
      tr: 'latin',
      ar: 'arabic',
      ur: 'arabic',
      zh: 'han',
      'zh-TW': 'han',
      ja: 'han',
      th: 'thai',
      ko: 'hangul',
      hi: 'devanagari',
    };
    const word = (alphabet: string, n: number, salt: number): string => {
      const chars = Array.from(alphabet);
      let x = n * 7919 + salt * 104729 + 17;
      let out = '';
      for (let i = 0; i < 5; i += 1) {
        out += chars[x % chars.length];
        x = Math.floor(x / chars.length) + i * 31 + 7;
      }
      return out;
    };
    const list: Record<string, [string, Record<string, string[]>]> = {};
    for (let n = 0; n < terms; n += 1) {
      const forms: Record<string, string[]> = {};
      for (const [locale, script] of Object.entries(byLocale)) {
        forms[locale] = [
          `${word(scripts[script] as string, n, 1)}${n}x`,
          `${word(scripts[script] as string, n, 2)}${n}y`,
        ];
      }
      list[`t${n}`] = [`term ${n}`, forms];
    }
    return mini(list);
  }

  it('compiles and spots within a few seconds for 400 terms of 17 locales (13,600 forms)', () => {
    const glossary = big(400);
    expect(glossary.terms).toHaveLength(400);
    const started = Date.now();
    const spotter = createSpotter(glossary);
    const text = Array.from({ length: 400 }, (_, n) => {
      const form = glossary.terms[n]?.forms['en-US']?.canonical as string;
      return `${form} and ordinary words ${n}`;
    }).join(' ');
    const hits = spotter.spot(normalizeQuestion(text).text);
    const elapsed = Date.now() - started;
    expect(hits.map((hit) => hit.terms[0]?.id)).toEqual(
      Array.from({ length: 400 }, (_, n) => `t${n}`)
    );
    expect(elapsed).toBeLessThan(5000);
  });
});

// ---------------------------------------------------------------------------------------
// Hints
// ---------------------------------------------------------------------------------------

describe('glossaryHints', () => {
  const hitsOf = (text: string): GlossaryHit[] =>
    spotTerms(normalizeQuestion(text).text);

  it('gives one hint per term, in the order the terms appear, with the English term', () => {
    expect(glossaryHints(hitsOf('Kaufen oder Gold? Gold kaufen!'))).toEqual([
      { id: 'buy', matched: 'Kaufen', en: 'buy' },
      { id: 'gold', matched: 'Gold', en: 'gold' },
    ]);
    expect(glossaryHints(hitsOf('停損 止损'))).toEqual([
      { id: 'stop_loss', matched: '停損', en: 'stop loss' },
    ]);
  });

  it('gives a hint for each term of a spelling that two terms share', () => {
    const h = mini({
      buy: ['buy', { es: ['al'] }],
      take: ['take', { tr: ['al'] }],
    });
    const hits = createSpotter(h).spot('al');
    expect(glossaryHints(hits, h)).toEqual([
      { id: 'buy', matched: 'al', en: 'buy' },
      { id: 'take', matched: 'al', en: 'take' },
    ]);
  });

  it('stops at the limit, 16 by default', () => {
    const forms: Record<string, [string, Record<string, string[]>]> = {};
    for (let i = 0; i < 20; i += 1)
      forms[`t${i}`] = [`term${i}`, { 'en-US': [`term${i}`] }];
    const h = mini(forms);
    const hits = createSpotter(h).spot(
      Object.keys(forms)
        .map((_, i) => `term${i}`)
        .join(' ')
    );
    expect(hits).toHaveLength(20);
    expect(glossaryHints(hits, h)).toHaveLength(16);
    expect(glossaryHints(hits, h, 3).map((hint) => hint.id)).toEqual([
      't0',
      't1',
      't2',
    ]);
    expect(glossaryHints(hits, h, 20)).toHaveLength(20);
    expect(glossaryHints([], h)).toEqual([]);
  });
});

// ---------------------------------------------------------------------------------------
// Gaps the mutation check found
// ---------------------------------------------------------------------------------------

describe('parseGlossary: the edges', () => {
  const break_ = (change: (glossary: any) => void): unknown => {
    const glossary = raw();
    change(glossary);
    return glossary;
  };

  it('anchors the owner and the version patterns at both ends', () => {
    for (const owner of [
      'XSYN',
      'SYN ',
      ' SYN',
      'MCD1X',
      'XMCD1',
      'D1X',
      'XD1',
      'MCD1 ',
    ]) {
      expect(summary(break_((g) => (g.terms[0].owners = [owner])))).toEqual([
        'terms[0].owners[0] BAD_FORMAT',
      ]);
    }
    for (const version of ['1.0 beta', '1.0\n', 'v1/2', '1.0+x']) {
      expect(summary(break_((g) => (g.version = version)))).toEqual([
        'version BAD_FORMAT',
      ]);
    }
    expect(
      parseGlossary(break_((g) => (g.version = `1${'b'.repeat(39)}`))).ok
    ).toBe(true);
    expect(summary(break_((g) => (g.version = `1${'b'.repeat(40)}`)))).toEqual([
      'version BAD_FORMAT',
    ]);
  });

  it('accepts the largest list of variants, of English wordings and of owners', () => {
    const variants = Array.from({ length: 12 }, (_, i) => `venta${i}`);
    expect(
      parseGlossary(break_((g) => (g.terms[0].forms.es.variants = variants))).ok
    ).toBe(true);
    expect(
      parseGlossary(break_((g) => (g.terms[0].en_variants = variants))).ok
    ).toBe(true);
    expect(
      parseGlossary(
        break_((g) => (g.terms[0].owners = ['SYN', 'D1', 'D2', 'D3']))
      ).ok
    ).toBe(true);
  });

  it('reports a term or a form that is not an object, and goes on', () => {
    for (const bad of ['text', null, 5, [], true]) {
      expect(summary(break_((g) => (g.terms[0] = bad)))).toEqual([
        'terms[0] WRONG_TYPE',
      ]);
      expect(summary(break_((g) => (g.terms[0].forms.es = bad)))).toEqual([
        'terms[0].forms.es WRONG_TYPE',
      ]);
    }
  });

  it('checks every form of a locale even when the first is unreadable', () => {
    expect(
      summary(
        break_((g) => {
          g.terms[0].forms.es.canonical = 5;
          g.terms[0].forms.es.variants = ['x', '', 'ok variant'];
        })
      )
    ).toEqual([
      'terms[0].forms.es.canonical WRONG_TYPE',
      'terms[0].forms.es.variants[1] TOO_SHORT',
      'terms[0].forms.es.variants[0] TOO_SHORT',
    ]);
  });

  it('checks every locale even when one is not a locale', () => {
    expect(
      summary(
        break_((g) => {
          g.terms[0].forms = {
            xx: g.terms[0].forms.es,
            'en-US': 'text',
            es: 5,
          };
        })
      )
    ).toEqual([
      'terms[0].forms.xx NOT_ONE_OF',
      'terms[0].forms.en-US WRONG_TYPE',
      'terms[0].forms.es WRONG_TYPE',
    ]);
  });

  it('puts the problem at the id and at the English form', () => {
    expect(summary(break_((g) => (g.terms[0].id = 'Buy')))).toEqual([
      'terms[0].id BAD_FORMAT',
    ]);
    expect(summary(break_((g) => (g.terms[0].en = '')))).toEqual([
      'terms[0].en TOO_SHORT',
    ]);
    expect(summary(break_((g) => (g.terms[0].en = 'x'.repeat(81))))).toEqual([
      'terms[0].en TOO_LONG',
    ]);
  });

  it('does not call two unreadable ids, or two unreadable owners, duplicates', () => {
    expect(
      summary(
        break_((g) => {
          g.terms[0].id = 'Bad';
          g.terms[1].id = 'Worse';
        })
      )
    ).toEqual(['terms[0].id BAD_FORMAT', 'terms[1].id BAD_FORMAT']);
    expect(
      summary(break_((g) => (g.terms[0].owners = ['bad', 'worse'])))
    ).toEqual([
      'terms[0].owners[0] BAD_FORMAT',
      'terms[0].owners[1] BAD_FORMAT',
    ]);
  });

  it('says whether a repeated form belongs to the same term or to another, and names it', () => {
    const same = issuesOf(
      break_((g) => (g.terms[0].forms['en-US'].variants = ['BUYS', 'buys']))
    );
    expect(same[0]?.message).toBe(
      'is written twice for this term in this locale'
    );
    const other = issuesOf(
      break_((g) => (g.terms[1].forms['en-US'].variants = ['buy']))
    );
    expect(other[0]?.message).toBe(
      'is already a form of the term buy in this locale'
    );
    // against a term whose id is unreadable, the holder is named by its place
    const unnamed = issuesOf(
      break_((g) => {
        g.terms[0].id = 'Bad';
        g.terms[1].forms['en-US'].variants = ['buy'];
      })
    );
    expect(unnamed.map((issue) => `${issue.path}: ${issue.message}`)).toEqual([
      'terms[0].id: must match ^[a-z][a-z0-9_]{0,39}$',
      'terms[1].forms.en-US.variants[0]: is already a form of the term terms[0] in this locale',
    ]);
  });
});

describe('the module refuses a committed glossary that is not valid', () => {
  it('stops at load, naming the first problem', () => {
    jest.isolateModules(() => {
      jest.doMock('@/config/intake/glossary.v1.json', () => ({
        schema: 'glossary/1',
        version: '1',
      }));
      expect(() => require('@/lib/intake/text/glossary')).toThrow(
        'config/intake/glossary.v1.json is not a valid glossary/1 file: terms REQUIRED: is required'
      );
    });
    jest.dontMock('@/config/intake/glossary.v1.json');
  });
});

describe('spotting: the script classes in their corner cases', () => {
  it('has no boundary for a Han, Kana or Thai form, whatever is next to it, even the word "undefined"', () => {
    const g = mini({ gold: ['gold', { zh: ['黄金'] }] });
    expect(spotIn(g, 'undefined黄金undefined')).toEqual([['gold', '黄金']]);
    expect(spotIn(g, 'abc黄金def')).toEqual([['gold', '黄金']]);
  });

  it('bounds a form of any other script as a word, and one with no letter at all', () => {
    const g = mini({
      gold: ['gold', { 'en-US': ['золото'] }],
      num: ['number', { 'en-US': ['1234'] }],
    });
    expect(spotIn(g, 'золото')).toEqual([['gold', 'золото']]);
    expect(spotIn(g, 'золотой')).toEqual([]);
    expect(spotIn(g, 'наше золото!')).toEqual([['gold', 'золото']]);
    expect(spotIn(g, '1234')).toEqual([['num', '1234']]);
    expect(spotIn(g, '51234')).toEqual([]);
    expect(spotIn(g, '12345')).toEqual([]);
    expect(spotIn(g, 'a1234')).toEqual([]);
    expect(spotIn(g, 'x 1234 y')).toEqual([['num', '1234']]);
  });

  it('classes a form by its first LETTER, whatever comes before it', () => {
    const g = mini({
      gold: ['gold', { zh: ['(黄金)'] }],
      x: ['x', { 'en-US': ['#gold'] }],
    });
    // no boundary for the Han form, though it begins with a bracket
    expect(spotIn(g, 'a(黄金)b')).toEqual([['gold', '(黄金)']]);
    // a Latin form that begins with a mark is bounded by LATIN letters: Chinese before it is no word
    expect(spotIn(g, '黄#gold')).toEqual([['x', '#gold']]);
    expect(spotIn(g, 'a#gold')).toEqual([]);
    expect(spotIn(g, '#goldfish')).toEqual([]);
  });

  it('takes the longest of two hits that start at the same place in different script classes', () => {
    const forwards = mini({
      short: ['short', { 'en-US': ['12'] }],
      long: ['long', { 'en-US': ['12-ab'] }],
    });
    const backwards = mini({
      long: ['long', { 'en-US': ['12-ab'] }],
      short: ['short', { 'en-US': ['12'] }],
    });
    expect(spotIn(forwards, '12-ab')).toEqual([['long', '12-ab']]);
    expect(spotIn(backwards, '12-ab')).toEqual([['long', '12-ab']]);
  });

  it('keeps the first of two hits that overlap, drops the second and goes on to the third', () => {
    const g = mini({
      latin: ['latin', { 'en-US': ['b黄'] }],
      han: ['han', { zh: ['黄金'] }],
      third: ['third', { 'en-US': ['buy'] }],
    });
    expect(spotIn(g, ' b黄金 buy')).toEqual([
      ['latin', 'b黄'],
      ['third', 'buy'],
    ]);
  });

  it('goes on to the next term of a hit when the first has a hint already', () => {
    const g = mini({
      buy: ['buy', { 'en-US': ['buy'], es: ['al'] }],
      take: ['take', { tr: ['al'] }],
    });
    const hits = createSpotter(g).spot('buy al');
    expect(hits.map((hit) => hit.terms.map((t) => t.id))).toEqual([
      ['buy'],
      ['buy', 'take'],
    ]);
    expect(glossaryHints(hits, g).map((hint) => hint.id)).toEqual([
      'buy',
      'take',
    ]);
  });

  it('gives a hint for a term that comes after a repeated one', () => {
    const hits = spotTerms(normalizeQuestion('Gold Gold buy').text);
    expect(hits).toHaveLength(3);
    expect(glossaryHints(hits).map((hint) => hint.id)).toEqual(['gold', 'buy']);
  });
});
