#!/usr/bin/env node
/**
 * The evaluation run of the reply path (build step 7 part 10; runbook stages S2 and S3;
 * architecture 5.10, ADR-055, ADR-079; decisions D1, D19, D25).
 *
 * WHAT A RUN IS. Every cell of the golden scenarios (`config/reply/golden/scenarios.v1.json`: a
 * scenario, a trader type, a locale, a pass) goes through the REAL orchestrator, over the same world
 * the orchestrator tests use, and is recorded: what each model call returned, what it cost, what the
 * checks found, what the pipeline did. The record is `config/reply/eval-runs/<id>.json`, named by a
 * fingerprint of the model, the prompt, the wording lists, the caps and the scenarios, and the
 * release gate (`__tests__/lib/reply/eval-gate.test.ts`) refuses a model whose run is for another one.
 *
 * TWO KINDS.
 *   --stand-in   the fixture model writes the replies. FREE, offline, deterministic. It shows the
 *                mechanism and measures NOTHING about a model, a language or a price, and the gate
 *                refuses it as evidence by name. Every line it prints says so.
 *   --live       a real model, through OpenRouter, for the cells whose words the model writes
 *                (the staged failures are replayed from scripts and cost nothing). SPENDS MONEY.
 *                It needs a key, an explicit --cap-usd (decision D25: you set the budget before S2)
 *                and writes nothing unless you pass --write. IT NEVER EDITS THE REGISTRY: it prints
 *                the fields a person would write into config/ai-models.ts.
 *
 * COMMANDS (from the repository root)
 *   --help
 *   --stand-in [--write] [--passes N] [--date YYYY-MM-DD]
 *        record the stand-in run; with --write, to config/reply/eval-runs/stand-in.json
 *        (or to the file --out names).
 *   --check [--file F]
 *        record the stand-in run again and compare it with the committed one, byte for byte
 *        (exit 1 when they differ: the checks, the prompt, the lists, the caps or the scenarios moved).
 *   --replay FILE
 *        play the recorded replies of any run through the checks again with NO model call, and say
 *        what differs from the record (exit 1 when anything does).
 *   --report FILE
 *        print the table of 5.10 for a recorded run.
 *   --estimate --model SLUG
 *        how many calls a live run would make and the most they could cost, from the registry's
 *        prices (it calls nothing).
 *   --live --model SLUG --cap-usd N [--fallback SLUG] [--passes N] [--locales a,b] [--scenarios G01,G02]
 *          [--write] [--out FILE] [--date YYYY-MM-DD]
 *        the live run (default 2 passes: the plan repeats each scenario twice to damp noise).
 *
 * THE KEY (OPENROUTER_API_KEY, or the older INTAKE_UNDERSTAND_API_KEY) is read from the environment,
 * goes to the gateway adapter and nowhere else, and every line printed is scrubbed of it first.
 * OPENROUTER_BASE_URL names another base URL (a proxy, or the fake server of the tests).
 *
 * Exit codes: 0 done and every bar holds; 1 a bar fails or a difference was found; 2 usage, a
 * missing key, a file that cannot be read, or a run stopped at its cap. Needs `tsx` (a devDependency).
 */

'use strict';

const fs = require('fs');
const path = require('path');

const { boot, ROOT } = require('./ts-boot');
const RUNS_DIR = 'config/reply/eval-runs';
const STAND_IN_FILE = `${RUNS_DIR}/stand-in.json`;
const DEFAULT_LIVE_PASSES = 2;
const MAX_CAP_USD = 50;
/** What a call whose cost the service did not report is counted as, so the cap still holds. */
const UNREPORTED_CALL_MICRO_USD = 20_000;

class UsageError extends Error {}
class CapReached extends Error {}

const HELP = fs
  .readFileSync(__filename, 'utf8')
  .split('\n')
  .slice(1)
  .join('\n')
  .match(/\/\*\*\n([\s\S]*?)\n \*\//)[1]
  .split('\n')
  .map((line) => line.replace(/^ \* ?/, ''))
  .join('\n');

// ---------------------------------------------------------------------------------------
// Arguments
// ---------------------------------------------------------------------------------------

const VALUE_FLAGS = new Set([
  '--passes',
  '--date',
  '--file',
  '--replay',
  '--report',
  '--model',
  '--fallback',
  '--cap-usd',
  '--locales',
  '--scenarios',
  '--out',
]);
const BOOL_FLAGS = new Set([
  '--help',
  '--stand-in',
  '--check',
  '--estimate',
  '--live',
  '--write',
]);

function parseArgs(argv) {
  const args = { _: [] };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (BOOL_FLAGS.has(arg)) args[arg.slice(2)] = true;
    else if (VALUE_FLAGS.has(arg)) {
      const value = argv[i + 1];
      if (value === undefined || value.startsWith('--'))
        throw new UsageError(`${arg} needs a value`);
      args[arg.slice(2)] = value;
      i += 1;
    } else throw new UsageError(`unknown argument ${arg}`);
  }
  if (args.passes !== undefined) {
    const n = Number(args.passes);
    if (!Number.isInteger(n) || n < 1 || n > 5)
      throw new UsageError('--passes is a whole number from 1 to 5');
    args.passes = n;
  }
  if (args.date !== undefined && !/^\d{4}-\d{2}-\d{2}$/.test(args.date))
    throw new UsageError('--date is YYYY-MM-DD');
  if (args['cap-usd'] !== undefined) {
    const cap = Number(args['cap-usd']);
    if (!(cap > 0) || cap > MAX_CAP_USD)
      throw new UsageError(
        `--cap-usd is a number above 0 and at most ${MAX_CAP_USD}`
      );
    args['cap-usd'] = cap;
  }
  const modes = [
    'stand-in',
    'check',
    'estimate',
    'live',
    'replay',
    'report',
    'help',
  ].filter((m) => args[m] !== undefined);
  if (modes.length !== 1)
    throw new UsageError(
      'give exactly one of --stand-in, --check, --estimate, --live, --replay, --report, --help'
    );
  return args;
}

// ---------------------------------------------------------------------------------------
// The TypeScript side
// ---------------------------------------------------------------------------------------

const lf = (text) => text.replace(/\r\n/g, '\n');

function readRun(file) {
  const full = path.resolve(ROOT, file);
  if (!fs.existsSync(full)) throw new UsageError(`${file} does not exist`);
  try {
    return JSON.parse(lf(fs.readFileSync(full, 'utf8')));
  } catch (error) {
    throw new UsageError(`${file} is not JSON: ${error.message}`);
  }
}

function writeRun(ts, run, rel, out) {
  const full = path.resolve(ROOT, out || rel);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, ts.suite.runFileText(run), 'utf8');
}

const today = () => new Date().toISOString().slice(0, 10);

// ---------------------------------------------------------------------------------------
// Commands
// ---------------------------------------------------------------------------------------

async function standIn(args, out) {
  const ts = boot();
  const run = await ts.harness.recordRun({
    kind: 'STAND_IN',
    scenarios: ts.scenarios.SCENARIO_SET,
    passes: args.passes || 1,
    madeOn: args.date || today(),
    model: ts.harness.STAND_IN_MODEL,
  });
  out(ts.report.renderRunReport(run));
  if (args.write) {
    writeRun(ts, run, STAND_IN_FILE, args.out);
    out(`wrote ${args.out || STAND_IN_FILE}`);
  }
  return run.summary.all_pass ? 0 : 1;
}

async function check(args, out) {
  const ts = boot();
  const rel = args.file || STAND_IN_FILE;
  const committedText = lf(fs.readFileSync(path.resolve(ROOT, rel), 'utf8'));
  const committed = JSON.parse(committedText);
  const run = await ts.harness.recordRun({
    kind: 'STAND_IN',
    scenarios: ts.scenarios.SCENARIO_SET,
    passes: committed.passes,
    madeOn: committed.made_on,
    model: ts.harness.STAND_IN_MODEL,
  });
  const text = lf(ts.suite.runFileText(run));
  if (text === committedText) {
    out(
      `${rel} is what a fresh stand-in run gives (STAND-IN: the mechanism only)`
    );
    return 0;
  }
  out(`${rel} is NOT what a fresh stand-in run gives:`);
  const parts = [
    'model_slug',
    'provider',
    'prompt_version',
    'prompt_sha256',
    'wording_version',
    'wording_sha256',
    'caps_sha256',
    'scenario_set_sha256',
  ];
  const moved = parts.filter(
    (key) => committed.fingerprint[key] !== run.fingerprint[key]
  );
  if (
    moved.length > 0 ||
    committed.fingerprint.sha256 !== run.fingerprint.sha256
  ) {
    out(
      `  the fingerprint changed (${run.fingerprint.sha256.slice(0, 12)} now, ${committed.fingerprint.sha256.slice(0, 12)} recorded)`
    );
    for (const key of moved) out(`  - ${key} differs`);
  }
  const before = new Map(
    committed.cells.map((cell) => [cell.id, JSON.stringify(cell)])
  );
  let shown = 0;
  for (const cell of run.cells) {
    if (before.get(cell.id) !== JSON.stringify(cell)) {
      shown += 1;
      if (shown <= 10) out(`  cell ${cell.id} differs`);
    }
  }
  if (shown > 10) out(`  ... and ${shown - 10} more cells`);
  out(
    'Record it again with: node scripts/reply/eval-run.js --stand-in --write'
  );
  return 1;
}

async function replay(args, out) {
  const ts = boot();
  const run = readRun(args.replay);
  const structure = await ts.suite.runProblems(run);
  if (structure.length > 0) {
    for (const problem of structure) out(`- ${problem}`);
    return 1;
  }
  const scenarios = ts.scenarios.SCENARIO_SET.scenarios;
  const worldOf = await ts.harness.judgeWorldsFor(run, scenarios);
  const result = ts.suite.replayRun(run, scenarios, worldOf);
  if (run.kind === 'STAND_IN') out(ts.suite.STAND_IN_LABEL);
  if (result.problems.length === 0) {
    out(
      `${run.id}: every judgement and the summary are what the recorded replies give (${run.cells.length} cells, no model called)`
    );
    return 0;
  }
  for (const problem of result.problems.slice(0, 20)) out(`- ${problem}`);
  if (result.problems.length > 20)
    out(`... and ${result.problems.length - 20} more`);
  return 1;
}

async function reportOf(args, out) {
  const ts = boot();
  const run = readRun(args.report);
  out(ts.report.renderRunReport(run));
  return run.summary && run.summary.all_pass ? 0 : 1;
}

function modelRow(ts, slug, role, rows) {
  const row = (rows || ts.registry.AI_MODEL_REGISTRY).find(
    (candidate) => candidate.slug === slug
  );
  if (row === undefined)
    throw new UsageError(`${slug} is not in config/ai-models.ts`);
  if (!row.roles.includes(role))
    throw new UsageError(`${slug} is not an ${role} model`);
  return row;
}

function modelCells(ts, args) {
  const wantedLocales = args.locales ? args.locales.split(',') : null;
  const wantedScenarios = args.scenarios ? args.scenarios.split(',') : null;
  const known = new Set(ts.scenarios.SCENARIO_SET.scenarios.map((s) => s.id));
  for (const id of wantedScenarios || [])
    if (!known.has(id)) throw new UsageError(`unknown scenario ${id}`);
  for (const locale of wantedLocales || [])
    if (
      !ts.scenarios.SCENARIO_SET.scenarios.some((s) =>
        ts.scenarios.localesOf(s).includes(locale)
      )
    )
      throw new UsageError(`unknown locale ${locale}`);
  return (key) =>
    (wantedLocales === null || wantedLocales.includes(key.locale)) &&
    (wantedScenarios === null || wantedScenarios.includes(key.scenario));
}

async function estimate(args, out, io) {
  const ts = boot();
  if (!args.model) throw new UsageError('--estimate needs --model');
  const row = modelRow(ts, args.model, 'answer', io.registryRows);
  const passes = args.passes || DEFAULT_LIVE_PASSES;
  const keep = modelCells(ts, args);
  const byId = new Map(
    ts.scenarios.SCENARIO_SET.scenarios.map((s) => [s.id, s])
  );
  const keys = ts.scenarios
    .cellsOf(ts.scenarios.SCENARIO_SET.scenarios, passes)
    .filter((key) => keep(key) && byId.get(key.scenario).source === 'MODEL');
  const calls = keys.length;
  out(
    `${row.slug}: a live run of ${passes} pass(es) asks the model for ${calls} replies (the staged failures cost nothing).`
  );
  if (row.price_in === null || row.price_out === null) {
    out(
      'The registry holds no dated price for this model: run `node scripts/reply/gateway-smoke.js --list-models` (runbook S1) and write it first.'
    );
    return 0;
  }
  // the dearest a call can be: the prompt at its cap of 19,600 tokens (5.4) plus the largest reply; one regeneration is not counted (the scenarios of the live run expect none)
  const perCall =
    (19_600 * row.price_in + row.max_output_tokens * row.price_out) / 1e6;
  out(
    `Priced at ${row.price_in} / ${row.price_out} USD per million tokens (read ${row.priced_at}), the dearest possible call is about $${perCall.toFixed(4)}: at most about $${(perCall * calls).toFixed(2)} for the run. A real run costs less (most prompts are under the cap, and a cache lowers it); set --cap-usd above what you can afford to lose, not above this.`
  );
  return 0;
}

/**
 * A port that adds up what its calls cost. Once the cap is reached it makes no call at all (it
 * answers ABORTED), and the run stops after the cell that crossed it, so the most that can be spent
 * beyond the cap is the cost of the one call that crossed it.
 */
function capped(port, spend, capMicro) {
  return {
    target: port.target,
    complete: async (request) => {
      if (spend.micro >= capMicro) {
        return {
          ok: false,
          code: 'ABORTED',
          model: port.target.slug,
          latency_ms: 0,
          attempts: 0,
        };
      }
      const result = await port.complete(request);
      spend.calls += 1;
      if (result.ok) {
        const cost =
          result.usage && Number.isInteger(result.usage.cost_micro_usd)
            ? result.usage.cost_micro_usd
            : UNREPORTED_CALL_MICRO_USD;
        spend.micro += cost;
      }
      return result;
    },
  };
}

async function live(args, env, out, io) {
  // (`io.registryRows` is for the tests, which hand in a priced row; the command line always reads the registry)
  const key = env.OPENROUTER_API_KEY || env.INTAKE_UNDERSTAND_API_KEY || '';
  if (key === '')
    throw new UsageError(
      '--live needs OPENROUTER_API_KEY (or INTAKE_UNDERSTAND_API_KEY) in the environment'
    );
  if (!args.model) throw new UsageError('--live needs --model');
  if (args['cap-usd'] === undefined)
    throw new UsageError(
      '--live needs --cap-usd: you set the budget before the run (decision D25)'
    );
  const ts = boot();
  const primary = modelRow(ts, args.model, 'answer', io.registryRows);
  const fallback = args.fallback
    ? modelRow(ts, args.fallback, 'answer', io.registryRows)
    : null;
  if (primary.price_in === null || primary.price_out === null) {
    throw new UsageError(
      `${primary.slug} has no dated price in config/ai-models.ts: the ledger cannot work out a worst case without one, so run runbook S1 (gateway-smoke.js) and write the verified fields first`
    );
  }
  if (
    fallback !== null &&
    ts.registry.vendorOf(fallback.slug) === ts.registry.vendorOf(primary.slug)
  ) {
    throw new UsageError(
      'the fallback must be a model of another provider (ADR-055)'
    );
  }
  const passes = args.passes || DEFAULT_LIVE_PASSES;
  const config = { apiKey: key, baseUrl: env.OPENROUTER_BASE_URL || undefined };
  const spend = { micro: 0, calls: 0 };
  const capMicro = Math.round(args['cap-usd'] * 1e6);
  const port = (row) =>
    capped(
      ts.openrouter.createOpenRouterModelPort(
        config,
        row,
        io.portOptions || {}
      ),
      spend,
      capMicro
    );
  const models = {
    primary: port(primary),
    fallback: fallback === null ? null : port(fallback),
  };
  const keep = modelCells(ts, args);
  let run;
  try {
    run = await ts.harness.recordRun({
      kind: 'LIVE',
      scenarios: ts.scenarios.SCENARIO_SET,
      passes,
      madeOn: args.date || today(),
      model: { slug: primary.slug },
      live: models,
      only: (cellKey) => keep(cellKey),
      onCell: (cell, done, total) => {
        if (spend.micro >= capMicro && done < total) throw new CapReached();
        if (done % 25 === 0 || done === total)
          out(
            `  ${done} of ${total} cells, about $${(spend.micro / 1e6).toFixed(4)} spent`
          );
      },
    });
  } catch (error) {
    if (error instanceof CapReached) {
      out(
        `STOPPED at the cap: about $${(spend.micro / 1e6).toFixed(4)} spent of $${args['cap-usd'].toFixed(2)} in ${spend.calls} calls. Nothing was written: a part of a run is not evidence.`
      );
      return 2;
    }
    throw error;
  }
  out(ts.report.renderRunReport(run));
  out(
    `spent about $${(spend.micro / 1e6).toFixed(4)} of the $${args['cap-usd'].toFixed(2)} cap in ${spend.calls} calls`
  );
  if (args.write) {
    const rel = `${RUNS_DIR}/${run.id}.json`;
    writeRun(ts, run, rel, args.out);
    out(`wrote ${args.out || rel}`);
  }
  const ok = run.summary.locales.filter((l) => l.ok).map((l) => l.locale);
  out('');
  out(
    'Registry fields a person would write into config/ai-models.ts if this run is accepted (this script never edits it):'
  );
  out(
    `  status: ${run.summary.all_pass ? "'passed'" : "'candidate'  (a bar fails: see above)"}`
  );
  out(`  eval_run: { id: '${run.id}', date: '${run.made_on}' }`);
  out(`  languages_ok: ${JSON.stringify(ok)}`);
  out(
    '  launch_role: a person decides (ADR-055: one default and one fallback of another provider, both passed)'
  );
  return run.summary.all_pass ? 0 : 1;
}

// ---------------------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------------------

function makeOut(key, sink) {
  return (line) => {
    let text = String(line);
    if (key !== '') text = text.split(key).join('[key]');
    sink(text);
  };
}

async function run(argv, env, io = {}) {
  const key = env.OPENROUTER_API_KEY || env.INTAKE_UNDERSTAND_API_KEY || '';
  const out = makeOut(
    key,
    io.sink || ((line) => process.stdout.write(`${line}\n`))
  );
  try {
    const args = parseArgs(argv);
    if (args.help) {
      out(HELP);
      return 0;
    }
    if (args['stand-in']) return await standIn(args, out);
    if (args.check) return await check(args, out);
    if (args.replay) return await replay(args, out);
    if (args.report) return await reportOf(args, out);
    if (args.estimate) return await estimate(args, out, io);
    return await live(args, env, out, io);
  } catch (error) {
    if (error instanceof UsageError) {
      out(`eval-run: ${error.message}`);
      return 2;
    }
    // a failure of the script itself: the class and the first line, never a stack (it could hold the key)
    out(
      `eval-run: failed (${error && error.name ? error.name : 'Error'}: ${String(error && error.message).split('\n')[0]})`
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
  run,
  UsageError,
  STAND_IN_FILE,
  RUNS_DIR,
  MAX_CAP_USD,
  DEFAULT_LIVE_PASSES,
};
