import { headers } from 'next/headers';

function withoutWww(hostname: string): string {
  return hostname.replace(/^www\./i, '');
}

/**
 * Validates that the request origin matches allowed origins.
 * This provides additional CSRF protection for sensitive endpoints.
 *
 * The Origin header is compared as a parsed origin (scheme + host + port),
 * never as a string prefix: 'https://davintrade.app.evil.com' must not pass
 * for 'https://davintrade.app'. The allowed origins are this request's own
 * host (https always, http outside production) and the NEXTAUTH_URL origin,
 * each also matched with the apex/www counterpart on the same scheme and port
 * (the app is served on both; see lib/auth/auth-options.ts).
 *
 * Without an Origin header the browser's Sec-Fetch-Site decides: 'cross-site'
 * and 'same-site' are refused ('same-site' because the session cookie is
 * shared with sibling subdomains of .davintrade.app). A request with no
 * Sec-Fetch-Site either (a non-browser client) is allowed.
 *
 * @param request - The incoming request. Omit it in a Route Handler to read
 *   the headers of the current request through next/headers.
 * @returns true if the request origin is acceptable
 */
export async function validateOrigin(request?: Request): Promise<boolean> {
  const headersList = request ? request.headers : await headers();
  const origin = headersList.get('origin');

  if (!origin) {
    const secFetchSite = headersList.get('sec-fetch-site');
    return secFetchSite !== 'cross-site' && secFetchSite !== 'same-site';
  }

  // First entry when a chain of proxies appended to x-forwarded-host
  const host = (
    headersList.get('x-forwarded-host') ||
    headersList.get('host') ||
    ''
  )
    .split(',')[0]
    ?.trim();
  if (!host) {
    return false;
  }

  let requestOrigin: URL;
  try {
    requestOrigin = new URL(origin);
  } catch {
    // Not a URL, e.g. the literal 'null' sent from sandboxed contexts
    return false;
  }

  const runtimeNodeEnv = Reflect.get(process.env, 'NODE_ENV') as
    | string
    | undefined;
  const allowedOrigins: URL[] = [];
  const allow = (value: string): void => {
    try {
      allowedOrigins.push(new URL(value));
    } catch {
      // An unparsable host or NEXTAUTH_URL allows nothing
    }
  };
  allow(`https://${host}`);
  if (runtimeNodeEnv !== 'production') {
    allow(`http://${host}`); // local development
  }
  const nextAuthUrl = process.env['NEXTAUTH_URL'];
  if (nextAuthUrl) {
    allow(nextAuthUrl);
  }

  return allowedOrigins.some(
    (allowed) =>
      allowed.origin === requestOrigin.origin ||
      (allowed.protocol === requestOrigin.protocol &&
        allowed.port === requestOrigin.port &&
        withoutWww(allowed.hostname) === withoutWww(requestOrigin.hostname))
  );
}

/**
 * Returns a 403 response for invalid CSRF requests.
 * Use this when validateOrigin() returns false.
 */
export function csrfErrorResponse(): Response {
  return new Response(JSON.stringify({ error: 'Invalid request origin' }), {
    status: 403,
    headers: { 'Content-Type': 'application/json' },
  });
}
