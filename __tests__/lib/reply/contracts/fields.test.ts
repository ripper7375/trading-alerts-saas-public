/**
 * @jest-environment node
 */

import { Issues } from '@/lib/reply/contracts/intake';
import {
  CODE,
  ID,
  INSTANT,
  INT_MAX,
  MCD,
  MODEL_SLUG,
  RULES_VERSION,
  RULE_ID,
  SHA256,
  STATE_CODE,
  VERSION,
  codeList,
  idText,
  intIn,
  sha256Text,
  slotText,
  versionText,
} from '@/lib/reply/contracts/fields';

/** Each pattern, at its edges: anchored at both ends, and exactly as long as it may be. */
const PATTERNS: [string, RegExp, string[], string[]][] = [
  [
    'ID',
    ID,
    ['a', 'A', '0', '_', '-', 'a-B_9', 'x'.repeat(64)],
    ['', 'x'.repeat(65), 'a b', 'a.b', 'é', 'a\n', '\na', ' a', 'a '],
  ],
  [
    'VERSION',
    VERSION,
    ['1', 'a', 'draft-1', 'v1.2.3', 'a.b_c-d', 'x'.repeat(40)],
    ['', 'x'.repeat(41), '-x', '.x', '_x', 'a b', 'a\n', ' a'],
  ],
  [
    'SHA256',
    SHA256,
    ['0'.repeat(64), 'abcdef0123456789'.repeat(4)],
    [
      '',
      '0'.repeat(63),
      '0'.repeat(65),
      'A'.repeat(64),
      'g'.repeat(64),
      `${'0'.repeat(64)}\n`,
      ` ${'0'.repeat(63)}`,
    ],
  ],
  [
    'MODEL_SLUG',
    MODEL_SLUG,
    [
      'a',
      '1',
      'google/gemini-2.5-flash',
      'vendor/model:beta',
      'a@b+c',
      'x'.repeat(120),
    ],
    ['', 'x'.repeat(121), '/x', '-x', ' x', 'a b', 'a\n', 'é'],
  ],
  [
    'CODE',
    CODE,
    [
      'A',
      'TERM_DROPPED',
      'UPSTREAM_STALE:MCD1',
      `A${'B'.repeat(39)}`,
      `A:${'B'.repeat(40)}`,
      'A1',
    ],
    [
      '',
      `A${'B'.repeat(40)}`,
      `A:${'B'.repeat(41)}`,
      'a',
      '1A',
      '_A',
      ':X',
      'A:',
      'A:b',
      'A::B',
      'A:B:C',
      'A\n',
    ],
  ],
  [
    'MCD',
    MCD,
    ['MCD1', 'MCD9', 'MCD10', 'MCD15'],
    ['', 'MCD', 'MCD0', 'MCD16', 'MCD01', 'XMCD1', 'MCD1X', 'mcd1', 'MCD1\n'],
  ],
  [
    'STATE_CODE',
    STATE_CODE,
    ['MCD0_X', 'MCD1_UP', 'MCD15_UP_IN_CORRIDOR', 'MCD9_A1'],
    [
      '',
      'MCD16_X',
      'MCD1_',
      'MCD1X',
      'mcd1_x',
      'MCD1_a',
      'XMCD1_X',
      'MCD1_X\n',
    ],
  ],
  [
    'RULE_ID',
    RULE_ID,
    ['R1_X', 'R3S_TREND', 'R12_A_B', 'NO_MATCH', 'R0_DATA_CHECK'],
    [
      '',
      'R_X',
      'R1',
      'R1S_',
      'r1_x',
      'NO_MATCHX',
      'XNO_MATCH',
      'R1_x',
      'NO_MATCH\n',
    ],
  ],
  [
    'RULES_VERSION',
    RULES_VERSION,
    ['draft-1', 'v1.2', '0', 'a_b'],
    ['', 'Draft', '-x', '.x', 'a b', 'a\n', 'A'],
  ],
  [
    'INSTANT',
    INSTANT,
    [
      '2026-09-18T21:00:12Z',
      '2026-09-18T21:00:12.1Z',
      '2026-09-18T21:00:12.12Z',
      '2026-09-18T21:00:12.123Z',
    ],
    [
      '',
      '2026-09-18T21:00:12.1234Z',
      '2026-09-18T21:00:12.Z',
      '2026-09-18T21:00Z',
      '2026-09-18T21:00:12',
      '2026-09-18 21:00:12Z',
      '2026-09-18T21:00:12Z\n',
      'x2026-09-18T21:00:12Z',
    ],
  ],
];

describe.each(PATTERNS)('%s', (_name, pattern, good, bad) => {
  it.each(good.map((g) => [g]))('accepts %j', (value) => {
    expect(pattern.test(value)).toBe(true);
  });
  it.each(bad.map((b) => [b]))('refuses %j', (value) => {
    expect(pattern.test(value)).toBe(false);
  });
  it('is not global or sticky, so .test never keeps state', () => {
    expect(pattern.global).toBe(false);
    expect(pattern.sticky).toBe(false);
  });
});

describe('INT_MAX', () => {
  it('is the largest value of a 32-bit INTEGER column', () => {
    expect(INT_MAX).toBe(2147483647);
    expect(INT_MAX).toBe(2 ** 31 - 1);
  });
});

const run = <T>(fn: (issues: Issues) => T): { value: T; issues: string[] } => {
  const issues = new Issues();
  const value = fn(issues);
  return { value, issues: issues.list.map((i) => `${i.path}:${i.code}`) };
};

describe('the field validators', () => {
  it.each([
    ['idText', idText, 'req-1', 'has space'],
    ['versionText', versionText, '1.0.0', '-1'],
    ['sha256Text', sha256Text, 'a'.repeat(64), 'a'.repeat(63)],
    ['slotText', slotText, '2026-09-18T20:55Z', '2026-09-18T20:56Z'],
  ] as const)(
    '%s returns a good value, refuses a bad shape and a wrong type',
    (_name, check, good, bad) => {
      expect(run((i) => check(good, 'f', i))).toEqual({
        value: good,
        issues: [],
      });
      expect(run((i) => check(bad, 'f', i))).toEqual({
        value: undefined,
        issues: ['f:BAD_FORMAT'],
      });
      for (const wrong of [4, null, undefined, {}, [], true]) {
        expect(run((i) => check(wrong, 'f', i))).toEqual({
          value: undefined,
          issues: ['f:WRONG_TYPE'],
        });
      }
      expect(run((i) => check('', 'f', i)).issues).toHaveLength(1);
    }
  );

  it('slotText is a real slot: a made-up day, a minute that is not a multiple of five', () => {
    for (const slot of [
      '2026-02-30T10:00Z',
      '2026-13-01T10:00Z',
      '2026-09-18T24:00Z',
      '2026-09-18T20:55:00Z',
      '2026-09-18',
    ]) {
      expect(run((i) => slotText(slot, 'f', i)).issues).toEqual([
        'f:BAD_FORMAT',
      ]);
    }
    expect(run((i) => slotText('2028-02-29T23:55Z', 'f', i)).issues).toEqual(
      []
    );
  });

  describe('intIn', () => {
    it('is a whole number from the minimum (0) to the maximum', () => {
      expect(run((i) => intIn(0, 'n', i, 5)).issues).toEqual([]);
      expect(run((i) => intIn(5, 'n', i, 5)).issues).toEqual([]);
      expect(run((i) => intIn(6, 'n', i, 5)).issues).toEqual([
        'n:OUT_OF_RANGE',
      ]);
      expect(run((i) => intIn(-1, 'n', i, 5)).issues).toEqual([
        'n:OUT_OF_RANGE',
      ]);
      expect(run((i) => intIn(1.5, 'n', i, 5)).issues).toEqual([
        'n:WRONG_TYPE',
      ]);
      expect(run((i) => intIn('3', 'n', i, 5)).issues).toEqual([
        'n:WRONG_TYPE',
      ]);
      expect(run((i) => intIn(Number.NaN, 'n', i, 5)).issues).toEqual([
        'n:WRONG_TYPE',
      ]);
      expect(run((i) => intIn(Infinity, 'n', i, 5)).issues).toEqual([
        'n:WRONG_TYPE',
      ]);
    });

    it('takes a minimum of its own', () => {
      expect(run((i) => intIn(1, 'n', i, 5, 1)).issues).toEqual([]);
      expect(run((i) => intIn(0, 'n', i, 5, 1)).issues).toEqual([
        'n:OUT_OF_RANGE',
      ]);
    });
  });

  describe('codeList', () => {
    it('is a list of codes, none twice, at most max', () => {
      expect(run((i) => codeList(['A', 'B_1'], 'l', i, 3))).toEqual({
        value: ['A', 'B_1'],
        issues: [],
      });
      expect(run((i) => codeList([], 'l', i, 3))).toEqual({
        value: [],
        issues: [],
      });
      expect(run((i) => codeList(['A', 'B', 'C'], 'l', i, 3)).issues).toEqual(
        []
      );
      expect(
        run((i) => codeList(['A', 'B', 'C', 'D'], 'l', i, 3)).issues
      ).toEqual(['l:TOO_MANY']);
      expect(run((i) => codeList(['A', 'A'], 'l', i, 3)).issues).toEqual([
        'l[1]:DUPLICATE',
      ]);
      expect(run((i) => codeList(['a'], 'l', i, 3)).issues).toEqual([
        'l[0]:BAD_FORMAT',
      ]);
      expect(run((i) => codeList('A', 'l', i, 3)).issues).toEqual([
        'l:WRONG_TYPE',
      ]);
    });

    it('keeps the good codes of a list that has a bad one, and skips the bad', () => {
      expect(run((i) => codeList(['A', 'b', 'C'], 'l', i, 5)).value).toEqual([
        'A',
        'C',
      ]);
    });

    it('takes a pattern of its own', () => {
      expect(
        run((i) => codeList(['Z1', 'Z9'], 'l', i, 5, /^Z[1-5]$/)).issues
      ).toEqual(['l[1]:BAD_FORMAT']);
    });
  });
});
