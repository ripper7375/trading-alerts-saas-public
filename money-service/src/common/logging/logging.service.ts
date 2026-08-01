import { Injectable, LoggerService } from '@nestjs/common';

import { rootPinoLogger } from './pino-instance';

/**
 * NestJS LoggerService backed by the shared root pino instance
 * (pino-instance.ts). Wired app-wide via app.useLogger() in main.ts, so
 * every existing `new Logger(context)` call site across the service (and
 * Nest's own internal framework logs) is upgraded to structured JSON
 * output with zero changes to those call sites.
 */
@Injectable()
export class PinoLoggerService implements LoggerService {
  log(message: unknown, ...optionalParams: unknown[]): void {
    this.write(
      rootPinoLogger.info.bind(rootPinoLogger),
      message,
      optionalParams
    );
  }

  error(message: unknown, ...optionalParams: unknown[]): void {
    this.write(
      rootPinoLogger.error.bind(rootPinoLogger),
      message,
      optionalParams
    );
  }

  warn(message: unknown, ...optionalParams: unknown[]): void {
    this.write(
      rootPinoLogger.warn.bind(rootPinoLogger),
      message,
      optionalParams
    );
  }

  debug(message: unknown, ...optionalParams: unknown[]): void {
    this.write(
      rootPinoLogger.debug.bind(rootPinoLogger),
      message,
      optionalParams
    );
  }

  verbose(message: unknown, ...optionalParams: unknown[]): void {
    this.write(
      rootPinoLogger.trace.bind(rootPinoLogger),
      message,
      optionalParams
    );
  }

  fatal(message: unknown, ...optionalParams: unknown[]): void {
    this.write(
      rootPinoLogger.fatal.bind(rootPinoLogger),
      message,
      optionalParams
    );
  }

  private write(
    pinoCall: (mergingObject: object, msg: string) => void,
    message: unknown,
    optionalParams: unknown[]
  ): void {
    // Nest's own convention: the last string optionalParam is the calling
    // class's "context" name (e.g. new Logger('AppModule').log('x')
    // forwards context via the instance, but static/manual calls and
    // Nest's internal framework logs pass it as a trailing string arg).
    const last = optionalParams[optionalParams.length - 1];
    const context = typeof last === 'string' ? last : undefined;
    const extra = context ? optionalParams.slice(0, -1) : optionalParams;

    const msg = typeof message === 'string' ? message : JSON.stringify(message);
    pinoCall(
      {
        ...(context ? { context } : {}),
        ...(extra.length ? { params: extra } : {}),
      },
      msg
    );
  }
}
