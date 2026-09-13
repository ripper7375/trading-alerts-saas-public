/**
 * Post-sign-in return address, taken from a `?callbackUrl=` query parameter.
 *
 * middleware.ts (and a few pages) send a signed-out visitor to
 * `/login?callbackUrl=<where they were going>`. Until 2026-09-13 the login
 * form ignored that parameter and always went to /dashboard. Honouring it
 * means trusting a value anyone can put in a link, which is a textbook open
 * redirect (`/login?callbackUrl=https://evil.example` -> sign in -> phishing
 * page on a domain the user just saw us vouch for). So this accepts ONLY a
 * same-site relative path and falls back to the default for anything else.
 *
 * Accepted: `/pro/currency-index/compare`, `/alerts?tab=active#x`.
 * Rejected (-> fallback): absolute URLs (`https://...`), protocol-relative
 * (`//evil.example`), backslash tricks browsers normalise to `//`
 * (`/\evil.example`), scheme-like values (`javascript:...`), anything with
 * control characters or whitespace, and the auth pages themselves (a return
 * to /login after logging in is a loop).
 *
 * @module lib/auth/safe-callback-url
 */

export const DEFAULT_POST_LOGIN_PATH = '/dashboard';

const AUTH_PAGES = ['/login', '/register', '/verify-2fa'];
const PROBE_ORIGIN = 'https://callback.invalid';

export function safeCallbackUrl(
  raw: string | null | undefined,
  fallback: string = DEFAULT_POST_LOGIN_PATH
): string {
  if (typeof raw !== 'string' || raw.length === 0 || raw.length > 2048) {
    return fallback;
  }
  // Must be a path: one leading slash, not two, and no backslash anywhere
  // (browsers treat `\` as `/`, so `/\evil` behaves like `//evil`).
  if (!raw.startsWith('/') || raw.startsWith('//') || raw.includes('\\')) {
    return fallback;
  }
  // Control characters and whitespace have no business in a return path and
  // are how several URL-parser confusions are smuggled in.
  if (/[\u0000-\u001F\u007F\s]/.test(raw)) {
    return fallback;
  }

  let parsed: URL;
  try {
    parsed = new URL(raw, PROBE_ORIGIN);
  } catch {
    return fallback;
  }
  // Belt and braces: whatever the string looked like, resolving it against a
  // fixed origin must not have changed the origin.
  if (parsed.origin !== PROBE_ORIGIN) {
    return fallback;
  }
  if (
    AUTH_PAGES.some(
      (page) =>
        parsed.pathname === page || parsed.pathname.startsWith(`${page}/`)
    )
  ) {
    return fallback;
  }

  return `${parsed.pathname}${parsed.search}${parsed.hash}`;
}

/** The safe callbackUrl from the current browser location (client-only). */
export function callbackUrlFromLocation(
  fallback: string = DEFAULT_POST_LOGIN_PATH
): string {
  if (typeof window === 'undefined') return fallback;
  return safeCallbackUrl(
    new URLSearchParams(window.location.search).get('callbackUrl'),
    fallback
  );
}
