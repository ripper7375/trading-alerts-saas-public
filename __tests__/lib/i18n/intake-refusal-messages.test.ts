/**
 * The refusal replies of the intake path: a small generated copy of the `intake.refusal.*` keys
 * of the 19 dictionaries, so that no route handler has to carry the dictionaries themselves
 * (Turbopack gave every group of route handlers that reached `get-dictionary` its own 7.8 MB
 * chunk and a 7.7 MB source map).
 *
 * @module __tests__/lib/i18n/intake-refusal-messages.test
 */

import { getDictionary } from '@/lib/i18n/get-dictionary';
import messages from '@/lib/i18n/intake-refusal-messages.json';
import {
  INTAKE_TEXT,
  LOCALES,
  REFUSAL_CODES,
  refusalTextKey,
} from '@/lib/intake';

const {
  buildMessages,
  serialise,
} = require('../../../scripts/i18n/generate-intake-refusal-messages.cjs');

const COMMAND = 'node scripts/i18n/generate-intake-refusal-messages.cjs';
const catalog: Record<string, Record<string, string>> = messages;

describe('the intake refusal messages', () => {
  it(`match what the generator writes (regenerate with: ${COMMAND})`, () => {
    expect(serialise(buildMessages())).toBe(
      JSON.stringify(messages, null, 2) + '\n'
    );
  });

  it('hold the 19 locales, each with exactly the refusal keys of the registry', () => {
    const keys = REFUSAL_CODES.map((code) => refusalTextKey(code)).sort();
    expect(Object.keys(catalog).sort()).toEqual([...LOCALES].sort());
    for (const locale of LOCALES) {
      expect(Object.keys(catalog[locale] ?? {}).sort()).toEqual(keys);
    }
  });

  it('are the dictionary text, key for key, and never an empty text', () => {
    for (const locale of LOCALES) {
      for (const code of REFUSAL_CODES) {
        const key = refusalTextKey(code);
        expect(catalog[locale]?.[key]).toBe(getDictionary(locale)[key]);
        expect(catalog[locale]?.[key]).not.toBe('');
      }
    }
  });

  it('are the English of the registry for the two English locales', () => {
    for (const locale of ['en-GB', 'en-US']) {
      for (const code of REFUSAL_CODES) {
        const key = refusalTextKey(code);
        expect(catalog[locale]?.[key]).toBe(INTAKE_TEXT[key]);
      }
    }
  });

  it('stay small: that is the point of a separate file', () => {
    expect(JSON.stringify(messages).length).toBeLessThan(40_000);
  });
});
