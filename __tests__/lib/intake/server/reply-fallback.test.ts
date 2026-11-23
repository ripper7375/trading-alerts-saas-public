/**
 * @jest-environment node
 */

/**
 * A catalog with no text for a key must not become an empty reply (build step 6 part 5).
 *
 * The catalog is `lib/i18n/intake-refusal-messages.json`; this test swaps it for two small locales
 * and changes what they hold from one test to the next. The tests in `reply.test.ts` use the real
 * catalog.
 */

jest.mock('@/lib/i18n/intake-refusal-messages.json', () => ({
  __esModule: true,
  default: { ja: {}, 'en-GB': {} },
}));

import messages from '@/lib/i18n/intake-refusal-messages.json';
import { INTAKE_TEXT } from '@/lib/intake';
import { replyText } from '@/lib/intake/server/reply';

// The same object `reply.ts` reads, so a change here is a change there.
const mockMessages = messages as unknown as Record<
  string,
  Record<string, unknown>
>;

afterEach(() => {
  for (const locale of Object.values(mockMessages)) {
    for (const key of Object.keys(locale)) delete locale[key];
  }
});

describe('replyText with a catalog that has a gap', () => {
  it('uses the English of the registry when the key is missing', () => {
    expect(replyText('OUT_OF_SCOPE', 'ja')).toBe(
      INTAKE_TEXT['intake.refusal.out_of_scope']
    );
  });

  it('uses the English when the text is empty or not text', () => {
    for (const value of ['', 5, null, undefined, {}]) {
      mockMessages.ja!['intake.refusal.out_of_scope'] = value;
      expect(replyText('OUT_OF_SCOPE', 'ja')).toBe(
        INTAKE_TEXT['intake.refusal.out_of_scope']
      );
    }
  });

  it('uses the catalog’s text when there is one', () => {
    mockMessages.ja!['intake.refusal.out_of_scope'] = '範囲外です';
    expect(replyText('OUT_OF_SCOPE', 'ja')).toBe('範囲外です');
  });

  it('fills the placeholders of whichever text it uses', () => {
    mockMessages.ja!['intake.refusal.question_too_long'] = '{limit} 文字まで';
    expect(replyText('QUESTION_TOO_LONG', 'ja', { limit: '500' })).toBe(
      '500 文字まで'
    );
    delete mockMessages.ja!['intake.refusal.question_too_long'];
    expect(replyText('QUESTION_TOO_LONG', 'ja', { limit: '500' })).toContain(
      '500'
    );
  });

  it('reads en-GB for a locale the catalog does not know', () => {
    mockMessages['en-GB']!['intake.refusal.out_of_scope'] = 'Out of scope (GB)';
    expect(replyText('OUT_OF_SCOPE', 'xx')).toBe('Out of scope (GB)');
  });

  it('uses the English of the registry for a locale it does not know when en-GB has a gap too', () => {
    expect(replyText('OUT_OF_SCOPE', 'xx')).toBe(
      INTAKE_TEXT['intake.refusal.out_of_scope']
    );
  });
});
