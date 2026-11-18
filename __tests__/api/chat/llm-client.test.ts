/**
 * @jest-environment node
 */
/**
 * Chat bot LLM client request bounds
 * (infra/contabo-chat-stack/apps/bot-worker/src/llmClient.ts).
 *
 * One message must not be able to buy an unbounded reply: both providers get
 * the same output-token cap. The module reads its settings when it is imported,
 * so each test loads a fresh copy; the provider call is a mocked fetch.
 */
type LlmClient =
  typeof import('../../../infra/contabo-chat-stack/apps/bot-worker/src/llmClient');

const env = process.env as Record<string, string | undefined>;
const SAVED = {
  LLM_PROVIDER: env['LLM_PROVIDER'],
  LLM_API_KEY: env['LLM_API_KEY'],
  LLM_MODEL: env['LLM_MODEL'],
};
const originalFetch = global.fetch;

function loadClient(provider: 'gemini' | 'claude'): LlmClient {
  env['LLM_PROVIDER'] = provider;
  env['LLM_API_KEY'] = 'test-llm-key';
  env['LLM_MODEL'] = 'test-model';
  let loaded: LlmClient | undefined;
  jest.isolateModules(() => {
    loaded = require('../../../infra/contabo-chat-stack/apps/bot-worker/src/llmClient');
  });
  return loaded as LlmClient;
}

function mockFetchReturning(body: unknown): jest.Mock {
  const fetchMock = jest.fn().mockResolvedValue({
    ok: true,
    json: async () => body,
    text: async () => '',
  });
  global.fetch = fetchMock as unknown as typeof fetch;
  return fetchMock;
}

function requestBody(fetchMock: jest.Mock): Record<string, unknown> {
  const init = fetchMock.mock.calls[0]![1] as { body: string };
  return JSON.parse(init.body) as Record<string, unknown>;
}

afterEach(() => {
  global.fetch = originalFetch;
  for (const [name, value] of Object.entries(SAVED)) {
    if (value === undefined) delete env[name];
    else env[name] = value;
  }
});

describe('getLlmReply', () => {
  it('caps a Gemini reply at 1,024 output tokens', async () => {
    const fetchMock = mockFetchReturning({
      candidates: [{ content: { parts: [{ text: 'hello' }] } }],
    });
    const { getLlmReply } = loadClient('gemini');

    await expect(getLlmReply('hi there')).resolves.toBe('hello');

    expect(String(fetchMock.mock.calls[0]![0])).toContain(
      'generativelanguage.googleapis.com'
    );
    const body = requestBody(fetchMock);
    expect(body['generationConfig']).toEqual({ maxOutputTokens: 1024 });
    expect(body['contents']).toEqual([
      { role: 'user', parts: [{ text: 'hi there' }] },
    ]);
  });

  it('caps a Claude reply at the same 1,024 output tokens', async () => {
    const fetchMock = mockFetchReturning({ content: [{ text: 'hello' }] });
    const { getLlmReply } = loadClient('claude');

    await expect(getLlmReply('hi there')).resolves.toBe('hello');

    expect(String(fetchMock.mock.calls[0]![0])).toContain('api.anthropic.com');
    const body = requestBody(fetchMock);
    expect(body['max_tokens']).toBe(1024);
    expect(body['messages']).toEqual([{ role: 'user', content: 'hi there' }]);
  });
});
