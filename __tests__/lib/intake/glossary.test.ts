/**
 * @jest-environment node
 */

/**
 * The real glossary (build step 6, part 3; architecture 4.3).
 *
 * `text/glossary.test.ts` holds the MECHANISM (the validator, the spotting, the script rules).
 * This file holds the CONTENT of `config/intake/glossary.v1.json`: 73 terms, each written in
 * all 19 locales, every form a draft until a person who reads the language approves it. A test
 * here fails when a term is lost, a locale is left out, a word is written in the wrong script,
 * a form no longer finds itself, or the glossary stops agreeing with Report 2 or the roster.
 */

import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

import {
  GLOSSARY,
  LOCALES,
  SENSOR_ROSTER,
  familyOfLocale,
  matchKey,
  normalizeQuestion,
  parseGlossary,
  spotTerms,
  termById,
  type GlossaryTerm,
} from '@/lib/intake';

const ROOT = join(__dirname, '..', '..', '..');
const REVIEW = join(ROOT, 'config', 'intake', 'review');
const dictionary = (locale: string): Record<string, string> =>
  JSON.parse(
    readFileSync(
      join(ROOT, 'lib', 'i18n', 'dictionaries', `${locale}.json`),
      'utf8'
    )
  ) as Record<string, string>;

/** The one script each non-Latin language is written in (Latin letters are allowed beside it). */
const HAN = String.raw`\p{Script=Han}`;
const SCRIPTS: Record<string, string> = {
  ja: String.raw`${HAN}\p{Script=Hiragana}\p{Script=Katakana}`,
  zh: HAN,
  'zh-TW': HAN,
  ko: String.raw`\p{Script=Hangul}`,
  ar: String.raw`\p{Script=Arabic}`,
  ur: String.raw`\p{Script=Arabic}`,
  hi: String.raw`\p{Script=Devanagari}`,
  th: String.raw`\p{Script=Thai}`,
};
/** Scripts that must not appear in a language that does not use them. */
const FOREIGN = [
  'Han',
  'Hiragana',
  'Katakana',
  'Hangul',
  'Arabic',
  'Devanagari',
  'Thai',
  'Cyrillic',
  'Greek',
  'Hebrew',
];
/** Latin acronyms a trader keeps in every language. */
const ACRONYMS = new Set(['RRR']);

const forms = (term: GlossaryTerm, locale: string): string[] => {
  const form = term.forms[locale];
  return form === undefined ? [] : [form.canonical, ...form.variants];
};

describe('the committed glossary: the term list', () => {
  it('is a valid glossary/1 file with 73 terms, 3 of them never translated', () => {
    expect(parseGlossary(JSON.parse(JSON.stringify(GLOSSARY))).ok).toBe(true);
    expect(GLOSSARY.version).toMatch(/^1\./);
    expect(GLOSSARY.terms).toHaveLength(73);
    expect(
      GLOSSARY.terms.filter((t) => t.never_translate).map((t) => t.id)
    ).toEqual(['uoedt', 'loedt', 'baseline']);
  });

  it('has the terms of the plan, in a fixed order', () => {
    expect(GLOSSARY.terms.map((t) => t.id)).toEqual([
      // the trader's actions and trade setup
      'buy',
      'sell',
      'stand_aside',
      'entry',
      'entry_zone',
      'stop_loss',
      'take_profit',
      'target',
      'lot_size',
      'leverage',
      'spread',
      'commission',
      'risk',
      'risk_reward',
      'equity',
      'margin',
      'broker',
      'stop_distance',
      'reduced_risk',
      // the instrument, the chart and the market
      'gold',
      'chart',
      'timeframe',
      'candle',
      'closed_bar',
      'trend',
      'uptrend',
      'downtrend',
      'sideways',
      'support',
      'resistance',
      'breakout',
      'breakdown',
      'pullback',
      'rally',
      'reversal',
      'range',
      'volatility',
      'momentum',
      'overbought',
      'oversold',
      // the channel and what the sensors read
      'channel',
      'corridor',
      'uoedt',
      'loedt',
      'baseline',
      'overextension',
      'reversion',
      'consolidated',
      'equilibrium',
      'value_zone',
      'premium_zone',
      'trend_conflict',
      'stochastic',
      // the synthesis
      'synthesis',
      'archetype',
      'continuation',
      'counter_trend',
      'with_trend',
      'exhaustion',
      'snapback',
      'invalidation',
      'runway',
      // statuses, data and the news
      'cautionary',
      'stale',
      'market_closed',
      'sensor',
      'reading',
      'news_blackout',
      'economic_calendar',
      'high_impact',
      'inflation',
      'interest_rate',
      'us_dollar',
    ]);
  });

  it('gives every term a one-sentence English definition ending in a full stop', () => {
    for (const term of GLOSSARY.terms) {
      expect(term.definition).toMatch(/[.]$/);
      expect(term.definition.length).toBeGreaterThanOrEqual(15);
      expect(term.definition.length).toBeLessThanOrEqual(300);
      expect(term.definition.split(/(?<=[.])\s+/u)).toHaveLength(1);
    }
  });

  it('names an owner for every term, and every sensor owner is on the roster', () => {
    const sensors = new Set(SENSOR_ROSTER.sensors.map((s) => s.mcd_id));
    for (const term of GLOSSARY.terms) {
      expect(term.owners.length).toBeGreaterThanOrEqual(1);
      for (const owner of term.owners) {
        if (owner.startsWith('MCD')) expect(sensors.has(owner)).toBe(true);
      }
    }
  });

  it('agrees with the roster: a term a sensor owns is a term of the glossary that names the sensor', () => {
    for (const sensor of SENSOR_ROSTER.sensors) {
      for (const owned of sensor.owned_terms) {
        const term = GLOSSARY.terms.find(
          (t) => matchKey(t.en) === matchKey(owned)
        );
        expect(term).toBeDefined();
        expect(term?.owners).toContain(sensor.mcd_id);
        expect(term?.never_translate).toBe(true);
      }
    }
  });
});

describe('the committed glossary: the 19 locales', () => {
  it('writes every term in every one of the 19 locales, and in no other', () => {
    expect(LOCALES).toHaveLength(19);
    for (const term of GLOSSARY.terms) {
      expect(Object.keys(term.forms).sort()).toEqual([...LOCALES].sort());
    }
  });

  it('writes a never-translated term as its English form, alone, in every locale', () => {
    for (const term of GLOSSARY.terms.filter((t) => t.never_translate)) {
      for (const locale of LOCALES) {
        expect(term.forms[locale]).toMatchObject({
          canonical: term.en,
          variants: [],
        });
      }
    }
  });

  it('gives a translated term a canonical form in each language and, almost always, other spellings too', () => {
    // a term with one word and no other spelling in a language is allowed (Thai `ซื้อ`), but rare
    const bare: string[] = [];
    for (const term of GLOSSARY.terms.filter((t) => !t.never_translate)) {
      for (const locale of LOCALES) {
        const form = term.forms[locale];
        expect(form?.canonical.trim()).not.toBe('');
        if (form?.variants.length === 0) bare.push(`${term.id}/${locale}`);
      }
    }
    expect(bare.length).toBeLessThanOrEqual(30);
  });

  it('writes en-GB and pt-BR as the term list of their language, with their own spelling where it differs', () => {
    const differs = (a: string, b: string) =>
      GLOSSARY.terms.filter(
        (t) =>
          JSON.stringify(t.forms[a]) !== JSON.stringify(t.forms[b]) &&
          !t.never_translate
      );
    // British and American English share every trading word in this list
    expect(differs('en-US', 'en-GB')).toEqual([]);
    // Brazilian Portuguese differs from European Portuguese in a few words (timeframe, interest)
    const brazil = differs('pt', 'pt-BR').map((t) => t.id);
    expect(brazil.length).toBeGreaterThan(0);
    expect(brazil.length).toBeLessThanOrEqual(15);
  });

  it.each(LOCALES.filter((locale) => SCRIPTS[locale] !== undefined))(
    'writes every %s form in the script of the language (or the acronym RRR)',
    (locale) => {
      const own = new RegExp(`[${SCRIPTS[locale]}]`, 'u');
      const wrong: string[] = [];
      for (const term of GLOSSARY.terms.filter((t) => !t.never_translate)) {
        for (const spelling of forms(term, locale)) {
          if (!own.test(spelling) && !ACRONYMS.has(spelling))
            wrong.push(`${term.id}: ${spelling}`);
        }
      }
      expect(wrong).toEqual([]);
    }
  );

  it.each(LOCALES)(
    'writes no %s form in a script the language does not use',
    (locale) => {
      const allowed = (SCRIPTS[locale] ?? '').match(/Script=(\w+)/g) ?? [];
      const allowedNames = new Set(
        allowed.map((s) => s.slice('Script='.length))
      );
      const foreign = FOREIGN.filter((name) => !allowedNames.has(name));
      const pattern = new RegExp(
        `[${foreign.map((name) => `\\p{Script=${name}}`).join('')}]`,
        'u'
      );
      const wrong: string[] = [];
      for (const term of GLOSSARY.terms.filter((t) => !t.never_translate)) {
        for (const spelling of forms(term, locale)) {
          if (pattern.test(spelling)) wrong.push(`${term.id}: ${spelling}`);
        }
      }
      expect(wrong).toEqual([]);
    }
  );

  it('keeps the letters of each Latin language: Turkish dotless i, German umlauts, Vietnamese marks, French accents', () => {
    const letters = (locale: string) =>
      new Set(
        GLOSSARY.terms
          .flatMap((t) => forms(t, locale))
          .join('')
          .toLowerCase()
      );
    expect(letters('tr').has('ı')).toBe(true);
    expect(letters('de').has('ü')).toBe(true);
    expect(letters('vi').has('ế')).toBe(true);
    expect(letters('fr').has('é')).toBe(true);
  });
});

describe('the committed glossary: the round trip through the spotting pass', () => {
  const FAMILIES = new Map(LOCALES.map((l) => [l, familyOfLocale(l)]));

  it('finds every canonical form and every variant of every locale, whole, as its own term', () => {
    const missed: string[] = [];
    let checked = 0;
    for (const term of GLOSSARY.terms) {
      for (const locale of LOCALES) {
        for (const spelling of forms(term, locale)) {
          checked++;
          const text = normalizeQuestion(spelling).text;
          const hits = spotTerms(text);
          const whole =
            hits.length === 1 &&
            hits[0]?.start === 0 &&
            hits[0]?.end === text.length;
          const owner = hits[0]?.terms.find((t) => t.id === term.id);
          const family = FAMILIES.get(locale) as string;
          if (
            !whole ||
            owner === undefined ||
            !owner.languages.includes(family)
          )
            missed.push(`${term.id}/${locale}: ${spelling}`);
        }
      }
    }
    expect(missed).toEqual([]);
    expect(checked).toBeGreaterThan(4000);
  });

  it('finds a form in a sentence, with the sentence round it', () => {
    const sentences: [string, string, string][] = [
      ['Should I buy gold now?', 'buy', 'gold'],
      ['¿Dónde pongo el stop loss del oro?', 'stop_loss', 'gold'],
      ['Wo liegt die Unterstützung bei Gold?', 'support', 'gold'],
      ['ゴールドのレジスタンスはどこですか', 'resistance', 'gold'],
      ['كم يبلغ سعر الذهب اليوم؟', 'gold', 'gold'],
      ['Quel est le levier pour l’or ?', 'leverage', 'gold'],
      ['금 시세와 레버리지를 알려 주세요', 'leverage', 'gold'],
      ['黄金的止损应该放在哪里', 'stop_loss', 'gold'],
      ['เทรนด์ขาขึ้นของทองคำยังอยู่ไหม', 'uptrend', 'gold'],
      ['Altın için destek seviyesi nerede?', 'support', 'gold'],
    ];
    for (const [question, first, second] of sentences) {
      const ids = spotTerms(normalizeQuestion(question).text).flatMap((hit) =>
        hit.terms.map((t) => t.id)
      );
      expect({ question, found: ids }).toEqual({
        question,
        found: expect.arrayContaining([first, second]),
      });
    }
  });

  it('shares no spelling between two terms in the same locale (the validator holds it too)', () => {
    const seen = new Map<string, string>();
    for (const term of GLOSSARY.terms) {
      for (const locale of LOCALES) {
        for (const spelling of forms(term, locale)) {
          const key = `${locale}\u0000${matchKey(spelling)}`;
          const holder = seen.get(key);
          expect({ locale, spelling, holder }).toEqual({
            locale,
            spelling,
            holder: holder === undefined ? undefined : term.id,
          });
          seen.set(key, term.id);
        }
      }
    }
  });

  it('shares no spelling between two terms of different locales either, so a hit names one term', () => {
    const owners = new Map<string, Set<string>>();
    for (const term of GLOSSARY.terms) {
      for (const locale of LOCALES) {
        for (const spelling of forms(term, locale)) {
          const key = matchKey(spelling);
          const set = owners.get(key) ?? new Set<string>();
          set.add(term.id);
          owners.set(key, set);
        }
      }
    }
    const shared = [...owners].filter(([, ids]) => ids.size > 1);
    expect(shared.map(([key, ids]) => `${key}: ${[...ids].join('+')}`)).toEqual(
      []
    );
  });

  it('does not take the bare French "or" for gold: it is also a common word', () => {
    expect(spotTerms('or')).toEqual([]);
    expect(spotTerms('buy or sell').map((h) => h.matched)).toEqual([
      'buy',
      'sell',
    ]);
    expect(spotTerms("le prix de l'or").map((h) => h.matched)).toEqual([
      "l'or",
    ]);
    expect(spotTerms("le cours de l'or").map((h) => h.matched)).toEqual([
      "cours de l'or",
    ]);
  });
});

describe('the committed glossary: agreement with Report 2', () => {
  /** The terms Report 2 already shows, and the dictionary row each one is. */
  const REPORT2: Record<string, string> = {
    stop_loss: 'report2.stop.heading',
    entry: 'report2.entry.heading',
    lot_size: 'report2.pair.lot',
    leverage: 'report2.check.leverage',
    equity: 'report2.equity.label',
    stop_distance: 'report2.label.stop_distance',
  };

  it.each(LOCALES)(
    'writes the six trading words of Report 2 as Report 2 does in %s',
    (locale) => {
      const rows = dictionary(locale);
      for (const [id, key] of Object.entries(REPORT2)) {
        const term = termById(GLOSSARY, id);
        expect({
          id,
          locale,
          canonical: term?.forms[locale]?.canonical.toLowerCase(),
        }).toEqual({
          id,
          locale,
          canonical: (rows[key] as string).toLowerCase(),
        });
      }
    }
  );

  it('reads the English of those six terms as the English of Report 2', () => {
    const rows = dictionary('en-US');
    for (const [id, key] of Object.entries(REPORT2)) {
      expect((termById(GLOSSARY, id) as GlossaryTerm).en.toLowerCase()).toBe(
        (rows[key] as string).toLowerCase()
      );
    }
  });
});

describe('the committed glossary: the status of its forms follows the approvals', () => {
  const approvalOf = (area: string): { status: string } =>
    JSON.parse(readFileSync(join(REVIEW, area, 'approval.json'), 'utf8')) as {
      status: string;
    };

  it('has one review folder per area: the term list and the 19 locales', () => {
    expect(
      readdirSync(REVIEW)
        .filter((n) => n !== 'INDEX.md')
        .sort()
    ).toEqual(['terms', ...LOCALES].sort());
  });

  it.each(LOCALES)(
    'marks the forms of %s approved exactly when its area is APPROVED',
    (locale) => {
      const approved = approvalOf(locale).status === 'APPROVED';
      for (const term of GLOSSARY.terms) {
        expect(term.forms[locale]?.status).toBe(
          approved ? 'approved' : 'draft'
        );
      }
    }
  );
});
