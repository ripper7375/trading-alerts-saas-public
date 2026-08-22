import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';

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
];

function isProtectedPath(pathname: string): boolean {
  return PROTECTED_PREFIXES.some((prefix) => pathname.startsWith(prefix));
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

      // Role-based Edge Guard: Admin visiting affiliate routes redirected to Admin Executive Dashboard
      if (targetPathname.startsWith('/affiliate') && token.role === 'ADMIN') {
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
