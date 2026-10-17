import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';

import { validateOrigin } from '@/lib/csrf';
import { SESSION_COOKIE_NAME } from '@/lib/operation-service/cookies';
import {
  COUNTRY_HEADER,
  LOCALE_COOKIE,
  isSupportedCountryPrefix,
  preferencesForCountryPrefix,
} from '@/lib/i18n/locale-resolver';

// Session 3-3's "middleware guard" candidate step — the first middleware.ts
// this repo has ever had (every matched request passes through it, hence
// the conservative matcher below and the fail-open catch). Additive, not a
// cutover: getToken() reads the SAME cookie app/(dashboard)/layout.tsx
// already checks via getServerSession(authOptions), under the exact name/
// format NextAuth itself uses (F26) — a token minted by either the existing
// NextAuth flow or the new operation-service cookie-set route
// (app/api/auth/token-login) decodes identically here. Every real user
// today already carries a valid NextAuth cookie, so this changes nothing
// observable for them; it only adds an earlier, edge-level version of the
// same check the layout already performs (defense in depth / faster
// redirect), and gives the new token path something to be gated by.

// Session 6-5: exact-pathname allow-list, not a broader prefix carve-out —
// deletion-confirm/deletion-cancel are deliberately unauthenticated/optional-
// auth API routes (public, token-based email-link flow, zero session
// required per their own route handlers), so the pages that call them must
// stay reachable even when the /settings/:path* matcher below would
// otherwise redirect a logged-out visitor to /login before the page ever
// renders. Every other /settings/* route stays gated exactly as before.
const PUBLIC_SETTINGS_PATHS = new Set<string>([
  '/settings/account/delete/confirm',
  '/settings/account/delete/cancel',
]);

// Session 9-1: the set of prefixes the auth gate below applies to. Widened
// from a matcher-only list (pre-9-1) to an explicit array because the
// matcher now has to cover every path (for locale-prefix rewriting), so the
// auth gate needs its own path test rather than relying on the matcher to
// pre-filter which requests it sees.
const PROTECTED_PREFIXES = [
  '/dashboard',
  '/alerts',
  '/charts',
  '/settings',
  '/admin',
  '/notifications',
  '/affiliate',
  // The two workspaces (app/terminal and app/free). Each page redirects a
  // signed-out visitor itself; gating here first adds the callbackUrl and
  // puts the check at the edge as well.
  '/terminal',
  '/free',
  // The PRO pages (/pro/currency-index and /pro/currency-index/compare).
  // Their layout already requires a session, but a layout cannot see the
  // requested path, so it redirected to a bare /login and the visitor lost
  // their place. Gating here first adds the callbackUrl. The trailing slash
  // is deliberate: it means "children only", so a '/pro' prefix cannot also
  // catch '/pricing'-style siblings such as a future '/promo' or '/products'.
  '/pro/',
];

/**
 * Segment-boundary prefix match: '/free' matches '/free' and '/free/x' but
 * not '/freebies'. A prefix that ends in '/' matches only paths below it.
 */
function matchesPrefix(pathname: string, prefix: string): boolean {
  if (prefix.endsWith('/')) {
    return pathname.startsWith(prefix);
  }
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

function isProtectedPath(pathname: string): boolean {
  return PROTECTED_PREFIXES.some((prefix) => matchesPrefix(pathname, prefix));
}

// Central CSRF check (Next.js remediation T1-f). The session cookie is shared
// with sibling subdomains of .davintrade.app, so every state-changing request
// to /api/** must come from this site: validateOrigin() compares the Origin
// header (or, without one, Sec-Fetch-Site) with this request's own host.
const CSRF_SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

// Machine callers authenticated by a signature or a secret, never by the
// session cookie, so a browser's Origin means nothing for them (a webhook
// sender has none, or its own). Exempt a route only when its handler checks
// such a credential: an admin-cookie route called by the admin UI (for
// example /api/admin/system/jobs/*/trigger) belongs under the check. A
// trailing '/' means "children only".
const CSRF_EXEMPT_API_PREFIXES = [
  '/api/webhooks/stripe', // stripe-signature
  '/api/webhooks/dlocal', // x-signature
  '/api/webhooks/riseworks', // x-rise-signature
  '/api/cron/', // Authorization: Bearer CRON_SECRET
];

function isApiPath(pathname: string): boolean {
  const path = pathname.replace(/\/{2,}/g, '/').toLowerCase();
  return path === '/api' || path.startsWith('/api/');
}

/**
 * Whether this request must pass validateOrigin(): a method that can change
 * state, aimed at /api/**, and not a machine caller. The path is judged raw
 * AND percent-decoded, so '/%61pi/alerts' or '//api/alerts' cannot dodge it
 * if the router resolves them to /api/alerts; and only a plain path (no
 * escapes) can be exempt, so no encoded path reaches an exemption. A path
 * that cannot be decoded is checked: strict is the safe side.
 */
function requiresOriginCheck(method: string, pathname: string): boolean {
  if (CSRF_SAFE_METHODS.has(method.toUpperCase())) {
    return false;
  }

  let decoded: string;
  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    return true;
  }

  if (!isApiPath(pathname) && !isApiPath(decoded)) {
    return false;
  }

  const isPlainPath = decoded === pathname;
  return !(
    isPlainPath &&
    CSRF_EXEMPT_API_PREFIXES.some((prefix) => matchesPrefix(pathname, prefix))
  );
}

export async function middleware(request: NextRequest): Promise<NextResponse> {
  const { pathname: originalPathname } = request.nextUrl;

  // Session 9-1: country-prefix locale rewrite (ported from codebase 2's
  // middleware.ts), run first so the auth gate below evaluates the TARGET
  // path (e.g. '/th/dashboard' -> '/dashboard'), not the prefixed one.
  const segments = originalPathname.split('/').filter(Boolean);
  const firstSegment = segments[0]?.toLowerCase();
  const countryPrefix = isSupportedCountryPrefix(firstSegment)
    ? firstSegment!
    : null;
  const targetPathname = countryPrefix
    ? '/' + segments.slice(1).join('/')
    : originalPathname;

  // Before the auth gate and OUTSIDE its try/catch: that catch fails open on
  // a token decode error, and a failure here (a refusal, or validateOrigin
  // throwing) must never turn into a pass-through.
  if (
    requiresOriginCheck(request.method, targetPathname) &&
    !(await validateOrigin(request))
  ) {
    return NextResponse.json(
      { error: 'Invalid request origin' },
      { status: 403 }
    );
  }

  if (PUBLIC_SETTINGS_PATHS.has(targetPathname)) {
    return finishWithLocale(
      request,
      countryPrefix,
      buildLocaleResponse(request, countryPrefix, targetPathname)
    );
  }

  if (isProtectedPath(targetPathname)) {
    try {
      const token = await getToken({
        req: request,
        secret: process.env.NEXTAUTH_SECRET,
        cookieName: SESSION_COOKIE_NAME,
      });

      if (!token) {
        if (
          targetPathname.startsWith('/affiliate/dashboard') ||
          targetPathname.startsWith('/affiliate/settings') ||
          !targetPathname.startsWith('/affiliate')
        ) {
          const loginUrl = new URL('/login', request.url);
          loginUrl.searchParams.set('callbackUrl', originalPathname);
          return finishWithLocale(
            request,
            countryPrefix,
            NextResponse.redirect(loginUrl)
          );
        }
        return finishWithLocale(
          request,
          countryPrefix,
          buildLocaleResponse(request, countryPrefix, targetPathname)
        );
      }

      // Role-based Edge Guard: Admin routes
      if (targetPathname.startsWith('/admin') && token.role !== 'ADMIN') {
        const dashboardUrl = new URL('/dashboard', request.url);
        dashboardUrl.searchParams.set('error', 'admin_required');
        return finishWithLocale(
          request,
          countryPrefix,
          NextResponse.redirect(dashboardUrl)
        );
      }

      // Role-based Edge Guard: Admin visiting affiliate routes redirected to
      // Admin Executive Dashboard -- except the affiliate dashboard, which an
      // admin opens read-only via "view as affiliate". Its layout decides:
      // the viewed affiliate, or the picker (lib/affiliate/view-as.ts).
      if (
        targetPathname.startsWith('/affiliate') &&
        !targetPathname.startsWith('/affiliate/dashboard') &&
        token.role === 'ADMIN'
      ) {
        return finishWithLocale(
          request,
          countryPrefix,
          NextResponse.redirect(new URL('/admin', request.url))
        );
      }
    } catch (error) {
      // Fail OPEN, not closed: per-page session checks remain authoritative backstop.
      console.error(
        '[middleware] token decode failed, allowing request through:',
        error
      );
    }
  }

  return finishWithLocale(
    request,
    countryPrefix,
    buildLocaleResponse(request, countryPrefix, targetPathname)
  );
}

/**
 * Builds the base response for the (non-redirected) fallthrough case: a
 * rewrite to the prefix-stripped path (with the country header set so
 * app/layout.tsx's server render resolves the same language) if a country
 * prefix was present, or a plain pass-through otherwise.
 */
function buildLocaleResponse(
  request: NextRequest,
  countryPrefix: string | null,
  targetPathname: string
): NextResponse {
  if (!countryPrefix) {
    return NextResponse.next();
  }

  const url = request.nextUrl.clone();
  url.pathname = targetPathname || '/';

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set(COUNTRY_HEADER, countryPrefix);

  return NextResponse.rewrite(url, { request: { headers: requestHeaders } });
}

/**
 * Converges the locale cookie onto the URL's country prefix on whatever
 * response the auth gate above decided on (redirect, rewrite, or
 * pass-through) so a later visit to a non-prefixed path server-renders in
 * the same language.
 */
function finishWithLocale(
  request: NextRequest,
  countryPrefix: string | null,
  response: NextResponse
): NextResponse {
  if (!countryPrefix) return response;

  const preferences = preferencesForCountryPrefix(countryPrefix);
  if (
    preferences &&
    request.cookies.get(LOCALE_COOKIE)?.value !== preferences.language
  ) {
    response.cookies.set(LOCALE_COOKIE, preferences.language, {
      path: '/',
      maxAge: 31536000,
      sameSite: 'lax',
    });
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico, images, logos
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
