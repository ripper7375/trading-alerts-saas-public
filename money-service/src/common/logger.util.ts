/**
 * Simple Logging Utility
 *
 * Originally ported byte-for-byte from lib/logger.ts (Session 4A-2, File
 * 2/6) as a plain console.log wrapper. Session 4B-4 (F13, Step 3):
 * delegates to the shared root pino instance (common/logging/pino-
 * instance.ts) instead — same `.info/.warn/.error/.debug` call shape for
 * all ~20 existing call sites, output is now structured JSON with the
 * same service/timestamp/correlationId/traceId/spanId enrichment
 * PinoLoggerService's mixin adds. `debug()`'s old manual
 * `NODE_ENV === 'development'` gate is dropped — pino's own level filter
 * (info in production, debug otherwise, set in pino-instance.ts) already
 * replicates it.
 */

import { rootPinoLogger } from './logging/pino-instance';

interface LogContext {
  [key: string]: unknown;
}

class Logger {
  info(message: string, context?: LogContext): void {
    rootPinoLogger.info(context ?? {}, message);
  }

  warn(message: string, context?: LogContext): void {
    rootPinoLogger.warn(context ?? {}, message);
  }

  error(message: string, context?: LogContext): void {
    rootPinoLogger.error(context ?? {}, message);
  }

  debug(message: string, context?: LogContext): void {
    rootPinoLogger.debug(context ?? {}, message);
  }
}

export const logger = new Logger();
