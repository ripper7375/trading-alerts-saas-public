/**
 * @jest-environment node
 */

/**
 * Report 2 is translated in all 19 languages (build step 5, part 7; plan decision
 * D14: "a draft in all 19 languages ships, and the flag stays off"; ADR-081 makes
 * the safety texts a release gate).
 *
 * The existing compulsory-translation test walks the pages under `app/`, and the
 * development preview route is deliberately outside it. Report 2's own words live in
 * one registry (`lib/engine4/templates/text.ts`), so this test holds THAT to every
 * dictionary, key by key and language by language, with no fallback gaps:
 *
 *  - every dictionary has every key, as a non-empty string;
 *  - the two English dictionaries are exactly the registry (so the `t()` fallback in
 *    the code and the dictionary can never disagree);
 *  - every other language has a real translation: not the English text (unless it is
 *    a loanword the project's reviewed list names, or has no words to translate), and
 *    written in its own script;
 *  - a translation keeps every `{placeholder}` of the English, no more and no fewer;
 *  - no dictionary holds a `report2.` key the registry does not know;
 *  - no component draws user-facing English that bypasses the registry.
 */

import { readdirSync, readFileSync, statSync } from 'fs';
import { join, resolve } from 'path';
import * as ts from 'typescript';

import { SUPPORTED_LANGUAGE_CODES, textDirection } from '@/lib/i18n/languages';
import {
  DRAFT_TEXT_KEYS,
  REPORT2_KEYS,
  REPORT2_TEXT,
  placeholdersOf,
} from '@/lib/engine4/templates/text';

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
  test('are exactly the languages the app offers', () => {
    expect(LANGUAGES).toHaveLength(19);
    expect(Object.keys(dicts).sort()).toEqual([...LANGUAGES].sort());
  });

  test('the registry is not empty and every key is in the project’s namespace', () => {
    expect(REPORT2_KEYS.length).toBeGreaterThan(150);
    expect(REPORT2_KEYS.every((key) => key.startsWith('report2.'))).toBe(true);
  });

  test.each(LANGUAGES)('%s has every key as a non-empty string', (language) => {
    const dictionary = dicts[language] as Record<string, string>;
    const missing = REPORT2_KEYS.filter((key) => {
      const value = dictionary[key];
      return typeof value !== 'string' || value.trim() === '';
    });
    expect(missing).toEqual([]);
  });

  test.each(['en-GB', 'en-US'])(
    '%s is exactly the registry, so the fallback and the dictionary agree',
    (language) => {
      const dictionary = dicts[language] as Record<string, string>;
      const different = REPORT2_KEYS.filter(
        (key) => dictionary[key] !== REPORT2_TEXT[key]
      );
      expect(different).toEqual([]);
    }
  );

  test.each(OTHERS)(
    '%s is really translated: no English copy, no gap, on the project’s own rule',
    (language) => {
      const untranslated = REPORT2_KEYS.filter(
        (key) => !coverage.isTranslated(language, key, dicts)
      );
      expect(untranslated).toEqual([]);
    }
  );

  test.each(OTHERS)(
    '%s keeps every {placeholder} of the English, no more and no fewer',
    (language) => {
      const dictionary = dicts[language] as Record<string, string>;
      const wrong = REPORT2_KEYS.filter(
        (key) =>
          JSON.stringify(placeholdersOf(dictionary[key] as string)) !==
          JSON.stringify(placeholdersOf(REPORT2_TEXT[key]))
      );
      expect(wrong).toEqual([]);
    }
  );

  test.each(Object.keys(SCRIPT))(
    '%s is written in its own script',
    (language) => {
      const dictionary = dicts[language] as Record<string, string>;
      const script = SCRIPT[language] as RegExp;
      // English left behind is Latin words in a text that has none of the script. A text
      // with no words at all (the range "{min} ~ {max}.") has nothing to leave behind.
      const latinWords = (text: string): boolean =>
        /[A-Za-z]{3,}/.test(text.replace(/\{\w+\}/g, ''));
      const latinOnly = REPORT2_KEYS.filter((key) => {
        const text = dictionary[key] as string;
        return (
          /[a-z]{3,}/.test(REPORT2_TEXT[key]) &&
          latinWords(text) &&
          !script.test(text)
        );
      });
      expect(latinOnly).toEqual([]);
    }
  );

  test.each(OTHERS)('%s leaves no braces or markers behind', (language) => {
    const dictionary = dicts[language] as Record<string, string>;
    const bad = REPORT2_KEYS.filter((key) => {
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
    '%s holds no report2 key the registry does not know',
    (language) => {
      const known = new Set<string>(REPORT2_KEYS);
      const orphans = Object.keys(dicts[language] as object).filter(
        (key) => key.startsWith('report2.') && !known.has(key)
      );
      expect(orphans).toEqual([]);
    }
  );

  test('the compulsory wording and the three buttons are translated everywhere (the draft list)', () => {
    for (const language of OTHERS) {
      for (const key of DRAFT_TEXT_KEYS) {
        expect(coverage.isTranslated(language, key, dicts)).toBe(true);
      }
    }
  });

  test('the sentence that matters says the same thing in every language: the trader places the order, DavinTrade does not', () => {
    // a name that must survive translation untouched
    for (const language of LANGUAGES) {
      const text = (dicts[language] as Record<string, string>)[
        'report2.notice.broker_order'
      ] as string;
      expect(text).toContain('DavinTrade');
    }
  });

  test('Arabic and Urdu are right to left; the other seventeen are not', () => {
    for (const language of LANGUAGES) {
      expect(textDirection(language)).toBe(
        language === 'ar' || language === 'ur' ? 'rtl' : 'ltr'
      );
    }
  });

  test('no text is long enough to break a phone screen on its own', () => {
    for (const language of LANGUAGES) {
      const dictionary = dicts[language] as Record<string, string>;
      for (const key of REPORT2_KEYS) {
        expect((dictionary[key] as string).length).toBeLessThanOrEqual(260);
      }
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
  const files = sourceFiles(join(ROOT, 'components', 'report2'));

  test('there are components to check', () => {
    expect(files.length).toBeGreaterThanOrEqual(10);
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

  test('every component that shows text reads it through useReport2 (useLocale underneath)', () => {
    const withText = files.filter((file) =>
      /\btr\(|\bsay\(/.test(readFileSync(file, 'utf8'))
    );
    expect(withText.length).toBeGreaterThanOrEqual(8);
    for (const file of withText) {
      expect(readFileSync(file, 'utf8')).toContain('useReport2');
    }
  });

  test('the hook is built on useLocale, and the money and dates go through the shared formatters', () => {
    const hook = readFileSync(
      join(ROOT, 'components/report2/use-report2.ts'),
      'utf8'
    );
    expect(hook).toContain("from '@/lib/context/locale-context'");
    expect(hook).toContain('useLocale()');
    expect(hook).toContain('formatDateTime');
    const format = readFileSync(
      join(ROOT, 'components/report2/format.ts'),
      'utf8'
    );
    expect(format).toContain("from '@/lib/billing/invoice-amounts'");
    expect(format).toContain('formatChargedAmount');
    // never the converting formatter: it would turn the trader's dollars into another
    // currency (a comment may name it; code may not call it)
    const code = (text: string): string =>
      text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    expect(code(format)).not.toMatch(/\bformatCurrency\s*\(/);
    // and no local ad-hoc formatter of money or dates
    for (const file of files) {
      const source = code(readFileSync(file, 'utf8'));
      expect(source).not.toMatch(/\bformatCurrency\s*\(/);
      expect(source).not.toMatch(
        /toLocaleString\(|toLocaleDateString\(|toFixed\(|date-fns/
      );
    }
  });
});
