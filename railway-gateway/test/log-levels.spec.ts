import { Logger } from '@nestjs/common';
import { loggerOptions } from '../src/common/log-levels';

/**
 * Railway drops log lines when a service writes too many (B3 log scan,
 * 2026-11-26): production keeps log, warn and error, and debug only on request.
 */
describe('loggerOptions', () => {
  it('writes log, warn and error in production', () => {
    expect(loggerOptions({ NODE_ENV: 'production' })).toEqual({
      logger: ['log', 'warn', 'error'],
    });
  });

  it('adds debug in production when LOG_LEVEL is debug', () => {
    expect(
      loggerOptions({ NODE_ENV: 'production', LOG_LEVEL: 'debug' })
    ).toEqual({ logger: ['debug', 'log', 'warn', 'error'] });
  });

  it('ignores any other LOG_LEVEL in production', () => {
    for (const value of ['', 'info', 'verbose', 'DEBUG', 'true']) {
      expect(
        loggerOptions({ NODE_ENV: 'production', LOG_LEVEL: value })
      ).toEqual({ logger: ['log', 'warn', 'error'] });
    }
  });

  it("leaves Nest's default levels outside production", () => {
    for (const env of [
      {},
      { NODE_ENV: 'development' },
      { NODE_ENV: 'test' },
      { LOG_LEVEL: 'debug' },
    ]) {
      expect(loggerOptions(env)).toEqual({});
    }
  });
});

describe('what the Nest logger writes with the production levels', () => {
  function written(env: NodeJS.ProcessEnv): string {
    const lines: string[] = [];
    const keep = (chunk: unknown): boolean => {
      lines.push(String(chunk));
      return true;
    };
    const out = jest.spyOn(process.stdout, 'write').mockImplementation(keep);
    const err = jest.spyOn(process.stderr, 'write').mockImplementation(keep);
    try {
      Logger.overrideLogger(loggerOptions(env).logger ?? false);
      const logger = new Logger('Probe');
      logger.verbose('line-verbose');
      logger.debug('line-debug');
      logger.log('line-log');
      logger.warn('line-warn');
      logger.error('line-error');
      logger.fatal('line-fatal');
    } finally {
      out.mockRestore();
      err.mockRestore();
    }
    return lines.join('');
  }

  const seen = (text: string): string[] =>
    ['verbose', 'debug', 'log', 'warn', 'error', 'fatal'].filter((level) =>
      text.includes(`line-${level}`)
    );

  afterAll(() => {
    Logger.overrideLogger([
      'verbose',
      'debug',
      'log',
      'warn',
      'error',
      'fatal',
    ]);
  });

  it('drops debug and verbose and keeps fatal', () => {
    expect(seen(written({ NODE_ENV: 'production' }))).toEqual([
      'log',
      'warn',
      'error',
      'fatal',
    ]);
  });

  it('writes debug when it is asked for', () => {
    expect(
      seen(written({ NODE_ENV: 'production', LOG_LEVEL: 'debug' }))
    ).toEqual(['debug', 'log', 'warn', 'error', 'fatal']);
  });
});
