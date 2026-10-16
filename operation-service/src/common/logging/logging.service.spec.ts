import { PinoLoggerService } from './logging.service';

// Real pino, written to memory: what these tests assert is the JSON line that
// would reach stdout, not the arguments handed to a mock.
const mockLines: string[] = [];
jest.mock('./pino-instance', () => {
  const actual = jest.requireActual('./pino-instance');
  const rootPinoLogger = actual.createRootPinoLogger({
    write: (chunk: string) => {
      mockLines.push(chunk);
    },
  });
  rootPinoLogger.level = 'trace'; // so verbose() is not filtered out
  return { ...actual, rootPinoLogger };
});

function lastLine(): Record<string, unknown> {
  expect(mockLines.length).toBeGreaterThan(0);
  return JSON.parse(mockLines[mockLines.length - 1] as string);
}

describe('PinoLoggerService', () => {
  const service = new PinoLoggerService();

  beforeEach(() => {
    mockLines.length = 0;
  });

  describe('Error serialisation', () => {
    it('logs an Error given as the message under `err` with type, message and stack', () => {
      const error = new TypeError('connection refused');

      service.error(error);

      const line = lastLine();
      expect(line['level']).toBe('error');
      expect(line['msg']).toBe('connection refused');
      expect(line['err']).toEqual(
        expect.objectContaining({
          type: 'TypeError',
          message: 'connection refused',
          stack: expect.stringContaining('TypeError: connection refused'),
        })
      );
    });

    it('keeps the context when the message is an Error', () => {
      service.error(new Error('boom'), 'PaymentService');

      const line = lastLine();
      expect(line['context']).toBe('PaymentService');
      expect(line['params']).toBeUndefined();
      expect((line['err'] as { message: string }).message).toBe('boom');
    });

    it('lifts an Error out of the parameters on any level', () => {
      service.warn('retrying', new Error('timeout'), 'QueueWorker');

      const line = lastLine();
      expect(line['level']).toBe('warn');
      expect(line['msg']).toBe('retrying');
      expect(line['context']).toBe('QueueWorker');
      expect(line['params']).toBeUndefined();
      expect(line['err']).toEqual(
        expect.objectContaining({ type: 'Error', message: 'timeout' })
      );
    });

    it('serialises a second Error in place instead of logging it as {}', () => {
      service.error(new Error('first'), new Error('second'));

      const line = lastLine();
      expect((line['err'] as { message: string }).message).toBe('first');
      expect(line['params']).toEqual([
        expect.objectContaining({ type: 'Error', message: 'second' }),
      ]);
    });
  });

  describe('stack strings', () => {
    const stackText = 'Error: boom\n    at handler (file.ts:1:1)';

    it('promotes a lone trailing string to `stack` on error()', () => {
      service.error('failed', stackText, 'PaymentService');

      const line = lastLine();
      expect(line['stack']).toBe(stackText);
      expect(line['context']).toBe('PaymentService');
      expect(line['params']).toBeUndefined();
    });

    it('promotes it on fatal() as well', () => {
      service.fatal('failed', stackText, 'PaymentService');

      const line = lastLine();
      expect(line['level']).toBe('fatal');
      expect(line['stack']).toBe(stackText);
      expect(line['params']).toBeUndefined();
    });

    it.each(['log', 'warn', 'debug', 'verbose'] as const)(
      'does NOT promote it on %s(): it stays an ordinary parameter',
      (method) => {
        service[method]('note', 'just a string', 'SomeService');

        const line = lastLine();
        expect(line['stack']).toBeUndefined();
        expect(line['params']).toEqual(['just a string']);
        expect(line['context']).toBe('SomeService');
      }
    );

    it('does not promote when there is more than one parameter', () => {
      service.error('failed', 'a', 'b', 'Ctx');

      const line = lastLine();
      expect(line['stack']).toBeUndefined();
      expect(line['params']).toEqual(['a', 'b']);
    });
  });

  describe('everything else keeps its old shape', () => {
    it('logs a string message with the trailing string as context', () => {
      service.log('hello', 'AppModule');

      const line = lastLine();
      expect(line['level']).toBe('info');
      expect(line['msg']).toBe('hello');
      expect(line['context']).toBe('AppModule');
      expect(line['service']).toEqual(expect.any(String));
      expect(line['timestamp']).toEqual(expect.any(String));
    });

    it('files object parameters under `params`', () => {
      service.log('created', { id: 'r-1', count: 2 }, 'Ctx');

      expect(lastLine()['params']).toEqual([{ id: 'r-1', count: 2 }]);
    });

    it('stringifies a non-string message', () => {
      service.log({ a: 1 });

      expect(lastLine()['msg']).toBe('{"a":1}');
    });

    it('does not throw on a circular message', () => {
      const circular: Record<string, unknown> = {};
      circular['self'] = circular;

      expect(() => service.log(circular)).not.toThrow();
      expect(lastLine()['msg']).toBe('[object Object]');
    });

    it.each([
      ['log', 'info'],
      ['error', 'error'],
      ['warn', 'warn'],
      ['debug', 'debug'],
      ['verbose', 'trace'],
      ['fatal', 'fatal'],
    ] as const)('maps %s() to pino level %s', (method, level) => {
      service[method]('x');

      expect(lastLine()['level']).toBe(level);
    });
  });

  describe('redaction through the service', () => {
    it('censors secret-named keys in object parameters', () => {
      service.log('login', { token: 'abc123', userId: 'u-1' }, 'Auth');

      const params = lastLine()['params'] as Array<Record<string, unknown>>;
      expect(params[0]).toEqual({ token: '[REDACTED]', userId: 'u-1' });
      expect(JSON.stringify(mockLines)).not.toContain('abc123');
    });
  });
});
