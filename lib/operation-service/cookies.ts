// Cookie names/attributes for the operation-service token bridge (Session 3-3).
//
// SESSION_COOKIE_NAME deliberately matches lib/auth/auth-options.ts's `cookies`
// block EXACTLY (F26, DECISION-LOG.md: reuse NextAuth's cookie so existing
// session-reading code — getServerSession, next-auth/jwt's getToken — accepts
// a token minted by operation-service with zero changes). Session 3-3's own
// CONFIRM found the Decision Log's literal string ("next-auth.session-token")
// was the non-production value only; the real per-environment name/attributes
// are reproduced here from the live auth-options.ts config, not the shorthand.
//
// No Node-only APIs here — this module is imported by middleware.ts, which
// runs on the Edge runtime.

const isProduction = process.env.NODE_ENV === 'production';

export const SESSION_COOKIE_NAME = isProduction
  ? '__Secure-next-auth.session-token'
  : 'next-auth.session-token';

// New cookie (F26 only decided the session cookie's name) — not a NextAuth
// concept, so no existing name to reuse. Prefixed the same way in production
// for consistency with the session cookie's own __Secure- convention.
export const REFRESH_COOKIE_NAME = isProduction
  ? '__Secure-operation-refresh-token'
  : 'operation-refresh-token';

// Both match their respective backing tokens' real expiry: the access JWE's
// own exp claim (next-auth-jwt-encode.util.ts's SESSION_MAX_AGE_SECONDS) and
// the RefreshToken row's TTL (refresh-token.service.ts's REFRESH_TOKEN_TTL_MS)
// — both 30 days, both already matched to auth-options.ts's session.maxAge.
export const SESSION_COOKIE_MAX_AGE = 30 * 24 * 60 * 60;
export const REFRESH_COOKIE_MAX_AGE = 30 * 24 * 60 * 60;

export function tokenCookieOptions(maxAge: number): {
  httpOnly: true;
  sameSite: 'lax';
  path: '/';
  secure: boolean;
  maxAge: number;
} {
  return {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    secure: isProduction,
    maxAge,
  };
}
