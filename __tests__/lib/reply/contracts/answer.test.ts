/**
 * @jest-environment node
 */

import {
  ANSWER_ACTIONS,
  ANSWER_KEYS,
  ANSWER_LIMITS,
  answerTexts,
  validateAnswer,
} from '@/lib/reply/contracts/answer';
import { LOCALES } from '@/lib/intake';

import {
  ANSWER,
  contextFor,
  summary,
  withPath,
  without,
} from '../helpers/fixtures';

const codes = (value: unknown, context = {}) =>
  summary(validateAnswer(value, context));

describe('answer.v1', () => {
  it('has four keys: the locale, the text, the cites and the action', () => {
    expect([...ANSWER_KEYS]).toEqual(['locale', 'text', 'cites', 'action']);
    expect([...ANSWER_ACTIONS]).toEqual(['OPEN_TRADE_SETUP']);
  });

  it('accepts a short answer, with and without a context', () => {
    const result = validateAnswer(ANSWER, contextFor('01'));
    expect(result).toEqual({ ok: true, value: ANSWER });
    expect(validateAnswer(ANSWER).ok).toBe(true);
  });

  it.each(ANSWER_KEYS)('requires %s', (key) => {
    expect(codes(without(ANSWER, key))).toEqual([`${key}:REQUIRED`]);
  });

  it('refuses an extra key, and direction for what it is', () => {
    expect(codes({ ...ANSWER, note: 'x' })).toEqual(['note:UNKNOWN_KEY']);
    for (const key of ['direction', 'bias', 'side', 'recommendation']) {
      expect(codes({ ...ANSWER, [key]: 'LONG' })).toEqual([
        `${key}:FORBIDDEN_KEY`,
      ]);
    }
  });

  it.each([null, undefined, [], 'text', 4])(
    'refuses %j as a whole answer',
    (value) => {
      expect(codes(value)).toEqual([':WRONG_TYPE']);
    }
  );

  describe('the locale', () => {
    it.each(LOCALES)('accepts %s', (locale) => {
      expect(codes({ ...ANSWER, locale })).toEqual([]);
    });

    it.each(['en', 'EN-us', 'pt_BR', 'xx', '', 'de-DE', 'ru'])(
      'refuses %j',
      (locale) => {
        expect(codes({ ...ANSWER, locale })).toEqual(['locale:NOT_ONE_OF']);
      }
    );

    it('must be a string', () => {
      expect(codes({ ...ANSWER, locale: 4 })).toEqual(['locale:WRONG_TYPE']);
      expect(codes({ ...ANSWER, locale: null })).toEqual(['locale:WRONG_TYPE']);
    });

    it('must be the locale the packet says the reply is written in, given a context', () => {
      expect(
        codes({ ...ANSWER, locale: 'de' }, { replyLocale: 'en-US' })
      ).toEqual(['locale:INCONSISTENT']);
      expect(
        codes({ ...ANSWER, locale: 'en-US' }, { replyLocale: 'en-US' })
      ).toEqual([]);
      expect(codes({ ...ANSWER, locale: 'de' })).toEqual([]);
    });
  });

  describe('the action', () => {
    it('is null or OPEN_TRADE_SETUP', () => {
      expect(codes({ ...ANSWER, action: null })).toEqual([]);
      expect(codes({ ...ANSWER, action: 'OPEN_TRADE_SETUP' })).toEqual([]);
    });

    it.each(['PLACE_ORDER', 'open_trade_setup', 'BUY', '', 4, undefined])(
      'refuses %j: the list is closed',
      (action) => {
        const result = codes({ ...ANSWER, action });
        expect(result).toHaveLength(1);
        expect(result[0]).toMatch(/^action:(NOT_ONE_OF|WRONG_TYPE|REQUIRED)$/);
      }
    );
  });

  describe('the text', () => {
    it('is held at its limit', () => {
      expect(
        codes({ ...ANSWER, text: 'x'.repeat(ANSWER_LIMITS.text) })
      ).toEqual([]);
      expect(
        codes({ ...ANSWER, text: 'x'.repeat(ANSWER_LIMITS.text + 1) })
      ).toEqual(['text:TOO_LONG']);
      expect(codes({ ...ANSWER, text: '' })).toEqual(['text:TOO_SHORT']);
      expect(codes({ ...ANSWER, text: '  ' })).toEqual(['text:TOO_SHORT']);
    });

    it('may place values, which must exist given a context', () => {
      expect(codes(withPath(ANSWER, 'text', 'at {MCD2.nothing}'))).toEqual([]);
      expect(
        codes(withPath(ANSWER, 'text', 'at {MCD2.nothing}'), contextFor('01'))
      ).toEqual(['text:NOT_ONE_OF']);
      expect(codes(withPath(ANSWER, 'text', 'at {MCD2.baseline} {'))).toEqual([
        'text:BAD_FORMAT',
      ]);
    });

    it('is one line of plain text', () => {
      expect(codes(withPath(ANSWER, 'text', 'one\ntwo'))).toEqual([
        'text:BAD_FORMAT',
      ]);
    });
  });

  describe('the cites', () => {
    it('are sensors, zones or the synthesis, at most four, none twice', () => {
      expect(codes({ ...ANSWER, cites: [] })).toEqual([]);
      expect(codes({ ...ANSWER, cites: ['MCD1', 'Z1', 'SYN'] })).toEqual([]);
      expect(codes({ ...ANSWER, cites: ['MCD1', 'MCD1'] })).toEqual([
        'cites[1]:DUPLICATE',
      ]);
      expect(
        codes({ ...ANSWER, cites: ['MCD1', 'MCD2', 'MCD3', 'Z1', 'Z2'] })
      ).toEqual(['cites:TOO_MANY']);
    });

    it('must be in the packet, given a context', () => {
      expect(codes({ ...ANSWER, cites: ['MCD9'] })).toEqual([]);
      expect(codes({ ...ANSWER, cites: ['MCD9'] }, contextFor('01'))).toEqual([
        'cites[0]:NOT_ONE_OF',
      ]);
    });
  });

  it('answerTexts lists the text with its path', () => {
    expect(answerTexts(ANSWER)).toEqual([{ path: 'text', text: ANSWER.text }]);
  });
});
