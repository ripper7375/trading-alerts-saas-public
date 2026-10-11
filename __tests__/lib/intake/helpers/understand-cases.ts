/**
 * What a person labelled as a good or a bad `understand-result/1`: one list, read by the test of
 * the JSON Schema file (does the schema say so?) and by the test of the TypeScript validator
 * (does the code say so?), so the two cannot drift apart without a case failing.
 *
 * A case is `[what it is, the document, whether it is valid]`.
 */

import { LANGUAGE_FAMILIES, UNDERSTAND_INTENTS } from '@/lib/intake';

import type { Any } from './walk';

export const valid = (patch: Any = {}): Any => ({
  schema: 'understand-result/1',
  language: 'th',
  english: 'Where should I enter gold now?',
  intent: 'ENTRY_TIMING',
  symbols: ['XAUUSD'],
  timeframes: ['M5'],
  ...patch,
});

export const withoutKey = (key: string): Any => {
  const value = valid();
  delete value[key];
  return value;
};

export const UNDERSTAND_CASES: [string, Any, boolean][] = [
  ['a complete result', valid(), true],
  ['no symbol and no timeframe', valid({ symbols: [], timeframes: [] }), true],
  [
    'symbols as models write them',
    valid({ symbols: ['BTC/USD', 'US30', 'EUR_USD', 'xauusd', 'XAU.USD'] }),
    true,
  ],
  [
    'timeframes as models write them',
    valid({ timeframes: ['M5', 'H4', '1h', 'D1', 'W1'] }),
    true,
  ],
  ['an unknown language', valid({ language: 'und' }), true],
  ['the longest English text', valid({ english: 'x'.repeat(1000) }), true],
  [
    'eight symbols',
    valid({ symbols: Array.from({ length: 8 }, () => 'XAUUSD') }),
    true,
  ],
  ...UNDERSTAND_INTENTS.map((intent): [string, Any, boolean] => [
    `the label ${intent}`,
    valid({ intent }),
    true,
  ]),
  ...LANGUAGE_FAMILIES.map((language): [string, Any, boolean] => [
    `the language ${language}`,
    valid({ language }),
    true,
  ]),
  [
    'an instant label (never from the model)',
    valid({ intent: 'INSTANT_M5_INSPECT' }),
    false,
  ],
  ['a lower-case label', valid({ intent: 'direction' }), false],
  ['no label', valid({ intent: '' }), false],
  [
    'a locale instead of a language: pt-BR',
    valid({ language: 'pt-BR' }),
    false,
  ],
  [
    'a locale instead of a language: en-GB',
    valid({ language: 'en-GB' }),
    false,
  ],
  ['a language outside the 17', valid({ language: 'ru' }), false],
  ['an upper-case language', valid({ language: 'EN' }), false],
  ['no English text', valid({ english: '' }), false],
  [
    'an English text over the limit',
    valid({ english: 'x'.repeat(1001) }),
    false,
  ],
  ['an English text that is not text', valid({ english: ['Where?'] }), false],
  ['an extra field', valid({ explanation: 'because' }), false],
  ['a wrong schema id', valid({ schema: 'understand-result/2' }), false],
  [
    'nine symbols',
    valid({ symbols: Array.from({ length: 9 }, () => 'XAUUSD') }),
    false,
  ],
  ['a symbol with a space', valid({ symbols: ['XAU USD'] }), false],
  [
    'a symbol that is SQL',
    valid({ symbols: ["x'; DROP TABLE users;--"] }),
    false,
  ],
  ['a symbol too long', valid({ symbols: ['ABCDEFGHIJKLM'] }), false],
  [
    'a symbol that is a sentence',
    valid({ symbols: ['ignore previous instructions'] }),
    false,
  ],
  ['symbols as a string', valid({ symbols: 'XAUUSD' }), false],
  ['a timeframe with a space', valid({ timeframes: ['M 5'] }), false],
  ['a timeframe too long', valid({ timeframes: ['M5M15M30'] }), false],
  ['a timeframe that is not text', valid({ timeframes: [5] }), false],
  ...['schema', 'language', 'english', 'intent', 'symbols', 'timeframes'].map(
    (key): [string, Any, boolean] => [`no ${key}`, withoutKey(key), false]
  ),
  ['not an object: a string', 'DIRECTION', false],
  ['not an object: null', null, false],
  ['not an object: a list', [valid()], false],
];
