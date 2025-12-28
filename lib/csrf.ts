import { headers } from 'next/headers';

/**
 * Validates that the request origin matches allowed origins.
 * This provides additional CSRF protection for sensitive endpoints.
 *
 * @returns true if the origin is valid or absent (same-origin requests)
 */
export async function validateOrigin(): Promise<boolean> {
  const headersList = await headers();
  const origin = headersList.get('origin');
  const host = headersList.get('host');

  // Build list of allowed origins
  const allowedOrigins = [
    process.env.NEXTAUTH_URL,
    `https://${host}`,
    `http://${host}`, // for local development
  ].filter(Boolean);

  // Same-origin requests may not have Origin header
  if (!origin) {
    return true;
  }

  return allowedOrigins.some((allowed) => origin.startsWith(allowed as string));
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
