import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

import {
  createOperationApi,
  unwrapOperationApi,
} from '@/lib/api/generated/operation-api/client';
import { csrfErrorResponse, validateOrigin } from '@/lib/csrf';
import {
  REFRESH_COOKIE_NAME,
  SESSION_COOKIE_NAME,
} from '@/lib/operation-service/cookies';

// Additive logout for the operation-service token bridge — does not touch
// next-auth/react's signOut() call sites (those still clear the same-named
// session cookie their own way; unaffected by this route's existence).
export async function POST(): Promise<NextResponse> {
  if (!(await validateOrigin())) {
    return csrfErrorResponse() as NextResponse;
  }

  const cookieStore = await cookies();
  const refreshToken = cookieStore.get(REFRESH_COOKIE_NAME)?.value;

  if (refreshToken) {
    try {
      const api = createOperationApi(null);
      const apiResult = await api.POST('/auth/logout', {
        body: { refreshToken } as never,
      });
      await unwrapOperationApi(apiResult);
    } catch (error) {
      // logout is idempotent server-side (revokeByRawToken) and these
      // cookies are being cleared either way — a network blip here must not
      // block the client from clearing its own local session state.
      console.error('[token-logout] operation-service call failed:', error);
    }
  }

  cookieStore.delete(SESSION_COOKIE_NAME);
  cookieStore.delete(REFRESH_COOKIE_NAME);

  return NextResponse.json({ success: true });
}
