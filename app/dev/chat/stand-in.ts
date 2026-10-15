/**
 * A stand-in for the chat routes, for the development preview's live scenario (build step 7 part 8).
 *
 * It answers `GET /api/chat/state` with the preview's state and `POST /api/chat/message` by playing a
 * RECORDED answer of the real route (`recorded.json`), as an NDJSON stream with a pause between the
 * events so the stages can be watched. `POST /api/engine4/offer` answers 404 as a production build
 * does while Report 2 is off, so the Trade Setup button shows its "could not be opened" notice. It
 * honours the abort signal, so the Stop button works. Nothing is sent anywhere.
 */

import type { ChatInfo, StreamEvent } from '@/components/chat/types';

import { RECORDED, type Exchange } from './scenarios';
import { localizeRefusal, localizeResult } from './samples';

const json = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });

const sleep = (ms: number, signal: AbortSignal | undefined): Promise<void> =>
  new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException('Aborted', 'AbortError'));
      return;
    }
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener(
      'abort',
      () => {
        clearTimeout(timer);
        reject(new DOMException('Aborted', 'AbortError'));
      },
      { once: true }
    );
  });

export interface StandInOptions {
  /** the name of the recorded exchange a typed question gets */
  answer: () => string;
  info: () => ChatInfo;
  language: () => string;
  t: (key: string, fallback?: string) => string;
  /** the pause between two events, in milliseconds */
  stepMs?: number;
  /**
   * Whole-workspace preview (build step 7 part 9): the thread a message belongs to. Called once per
   * message request, with its body; the result event is given that thread, as the real route gives a
   * reply the thread of its request (a new one when the body names none). Left out, a recorded reply
   * keeps the thread it was recorded in, which is what `/dev/chat` has always shown.
   */
  threadId?: (body: Record<string, unknown>) => string;
}

export function standInFetch(options: StandInOptions): typeof fetch {
  const step = options.stepMs ?? 650;

  const localized = (
    event: StreamEvent,
    threadId: string | null
  ): StreamEvent => {
    const language = options.language();
    if (event.type === 'result') {
      const result = localizeResult(event.result, language);
      return {
        ...event,
        result: threadId === null ? result : { ...result, thread_id: threadId },
      };
    }
    if (event.type === 'refusal') {
      return {
        ...event,
        refusal: localizeRefusal(event.refusal, language, options.t),
      };
    }
    return event;
  };

  return async (input, init) => {
    const url =
      typeof input === 'string'
        ? input
        : input instanceof URL
          ? input.href
          : input.url;
    const signal = init?.signal ?? undefined;
    // a real fetch refuses at once when it is already aborted
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
    if (url.endsWith('/api/chat/state')) {
      return json({ success: true, ...options.info() });
    }
    if (url.endsWith('/api/engine4/offer')) {
      return json(
        {
          success: false,
          error: { code: 'FEATURE_DISABLED', message: 'Not found' },
        },
        404
      );
    }
    if (!url.endsWith('/api/chat/message'))
      return json({ success: false }, 404);

    // the thread this message belongs to (the whole-workspace preview files it into its thread list)
    let threadId: string | null = null;
    if (options.threadId !== undefined) {
      let body: Record<string, unknown> = {};
      try {
        body = JSON.parse(String(init?.body)) as Record<string, unknown>;
      } catch {
        body = {};
      }
      threadId = options.threadId(body);
    }
    const exchange = RECORDED[options.answer()] as Exchange;
    if (exchange.kind === 'JSON') {
      await sleep(step, signal);
      const body = exchange.body as {
        refusal?: Parameters<typeof localizeRefusal>[0];
      };
      return json(
        body.refusal === undefined
          ? exchange.body
          : {
              ...(exchange.body as object),
              refusal: localizeRefusal(
                body.refusal,
                options.language(),
                options.t
              ),
            },
        exchange.status
      );
    }

    const encoder = new TextEncoder();
    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        try {
          for (const event of exchange.events) {
            await sleep(step, signal);
            controller.enqueue(
              encoder.encode(`${JSON.stringify(localized(event, threadId))}\n`)
            );
          }
          controller.close();
        } catch (error) {
          controller.error(error);
        }
      },
    });
    return new Response(stream, {
      status: exchange.status,
      headers: { 'content-type': 'application/x-ndjson; charset=utf-8' },
    });
  };
}
