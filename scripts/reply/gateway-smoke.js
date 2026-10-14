#!/usr/bin/env node
/**
 * The first contact with OpenRouter (build step 7 part 3; runbook stage S1; decisions D1, D5, D25).
 *
 * The gateway adapter (`lib/reply/gateway/openrouter.ts`) was written from OpenRouter's documented
 * format and has never been called against a real endpoint; the registry (`config/ai-models.ts`)
 * holds six candidates whose slugs, prices and features nobody has checked. This script is the one
 * place those two meet the live service. IT IS NEVER RUN IN CI and no test calls the real service:
 * the tests of this script talk to a local fake server.
 *
 * WHAT IT DOES
 *   --help          this text. Needs nothing.
 *   --list-models   Reads OpenRouter's public model list (NO key is sent: the list is public) and
 *                   prints, for every model in the registry, what the service says next to what the
 *                   registry says: whether the slug exists, the context, the price per million
 *                   tokens, image input, structured outputs. A difference is marked `<>`. This is the
 *                   free step: run it before there is a key.
 *   --call          Spends money. For each model it makes a few tiny calls THROUGH THE REAL ADAPTER
 *                   (so the request is exactly what production sends, the privacy field included):
 *                     json_object   a JSON reply
 *                     json_schema   a reply under a strict schema
 *                     vision        a one-pixel image
 *                     cache         (only with --probe-cache) two calls with one long prefix
 *                   It reports what answered, the reported cost, the tokens and the time, and prints
 *                   the registry fields it would propose. It stops when the money spent reaches the
 *                   cap. Needs OPENROUTER_API_KEY (or its older name INTAKE_UNDERSTAND_API_KEY).
 *
 * IT NEVER EDITS THE REGISTRY. A person writes the verified fields, with the date they were read
 * (`verified_at`, `priced_at`), into `config/ai-models.ts`; the registry's checker then holds the row
 * to them. A model for which no host that keeps no prompts answers (ADR-077) is not eligible.
 *
 * USAGE (from the repository root)
 *   node scripts/reply/gateway-smoke.js --help
 *   node scripts/reply/gateway-smoke.js --list-models [--json]
 *   node scripts/reply/gateway-smoke.js --call [--model <slug>]... [--cap-usd 1] [--probe-cache] [--json]
 *
 *   --model <slug>   only this model (repeatable); default: every model of the registry
 *   --cap-usd <n>    the most this run may spend, in US dollars: default 1, at most 10 (decision D25
 *                    puts the whole initial evaluation at $5 to $10)
 *   OPENROUTER_BASE_URL   another base URL (a proxy, or the fake server of the tests)
 *
 * THE KEY is read from the environment, goes into the adapter's Authorization header and nowhere
 * else, and every line this script prints is scrubbed of it first.
 *
 * Exit codes: 0 done and nothing differs or failed; 1 a difference or a failed probe; 2 usage, a
 * missing key, or a service that could not be reached. Needs `tsx` (a devDependency) to read the
 * TypeScript registry and adapter.
 */

'use strict';

const path = require('path');

const DEFAULT_BASE_URL = 'https://openrouter.ai/api/v1';
const MAX_CAP_USD = 10;
const DEFAULT_CAP_USD = 1;
/** What a call whose cost the service did not report is counted as, so the cap still holds. */
const UNREPORTED_CALL_USD = 0.02;
/** Lines of the cache probe's fixed prefix. */
const CACHE_PREFIX_LINES = 300;
const ONE_PIXEL_PNG =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';

class UsageError extends Error {}

const HELP = `gateway-smoke: the first contact with OpenRouter (runbook S1)

  node scripts/reply/gateway-smoke.js --help
  node scripts/reply/gateway-smoke.js --list-models [--json]
  node scripts/reply/gateway-smoke.js --call [--model <slug>]... [--cap-usd 1] [--probe-cache] [--json]

  --list-models   public model list vs the registry; sends no key, costs nothing
  --call          tiny real calls through the real adapter; costs money (cap: --cap-usd, default ${DEFAULT_CAP_USD}, at most ${MAX_CAP_USD})
  --model <slug>  only this model (repeatable)
  --probe-cache   also ask whether prompt caching engages (a pair of calls with one long prefix, first
                  with no marker, then, if nothing was cached, with an explicit breakpoint)
  --json          print one JSON document instead of text

It never edits config/ai-models.ts: a person writes the verified fields and their dates.
Never run in CI. --call needs OPENROUTER_API_KEY (or INTAKE_UNDERSTAND_API_KEY).`;

// ---------------------------------------------------------------------------------------
// Arguments
// ---------------------------------------------------------------------------------------

function parseArgs(argv) {
  const args = {
    help: false,
    list: false,
    call: false,
    json: false,
    probeCache: false,
    capUsd: DEFAULT_CAP_USD,
    models: [],
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--help' || arg === '-h') args.help = true;
    else if (arg === '--list-models') args.list = true;
    else if (arg === '--call') args.call = true;
    else if (arg === '--json') args.json = true;
    else if (arg === '--probe-cache') args.probeCache = true;
    else if (arg === '--model') {
      const value = argv[(i += 1)];
      if (value === undefined || value.startsWith('--')) {
        throw new UsageError('--model needs a slug');
      }
      args.models.push(value);
    } else if (arg === '--cap-usd') {
      const value = Number(argv[(i += 1)]);
      if (!Number.isFinite(value) || value <= 0) {
        throw new UsageError('--cap-usd needs a number above zero');
      }
      if (value > MAX_CAP_USD) {
        throw new UsageError(
          `--cap-usd is at most ${MAX_CAP_USD} (decision D25: the initial evaluation is $5 to $10)`
        );
      }
      args.capUsd = value;
    } else {
      throw new UsageError(`unknown argument ${arg}`);
    }
  }
  if (args.help) return args;
  const modes = [args.list, args.call].filter(Boolean).length;
  if (modes === 0)
    throw new UsageError('say what to do: --help, --list-models or --call');
  if (modes > 1) throw new UsageError('give one of --list-models, --call');
  if (args.probeCache && !args.call)
    throw new UsageError('--probe-cache belongs to --call');
  return args;
}

// ---------------------------------------------------------------------------------------
// Output, scrubbed of the key
// ---------------------------------------------------------------------------------------

/** Replace every occurrence of the key in a text. */
function scrub(text, key) {
  if (typeof key !== 'string' || key.length < 8) return text;
  return text.split(key).join('[key]');
}

function makeOut(key, sink) {
  return (line = '') => sink(scrub(String(line), key));
}

// ---------------------------------------------------------------------------------------
// The public model list
// ---------------------------------------------------------------------------------------

const perMillion = (perToken) => {
  const n = Number(perToken);
  return Number.isFinite(n) ? Math.round(n * 1e6 * 1e6) / 1e6 : null;
};

/** What the service says of one model, in the registry's own terms (null where it does not say). */
function summariseLive(entry) {
  if (entry === undefined || entry === null || typeof entry !== 'object')
    return null;
  const supported = Array.isArray(entry.supported_parameters)
    ? entry.supported_parameters
    : null;
  const modalities =
    entry.architecture && Array.isArray(entry.architecture.input_modalities)
      ? entry.architecture.input_modalities
      : null;
  return {
    context_tokens: Number.isInteger(entry.context_length)
      ? entry.context_length
      : null,
    max_output_tokens:
      entry.top_provider &&
      Number.isInteger(entry.top_provider.max_completion_tokens)
        ? entry.top_provider.max_completion_tokens
        : null,
    price_in: entry.pricing ? perMillion(entry.pricing.prompt) : null,
    price_out: entry.pricing ? perMillion(entry.pricing.completion) : null,
    price_cache_read: entry.pricing
      ? perMillion(entry.pricing.input_cache_read)
      : null,
    vision: modalities === null ? null : modalities.includes('image'),
    json_schema:
      supported === null ? null : supported.includes('structured_outputs'),
    json_object:
      supported === null ? null : supported.includes('response_format'),
  };
}

/**
 * Rows of [field, live, registry, differs] for one registry model against the service's list. An
 * unverified field has no registry value to differ from; `cache read $/M` is information (what a
 * cached input token costs) and never a difference.
 */
function compareModel(row, live) {
  if (live === null) return null;
  const unverified = row.verified_at === null;
  const fields = [
    [
      'context_tokens',
      live.context_tokens,
      unverified ? 'unverified' : row.context_tokens,
    ],
    [
      'max_output_tokens',
      live.max_output_tokens,
      unverified ? 'unverified' : row.max_output_tokens,
    ],
    [
      'price_in $/M',
      live.price_in,
      row.price_in === null ? 'unverified' : row.price_in,
    ],
    [
      'price_out $/M',
      live.price_out,
      row.price_out === null ? 'unverified' : row.price_out,
    ],
    ['vision', live.vision, unverified ? 'unverified' : row.vision],
    [
      'json_schema',
      live.json_schema,
      unverified ? 'unverified' : row.json_schema,
    ],
  ];
  const rows = fields.map(([name, liveValue, registryValue]) => [
    name,
    liveValue,
    registryValue,
    registryValue !== 'unverified' &&
      String(liveValue) !== String(registryValue),
  ]);
  rows.push([
    'cache read $/M',
    live.price_cache_read,
    `(registry: ${row.prompt_caching})`,
    false,
  ]);
  return rows;
}

/** 0 when every model was found and none differs, else 1. */
function listExitCode(missing, differs) {
  return missing === 0 && differs === 0 ? 0 : 1;
}

/**
 * The registry beside the service's list: one entry per registry model (only `only` when it is not
 * empty), how many were not found, and how many differ in a field the registry has verified.
 */
function buildListReport(registry, data, only) {
  const byId = new Map(data.map((entry) => [entry && entry.id, entry]));
  const report = [];
  let differs = 0;
  let missing = 0;
  for (const row of registry) {
    if (only.length > 0 && !only.includes(row.slug)) continue;
    const live = summariseLive(byId.get(row.slug));
    const rows = compareModel(row, live);
    if (rows === null) missing += 1;
    else if (rows.some((r) => r[3])) differs += 1;
    report.push({
      slug: row.slug,
      name: row.name,
      found: live !== null,
      live,
      rows,
    });
  }
  return { report, missing, differs };
}

async function listModels(args, ctx) {
  const { registry, fetchImpl, baseUrl, out } = ctx;
  const response = await fetchImpl(`${baseUrl.replace(/\/+$/, '')}/models`, {
    method: 'GET',
    headers: { Accept: 'application/json' },
    redirect: 'error',
  });
  if (!response.ok) {
    throw new UsageError(`the model list answered HTTP ${response.status}`);
  }
  const body = await response.json();
  const data = body && Array.isArray(body.data) ? body.data : null;
  if (data === null)
    throw new UsageError(
      'the model list has a shape this script does not know'
    );
  const { report, missing, differs } = buildListReport(
    registry,
    data,
    args.models
  );

  if (args.json) {
    out(JSON.stringify({ mode: 'list-models', models: report }, null, 2));
  } else {
    out(`registry vs ${baseUrl}/models (${data.length} models listed)`);
    for (const item of report) {
      out('');
      out(`${item.slug}  (${item.name})`);
      if (!item.found) {
        out(
          '  NOT FOUND in the live list: the slug is wrong, or the model is not served. Correct the registry.'
        );
        continue;
      }
      for (const [name, liveValue, registryValue, differ] of item.rows) {
        out(
          `  ${differ ? '<>' : '  '} ${name.padEnd(18)} live ${String(liveValue).padEnd(12)} registry ${registryValue}`
        );
      }
    }
    out('');
    out(
      `${missing} not found, ${differs} with a difference. Nothing was written.`
    );
  }
  return listExitCode(missing, differs);
}

// ---------------------------------------------------------------------------------------
// The calls
// ---------------------------------------------------------------------------------------

const SMOKE_SCHEMA = {
  type: 'object',
  properties: { ok: { type: 'boolean' } },
  required: ['ok'],
  additionalProperties: false,
};

function probeRequest(kind) {
  const base = {
    temperature: 0,
    max_output_tokens: 48,
    timeout_ms: 30_000,
  };
  const system = { role: 'system', content: 'You answer with JSON only.' };
  if (kind === 'json_object') {
    return {
      ...base,
      messages: [system, { role: 'user', content: 'Return {"ok": true}.' }],
      response: { kind: 'JSON_OBJECT' },
    };
  }
  if (kind === 'json_schema') {
    return {
      ...base,
      messages: [system, { role: 'user', content: 'Return {"ok": true}.' }],
      response: { kind: 'JSON_SCHEMA', name: 'smoke', schema: SMOKE_SCHEMA },
    };
  }
  if (kind === 'vision') {
    return {
      ...base,
      messages: [
        system,
        {
          role: 'user',
          content: [
            { type: 'text', text: 'There is a picture. Return {"ok": true}.' },
            { type: 'image', url: ONE_PIXEL_PNG },
          ],
        },
      ],
      response: { kind: 'JSON_OBJECT' },
    };
  }
  // cache: one long, fixed prefix (about 3,000 tokens: providers cache from 1,024 to 2,048 up), then a short question
  const filler = Array.from(
    { length: CACHE_PREFIX_LINES },
    (_, i) => `Line ${i + 1}: the board is quiet.`
  ).join('\n');
  return {
    ...base,
    messages: [
      {
        role: 'system',
        content: [
          {
            type: 'text',
            text: `${filler}\nYou answer with JSON only.`,
            cacheable: true,
          },
        ],
      },
      { role: 'user', content: 'Return {"ok": true}.' },
    ],
    response: { kind: 'JSON_OBJECT' },
  };
}

function judge(kind, result) {
  if (!result.ok) return { kind, passed: false, code: result.code };
  let parsed = null;
  try {
    parsed = JSON.parse(result.text);
  } catch {
    // not JSON
  }
  const valid =
    parsed !== null && typeof parsed === 'object' && parsed.ok === true;
  return {
    kind,
    passed: valid,
    code: valid ? null : 'NOT_THE_JSON_ASKED_FOR',
    response_mode: result.response_mode,
    served_model: result.served_model,
    host: result.host,
    latency_ms: result.latency_ms,
    attempts: result.attempts,
    usage: result.usage,
  };
}

function usdOf(result) {
  if (!result.ok) return 0;
  const micro = result.usage && result.usage.cost_micro_usd;
  return Number.isInteger(micro) ? micro / 1e6 : UNREPORTED_CALL_USD;
}

/**
 * Does the second call of a pair come back with cached tokens? The pair is the same long, fixed
 * prefix twice. `mode` is the target's `prompt_caching`: AUTO sends no markers (a provider that
 * caches by prefix does it by itself), EXPLICIT marks the prefix with a breakpoint.
 */
async function probeCaching(ctx, config, target, mode, spend) {
  const t = { ...target, json_schema: false, prompt_caching: mode };
  const probes = [];
  for (let i = 0; i < 2; i += 1) {
    if (spend.over()) {
      spend.stopped = true;
      break;
    }
    const result = await ctx.gateway.callOpenRouter(
      config,
      t,
      probeRequest('cache'),
      {
        fetchImpl: ctx.fetchImpl,
        retries: 0,
      }
    );
    spend.add(usdOf(result));
    const judged = judge(`cache_${mode.toLowerCase()}`, result);
    if (!judged.passed) spend.failures += 1;
    probes.push(judged);
  }
  const second = probes[1];
  const cached = second && second.usage ? second.usage.cached_tokens : null;
  return { probes, engaged: Number.isInteger(cached) && cached > 0 };
}

async function callModels(args, ctx) {
  const { registry, gateway, out } = ctx;
  const config = gateway.gatewayConfigFromEnv(ctx.env);
  for (const slug of args.models) {
    if (!registry.some((row) => row.slug === slug)) {
      throw new UsageError(`${slug} is not in the registry`);
    }
  }
  const chosen = registry.filter(
    (row) => args.models.length === 0 || args.models.includes(row.slug)
  );
  const perModel = 3 + (args.probeCache ? 4 : 0);
  if (!args.json) {
    out(
      `calling ${chosen.length} model(s), up to ${perModel} call(s) each, cap $${args.capUsd.toFixed(2)}, through the real adapter (data_collection: deny)`
    );
  }

  const spend = {
    spent: 0,
    stopped: false,
    failures: 0,
    add(usd) {
      this.spent += usd;
    },
    over() {
      return this.spent >= args.capUsd;
    },
  };
  const report = [];
  for (const row of chosen) {
    const target = {
      slug: row.slug,
      vision: true, // the probe decides, not the registry's unverified placeholder
      context_budget: row.context_budget,
      max_output_tokens: 64,
      json_schema: false,
      prompt_caching: 'AUTO',
      provider_only: row.provider_only,
      price_in: row.price_in,
      price_out: row.price_out,
      calibration: row.calibration,
    };
    const probes = [];
    for (const kind of ['json_object', 'json_schema', 'vision']) {
      if (spend.over()) {
        spend.stopped = true;
        break;
      }
      // a SCHEMA request on a target that says it enforces one; the others are plain
      const t =
        kind === 'json_schema' ? { ...target, json_schema: true } : target;
      const result = await gateway.callOpenRouter(
        config,
        t,
        probeRequest(kind),
        {
          fetchImpl: ctx.fetchImpl,
          retries: 0,
        }
      );
      spend.add(usdOf(result));
      const judged = judge(kind, result);
      if (!judged.passed) spend.failures += 1;
      probes.push(judged);
    }

    let caching = 'not probed (use --probe-cache)';
    if (args.probeCache) {
      const auto = await probeCaching(ctx, config, target, 'AUTO', spend);
      probes.push(...auto.probes);
      if (auto.engaged) {
        caching = 'AUTO';
      } else {
        const explicit = await probeCaching(
          ctx,
          config,
          target,
          'EXPLICIT',
          spend
        );
        probes.push(...explicit.probes);
        caching = explicit.engaged ? 'EXPLICIT' : 'NONE';
      }
    }
    report.push({
      slug: row.slug,
      name: row.name,
      probes,
      proposal: propose(probes, caching),
    });
  }

  if (args.json) {
    out(
      JSON.stringify(
        {
          mode: 'call',
          spent_usd: Number(spend.spent.toFixed(6)),
          cap_usd: args.capUsd,
          stopped_at_cap: spend.stopped,
          models: report,
        },
        null,
        2
      )
    );
  } else {
    for (const item of report) {
      out('');
      out(`${item.slug}  (${item.name})`);
      for (const p of item.probes) {
        const cost =
          p.usage && Number.isInteger(p.usage.cost_micro_usd)
            ? `$${(p.usage.cost_micro_usd / 1e6).toFixed(6)}`
            : 'cost not reported';
        out(
          `  ${p.passed ? 'ok  ' : 'FAIL'} ${p.kind.padEnd(14)} ${
            p.passed
              ? `${p.latency_ms} ms, ${cost}, mode ${p.response_mode}, host ${p.host || '?'}`
              : p.code
          }`
        );
      }
      out('  proposed registry fields (a person writes them, with the date):');
      for (const [name, value] of Object.entries(item.proposal)) {
        out(`    ${name}: ${JSON.stringify(value)}`);
      }
    }
    out('');
    out(
      `spent about $${spend.spent.toFixed(6)} of the $${args.capUsd.toFixed(2)} cap${
        spend.stopped ? ' (STOPPED at the cap: some probes did not run)' : ''
      }. Nothing was written.`
    );
  }
  return spend.failures === 0 && !spend.stopped ? 0 : 1;
}

/** What the probes of one model suggest for its registry row. A suggestion, never an edit. */
function propose(probes, caching) {
  const passed = (kind) => probes.some((p) => p.kind === kind && p.passed);
  const reported = probes.filter(
    (p) =>
      p.usage &&
      Number.isInteger(p.usage.cost_micro_usd) &&
      p.usage.cost_flag === null
  );
  return {
    json_schema: passed('json_schema'),
    vision: passed('vision'),
    prompt_caching: caching,
    reports_cost: reported.length > 0,
    eligible_under_adr_077: probes.some((p) => p.passed)
      ? true
      : 'no host answered with data_collection: deny',
  };
}

// ---------------------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------------------

async function run(argv, env, io = {}) {
  const sink = io.sink || ((line) => process.stdout.write(`${line}\n`));
  const key = env.OPENROUTER_API_KEY || env.INTAKE_UNDERSTAND_API_KEY || '';
  const out = makeOut(key, sink);
  let args;
  try {
    args = parseArgs(argv);
    if (args.help) {
      out(HELP);
      return 0;
    }
    if (args.call && key === '') {
      throw new UsageError(
        '--call needs OPENROUTER_API_KEY (or INTAKE_UNDERSTAND_API_KEY) in the environment'
      );
    }

    // the TypeScript registry and adapter, read as they are in production
    const root = path.resolve(__dirname, '..', '..');
    require('tsx/cjs');
    const registry = require(
      path.join(root, 'lib/reply/gateway/registry.ts')
    ).AI_MODEL_REGISTRY;
    const gateway = require(path.join(root, 'lib/reply/gateway/openrouter.ts'));
    const baseUrl =
      env.OPENROUTER_BASE_URL ||
      env.INTAKE_UNDERSTAND_BASE_URL ||
      DEFAULT_BASE_URL;
    const ctx = {
      registry,
      gateway,
      baseUrl,
      key,
      env,
      out,
      fetchImpl: io.fetchImpl || fetch,
    };
    return args.list
      ? await listModels(args, ctx)
      : await callModels(args, ctx);
  } catch (error) {
    if (error instanceof UsageError) {
      out(`gateway-smoke: ${error.message}`);
      return 2;
    }
    // a failure of the script itself: the class and nothing from the message, which could hold anything
    out(
      `gateway-smoke: failed (${error && error.name ? error.name : 'Error'})`
    );
    return 2;
  }
}

if (require.main === module) {
  run(process.argv.slice(2), process.env).then(
    (code) => {
      process.exitCode = code;
    },
    () => {
      process.exitCode = 2;
    }
  );
}

module.exports = {
  parseArgs,
  scrub,
  summariseLive,
  compareModel,
  buildListReport,
  listExitCode,
  usdOf,
  probeRequest,
  judge,
  propose,
  run,
  UsageError,
  MAX_CAP_USD,
  DEFAULT_CAP_USD,
  DEFAULT_BASE_URL,
  UNREPORTED_CALL_USD,
  CACHE_PREFIX_LINES,
};
