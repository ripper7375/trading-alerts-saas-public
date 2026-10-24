import 'server-only';

/**
 * Server-side check of a Cloudflare Turnstile token (CODE-15, D-15).
 *
 * A form shows the Turnstile widget when `NEXT_PUBLIC_TURNSTILE_SITE_KEY` is set; the page hands
 * the token to the server with the form; the server asks Cloudflare whether it is good. The
 * widget does nothing on its own: this check is the control.
 *
 * - `TURNSTILE_SECRET_KEY` UNSET: the check is skipped (`{ ok: true, skipped: true }`), so local
 *   development and the test suites need no Cloudflare account. In production a single warning
 *   says so.
 * - `TURNSTILE_SECRET_KEY` SET: the check FAILS CLOSED. A missing or malformed token, a refusal,
 *   an unreachable Cloudflare, an HTTP error, an answer that is not JSON and a timeout (5 s) all
 *   refuse. Only a boolean `success: true` passes.
 *
 * A token is valid for 300 s and works once. The secret and the token are never logged: the
 * failures log a fixed phrase, an HTTP status or an error class, never an error message.
 */

export const TURNSTILE_VERIFY_URL =
  'https://challenges.cloudflare.com/turnstile/v0/siteverify';
export const TURNSTILE_TIMEOUT_MS = 5_000;
/** Cloudflare's own limit for a token. */
export const TURNSTILE_TOKEN_MAX_LENGTH = 2048;
/**
 * The error code a route answers (400) and `authorize()` throws when the check refuses. The three
 * forms read the same literal (`components/auth/turnstile-widget.tsx` cannot import this server
 * module); the tests of both sides pin it.
 */
export const TURNSTILE_FAILED_CODE = 'TURNSTILE_FAILED';

export type TurnstileVerdict =
  | { ok: true; skipped: boolean }
  | { ok: false; reason: 'invalid_token' | 'rejected' | 'unavailable' };

/** Cloudflare's codes for a secret key it does not accept: a deployment mistake, not a bot. */
const SECRET_PROBLEM_CODES = ['invalid-input-secret', 'missing-input-secret'];

let warnedDisabled = false;

function secretKey(): string | null {
  const secret = process.env['TURNSTILE_SECRET_KEY']?.trim();
  return secret ? secret : null;
}

/** True when `TURNSTILE_SECRET_KEY` is set, that is, when a form must carry a valid token. */
export function isTurnstileEnabled(): boolean {
  return secretKey() !== null;
}

function unavailable(detail: string): TurnstileVerdict {
  console.warn(`[Turnstile] verification unavailable (${detail}); refusing`);
  return { ok: false, reason: 'unavailable' };
}

/**
 * Whether `token` is a token Cloudflare accepts for this site. `remoteIp` is the client's
 * address when it is known (Cloudflare uses it as one more signal); it is left out otherwise.
 * Never throws.
 */
export async function verifyTurnstile(
  token: unknown,
  remoteIp?: string | null
): Promise<TurnstileVerdict> {
  const secret = secretKey();
  if (!secret) {
    if (process.env['NODE_ENV'] === 'production' && !warnedDisabled) {
      warnedDisabled = true;
      console.warn(
        '[Turnstile] TURNSTILE_SECRET_KEY is not set: the bot check is skipped'
      );
    }
    return { ok: true, skipped: true };
  }

  const response = typeof token === 'string' ? token.trim() : '';
  if (!response || response.length > TURNSTILE_TOKEN_MAX_LENGTH) {
    return { ok: false, reason: 'invalid_token' };
  }

  const form = new URLSearchParams({ secret, response });
  if (remoteIp) form.set('remoteip', remoteIp);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TURNSTILE_TIMEOUT_MS);
  try {
    const answer = await fetch(TURNSTILE_VERIFY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: form.toString(),
      signal: controller.signal,
    });
    // The body is read whatever the status: Cloudflare answers a wrong secret key with HTTP 400
    // and `error-codes: ["invalid-input-secret"]`, and that is the one failure worth naming.
    const result: unknown = await answer.json().catch(() => undefined);
    const body =
      typeof result === 'object' && result !== null && !Array.isArray(result)
        ? (result as { success?: unknown; 'error-codes'?: unknown })
        : {};

    const codes = Array.isArray(body['error-codes']) ? body['error-codes'] : [];
    const problem = SECRET_PROBLEM_CODES.find((code) => codes.includes(code));
    if (problem) {
      console.error(
        `[Turnstile] Cloudflare does not accept the secret key (${problem}); check TURNSTILE_SECRET_KEY`
      );
    }

    if (!answer.ok) return unavailable(`HTTP ${answer.status}`);
    if (result === undefined) return unavailable('answer is not JSON');
    return body.success === true
      ? { ok: true, skipped: false }
      : { ok: false, reason: 'rejected' };
  } catch (error) {
    return unavailable(error instanceof Error ? error.name : 'unknown error');
  } finally {
    clearTimeout(timer);
  }
}
