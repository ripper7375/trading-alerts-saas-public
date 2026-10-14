/**
 * @jest-environment node
 */

/**
 * The fallback (build step 7 part 3; ADR-055): when the second model is asked and when it is not,
 * what each call reports, the kill switch through the launch plan, and the waits of the real ports.
 */

import { AI_MODELS } from '@/config/ai-models';
import {
  FALLBACK_TIMEOUT_MS,
  ANSWER_TIMEOUT_MS,
} from '@/lib/reply/gateway/openrouter';
import {
  completeWithFallback,
  launchPorts,
  type FallbackOutcome,
} from '@/lib/reply/gateway/fallback';
import {
  FIXTURE_TARGET,
  FIXTURE_TARGET_B,
  createFixtureModel,
  type FixtureScript,
} from '@/lib/reply/gateway/fixture';
import {
  loadRegistry,
  parseDisabledModels,
  planLaunch,
} from '@/lib/reply/gateway/registry';
import type { GatewayErrorCode } from '@/lib/reply/gateway/types';

import {
  KEY,
  completion,
  fetchFake,
  registryRow,
  request,
  type Handler,
} from './helpers/gateway-fixtures';

const REPLY = (text: string, cost = 1000): FixtureScript => ({
  kind: 'REPLY',
  text,
  usage: { cost_micro_usd: cost },
});
const FAIL = (code: GatewayErrorCode, attempts = 1): FixtureScript => ({
  kind: 'FAIL',
  code,
  attempts,
});

const model = (target: typeof FIXTURE_TARGET, ...scripts: FixtureScript[]) =>
  createFixtureModel({ target, scenarios: { default: scripts } });

const outcomeShape = (o: FallbackOutcome) => ({
  by: o.answered_by,
  answered: o.answer !== null,
  attempts: o.attempts.map((a) => [
    a.slot,
    a.result.ok ? 'OK' : (a.result as any).code,
  ]),
  skipped: o.fallback_skipped,
  failure: o.failure,
});

describe('completeWithFallback', () => {
  it('asks only the primary when it answers', async () => {
    const primary = model(FIXTURE_TARGET, REPLY('from the primary'));
    const fallback = model(FIXTURE_TARGET_B, REPLY('from the fallback'));
    const outcome = await completeWithFallback(
      { primary, fallback },
      request()
    );
    expect(outcome.answer?.text).toBe('from the primary');
    expect(outcomeShape(outcome)).toEqual({
      by: 'PRIMARY',
      answered: true,
      attempts: [['PRIMARY', 'OK']],
      skipped: null,
      failure: null,
    });
    expect(primary.count).toBe(1);
    expect(fallback.count).toBe(0);
  });

  it.each<GatewayErrorCode>([
    'TIMEOUT',
    'UNREACHABLE',
    'HTTP_429',
    'HTTP_500',
    'HTTP_502',
    'HTTP_503',
    'HTTP_400',
    'HTTP_404',
    'HTTP_413',
    'HTTP_401',
    'HTTP_402',
    'HTTP_403',
    'BAD_RESPONSE',
    'RESPONSE_TOO_LARGE',
    'NOT_CONFIGURED',
  ])('asks the fallback when the primary fails with %s', async (code) => {
    const primary = model(FIXTURE_TARGET, FAIL(code, 2));
    const fallback = model(FIXTURE_TARGET_B, REPLY('from the fallback'));
    const outcome = await completeWithFallback(
      { primary, fallback },
      request()
    );
    expect(outcome.answer?.text).toBe('from the fallback');
    expect(outcomeShape(outcome)).toEqual({
      by: 'FALLBACK',
      answered: true,
      attempts: [
        ['PRIMARY', code],
        ['FALLBACK', 'OK'],
      ],
      skipped: null,
      failure: null,
    });
    expect(primary.count).toBe(1);
    expect(fallback.count).toBe(1);
  });

  it('reports each call on its own line, with its own usage, for the ledger', async () => {
    const primary = model(FIXTURE_TARGET, FAIL('HTTP_503', 2));
    const fallback = model(FIXTURE_TARGET_B, REPLY('ok', 4321));
    const outcome = await completeWithFallback(
      { primary, fallback },
      request()
    );
    const [first, second] = outcome.attempts;
    expect(first).toMatchObject({
      slot: 'PRIMARY',
      result: { ok: false, model: 'fixture-a/recorded', attempts: 2 },
    });
    expect(second?.slot).toBe('FALLBACK');
    expect(second?.result.ok && second.result.usage.cost_micro_usd).toBe(4321);
    expect(second?.result.ok && second.result.model).toBe('fixture-b/recorded');
  });

  it('says so when both fail, with the last code and every attempt', async () => {
    const primary = model(FIXTURE_TARGET, FAIL('TIMEOUT', 2));
    const fallback = model(FIXTURE_TARGET_B, FAIL('HTTP_503', 2));
    const outcome = await completeWithFallback(
      { primary, fallback },
      request()
    );
    expect(outcome.answer).toBeNull();
    expect(outcomeShape(outcome)).toEqual({
      by: null,
      answered: false,
      attempts: [
        ['PRIMARY', 'TIMEOUT'],
        ['FALLBACK', 'HTTP_503'],
      ],
      skipped: null,
      failure: 'HTTP_503',
    });
  });

  it('asks each model at most once', async () => {
    const primary = model(FIXTURE_TARGET, FAIL('TIMEOUT'));
    const fallback = model(FIXTURE_TARGET_B, FAIL('TIMEOUT'));
    await completeWithFallback({ primary, fallback }, request());
    expect(primary.count).toBe(1);
    expect(fallback.count).toBe(1);
  });

  describe('when the fallback is not asked', () => {
    it('has no model at all: NO_MODEL, and nothing is called', async () => {
      const outcome = await completeWithFallback(
        { primary: null, fallback: null },
        request()
      );
      expect(outcomeShape(outcome)).toEqual({
        by: null,
        answered: false,
        attempts: [],
        skipped: null,
        failure: 'NO_MODEL',
      });
      const lone = model(FIXTURE_TARGET_B, REPLY('x'));
      const alone = await completeWithFallback(
        { primary: null, fallback: lone },
        request()
      );
      expect(alone.failure).toBe('NO_MODEL');
      expect(lone.count).toBe(0);
    });

    it('has no fallback named: NO_FALLBACK, and the failure is the primary’s', async () => {
      const primary = model(FIXTURE_TARGET, FAIL('HTTP_503'));
      const outcome = await completeWithFallback(
        { primary, fallback: null },
        request()
      );
      expect(outcomeShape(outcome)).toEqual({
        by: null,
        answered: false,
        attempts: [['PRIMARY', 'HTTP_503']],
        skipped: 'NO_FALLBACK',
        failure: 'HTTP_503',
      });
    });

    it('has a fallback of the same vendor: SAME_PROVIDER (ADR-055)', async () => {
      const primary = model(FIXTURE_TARGET, FAIL('HTTP_503'));
      const sameVendor = model(
        { ...FIXTURE_TARGET_B, slug: 'fixture-a/other' },
        REPLY('x')
      );
      const outcome = await completeWithFallback(
        { primary, fallback: sameVendor },
        request()
      );
      expect(outcomeShape(outcome)).toEqual({
        by: null,
        answered: false,
        attempts: [['PRIMARY', 'HTTP_503']],
        skipped: 'SAME_PROVIDER',
        failure: 'HTTP_503',
      });
      expect(sameVendor.count).toBe(0);
    });

    it('has a deadline that passed: the primary was ABORTED', async () => {
      const primary = model(FIXTURE_TARGET, FAIL('ABORTED'));
      const fallback = model(FIXTURE_TARGET_B, REPLY('x'));
      const outcome = await completeWithFallback(
        { primary, fallback },
        request()
      );
      expect(outcomeShape(outcome)).toEqual({
        by: null,
        answered: false,
        attempts: [['PRIMARY', 'ABORTED']],
        skipped: 'ABORTED',
        failure: 'ABORTED',
      });
      expect(fallback.count).toBe(0);
    });

    it('has a deadline that passed while the primary was failing for another reason', async () => {
      const controller = new AbortController();
      const primary = model(FIXTURE_TARGET, FAIL('HTTP_503'));
      const fallback = model(FIXTURE_TARGET_B, REPLY('x'));
      const spy = jest
        .spyOn(primary, 'complete')
        .mockImplementation(async () => {
          controller.abort();
          return {
            ok: false,
            code: 'HTTP_503',
            model: 'fixture-a/recorded',
            latency_ms: 0,
            attempts: 2,
          };
        });
      const outcome = await completeWithFallback(
        { primary, fallback },
        request({ signal: controller.signal })
      );
      spy.mockRestore();
      expect(outcome.fallback_skipped).toBe('ABORTED');
      expect(fallback.count).toBe(0);
    });
  });

  describe('a fallback that cannot take the request', () => {
    it('with a smaller window than the prompt: refused by itself, nothing sent, the reason in the attempts', async () => {
      const primary = model(FIXTURE_TARGET, FAIL('HTTP_503'));
      const small = createFixtureModel({
        target: { ...FIXTURE_TARGET_B, context_budget: 10_000 },
        scenarios: { default: [REPLY('x')] },
      });
      const outcome = await completeWithFallback(
        { primary, fallback: small },
        request({ estimated_prompt_tokens: 18_000 })
      );
      expect(outcome.answer).toBeNull();
      expect(outcome.failure).toBe('CONTEXT_TOO_LARGE');
      const second = outcome.attempts[1];
      expect(second?.slot).toBe('FALLBACK');
      expect(second?.result).toMatchObject({
        ok: false,
        code: 'CONTEXT_TOO_LARGE',
        attempts: 0,
      });
    });

    it('lets a prompt through that fits the fallback’s window', async () => {
      const primary = model(FIXTURE_TARGET, FAIL('HTTP_503'));
      const small = createFixtureModel({
        target: { ...FIXTURE_TARGET_B, context_budget: 20_000 },
        scenarios: { default: [REPLY('fits')] },
      });
      const outcome = await completeWithFallback(
        { primary, fallback: small },
        request({ estimated_prompt_tokens: 18_000 })
      );
      expect(outcome.answer?.text).toBe('fits');
    });

    it('that cannot read the chart: VISION_UNSUPPORTED, nothing sent', async () => {
      const primary = model(FIXTURE_TARGET, FAIL('HTTP_503'));
      const blind = model({ ...FIXTURE_TARGET_B, vision: false }, REPLY('x'));
      const withChart = request({
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: 'q' },
              { type: 'image', url: 'https://charts.example.com/m5.png' },
            ],
          },
        ],
      });
      const outcome = await completeWithFallback(
        { primary, fallback: blind },
        withChart
      );
      expect(outcome.failure).toBe('VISION_UNSUPPORTED');
      expect(outcome.attempts[1]?.result).toMatchObject({
        ok: false,
        attempts: 0,
      });
    });

    it('is asked for less than the request when it can write less, never more', async () => {
      const primary = model(FIXTURE_TARGET, FAIL('HTTP_503'));
      const short = createFixtureModel({
        target: { ...FIXTURE_TARGET_B, max_output_tokens: 1_000 },
        scenarios: { default: [REPLY('ok')] },
      });
      await completeWithFallback(
        { primary, fallback: short },
        request({ max_output_tokens: 3_000 })
      );
      expect(short.calls[0]?.max_output_tokens).toBe(1_000);
      expect(primary.calls[0]?.max_output_tokens).toBe(3_000);

      const long = model(FIXTURE_TARGET_B, REPLY('ok'));
      const primary2 = model(FIXTURE_TARGET, FAIL('HTTP_503'));
      await completeWithFallback(
        { primary: primary2, fallback: long },
        request({ max_output_tokens: 1_200 })
      );
      expect(long.calls[0]?.max_output_tokens).toBe(1_200);
    });
  });
});

// ---------------------------------------------------------------------------------------

describe('the launch plan, through the kill switch, to the ports', () => {
  const rows = loadRegistry([
    registryRow({ slug: 'vendor-a/one', launch_role: 'default' }),
    registryRow({ slug: 'vendor-b/two', launch_role: 'fallback' }),
  ]);
  const config = { apiKey: KEY };

  it('builds two ports for a full plan, none for an empty one', () => {
    const full = launchPorts(config, planLaunch(new Set(), rows));
    expect(full.primary?.target.slug).toBe('vendor-a/one');
    expect(full.fallback?.target.slug).toBe('vendor-b/two');
    expect(
      launchPorts(config, planLaunch(new Set(), loadRegistry(AI_MODELS)))
    ).toEqual({
      primary: null,
      fallback: null,
    });
  });

  it('with the default switched off, the fallback model asks alone', () => {
    const ports = launchPorts(
      config,
      planLaunch(parseDisabledModels('vendor-a/one'), rows)
    );
    expect(ports.primary?.target.slug).toBe('vendor-b/two');
    expect(ports.fallback).toBeNull();
  });

  it('with the fallback switched off, the default asks alone', () => {
    const ports = launchPorts(
      config,
      planLaunch(parseDisabledModels('vendor-b/two'), rows)
    );
    expect(ports.primary?.target.slug).toBe('vendor-a/one');
    expect(ports.fallback).toBeNull();
  });

  it('with both switched off, nobody: NO_MODEL', async () => {
    const ports = launchPorts(
      config,
      planLaunch(parseDisabledModels('vendor-a/one,vendor-b/two'), rows)
    );
    const outcome = await completeWithFallback(ports, request());
    expect(outcome.failure).toBe('NO_MODEL');
  });

  it('calls the primary and then the fallback of the plan, each by its own slug, and no key outside the header', async () => {
    const seen: string[] = [];
    const fake = fetchFake((_url, init) => {
      const slug = JSON.parse(String(init.body)).model as string;
      seen.push(slug);
      return slug === 'vendor-a/one'
        ? new Response('down', { status: 503 })
        : completion('{"headline":"x"}');
    });
    const ports = launchPorts(config, planLaunch(new Set(), rows), {
      fetchImpl: fake.fetch,
      retries: 0,
    });
    const outcome = await completeWithFallback(ports, request());
    expect(seen).toEqual(['vendor-a/one', 'vendor-b/two']);
    expect(outcome.answered_by).toBe('FALLBACK');
    for (const c of fake.calls) {
      expect(String(c.init.body)).not.toContain(KEY);
      expect(c.headers['Authorization']).toBe(`Bearer ${KEY}`);
      expect(c.body.provider.data_collection).toBe('deny');
    }
  });

  describe('the waits of decision D23', () => {
    beforeEach(() => jest.useFakeTimers());
    afterEach(() => jest.useRealTimers());

    const hanging: Handler = (_url, init) =>
      new Promise((_resolve, reject) => {
        (init.signal as AbortSignal).addEventListener('abort', () =>
          reject(Object.assign(new Error('aborted'), { name: 'AbortError' }))
        );
      });

    it('the primary waits 25 seconds, then the fallback is asked', async () => {
      const fake = fetchFake((_url, init) =>
        JSON.parse(String(init.body)).model === 'vendor-a/one'
          ? hanging(_url, init)
          : completion('{"headline":"x"}')
      );
      const ports = launchPorts(config, planLaunch(new Set(), rows), {
        fetchImpl: fake.fetch,
        retries: 0,
      });
      const pending = completeWithFallback(ports, request());
      await jest.advanceTimersByTimeAsync(ANSWER_TIMEOUT_MS - 1);
      expect(fake.calls).toHaveLength(1);
      await jest.advanceTimersByTimeAsync(1);
      const outcome = await pending;
      expect(fake.calls).toHaveLength(2);
      expect(outcome.answered_by).toBe('FALLBACK');
    });

    it('the fallback waits 20 seconds', async () => {
      const fake = fetchFake((url, init) =>
        JSON.parse(String(init.body)).model === 'vendor-a/one'
          ? new Response('down', { status: 503 })
          : hanging(url, init)
      );
      const ports = launchPorts(config, planLaunch(new Set(), rows), {
        fetchImpl: fake.fetch,
        retries: 0,
      });
      const pending = completeWithFallback(ports, request());
      await jest.advanceTimersByTimeAsync(FALLBACK_TIMEOUT_MS - 1);
      expect(fake.calls).toHaveLength(2);
      expect((fake.calls[1]?.init.signal as AbortSignal).aborted).toBe(false);
      await jest.advanceTimersByTimeAsync(1);
      const outcome = await pending;
      expect(outcome.failure).toBe('TIMEOUT');
      expect(outcome.attempts.map((a) => a.slot)).toEqual([
        'PRIMARY',
        'FALLBACK',
      ]);
    });
  });
});
