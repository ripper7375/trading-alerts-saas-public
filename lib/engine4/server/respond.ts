/**
 * How a route answers, and the wrapper every route runs inside.
 *
 * `runRoute` is the whole front door: it times the request, applies the flag, the
 * session and the tier (`session.ts`), reads a JSON body when the route takes one,
 * runs the route's handler and turns whatever happens into one of the two formats
 * of `errors.ts`. A route file is therefore a few lines that name its handler.
 *
 * `respond` is the ONE place an answer leaves. Chapter 7's `request_traces` writer
 * plugs in here (it receives the finished trace), so no route changes when it
 * arrives.
 *
 * BigInt values (the offer and the blackout carry unix seconds as `bigint`) are
 * written as decimal text, exactly; a `Rational` writes itself as its canonical
 * text. Nothing is sent through a JavaScript number that was not one already.
 *
 * @module lib/engine4/server/respond
 */

import { AuditKeyError } from '../store/user-hash';
import { StoredProfileError } from '../store/profile-store';
import {
  ERROR_STATUS,
  Engine4HttpError,
  errorBody,
  type Engine4ErrorCode,
} from './errors';
import { readJsonBody } from './request';
import { authorize, type Engine4Caller } from './session';
import { TraceBuilder, type Engine4Route, type RequestTrace } from './trace';

/** JSON text of a value, with `bigint` as decimal text. */
export function toJsonText(value: unknown): string {
  return JSON.stringify(value, (_key, item: unknown) =>
    typeof item === 'bigint' ? item.toString() : item
  );
}

function send(body: unknown, status: number): Response {
  return new Response(toJsonText(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      // an answer is about THIS trader and THIS minute: nothing may keep it
      'Cache-Control': 'no-store',
    },
  });
}

export function respondError(
  code: Engine4ErrorCode,
  message: string,
  trace: RequestTrace,
  details?: Record<string, unknown>
): Response {
  return send(errorBody(code, message, trace, details), ERROR_STATUS[code]);
}

export function respondOk<T extends object>(
  fields: T,
  trace: RequestTrace,
  status = 200
): Response {
  return send({ ...fields, success: true, trace }, status);
}

export interface RouteInput {
  route: Engine4Route;
  request: Request;
  /** the route takes a JSON body (POST) */
  takesBody: boolean;
}

export interface RouteContext {
  caller: Engine4Caller;
  trace: TraceBuilder;
  /** the parsed body, or null for a route without one */
  body: Record<string, unknown> | null;
}

export interface RouteOutput<T extends object> {
  fields: T;
  status?: number;
}

export interface RouteOptions {
  clock?: () => number;
  authorizeCaller?: typeof authorize;
}

export async function runRoute<T extends object>(
  input: RouteInput,
  handler: (context: RouteContext) => Promise<RouteOutput<T>>,
  options: RouteOptions = {}
): Promise<Response> {
  const trace = new TraceBuilder(
    input.route,
    input.request.method,
    options.clock
  );
  try {
    const access = await (options.authorizeCaller ?? authorize)();
    trace.set({ tier: access.ok ? access.caller.tier : access.tier });
    if (!access.ok) {
      return respondError(access.code, access.message, trace.snapshot());
    }
    let body: Record<string, unknown> | null = null;
    if (input.takesBody) {
      const read = await readJsonBody(input.request);
      if (!read.ok) {
        return respondError(read.code, read.message, trace.snapshot());
      }
      body = read.body;
    }
    const out = await handler({ caller: access.caller, trace, body });
    return respondOk(out.fields, trace.snapshot(), out.status);
  } catch (error) {
    if (error instanceof Engine4HttpError) {
      return respondError(
        error.code,
        error.message,
        trace.snapshot(),
        error.details
      );
    }
    if (error instanceof AuditKeyError) {
      console.error(`[engine4] ${trace.requestId} audit key:`, error.message);
      return respondError(
        'AUDIT_NOT_CONFIGURED',
        'Report 2 cannot record anything right now.',
        trace.snapshot()
      );
    }
    if (error instanceof StoredProfileError) {
      console.error(
        `[engine4] ${trace.requestId} stored profile:`,
        error.message
      );
      return respondError(
        'INTERNAL',
        'The stored profile could not be read.',
        trace.snapshot()
      );
    }
    console.error(
      `[engine4] ${trace.requestId} unexpected failure:`,
      error instanceof Error ? error.message : error
    );
    return respondError(
      'INTERNAL',
      'Something went wrong on our side.',
      trace.snapshot()
    );
  }
}
