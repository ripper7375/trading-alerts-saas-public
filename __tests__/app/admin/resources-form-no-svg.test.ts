/**
 * @jest-environment node
 *
 * CODE-12: the Media Kit refuses SVG uploads, so the admin form must not offer
 * them: not in the file picker's `accept` list and not in the helper texts it
 * shows in any of the 19 languages.
 */

import fs from 'fs';
import path from 'path';

const ROOT = path.resolve(__dirname, '../../..');
const PAGE = path.join(ROOT, 'app/admin/resources/page.tsx');
const DICTIONARIES = path.join(ROOT, 'lib/i18n/dictionaries');

const FORM_KEYS = [
  'admin.resources.file_support_note',
  'admin.resources.format_placeholder',
] as const;

const locales = fs
  .readdirSync(DICTIONARIES)
  .filter((file) => file.endsWith('.json'))
  .sort();

describe('admin Media Kit upload form (no SVG)', () => {
  it('lists all 19 dictionaries', () => {
    expect(locales).toHaveLength(19);
  });

  it('the file picker accepts PNG, JPG, MP4 and PDF only', () => {
    const source = fs.readFileSync(PAGE, 'utf8');
    const accept = /id="asset-file"[\s\S]*?accept="([^"]*)"/.exec(source);

    expect(accept).not.toBeNull();
    expect(accept?.[1].split(',').sort()).toEqual([
      '.jpeg',
      '.jpg',
      '.mp4',
      '.pdf',
      '.png',
    ]);
  });

  it('the English fallbacks in the page name no SVG', () => {
    const source = fs.readFileSync(PAGE, 'utf8');

    for (const key of FORM_KEYS) {
      const at = source.indexOf(`'${key}'`);
      expect(at).toBeGreaterThan(-1);
      const fallback = /,\s*'([^']*)'/.exec(source.slice(at))?.[1] ?? '';
      expect(fallback).not.toBe('');
      expect(fallback).not.toMatch(/svg/i);
    }
  });

  it.each(locales)('%s names no SVG in the form texts', (file) => {
    const dictionary = JSON.parse(
      fs.readFileSync(path.join(DICTIONARIES, file), 'utf8')
    ) as Record<string, string>;

    for (const key of FORM_KEYS) {
      expect(typeof dictionary[key]).toBe('string');
      expect(dictionary[key]).not.toMatch(/svg/i);
    }
  });

  it('the upload note still names the formats that are accepted', () => {
    for (const file of ['en-US.json', 'en-GB.json']) {
      const dictionary = JSON.parse(
        fs.readFileSync(path.join(DICTIONARIES, file), 'utf8')
      ) as Record<string, string>;

      expect(dictionary['admin.resources.file_support_note']).toBe(
        'Supports PNG, JPG, MP4, PDF up to 50MB'
      );
    }
  });
});
