/**
 * @jest-environment node
 */

/**
 * The TypeScript validator of `understand-result/1` against its JSON Schema file
 * (`config/intake/understand-result-1.schema.json`), on the same documents: the labelled list,
 * and hundreds of damaged copies of a good result. They must agree on every document,
 * except the three places where the code is STRICTER than the schema on purpose, which are
 * pinned here so neither side drifts:
 *
 *  1. an English text of only white space (the schema allows it; there is nothing to route);
 *  2. an English text longer than 1,000 UTF-16 code units but not 1,000 code points (the schema
 *     counts code points, the packet counts code units; a result the packet would refuse is
 *     refused here);
 *  3. a trailing line feed in a symbol or a timeframe (Python's `$` matches before it, JavaScript's
 *     does not).
 */

import { join } from 'path';

import { validateUnderstandResult } from '@/lib/intake';

import { REPO_ROOT, describePython } from './helpers/python';
import { schemaVerdicts, type Verdict } from './helpers/schema-verdicts';
import { UNDERSTAND_CASES, valid } from './helpers/understand-cases';
import type { Any } from './helpers/walk';

const SCHEMA = join(
  REPO_ROOT,
  'config',
  'intake',
  'understand-result-1.schema.json'
);

/** Documents: the labelled ones, then every field of a good result damaged in many ways. */
function documents(): [string, Any][] {
  const docs: [string, Any][] = UNDERSTAND_CASES.map(([what, doc]) => [
    what,
    doc,
  ]);
  const good = valid();
  const ALIENS: [string, unknown][] = [
    ['null', null],
    ['zero', 0],
    ['a float', 1.5],
    ['true', true],
    ['an empty string', ''],
    ['a string', 'x'],
    ['an empty list', []],
    ['a list of strings', ['x']],
    ['a list of numbers', [1]],
    ['an empty object', {}],
    ['an object', { a: 1 }],
  ];
  for (const key of Object.keys(good)) {
    docs.push([
      `${key} removed`,
      Object.fromEntries(Object.entries(good).filter(([k]) => k !== key)),
    ]);
    for (const [name, alien] of ALIENS) {
      docs.push([`${key} is ${name}`, { ...good, [key]: alien }]);
    }
  }
  docs.push(['an extra key', { ...good, extra: 1 }]);
  docs.push(['an extra null key', { ...good, extra: null }]);

  for (const length of [0, 1, 999, 1000, 1001, 2000]) {
    docs.push([
      `english of ${length}`,
      { ...good, english: 'x'.repeat(length) },
    ]);
  }
  for (const length of [0, 1, 7, 8, 9, 20]) {
    docs.push([
      `${length} symbols`,
      { ...good, symbols: Array.from({ length }, () => 'XAUUSD') },
    ]);
    docs.push([
      `${length} timeframes`,
      { ...good, timeframes: Array.from({ length }, () => 'M5') },
    ]);
  }
  for (const length of [0, 1, 11, 12, 13]) {
    docs.push([
      `a symbol of ${length}`,
      { ...good, symbols: ['A'.repeat(length)] },
    ]);
  }
  for (const length of [0, 1, 5, 6, 7]) {
    docs.push([
      `a timeframe of ${length}`,
      { ...good, timeframes: ['A'.repeat(length)] },
    ]);
  }
  // every ASCII character, and some that are not, as a symbol and as a timeframe
  const chars = [
    ...Array.from({ length: 95 }, (_, i) => String.fromCharCode(32 + i)),
    'é',
    'ß',
    '٤',
    '金',
    '😀',
    '\t',
    ' ',
    '\u200b',
  ];
  for (const char of chars) {
    docs.push([
      `the symbol ${JSON.stringify(char)}`,
      { ...good, symbols: [`X${char}Y`] },
    ]);
    docs.push([
      `the timeframe ${JSON.stringify(char)}`,
      { ...good, timeframes: [`M${char}5`] },
    ]);
  }
  // every value of the language field, as a locale, in the wrong case and with a space
  for (const language of [
    'en',
    'EN',
    'en-US',
    'en-GB',
    'pt',
    'pt-BR',
    'zh',
    'zh-TW',
    'zh-CN',
    'zh-tw',
    'und',
    'UND',
    'xx',
    ' en',
    'en ',
    'ru',
    'he',
    'nl',
    'pl',
    'sv',
    '',
  ]) {
    docs.push([
      `the language ${JSON.stringify(language)}`,
      { ...good, language },
    ]);
  }
  for (const intent of [
    ...[
      'DIRECTION',
      'ENTRY_TIMING',
      'EXIT_TARGETS',
      'RISK_SIZING',
      'EXPLAIN',
      'NEWS',
      'REPORT_2',
      'OUT_OF_SCOPE',
    ],
    'INSTANT_M5_INSPECT',
    'INSTANT_M15_INSPECT',
    'direction',
    'Direction',
    'DIRECTION ',
    ' DIRECTION',
    'REPORT2',
    'OUT-OF-SCOPE',
    '',
  ]) {
    docs.push([`the intent ${JSON.stringify(intent)}`, { ...good, intent }]);
  }
  for (const schema of [
    'understand-result/1',
    'understand-result/2',
    'understand-result',
    'Understand-Result/1',
    '',
  ]) {
    docs.push([`the schema id ${JSON.stringify(schema)}`, { ...good, schema }]);
  }
  for (const root of [null, true, 0, 'x', [], [good], [[]], {}]) {
    docs.push([`the root ${JSON.stringify(root)?.slice(0, 20)}`, root]);
  }
  return docs;
}

/** Documents on which the code is stricter than the schema, and why. */
const STRICTER: [string, Any][] = [
  ['an English text of one space', valid({ english: ' ' })],
  ['an English text of tabs and line feeds', valid({ english: '\t\n\r' })],
  ['an English text of an ideographic space', valid({ english: '　' })],
  [
    'an English text of 501 emoji (1,002 code units)',
    valid({ english: '😀'.repeat(501) }),
  ],
  ['an English text of 1,000 emoji', valid({ english: '😀'.repeat(1000) })],
  ['a symbol with a trailing line feed', valid({ symbols: ['XAUUSD\n'] })],
  ['a timeframe with a trailing line feed', valid({ timeframes: ['M5\n'] })],
];

describePython('validateUnderstandResult against its JSON Schema', () => {
  // computed in beforeAll, not here: a skipped suite still runs this body, and without Python it must not
  let docs: [string, Any][] = [];
  let verdicts: Verdict[] = [];
  beforeAll(() => {
    docs = documents();
    verdicts = schemaVerdicts(
      SCHEMA,
      docs.map(([, doc]) => doc)
    );
  });

  it('has hundreds of documents to compare', () => {
    expect(docs.length).toBeGreaterThan(400);
    expect(verdicts).toHaveLength(docs.length);
  });

  it('agrees with the schema on every one', () => {
    const disagreements: string[] = [];
    docs.forEach(([what, doc], index) => {
      const code = validateUnderstandResult(doc).ok;
      const schema = (verdicts[index] as { ok: boolean }).ok;
      if (code !== schema)
        disagreements.push(`${what}: code ${code}, schema ${schema}`);
    });
    expect(disagreements).toEqual([]);
  });

  it('is stricter than the schema in the three places that were chosen, and nowhere else', () => {
    const schema = schemaVerdicts(
      SCHEMA,
      STRICTER.map(([, doc]) => doc)
    );
    STRICTER.forEach(([what, doc], index) => {
      expect({ what, schema: (schema[index] as { ok: boolean }).ok }).toEqual({
        what,
        schema: true,
      });
      expect({ what, code: validateUnderstandResult(doc).ok }).toEqual({
        what,
        code: false,
      });
    });
  });

  it('accepts every good result the schema accepts in the labelled list', () => {
    UNDERSTAND_CASES.forEach(([what, doc, want], index) => {
      expect({ what, schema: (verdicts[index] as { ok: boolean }).ok }).toEqual(
        { what, schema: want }
      );
      expect({ what, code: validateUnderstandResult(doc).ok }).toEqual({
        what,
        code: want,
      });
    });
  });
});
