/**
 * @jest-environment node
 */

/**
 * The fixed texts of the intake path (build step 6, part 3; architecture 4.2, 4.3, 4.4).
 *
 * `lib/intake/text.ts` is the English registry: the reply to each refusal code, the two instant
 * prompts, and one sentence per reason code. The 19 dictionaries hold the translations under
 * the same `intake.*` keys. These tests hold the two together key by key, check that every
 * translation keeps its `{name}` placeholders and is written in its own script, and read the
 * reason codes from the Python source so a new code there fails here until its text exists.
 */

import { readFileSync } from 'fs';
import { join } from 'path';

import {
  FIXED_REASON_TEXT_KEY,
  INSTANT_INTENTS,
  INSTANT_TEXT_KEY,
  INTAKE_COUNSEL_KEYS,
  INTAKE_KEYS,
  INTAKE_TEXT,
  LOCALES,
  MODIFIER_REASON_CODE,
  QUESTION_MAX_CHARS,
  REFUSAL_CODES,
  REFUSAL_TEXT_KEY,
  UPSTREAM_REASON_TEXT_KEY,
  instantTextKey,
  intakeText,
  reasonTextOf,
  refusalTextKey,
} from '@/lib/intake';
import {
  fillText,
  placeholdersOf,
  type IntakeTextKey,
} from '@/lib/intake/text';
import {
  fillText as report2Fill,
  placeholdersOf as report2Placeholders,
} from '@/lib/engine4/templates/text';

const ROOT = join(__dirname, '..', '..', '..');
const dictionary = (locale: string): Record<string, string> =>
  JSON.parse(
    readFileSync(
      join(ROOT, 'lib', 'i18n', 'dictionaries', `${locale}.json`),
      'utf8'
    )
  ) as Record<string, string>;
const DICTIONARIES = Object.fromEntries(
  LOCALES.map((locale) => [locale, dictionary(locale)])
) as Record<string, Record<string, string>>;

const intakeKeysOf = (locale: string): string[] =>
  Object.keys(DICTIONARIES[locale] as object).filter((key) =>
    key.startsWith('intake.')
  );

const ENGLISH_LOCALES = ['en-US', 'en-GB'];
const HAN = ['Han'];
/** The scripts a language's own text may use (Latin letters are always allowed beside them). */
const OWN_SCRIPTS: Record<string, string[]> = {
  ja: [...HAN, 'Hiragana', 'Katakana'],
  zh: HAN,
  'zh-TW': HAN,
  ko: ['Hangul'],
  ar: ['Arabic'],
  ur: ['Arabic'],
  hi: ['Devanagari'],
  th: ['Thai'],
};
const ALL_SCRIPTS = [
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
const scriptTest = (names: string[]): RegExp =>
  new RegExp(`[${names.map((n) => `\\p{Script=${n}}`).join('')}]`, 'u');

const IDENTICAL_OK = JSON.parse(
  readFileSync(join(ROOT, 'scripts', 'i18n-identical-ok.json'), 'utf8')
) as Record<string, string[]>;

describe('the registry', () => {
  it('holds 28 texts: 10 replies to refusals, 2 instant prompts, 16 reason texts', () => {
    expect(INTAKE_KEYS).toHaveLength(28);
    expect(
      INTAKE_KEYS.filter((k) => k.startsWith('intake.refusal.'))
    ).toHaveLength(10);
    expect(
      INTAKE_KEYS.filter((k) => k.startsWith('intake.instant.'))
    ).toHaveLength(2);
    expect(
      INTAKE_KEYS.filter((k) => k.startsWith('intake.reason.'))
    ).toHaveLength(16);
    expect(new Set(Object.values(INTAKE_TEXT)).size).toBe(28);
  });

  it('writes every key as intake.<group>.<lower_case_name>', () => {
    for (const key of INTAKE_KEYS) {
      expect(key).toMatch(/^intake\.(refusal|instant|reason)\.[a-z0-9_]+$/);
    }
  });

  it('keeps a text to one line with nothing round it, ending like a sentence or a label', () => {
    for (const [key, text] of Object.entries(INTAKE_TEXT)) {
      expect(text).toBe(text.trim());
      expect(text).not.toMatch(/[\r\n\t]/);
      if (!key.startsWith('intake.instant.')) expect(text).toMatch(/[.]$/);
    }
  });

  it('uses only the placeholders {limit}, {sensor} and {state}, once each', () => {
    const found: Record<string, string[]> = {};
    for (const [key, text] of Object.entries(INTAKE_TEXT)) {
      const names = placeholdersOf(text);
      if (names.length > 0) found[key] = names;
    }
    expect(found).toEqual({
      'intake.refusal.question_too_long': ['limit'],
      'intake.reason.upstream_cautionary': ['sensor'],
      'intake.reason.upstream_unavailable': ['sensor'],
      'intake.reason.upstream_stale': ['sensor'],
      'intake.reason.modifier_caution': ['state'],
    });
  });

  it('puts no figure in a text but the names of the two charts (the numbers come from the caller)', () => {
    for (const [key, text] of Object.entries(INTAKE_TEXT)) {
      const rest = text.replace(/\bM(5|15)\b/g, '');
      expect({ key, digits: /\d/.test(rest) }).toEqual({ key, digits: false });
    }
  });

  it('names gold and the two charts the same way in every reply that mentions them', () => {
    expect(INTAKE_TEXT['intake.refusal.out_of_scope']).toContain(
      'gold (XAUUSD)'
    );
    expect(INTAKE_TEXT['intake.refusal.out_of_scope']).toContain('M5 and M15');
    expect(INTAKE_TEXT['intake.refusal.thread_invalid']).toContain(
      'gold (XAUUSD)'
    );
    expect(INTAKE_TEXT['intake.refusal.question_empty']).toContain(
      'gold (XAUUSD)'
    );
  });

  it('marks the replies to refusals as the wording that waits for counsel', () => {
    expect([...INTAKE_COUNSEL_KEYS]).toEqual(
      INTAKE_KEYS.filter((k) => k.startsWith('intake.refusal.'))
    );
  });
});

describe('the refusal replies', () => {
  it('has a reply for every refusal code, under the key named after the code', () => {
    expect(Object.keys(REFUSAL_TEXT_KEY).sort()).toEqual(
      [...REFUSAL_CODES].sort()
    );
    for (const code of REFUSAL_CODES) {
      expect(refusalTextKey(code)).toBe(`intake.refusal.${code.toLowerCase()}`);
      expect(INTAKE_KEYS).toContain(refusalTextKey(code));
    }
  });

  it('has no refusal text without a refusal code', () => {
    const keys = INTAKE_KEYS.filter((k) => k.startsWith('intake.refusal.'));
    expect(keys.sort()).toEqual(
      REFUSAL_CODES.map((code) => `intake.refusal.${code.toLowerCase()}`).sort()
    );
  });

  it('tells a too-long question the limit of the door', () => {
    const text = intakeText('intake.refusal.question_too_long', {
      limit: String(QUESTION_MAX_CHARS),
    });
    expect(text).toContain('500 characters');
    expect(text).not.toContain('{');
    for (const locale of LOCALES) {
      const translated = fillText(
        (DICTIONARIES[locale] as Record<string, string>)[
          'intake.refusal.question_too_long'
        ] as string,
        { limit: '500' }
      );
      expect({ locale, has500: translated.includes('500') }).toEqual({
        locale,
        has500: true,
      });
    }
  });

  it('keeps the profile reply the same as the Report 2 reply, in every language', () => {
    for (const locale of LOCALES) {
      const rows = DICTIONARIES[locale] as Record<string, string>;
      expect({
        locale,
        text: rows['intake.refusal.profile_not_set'],
      }).toEqual({ locale, text: rows['report2.api.profile'] });
    }
  });
});

describe('the instant prompts', () => {
  it('has one text for each of the two instant intents', () => {
    expect(Object.keys(INSTANT_TEXT_KEY).sort()).toEqual(
      [...INSTANT_INTENTS].sort()
    );
    expect(instantTextKey('INSTANT_M5_INSPECT')).toBe('intake.instant.m5');
    expect(instantTextKey('INSTANT_M15_INSPECT')).toBe('intake.instant.m15');
  });

  it.each(LOCALES)(
    'names its own chart, and only that chart, in %s',
    (locale) => {
      const rows = DICTIONARIES[locale] as Record<string, string>;
      expect(rows['intake.instant.m5']).toMatch(/\bM5\b/);
      expect(rows['intake.instant.m5']).not.toMatch(/\bM15\b/);
      expect(rows['intake.instant.m15']).toMatch(/\bM15\b/);
      expect(rows['intake.instant.m15']).not.toMatch(/\bM5\b/);
    }
  );
});

describe('the reason texts', () => {
  /** The codes of `reason_codes.py`, read from the source: what the gateway can really emit. */
  const source = readFileSync(
    join(ROOT, 'railway-gateway', 'sensors', 'mcd_common', 'reason_codes.py'),
    'utf8'
  );
  const fixedInSource = [
    ...source.matchAll(/^([A-Z][A-Z0-9_]+) = "\1"$/gm),
  ].map((m) => m[1] as string);
  const statusNames = ['VALID', 'CAUTIONARY', 'INVALID', 'STALE'];
  const fixedCodes = fixedInSource.filter((c) => !statusNames.includes(c));
  const upstreamBlock =
    /_UPSTREAM_STATUS = \{([^}]*)\}/s.exec(source)?.[1] ?? '';
  const upstreamInSource = [
    ...upstreamBlock.matchAll(/"(UPSTREAM_[A-Z]+)"/g),
  ].map((m) => m[1] as string);

  it('reads the codes from the Python source (twelve fixed, three inherited)', () => {
    expect(fixedCodes).toHaveLength(12);
    expect(upstreamInSource).toHaveLength(3);
  });

  it('has a text for every fixed code of the source, and for no other', () => {
    expect(Object.keys(FIXED_REASON_TEXT_KEY).sort()).toEqual(
      [...fixedCodes].sort()
    );
  });

  it('has a text for every inherited code of the source, and for no other', () => {
    expect(Object.keys(UPSTREAM_REASON_TEXT_KEY).sort()).toEqual(
      [...upstreamInSource].sort()
    );
  });

  it('names each key after its code', () => {
    for (const [code, key] of Object.entries(FIXED_REASON_TEXT_KEY)) {
      expect(key).toBe(`intake.reason.${code.toLowerCase()}`);
    }
    for (const [code, key] of Object.entries(UPSTREAM_REASON_TEXT_KEY)) {
      expect(key).toBe(`intake.reason.${code.toLowerCase()}`);
    }
    expect(INTAKE_KEYS).toContain('intake.reason.modifier_caution');
  });

  it('uses every reason key for a code, and the registry has no reason text left over', () => {
    const used = [
      ...Object.values(FIXED_REASON_TEXT_KEY),
      ...Object.values(UPSTREAM_REASON_TEXT_KEY),
      'intake.reason.modifier_caution',
    ];
    expect(used.sort()).toEqual(
      INTAKE_KEYS.filter((k) => k.startsWith('intake.reason.')).sort()
    );
  });

  it('turns a fixed code into its key and no parameters', () => {
    expect(reasonTextOf('DATA_STALE')).toEqual({
      key: 'intake.reason.data_stale',
      params: {},
    });
    expect(reasonTextOf('MCD0_DEFECT_M15')).toEqual({
      key: 'intake.reason.mcd0_defect_m15',
      params: {},
    });
  });

  it('turns an inherited code into its key and the sensor it names', () => {
    expect(reasonTextOf('UPSTREAM_STALE:MCD1')).toEqual({
      key: 'intake.reason.upstream_stale',
      params: { sensor: 'MCD1' },
    });
    expect(reasonTextOf('UPSTREAM_CAUTIONARY:MCD15')).toEqual({
      key: 'intake.reason.upstream_cautionary',
      params: { sensor: 'MCD15' },
    });
    expect(reasonTextOf('UPSTREAM_UNAVAILABLE:MCD0')?.params).toEqual({
      sensor: 'MCD0',
    });
  });

  it('turns the synthesis code into its key and the state it carries', () => {
    expect(MODIFIER_REASON_CODE).toBe('MODIFIER_CAUTION');
    expect(reasonTextOf('MODIFIER_CAUTION:MCD3_CONFLICT')).toEqual({
      key: 'intake.reason.modifier_caution',
      params: { state: 'MCD3_CONFLICT' },
    });
  });

  it.each([
    '',
    'NOT_A_CODE',
    'data_stale',
    'DATA_STALE:MCD1',
    'UPSTREAM_STALE',
    'UPSTREAM_STALE:',
    'UPSTREAM_STALE:MCD16',
    'UPSTREAM_STALE:mcd1',
    'UPSTREAM_STALE:MCD01',
    'UPSTREAM_STALE:MCD1:MCD2',
    'UPSTREAM_OTHER:MCD1',
    'MODIFIER_CAUTION',
    'MODIFIER_CAUTION:',
    // no colon: the code is not cut at its last character and read as a prefix and a state
    'MODIFIER_CAUTIONX',
    'MODIFIER_CAUTION1',
    'MODIFIER_CAUTION_',
    'UPSTREAM_STALEX',
    ':MCD1',
    ':',
    'MODIFIER_CAUTION:lower',
    'MODIFIER_CAUTION:1ST',
    'MODIFIER_CAUTION:A B',
    '__proto__',
    'constructor',
    'toString',
    'hasOwnProperty',
    '__proto__:MCD1',
    'constructor:MCD1',
    'toString:MCD1',
  ])('gives no text for %p', (code) => {
    expect(reasonTextOf(code)).toBeUndefined();
  });

  it('refuses a state code longer than 64 characters', () => {
    expect(reasonTextOf(`MODIFIER_CAUTION:A${'B'.repeat(63)}`)).toBeDefined();
    expect(reasonTextOf(`MODIFIER_CAUTION:A${'B'.repeat(64)}`)).toBeUndefined();
  });

  it('fills the placeholder from the parameters of a code', () => {
    const found = reasonTextOf('UPSTREAM_STALE:MCD2');
    expect(found).toBeDefined();
    expect(intakeText(found?.key as IntakeTextKey, found?.params)).toBe(
      'MCD2 is out of date, so this one is too.'
    );
  });
});

describe('fillText and placeholdersOf', () => {
  it('fills a placeholder, leaves a missing one visible, and ignores parameters it does not use', () => {
    expect(fillText('a {x} b {y}', { x: '1' })).toBe('a 1 b {y}');
    expect(fillText('a {x}', { x: '1', z: '2' })).toBe('a 1');
    expect(fillText('a {x}')).toBe('a {x}');
    expect(fillText('{x}{x}', { x: 'ab' })).toBe('abab');
  });

  it('does not run a parameter as a pattern or fill from the prototype', () => {
    expect(fillText('a {x}', { x: '$&' })).toBe('a $&');
    expect(fillText('a {toString}', {})).toBe('a {toString}');
    expect(fillText('a {constructor}', {})).toBe('a {constructor}');
  });

  it('lists the placeholders of a text, sorted', () => {
    expect(placeholdersOf('{b} and {a} and {b}')).toEqual(['a', 'b', 'b']);
    expect(placeholdersOf('none')).toEqual([]);
  });

  it('behaves exactly as the Report 2 helpers it repeats', () => {
    const samples: [string, Record<string, string> | undefined][] = [
      ['a {x} b {y}', { x: '1' }],
      ['{x}{x}', { x: 'ab' }],
      ['plain', undefined],
      ['a {toString}', {}],
      ['{a} {b} {c}', { a: '1', b: '2', c: '3' }],
      ['{a_b} {A1}', { a_b: 'x', A1: 'y' }],
    ];
    for (const [text, params] of samples) {
      expect(fillText(text, params)).toBe(report2Fill(text, params));
      expect(placeholdersOf(text)).toEqual(report2Placeholders(text));
    }
  });
});

describe('the 19 dictionaries', () => {
  it('hold exactly the 28 intake keys of the registry, in en-US and en-GB with the registry text', () => {
    for (const locale of ENGLISH_LOCALES) {
      expect(intakeKeysOf(locale)).toEqual(INTAKE_KEYS);
      for (const key of INTAKE_KEYS) {
        expect((DICTIONARIES[locale] as Record<string, string>)[key]).toBe(
          INTAKE_TEXT[key]
        );
      }
    }
  });

  it.each(LOCALES)(
    'hold exactly the registry keys in %s, in the order of the registry',
    (locale) => {
      expect(intakeKeysOf(locale)).toEqual(INTAKE_KEYS);
    }
  );

  it.each(LOCALES)(
    'keep the placeholders of the English in every %s text',
    (locale) => {
      const rows = DICTIONARIES[locale] as Record<string, string>;
      const wrong: string[] = [];
      for (const key of INTAKE_KEYS) {
        const want = placeholdersOf(INTAKE_TEXT[key]);
        const have = placeholdersOf(rows[key] as string);
        if (JSON.stringify(want) !== JSON.stringify(have))
          wrong.push(`${key}: ${have.join(',')} instead of ${want.join(',')}`);
      }
      expect(wrong).toEqual([]);
    }
  );

  it.each(LOCALES)(
    'write every %s text with something in it and nothing round it',
    (locale) => {
      const rows = DICTIONARIES[locale] as Record<string, string>;
      for (const key of INTAKE_KEYS) {
        const text = rows[key] as string;
        expect(typeof text).toBe('string');
        expect(text.length).toBeGreaterThan(5);
        expect(text).toBe(text.trim());
        expect(text).not.toMatch(/[\r\n\t]/);
      }
    }
  );

  it.each(LOCALES.filter((l) => !ENGLISH_LOCALES.includes(l)))(
    'translate every %s text: none is left in English unless the allow-list says so',
    (locale) => {
      const rows = DICTIONARIES[locale] as Record<string, string>;
      const allowed = new Set(IDENTICAL_OK[locale] ?? []);
      const left = INTAKE_KEYS.filter(
        (key) =>
          rows[key] === INTAKE_TEXT[key] &&
          !allowed.has(key) &&
          !allowed.has(INTAKE_TEXT[key])
      );
      expect(left).toEqual([]);
    }
  );

  it.each(LOCALES.filter((l) => OWN_SCRIPTS[l] !== undefined))(
    'write every %s text in the script of the language',
    (locale) => {
      const rows = DICTIONARIES[locale] as Record<string, string>;
      const own = scriptTest(OWN_SCRIPTS[locale] as string[]);
      const missing = INTAKE_KEYS.filter(
        (key) => !own.test(rows[key] as string)
      );
      expect(missing).toEqual([]);
    }
  );

  it.each(LOCALES)(
    'write no %s text in a script the language does not use',
    (locale) => {
      const rows = DICTIONARIES[locale] as Record<string, string>;
      const foreign = scriptTest(
        ALL_SCRIPTS.filter(
          (name) => !(OWN_SCRIPTS[locale] ?? []).includes(name)
        )
      );
      const wrong = INTAKE_KEYS.filter((key) =>
        foreign.test(rows[key] as string)
      );
      expect(wrong).toEqual([]);
    }
  );

  it('use the right-to-left marks of no text: the page sets the direction, not the words', () => {
    for (const locale of LOCALES) {
      const rows = DICTIONARIES[locale] as Record<string, string>;
      for (const key of INTAKE_KEYS) {
        expect(rows[key]).not.toMatch(/[‎‏‪-‮⁦-⁩]/u);
      }
    }
  });

  it('differ between British and American English only where the registry says nothing (they are the same)', () => {
    for (const key of INTAKE_KEYS) {
      expect((DICTIONARIES['en-GB'] as Record<string, string>)[key]).toBe(
        (DICTIONARIES['en-US'] as Record<string, string>)[key]
      );
    }
  });
});

describe('the Panel C labels part 3 translated', () => {
  const LABELS = [
    'Ask AI about M5 Chart',
    'Ask AI about M15 Chart',
    'Click to ask AI about M5 chart situation',
    'Click to ask AI about M15 chart situation',
  ];
  const SIX = ['ar', 'fr', 'it', 'ko', 'zh', 'zh-TW'];

  it.each(SIX)(
    'has the four labels of %s translated, naming the right chart',
    (locale) => {
      const rows = DICTIONARIES[locale] as Record<string, string>;
      for (const key of LABELS) {
        expect(rows[key]).not.toBe(key);
        const chart = key.includes('M15') ? 'M15' : 'M5';
        const other = chart === 'M15' ? /\bM5\b/ : /\bM15\b/;
        expect(rows[key]).toMatch(new RegExp(`\\b${chart}\\b`));
        expect(rows[key]).not.toMatch(other);
      }
    }
  );

  it.each(['ar', 'ko', 'zh', 'zh-TW'])(
    "writes the %s labels in the language's script",
    (locale) => {
      const own = scriptTest(OWN_SCRIPTS[locale] as string[]);
      const rows = DICTIONARIES[locale] as Record<string, string>;
      for (const key of LABELS) expect(rows[key]).toMatch(own);
    }
  );

  it('leaves the labels of the other locales as they were (English in en-US and en-GB)', () => {
    for (const locale of ENGLISH_LOCALES) {
      const rows = DICTIONARIES[locale] as Record<string, string>;
      for (const key of LABELS) expect(rows[key]).toBe(key);
    }
  });

  it('has no label still in English in any locale but the two English ones', () => {
    for (const locale of LOCALES.filter((l) => !ENGLISH_LOCALES.includes(l))) {
      const rows = DICTIONARIES[locale] as Record<string, string>;
      for (const key of LABELS) {
        expect({ locale, key, same: rows[key] === key }).toEqual({
          locale,
          key,
          same: false,
        });
      }
    }
  });
});
