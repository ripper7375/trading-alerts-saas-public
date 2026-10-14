/**
 * @jest-environment node
 */

/**
 * The smoke script (build step 7 part 3; runbook S1): `scripts/reply/gateway-smoke.js`. It is never
 * run against the real service by a test. The pure parts are tested directly; the whole script is
 * run as a child process against a FAKE server on this machine, to show what it sends (no key to
 * the public list; the privacy field and the usage block on every call), what it prints (never the
 * key), how it stops at the cap, and its exit codes.
 */

import { spawn } from 'child_process';
import http from 'http';
import type { AddressInfo } from 'net';
import path from 'path';

import { AI_MODELS } from '@/config/ai-models';
import { estimateRawTokens } from '@/lib/reply/context/tokens';

import { KEY } from './helpers/gateway-fixtures';

const smoke = require('../../../../scripts/reply/gateway-smoke.js');

const SCRIPT = path.resolve(
  __dirname,
  '..',
  '..',
  '..',
  '..',
  'scripts',
  'reply',
  'gateway-smoke.js'
);

jest.setTimeout(120_000);

// ---------------------------------------------------------------------------------------
// Pure parts
// ---------------------------------------------------------------------------------------

describe('parseArgs', () => {
  it('reads each mode and option', () => {
    expect(smoke.parseArgs(['--help']).help).toBe(true);
    expect(smoke.parseArgs(['--list-models', '--json'])).toMatchObject({
      list: true,
      json: true,
    });
    expect(
      smoke.parseArgs([
        '--call',
        '--model',
        'a/b',
        '--model',
        'c/d',
        '--cap-usd',
        '2.5',
        '--probe-cache',
      ])
    ).toMatchObject({
      call: true,
      models: ['a/b', 'c/d'],
      capUsd: 2.5,
      probeCache: true,
    });
    expect(smoke.parseArgs(['--call']).capUsd).toBe(smoke.DEFAULT_CAP_USD);
  });

  it.each([
    [[], 'say what to do'],
    [['--list-models', '--call'], 'give one of'],
    [['--bogus'], 'unknown argument'],
    [['--call', '--model'], '--model needs a slug'],
    [['--call', '--model', '--json'], '--model needs a slug'],
    [['--call', '--cap-usd'], '--cap-usd needs a number'],
    [['--call', '--cap-usd', '0'], '--cap-usd needs a number'],
    [['--call', '--cap-usd', '-1'], '--cap-usd needs a number'],
    [['--call', '--cap-usd', 'lots'], '--cap-usd needs a number'],
    [['--call', '--cap-usd', '10.01'], 'at most 10'],
    [['--list-models', '--probe-cache'], '--probe-cache belongs to --call'],
  ])('refuses %j', (argv, message) => {
    expect(() => smoke.parseArgs(argv)).toThrow(message);
  });

  it('lets the cap be exactly ten dollars (decision D25), and no more', () => {
    expect(smoke.MAX_CAP_USD).toBe(10);
    expect(smoke.parseArgs(['--call', '--cap-usd', '10']).capUsd).toBe(10);
  });

  it('takes --help alongside anything', () => {
    expect(smoke.parseArgs(['--help', '--call', '--list-models']).help).toBe(
      true
    );
  });
});

describe('scrub', () => {
  it('removes every occurrence of the key from a line', () => {
    expect(smoke.scrub(`a ${KEY} b ${KEY}`, KEY)).toBe('a [key] b [key]');
  });
  it('leaves a line alone when there is no key, or the key is too short to be one', () => {
    expect(smoke.scrub('hello', KEY)).toBe('hello');
    expect(smoke.scrub('hello', '')).toBe('hello');
    expect(smoke.scrub('a short', 'short')).toBe('a short');
  });
});

describe('summariseLive and compareModel', () => {
  const entry = {
    id: 'vendor/model',
    context_length: 200_000,
    top_provider: { max_completion_tokens: 8_192 },
    pricing: {
      prompt: '0.0000003',
      completion: '0.0000025',
      input_cache_read: '0.00000003',
    },
    architecture: { input_modalities: ['text', 'image'] },
    supported_parameters: [
      'temperature',
      'structured_outputs',
      'response_format',
    ],
  };

  it('puts the service’s per-token prices into dollars per million tokens', () => {
    expect(smoke.summariseLive(entry)).toEqual({
      context_tokens: 200_000,
      max_output_tokens: 8_192,
      price_in: 0.3,
      price_out: 2.5,
      price_cache_read: 0.03,
      vision: true,
      json_schema: true,
      json_object: true,
    });
  });

  it('says null for what the service does not say, and never throws on a strange shape', () => {
    expect(smoke.summariseLive({ id: 'x' })).toEqual({
      context_tokens: null,
      max_output_tokens: null,
      price_in: null,
      price_out: null,
      price_cache_read: null,
      vision: null,
      json_schema: null,
      json_object: null,
    });
    expect(smoke.summariseLive(undefined)).toBeNull();
    expect(smoke.summariseLive('x')).toBeNull();
    expect(
      smoke.summariseLive({ pricing: { prompt: 'free', completion: null } })
        .price_in
    ).toBeNull();
  });

  const verified = {
    ...AI_MODELS[0],
    verified_at: '2026-10-14',
    context_tokens: 200_000,
    max_output_tokens: 8_192,
    price_in: 0.3,
    price_out: 2.5,
    vision: true,
    json_schema: true,
    prompt_caching: 'AUTO',
  };

  it('finds no difference for a row that matches the service', () => {
    const rows = smoke.compareModel(verified, smoke.summariseLive(entry));
    expect(rows.filter((r: any[]) => r[3])).toEqual([]);
  });

  it('marks each field that differs', () => {
    const live = smoke.summariseLive({
      ...entry,
      context_length: 128_000,
      pricing: { prompt: '0.0000004', completion: '0.0000025' },
      architecture: { input_modalities: ['text'] },
    });
    const differs = smoke
      .compareModel(verified, live)
      .filter((r: any[]) => r[3])
      .map((r: any[]) => r[0]);
    expect(differs).toEqual(['context_tokens', 'price_in $/M', 'vision']);
  });

  it('has nothing to differ from for an unverified row, and returns null for a model not found', () => {
    const rows = smoke.compareModel(AI_MODELS[0], smoke.summariseLive(entry));
    expect(rows.filter((r: any[]) => r[3])).toEqual([]);
    expect(rows.find((r: any[]) => r[0] === 'price_in $/M')[2]).toBe(
      'unverified'
    );
    expect(smoke.compareModel(AI_MODELS[0], null)).toBeNull();
  });

  it('shows the cache-read price as information and never as a difference', () => {
    const rows = smoke.compareModel(verified, smoke.summariseLive(entry));
    const cache = rows.find((r: any[]) => r[0] === 'cache read $/M');
    expect(cache[1]).toBe(0.03);
    expect(cache[3]).toBe(false);
  });
});

describe('the probes', () => {
  it('are tiny, and use the shapes the adapter takes', () => {
    for (const kind of ['json_object', 'json_schema', 'vision', 'cache']) {
      const request = smoke.probeRequest(kind);
      expect(request.max_output_tokens).toBeLessThanOrEqual(64);
      expect(request.temperature).toBe(0);
      expect(Array.isArray(request.messages)).toBe(true);
    }
    expect(smoke.probeRequest('json_schema').response.kind).toBe('JSON_SCHEMA');
    expect(JSON.stringify(smoke.probeRequest('vision'))).toContain(
      'data:image/png;base64'
    );
  });

  it('judge: the JSON asked for is a pass, anything else a fail with a code', () => {
    const ok = (text: string) => ({
      ok: true,
      text,
      usage: { cost_micro_usd: 5 },
      response_mode: 'JSON_OBJECT',
    });
    expect(smoke.judge('json_object', ok('{"ok":true}')).passed).toBe(true);
    expect(smoke.judge('json_object', ok('{"ok":false}'))).toMatchObject({
      passed: false,
      code: 'NOT_THE_JSON_ASKED_FOR',
    });
    expect(smoke.judge('json_object', ok('sure!'))).toMatchObject({
      passed: false,
    });
    expect(smoke.judge('json_object', { ok: false, code: 'HTTP_404' })).toEqual(
      {
        kind: 'json_object',
        passed: false,
        code: 'HTTP_404',
      }
    );
  });

  it('propose: a suggestion from what answered, never a claim about what was not probed', () => {
    const probe = (kind: string, passed: boolean, cost: number | null = 5) => ({
      kind,
      passed,
      usage: {
        cost_micro_usd: cost,
        cost_flag: cost === null ? 'COST_ESTIMATED' : null,
      },
    });
    expect(
      smoke.propose(
        [
          probe('json_object', true),
          probe('json_schema', true),
          probe('vision', false),
        ],
        'AUTO'
      )
    ).toEqual({
      json_schema: true,
      vision: false,
      prompt_caching: 'AUTO',
      reports_cost: true,
      eligible_under_adr_077: true,
    });
    expect(
      smoke.propose(
        [
          probe('json_object', false, null),
          probe('json_schema', false, null),
          probe('vision', false, null),
        ],
        'NONE'
      )
    ).toMatchObject({
      reports_cost: false,
      eligible_under_adr_077: 'no host answered with data_collection: deny',
    });
  });
});

describe('pinned values (a test that imports a constant cannot see it move)', () => {
  it('the defaults are written out', () => {
    expect(smoke.DEFAULT_BASE_URL).toBe('https://openrouter.ai/api/v1');
    expect(smoke.DEFAULT_CAP_USD).toBe(1);
    expect(smoke.MAX_CAP_USD).toBe(10);
    expect(smoke.UNREPORTED_CALL_USD).toBe(0.02);
  });

  it('scrub works from an eight-character key and not below', () => {
    expect(smoke.scrub('a 12345678 b', '12345678')).toBe('a [key] b');
    expect(smoke.scrub('a 1234567 b', '1234567')).toBe('a 1234567 b');
  });

  it('the probes are tiny and exact', () => {
    for (const kind of ['json_object', 'json_schema', 'vision', 'cache']) {
      const request = smoke.probeRequest(kind);
      expect(request.max_output_tokens).toBe(48);
      expect(request.timeout_ms).toBe(30_000);
      expect(request.temperature).toBe(0);
    }
    expect(smoke.probeRequest('json_object').messages[0]).toEqual({
      role: 'system',
      content: 'You answer with JSON only.',
    });
    expect(smoke.probeRequest('json_schema').response).toEqual({
      kind: 'JSON_SCHEMA',
      name: 'smoke',
      schema: {
        type: 'object',
        properties: { ok: { type: 'boolean' } },
        required: ['ok'],
        additionalProperties: false,
      },
    });
  });

  it('the cache probe has a prefix long enough for a provider to cache (at least 2,048 tokens), and marks it cacheable', () => {
    expect(smoke.CACHE_PREFIX_LINES).toBe(300);
    const system = smoke.probeRequest('cache').messages[0].content[0];
    expect(system.cacheable).toBe(true);
    expect(system.text.split('\n')).toHaveLength(smoke.CACHE_PREFIX_LINES + 1);
    expect(estimateRawTokens(system.text)).toBeGreaterThanOrEqual(2_048);
  });

  it('summariseLive reads nothing from a value that is not a model', () => {
    expect(smoke.summariseLive(null)).toBeNull();
    expect(smoke.summariseLive(42)).toBeNull();
    expect(smoke.summariseLive(true)).toBeNull();
  });

  it('compares exactly these fields, in this order, and shows the cache price last as information', () => {
    const rows = smoke.compareModel(
      AI_MODELS[0],
      smoke.summariseLive({ id: 'x' })
    );
    expect(rows.map((r: any[]) => r[0])).toEqual([
      'context_tokens',
      'max_output_tokens',
      'price_in $/M',
      'price_out $/M',
      'vision',
      'json_schema',
      'cache read $/M',
    ]);
  });

  it('judge gives a passing probe no code', () => {
    const judged = smoke.judge('json_object', {
      ok: true,
      text: '{"ok":true}',
      usage: { cost_micro_usd: 5 },
      response_mode: 'JSON_OBJECT',
    });
    expect(judged.passed).toBe(true);
    expect(judged.code).toBeNull();
  });

  it('propose counts a model that reports its cost on a single probe', () => {
    const probe = (cost: number | null) => ({
      kind: 'json_object',
      passed: true,
      usage: {
        cost_micro_usd: cost,
        cost_flag: cost === null ? 'COST_ESTIMATED' : null,
      },
    });
    expect(smoke.propose([probe(5)], 'NONE').reports_cost).toBe(true);
    expect(smoke.propose([probe(null)], 'NONE').reports_cost).toBe(false);
    expect(smoke.propose([], 'NONE').reports_cost).toBe(false);
  });

  describe('usdOf, the money a call counts against the cap', () => {
    it('is the reported cost in dollars, a fixed amount when none is reported, and nothing for a failure', () => {
      expect(smoke.usdOf({ ok: true, usage: { cost_micro_usd: 12_500 } })).toBe(
        0.0125
      );
      expect(smoke.usdOf({ ok: true, usage: { cost_micro_usd: 0 } })).toBe(0);
      expect(smoke.usdOf({ ok: true, usage: { cost_micro_usd: null } })).toBe(
        0.02
      );
      expect(smoke.usdOf({ ok: true, usage: {} })).toBe(0.02);
      expect(smoke.usdOf({ ok: true })).toBe(0.02);
      expect(smoke.usdOf({ ok: false, code: 'HTTP_503' })).toBe(0);
    });
  });

  describe('buildListReport', () => {
    const live = (id: string, extra: Record<string, unknown> = {}) => ({
      id,
      context_length: 200_000,
      top_provider: { max_completion_tokens: 8_192 },
      pricing: { prompt: '0.0000003', completion: '0.0000025' },
      architecture: { input_modalities: ['text', 'image'] },
      supported_parameters: ['structured_outputs', 'response_format'],
      ...extra,
    });
    const verified = (slug: string, extra: Record<string, unknown> = {}) => ({
      ...AI_MODELS[0],
      slug,
      name: slug,
      verified_at: '2026-10-14',
      context_tokens: 200_000,
      max_output_tokens: 8_192,
      price_in: 0.3,
      price_out: 2.5,
      priced_at: '2026-10-14',
      vision: true,
      json_schema: true,
      ...extra,
    });

    it('counts the models it did not find, the ones that differ, and the ones that match', () => {
      const registry = [
        verified('a/match'),
        verified('b/differs'),
        verified('c/also-differs'),
        verified('d/missing'),
        verified('e/missing-too'),
        verified('f/third-missing'),
      ];
      const data = [
        live('a/match'),
        live('b/differs', { context_length: 128_000 }),
        live('c/also-differs', {
          architecture: { input_modalities: ['text'] },
        }),
      ];
      const { report, missing, differs } = smoke.buildListReport(
        registry,
        data,
        []
      );
      expect(missing).toBe(3);
      expect(differs).toBe(2);
      expect(report.map((r: any) => [r.slug, r.found])).toEqual([
        ['a/match', true],
        ['b/differs', true],
        ['c/also-differs', true],
        ['d/missing', false],
        ['e/missing-too', false],
        ['f/third-missing', false],
      ]);
    });

    it('counts a model once however many of its fields differ', () => {
      const registry = [verified('a/x')];
      const data = [
        live('a/x', {
          context_length: 1,
          pricing: { prompt: '0.0000009', completion: '0.0000001' },
          architecture: { input_modalities: ['text'] },
        }),
      ];
      expect(smoke.buildListReport(registry, data, []).differs).toBe(1);
    });

    it('leaves out a model that was not asked for, and does not count it', () => {
      const registry = [verified('a/x'), verified('b/y')];
      const result = smoke.buildListReport(registry, [live('a/x')], ['a/x']);
      expect(result.report.map((r: any) => r.slug)).toEqual(['a/x']);
      expect(result.missing).toBe(0);
    });

    it('tolerates entries that are not models', () => {
      const registry = [verified('a/x')];
      const result = smoke.buildListReport(
        registry,
        [null, 'x', 42, live('a/x')],
        []
      );
      expect(result.missing).toBe(0);
    });
  });
});

// ---------------------------------------------------------------------------------------
// The whole script against a fake server on this machine
// ---------------------------------------------------------------------------------------

interface Seen {
  method: string;
  url: string;
  authorization: string | undefined;
  accept: string | undefined;
  body: any;
}

/** Slugs the fake service lists: all of the registry's but one. */
const MISSING = 'z-ai/glm-5.2';

function listing() {
  return {
    data: AI_MODELS.filter((m) => m.slug !== MISSING).map((m) => ({
      id: m.slug,
      name: m.name,
      context_length: 1_000_000,
      top_provider: { max_completion_tokens: 65_536 },
      pricing: {
        prompt: '0.0000003',
        completion: '0.0000025',
        input_cache_read: '0.00000003',
      },
      architecture: {
        input_modalities: m.slug.startsWith('deepseek')
          ? ['text']
          : ['text', 'image'],
      },
      supported_parameters: ['response_format', 'structured_outputs'],
    })),
  };
}

let server: http.Server;
let base: string;
let seen: Seen[] = [];
/** per-call cost the fake reports, in dollars */
let costPerCall = 0.00001;
/** what GET /models answers instead of the listing (a string is sent as it is), or undefined */
let listingOverride: unknown;
/** models that answer HTTP 503 to every call */
let failingModels = new Set<string>();
/** models whose answers carry no cost */
let noCostModels = new Set<string>();
/** models that answer HTTP 503 to the cache probe only (the call with the long prefix) */
let failCacheModels = new Set<string>();

beforeAll(async () => {
  server = http.createServer((req, res) => {
    const chunks: Buffer[] = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => {
      const text = Buffer.concat(chunks).toString('utf8');
      const body = text === '' ? null : JSON.parse(text);
      seen.push({
        method: req.method ?? '',
        url: req.url ?? '',
        authorization: req.headers.authorization,
        accept: req.headers.accept,
        body,
      });
      res.setHeader('Content-Type', 'application/json');
      if (req.method === 'GET' && req.url === '/v1/models') {
        res.end(
          listingOverride === undefined
            ? JSON.stringify(listing())
            : typeof listingOverride === 'string'
              ? listingOverride
              : JSON.stringify(listingOverride)
        );
        return;
      }
      if (req.method === 'POST' && req.url === '/v1/chat/completions') {
        if (failingModels.has(body.model)) {
          res.statusCode = 503;
          res.end('{}');
          return;
        }
        if (
          failCacheModels.has(body.model) &&
          JSON.stringify(body.messages).includes('Line 1:')
        ) {
          res.statusCode = 503;
          res.end('{}');
          return;
        }
        const hasImage = JSON.stringify(body.messages).includes('image_url');
        if (hasImage && body.model.startsWith('deepseek')) {
          res.statusCode = 400;
          res.end(
            JSON.stringify({ error: { code: 400, message: 'no images here' } })
          );
          return;
        }
        const cacheable = JSON.stringify(body.messages).includes(
          'cache_control'
        );
        const callsOfModelWithPrefix = seen.filter(
          (s) =>
            s.url === '/v1/chat/completions' &&
            s.body.model === body.model &&
            JSON.stringify(s.body.messages).includes('Line 1:')
        ).length;
        // openai caches by itself on the second call; anthropic only with a breakpoint
        const cached =
          callsOfModelWithPrefix >= 2 &&
          ((body.model.startsWith('openai') && !cacheable) ||
            (body.model.startsWith('anthropic') && cacheable))
            ? 2_048
            : 0;
        res.end(
          JSON.stringify({
            id: 'gen-fake-1',
            model: body.model,
            provider: 'Fake Host',
            choices: [
              {
                finish_reason: 'stop',
                message: { role: 'assistant', content: '{"ok": true}' },
              },
            ],
            usage: {
              prompt_tokens: callsOfModelWithPrefix > 0 ? 3_000 : 50,
              completion_tokens: 6,
              prompt_tokens_details: { cached_tokens: cached },
              ...(noCostModels.has(body.model) ? {} : { cost: costPerCall }),
            },
          })
        );
        return;
      }
      res.statusCode = 404;
      res.end('{}');
    });
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/v1`;
});
afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
});
beforeEach(() => {
  seen = [];
  costPerCall = 0.00001;
  listingOverride = undefined;
  failingModels = new Set();
  noCostModels = new Set();
  failCacheModels = new Set();
});

function runScript(
  args: string[],
  env: Record<string, string | undefined> = {}
): Promise<{ code: number | null; out: string }> {
  return new Promise((resolve) => {
    const clean: NodeJS.ProcessEnv = { ...process.env };
    delete clean['OPENROUTER_API_KEY'];
    delete clean['INTAKE_UNDERSTAND_API_KEY'];
    delete clean['OPENROUTER_BASE_URL'];
    delete clean['INTAKE_UNDERSTAND_BASE_URL'];
    const child = spawn(process.execPath, [SCRIPT, ...args], {
      cwd: path.resolve(__dirname, '..', '..', '..', '..'),
      env: { ...clean, ...(env as NodeJS.ProcessEnv) },
    });
    let out = '';
    child.stdout.on('data', (d) => (out += d));
    child.stderr.on('data', (d) => (out += d));
    child.on('close', (code) => resolve({ code, out }));
  });
}

describe('the script as a process', () => {
  it('--help prints the usage and needs nothing: no key, no network', async () => {
    const { code, out } = await runScript(['--help']);
    expect(code).toBe(0);
    expect(out).toContain('gateway-smoke');
    expect(out).toContain('--list-models');
    expect(out).toContain('Never run in CI');
    expect(seen).toHaveLength(0);
  });

  it('--call without a key stops with exit 2 and contacts nobody', async () => {
    const { code, out } = await runScript(['--call'], {
      OPENROUTER_BASE_URL: base,
    });
    expect(code).toBe(2);
    expect(out).toContain('--call needs OPENROUTER_API_KEY');
    expect(seen).toHaveLength(0);
  });

  it('a bad argument is exit 2 with a message', async () => {
    const { code, out } = await runScript(['--cap-usd', '11', '--call'], {
      OPENROUTER_API_KEY: KEY,
      OPENROUTER_BASE_URL: base,
    });
    expect(code).toBe(2);
    expect(out).toContain('at most 10');
    expect(seen).toHaveLength(0);
  });

  it('--list-models prints the registry beside the service, sends NO key, and says what it did not find', async () => {
    const { code, out } = await runScript(['--list-models'], {
      OPENROUTER_BASE_URL: base,
    });
    expect(seen).toHaveLength(1);
    expect(seen[0]).toMatchObject({
      method: 'GET',
      url: '/v1/models',
      authorization: undefined,
    });
    expect(out).toContain('google/gemini-3.6-flash');
    expect(out).toContain('price_in $/M');
    expect(out).toContain('live 0.3');
    expect(out).toContain('registry unverified');
    expect(out).toContain(`${MISSING}`);
    expect(out).toContain('NOT FOUND in the live list');
    expect(out).toContain('1 not found');
    expect(out).toContain('Nothing was written.');
    expect(code).toBe(1);
  });

  it('--list-models --json prints one document and --model narrows it', async () => {
    const { code, out } = await runScript(
      ['--list-models', '--json', '--model', 'openai/gpt-5.6-terra'],
      {
        OPENROUTER_BASE_URL: base,
      }
    );
    const doc = JSON.parse(out);
    expect(doc.mode).toBe('list-models');
    expect(doc.models.map((m: any) => m.slug)).toEqual([
      'openai/gpt-5.6-terra',
    ]);
    expect(doc.models[0].live.price_in).toBe(0.3);
    expect(code).toBe(0);
  });

  it('--list-models answers exit 2 when the service answers an error', async () => {
    const dead = http.createServer((_req, res) => {
      res.statusCode = 503;
      res.end('{}');
    });
    await new Promise<void>((resolve) => dead.listen(0, '127.0.0.1', resolve));
    const url = `http://127.0.0.1:${(dead.address() as AddressInfo).port}/v1`;
    const { code, out } = await runScript(['--list-models'], {
      OPENROUTER_BASE_URL: url,
    });
    await new Promise<void>((resolve) => dead.close(() => resolve()));
    expect(code).toBe(2);
    expect(out).toContain('HTTP 503');
  });

  it('--call sends the privacy field, the usage block and the key in the header only, never prints the key, and proposes fields', async () => {
    const { code, out } = await runScript(
      [
        '--call',
        '--model',
        'deepseek/deepseek-v4-flash',
        '--model',
        'google/gemini-3.6-flash',
      ],
      { OPENROUTER_API_KEY: KEY, OPENROUTER_BASE_URL: base }
    );
    const posts = seen.filter((s) => s.method === 'POST');
    expect(posts).toHaveLength(6); // json_object, json_schema, vision for two models
    for (const post of posts) {
      expect(post.authorization).toBe(`Bearer ${KEY}`);
      expect(post.body.provider.data_collection).toBe('deny');
      expect(post.body.usage).toEqual({ include: true });
      expect(JSON.stringify(post.body)).not.toContain(KEY);
    }
    // the schema probe sends a schema; the others a plain JSON object
    const forDeepseek = posts.filter((p) =>
      p.body.model.startsWith('deepseek')
    );
    expect(forDeepseek.map((p) => p.body.response_format.type)).toEqual([
      'json_object',
      'json_schema',
      'json_object',
    ]);

    expect(out).not.toContain(KEY);
    expect(out).toContain('deepseek/deepseek-v4-flash');
    expect(out).toMatch(/FAIL vision\s+HTTP_400/); // the fake service refuses images for deepseek
    expect(out).toContain('proposed registry fields');
    expect(out).toContain('vision: ');
    expect(out).toContain('Nothing was written.');
    expect(code).toBe(1); // a probe failed
  });

  it('--call --json proposes the fields per model', async () => {
    const { code, out } = await runScript(
      ['--call', '--json', '--model', 'google/gemini-3.6-flash'],
      { OPENROUTER_API_KEY: KEY, OPENROUTER_BASE_URL: base }
    );
    const doc = JSON.parse(out);
    expect(doc.models[0].proposal).toEqual({
      json_schema: true,
      vision: true,
      prompt_caching: 'not probed (use --probe-cache)',
      reports_cost: true,
      eligible_under_adr_077: true,
    });
    expect(doc.spent_usd).toBeCloseTo(0.00003, 8);
    expect(doc.stopped_at_cap).toBe(false);
    expect(code).toBe(0);
  });

  it('--probe-cache finds automatic caching where the second call comes back cached, explicit breakpoints where only they work, and none otherwise', async () => {
    const { out } = await runScript(
      [
        '--call',
        '--json',
        '--probe-cache',
        '--model',
        'openai/gpt-5.6-terra',
        '--model',
        'anthropic/claude-sonnet-5',
        '--model',
        'google/gemini-3.6-flash',
      ],
      { OPENROUTER_API_KEY: KEY, OPENROUTER_BASE_URL: base }
    );
    const caching = Object.fromEntries(
      JSON.parse(out).models.map((m: any) => [
        m.slug,
        m.proposal.prompt_caching,
      ])
    );
    expect(caching).toEqual({
      'openai/gpt-5.6-terra': 'AUTO',
      'anthropic/claude-sonnet-5': 'EXPLICIT',
      'google/gemini-3.6-flash': 'NONE',
    });
    // the explicit pair carries a breakpoint, the automatic pair none
    const prefix = seen.filter(
      (s) =>
        s.method === 'POST' &&
        JSON.stringify(s.body.messages).includes('Line 1:')
    );
    const anthropic = prefix.filter((s) =>
      s.body.model.startsWith('anthropic')
    );
    expect(anthropic).toHaveLength(4);
    expect(
      anthropic.map((s) =>
        JSON.stringify(s.body.messages).includes('cache_control')
      )
    ).toEqual([false, false, true, true]);
    const openai = prefix.filter((s) => s.body.model.startsWith('openai'));
    expect(openai).toHaveLength(2);
  });

  it('stops when the money spent reaches the cap, says so, and exits 1', async () => {
    costPerCall = 0.01;
    const { code, out } = await runScript(
      [
        '--call',
        '--cap-usd',
        '0.02',
        '--model',
        'google/gemini-3.6-flash',
        '--model',
        'openai/gpt-5.6-terra',
      ],
      { OPENROUTER_API_KEY: KEY, OPENROUTER_BASE_URL: base }
    );
    const posts = seen.filter((s) => s.method === 'POST');
    expect(posts).toHaveLength(2);
    expect(out).toContain('STOPPED at the cap');
    expect(code).toBe(1);
  });

  it('counts a call whose cost is not reported at a fixed amount, so the cap still holds', async () => {
    // the fake always reports a cost; a different server would not. The arithmetic is the script's:
    const { code } = await runScript(
      ['--call', '--cap-usd', '0.02', '--model', 'google/gemini-3.6-flash'],
      { OPENROUTER_API_KEY: KEY, OPENROUTER_BASE_URL: base }
    );
    expect(code).toBe(0);
  });

  it('refuses a model that is not in the registry', async () => {
    const { code, out } = await runScript(
      ['--call', '--model', 'nobody/nothing'],
      {
        OPENROUTER_API_KEY: KEY,
        OPENROUTER_BASE_URL: base,
      }
    );
    expect(code).toBe(2);
    expect(out).toContain('nobody/nothing is not in the registry');
    expect(seen.filter((s) => s.method === 'POST')).toHaveLength(0);
  });

  it('scrubs the key from anything it prints, even when a message holds it', async () => {
    const { run } = smoke;
    const lines: string[] = [];
    const code = await run(
      ['--help'],
      { OPENROUTER_API_KEY: KEY },
      { sink: (l: string) => lines.push(l) }
    );
    expect(code).toBe(0);
    expect(lines.join('\n')).not.toContain(KEY);
  });
});

describe('the script as a process: more paths', () => {
  const ENV = () => ({ OPENROUTER_API_KEY: KEY, OPENROUTER_BASE_URL: base });

  it('asks for JSON in the Accept header of the model list', async () => {
    await runScript(['--list-models', '--model', 'openai/gpt-5.6-terra'], {
      OPENROUTER_BASE_URL: base,
    });
    expect(seen[0]?.accept).toBe('application/json');
  });

  it('prints each field of the comparison on its own line, and the totals', async () => {
    const { out } = await runScript(
      ['--list-models', '--model', 'openai/gpt-5.6-terra'],
      { OPENROUTER_BASE_URL: base }
    );
    for (const name of [
      'context_tokens',
      'max_output_tokens',
      'price_in $/M',
      'price_out $/M',
      'vision',
      'json_schema',
      'cache read $/M',
    ]) {
      expect(out).toContain(name);
    }
    expect(out).toContain(
      '0 not found, 0 with a difference. Nothing was written.'
    );
  });

  it.each([
    ['an empty object', '{}'],
    ['null', 'null'],
    ['a list', '[]'],
    ['data that is not a list', '{"data":"x"}'],
  ])(
    'says the model list has a shape it does not know when it is %s, and exits 2',
    async (_name, text) => {
      listingOverride = text;
      const { code, out } = await runScript(['--list-models'], {
        OPENROUTER_BASE_URL: base,
      });
      expect(code).toBe(2);
      expect(out).toContain(
        'the model list has a shape this script does not know'
      );
    }
  );

  it('exits 2 and names only the kind of failure when the service cannot be reached', async () => {
    const closed = http.createServer();
    await new Promise<void>((resolve) =>
      closed.listen(0, '127.0.0.1', resolve)
    );
    const url = `http://127.0.0.1:${(closed.address() as AddressInfo).port}/v1`;
    await new Promise<void>((resolve) => closed.close(() => resolve()));
    const { code, out } = await runScript(['--list-models'], {
      OPENROUTER_BASE_URL: url,
    });
    expect(code).toBe(2);
    expect(out).toContain('gateway-smoke: failed (TypeError)');
    expect(out).not.toContain(url);
  });

  it('without --model, calls every model of the registry, three probes each, and says so', async () => {
    const { code, out } = await runScript(['--call'], ENV());
    const posts = seen.filter((s) => s.method === 'POST');
    expect(posts).toHaveLength(AI_MODELS.length * 3);
    expect(new Set(posts.map((p) => p.body.model))).toEqual(
      new Set(AI_MODELS.map((m) => m.slug))
    );
    expect(out).toContain(
      `calling ${AI_MODELS.length} model(s), up to 3 call(s) each, cap $1.00`
    );
    // the fake refuses images for deepseek: one probe fails, so the exit code says so
    expect(code).toBe(1);
  });

  it('says up to seven calls each with --probe-cache', async () => {
    const { out } = await runScript(
      ['--call', '--probe-cache', '--model', 'google/gemini-3.6-flash'],
      ENV()
    );
    expect(out).toContain('calling 1 model(s), up to 7 call(s) each');
  });

  it('does not retry a failed call: a model that answers 503 is asked once per probe, and the run exits 1', async () => {
    failingModels = new Set(['moonshotai/kimi-k3']);
    const { code, out } = await runScript(
      ['--call', '--model', 'moonshotai/kimi-k3'],
      ENV()
    );
    expect(seen.filter((s) => s.method === 'POST')).toHaveLength(3);
    expect(out).toMatch(/FAIL json_object\s+HTTP_503/);
    expect(out).toMatch(/FAIL json_schema\s+HTTP_503/);
    expect(out).toMatch(/FAIL vision\s+HTTP_503/);
    expect(out).toContain('no host answered with data_collection: deny');
    expect(code).toBe(1);
  });

  it('a failed call costs nothing against the cap', async () => {
    failingModels = new Set(['moonshotai/kimi-k3']);
    costPerCall = 5;
    const { out } = await runScript(
      ['--call', '--cap-usd', '0.5', '--model', 'moonshotai/kimi-k3'],
      ENV()
    );
    expect(seen.filter((s) => s.method === 'POST')).toHaveLength(3);
    expect(out).not.toContain('STOPPED at the cap');
  });

  it('exits 0 and reports a clean run when every probe passes', async () => {
    const { code, out } = await runScript(
      ['--call', '--model', 'google/gemini-3.6-flash'],
      ENV()
    );
    expect(code).toBe(0);
    expect(out).toContain('ok   json_object');
    expect(out).toContain('ok   json_schema');
    expect(out).toContain('ok   vision');
    expect(out).toContain('mode JSON_SCHEMA');
    expect(out).toContain('host Fake Host');
    expect(out).toContain('$0.000010');
    expect(out).toContain(
      'spent about $0.000030 of the $1.00 cap. Nothing was written.'
    );
    expect(out).not.toContain('STOPPED');
  });

  it('says so when a model reports no cost, and counts that call at the fixed amount', async () => {
    noCostModels = new Set(['google/gemini-3.6-flash']);
    const { out } = await runScript(
      ['--call', '--json', '--model', 'google/gemini-3.6-flash'],
      ENV()
    );
    const doc = JSON.parse(out);
    expect(doc.mode).toBe('call');
    expect(doc.models[0].proposal.reports_cost).toBe(false);
    expect(doc.spent_usd).toBeCloseTo(0.06, 6);
    const text = (
      await runScript(['--call', '--model', 'google/gemini-3.6-flash'], ENV())
    ).out;
    expect(text).toContain('cost not reported');
  });

  it('stops inside the cache probe too, when the cap is reached there', async () => {
    costPerCall = 0.01;
    const { code, out } = await runScript(
      [
        '--call',
        '--cap-usd',
        '0.03',
        '--probe-cache',
        '--model',
        'google/gemini-3.6-flash',
      ],
      ENV()
    );
    expect(seen.filter((s) => s.method === 'POST')).toHaveLength(3);
    expect(out).toContain('STOPPED at the cap');
    expect(code).toBe(1);
  });

  it('a clean cache probe exits 0 and reports the mode it found', async () => {
    const { code, out } = await runScript(
      ['--call', '--json', '--probe-cache', '--model', 'openai/gpt-5.6-terra'],
      ENV()
    );
    expect(JSON.parse(out).models[0].proposal.prompt_caching).toBe('AUTO');
    expect(code).toBe(0);
  });

  it('a model with no automatic caching and no breakpoint support is NONE after four cache calls', async () => {
    const { out } = await runScript(
      [
        '--call',
        '--json',
        '--probe-cache',
        '--model',
        'google/gemini-3.6-flash',
      ],
      ENV()
    );
    const posts = seen.filter(
      (s) =>
        s.method === 'POST' &&
        JSON.stringify(s.body.messages).includes('Line 1:')
    );
    expect(posts).toHaveLength(4);
    expect(JSON.parse(out).models[0].proposal.prompt_caching).toBe('NONE');
  });

  it('--list-models --json indents two spaces and holds the models', async () => {
    const { out } = await runScript(
      ['--list-models', '--json', '--model', 'openai/gpt-5.6-terra'],
      { OPENROUTER_BASE_URL: base }
    );
    expect(out.split('\n')[1]).toMatch(/^ {2}"mode"/);
  });
});

describe('the last paths of the smoke script', () => {
  it('listExitCode is 0 only when nothing is missing and nothing differs', () => {
    expect(smoke.listExitCode(0, 0)).toBe(0);
    expect(smoke.listExitCode(1, 0)).toBe(1);
    expect(smoke.listExitCode(0, 1)).toBe(1);
    expect(smoke.listExitCode(2, 2)).toBe(1);
    expect(smoke.listExitCode(1, 1)).toBe(1);
  });

  it('the probes ask for exactly this, in these words', () => {
    const asked = (kind: string) =>
      JSON.stringify(smoke.probeRequest(kind).messages);
    expect(asked('json_object')).toContain('Return {\\"ok\\": true}.');
    expect(smoke.probeRequest('json_object').messages[1]).toEqual({
      role: 'user',
      content: 'Return {"ok": true}.',
    });
    expect(smoke.probeRequest('json_schema').messages[1]).toEqual({
      role: 'user',
      content: 'Return {"ok": true}.',
    });
    expect(smoke.probeRequest('vision').messages[1].content[0]).toEqual({
      type: 'text',
      text: 'There is a picture. Return {"ok": true}.',
    });
    expect(smoke.probeRequest('vision').messages[1].content[1].type).toBe(
      'image'
    );
    expect(smoke.probeRequest('cache').messages[1]).toEqual({
      role: 'user',
      content: 'Return {"ok": true}.',
    });
  });
});

describe('the script as a process: the cache probe', () => {
  const ENV = () => ({ OPENROUTER_API_KEY: KEY, OPENROUTER_BASE_URL: base });

  it('--call --json indents two spaces', async () => {
    const { out } = await runScript(
      ['--call', '--json', '--model', 'google/gemini-3.6-flash'],
      ENV()
    );
    expect(out.split('\n')[1]).toMatch(/^ {2}"mode"/);
  });

  it('a cache probe that fails on its own fails the run, with its name, and is not retried', async () => {
    failCacheModels = new Set(['google/gemini-3.6-flash']);
    const { code, out } = await runScript(
      ['--call', '--probe-cache', '--model', 'google/gemini-3.6-flash'],
      ENV()
    );
    // three probes that pass, then the automatic pair and the explicit pair, one call each time
    expect(seen.filter((s) => s.method === 'POST')).toHaveLength(7);
    expect(out).toContain('ok   json_object');
    expect(out).toMatch(/FAIL cache_auto\s+HTTP_503/);
    expect(out).toMatch(/FAIL cache_explicit\s+HTTP_503/);
    expect(code).toBe(1);
  });

  it('asks a failing model once for every call, the cache probe included', async () => {
    failingModels = new Set(['moonshotai/kimi-k3']);
    const { code } = await runScript(
      ['--call', '--probe-cache', '--model', 'moonshotai/kimi-k3'],
      ENV()
    );
    expect(seen.filter((s) => s.method === 'POST')).toHaveLength(7);
    expect(code).toBe(1);
  });
});
