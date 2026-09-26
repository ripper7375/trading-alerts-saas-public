/**
 * @jest-environment node
 */
/**
 * Every language must translate every key used on the compulsory pages:
 * public marketing, auth and FREE/PRO user pages (see compulsoryPages() in
 * scripts/i18n-translation-coverage.js). Admin and affiliate pages are not
 * covered.
 *
 * A key counts as translated when its value differs from en-GB, needs no
 * translation (brand names, tickers), or is listed in
 * scripts/i18n-identical-ok.json (the correct translation equals English,
 * e.g. "Heiken Ashi"). A new key added to en-GB/en-US only fails this test.
 */
import fs from 'fs';
import path from 'path';

const coverage = require(
  path.join(process.cwd(), 'scripts/i18n-translation-coverage.js')
) as {
  loadDictionaries: () => Record<string, Record<string, string>>;
  isTranslated: (
    language: string,
    key: string,
    dicts: Record<string, Record<string, string>>
  ) => boolean;
  keysForPage: (pageFile: string, dictKeys: Set<string>) => Set<string>;
  compulsoryPages: () => string[];
  literalsOf: (file: string) => { imports: string[] };
  resolveImport: (spec: string, fromFile: string) => string | null;
};

/** A page file and every local file it imports, transitively. */
function importClosure(pages: string[]): string[] {
  const seen = new Set<string>();
  const stack = pages.map((p) => path.join(process.cwd(), p));
  while (stack.length) {
    const file = path.normalize(stack.pop() as string);
    if (seen.has(file)) continue;
    seen.add(file);
    for (const spec of coverage.literalsOf(file).imports) {
      const next = coverage.resolveImport(spec, file);
      if (next) stack.push(next);
    }
  }
  return [...seen];
}

describe('compulsory pages are translated in every language', () => {
  const dicts = coverage.loadDictionaries();
  const dictKeys = new Set(Object.keys(dicts['en-GB'] ?? {}));
  const languages = Object.keys(dicts).filter((l) => !l.startsWith('en'));
  const pages = coverage.compulsoryPages();

  it('finds the compulsory pages and every dictionary', () => {
    expect(pages.length).toBeGreaterThan(50);
    expect(pages).toContain('app/(marketing)/page.tsx');
    expect(pages).toContain('app/dashboard/page.tsx');
    expect(pages.some((p) => p.startsWith('app/admin/'))).toBe(false);
    expect(pages.some((p) => p.startsWith('app/affiliate/'))).toBe(false);
    expect(languages).toHaveLength(15);
  });

  it('every literal t()/dt() key on a compulsory page is in the dictionaries', () => {
    // A key in no dictionary always renders its English fallback, and the
    // per-language check below cannot see it. Admin-only strings (admin.*,
    // e.g. the admin "view as user" banner on Settings) may stay English.
    const call = /\b(?:t|dt)\(\s*(['"])((?:(?!\1)[^\\\n]|\\.)+)\1/g;
    const missing: string[] = [];
    for (const file of importClosure(pages)) {
      const src = fs.readFileSync(file, 'utf8');
      for (const m of src.matchAll(call)) {
        const key = (m[2] as string).replace(/\\(.)/g, '$1');
        if (!dictKeys.has(key) && !key.startsWith('admin.')) {
          missing.push(`${path.relative(process.cwd(), file)}: ${key}`);
        }
      }
    }
    expect(missing).toEqual([]);
  });

  it.each(languages)(
    '%s has no untranslated key on a compulsory page',
    (language) => {
      const missing: string[] = [];
      for (const page of pages) {
        const keys = coverage.keysForPage(
          path.join(process.cwd(), page),
          dictKeys
        );
        for (const key of keys) {
          if (!coverage.isTranslated(language, key, dicts)) {
            missing.push(`${page}: ${JSON.stringify(key)}`);
          }
        }
      }
      // Printed in full so the failure says exactly what to translate.
      expect([...new Set(missing)]).toEqual([]);
    }
  );
});
