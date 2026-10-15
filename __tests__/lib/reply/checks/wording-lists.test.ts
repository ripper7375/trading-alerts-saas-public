/**
 * @jest-environment node
 */

import {
  CATEGORIES_SCHEMA,
  DIRECTION_SIDES,
  DIRECTION_TIERS,
  MATCH_MODES,
  NEVER_CATEGORIES,
  PHRASES_SCHEMA,
  SHIPPED_WORDING_FILES,
  WORDING,
  WORDING_LANGUAGES,
  WORDING_LIMITS,
  WORDING_VERSION,
  compileWording,
  foldForMatching,
  loadWording,
  notVerifiedMark,
  wordingForLocale,
} from '@/lib/reply/checks/wording-lists';
import type { RawWording } from '@/lib/reply/checks/wording-lists';
import { LOCALES, familyOfLocale } from '@/lib/reply/contracts/intake';

import { clone } from '../../intake/helpers/packets';
import {
  CATEGORIES_DAMAGE,
  LANGUAGE_FILE_DAMAGE,
  PHRASE_DAMAGE,
} from './helpers/damage-cases';

type Any = any;

/** A deep copy of the shipped files, changed by `change`. */
function damaged(change: (raw: Any) => void): RawWording {
  const raw: Any = clone(SHIPPED_WORDING_FILES);
  change(raw);
  return raw as RawWording;
}

const problemsOf = (raw: RawWording): string[] => compileWording(raw).problems;

describe('the shipped lists', () => {
  it('load without a problem and cover the 17 languages of the 19 locales', () => {
    expect(problemsOf(SHIPPED_WORDING_FILES)).toEqual([]);
    expect(WORDING.version).toBe(WORDING_VERSION);
    expect(Object.keys(WORDING.languages)).toEqual([...WORDING_LANGUAGES]);
    expect(WORDING_LANGUAGES).toHaveLength(17);
    expect(LOCALES).toHaveLength(19);
  });

  it('give each of the 19 locales a list, English and Portuguese shared', () => {
    for (const locale of LOCALES) {
      const wording = wordingForLocale(locale);
      expect(wording).not.toBeNull();
      expect(wording?.language).toBe(familyOfLocale(locale));
      expect(wording?.locales).toContain(locale);
    }
    expect(wordingForLocale('en-US')).toBe(wordingForLocale('en-GB'));
    expect(wordingForLocale('pt')).toBe(wordingForLocale('pt-BR'));
    expect(wordingForLocale('zh')).not.toBe(wordingForLocale('zh-TW'));
    expect(wordingForLocale('de')?.language).toBe('de');
  });

  it('give a value that is not one of the 19 locales no list', () => {
    expect(wordingForLocale('xx')).toBeNull();
    expect(wordingForLocale('')).toBeNull();
    expect(wordingForLocale('en')).toBeNull();
    expect(wordingForLocale('EN-US')).toBeNull();
    expect(wordingForLocale('__proto__')).toBeNull();
  });

  it('hold, in every language, every concept of the five "never" rows and every tier of the direction guard', () => {
    for (const language of WORDING_LANGUAGES) {
      const wording = WORDING.languages[language];
      for (const category of NEVER_CATEGORIES) {
        expect(Object.keys(wording.categories[category]).sort()).toEqual(
          [...WORDING.concepts[category]].sort()
        );
        for (const phrases of Object.values(wording.categories[category])) {
          expect(phrases.length).toBeGreaterThan(0);
        }
      }
      for (const side of DIRECTION_SIDES) {
        for (const tier of DIRECTION_TIERS) {
          expect(wording.direction[side][tier].length).toBeGreaterThan(0);
        }
      }
    }
  });

  it('have the concepts of architecture 5.9 in each category', () => {
    expect(Object.keys(WORDING.concepts)).toEqual([...NEVER_CATEGORIES]);
    expect(WORDING.concepts.ADVICE).toEqual([
      'recommend',
      'advise',
      'should_act',
      'suggest_trade',
    ]);
    expect(WORDING.concepts.URGENCY).toEqual([
      'act_now',
      'dont_miss',
      'last_chance',
    ]);
  });

  it('hold a lot of phrases, folded and short', () => {
    let total = 0;
    for (const language of WORDING_LANGUAGES) {
      const wording = WORDING.languages[language];
      let own = 0;
      const all = [
        ...Object.values(wording.categories).flatMap((c) =>
          Object.values(c).flat()
        ),
        ...DIRECTION_SIDES.flatMap((side) =>
          DIRECTION_TIERS.flatMap((tier) => wording.direction[side][tier])
        ),
      ];
      for (const phrase of all) {
        own += 1;
        expect(phrase.text).toBe(foldForMatching(phrase.text, language));
        expect(phrase.text).not.toContain('*');
        expect([...phrase.text].length).toBeLessThanOrEqual(
          WORDING_LIMITS.phraseChars
        );
        expect(MATCH_MODES).toContain(phrase.mode);
      }
      expect(own).toBeGreaterThanOrEqual(100);
      total += own;
    }
    expect(total).toBeGreaterThan(2000);
  });

  it('give each language its own "not verified" mark, and English to a value that is not a locale', () => {
    const marks = new Set(
      WORDING_LANGUAGES.map((l) => WORDING.languages[l].notVerified)
    );
    expect(marks.size).toBe(17);
    for (const language of WORDING_LANGUAGES) {
      const mark = WORDING.languages[language].notVerified;
      expect(mark.startsWith('—')).toBe(true);
      expect([...mark].length).toBeLessThanOrEqual(
        WORDING_LIMITS.notVerifiedChars
      );
    }
    expect(notVerifiedMark('en-US')).toBe('—, not verified');
    expect(notVerifiedMark('xx')).toBe('—, not verified');
    expect(notVerifiedMark('zh-TW')).toBe('—，未驗證');
    expect(notVerifiedMark('zh')).toBe('—，未验证');
  });

  it('are loaded when the module is, through the same checks', () => {
    expect(() => loadWording(SHIPPED_WORDING_FILES)).not.toThrow();
  });
});

describe('foldForMatching', () => {
  it.each([
    ['en', "Don't Miss THIS", 'dont miss this'],
    ['en', 'risk-free', 'risk free'],
    ['en', 'risk—free', 'risk free'],
    ['en', 'risk‑free', 'risk free'],
    ['en', 'it’s', 'its'],
    ['en', '  too   many\n spaces\t', 'too many spaces'],
    ['en', 're​com­mend', 'recommend'],
    ['en', 'ＲＩＳＫ', 'risk'],
    ['es', 'Recomendación', 'recomendacion'],
    ['fr', 'Dépêchez-vous', 'depechez vous'],
    ['de', 'Straße', 'strasse'],
    [
      'de',
      'Wahrscheinlichkeit für Überzeugung',
      'wahrscheinlichkeit fur uberzeugung',
    ],
    ['tr', 'İSTEK Iı', 'istek ii'],
    ['tr', 'Olasılığı', 'olasiligi'],
    ['pt', 'Convicção', 'conviccao'],
    ['vi', 'Xác Suất', 'xác suất'],
    ['id', 'Rekomendasi', 'rekomendasi'],
    ['ja', 'ｶﾞｲﾄﾞ', 'ガイド'],
    ['zh', '稳赚', '稳赚'],
    ['ko', '보장', '보장'],
    ['th', 'รับประกัน', 'รับประกัน'],
    ['hi', 'सलाह', 'सलाह'],
  ])('%s: %j is %j', (language, text, expected) => {
    expect(foldForMatching(text, language)).toBe(expected);
  });

  it('removes the vowel marks of Arabic and Urdu and joins the letters that are one', () => {
    expect(foldForMatching('أُعلن', 'ar')).toBe(foldForMatching('اعلن', 'ar'));
    expect(foldForMatching('إشاعة', 'ar')).toBe(foldForMatching('اشاعة', 'ar'));
    expect(foldForMatching('شراءً', 'ar')).toBe('شراء');
    expect(foldForMatching('الله', 'ar')).toBe('الله');
    expect(foldForMatching('كــتاب', 'ar')).toBe(foldForMatching('كتاب', 'ar'));
    expect(foldForMatching('ملكي', 'ar')).toBe(foldForMatching('ملکی', 'ar'));
    expect(foldForMatching('ىيى', 'ar')).toBe('ييي');
    expect(foldForMatching('كيك', 'ur')).toBe('کیک');
    expect(foldForMatching('ہم', 'ur')).toBe(foldForMatching('هم', 'ur'));
  });

  it('is the same function for a phrase and for a text', () => {
    for (const language of WORDING_LANGUAGES) {
      const text = 'Act NOW, don’t miss it — it is risk-free!';
      expect(foldForMatching(foldForMatching(text, language), language)).toBe(
        foldForMatching(text, language)
      );
    }
  });

  it('keeps the signs a phrase may carry', () => {
    expect(foldForMatching('A+ setup, 100% accurate', 'en')).toBe(
      'a+ setup, 100% accurate'
    );
  });
});

describe('a damaged set is refused, and every problem is named', () => {
  it('names a problem for each way a language file can be wrong', () => {
    const cases = LANGUAGE_FILE_DAMAGE;
    for (const [name, change, expected] of cases) {
      const found = problemsOf(damaged(change));
      expect({ name, found: found.some((p) => expected.test(p)) }).toEqual({
        name,
        found: true,
      });
    }
  });

  it('names a problem for each way a phrase can be wrong', () => {
    const put = (entry: unknown) => (raw: Any) =>
      (raw.languages.en.categories.ADVICE.advise = ['advice', entry]);
    const cases = PHRASE_DAMAGE;
    for (const [name, entry, expected] of cases) {
      const found = problemsOf(damaged(put(entry)));
      expect({ name, found: found.some((p) => expected.test(p)) }).toEqual({
        name,
        found: true,
      });
    }
  });

  it('accepts the forms it should', () => {
    const put = (entry: unknown) => (raw: Any) =>
      (raw.languages.en.categories.ADVICE.advise = ['advice', entry]);
    for (const entry of [
      'counsel',
      'counsel*',
      '*counsel*',
      { t: 'counsel', x: ['legal counsel'] },
      { t: 'counsel*' },
      'consultation',
      'a+ rating',
      '100% sure',
    ]) {
      expect({ entry, problems: problemsOf(damaged(put(entry))) }).toEqual({
        entry,
        problems: [],
      });
    }
  });

  it('calls a repeated phrase what it is, in the same concept or another, and after folding', () => {
    const same = problemsOf(
      damaged(
        (r) => (r.languages.en.categories.ADVICE.advise = ['advice', 'Advice'])
      )
    );
    expect(same.some((p) => /repeats an entry of ADVICE\.advise/.test(p))).toBe(
      true
    );
    const other = problemsOf(
      damaged(
        (r) =>
          (r.languages.en.categories.ADVICE.advise = ['advice', 'risk-free'])
      )
    );
    expect(
      other.some((p) =>
        /GUARANTEE\.risk_free: "risk free" repeats an entry of ADVICE\.advise/.test(
          p
        )
      )
    ).toBe(true);
    const folded = problemsOf(
      damaged(
        (r) =>
          (r.languages.en.categories.ADVICE.advise = ['advice', 'dont  miss'])
      )
    );
    expect(
      folded.some((p) =>
        /URGENCY\.dont_miss: "dont miss" repeats an entry of ADVICE\.advise/.test(
          p
        )
      )
    ).toBe(true);
    const sameModeOnly = problemsOf(
      damaged(
        (r) => (r.languages.en.categories.ADVICE.advise = ['advice', 'advice*'])
      )
    );
    expect(sameModeOnly).toEqual([]);
  });

  it('holds a language written without spaces to a different rule for short phrases', () => {
    const one = problemsOf(
      damaged((r) => (r.languages.ja.categories.ADVICE.advise = ['助言', '噂']))
    );
    expect(one.some((p) => /single character/.test(p))).toBe(true);
    const two = problemsOf(
      damaged(
        (r) => (r.languages.ja.categories.ADVICE.advise = ['助言', '忠告'])
      )
    );
    expect(two).toEqual([]);
  });

  it('names a problem for each way categories.json can be wrong', () => {
    const cases = CATEGORIES_DAMAGE;
    for (const [name, change, expected] of cases) {
      const found = problemsOf(damaged(change));
      expect({ name, found: found.some((p) => expected.test(p)) }).toEqual({
        name,
        found: true,
      });
    }
  });

  it('refuses the set when any problem is found, and says how many', () => {
    const raw = damaged((r) => {
      r.languages.de.default_mode = 'regex';
      r.languages.fr.categories.URGENCY = {};
    });
    expect(compileWording(raw).set).toBeNull();
    expect(() => loadWording(raw)).toThrow(
      /the wording lists are damaged \(\d+ problems\)/
    );
    const one = damaged((r) => (r.languages.de.default_mode = 'regex'));
    expect(() => loadWording(one)).toThrow(/\(1 problem\)/);
  });

  it('keeps going after the first problem so a person sees them all', () => {
    const found = problemsOf(
      damaged((r) => {
        r.languages.de.not_verified = '';
        r.languages.fr.not_verified = '';
        r.languages.it.not_verified = '';
      })
    );
    expect(found.filter((p) => /not_verified/.test(p))).toHaveLength(3);
  });

  it('knows the schema names the files carry', () => {
    expect(PHRASES_SCHEMA).toBe('wording-phrases/1');
    expect(CATEGORIES_SCHEMA).toBe('wording-categories/1');
  });
});

describe('foldForMatching, letter by letter', () => {
  const at = (code: number): string => String.fromCodePoint(code);

  it.each([
    ['ß', 'ss'],
    ['ø', 'o'],
    ['æ', 'ae'],
    ['œ', 'oe'],
    ['đ', 'd'],
    ['ł', 'l'],
    ['ı', 'i'],
  ])('writes %s as %s in the Latin-script languages', (letter, expected) => {
    for (const language of ['en', 'es', 'de', 'pt', 'it', 'fr', 'id', 'tr']) {
      expect(foldForMatching(`a${letter}b`, language)).toBe(`a${expected}b`);
    }
  });

  it('keeps those letters in the languages that are not Latin script, and đ in Vietnamese', () => {
    expect(foldForMatching('đô la', 'vi')).toBe('đô la');
    expect(foldForMatching('ß', 'ja')).toBe('ß');
  });

  it.each([
    [0x0623, 'alef with hamza above'],
    [0x0625, 'alef with hamza below'],
    [0x0622, 'alef with madda'],
    [0x0671, 'alef wasla'],
  ])('joins U+%s (%s) to the plain alef in Arabic and Urdu', (code) => {
    for (const language of ['ar', 'ur']) {
      expect(foldForMatching(`x${at(code)}y`, language)).toBe(
        `x${at(0x0627)}y`
      );
    }
  });

  it.each([
    [0x0649, 'alef maqsura'],
    [0x06cc, 'Farsi yeh'],
    [0x06d2, 'yeh barree'],
  ])('joins U+%s (%s) to the Arabic yeh in Arabic', (code) => {
    expect(foldForMatching(`x${at(code)}y`, 'ar')).toBe(`x${at(0x064a)}y`);
  });

  it.each([
    [0x064a, 'Arabic yeh'],
    [0x0649, 'alef maqsura'],
    [0x06d2, 'yeh barree'],
  ])('joins U+%s (%s) to the Farsi yeh in Urdu', (code) => {
    expect(foldForMatching(`x${at(code)}y`, 'ur')).toBe(`x${at(0x06cc)}y`);
  });

  it('joins the keheh and the heh forms in each language', () => {
    expect(foldForMatching(`x${at(0x06a9)}y`, 'ar')).toBe(`x${at(0x0643)}y`);
    expect(foldForMatching(`x${at(0x06c1)}y`, 'ar')).toBe(`x${at(0x0647)}y`);
    expect(foldForMatching(`x${at(0x0643)}y`, 'ur')).toBe(`x${at(0x06a9)}y`);
    expect(foldForMatching(`x${at(0x0647)}y`, 'ur')).toBe(`x${at(0x06c1)}y`);
  });

  it.each([
    [0x0640, 'tatweel'],
    [0x064b, 'fathatan'],
    [0x065f, 'wavy hamza below'],
    [0x0670, 'superscript alef'],
    [0x06d6, 'small high ligature'],
    [0x06ed, 'small low meem'],
  ])('removes U+%s (%s) from Arabic and Urdu', (code) => {
    for (const language of ['ar', 'ur']) {
      expect(foldForMatching(`x${at(code)}y`, language)).toBe('xy');
    }
  });

  it('does not touch the Arabic letters in the other languages', () => {
    expect(foldForMatching(at(0x0623), 'ja')).toBe(at(0x0623));
    expect(foldForMatching(at(0x064b), 'hi')).toBe(at(0x064b));
  });

  it.each([
    [0x0027, ''],
    [0x2018, ''],
    [0x2019, ''],
    [0x201b, ''],
    [0x02bc, ''],
    [0x0060, ''],
  ])('removes the apostrophe U+%s', (code, expected) => {
    expect(foldForMatching(`don${at(code)}t`, 'en')).toBe(`don${expected}t`);
  });

  it.each([
    0x002d, 0x2010, 0x2011, 0x2012, 0x2013, 0x2014, 0x2015, 0x2212, 0x00ad,
    0x2043,
  ])('writes the dash U+%s as a space or nothing between two words', (code) => {
    const folded = foldForMatching(`risk${at(code)}free`, 'en');
    expect(['risk free', 'riskfree']).toContain(folded);
  });

  it('writes the hyphens and dashes (not the soft hyphen) as a space', () => {
    for (const code of [
      0x002d, 0x2010, 0x2011, 0x2012, 0x2013, 0x2014, 0x2015, 0x2212, 0x2043,
    ]) {
      expect(foldForMatching(`risk${at(code)}free`, 'en')).toBe('risk free');
    }
    expect(foldForMatching(`risk${at(0x00ad)}free`, 'en')).toBe('riskfree');
  });

  it('removes a control character into a space and an invisible one into nothing', () => {
    expect(foldForMatching(`a${at(0x0001)}b`, 'en')).toBe('a b');
    expect(foldForMatching(`a${at(0x200b)}b`, 'en')).toBe('ab');
    expect(foldForMatching(`a${at(0xfe0f)}b`, 'en')).toBe('ab');
    expect(foldForMatching(`a${at(0xfeff)}b`, 'en')).toBe('a b');
    expect(foldForMatching(`a${String.fromCharCode(0xd800)}b`, 'en')).toBe(
      'ab'
    );
    expect(foldForMatching(`a${at(0x0085)}b`, 'en')).toBe('a b');
  });
});

describe('the limits of a phrase, at their exact numbers', () => {
  const put = (language: string, entries: unknown[]) => (raw: Any) =>
    (raw.languages[language].categories.ADVICE.advise = entries);
  const ok = (language: string, entries: unknown[]): boolean =>
    compileWording(damaged(put(language, entries))).problems.length === 0;

  it('allows a phrase of 60 characters and refuses 61', () => {
    expect(ok('en', ['advice', 'x'.repeat(30) + ' ' + 'y'.repeat(29)])).toBe(
      true
    );
    expect(ok('en', ['advice', 'x'.repeat(30) + ' ' + 'y'.repeat(30)])).toBe(
      false
    );
  });

  it('allows a single word of 4 letters and refuses 3', () => {
    expect(ok('en', ['advice', 'abcd'])).toBe(true);
    expect(ok('en', ['advice', 'abc'])).toBe(false);
    expect(ok('en', ['advice', 'abc def'])).toBe(true);
  });

  it('allows a phrase matched anywhere of 6 letters and refuses 5', () => {
    expect(ok('en', ['advice', '*abcdef*'])).toBe(true);
    expect(ok('en', ['advice', '*abcde*'])).toBe(false);
  });

  it('allows a mark of 60 characters and refuses 61', () => {
    const mark = (n: number) => (raw: Any) =>
      (raw.languages.en.not_verified = '—'.repeat(n));
    expect(problemsOf(damaged(mark(60)))).toEqual([]);
    expect(problemsOf(damaged(mark(61))).length).toBeGreaterThan(0);
  });

  it('holds the limits it names', () => {
    expect(WORDING_LIMITS).toEqual({
      phraseChars: 60,
      minTokenChars: 4,
      minUnspacedChars: 2,
      notVerifiedChars: 60,
    });
  });
});

describe('the corners of the loader, pinned by the mutation check', () => {
  const messages = (change: (raw: Any) => void): string[] =>
    compileWording(damaged(change)).problems;

  it('names every unknown key of an entry, separated by commas', () => {
    const found = messages(
      (r) =>
        (r.languages.en.categories.ADVICE.advise = [
          'advice',
          { t: 'counsel', y: 1, z: 2 },
        ])
    );
    expect(found.some((p) => /unknown key\(s\) y, z$/.test(p))).toBe(true);
  });

  it('names the modes it accepts, separated by commas', () => {
    const found = messages((r) => (r.categories.modes = { word: '' }));
    expect(found.some((p) => p.includes('word, prefix, substring'))).toBe(true);
  });

  it('refuses a concept that is not an object, or has an empty gloss, without throwing', () => {
    const notObject = messages(
      (r) => (r.categories.categories[0].concepts[0] = null)
    );
    expect(notObject.some((p) => /a concept with a bad id/.test(p))).toBe(true);
    expect(notObject.some((p) => /needs a gloss/.test(p))).toBe(true);
    const empty = messages(
      (r) => (r.categories.categories[0].concepts[0].gloss = '')
    );
    expect(empty.some((p) => /ADVICE\.recommend needs a gloss/.test(p))).toBe(
      true
    );
    const missing = messages(
      (r) => delete r.categories.categories[0].concepts[0].gloss
    );
    expect(missing.some((p) => /ADVICE\.recommend needs a gloss/.test(p))).toBe(
      true
    );
  });

  it('refuses a language entry with no locales, or locales that are not a list, without throwing', () => {
    const none = messages((r) => delete r.categories.languages[0].locales);
    expect(none.some((p) => /exactly the 19 locales/.test(p))).toBe(true);
    const wrong = messages(
      (r) => (r.categories.languages[0].locales = 'en-US')
    );
    expect(wrong.some((p) => /exactly the 19 locales/.test(p))).toBe(true);
    const noObject = messages((r) => (r.categories.languages[0] = 'en'));
    expect(noObject.length).toBeGreaterThan(0);
  });

  it('counts a spaced short phrase as more than one word', () => {
    const put = (entry: string) => (raw: Any) =>
      (raw.languages.en.categories.ADVICE.advise = ['advice', entry]);
    expect(messages(put('a b'))).toEqual([]);
    expect(messages(put('ab'))).not.toEqual([]);
  });

  it('writes a phrase file problem with the file, the place and the entry, once', () => {
    const found = messages(
      (r) => (r.languages.en.categories.ADVICE.advise = ['advice', ''])
    );
    expect(found).toEqual([
      'en.json: ADVICE.advise: "" is empty or has white space at an end',
    ]);
  });

  it('folds a run of white space and the dash and the control character the same, in any order', () => {
    expect(foldForMatching('a\u0001\u0001 -  b', 'en')).toBe('a b');
    expect(foldForMatching('a \t\n b', 'en')).toBe('a b');
    expect(foldForMatching('İSTEK', 'tr')).toBe('istek');
    expect(foldForMatching('Iı', 'tr')).toBe('ii');
  });
});

describe('the last corners of the loader', () => {
  const messages = (change: (raw: Any) => void): string[] =>
    compileWording(damaged(change)).problems;

  it('refuses an exception that is only white space', () => {
    const found = messages(
      (r) =>
        (r.languages.en.categories.ADVICE.advise = [
          'advice',
          { t: 'counsel', x: ['  '] },
        ])
    );
    expect(
      found.some((p) =>
        /exception of "counsel" must be a non-empty string/.test(p)
      )
    ).toBe(true);
  });

  it('holds a concept id to the whole of its pattern', () => {
    for (const id of [
      'abc!',
      'abc d',
      ' abc',
      'abc ',
      'Abc',
      '1abc',
      'a',
      'x'.repeat(33),
    ]) {
      const found = messages(
        (r) => (r.categories.categories[0].concepts[0].id = id)
      );
      expect({
        id,
        refused: found.some((p) => /a concept with a bad id/.test(p)),
      }).toEqual({ id, refused: true });
    }
    for (const id of ['abc', 'a_b', 'ab', 'x'.repeat(32)]) {
      const found = messages(
        (r) => (r.categories.categories[0].concepts[0].id = id)
      );
      expect({
        id,
        bad: found.some((p) => /a concept with a bad id/.test(p)),
      }).toEqual({ id, bad: false });
    }
  });

  it('refuses language entries that are not records, without throwing', () => {
    for (const entry of [null, 5, 'en', [], { locales: ['en-US'] }]) {
      const found = messages((r) => (r.categories.languages[0] = entry));
      expect({
        entry,
        refused: found.some((p) => /the languages must be/.test(p)),
      }).toEqual({ entry, refused: true });
    }
  });

  it('writes the lists it expects, separated by commas', () => {
    const found = messages((r) => r.categories.languages.reverse());
    expect(
      found.some((p) =>
        p.includes(
          'en, es, de, pt, it, ja, ar, fr, ko, zh, zh-TW, ur, hi, vi, id, th, tr'
        )
      )
    ).toBe(true);
    const modes = messages((r) => (r.languages.de.default_mode = 'regex'));
    expect(
      modes.some((p) =>
        p.endsWith('default_mode must be word, prefix, substring')
      )
    ).toBe(true);
  });

  it('gives no set for even one problem', () => {
    const one = compileWording(
      damaged((r) => (r.languages.de.default_mode = 'regex'))
    );
    expect(one.problems).toHaveLength(1);
    expect(one.set).toBeNull();
    const none = compileWording(SHIPPED_WORDING_FILES);
    expect(none.problems).toEqual([]);
    expect(none.set).not.toBeNull();
  });

  it('writes the error with one line a problem', () => {
    const raw = damaged((r) => {
      r.languages.de.default_mode = 'regex';
      r.languages.fr.default_mode = 'regex';
    });
    expect(() => loadWording(raw)).toThrow(
      'the wording lists are damaged (2 problems):\n- de.json: default_mode must be word, prefix, substring\n- fr.json: default_mode must be word, prefix, substring'
    );
  });
});

describe('the mode of a phrase', () => {
  it('is the language default for a plain phrase, a prefix for a trailing star and a substring for two stars', () => {
    const en = WORDING.languages.en.categories.ADVICE;
    expect(en['recommend']?.map((p) => [p.source, p.mode])).toEqual([
      ['recommend*', 'prefix'],
    ]);
    expect(en['advise']?.map((p) => [p.source, p.mode])).toEqual([
      ['advice', 'word'],
      ['advise*', 'prefix'],
      ['advisable', 'word'],
    ]);
    expect(
      WORDING.languages.de.categories.ADVICE['recommend']?.map((p) => [
        p.source,
        p.mode,
      ])
    ).toEqual([
      ['*empfehl*', 'substring'],
      ['*empfiehl*', 'substring'],
      ['*empfohlen*', 'substring'],
    ]);
    expect(
      WORDING.languages.zh.categories.ADVICE['recommend']?.every(
        (p) => p.mode === 'substring'
      )
    ).toBe(true);
    expect(
      WORDING.languages.ar.categories.ADVICE['advise']?.every(
        (p) => p.mode === 'substring'
      )
    ).toBe(true);
    expect(
      WORDING.languages.tr.categories.ADVICE['recommend']?.[0]
    ).toMatchObject({ source: 'tavsiye*', mode: 'prefix' });
  });

  it('is decided the same way for a phrase in an object', () => {
    const put = (entry: unknown) => (raw: Any) =>
      (raw.languages.en.categories.ADVICE.advise = ['advice', entry]);
    const { set } = compileWording(
      damaged(put({ t: 'counsel*', x: ['counselor'] }))
    );
    expect(set?.languages.en.categories.ADVICE['advise']?.[1]).toMatchObject({
      text: 'counsel',
      mode: 'prefix',
      except: ['counselor'],
    });
    const both = compileWording(damaged(put({ t: '*counsel*' }))).set;
    expect(both?.languages.en.categories.ADVICE['advise']?.[1]).toMatchObject({
      mode: 'substring',
    });
  });
});

describe('an entry and its stem in one list', () => {
  const put = (mode: string) => (raw: Any) => {
    raw.languages.en.default_mode = mode;
    raw.languages.en.categories.ADVICE.advise = ['advice', 'advice*'];
  };
  const repeats = (raw: RawWording): string[] =>
    compileWording(raw).problems.filter((p) =>
      /ADVICE\.advise: "advice\*" repeats an entry of ADVICE\.advise/.test(p)
    );

  it('are two entries in a language that matches whole words', () => {
    expect(repeats(damaged(put('word')))).toEqual([]);
  });

  it('are one entry written twice in a language whose default is a prefix', () => {
    expect(repeats(damaged(put('prefix')))).toHaveLength(1);
  });
});
