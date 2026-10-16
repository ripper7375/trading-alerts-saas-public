#!/usr/bin/env node
/**
 * The golden scenarios of the reply path: check, review sheet and approval (build step 7 part 10;
 * the pattern of scripts/reply/wording-tool.js, scripts/reply/prompts-tool.js and
 * davintrade-stack-d-and-e/engine-1-5-new/mcd_worker/tools/golden.py; architecture 7.6 and 7.7,
 * ADR-078 and ADR-079).
 *
 * `config/reply/golden/scenarios.v1.json` is what a person reads and approves: each situation the
 * reply path must handle, and what must be true afterwards, written from the architecture BEFORE
 * anything is run. The checks that run the scenarios through the real orchestrator are
 * `__tests__/lib/reply/eval/` and `scripts/reply/eval-run.js`; this tool is the human's side.
 *
 * COMMANDS (from the repository root; `--root DIR` points any of them at another tree)
 *   record              write config/reply/golden/review.md and approval.json. It NEVER writes
 *                       APPROVED: a person edits status, approved_by and approved_on. The approval
 *                       holds the SHA-256 of the scenarios as they were read, so any later edit puts
 *                       it back to "written for other scenarios".
 *   check [--require-approved]
 *                       the structure of the file, the coverage of architecture 7.6 and 7.7, a fresh
 *                       review sheet, a valid approval; with the flag, also an APPROVED status.
 *   matrix              the table of architecture 7.6: each row and the scenarios that hold it; exit
 *                       1 when a row has none.
 *
 * NO GENERATED FILE LISTS A STATUS, so signing approval.json makes nothing stale.
 * Exit codes: 0 fine; 1 a problem; 2 a file is unusable. Node standard library only.
 */

'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const SCENARIO_SCHEMA = 'golden-reply/1';
const APPROVAL_SCHEMA = 'golden-reply-approval/1';
const AREA = 'golden-reply';
const PENDING = 'PENDING';
const APPROVED = 'APPROVED';

const FILES = {
  scenarios: 'config/reply/golden/scenarios.v1.json',
  review: 'config/reply/golden/review.md',
  approval: 'config/reply/golden/approval.json',
};

const FAMILIES = ['CYCLE', 'DATA', 'DEGRADED', 'PLANTED', 'DEMO'];
const SOURCES = ['MODEL', 'FIXTURE'];
const CONDITIONS = [
  'NONE',
  'CHART_OTHER_CYCLE',
  'CHART_MISSING',
  'MODEL_DOWN',
  'BOTH_MODELS_DOWN',
  'QUOTA_EXHAUSTED',
  'KNOWLEDGE_DOWN',
  'CALENDAR_LATE',
  'SPECS_STALE',
  'PLANT_WRONG_PRICE',
  'PLANT_BANNED_PHRASE',
  'PLANT_BAD_JSON',
  'PLANT_BAD_ZONE',
];
const INTENTS = [
  'DIRECTION',
  'EXPLAIN',
  'NEWS',
  'REPORT_2',
  'INSTANT_M5_INSPECT',
  'INSTANT_M15_INSPECT',
];
const OUTCOMES = ['REPORT1', 'ANSWER', 'FIXED_ANSWER', 'ACTION', 'REFUSED'];
const TRADERS = ['DAY_TRADER', 'SCALPER'];
const STATUSES = ['FRESH', 'DELAYED', 'STALE', 'MARKET_CLOSED'];
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
const FIXED_REASONS = [
  'DATA_STALE',
  'WORDING_FAILED',
  'SCHEMA_FAILED',
  'MODEL_UNAVAILABLE',
  'DEADLINE',
  'MARKET_CLOSED',
  'NO_SYNTHESIS',
];
const NOTES = ['CHART_OTHER_CYCLE', 'CHART_UNAVAILABLE'];
const EVENTS_STATUSES = ['OK', 'LATE', 'UNAVAILABLE', 'EMPTY'];

/** The ten rows of architecture 7.6 (a test holds this list to `DEGRADED_ROWS` of lib/reply/eval/scenarios.ts). */
const DEGRADED_ROWS = [
  [
    1,
    'Market data STALE',
    'No direction, no Report 2; other questions answered; stop time stated',
  ],
  [2, 'Market closed', "Last session's picture, labelled; no Report 2"],
  [
    3,
    'Sensor INVALID or STALE',
    'Listed as unavailable; left out of synthesis',
  ],
  [
    4,
    'Chart missing or from another cycle',
    'Text-only answer; the missing chart is stated',
  ],
  [
    5,
    'Promote in progress (RETUNING)',
    'Sensors CAUTIONARY; half risk pre-set',
  ],
  [
    6,
    'Model provider down',
    'Fallback model; if both fail, a fixed answer from the sensor board',
  ],
  [7, 'Quota exhausted', 'Refused before any model call; balance shown'],
  [
    8,
    "Knowledge index won't load",
    'Report 1 from sensor data, flagged; Report 2 unaffected',
  ],
  [
    9,
    'News calendar not exported for 45 min',
    'Blackout still applied from the last known schedule; age shown',
  ],
  [
    10,
    '`symbol_specs` older than 7 days',
    'Report 2 not offered until the specs refresh',
  ],
];

/** About 24 (architecture 7.7): the fewest the set may have. */
const MIN_SCENARIOS = 24;

class ToolError extends Error {}

const lf = (text) => text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
const sha256 = (text) =>
  crypto.createHash('sha256').update(text, 'utf8').digest('hex');

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

const isRec = (value) =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const isWhole = (value) => Number.isSafeInteger(value) && value >= 0;

// ---------------------------------------------------------------------------
// Structure (a test holds this to `scenarioSetProblems` of lib/reply/eval/scenarios.ts)
// ---------------------------------------------------------------------------

const SCENARIO_KEYS = [
  'id',
  'family',
  'title',
  'rule',
  'row',
  'cycle',
  'traders',
  'locales',
  'intent',
  'source',
  'condition',
  'overlay',
  'expect',
];
const EXPECT_KEYS = [
  'outcome',
  'fixed_reason',
  'refusal',
  'model_calls',
  'regenerations',
  'schema_retries',
  'numbers_flagged',
  'direction',
  'zones_valid',
  'stand_aside_kept',
  'notes',
  'news_status',
  'fallback_used',
];

function keyProblems(value, keys, where) {
  const out = [];
  for (const key of keys)
    if (!(key in value)) out.push(`${where}.${key} is missing`);
  for (const key of Object.keys(value))
    if (!keys.includes(key)) out.push(`${where}.${key} is not a field`);
  return out;
}

function expectProblems(expect, where) {
  if (!isRec(expect)) return [`${where} is not an object`];
  const problems = keyProblems(expect, EXPECT_KEYS, where);
  if (problems.length > 0) return problems;
  if (!OUTCOMES.includes(expect.outcome))
    problems.push(`${where}.outcome is not an outcome`);
  if (
    expect.fixed_reason !== null &&
    !FIXED_REASONS.includes(expect.fixed_reason)
  )
    problems.push(`${where}.fixed_reason is not a fixed reason`);
  if ((expect.outcome === 'FIXED_ANSWER') !== (expect.fixed_reason !== null))
    problems.push(
      `${where}.fixed_reason is set exactly when the outcome is FIXED_ANSWER`
    );
  if ((expect.outcome === 'REFUSED') !== (expect.refusal !== null))
    problems.push(
      `${where}.refusal is set exactly when the outcome is REFUSED`
    );
  const calls = expect.model_calls;
  if (
    !isRec(calls) ||
    !isWhole(calls.min) ||
    !isWhole(calls.max) ||
    calls.min > calls.max ||
    calls.max > 3
  )
    problems.push(
      `${where}.model_calls is not { min, max } with min <= max <= 3`
    );
  for (const key of ['regenerations', 'schema_retries'])
    if (expect[key] !== 0 && expect[key] !== 1)
      problems.push(`${where}.${key} is not 0 or 1`);
  if (expect.numbers_flagged !== null && !isWhole(expect.numbers_flagged))
    problems.push(`${where}.numbers_flagged is not a count or null`);
  if (expect.direction !== 'SYN' && expect.direction !== 'NONE')
    problems.push(`${where}.direction is not SYN or NONE`);
  for (const key of ['zones_valid', 'stand_aside_kept', 'fallback_used'])
    if (typeof expect[key] !== 'boolean')
      problems.push(`${where}.${key} is not a boolean`);
  if (
    !Array.isArray(expect.notes) ||
    expect.notes.some((n) => !NOTES.includes(n)) ||
    new Set(expect.notes).size !== expect.notes.length
  )
    problems.push(`${where}.notes is not a list of distinct result notes`);
  if (
    expect.news_status !== null &&
    !EVENTS_STATUSES.includes(expect.news_status)
  )
    problems.push(`${where}.news_status is not an events status or null`);
  return problems;
}

function structureProblems(file) {
  if (!isRec(file)) return ['the file is not an object'];
  const problems = keyProblems(
    file,
    ['schema', 'version', 'scenarios'],
    'file'
  );
  if (file.schema !== SCENARIO_SCHEMA)
    problems.push(`schema must be ${SCENARIO_SCHEMA}`);
  if (typeof file.version !== 'string' || file.version === '')
    problems.push('version is not a name');
  if (!Array.isArray(file.scenarios))
    return [...problems, 'scenarios is not a list'];
  const seen = new Set();
  file.scenarios.forEach((s, index) => {
    const where = `scenarios[${index}]`;
    if (!isRec(s)) {
      problems.push(`${where} is not an object`);
      return;
    }
    const own = keyProblems(s, SCENARIO_KEYS, where);
    if (own.length > 0) {
      problems.push(...own);
      return;
    }
    if (typeof s.id !== 'string' || !/^[GODPM][0-9]{2}[a-z]?$/.test(s.id))
      problems.push(`${where}.id is not a scenario id`);
    else if (seen.has(s.id)) problems.push(`${where}.id ${s.id} is used twice`);
    else seen.add(s.id);
    if (!FAMILIES.includes(s.family))
      problems.push(`${where}.family is not a family`);
    for (const key of ['title', 'rule'])
      if (typeof s[key] !== 'string' || s[key] === '')
        problems.push(`${where}.${key} is empty`);
    if (
      s.row !== null &&
      !(Number.isInteger(s.row) && s.row >= 1 && s.row <= 10)
    )
      problems.push(`${where}.row is not 1 to 10 or null`);
    if (typeof s.cycle !== 'string' || !/^(0[1-9]|1[0-6])$/.test(s.cycle))
      problems.push(`${where}.cycle is not 01 to 16`);
    if (
      !Array.isArray(s.traders) ||
      s.traders.length === 0 ||
      s.traders.some((t) => !TRADERS.includes(t)) ||
      new Set(s.traders).size !== s.traders.length
    )
      problems.push(`${where}.traders is not one or both trader types`);
    if (
      s.locales !== 'ALL' &&
      (!Array.isArray(s.locales) ||
        s.locales.length === 0 ||
        s.locales.some((l) => !LOCALES.includes(l)) ||
        new Set(s.locales).size !== s.locales.length)
    )
      problems.push(`${where}.locales is not ALL or a list of the 19 locales`);
    if (!INTENTS.includes(s.intent))
      problems.push(`${where}.intent is not a scenario intent`);
    if (!SOURCES.includes(s.source))
      problems.push(`${where}.source is not MODEL or FIXTURE`);
    if (!CONDITIONS.includes(s.condition))
      problems.push(`${where}.condition is not a condition`);
    if (
      !isRec(s.overlay) ||
      !STATUSES.includes(s.overlay.status) ||
      typeof s.overlay.retuning !== 'boolean'
    )
      problems.push(`${where}.overlay is not { status, retuning }`);
    problems.push(...expectProblems(s.expect, `${where}.expect`));
  });
  return problems;
}

/** The coverage the architecture asks of the set (7.6: each row has a scenario; 7.7: about 24; the 16 cycles, both trader types). */
function coverageProblems(file) {
  const problems = [];
  const list = file.scenarios;
  if (list.length < MIN_SCENARIOS)
    problems.push(
      `the set has ${list.length} scenarios; architecture 7.7 asks for about ${MIN_SCENARIOS}`
    );
  for (const [row] of DEGRADED_ROWS)
    if (!list.some((s) => s.row === row))
      problems.push(`row ${row} of architecture 7.6 has no scenario`);
  for (let n = 1; n <= 16; n += 1) {
    const cycle = String(n).padStart(2, '0');
    const found = list.find((s) => s.family === 'CYCLE' && s.cycle === cycle);
    if (found === undefined)
      problems.push(`golden cycle ${cycle} has no CYCLE scenario`);
    else if (!TRADERS.every((t) => found.traders.includes(t)))
      problems.push(`golden cycle ${cycle} is not run for both trader types`);
  }
  for (const family of FAMILIES)
    if (!list.some((s) => s.family === family))
      problems.push(`no scenario of the family ${family}`);
  if (!list.some((s) => s.overlay.status === 'DELAYED'))
    problems.push('no scenario runs on DELAYED data');
  if (!list.some((s) => s.overlay.status === 'STALE'))
    problems.push('no scenario runs on STALE data');
  if (!list.some((s) => s.overlay.status === 'MARKET_CLOSED'))
    problems.push('no scenario runs on MARKET_CLOSED data');
  if (!list.some((s) => s.overlay.retuning))
    problems.push('no scenario runs while RETUNING');
  if (
    !list.some(
      (s) => s.condition === 'PLANT_BANNED_PHRASE' && s.locales === 'ALL'
    )
  )
    problems.push('the planted listed phrase is not run in all 19 locales');
  if (
    !list.some(
      (s) => s.family === 'DEMO' && s.locales === 'ALL' && s.source === 'MODEL'
    )
  )
    problems.push('the Free tier demo scenario is not run in all 19 locales');
  for (const s of list) {
    if (s.family === 'PLANTED' && s.source !== 'FIXTURE')
      problems.push(
        `${s.id}: a planted failure is staged, so its source is FIXTURE`
      );
    if (s.family === 'CYCLE' && s.source !== 'MODEL')
      problems.push(
        `${s.id}: a CYCLE scenario is written by the model under test`
      );
    if (s.condition.startsWith('PLANT_') && s.family !== 'PLANTED')
      problems.push(
        `${s.id}: a planted condition belongs to the PLANTED family`
      );
  }
  return problems;
}

// ---------------------------------------------------------------------------
// Counts and the review sheet
// ---------------------------------------------------------------------------

function localesOf(s) {
  return s.locales === 'ALL' ? LOCALES.length : s.locales.length;
}

/** Cells of one pass and the cells that count toward a language's score (the rule of lib/reply/eval/scenarios.ts `isScored`). */
function counts(file) {
  let cells = 0;
  let scored = 0;
  let live = 0;
  for (const s of file.scenarios) {
    const n = s.traders.length * localesOf(s);
    cells += n;
    const e = s.expect;
    const isScored =
      s.source === 'MODEL' &&
      s.locales === 'ALL' &&
      (e.outcome === 'REPORT1' || e.outcome === 'ANSWER') &&
      e.regenerations === 0 &&
      e.schema_retries === 0 &&
      e.numbers_flagged === 0 &&
      !e.fallback_used;
    if (isScored) scored += n;
    if (s.source === 'MODEL') live += n;
  }
  return { cells, scored, live };
}

const cell = (text) => String(text).replace(/\|/g, '\\|').replace(/\n/g, ' ');
const rangeText = (r) =>
  r.min === r.max ? String(r.min) : `${r.min} to ${r.max}`;

function expectText(e) {
  const parts = [e.outcome];
  if (e.fixed_reason) parts.push(`(${e.fixed_reason})`);
  if (e.refusal) parts.push(`(${e.refusal}, the balance shown)`);
  parts.push(`model calls ${rangeText(e.model_calls)}`);
  if (e.regenerations) parts.push('one regeneration');
  if (e.schema_retries) parts.push('one schema retry');
  if (e.numbers_flagged)
    parts.push(`${e.numbers_flagged} number shown as "not verified"`);
  if (e.fallback_used) parts.push('the fallback writes it');
  parts.push(
    e.direction === 'SYN'
      ? "direction = the synthesis reading's"
      : 'no direction stated'
  );
  if (e.outcome === 'REPORT1') parts.push('zone ids valid, stand-aside kept');
  if (e.notes.length > 0) parts.push(`notes ${e.notes.join(', ')}`);
  if (e.news_status) parts.push(`calendar ${e.news_status}`);
  return parts.join('; ');
}

function renderReview(file) {
  const c = counts(file);
  const out = [];
  out.push('# Golden scenarios of the reply path: review sheet', '');
  out.push(
    '> GENERATED by `node scripts/reply/golden-tool.js record` from `config/reply/golden/scenarios.v1.json`. Do not edit this file; edit the scenarios and run `record` again.',
    ''
  );
  out.push(
    '**What you are approving.** Each row below is one situation the reply path must handle and what must be true afterwards, written from the architecture before anything was run. The checks that run them through the real orchestrator are `__tests__/lib/reply/eval/` and `scripts/reply/eval-run.js`. A scenario you approve is a promise: if the pipeline ever stops keeping it, the release gate stops the deploy.',
    ''
  );
  out.push(
    '**How to approve.** Read the table, then edit `config/reply/golden/approval.json`: set `status` to `APPROVED`, `approved_by` to your name and `approved_on` to the date. The file holds the hash of the scenarios as they were read, so a later edit to them puts the approval back to "written for other scenarios".',
    ''
  );
  out.push('## Counts', '');
  out.push(
    `- ${file.scenarios.length} scenarios: ${FAMILIES.map((f) => `${file.scenarios.filter((s) => s.family === f).length} ${f}`).join(', ')}.`
  );
  out.push(
    `- ${c.cells} cells in one pass (a cell is a scenario, a trader type and a locale); ${c.live} of them are written by the model under test in a live run (the rest are staged and cost nothing); ${c.scored} count toward a language's score.`
  );
  out.push(`- Content hash: \`${sha256(canonical(file))}\``, '');
  out.push(
    '## Architecture 7.6: the ten rows and the scenarios that hold them',
    ''
  );
  out.push(
    '| Row | Failure | Response (architecture) | Scenarios |',
    '| ---: | --- | --- | --- |'
  );
  for (const [row, failure, response] of DEGRADED_ROWS) {
    const ids = file.scenarios.filter((s) => s.row === row).map((s) => s.id);
    out.push(
      `| ${row} | ${cell(failure)} | ${cell(response)} | ${ids.join(', ')} |`
    );
  }
  out.push('');
  out.push('## The scenarios', '');
  out.push(
    '| Id | Family | Situation | Cycle | Traders | Locales | Asks | Staged | Words from | Must be true |'
  );
  out.push('| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |');
  for (const s of file.scenarios) {
    const staged = [
      s.overlay.status !== 'FRESH' ? `data ${s.overlay.status}` : null,
      s.overlay.retuning ? 'RETUNING' : null,
      s.condition !== 'NONE' ? s.condition : null,
    ].filter(Boolean);
    out.push(
      `| ${s.id} | ${s.family} | ${cell(s.title)} | ${s.cycle} | ${s.traders.join(' + ')} | ${s.locales === 'ALL' ? 'all 19' : s.locales.join(', ')} | ${s.intent} | ${staged.length ? staged.join(', ') : 'nothing'} | ${s.source === 'MODEL' ? 'the model' : 'staged replies'} | ${cell(expectText(s.expect))} |`
    );
  }
  out.push('');
  out.push('## Why each one must hold', '');
  for (const s of file.scenarios) out.push(`- **${s.id}** ${s.rule}`);
  out.push('');
  out.push('## What this sheet does not cover', '');
  out.push(
    '- The expectations say what the pipeline does; they do not say the words are good. The 19 languages of the wording lists, the invalidation lines and the disclaimers wait for native readers and counsel (architecture Appendix D).',
    "- Rows 9 and 10 of architecture 7.6 are decided inside Engine 4 (the blackout and the offer check). The scenarios D09 and D10 hold the reply path's half; the other half is held by Engine 4's approved worked examples 08 and 09.",
    '- A run of the model under test (runbook S2) is what makes any of this a statement about a model. Until then every run is a STAND-IN run.',
    ''
  );
  return `${out.join('\n')}`;
}

// ---------------------------------------------------------------------------
// Approval
// ---------------------------------------------------------------------------

const contentSha256 = (file) => sha256(canonical(file));

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
      'the approval was written for other scenarios: run `record`, then read and sign again'
    );
  return problems;
}

function load(root) {
  const file = readJson(root, FILES.scenarios);
  const problems = structureProblems(file);
  if (problems.length > 0)
    throw new ToolError(
      `the scenarios have problems:\n- ${problems.join('\n- ')}`
    );
  return file;
}

function record(root) {
  const file = load(root);
  const problems = coverageProblems(file);
  if (problems.length > 0)
    throw new ToolError(
      `the scenarios do not cover what the architecture asks; fix them first:\n- ${problems.join('\n- ')}`
    );
  const digest = contentSha256(file);
  let old = null;
  try {
    old = readApproval(root);
  } catch {
    old = null;
  }
  const writes = [
    [FILES.review, `${renderReview(file)}`],
    [FILES.approval, dump(newApproval(digest, old))],
  ];
  for (const [rel, text] of writes) {
    const full = path.join(root, rel);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, text, 'utf8');
  }
  return writes.map(([rel]) => rel);
}

function check(root, { requireApproved = false } = {}) {
  const file = readJson(root, FILES.scenarios);
  const problems = [...structureProblems(file)];
  if (problems.length === 0) problems.push(...coverageProblems(file));
  if (problems.length > 0) return { problems, status: null };
  const digest = contentSha256(file);
  const reviewPath = path.join(root, FILES.review);
  if (!fs.existsSync(reviewPath)) problems.push(`${FILES.review} is missing`);
  else if (lf(fs.readFileSync(reviewPath, 'utf8')) !== lf(renderReview(file)))
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
    if (requireApproved && approval.status !== APPROVED)
      problems.push(
        'the golden scenarios are PENDING: no model joins the registry on scenarios nobody approved'
      );
  }
  return { problems, status: approval === null ? null : approval.status };
}

function renderMatrix(file) {
  const out = ['| Row | Failure | Scenarios |', '| ---: | --- | --- |'];
  for (const [row, failure] of DEGRADED_ROWS) {
    const ids = file.scenarios.filter((s) => s.row === row).map((s) => s.id);
    out.push(
      `| ${row} | ${failure} | ${ids.length ? ids.join(', ') : 'NONE'} |`
    );
  }
  return out.join('\n');
}

function main(argv) {
  const args = argv.slice(2);
  const rootIndex = args.indexOf('--root');
  const root =
    rootIndex === -1
      ? path.resolve(__dirname, '..', '..')
      : path.resolve(args[rootIndex + 1]);
  const command = args.find(
    (arg, index) => !arg.startsWith('--') && args[index - 1] !== '--root'
  );
  try {
    if (command === 'record') {
      for (const rel of record(root)) console.log(`wrote ${rel}`);
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
        `the golden scenarios are as they should be (approval ${status})`
      );
      return 0;
    }
    if (command === 'matrix') {
      const file = load(root);
      console.log(renderMatrix(file));
      return DEGRADED_ROWS.every(([row]) =>
        file.scenarios.some((s) => s.row === row)
      )
        ? 0
        : 1;
    }
    console.error(
      'usage: golden-tool.js record | check [--require-approved] | matrix [--root DIR]'
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
  DEGRADED_ROWS,
  FILES,
  check,
  counts,
  coverageProblems,
  contentSha256,
  record,
  renderMatrix,
  renderReview,
  structureProblems,
};

if (require.main === module) {
  process.exitCode = main(process.argv);
}
