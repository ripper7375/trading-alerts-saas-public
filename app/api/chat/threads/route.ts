/**
 * The trader's chat threads (architecture 5.13, 7.5).
 *
 * GET lists them, newest message first: `?limit=` (1 to 100, 50 by default) and `?after=` (the opaque
 * `next` of the previous page). Off unless REPLY_ENABLED is `true`; signed-in Pro traders only; a trader
 * sees their own threads and nobody else's.
 *
 * @module app/api/chat/threads/route
 */

import {
  createChatAuth,
  handleThreadsList,
} from '@/lib/reply/server/threads-api';

export const dynamic = 'force-dynamic';

export async function GET(request: Request): Promise<Response> {
  return handleThreadsList(request, { auth: createChatAuth() });
}
