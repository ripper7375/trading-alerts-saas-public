/**
 * @jest-environment node
 */

/**
 * `createHttpApi` (build step 5, part 7): the browser's side of the routes. Every way
 * the routes can answer, or fail to, becomes one shape, and the one fact the consent
 * bar needs, "no answer came, so pressing again must send the same submission id",
 * is `retryable`. The routes themselves are exercised in `api-parity.test.ts`.
 */

import {
  createHttpApi,
  type ConsentRequest,
  type SetupRequest,
} from '@/components/report2/api-client';

const REQUEST: SetupRequest = {
  cycleSlot: '1789764900',
  side: 'BUY',
  zoneId: 'Z1',
  entry: '4367.2',
  equity: '10000',
  riskPct: '0.75',
  stopDistance: '16.78',
  rrr: '1.75',
  language: 'en-US',
};

const CONSENT: ConsentRequest = {
  ...REQUEST,
  action: 'ACCEPT',
  submissionId: 'submission-0001-abcdef',
  shownSetupSha256: 'a'.repeat(64),
};

function reply(status: number, body: unknown): Response {
  return new Response(typeof body === 'string' ? body : JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function api(handler: (url: string, init: RequestInit) => Promise<Response>) {
  const calls: { url: string; init: RequestInit }[] = [];
  const fetchImpl = (async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    return handler(url, init);
  }) as unknown as typeof fetch;
  return { api: createHttpApi(fetchImpl), calls };
}

describe('what it sends', () => {
  test('size: POST JSON to /api/engine4/size with exactly the fields of the request', async () => {
    const { api: client, calls } = api(async () =>
      reply(200, { success: true, setup: {} })
    );
    await client.size(REQUEST);
    expect(calls).toHaveLength(1);
    expect(calls[0]!.url).toBe('/api/engine4/size');
    expect(calls[0]!.init.method).toBe('POST');
    expect(new Headers(calls[0]!.init.headers).get('content-type')).toBe(
      'application/json'
    );
    expect(JSON.parse(calls[0]!.init.body as string)).toEqual(REQUEST);
  });

  test('consent: POST JSON to /api/engine4/consent with the action, the submission id and the hash shown', async () => {
    const { api: client, calls } = api(async () =>
      reply(201, {
        success: true,
        duplicate: false,
        consent: { recordedAt: '2026-09-18T20:57:30.000Z' },
      })
    );
    await client.consent(CONSENT);
    expect(calls[0]!.url).toBe('/api/engine4/consent');
    expect(JSON.parse(calls[0]!.init.body as string)).toEqual(CONSENT);
  });
});

describe('size', () => {
  test('a good answer is handed back whole', async () => {
    const body = {
      success: true,
      setup: { ok: true },
      setupSha256: 'x',
      badge: {},
      offer: {},
    };
    const { api: client } = api(async () => reply(200, body));
    expect(await client.size(REQUEST)).toEqual({ ok: true, answer: body });
  });

  test('a setup that fails its checks is still a 200 and still an answer, never an error', async () => {
    const body = { success: true, setup: { ok: false, checks: [] } };
    const { api: client } = api(async () => reply(200, body));
    const outcome = await client.size(REQUEST);
    expect(outcome.ok).toBe(true);
  });

  test.each([
    [401, 'UNAUTHENTICATED', false],
    [403, 'TIER_REQUIRED', false],
    [404, 'FEATURE_DISABLED', false],
    [409, 'PROFILE_NOT_SET', false],
    [400, 'BAD_REQUEST', false],
    [503, 'DATA_UNAVAILABLE', true],
    [500, 'INTERNAL', true],
  ])(
    'a %i with %s is refused, and retryable is %s',
    async (status, code, retryable) => {
      const { api: client } = api(async () =>
        reply(status, { success: false, error: { code, message: 'x' } })
      );
      expect(await client.size(REQUEST)).toEqual({
        ok: false,
        code,
        retryable,
      });
    }
  );

  test('no answer at all (the connection failed) is NETWORK, and retryable', async () => {
    const { api: client } = api(async () => {
      throw new TypeError('Failed to fetch');
    });
    expect(await client.size(REQUEST)).toEqual({
      ok: false,
      code: 'NETWORK',
      retryable: true,
    });
  });

  test('an answer that is not JSON is INTERNAL; retryable only if it was a server failure', async () => {
    const down = api(async () => reply(502, '<html>Bad gateway</html>'));
    expect(await down.api.size(REQUEST)).toEqual({
      ok: false,
      code: 'INTERNAL',
      retryable: true,
    });
    const odd = api(async () => reply(418, 'teapot'));
    expect(await odd.api.size(REQUEST)).toEqual({
      ok: false,
      code: 'INTERNAL',
      retryable: false,
    });
  });

  test('a 200 that is not the shape of an answer is not trusted', async () => {
    for (const body of [
      {},
      { success: false },
      { success: true },
      { success: true, setup: 'x' },
      [],
      null,
    ]) {
      const { api: client } = api(async () => reply(200, body as never));
      const outcome = await client.size(REQUEST);
      expect(outcome.ok).toBe(false);
    }
  });

  test('an error with no code is INTERNAL', async () => {
    const { api: client } = api(async () => reply(500, { success: false }));
    expect(await client.size(REQUEST)).toEqual({
      ok: false,
      code: 'INTERNAL',
      retryable: true,
    });
  });
});

describe('consent', () => {
  test('a record written (201) is ok, not a duplicate, with the time it was written', async () => {
    const { api: client } = api(async () =>
      reply(201, {
        success: true,
        duplicate: false,
        consent: {
          id: 'c1',
          action: 'ACCEPT',
          recordedAt: '2026-09-18T20:57:30.000Z',
        },
      })
    );
    expect(await client.consent(CONSENT)).toEqual({
      ok: true,
      duplicate: false,
      action: 'ACCEPT',
      recordedAt: '2026-09-18T20:57:30.000Z',
    });
  });

  test('the first answer given again (200) is a duplicate', async () => {
    const { api: client } = api(async () =>
      reply(200, {
        success: true,
        duplicate: true,
        consent: { recordedAt: '2026-09-18T20:57:30.000Z' },
      })
    );
    expect(await client.consent(CONSENT)).toMatchObject({
      ok: true,
      duplicate: true,
    });
  });

  test('the action in the outcome is the action that was pressed, whatever the server echoed', async () => {
    const { api: client } = api(async () =>
      reply(201, {
        success: true,
        duplicate: false,
        consent: { action: 'DECLINE', recordedAt: '2026-09-18T20:57:30.000Z' },
      })
    );
    expect(
      await client.consent({ ...CONSENT, action: 'MODIFY' })
    ).toMatchObject({ action: 'MODIFY' });
  });

  test.each([
    [409, 'SETUP_CHANGED', false],
    [409, 'SUBMISSION_IN_FLIGHT', true],
    [422, 'SUBMISSION_ID_REUSED', false],
    [422, 'CONSENT_REFUSED', false],
    [503, 'AUDIT_NOT_CONFIGURED', true],
    [500, 'INTERNAL', true],
  ])('a %i with %s: retryable is %s', async (status, code, retryable) => {
    const { api: client } = api(async () =>
      reply(status, { success: false, error: { code, message: 'x' } })
    );
    expect(await client.consent(CONSENT)).toEqual({
      ok: false,
      code,
      retryable,
    });
  });

  test('no answer at all is NETWORK and retryable: the same press may already have been recorded', async () => {
    const { api: client } = api(async () => {
      throw new TypeError('Failed to fetch');
    });
    expect(await client.consent(CONSENT)).toEqual({
      ok: false,
      code: 'NETWORK',
      retryable: true,
    });
  });

  test('a 200 without a consent is not a recorded consent', async () => {
    const { api: client } = api(async () => reply(200, { success: true }));
    expect((await client.consent(CONSENT)).ok).toBe(false);
  });
});
