/**
 * Engine 4: the trader's profile (architecture 6.2, 6.11).
 *
 * GET  reads the confirmed profile, or the defaults to pre-fill the card when there is none.
 * POST confirms the profile: validates it, saves it as the current one and appends a
 *      snapshot of the change to the history in one transaction.
 *
 * Off unless ENGINE4_REPORT2_ENABLED is `true`; signed-in Pro traders only.
 *
 * @module app/api/engine4/profile/route
 */

import {
  handleProfileGet,
  handleProfilePost,
} from '@/lib/engine4/server/handlers';
import { runRoute } from '@/lib/engine4/server/respond';

export const dynamic = 'force-dynamic';

export async function GET(request: Request): Promise<Response> {
  return runRoute(
    { route: 'profile', request, takesBody: false },
    handleProfileGet
  );
}

export async function POST(request: Request): Promise<Response> {
  return runRoute(
    { route: 'profile', request, takesBody: true },
    handleProfilePost
  );
}
