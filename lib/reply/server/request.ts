/**
 * What `POST /api/chat/message` accepts from a body (build step 7 part 7b; plan part 7 (3)).
 *
 * The body is read ONCE, by the intake path's reader (JSON, an object, at most 8 KiB, sent as
 * `application/json`), and only after the flag, the session and the tier have passed: `runReply`
 * calls the reader between the third and fourth checks of the gate, so a switched-off route, an
 * anonymous caller or a Free trader never has a body read. The route then takes nothing from it but:
 *
 *   client_request_id   required, a UUID: the key of the request. One per button press or sent message.
 *                       The same trader sending the same id again is the same request (charged once).
 *   thread_id           optional, text or null: the conversation this belongs to; the gate decides
 *                       whether it is the trader's (another trader's is THREAD_INVALID)
 *   question            a typed question, as typed; OR
 *   kind                the label of a Panel C button (`INSTANT_M5_INSPECT` or `INSTANT_M15_INSPECT`)
 *
 * Exactly one of `question` and `kind`. Every other field is ignored, by construction: the reader
 * builds a new object from the named keys, it never spreads or merges the body. A user id, a tier, a
 * language, a symbol, an intent or a profile that a client sends has nowhere to go: who the caller is
 * comes from the session, the language from the interface setting the server reads, the symbol is
 * gold, the intent comes from the Understand step or the label.
 *
 * Pure but for the body reader it takes from the intake path.
 *
 * @module lib/reply/server/request
 */

import { readJsonBody } from '@/lib/intake/server/request';
import type { RequestFailure } from '@/lib/intake/server/errors';

import { isInstantIntent, INSTANT_INTENTS } from '../contracts/intake';
import type { RequestRead } from '../contracts/intake';
import type { ReplyRequest } from '../run/types';

export { readJsonBody };
export type { RequestFailure };

/** A UUID in its usual text form, any version. */
export const CLIENT_REQUEST_UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function own(body: Record<string, unknown>, key: string): unknown {
  return Object.prototype.hasOwnProperty.call(body, key)
    ? body[key]
    : undefined;
}

const bad = (message: string): { ok: false; failure: RequestFailure } => ({
  ok: false,
  failure: { code: 'BAD_REQUEST', message },
});

export function readReplyRequest(
  body: Record<string, unknown>
): RequestRead<ReplyRequest, RequestFailure> {
  const clientRequestId = own(body, 'client_request_id');
  if (
    typeof clientRequestId !== 'string' ||
    !CLIENT_REQUEST_UUID.test(clientRequestId)
  ) {
    return bad('client_request_id must be a UUID.');
  }
  const rawThread = own(body, 'thread_id');
  if (
    rawThread !== undefined &&
    rawThread !== null &&
    typeof rawThread !== 'string'
  ) {
    return bad('thread_id must be text.');
  }
  const threadId = typeof rawThread === 'string' ? rawThread : null;

  const question = own(body, 'question');
  const kind = own(body, 'kind');
  if (question !== undefined && kind !== undefined) {
    return bad('Send a question or a kind, not both.');
  }
  if (question !== undefined) {
    if (typeof question !== 'string') return bad('question must be text.');
    return {
      ok: true,
      request: { kind: 'TYPED', question, threadId, clientRequestId },
    };
  }
  if (kind !== undefined) {
    if (!isInstantIntent(kind)) {
      return bad(`kind must be ${INSTANT_INTENTS.join(' or ')}.`);
    }
    return {
      ok: true,
      request: { kind: 'INSTANT', intent: kind, threadId, clientRequestId },
    };
  }
  return bad('Send a question or a kind.');
}
