/**
 * How an intake route answers, and the wrapper both routes run inside.
 *
 * `runIntakeRoute` is the whole front door: it starts the trace, runs the pipeline (flag,
 * session, tier, [the body], thread, profile, quota, and the rest) and turns whatever happens
 * into one of the two formats of `errors.ts`. A route file is therefore a few lines that name
 * its route.
 *
 * `send` is the ONE place an answer leaves. Chapter 7's `request_traces` writer plugs in here
 * (it receives the finished trace), so no route changes when it arrives.
 *
 * @module lib/intake/server/respond
 */

import { randomUUID } from 'crypto';

import type { IntakePorts } from '../pipeline';
import { PacketInvalidError, runIntake } from '../pipeline';
import { TraceRecorder, type IntakeTrace, type TraceRoute } from '../trace';
import {
  ERROR_STATUS,
  errorBody,
  type IntakeErrorBody,
  type IntakeSuccessBody,
  type RequestFailure,
} from './errors';
import { productionPorts } from './access';
import { readInstantRequest, readJsonBody, readTypedRequest } from './request';

function send(
  body: IntakeErrorBody | IntakeSuccessBody,
  status: number
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      // an answer is about THIS trader and THIS minute: nothing may keep it
      'Cache-Control': 'no-store',
      'X-Request-Id': body.trace.request_id,
    },
  });
}

export interface RouteOptions {
  /** the ports; the real ones unless a test passes its own */
  ports?: IntakePorts;
  requestId?: () => string;
}

export interface RouteInput {
  route: TraceRoute;
  request: Request;
}

export async function runIntakeRoute(
  input: RouteInput,
  options: RouteOptions = {}
): Promise<Response> {
  const ports = options.ports ?? productionPorts();
  const clock = (): number => ports.now();
  const trace = new TraceRecorder({
    requestId: (options.requestId ?? randomUUID)(),
    route: input.route,
    method: input.request.method,
    startedAt: new Date(clock()).toISOString(),
    clock,
  });
  const snapshot = (): IntakeTrace => trace.snapshot();

  try {
    const result = await runIntake<RequestFailure>(ports, trace, async () => {
      const read = await readJsonBody(input.request);
      if (!read.ok) return read;
      return input.route === 'instant'
        ? readInstantRequest(read.body)
        : readTypedRequest(read.body);
    });

    switch (result.kind) {
      case 'DISABLED':
        return send(
          errorBody('FEATURE_DISABLED', snapshot()),
          ERROR_STATUS.FEATURE_DISABLED
        );
      case 'REQUEST_FAILED':
        return send(
          errorBody(result.failure.code, snapshot(), {
            message: result.failure.message,
          }),
          ERROR_STATUS[result.failure.code]
        );
      case 'REFUSED':
        return send(
          errorBody(result.refusal.code, snapshot(), {
            refusal: result.refusal,
          }),
          ERROR_STATUS[result.refusal.code]
        );
      case 'PACKET':
        return send(
          { success: true, packet: result.packet, trace: snapshot() },
          200
        );
    }
  } catch (error) {
    // the cause goes to the server log, with the request id and nothing the trader typed
    console.error(
      `[intake] ${trace.requestId} ${
        error instanceof PacketInvalidError
          ? 'packet failed its validator'
          : 'unexpected failure'
      }:`,
      error instanceof Error ? error.message : 'unknown error'
    );
    return send(errorBody('INTERNAL', snapshot()), ERROR_STATUS.INTERNAL);
  }
}
