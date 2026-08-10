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

export async function middleware(request: NextRequest): Promise<NextResponse> {
  try {
    const token = await getToken({
      req: request,
      secret: process.env.NEXTAUTH_SECRET,
      cookieName: SESSION_COOKIE_NAME,
    });

    if (!token) {
      const loginUrl = new URL('/login', request.url);
      loginUrl.searchParams.set('callbackUrl', request.nextUrl.pathname);
      return NextResponse.redirect(loginUrl);
    }

    return NextResponse.next();
  } catch (error) {
    // Fail OPEN, not closed: this is the first-ever middleware.ts in this
    // repo, and every matched request depends on it. A bug/exception here
    // must not lock every user out — the per-page session checks
    // (app/(dashboard)/layout.tsx's getServerSession call) remain the
    // authoritative backstop either way.
    console.error(
      '[middleware] token decode failed, allowing request through:',
      error
    );
    return NextResponse.next();
  }
}

// /admin was excluded here until Session 6-2 (DECISION-LOG.md F62): a
// separate, non-route-group tree (app/admin/login, app/admin/affiliates,
// app/admin/settings) shared this URL prefix and had its own bespoke,
// already-logged-out-reachable login page — matching /admin/:path* here
// would have redirected logged-out admins away from their own login page
// before they could ever reach it. That tree is gone now: all 23 admin
// pages live under app/(dashboard)/admin/* (one shell, one
// getServerSession + role guard via app/(dashboard)/admin/layout.tsx),
// and /admin/login redirects to the standard /login flow
// (next.config.js). /admin/:path* is covered below as the same earlier,
// edge-level defense-in-depth every other authenticated route already
// gets — the layout guard stays the authoritative backstop either way.
export const config = {
  matcher: [
    '/dashboard/:path*',
    '/alerts/:path*',
    '/charts/:path*',
    '/settings/:path*',
    '/admin/:path*',
    '/notifications/:path*',
  ],
};
