/**
 * The two instant prompts of Panel C ("Ask AI about M5 Chart" and "M15 Chart"): the same intake
 * path as a typed question, without the Understand and scope steps (architecture 4.2, 4.10).
 *
 * POST { kind: "INSTANT_M5_INSPECT" | "INSTANT_M15_INSPECT", threadId? } and nothing else: no text
 * and no language. The reply is written in the language of the interface setting the server
 * reads. The gate applies like any question: sign-in, tier and the quota pre-check.
 *
 * Off unless INTAKE_ENABLED is `true`; the buttons that call it render only when
 * INTAKE_INSTANT_PROMPTS_ENABLED is `true` as well (part 10).
 *
 * @module app/api/intake/instant/route
 */

import { runIntakeRoute } from '@/lib/intake/server/respond';

export const dynamic = 'force-dynamic';

export async function POST(request: Request): Promise<Response> {
  return runIntakeRoute({ route: 'instant', request });
}
