/**
 * Regression tests for Italian / Brazilian-Portuguese dictionary quality.
 *
 * The `{plural}` placeholder is replaced in code with an English "s" (or "").
 * Combined with a slash form ("giorno/i{plural}") it rendered "3 giorno/is fa",
 * so languages that use slash/parenthesis forms must not carry `{plural}`.
 *
 * @module __tests__/lib/i18n/dictionary-placeholders.test
 */

import enGB from '@/lib/i18n/dictionaries/en-GB.json';
import itDict from '@/lib/i18n/dictionaries/it.json';
import ptBR from '@/lib/i18n/dictionaries/pt-BR.json';

type Dict = Record<string, string>;

const reference = enGB as Dict;
const LANGS: Array<[string, Dict]> = [
  ['it', itDict as Dict],
  ['pt-BR', ptBR as Dict],
];

/** Same substitution the app performs (e.g. app/settings/security/activity/page.tsx). */
function render(template: string, n: number): string {
  return template
    .replace('{n}', String(n))
    .replace('{count}', String(n))
    .replace('{plural}', n === 1 ? '' : 's');
}

const pluralKeys = Object.keys(reference).filter((k) =>
  reference[k]!.includes('{plural}')
);

describe.each(LANGS)('%s dictionary placeholders', (_lang, dict) => {
  it('has a plural-aware key set to test', () => {
    expect(pluralKeys.length).toBeGreaterThan(0);
  });

  it.each(pluralKeys)(
    '%s never glues the English "s" onto a slash/paren form',
    (key) => {
      const value = dict[key]!;
      expect(value).not.toMatch(/[/)]\{plural\}/);
      for (const n of [1, 2, 5]) {
        expect(render(value, n)).not.toMatch(/\/[a-zà-ú]*s\b/i);
        expect(render(value, n)).not.toContain('{');
      }
    }
  );

  it('keeps every {n}/{count} variable that en-GB uses', () => {
    const bad: string[] = [];
    for (const key of Object.keys(reference)) {
      const vars = (reference[key]!.match(/\{(n|count)\}/g) ?? []).sort();
      const got = (String(dict[key]).match(/\{(n|count)\}/g) ?? []).sort();
      if (JSON.stringify(vars) !== JSON.stringify(got)) bad.push(key);
    }
    expect(bad).toEqual([]);
  });
});

describe('it dictionary user-facing strings', () => {
  it.each([
    'settings.language_title',
    'settings.save_btn',
    'settings.saved_btn',
    'settings.nav.billing',
    'settings.nav.security',
    'nav.pricing',
    'time.days_ago',
    'time.just_now',
  ])('%s is translated (differs from en-GB)', (key) => {
    expect((itDict as Dict)[key]).toBeTruthy();
    expect((itDict as Dict)[key]).not.toBe(reference[key]);
  });

  it('renders Italian relative time without a stray English suffix', () => {
    const d = itDict as Dict;
    expect(render(d['settings.security.days_ago']!, 3)).toBe('3 giorno/i fa');
    expect(render(d['settings.security.hours_ago']!, 1)).toBe('1 ora/e fa');
  });
});
