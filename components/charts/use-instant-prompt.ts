'use client';

/**
 * The press of a Panel C instant prompt (architecture 4.2 and 4.10, plan decision D10).
 *
 * One hook serves both Market Context badges of the stacked charts, so there is ONE request in
 * flight for the whole chart: while the M5 question is out, the M15 badge waits too (two
 * simultaneous presses would both pass the quota pre-check). A press posts `{ kind }` to
 * `/api/intake/instant` and nothing else: no text and no language, the server reads the interface
 * setting.
 *
 *  - PRO: the request. While it runs `pending` names the kind and every further press is ignored
 *    (a ref guards the same tick, so a double click cannot slip through before the next render).
 *  - FREE: no request. A press opens the existing upgrade modal (decision D10 (c)).
 *  - A refusal is shown as the server's own `refusal.reply`, already in the interface language. Any
 *    other failure (the route answers 404 while `INTAKE_ENABLED` is off, a 5xx, no network) shows
 *    the fixed "not available" text of the dictionaries.
 *  - A success (200, `{ success: true, packet, trace }`) is handed to `onResult` and nothing is
 *    rendered: the reply to the trader is step 7's (D10 (e)), which is why the badges stay behind
 *    their own flag until then.
 *
 * With the workspace's chat given (`chat`, build step 7 part 9: the reply flag is on) a PRO press goes
 * to the chat instead of this route, and the chat is the whole answer:
 *
 *  - the request is `POST /api/chat/message` with `{ client_request_id, kind }`, made by the chat's own
 *    provider; there is ONE request in flight for the WHOLE workspace, whether it was started by a
 *    badge or by a typed question in Panel B. While it runs `busy` is true for both badges, and
 *    `pending` names the badge that was pressed (none for a typed question); a press during it is
 *    ignored;
 *  - the answer, the stages and a refusal card are Panel B's. A refusal is ALSO shown below the badge
 *    that was pressed, as before; any other failure shows the fixed "not available" text there;
 *  - a success calls `onChatResult` (the workspace opens Panel B if it was collapsed; the active
 *    thread of Panel A is the chat's own, so it needs nothing from here).
 *
 * Off (no `chat`), everything above the line is exactly what it was.
 *
 * @module components/charts/use-instant-prompt
 */

import { useCallback, useEffect, useRef, useState } from 'react';

import type { AskOptions } from '@/components/chat/chat-provider';
import { useLocale } from '@/lib/context/locale-context';
import { INSTANT_INTENTS, type InstantIntent } from '@/lib/intake/intents';
import { INTAKE_TEXT } from '@/lib/intake/text';

/** The one route the badges call. */
export const INSTANT_ENDPOINT = '/api/intake/instant';

/** How long a refusal stays below its badge. */
export const NOTICE_MS = 12_000;

/** The kind of instant prompt a chart timeframe has, or null (only M5 and M15 have one). */
export function instantKindFor(timeframe: string): InstantIntent | null {
  if (timeframe === 'M5') return INSTANT_INTENTS[0];
  if (timeframe === 'M15') return INSTANT_INTENTS[1];
  return null;
}

/** What the route said, reduced to what a badge needs. */
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

/**
 * The workspace's chat, as far as a badge needs it. `ChatContextValue` fits it; a test or the preview
 * may pass a smaller one.
 */
export interface InstantChat {
  /** a request is in flight anywhere in the workspace (Panel B's composer or either badge) */
  busy: boolean;
  /** the badge whose request is in flight; null when none is, or when a typed question is */
  pending: InstantIntent | null;
  ask: (
    input: { kind: 'INSTANT'; intent: InstantIntent },
    options?: AskOptions
  ) => boolean;
}

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
  /** the workspace's chat: given, a PRO press goes to it and not to `/api/intake/instant` */
  chat?: InstantChat | null;
  /** the chat answered: the workspace opens Panel B if it was collapsed */
  onChatResult?: (result: { threadId: string }) => void;
}

export interface InstantNotice {
  kind: InstantIntent;
  text: string;
}

export interface InstantPromptState {
  /** the kind whose request is in flight, or null */
  pending: InstantIntent | null;
  /** a request is in flight that both badges wait for: this chart's own, or (with the chat) the whole workspace's */
  busy: boolean;
  /** the text below the badge that was refused, or null */
  notice: InstantNotice | null;
  press: (kind: InstantIntent) => void;
}

export function useInstantPrompt({
  isPro,
  onOpenUpgradeModal,
  onResult,
  post = postInstantPrompt,
  noticeMs = NOTICE_MS,
  chat = null,
  onChatResult,
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
      const unavailableText = (): string =>
        t(
          'intake.refusal.feature_unavailable',
          INTAKE_TEXT['intake.refusal.feature_unavailable']
        );
      if (chat !== null) {
        // one request for the whole workspace: while any is in flight a press does nothing
        if (chat.busy) return;
        setNotice(null);
        chat.ask(
          { kind: 'INSTANT', intent: kind },
          {
            onSettled: (outcome) => {
              if (!mounted.current) return;
              switch (outcome.kind) {
                case 'RESULT':
                  onChatResult?.({ threadId: outcome.threadId });
                  break;
                case 'REFUSAL':
                  // Panel B has the refusal card; the badge repeats the server's words, as it always did
                  setNotice({
                    kind,
                    text:
                      outcome.reply.trim() !== ''
                        ? outcome.reply
                        : unavailableText(),
                  });
                  break;
                case 'UNAVAILABLE':
                case 'FAILED':
                  setNotice({ kind, text: unavailableText() });
                  break;
                case 'CANCELLED':
                  break;
              }
            },
          }
        );
        return;
      }
      inFlight.current = true;
      setNotice(null);
      setPending(kind);
      const unavailable = unavailableText;
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
    [isPro, onOpenUpgradeModal, onResult, post, t, chat, onChatResult]
  );

  return chat !== null
    ? { pending: chat.pending, busy: chat.busy, notice, press }
    : { pending, busy: pending !== null, notice, press };
}
