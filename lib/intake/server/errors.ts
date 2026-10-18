/**
 * The one error format of the intake routes, and the one success format.
 *
 * Every answer, success or failure, is
 *
 *   { success: true,  packet, trace }
 *   { success: false, error: { code, message }, refusal?, trace }
 *
 * with the HTTP status the code maps to. A refusal of the intake path (the gate, the door, the
 * Understand call, the scope check) carries `refusal`, an `intake-refusal/1` with the fixed
 * reply in the locale the trader reads: that reply is what the chat shows. `message` is English,
 * for a log or a developer. The trace is always there, even for a request refused before it
 * started (a switched-off feature, no session), so support can open any request id.
 *
 * What is NOT in an answer: a stack, a database message, an environment variable's name or
 * value, the model's key, the knowledge service's key, a user id. A failure the code does not
 * know is `INTERNAL` with a fixed message; the cause goes to the server log.
 *
 * HTTP statuses are chosen here, as `lib/engine4/server/errors.ts` does for Engine 4:
 * a refusal that is the trader's to fix is 4xx (401 sign in, 403 tier, 409 profile, 422 the
 * thread, the question or its scope, 429 the allowance), one that is ours is 503.
 *
 * @module lib/intake/server/errors
 */

import 'server-only';

import type { IntakePacket } from '../packet';
import type { IntakeRefusal, RefusalCode } from '../refusal';
import type { IntakeTrace } from '../trace';

export type IntakeErrorCode =
  /** the feature flag is off: the routes do not exist for anybody */
  | 'FEATURE_DISABLED'
  | RefusalCode
  | 'BAD_REQUEST'
  | 'UNSUPPORTED_MEDIA_TYPE'
  | 'PAYLOAD_TOO_LARGE'
  | 'INTERNAL';

export const ERROR_STATUS: Readonly<Record<IntakeErrorCode, number>> = {
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
};

/** English, for a developer or a log; the trader reads the localized reply of the refusal. */
export const ERROR_MESSAGE: Readonly<Record<IntakeErrorCode, string>> = {
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
};

/** A request whose body could not be read: the reader's failure, which is not a refusal of the gate. */
export interface RequestFailure {
  code: Extract<
    IntakeErrorCode,
    'BAD_REQUEST' | 'UNSUPPORTED_MEDIA_TYPE' | 'PAYLOAD_TOO_LARGE'
  >;
  message: string;
}

export interface IntakeErrorBody {
  success: false;
  error: { code: IntakeErrorCode; message: string };
  /** present for every refusal of the intake path */
  refusal?: IntakeRefusal;
  trace: IntakeTrace;
}

export interface IntakeSuccessBody {
  success: true;
  packet: IntakePacket;
  trace: IntakeTrace;
}

export function errorBody(
  code: IntakeErrorCode,
  trace: IntakeTrace,
  options: { message?: string; refusal?: IntakeRefusal } = {}
): IntakeErrorBody {
  return {
    success: false,
    error: { code, message: options.message ?? ERROR_MESSAGE[code] },
    ...(options.refusal === undefined ? {} : { refusal: options.refusal }),
    trace,
  };
}
