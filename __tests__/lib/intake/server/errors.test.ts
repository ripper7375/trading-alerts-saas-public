/**
 * @jest-environment node
 */

/**
 * The one error format of the intake routes (build step 6 part 5).
 */

import { GATE_ORDER, REFUSAL_CODES } from '@/lib/intake';
import {
  ERROR_MESSAGE,
  ERROR_STATUS,
  errorBody,
  type IntakeErrorCode,
} from '@/lib/intake/server/errors';

import { newTrace } from '../helpers/ports';

const ALL: IntakeErrorCode[] = [
  'FEATURE_DISABLED',
  ...REFUSAL_CODES,
  'BAD_REQUEST',
  'UNSUPPORTED_MEDIA_TYPE',
  'PAYLOAD_TOO_LARGE',
  'INTERNAL',
];

describe('statuses', () => {
  it('has a status and an English message for every code, and no others', () => {
    expect(Object.keys(ERROR_STATUS).sort()).toEqual([...ALL].sort());
    expect(Object.keys(ERROR_MESSAGE).sort()).toEqual([...ALL].sort());
  });

  it('pins the statuses', () => {
    expect(ERROR_STATUS).toEqual({
      FEATURE_DISABLED: 404,
      NOT_SIGNED_IN: 401,
      TIER_REQUIRED: 403,
      THREAD_INVALID: 422,
      PROFILE_NOT_SET: 409,
      QUOTA_INSUFFICIENT: 429,
      FEATURE_UNAVAILABLE: 503,
      QUESTION_EMPTY: 422,
      QUESTION_TOO_LONG: 422,
      UNDERSTANDING_FAILED: 503,
      OUT_OF_SCOPE: 422,
      BAD_REQUEST: 400,
      UNSUPPORTED_MEDIA_TYPE: 415,
      PAYLOAD_TOO_LARGE: 413,
      INTERNAL: 500,
    });
  });

  it('answers the gate’s refusals in the order it decides them: 401, 403, 422, 409, 429', () => {
    expect(GATE_ORDER.map((code) => ERROR_STATUS[code])).toEqual([
      401, 403, 422, 409, 429,
    ]);
  });

  it('is a client error (4xx) for what the trader can fix, and 5xx for what is ours', () => {
    for (const code of [
      'NOT_SIGNED_IN',
      'TIER_REQUIRED',
      'THREAD_INVALID',
      'PROFILE_NOT_SET',
      'QUOTA_INSUFFICIENT',
      'QUESTION_EMPTY',
      'QUESTION_TOO_LONG',
      'OUT_OF_SCOPE',
      'BAD_REQUEST',
    ] as const) {
      expect(ERROR_STATUS[code]).toBeGreaterThanOrEqual(400);
      expect(ERROR_STATUS[code]).toBeLessThan(500);
    }
    for (const code of [
      'FEATURE_UNAVAILABLE',
      'UNDERSTANDING_FAILED',
      'INTERNAL',
    ] as const) {
      expect(ERROR_STATUS[code]).toBeGreaterThanOrEqual(500);
    }
  });

  it('pins the English messages', () => {
    expect(ERROR_MESSAGE).toEqual({
      FEATURE_DISABLED: 'Not found',
      NOT_SIGNED_IN: 'You must be signed in.',
      TIER_REQUIRED: 'The AI analyst is a Pro feature.',
      THREAD_INVALID: 'The thread is not available for this symbol.',
      PROFILE_NOT_SET: 'The trader has not confirmed a profile.',
      QUOTA_INSUFFICIENT: 'There is not enough allowance for this request.',
      FEATURE_UNAVAILABLE: 'The AI analyst is not available right now.',
      QUESTION_EMPTY: 'The question is empty.',
      QUESTION_TOO_LONG: 'The question is too long.',
      UNDERSTANDING_FAILED: 'The question could not be read.',
      OUT_OF_SCOPE: 'The question is about another symbol or timeframe.',
      BAD_REQUEST: 'The request is not well formed.',
      UNSUPPORTED_MEDIA_TYPE: 'The body must be sent as application/json.',
      PAYLOAD_TOO_LARGE: 'The body is too large.',
      INTERNAL: 'Something went wrong on our side.',
    });
  });

  it('says nothing in a message that a stack, a table or a key would', () => {
    for (const message of Object.values(ERROR_MESSAGE)) {
      expect(message).not.toMatch(
        /at \w+|prisma|postgres|\bkey\b|secret|token|\bsql\b/i
      );
      expect(message.length).toBeGreaterThan(0);
    }
    expect(ERROR_MESSAGE.FEATURE_DISABLED).toBe('Not found');
    expect(ERROR_MESSAGE.INTERNAL).toBe('Something went wrong on our side.');
  });
});

describe('errorBody', () => {
  const trace = newTrace().snapshot();

  it('is the failure format with the code, its message and the trace', () => {
    expect(errorBody('INTERNAL', trace)).toEqual({
      success: false,
      error: { code: 'INTERNAL', message: 'Something went wrong on our side.' },
      trace,
    });
  });

  it('carries a refusal when there is one, and no key for it when there is none', () => {
    const refusal = {
      schema: 'intake-refusal/1',
      code: 'OUT_OF_SCOPE',
      stage: 'SCOPE',
      reply_locale: 'de',
      reply: 'x',
    } as const;
    const withRefusal = errorBody('OUT_OF_SCOPE', trace, { refusal });
    expect(withRefusal.refusal).toBe(refusal);
    expect('refusal' in errorBody('OUT_OF_SCOPE', trace)).toBe(false);
  });

  it('takes the reader’s own message when it has one', () => {
    expect(
      errorBody('BAD_REQUEST', trace, { message: 'question must be text.' })
        .error
    ).toEqual({ code: 'BAD_REQUEST', message: 'question must be text.' });
  });
});
