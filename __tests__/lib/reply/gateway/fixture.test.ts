/**
 * @jest-environment node
 */

/**
 * The fixture model (build step 7 part 3): it plays recorded and planted replies in order, counts
 * its calls, can be told to fail, refuses what a real port would refuse, and plants errors that
 * cannot silently fail to be planted.
 */

import {
  DEFAULT_SCENARIO,
  FIXTURE_TARGET,
  FIXTURE_TARGET_B,
  badJson,
  createFixtureModel,
  plantLiteral,
  type FixtureScript,
} from '@/lib/reply/gateway/fixture';
import {
  DEFAULT_CALIBRATION,
  estimateRawTokens,
} from '@/lib/reply/context/tokens';
import type { ModelAnswer } from '@/lib/reply/gateway/types';

import { request } from './helpers/gateway-fixtures';

const GOOD = JSON.stringify({
  headline: 'Counter-trend rally inside the M5 corridor',
  rationale: [{ text: 'M5 holds above 4350.22', cites: ['MCD2'] }],
});

const reply = (
  text: string,
  extra: Partial<Extract<FixtureScript, { kind: 'REPLY' }>> = {}
): FixtureScript => ({
  kind: 'REPLY',
  text,
  ...extra,
});

const answered = (result: unknown): ModelAnswer => {
  expect((result as ModelAnswer).ok).toBe(true);
  return result as ModelAnswer;
};

describe('the scripts', () => {
  it('plays the scripts of a scenario in order and repeats the last', async () => {
    const model = createFixtureModel({
      scenarios: { default: [reply('one'), reply('two'), reply('three')] },
    });
    const texts: string[] = [];
    for (let i = 0; i < 5; i += 1) {
      texts.push(answered(await model.complete(request())).text);
    }
    expect(texts).toEqual(['one', 'two', 'three', 'three', 'three']);
  });

  it('plays a planted wrong price first and the good reply on the regeneration', async () => {
    const wrong = plantLiteral(GOOD, '4350.22', '4350.72');
    const model = createFixtureModel({
      scenarios: { default: [reply(wrong), reply(GOOD)] },
    });
    expect(answered(await model.complete(request())).text).toContain('4350.72');
    expect(answered(await model.complete(request())).text).toContain('4350.22');
  });

  it('keeps a script per scenario and chooses the scenario with `select`', async () => {
    const model = createFixtureModel({
      scenarios: { a: [reply('A1'), reply('A2')], b: [reply('B1')] },
      select: (req) =>
        typeof req.messages[0]?.content === 'string' &&
        req.messages[0].content.startsWith('b')
          ? 'b'
          : 'a',
    });
    const ask = (head: string) =>
      model.complete(
        request({
          messages: [
            { role: 'system', content: head },
            { role: 'user', content: 'q' },
          ],
        })
      );
    expect(answered(await ask('a')).text).toBe('A1');
    expect(answered(await ask('b')).text).toBe('B1');
    expect(answered(await ask('a')).text).toBe('A2');
    expect(answered(await ask('b')).text).toBe('B1');
  });

  it('uses the scenario named `default` when there is no `select`', async () => {
    expect(DEFAULT_SCENARIO).toBe('default');
    const model = createFixtureModel({ scenarios: { default: [reply('x')] } });
    expect(answered(await model.complete(request())).text).toBe('x');
  });

  it('throws, loudly, for a scenario nobody scripted: a test that forgot proves nothing', async () => {
    const none = createFixtureModel({ scenarios: {} });
    await expect(none.complete(request())).rejects.toThrow(
      /no script for scenario "default"/
    );
    const empty = createFixtureModel({ scenarios: { default: [] } });
    await expect(empty.complete(request())).rejects.toThrow(/no script/);
  });

  it('fails with the code a script names, and the attempts it names', async () => {
    const model = createFixtureModel({
      scenarios: {
        default: [
          { kind: 'FAIL', code: 'TIMEOUT', attempts: 2 },
          { kind: 'FAIL', code: 'HTTP_503' },
          reply('back up'),
        ],
      },
    });
    expect(await model.complete(request())).toMatchObject({
      ok: false,
      code: 'TIMEOUT',
      attempts: 2,
      model: FIXTURE_TARGET.slug,
    });
    expect(await model.complete(request())).toMatchObject({
      ok: false,
      code: 'HTTP_503',
      attempts: 1,
    });
    expect(answered(await model.complete(request())).text).toBe('back up');
  });

  it('returns a bad-JSON reply as a reply: the validator, not the model, finds it out', async () => {
    const model = createFixtureModel({
      scenarios: { default: [reply(badJson(GOOD))] },
    });
    const text = answered(await model.complete(request())).text;
    expect(() => JSON.parse(text)).toThrow();
  });
});

describe('counting', () => {
  it('counts every request that reaches it and keeps them, without the abort signal', async () => {
    const model = createFixtureModel({ scenarios: { default: [reply('x')] } });
    expect(model.count).toBe(0);
    const controller = new AbortController();
    await model.complete(request({ signal: controller.signal }));
    await model.complete(request({ max_output_tokens: 99 }));
    expect(model.count).toBe(2);
    expect(model.calls).toHaveLength(2);
    expect(model.calls[1]?.max_output_tokens).toBe(99);
    expect('signal' in (model.calls[0] as object)).toBe(false);
  });

  it('forgets the calls and starts every scenario again on reset', async () => {
    const model = createFixtureModel({
      scenarios: { default: [reply('one'), reply('two')] },
    });
    await model.complete(request());
    await model.complete(request());
    model.reset();
    expect(model.count).toBe(0);
    expect(answered(await model.complete(request())).text).toBe('one');
  });

  it('counts a refused request too: it reached the model', async () => {
    const model = createFixtureModel({ scenarios: { default: [reply('x')] } });
    await model.complete(request({ max_output_tokens: 0 }));
    expect(model.count).toBe(1);
  });
});

describe('refusing what a real port refuses', () => {
  const model = createFixtureModel({ scenarios: { default: [reply('x')] } });
  afterEach(() => model.reset());

  it.each([
    ['an empty request', { messages: [] }, 'REQUEST_INVALID'],
    [
      'too many output tokens',
      { max_output_tokens: FIXTURE_TARGET.max_output_tokens + 1 },
      'REQUEST_INVALID',
    ],
    [
      'a prompt over the window',
      { estimated_prompt_tokens: 500_000 },
      'CONTEXT_TOO_LARGE',
    ],
  ])('refuses %s with %s and zero attempts', async (_name, overrides, code) => {
    expect(await model.complete(request(overrides as any))).toMatchObject({
      ok: false,
      code,
      attempts: 0,
      latency_ms: 0,
    });
  });

  it('refuses an image for a fixture that cannot see', async () => {
    const blind = createFixtureModel({
      target: { ...FIXTURE_TARGET, vision: false },
      scenarios: { default: [reply('x')] },
    });
    const result = await blind.complete(
      request({
        messages: [
          {
            role: 'user',
            content: [
              { type: 'image', url: 'https://charts.example.com/a.png' },
            ],
          },
        ],
      })
    );
    expect(result).toMatchObject({
      ok: false,
      code: 'VISION_UNSUPPORTED',
      attempts: 0,
      latency_ms: 0,
    });
  });

  it('is ABORTED at once for a signal that has fired, and plays no script', async () => {
    const m = createFixtureModel({
      scenarios: { default: [reply('one'), reply('two')] },
    });
    const controller = new AbortController();
    controller.abort();
    expect(
      await m.complete(request({ signal: controller.signal }))
    ).toMatchObject({ ok: false, code: 'ABORTED', attempts: 0, latency_ms: 0 });
    expect(answered(await m.complete(request())).text).toBe('one');
  });
});

describe('what a reply carries', () => {
  it('derives the usage from the text with the deterministic estimator, and reports a cost of zero', async () => {
    const model = createFixtureModel({ scenarios: { default: [reply(GOOD)] } });
    const a = answered(await model.complete(request()));
    const b = answered(
      await createFixtureModel({
        scenarios: { default: [reply(GOOD)] },
      }).complete(request())
    );
    expect(a.usage).toEqual(b.usage);
    expect(a.usage.prompt_tokens).toBeGreaterThan(0);
    expect(a.usage.completion_tokens).toBeGreaterThan(0);
    expect(a.usage.cached_tokens).toBe(0);
    expect(a.usage.cost_micro_usd).toBe(0);
    expect(a.usage.cost_flag).toBeNull();
  });

  it('lets a script override the figures it names and keeps the derived ones for the rest', async () => {
    const model = createFixtureModel({
      scenarios: {
        default: [
          reply(GOOD, {
            usage: { cost_micro_usd: 7650, cached_tokens: 16_000 },
            finish_reason: 'length',
            latency_ms: 4_200,
          }),
        ],
      },
    });
    const a = answered(await model.complete(request()));
    expect(a.usage.cost_micro_usd).toBe(7650);
    expect(a.usage.cached_tokens).toBe(16_000);
    expect(a.usage.prompt_tokens).toBeGreaterThan(0);
    expect(a.finish_reason).toBe('length');
    expect(a.latency_ms).toBe(4_200);
  });

  it('answers as the model it is, with a generation id that counts its calls', async () => {
    const model = createFixtureModel({
      target: FIXTURE_TARGET_B,
      scenarios: { default: [reply('x')] },
    });
    const first = answered(await model.complete(request()));
    const second = answered(await model.complete(request()));
    expect(first).toMatchObject({
      model: 'fixture-b/recorded',
      served_model: 'fixture-b/recorded',
      host: 'fixture',
      attempts: 1,
    });
    expect([first.generation_id, second.generation_id]).toEqual([
      'fixture-1',
      'fixture-2',
    ]);
    expect(model.target).toBe(FIXTURE_TARGET_B);
  });

  it('reports the response mode a real port would send for the model’s capabilities', async () => {
    const schema = createFixtureModel({ scenarios: { default: [reply('x')] } });
    expect(answered(await schema.complete(request())).response_mode).toBe(
      'JSON_SCHEMA'
    );
    const plain = createFixtureModel({
      target: { ...FIXTURE_TARGET, json_schema: false },
      scenarios: { default: [reply('x')] },
    });
    expect(answered(await plain.complete(request())).response_mode).toBe(
      'JSON_OBJECT'
    );
    expect(
      answered(await schema.complete(request({ response: { kind: 'TEXT' } })))
        .response_mode
    ).toBe('TEXT');
  });

  it('is deterministic: two runs of one script give the same results', async () => {
    const run = async () => {
      const m = createFixtureModel({
        scenarios: { default: [reply('a'), reply('b')] },
      });
      return [await m.complete(request()), await m.complete(request())];
    };
    expect(await run()).toEqual(await run());
  });
});

describe('the defaults', () => {
  it('the default fixture model can see, enforces a schema, caches by itself and has a big window', () => {
    expect(FIXTURE_TARGET).toEqual({
      slug: 'fixture-a/recorded',
      vision: true,
      context_budget: 120_000,
      max_output_tokens: 4_096,
      json_schema: true,
      prompt_caching: 'AUTO',
      provider_only: null,
      price_in: null,
      price_out: null,
      calibration: DEFAULT_CALIBRATION,
    });
    expect(FIXTURE_TARGET_B).toEqual({
      ...FIXTURE_TARGET,
      slug: 'fixture-b/recorded',
    });
    expect(Object.isFrozen(FIXTURE_TARGET)).toBe(true);
  });

  it('a reply takes no time, finishes with `stop` and counts one attempt unless a script says otherwise', async () => {
    const model = createFixtureModel({
      scenarios: { default: [reply('x')] },
    });
    expect(answered(await model.complete(request()))).toMatchObject({
      latency_ms: 0,
      finish_reason: 'stop',
      attempts: 1,
    });
  });

  it('a failure takes no time and counts one attempt unless a script says otherwise', async () => {
    const model = createFixtureModel({
      scenarios: { default: [{ kind: 'FAIL', code: 'TIMEOUT' }] },
    });
    expect(await model.complete(request())).toEqual({
      ok: false,
      code: 'TIMEOUT',
      model: 'fixture-a/recorded',
      latency_ms: 0,
      attempts: 1,
    });
  });

  it('derives the prompt tokens from the TEXT of the request and ignores the images', async () => {
    const model = createFixtureModel({ scenarios: { default: [reply('x')] } });
    const result = answered(
      await model.complete(
        request({
          messages: [
            { role: 'system', content: 'AAA BBB' },
            {
              role: 'user',
              content: [
                { type: 'text', text: 'CCC' },
                { type: 'image', url: 'https://charts.example.com/a.png' },
                { type: 'text', text: 'DDD' },
              ],
            },
          ],
        })
      )
    );
    expect(result.usage.prompt_tokens).toBe(
      estimateRawTokens('AAA BBB\nCCC\nDDD')
    );
    expect(result.usage.completion_tokens).toBe(estimateRawTokens('x'));
  });
});

describe('planted errors', () => {
  it('replaces a value at the very start of the reply', () => {
    expect(plantLiteral('4350.22 x', '4350.22', '1')).toBe('1 x');
  });

  it('cuts at exactly half, and never to nothing', () => {
    expect(badJson('{"abcdef":1}')).toBe('{"abcd');
    expect(badJson('{"a":1,"b":22}')).toBe('{"a":1,');
    // a prefix that would still parse is broken on purpose, not cut to nothing
    expect(badJson('1')).toBe('1{');
    expect(badJson('123')).toBe('1{');
  });

  it('replaces the first occurrence of a value', () => {
    expect(plantLiteral('a 4350.22 b 4350.22', '4350.22', '4350.72')).toBe(
      'a 4350.72 b 4350.22'
    );
  });

  it('throws when the value to replace is not there, or is empty: an error never silently not planted', () => {
    expect(() => plantLiteral('abc', '4350.22', '1')).toThrow(
      /cannot plant an error/
    );
    expect(() => plantLiteral('abc', '', '1')).toThrow(/cannot plant an error/);
  });

  it('cuts a JSON reply short so that it no longer parses', () => {
    const cut = badJson(GOOD);
    expect(cut.length).toBeLessThan(GOOD.length);
    expect(() => JSON.parse(cut)).toThrow();
  });

  it('breaks on purpose a prefix that would still parse', () => {
    const cut = badJson('12345678');
    expect(() => JSON.parse(cut)).toThrow();
    expect(() => JSON.parse(badJson('1'))).toThrow();
  });
});
