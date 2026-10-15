/**
 * The AI analyst's message route: a typed question or a press of a Panel C button becomes a checked,
 * stored reply (architecture 5.1 to 5.14, ADR-054).
 *
 * POST { client_request_id, question | kind, thread_id? } runs the gate (flag, session, tier, thread,
 * profile, quota), holds the worst case of the request in the quota ledger, runs the intake path, the
 * answer gate, the model with its fallback, the number and wording checks, composes the reply, settles
 * what was spent and stores the thread, the messages and the trace row. The user, the tier and the
 * language come from the server (the session and the interface setting), never from the body.
 *
 * The answer is NDJSON (stage events, then one `result`, `refusal` or `error`) once the gate has passed;
 * a request turned away at the gate is a JSON error with the HTTP status of its reason. The reply is
 * delivered whole, never token by token.
 *
 * Off unless REPLY_ENABLED is `true` (404 to everybody otherwise); signed-in Pro traders with a
 * confirmed profile only. `/api/chat/token` (the support chat's socket) is another thing.
 *
 * @module app/api/chat/message/route
 */

import { after } from 'next/server';

import { runMessageRoute } from '@/lib/reply/server/respond';

export const dynamic = 'force-dynamic';

/** Seconds. The run's own deadline is 55: the board-only answer goes out before the platform stops us. */
export const maxDuration = 60;

export async function POST(request: Request): Promise<Response> {
  return runMessageRoute(request, {
    // a client that leaves does not end the run: the platform keeps the function until it has stored the reply
    keepAlive: (task) => after(() => task),
  });
}
