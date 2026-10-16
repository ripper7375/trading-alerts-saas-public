#!/usr/bin/env node
/**
 * The Free tier's recorded example (build step 7 part 10; architecture 7.3, ADR-072, plan decision
 * D19; runbook stages S2 and S5).
 *
 * WHAT IT MAKES. `config/reply/demo/<locale>.json` for each of the 19 locales: one golden scenario
 * (M01: the real 18 Sep cycle, an M5 instant prompt) as the trader of that language would have been
 * answered, replayed from storage by the Free tier's panels (`components/chat/demo-source.ts`) at
 * no cost and with no model call. It is taken from a RECORDED RUN, not from a model asked now: the
 * run's recorded replies are played through the real orchestrator again, so the composed result is
 * exactly what the pipeline makes of them, with the same direction, the same zones and the same
 * stamp.
 *
 * WHAT IT NEVER DOES. It never approves. `approval.json` is written PENDING and only a person
 * changes it. And a recording made from a STAND-IN run (the fixture model's words) is never shown to
 * a trader even when someone approves it: `loadDemo` refuses it by its `source.kind`. The Free tier
 * sees the recorded example only after a LIVE run (runbook S2) has been recorded again with
 * `--run`, read in every language (S5) and signed.
 *
 * COMMANDS (from the repository root; `--root DIR` points any of them at another tree)
 *   record [--run FILE]   write the 19 recordings, review.md and approval.json from a recorded run
 *                         (default: config/reply/eval-runs/stand-in.json). Needs `tsx`.
 *   check [--require-approved]
 *                         structure of every file, a fresh review sheet, a valid approval; with the
 *                         flag, also APPROVED and no recording from a stand-in run. Node only.
 *
 * Exit codes: 0 fine; 1 a problem; 2 a file is unusable.
 */

'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const DEMO_SCHEMA = 'demo-recording/1';
const APPROVAL_SCHEMA = 'demo-approval/1';
const AREA = 'demo';
const PENDING = 'PENDING';
const APPROVED = 'APPROVED';
const SCENARIO = 'M01';
const TRADER = 'DAY_TRADER';
const INSTANT = 'INSTANT_M5_INSPECT';

const DIR = 'config/reply/demo';
const FILES = {
  review: `${DIR}/review.md`,
  approval: `${DIR}/approval.json`,
};
const LOCALES = [
  'en-US',
  'en-GB',
  'es',
  'de',
  'pt',
  'pt-BR',
  'it',
  'ja',
  'ar',
  'fr',
  'ko',
  'zh',
  'zh-TW',
  'ur',
  'hi',
  'vi',
  'id',
  'th',
  'tr',
];
const KINDS = ['STAND_IN', 'LIVE'];
const FORBIDDEN_KEY = /equity|commission/i;

class ToolError extends Error {}

const lf = (text) => text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
const sha256 = (text) =>
  crypto.createHash('sha256').update(text, 'utf8').digest('hex');
const isRec = (value) =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value !== null && typeof value === 'object') {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}

function readJson(root, rel) {
  const full = path.join(root, rel);
  if (!fs.existsSync(full)) throw new ToolError(`${rel} is missing`);
  try {
    return JSON.parse(lf(fs.readFileSync(full, 'utf8')));
  } catch (error) {
    throw new ToolError(`${rel} is not JSON: ${error.message}`);
  }
}

const fileOf = (locale) => `${DIR}/${locale}.json`;

function loadAll(root) {
  const out = {};
  for (const locale of LOCALES) out[locale] = readJson(root, fileOf(locale));
  return out;
}

// ---------------------------------------------------------------------------
// Structure
// ---------------------------------------------------------------------------

function keysOf(value, keys, where) {
  const problems = [];
  for (const key of keys)
    if (!(key in value)) problems.push(`${where}.${key} is missing`);
  for (const key of Object.keys(value))
    if (!keys.includes(key)) problems.push(`${where}.${key} is not a field`);
  return problems;
}

function forbiddenKeyPaths(value, here = '') {
  const found = [];
  if (Array.isArray(value))
    value.forEach((item, i) =>
      found.push(...forbiddenKeyPaths(item, `${here}[${i}]`))
    );
  else if (isRec(value)) {
    for (const key of Object.keys(value)) {
      if (FORBIDDEN_KEY.test(key)) found.push(`${here}.${key}`);
      found.push(...forbiddenKeyPaths(value[key], `${here}.${key}`));
    }
  }
  return found;
}

function structureProblems(all) {
  const problems = [];
  const runs = new Set();
  for (const locale of LOCALES) {
    const where = fileOf(locale);
    const file = all[locale];
    if (!isRec(file)) {
      problems.push(`${where} is not an object`);
      continue;
    }
    const own = keysOf(
      file,
      ['schema', 'locale', 'source', 'recording'],
      where
    );
    if (own.length > 0) {
      problems.push(...own);
      continue;
    }
    if (file.schema !== DEMO_SCHEMA)
      problems.push(`${where}: schema must be ${DEMO_SCHEMA}`);
    if (file.locale !== locale)
      problems.push(`${where}: locale must be ${locale}`);
    const source = file.source;
    if (!isRec(source)) {
      problems.push(`${where}: source is not an object`);
      continue;
    }
    problems.push(
      ...keysOf(
        source,
        ['kind', 'run_id', 'fingerprint_sha256', 'scenario', 'trader', 'pass'],
        `${where}.source`
      )
    );
    if (!KINDS.includes(source.kind))
      problems.push(`${where}: source.kind must be STAND_IN or LIVE`);
    if (source.scenario !== SCENARIO || source.trader !== TRADER)
      problems.push(`${where}: the recording is of ${SCENARIO} for ${TRADER}`);
    if (!/^[0-9a-f]{64}$/.test(String(source.fingerprint_sha256)))
      problems.push(`${where}: source.fingerprint_sha256 is not a SHA-256`);
    runs.add(`${source.kind}|${source.run_id}|${source.fingerprint_sha256}`);
    const recording = file.recording;
    if (!isRec(recording)) {
      problems.push(`${where}: recording is not an object`);
      continue;
    }
    problems.push(
      ...keysOf(recording, ['as_of', 'locale', 'turns'], `${where}.recording`)
    );
    if (recording.locale !== locale)
      problems.push(`${where}: recording.locale must be ${locale}`);
    if (
      !/^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-5][05]Z$/.test(
        String(recording.as_of)
      )
    )
      problems.push(`${where}: recording.as_of is not a cycle slot`);
    const turns = recording.turns;
    if (!Array.isArray(turns) || turns.length !== 1) {
      problems.push(`${where}: the recording has exactly one turn`);
      continue;
    }
    const turn = turns[0];
    if (
      !isRec(turn) ||
      turn.question !== null ||
      turn.instant !== INSTANT ||
      !isRec(turn.result)
    ) {
      problems.push(`${where}: the turn is an ${INSTANT} prompt with a result`);
      continue;
    }
    const result = turn.result;
    if (result.kind !== 'REPORT1')
      problems.push(`${where}: the result is a Report 1`);
    if (result.reply_locale !== locale)
      problems.push(`${where}: result.reply_locale must be ${locale}`);
    if (result.intent !== INSTANT)
      problems.push(`${where}: result.intent must be ${INSTANT}`);
    if (!isRec(result.stamp) || result.stamp.as_of !== recording.as_of)
      problems.push(`${where}: the stamp's time is the recording's`);
    for (const found of forbiddenKeyPaths(result))
      problems.push(
        `${where}: a key that names equity or commission at ${found}`
      );
  }
  if (runs.size > 1)
    problems.push('the 19 recordings are not all from one run');
  return problems;
}

// ---------------------------------------------------------------------------
// Review sheet and approval
// ---------------------------------------------------------------------------

const contentSha256 = (all) =>
  sha256(canonical(LOCALES.map((locale) => [locale, all[locale]])));

const cell = (text) => String(text).replace(/\|/g, '\\|').replace(/\n/g, ' ');

function renderReview(all) {
  const first = all[LOCALES[0]].source;
  const standIn = first.kind === 'STAND_IN';
  const out = [];
  out.push('# The Free tier recorded example: review sheet', '');
  out.push(
    '> GENERATED by `node scripts/reply/record-demo.js record`. Do not edit this file; record again.',
    ''
  );
  if (standIn) {
    out.push(
      '> **STAND-IN CONTENT. DO NOT APPROVE.** These 19 recordings are made from a STAND-IN run: the sentences were written by the test harness, not by a model, and say nothing real about gold. They prove the Free tier can replay a stored conversation in 19 languages at no cost. `loadDemo` refuses them by their source even if this sheet is signed. Record again from a LIVE run (`node scripts/reply/record-demo.js record --run config/reply/eval-runs/<live run>.json`) and read that.',
      ''
    );
  }
  out.push(
    '**What you are approving.** What a Free trader sees in Panel B, in their language: one real golden cycle (the 18 Sep counter-trend rally) and the Report 1 an M5 instant prompt gets for it, labelled "Recorded example, data as of ..." by the panel itself. Read the headline, the lines under it and the direction in each language.',
    ''
  );
  out.push(
    '**How to approve.** Edit `config/reply/demo/approval.json`: set `status` to `APPROVED`, `approved_by` and `approved_on`. It holds the hash of the 19 recordings as they were read.',
    ''
  );
  out.push(
    `- Source: ${first.kind} run \`${first.run_id}\`, fingerprint \`${first.fingerprint_sha256.slice(0, 16)}\`, scenario ${first.scenario}, trader ${first.trader}`
  );
  out.push(`- Content hash: \`${contentSha256(all)}\``, '');
  out.push(
    '| Locale | Direction | Headline | First line under "alignment" | First "what would change" line |'
  );
  out.push('| --- | --- | --- | --- | --- |');
  for (const locale of LOCALES) {
    const result = all[locale].recording.turns[0].result;
    const report = result.report;
    const line = (list) => (list.length > 0 ? list[0].text : '');
    out.push(
      `| ${locale} | ${report.direction.bias}${report.direction.stand_aside ? ' (stand aside)' : ''} | ${cell(report.headline)} | ${cell(line(report.alignment.lines))} | ${cell(line(report.watch))} |`
    );
  }
  out.push('');
  out.push('## What this sheet does not cover', '');
  out.push(
    "- The disclaimer, the labels and the interface words are the dictionaries' (`chat.*`), read separately with counsel (architecture Appendix D).",
    "- Numbers, level names and sensor ids are the engines' and are not translated.",
    ''
  );
  return out.join('\n');
}

function newApproval(digest, old) {
  const keep =
    old !== null &&
    old.status === APPROVED &&
    old.content_sha256 === digest &&
    typeof old.approved_by === 'string' &&
    old.approved_by !== '' &&
    typeof old.approved_on === 'string' &&
    old.approved_on !== '';
  return keep
    ? old
    : {
        schema: APPROVAL_SCHEMA,
        area: AREA,
        status: PENDING,
        approved_by: '',
        approved_on: '',
        content_sha256: digest,
        note: '',
      };
}

const dump = (value) => `${JSON.stringify(value, null, 2)}\n`;

function readApproval(root) {
  const full = path.join(root, FILES.approval);
  if (!fs.existsSync(full)) return null;
  try {
    return JSON.parse(lf(fs.readFileSync(full, 'utf8')));
  } catch (error) {
    throw new ToolError(`${FILES.approval} is not JSON: ${error.message}`);
  }
}

const APPROVAL_KEYS = [
  'schema',
  'area',
  'status',
  'approved_by',
  'approved_on',
  'content_sha256',
  'note',
];

function approvalProblems(approval, digest) {
  if (!isRec(approval)) return [`${FILES.approval} must be an object`];
  const problems = [];
  for (const key of APPROVAL_KEYS)
    if (!(key in approval)) problems.push(`${FILES.approval} lacks "${key}"`);
  for (const key of Object.keys(approval))
    if (!APPROVAL_KEYS.includes(key))
      problems.push(`${FILES.approval} has an unknown key "${key}"`);
  if (approval.schema !== APPROVAL_SCHEMA)
    problems.push(`schema must be ${APPROVAL_SCHEMA}`);
  if (approval.area !== AREA) problems.push(`area must be ${AREA}`);
  if (![PENDING, APPROVED].includes(approval.status))
    problems.push(`status must be ${PENDING} or ${APPROVED}`);
  if (approval.status === APPROVED) {
    if (
      typeof approval.approved_by !== 'string' ||
      approval.approved_by.trim() === ''
    )
      problems.push('an APPROVED area needs approved_by');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(approval.approved_on)))
      problems.push('an APPROVED area needs approved_on as YYYY-MM-DD');
  }
  if (approval.content_sha256 !== digest)
    problems.push(
      'the approval was written for other recordings: run `record`, then read and sign again'
    );
  return problems;
}

function check(root, { requireApproved = false } = {}) {
  const all = loadAll(root);
  const problems = structureProblems(all);
  if (problems.length > 0) return { problems, status: null };
  const digest = contentSha256(all);
  const reviewPath = path.join(root, FILES.review);
  if (!fs.existsSync(reviewPath)) problems.push(`${FILES.review} is missing`);
  else if (lf(fs.readFileSync(reviewPath, 'utf8')) !== lf(renderReview(all)))
    problems.push(`${FILES.review} differs from a fresh run: run \`record\``);
  let approval = null;
  try {
    approval = readApproval(root);
  } catch (error) {
    problems.push(error.message);
  }
  if (approval === null) problems.push(`${FILES.approval} is missing`);
  else {
    problems.push(...approvalProblems(approval, digest));
    if (requireApproved) {
      if (approval.status !== APPROVED)
        problems.push(
          'the recorded example is PENDING: the Free tier does not show an unread recording'
        );
      if (all[LOCALES[0]].source.kind !== 'LIVE')
        problems.push(
          'the recorded example comes from a STAND-IN run: it is never shown to a trader'
        );
    }
  }
  return { problems, status: approval === null ? null : approval.status };
}

// ---------------------------------------------------------------------------
// Recording (needs the TypeScript)
// ---------------------------------------------------------------------------

async function record(root, runRel) {
  const { boot } = require('./ts-boot');
  const ts = boot();
  const rel = runRel || 'config/reply/eval-runs/stand-in.json';
  const run = readJson(root, rel);
  const problems = await ts.suite.runProblems(run);
  if (problems.length > 0)
    throw new ToolError(`${rel} is not a run:\n- ${problems.join('\n- ')}`);
  const scenario = ts.scenarios.SCENARIO_SET.scenarios.find(
    (s) => s.id === SCENARIO
  );
  if (scenario === undefined)
    throw new ToolError(`scenario ${SCENARIO} is not in the set`);
  const all = {};
  for (const locale of LOCALES) {
    const id = `${SCENARIO}.${TRADER}.${locale}.1`;
    const cell = run.cells.find((c) => c.id === id);
    if (cell === undefined)
      throw new ToolError(
        `${rel} has no cell ${id}: record the run again (it must contain ${SCENARIO})`
      );
    // the recorded replies, played through the real pipeline again: the result is what it makes of them
    const { out } = await ts.harness.runCellFull(
      scenario,
      { scenario: SCENARIO, trader: TRADER, locale, pass: 1 },
      { replies: cell.calls.map((call) => call.text) }
    );
    if (out.kind !== 'REPLY' || out.result.kind !== 'REPORT1')
      throw new ToolError(`${id}: the recorded replies do not make a Report 1`);
    all[locale] = {
      schema: DEMO_SCHEMA,
      locale,
      source: {
        kind: run.kind,
        run_id: run.id,
        fingerprint_sha256: run.fingerprint.sha256,
        scenario: SCENARIO,
        trader: TRADER,
        pass: 1,
      },
      recording: {
        as_of: out.result.stamp.as_of,
        locale,
        turns: [{ question: null, instant: INSTANT, result: out.result }],
      },
    };
  }
  const found = structureProblems(all);
  if (found.length > 0)
    throw new ToolError(
      `the recordings have problems:\n- ${found.join('\n- ')}`
    );
  const digest = contentSha256(all);
  let old = null;
  try {
    old = readApproval(root);
  } catch {
    old = null;
  }
  const writes = [
    ...LOCALES.map((locale) => [fileOf(locale), dump(all[locale])]),
    [FILES.review, renderReview(all)],
    [FILES.approval, dump(newApproval(digest, old))],
  ];
  for (const [file, text] of writes) {
    const full = path.join(root, file);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, text, 'utf8');
  }
  return writes.map(([file]) => file);
}

async function main(argv) {
  const args = argv.slice(2);
  const flagValue = (name) => {
    const at = args.indexOf(name);
    return at === -1 ? null : args[at + 1];
  };
  const rootArg = flagValue('--root');
  const root =
    rootArg === null
      ? path.resolve(__dirname, '..', '..')
      : path.resolve(rootArg);
  const command = args.find(
    (arg, index) =>
      !arg.startsWith('--') &&
      args[index - 1] !== '--root' &&
      args[index - 1] !== '--run'
  );
  try {
    if (command === 'record') {
      for (const file of await record(root, flagValue('--run')))
        console.log(`wrote ${file}`);
      return 0;
    }
    if (command === 'check') {
      const { problems, status } = check(root, {
        requireApproved: args.includes('--require-approved'),
      });
      if (problems.length > 0) {
        for (const problem of problems) console.error(`- ${problem}`);
        return 1;
      }
      console.log(
        `the recorded example is as it should be (approval ${status})`
      );
      return 0;
    }
    console.error(
      'usage: record-demo.js record [--run FILE] | check [--require-approved] [--root DIR]'
    );
    return 2;
  } catch (error) {
    if (error instanceof ToolError) {
      console.error(error.message);
      return 2;
    }
    throw error;
  }
}

module.exports = {
  DIR,
  FILES,
  LOCALES,
  check,
  contentSha256,
  fileOf,
  loadAll,
  renderReview,
  structureProblems,
};

if (require.main === module) {
  main(process.argv).then(
    (code) => {
      process.exitCode = code;
    },
    (error) => {
      console.error(
        `record-demo: failed (${error && error.name ? error.name : 'Error'}: ${String(error && error.message).split('\n')[0]})`
      );
      process.exitCode = 2;
    }
  );
}
