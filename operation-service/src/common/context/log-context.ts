import { AsyncLocalStorage } from 'async_hooks';

import { trace } from '@opentelemetry/api';

/**
 * Shared AsyncLocalStorage store for the current request's correlation ID.
 * Populated by CorrelationIdMiddleware (Step 4); read here by
 * PinoLoggerService's mixin (Step 3) so every log line inside a request
 * carries the same correlationId without threading it through every call
 * site manually.
 */
export interface CorrelationContext {
  correlationId: string;
}

export const correlationContextStorage =
  new AsyncLocalStorage<CorrelationContext>();

export function getCorrelationId(): string | undefined {
  return correlationContextStorage.getStore()?.correlationId;
}

/** Reads the currently active OTel span's trace/span IDs, if any (F13). */
export function getActiveTraceContext(): {
  traceId?: string;
  spanId?: string;
} {
  const span = trace.getActiveSpan();
  if (!span) {
    return {};
  }
  const ctx = span.spanContext();
  return { traceId: ctx.traceId, spanId: ctx.spanId };
}
