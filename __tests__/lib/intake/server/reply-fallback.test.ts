/**
 * @jest-environment node
 */

/**
 * A dictionary with no text for a key must not become an empty reply (build step 6 part 5).
 */

const mockDictionary: Record<string, unknown> = {};
jest.mock('@/lib/i18n/get-dictionary', () => ({
  getDictionary: () => mockDictionary,
}));

import { INTAKE_TEXT } from '@/lib/intake';
import { replyText } from '@/lib/intake/server/reply';

afterEach(() => {
  for (const key of Object.keys(mockDictionary)) delete mockDictionary[key];
});

describe('replyText with a dictionary that has a gap', () => {
  it('uses the English of the registry when the key is missing', () => {
    expect(replyText('OUT_OF_SCOPE', 'ja')).toBe(
      INTAKE_TEXT['intake.refusal.out_of_scope']
    );
  });

  it('uses the English when the text is empty or not text', () => {
    for (const value of ['', 5, null, undefined, {}]) {
      mockDictionary['intake.refusal.out_of_scope'] = value;
      expect(replyText('OUT_OF_SCOPE', 'ja')).toBe(
        INTAKE_TEXT['intake.refusal.out_of_scope']
      );
    }
  });

  it('uses the dictionary’s text when there is one', () => {
    mockDictionary['intake.refusal.out_of_scope'] = '範囲外です';
    expect(replyText('OUT_OF_SCOPE', 'ja')).toBe('範囲外です');
  });

  it('fills the placeholders of whichever text it uses', () => {
    mockDictionary['intake.refusal.question_too_long'] = '{limit} 文字まで';
    expect(replyText('QUESTION_TOO_LONG', 'ja', { limit: '500' })).toBe(
      '500 文字まで'
    );
    delete mockDictionary['intake.refusal.question_too_long'];
    expect(replyText('QUESTION_TOO_LONG', 'ja', { limit: '500' })).toContain(
      '500'
    );
  });
});
