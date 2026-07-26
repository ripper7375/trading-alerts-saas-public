/**
 * Wise API Client Tests (Session 4A-W3a, File 4/10)
 *
 * Covers retry/back-off behavior on 429/5xx and the body-redaction
 * invariant (design §7.4) — raw `details` must never reach a log call.
 */
import { logger } from '../common/logger.util';

import { WiseApiClient, WiseApiError } from './wise-api.client';
import type { WiseConfig } from './wise.config';

function jsonResponse(
  status: number,
  body: unknown,
  headers: Record<string, string> = {}
): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: new Headers(headers),
    json: async () => body,
  } as unknown as Response;
}

describe('WiseApiClient', () => {
  let client: WiseApiClient;
  const mockFetch = jest.fn();
  const fakeConfig = {
    baseUrl: 'https://api.wise-sandbox.com',
    apiToken: 'test-token',
    profileId: '29617748',
    environment: 'sandbox',
  } as unknown as WiseConfig;

  beforeEach(() => {
    global.fetch = mockFetch as unknown as typeof fetch;
    mockFetch.mockReset();
    client = new WiseApiClient(fakeConfig);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('retries on 429 with exponential back-off and eventually succeeds', async () => {
    jest.useFakeTimers();
    mockFetch
      .mockResolvedValueOnce(jsonResponse(429, {}))
      .mockResolvedValueOnce(jsonResponse(429, {}))
      .mockResolvedValueOnce(jsonResponse(200, { id: 29617748 }));

    const promise = client.request('/v1/profiles');
    await jest.advanceTimersByTimeAsync(500);
    await jest.advanceTimersByTimeAsync(1000);
    const result = await promise;

    expect(result).toEqual({ id: 29617748 });
    expect(mockFetch).toHaveBeenCalledTimes(3);
  });

  it('respects Retry-After when present', async () => {
    jest.useFakeTimers();
    mockFetch
      .mockResolvedValueOnce(jsonResponse(429, {}, { 'Retry-After': '2' }))
      .mockResolvedValueOnce(jsonResponse(200, { ok: true }));

    const promise = client.request('/v1/profiles');
    await jest.advanceTimersByTimeAsync(2000);
    const result = await promise;

    expect(result).toEqual({ ok: true });
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it('gives up after MAX_RETRIES and throws WiseApiError on a persistent 5xx', async () => {
    jest.useFakeTimers();
    mockFetch.mockResolvedValue(jsonResponse(500, { error: 'boom' }));

    const promise = client.request('/v1/profiles');
    const expectation = expect(promise).rejects.toBeInstanceOf(WiseApiError);
    await jest.advanceTimersByTimeAsync(500);
    await jest.advanceTimersByTimeAsync(1000);
    await jest.advanceTimersByTimeAsync(2000);
    await expectation;

    expect(mockFetch).toHaveBeenCalledTimes(4);
  });

  it('never logs the raw details object — only [REDACTED]', async () => {
    const infoSpy = jest
      .spyOn(logger, 'info')
      .mockImplementation(() => undefined);
    mockFetch.mockResolvedValueOnce(jsonResponse(200, { id: 1 }));

    await client.request('/v1/accounts', {
      method: 'POST',
      body: {
        accountHolderName: 'Jane Doe',
        details: { accountNumber: '37778842', dateOfBirth: '1961-01-01' },
      },
      redactBodyFields: ['details'],
    });

    const successCall = infoSpy.mock.calls.find(
      ([message]) => message === 'Wise API request succeeded'
    );
    expect(successCall).toBeDefined();

    const context = successCall?.[1] as {
      requestBody?: Record<string, unknown>;
    };
    expect(context?.requestBody?.['details']).toBe('[REDACTED]');

    const serializedCalls = JSON.stringify(infoSpy.mock.calls);
    expect(serializedCalls).not.toContain('37778842');
    expect(serializedCalls).not.toContain('1961-01-01');

    infoSpy.mockRestore();
  });

  it('redacts the details object on an error response too', async () => {
    const errorSpy = jest
      .spyOn(logger, 'error')
      .mockImplementation(() => undefined);
    mockFetch.mockResolvedValueOnce(jsonResponse(400, { error: 'invalid' }));

    await expect(
      client.request('/v1/accounts', {
        method: 'POST',
        body: { details: { accountNumber: '99988877' } },
        redactBodyFields: ['details'],
      })
    ).rejects.toBeInstanceOf(WiseApiError);

    const serializedCalls = JSON.stringify(errorSpy.mock.calls);
    expect(serializedCalls).not.toContain('99988877');

    errorSpy.mockRestore();
  });
});
