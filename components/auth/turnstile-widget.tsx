'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import { useLocale } from '@/lib/context/locale-context';

/**
 * The Cloudflare Turnstile challenge for the sign-in, registration and forgot-password forms
 * (CODE-15, D-15).
 *
 * `useTurnstile()` is what a form uses: `required` says whether a challenge is on (the site key is
 * set), `widget` is the element to render, `token` is what the widget handed over, `ready` says
 * whether the form may be submitted, and `reset()` starts a fresh widget. A token works once, so
 * a form calls `reset()` after EVERY attempt, whatever its outcome.
 *
 * With `NEXT_PUBLIC_TURNSTILE_SITE_KEY` unset nothing is rendered or loaded and the form is
 * exactly what it was (local development). The server decides: `lib/security/turnstile.ts`.
 */

export const TURNSTILE_SCRIPT_SRC =
  'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';

/**
 * The code a server answers when the check refuses. Spelled out here because this file cannot
 * import the server module `lib/security/turnstile.ts`; the tests of both sides pin the literal.
 */
export const TURNSTILE_FAILED_CODE = 'TURNSTILE_FAILED';

interface TurnstileRenderOptions {
  sitekey: string;
  theme: 'auto';
  callback: (token: string) => void;
  'expired-callback': () => void;
  'error-callback': () => void;
}

interface TurnstileApi {
  render: (
    container: HTMLElement,
    options: TurnstileRenderOptions
  ) => string | undefined;
  remove: (widgetId: string) => void;
}

/**
 * The site key, or null when no challenge is wanted. A literal `process.env[...]` read of a
 * NEXT_PUBLIC_ variable is inlined at build time (the convention of `lib/auth/auth-bridge-flag.ts`).
 */
export function getTurnstileSiteKey(): string | null {
  const key = process.env['NEXT_PUBLIC_TURNSTILE_SITE_KEY']?.trim();
  return key ? key : null;
}

function currentApi(): TurnstileApi | undefined {
  return (window as unknown as { turnstile?: TurnstileApi }).turnstile;
}

/**
 * Calls `onReady` with Cloudflare's API as soon as it is there (at once when it already is), or
 * `onFail` when the script cannot be loaded. The script is added to the page once; every widget
 * that mounts before it has loaded waits on the same element. Returns a function that cancels
 * the wait.
 */
function whenTurnstileReady(
  onReady: (api: TurnstileApi) => void,
  onFail: () => void
): () => void {
  const api = currentApi();
  if (api) {
    onReady(api);
    return () => {};
  }

  let script = document.querySelector<HTMLScriptElement>(
    `script[src="${TURNSTILE_SCRIPT_SRC}"]`
  );
  if (!script) {
    script = document.createElement('script');
    script.src = TURNSTILE_SCRIPT_SRC;
    script.async = true;
    script.defer = true;
    document.head.appendChild(script);
  }
  const element = script;

  const handleLoad = (): void => {
    const loaded = currentApi();
    if (loaded) onReady(loaded);
    else onFail();
  };
  const handleError = (): void => {
    // Out of the page, so that the next widget tries the download again.
    element.remove();
    onFail();
  };
  element.addEventListener('load', handleLoad, { once: true });
  element.addEventListener('error', handleError, { once: true });
  return () => {
    element.removeEventListener('load', handleLoad);
    element.removeEventListener('error', handleError);
  };
}

interface TurnstileWidgetProps {
  /** The token when the visitor passes the challenge; null when it expires or fails. */
  onToken: (token: string | null) => void;
}

/** One challenge. Mount a fresh one (a new `key`) for every attempt. */
export function TurnstileWidget({
  onToken,
}: TurnstileWidgetProps): React.JSX.Element {
  const { t } = useLocale();
  const containerRef = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const siteKey = getTurnstileSiteKey();
    const container = containerRef.current;
    if (!siteKey || !container) return undefined;

    let widgetId: string | undefined;
    const fail = (): void => {
      onToken(null);
      setFailed(true);
    };
    const cancel = whenTurnstileReady((api) => {
      widgetId = api.render(container, {
        sitekey: siteKey,
        theme: 'auto',
        callback: (token) => {
          setFailed(false);
          onToken(token);
        },
        'expired-callback': () => onToken(null),
        'error-callback': fail,
      });
    }, fail);

    return () => {
      cancel();
      if (widgetId !== undefined) currentApi()?.remove(widgetId);
    };
  }, [onToken]);

  return (
    <div className="space-y-2">
      <div ref={containerRef} className="flex justify-center" />
      {failed && (
        <p role="alert" className="text-center text-xs text-rose-600">
          {t(
            'auth.turnstile.unavailable',
            'The security check could not be loaded. Reload the page and try again.'
          )}
        </p>
      )}
    </div>
  );
}

export interface TurnstileState {
  /** A challenge is on (the site key is set). */
  required: boolean;
  /** The token the widget handed over, or null. */
  token: string | null;
  /** The form may be submitted: no challenge is on, or the widget has handed over a token. */
  ready: boolean;
  /** Render this inside the form; null when no challenge is on. */
  widget: React.JSX.Element | null;
  /** Start a fresh widget and forget the token (call after every attempt). */
  reset: () => void;
}

export function useTurnstile(): TurnstileState {
  const required = getTurnstileSiteKey() !== null;
  const [token, setToken] = useState<string | null>(null);
  const [round, setRound] = useState(0);

  const reset = useCallback((): void => {
    setToken(null);
    setRound((current) => current + 1);
  }, []);

  return {
    required,
    token,
    ready: !required || token !== null,
    widget: required ? (
      <TurnstileWidget key={round} onToken={setToken} />
    ) : null,
    reset,
  };
}
