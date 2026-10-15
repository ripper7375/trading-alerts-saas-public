/**
 * The NDJSON stream of `POST /api/chat/message` (build step 7 part 7b; ADR-054, decision D24).
 *
 * One JSON object per line: stage events as the request moves through GATE, UNDERSTAND, DATA,
 * CONTEXT, MODEL and CHECKS, then exactly ONE terminal event (`result`, `refusal` or `error`), which
 * is the last line. The reply is delivered whole, after it was checked: there is no token-by-token
 * text that a failed check would have to take back. Framing is `encodeEvent` of the contract
 * (canonical JSON and a newline), and a client reads it with `decodeStream`.
 *
 * The stream is a plain `ReadableStream` of bytes. A client that leaves cancels it; from then on
 * writing to it is a no-op and the run goes on (the orchestrator finishes, settles and stores a
 * request whose model was called, so a reload shows the reply). Nothing here ever throws into the run.
 *
 * Pure but for the Web stream classes.
 *
 * @module lib/reply/server/stream
 */

import { encodeEvent } from '../contracts/stage-events';
import type { StreamEvent, TerminalEvent } from '../contracts/stage-events';
import type { ReplyRun } from '../run/types';

export const NDJSON_CONTENT_TYPE = 'application/x-ndjson; charset=utf-8';

export function streamHeaders(): Record<string, string> {
  return {
    'Content-Type': NDJSON_CONTENT_TYPE,
    // an answer is about THIS trader and THIS minute: nothing may keep it
    'Cache-Control': 'no-store',
    // a proxy that buffers a stream defeats its progress
    'X-Accel-Buffering': 'no',
  };
}

/**
 * The terminal event of a run that ended after the stream began (or of a stored reply). A run that
 * never reached the gate's end (`DISABLED`, `REQUEST_FAILED`) has none: it is answered as JSON.
 */
export function terminalOf<F>(run: ReplyRun<F>): TerminalEvent | null {
  switch (run.kind) {
    case 'REPLY':
      return { type: 'result', request_id: run.requestId, result: run.result };
    case 'REFUSED':
      return {
        type: 'refusal',
        request_id: run.requestId,
        refusal: run.refusal,
      };
    case 'ERROR':
      return {
        type: 'error',
        request_id: run.requestId,
        code: run.code,
        retryable: run.retryable,
      };
    case 'ABORTED':
      // the client left; it is told it may ask again, in case it is still listening
      return {
        type: 'error',
        request_id: run.requestId,
        code: 'INTERNAL',
        retryable: true,
      };
    default:
      return null;
  }
}

export interface EventStream {
  stream: ReadableStream<Uint8Array>;
  /** write one event; nothing after `end` or after the client cancelled */
  write(event: StreamEvent): void;
  end(): void;
}

/** A stream that starts with `initial` events already written. */
export function createEventStream(
  initial: readonly StreamEvent[]
): EventStream {
  const encoder = new TextEncoder();
  let controller: ReadableStreamDefaultController<Uint8Array> | null = null;

  // a stream that has ended or that the client cancelled refuses both calls (they throw); the run
  // does not care, so both are swallowed
  const write = (event: StreamEvent): void => {
    try {
      controller?.enqueue(encoder.encode(encodeEvent(event)));
    } catch {
      // closed under us: nobody is listening
    }
  };
  const end = (): void => {
    try {
      controller?.close();
    } catch {
      // already closed
    }
  };

  const stream = new ReadableStream<Uint8Array>({
    start(started) {
      controller = started;
      for (const event of initial) write(event);
    },
  });
  return { stream, write, end };
}
