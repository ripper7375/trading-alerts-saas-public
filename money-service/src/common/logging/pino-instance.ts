import pino from 'pino';

import {
  getActiveTraceContext,
  getCorrelationId,
} from '../context/log-context';

/**
 * Keys whose values never reach stdout. Pino replaces them with `censor`
 * before serialising. `*.x` covers a key one level below any top-level key
 * (`{ user: { token } }`); `params[*].x` covers the objects handed to
 * PinoLoggerService as trailing log parameters (`logger.log('msg', { token })`),
 * which it files under `params`.
 */
export const REDACT_PATHS: string[] = [
  'password',
  'token',
  'secret',
  'authorization',
  'cookie',
  'apiKey',
  '*.password',
  '*.token',
  '*.secret',
  '*.paymentDetails',
  '*.accountNumber',
  '*.iban',
  'req.headers.authorization',
  'req.headers.cookie',
  'params[*].password',
  'params[*].token',
  'params[*].secret',
  'params[*].authorization',
  'params[*].cookie',
  'params[*].apiKey',
  'params[*].paymentDetails',
  'params[*].accountNumber',
  'params[*].iban',
];

/**
 * Builds the service's pino instance. Production code uses the shared
 * `rootPinoLogger` below; tests pass a destination to capture the output.
 */
export function createRootPinoLogger(
  destination?: pino.DestinationStream
): pino.Logger {
  return pino(
    {
      level: process.env['NODE_ENV'] === 'production' ? 'info' : 'debug',
      base: { service: 'money-service' },
      // Emits an ISO string field named "timestamp" instead of pino's default
      // numeric epoch-ms "time" field, matching this order's own Contract.
      timestamp: () => `,"timestamp":"${new Date().toISOString()}"`,
      formatters: {
        level: (label) => ({ level: label }),
      },
      redact: {
        paths: REDACT_PATHS,
        censor: '[REDACTED]',
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
    },
    destination
  );
}

/**
 * Single shared root pino instance for the whole service — both
 * PinoLoggerService (Nest's app-wide LoggerService, DI-injected) and
 * logger.util.ts's module-scope `logger` (used outside Nest's DI
 * container, existing call sites across ~20 files) delegate to this SAME
 * instance so every log line gets the same
 * service/timestamp/correlationId/traceId/spanId enrichment regardless of
 * which entry point wrote it.
 */
export const rootPinoLogger = createRootPinoLogger();
