/**
 * `POST /api/chat/message`: the route's whole body (build step 7 part 7b; plan part 7 (3) to (5),
 * decisions D8, D21, D23 and D24; ADR-054).
 *
 * The route starts the run (`runReply`) the moment it has a request, and decides the shape of the
 * answer by how far the run got:
 *
 *  - NOT FOUND, 404: `REPLY_ENABLED` is not exactly `true`. The route does not exist for anybody, and
 *    nothing else is asked (no session, no body, no database; the production ports are not even built).
 *  - A JSON ERROR with a status, if the run ends BEFORE it left the gate: the body could not be read
 *    (400, 413, 415), the caller is not signed in (401), has no analyst (403), has no profile (409),
 *    names a thread that is not theirs (422), has not the allowance (429, with the balance), or the
 *    service is not available (503). These are decisions about WHO may ask, and an HTTP status says
 *    them to every client, proxy and log in the one way they all understand.
 *  - A STREAM, 200 NDJSON, from the moment the gate has passed: stage events, then one terminal event
 *    (`result`, `refusal` for a refusal of the door or the scope check, `error` for a failure of ours).
 *    A request that was served before and is answered from the store is a stream of one event.
 *  - Nothing to say, 499: the client left before any model was called. Nobody is listening.
 *
 * THE CLIENT LEAVING. The run is handed to `keepAlive` (the route passes `after`, so the platform
 * keeps the function alive until it finishes) and never depends on the stream: a client that
 * disconnects cancels the stream, the run does not notice, and when the model was already called it
 * finishes, settles and stores the reply, so a reload shows it. A client that leaves before any
 * model call is the run's `ABORTED`: the hold is given back.
 *
 * Server code only: it reads the environment and builds the production ports.
 *
 * @module lib/reply/server/respond
 */

import 'server-only';

import type { GateCaller } from '../contracts/intake';
import type { StageEvent, StreamEvent } from '../contracts/stage-events';
import { runReply } from '../orchestrator';
import type { ReplyOptions, ReplyPorts, ReplyRun } from '../run/types';
import { chatErrorResponse, jsonHeaders, type ChatErrorCode } from './errors';
import { isReplyEnabled, type Env } from './flags';
import { createReplyPorts } from './ports';
import { readJsonBody, readReplyRequest } from './request';
import type { RequestFailure } from './request';
import { createEventStream, streamHeaders, terminalOf } from './stream';

export interface MessageRouteOptions {
  /** the ports; the real ones unless a test passes its own */
  ports?: ReplyPorts;
  env?: Env;
  /** keeps the platform's function alive until the run ends (`after`); a test may leave it out */
  keepAlive?: (task: Promise<unknown>) => void;
  deadlineMs?: number;
}

const notFound = (): Response => chatErrorResponse('FEATURE_DISABLED');

/** The answer to a run that ended before the stream began (or never will). */
function plainResponse(run: ReplyRun<RequestFailure>): Response {
  switch (run.kind) {
    case 'DISABLED':
      return notFound();
    case 'REQUEST_FAILED':
      return chatErrorResponse(run.failure.code, {
        message: run.failure.message,
      });
    case 'REFUSED':
      return chatErrorResponse(run.refusal.code as ChatErrorCode, {
        requestId: run.requestId,
        refusal: run.refusal,
        quota: run.quota,
      });
    case 'ABORTED':
      // 499, the status a proxy gives a client that closed the connection first
      return new Response(null, {
        status: 499,
        headers: jsonHeaders(run.requestId),
      });
    default:
      // a reply or an error: both are streams, even when there is only the one event
      return streamedResponse(run, []);
  }
}

function streamedResponse(
  run: ReplyRun<RequestFailure>,
  buffered: readonly StreamEvent[]
): Response {
  const terminal = terminalOf(run);
  const events: StreamEvent[] = [...buffered];
  if (terminal !== null) events.push(terminal);
  const { stream, end } = createEventStream(events);
  end();
  return new Response(stream, { status: 200, headers: streamHeaders() });
}

export async function runMessageRoute(
  request: Request,
  options: MessageRouteOptions = {}
): Promise<Response> {
  const env = options.env ?? process.env;
  // off means the route does not exist: nothing is built, nothing is asked
  if (options.ports === undefined && !isReplyEnabled(env)) return notFound();
  const ports = options.ports ?? createReplyPorts(env);

  const buffered: StreamEvent[] = [];
  let sink: ((event: StreamEvent) => void) | null = null;
  let streaming = false;
  let startStream: () => void = () => undefined;
  const started = new Promise<void>((resolve) => {
    startStream = resolve;
  });

  const emit = (event: StageEvent): void => {
    if (sink !== null) sink(event);
    else buffered.push(event);
    // the gate is the one stage that can still end in an HTTP status; anything after it is a stream
    if (event.stage !== 'GATE' && !streaming) {
      streaming = true;
      startStream();
    }
  };

  const reader = async (_caller: GateCaller) => {
    const body = await readJsonBody(request);
    if (!body.ok) return body;
    return readReplyRequest(body.body);
  };

  const replyOptions: ReplyOptions = {
    signal: request.signal,
    emit,
    ...(options.deadlineMs === undefined
      ? {}
      : { deadlineMs: options.deadlineMs }),
  };
  const run = runReply<RequestFailure>(ports, reader, replyOptions);
  // the platform needs to know when the run is over, not how it went
  options.keepAlive?.(
    run.then(
      () => undefined,
      () => undefined
    )
  );

  const first = await Promise.race([
    run.then(
      (done) => ({ at: 'ENDED', done }) as const,
      () => ({ at: 'FAILED' }) as const
    ),
    started.then(() => ({ at: 'STREAMING' }) as const),
  ]);

  if (first.at === 'FAILED') {
    ports.log('ROUTE_RUN_FAILED');
    return chatErrorResponse('INTERNAL');
  }
  if (first.at === 'ENDED') {
    // a run that ended after it left the gate is a stream even if the race saw it end first
    return streaming
      ? streamedResponse(first.done, buffered)
      : plainResponse(first.done);
  }

  // the gate has passed: the answer is a stream, fed as the run goes on
  const { stream, write, end } = createEventStream(buffered);
  sink = write;
  void run.then(
    (done) => {
      const terminal = terminalOf(done);
      if (terminal !== null) write(terminal);
      end();
    },
    () => {
      ports.log('ROUTE_RUN_FAILED');
      write({
        type: 'error',
        request_id: 'unknown',
        code: 'INTERNAL',
        retryable: false,
      });
      end();
    }
  );
  return new Response(stream, { status: 200, headers: streamHeaders() });
}
