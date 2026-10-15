/**
 * @jest-environment node
 */

/**
 * The language lines of the invalidation sentence (build step 7 part 5; decision D12). They are
 * drafts nobody native has read, so the file is held to what a machine CAN check: one line per
 * language of the 19 locales, each with its two placeholders and nothing else, and each one a
 * sentence our own wording and number checks accept in its language.
 */

import file from '@/config/reply/report1/invalidation-line.v1.json';
import { checkNumbers } from '@/lib/reply/checks/number-check';
import { checkWording } from '@/lib/reply/checks/wording-check';
import { LOCALES, familyOfLocale } from '@/lib/reply/contracts/intake';
import {
  INVALIDATION_LINES,
  INVALIDATION_LINE_MAX_CHARS,
  INVALIDATION_LINE_SCHEMA,
  LINE_LANGUAGES,
  checkInvalidationLines,
  invalidationText,
} from '@/lib/reply/report1/invalidation-line';
import { resolveText } from '@/lib/reply/report1/resolve';

import { dictOf } from '../checks/helpers/checks-fixtures';

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

describe('the file', () => {
  it('has one line for each of the 17 languages of the 19 locales, and no other', () => {
    expect(LINE_LANGUAGES).toHaveLength(17);
    expect(Object.keys(file.lines).sort()).toEqual([...LINE_LANGUAGES].sort());
    expect(checkInvalidationLines(file)).toEqual([]);
    expect(INVALIDATION_LINES.version).toBe('1.0.0-draft');
    expect(file.schema).toBe(INVALIDATION_LINE_SCHEMA);
  });

  it('says in its own words that it is a draft', () => {
    expect(file.status).toMatch(/^DRAFT/);
  });

  it('has exactly one zone and one price in every line, and no other brace', () => {
    for (const [language, line] of Object.entries(file.lines)) {
      expect({ language, zone: line.split('{zone}').length - 1 }).toEqual({
        language,
        zone: 1,
      });
      expect({ language, price: line.split('{price}').length - 1 }).toEqual({
        language,
        price: 1,
      });
      expect(line.replace('{zone}', '').replace('{price}', '')).not.toMatch(
        /[{}]/
      );
      expect(line.length).toBeLessThanOrEqual(INVALIDATION_LINE_MAX_CHARS);
    }
  });
});

describe('the checker of the file', () => {
  const good = () => clone(file) as Record<string, any>;

  it('names a language that is missing, an unknown one and a line that is not text', () => {
    const missing = good();
    delete missing['lines']['de'];
    expect(checkInvalidationLines(missing)).toEqual(['de: no line']);
    const extra = good();
    extra['lines']['xx'] = 'A {zone} {price}';
    expect(checkInvalidationLines(extra)).toEqual([
      'xx: not a language of the 19 locales',
    ]);
    const number = good();
    number['lines']['de'] = 7;
    expect(checkInvalidationLines(number)).toEqual([
      'de: the line is not text',
    ]);
    const blank = good();
    blank['lines']['de'] = '   ';
    expect(checkInvalidationLines(blank)).toEqual(['de: the line is not text']);
  });

  it('names a line with a placeholder missing, repeated or foreign', () => {
    const noZone = good();
    noZone['lines']['fr'] = 'Une clôture au-delà de {price}';
    expect(checkInvalidationLines(noZone)).toEqual([
      'fr: needs exactly one {zone} and one {price}',
    ]);
    const twice = good();
    twice['lines']['fr'] = '{zone} {zone} {price}';
    expect(checkInvalidationLines(twice)).toEqual([
      'fr: needs exactly one {zone} and one {price}',
    ]);
    const foreign = good();
    foreign['lines']['fr'] = '{zone} {price} {other}';
    expect(checkInvalidationLines(foreign)).toEqual([
      'fr: holds a brace that is not {zone} or {price}',
    ]);
    const stray = good();
    stray['lines']['fr'] = '{zone} {price} }';
    expect(checkInvalidationLines(stray)).toEqual([
      'fr: holds a brace that is not {zone} or {price}',
    ]);
  });

  it('names a line that is too long or holds an override or control character', () => {
    const long = good();
    long['lines']['en'] =
      `{zone} {price} ${'x'.repeat(INVALIDATION_LINE_MAX_CHARS)}`;
    expect(checkInvalidationLines(long)).toEqual([
      `en: longer than ${INVALIDATION_LINE_MAX_CHARS} characters`,
    ]);
    for (const code of [0x0a, 0x202e, 0x2066, 0xfeff]) {
      const bad = good();
      bad['lines']['en'] = `{zone} ${String.fromCodePoint(code)} {price}`;
      expect(checkInvalidationLines(bad)).toContain(
        'en: holds a control, override or tag character'
      );
    }
  });

  it('names a wrong schema, no version, and a file that is not an object', () => {
    const schema = good();
    schema['schema'] = 'invalidation-line/2';
    expect(checkInvalidationLines(schema)).toEqual([
      'the schema is not invalidation-line/1',
    ]);
    const version = good();
    version['version'] = '';
    expect(checkInvalidationLines(version)).toEqual(['the version is missing']);
    for (const value of [null, [], 'text', 7]) {
      expect(checkInvalidationLines(value)).toEqual([
        'the file is not an object',
      ]);
    }
    const lines = good();
    lines['lines'] = [];
    expect(checkInvalidationLines(lines)).toEqual(['lines is not an object']);
  });
});

describe('the sentence in each language, as the reader gets it', () => {
  const dictionary = dictOf([
    { id: 'Z1.invalidation', value: 4350.42, kind: 'PRICE', addressable: true },
  ]);

  it('is a sentence our own checks accept: no banned phrase, no wrong number, the zone and the price in it', () => {
    for (const locale of LOCALES) {
      const text = invalidationText(locale, 'Z1');
      expect(text).toContain('Z1');
      expect(text).toContain('{Z1.invalidation}');
      const resolved = resolveText(text, 'watch[0].text', dictionary, {
        locale,
        referenceSeconds: null,
      });
      expect(resolved.ok).toBe(true);
      if (!resolved.ok) continue;
      for (const bias of ['LONG', 'SHORT', 'NEUTRAL', 'STAND_ASIDE'] as const) {
        const wording = checkWording(
          [{ path: 'watch[0].text', text: resolved.text }],
          locale,
          bias
        );
        expect({
          locale,
          bias,
          findings: wording.findings.map((f) => f.phrase),
        }).toEqual({
          locale,
          bias,
          findings: [],
        });
      }
      const numbers = checkNumbers(
        [{ path: 'watch[0].text', text: resolved.text }],
        dictionary,
        locale
      );
      expect({
        locale,
        violations: numbers.violations.map((v) => v.raw),
      }).toEqual({ locale, violations: [] });
      expect(numbers.matched).toBeGreaterThanOrEqual(1);
    }
  });

  it('is the same for the two locales of one language', () => {
    for (const [a, b] of [
      ['en-US', 'en-GB'],
      ['pt', 'pt-BR'],
    ]) {
      expect(familyOfLocale(a as string)).toBe(familyOfLocale(b as string));
      expect(invalidationText(a as string, 'Z2')).toBe(
        invalidationText(b as string, 'Z2')
      );
    }
  });

  it('keeps Chinese in its own script for each of the two Chinese locales', () => {
    expect(invalidationText('zh', 'Z1')).not.toBe(
      invalidationText('zh-TW', 'Z1')
    );
  });

  it('reads an unknown locale as English', () => {
    expect(invalidationText('xx', 'Z1')).toBe(invalidationText('en-US', 'Z1'));
  });

  it('writes the zone id it is given and does not read a replacement pattern into it', () => {
    expect(invalidationText('en-US', 'Z$&')).toContain('Z$&');
    expect(invalidationText('en-US', 'Z$&')).toContain('{Z$&.invalidation}');
  });
});

describe('the edges of the checker', () => {
  const good = () => clone(file) as Record<string, any>;
  const withLine = (language: string, line: unknown) => {
    const value = good();
    value['lines'][language] = line;
    return value;
  };

  it('takes a line of exactly the longest length and refuses one character more', () => {
    const base = '{zone} {price} ';
    const exact = base + 'x'.repeat(INVALIDATION_LINE_MAX_CHARS - base.length);
    expect(exact).toHaveLength(INVALIDATION_LINE_MAX_CHARS);
    expect(checkInvalidationLines(withLine('en', exact))).toEqual([]);
    expect(checkInvalidationLines(withLine('en', exact + 'x'))).toEqual([
      `en: longer than ${INVALIDATION_LINE_MAX_CHARS} characters`,
    ]);
    expect(INVALIDATION_LINE_MAX_CHARS).toBe(160);
  });

  it('refuses lines that are not an object, whatever else they are', () => {
    for (const lines of ['text', null, 7, true]) {
      const value = good();
      value['lines'] = lines;
      expect(checkInvalidationLines(value)).toEqual(['lines is not an object']);
    }
  });

  it('keeps looking after a language it cannot read: every problem is reported', () => {
    const value = good();
    delete value['lines']['ar']; // missing
    value['lines']['de'] = 7; // not text
    value['lines']['fr'] = 'sans rien'; // no placeholders
    value['lines']['xx'] = 'A {zone} {price}'; // unknown
    expect(checkInvalidationLines(value)).toEqual([
      'ar: no line',
      'xx: not a language of the 19 locales',
      'de: the line is not text',
      'fr: needs exactly one {zone} and one {price}',
    ]);
  });
});

describe('loading the file', () => {
  it('refuses to start on a damaged file and names every problem', () => {
    const broken = clone(file) as Record<string, any>;
    delete broken['lines']['de'];
    broken['lines']['fr'] = 'sans rien';
    jest.isolateModules(() => {
      jest.doMock('@/config/reply/report1/invalidation-line.v1.json', () => ({
        __esModule: true,
        default: broken,
      }));
      expect(() => require('@/lib/reply/report1/invalidation-line')).toThrow(
        'invalidation-line.v1.json: de: no line; fr: needs exactly one {zone} and one {price}'
      );
    });
    jest.dontMock('@/config/reply/report1/invalidation-line.v1.json');
  });

  it('refuses to start on a file with a single problem too', () => {
    const broken = clone(file) as Record<string, any>;
    delete broken['lines']['de'];
    jest.isolateModules(() => {
      jest.doMock('@/config/reply/report1/invalidation-line.v1.json', () => ({
        __esModule: true,
        default: broken,
      }));
      expect(() => require('@/lib/reply/report1/invalidation-line')).toThrow(
        'invalidation-line.v1.json: de: no line'
      );
    });
    jest.dontMock('@/config/reply/report1/invalidation-line.v1.json');
  });

  it('starts on the file that ships', () => {
    jest.isolateModules(() => {
      const loaded = require('@/lib/reply/report1/invalidation-line');
      expect(loaded.INVALIDATION_LINES.version).toBe('1.0.0-draft');
      expect(Object.keys(loaded.INVALIDATION_LINES.lines)).toHaveLength(17);
    });
  });
});
