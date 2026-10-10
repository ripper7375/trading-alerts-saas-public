/**
 * Engine 4: is Report 2 offered for this cycle (architecture 6.4, 6.13)?
 *
 * POST { cycleSlot?, zoneId? } runs the offer check on server-read data (the live
 * data status from the gateway, the newest cycle, the news calendar, the broker
 * figures) and answers with the verdict and the modal definition the trader fills
 * in. Without `cycleSlot` the newest reading is the pinned one; the answer names
 * the cycle every later call must send.
 *
 * Off unless ENGINE4_REPORT2_ENABLED is `true`; signed-in Pro traders only.
 *
 * @module app/api/engine4/offer/route
 */

import { handleOffer } from '@/lib/engine4/server/handlers';
import { runRoute } from '@/lib/engine4/server/respond';

export const dynamic = 'force-dynamic';

export async function POST(request: Request): Promise<Response> {
  return runRoute({ route: 'offer', request, takesBody: true }, (context) =>
    handleOffer(context)
  );
}
