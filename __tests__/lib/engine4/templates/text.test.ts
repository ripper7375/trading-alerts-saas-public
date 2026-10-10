/**
 * @jest-environment node
 */

/**
 * The text registry (build step 5, part 7): the single source of every word Report 2
 * shows. These tests keep it honest in both directions: no key in the source that the
 * registry does not know (a typo would silently show English), and no key in the
 * registry that nothing uses (dead text that 19 translators would still be paid for).
 */

import { readdirSync, readFileSync, statSync } from 'fs';
import { join, resolve } from 'path';

import {
  DRAFT_TEXT_KEYS,
  REPORT2_KEYS,
  REPORT2_TEXT,
  fillText,
  placeholdersOf,
} from '@/lib/engine4/templates/text';

const ROOT = resolve(__dirname, '..', '..', '..', '..');

function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...sourceFiles(full));
    else if (/\.(ts|tsx)$/.test(entry) && !entry.endsWith('.d.ts'))
      out.push(full);
  }
  return out;
}

const SOURCES = [
  ...sourceFiles(join(ROOT, 'components', 'report2')),
  ...sourceFiles(join(ROOT, 'lib', 'engine4', 'templates')),
].filter((file) => !/templates[\\/]text\.ts$/.test(file));

const LITERAL = /['"`](report2\.[a-z0-9_.]+)['"`]/g;

describe('the registry', () => {
  test('has a key for each text, all of them report2.*, none repeated', () => {
    expect(REPORT2_KEYS.length).toBeGreaterThan(150);
    expect(new Set(REPORT2_KEYS).size).toBe(REPORT2_KEYS.length);
    for (const key of REPORT2_KEYS) {
      expect(key).toMatch(/^report2\.[a-z0-9_]+(\.[a-z0-9_]+)*$/);
    }
  });

  test('every English text is filled in, trimmed and free of a double space', () => {
    for (const key of REPORT2_KEYS) {
      const text = REPORT2_TEXT[key];
      expect(text.trim()).toBe(text);
      expect(text.length).toBeGreaterThan(0);
      expect(text).not.toMatch(/ {2}/);
    }
  });

  test('the same placeholders are written the same way everywhere ({word} only)', () => {
    for (const key of REPORT2_KEYS) {
      const text: string = REPORT2_TEXT[key];
      expect(text.replace(/\{\w+\}/g, '')).not.toMatch(/[{}]/);
    }
  });

  test('every key is used by the template or a component: no dead text', () => {
    const used = new Set<string>();
    for (const file of SOURCES) {
      for (const match of readFileSync(file, 'utf8').matchAll(LITERAL)) {
        used.add(match[1] as string);
      }
    }
    expect(REPORT2_KEYS.filter((key) => !used.has(key))).toEqual([]);
  });

  test('every report2.* literal in the source is a key of the registry: no typo', () => {
    const known = new Set<string>(REPORT2_KEYS);
    const unknown: string[] = [];
    for (const file of SOURCES) {
      for (const match of readFileSync(file, 'utf8').matchAll(LITERAL)) {
        const key = match[1] as string;
        if (!known.has(key))
          unknown.push(`${file.slice(ROOT.length + 1)}: ${key}`);
      }
    }
    expect(unknown).toEqual([]);
  });

  test('the draft wording that waits for counsel is named, and every one exists', () => {
    expect(DRAFT_TEXT_KEYS.length).toBeGreaterThanOrEqual(3);
    for (const key of DRAFT_TEXT_KEYS) expect(REPORT2_KEYS).toContain(key);
    // the three texts on every report are draft, and so are the three buttons
    expect(DRAFT_TEXT_KEYS).toEqual(
      expect.arrayContaining([
        'report2.notice.single_order',
        'report2.notice.broker_order',
        'report2.notice.calculation_tool',
        'report2.consent.accept',
        'report2.consent.modify',
        'report2.consent.decline',
      ])
    );
  });

  test('says what the architecture says: you place the order with your broker', () => {
    expect(REPORT2_TEXT['report2.notice.broker_order']).toMatch(
      /^You place the order with your broker\./
    );
    expect(REPORT2_TEXT['report2.consent.accept']).toBe('Accept setup');
    expect(REPORT2_TEXT['report2.consent.modify']).toBe('Modify');
    expect(REPORT2_TEXT['report2.consent.decline']).toBe('Decline');
  });
});

describe('fillText', () => {
  test('fills every placeholder it has a value for', () => {
    expect(fillText('From {low} to {high}.', { low: '1', high: '2' })).toBe(
      'From 1 to 2.'
    );
    expect(fillText('{a}{a}', { a: 'x' })).toBe('xx');
  });

  test('leaves a placeholder with no value as it is, so a gap is visible', () => {
    expect(fillText('Max {max} now {time}', { max: '2' })).toBe(
      'Max 2 now {time}'
    );
  });

  test('without values returns the text as it is', () => {
    expect(fillText('Zone {zone}')).toBe('Zone {zone}');
  });

  test('does not read the prototype: a name like constructor is a gap, not a function', () => {
    expect(fillText('{constructor}', {})).toBe('{constructor}');
    expect(fillText('{toString}', { other: 'x' })).toBe('{toString}');
  });

  test('inserts a value that itself looks like a placeholder as plain text', () => {
    expect(fillText('A {x} B', { x: '{y}' })).toBe('A {y} B');
  });

  test('placeholdersOf lists them sorted, with repeats', () => {
    expect(placeholdersOf('{b} and {a} and {b}')).toEqual(['a', 'b', 'b']);
    expect(placeholdersOf('no placeholders')).toEqual([]);
  });
});

describe('no text states a figure of its own', () => {
  test('every number in a report is a placeholder filled from Engine 4 (the one digit is the name "Report 2")', () => {
    const withFigures = REPORT2_KEYS.filter((key) => {
      const text: string = REPORT2_TEXT[key];
      return /\d/.test(text.replace(/Report 2/g, ''));
    });
    expect(withFigures).toEqual([]);
  });

  test('and no text writes a percent or dollar sign beside a number, in any form', () => {
    for (const key of REPORT2_KEYS) {
      const text: string = REPORT2_TEXT[key];
      expect(text).not.toMatch(/\d\s?%|%\s?\d|\$\s?\d/);
    }
  });
});
