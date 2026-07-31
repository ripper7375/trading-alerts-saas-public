import { randomUUID } from 'crypto';

import pino from 'pino';

/**
 * Structured per-fire logging (CC-B: pino + correlation-ID). Scoped
 * narrowly to the alert-engine's fire-dispatch path, per this order's own
 * entry criterion wording ("pino / correlation-ID logging integrated into
 * AlertEngineModule") — not a repo-wide replacement of NestJS's built-in
 * Logger (which stays in use everywhere else in this service and the rest
 * of the codebase; a full migration is out of this PORT session's scope).
 * Distributed tracing (the rest of CC-B, plan §CC-B) stays gated on F13
 * (OPEN — sink not yet chosen), unaffected by this addition.
 *
 * @module alert-engine/alert-engine.logger
 */
export const alertEngineLogger = pino({
  name: 'alert-engine',
  level: process.env['NODE_ENV'] === 'production' ? 'info' : 'debug',
});

/** One correlation ID per fired alert, threaded through every log line for
 * that fire's dispatch/publish path so it can be traced end-to-end. */
export function newFireCorrelationId(): string {
  return `fire_${randomUUID()}`;
}
