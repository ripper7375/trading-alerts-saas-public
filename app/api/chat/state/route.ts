/**
 * The chat panel's state in one call (architecture 5.12, 7.3; ADR-072, ADR-073): the models that passed
 * the evaluation with the units a message costs (measured, or null), this month's balance, the trader's
 * type and the cycle the data is on.
 *
 * Off unless REPLY_ENABLED is `true`; signed-in Pro traders only.
 *
 * @module app/api/chat/state/route
 */

import { createStateApiDeps, handleState } from '@/lib/reply/server/state-api';

export const dynamic = 'force-dynamic';

export async function GET(request: Request): Promise<Response> {
  return handleState(request, createStateApiDeps());
}
