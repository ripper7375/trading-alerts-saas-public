import type { LogLevel } from '@nestjs/common';

/**
 * The log levels handed to NestFactory.
 *
 * Production writes `log`, `warn` and `error` (Nest then writes `fatal` too).
 * Ingestion bursts wrote so many `debug` lines (one per authorised request, two
 * per job) that Railway dropped lines, errors possibly among them. Setting
 * `LOG_LEVEL=debug` brings the `debug` lines back, including
 * `Authorized caller: <prefix>`. Outside production Nest's default is kept.
 */
export function loggerOptions(env: NodeJS.ProcessEnv): {
  logger?: LogLevel[];
} {
  if (env['NODE_ENV'] !== 'production') return {};
  const levels: LogLevel[] = ['log', 'warn', 'error'];
  return {
    logger: env['LOG_LEVEL'] === 'debug' ? ['debug', ...levels] : levels,
  };
}
