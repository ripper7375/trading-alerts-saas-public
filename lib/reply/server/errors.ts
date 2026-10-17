/**
 * The error format of the chat routes (build step 7 part 7b; the format of `lib/intake/server/errors.ts`
 * and `lib/engine4/server/errors.ts`, extended by the request id and the balance).
 *
 * A request that is turned away BEFORE the stream begins (the route is switched off, the body cannot
 * be read, the gate says no) is answered with a plain JSON body and the HTTP status the code maps to:
 *
 *   { success: false, error: { code, message }, request_id?, refusal?, quota? }
 *
 * A refusal of the gate or the door carries `refusal`, an `intake-refusal/1` whose `reply` is the fixed
 * text in the locale the trader reads: that text is what the chat shows. A refusal because the allowance
 * cannot cover the request carries `quota` too, the balance in units: how much the month allows
 * (`limit_units`), how much is free (`available_units`) and how much this request would have held
 * (`needed_units`). The interface turns them into a share and "about N analyses left" (ADR-073); it
 * never prints them as a number of tokens.
 *
 * What is NOT in an answer: a stack, a database message, an environment variable's name or value, a key,
 * a user id. `message` is English, for a developer or a log; a failure the code does not know is
 * `INTERNAL` with a fixed message and the cause goes to the server log.
 *
 * The statuses are the intake routes' (404 off, 401 sign in, 403 tier, 409 profile, 422 the thread or
 * the question, 429 the allowance, 503 ours), plus 404 for a thread that is not the trader's.
 *
 * Server code only; pure itself.
 *
 * @module lib/reply/server/errors
 */

import 'server-only';

import {
  ERROR_MESSAGE,
  ERROR_STATUS,
  type IntakeErrorCode,
} from '@/lib/intake/server/errors';

import type { IntakeRefusal } from '../contracts/intake';
import type { QuotaDetail } from '../run/types';

export type ChatErrorCode = IntakeErrorCode;

/** The balance as the wire carries it. */
export interface QuotaBody {
  limit_units: number;
  available_units: number;
  needed_units: number;
}

export interface ChatErrorBody {
  success: false;
  error: { code: ChatErrorCode; message: string };
  request_id?: string;
  refusal?: IntakeRefusal;
  quota?: QuotaBody;
}

export function quotaBody(detail: QuotaDetail): QuotaBody {
  return {
    limit_units: detail.limitUnits,
    available_units: detail.availableUnits,
    needed_units: detail.neededUnits,
  };
}

export interface ChatErrorOptions {
  requestId?: string;
  message?: string;
  refusal?: IntakeRefusal;
  quota?: QuotaDetail | null;
  /** the status, when it is not the one the code maps to (a thread that is not yours is 404, not 422) */
  status?: number;
}

export function chatErrorBody(
  code: ChatErrorCode,
  options: ChatErrorOptions = {}
): ChatErrorBody {
  return {
    success: false,
    error: { code, message: options.message ?? ERROR_MESSAGE[code] },
    ...(options.requestId === undefined
      ? {}
      : { request_id: options.requestId }),
    ...(options.refusal === undefined ? {} : { refusal: options.refusal }),
    ...(options.quota === undefined || options.quota === null
      ? {}
      : { quota: quotaBody(options.quota) }),
  };
}

/** Every answer of these routes is about THIS trader and THIS minute: nothing may keep it. */
export function jsonHeaders(requestId?: string): Record<string, string> {
  return {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    ...(requestId === undefined ? {} : { 'X-Request-Id': requestId }),
  };
}

export function chatErrorResponse(
  code: ChatErrorCode,
  options: ChatErrorOptions = {}
): Response {
  return new Response(JSON.stringify(chatErrorBody(code, options)), {
    status: options.status ?? ERROR_STATUS[code],
    headers: jsonHeaders(options.requestId),
  });
}

export function jsonResponse(
  body: unknown,
  status = 200,
  requestId?: string
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: jsonHeaders(requestId),
  });
}
