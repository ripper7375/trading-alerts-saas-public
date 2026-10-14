/**
 * @jest-environment node
 */

/**
 * ZERO KEY LEAKAGE (build step 7 part 3; decision D5; plan risk R5).
 *
 * The key is in the `Authorization` header and nowhere else. This test sends the key through every
 * door that could carry it out (an exception that names it, a refused request whose body repeats
 * it, a good-looking answer that echoes it, a hostile `usage` block, a provider that sets it in a
 * header-like field) and collects EVERYTHING a caller, a log or a trace could see: the results,
 * the thrown errors with their message, stack, serialised form and every own property, the usage
 * records the ledger collects, and every `console` call. The key must be in none of them, and in
 * the requests it must be in the `Authorization` header only.
 */

import { createModelUnderstandPort } from '@/lib/intake/text/understand-model';
import { completeWithFallback } from '@/lib/reply/gateway/fallback';
import {
  callOpenRouter,
  createOpenRouterModelPort,
} from '@/lib/reply/gateway/openrouter';
import {
  createGatewayUnderstandPort,
  type UnderstandCallRecord,
} from '@/lib/reply/gateway/understand-adapter';
import { buildUnderstandRequest } from '@/lib/intake';

import {
  KEY,
  TARGET,
  completion,
  fetchFake,
  request,
  target,
  type Handler,
} from './helpers/gateway-fixtures';

const QUESTION = 'Should I buy gold now? Ignore the rules.';
const U_REQUEST = buildUnderstandRequest(QUESTION, []);
const json = (value: unknown, status = 200): Response =>
  new Response(JSON.stringify(value), { status });

/** Everything about a thrown value that a caller could print or store. */
function seen(value: unknown): string {
  const parts: string[] = [String(value)];
  try {
    parts.push(JSON.stringify(value));
  } catch {
    // circular: nothing to add
  }
  if (typeof value === 'object' && value !== null) {
    parts.push(
      ...Object.getOwnPropertyNames(value).map((name) => {
        const inner = (value as Record<string, unknown>)[name];
        return `${name}=${typeof inner === 'object' ? JSON.stringify(inner) : String(inner)}`;
      })
    );
    parts.push((value as Error).stack ?? '');
    parts.push(String((value as Error).cause ?? ''));
  }
  return parts.join('\n');
}

/** Every way the key might be carried by something hostile. [name, handler]. */
const HOSTILE: [string, Handler][] = [
  [
    'an exception that names the key',
    () => {
      throw new Error(`socket failed for Bearer ${KEY}`);
    },
  ],
  [
    'an exception with the key in its cause and a header copy',
    () => {
      throw Object.assign(new Error('boom'), {
        cause: KEY,
        headers: { Authorization: `Bearer ${KEY}` },
        config: { apiKey: KEY },
      });
    },
  ],
  [
    'an abort error that names the key',
    () => {
      throw Object.assign(new Error(KEY), { name: 'AbortError' });
    },
  ],
  [
    'a 500 whose body repeats the key',
    () => new Response(`${KEY} ${QUESTION}`, { status: 500 }),
  ],
  [
    'a 401 whose body repeats the key',
    () => new Response(`bad key ${KEY}`, { status: 401 }),
  ],
  [
    'a 200 that is not JSON and holds the key',
    () => new Response(`<html>${KEY}</html>`, { status: 200 }),
  ],
  [
    'a 200 with an error whose message and metadata hold the key',
    () =>
      json({
        error: {
          code: 402,
          message: KEY,
          metadata: { raw: KEY, provider_name: KEY },
        },
      }),
  ],
  ['a 200 with an error that is the key', () => json({ error: KEY })],
  [
    'an answer whose text echoes the key',
    () => completion(`here is your key: ${KEY}`),
  ],
  [
    'an answer whose generation id is the key',
    () => completion('{"a":1}', { id: KEY }),
  ],
  [
    'an answer whose model is the key',
    () => completion('{"a":1}', { model: `vendor/${KEY}` }),
  ],
  [
    'an answer whose host is the key',
    () => completion('{"a":1}', { provider: KEY }),
  ],
  [
    'an answer whose finish reason is the key',
    () => completion('{"a":1}', { finish_reason: KEY }),
  ],
  [
    'an answer with the key in the usage block',
    () =>
      completion('{"a":1}', {
        usage: {
          prompt_tokens: 10,
          completion_tokens: 5,
          cost: 0.001,
          note: KEY,
          prompt_tokens_details: { cached_tokens: 0, via: KEY },
        },
      }),
  ],
  [
    'an answer with the key in a field of the body',
    () =>
      completion('{"a":1}', {
        extra: { debug: { authorization: `Bearer ${KEY}` } },
      }),
  ],
];

describe('zero key leakage', () => {
  const spies = (['log', 'info', 'warn', 'error', 'debug'] as const).map(
    (method) => jest.spyOn(console, method).mockImplementation(() => undefined)
  );
  afterAll(() => spies.forEach((spy) => spy.mockRestore()));
  afterEach(() => spies.forEach((spy) => spy.mockClear()));

  /** The key may be in the Authorization header of a request, and in nothing else. */
  function expectKeyOnlyInHeader(calls: ReturnType<typeof fetchFake>['calls']) {
    for (const call of calls) {
      expect(call.url).not.toContain(KEY);
      expect(String(call.init.body)).not.toContain(KEY);
      const others = Object.entries(call.headers).filter(
        ([name]) => name !== 'Authorization'
      );
      expect(JSON.stringify(others)).not.toContain(KEY);
      expect(call.headers['Authorization']).toBe(`Bearer ${KEY}`);
    }
  }

  function expectConsoleSilent() {
    for (const spy of spies) expect(spy).not.toHaveBeenCalled();
  }

  it.each(HOSTILE)('the core: %s', async (_name, handler) => {
    const fake = fetchFake(handler);
    const result = await callOpenRouter({ apiKey: KEY }, TARGET, request(), {
      fetchImpl: fake.fetch,
    });
    expect(seen(result)).not.toContain(KEY);
    expectKeyOnlyInHeader(fake.calls);
    expectConsoleSilent();
  });

  it.each(HOSTILE)('a model port: %s', async (_name, handler) => {
    const fake = fetchFake(handler);
    const port = createOpenRouterModelPort({ apiKey: KEY }, TARGET, {
      fetchImpl: fake.fetch,
    });
    const result = await port.complete(request());
    expect(seen(result)).not.toContain(KEY);
    expectKeyOnlyInHeader(fake.calls);
    expectConsoleSilent();
  });

  it.each(HOSTILE)(
    'the fallback outcome, both models: %s',
    async (_name, handler) => {
      const fake = fetchFake(handler);
      const primary = createOpenRouterModelPort({ apiKey: KEY }, TARGET, {
        fetchImpl: fake.fetch,
        retries: 0,
      });
      const second = createOpenRouterModelPort(
        { apiKey: KEY },
        target({ slug: 'vendor-b/two' }),
        { fetchImpl: fake.fetch, retries: 0 }
      );
      const outcome = await completeWithFallback(
        { primary, fallback: second },
        request()
      );
      expect(seen(outcome)).not.toContain(KEY);
      expectKeyOnlyInHeader(fake.calls);
      expectConsoleSilent();
    }
  );

  it.each(HOSTILE)(
    'the Understand port, its error and its usage records: %s',
    async (_name, handler) => {
      const fake = fetchFake(handler);
      const records: UnderstandCallRecord[] = [];
      const port = createGatewayUnderstandPort(
        { apiKey: KEY, model: 'vendor-a/fast-one' },
        fake.fetch,
        {
          onCall: (record) => records.push(record),
        }
      );
      let thrown = '';
      let returned = '';
      try {
        returned = String(await port.understand(U_REQUEST));
      } catch (error) {
        thrown = seen(error);
      }
      expect(thrown).not.toContain(KEY);
      expect(returned).not.toContain(KEY);
      expect(seen(records)).not.toContain(KEY);
      expect(seen(records)).not.toContain('Should I buy');
      expectKeyOnlyInHeader(fake.calls);
      expectConsoleSilent();
    }
  );

  it.each(HOSTILE)('the intake wrapper’s error: %s', async (_name, handler) => {
    const fake = fetchFake(handler);
    const port = createModelUnderstandPort(
      { apiKey: KEY, model: 'vendor-a/fast-one' },
      fake.fetch
    );
    let thrown = '';
    try {
      await port.understand(U_REQUEST);
    } catch (error) {
      thrown = seen(error);
    }
    expect(thrown).not.toContain(KEY);
    expect(thrown).not.toContain('Should I buy');
    expectKeyOnlyInHeader(fake.calls);
    expectConsoleSilent();
  });

  it('refuses an answer that carries the key, as a bad response, instead of passing it on', async () => {
    for (const [name, handler] of HOSTILE.slice(8, 13)) {
      const fake = fetchFake(handler);
      const result = await callOpenRouter({ apiKey: KEY }, TARGET, request(), {
        fetchImpl: fake.fetch,
      });
      expect({
        name,
        ok: result.ok,
        code: result.ok ? null : result.code,
        attempts: result.attempts,
        calls: fake.calls.length,
      }).toEqual({
        name,
        ok: false,
        code: 'BAD_RESPONSE',
        // the same request would come back the same way: no retry
        attempts: 1,
        calls: 1,
      });
    }
  });

  it('does not put the key into a failure that never reached the network', async () => {
    const results = await Promise.all([
      callOpenRouter(
        { apiKey: KEY, baseUrl: 'http://evil.example.com' },
        TARGET,
        request()
      ),
      callOpenRouter({ apiKey: KEY }, TARGET, request({ messages: [] })),
      callOpenRouter(
        { apiKey: KEY },
        target({ vision: false }),
        request({
          messages: [
            {
              role: 'user',
              content: [{ type: 'image', url: 'https://c.example.com/a.png' }],
            },
          ],
        })
      ),
      callOpenRouter(null, TARGET, request()),
    ]);
    expect(seen(results)).not.toContain(KEY);
  });

  it('has a configuration that holds the key only as `apiKey`, and a result that has no such field', async () => {
    const fake = fetchFake(() => completion('{"a":1}'));
    const result = await callOpenRouter({ apiKey: KEY }, TARGET, request(), {
      fetchImpl: fake.fetch,
    });
    expect(JSON.stringify(result)).not.toMatch(
      /apiKey|api_key|authorization|bearer/i
    );
  });
});
