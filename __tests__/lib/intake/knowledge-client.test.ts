/**
 * @jest-environment node
 */

/**
 * The client of the knowledge service (build step 6 part 5; architecture 4.7 and 7.6): what it
 * sends, what it believes, and that every failure is an UNAVAILABLE pack with a code and never
 * an exception, a leaked key or a packet the validator would refuse.
 */

import {
  KNOWLEDGE_KEY_HEADER,
  KNOWLEDGE_MAX_RESPONSE_CHARS,
  KNOWLEDGE_SEARCH_SCHEMA,
  KNOWLEDGE_TIMEOUT_MS,
  createKnowledgeClient,
  knowledgeConfigFromEnv,
  searchEndpoint,
  unavailableKnowledge,
  type KnowledgeRequest,
} from '@/lib/intake/knowledge-client';

import { sampleChunk } from './helpers/ports';

const REQUEST: KnowledgeRequest = {
  intent: 'DIRECTION',
  question_en: 'Should I buy gold now',
  m_star: ['MCD1', 'MCD3'],
  state_codes: ['MCD1_UP_IN_CORRIDOR'],
  routing_version: 'routing-v1',
};
const KEY = 'sk-test-knowledge-key-9f3a';
const URL = 'https://knowledge.example.internal';

type Handler = (
  input: string,
  init: RequestInit
) => Promise<Response> | Response;

function fetchFake(handler: Handler): {
  fetch: (input: string, init: RequestInit) => Promise<Response>;
  calls: { url: string; init: RequestInit }[];
} {
  const calls: { url: string; init: RequestInit }[] = [];
  return {
    calls,
    fetch: async (url, init) => {
      calls.push({ url, init });
      return handler(url, init);
    },
  };
}

const json = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

const pack = (over: Record<string, unknown> = {}): Record<string, unknown> => ({
  status: 'OK',
  index_build_id: 'build-0001',
  chunks: [sampleChunk()],
  expansions: [],
  ...over,
});

const client = (handler: Handler, timeoutMs?: number) => {
  const fake = fetchFake(handler);
  return {
    ...fake,
    port: createKnowledgeClient(
      { url: URL, key: KEY, ...(timeoutMs === undefined ? {} : { timeoutMs }) },
      fake.fetch
    ),
  };
};

describe('knowledgeConfigFromEnv', () => {
  it('needs both the URL and the key', () => {
    expect(
      knowledgeConfigFromEnv({
        KNOWLEDGE_SERVICE_URL: URL,
        KNOWLEDGE_SERVICE_KEY: KEY,
      })
    ).toEqual({ url: URL, key: KEY });
  });

  it.each([
    [{}],
    [{ KNOWLEDGE_SERVICE_URL: URL }],
    [{ KNOWLEDGE_SERVICE_KEY: KEY }],
    [{ KNOWLEDGE_SERVICE_URL: '', KNOWLEDGE_SERVICE_KEY: KEY }],
    [{ KNOWLEDGE_SERVICE_URL: '   ', KNOWLEDGE_SERVICE_KEY: KEY }],
    [{ KNOWLEDGE_SERVICE_URL: URL, KNOWLEDGE_SERVICE_KEY: '' }],
  ])('is not configured with %j', (env) => {
    expect(knowledgeConfigFromEnv(env)).toBeNull();
  });

  it('trims the URL and leaves the key as it is', () => {
    expect(
      knowledgeConfigFromEnv({
        KNOWLEDGE_SERVICE_URL: `  ${URL}  `,
        KNOWLEDGE_SERVICE_KEY: ` ${KEY} `,
      })
    ).toEqual({ url: URL, key: ` ${KEY} ` });
  });
});

describe('searchEndpoint', () => {
  it.each([
    ['https://k.example.com', 'https://k.example.com/search'],
    ['https://k.example.com/', 'https://k.example.com/search'],
    ['https://k.example.com///', 'https://k.example.com/search'],
    ['https://k.example.com/api/v1', 'https://k.example.com/api/v1/search'],
    ['https://k.example.com/api/', 'https://k.example.com/api/search'],
    ['https://k.example.com:8443', 'https://k.example.com:8443/search'],
    [
      'https://k.example.com/x?token=abc#frag',
      'https://k.example.com/x/search',
    ],
    ['http://localhost:8000', 'http://localhost:8000/search'],
    ['http://127.0.0.1:8000/', 'http://127.0.0.1:8000/search'],
    ['http://[::1]:8000', 'http://[::1]:8000/search'],
  ])('%s -> %s', (base, expected) => {
    expect(searchEndpoint(base)?.toString()).toBe(expected);
  });

  it.each([
    'not a url',
    '',
    'ftp://k.example.com',
    'file:///etc/passwd',
    'javascript:alert(1)',
    'http://k.example.com',
    'http://localhost.evil.com',
    'http://127.0.0.1.evil.com',
    'https://user@k.example.com',
    'https://user:pass@k.example.com',
    'http://user:pass@localhost',
  ])('refuses %s', (base) => {
    expect(searchEndpoint(base)).toBeNull();
  });
});

describe('createKnowledgeClient: what it sends', () => {
  it('posts the search to /search with the key in a header and the request as JSON', async () => {
    const { port, calls } = client(() => json(pack()));
    await port.search(REQUEST);
    expect(calls).toHaveLength(1);
    const { url, init } = calls[0] as (typeof calls)[number];
    expect(url).toBe('https://knowledge.example.internal/search');
    expect(init.method).toBe('POST');
    const headers = init.headers as Record<string, string>;
    expect(headers[KNOWLEDGE_KEY_HEADER]).toBe(KEY);
    expect(headers['Content-Type']).toBe('application/json');
    expect(headers['Accept']).toBe('application/json');
    expect(JSON.parse(init.body as string)).toEqual({
      schema: KNOWLEDGE_SEARCH_SCHEMA,
      intent: 'DIRECTION',
      question_en: 'Should I buy gold now',
      m_star: ['MCD1', 'MCD3'],
      state_codes: ['MCD1_UP_IN_CORRIDOR'],
      routing_version: 'routing-v1',
    });
  });

  it('never puts the key in the URL or the body, and never follows a redirect', async () => {
    const { port, calls } = client(() => json(pack()));
    await port.search(REQUEST);
    const { url, init } = calls[0] as (typeof calls)[number];
    expect(url).not.toContain(KEY);
    expect(init.body as string).not.toContain(KEY);
    expect(init.redirect).toBe('error');
    expect(init.cache).toBe('no-store');
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });

  it('sends nothing else the request did not hold, however the request object grew', async () => {
    const { port, calls } = client(() => json(pack()));
    await port.search({
      ...REQUEST,
      extra: 'secret',
      equity: '10000',
    } as KnowledgeRequest);
    const body = JSON.parse(
      (calls[0] as (typeof calls)[number]).init.body as string
    );
    expect(Object.keys(body).sort()).toEqual([
      'intent',
      'm_star',
      'question_en',
      'routing_version',
      'schema',
      'state_codes',
    ]);
  });

  it('the name of the header is the one part 6 reads', () => {
    expect(KNOWLEDGE_KEY_HEADER).toBe('x-knowledge-service-key');
    expect(KNOWLEDGE_SEARCH_SCHEMA).toBe('knowledge-search/1');
  });
});

describe('createKnowledgeClient: what it believes', () => {
  it('returns a good pack as it came, with no problem', async () => {
    const body = pack({ expansions: [sampleChunk('D2-X')] });
    const { port } = client(() => json(body));
    await expect(port.search(REQUEST)).resolves.toEqual({
      knowledge: body,
      problems: [],
    });
  });

  it('returns an EMPTY pack, which names its build', async () => {
    const body = pack({ status: 'EMPTY', chunks: [] });
    const { port } = client(() => json(body));
    await expect(port.search(REQUEST)).resolves.toEqual({
      knowledge: body,
      problems: [],
    });
  });

  it('notes it when the service itself says its index is unavailable', async () => {
    const body = pack({
      status: 'UNAVAILABLE',
      index_build_id: null,
      chunks: [],
    });
    const { port } = client(() => json(body));
    await expect(port.search(REQUEST)).resolves.toEqual({
      knowledge: body,
      problems: ['KNOWLEDGE_INDEX_UNAVAILABLE'],
    });
  });

  it.each([
    ['an extra key on the pack', pack({ extra: 1 })],
    ['an unknown status', pack({ status: 'MAYBE' })],
    ['OK with no chunk', pack({ chunks: [] })],
    ['OK with no build id', pack({ index_build_id: null })],
    [
      'an UNAVAILABLE pack that names a build',
      pack({ status: 'UNAVAILABLE', chunks: [] }),
    ],
    [
      'five chunks',
      pack({ chunks: [1, 2, 3, 4, 5].map((n) => sampleChunk(`C${n}`)) }),
    ],
    [
      'nine expansions',
      pack({
        expansions: [1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) =>
          sampleChunk(`E${n}`)
        ),
      }),
    ],
    [
      'a chunk with an extra key',
      pack({ chunks: [{ ...sampleChunk(), score: 0.9 }] }),
    ],
    [
      'a chunk with an unknown domain',
      pack({ chunks: [{ ...sampleChunk(), domain: 'D9' }] }),
    ],
    [
      'a chunk id twice',
      pack({ chunks: [sampleChunk('A'), sampleChunk('A')] }),
    ],
    [
      'a chunk over 4,000 characters',
      pack({ chunks: [{ ...sampleChunk(), text: 'x'.repeat(4001) }] }),
    ],
    ['null', null],
    ['a list', []],
    ['a string', 'ok'],
  ])(
    'refuses %s as a bad shape and gives an unavailable pack',
    async (_name, body) => {
      const { port } = client(() => json(body));
      await expect(port.search(REQUEST)).resolves.toEqual({
        knowledge: unavailableKnowledge(),
        problems: ['KNOWLEDGE_BAD_SHAPE'],
      });
    }
  );

  it('refuses an answer that is not JSON', async () => {
    const { port } = client(
      () => new Response('<html>oops</html>', { status: 200 })
    );
    await expect(port.search(REQUEST)).resolves.toEqual({
      knowledge: unavailableKnowledge(),
      problems: ['KNOWLEDGE_BAD_JSON'],
    });
  });

  it('refuses an answer that is too large, by its header and by its text', async () => {
    const big = JSON.stringify(
      pack({ pad: 'x'.repeat(KNOWLEDGE_MAX_RESPONSE_CHARS) })
    );
    const { port } = client(() => new Response(big, { status: 200 }));
    await expect(port.search(REQUEST)).resolves.toEqual({
      knowledge: unavailableKnowledge(),
      problems: ['KNOWLEDGE_RESPONSE_TOO_LARGE'],
    });
    const declared = client(
      () =>
        new Response('{}', {
          status: 200,
          headers: {
            'content-length': String(KNOWLEDGE_MAX_RESPONSE_CHARS + 1),
          },
        })
    );
    await expect(declared.port.search(REQUEST)).resolves.toEqual({
      knowledge: unavailableKnowledge(),
      problems: ['KNOWLEDGE_RESPONSE_TOO_LARGE'],
    });
  });

  it('reads an answer of exactly the limit', async () => {
    const body = JSON.stringify(pack());
    expect(body.length).toBeLessThan(KNOWLEDGE_MAX_RESPONSE_CHARS);
    const padded =
      body.slice(0, -1) +
      ' '.repeat(KNOWLEDGE_MAX_RESPONSE_CHARS - body.length) +
      '}';
    expect(padded.length).toBe(KNOWLEDGE_MAX_RESPONSE_CHARS);
    const { port } = client(() => new Response(padded, { status: 200 }));
    const result = await port.search(REQUEST);
    expect(result.knowledge.status).toBe('OK');
  });

  it('has a limit of 256 KiB, a declared size of exactly that is read, and a header that is not a size is not one', async () => {
    expect(KNOWLEDGE_MAX_RESPONSE_CHARS).toBe(262_144);
    for (const declared of [
      String(KNOWLEDGE_MAX_RESPONSE_CHARS),
      '1e9',
      '0x100000',
      '999999999x',
      'x999999999',
      '-1',
    ]) {
      const { port } = client(
        () =>
          new Response(JSON.stringify(pack()), {
            status: 200,
            headers: { 'content-length': declared },
          })
      );
      const result = await port.search(REQUEST);
      expect({ declared, status: result.knowledge.status }).toEqual({
        declared,
        status: 'OK',
      });
    }
  });
});

describe('createKnowledgeClient: when it cannot', () => {
  it('is not configured: an unavailable pack and nothing sent', async () => {
    const fake = fetchFake(() => json(pack()));
    const port = createKnowledgeClient(null, fake.fetch);
    await expect(port.search(REQUEST)).resolves.toEqual({
      knowledge: unavailableKnowledge(),
      problems: ['KNOWLEDGE_NOT_CONFIGURED'],
    });
    expect(fake.calls).toHaveLength(0);
  });

  it('has a URL it will not call: an unavailable pack and nothing sent', async () => {
    const fake = fetchFake(() => json(pack()));
    for (const url of ['http://knowledge.example.com', 'ftp://x', 'nonsense']) {
      const port = createKnowledgeClient({ url, key: KEY }, fake.fetch);
      await expect(port.search(REQUEST)).resolves.toEqual({
        knowledge: unavailableKnowledge(),
        problems: ['KNOWLEDGE_URL_REFUSED'],
      });
    }
    expect(fake.calls).toHaveLength(0);
  });

  it.each([400, 401, 403, 404, 429, 500, 502, 503])(
    'answers HTTP %i with the status as a code',
    async (status) => {
      const { port } = client(() =>
        json({ error: 'INDEX_UNAVAILABLE' }, status)
      );
      await expect(port.search(REQUEST)).resolves.toEqual({
        knowledge: unavailableKnowledge(),
        problems: [`KNOWLEDGE_HTTP_${status}`],
      });
    }
  );

  it('cannot reach the service', async () => {
    const { port } = client(() => {
      throw new TypeError('fetch failed');
    });
    await expect(port.search(REQUEST)).resolves.toEqual({
      knowledge: unavailableKnowledge(),
      problems: ['KNOWLEDGE_UNREACHABLE'],
    });
  });

  it('a redirect, which fetch refuses to follow, is an unreachable service', async () => {
    const { port } = client(() => {
      throw new TypeError('fetch failed: redirect mode is set to error');
    });
    const result = await port.search(REQUEST);
    expect(result.problems).toEqual(['KNOWLEDGE_UNREACHABLE']);
  });

  it('never throws, whatever the fetch does', async () => {
    for (const thrown of [
      new Error('x'),
      'text',
      null,
      undefined,
      42,
      { name: 'Odd' },
    ]) {
      const { port } = client(() => Promise.reject(thrown));
      const result = await port.search(REQUEST);
      expect(result.knowledge.status).toBe('UNAVAILABLE');
      expect(result.problems).toEqual(['KNOWLEDGE_UNREACHABLE']);
    }
  });

  it('never lets the key into a problem, a pack or a thrown message', async () => {
    const outcomes = [
      await client(() => json({}, 500)).port.search(REQUEST),
      await client(() => {
        throw new Error(`failed with ${KEY}`);
      }).port.search(REQUEST),
      await client(() => json(pack({ status: 'MAYBE' }))).port.search(REQUEST),
      await client(() => new Response('nope')).port.search(REQUEST),
    ];
    for (const outcome of outcomes) {
      expect(JSON.stringify(outcome)).not.toContain(KEY);
    }
  });
});

describe('createKnowledgeClient: the wait', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  /** a fetch that never answers on its own and fails when its signal is aborted */
  const hanging: Handler = (_url, init) =>
    new Promise((_resolve, reject) => {
      (init.signal as AbortSignal).addEventListener('abort', () =>
        reject(
          Object.assign(new Error('The operation was aborted'), {
            name: 'AbortError',
          })
        )
      );
    });

  it('waits two seconds by default and then gives up', async () => {
    expect(KNOWLEDGE_TIMEOUT_MS).toBe(2_000);
    const { port } = client(hanging);
    const pending = port.search(REQUEST);
    await jest.advanceTimersByTimeAsync(KNOWLEDGE_TIMEOUT_MS - 1);
    let settled = false;
    void pending.then(() => {
      settled = true;
    });
    await Promise.resolve();
    expect(settled).toBe(false);
    await jest.advanceTimersByTimeAsync(1);
    await expect(pending).resolves.toEqual({
      knowledge: unavailableKnowledge(),
      problems: ['KNOWLEDGE_TIMEOUT'],
    });
  });

  it('waits as long as the configuration says', async () => {
    const { port } = client(hanging, 250);
    const pending = port.search(REQUEST);
    await jest.advanceTimersByTimeAsync(250);
    await expect(pending).resolves.toMatchObject({
      problems: ['KNOWLEDGE_TIMEOUT'],
    });
  });

  it('also gives up on an answer that starts and never finishes', async () => {
    const { port } = client((_url, init) => {
      const signal = init.signal as AbortSignal;
      return {
        ok: true,
        status: 200,
        headers: new Headers(),
        text: () =>
          new Promise<string>((_resolve, reject) =>
            signal.addEventListener('abort', () =>
              reject(
                Object.assign(new Error('aborted'), { name: 'AbortError' })
              )
            )
          ),
      } as unknown as Response;
    }, 100);
    const pending = port.search(REQUEST);
    await jest.advanceTimersByTimeAsync(100);
    await expect(pending).resolves.toMatchObject({
      problems: ['KNOWLEDGE_TIMEOUT'],
    });
  });

  it('leaves no timer behind after an answer, an error or a timeout', async () => {
    await client(() => json(pack())).port.search(REQUEST);
    expect(jest.getTimerCount()).toBe(0);
    await client(() => json({}, 503)).port.search(REQUEST);
    expect(jest.getTimerCount()).toBe(0);
    await client(() => {
      throw new Error('x');
    }).port.search(REQUEST);
    expect(jest.getTimerCount()).toBe(0);
    const { port } = client(hanging, 50);
    const pending = port.search(REQUEST);
    await jest.advanceTimersByTimeAsync(50);
    await pending;
    expect(jest.getTimerCount()).toBe(0);
  });

  it('does not abort a service that answers in time', async () => {
    const { port, calls } = client(async () => json(pack()), 500);
    const pending = port.search(REQUEST);
    await jest.advanceTimersByTimeAsync(499);
    await expect(pending).resolves.toMatchObject({ problems: [] });
    expect((calls[0]?.init.signal as AbortSignal).aborted).toBe(false);
  });
});
