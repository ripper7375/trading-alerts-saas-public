/**
 * @jest-environment node
 */

/**
 * The Understand adapter on the gateway core (build step 7 part 3; ADR-098 D4): the call it makes
 * (the same as step 6's), the usage hook the quota ledger collects, and that it rejects with a
 * code. The step 6 suite (`__tests__/lib/intake/text/understand-model.test.ts`) holds the wrapper
 * in the intake path to its old behaviour; this holds the new core.
 */

import { buildUnderstandRequest } from '@/lib/intake';
import { DEFAULT_CALIBRATION } from '@/lib/reply/context/tokens';
import {
  DEFAULT_UNDERSTAND_BASE_URL,
  UNDERSTAND_MAX_RESPONSE_CHARS,
  UNDERSTAND_MAX_TOKENS,
  UNDERSTAND_RETRIES,
  UNDERSTAND_TIMEOUT_MS,
  GatewayError,
  createGatewayUnderstandPort,
  understandConfigFromEnv,
  understandTarget,
  type UnderstandCallRecord,
  type UnderstandGatewayConfig,
} from '@/lib/reply/gateway/understand-adapter';
import { loadRegistry } from '@/lib/reply/gateway/registry';

import {
  KEY,
  completion,
  fetchFake,
  registryRow,
  type Handler,
} from './helpers/gateway-fixtures';

const MODEL = 'vendor-a/fast-one';
const CONFIG: UnderstandGatewayConfig = { apiKey: KEY, model: MODEL };
const QUESTION = 'Should I buy gold now?';
const REQUEST = buildUnderstandRequest(QUESTION, []);
const RESULT = JSON.stringify({
  schema: 'understand-result/1',
  language: 'en',
});

function setup(
  handler: Handler,
  config: UnderstandGatewayConfig | null = CONFIG
) {
  const fake = fetchFake(handler);
  const records: UnderstandCallRecord[] = [];
  const port = createGatewayUnderstandPort(config, fake.fetch, {
    onCall: (record) => records.push(record),
  });
  return { ...fake, port, records };
}

async function code(promise: Promise<unknown>): Promise<string> {
  try {
    await promise;
  } catch (error) {
    expect(error).toBeInstanceOf(GatewayError);
    return (error as GatewayError).code;
  }
  throw new Error('the port did not reject');
}

describe('the fixed terms of the call (ADR-098 D4)', () => {
  it('are a second an attempt, one retry, 700 tokens and a 64 KiB reply', () => {
    expect(UNDERSTAND_TIMEOUT_MS).toBe(1_000);
    expect(UNDERSTAND_RETRIES).toBe(1);
    expect(UNDERSTAND_MAX_TOKENS).toBe(700);
    expect(UNDERSTAND_MAX_RESPONSE_CHARS).toBe(65_536);
    expect(DEFAULT_UNDERSTAND_BASE_URL).toBe('https://openrouter.ai/api/v1');
  });

  it('is a JSON object at temperature 0, privacy field and usage block on, question only in the user message', async () => {
    const { port, calls } = setup(() => completion(RESULT));
    await port.understand(REQUEST);
    const body = calls[0]!.body;
    expect(body).toEqual({
      model: MODEL,
      messages: [
        { role: 'system', content: REQUEST.system },
        { role: 'user', content: REQUEST.user },
      ],
      temperature: 0,
      max_tokens: 700,
      response_format: { type: 'json_object' },
      provider: { data_collection: 'deny' },
      usage: { include: true },
    });
    expect(body.messages[0].content).not.toContain(QUESTION);
    expect(JSON.parse(body.messages[1].content).question).toBe(QUESTION);
    expect(calls[0]!.headers['Authorization']).toBe(`Bearer ${KEY}`);
  });
});

describe('understandConfigFromEnv', () => {
  it('needs the key and the model', () => {
    expect(
      understandConfigFromEnv({
        OPENROUTER_API_KEY: KEY,
        INTAKE_UNDERSTAND_MODEL: ` ${MODEL} `,
      })
    ).toEqual({
      apiKey: KEY,
      model: MODEL,
    });
    expect(understandConfigFromEnv({ OPENROUTER_API_KEY: KEY })).toBeNull();
    expect(
      understandConfigFromEnv({ INTAKE_UNDERSTAND_MODEL: MODEL })
    ).toBeNull();
    expect(understandConfigFromEnv({})).toBeNull();
  });
});

describe('the model the environment names', () => {
  it('is called bare when it is not in the registry: no price, no allow-list, the default calibration', () => {
    expect(understandTarget(MODEL)).toEqual({
      slug: MODEL,
      vision: false,
      context_budget: 30_000,
      json_schema: false,
      prompt_caching: 'NONE',
      provider_only: null,
      price_in: null,
      price_out: null,
      calibration: DEFAULT_CALIBRATION,
      max_output_tokens: 700,
    });
  });

  it('takes its dated price, provider allow-list and calibration from the registry when it is there', () => {
    const registry = loadRegistry([
      registryRow({
        slug: MODEL,
        price_in: 0.1,
        price_out: 0.4,
        provider_only: ['Google'],
        calibration: { ...DEFAULT_CALIBRATION, marginBp: 2500 },
      }),
    ]);
    expect(understandTarget(MODEL, registry)).toMatchObject({
      slug: MODEL,
      price_in: 0.1,
      price_out: 0.4,
      provider_only: ['Google'],
      calibration: { marginBp: 2500 },
      // whatever the registry says of the model, this call is the Understand call
      max_output_tokens: 700,
      json_schema: false,
      vision: false,
      prompt_caching: 'NONE',
    });
  });

  it('sends the registry row’s allow-list with the call', async () => {
    // the shipped registry has no allow-list: provider.only is absent
    const { port, calls } = setup(() => completion(RESULT), {
      ...CONFIG,
      model: 'google/gemini-3.6-flash',
    });
    await port.understand(REQUEST);
    expect(calls[0]!.body.provider).toEqual({ data_collection: 'deny' });
  });
});

describe('the usage hook (what the quota ledger collects)', () => {
  it('is called once per call, after the last attempt, with the whole call and its usage', async () => {
    let n = 0;
    const { port, records } = setup(() =>
      (n += 1) === 1
        ? new Response('busy', { status: 503 })
        : completion(RESULT)
    );
    await expect(port.understand(REQUEST)).resolves.toBe(RESULT);
    expect(records).toHaveLength(1);
    expect(records[0]).toMatchObject({
      ok: true,
      model: MODEL,
      attempts: 2,
      usage: {
        prompt_tokens: 18_000,
        completion_tokens: 900,
        cost_micro_usd: 7650,
        cost_flag: null,
      },
    });
  });

  it('is called with the failure too, with its code and the attempts', async () => {
    const { port, records } = setup(() => new Response('no', { status: 503 }));
    expect(await code(port.understand(REQUEST))).toBe('HTTP_503');
    expect(records).toEqual([
      {
        ok: false,
        code: 'HTTP_503',
        model: MODEL,
        latency_ms: expect.any(Number),
        attempts: 2,
      },
    ]);
  });

  it('is called for a base URL it refuses (nothing was sent, so nothing is owed)', async () => {
    const { port, records, calls } = setup(() => completion(RESULT), {
      ...CONFIG,
      baseUrl: 'http://x.example.com',
    });
    expect(await code(port.understand(REQUEST))).toBe('URL_REFUSED');
    expect(records).toEqual([
      expect.objectContaining({ ok: false, code: 'URL_REFUSED', attempts: 0 }),
    ]);
    expect(calls).toHaveLength(0);
  });

  it('is not called when the adapter is not configured: no call was made', async () => {
    const { port, records, calls } = setup(() => completion(RESULT), null);
    expect(await code(port.understand(REQUEST))).toBe('NOT_CONFIGURED');
    expect(records).toHaveLength(0);
    expect(calls).toHaveLength(0);
  });

  it('carries no word of the question: the record is numbers and a model name', async () => {
    const { port, records } = setup(() => completion(RESULT));
    await port.understand(REQUEST);
    const shown = JSON.stringify(records);
    expect(shown).not.toContain('Should I buy');
    expect(shown).not.toContain(REQUEST.system.slice(0, 40));
    expect(shown).not.toContain(KEY);
  });

  it('works without a hook', async () => {
    const fake = fetchFake(() => completion(RESULT));
    const port = createGatewayUnderstandPort(CONFIG, fake.fetch);
    await expect(port.understand(REQUEST)).resolves.toBe(RESULT);
  });

  it('lets a hook that throws fail the call loudly: a paid call is never left uncounted', async () => {
    const fake = fetchFake(() => completion(RESULT));
    const port = createGatewayUnderstandPort(CONFIG, fake.fetch, {
      onCall: () => {
        throw new Error('ledger down');
      },
    });
    await expect(port.understand(REQUEST)).rejects.toThrow('ledger down');
  });

  it('uses the clock it is given for the latency', async () => {
    const ticks = [10, 60];
    let i = 0;
    const fake = fetchFake(() => completion(RESULT));
    const records: UnderstandCallRecord[] = [];
    const port = createGatewayUnderstandPort(CONFIG, fake.fetch, {
      onCall: (r) => records.push(r),
      now: () => ticks[Math.min(i++, ticks.length - 1)]!,
    });
    await port.understand(REQUEST);
    expect(records[0]).toMatchObject({ ok: true, latency_ms: 50 });
  });
});

describe('what the port rejects with', () => {
  it('is a GatewayError with a code, a fixed message, and nothing else', async () => {
    const { port } = setup(
      () => new Response(`${KEY} ${QUESTION}`, { status: 500 })
    );
    try {
      await port.understand(REQUEST);
      throw new Error('did not reject');
    } catch (error) {
      expect(error).toBeInstanceOf(GatewayError);
      expect((error as GatewayError).message).toBe(
        'the model gateway call failed: HTTP_500'
      );
      expect((error as Error).name).toBe('GatewayError');
      // its own fields are its code and its name: no cause, no response, no request
      expect(Object.keys(error as object).sort()).toEqual(['code', 'name']);
    }
  });

  it('honours the configured wait and retries', async () => {
    const { port, calls } = setup(() => new Response('busy', { status: 503 }), {
      ...CONFIG,
      retries: 0,
    });
    expect(await code(port.understand(REQUEST))).toBe('HTTP_503');
    expect(calls).toHaveLength(1);
    const two = setup(() => new Response('busy', { status: 503 }), {
      ...CONFIG,
      retries: 2,
    });
    expect(await code(two.port.understand(REQUEST))).toBe('HTTP_503');
    expect(two.calls).toHaveLength(3);
  });

  it('reads a reply of exactly 64 KiB and refuses one character more', async () => {
    const shell = JSON.stringify({
      choices: [{ message: { content: '' } }],
    }).length;
    const sized = (total: number): string =>
      JSON.stringify({
        choices: [{ message: { content: 'x'.repeat(total - shell) } }],
      });
    const at = setup(
      () => new Response(sized(UNDERSTAND_MAX_RESPONSE_CHARS), { status: 200 })
    );
    await expect(at.port.understand(REQUEST)).resolves.toHaveLength(
      UNDERSTAND_MAX_RESPONSE_CHARS - shell
    );
    const over = setup(
      () =>
        new Response(sized(UNDERSTAND_MAX_RESPONSE_CHARS + 1), { status: 200 })
    );
    expect(await code(over.port.understand(REQUEST))).toBe(
      'RESPONSE_TOO_LARGE'
    );
  });
});
