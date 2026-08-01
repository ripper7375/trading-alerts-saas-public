/**
 * OpenTelemetry SDK bootstrap (F13, Option C: OTel SDK + OTLP HTTP exporter,
 * DECISION-LOG.md). Must be imported before any other module in every
 * entrypoint — auto-instrumentation patches the `http`/`express`/`ioredis`
 * module singletons at require() time, so anything required before this
 * runs is not instrumented.
 */
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { Resource } from '@opentelemetry/resources';
import { NodeSDK } from '@opentelemetry/sdk-node';
import {
  ATTR_SERVICE_NAME,
  ATTR_SERVICE_VERSION,
} from '@opentelemetry/semantic-conventions';

export function initOtel(serviceName: string): void {
  const endpoint = process.env['OTEL_EXPORTER_OTLP_ENDPOINT'];
  const resolvedServiceName = process.env['OTEL_SERVICE_NAME'] ?? serviceName;

  // No @opentelemetry/instrumentation-prisma entry exists in this installed
  // getNodeAutoInstrumentations() version's map (0.56.x) — native Prisma
  // tracing needs `previewFeatures = ["tracing"]` in schema.prisma plus a
  // separate @prisma/instrumentation package, out of scope for this INFRA
  // session (Rollback: no schema changes). HTTP/Express/ioredis are
  // auto-detected and instrumented since those packages are actually in
  // use; fs is disabled explicitly (extremely high-volume, low-signal).
  const instrumentations = getNodeAutoInstrumentations({
    '@opentelemetry/instrumentation-fs': { enabled: false },
  });

  const sdk = new NodeSDK({
    resource: new Resource({
      [ATTR_SERVICE_NAME]: resolvedServiceName,
      [ATTR_SERVICE_VERSION]: '0.1.0',
    }),
    // Only wire a real network exporter when a real collector endpoint is
    // configured. Omitting traceExporter is the actual silent branch: spans
    // still generate (so the Pino logger can attach trace/span IDs), but
    // nothing is sent anywhere — avoids OTLPTraceExporter's own default
    // localhost:4318 connection-refused retry noise while F13's Option A/B
    // backend is still unpicked.
    ...(endpoint ? { traceExporter: new OTLPTraceExporter() } : {}),
    instrumentations: [instrumentations],
  });

  try {
    sdk.start();
    console.log(
      `[OTel] Tracing initialized for ${resolvedServiceName}` +
        (endpoint
          ? ''
          : ' (no OTEL_EXPORTER_OTLP_ENDPOINT set — spans generated but not exported)')
    );
  } catch (error) {
    // Must never throw — a tracing failure must not block app boot.
    console.error(
      `[OTel] Failed to initialize tracing for ${resolvedServiceName}:`,
      error
    );
  }

  const shutdown = (): void => {
    sdk.shutdown().catch(() => undefined);
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}
