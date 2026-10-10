/**
 * The one error format of the Engine 4 routes, and the one success format.
 *
 * Every answer, success or failure, is
 *
 *   { success: true,  ...fields, trace }
 *   { success: false, error: { code, message, details? }, trace }
 *
 * with the HTTP status the code maps to. `code` is what the modal and the chat
 * translate (step 6 has the 19 languages); `message` is English for a log or a
 * developer. The trace is always there, even for a request refused before it
 * started (a switched-off feature, no session), so support can open any request id.
 *
 * What is NOT in an answer: a stack, a database message, an environment
 * variable's name or value, the audit key. A failure the code does not know is
 * `INTERNAL` with a fixed message; the cause goes to the server log.
 *
 * @module lib/engine4/server/errors
 */

import type { RequestTrace } from './trace';

export type Engine4ErrorCode =
  /** the feature flag is off: the routes do not exist for anybody */
  | 'FEATURE_DISABLED'
  | 'UNAUTHENTICATED'
  | 'TIER_REQUIRED'
  | 'BAD_REQUEST'
  | 'UNSUPPORTED_MEDIA_TYPE'
  | 'PAYLOAD_TOO_LARGE'
  /** the profile sent does not pass `validateProfile`; `details.issues` lists every problem */
  | 'INVALID_PROFILE'
  /** the trader has not confirmed a profile yet: nothing to size against */
  | 'PROFILE_NOT_SET'
  /** a consent record cannot be made for this setup; `details.code` says which refusal */
  | 'CONSENT_REFUSED'
  /** the setup recomputed now is not the one the trader was shown */
  | 'SETUP_CHANGED'
  /** another request with this submission id is still running */
  | 'SUBMISSION_IN_FLIGHT'
  /** this submission id was used for a different request */
  | 'SUBMISSION_ID_REUSED'
  /** a reading the answer cannot be made without could not be read */
  | 'DATA_UNAVAILABLE'
  /** the audit key is not provisioned: nothing that writes an audit row may run */
  | 'AUDIT_NOT_CONFIGURED'
  | 'INTERNAL';

export const ERROR_STATUS: Readonly<Record<Engine4ErrorCode, number>> = {
  FEATURE_DISABLED: 404,
  UNAUTHENTICATED: 401,
  TIER_REQUIRED: 403,
  BAD_REQUEST: 400,
  UNSUPPORTED_MEDIA_TYPE: 415,
  PAYLOAD_TOO_LARGE: 413,
  INVALID_PROFILE: 422,
  PROFILE_NOT_SET: 409,
  CONSENT_REFUSED: 422,
  SETUP_CHANGED: 409,
  SUBMISSION_IN_FLIGHT: 409,
  SUBMISSION_ID_REUSED: 422,
  DATA_UNAVAILABLE: 503,
  AUDIT_NOT_CONFIGURED: 503,
  INTERNAL: 500,
};

export interface Engine4ErrorBody {
  success: false;
  error: {
    code: Engine4ErrorCode;
    message: string;
    details?: Record<string, unknown>;
  };
  trace: RequestTrace;
}

export type Engine4SuccessBody<T extends object> = { success: true } & T & {
    trace: RequestTrace;
  };

/** A failure raised inside a route: `respond.ts` turns it into the error format. */
export class Engine4HttpError extends Error {
  constructor(
    readonly code: Engine4ErrorCode,
    message: string,
    readonly details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'Engine4HttpError';
  }
}

export function errorBody(
  code: Engine4ErrorCode,
  message: string,
  trace: RequestTrace,
  details?: Record<string, unknown>
): Engine4ErrorBody {
  return {
    success: false,
    error: {
      code,
      message,
      ...(details === undefined ? {} : { details }),
    },
    trace,
  };
}
