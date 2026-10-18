/**
 * Reading a request body, and what the two intake routes accept from it.
 *
 * A body is JSON, an object, small (8 KiB: a question is at most 500 characters, so even every
 * character escaped in the longest way fits with room), and sent as `application/json` (a
 * browser form cannot send that without a CORS preflight, which is the cheap CSRF guard the
 * session cookie's SameSite setting backs up). It is read ONCE, and only after the flag, the
 * session and the tier have passed (`runGate` calls the reader between the third and fourth
 * checks), so a switched-off feature, an anonymous caller or a Free trader never has a body read.
 *
 * The routes then take nothing from it but:
 *  - typed route:   `question` (text) and, optionally, `threadId`;
 *  - instant route: `kind` (one of the two labels of Panel C) and, optionally, `threadId`.
 *
 * Every other field is ignored, by construction: the readers build a new object from the named
 * keys, they never spread or merge the body. A user id, a tier, a language, a symbol, an intent
 * or a profile a client sends has nowhere to go: who the caller is comes from the session, the
 * language from the interface setting the server reads, the symbol is gold, the intent comes
 * from the Understand step or the label.
 *
 * @module lib/intake/server/request
 */

import 'server-only';

import { INSTANT_INTENTS, isInstantIntent } from '../intents';
import type { IntakeRequest } from '../pipeline';
import type { RequestRead } from '../gate';
import type { RequestFailure } from './errors';

/** 8 KiB. The door limit on the question (500 characters) is a refusal in the trader's language; this is the transport's. */
export const MAX_BODY_CHARS = 8_192;

export type BodyRead =
  | { ok: true; body: Record<string, unknown> }
  | { ok: false; failure: RequestFailure };

const fail = (
  code: RequestFailure['code'],
  message: string
): { ok: false; failure: RequestFailure } => ({
  ok: false,
  failure: { code, message },
});

export async function readJsonBody(request: Request): Promise<BodyRead> {
  const type = request.headers.get('content-type') ?? '';
  if (!/^application\/json\s*(;|$)/i.test(type)) {
    return fail(
      'UNSUPPORTED_MEDIA_TYPE',
      'The body must be sent as application/json.'
    );
  }
  const declared = request.headers.get('content-length');
  if (declared !== null && /^[0-9]+$/.test(declared)) {
    if (BigInt(declared) > BigInt(MAX_BODY_CHARS)) {
      return fail('PAYLOAD_TOO_LARGE', 'The body is too large.');
    }
  }
  let text: string;
  try {
    text = await request.text();
  } catch {
    return fail('BAD_REQUEST', 'The body is unreadable.');
  }
  if (text.length > MAX_BODY_CHARS) {
    return fail('PAYLOAD_TOO_LARGE', 'The body is too large.');
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return fail('BAD_REQUEST', 'The body is not JSON.');
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    return fail('BAD_REQUEST', 'The body must be a JSON object.');
  }
  return { ok: true, body: parsed as Record<string, unknown> };
}

function own(body: Record<string, unknown>, key: string): unknown {
  return Object.prototype.hasOwnProperty.call(body, key)
    ? body[key]
    : undefined;
}

type Read<T> = { ok: true; value: T } | { ok: false; message: string };

/** The thread the request names: absent, null or text; the thread port decides whether it is one. */
function readThreadId(body: Record<string, unknown>): Read<string | null> {
  const raw = own(body, 'threadId');
  if (raw === undefined || raw === null) return { ok: true, value: null };
  if (typeof raw !== 'string') {
    return { ok: false, message: 'threadId must be text.' };
  }
  return { ok: true, value: raw };
}

/** The request of the typed route: the question as typed, and a thread. */
export function readTypedRequest(
  body: Record<string, unknown>
): RequestRead<IntakeRequest, RequestFailure> {
  const question = own(body, 'question');
  if (typeof question !== 'string') {
    return {
      ok: false,
      failure: { code: 'BAD_REQUEST', message: 'question must be text.' },
    };
  }
  const thread = readThreadId(body);
  if (!thread.ok) {
    return {
      ok: false,
      failure: { code: 'BAD_REQUEST', message: thread.message },
    };
  }
  return {
    ok: true,
    request: { kind: 'TYPED', question, threadId: thread.value },
  };
}

/** The request of the instant route: the label of the button that was pressed, and a thread. Nothing typed, no language. */
export function readInstantRequest(
  body: Record<string, unknown>
): RequestRead<IntakeRequest, RequestFailure> {
  const kind = own(body, 'kind');
  if (!isInstantIntent(kind)) {
    return {
      ok: false,
      failure: {
        code: 'BAD_REQUEST',
        message: `kind must be ${INSTANT_INTENTS.join(' or ')}.`,
      },
    };
  }
  const thread = readThreadId(body);
  if (!thread.ok) {
    return {
      ok: false,
      failure: { code: 'BAD_REQUEST', message: thread.message },
    };
  }
  return {
    ok: true,
    request: { kind: 'INSTANT', intent: kind, threadId: thread.value },
  };
}
