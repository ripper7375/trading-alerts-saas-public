/**
 * @jest-environment node
 */
/**
 * The two texts of the Turnstile check (CODE-15) exist in all 19 dictionaries, in English in the
 * two English files and as a real translation in the other 17. The English wording is what the
 * forms use as their fallback, so the two must not drift.
 */
import fs from 'fs';
import path from 'path';

const DICTIONARY_DIR = path.join(process.cwd(), 'lib/i18n/dictionaries');

const ENGLISH: Record<string, string> = {
  'auth.turnstile.failed': 'Security check failed. Please try again.',
  'auth.turnstile.unavailable':
    'The security check could not be loaded. Reload the page and try again.',
};

function load(file: string): Record<string, string> {
  return JSON.parse(
    fs.readFileSync(path.join(DICTIONARY_DIR, file), 'utf8')
  ) as Record<string, string>;
}

const files = fs
  .readdirSync(DICTIONARY_DIR)
  .filter((file) => file.endsWith('.json'))
  .sort();

describe('CODE-15: the Turnstile texts are in every dictionary', () => {
  it('finds the 19 dictionaries', () => {
    expect(files).toHaveLength(19);
  });

  describe.each(Object.keys(ENGLISH))('%s', (key) => {
    it.each(files)('%s has a non-empty text', (file) => {
      const value = load(file)[key];
      expect(typeof value).toBe('string');
      expect((value as string).trim().length).toBeGreaterThan(0);
    });

    it.each(['en-US.json', 'en-GB.json'])(
      '%s carries the English wording the forms use as a fallback',
      (file) => {
        expect(load(file)[key]).toBe(ENGLISH[key]);
      }
    );

    it('is translated in the 17 other languages (it differs from English)', () => {
      const english = load('en-GB.json')[key];
      const untranslated = files
        .filter((file) => !file.startsWith('en-'))
        .filter((file) => load(file)[key] === english);

      expect(files.filter((file) => !file.startsWith('en-'))).toHaveLength(17);
      expect(untranslated).toEqual([]);
    });
  });
});
