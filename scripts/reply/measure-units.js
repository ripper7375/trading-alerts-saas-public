#!/usr/bin/env node
/**
 * Units and tokens per message kind and model, from the traces (build step 7 part 6; runbook
 * stage S3; architecture 5.6 and 7.3, ADR-050 and ADR-073; decisions D2 and D4).
 *
 * WHAT IT IS FOR. The Pro allowance is "the Pro price times the share Davin allows for model
 * spend, divided by the measured cost of a unit" (ADR-073), and no token number is published until
 * the first measurement. This is the measurement: it reads `request_traces`, the one row written
 * for every answer, and says what a first message, a follow-up and an instant prompt cost, in
 * units (D2: one unit is one micro-dollar, so a unit count IS a cost in micro-dollars), at the
 * median and at the tail, for each model. Run it on real traffic after the live run (S2), and set
 * `PRO_MONTHLY_UNITS` (S4) from what it prints.
 *
 * READ ONLY. It only SELECTs, inside a transaction opened READ ONLY, and writes nothing to the
 * database, to a file or anywhere else. It prints aggregates and, for the dearest requests, their
 * request ids (a support handle that names no trader); it never prints a user id, a hash, a
 * question or a reply.
 *
 * WHAT IT COUNTS.
 *   message kind   INSTANT       the two instant prompts of Panel C (intents INSTANT_*)
 *                  FIRST_MESSAGE the first typed question of a thread (a trace with no thread is one)
 *                  FOLLOW_UP     every later typed question of the same thread
 *   a MEASURED request is one a model wrote (the trace names a model): its units are what the
 *   ledger charged. Requests that SPENT money and delivered no model reply (a fixed answer after
 *   a failed regeneration, a request that died after the call) are listed apart as "paid, not
 *   delivered": they are real cost that no percentile of delivered answers shows.
 *   Percentiles are by the nearest-rank method (the p-th percentile of n values is the value of
 *   rank ceil(p/100 * n) in ascending order), so they are always values that occurred.
 *   A thread's first message is found among the traces read: with --since, a follow-up whose
 *   first message is before the range counts as a first message.
 *
 * USAGE (from the repository root)
 *   node scripts/reply/measure-units.js --help
 *   node scripts/reply/measure-units.js --traces <file.json|file.ndjson> [options]
 *   node scripts/reply/measure-units.js --db [--url <postgres url>] [options]
 *   node scripts/reply/measure-units.js --run <eval-run.json> [options]
 *
 *   --run <file>      a recorded evaluation run (config/reply/eval-runs/*.json, build step 7 part 10):
 *                     every cell a model wrote becomes one measured request, so the same table comes
 *                     out of the live run of runbook S2 before there is any traffic. A STAND-IN run
 *                     is measured too, to prove the mechanism, and the table says so: its units are
 *                     the fixture model's under a FICTIONAL price and mean nothing about money.
 *   --traces <file>   rows of request_traces as a JSON array or one JSON object a line (the columns
 *                     request_id, thread_id, intent, model, units_charged, outcome, created_at and
 *                     the JSON columns model_group and checks_group)
 *   --db              read the table itself. The URL is --url, else DATABASE_PUBLIC_URL. A laptop
 *                     reads production through DATABASE_PUBLIC_URL, never the private URL. Needs
 *                     the `pg` package (a dependency of this repository).
 *   --since <date>    only traces created on or after this date (YYYY-MM-DD, UTC)
 *   --until <date>    only traces created before this date (YYYY-MM-DD, UTC)
 *   --model <slug>    only this model
 *   --outliers <n>    list the n dearest measured requests (default 5; 0 for none)
 *   --price <usd> --share <0..1>
 *                     the Pro price and the share of it allowed for model spend: print the
 *                     allowance ADR-073 gives (PRO_MONTHLY_UNITS) and how many messages of each
 *                     kind it buys at the median and at the 90th percentile. The price is yours to
 *                     pass in: it is the SystemConfig price, never a constant of the code.
 *   --json            print one JSON document instead of the text
 *
 * Exit codes: 0 done; 1 nothing to measure (no trace was written by a model in the range); 2 usage,
 * a file that cannot be read, or a database that cannot be reached.
 * Node standard library only, except `pg` for --db.
 */

'use strict';

const fs = require('fs');
const path = require('path');

const KINDS = ['FIRST_MESSAGE', 'FOLLOW_UP', 'INSTANT'];
const PERCENTILES = [50, 90, 95, 99];
const MAX_UNITS = 2_000_000_000;

// ---------------------------------------------------------------------------------------
// Reading
// ---------------------------------------------------------------------------------------

const isRecord = (v) =>
  typeof v === 'object' && v !== null && !Array.isArray(v);
const wholeOrNull = (v) =>
  typeof v === 'number' && Number.isSafeInteger(v) && v >= 0 ? v : null;

function parseJsonColumn(value) {
  if (isRecord(value)) return value;
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return isRecord(parsed) ? parsed : {};
    } catch {
      return {};
    }
  }
  return {};
}

/** One row of request_traces as the figures this script uses; null for a row it cannot read. */
function normalise(row) {
  if (!isRecord(row)) return null;
  const requestId = typeof row.request_id === 'string' ? row.request_id : null;
  const units = wholeOrNull(Number(row.units_charged));
  const created = new Date(row.created_at);
  if (requestId === null || units === null || Number.isNaN(created.getTime())) {
    return null;
  }
  const modelGroup = parseJsonColumn(row.model_group);
  const checksGroup = parseJsonColumn(row.checks_group);
  const tokens = isRecord(modelGroup.tokens) ? modelGroup.tokens : {};
  return {
    requestId,
    threadId:
      typeof row.thread_id === 'string' && row.thread_id !== ''
        ? row.thread_id
        : null,
    intent: typeof row.intent === 'string' ? row.intent : '',
    model: typeof row.model === 'string' && row.model !== '' ? row.model : null,
    units,
    outcome: typeof row.outcome === 'string' ? row.outcome : '',
    createdAt: created.getTime(),
    promptTokens: wholeOrNull(tokens.prompt),
    completionTokens: wholeOrNull(tokens.completion),
    cachedTokens: wholeOrNull(tokens.cached),
    costMicroUsd: wholeOrNull(modelGroup.cost_micro_usd),
    fallbackUsed: modelGroup.fallback_used === true,
    regenerated: checksGroup.regenerations === 1,
  };
}

/**
 * The rows of request_traces that a recorded evaluation run stands in for (part 10): one row per cell,
 * with the units the ledger charged, the tokens the calls reported and the model that wrote the reply.
 * A cell is its own thread, so a typed question is a first message; an instant prompt is an instant.
 * The intent of a cell is its scenario's, read from the scenario file next to the run.
 */
function rowsFromRun(run, scenarios) {
  const intentOf = new Map(scenarios.map((s) => [s.id, s.intent]));
  return run.cells.map((cell) => {
    const intent = intentOf.get(cell.scenario) ?? 'DIRECTION';
    const answered = cell.judgement !== null;
    const calls = Array.isArray(cell.calls) ? cell.calls : [];
    const sum = (key) =>
      calls.reduce((total, call) => total + (call[key] ?? 0), 0);
    const staged =
      calls.length > 0 && calls.every((call) => call.host === 'fixture');
    return {
      request_id: cell.id,
      thread_id: intent.startsWith('INSTANT_') ? null : `th-${cell.id}`,
      intent,
      model: answered
        ? run.kind === 'LIVE' && staged
          ? 'fixture (staged)'
          : run.model.slug
        : null,
      units_charged: cell.units,
      outcome: cell.outcome,
      created_at: `${run.made_on}T00:00:00Z`,
      model_group: {
        tokens: {
          prompt: sum('prompt_tokens'),
          completion: sum('completion_tokens'),
          cached: sum('cached_tokens'),
        },
        cost_micro_usd: sum('cost_micro_usd'),
        fallback_used: cell.fallback_used === true,
      },
      checks_group: {
        regenerations:
          cell.judgement !== null && cell.judgement.regenerations === 1 ? 1 : 0,
      },
    };
  });
}

function readFile(path) {
  // trim() also removes a byte order mark, as an editor on Windows may leave one
  const trimmed = fs.readFileSync(path, 'utf8').trim();
  if (trimmed.startsWith('[')) return JSON.parse(trimmed);
  return trimmed
    .split(/\r?\n/)
    .filter((line) => line.trim() !== '')
    .map((line) => JSON.parse(line));
}

/** The statement --db sends: one SELECT, nothing else. A test reads it. */
const READ_SQL = `SELECT "request_id", "thread_id", "intent", "model", "units_charged", "outcome", "created_at",
       "model_group", "checks_group"
  FROM "request_traces"
 WHERE "created_at" >= $1::timestamptz AND "created_at" < $2::timestamptz
 ORDER BY "created_at", "request_id"`;

async function readDatabase(url, sinceMs, untilMs) {
  const { Client } = require('pg');
  const local = /^postgres(ql)?:\/\/[^@]*@(localhost|127\.0\.0\.1)[:/]/.test(
    url
  );
  const client = new Client({
    connectionString: url,
    ...(local ? {} : { ssl: { rejectUnauthorized: false } }),
  });
  await client.connect();
  try {
    await client.query('BEGIN READ ONLY');
    const { rows } = await client.query(READ_SQL, [
      new Date(sinceMs).toISOString(),
      new Date(untilMs).toISOString(),
    ]);
    await client.query('ROLLBACK');
    return rows;
  } finally {
    await client.end();
  }
}

// ---------------------------------------------------------------------------------------
// Arithmetic
// ---------------------------------------------------------------------------------------

/** Nearest-rank percentile of an ascending array of numbers; null for none. */
function percentile(sorted, p) {
  if (sorted.length === 0) return null;
  const rank = Math.max(Math.ceil((p / 100) * sorted.length), 1);
  return sorted[Math.min(rank, sorted.length) - 1];
}

function spread(values) {
  const known = values.filter((v) => v !== null).sort((a, b) => a - b);
  if (known.length === 0) return { n: 0, mean: null, max: null, p: {} };
  const sum = known.reduce((total, v) => total + v, 0);
  const p = {};
  for (const level of PERCENTILES) p[`p${level}`] = percentile(known, level);
  return {
    n: known.length,
    mean: Math.round(sum / known.length),
    max: known[known.length - 1],
    p,
  };
}

/** The allowance of ADR-073: floor(price x share / unit cost), in exact integers (unit = 1 micro-dollar). */
function proposal(priceUsd, share) {
  const priceMicro = Math.round(priceUsd * 1_000_000);
  const shareMillionths = Math.round(share * 1_000_000);
  if (!Number.isFinite(priceUsd) || priceUsd <= 0 || priceMicro < 1) {
    return { ok: false, code: 'PRICE' };
  }
  if (
    !Number.isFinite(share) ||
    share <= 0 ||
    share > 1 ||
    shareMillionths < 1
  ) {
    return { ok: false, code: 'SHARE' };
  }
  const units =
    (BigInt(priceMicro) * BigInt(shareMillionths)) / BigInt(1_000_000);
  if (units > BigInt(MAX_UNITS)) return { ok: false, code: 'TOO_LARGE' };
  return { ok: true, units: Number(units) };
}

// ---------------------------------------------------------------------------------------
// Analysis
// ---------------------------------------------------------------------------------------

/** Give every row its message kind. */
function classify(rows) {
  const typedByThread = new Map();
  for (const row of rows) {
    if (row.intent.startsWith('INSTANT_') || row.threadId === null) continue;
    const list = typedByThread.get(row.threadId) ?? [];
    list.push(row);
    typedByThread.set(row.threadId, list);
  }
  const firstOfThread = new Set();
  for (const list of typedByThread.values()) {
    list.sort(
      (a, b) =>
        a.createdAt - b.createdAt || (a.requestId < b.requestId ? -1 : 1)
    );
    firstOfThread.add(list[0].requestId);
  }
  return rows.map((row) => {
    let kind;
    if (row.intent.startsWith('INSTANT_')) kind = 'INSTANT';
    else if (row.threadId === null || firstOfThread.has(row.requestId))
      kind = 'FIRST_MESSAGE';
    else kind = 'FOLLOW_UP';
    return { ...row, kind };
  });
}

function analyse(rawRows, options = {}) {
  const rows = [];
  let unreadable = 0;
  for (const raw of rawRows) {
    const row = normalise(raw);
    if (row === null) unreadable += 1;
    else rows.push(row);
  }
  const inRange = rows.filter(
    (r) =>
      (options.sinceMs === undefined || r.createdAt >= options.sinceMs) &&
      (options.untilMs === undefined || r.createdAt < options.untilMs)
  );
  const classified = classify(inRange).filter(
    (r) => options.model === undefined || r.model === options.model
  );

  const measured = classified.filter((r) => r.model !== null);
  const groups = new Map();
  for (const row of measured) {
    const key = `${row.kind}|${row.model}`;
    const list = groups.get(key) ?? [];
    list.push(row);
    groups.set(key, list);
  }
  const summaries = [...groups.entries()]
    .map(([key, list]) => {
      const [kind, model] = key.split('|');
      const cost = list.map((r) => r.costMicroUsd);
      const known = cost.filter((c) => c !== null);
      const charged = list.reduce((total, r) => total + r.units, 0);
      const cachedKnown = list.filter(
        (r) => r.cachedTokens !== null && r.promptTokens
      );
      return {
        kind,
        model,
        n: list.length,
        units: spread(list.map((r) => r.units)),
        promptTokens: spread(list.map((r) => r.promptTokens)),
        completionTokens: spread(list.map((r) => r.completionTokens)),
        unitsCharged: charged,
        costMicroUsd:
          known.length === 0 ? null : known.reduce((t, c) => t + c, 0),
        costKnown: known.length,
        cachedShare:
          cachedKnown.length === 0
            ? null
            : Math.round(
                (cachedKnown.reduce((t, r) => t + r.cachedTokens, 0) /
                  cachedKnown.reduce((t, r) => t + r.promptTokens, 0)) *
                  1000
              ) / 1000,
        regeneratedShare:
          Math.round(
            (list.filter((r) => r.regenerated).length / list.length) * 1000
          ) / 1000,
        fallbackShare:
          Math.round(
            (list.filter((r) => r.fallbackUsed).length / list.length) * 1000
          ) / 1000,
      };
    })
    .sort(
      (a, b) =>
        KINDS.indexOf(a.kind) - KINDS.indexOf(b.kind) ||
        (a.model < b.model ? -1 : a.model > b.model ? 1 : 0)
    );

  const paidNotDelivered = classified.filter(
    (r) => r.model === null && r.units > 0
  );
  const outliersN = options.outliers ?? 5;
  const outliers = [...measured]
    .sort((a, b) => b.units - a.units || (a.requestId < b.requestId ? -1 : 1))
    .slice(0, Math.max(outliersN, 0))
    .map((r) => ({
      requestId: r.requestId,
      kind: r.kind,
      model: r.model,
      units: r.units,
    }));

  const outcomes = {};
  for (const r of classified)
    outcomes[r.outcome] = (outcomes[r.outcome] ?? 0) + 1;

  return {
    traces: classified.length,
    unreadable,
    measured: measured.length,
    outcomes,
    groups: summaries,
    paidNotDelivered: {
      n: paidNotDelivered.length,
      units: paidNotDelivered.reduce((t, r) => t + r.units, 0),
    },
    outliers,
  };
}

/** What an allowance buys, by group, at the median and at the 90th percentile. */
function buys(report, units) {
  return report.groups.map((g) => ({
    kind: g.kind,
    model: g.model,
    atP50: g.units.p.p50 > 0 ? Math.floor(units / g.units.p.p50) : null,
    atP90: g.units.p.p90 > 0 ? Math.floor(units / g.units.p.p90) : null,
  }));
}

// ---------------------------------------------------------------------------------------
// Output
// ---------------------------------------------------------------------------------------

const cell = (v) => (v === null || v === undefined ? '-' : String(v));
const usd = (micro) =>
  `${Math.floor(micro / 1_000_000)}.${String(micro % 1_000_000).padStart(6, '0')}`;

function render(report, extra) {
  const lines = [];
  lines.push(
    'MEASURE UNITS (read only)  1 unit = 1 micro-dollar of gateway cost, $1.00 = 1,000,000 units'
  );
  lines.push(
    `traces read ${report.traces}, written by a model ${report.measured}, unreadable ${report.unreadable}`
  );
  const outcomeText = Object.entries(report.outcomes)
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([k, v]) => `${k || '(none)'} ${v}`)
    .join(', ');
  lines.push(`outcomes: ${outcomeText === '' ? '-' : outcomeText}`);
  lines.push('');
  lines.push('UNITS PER REQUEST (nearest-rank percentiles)');
  lines.push(
    [
      'kind',
      'model',
      'n',
      'p50',
      'p90',
      'p95',
      'p99',
      'max',
      'mean',
      'regen',
      'fallback',
    ]
      .map((h, i) => (i < 2 ? h.padEnd(h === 'kind' ? 14 : 30) : h.padStart(9)))
      .join(' ')
  );
  for (const g of report.groups) {
    lines.push(
      [
        g.kind.padEnd(14),
        g.model.padEnd(30),
        cell(g.n).padStart(9),
        cell(g.units.p.p50).padStart(9),
        cell(g.units.p.p90).padStart(9),
        cell(g.units.p.p95).padStart(9),
        cell(g.units.p.p99).padStart(9),
        cell(g.units.max).padStart(9),
        cell(g.units.mean).padStart(9),
        cell(g.regeneratedShare).padStart(9),
        cell(g.fallbackShare).padStart(9),
      ].join(' ')
    );
  }
  lines.push('');
  lines.push('TOKENS PER REQUEST (what the providers reported)');
  lines.push(
    [
      'kind',
      'model',
      'prompt p50',
      'prompt p90',
      'reply p50',
      'reply p90',
      'cached share',
      'cost known',
    ]
      .map((h, i) =>
        i < 2 ? h.padEnd(h === 'kind' ? 14 : 30) : h.padStart(13)
      )
      .join(' ')
  );
  for (const g of report.groups) {
    lines.push(
      [
        g.kind.padEnd(14),
        g.model.padEnd(30),
        cell(g.promptTokens.p.p50).padStart(13),
        cell(g.promptTokens.p.p90).padStart(13),
        cell(g.completionTokens.p.p50).padStart(13),
        cell(g.completionTokens.p.p90).padStart(13),
        cell(g.cachedShare).padStart(13),
        `${g.costKnown}/${g.n}`.padStart(13),
      ].join(' ')
    );
  }
  lines.push('');
  lines.push(
    `PAID, NOT DELIVERED: ${report.paidNotDelivered.n} request(s), ${report.paidNotDelivered.units} units ($${usd(report.paidNotDelivered.units)}) spent with no model reply to show for it`
  );
  if (report.outliers.length > 0) {
    lines.push('');
    lines.push('THE DEAREST REQUESTS (support opens them by request id)');
    for (const o of report.outliers) {
      lines.push(`  ${o.requestId}  ${o.kind}  ${o.model}  ${o.units} units`);
    }
  }
  if (extra !== undefined) {
    lines.push('');
    lines.push(
      `ADR-073: price $${extra.priceUsd} x share ${extra.share} gives PRO_MONTHLY_UNITS = ${extra.units} ($${usd(extra.units)} of model spend a month)`
    );
    lines.push(
      ['kind', 'model', 'messages at p50', 'messages at p90']
        .map((h, i) =>
          i < 2 ? h.padEnd(h === 'kind' ? 14 : 30) : h.padStart(16)
        )
        .join(' ')
    );
    for (const b of extra.buys) {
      lines.push(
        [
          b.kind.padEnd(14),
          b.model.padEnd(30),
          cell(b.atP50).padStart(16),
          cell(b.atP90).padStart(16),
        ].join(' ')
      );
    }
    lines.push(
      'Set PRO_MONTHLY_UNITS yourself (runbook S4); this script sets nothing.'
    );
  }
  return lines.join('\n');
}

// ---------------------------------------------------------------------------------------
// The command
// ---------------------------------------------------------------------------------------

const HELP = (() => {
  const text = fs.readFileSync(__filename, 'utf8');
  const start = text.indexOf('/**');
  const end = text.indexOf('*/', start);
  return text
    .slice(start + 3, end)
    .split('\n')
    .map((line) =>
      line.startsWith(' * ') ? line.slice(3) : line.trim() === '*' ? '' : line
    )
    .join('\n')
    .trim();
})();

function parseArgs(argv) {
  const options = { json: false, outliers: 5 };
  const need = (i, name) => {
    if (i + 1 >= argv.length) throw new Error(`${name} needs a value`);
    return argv[i + 1];
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    switch (arg) {
      case '--help':
      case '-h':
        options.help = true;
        break;
      case '--traces':
        options.traces = need(i, arg);
        i += 1;
        break;
      case '--db':
        options.db = true;
        break;
      case '--run':
        options.run = need(i, arg);
        i += 1;
        break;
      case '--url':
        options.url = need(i, arg);
        i += 1;
        break;
      case '--since':
        options.since = need(i, arg);
        i += 1;
        break;
      case '--until':
        options.until = need(i, arg);
        i += 1;
        break;
      case '--model':
        options.model = need(i, arg);
        i += 1;
        break;
      case '--outliers': {
        const n = Number(need(i, arg));
        if (!Number.isInteger(n) || n < 0 || n > 100)
          throw new Error('--outliers must be a whole number from 0 to 100');
        options.outliers = n;
        i += 1;
        break;
      }
      case '--price':
        options.price = Number(need(i, arg));
        i += 1;
        break;
      case '--share':
        options.share = Number(need(i, arg));
        i += 1;
        break;
      case '--json':
        options.json = true;
        break;
      default:
        throw new Error(`unknown option ${arg}`);
    }
  }
  if (options.help) return options;
  if (
    [
      options.traces !== undefined,
      options.db === true,
      options.run !== undefined,
    ].filter(Boolean).length !== 1
  ) {
    throw new Error(
      'give exactly one of --traces <file>, --db and --run <file>'
    );
  }
  if ((options.price === undefined) !== (options.share === undefined)) {
    throw new Error('--price and --share go together');
  }
  for (const key of ['since', 'until']) {
    if (
      options[key] !== undefined &&
      !/^\d{4}-\d{2}-\d{2}$/.test(options[key])
    ) {
      throw new Error(`--${key} must be a date, YYYY-MM-DD`);
    }
    if (
      options[key] !== undefined &&
      Number.isNaN(Date.parse(`${options[key]}T00:00:00Z`))
    ) {
      throw new Error(`--${key} is not a real date`);
    }
  }
  return options;
}

async function main(
  argv,
  io = {
    out: (s) => process.stdout.write(`${s}\n`),
    err: (s) => process.stderr.write(`${s}\n`),
  },
  env = process.env
) {
  let options;
  try {
    options = parseArgs(argv);
  } catch (error) {
    io.err(`measure-units: ${error.message}`);
    io.err('try --help');
    return 2;
  }
  if (options.help) {
    io.out(HELP);
    return 0;
  }
  const sinceMs =
    options.since === undefined
      ? undefined
      : Date.parse(`${options.since}T00:00:00Z`);
  const untilMs =
    options.until === undefined
      ? undefined
      : Date.parse(`${options.until}T00:00:00Z`);

  let rows;
  let source = null;
  try {
    if (options.run !== undefined) {
      const run = JSON.parse(fs.readFileSync(options.run, 'utf8').trim());
      if (!run || run.schema !== 'eval-run/1' || !Array.isArray(run.cells)) {
        throw new Error('not an evaluation run (schema eval-run/1)');
      }
      const scenarioFile = path.join(
        __dirname,
        '..',
        '..',
        'config',
        'reply',
        'golden',
        'scenarios.v1.json'
      );
      rows = rowsFromRun(
        run,
        JSON.parse(fs.readFileSync(scenarioFile, 'utf8')).scenarios
      );
      source = { kind: run.kind, id: run.id };
    } else if (options.traces !== undefined) {
      rows = readFile(options.traces);
    } else {
      const url = options.url ?? env.DATABASE_PUBLIC_URL;
      if (typeof url !== 'string' || url === '') {
        io.err('measure-units: --db needs --url or DATABASE_PUBLIC_URL');
        return 2;
      }
      rows = await readDatabase(
        url,
        sinceMs ?? 0,
        untilMs ?? Date.UTC(9000, 0, 1)
      );
    }
  } catch (error) {
    io.err(`measure-units: could not read the traces: ${error.message}`);
    return 2;
  }

  const report = analyse(rows, {
    sinceMs,
    untilMs,
    model: options.model,
    outliers: options.outliers,
  });
  let extra;
  if (options.price !== undefined) {
    const result = proposal(options.price, options.share);
    if (!result.ok) {
      io.err(
        `measure-units: ${result.code === 'TOO_LARGE' ? 'the allowance is above the ledger bound' : `--${result.code.toLowerCase()} is not usable`}`
      );
      return 2;
    }
    extra = {
      priceUsd: options.price,
      share: options.share,
      units: result.units,
      buys: buys(report, result.units),
    };
  }
  if (source !== null && source.kind === 'STAND_IN' && !options.json) {
    io.out(
      "STAND-IN RUN: the replies are the fixture model's and the units are under a FICTIONAL price. This shows the mechanism and measures nothing about money."
    );
  }
  io.out(
    options.json
      ? JSON.stringify(
          {
            ...report,
            proposal: extra ?? null,
            ...(source === null ? {} : { source }),
          },
          null,
          2
        )
      : render(report, extra)
  );
  return report.measured === 0 ? 1 : 0;
}

module.exports = {
  KINDS,
  PERCENTILES,
  READ_SQL,
  analyse,
  buys,
  classify,
  main,
  normalise,
  parseArgs,
  percentile,
  proposal,
  readFile,
  render,
  rowsFromRun,
  spread,
};

if (require.main === module) {
  main(process.argv.slice(2)).then(
    (code) => {
      process.exitCode = code;
    },
    (error) => {
      process.stderr.write(`measure-units: ${error.message}\n`);
      process.exitCode = 2;
    }
  );
}
