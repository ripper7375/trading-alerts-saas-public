'use client';

/**
 * The press of a Panel C instant prompt (architecture 4.2 and 4.10, plan decision D10).
 *
 * One hook serves both buttons of the stacked charts, so there is ONE request in flight for the
 * whole chart: while the M5 question is out, the M15 button waits too (two simultaneous presses
 * would both pass the quota pre-check). A press posts `{ kind }` to `/api/intake/instant` and
 * nothing else: no text and no language, the server reads the interface setting.
 *
 *  - PRO: the request. While it runs `pending` names the kind and every further press is ignored
 *    (a ref guards the same tick, so a double click cannot slip through before the next render).
 *  - FREE: no request. A press opens the existing upgrade modal (decision D10 (c)).
 *  - A refusal is shown as the server's own `refusal.reply`, already in the interface language. Any
 *    other failure (the route answers 404 while `INTAKE_ENABLED` is off, a 5xx, no network) shows
 *    the fixed "not available" text of the dictionaries.
 *  - A success (200, `{ success: true, packet, trace }`) is handed to `onResult` and nothing is
 *    rendered: the reply to the trader is step 7's (D10 (e)), which is why the buttons stay behind
 *    their own flag until then.
 *
 * @module components/charts/use-instant-prompt
 */

import { useCallback, useEffect, useRef, useState } from 'react';

import { useLocale } from '@/lib/context/locale-context';
import { INSTANT_INTENTS, type InstantIntent } from '@/lib/intake/intents';
import { INTAKE_TEXT } from '@/lib/intake/text';

/** The one route the buttons call. */
export const INSTANT_ENDPOINT = '/api/intake/instant';

/** How long a refusal stays beside its button. */
export const NOTICE_MS = 12_000;

/** The kind of instant prompt a chart timeframe has, or null (only M5 and M15 have one). */
export function instantKindFor(timeframe: string): InstantIntent | null {
  if (timeframe === 'M5') return INSTANT_INTENTS[0];
  if (timeframe === 'M15') return INSTANT_INTENTS[1];
  return null;
}

/** What the route said, reduced to what a button needs. */
export type InstantAnswer =
  | { ok: true; body: unknown }
  | { ok: false; reply: string | null };

export type PostInstant = (kind: InstantIntent) => Promise<InstantAnswer>;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/**
 * `POST /api/intake/instant` with `{ kind }` and nothing else. It never throws: a network error, a
 * body that is not JSON and any status but a 200 with `success: true` come back as `ok: false`.
 */
export const postInstantPrompt: PostInstant = async (kind) => {
  try {
    const response = await fetch(INSTANT_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kind }),
    });
    let body: unknown = null;
    try {
      body = await response.json();
    } catch {
      body = null;
    }
    if (response.ok && isRecord(body) && body['success'] === true) {
      return { ok: true, body };
    }
    const refusal = isRecord(body) ? body['refusal'] : undefined;
    const reply = isRecord(refusal) ? refusal['reply'] : undefined;
    return {
      ok: false,
      reply: typeof reply === 'string' && reply.trim() !== '' ? reply : null,
    };
  } catch {
    return { ok: false, reply: null };
  }
};

export interface InstantPromptOptions {
  /** the trader has the Pro plan; a Free trader's press opens the upgrade modal */
  isPro: boolean;
  onOpenUpgradeModal?: () => void;
  /** the success body, for the chat that step 7 builds */
  onResult?: (body: unknown) => void;
  /** replaces the network call (tests, the development preview) */
  post?: PostInstant;
  /** how long a refusal stays; {@link NOTICE_MS} unless a test shortens it */
  noticeMs?: number;
}

export interface InstantNotice {
  kind: InstantIntent;
  text: string;
}

export interface InstantPromptState {
  /** the kind whose request is in flight, or null */
  pending: InstantIntent | null;
  /** the text beside the button that was refused, or null */
  notice: InstantNotice | null;
  press: (kind: InstantIntent) => void;
}

export function useInstantPrompt({
  isPro,
  onOpenUpgradeModal,
  onResult,
  post = postInstantPrompt,
  noticeMs = NOTICE_MS,
}: InstantPromptOptions): InstantPromptState {
  const { t } = useLocale();
  const [pending, setPending] = useState<InstantIntent | null>(null);
  const [notice, setNotice] = useState<InstantNotice | null>(null);
  const inFlight = useRef(false);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  // a refusal does not stay for ever: it goes away by itself
  useEffect(() => {
    if (notice === null) return;
    const timer = setTimeout(() => setNotice(null), noticeMs);
    return () => clearTimeout(timer);
  }, [notice, noticeMs]);

  const press = useCallback(
    (kind: InstantIntent): void => {
      if (inFlight.current) return;
      if (!isPro) {
        onOpenUpgradeModal?.();
        return;
      }
      inFlight.current = true;
      setNotice(null);
      setPending(kind);
      const unavailable = (): string =>
        t(
          'intake.refusal.feature_unavailable',
          INTAKE_TEXT['intake.refusal.feature_unavailable']
        );
      const run = async (): Promise<void> => {
        try {
          const answer = await post(kind);
          if (!mounted.current) return;
          if (answer.ok) onResult?.(answer.body);
          else setNotice({ kind, text: answer.reply ?? unavailable() });
        } catch {
          if (mounted.current) setNotice({ kind, text: unavailable() });
        } finally {
          inFlight.current = false;
          if (mounted.current) setPending(null);
        }
      };
      void run();
    },
    [isPro, onOpenUpgradeModal, onResult, post, t]
  );

  return { pending, notice, press };
}
