import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';

import { SESSION_COOKIE_NAME } from '@/lib/operation-service/cookies';

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

export async function middleware(request: NextRequest): Promise<NextResponse> {
  const { pathname } = request.nextUrl;

  if (PUBLIC_SETTINGS_PATHS.has(pathname)) {
    return NextResponse.next();
  }

  try {
    const token = await getToken({
      req: request,
      secret: process.env.NEXTAUTH_SECRET,
      cookieName: SESSION_COOKIE_NAME,
    });

    if (!token) {
      if (
        pathname.startsWith('/affiliate/dashboard') ||
        pathname.startsWith('/affiliate/settings') ||
        !pathname.startsWith('/affiliate')
      ) {
        const loginUrl = new URL('/login', request.url);
        loginUrl.searchParams.set('callbackUrl', pathname);
        return NextResponse.redirect(loginUrl);
      }
      return NextResponse.next();
    }

    // Role-based Edge Guard: Admin routes
    if (pathname.startsWith('/admin') && token.role !== 'ADMIN') {
      const dashboardUrl = new URL('/dashboard', request.url);
      dashboardUrl.searchParams.set('error', 'admin_required');
      return NextResponse.redirect(dashboardUrl);
    }

    // Role-based Edge Guard: Admin visiting affiliate routes redirected to Admin Executive Dashboard
    if (pathname.startsWith('/affiliate') && token.role === 'ADMIN') {
      return NextResponse.redirect(new URL('/admin', request.url));
    }

    return NextResponse.next();
  } catch (error) {
    // Fail OPEN, not closed: per-page session checks remain authoritative backstop.
    console.error(
      '[middleware] token decode failed, allowing request through:',
      error
    );
    return NextResponse.next();
  }
}

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/alerts/:path*',
    '/charts/:path*',
    '/settings/:path*',
    '/admin/:path*',
    '/notifications/:path*',
    '/affiliate/:path*',
  ],
};
