import { Injectable, LoggerService } from '@nestjs/common';
import pino from 'pino';

import { rootPinoLogger } from './pino-instance';

type PinoLevel = 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal';

function toMessage(message: unknown): string {
  if (typeof message === 'string') return message;
  try {
    return JSON.stringify(message) ?? String(message);
  } catch {
    // Circular structure, BigInt, ...: never let logging throw.
    return String(message);
  }
}

/**
 * NestJS LoggerService backed by the shared root pino instance
 * (pino-instance.ts). Wired app-wide via app.useLogger() in main.ts /
 * main-worker.ts, so every existing `new Logger(context)` call site across
 * the service (and Nest's own internal framework logs) is upgraded to
 * structured JSON output with zero changes to those call sites.
 */
@Injectable()
export class PinoLoggerService implements LoggerService {
  log(message: unknown, ...optionalParams: unknown[]): void {
    this.write('info', message, optionalParams);
  }

  error(message: unknown, ...optionalParams: unknown[]): void {
    this.write('error', message, optionalParams);
  }

  warn(message: unknown, ...optionalParams: unknown[]): void {
    this.write('warn', message, optionalParams);
  }

  debug(message: unknown, ...optionalParams: unknown[]): void {
    this.write('debug', message, optionalParams);
  }

  verbose(message: unknown, ...optionalParams: unknown[]): void {
    this.write('trace', message, optionalParams);
  }

  fatal(message: unknown, ...optionalParams: unknown[]): void {
    this.write('fatal', message, optionalParams);
  }

  private write(
    level: PinoLevel,
    message: unknown,
    optionalParams: unknown[]
  ): void {
    // Nest's own convention: the last string optionalParam is the calling
    // class's "context" name (e.g. new Logger('AppModule').log('x')
    // forwards context via the instance, but static/manual calls and
    // Nest's internal framework logs pass it as a trailing string arg).
    const last = optionalParams[optionalParams.length - 1];
    const context = typeof last === 'string' ? last : undefined;
    const rest = context ? optionalParams.slice(0, -1) : optionalParams;

    // An Error is serialised by pino's `err` serializer (type, message, stack).
    // JSON.stringify(new Error('x')) is "{}", which is what used to be logged.
    // The first Error wins the `err` key; any further Error is serialised in
    // place so it does not collapse to "{}" inside `params`.
    let err: Error | undefined = message instanceof Error ? message : undefined;
    const params: unknown[] = [];
    for (const param of rest) {
      if (param instanceof Error) {
        if (err === undefined) err = param;
        else params.push(pino.stdSerializers.err(param));
      } else {
        params.push(param);
      }
    }

    // Nest's `error(message, stack, context)` shape: a lone trailing string on
    // error/fatal is a stack trace. On log/warn/debug/verbose it is just data.
    let stack: string | undefined;
    if (
      (level === 'error' || level === 'fatal') &&
      params.length === 1 &&
      typeof params[0] === 'string'
    ) {
      stack = params.pop() as string;
    }

    rootPinoLogger[level](
      {
        ...(err ? { err } : {}),
        ...(context ? { context } : {}),
        ...(stack ? { stack } : {}),
        ...(params.length ? { params } : {}),
      },
      err && message === err ? err.message : toMessage(message)
    );
  }
}
