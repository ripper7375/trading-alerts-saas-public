/**
 * Auth Bridge Rollout Flag (Session 4B-20, DECISION-LOG.md F56)
 *
 * Client-readable feature flag controlling whether the login/register forms
 * call operation-service's token-* bridge routes (app/api/auth/token-login,
 * token-register) instead of next-auth/react's signIn('credentials', ...) /
 * the monolith's own app/api/auth/register. NEXT_PUBLIC_-prefixed so the same
 * read works in both 'use client' components and server code, without a
 * dedicated "who am I" round trip just to decide which path to take — same
 * bracket-notation convention this repo already uses for a live client-side
 * NEXT_PUBLIC_ read (hooks/use-ohlcv-socket.ts's NEXT_PUBLIC_MT5_WS_URL).
 *
 * Default: false (forms stay on next-auth/react / the monolith's own
 * register route) — Session 4B-21 is the dedicated cutover session that sets
 * this true in production. OAuth login (Google/Twitter/LinkedIn) is entirely
 * unaffected by this flag either way (F56, Option B) — it stays on
 * next-auth/react's signIn() against auth-options.ts regardless.
 *
 * @module lib/auth/auth-bridge-flag
 */
export function isAuthBridgeEnabled(): boolean {
  return process.env['NEXT_PUBLIC_AUTH_BRIDGE_ENABLED'] === 'true';
}
