'use client';

import { useEffect } from 'react';

// ~14 min per the order's candidate cadence. Purely a refresh-token rotation
// hygiene loop (limits a leaked refresh token's blast radius to one rotation
// window) — NOT driven by the access token's own expiry, which already
// matches NextAuth's 30-day session.maxAge (see
// next-auth-jwt-encode.util.ts).
const REFRESH_INTERVAL_MS = 14 * 60 * 1000;

/**
 * Silent-refresh loop for the operation-service token bridge (Session 3-3).
 *
 * Fire-and-forget by design: every existing real user today only carries a
 * NextAuth session cookie, no operation-service refresh-token cookie (that
 * cookie is httpOnly, so this component has no way to check for its
 * presence client-side before firing) — every tick for those users is a
 * fast server-side no-op (the route handler returns 401 NO_REFRESH_TOKEN).
 * This loop deliberately never inspects the response or redirects/logs a
 * user out itself; that stays the job of the existing "not authenticated"
 * paths (middleware, per-page session checks) if a real rotation ever
 * fails.
 */
export function TokenRefreshProvider(): null {
  useEffect(() => {
    const tick = (): void => {
      fetch('/api/auth/token-refresh', { method: 'POST' }).catch(() => {
        // Network blip — the next tick tries again; never surfaced to the user.
      });
    };

    const interval = setInterval(tick, REFRESH_INTERVAL_MS);
    return () => clearInterval(interval);
  }, []);

  return null;
}
