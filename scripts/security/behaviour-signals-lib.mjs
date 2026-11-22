// Behaviour signals of the private security pipeline (Phase 4 of the security
// monitoring architecture, v3.0, section 6.4): abuse seen while it starts.
//
//   BS-1 webhooks  any 5xx, or more than 5 signature failures an hour, on a provider webhook route (T6)
//   BS-2 auth      more than 20 failed logins, resets or 2FA checks an hour from one address
//                  bucket, or more than 5 for one account (T7)
//   BS-3 http      5xx above 1 % (P1) or 429 above 5 % (P2) of the requests of a 15 minute window (T8)
//   BS-4 llm       the day's LLM spend or request count above 2x the median of the last 7 days (T8)
//   BS-5 queue     BullMQ `failed` above 0, or `waiting` growing, for 15 minutes or more (T8, T10)
//   BS-6 main      a commit on the first-parent line of `main` that did not arrive through a
//                  merged pull request (T1)
//
// The thresholds are the initial ones of the architecture; the ones it leaves open (the 429
// share, minimum samples, the age of a snapshot) are in BEHAVIOUR_BASELINE, to be tuned in Phase 5.
//
// Pure functions. Every probe (the GitHub API, the gateway health endpoint) is injected, so the
// tests run without a network, and nothing here prints. The repository is public: the only output
// that may name a route, a bucket or a commit is the private, gitignored report; the console
// summary is counts and fixed words (`renderBehaviourStdout`).
//
// A check ends in one of four states (the same as the posture sweep):
//   pass         the signal is within its threshold
//   fail         it is not; becomes a finding with a priority and a rule
//   unavailable  the telemetry could not be read (unreadable, too old) or a probe failed: the
//                sweep is degraded, because the absence of a finding is then no proof of safety
//   skipped      there is nothing to judge (no sample yet, too few requests): not degraded
//
// reports/behaviour-input.json is the telemetry snapshot, written by whatever collects the logs
// (schema 1.0; every section is optional, and each section judges on its own):
//   { "schema_version": "1.0", "collected_at": "<ISO time>",
//     "webhooks": { "collected_at": "<ISO>", "window_minutes": 60,
//         "routes": [ { "id": "money-stripe", "asset": "money-service", "requests": 40,
//                       "status_5xx": 0, "signature_failures": 1 } ] },
//     "auth":     { "window_minutes": 60, "asset": "monolith-web",
//         "ip_buckets": [ { "bucket": "<opaque hash>", "failures": 3 } ],
//         "account_buckets": [ { "bucket": "<opaque hash>", "failures": 1 } ] },
//     "http":     { "window_minutes": 15, "asset": "monolith-web",
//         "requests": 5200, "status_5xx": 8, "status_429": 31 },
//     "llm":      { "asset": "chat-server",
//         "today": { "date": "2026-11-22", "spend_usd": 4.2, "requests": 310 },
//         "daily": [ { "date": "2026-11-21", "spend_usd": 2.0, "requests": 150 } ] },
//     "queue":    { "samples": [ { "at": "<ISO>", "waiting": 3, "failed": 0, "active": 1 } ] } }
// Buckets are opaque hashes: a value that looks like an address is dropped and never echoed.

import { DEFAULT_REPO } from './dependabot-triage-lib.mjs';
import { mergePostureFindings } from './posture-sweep-lib.mjs';
import {
  escapeMarkdownCell,
  findingKey,
  makeFinding,
} from './security-pipeline-lib.mjs';

const MINUTE_MS = 60000;
const HOUR_MS = 3600000;
const FUTURE_SKEW_HOURS = 10 / 60; // a clock a few minutes ahead is not an error

/** The recorded thresholds. A change here is a decision, not a fix. */
export const BEHAVIOUR_BASELINE = Object.freeze({
  maxSnapshotAgeHours: 26, // a section older than this says nothing about now
  webhook: Object.freeze({ maxSignatureFailuresPerHour: 5 }), // and no 5xx at all
  auth: Object.freeze({
    maxFailuresPerHourPerAddressBucket: 20,
    maxFailuresPerHourPerAccount: 5,
    maxOffendersListed: 20,
  }),
  http: Object.freeze({
    minRequests: 20, // fewer requests cannot show a rate
    maxServerErrorPercent: 1,
    maxRateLimitedPercent: 5,
  }),
  llm: Object.freeze({ multiple: 2, historyDays: 7, minHistoryDays: 3 }),
  queue: Object.freeze({
    sustainedMinutes: 15,
    minSamplesFailed: 2,
    minSamplesWaiting: 3,
    historyHours: 24,
    maxSamples: 300,
  }),
  mainPush: Object.freeze({
    defaultLookbackDays: 7,
    maxLookbackDays: 30,
    maxCommits: 60,
  }),
});

/** The six signals, in report order. The name is the fixed word the heartbeat shows. */
export const AREAS = Object.freeze([
  'webhooks',
  'auth',
  'http',
  'llm',
  'queue',
  'main',
]);
export const SIGNAL_IDS = Object.freeze({
  webhooks: 'BS-1',
  auth: 'BS-2',
  http: 'BS-3',
  llm: 'BS-4',
  queue: 'BS-5',
  main: 'BS-6',
});

/**
 * Rules of the behaviour checks: priority, time to a first response, the threat of the
 * architecture (section 2) and the playbook of the runbook that answers it. BS-1 and BS-2 touch
 * payments and authentication, so they carry the Rule 5 escalation. A rule with no playbook is
 * answered by the "Behaviour signals without a playbook" section of the runbook.
 */
export const BEHAVIOUR_RULES = Object.freeze({
  'BS-1': {
    priority: 'P1',
    signal: 'webhooks',
    threat: 'T6',
    kind: 'webhook-anomaly',
    rule5: true,
    playbook: 'PB-4',
    sla: '< 72 h (provider dashboard first; Rule 5 decision)',
  },
  'BS-2': {
    priority: 'P1',
    signal: 'auth',
    threat: 'T7',
    kind: 'auth-abuse',
    rule5: true,
    playbook: null,
    sla: '< 72 h (Rule 5 decision)',
  },
  'BS-3': {
    priority: 'P1',
    signal: 'http',
    threat: 'T8',
    kind: 'error-rate',
    rule5: false,
    playbook: null,
    sla: '< 72 h (find the failing route; tighten limits or pause the feature)',
  },
  'BS-3b': {
    priority: 'P2',
    signal: 'http',
    threat: 'T8',
    kind: 'error-rate',
    rule5: false,
    playbook: null,
    sla: '14 days (watch it; tighten limits if it persists)',
  },
  'BS-4': {
    priority: 'P1',
    signal: 'llm',
    threat: 'T8',
    kind: 'llm-anomaly',
    rule5: false,
    playbook: null,
    sla: '< 72 h (provider dashboard first; pause the feature if it is abuse)',
  },
  'BS-5': {
    priority: 'P1',
    signal: 'queue',
    threat: 'T8, T10',
    kind: 'queue-health',
    rule5: false,
    playbook: null,
    sla: '< 72 h (find why the jobs fail)',
  },
  'BS-5b': {
    priority: 'P2',
    signal: 'queue',
    threat: 'T8, T10',
    kind: 'queue-health',
    rule5: false,
    playbook: null,
    sla: '14 days (watch the backlog)',
  },
  'BS-6': {
    priority: 'P1',
    signal: 'main',
    threat: 'T1',
    kind: 'main-push',
    rule5: false,
    playbook: 'PB-5',
    sla: '< 72 h (review the commit; freeze deploys if it is unexplained)',
  },
});

// --- small helpers ------------------------------------------------------------------------

const isObject = (value) =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

// Control characters are removed and a long value is cut: an observed value comes from a file
// or the network, and is never stored whole.
function short(value, max = 120) {
  const text = String(value ?? '')
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001f\u007f]+/g, ' ')
    .trim();
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

// A reason code: fixed words only, never a message that could quote data.
const safeCode = (value, fallback = 'probe_error') =>
  typeof value === 'string' && /^[a-z0-9_]{1,40}$/i.test(value)
    ? value
    : fallback;

const isoOrNull = (value) => {
  const ms = typeof value === 'string' ? Date.parse(value) : NaN;
  return Number.isFinite(ms) ? new Date(ms).toISOString() : null;
};

const round1 = (value) => Math.round(value * 10) / 10;

const SAFE_ID_RE = /^[a-z0-9][a-z0-9-]{0,39}$/;
// an opaque hash or bucket name; a value that looks like an address is refused separately
const BUCKET_RE = /^[A-Za-z0-9][A-Za-z0-9_-]{2,63}$/;
const ADDRESS_LIKE_RE = /(?:\d{1,3}[-_.]){3}\d{1,3}/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const isSafeId = (value) => typeof value === 'string' && SAFE_ID_RE.test(value);
const isBucketId = (value) =>
  typeof value === 'string' &&
  BUCKET_RE.test(value) &&
  !ADDRESS_LIKE_RE.test(value);
// a count of events: a whole number, not negative
const count = (value) =>
  Number.isInteger(value) && value >= 0 && value <= 1e12 ? value : null;
const money = (value) =>
  typeof value === 'number' &&
  Number.isFinite(value) &&
  value >= 0 &&
  value < 1e9
    ? value
    : null;
// a calendar day: 2026-02-30 and 2026-13-45 have the shape but are not days (and an impossible
// month makes toISOString throw, so the time is checked first)
const isDay = (value) => {
  if (typeof value !== 'string' || !DATE_RE.test(value)) return false;
  const ms = Date.parse(`${value}T00:00:00Z`);
  return (
    Number.isFinite(ms) && new Date(ms).toISOString().slice(0, 10) === value
  );
};

// --- check constructors -----------------------------------------------------------------------------

function makeCheck(base, status, extra = {}) {
  const rule = status === 'fail' ? extra.rule : null;
  return {
    id: base.id,
    signal: SIGNAL_IDS[base.area],
    area: base.area,
    assetId: base.assetId,
    title: base.title,
    status,
    priority: rule ? BEHAVIOUR_RULES[rule].priority : null,
    rule,
    expected: base.expected ?? null,
    observed: extra.observed ?? null,
    detail: extra.detail ?? null,
  };
}
const pass = (base, observed) =>
  makeCheck(base, 'pass', { observed: short(observed) });
const fail = (base, rule, observed) =>
  makeCheck(base, 'fail', { rule, observed: short(observed) });
const unavailable = (base, detail) =>
  makeCheck(base, 'unavailable', { detail: safeCode(detail) });
const skipped = (base, detail) =>
  makeCheck(base, 'skipped', { detail: safeCode(detail) });

// The checks of each signal, as they appear when the signal could not be judged.
const BASES = Object.freeze({
  webhooks: {
    id: 'bs1-webhooks',
    area: 'webhooks',
    assetId: 'money-service',
    title: 'Webhook routes: no 5xx and few signature failures',
    expected: '5xx=0 signature_failures<=5/h',
  },
  authIp: {
    id: 'bs2-auth-ip',
    area: 'auth',
    assetId: 'monolith-web',
    title: 'Failed logins, resets and 2FA checks per address bucket',
    expected: '<=20 failures/h per address bucket',
  },
  authAccount: {
    id: 'bs2-auth-account',
    area: 'auth',
    assetId: 'monolith-web',
    title: 'Failed logins, resets and 2FA checks per account',
    expected: '<=5 failures/h per account',
  },
  http5xx: {
    id: 'bs3-http-5xx',
    area: 'http',
    assetId: 'monolith-web',
    title: 'Share of 5xx answers',
    expected: '5xx<=1% (>=20 requests)',
  },
  http429: {
    id: 'bs3-http-429',
    area: 'http',
    assetId: 'monolith-web',
    title: 'Share of 429 answers',
    expected: '429<=5% (>=20 requests)',
  },
  llmSpend: {
    id: 'bs4-llm-spend',
    area: 'llm',
    assetId: 'chat-server',
    title: 'LLM spend today against the 7-day median',
    expected: '<=2x the median of the last 7 days',
  },
  llmRequests: {
    id: 'bs4-llm-requests',
    area: 'llm',
    assetId: 'chat-server',
    title: 'LLM requests today against the 7-day median',
    expected: '<=2x the median of the last 7 days',
  },
  queueFailed: {
    id: 'bs5-queue-failed',
    area: 'queue',
    assetId: 'railway-gateway',
    title: 'BullMQ failed jobs',
    expected: 'failed=0 for 15 min',
  },
  queueWaiting: {
    id: 'bs5-queue-waiting',
    area: 'queue',
    assetId: 'railway-gateway',
    title: 'BullMQ waiting jobs',
    expected: 'waiting not growing for 15 min',
  },
  mainPush: {
    id: 'bs6-main-push',
    area: 'main',
    assetId: 'github-repo',
    title: 'Every commit on main arrived through a merged pull request',
    expected: 'no direct push',
  },
});

/** One check per base, for a telemetry section that cannot be judged. */
function sectionNotRun(section, bases) {
  if (section?.state === 'absent') {
    return bases.map((base) => skipped(base, 'no_telemetry_sample'));
  }
  if (section?.state === 'stale') {
    return bases.map((base) => unavailable(base, 'stale_telemetry'));
  }
  return bases.map((base) => unavailable(base, 'invalid_telemetry'));
}

// --- the telemetry snapshot ---------------------------------------------------------------------------

const parseWindow = (value, fallback) => {
  if (value === undefined) return fallback;
  return Number.isInteger(value) && value >= 1 && value <= 1440 ? value : null;
};

function parseWebhooks(raw, issues) {
  const windowMinutes = parseWindow(raw.window_minutes, 60);
  if (windowMinutes === null || !Array.isArray(raw.routes)) return null;
  const routes = [];
  const seen = new Set();
  for (const r of raw.routes) {
    const asset =
      isObject(r) && r.asset !== undefined ? r.asset : 'money-service';
    const requests =
      isObject(r) && r.requests !== undefined ? count(r.requests) : null;
    if (
      !isObject(r) ||
      !isSafeId(r.id) ||
      !isSafeId(asset) ||
      count(r.status_5xx) === null ||
      count(r.signature_failures) === null ||
      (r.requests !== undefined && requests === null)
    ) {
      issues.push('webhooks:bad_route');
      continue;
    }
    if (seen.has(r.id)) {
      issues.push('webhooks:duplicate_route');
      continue;
    }
    seen.add(r.id);
    routes.push({
      id: r.id,
      assetId: asset,
      requests,
      serverErrors: r.status_5xx,
      signatureFailures: r.signature_failures,
    });
  }
  return { windowMinutes, routes };
}

// undefined: the dimension is not in the snapshot; null: it is not a list
function parseBuckets(list, issues) {
  if (list === undefined) return undefined;
  if (!Array.isArray(list)) return null;
  const out = [];
  for (const b of list) {
    if (!isObject(b) || !isBucketId(b.bucket) || count(b.failures) === null) {
      issues.push('auth:bad_bucket');
      continue;
    }
    out.push({ bucket: b.bucket, failures: b.failures });
  }
  return out;
}

function parseAuth(raw, issues) {
  const windowMinutes = parseWindow(raw.window_minutes, 60);
  const asset = raw.asset === undefined ? 'monolith-web' : raw.asset;
  const ipBuckets = parseBuckets(raw.ip_buckets, issues);
  const accountBuckets = parseBuckets(raw.account_buckets, issues);
  if (
    windowMinutes === null ||
    !isSafeId(asset) ||
    ipBuckets === null ||
    accountBuckets === null
  ) {
    return null;
  }
  return {
    windowMinutes,
    assetId: asset,
    ipBuckets: ipBuckets ?? null,
    accountBuckets: accountBuckets ?? null,
  };
}

function parseHttp(raw) {
  const windowMinutes = parseWindow(raw.window_minutes, 15);
  const asset = raw.asset === undefined ? 'monolith-web' : raw.asset;
  const requests = count(raw.requests);
  const serverErrors = count(raw.status_5xx);
  const rateLimited = count(raw.status_429);
  if (
    windowMinutes === null ||
    !isSafeId(asset) ||
    requests === null ||
    serverErrors === null ||
    rateLimited === null ||
    serverErrors + rateLimited > requests
  ) {
    return null;
  }
  return { windowMinutes, assetId: asset, requests, serverErrors, rateLimited };
}

function parseDay(raw) {
  if (!isObject(raw) || !isDay(raw.date)) return null;
  const spendUsd = money(raw.spend_usd);
  const requests = count(raw.requests);
  return spendUsd === null || requests === null
    ? null
    : { date: raw.date, spendUsd, requests };
}

function parseLlm(raw, issues) {
  const asset = raw.asset === undefined ? 'chat-server' : raw.asset;
  if (!isSafeId(asset) || !Array.isArray(raw.daily)) return null;
  const today = parseDay(raw.today);
  if (today === null) return null;
  const seen = new Set();
  const daily = [];
  for (const entry of raw.daily) {
    const day = parseDay(entry);
    if (day === null) {
      issues.push('llm:bad_day');
      continue;
    }
    if (day.date === today.date) continue; // today is never its own baseline
    if (seen.has(day.date)) {
      issues.push('llm:duplicate_date');
      continue;
    }
    seen.add(day.date);
    daily.push(day);
  }
  daily.sort((a, b) => (a.date < b.date ? 1 : -1)); // newest first
  return { assetId: asset, today, daily };
}

// One health sample of the gateway queue: `at` is when it was read.
export function parseQueueSample(raw) {
  if (!isObject(raw)) return null;
  const at = isoOrNull(raw.at);
  const waiting = count(raw.waiting);
  const failed = count(raw.failed);
  const active = raw.active === undefined ? 0 : count(raw.active);
  if (at === null || waiting === null || failed === null || active === null) {
    return null;
  }
  return { at, waiting, failed, active };
}

function parseQueue(raw, issues) {
  if (!Array.isArray(raw.samples)) return null;
  const samples = [];
  for (const entry of raw.samples) {
    const sample = parseQueueSample(entry);
    if (sample === null) issues.push('queue:bad_sample');
    else samples.push(sample);
  }
  samples.sort((a, b) => Date.parse(a.at) - Date.parse(b.at));
  return { samples };
}

/**
 * One section of the snapshot. `absent`: not in the file. `invalid`: it cannot be read (a code
 * says why). `stale`: older than the maximum age. `ok`: fresh and well formed, with `data`.
 */
function readSection(
  raw,
  { name, fileAt, now, parse, issues, checkAge = true }
) {
  if (raw === undefined || raw === null) return { state: 'absent' };
  if (!isObject(raw)) {
    issues.push(`${name}:not_an_object`);
    return { state: 'invalid', code: 'not_an_object' };
  }
  const collectedAt = isoOrNull(raw.collected_at) ?? fileAt;
  if (checkAge && collectedAt === null) {
    issues.push(`${name}:no_collected_at`);
    return { state: 'invalid', code: 'no_collected_at' };
  }
  const ageHours =
    collectedAt === null
      ? null
      : (now.getTime() - Date.parse(collectedAt)) / HOUR_MS;
  if (checkAge && ageHours < -FUTURE_SKEW_HOURS) {
    issues.push(`${name}:future_collected_at`);
    return { state: 'invalid', code: 'future_collected_at' };
  }
  const data = parse(raw, issues);
  if (data === null) {
    issues.push(`${name}:bad_data`);
    return { state: 'invalid', code: 'bad_data' };
  }
  if (checkAge && ageHours > BEHAVIOUR_BASELINE.maxSnapshotAgeHours) {
    return { state: 'stale', collectedAt, ageHours: round1(ageHours) };
  }
  return {
    state: 'ok',
    collectedAt,
    ageHours: ageHours === null ? null : round1(Math.max(0, ageHours)),
    data,
  };
}

/**
 * Reads the telemetry snapshot (reports/behaviour-input.json). Never throws: a file that is
 * missing is a normal state, a section that cannot be read is `invalid`, and every dropped
 * entry leaves a fixed issue code (never its value).
 *
 * @param {unknown} raw the parsed JSON, or null when there is no file
 * @param {{ now: Date }} input
 */
export function parseBehaviourInput(raw, { now }) {
  const issues = [];
  const sections = {
    webhooks: { state: 'absent' },
    auth: { state: 'absent' },
    http: { state: 'absent' },
    llm: { state: 'absent' },
    queue: { state: 'absent' },
  };
  if (raw === null || raw === undefined) {
    return { present: false, collectedAt: null, sections, issues };
  }
  if (!isObject(raw)) {
    return {
      present: true,
      collectedAt: null,
      sections,
      issues: ['file:not_an_object'],
    };
  }
  const fileAt = isoOrNull(raw.collected_at);
  const read = (name, parse, options = {}) => {
    sections[name] = readSection(raw[name], {
      name,
      fileAt,
      now,
      parse,
      issues,
      ...options,
    });
  };
  read('webhooks', parseWebhooks);
  read('auth', parseAuth);
  read('http', parseHttp);
  read('llm', parseLlm);
  // the queue is judged on its newest sample (live and saved samples join it), not on the file
  read('queue', parseQueue, { checkAge: false });
  return {
    present: true,
    collectedAt: fileAt,
    sections,
    issues: [...new Set(issues)],
  };
}

// --- BS-1: webhooks ----------------------------------------------------------------------------------------

// A window longer than an hour is scaled down to an hour; a shorter one is never scaled up (a
// short burst is not extrapolated into an hourly rate).
const perHour = (events, windowMinutes) =>
  windowMinutes <= 60 ? events : (events * 60) / windowMinutes;

/**
 * BS-1 (T6): any 5xx, or more than 5 signature failures an hour, on a webhook route.
 *
 * @returns {{ checks: object[], notes: string[] }}
 */
export function evaluateWebhooks(section) {
  if (section.state !== 'ok') {
    return { checks: sectionNotRun(section, [BASES.webhooks]), notes: [] };
  }
  const { routes, windowMinutes } = section.data;
  if (routes.length === 0) {
    return {
      checks: [skipped(BASES.webhooks, 'no_telemetry_sample')],
      notes: [],
    };
  }
  const limit = BEHAVIOUR_BASELINE.webhook.maxSignatureFailuresPerHour;
  const checks = routes.map((r) => {
    const base = {
      ...BASES.webhooks,
      id: `bs1-webhook-${r.id}`,
      assetId: r.assetId,
    };
    const rate = perHour(r.signatureFailures, windowMinutes);
    const observed = `5xx=${r.serverErrors} signature_failures=${round1(rate)}/h${r.requests === null ? '' : ` requests=${r.requests}`}`;
    return r.serverErrors > 0 || rate > limit
      ? fail(base, 'BS-1', observed)
      : pass(base, observed);
  });
  return { checks, notes: [] };
}

// --- BS-2: failed logins, resets and 2FA ------------------------------------------------------------------

/**
 * BS-2 (T7): more than 20 failures an hour for one address bucket, or more than 5 for one
 * account. Each offending bucket is a check of its own; a dimension without an offender is one
 * passing check.
 *
 * @returns {{ checks: object[], notes: string[] }}
 */
export function evaluateAuthFailures(section) {
  if (section.state !== 'ok') {
    return {
      checks: sectionNotRun(section, [BASES.authIp, BASES.authAccount]),
      notes: [],
    };
  }
  const { windowMinutes, assetId, ipBuckets, accountBuckets } = section.data;
  const { maxOffendersListed } = BEHAVIOUR_BASELINE.auth;
  const checks = [];
  const notes = [];
  const dimension = (base, buckets, limit, label) => {
    const here = { ...base, assetId };
    if (buckets === null) {
      checks.push(skipped(here, 'no_telemetry_sample'));
      return;
    }
    const rated = buckets.map((b) => ({
      ...b,
      rate: perHour(b.failures, windowMinutes),
    }));
    const offenders = rated
      .filter((b) => b.rate > limit)
      .sort((a, z) => z.rate - a.rate || a.bucket.localeCompare(z.bucket));
    if (offenders.length === 0) {
      const max = rated.reduce((m, b) => Math.max(m, b.rate), 0);
      checks.push(pass(here, `max=${round1(max)}/h buckets=${rated.length}`));
      return;
    }
    for (const b of offenders.slice(0, maxOffendersListed)) {
      checks.push(
        fail(
          { ...here, id: `${base.id}-${b.bucket}` },
          'BS-2',
          `failures=${round1(b.rate)}/h window=${windowMinutes}m`
        )
      );
    }
    if (offenders.length > maxOffendersListed) {
      notes.push(
        `auth: ${offenders.length - maxOffendersListed} more offending ${label} buckets not listed`
      );
    }
  };
  dimension(
    BASES.authIp,
    ipBuckets,
    BEHAVIOUR_BASELINE.auth.maxFailuresPerHourPerAddressBucket,
    'address'
  );
  dimension(
    BASES.authAccount,
    accountBuckets,
    BEHAVIOUR_BASELINE.auth.maxFailuresPerHourPerAccount,
    'account'
  );
  return { checks, notes };
}

// --- BS-3: 5xx and 429 -------------------------------------------------------------------------------------------

/**
 * BS-3 (T8): 5xx above 1 % of the requests of the window is a P1; 429 above 5 % is a P2 (rule
 * BS-3b). Fewer than 20 requests show no rate, so nothing is judged.
 *
 * @returns {{ checks: object[], notes: string[] }}
 */
export function evaluateHttpRates(section) {
  if (section.state !== 'ok') {
    return {
      checks: sectionNotRun(section, [BASES.http5xx, BASES.http429]),
      notes: [],
    };
  }
  const d = section.data;
  const on = (base) => ({ ...base, assetId: d.assetId });
  if (d.requests < BEHAVIOUR_BASELINE.http.minRequests) {
    return {
      checks: [
        skipped(on(BASES.http5xx), 'below_min_sample'),
        skipped(on(BASES.http429), 'below_min_sample'),
      ],
      notes: [],
    };
  }
  const share = (events) =>
    `${events}/${d.requests} = ${((events * 100) / d.requests).toFixed(2)}% window=${d.windowMinutes}m`;
  // whole-number arithmetic: 1 % exactly is not a breach
  const over = (events, percent) => events * 100 > d.requests * percent;
  const base5xx = on(BASES.http5xx);
  const base429 = on(BASES.http429);
  return {
    checks: [
      over(d.serverErrors, BEHAVIOUR_BASELINE.http.maxServerErrorPercent)
        ? fail(base5xx, 'BS-3', share(d.serverErrors))
        : pass(base5xx, share(d.serverErrors)),
      over(d.rateLimited, BEHAVIOUR_BASELINE.http.maxRateLimitedPercent)
        ? fail(base429, 'BS-3b', share(d.rateLimited))
        : pass(base429, share(d.rateLimited)),
    ],
    notes: [],
  };
}

// --- BS-4: LLM spend and request count ------------------------------------------------------------------

function median(values) {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = sorted.length >> 1;
  return sorted.length % 2 === 1
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) / 2;
}

/**
 * BS-4 (T8): the day's LLM spend, or request count, above twice the median of the seven days
 * before it. At least three days of history are needed, and a median of zero cannot be compared.
 *
 * @returns {{ checks: object[], notes: string[] }}
 */
export function evaluateLlmUsage(section) {
  if (section.state !== 'ok') {
    return {
      checks: sectionNotRun(section, [BASES.llmSpend, BASES.llmRequests]),
      notes: [],
    };
  }
  const { assetId, today, daily } = section.data;
  const { multiple, historyDays, minHistoryDays } = BEHAVIOUR_BASELINE.llm;
  const history = daily.slice(0, historyDays); // newest first; today is not in it
  const metrics = [
    {
      base: { ...BASES.llmSpend, assetId },
      value: today.spendUsd,
      series: history.map((d) => d.spendUsd),
    },
    {
      base: { ...BASES.llmRequests, assetId },
      value: today.requests,
      series: history.map((d) => d.requests),
    },
  ];
  const checks = metrics.map(({ base, value, series }) => {
    if (series.length < minHistoryDays) {
      return skipped(base, 'insufficient_history');
    }
    const med = median(series);
    if (!(med > 0)) return skipped(base, 'no_baseline');
    const observed = `today=${value} median=${med} (${Number((value / med).toFixed(3))}x)`;
    return value > multiple * med
      ? fail(base, 'BS-4', observed)
      : pass(base, observed);
  });
  return { checks, notes: [] };
}

// --- BS-5: BullMQ failed and waiting jobs -----------------------------------------------------------------

// What a live probe of the gateway can answer besides a sample: these words are not failures.
const LIVE_NOT_A_FAILURE = new Set(['ok', 'not_configured', 'offline']);

/**
 * The saved health samples of the gateway queue, in one series: the history file, the samples
 * of the snapshot and the sample taken now. Oldest first, one per time, nothing older than 24
 * hours or from the future, and at most the newest 300.
 *
 * @param {{ history?: unknown[], snapshot?: unknown[], live?: unknown, now: Date }} input
 */
export function mergeQueueSamples({
  history = [],
  snapshot = [],
  live = null,
  now,
}) {
  const { historyHours, maxSamples } = BEHAVIOUR_BASELINE.queue;
  const oldest = now.getTime() - historyHours * HOUR_MS;
  const newest = now.getTime() + FUTURE_SKEW_HOURS * HOUR_MS;
  const byTime = new Map();
  for (const raw of [...history, ...snapshot, ...(live ? [live] : [])]) {
    const sample = parseQueueSample(raw);
    if (sample === null) continue;
    const ms = Date.parse(sample.at);
    if (ms < oldest || ms > newest) continue;
    byTime.set(sample.at, sample);
  }
  return [...byTime.values()]
    .sort((a, b) => Date.parse(a.at) - Date.parse(b.at))
    .slice(-maxSamples);
}

/**
 * BS-5 (T8, T10), on a series of health samples. `failed` above zero in every sample of the
 * last 15 minutes or more is a P1. `waiting` that never fell and ended higher over 15 minutes or
 * more is a P2 (rule BS-5b). A series too short for the rule is skipped, never a pass.
 *
 * @param {{ samples: object[], now: Date, liveStatus?: string | null }} input
 * @returns {{ checks: object[], notes: string[] }}
 */
export function evaluateQueueHealth({ samples, now, liveStatus = null }) {
  const bases = [BASES.queueFailed, BASES.queueWaiting];
  const q = BEHAVIOUR_BASELINE.queue;
  const series = samples
    .map(parseQueueSample)
    .filter((s) => s !== null)
    .sort((a, b) => Date.parse(a.at) - Date.parse(b.at));
  const liveFailed =
    typeof liveStatus === 'string' && !LIVE_NOT_A_FAILURE.has(liveStatus);
  if (series.length === 0) {
    if (liveStatus === 'offline') {
      return { checks: bases.map((b) => skipped(b, 'offline')), notes: [] };
    }
    return {
      checks: bases.map((b) =>
        liveFailed
          ? unavailable(b, liveStatus)
          : skipped(b, 'no_telemetry_sample')
      ),
      notes: [],
    };
  }
  const notes = liveFailed
    ? [
        `queue: the live health probe failed (${safeCode(liveStatus)}); judged on the saved samples`,
      ]
    : [];
  const last = series[series.length - 1];
  const ageHours = (now.getTime() - Date.parse(last.at)) / HOUR_MS;
  if (ageHours > BEHAVIOUR_BASELINE.maxSnapshotAgeHours) {
    return {
      checks: bases.map((b) => unavailable(b, 'stale_telemetry')),
      notes,
    };
  }
  const minutes = (a, b) => (Date.parse(b.at) - Date.parse(a.at)) / MINUTE_MS;
  const wholeSpan = minutes(series[0], last);
  const enough = (minSamples) =>
    series.length >= minSamples && wholeSpan >= q.sustainedMinutes;

  // failed: the run of samples at the end of the series with failed above zero
  let failedCheck;
  if (!enough(q.minSamplesFailed)) {
    failedCheck = skipped(BASES.queueFailed, 'insufficient_samples');
  } else {
    let from = series.length;
    while (from > 0 && series[from - 1].failed > 0) from -= 1;
    const run = series.slice(from);
    const span = run.length > 0 ? minutes(run[0], last) : 0;
    failedCheck =
      run.length >= q.minSamplesFailed && span >= q.sustainedMinutes
        ? fail(
            BASES.queueFailed,
            'BS-5',
            `failed>0 in ${run.length} samples over ${Math.round(span)} min (latest ${last.failed})`
          )
        : pass(
            BASES.queueFailed,
            run.length > 0
              ? `latest failed=${last.failed} (failed>0 for ${Math.round(span)} min)`
              : `latest failed=${last.failed}`
          );
  }

  // waiting: the run at the end that never fell, from the last sample before it first rose
  let waitingCheck;
  if (!enough(q.minSamplesWaiting)) {
    waitingCheck = skipped(BASES.queueWaiting, 'insufficient_samples');
  } else {
    let from = series.length - 1;
    while (from > 0 && series[from - 1].waiting <= series[from].waiting) {
      from -= 1;
    }
    let run = series.slice(from);
    while (run.length >= 2 && run[0].waiting === run[1].waiting) {
      run = run.slice(1);
    }
    // after the flat start is trimmed the run rises from its first sample and never falls, so
    // its last sample is higher than its first: no separate check for growth is needed
    const span = minutes(run[0], last);
    waitingCheck =
      run.length >= q.minSamplesWaiting && span >= q.sustainedMinutes
        ? fail(
            BASES.queueWaiting,
            'BS-5b',
            `waiting ${run[0].waiting} -> ${last.waiting} over ${run.length} samples, ${Math.round(span)} min`
          )
        : pass(BASES.queueWaiting, `latest waiting=${last.waiting}`);
  }
  return { checks: [failedCheck, waitingCheck], notes };
}

// --- BS-6: a push to main that did not come from a merged pull request -----------------------

const COMMIT_SHA_RE = /^[0-9a-f]{40}$/;
const ABBREVIATED_SHA_RE = /^[0-9a-f]{7,40}$/;
const PR_MESSAGE_RE = /^Merge pull request #\d+ from /;
const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

/**
 * BS-6 (T1): every commit on the first-parent line of `main` since the baseline must have
 * arrived through a merged pull request. The evidence is the pull request the GitHub API
 * associates with the commit, never the commit message (a message can be written by anyone who
 * can push). A commit the owner has acknowledged is not a finding.
 *
 * @param {{
 *   result: { ok: boolean, commits?: object[], truncated?: boolean, anchorFound?: boolean | null, skipped?: boolean, error?: string } | undefined,
 *   acknowledged?: string[],
 *   mainBranch?: string,
 * }} input
 * @returns {{ checks: object[], notes: string[], facts: object }}
 */
export function evaluateMainPushes({
  result,
  acknowledged = [],
  mainBranch = 'main',
}) {
  const facts = {
    examined: 0,
    reviewed: 0,
    direct: 0,
    acknowledged: 0,
    undecided: 0,
    truncated: false,
  };
  if (!isObject(result) || result.ok !== true) {
    const check =
      result?.skipped === true
        ? skipped(BASES.mainPush, result.error ?? 'offline')
        : unavailable(BASES.mainPush, result?.error);
    return { checks: [check], notes: [], facts };
  }
  const acks = acknowledged
    .filter((a) => typeof a === 'string')
    .map((a) => a.toLowerCase())
    .filter((a) => ABBREVIATED_SHA_RE.test(a));
  const commits = Array.isArray(result.commits) ? result.commits : [];
  const checks = [];
  for (const c of commits) {
    if (
      !isObject(c) ||
      typeof c.sha !== 'string' ||
      !COMMIT_SHA_RE.test(c.sha)
    ) {
      continue;
    }
    facts.examined += 1;
    const merged =
      Array.isArray(c.pulls) &&
      c.pulls.some(
        (p) => isObject(p) && p.merged === true && p.baseRef === mainBranch
      );
    if (merged) {
      facts.reviewed += 1;
    } else if (acks.some((a) => c.sha.startsWith(a))) {
      facts.acknowledged += 1;
    } else if (!Array.isArray(c.pulls)) {
      facts.undecided += 1;
    } else {
      facts.direct += 1;
      const claims = PR_MESSAGE_RE.test(String(c.subject ?? ''));
      checks.push(
        fail(
          { ...BASES.mainPush, id: `bs6-main-push-${c.sha.slice(0, 12)}` },
          'BS-6',
          `direct push ${isoOrNull(c.at) ?? 'at an unknown time'} (parents=${count(c.parents) ?? '?'})${claims ? ' message claims a pull request' : ''}`
        )
      );
    }
  }
  if (facts.undecided > 0) {
    checks.push(
      unavailable(
        { ...BASES.mainPush, id: 'bs6-main-push-lookup' },
        'pr_lookup_failed'
      )
    );
  }
  if (result.anchorFound === false) {
    checks.push(
      unavailable(
        { ...BASES.mainPush, id: 'bs6-main-push-baseline' },
        'baseline_not_found'
      )
    );
  }
  if (checks.length === 0) {
    const n = facts.examined;
    checks.push(
      pass(
        BASES.mainPush,
        n === 0
          ? 'no commits since the baseline'
          : facts.acknowledged > 0
            ? `${plural(n, 'commit')} since the baseline: ${facts.reviewed} through merged pull requests, ${facts.acknowledged} acknowledged`
            : `${plural(n, 'commit')} since the baseline, all through merged pull requests`
      )
    );
  }
  facts.truncated = result.truncated === true;
  const notes = facts.truncated
    ? [
        `main: only the newest ${BEHAVIOUR_BASELINE.mainPush.maxCommits} commits of the first-parent line were examined`,
      ]
    : [];
  return { checks, notes, facts };
}

// --- the owner's settings and the baseline ------------------------------------------------------------------

function parseHealthUrl(value) {
  if (typeof value !== 'string' || value.length === 0 || value.length > 300) {
    return null;
  }
  let url;
  try {
    url = new URL(value);
  } catch {
    return null;
  }
  if (
    url.protocol !== 'https:' ||
    url.username !== '' ||
    url.password !== '' ||
    url.hostname === ''
  ) {
    return null;
  }
  return url.href;
}

/**
 * Reads behaviour-settings.json, the owner's own file (never overwritten by a tool): the time
 * or the commit after which a push to `main` is judged, the commits already reviewed, and the
 * address of the gateway health endpoint. Never throws; a bad value is dropped with a fixed code.
 *
 * @param {unknown} raw the parsed JSON, or null when there is no file
 */
export function parseBehaviourSettings(raw) {
  const out = {
    present: raw !== null && raw !== undefined,
    issues: [],
    mainPush: { baselineAt: null, baselineSha: null, acknowledged: [] },
    queueHealthUrl: null,
  };
  if (raw === null || raw === undefined) return out;
  if (!isObject(raw)) {
    out.issues.push('file:not_an_object');
    return out;
  }
  const issues = [];
  const push = raw.main_push;
  if (push !== undefined && push !== null) {
    if (!isObject(push)) {
      issues.push('main_push:not_an_object');
    } else {
      if (push.baseline_at !== undefined) {
        const at = isoOrNull(push.baseline_at);
        if (at === null) issues.push('main_push:bad_baseline_at');
        else out.mainPush.baselineAt = at;
      }
      if (push.baseline_sha !== undefined) {
        const sha =
          typeof push.baseline_sha === 'string'
            ? push.baseline_sha.toLowerCase()
            : '';
        if (!ABBREVIATED_SHA_RE.test(sha)) {
          issues.push('main_push:bad_baseline_sha');
        } else {
          out.mainPush.baselineSha = sha;
        }
      }
      if (push.acknowledged_shas !== undefined) {
        if (!Array.isArray(push.acknowledged_shas)) {
          issues.push('main_push:bad_acknowledged_sha');
        } else {
          for (const item of push.acknowledged_shas.slice(0, 500)) {
            const sha = typeof item === 'string' ? item.toLowerCase() : '';
            if (ABBREVIATED_SHA_RE.test(sha))
              out.mainPush.acknowledged.push(sha);
            else issues.push('main_push:bad_acknowledged_sha');
          }
        }
      }
    }
  }
  const queue = raw.queue;
  if (queue !== undefined && queue !== null) {
    if (!isObject(queue)) {
      issues.push('queue:not_an_object');
    } else if (queue.health_url !== undefined) {
      const url = parseHealthUrl(queue.health_url);
      if (url === null) issues.push('queue:bad_health_url');
      else out.queueHealthUrl = url;
    }
  }
  out.issues = [...new Set(issues)];
  return out;
}

/**
 * Where the check of `main` starts. A commit anchor (`baseline_sha`) wins: everything after it
 * on the first-parent line is examined whatever dates the commits carry. Otherwise a recorded
 * time, cut to the last 30 days and not in the future; with neither, the last 7 days.
 *
 * @param {{ settings: ReturnType<typeof parseBehaviourSettings>, now: Date }} input
 * @returns {{ source: 'anchor' | 'recorded' | 'default', at: string | null, sha: string | null }}
 */
export function resolveMainBaseline({ settings, now }) {
  const { baselineAt, baselineSha } = settings.mainPush;
  const { defaultLookbackDays, maxLookbackDays } = BEHAVIOUR_BASELINE.mainPush;
  const day = 24 * HOUR_MS;
  if (baselineSha)
    return { source: 'anchor', at: baselineAt, sha: baselineSha };
  if (baselineAt) {
    const floor = now.getTime() - maxLookbackDays * day;
    const ms = Math.min(Math.max(Date.parse(baselineAt), floor), now.getTime());
    return { source: 'recorded', at: new Date(ms).toISOString(), sha: null };
  }
  return {
    source: 'default',
    at: new Date(now.getTime() - defaultLookbackDays * day).toISOString(),
    sha: null,
  };
}

// --- findings ----------------------------------------------------------------------------------------------------

const SEVERITY_BY_TIER = { P0: 'critical', P1: 'high', P2: 'moderate' };

/**
 * A failed check as a scored finding, shaped like the findings of the vulnerability engine so
 * the priority sort, the alert state and the report table take it unchanged. BS-1 and BS-2
 * touch payments and authentication: they carry the Rule 5 flag and count as escalations.
 */
export function makeBehaviourFinding(check, { inventory = null } = {}) {
  const asset = inventory?.assets.find((a) => a.id === check.assetId) ?? null;
  const rule = BEHAVIOUR_RULES[check.rule];
  return {
    ...makeFinding({
      kind: rule.kind,
      source: 'behaviour-signals',
      ecosystem: 'behaviour',
      assetId: check.assetId,
      packageName: check.id,
      version: check.observed,
      primaryId: `BEHAVIOUR-${check.id.toUpperCase()}`,
      title: check.title,
      severity: SEVERITY_BY_TIER[check.priority] ?? 'low',
      vulnClass: 'other',
      fixKnown: true,
      scope: 'runtime',
      key: findingKey(['behaviour', check.id]),
      behaviour: {
        expected: check.expected,
        observed: check.observed,
        threat: rule.threat,
        playbook: rule.playbook,
      },
    }),
    lifecycle: asset?.lifecycle ?? 'production',
    exposureTier: asset?.exposureTier ?? null,
    rule5Boundary: rule.rule5 === true,
    vexActive: false,
    vexSource: null,
    vexExpired: [],
    priority: check.priority,
    rule: check.rule,
    sla: rule.sla,
    escalation: rule.rule5 === true,
  };
}

/**
 * Adds findings whose key is not there yet (one per key), sorted like the engine's. It is the
 * posture sweep's merge: both kinds of finding take the same path into the alert state.
 */
export const mergeBehaviourFindings = mergePostureFindings;

// --- the sweep ----------------------------------------------------------------------------------------------------

async function attempt(fn, fallback) {
  try {
    return await fn();
  } catch {
    return fallback;
  }
}

const PROBE_ERROR = Object.freeze({ ok: false, error: 'probe_error' });

function areaStatus(checks) {
  if (checks.some((c) => c.status === 'fail')) return 'fail';
  if (checks.some((c) => c.status === 'unavailable')) return 'unavailable';
  return checks.some((c) => c.status === 'pass') ? 'ok' : 'skipped';
}

// What the result says about one section of the snapshot: its state and age, never its content.
function sectionSummary(section) {
  if (section.state === 'invalid') {
    return { state: 'invalid', code: section.code };
  }
  if (section.state === 'absent') return { state: 'absent' };
  return {
    state: section.state,
    collected_at: section.collectedAt,
    age_hours: section.ageHours,
  };
}

const issueNote = (file, issues) =>
  issues.includes('file:not_an_object')
    ? `${file} is not a JSON object and was ignored`
    : `${file}: ${issues.length} problem${issues.length === 1 ? '' : 's'} ignored (${issues.join(', ')})`;

/**
 * One behaviour sweep. Never throws: a probe that fails makes its checks unavailable.
 *
 * @param {{
 *   inventory?: object | null,
 *   input?: unknown,
 *   settings?: unknown,
 *   queueHistory?: unknown[],
 *   probes?: { mainPush?: Function, queue?: Function } | null,
 *   now: Date,
 *   offline?: boolean,
 *   repo?: string,
 *   mainBranch?: string,
 * }} input
 */
export async function runBehaviourSignals({
  inventory = null,
  input = null,
  settings = null,
  queueHistory = [],
  probes = null,
  now,
  offline = false,
  repo = DEFAULT_REPO,
  mainBranch = 'main',
}) {
  const snapshot = parseBehaviourInput(input, { now });
  const cfg = parseBehaviourSettings(settings);
  const notes = [];
  if (snapshot.issues.length > 0) {
    notes.push(issueNote('behaviour-input.json', snapshot.issues));
  }
  if (cfg.issues.length > 0) {
    notes.push(issueNote('behaviour-settings.json', cfg.issues));
  }

  // the telemetry of the snapshot
  const webhooks = evaluateWebhooks(snapshot.sections.webhooks);
  const auth = evaluateAuthFailures(snapshot.sections.auth);
  const http = evaluateHttpRates(snapshot.sections.http);
  const llm = evaluateLlmUsage(snapshot.sections.llm);

  // BS-5: the gateway queue, from the snapshot, the saved samples and a sample taken now
  let liveStatus;
  let liveSample = null;
  if (offline) {
    liveStatus = 'offline';
  } else if (typeof probes?.queue !== 'function') {
    liveStatus = 'not_configured';
  } else {
    const answer = await attempt(() => probes.queue(), PROBE_ERROR);
    liveSample = answer?.ok === true ? parseQueueSample(answer.sample) : null;
    liveStatus =
      liveSample !== null
        ? 'ok'
        : answer?.ok === true
          ? 'bad_response'
          : safeCode(answer?.error);
  }
  const queueSection = snapshot.sections.queue;
  const samples = mergeQueueSamples({
    history: Array.isArray(queueHistory) ? queueHistory : [],
    snapshot: queueSection.state === 'ok' ? queueSection.data.samples : [],
    live: liveSample,
    now,
  });
  const queue =
    queueSection.state === 'invalid' && samples.length === 0
      ? {
          checks: sectionNotRun(queueSection, [
            BASES.queueFailed,
            BASES.queueWaiting,
          ]),
          notes: [],
        }
      : evaluateQueueHealth({ samples, now, liveStatus });

  // BS-6: the first-parent line of main
  const baseline = resolveMainBaseline({ settings: cfg, now });
  let mainResult;
  if (offline) {
    mainResult = { ok: false, skipped: true, error: 'offline' };
  } else if (typeof probes?.mainPush !== 'function') {
    mainResult = { ok: false, error: 'no_probes' };
  } else {
    mainResult = await attempt(
      () =>
        probes.mainPush({
          baseline,
          mainBranch,
          maxCommits: BEHAVIOUR_BASELINE.mainPush.maxCommits,
        }),
      PROBE_ERROR
    );
  }
  const main = evaluateMainPushes({
    result: mainResult,
    acknowledged: cfg.mainPush.acknowledged,
    mainBranch,
  });

  const parts = [webhooks, auth, http, llm, queue, main];
  const checks = parts.flatMap((part) => part.checks);
  notes.push(...parts.flatMap((part) => part.notes));
  const findings = mergeBehaviourFindings(
    [],
    checks
      .filter((c) => c.status === 'fail')
      .map((c) => makeBehaviourFinding(c, { inventory }))
  );

  const tally = (status) => checks.filter((c) => c.status === status).length;
  const tiers = { P0: 0, P1: 0, P2: 0, P3: 0 };
  for (const f of findings) if (f.priority in tiers) tiers[f.priority] += 1;
  const spanMinutes =
    samples.length > 1
      ? Math.round(
          (Date.parse(samples[samples.length - 1].at) -
            Date.parse(samples[0].at)) /
            MINUTE_MS
        )
      : 0;

  return {
    schema_version: '1.0',
    generated_at: now.toISOString(),
    run: {
      offline,
      degraded: tally('unavailable') > 0,
      repo,
      main_branch: mainBranch,
    },
    telemetry: {
      snapshot_present: snapshot.present,
      collected_at: snapshot.collectedAt,
      sections: Object.fromEntries(
        Object.entries(snapshot.sections).map(([name, section]) => [
          name,
          sectionSummary(section),
        ])
      ),
      issues: snapshot.issues,
      settings_present: cfg.present,
      settings_issues: cfg.issues,
    },
    main: { baseline, commits: main.facts },
    queue: {
      live: liveStatus,
      sample_count: samples.length,
      span_minutes: spanMinutes,
      samples,
    },
    summary: {
      checks: {
        total: checks.length,
        pass: tally('pass'),
        fail: tally('fail'),
        unavailable: tally('unavailable'),
        skipped: tally('skipped'),
      },
      tiers,
      findings: findings.length,
      signals: Object.fromEntries(
        AREAS.map((area) => [
          area,
          areaStatus(checks.filter((c) => c.area === area)),
        ])
      ),
    },
    checks,
    findings,
    notes,
  };
}

// --- reports --------------------------------------------------------------------------------------------------------

const esc = escapeMarkdownCell;

/**
 * The console summary: counts and fixed words only. No route, bucket, commit or asset name.
 *
 * @param {Awaited<ReturnType<typeof runBehaviourSignals>>} result
 */
export function renderBehaviourStdout(result, { heading = true } = {}) {
  const { checks: c, tiers: t, signals, findings } = result.summary;
  const sections = Object.values(result.telemetry.sections);
  const inState = (state) => sections.filter((s) => s.state === state).length;
  const lines = [];
  if (heading) lines.push('DavinTrade behaviour signals (counts only)');
  // every line is prefixed: in the full sweep they follow the vulnerability summary lines
  lines.push(
    `behaviour_run: ${result.generated_at} mode=${result.run.offline ? 'offline' : 'online'}${result.run.degraded ? ' degraded=yes' : ''}`,
    `behaviour_checks: total=${c.total} pass=${c.pass} fail=${c.fail} unavailable=${c.unavailable} skipped=${c.skipped}`,
    `behaviour_findings: P0=${t.P0} P1=${t.P1} P2=${t.P2} P3=${t.P3} total=${findings}`,
    `behaviour_signals: ${AREAS.map((area) => `${area}=${signals[area]}`).join(' ')}`,
    `behaviour_telemetry: snapshot=${result.telemetry.snapshot_present ? 'present' : 'absent'} sections=${inState('ok')}/${sections.length} stale=${inState('stale')} invalid=${inState('invalid')}`
  );
  return lines;
}

/** The report section (also embedded in the main posture report): private, names routes and commits. */
export function renderBehaviourSection(result) {
  const { checks: c, tiers: t, signals } = result.summary;
  const out = ['## Behaviour signals', ''];
  out.push(
    `Mode: ${result.run.offline ? 'offline (no live probes)' : 'online'}; checks ${c.total}: pass ${c.pass}, fail ${c.fail}, unavailable ${c.unavailable}, skipped ${c.skipped}. Findings: P0 ${t.P0}, P1 ${t.P1}, P2 ${t.P2}, P3 ${t.P3}.`
  );
  out.push(
    `Signals: ${AREAS.map((area) => `${area} ${signals[area]}`).join(', ')}.`
  );
  if (result.run.degraded) {
    out.push(
      '',
      '**At least one signal could not be judged (unavailable). Absence of a finding is not proof of safety.**'
    );
  }
  out.push('', '### Checks', '');
  out.push(
    '| Signal | Check | Asset | Status | Priority | Rule | Response | Expected | Observed | Detail |',
    '| :- | :- | :- | :- | :- | :- | :- | :- | :- | :- |'
  );
  for (const check of result.checks) {
    const response =
      check.status === 'fail'
        ? (BEHAVIOUR_RULES[check.rule]?.playbook ??
          'no playbook (see the runbook)')
        : '';
    out.push(
      `| ${esc(check.signal)} | ${esc(check.id)} | ${esc(check.assetId)} | ${esc(check.status)} | ${esc(check.priority ?? '')} | ${esc(check.rule ?? '')} | ${esc(response)} | ${esc(check.expected ?? '')} | ${esc(check.observed ?? '')} | ${esc(check.detail ?? '')} |`
    );
  }
  const tm = result.telemetry;
  out.push('', '### Telemetry', '');
  out.push(
    '| Section | State | Collected | Age (h) | Detail |',
    '| :- | :- | :- | -: | :- |'
  );
  for (const [name, s] of Object.entries(tm.sections)) {
    out.push(
      `| ${esc(name)} | ${esc(s.state)} | ${esc(s.collected_at ?? '')} | ${s.age_hours ?? ''} | ${esc(s.code ?? '')} |`
    );
  }
  out.push(
    '',
    `Snapshot reports/behaviour-input.json: ${tm.snapshot_present ? 'present' : 'absent'}. Settings behaviour-settings.json: ${tm.settings_present ? 'present' : 'absent'}.`
  );
  const baseline = result.main.baseline;
  const cm = result.main.commits;
  out.push(
    `Baseline for main: ${baseline.source}${baseline.at ? ` ${esc(baseline.at)}` : ''}${baseline.sha ? ` (anchor commit ${esc(baseline.sha)})` : ''}${baseline.source === 'default' ? ` (no baseline recorded: the last ${BEHAVIOUR_BASELINE.mainPush.defaultLookbackDays} days are examined)` : ''}. Commits examined ${cm.examined}: reviewed ${cm.reviewed}, direct ${cm.direct}, acknowledged ${cm.acknowledged}, undecided ${cm.undecided}.`
  );
  out.push(
    `Gateway queue: live probe ${esc(result.queue.live)}; ${result.queue.sample_count} samples over ${result.queue.span_minutes} min.`
  );
  if (result.notes.length > 0) {
    out.push('', '### Notes', '');
    for (const note of result.notes) out.push(`- ${esc(note, 300)}`);
  }
  out.push('');
  return out;
}

/** The standalone private report (Markdown). */
export function renderBehaviourMarkdown(result) {
  return `${[
    '# DavinTrade behaviour signals (private)',
    '',
    `Generated ${result.generated_at} by scripts/security/run-behaviour-signals.mjs (or by scripts/security/run-security-pipeline.mjs --with-behaviour).`,
    'This file names routes, buckets and commits. It stays in the gitignored reports folder: never commit it, paste it into an issue or attach it to a public log.',
    '',
    ...renderBehaviourSection(result),
  ].join('\n')}\n`;
}

// --- arguments --------------------------------------------------------------------------------------------------------

export class BehaviourUsageError extends Error {}

const FLAGS = {
  '--offline': 'offline',
  '--help': 'help',
  '-h': 'help',
};
const VALUES = {
  '--repo': 'repo',
  '--root': 'root',
  '--pipeline-dir': 'pipelineDir',
  '--secrets-file': 'secretsFile',
};

export const BEHAVIOUR_USAGE = [
  'Usage: node scripts/security/run-behaviour-signals.mjs [options]',
  '  --offline            no live probes (the GitHub API, the gateway health endpoint); the telemetry snapshot is still read',
  '  --repo owner/name    repository whose main branch is checked (default ' +
    DEFAULT_REPO +
    ')',
  '  --root <dir>         repository root (default: the checkout this script is in)',
  '  --pipeline-dir <dir> private folder (default: <root>/davintrade-security-monitoring-pipeline)',
  '  --secrets-file <f>   file with DEPENDABOT_TRIAGE_TOKEN (default: <root>/.env.local; only 3 keys are read)',
  'Reads: <pipeline-dir>/reports/behaviour-input.json (telemetry) and <pipeline-dir>/behaviour-settings.json (your baseline and acknowledged commits); both are optional.',
  'Output: counts only on stdout; details in <pipeline-dir>/reports/latest-behaviour-signals.json and .md (gitignored).',
  'Exit codes: 0 done, 1 unexpected failure, 2 usage or setup error.',
].join('\n');

/** @param {string[]} argv arguments after the script name */
export function parseBehaviourArgs(argv) {
  const options = {
    offline: false,
    help: false,
    repo: DEFAULT_REPO,
    root: null,
    pipelineDir: null,
    secretsFile: null,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const eq = arg.startsWith('--') ? arg.indexOf('=') : -1;
    const flag = eq === -1 ? arg : arg.slice(0, eq);
    const inline = eq === -1 ? undefined : arg.slice(eq + 1);
    if (FLAGS[flag] && inline === undefined) {
      options[FLAGS[flag]] = true;
    } else if (VALUES[flag]) {
      const value = inline ?? argv[(i += 1)];
      if (value === undefined || value === '') {
        throw new BehaviourUsageError(`${flag} needs a value`);
      }
      options[VALUES[flag]] = value;
    } else {
      throw new BehaviourUsageError('unknown argument');
    }
  }
  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(options.repo)) {
    throw new BehaviourUsageError('--repo must look like owner/name');
  }
  return options;
}

// --- end of lib ---
