/**
 * One chat thread (architecture 5.13, 7.5; decisions D15, D16, D18).
 *
 * GET    the thread and its messages.
 * PATCH  { "title": "..." } renames it; the trader's own title is never replaced by a derived one.
 * DELETE removes the thread and its messages. The audit row of every answer (`request_traces`) is kept:
 * it holds no question and is the seven-year record.
 *
 * A thread that is not the trader's is 404 THREAD_INVALID, the same answer as one that does not exist.
 * Off unless REPLY_ENABLED is `true`; signed-in Pro traders only.
 *
 * @module app/api/chat/threads/[id]/route
 */

import {
  createChatAuth,
  handleThreadDelete,
  handleThreadGet,
  handleThreadRename,
} from '@/lib/reply/server/threads-api';

export const dynamic = 'force-dynamic';

interface Context {
  params: Promise<{ id: string }>;
}

export async function GET(request: Request, context: Context) {
  const { id } = await context.params;
  return handleThreadGet(request, id, { auth: createChatAuth() });
}

export async function PATCH(request: Request, context: Context) {
  const { id } = await context.params;
  return handleThreadRename(request, id, { auth: createChatAuth() });
}

export async function DELETE(request: Request, context: Context) {
  const { id } = await context.params;
  return handleThreadDelete(request, id, { auth: createChatAuth() });
}
