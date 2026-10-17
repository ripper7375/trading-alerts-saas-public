/**
 * The fixture model: a deterministic stand-in for a real model (build step 7 part 3; plan
 * section 4 and part 10).
 *
 * It makes everything around a model testable without a key, a network or a paid call: the
 * assembler's output goes in, a RECORDED or PLANTED reply comes out, the real checks, gate,
 * ledger and orchestrator run around it, and it COUNTS what it was asked. It is a `ModelPort`
 * like the real one and refuses a request the same way the real port does (an image for a model
 * that cannot read one, a prompt over its window, a malformed request), so a test of the fallback
 * can use two fixtures of two vendors.
 *
 * SCRIPTS. A scenario is a list of scripts played in order, the last one repeating: call one
 * answers with a planted wrong price, call two (the regeneration) with the good reply. A script
 * is a reply with its usage, or a failure with its code (`TIMEOUT`, `HTTP_503`, `BAD_RESPONSE`, ...).
 * Which scenario a request belongs to is the caller's `select` function (default: one scenario,
 * `default`). A request for a scenario nobody scripted is a loud error (a throw), not a silent
 * empty answer: a test that forgot to script is a test that proves nothing.
 *
 * USAGE. Unless a script says otherwise, the usage of a reply is derived from the text by the
 * deterministic estimator: the prompt tokens from every text part of the request, the completion
 * tokens from the reply, nothing cached, and a reported cost of zero micro-dollars. So the same
 * run gives the same numbers on every machine.
 *
 * PLANTED ERRORS. `plantLiteral` puts a wrong value into a good reply (it throws when the value to
 * replace is not there, so a planted error can never silently not be planted) and `badJson` cuts a
 * JSON reply short. They are the building blocks of the planted corpora of part 4 and part 10.
 *
 * Pure: no I/O, no clock, no randomness. Used by tests and by the offline evaluation; production
 * code does not import it.
 *
 * @module lib/reply/gateway/fixture
 */

import 'server-only';

import { DEFAULT_CALIBRATION, estimateRawTokens } from '../context/tokens';

import { requestProblem, responseModeFor } from './openrouter';
import type {
  GatewayErrorCode,
  ModelCallResult,
  ModelPort,
  ModelRequest,
  ModelTarget,
  UsageCapture,
} from './types';

/** A fixture model that can see, enforces a schema and has a window no test prompt fills. */
export const FIXTURE_TARGET: ModelTarget = Object.freeze({
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

/** A second fixture model of ANOTHER vendor: the pair a fallback test needs. */
export const FIXTURE_TARGET_B: ModelTarget = Object.freeze({
  ...FIXTURE_TARGET,
  slug: 'fixture-b/recorded',
});

export interface FixtureReply {
  kind: 'REPLY';
  text: string;
  /** replaces the derived figures it names */
  usage?: Partial<
    Pick<
      UsageCapture,
      'prompt_tokens' | 'completion_tokens' | 'cached_tokens' | 'cost_micro_usd'
    >
  >;
  finish_reason?: string;
  latency_ms?: number;
}

export interface FixtureFailure {
  kind: 'FAIL';
  code: GatewayErrorCode;
  /** how many attempts the real port would have made before giving up; default 1 */
  attempts?: number;
}

export type FixtureScript = FixtureReply | FixtureFailure;

export interface FixtureOptions {
  target?: ModelTarget;
  scenarios: Readonly<Record<string, readonly FixtureScript[]>>;
  select?: (request: ModelRequest) => string;
}

export interface FixtureModel extends ModelPort {
  /** every request that reached the model, in order (the abort signal is left out) */
  readonly calls: readonly ModelRequest[];
  /** the number of requests that reached the model, including refused ones */
  readonly count: number;
  /** forget the calls and start every scenario again */
  reset(): void;
}

export const DEFAULT_SCENARIO = 'default';

function promptText(request: ModelRequest): string {
  const parts: string[] = [];
  for (const message of request.messages) {
    if (typeof message.content === 'string') {
      parts.push(message.content);
    } else {
      for (const part of message.content) {
        if (part.type === 'text') parts.push(part.text);
      }
    }
  }
  return parts.join('\n');
}

export function createFixtureModel(options: FixtureOptions): FixtureModel {
  const target = options.target ?? FIXTURE_TARGET;
  const select = options.select ?? (() => DEFAULT_SCENARIO);
  const calls: ModelRequest[] = [];
  const played = new Map<string, number>();

  const failure = (
    code: GatewayErrorCode,
    attempts: number,
    latency = 0
  ): ModelCallResult => ({
    ok: false,
    code,
    model: target.slug,
    latency_ms: latency,
    attempts,
  });

  return {
    target,
    get calls() {
      return calls;
    },
    get count() {
      return calls.length;
    },
    reset() {
      calls.length = 0;
      played.clear();
    },
    async complete(request: ModelRequest): Promise<ModelCallResult> {
      const { signal, ...recorded } = request;
      calls.push(recorded);
      if (signal?.aborted === true) return failure('ABORTED', 0);
      const problem = requestProblem(target, request);
      if (problem !== null) return failure(problem, 0);

      const scenario = select(request);
      const scripts = options.scenarios[scenario];
      if (scripts === undefined || scripts.length === 0) {
        throw new Error(
          `the fixture model has no script for scenario "${scenario}"`
        );
      }
      const turn = played.get(scenario) ?? 0;
      played.set(scenario, turn + 1);
      const script = scripts[
        Math.min(turn, scripts.length - 1)
      ] as FixtureScript;

      if (script.kind === 'FAIL') {
        return failure(script.code, script.attempts ?? 1, 0);
      }
      const usage: UsageCapture = {
        prompt_tokens:
          script.usage?.prompt_tokens ?? estimateRawTokens(promptText(request)),
        completion_tokens:
          script.usage?.completion_tokens ?? estimateRawTokens(script.text),
        cached_tokens: script.usage?.cached_tokens ?? 0,
        cost_micro_usd: script.usage?.cost_micro_usd ?? 0,
        cost_flag: null,
      };
      return {
        ok: true,
        text: script.text,
        model: target.slug,
        served_model: target.slug,
        host: 'fixture',
        generation_id: `fixture-${calls.length}`,
        response_mode: responseModeFor(target, request),
        finish_reason: script.finish_reason ?? 'stop',
        usage,
        latency_ms: script.latency_ms ?? 0,
        attempts: 1,
      };
    },
  };
}

// ---------------------------------------------------------------------------------------
// Planted errors
// ---------------------------------------------------------------------------------------

/** `text` with the first `from` replaced by `to`; throws when `from` is not in it. */
export function plantLiteral(text: string, from: string, to: string): string {
  const at = text.indexOf(from);
  if (from === '' || at < 0) {
    throw new Error(`cannot plant an error: "${from}" is not in the reply`);
  }
  return text.slice(0, at) + to + text.slice(at + from.length);
}

/** A JSON reply cut short, so that it no longer parses. */
export function badJson(text: string): string {
  const cut = text.slice(0, Math.max(1, Math.floor(text.length / 2)));
  try {
    JSON.parse(cut);
  } catch {
    return cut;
  }
  // a prefix that still parses (a bare number, say): break it on purpose
  return `${cut}{`;
}
