// Run: node --test 'scripts/security/*.test.mjs'
//
// The private LINE notifier: secret loading, the privacy guard (counts, tiers,
// asset ids and fixed words only), state-transition deduplication, the daily
// heartbeat and its dead-man's-switch window, the push client and the preview.
// No test sends anything: fetch is a fake, and the credentials are invented.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ALERT_REASONS,
  HEARTBEAT_MIN_INTERVAL_HOURS,
  LINE_PUSH_URL,
  REPORT_HINT,
  buildAlertMessage,
  buildHeartbeatMessage,
  buildPushBody,
  buildTestMessage,
  computeTransitions,
  emptyAlertState,
  findPrivacyViolations,
  heartbeatDecision,
  normalizeAlertState,
  parseEnvFile,
  pushLineMessages,
  renderPreview,
  resolveSecrets,
  runNotifications,
  safeAssetId,
  sanitizeLineText,
  snapshotFindings,
} from './line-notifier-lib.mjs';

// Strings that must never reach a message.
const PACKAGE = 'sentinel-package-name';
const ADVISORY = 'GHSA-aaaa-bbbb-cccc';
const CVE = 'CVE-2099-0001';
const MALICIOUS = 'MAL-2099-0001';
const TOKEN = 'fake-channel-token-0123456789abcdefghijklmnopqrstuvwxyz';
const USER_ID = 'U0123456789abcdef0123456789abcdef';
const NOW = new Date('2026-11-21T16:40:00Z');

const hex = (n) => n.toString(16).padStart(16, '0');
const finding = (n, over = {}) => ({
  key: hex(n),
  priority: 'P1',
  assetId: 'money-service',
  kind: 'advisory',
  malicious: false,
  packageName: PACKAGE,
  primaryId: ADVISORY,
  advisoryIds: [ADVISORY, CVE],
  ...over,
});
const posture = (over = {}) => ({
  run: { degraded: false, offline: false },
  inventory: { assets_total: 16, assets_scanned: 9 },
  matchers: { ok: 8, failed: 0, skipped: 2 },
  summary: { tiers: { P0: 0, P1: 1, P2: 2, P3: 3, WITHDRAWN: 0 } },
  runtime_floors: {
    counts: {
      below_floor: 0,
      behind_latest_security: 0,
      unverified: 1,
      ok: 3,
      unknown_line: 0,
    },
    floors: [{ floorBehind: false }, { floorBehind: false }],
  },
  dependabot: { status: 'skipped' },
  findings: [],
  ...over,
});

const hoursAgo = (hours) =>
  new Date(NOW.getTime() - hours * 3600 * 1000).toISOString();

// --- secrets ------------------------------------------------------------------------

test('parseEnvFile reads only the allowed keys', () => {
  const parsed = parseEnvFile(
    [
      '# comment',
      'DATABASE_URL=postgres://not-for-us',
      `LINE_CHANNEL_ACCESS_TOKEN="${TOKEN}"`,
      `export LINE_TARGET_USER_ID=${USER_ID} # trailing comment`,
      "DEPENDABOT_TRIAGE_TOKEN='quoted-token'",
      'NEXTAUTH_SECRET=never-read',
      'LINE_CHANNEL_ACCESS_TOKEN_OTHER=ignored',
      '',
    ].join('\r\n')
  );
  assert.deepEqual(parsed, {
    LINE_CHANNEL_ACCESS_TOKEN: TOKEN,
    LINE_TARGET_USER_ID: USER_ID,
    DEPENDABOT_TRIAGE_TOKEN: 'quoted-token',
  });
  assert.equal(JSON.stringify(parsed).includes('never-read'), false);
  assert.deepEqual(parseEnvFile('LINE_TARGET_USER_ID='), {});
  assert.deepEqual(parseEnvFile(null), {});
});

test('resolveSecrets: the environment wins, the file fills the gaps, GITHUB_TOKEN is never read from the file', () => {
  const fileText = `LINE_CHANNEL_ACCESS_TOKEN=from-file\nLINE_TARGET_USER_ID=${USER_ID}\nGITHUB_TOKEN=must-not-load\n`;
  assert.deepEqual(
    resolveSecrets({
      env: { LINE_CHANNEL_ACCESS_TOKEN: 'from-env' },
      fileText,
    }),
    {
      lineToken: 'from-env',
      lineUserId: USER_ID,
      dependabotToken: null,
      githubToken: null,
    }
  );
  assert.equal(
    resolveSecrets({ env: { GITHUB_TOKEN: ' gh ' }, fileText: null })
      .githubToken,
    'gh'
  );
  assert.deepEqual(resolveSecrets({}), {
    lineToken: null,
    lineUserId: null,
    dependabotToken: null,
    githubToken: null,
  });
});

// --- privacy guard --------------------------------------------------------------------

test('findPrivacyViolations flags advisory ids, addresses, hosts, URLs, tokens and user ids', () => {
  const cases = {
    advisory_id: [ADVISORY, CVE, MALICIOUS, 'PYSEC-2099-1', 'see ghsa-xxxx'],
    ipv4: ['host 192.0.2.1 is up'],
    url: ['https://example.test/x'],
    hostname: [
      'api.davintrade.app',
      'monorail.proxy.rlwy.net',
      'db.railway.internal',
    ],
    host_port: ['host.example:5432'],
    line_user_id: [USER_ID],
    long_token: [TOKEN],
    bearer: ['Authorization: Bearer abc'],
  };
  for (const [code, texts] of Object.entries(cases)) {
    for (const text of texts) {
      assert.ok(findPrivacyViolations(text).includes(code), `${code}: ${text}`);
    }
  }
});

test('findPrivacyViolations accepts counts, tiers, versions, times and the report pointer', () => {
  const ok = [
    'Open now: P0=0 P1=2 P2=3 P3=14',
    'Runtime floors: BREACH (3 assets)',
    'Last heartbeat: 24.1 h ago',
    '✅ [DavinTrade Security Heartbeat] 2026-11-21 16:40 UTC',
    `Details: ${REPORT_HINT}`,
    'money-service x2, railway-gateway',
    'Node 24.22.3 floor',
  ];
  for (const text of ok)
    assert.deepEqual(findPrivacyViolations(text), [], text);
});

test('findPrivacyViolations: forbidden strings match whole tokens only', () => {
  const forbidden = [PACKAGE, 'tar', 'ab'];
  assert.deepEqual(
    findPrivacyViolations(`affects ${PACKAGE} here`, { forbidden }),
    ['forbidden_string']
  );
  assert.deepEqual(
    findPrivacyViolations(`@scope/${PACKAGE}`, { forbidden }),
    []
  );
  assert.deepEqual(
    findPrivacyViolations('start of a story', { forbidden }),
    [],
    'a substring is not a token'
  );
  assert.deepEqual(findPrivacyViolations('the tar file', { forbidden }), [
    'forbidden_string',
  ]);
  assert.deepEqual(
    findPrivacyViolations('ab', { forbidden }),
    [],
    'too short to be a name'
  );
});

test('sanitizeLineText passes safe text and replaces an unsafe one with a fixed fallback', () => {
  const safe = sanitizeLineText('Open now: P0=0', 'alert');
  assert.deepEqual(safe, {
    text: 'Open now: P0=0',
    safe: true,
    violations: [],
  });

  const unsafe = sanitizeLineText(`New P0 in ${ADVISORY}`, 'alert');
  assert.equal(unsafe.safe, false);
  assert.match(unsafe.text, /^🚨 \[DavinTrade Security Alert\]/);
  assert.deepEqual(
    findPrivacyViolations(unsafe.text),
    [],
    'the fallback is itself safe'
  );
  assert.equal(
    sanitizeLineText(`x ${PACKAGE}`, 'heartbeat', {
      forbidden: [PACKAGE],
    }).text.startsWith('✅ [DavinTrade Security Heartbeat]'),
    true
  );

  const leak = sanitizeLineText(`token ${'z'.repeat(10)}`, 'alert', {
    secrets: ['z'.repeat(10)],
  });
  assert.equal(leak.safe, false);
  assert.ok(leak.violations.includes('secret'));

  const long = sanitizeLineText('a '.repeat(4000), 'alert');
  assert.ok(long.text.length <= 4800);
  assert.equal(long.safe, true);
});

test('safeAssetId repeats a kebab-case asset id and nothing else', () => {
  assert.equal(safeAssetId('money-service'), 'money-service');
  assert.equal(safeAssetId(ADVISORY), 'unknown-asset');
  assert.equal(
    safeAssetId(ADVISORY.toLowerCase()),
    'unknown-asset',
    'a lower-cased identifier is not an asset id either'
  );
  assert.equal(safeAssetId('Has Space'), 'unknown-asset');
  assert.equal(safeAssetId('x'.repeat(41)), 'unknown-asset');
  assert.equal(safeAssetId(undefined), 'unknown-asset');
});

// --- state and transitions -------------------------------------------------------------

test('normalizeAlertState: a missing file is a first run, a broken one is reset loudly', () => {
  assert.deepEqual(normalizeAlertState(null), {
    state: emptyAlertState(),
    reset: false,
  });
  assert.deepEqual(normalizeAlertState('garbage'), {
    state: emptyAlertState(),
    reset: true,
  });
  assert.deepEqual(normalizeAlertState({ schema_version: '9' }), {
    state: emptyAlertState(),
    reset: true,
  });
  const { state, reset } = normalizeAlertState({
    schema_version: '1.0',
    updated_at: '2026-11-20T00:00:00Z',
    last_heartbeat_at: '2026-11-20T08:00:00Z',
    findings: {
      [hex(1)]: { tier: 'P1', malicious: true },
      [hex(2)]: { tier: 'P9' },
      'not-hex': { tier: 'P0' },
    },
  });
  assert.equal(reset, false);
  assert.deepEqual(state.findings, {
    [hex(1)]: { tier: 'P1', malicious: true },
  });
  assert.equal(state.last_heartbeat_at, '2026-11-20T08:00:00Z');
  assert.equal(
    normalizeAlertState({
      schema_version: '1.0',
      findings: {},
      last_heartbeat_at: 'yesterday',
    }).state.last_heartbeat_at,
    null
  );
});

const stateOf = (entries, extra = {}) => ({
  ...emptyAlertState(),
  findings: entries,
  ...extra,
});
const reasons = (state, findings) =>
  computeTransitions(state, findings).alerts.map((a) => a.reason);

test('computeTransitions: a first run alerts on every P0 and P1, and on nothing else', () => {
  const findings = [
    finding(1, { priority: 'P0' }),
    finding(2, { priority: 'P1' }),
    finding(3, { priority: 'P2' }),
    finding(4, { priority: 'P3' }),
    finding(5, { priority: 'WITHDRAWN' }),
  ];
  assert.deepEqual(reasons(emptyAlertState(), findings), ['new_p0', 'new_p1']);
});

test('computeTransitions: an unchanged finding does not alert again (deduplication)', () => {
  const findings = [
    finding(1, { priority: 'P0' }),
    finding(2, { priority: 'P1' }),
  ];
  const state = stateOf(snapshotFindings(findings));
  assert.deepEqual(reasons(state, findings), []);
  assert.deepEqual(computeTransitions(state, findings), {
    alerts: [],
    resolved: 0,
  });
});

test('computeTransitions: escalations to P0 and P1 alert, a downgrade does not', () => {
  const state = stateOf({
    [hex(1)]: { tier: 'P1' },
    [hex(2)]: { tier: 'P2' },
    [hex(3)]: { tier: 'P3' },
    [hex(4)]: { tier: 'P0' },
    [hex(5)]: { tier: 'P2' },
  });
  const findings = [
    finding(1, { priority: 'P0' }), // P1 -> P0
    finding(2, { priority: 'P1' }), // P2 -> P1
    finding(3, { priority: 'P0' }), // P3 -> P0
    finding(4, { priority: 'P1' }), // P0 -> P1: a downgrade
    finding(5, { priority: 'P2' }), // unchanged
  ];
  assert.deepEqual(reasons(state, findings), [
    'escalated_to_p0',
    'escalated_to_p1',
    'escalated_to_p0',
  ]);
});

test('computeTransitions: a malicious-package record and a runtime floor breach have their own reasons', () => {
  const findings = [
    finding(1, { priority: 'P0', malicious: true, assetId: 'monolith-web' }),
    finding(2, {
      priority: 'P1',
      kind: 'runtime-floor',
      assetId: 'money-service',
    }),
    finding(3, {
      priority: 'P2',
      kind: 'runtime-floor',
      assetId: 'chat-server',
    }),
  ];
  assert.deepEqual(reasons(emptyAlertState(), findings), [
    'malicious_package',
    'runtime_floor_breach',
  ]);
  // already known: neither alerts again
  assert.deepEqual(reasons(stateOf(snapshotFindings(findings)), findings), []);
  // a known P0 that becomes malicious alerts as a malicious package
  const flagged = [finding(1, { priority: 'P0', malicious: true })];
  assert.deepEqual(
    reasons(stateOf({ [hex(1)]: { tier: 'P0', malicious: false } }), flagged),
    ['malicious_package']
  );
});

test('computeTransitions counts P0 and P1 findings that were resolved', () => {
  const state = stateOf({
    [hex(1)]: { tier: 'P0' },
    [hex(2)]: { tier: 'P1' },
    [hex(3)]: { tier: 'P1' },
    [hex(4)]: { tier: 'P3' },
  });
  const findings = [
    finding(2, { priority: 'P3' }),
    finding(3, { priority: 'P1' }),
  ];
  // 1 is gone, 2 dropped to P3, 3 is unchanged, 4 was never P0/P1
  assert.equal(computeTransitions(state, findings).resolved, 2);
});

test('the asset ids in alerts are validated, never raw', () => {
  const findings = [
    finding(1, { priority: 'P0', assetId: `${ADVISORY} injected` }),
  ];
  assert.deepEqual(computeTransitions(emptyAlertState(), findings).alerts, [
    { reason: 'new_p0', assetId: 'unknown-asset' },
  ]);
});

// --- heartbeat --------------------------------------------------------------------------------------

test('heartbeatDecision: once per window, deduplicated within a day, flagged when missed', () => {
  const decide = (hours, requested) =>
    heartbeatDecision({
      lastHeartbeatAt: hours === null ? null : hoursAgo(hours),
      now: NOW,
      requested,
    });
  const row = (d) => `${d.send}/${d.reason}/${d.missed}`;
  assert.equal(row(decide(null, false)), 'true/window/false', 'first ever');
  assert.equal(row(decide(null, true)), 'true/window/false');
  assert.equal(
    row(decide(3, true)),
    'false/deduplicated/false',
    'a second run the same day'
  );
  assert.equal(row(decide(10, false)), 'false/deduplicated/false');
  assert.equal(
    row(decide(HEARTBEAT_MIN_INTERVAL_HOURS - 0.1, true)),
    'false/deduplicated/false'
  );
  assert.equal(
    row(decide(23.9, true)),
    'true/requested/false',
    'the daily task, a little early'
  );
  assert.equal(
    row(decide(23.9, false)),
    'false/deduplicated/false',
    'not asked, not yet a whole window'
  );
  assert.equal(
    row(decide(24, false)),
    'true/window/false',
    'a whole window passed: sent even without the flag'
  );
  assert.equal(row(decide(26, true)), 'true/window/false');
  assert.equal(
    row(decide(26.5, true)),
    'true/window/true',
    'more than 26 h: missed'
  );
  assert.equal(decide(5, true).hoursSinceLast, 5);
  assert.equal(
    heartbeatDecision({
      lastHeartbeatAt: new Date(NOW.getTime() + 3600e3).toISOString(),
      now: NOW,
      requested: false,
    }).hoursSinceLast,
    0,
    'a clock in the future counts as zero'
  );
});

// --- messages ---------------------------------------------------------------------------------------------

test('the alert message carries reasons, counts, asset ids and the report pointer only', () => {
  const text = buildAlertMessage({
    alerts: [
      { reason: 'new_p0', assetId: 'money-service' },
      { reason: 'new_p1', assetId: 'monolith-web' },
      { reason: 'new_p1', assetId: 'monolith-web' },
      { reason: 'new_p1', assetId: 'railway-gateway' },
      { reason: 'runtime_floor_breach', assetId: 'money-service' },
      { reason: 'malicious_package', assetId: 'monolith-web' },
    ],
    posture: posture({
      summary: { tiers: { P0: 1, P1: 3, P2: 2, P3: 9, WITHDRAWN: 0 } },
    }),
    now: NOW,
  });
  assert.equal(
    text,
    [
      '🚨 [DavinTrade Security Alert] 2026-11-21 16:40 UTC',
      'Malicious-package record: 1 (monolith-web)',
      'New P0: 1 (money-service)',
      'Runtime floor breach: 1 (money-service)',
      'New P1: 3 (monolith-web x2, railway-gateway)',
      'Open now: P0=1 P1=3 P2=2 P3=9',
      `Details: ${REPORT_HINT}`,
    ].join('\n')
  );
  assert.deepEqual(
    findPrivacyViolations(text, { forbidden: [PACKAGE, ADVISORY, CVE] }),
    []
  );
  assert.equal(ALERT_REASONS.length, 6);
});

test('the heartbeat message is compact and healthy by default', () => {
  const text = buildHeartbeatMessage({
    posture: posture(),
    now: NOW,
    heartbeat: heartbeatDecision({
      lastHeartbeatAt: hoursAgo(24.2),
      now: NOW,
      requested: true,
    }),
    resolved: 0,
  });
  assert.equal(
    text,
    [
      '✅ [DavinTrade Security Heartbeat] 2026-11-21 16:40 UTC',
      'Sweep: OK | assets scanned 9/16 | matchers ok 8, failed 0',
      'Open: P0=0 P1=1 P2=2 P3=3 | withdrawn=0',
      'Runtime floors: unverified (1)',
      'Dependabot: not compared',
      'Last heartbeat: 24.2 h ago',
      `Details: ${REPORT_HINT}`,
    ].join('\n')
  );
});

test('the heartbeat flags a degraded sweep, a missed heartbeat, floors and resolved findings', () => {
  const text = buildHeartbeatMessage({
    posture: posture({
      run: { degraded: true, offline: true },
      matchers: { ok: 5, failed: 2, skipped: 0 },
      runtime_floors: {
        counts: {
          below_floor: 3,
          behind_latest_security: 1,
          unverified: 0,
          ok: 0,
          unknown_line: 0,
        },
        floors: [{ floorBehind: true }, { floorBehind: false }],
      },
      dependabot: { status: 'compared', open: 90, mismatch: 2 },
    }),
    now: NOW,
    heartbeat: heartbeatDecision({
      lastHeartbeatAt: hoursAgo(31.5),
      now: NOW,
      requested: true,
    }),
    resolved: 2,
  });
  assert.match(text, /^⚠️ \[DavinTrade Security Heartbeat\]/);
  assert.match(
    text,
    /Sweep: DEGRADED \(offline\) \| assets scanned 9\/16 \| matchers ok 5, failed 2/
  );
  assert.match(
    text,
    /Runtime floors: BREACH \(3 assets\), behind the latest security release \(1\), inventory floor outdated \(1\)/
  );
  assert.match(text, /Dependabot: open=90 mismatch=2/);
  assert.match(text, /Resolved P0\/P1 since the last sweep: 2/);
  assert.match(
    text,
    /⚠ Missed heartbeat: the previous one was 31\.5 h ago \(expected within 26 h\)\./
  );
  assert.match(text, /Last heartbeat: 31\.5 h ago/);
  assert.deepEqual(findPrivacyViolations(text), []);
  const first = buildHeartbeatMessage({
    posture: posture(),
    now: NOW,
    heartbeat: heartbeatDecision({
      lastHeartbeatAt: null,
      now: NOW,
      requested: true,
    }),
  });
  assert.match(first, /Last heartbeat: first run/);
});

test('buildTestMessage and buildPushBody', () => {
  assert.match(
    buildTestMessage(NOW),
    /^✅ \[DavinTrade Security\] LINE connection test 2026-11-21 16:40 UTC/
  );
  const body = buildPushBody({
    userId: USER_ID,
    texts: ['a', 'b', 'c', 'd', 'e', 'f'],
  });
  assert.equal(body.to, USER_ID);
  assert.equal(
    body.messages.length,
    5,
    'LINE accepts five messages per request'
  );
  assert.deepEqual(body.messages[0], { type: 'text', text: 'a' });
});

// --- push ---------------------------------------------------------------------------------------------------

function fakeLine(statuses) {
  const calls = [];
  const queue = [...statuses];
  const fetchImpl = async (url, init) => {
    calls.push({ url, init });
    const next = queue.length > 1 ? queue.shift() : queue[0];
    if (next === 'throw') throw new TypeError('fetch failed');
    return new Response(
      next === 200 ? '{}' : JSON.stringify({ message: `error body ${TOKEN}` }),
      { status: next }
    );
  };
  return { fetchImpl, calls };
}

test('pushLineMessages sends the documented request', async () => {
  const { fetchImpl, calls } = fakeLine([200]);
  const result = await pushLineMessages({
    fetchImpl,
    token: TOKEN,
    userId: USER_ID,
    texts: ['hello'],
    sleep: async () => {},
  });
  assert.deepEqual(result, { ok: true, code: 'sent', status: 200 });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, LINE_PUSH_URL);
  assert.equal(LINE_PUSH_URL, 'https://api.line.me/v2/bot/message/push');
  assert.equal(calls[0].init.method, 'POST');
  assert.equal(calls[0].init.headers.Authorization, `Bearer ${TOKEN}`);
  assert.equal(calls[0].init.headers['Content-Type'], 'application/json');
  assert.match(calls[0].init.headers['X-Line-Retry-Key'], /^[0-9a-f-]{36}$/);
  assert.deepEqual(JSON.parse(calls[0].init.body), {
    to: USER_ID,
    messages: [{ type: 'text', text: 'hello' }],
  });
});

test('pushLineMessages returns fixed codes, retries a 5xx or a network error once with the same retry key, never throws', async () => {
  const cases = [
    [[401], 'auth_failed', 1],
    [[403], 'auth_failed', 1],
    [[429], 'rate_limited', 1],
    [[400], 'http_400', 1],
    [[409], 'sent', 1],
    [[500, 200], 'sent', 2],
    [[500, 503], 'http_503', 2],
    [['throw', 200], 'sent', 2],
    [['throw', 'throw'], 'network_error', 2],
  ];
  for (const [statuses, code, expectedCalls] of cases) {
    const { fetchImpl, calls } = fakeLine(statuses);
    const result = await pushLineMessages({
      fetchImpl,
      token: TOKEN,
      userId: USER_ID,
      texts: ['x'],
      sleep: async () => {},
    });
    assert.equal(result.code, code, JSON.stringify(statuses));
    assert.equal(calls.length, expectedCalls, JSON.stringify(statuses));
    assert.equal(
      JSON.stringify(result).includes(TOKEN),
      false,
      'the response body and token never come back'
    );
    if (expectedCalls === 2) {
      assert.equal(
        calls[0].init.headers['X-Line-Retry-Key'],
        calls[1].init.headers['X-Line-Retry-Key']
      );
    }
  }
});

// --- preview ------------------------------------------------------------------------------------------------------

test('renderPreview shows the exact texts and a body with the user redacted', () => {
  const preview = renderPreview({
    now: NOW,
    reason: 'dry run',
    texts: ['first text', 'second text'],
  });
  assert.match(preview, /Nothing was sent\./);
  assert.match(preview, /---- message 1 of 2 ----\nfirst text\n/);
  assert.match(preview, /---- message 2 of 2 ----\nsecond text\n/);
  assert.ok(preview.includes('"to":"<LINE_TARGET_USER_ID>"'));
  assert.equal(preview.includes(USER_ID), false);
});

// --- one notification round -------------------------------------------------------------------------------------------

const OPTIONS = { notifyLine: true, heartbeat: true, dryRunLine: false };
const SECRETS = { lineToken: TOKEN, lineUserId: USER_ID };
const round = (over = {}) => {
  const { fetchImpl, calls } = fakeLine([200]);
  const input = {
    options: OPTIONS,
    secrets: SECRETS,
    posture: posture({
      findings: [
        finding(1, { priority: 'P0' }),
        finding(2, { priority: 'P1' }),
        finding(3, { priority: 'P3' }),
      ],
      summary: { tiers: { P0: 1, P1: 1, P2: 0, P3: 1, WITHDRAWN: 0 } },
    }),
    state: emptyAlertState(),
    now: NOW,
    fetchImpl,
    sleep: async () => {},
    forbidden: [PACKAGE, ADVISORY, CVE],
    ...over,
  };
  return { input, calls, run: () => runNotifications(input) };
};

test('runNotifications is off without a LINE flag', async () => {
  const { run, calls } = round({
    options: { notifyLine: false, heartbeat: true, dryRunLine: false },
  });
  const result = await run();
  assert.equal(result.mode, 'off');
  assert.equal(calls.length, 0);
  assert.equal(result.nextState, null);
});

test('runNotifications --dry-run-line sends nothing, previews every message and keeps the state', async () => {
  const { run, calls } = round({
    options: { notifyLine: false, heartbeat: false, dryRunLine: true },
  });
  const result = await run();
  assert.equal(result.mode, 'dry_run');
  assert.equal(calls.length, 0);
  assert.equal(result.nextState, null, 'a dry run never swallows an alert');
  assert.equal(result.previewTexts.length, 2, 'the alert and the heartbeat');
  assert.match(result.previewTexts[0], /^🚨 /);
  assert.match(result.previewTexts[1], /^✅ \[DavinTrade Security Heartbeat\]/);
  for (const text of result.previewTexts) {
    assert.deepEqual(findPrivacyViolations(text, { forbidden: [PACKAGE] }), []);
  }
});

test('runNotifications without credentials falls back to a preview and does not fail', async () => {
  const { run, calls } = round({
    secrets: { lineToken: null, lineUserId: null },
  });
  const result = await run();
  assert.equal(result.mode, 'preview_no_credentials');
  assert.equal(calls.length, 0);
  assert.equal(
    result.nextState,
    null,
    'the alerts stay pending until the credentials exist'
  );
  assert.equal(result.previewTexts.length, 2);
  const half = await round({
    secrets: { lineToken: TOKEN, lineUserId: null },
  }).run();
  assert.equal(half.mode, 'preview_no_credentials');
});

test('runNotifications sends one request with the alert and the heartbeat, then records the state', async () => {
  const { run, calls } = round();
  const result = await run();
  assert.equal(result.mode, 'sent');
  assert.equal(calls.length, 1);
  const body = JSON.parse(calls[0].init.body);
  assert.equal(body.messages.length, 2);
  assert.match(body.messages[0].text, /^🚨 \[DavinTrade Security Alert\]/);
  assert.match(body.messages[1].text, /^✅ \[DavinTrade Security Heartbeat\]/);
  assert.equal(result.heartbeatSent, true);
  assert.equal(result.alerts, 2);
  assert.equal(result.nextState.last_heartbeat_at, NOW.toISOString());
  assert.deepEqual(Object.keys(result.nextState.findings).sort(), [
    hex(1),
    hex(2),
    hex(3),
  ]);
  for (const message of body.messages) {
    assert.deepEqual(
      findPrivacyViolations(message.text, {
        forbidden: [PACKAGE, ADVISORY, CVE],
      }),
      []
    );
  }
});

test('runNotifications deduplicates: the next run with the stored state sends nothing new', async () => {
  const first = await round().run();
  assert.equal(first.mode, 'sent');
  // two hours later, the same findings, --heartbeat passed again
  const { run, calls } = round({
    state: first.nextState,
    now: new Date(NOW.getTime() + 2 * 3600e3),
  });
  const second = await run();
  assert.equal(second.mode, 'nothing_to_send');
  assert.equal(calls.length, 0);
  assert.equal(second.alerts, 0);
  assert.equal(second.heartbeat.reason, 'deduplicated');
  assert.equal(
    second.nextState.last_heartbeat_at,
    NOW.toISOString(),
    'the heartbeat time is not moved'
  );
  // the next day: no alert, but the heartbeat goes out
  const { run: runDay, calls: dayCalls } = round({
    state: first.nextState,
    now: new Date(NOW.getTime() + 24.1 * 3600e3),
  });
  const day = await runDay();
  assert.equal(day.mode, 'sent');
  assert.equal(JSON.parse(dayCalls[0].init.body).messages.length, 1);
  assert.equal(day.alerts, 0);
});

test('runNotifications keeps the state when the push fails, so the alert fires again', async () => {
  const { fetchImpl } = fakeLine([401]);
  const result = await round({ fetchImpl }).run();
  assert.equal(result.mode, 'failed');
  assert.equal(result.code, 'auth_failed');
  assert.equal(result.nextState, null);
  assert.equal(JSON.stringify(result).includes(TOKEN), false);
});

test('runNotifications sends the heartbeat even without --heartbeat once a window has passed', async () => {
  const { run, calls } = round({
    options: { notifyLine: true, heartbeat: false, dryRunLine: false },
    posture: posture(),
    state: { ...emptyAlertState(), last_heartbeat_at: hoursAgo(25) },
  });
  const result = await run();
  assert.equal(result.mode, 'sent');
  assert.equal(JSON.parse(calls[0].init.body).messages.length, 1);
  assert.equal(result.heartbeat.missed, false);
  const missed = await round({
    posture: posture(),
    state: { ...emptyAlertState(), last_heartbeat_at: hoursAgo(40) },
  }).run();
  assert.match(missed.texts.at(-1), /Missed heartbeat/);
});

test('runNotifications never lets a leak into a message: it falls back to a fixed text', async () => {
  // a stand-in for a bug: the guard sees a token-like string in a message
  const { run } = round({
    posture: posture({
      findings: [finding(1, { priority: 'P0' })],
      summary: { tiers: { P0: 1, P1: 0, P2: 0, P3: 0, WITHDRAWN: 0 } },
    }),
    forbidden: ['money-service'], // pretend an asset id collides with a forbidden token
    secrets: { lineToken: null, lineUserId: null },
  });
  const result = await run();
  assert.ok(result.violations.includes('forbidden_string'));
  assert.match(result.previewTexts[0], /withheld by the privacy guard/);
  for (const text of result.previewTexts)
    assert.deepEqual(findPrivacyViolations(text), []);
});
