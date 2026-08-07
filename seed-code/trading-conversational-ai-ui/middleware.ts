import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const SUPPORTED_COUNTRY_CODES = new Set([
  'gb',
  'in',
  'ng',
  'pk',
  'vn',
  'id',
  'th',
  'za',
  'tr',
  'us',
  'eu',
  'jp',
]);

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const segments = pathname.split('/').filter(Boolean);
  const firstSegment = segments[0]?.toLowerCase();

  // If URL starts with a supported country code (e.g. /th/settings/help, /gb/alerts, /vn/pricing)
  if (firstSegment && SUPPORTED_COUNTRY_CODES.has(firstSegment)) {
    const remainingSegments = segments.slice(1);
    const targetPath = '/' + remainingSegments.join('/');

    // Rewrite internally to target route while preserving the country prefix in the browser URL
    const url = request.nextUrl.clone();
    url.pathname = targetPath || '/';
    return NextResponse.rewrite(url);
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
