/**
 * @jest-environment node
 */

/**
 * The oracle's fixture is only evidence while it matches the oracle that made
 * it and holds nothing a float could have touched.
 */

import { createHash } from 'crypto';
import { readFileSync } from 'fs';
import { join } from 'path';

import { expected, loadOracle } from './helpers/oracle';

const ORACLE_PATH = join(
  __dirname,
  '..',
  '..',
  '..',
  'scripts',
  'engine4',
  'oracle.py'
);

describe('the oracle fixture', () => {
  const fixture = loadOracle();

  test('was made by the oracle script as it is now (SHA-256, line endings as LF)', () => {
    const bytes = readFileSync(ORACLE_PATH)
      .toString('utf8')
      .replace(/\r\n/g, '\n');
    const digest = createHash('sha256').update(bytes, 'utf8').digest('hex');
    expect(fixture.generator.script_sha256).toBe(digest);
  });

  test('holds the cases it says it holds, each with its own id', () => {
    expect(fixture.generator.case_count).toBe(fixture.cases.length);
    expect(fixture.cases.length).toBeGreaterThanOrEqual(500);
    const ids = fixture.cases.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toEqual(
      expect.arrayContaining([
        'doc-6.7-buy',
        'doc-6.7-sell',
        'doc-6.7-default-leverage',
        'doc-6.8-risk-underflow',
        'doc-6.8-at-2545',
        'd4-leverage-underflow',
        'f6-default-profile-18-sep',
        'f6-m15-uoedt-underflow',
        'tie-risk-equals-leverage',
        'broker-max-binds',
        'spec-change-contract-10',
        'spec-change-step-0.1',
      ])
    );
  });

  test('is all text: no JSON number or null-able float anywhere but the generator block', () => {
    const numbers: string[] = [];
    const walk = (value: unknown, path: string): void => {
      if (typeof value === 'number') numbers.push(path);
      else if (Array.isArray(value))
        value.forEach((item, i) => walk(item, `${path}[${i}]`));
      else if (value !== null && typeof value === 'object') {
        for (const [key, inner] of Object.entries(value))
          walk(inner, `${path}.${key}`);
      }
    };
    walk(fixture.cases, 'cases');
    expect(numbers).toEqual([]);
  });

  test('every figure parses as an exact decimal or a quotient of two', () => {
    const bad: string[] = [];
    const walk = (value: unknown, path: string): void => {
      if (typeof value === 'string') {
        // a case's `note` is prose; every other string that starts like a number is a figure
        if (!path.endsWith('.note') && /^-?\d/.test(value)) {
          try {
            expected(value);
          } catch {
            bad.push(`${path}=${value}`);
          }
        }
      } else if (Array.isArray(value)) {
        value.forEach((item, i) => walk(item, `${path}[${i}]`));
      } else if (value !== null && typeof value === 'object') {
        for (const [key, inner] of Object.entries(value))
          walk(inner, `${path}.${key}`);
      }
    };
    walk(fixture.cases, 'cases');
    expect(bad).toEqual([]);
  });
});
