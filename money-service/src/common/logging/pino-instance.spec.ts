import { createRootPinoLogger, REDACT_PATHS } from './pino-instance';

describe('pino-instance redaction', () => {
  const lines: string[] = [];
  const logger = createRootPinoLogger({
    write: (chunk: string) => {
      lines.push(chunk);
    },
  });

  function emit(payload: object): Record<string, unknown> {
    lines.length = 0;
    logger.info(payload, 'msg');
    return JSON.parse(lines[0] as string);
  }

  it('censors top-level secret keys', () => {
    const line = emit({
      password: 'p-1',
      token: 't-1',
      secret: 's-1',
      authorization: 'Bearer a-1',
      cookie: 'c=1',
      apiKey: 'k-1',
      visible: 'ok',
    });

    expect(line).toEqual(
      expect.objectContaining({
        password: '[REDACTED]',
        token: '[REDACTED]',
        secret: '[REDACTED]',
        authorization: '[REDACTED]',
        cookie: '[REDACTED]',
        apiKey: '[REDACTED]',
        visible: 'ok',
      })
    );
  });

  it('censors the keys one level down, including payment details', () => {
    const line = emit({
      user: { password: 'p-2', token: 't-2', secret: 's-2', name: 'Alice' },
      payout: {
        paymentDetails: { iban: 'DE00 0000' },
        accountNumber: '12345678',
        iban: 'DE00 1111',
        currency: 'USD',
      },
    });

    expect(line['user']).toEqual({
      password: '[REDACTED]',
      token: '[REDACTED]',
      secret: '[REDACTED]',
      name: 'Alice',
    });
    expect(line['payout']).toEqual({
      paymentDetails: '[REDACTED]',
      accountNumber: '[REDACTED]',
      iban: '[REDACTED]',
      currency: 'USD',
    });
  });

  it('censors the encrypted payment column too (WS-11)', () => {
    const line = emit({
      payout: { paymentDetailsEncrypted: 'v1:aa:bb:cc', currency: 'USD' },
      params: [{ paymentDetailsEncrypted: 'v1:dd:ee:ff', id: 'r-2' }],
    });

    expect(line['payout']).toEqual({
      paymentDetailsEncrypted: '[REDACTED]',
      currency: 'USD',
    });
    expect(line['params']).toEqual([
      { paymentDetailsEncrypted: '[REDACTED]', id: 'r-2' },
    ]);
    expect(REDACT_PATHS).toEqual(
      expect.arrayContaining([
        '*.paymentDetailsEncrypted',
        'params[*].paymentDetailsEncrypted',
      ])
    );
  });

  it('censors request credentials', () => {
    const line = emit({
      req: {
        method: 'GET',
        headers: { authorization: 'Bearer a-3', cookie: 's=1', host: 'x' },
      },
    });

    expect(line['req']).toEqual({
      method: 'GET',
      headers: {
        authorization: '[REDACTED]',
        cookie: '[REDACTED]',
        host: 'x',
      },
    });
  });

  it('censors the objects PinoLoggerService files under `params`', () => {
    const line = emit({
      params: [{ token: 't-3', apiKey: 'k-3', iban: 'i-3', id: 'r-1' }],
    });

    expect(line['params']).toEqual([
      {
        token: '[REDACTED]',
        apiKey: '[REDACTED]',
        iban: '[REDACTED]',
        id: 'r-1',
      },
    ]);
  });

  it('never prints a planted secret anywhere in the line', () => {
    emit({
      token: 'SECRET-VALUE-1',
      a: { password: 'SECRET-VALUE-2' },
      params: [{ secret: 'SECRET-VALUE-3' }],
      req: { headers: { authorization: 'SECRET-VALUE-4' } },
    });

    expect(lines[0]).not.toMatch(/SECRET-VALUE/);
  });

  it('leaves the message and unrelated fields alone', () => {
    const line = emit({ symbol: 'XAUUSD', price: 2650.5 });

    expect(line['msg']).toBe('msg');
    expect(line['symbol']).toBe('XAUUSD');
    expect(line['price']).toBe(2650.5);
  });

  it('lists every path the plan requires', () => {
    expect(REDACT_PATHS).toEqual(
      expect.arrayContaining([
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
      ])
    );
  });
});
