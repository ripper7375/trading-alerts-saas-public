import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import {
  COUNTRY_HEADER,
  LOCALE_COOKIE,
  isSupportedCountryPrefix,
  preferencesForCountryPrefix,
} from '@/lib/i18n/locale-resolver';

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const segments = pathname.split('/').filter(Boolean);
  const firstSegment = segments[0]?.toLowerCase();

  // If URL starts with a supported country code (e.g. /th/settings/help, /gb/alerts, /vn/pricing)
  if (isSupportedCountryPrefix(firstSegment)) {
    const remainingSegments = segments.slice(1);
    const targetPath = '/' + remainingSegments.join('/');

    // Rewrite internally to target route while preserving the country prefix in the browser URL
    const url = request.nextUrl.clone();
    url.pathname = targetPath || '/';

    // The rewrite strips the country prefix before `app/layout.tsx` runs, so the
    // server render would otherwise fall back to the cookie (or English) and only
    // discover the requested locale on the client — the exact cause of the
    // English -> Thai flip on refresh. Forward it as a request header instead.
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set(COUNTRY_HEADER, firstSegment);

    const response = NextResponse.rewrite(url, {
      request: { headers: requestHeaders },
    });

    // Converge the cookie on the URL's locale so a later visit to a non-prefixed
    // path (or a full reload) server-renders in the same language.
    const preferences = preferencesForCountryPrefix(firstSegment);
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

  return NextResponse.next();
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
