/**
 * Engine 4: validate and size a setup (architecture 6.7, 6.10).
 *
 * POST { cycleSlot, zoneId?, entry?, equity, riskPct, stopDistance, rrr, side?,
 * language? } recomputes everything on the server from the cycle, the zone and the
 * trader's own inputs, and answers with the one `ValidatedSetup` (the eight checks,
 * the three scenarios, the underflow help), its hash, and the badge. A figure the
 * client computes and sends along (a lot, a scenario, a profile, a verdict) is
 * ignored: it has nowhere to go.
 *
 * Off unless ENGINE4_REPORT2_ENABLED is `true`; signed-in Pro traders only.
 *
 * @module app/api/engine4/size/route
 */

import { handleSize } from '@/lib/engine4/server/handlers';
import { runRoute } from '@/lib/engine4/server/respond';

export const dynamic = 'force-dynamic';

export async function POST(request: Request): Promise<Response> {
  return runRoute({ route: 'size', request, takesBody: true }, (context) =>
    handleSize(context)
  );
}
