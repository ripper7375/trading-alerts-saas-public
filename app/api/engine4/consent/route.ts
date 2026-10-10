/**
 * Engine 4: record what the trader did with a setup (architecture 6.11, ADR-069).
 *
 * POST { action, submissionId, shownSetupSha256, cycleSlot, zoneId?, ...inputs }
 * recomputes the setup on the server, and writes ONE append-only consent record if
 * and only if it is the setup the trader was shown. One `submissionId` writes at
 * most one record: a repeat of the same press gets the same answer.
 *
 * Off unless ENGINE4_REPORT2_ENABLED is `true`; signed-in Pro traders only. Needs
 * ENGINE4_AUDIT_HMAC_KEY: without it nothing is written (503).
 *
 * @module app/api/engine4/consent/route
 */

import { handleConsent } from '@/lib/engine4/server/handlers';
import { runRoute } from '@/lib/engine4/server/respond';

export const dynamic = 'force-dynamic';

export async function POST(request: Request): Promise<Response> {
  return runRoute({ route: 'consent', request, takesBody: true }, (context) =>
    handleConsent(context)
  );
}
