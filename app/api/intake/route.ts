/**
 * The AI analyst's intake: a typed question becomes an `intake-packet/1` for Section 5, or a
 * fixed reply in the trader's language when it cannot (architecture chapter 4).
 *
 * POST { question, threadId? } runs the gate (flag, session, tier, thread, profile, quota), the
 * door, the Understand step and the scope check, then reads the latest complete cycle, builds the
 * sensor board, routes the question and retrieves the knowledge. The user, the tier and the
 * language come from the server (the session and the interface setting), never from the body.
 *
 * Off unless INTAKE_ENABLED is `true`; signed-in Pro traders with a confirmed profile only.
 *
 * @module app/api/intake/route
 */

import { runIntakeRoute } from '@/lib/intake/server/respond';

export const dynamic = 'force-dynamic';

export async function POST(request: Request): Promise<Response> {
  return runIntakeRoute({ route: 'typed', request });
}
