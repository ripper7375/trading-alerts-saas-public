// Private LINE Messaging API notifier for the security pipeline (decision D-7).
//
//   POST https://api.line.me/v2/bot/message/push
//
// The message text carries counts, priority tiers (P0-P3), asset ids, runtime
// floor status and state-transition reasons only. It never carries an advisory
// identifier, a package name or an infrastructure address: the details stay in
// the private posture report on this machine. That is guaranteed twice: the
// builders only interpolate numbers, tier labels, validated asset ids and fixed
// words, and `sanitizeLineText` refuses any text that still looks like a leak
// (a fixed fallback message is sent instead, so an alert is never lost).
//
// The channel token and the target user id are read from the environment or the
// gitignored `.env.local` (only those keys are ever read from the file). They are
// never logged, printed, written to a report or put into a message.

import { randomUUID } from 'node:crypto';

export const LINE_PUSH_URL = 'https://api.line.me/v2/bot/message/push';
export const REPORT_HINT = 'reports/latest-security-posture.md';

// Keys read from `.env.local`; every other line of that file is ignored.
export const SECRET_KEYS = Object.freeze([
  'LINE_CHANNEL_ACCESS_TOKEN',
  'LINE_TARGET_USER_ID',
  'DEPENDABOT_TRIAGE_TOKEN',
]);

export const HEARTBEAT_MIN_INTERVAL_HOURS = 20; // a second run the same day is deduplicated
export const HEARTBEAT_WINDOW_HOURS = 24; // one heartbeat per window, even without --heartbeat
export const HEARTBEAT_MISSED_HOURS = 26; // an older previous heartbeat is a missed one
export const MAX_TEXT_LENGTH = 4800; // LINE allows 5000 characters per text message

const HOUR_MS = 3600 * 1000;
const TIER_RANK = Object.freeze({ P0: 0, P1: 1, P2: 2, P3: 3 });

// --- secrets -------------------------------------------------------------------------

/**
 * Reads `KEY=value` lines, keeping only the allowed keys. Comments, blank lines,
 * `export` prefixes and one pair of quotes are handled.
 */
export function parseEnvFile(text, allowed = SECRET_KEYS) {
  const out = {};
  for (const raw of String(text ?? '')
    .replace(/^﻿/, '')
    .split(/\r?\n/)) {
    const line = raw.trim();
    if (line === '' || line.startsWith('#')) continue;
    const m = /^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/.exec(line);
    if (!m || !allowed.includes(m[1])) continue;
    let value = m[2].trim();
    if (/^(["']).*\1$/.test(value) && value.length >= 2)
      value = value.slice(1, -1);
    else value = value.replace(/\s+#.*$/, '');
    if (value !== '') out[m[1]] = value;
  }
  return out;
}

/** The environment wins over the file. GITHUB_TOKEN is read from the environment only. */
export function resolveSecrets({ env = {}, fileText = null }) {
  const file = parseEnvFile(fileText);
  const pick = (key) => {
    const fromEnv = typeof env[key] === 'string' ? env[key].trim() : '';
    return fromEnv !== '' ? fromEnv : (file[key] ?? null);
  };
  const github =
    typeof env.GITHUB_TOKEN === 'string' ? env.GITHUB_TOKEN.trim() : '';
  return {
    lineToken: pick('LINE_CHANNEL_ACCESS_TOKEN'),
    lineUserId: pick('LINE_TARGET_USER_ID'),
    dependabotToken: pick('DEPENDABOT_TRIAGE_TOKEN'),
    githubToken: github !== '' ? github : null,
  };
}

// --- privacy guard -------------------------------------------------------------------

const ADVISORY_PREFIX = /\b(?:GHSA|CVE|MAL|PYSEC|OSV|RUSTSEC|SNYK)-/i;
const IPV4 = /\b(?:\d{1,3}\.){3}\d{1,3}\b/;
const URL_SCHEME = /\b[a-z][a-z0-9+.-]*:\/\//i;
const HOSTNAME =
  /\b(?:[a-z0-9-]+\.)+(?:com|net|org|io|dev|app|cloud|internal|local|co|me|xyz|sh|ai|info|biz|us|uk|th|jp|rlwy|railway)\b/i;
const HOST_PORT = /\b[a-z][a-z0-9.-]{2,}:\d{2,5}\b/i;
const LINE_USER_ID = /\bU[0-9a-f]{32}\b/;
const LONG_TOKEN = /[A-Za-z0-9+/_=-]{32,}/;
const BEARER = /\bBearer\s+\S+/i;

const escapeRegExp = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Reasons a text must not be sent. `forbidden` are exact strings (package names,
 * identifiers of the current run) that may not appear as a whole token.
 *
 * @param {string} text
 * @param {{ forbidden?: string[] }} [options]
 * @returns {string[]} fixed codes; empty when the text is safe
 */
export function findPrivacyViolations(text, { forbidden = [] } = {}) {
  // the pointer to the local report is the one path a message may carry
  const body = String(text).replaceAll(REPORT_HINT, '');
  const violations = [];
  const check = (code, pattern) => {
    if (pattern.test(body)) violations.push(code);
  };
  check('advisory_id', ADVISORY_PREFIX);
  check('ipv4', IPV4);
  check('url', URL_SCHEME);
  check('hostname', HOSTNAME);
  check('host_port', HOST_PORT);
  check('line_user_id', LINE_USER_ID);
  check('long_token', LONG_TOKEN);
  check('bearer', BEARER);
  for (const word of forbidden) {
    if (typeof word !== 'string' || word.length < 3) continue;
    const token = new RegExp(
      `(?<![A-Za-z0-9@/_.-])${escapeRegExp(word)}(?![A-Za-z0-9@/_.-])`
    );
    if (token.test(body)) {
      violations.push('forbidden_string');
      break;
    }
  }
  return violations;
}

const FALLBACKS = Object.freeze({
  alert: `🚨 [DavinTrade Security Alert] New findings need review. Message details were withheld by the privacy guard: see ${REPORT_HINT}`,
  heartbeat: `✅ [DavinTrade Security Heartbeat] The sweep finished. Message details were withheld by the privacy guard: see ${REPORT_HINT}`,
  test: '✅ [DavinTrade Security] LINE connection test.',
});

/**
 * Returns the text if it is safe, otherwise the fixed fallback for its kind.
 *
 * @param {string} text
 * @param {'alert' | 'heartbeat' | 'test'} kind
 * @param {{ forbidden?: string[], secrets?: (string | null)[] }} [options]
 */
export function sanitizeLineText(
  text,
  kind,
  { forbidden = [], secrets = [] } = {}
) {
  let violations = findPrivacyViolations(text, { forbidden });
  for (const secret of secrets) {
    if (
      typeof secret === 'string' &&
      secret.length >= 8 &&
      String(text).includes(secret)
    ) {
      violations = [...violations, 'secret'];
    }
  }
  if (violations.length > 0)
    return { text: FALLBACKS[kind], safe: false, violations };
  const clipped =
    text.length > MAX_TEXT_LENGTH
      ? `${text.slice(0, MAX_TEXT_LENGTH - 1)}…`
      : text;
  return { text: clipped, safe: true, violations: [] };
}

/** An asset id is a short kebab-case name; anything else is not repeated. */
export const safeAssetId = (id) =>
  typeof id === 'string' &&
  /^[a-z0-9][a-z0-9-]{0,39}$/.test(id) &&
  !ADVISORY_PREFIX.test(id)
    ? id
    : 'unknown-asset';

const stamp = (date) =>
  `${date.toISOString().slice(0, 16).replace('T', ' ')} UTC`;
const num = (value) =>
  Number.isFinite(value) ? Math.max(0, Math.trunc(value)) : 0;

// --- alert state and transitions -------------------------------------------------------------

export const emptyAlertState = () => ({
  schema_version: '1.0',
  updated_at: null,
  last_heartbeat_at: null,
  findings: {},
});

/**
 * Reads a stored alert state. A missing file is a normal first run; a file that
 * does not parse as a state is replaced by an empty one (so current P0 and P1
 * findings alert again: failing loud beats staying silent).
 *
 * @returns {{ state: ReturnType<typeof emptyAlertState>, reset: boolean }}
 */
export function normalizeAlertState(raw) {
  if (raw === null || raw === undefined)
    return { state: emptyAlertState(), reset: false };
  const valid =
    raw &&
    typeof raw === 'object' &&
    raw.schema_version === '1.0' &&
    raw.findings &&
    typeof raw.findings === 'object' &&
    !Array.isArray(raw.findings);
  if (!valid) return { state: emptyAlertState(), reset: true };
  const findings = {};
  for (const [key, entry] of Object.entries(raw.findings)) {
    if (/^[0-9a-f]{16}$/.test(key) && entry && entry.tier in TIER_RANK) {
      findings[key] = { tier: entry.tier, malicious: entry.malicious === true };
    }
  }
  const last =
    typeof raw.last_heartbeat_at === 'string' &&
    !Number.isNaN(Date.parse(raw.last_heartbeat_at))
      ? raw.last_heartbeat_at
      : null;
  return {
    state: {
      schema_version: '1.0',
      updated_at: typeof raw.updated_at === 'string' ? raw.updated_at : null,
      last_heartbeat_at: last,
      findings,
    },
    reset: false,
  };
}

/** The tier (and malicious flag) of every live finding, keyed by its opaque id. */
export function snapshotFindings(findings) {
  const out = {};
  for (const f of findings) {
    if (f.priority in TIER_RANK)
      out[f.key] = { tier: f.priority, malicious: f.malicious === true };
  }
  return out;
}

export const ALERT_REASONS = Object.freeze([
  'malicious_package',
  'secret_breach',
  'new_p0',
  'escalated_to_p0',
  'runtime_floor_breach',
  'posture_breach',
  'behaviour_breach',
  'new_p1',
  'escalated_to_p1',
]);

const REASON_LABELS = Object.freeze({
  malicious_package: 'Malicious-package record',
  secret_breach: 'Secret scanning breach',
  new_p0: 'New P0',
  escalated_to_p0: 'Escalated to P0',
  runtime_floor_breach: 'Runtime floor breach',
  posture_breach: 'Live posture breach',
  behaviour_breach: 'Behaviour signal breach',
  new_p1: 'New P1',
  escalated_to_p1: 'Escalated to P1',
});

/**
 * What changed since the last sweep that was reported: a new P0 or P1, an
 * escalation to P0 or P1, a malicious-package record, a runtime floor breach.
 * Anything that stays as it was is not an alert (deduplication).
 *
 * @param {ReturnType<typeof emptyAlertState>} previous
 * @param {object[]} findings scored findings (priority, key, assetId, kind, malicious)
 * @returns {{ alerts: { reason: string, assetId: string }[], resolved: number }}
 */
export function computeTransitions(previous, findings) {
  const alerts = [];
  const live = new Set();
  for (const f of findings) {
    if (!(f.priority in TIER_RANK)) continue;
    live.add(f.key);
    const before = previous.findings[f.key];
    const was = before ? TIER_RANK[before.tier] : null;
    const now = TIER_RANK[f.priority];
    const assetId = safeAssetId(f.assetId);
    if (f.kind === 'runtime-floor') {
      if (now <= 1 && (was === null || was > 1))
        alerts.push({ reason: 'runtime_floor_breach', assetId });
    } else if (f.source === 'secret-scanning') {
      // an open GitHub secret-scanning alert (rule R-3, always P0): one alert per open alert, and
      // never twice. The text says how many and on which asset, nothing about the secret.
      if (now <= 1 && (was === null || was > 1))
        alerts.push({ reason: 'secret_breach', assetId });
    } else if (f.source === 'posture-sweep') {
      // a failed check of the live posture sweep (headers, certificate, DNS, GitHub
      // settings, deployed build): alerts when it enters P0 or P1, never twice
      if (now <= 1 && (was === null || was > 1))
        alerts.push({ reason: 'posture_breach', assetId });
    } else if (f.source === 'behaviour-signals') {
      // a signal of the behaviour sweep (webhooks, failed logins, error rate, LLM spend, the
      // queue, a push to main): alerts when it enters P0 or P1, never twice
      if (now <= 1 && (was === null || was > 1))
        alerts.push({ reason: 'behaviour_breach', assetId });
    } else if (f.malicious === true && !before?.malicious) {
      alerts.push({ reason: 'malicious_package', assetId });
    } else if (f.priority === 'P0' && was !== 0) {
      alerts.push({
        reason: was === null ? 'new_p0' : 'escalated_to_p0',
        assetId,
      });
    } else if (f.priority === 'P1' && (was === null || was > 1)) {
      alerts.push({
        reason: was === null ? 'new_p1' : 'escalated_to_p1',
        assetId,
      });
    }
  }
  let resolved = 0;
  for (const [key, entry] of Object.entries(previous.findings)) {
    if (TIER_RANK[entry.tier] > 1) continue;
    const now = findings.find((f) => f.key === key);
    if (!now || !(now.priority in TIER_RANK) || TIER_RANK[now.priority] > 1)
      resolved += 1;
  }
  return { alerts, resolved };
}

/**
 * Whether to send the daily heartbeat. One goes out when none was sent for a
 * whole window (24 h, so a run without --heartbeat still keeps the dead-man's
 * switch alive) or when --heartbeat is passed and the last one is at least 20 h
 * old (a second run the same day is deduplicated). A previous heartbeat older
 * than 26 h is a missed one.
 */
export function heartbeatDecision({ lastHeartbeatAt, now, requested }) {
  const last = lastHeartbeatAt ? Date.parse(lastHeartbeatAt) : null;
  const hours =
    last === null ? null : Math.max(0, (now.getTime() - last) / HOUR_MS);
  const due = hours === null || hours >= HEARTBEAT_WINDOW_HOURS;
  const byFlag =
    requested && (hours === null || hours >= HEARTBEAT_MIN_INTERVAL_HOURS);
  return {
    send: due || byFlag,
    reason: due ? 'window' : byFlag ? 'requested' : 'deduplicated',
    hoursSinceLast: hours,
    missed: hours !== null && hours > HEARTBEAT_MISSED_HOURS,
  };
}

// --- messages ---------------------------------------------------------------------------------

const hoursText = (hours) => `${(Math.round(hours * 10) / 10).toFixed(1)} h`;

function floorsText(posture) {
  const c = posture.runtime_floors.counts;
  const behind = posture.runtime_floors.floors.filter(
    (f) => f.floorBehind
  ).length;
  const parts = [];
  if (c.below_floor > 0)
    parts.push(
      `BREACH (${c.below_floor} asset${c.below_floor === 1 ? '' : 's'})`
    );
  if (c.behind_latest_security > 0)
    parts.push(
      `behind the latest security release (${c.behind_latest_security})`
    );
  if (behind > 0) parts.push(`inventory floor outdated (${behind})`);
  if (c.unverified > 0) parts.push(`unverified (${c.unverified})`);
  return parts.length > 0 ? parts.join(', ') : 'OK';
}

const tiersText = (tiers) =>
  `P0=${num(tiers.P0)} P1=${num(tiers.P1)} P2=${num(tiers.P2)} P3=${num(tiers.P3)}`;

// The live posture sweep in the heartbeat: counts and a fixed vocabulary only.
const POSTURE_AREAS = Object.freeze(['web', 'tls', 'dns', 'github', 'runtime']);
const POSTURE_AREA_WORDS = new Set(['ok', 'fail', 'unavailable', 'skipped']);

function livePostureText(live) {
  const c = live.summary?.checks ?? {};
  const areas = POSTURE_AREAS.map((name) => {
    const word = live.summary?.areas?.[name];
    return `${name}=${POSTURE_AREA_WORDS.has(word) ? word : 'unknown'}`;
  }).join(' ');
  return `Live posture: pass=${num(c.pass)} fail=${num(c.fail)} unavailable=${num(c.unavailable)} skipped=${num(c.skipped)} | ${areas}`;
}

// The behaviour signals in the heartbeat: counts and a fixed vocabulary only.
const BEHAVIOUR_SIGNALS = Object.freeze([
  'webhooks',
  'auth',
  'http',
  'llm',
  'queue',
  'main',
]);

function liveBehaviourText(live) {
  const c = live.summary?.checks ?? {};
  const signals = BEHAVIOUR_SIGNALS.map((name) => {
    const word = live.summary?.signals?.[name];
    return `${name}=${POSTURE_AREA_WORDS.has(word) ? word : 'unknown'}`;
  }).join(' ');
  return `Behaviour signals: pass=${num(c.pass)} fail=${num(c.fail)} unavailable=${num(c.unavailable)} skipped=${num(c.skipped)} | ${signals}`;
}

/**
 * The immediate alert: transitions grouped by reason, with the assets they hit.
 */
export function buildAlertMessage({ alerts, posture, now }) {
  const lines = [`🚨 [DavinTrade Security Alert] ${stamp(now)}`];
  for (const reason of ALERT_REASONS) {
    const hits = alerts.filter((a) => a.reason === reason);
    if (hits.length === 0) continue;
    const byAsset = new Map();
    for (const hit of hits)
      byAsset.set(hit.assetId, (byAsset.get(hit.assetId) ?? 0) + 1);
    const assets = [...byAsset]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([id, n]) => (n > 1 ? `${id} x${n}` : id));
    lines.push(
      `${REASON_LABELS[reason]}: ${hits.length} (${assets.join(', ')})`
    );
  }
  lines.push(`Open now: ${tiersText(posture.summary.tiers)}`);
  lines.push(`Details: ${REPORT_HINT}`);
  return lines.join('\n');
}

/** The compact daily heartbeat (the dead-man's switch: silence is an alert). */
export function buildHeartbeatMessage({
  posture,
  now,
  heartbeat,
  resolved = 0,
}) {
  const degraded = posture.run.degraded === true;
  const icon = degraded || heartbeat.missed ? '⚠️' : '✅';
  const m = posture.matchers;
  const dep = posture.dependabot;
  const lines = [
    `${icon} [DavinTrade Security Heartbeat] ${stamp(now)}`,
    `Sweep: ${degraded ? 'DEGRADED' : 'OK'}${posture.run.offline ? ' (offline)' : ''} | assets scanned ${num(posture.inventory.assets_scanned)}/${num(posture.inventory.assets_total)} | matchers ok ${num(m.ok)}, failed ${num(m.failed)}`,
    `Open: ${tiersText(posture.summary.tiers)} | withdrawn=${num(posture.summary.tiers.WITHDRAWN)}`,
    `Runtime floors: ${floorsText(posture)}`,
    dep.status === 'compared'
      ? `Dependabot: open=${num(dep.open)} mismatch=${num(dep.mismatch)}`
      : 'Dependabot: not compared',
  ];
  if (posture.live_posture) lines.push(livePostureText(posture.live_posture));
  if (posture.live_behaviour) {
    lines.push(liveBehaviourText(posture.live_behaviour));
  }
  if (resolved > 0)
    lines.push(`Resolved P0/P1 since the last sweep: ${num(resolved)}`);
  if (heartbeat.missed) {
    lines.push(
      `⚠ Missed heartbeat: the previous one was ${hoursText(heartbeat.hoursSinceLast)} ago (expected within ${HEARTBEAT_MISSED_HOURS} h).`
    );
  }
  lines.push(
    heartbeat.hoursSinceLast === null
      ? 'Last heartbeat: first run'
      : `Last heartbeat: ${hoursText(heartbeat.hoursSinceLast)} ago`
  );
  lines.push(`Details: ${REPORT_HINT}`);
  return lines.join('\n');
}

export const buildTestMessage = (now) =>
  `✅ [DavinTrade Security] LINE connection test ${stamp(now)}. If you can read this, push alerts reach you.`;

// --- push ---------------------------------------------------------------------------------------

/** The JSON body of a push request. */
export const buildPushBody = ({ userId, texts }) => ({
  to: userId,
  messages: texts.slice(0, 5).map((text) => ({ type: 'text', text })),
});

/**
 * Sends the texts in one push request. Never throws, never returns the response
 * body or the token: the result is a fixed code.
 *
 * @returns {Promise<{ ok: boolean, code: string, status: number }>}
 */
export async function pushLineMessages({
  fetchImpl,
  token,
  userId,
  texts,
  sleep,
}) {
  const retryKey = randomUUID(); // makes a retried request safe from duplicates
  const body = JSON.stringify(buildPushBody({ userId, texts }));
  let last = { ok: false, code: 'network_error', status: 0 };
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const response = await fetchImpl(LINE_PUSH_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
          'X-Line-Retry-Key': retryKey,
        },
        body,
        signal: AbortSignal.timeout(30000),
      });
      const status = response.status;
      if (response.ok || status === 409)
        return { ok: true, code: 'sent', status };
      last = {
        ok: false,
        status,
        code:
          status === 401 || status === 403
            ? 'auth_failed'
            : status === 429
              ? 'rate_limited'
              : `http_${status}`,
      };
      if (status < 500) return last;
    } catch {
      last = { ok: false, code: 'network_error', status: 0 };
    }
    if (attempt === 0) await sleep?.(1000);
  }
  return last;
}

// --- preview ----------------------------------------------------------------------------------------

/**
 * The text of reports/last-line-message-preview.txt: the exact message texts
 * that would be sent, and the request body with the user id redacted.
 */
export function renderPreview({ now, reason, texts }) {
  const lines = [
    '# DavinTrade security LINE message preview (private, gitignored)',
    `# Written ${now.toISOString()} (${reason}). Nothing was sent.`,
    '# Request body, with the target user redacted:',
    `# ${JSON.stringify(buildPushBody({ userId: '<LINE_TARGET_USER_ID>', texts }))}`,
    '',
  ];
  texts.forEach((text, index) => {
    lines.push(`---- message ${index + 1} of ${texts.length} ----`, text, '');
  });
  return `${lines.join('\n')}\n`;
}

// --- orchestration of one notification round ---------------------------------------------------------

/**
 * Decides what to tell Davin about a finished sweep and (unless it is a dry run
 * or the credentials are missing) sends it.
 *
 *   off                      no LINE flag
 *   dry_run                  --dry-run-line: nothing sent, preview of every message
 *   preview_no_credentials   --notify-line without credentials: preview, exit cleanly
 *   nothing_to_send          no transition and no heartbeat due
 *   sent / failed            the push result
 *
 * `nextState` is set only when the sweep may be treated as reported (sent, or
 * nothing to send): a dry run or a failed push leaves the state alone so the
 * alert still fires next time.
 *
 * @param {{
 *   options: { notifyLine: boolean, heartbeat: boolean, dryRunLine: boolean },
 *   secrets: { lineToken: string | null, lineUserId: string | null },
 *   posture: object,
 *   state: ReturnType<typeof emptyAlertState>,
 *   now: Date,
 *   fetchImpl: typeof fetch,
 *   sleep?: (ms: number) => Promise<void>,
 *   forbidden?: string[],
 * }} input
 */
export async function runNotifications({
  options,
  secrets,
  posture,
  state,
  now,
  fetchImpl,
  sleep,
  forbidden = [],
}) {
  const base = {
    mode: 'off',
    texts: [],
    previewTexts: [],
    violations: [],
    nextState: null,
    alerts: 0,
    heartbeatSent: false,
  };
  if (!options.notifyLine && !options.dryRunLine) return base;

  const { alerts, resolved } = computeTransitions(state, posture.findings);
  const heartbeat = heartbeatDecision({
    lastHeartbeatAt: state.last_heartbeat_at,
    now,
    requested: options.heartbeat,
  });
  const guard = { forbidden, secrets: [secrets.lineToken, secrets.lineUserId] };
  const violations = [];
  const make = (kind, text) => {
    const result = sanitizeLineText(text, kind, guard);
    violations.push(...result.violations);
    return result.text;
  };
  const alertText =
    alerts.length > 0
      ? make('alert', buildAlertMessage({ alerts, posture, now }))
      : null;
  const heartbeatText = make(
    'heartbeat',
    buildHeartbeatMessage({ posture, now, heartbeat, resolved })
  );

  const previewTexts = [alertText, heartbeatText].filter(Boolean);
  const texts = [alertText, heartbeat.send ? heartbeatText : null].filter(
    Boolean
  );
  const nextState = () => ({
    ...state,
    updated_at: now.toISOString(),
    last_heartbeat_at: heartbeat.send
      ? now.toISOString()
      : state.last_heartbeat_at,
    findings: snapshotFindings(posture.findings),
  });
  const result = {
    ...base,
    violations,
    alerts: alerts.length,
    heartbeat,
    previewTexts,
  };

  if (options.dryRunLine) return { ...result, mode: 'dry_run', texts };
  if (!secrets.lineToken || !secrets.lineUserId)
    return { ...result, mode: 'preview_no_credentials', texts };
  if (texts.length === 0)
    return { ...result, mode: 'nothing_to_send', nextState: nextState() };

  const pushed = await pushLineMessages({
    fetchImpl,
    token: secrets.lineToken,
    userId: secrets.lineUserId,
    texts,
    sleep,
  });
  if (!pushed.ok)
    return { ...result, mode: 'failed', texts, code: pushed.code };
  return {
    ...result,
    mode: 'sent',
    texts,
    heartbeatSent: heartbeat.send,
    nextState: nextState(),
  };
}
