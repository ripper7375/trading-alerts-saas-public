/**
 * @jest-environment node
 */

/**
 * The chat panel is translated in all 19 languages (build step 7 part 8; ADR-098 D14: "a draft in all
 * 19 languages ships, and the flag stays off"; the compulsory-translation test counts the 17
 * non-English files).
 *
 * The panel's own words live in one registry (`components/chat/text.ts`), so this test holds THAT to
 * every dictionary, key by key and language by language, with no fallback gaps:
 *
 *  - every dictionary has every key, as a non-empty string;
 *  - the two English dictionaries are exactly the registry (so the `t()` fallback in the code and the
 *    dictionary can never disagree);
 *  - every other language has a real translation: not the English text (unless the project's reviewed
 *    list says the word is the same in that language), and written in its own script;
 *  - a translation keeps every `{placeholder}` of the English, no more and no fewer;
 *  - no dictionary holds a `chat.` key the registry does not know (the older `chat.` keys of the
 *    support widget are named below);
 *  - no component draws user-facing English that bypasses the registry;
 *  - the older keys the panel reuses are translated everywhere.
 */

import { readdirSync, readFileSync, statSync } from 'fs';
import { join, resolve } from 'path';
import * as ts from 'typescript';

import {
  CHAT_KEYS,
  CHAT_TEXT,
  DRAFT_TEXT_KEYS,
  fillText,
  placeholdersOf,
} from '@/components/chat/text';
import { SUPPORTED_LANGUAGE_CODES, textDirection } from '@/lib/i18n/languages';

const ROOT = resolve(__dirname, '..', '..', '..');

const coverage = require(
  join(ROOT, 'scripts/i18n-translation-coverage.js')
) as {
  loadDictionaries: () => Record<string, Record<string, string>>;
  isTranslated: (
    language: string,
    key: string,
    dicts: Record<string, Record<string, string>>
  ) => boolean;
};

const dicts = coverage.loadDictionaries();
const LANGUAGES = [...SUPPORTED_LANGUAGE_CODES];
const OTHERS = LANGUAGES.filter((language) => !language.startsWith('en-'));

/** The `chat.` keys older than this panel: the support widget's. They are not the registry's. */
const OLDER_CHAT_KEYS = new Set(
  Object.keys(dicts['en-GB'] as object).filter(
    (key) => key.startsWith('chat.') && !(key in CHAT_TEXT)
  )
);

/** The script a translation must be written in, for the languages that do not use the Latin alphabet. */
const SCRIPT: Record<string, RegExp> = {
  ar: /[؀-ۿ]/,
  ur: /[؀-ۿ]/,
  hi: /[ऀ-ॿ]/,
  ja: /[぀-ヿ一-鿿]/,
  ko: /[가-힯]/,
  th: /[฀-๿]/,
  zh: /[一-鿿]/,
  'zh-TW': /[一-鿿]/,
};

describe('the 19 dictionaries', () => {
  it('are exactly the languages the app offers', () => {
    expect(LANGUAGES).toHaveLength(19);
    expect(Object.keys(dicts).sort()).toEqual([...LANGUAGES].sort());
  });

  it('the registry is not empty, every key is in the chat namespace, and none is written twice', () => {
    expect(CHAT_KEYS.length).toBeGreaterThan(100);
    expect(CHAT_KEYS.every((key) => key.startsWith('chat.'))).toBe(true);
    expect(new Set(CHAT_KEYS).size).toBe(CHAT_KEYS.length);
  });

  test.each(LANGUAGES)('%s has every key as a non-empty string', (language) => {
    const dictionary = dicts[language] as Record<string, string>;
    const missing = CHAT_KEYS.filter((key) => {
      const value = dictionary[key];
      return typeof value !== 'string' || value.trim() === '';
    });
    expect(missing).toEqual([]);
  });

  test.each(['en-GB', 'en-US'])(
    '%s is exactly the registry, so the fallback and the dictionary agree',
    (language) => {
      const dictionary = dicts[language] as Record<string, string>;
      expect(
        CHAT_KEYS.filter((key) => dictionary[key] !== CHAT_TEXT[key])
      ).toEqual([]);
    }
  );

  test.each(OTHERS)(
    '%s is really translated: no English copy, no gap, on the project’s own rule',
    (language) => {
      const untranslated = CHAT_KEYS.filter(
        (key) => !coverage.isTranslated(language, key, dicts)
      );
      expect(untranslated).toEqual([]);
    }
  );

  test.each(OTHERS)(
    '%s keeps every {placeholder} of the English, no more and no fewer',
    (language) => {
      const dictionary = dicts[language] as Record<string, string>;
      const wrong = CHAT_KEYS.filter(
        (key) =>
          JSON.stringify(placeholdersOf(dictionary[key] as string).sort()) !==
          JSON.stringify(placeholdersOf(CHAT_TEXT[key]).sort())
      );
      expect(wrong).toEqual([]);
    }
  );

  test.each(Object.keys(SCRIPT))(
    '%s is written in its own script',
    (language) => {
      const dictionary = dicts[language] as Record<string, string>;
      const script = SCRIPT[language] as RegExp;
      const latinWords = (text: string): boolean =>
        /[A-Za-z]{3,}/.test(text.replace(/\{\w+\}/g, ''));
      const latinOnly = CHAT_KEYS.filter((key) => {
        const text = dictionary[key] as string;
        return (
          /[a-z]{3,}/.test(CHAT_TEXT[key]) &&
          latinWords(text) &&
          !script.test(text)
        );
      });
      expect(latinOnly).toEqual([]);
    }
  );

  test.each(OTHERS)('%s leaves no braces or markers behind', (language) => {
    const dictionary = dicts[language] as Record<string, string>;
    const bad = CHAT_KEYS.filter((key) => {
      const text = dictionary[key] as string;
      return (
        text.replace(/\{\w+\}/g, '').match(/[{}]/) !== null ||
        /\b(TODO|FIXME|XXX|lorem)\b/i.test(text) ||
        text !== text.trim() ||
        / {2}/.test(text)
      );
    });
    expect(bad).toEqual([]);
  });

  test.each(LANGUAGES)(
    '%s holds no chat key the registry does not know',
    (language) => {
      const known = new Set<string>(CHAT_KEYS);
      const orphans = Object.keys(dicts[language] as object).filter(
        (key) =>
          key.startsWith('chat.') &&
          !known.has(key) &&
          !OLDER_CHAT_KEYS.has(key)
      );
      expect(orphans).toEqual([]);
    }
  );

  it('the older chat keys of the support widget were not touched by this panel', () => {
    expect(OLDER_CHAT_KEYS.size).toBeGreaterThan(0);
    for (const key of OLDER_CHAT_KEYS) {
      expect(CHAT_KEYS).not.toContain(key);
    }
  });

  it('the wording that waits for counsel is a real translation in every language (the draft list)', () => {
    expect(DRAFT_TEXT_KEYS.length).toBeGreaterThan(5);
    for (const key of DRAFT_TEXT_KEYS) expect(key in CHAT_TEXT).toBe(true);
    for (const language of OTHERS) {
      for (const key of DRAFT_TEXT_KEYS) {
        expect(coverage.isTranslated(language, key, dicts)).toBe(true);
      }
    }
  });

  it('the two sentences that matter say the same thing in every language: the reader decides and places any order, and the direction is not the AI’s', () => {
    // what must survive translation untouched: a name, a code, a figure
    for (const language of LANGUAGES) {
      const dictionary = dicts[language] as Record<string, string>;
      expect(dictionary['chat.empty.body']).toContain('XAUUSD');
      expect(dictionary['chat.empty.body']).toContain('M15');
      expect(dictionary['chat.empty.body']).toContain('M5');
      expect(dictionary['chat.composer.placeholder']).toContain('XAUUSD');
      expect(dictionary['chat.section.alignment']).toContain('M15');
      expect(dictionary['chat.model.locked']).toContain('PRO');
      expect(dictionary['chat.free.body']).toContain('PRO');
      expect(dictionary['chat.demo.body']).toContain('PRO');
      expect(dictionary['chat.instant.INSTANT_M15_INSPECT']).toContain('M15');
      expect(dictionary['chat.instant.INSTANT_M5_INSPECT']).toContain('M5');
    }
  });

  it('Arabic and Urdu are right to left; the other seventeen are not', () => {
    for (const language of LANGUAGES) {
      expect(textDirection(language)).toBe(
        language === 'ar' || language === 'ur' ? 'rtl' : 'ltr'
      );
    }
  });

  it('no text is long enough to break a narrow panel on its own', () => {
    for (const language of LANGUAGES) {
      const dictionary = dicts[language] as Record<string, string>;
      for (const key of CHAT_KEYS) {
        expect((dictionary[key] as string).length).toBeLessThanOrEqual(260);
      }
    }
  });

  it('the older keys the panel reuses are translated in every language', () => {
    for (const key of [
      'AI Analyst',
      'Collapse panel',
      'Show AI Analyst',
      'dashboard.upgrade_to_pro',
      'settings.security.close',
    ]) {
      for (const language of LANGUAGES) {
        const value = (dicts[language] as Record<string, string>)[key];
        expect({
          language,
          key,
          has: typeof value === 'string' && value !== '',
        }).toEqual({
          language,
          key,
          has: true,
        });
        expect(coverage.isTranslated(language, key, dicts)).toBe(true);
      }
    }
  });
});

describe('fillText', () => {
  it('fills the placeholders it is given and leaves the others as written', () => {
    expect(fillText('Cycle {time} {x}', { time: '20:55' })).toBe(
      'Cycle 20:55 {x}'
    );
    expect(fillText('Rule {rule}')).toBe('Rule {rule}');
    expect(fillText('{a}{a}', { a: '1' })).toBe('11');
  });

  it('does not run a placeholder named like an inherited property', () => {
    expect(fillText('{toString}', {})).toBe('{toString}');
  });

  it('every text of the registry that has placeholders names them once or more, in {word} form only', () => {
    for (const key of CHAT_KEYS) {
      const text = CHAT_TEXT[key];
      expect(text.replace(/\{\w+\}/g, '').match(/[{}]/)).toBeNull();
    }
  });
});

// ---------------------------------------------------------------------------
// No user-facing English outside the registry
// ---------------------------------------------------------------------------

function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...sourceFiles(full));
    else if (/\.tsx$/.test(entry)) out.push(full);
  }
  return out;
}

describe('the components', () => {
  const files = [
    ...sourceFiles(join(ROOT, 'components', 'chat')),
    join(ROOT, 'components', 'chat-panel.tsx'),
  ];

  test('there are components to check', () => {
    expect(files.length).toBeGreaterThanOrEqual(20);
  });

  /** JSX text with letters, and spoken attributes written as plain strings, in one TSX source */
  const literalsIn = (name: string, text: string): string[] => {
    const SPOKEN = new Set([
      'aria-label',
      'aria-description',
      'aria-placeholder',
      'title',
      'placeholder',
      'alt',
    ]);
    const source = ts.createSourceFile(
      name,
      text,
      ts.ScriptTarget.ES2020,
      true,
      ts.ScriptKind.TSX
    );
    const found: string[] = [];
    const visit = (node: ts.Node): void => {
      if (ts.isJsxText(node) && /[A-Za-z]{2,}/.test(node.text)) {
        found.push(`text "${node.text.trim()}"`);
      }
      if (
        ts.isJsxAttribute(node) &&
        SPOKEN.has(node.name.getText(source)) &&
        node.initializer !== undefined &&
        ts.isStringLiteral(node.initializer) &&
        /[A-Za-z]{2,}/.test(node.initializer.text)
      ) {
        found.push(`${node.name.getText(source)}="${node.initializer.text}"`);
      }
      ts.forEachChild(node, visit);
    };
    visit(source);
    return found;
  };

  test('none draws a word of its own: no JSX text with letters, no label, title or alt written as a plain string', () => {
    const offenders: string[] = [];
    for (const file of files) {
      for (const found of literalsIn(file, readFileSync(file, 'utf8'))) {
        offenders.push(`${file.slice(ROOT.length + 1)}: ${found}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  test('the guard sees what it should: JSX text and a plain label are caught, an expression is not', () => {
    expect(
      literalsIn(
        'a.tsx',
        'export const a = <p title="Hello there">Plain words</p>;'
      ).sort()
    ).toEqual(['text "Plain words"', 'title="Hello there"']);
    expect(
      literalsIn('b.tsx', 'export const b = <p title={t("k")}>{t("k")}</p>;')
    ).toEqual([]);
  });

  test('every key a component asks for is in the registry (or is one of the older keys the panel reuses)', () => {
    const REUSED = new Set([
      'AI Analyst',
      'Collapse panel',
      'Show AI Analyst',
      'dashboard.upgrade_to_pro',
      'settings.security.close',
    ]);
    const unknown: string[] = [];
    for (const file of files) {
      const source = readFileSync(file, 'utf8');
      for (const match of source.matchAll(/\btr\(\s*'(chat\.[^']+)'/g)) {
        if (!((match[1] as string) in CHAT_TEXT))
          unknown.push(`${file.slice(ROOT.length + 1)}: ${match[1]}`);
      }
      for (const match of source.matchAll(/\bt\(\s*'([^']+)'/g)) {
        const key = match[1] as string;
        if (!REUSED.has(key))
          unknown.push(`${file.slice(ROOT.length + 1)}: t('${key}')`);
      }
    }
    expect(unknown).toEqual([]);
  });

  test('every component that shows a word reads it through useChatWords (useLocale underneath)', () => {
    const withText = files.filter((file) =>
      /\btr\(/.test(readFileSync(file, 'utf8'))
    );
    expect(withText.length).toBeGreaterThanOrEqual(15);
    for (const file of withText) {
      expect(readFileSync(file, 'utf8')).toContain('useChatWords');
    }
  });

  test('the hook is built on useLocale, and the dates go through the shared formatter', () => {
    const hook = readFileSync(
      join(ROOT, 'components/chat/use-chat-words.ts'),
      'utf8'
    );
    expect(hook).toContain("from '@/lib/context/locale-context'");
    expect(hook).toContain('useLocale()');
    expect(hook).toContain('formatDateTime');
  });

  test('no component formats money or a date of its own: no formatCurrency, toLocaleString, toFixed in a component, no date-fns', () => {
    const code = (text: string): string =>
      text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    for (const file of [...files, join(ROOT, 'components/chat/format.ts')]) {
      const source = code(readFileSync(file, 'utf8'));
      expect({
        file: file.slice(ROOT.length + 1),
        bad: /\bformatCurrency\s*\(|toLocaleString\(|toLocaleDateString\(|date-fns/.test(
          source
        ),
      }).toEqual({
        file: file.slice(ROOT.length + 1),
        bad: false,
      });
    }
  });
});
