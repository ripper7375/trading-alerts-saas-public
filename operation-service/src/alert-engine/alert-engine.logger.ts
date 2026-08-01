import { randomUUID } from 'crypto';

import { rootPinoLogger } from '../common/logging/pino-instance';

/**
 * Structured per-fire logging (CC-B: pino + correlation-ID). Scoped
 * narrowly to the alert-engine's fire-dispatch path, per this order's own
 * entry criterion wording ("pino / correlation-ID logging integrated into
 * AlertEngineModule") — not a repo-wide replacement of NestJS's built-in
 * Logger (which stays in use everywhere else in this service and the rest
 * of the codebase; a full migration is out of this PORT session's scope).
 *
 * Session 4B-4 (F13, Step 3): now a `.child()` of the shared root pino
 * instance (common/logging/pino-instance.ts) instead of its own separately
 * -configured pino() root, so every fire-dispatch log line also carries
 * the service/timestamp/traceId/spanId enrichment PinoLoggerService's
 * mixin adds — same `.child({...}).info(...)` call shape as before,
 * dispatcher.service.ts is unchanged.
 *
 * @module alert-engine/alert-engine.logger
 */
export const alertEngineLogger = rootPinoLogger.child({ name: 'alert-engine' });

/** One correlation ID per fired alert, threaded through every log line for
 * that fire's dispatch/publish path so it can be traced end-to-end. */
export function newFireCorrelationId(): string {
  return `fire_${randomUUID()}`;
}
