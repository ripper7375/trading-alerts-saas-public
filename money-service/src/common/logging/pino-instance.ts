import pino from 'pino';

import {
  getActiveTraceContext,
  getCorrelationId,
} from '../context/log-context';

/**
 * Single shared root pino instance for the whole service — both
 * PinoLoggerService (Nest's app-wide LoggerService, DI-injected) and
 * logger.util.ts's module-scope `logger` (used outside Nest's DI
 * container, existing call sites across ~20 files) delegate to this SAME
 * instance so every log line gets the same
 * service/timestamp/correlationId/traceId/spanId enrichment regardless of
 * which entry point wrote it.
 */
export const rootPinoLogger = pino({
  level: process.env['NODE_ENV'] === 'production' ? 'info' : 'debug',
  base: { service: 'money-service' },
  // Emits an ISO string field named "timestamp" instead of pino's default
  // numeric epoch-ms "time" field, matching this order's own Contract.
  timestamp: () => `,"timestamp":"${new Date().toISOString()}"`,
  formatters: {
    level: (label) => ({ level: label }),
  },
  mixin() {
    const correlationId = getCorrelationId();
    const { traceId, spanId } = getActiveTraceContext();
    return {
      ...(correlationId ? { correlationId } : {}),
      ...(traceId ? { traceId } : {}),
      ...(spanId ? { spanId } : {}),
    };
  },
});
