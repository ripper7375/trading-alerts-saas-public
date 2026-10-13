/**
 * @jest-environment node
 */

/**
 * The fixed reply to a refusal, in a locale (build step 6 part 5).
 */

import { getDictionary } from '@/lib/i18n/get-dictionary';
import {
  INTAKE_TEXT,
  LOCALES,
  REFUSAL_CODES,
  refusalTextKey,
} from '@/lib/intake';
import { replyText } from '@/lib/intake/server/reply';

describe('replyText', () => {
  it.each(REFUSAL_CODES)(
    '%s is the dictionary’s text in every one of the 19 locales',
    (code) => {
      const key = refusalTextKey(code);
      for (const locale of LOCALES) {
        const text = replyText(code, locale, { limit: '500' });
        const expected = (getDictionary(locale)[key] as string).replace(
          '{limit}',
          '500'
        );
        expect(text).toBe(expected);
        expect(text.length).toBeGreaterThan(0);
        expect(text).not.toMatch(/\{\w+\}/);
      }
    }
  );

  it('fills the limit, and leaves a placeholder with no value visible', () => {
    expect(replyText('QUESTION_TOO_LONG', 'en-US', { limit: '500' })).toBe(
      'Your question is too long. Please keep it to 500 characters or fewer.'
    );
    expect(replyText('QUESTION_TOO_LONG', 'en-US')).toContain('{limit}');
    expect(replyText('QUESTION_TOO_LONG', 'en-US', {})).toContain('{limit}');
  });

  it('is the English of the registry for the two English locales', () => {
    for (const code of REFUSAL_CODES) {
      const english = INTAKE_TEXT[refusalTextKey(code)].replace(
        '{limit}',
        '500'
      );
      expect(replyText(code, 'en-US', { limit: '500' })).toBe(english);
      expect(replyText(code, 'en-GB', { limit: '500' })).toBe(english);
    }
  });

  it('falls back to the base dictionary for a locale it does not know', () => {
    expect(replyText('OUT_OF_SCOPE', 'xx')).toBe(
      replyText('OUT_OF_SCOPE', 'en-GB')
    );
  });
});
