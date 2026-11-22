// Run: node --test 'scripts/security/*.test.mjs'
//
// The behaviour signals (Phase 4 of the security monitoring architecture, v3.0,
// section 6.4), entirely offline: the telemetry snapshot is built in memory and
// every probe (the GitHub API, the gateway health endpoint) is a fake, so nothing
// real is read or sent. Identifiers are invented; the assertions check that they
// reach the private reports and never stdout or a LINE message.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  AREAS,
  BEHAVIOUR_BASELINE,
  BEHAVIOUR_RULES,
  BEHAVIOUR_USAGE,
  BehaviourUsageError,
  evaluateAuthFailures,
  evaluateHttpRates,
  evaluateLlmUsage,
  evaluateMainPushes,
  evaluateQueueHealth,
  evaluateWebhooks,
  makeBehaviourFinding,
  mergeBehaviourFindings,
  mergeQueueSamples,
  parseBehaviourArgs,
  parseBehaviourInput,
  parseBehaviourSettings,
  parseQueueSample,
  renderBehaviourMarkdown,
  renderBehaviourSection,
  renderBehaviourStdout,
  resolveMainBaseline,
  runBehaviourSignals,
} from './behaviour-signals-lib.mjs';
import { runBehaviourCli } from './behaviour-signals-run.mjs';
import { findPrivacyViolations } from './line-notifier-lib.mjs';
import {
  compareFindings,
  loadInventory,
  summarizeFindings,
} from './security-pipeline-lib.mjs';

const NOW = new Date('2026-11-22T12:00:00Z');
// a URL that carries a user name and a password, built here so none is written into the source
const withCredentials = (href) => {
  const url = new URL(href);
  url.username = 'name';
  url.password = 'pass-word';
  return url.href;
};
const MIN = 60000;
const HOUR = 3600000;
const DAY = 86400000;
const iso = (ms) => new Date(ms).toISOString();
const ago = (ms) => iso(NOW.getTime() - ms);

// a snapshot collected five minutes ago, with the given sections
const snapshot = (sections = {}, over = {}) => ({
  schema_version: '1.0',
  collected_at: ago(5 * MIN),
  ...sections,
  ...over,
});
const parsed = (sections, over) =>
  parseBehaviourInput(snapshot(sections, over), { now: NOW });
const states = (p) =>
  Object.fromEntries(Object.entries(p.sections).map(([k, v]) => [k, v.state]));
const brief = (c) => [c.id, c.status, c.rule, c.priority];
const route = (over = {}) => ({
  id: 'money-stripe',
  asset: 'money-service',
  requests: 40,
  status_5xx: 0,
  signature_failures: 1,
  ...over,
});
const webhooks = (routes, over = {}) =>
  parsed({ webhooks: { window_minutes: 60, routes, ...over } }).sections
    .webhooks;

// --- the telemetry snapshot ---------------------------------------------------------------------

test('parseBehaviourInput: no file means every section is absent and nothing is wrong', () => {
  for (const raw of [null, undefined]) {
    const p = parseBehaviourInput(raw, { now: NOW });
    assert.equal(p.present, false);
    assert.deepEqual(states(p), {
      webhooks: 'absent',
      auth: 'absent',
      http: 'absent',
      llm: 'absent',
      queue: 'absent',
    });
    assert.deepEqual(p.issues, []);
  }
});

test('parseBehaviourInput: a value that is not an object is reported, never thrown', () => {
  for (const raw of ['text', 42, true, [], [1, 2]]) {
    const p = parseBehaviourInput(raw, { now: NOW });
    assert.equal(p.present, true);
    assert.deepEqual(p.issues, ['file:not_an_object']);
    assert.ok(Object.values(states(p)).every((s) => s === 'absent'));
  }
});

test('parseBehaviourInput: a well-formed section is normalised and the others stay absent', () => {
  const p = parsed({ webhooks: { window_minutes: 60, routes: [route()] } });
  assert.equal(p.present, true);
  assert.equal(p.sections.webhooks.state, 'ok');
  assert.deepEqual(p.sections.webhooks.data, {
    windowMinutes: 60,
    routes: [
      {
        id: 'money-stripe',
        assetId: 'money-service',
        requests: 40,
        serverErrors: 0,
        signatureFailures: 1,
      },
    ],
  });
  assert.equal(p.sections.webhooks.collectedAt, ago(5 * MIN));
  assert.equal(p.sections.auth.state, 'absent');
  assert.deepEqual(p.issues, []);
});

test('a section brings its own collected_at, or takes the file one, or is invalid', () => {
  const own = parseBehaviourInput(
    {
      schema_version: '1.0',
      webhooks: { collected_at: ago(HOUR), routes: [route()] },
    },
    { now: NOW }
  );
  assert.equal(own.sections.webhooks.state, 'ok');
  assert.equal(own.sections.webhooks.collectedAt, ago(HOUR));
  assert.equal(own.sections.webhooks.ageHours, 1);

  const none = parseBehaviourInput(
    { schema_version: '1.0', webhooks: { routes: [route()] } },
    { now: NOW }
  );
  assert.deepEqual(none.sections.webhooks, {
    state: 'invalid',
    code: 'no_collected_at',
  });

  const future = parsed({
    webhooks: { collected_at: iso(NOW.getTime() + HOUR), routes: [route()] },
  });
  assert.deepEqual(future.sections.webhooks, {
    state: 'invalid',
    code: 'future_collected_at',
  });
});

test('a section older than 26 hours is stale; exactly 26 hours is still fresh', () => {
  assert.equal(BEHAVIOUR_BASELINE.maxSnapshotAgeHours, 26);
  const fresh = parsed({
    webhooks: { collected_at: ago(26 * HOUR), routes: [route()] },
  });
  assert.equal(fresh.sections.webhooks.state, 'ok');
  const stale = parsed({
    webhooks: { collected_at: ago(26 * HOUR + MIN), routes: [route()] },
  });
  assert.equal(stale.sections.webhooks.state, 'stale');
  assert.equal(stale.sections.webhooks.ageHours, 26);
});

test('a bad route is dropped with a fixed issue code and the good one stays', () => {
  const p = parsed({
    webhooks: {
      routes: [
        route(),
        route({ id: 'Bad Id' }),
        route({ id: 'neg', status_5xx: -1 }),
        route({ id: 'frac', signature_failures: 1.5 }),
        route({ id: 'money-stripe' }),
        route({ id: 'wrong-asset', asset: 'Not An Asset' }),
        null,
        'text',
      ],
    },
  });
  assert.deepEqual(
    p.sections.webhooks.data.routes.map((r) => r.id),
    ['money-stripe']
  );
  assert.deepEqual(p.issues, [
    'webhooks:bad_route',
    'webhooks:duplicate_route',
  ]);
});

test('a window outside 1 to 1440 minutes, or routes that are not a list, make the section invalid', () => {
  for (const over of [
    { window_minutes: 0 },
    { window_minutes: 1441 },
    { window_minutes: 2.5 },
    { window_minutes: '60' },
    { routes: 'all' },
  ]) {
    const section = parsed({
      webhooks: { window_minutes: 60, routes: [route()], ...over },
    }).sections.webhooks;
    assert.deepEqual(section, { state: 'invalid', code: 'bad_data' });
  }
});

test('auth buckets that look like an address are dropped and never echoed', () => {
  const p = parsed({
    auth: {
      ip_buckets: [
        { bucket: 'a1b2c3d4', failures: 3 },
        { bucket: '203-0-113-7', failures: 99 },
        { bucket: 'ip_203_0_113_7_x', failures: 99 },
        { bucket: 'ab', failures: 1 },
        { bucket: 'has space', failures: 1 },
      ],
      account_buckets: [{ bucket: 'acct-77c1', failures: 2 }],
    },
  });
  assert.deepEqual(p.sections.auth.data.ipBuckets, [
    { bucket: 'a1b2c3d4', failures: 3 },
  ]);
  assert.deepEqual(p.issues, ['auth:bad_bucket']);
  assert.equal(JSON.stringify(p).includes('203'), false);
});

test('http counts must add up: errors and throttled requests cannot exceed the requests', () => {
  const ok = parsed({
    http: { window_minutes: 15, requests: 100, status_5xx: 4, status_429: 6 },
  });
  assert.deepEqual(ok.sections.http.data, {
    windowMinutes: 15,
    assetId: 'monolith-web',
    requests: 100,
    serverErrors: 4,
    rateLimited: 6,
  });
  for (const bad of [
    { requests: 10, status_5xx: 11, status_429: 0 },
    { requests: 10, status_5xx: 6, status_429: 6 },
    { requests: -1, status_5xx: 0, status_429: 0 },
    { requests: 10, status_5xx: 0 },
  ]) {
    assert.deepEqual(parsed({ http: bad }).sections.http, {
      state: 'invalid',
      code: 'bad_data',
    });
  }
});

// --- BS-1: webhook 5xx and signature failures -----------------------------------------------------------

test('BS-1: a quiet route passes and the check says what was measured', () => {
  const { checks } = evaluateWebhooks(webhooks([route()]));
  assert.equal(checks.length, 1);
  const [c] = checks;
  assert.deepEqual(brief(c), ['bs1-webhook-money-stripe', 'pass', null, null]);
  assert.equal(c.signal, 'BS-1');
  assert.equal(c.area, 'webhooks');
  assert.equal(c.assetId, 'money-service');
  assert.equal(c.expected, '5xx=0 signature_failures<=5/h');
  assert.equal(c.observed, '5xx=0 signature_failures=1/h requests=40');
});

test('BS-1: any 5xx is a P1 breach, even a single one', () => {
  const { checks } = evaluateWebhooks(
    webhooks([route({ status_5xx: 1 }), route({ id: 'money-dlocal' })])
  );
  assert.deepEqual(checks.map(brief), [
    ['bs1-webhook-money-stripe', 'fail', 'BS-1', 'P1'],
    ['bs1-webhook-money-dlocal', 'pass', null, null],
  ]);
  assert.equal(checks[0].observed, '5xx=1 signature_failures=1/h requests=40');
});

test('BS-1: more than five signature failures an hour is a breach; exactly five is not', () => {
  const at = (n) =>
    evaluateWebhooks(webhooks([route({ signature_failures: n })])).checks[0];
  assert.equal(at(5).status, 'pass');
  assert.equal(at(6).status, 'fail');
  assert.equal(at(6).rule, 'BS-1');
  assert.equal(at(6).priority, 'P1');
});

test('BS-1: a window longer than an hour is scaled down, a shorter one is not scaled up', () => {
  const at = (windowMinutes, n) =>
    evaluateWebhooks(
      webhooks([route({ signature_failures: n })], {
        window_minutes: windowMinutes,
      })
    ).checks[0];
  // 10 in two hours = 5 an hour; 12 in two hours = 6 an hour
  assert.equal(at(120, 10).status, 'pass');
  assert.equal(at(120, 12).status, 'fail');
  assert.equal(
    at(120, 12).observed,
    '5xx=0 signature_failures=6/h requests=40'
  );
  // six in half an hour is already more than five an hour; five in ten minutes is not extrapolated
  assert.equal(at(30, 6).status, 'fail');
  assert.equal(at(10, 5).status, 'pass');
});

test('BS-1: nothing to judge is skipped, an unreadable or old snapshot is unavailable', () => {
  const absent = parsed({}).sections.webhooks;
  assert.deepEqual(
    evaluateWebhooks(absent).checks.map((c) => [c.id, c.status, c.detail]),
    [['bs1-webhooks', 'skipped', 'no_telemetry_sample']]
  );
  assert.deepEqual(
    evaluateWebhooks(webhooks([])).checks.map((c) => [c.status, c.detail]),
    [['skipped', 'no_telemetry_sample']]
  );
  const stale = parsed({
    webhooks: { collected_at: ago(30 * HOUR), routes: [route()] },
  }).sections.webhooks;
  assert.deepEqual(
    evaluateWebhooks(stale).checks.map((c) => [c.status, c.detail]),
    [['unavailable', 'stale_telemetry']]
  );
  const invalid = parsed({ webhooks: { window_minutes: 0, routes: [] } })
    .sections.webhooks;
  assert.deepEqual(
    evaluateWebhooks(invalid).checks.map((c) => [c.status, c.detail]),
    [['unavailable', 'invalid_telemetry']]
  );
  for (const result of [absent, stale, invalid]) {
    const [c] = evaluateWebhooks(result).checks;
    assert.equal(c.priority, null);
    assert.equal(c.rule, null);
    assert.equal(c.assetId, 'money-service');
  }
});

// --- BS-2: failed logins, resets and 2FA ------------------------------------------------------------------

const auth = (over = {}) => ({
  window_minutes: 60,
  ip_buckets: [{ bucket: 'a1b2c3d4', failures: 4 }],
  account_buckets: [{ bucket: '9c41f0aa', failures: 2 }],
  ...over,
});
const authSection = (over) => parsed({ auth: auth(over) }).sections.auth;

test('BS-2: quiet buckets give one passing check per dimension', () => {
  const { checks } = evaluateAuthFailures(authSection());
  assert.deepEqual(checks.map(brief), [
    ['bs2-auth-ip', 'pass', null, null],
    ['bs2-auth-account', 'pass', null, null],
  ]);
  assert.deepEqual(
    checks.map((c) => [c.signal, c.area, c.assetId, c.observed]),
    [
      ['BS-2', 'auth', 'monolith-web', 'max=4/h buckets=1'],
      ['BS-2', 'auth', 'monolith-web', 'max=2/h buckets=1'],
    ]
  );
});

test('BS-2: more than 20 an hour for one address bucket, or more than 5 for one account, is a P1', () => {
  const ip = (n) =>
    evaluateAuthFailures(
      authSection({ ip_buckets: [{ bucket: 'a1b2c3d4', failures: n }] })
    ).checks;
  assert.equal(
    ip(20).find((c) => c.id.startsWith('bs2-auth-ip')).status,
    'pass'
  );
  const over = ip(21);
  assert.deepEqual(brief(over.find((c) => c.id.startsWith('bs2-auth-ip'))), [
    'bs2-auth-ip-a1b2c3d4',
    'fail',
    'BS-2',
    'P1',
  ]);

  const account = (n) =>
    evaluateAuthFailures(
      authSection({ account_buckets: [{ bucket: '9c41f0aa', failures: n }] })
    ).checks;
  assert.equal(
    account(5).find((c) => c.id.startsWith('bs2-auth-account')).status,
    'pass'
  );
  assert.deepEqual(
    brief(account(6).find((c) => c.id.startsWith('bs2-auth-account'))),
    ['bs2-auth-account-9c41f0aa', 'fail', 'BS-2', 'P1']
  );
});

test('BS-2: a dimension with a breach lists the offenders, the other dimension still passes', () => {
  const { checks } = evaluateAuthFailures(
    authSection({
      ip_buckets: [
        { bucket: 'a1b2c3d4', failures: 30 },
        { bucket: 'e5f6a7b8', failures: 2 },
        { bucket: 'c9d0e1f2', failures: 25 },
      ],
    })
  );
  assert.deepEqual(checks.map(brief), [
    ['bs2-auth-ip-a1b2c3d4', 'fail', 'BS-2', 'P1'],
    ['bs2-auth-ip-c9d0e1f2', 'fail', 'BS-2', 'P1'],
    ['bs2-auth-account', 'pass', null, null],
  ]);
  assert.equal(checks[0].observed, 'failures=30/h window=60m');
});

test('BS-2: the window is scaled down above an hour and never scaled up', () => {
  const run = (windowMinutes, failures) =>
    evaluateAuthFailures(
      authSection({
        window_minutes: windowMinutes,
        ip_buckets: [{ bucket: 'a1b2c3d4', failures }],
      })
    ).checks[0];
  assert.equal(run(120, 40).status, 'pass'); // 20 an hour
  assert.equal(run(120, 42).status, 'fail'); // 21 an hour
  assert.equal(run(15, 20).status, 'pass'); // not extrapolated to 80 an hour
});

test('BS-2: at most 20 offenders are listed per dimension and the rest are counted in a note', () => {
  const buckets = Array.from({ length: 25 }, (_, i) => ({
    bucket: `bucket${String(i).padStart(3, '0')}`,
    failures: 50,
  }));
  const { checks, notes } = evaluateAuthFailures(
    authSection({ ip_buckets: buckets })
  );
  assert.equal(checks.filter((c) => c.status === 'fail').length, 20);
  assert.deepEqual(notes, [
    'auth: 5 more offending address buckets not listed',
  ]);
});

test('BS-2: a dimension the snapshot does not carry is skipped, an empty one passes', () => {
  const only = evaluateAuthFailures(
    parsed({ auth: { window_minutes: 60, ip_buckets: [] } }).sections.auth
  ).checks;
  assert.deepEqual(
    only.map((c) => [c.id, c.status, c.detail, c.observed]),
    [
      ['bs2-auth-ip', 'pass', null, 'max=0/h buckets=0'],
      ['bs2-auth-account', 'skipped', 'no_telemetry_sample', null],
    ]
  );
  const absent = evaluateAuthFailures(parsed({}).sections.auth).checks;
  assert.deepEqual(
    absent.map((c) => [c.id, c.status, c.detail]),
    [
      ['bs2-auth-ip', 'skipped', 'no_telemetry_sample'],
      ['bs2-auth-account', 'skipped', 'no_telemetry_sample'],
    ]
  );
});

// --- BS-3: 5xx and 429 rate -----------------------------------------------------------------------------------

const httpOf = (over = {}) =>
  parsed({
    http: {
      window_minutes: 15,
      requests: 1000,
      status_5xx: 5,
      status_429: 10,
      ...over,
    },
  }).sections.http;

test('BS-3: a 5xx rate above one percent is a P1, one percent exactly is not', () => {
  const at = (n) => evaluateHttpRates(httpOf({ status_5xx: n })).checks;
  assert.deepEqual(at(10).map(brief), [
    ['bs3-http-5xx', 'pass', null, null],
    ['bs3-http-429', 'pass', null, null],
  ]);
  const over = at(11);
  assert.deepEqual(brief(over[0]), ['bs3-http-5xx', 'fail', 'BS-3', 'P1']);
  assert.equal(over[0].observed, '11/1000 = 1.10% window=15m');
  assert.equal(over[0].expected, '5xx<=1% (>=20 requests)');
  assert.equal(over[0].assetId, 'monolith-web');
});

test('BS-3: a 429 rate above five percent is a P2 (rule BS-3b), five percent exactly is not', () => {
  const at = (n) => evaluateHttpRates(httpOf({ status_429: n })).checks[1];
  assert.equal(at(50).status, 'pass');
  assert.deepEqual(brief(at(51)), ['bs3-http-429', 'fail', 'BS-3b', 'P2']);
  assert.equal(at(51).observed, '51/1000 = 5.10% window=15m');
});

test('BS-3: both can fail at once, each with its own priority', () => {
  const { checks } = evaluateHttpRates(
    httpOf({ status_5xx: 50, status_429: 200 })
  );
  assert.deepEqual(
    checks.map((c) => [c.rule, c.priority]),
    [
      ['BS-3', 'P1'],
      ['BS-3b', 'P2'],
    ]
  );
});

test('BS-3: fewer than 20 requests cannot show a rate, so nothing is judged', () => {
  assert.equal(BEHAVIOUR_BASELINE.http.minRequests, 20);
  const small = evaluateHttpRates(
    httpOf({ requests: 19, status_5xx: 19, status_429: 0 })
  ).checks;
  assert.deepEqual(
    small.map((c) => [c.status, c.detail]),
    [
      ['skipped', 'below_min_sample'],
      ['skipped', 'below_min_sample'],
    ]
  );
  // twenty requests are enough
  assert.equal(
    evaluateHttpRates(httpOf({ requests: 20, status_5xx: 1, status_429: 0 }))
      .checks[0].status,
    'fail'
  );
});

test('BS-3: the asset can be named in the snapshot; a missing or old one is not a pass', () => {
  const named = parsed({
    http: {
      requests: 100,
      status_5xx: 0,
      status_429: 0,
      asset: 'money-service',
    },
  }).sections.http;
  assert.equal(evaluateHttpRates(named).checks[0].assetId, 'money-service');
  const absent = evaluateHttpRates(parsed({}).sections.http).checks;
  assert.deepEqual(
    absent.map((c) => [c.id, c.status, c.detail]),
    [
      ['bs3-http-5xx', 'skipped', 'no_telemetry_sample'],
      ['bs3-http-429', 'skipped', 'no_telemetry_sample'],
    ]
  );
  const stale = parsed({
    http: {
      collected_at: ago(27 * HOUR),
      requests: 100,
      status_5xx: 0,
      status_429: 0,
    },
  }).sections.http;
  assert.deepEqual(
    evaluateHttpRates(stale).checks.map((c) => [c.status, c.detail]),
    [
      ['unavailable', 'stale_telemetry'],
      ['unavailable', 'stale_telemetry'],
    ]
  );
});

// --- BS-4: LLM spend and request count ------------------------------------------------------------------

// the seven days before 2026-11-22, newest first in the file order of a collector
const days = (n, spend, requests) =>
  Array.from({ length: n }, (_, i) => ({
    date: new Date(Date.UTC(2026, 10, 21 - i)).toISOString().slice(0, 10),
    spend_usd: typeof spend === 'function' ? spend(i) : spend,
    requests: typeof requests === 'function' ? requests(i) : requests,
  }));
const llmSection = (over = {}) =>
  parsed({
    llm: {
      asset: 'chat-server',
      today: { date: '2026-11-22', spend_usd: 4, requests: 100 },
      daily: days(7, 2, 50),
      ...over,
    },
  }).sections.llm;

test('BS-4: today above twice the seven-day median is a P1; exactly twice is not', () => {
  const run = (today) =>
    evaluateLlmUsage(llmSection({ today: { date: '2026-11-22', ...today } }))
      .checks;
  assert.deepEqual(run({ spend_usd: 4, requests: 100 }).map(brief), [
    ['bs4-llm-spend', 'pass', null, null],
    ['bs4-llm-requests', 'pass', null, null],
  ]);
  const over = run({ spend_usd: 4.01, requests: 101 });
  assert.deepEqual(over.map(brief), [
    ['bs4-llm-spend', 'fail', 'BS-4', 'P1'],
    ['bs4-llm-requests', 'fail', 'BS-4', 'P1'],
  ]);
  assert.equal(over[0].assetId, 'chat-server');
  assert.equal(over[0].observed, 'today=4.01 median=2 (2.005x)');
  assert.equal(over[1].observed, 'today=101 median=50 (2.02x)');
  assert.equal(over[0].expected, '<=2x the median of the last 7 days');
});

test('BS-4: spend and request count are judged on their own', () => {
  const { checks } = evaluateLlmUsage(
    llmSection({ today: { date: '2026-11-22', spend_usd: 9, requests: 90 } })
  );
  assert.deepEqual(
    checks.map((c) => [c.id, c.status]),
    [
      ['bs4-llm-spend', 'fail'],
      ['bs4-llm-requests', 'pass'],
    ]
  );
});

test('BS-4: the median of an even number of days is the mean of the middle two', () => {
  const daily = days(4, (i) => [1, 2, 3, 4][i], 50);
  const at = (spend) =>
    evaluateLlmUsage(
      llmSection({
        daily,
        today: { date: '2026-11-22', spend_usd: spend, requests: 1 },
      })
    ).checks[0];
  assert.equal(at(5).status, 'pass'); // median 2.5, so up to 5
  assert.equal(at(5.01).status, 'fail');
});

test('BS-4: only the seven latest days before today count, and today is never its own baseline', () => {
  const daily = [
    ...days(7, 2, 50),
    // three older days with huge values must be ignored ...
    ...days(10, 2, 50)
      .slice(7)
      .map((d) => ({ ...d, spend_usd: 1000, requests: 100000 })),
    // ... and a row for today itself is not part of the history
    { date: '2026-11-22', spend_usd: 1000, requests: 100000 },
  ];
  const { checks } = evaluateLlmUsage(llmSection({ daily }));
  assert.deepEqual(
    checks.map((c) => [c.status, c.observed]),
    [
      ['pass', 'today=4 median=2 (2x)'],
      ['pass', 'today=100 median=50 (2x)'],
    ]
  );
});

test('BS-4: the median is taken over exactly seven days, so older days cannot move it', () => {
  // the seven latest days have a median of 2; the three older days would lift it to 3
  const recent = days(7, (i) => [1, 1, 1, 2, 3, 3, 3][i], 50);
  const older = days(10, 0, 0)
    .slice(7)
    .map((d) => ({ ...d, spend_usd: 1000, requests: 100000 }));
  const { checks } = evaluateLlmUsage(
    llmSection({
      daily: [...recent, ...older],
      today: { date: '2026-11-22', spend_usd: 5, requests: 100 },
    })
  );
  assert.deepEqual(brief(checks[0]), ['bs4-llm-spend', 'fail', 'BS-4', 'P1']);
  assert.equal(checks[0].observed, 'today=5 median=2 (2.5x)');
});

test('BS-4: fewer than three days of history is skipped, a zero median cannot be compared', () => {
  assert.equal(BEHAVIOUR_BASELINE.llm.minHistoryDays, 3);
  const few = evaluateLlmUsage(llmSection({ daily: days(2, 2, 50) })).checks;
  assert.deepEqual(
    few.map((c) => [c.status, c.detail]),
    [
      ['skipped', 'insufficient_history'],
      ['skipped', 'insufficient_history'],
    ]
  );
  const zero = evaluateLlmUsage(
    llmSection({
      daily: days(7, 0, 50),
      today: { date: '2026-11-22', spend_usd: 9, requests: 120 },
    })
  ).checks;
  assert.deepEqual(
    zero.map((c) => [c.id, c.status, c.detail]),
    [
      ['bs4-llm-spend', 'skipped', 'no_baseline'],
      ['bs4-llm-requests', 'fail', null],
    ]
  );
});

test('BS-4: a date that has the shape of a day but is not one is bad data, never a crash', () => {
  for (const date of ['2026-13-45', '2026-02-30', '2026-00-10', '0000-00-00']) {
    const section = parsed({
      llm: { today: { date, spend_usd: 1, requests: 1 }, daily: [] },
    }).sections.llm;
    assert.deepEqual(section, { state: 'invalid', code: 'bad_data' }, date);
  }
  // inside the history only that row is dropped
  const p = parsed({
    llm: {
      today: { date: '2026-11-22', spend_usd: 1, requests: 1 },
      daily: [
        { date: '2026-02-30', spend_usd: 1, requests: 1 },
        { date: '2026-11-21', spend_usd: 1, requests: 1 },
      ],
    },
  });
  assert.equal(p.sections.llm.state, 'ok');
  assert.equal(p.sections.llm.data.daily.length, 1);
  assert.deepEqual(p.issues, ['llm:bad_day']);
});

test('BS-4: a missing, unreadable or old section is never a pass', () => {
  assert.deepEqual(
    evaluateLlmUsage(parsed({}).sections.llm).checks.map((c) => [
      c.id,
      c.status,
      c.detail,
      c.assetId,
    ]),
    [
      ['bs4-llm-spend', 'skipped', 'no_telemetry_sample', 'chat-server'],
      ['bs4-llm-requests', 'skipped', 'no_telemetry_sample', 'chat-server'],
    ]
  );
  const bad = parsed({
    llm: { today: { date: 'yesterday', spend_usd: 1, requests: 1 }, daily: [] },
  }).sections.llm;
  assert.deepEqual(bad, { state: 'invalid', code: 'bad_data' });
  assert.deepEqual(
    evaluateLlmUsage(bad).checks.map((c) => [c.status, c.detail]),
    [
      ['unavailable', 'invalid_telemetry'],
      ['unavailable', 'invalid_telemetry'],
    ]
  );
});

// --- BS-5: BullMQ failed and waiting jobs -----------------------------------------------------------------

// [minutes ago, waiting, failed], any order
const series = (rows) =>
  rows.map(([minutes, waiting, failed]) => ({
    at: ago(minutes * MIN),
    waiting,
    failed,
    active: 0,
  }));
const queue = (rows, liveStatus = null) =>
  evaluateQueueHealth({ samples: series(rows), now: NOW, liveStatus });

test('parseQueueSample: a well-formed sample, with active defaulting to zero, or nothing', () => {
  assert.deepEqual(
    parseQueueSample({ at: '2026-11-22T11:00:00Z', waiting: 3, failed: 1 }),
    { at: '2026-11-22T11:00:00.000Z', waiting: 3, failed: 1, active: 0 }
  );
  for (const bad of [
    null,
    'x',
    [],
    { at: 'now', waiting: 1, failed: 0 },
    { at: '2026-11-22T11:00:00Z', waiting: -1, failed: 0 },
    { at: '2026-11-22T11:00:00Z', waiting: 1.5, failed: 0 },
    { at: '2026-11-22T11:00:00Z', waiting: 1 },
    { at: '2026-11-22T11:00:00Z', waiting: 1, failed: 0, active: 'x' },
  ]) {
    assert.equal(parseQueueSample(bad), null);
  }
});

test('the queue section of the snapshot is sorted and keeps only good samples', () => {
  const p = parsed({
    queue: {
      samples: [
        { at: ago(10 * MIN), waiting: 2, failed: 0 },
        { at: ago(30 * MIN), waiting: 1, failed: 0 },
        { at: 'never', waiting: 1, failed: 0 },
      ],
    },
  });
  assert.equal(p.sections.queue.state, 'ok');
  assert.deepEqual(
    p.sections.queue.data.samples.map((s) => s.waiting),
    [1, 2]
  );
  assert.deepEqual(p.issues, ['queue:bad_sample']);
  // an old snapshot is not stale on its own: the newest sample decides
  const old = parseBehaviourInput(
    {
      schema_version: '1.0',
      queue: { samples: [{ at: ago(40 * HOUR), waiting: 1, failed: 0 }] },
    },
    { now: NOW }
  );
  assert.equal(old.sections.queue.state, 'ok');
});

test('BS-5: no sample at all is skipped, offline by choice is skipped, a failed live probe is unavailable', () => {
  const none = (liveStatus) =>
    queue([], liveStatus).checks.map((c) => [c.id, c.status, c.detail]);
  assert.deepEqual(none(null), [
    ['bs5-queue-failed', 'skipped', 'no_telemetry_sample'],
    ['bs5-queue-waiting', 'skipped', 'no_telemetry_sample'],
  ]);
  assert.deepEqual(none('not_configured')[0], [
    'bs5-queue-failed',
    'skipped',
    'no_telemetry_sample',
  ]);
  assert.deepEqual(none('offline')[0], [
    'bs5-queue-failed',
    'skipped',
    'offline',
  ]);
  assert.deepEqual(none('timeout')[1], [
    'bs5-queue-waiting',
    'unavailable',
    'timeout',
  ]);
  // only a fixed code is ever kept
  assert.deepEqual(none('Error: connect ECONNREFUSED 192.0.2.1:443')[0], [
    'bs5-queue-failed',
    'unavailable',
    'probe_error',
  ]);
});

test('BS-5: the newest sample must be fresh; fewer samples or a shorter span than the rule needs are skipped', () => {
  assert.deepEqual(
    queue([[27 * 60, 1, 0]]).checks.map((c) => [c.status, c.detail]),
    [
      ['unavailable', 'stale_telemetry'],
      ['unavailable', 'stale_telemetry'],
    ]
  );
  // one sample cannot show a sustained condition
  assert.deepEqual(
    queue([[1, 9, 9]]).checks.map((c) => [c.status, c.detail]),
    [
      ['skipped', 'insufficient_samples'],
      ['skipped', 'insufficient_samples'],
    ]
  );
  // two samples ten minutes apart are shorter than the 15 minutes of the rule
  assert.deepEqual(
    queue([
      [20, 9, 9],
      [10, 9, 9],
    ]).checks.map((c) => c.status),
    ['skipped', 'skipped']
  );
});

test('BS-5: failed above zero in every sample for 15 minutes or more is a P1', () => {
  const { checks } = queue([
    [30, 0, 1],
    [20, 0, 1],
    [10, 0, 2],
    [0, 0, 2],
  ]);
  assert.deepEqual(brief(checks[0]), [
    'bs5-queue-failed',
    'fail',
    'BS-5',
    'P1',
  ]);
  assert.equal(
    checks[0].observed,
    'failed>0 in 4 samples over 30 min (latest 2)'
  );
  assert.equal(checks[0].assetId, 'railway-gateway');
  assert.equal(checks[1].status, 'pass'); // waiting is flat at zero
  // exactly 15 minutes between two samples is enough
  assert.equal(
    queue([
      [15, 0, 1],
      [0, 0, 1],
    ]).checks[0].status,
    'fail'
  );
});

test('BS-5: failed jobs for less than 15 minutes, or none now, pass', () => {
  const short = queue([
    [60, 0, 0],
    [30, 0, 0],
    [10, 0, 1],
    [0, 0, 1],
  ]).checks[0];
  assert.equal(short.status, 'pass');
  assert.equal(short.observed, 'latest failed=1 (failed>0 for 10 min)');
  const cleared = queue([
    [40, 0, 3],
    [20, 0, 3],
    [0, 0, 0],
  ]).checks[0];
  assert.equal(cleared.status, 'pass');
  assert.equal(cleared.observed, 'latest failed=0');
});

test('BS-5: waiting that never fell and ended higher, for 15 minutes or more, is a P2 (rule BS-5b)', () => {
  const { checks } = queue([
    [40, 5, 0],
    [20, 8, 0],
    [0, 12, 0],
  ]);
  assert.deepEqual(brief(checks[1]), [
    'bs5-queue-waiting',
    'fail',
    'BS-5b',
    'P2',
  ]);
  assert.equal(checks[1].observed, 'waiting 5 -> 12 over 3 samples, 40 min');
  assert.equal(checks[0].status, 'pass');
});

test('BS-5: waiting that is flat, falls, grows briefly or in too few samples passes or waits', () => {
  const wait = (rows) => queue(rows).checks[1];
  assert.equal(
    wait([
      [40, 7, 0],
      [20, 7, 0],
      [0, 7, 0],
    ]).status,
    'pass'
  );
  assert.equal(
    wait([
      [40, 12, 0],
      [20, 8, 0],
      [0, 5, 0],
    ]).status,
    'pass'
  );
  // grew, then dipped: not continuous
  assert.equal(
    wait([
      [40, 5, 0],
      [30, 9, 0],
      [20, 6, 0],
      [0, 8, 0],
    ]).status,
    'pass'
  );
  // growing, but only for the last twelve minutes of a longer series
  const brisk = wait([
    [60, 4, 0],
    [30, 4, 0],
    [12, 4, 0],
    [8, 5, 0],
    [0, 9, 0],
  ]);
  assert.equal(brisk.status, 'pass');
  assert.equal(brisk.observed, 'latest waiting=9');
  // two samples cannot show growth
  assert.deepEqual(
    [
      wait([
        [30, 1, 0],
        [0, 50, 0],
      ]),
    ].map((c) => [c.status, c.detail]),
    [['skipped', 'insufficient_samples']]
  );
});

test('BS-5: waiting that pauses on a plateau but never falls is still one growth', () => {
  const c = queue([
    [40, 5, 0],
    [30, 8, 0],
    [20, 8, 0],
    [0, 12, 0],
  ]).checks[1];
  assert.equal(c.status, 'fail');
  assert.equal(c.observed, 'waiting 5 -> 12 over 4 samples, 40 min');
});

test('BS-5: a flat start is not part of the growth, the run is measured from the last flat sample', () => {
  const c = queue([
    [60, 0, 0],
    [45, 0, 0],
    [30, 0, 0],
    [20, 2, 0],
    [10, 4, 0],
    [0, 6, 0],
  ]).checks[1];
  assert.equal(c.status, 'fail');
  assert.equal(c.observed, 'waiting 0 -> 6 over 4 samples, 30 min');
});

test('BS-5: a live probe that failed does not hide the saved samples, and says so in a note', () => {
  const { checks, notes } = queue(
    [
      [30, 0, 1],
      [0, 0, 1],
    ],
    'timeout'
  );
  assert.equal(checks[0].status, 'fail');
  assert.deepEqual(notes, [
    'queue: the live health probe failed (timeout); judged on the saved samples',
  ]);
});

test('mergeQueueSamples: one series, oldest first, without duplicates, old samples or surplus', () => {
  const s = (minutes, waiting) => ({
    at: ago(minutes * MIN),
    waiting,
    failed: 0,
    active: 0,
  });
  const merged = mergeQueueSamples({
    history: [s(30, 1), s(10, 2), s(25 * 60, 9)],
    snapshot: [s(10, 2), s(20, 5)],
    live: s(0, 7),
    now: NOW,
  });
  assert.deepEqual(
    merged.map((x) => x.waiting),
    [1, 5, 2, 7]
  );
  // no live sample, no snapshot
  assert.equal(mergeQueueSamples({ history: [], now: NOW }).length, 0);
  // the newest 300 are kept
  const many = Array.from({ length: 320 }, (_, i) => s(i / 100, i));
  const capped = mergeQueueSamples({ history: many, now: NOW });
  assert.equal(capped.length, BEHAVIOUR_BASELINE.queue.maxSamples);
  assert.equal(
    capped.at(-1).at,
    many
      .map((x) => x.at)
      .sort()
      .at(-1)
  );
});

// --- BS-6: a push to main that did not come from a merged pull request -----------------------------

const SHA = (n) => String(n).padStart(2, '0').repeat(20); // 40 hex characters
const review = (n, over = {}) => ({
  sha: SHA(n),
  at: ago(n * HOUR),
  parents: 2,
  subject: `Merge pull request #${500 + n} from owner/branch-${n}`,
  pulls: [{ number: 500 + n, merged: true, baseRef: 'main' }],
  ...over,
});
const directPush = (n, over = {}) =>
  review(n, { parents: 1, subject: 'fix: change it', pulls: [], ...over });
const mainCheck = (result, extra = {}) =>
  evaluateMainPushes({ result, ...extra });
const found = (commits, over = {}) => ({
  ok: true,
  commits,
  truncated: false,
  anchorFound: null,
  ...over,
});

test('BS-6: every commit through a merged pull request is one passing check', () => {
  const { checks, facts } = mainCheck(found([review(1), review(2), review(3)]));
  assert.equal(checks.length, 1);
  assert.deepEqual(brief(checks[0]), ['bs6-main-push', 'pass', null, null]);
  assert.equal(checks[0].assetId, 'github-repo');
  assert.equal(checks[0].area, 'main');
  assert.equal(
    checks[0].observed,
    '3 commits since the baseline, all through merged pull requests'
  );
  assert.deepEqual(facts, {
    examined: 3,
    reviewed: 3,
    direct: 0,
    acknowledged: 0,
    undecided: 0,
    truncated: false,
  });
  assert.equal(
    mainCheck(found([])).checks[0].observed,
    'no commits since the baseline'
  );
});

test('BS-6: a commit without a merged pull request is a P1, one check per commit, newest first', () => {
  const { checks, facts } = mainCheck(
    found([directPush(1), review(2), directPush(3)])
  );
  assert.deepEqual(checks.map(brief), [
    [`bs6-main-push-${SHA(1).slice(0, 12)}`, 'fail', 'BS-6', 'P1'],
    [`bs6-main-push-${SHA(3).slice(0, 12)}`, 'fail', 'BS-6', 'P1'],
  ]);
  assert.equal(checks[0].observed, `direct push ${ago(HOUR)} (parents=1)`);
  assert.equal(facts.direct, 2);
  assert.equal(facts.reviewed, 1);
});

test('BS-6: a message that claims a pull request proves nothing without one', () => {
  const { checks } = mainCheck(found([review(1, { pulls: [] })]));
  assert.equal(checks[0].status, 'fail');
  assert.match(checks[0].observed, /message claims a pull request/);
});

test('BS-6: a pull request that was not merged, or merged into another branch, is not a review', () => {
  for (const pulls of [
    [{ number: 7, merged: false, baseRef: 'main' }],
    [{ number: 7, merged: true, baseRef: 'release' }],
    [null, 'x', {}],
  ]) {
    assert.equal(
      mainCheck(found([directPush(1, { pulls })])).checks[0].status,
      'fail'
    );
  }
  // the branch is a parameter
  assert.equal(
    mainCheck(
      found([
        review(1, { pulls: [{ number: 7, merged: true, baseRef: 'trunk' }] }),
      ]),
      { mainBranch: 'trunk' }
    ).checks[0].status,
    'pass'
  );
});

test('BS-6: an acknowledged commit is not a finding, by its full hash or a prefix of seven or more', () => {
  const full = mainCheck(found([directPush(1)]), {
    acknowledged: [SHA(1)],
  });
  assert.deepEqual(brief(full.checks[0]), [
    'bs6-main-push',
    'pass',
    null,
    null,
  ]);
  assert.equal(
    full.checks[0].observed,
    '1 commit since the baseline: 0 through merged pull requests, 1 acknowledged'
  );
  assert.equal(full.facts.acknowledged, 1);
  const prefix = mainCheck(found([directPush(1), directPush(2)]), {
    acknowledged: [SHA(1).slice(0, 7).toUpperCase()],
  });
  assert.deepEqual(
    prefix.checks.map((c) => c.id),
    [`bs6-main-push-${SHA(2).slice(0, 12)}`]
  );
  // six characters are too few to match anything
  assert.equal(
    mainCheck(found([directPush(1)]), { acknowledged: [SHA(1).slice(0, 6)] })
      .checks[0].status,
    'fail'
  );
});

test('BS-6: a commit whose pull requests could not be looked up is unavailable, never a pass', () => {
  const only = mainCheck(found([review(1), review(2, { pulls: null })]));
  assert.deepEqual(
    only.checks.map((c) => [c.id, c.status, c.detail]),
    [['bs6-main-push-lookup', 'unavailable', 'pr_lookup_failed']]
  );
  const both = mainCheck(found([directPush(1), review(2, { pulls: null })]));
  assert.deepEqual(
    both.checks.map((c) => c.status),
    ['fail', 'unavailable']
  );
});

test('BS-6: a baseline commit that is not on the first-parent line is unavailable', () => {
  const { checks } = mainCheck(found([review(1)], { anchorFound: false }));
  assert.deepEqual(
    checks.map((c) => [c.id, c.status, c.detail]),
    [['bs6-main-push-baseline', 'unavailable', 'baseline_not_found']]
  );
});

test('BS-6: offline is skipped, a failed probe is unavailable with a fixed code, a long walk is noted', () => {
  assert.deepEqual(
    mainCheck({ ok: false, skipped: true, error: 'offline' }).checks.map(
      (c) => [c.status, c.detail]
    ),
    [['skipped', 'offline']]
  );
  assert.deepEqual(
    mainCheck({ ok: false, error: 'http_403' }).checks.map((c) => [
      c.status,
      c.detail,
    ]),
    [['unavailable', 'http_403']]
  );
  assert.equal(
    mainCheck({ ok: false, error: 'a message with spaces' }).checks[0].detail,
    'probe_error'
  );
  assert.equal(mainCheck(undefined).checks[0].detail, 'probe_error');
  const long = mainCheck(found([review(1)], { truncated: true }));
  assert.equal(long.checks[0].status, 'pass');
  assert.deepEqual(long.notes, [
    `main: only the newest ${BEHAVIOUR_BASELINE.mainPush.maxCommits} commits of the first-parent line were examined`,
  ]);
});

// --- the owner's settings and the baseline ------------------------------------------------------------------

test('parseBehaviourSettings: no file is the default, a good file is normalised', () => {
  const none = parseBehaviourSettings(null);
  assert.deepEqual(
    {
      present: none.present,
      issues: none.issues,
      mainPush: none.mainPush,
      queueHealthUrl: none.queueHealthUrl,
    },
    {
      present: false,
      issues: [],
      mainPush: { baselineAt: null, baselineSha: null, acknowledged: [] },
      queueHealthUrl: null,
    }
  );
  const good = parseBehaviourSettings({
    schema_version: '1.0',
    main_push: {
      baseline_at: '2026-11-20T16:00:00Z',
      baseline_sha: 'ABCDEF1234567',
      acknowledged_shas: [
        '0123456789ABCDEF',
        'fedcba9876543210fedcba9876543210fedcba98',
      ],
    },
    queue: { health_url: 'https://gateway.example.test/api/v1/health' },
  });
  assert.equal(good.present, true);
  assert.deepEqual(good.issues, []);
  assert.deepEqual(good.mainPush, {
    baselineAt: '2026-11-20T16:00:00.000Z',
    baselineSha: 'abcdef1234567',
    acknowledged: [
      '0123456789abcdef',
      'fedcba9876543210fedcba9876543210fedcba98',
    ],
  });
  assert.equal(
    good.queueHealthUrl,
    'https://gateway.example.test/api/v1/health'
  );
});

test('parseBehaviourSettings: a bad value is dropped with a fixed code; only an https URL without credentials is kept', () => {
  const p = parseBehaviourSettings({
    main_push: {
      baseline_at: 'last week',
      baseline_sha: 'xyz',
      acknowledged_shas: ['abc', 'not hex at all', 42, '0123456789abcdef'],
    },
    queue: { health_url: 'http://gateway.example.test/health' },
  });
  assert.deepEqual(p.mainPush, {
    baselineAt: null,
    baselineSha: null,
    acknowledged: ['0123456789abcdef'],
  });
  assert.equal(p.queueHealthUrl, null);
  assert.deepEqual(p.issues, [
    'main_push:bad_baseline_at',
    'main_push:bad_baseline_sha',
    'main_push:bad_acknowledged_sha',
    'queue:bad_health_url',
  ]);
  for (const url of [
    withCredentials('https://gateway.example.test/health'),
    'ftp://gateway.example.test/health',
    'gateway.example.test/health',
    'https://',
    42,
    `https://gateway.example.test/${'a'.repeat(400)}`,
  ]) {
    assert.equal(
      parseBehaviourSettings({ queue: { health_url: url } }).queueHealthUrl,
      null,
      String(url).slice(0, 40)
    );
  }
  for (const raw of ['x', 1, [], true]) {
    assert.deepEqual(parseBehaviourSettings(raw).issues, [
      'file:not_an_object',
    ]);
  }
});

test('resolveMainBaseline: a recorded time, else seven days back, never older than thirty', () => {
  const settings = (mainPush) => ({
    mainPush: {
      baselineAt: null,
      baselineSha: null,
      acknowledged: [],
      ...mainPush,
    },
  });
  assert.deepEqual(resolveMainBaseline({ settings: settings({}), now: NOW }), {
    source: 'default',
    at: ago(7 * 24 * HOUR),
    sha: null,
  });
  assert.deepEqual(
    resolveMainBaseline({
      settings: settings({ baselineAt: ago(2 * 24 * HOUR) }),
      now: NOW,
    }),
    { source: 'recorded', at: ago(2 * 24 * HOUR), sha: null }
  );
  // older than 30 days is cut to 30 days; a time in the future is cut to now
  assert.equal(
    resolveMainBaseline({
      settings: settings({ baselineAt: ago(90 * 24 * HOUR) }),
      now: NOW,
    }).at,
    ago(30 * 24 * HOUR)
  );
  assert.equal(
    resolveMainBaseline({
      settings: settings({ baselineAt: iso(NOW.getTime() + DAY) }),
      now: NOW,
    }).at,
    NOW.toISOString()
  );
  // a commit anchor wins over the time
  assert.deepEqual(
    resolveMainBaseline({
      settings: settings({ baselineAt: ago(DAY), baselineSha: 'abcdef1' }),
      now: NOW,
    }),
    { source: 'anchor', at: ago(DAY), sha: 'abcdef1' }
  );
});

// --- findings ------------------------------------------------------------------------------------------------------

const INVENTORY_TEXT = `
schema_version: '3.0'
updated_at: '2026-11-22'
toolchain_pins:
  node_runtime_floors:
    v24_min_patch: '24.22.3'
    v22_min_patch: '22.23.5'
expected_public_endpoints:
  - 'www.example.test'
assets:
  - id: money-service
    lifecycle: production
    exposure_tier: 1
    escalation_required: true
    ecosystems:
      - type: npm
  - id: monolith-web
    lifecycle: production
    exposure_tier: 1
    ecosystems:
      - type: npm
  - id: railway-gateway
    lifecycle: production
    exposure_tier: 2
    ecosystems:
      - type: npm
  - id: chat-server
    lifecycle: paused
    exposure_tier: 1
    ecosystems:
      - type: docker
`;
const inventory = loadInventory(INVENTORY_TEXT);

// a snapshot in which every signal is within its threshold
const healthySnapshot = () =>
  snapshot({
    webhooks: {
      window_minutes: 60,
      routes: [route(), route({ id: 'money-dlocal' })],
    },
    auth: auth(),
    http: { window_minutes: 15, requests: 1000, status_5xx: 5, status_429: 10 },
    llm: {
      asset: 'chat-server',
      today: { date: '2026-11-22', spend_usd: 3, requests: 80 },
      daily: days(7, 2, 50),
    },
  });
// a snapshot, a queue and a main that breach every signal
const breachedSnapshot = () =>
  snapshot({
    webhooks: { window_minutes: 60, routes: [route({ status_5xx: 2 })] },
    auth: auth({ ip_buckets: [{ bucket: 'a1b2c3d4', failures: 25 }] }),
    http: {
      window_minutes: 15,
      requests: 1000,
      status_5xx: 30,
      status_429: 70,
    },
    llm: {
      asset: 'chat-server',
      today: { date: '2026-11-22', spend_usd: 9, requests: 200 },
      daily: days(7, 2, 50),
    },
  });
const liveSample = (waiting = 0, failed = 0) => ({
  ok: true,
  sample: { at: NOW.toISOString(), waiting, failed, active: 0 },
});
function fakeProbes(over = {}) {
  const calls = { mainPush: [], queue: 0 };
  return {
    calls,
    probes: {
      mainPush: async (args) => {
        calls.mainPush.push(args);
        return over.mainPush ?? found([review(1), review(2)]);
      },
      queue: async () => {
        calls.queue += 1;
        return over.queue ?? liveSample();
      },
    },
  };
}
const sweep = (over = {}) =>
  runBehaviourSignals({
    inventory,
    now: NOW,
    probes: fakeProbes().probes,
    ...over,
  });

test('makeBehaviourFinding: a failed check becomes a scored finding in the shape the engine uses', () => {
  const breach = evaluateWebhooks(webhooks([route({ status_5xx: 2 })]))
    .checks[0];
  const f = makeBehaviourFinding(breach, { inventory });
  assert.equal(f.source, 'behaviour-signals');
  assert.equal(f.kind, 'webhook-anomaly');
  assert.equal(f.ecosystem, 'behaviour');
  assert.equal(f.assetId, 'money-service');
  assert.equal(f.priority, 'P1');
  assert.equal(f.rule, 'BS-1');
  assert.match(f.sla, /72 h/);
  assert.equal(f.severity, 'high');
  assert.equal(f.exposureTier, 1);
  assert.equal(f.lifecycle, 'production');
  assert.equal(f.rule5Boundary, true);
  assert.equal(f.escalation, true);
  assert.equal(f.vexActive, false);
  assert.deepEqual(f.advisoryIds, []);
  assert.equal(f.primaryId, 'BEHAVIOUR-BS1-WEBHOOK-MONEY-STRIPE');
  assert.match(f.key, /^[0-9a-f]{16}$/);
  assert.equal(f.version, breach.observed);
  // the same check, the same key: a breach that goes on is not a new alert
  assert.equal(makeBehaviourFinding(breach, { inventory }).key, f.key);
  const other = evaluateWebhooks(
    webhooks([route({ id: 'money-dlocal', status_5xx: 2 })])
  ).checks[0];
  assert.notEqual(makeBehaviourFinding(other, { inventory }).key, f.key);
});

test('makeBehaviourFinding: the rule decides the priority, the Rule 5 flag and the kind', () => {
  const ratio = evaluateHttpRates(httpOf({ status_429: 200 })).checks[1];
  const f = makeBehaviourFinding(ratio, { inventory });
  assert.deepEqual(
    [f.priority, f.rule, f.severity, f.kind, f.rule5Boundary, f.escalation],
    ['P2', 'BS-3b', 'moderate', 'error-rate', false, false]
  );
  // a pseudo asset that is not in the inventory still gets a finding
  const push = evaluateMainPushes({ result: found([directPush(1)]) }).checks[0];
  const g = makeBehaviourFinding(push, { inventory });
  assert.deepEqual(
    [g.assetId, g.kind, g.lifecycle, g.exposureTier, g.escalation],
    ['github-repo', 'main-push', 'production', null, false]
  );
  assert.equal(BEHAVIOUR_RULES['BS-6'].playbook, 'PB-5');
  assert.equal(BEHAVIOUR_RULES['BS-1'].playbook, 'PB-4');
  assert.equal(BEHAVIOUR_RULES['BS-2'].rule5, true);
});

test('mergeBehaviourFindings: adds what is new, keeps one per key, sorted like the engine', () => {
  const a = makeBehaviourFinding(
    evaluateWebhooks(webhooks([route({ status_5xx: 2 })])).checks[0],
    { inventory }
  );
  const b = makeBehaviourFinding(
    evaluateHttpRates(httpOf({ status_429: 200 })).checks[1],
    { inventory }
  );
  const merged = mergeBehaviourFindings([b], [a, { ...a }, b]);
  assert.deepEqual(
    merged.map((f) => f.rule),
    ['BS-1', 'BS-3b']
  );
  assert.deepEqual([...merged].sort(compareFindings), merged);
});

// --- the sweep ---------------------------------------------------------------------------------------------------------

test('a sweep with no telemetry and no network judges nothing and is not degraded', async () => {
  const result = await sweep({ offline: true });
  assert.equal(result.schema_version, '1.0');
  assert.equal(result.generated_at, NOW.toISOString());
  assert.deepEqual(result.run, {
    offline: true,
    degraded: false,
    repo: 'ripper7375/trading-alerts-saas-public',
    main_branch: 'main',
  });
  assert.deepEqual(result.summary.checks, {
    total: 10,
    pass: 0,
    fail: 0,
    unavailable: 0,
    skipped: 10,
  });
  assert.deepEqual(result.summary.tiers, { P0: 0, P1: 0, P2: 0, P3: 0 });
  assert.equal(result.summary.findings, 0);
  assert.deepEqual(
    result.summary.signals,
    Object.fromEntries(AREAS.map((area) => [area, 'skipped']))
  );
  assert.deepEqual(result.findings, []);
  assert.equal(result.telemetry.snapshot_present, false);
});

test('a healthy sweep passes every signal', async () => {
  const fake = fakeProbes();
  const result = await sweep({
    input: healthySnapshot(),
    queueHistory: series([
      [40, 0, 0],
      [20, 0, 0],
      [10, 0, 0],
    ]),
    probes: fake.probes,
  });
  assert.deepEqual(result.summary.checks, {
    total: 11,
    pass: 11,
    fail: 0,
    unavailable: 0,
    skipped: 0,
  });
  assert.deepEqual(
    result.summary.signals,
    Object.fromEntries(AREAS.map((area) => [area, 'ok']))
  );
  assert.equal(result.run.degraded, false);
  assert.deepEqual(result.findings, []);
  assert.deepEqual(
    result.checks.map((c) => c.signal),
    [
      'BS-1',
      'BS-1',
      'BS-2',
      'BS-2',
      'BS-3',
      'BS-3',
      'BS-4',
      'BS-4',
      'BS-5',
      'BS-5',
      'BS-6',
    ]
  );
  // the probe of main is asked for the baseline and the limits, the queue probe once
  assert.equal(fake.calls.queue, 1);
  assert.deepEqual(fake.calls.mainPush, [
    {
      baseline: { source: 'default', at: ago(7 * DAY), sha: null },
      mainBranch: 'main',
      maxCommits: BEHAVIOUR_BASELINE.mainPush.maxCommits,
    },
  ]);
});

test('a sweep that breaches every signal turns the failures into findings, worst first', async () => {
  const result = await sweep({
    input: breachedSnapshot(),
    queueHistory: series([
      [40, 5, 1],
      [20, 8, 1],
      [10, 10, 2],
    ]),
    probes: fakeProbes({
      queue: liveSample(14, 2),
      mainPush: found([directPush(1), review(2)]),
    }).probes,
  });
  assert.deepEqual(result.summary.checks, {
    total: 10,
    pass: 1,
    fail: 9,
    unavailable: 0,
    skipped: 0,
  });
  assert.deepEqual(result.summary.tiers, { P0: 0, P1: 7, P2: 2, P3: 0 });
  assert.equal(result.summary.findings, 9);
  assert.deepEqual(
    result.summary.signals,
    Object.fromEntries(AREAS.map((area) => [area, 'fail']))
  );
  assert.deepEqual(
    result.findings.map((f) => f.priority),
    ['P1', 'P1', 'P1', 'P1', 'P1', 'P1', 'P1', 'P2', 'P2']
  );
  assert.deepEqual([...new Set(result.findings.map((f) => f.rule))].sort(), [
    'BS-1',
    'BS-2',
    'BS-3',
    'BS-3b',
    'BS-4',
    'BS-5',
    'BS-5b',
    'BS-6',
  ]);
  // the two Rule 5 signals are counted as escalations
  assert.equal(summarizeFindings(result.findings).escalations, 2);
  assert.equal(result.run.degraded, false);
});

test('offline asks no probe and says so; the live probes are skipped, not failed', async () => {
  const fake = fakeProbes();
  const result = await sweep({
    input: healthySnapshot(),
    probes: fake.probes,
    offline: true,
  });
  assert.equal(fake.calls.queue, 0);
  assert.equal(fake.calls.mainPush.length, 0);
  const last = result.checks.at(-1);
  assert.deepEqual(
    [last.id, last.status, last.detail],
    ['bs6-main-push', 'skipped', 'offline']
  );
  assert.equal(result.queue.live, 'offline');
  assert.equal(result.run.degraded, false);
  // the telemetry of the snapshot is still judged
  assert.equal(result.summary.signals.webhooks, 'ok');
});

test('a probe that throws or fails leaves a fixed code and degrades the sweep', async () => {
  const result = await sweep({
    input: healthySnapshot(),
    probes: {
      mainPush: async () => {
        throw new Error('connect ECONNREFUSED 192.0.2.1:443 token=abc123');
      },
      queue: async () => ({ ok: false, error: 'http_503' }),
    },
  });
  const main = result.checks.find((c) => c.area === 'main');
  assert.deepEqual([main.status, main.detail], ['unavailable', 'probe_error']);
  assert.equal(result.queue.live, 'http_503');
  assert.deepEqual(
    result.checks.filter((c) => c.area === 'queue').map((c) => c.detail),
    ['http_503', 'http_503']
  );
  assert.equal(result.run.degraded, true);
  assert.equal(JSON.stringify(result).includes('ECONNREFUSED'), false);
  assert.equal(JSON.stringify(result).includes('abc123'), false);

  // no probes at all: the live signals are unavailable, the snapshot still counts
  const bare = await sweep({ input: healthySnapshot(), probes: null });
  assert.equal(bare.checks.find((c) => c.area === 'main').detail, 'no_probes');
  assert.equal(bare.queue.live, 'not_configured');
  assert.equal(bare.checks.find((c) => c.area === 'queue').status, 'skipped');
});

test('a signal with a failed check and an unresolved one is fail, and the sweep is degraded', async () => {
  const result = await sweep({
    probes: fakeProbes({
      mainPush: found([directPush(1), review(2, { pulls: null })]),
    }).probes,
  });
  assert.equal(result.summary.signals.main, 'fail');
  assert.equal(result.run.degraded, true);
  assert.deepEqual(
    result.checks.filter((c) => c.area === 'main').map((c) => c.status),
    ['fail', 'unavailable']
  );
});

test('the live queue sample joins the saved samples and is returned for saving', async () => {
  const result = await sweep({
    queueHistory: series([
      [40, 0, 1],
      [25, 0, 1],
      [10, 0, 1],
    ]),
    probes: fakeProbes({ queue: liveSample(0, 2) }).probes,
  });
  assert.equal(result.queue.live, 'ok');
  assert.equal(result.queue.sample_count, 4);
  assert.equal(result.queue.span_minutes, 40);
  assert.equal(result.queue.samples.length, 4);
  assert.equal(result.queue.samples.at(-1).failed, 2);
  const failed = result.checks.find((c) => c.id === 'bs5-queue-failed');
  assert.equal(failed.status, 'fail');
  assert.equal(failed.observed, 'failed>0 in 4 samples over 40 min (latest 2)');
});

test('samples in the snapshot and in the history are one series', async () => {
  const input = snapshot({
    queue: {
      samples: [
        { at: ago(40 * MIN), waiting: 3, failed: 0 },
        { at: ago(20 * MIN), waiting: 6, failed: 0 },
      ],
    },
  });
  const result = await sweep({
    input,
    queueHistory: series([[10, 9, 0]]),
    probes: fakeProbes({ queue: liveSample(12, 0) }).probes,
  });
  assert.equal(result.queue.sample_count, 4);
  assert.equal(
    result.checks.find((c) => c.id === 'bs5-queue-waiting').status,
    'fail'
  );
  // a queue section that cannot be read is unavailable when nothing else supplies samples
  const bad = await sweep({
    input: snapshot({ queue: { samples: 'many' } }),
    probes: { mainPush: fakeProbes().probes.mainPush },
  });
  assert.deepEqual(
    bad.checks
      .filter((c) => c.area === 'queue')
      .map((c) => [c.status, c.detail]),
    [
      ['unavailable', 'invalid_telemetry'],
      ['unavailable', 'invalid_telemetry'],
    ]
  );
});

test('the settings feed the baseline and the acknowledged commits, and the result reports them', async () => {
  const fake = fakeProbes({ mainPush: found([directPush(1), review(2)]) });
  const result = await sweep({
    settings: {
      schema_version: '1.0',
      main_push: {
        baseline_at: ago(2 * DAY),
        acknowledged_shas: [SHA(1).slice(0, 8)],
      },
    },
    probes: fake.probes,
  });
  assert.deepEqual(fake.calls.mainPush[0].baseline, {
    source: 'recorded',
    at: ago(2 * DAY),
    sha: null,
  });
  assert.equal(result.checks.at(-1).status, 'pass');
  assert.deepEqual(result.main.baseline, {
    source: 'recorded',
    at: ago(2 * DAY),
    sha: null,
  });
  assert.deepEqual(result.main.commits, {
    examined: 2,
    reviewed: 1,
    direct: 0,
    acknowledged: 1,
    undecided: 0,
    truncated: false,
  });
  assert.equal(result.telemetry.settings_present, true);
  // the gateway address is only ever read by the caller that builds the probe
  assert.equal(JSON.stringify(result).includes('https://'), false);
});

test('unreadable or odd files become fixed notes, never a crash', async () => {
  const result = await sweep({
    input: snapshot({
      webhooks: { routes: [route(), route({ id: 'Bad Id' })] },
    }),
    settings: { main_push: { baseline_at: 'last week' } },
    offline: true,
  });
  assert.deepEqual(result.notes, [
    'behaviour-input.json: 1 problem ignored (webhooks:bad_route)',
    'behaviour-settings.json: 1 problem ignored (main_push:bad_baseline_at)',
  ]);
  const garbage = await sweep({ input: 'x', settings: 5, offline: true });
  assert.deepEqual(garbage.notes, [
    'behaviour-input.json is not a JSON object and was ignored',
    'behaviour-settings.json is not a JSON object and was ignored',
  ]);
  assert.equal(garbage.telemetry.snapshot_present, true);
});

test('the telemetry summary names each section and its state, with no content', async () => {
  const result = await sweep({
    input: snapshot({
      webhooks: { collected_at: ago(30 * HOUR), routes: [route()] },
      auth: auth(),
      http: { requests: 'many' },
    }),
    offline: true,
  });
  assert.deepEqual(result.telemetry.sections, {
    webhooks: { state: 'stale', collected_at: ago(30 * HOUR), age_hours: 30 },
    auth: { state: 'ok', collected_at: ago(5 * MIN), age_hours: 0.1 },
    http: { state: 'invalid', code: 'bad_data' },
    llm: { state: 'absent' },
    queue: { state: 'absent' },
  });
  assert.equal(result.run.degraded, true); // a stale and an unreadable section
});

// --- the console summary and the private reports ---------------------------------------------------------

const BREACHED_RUN = () =>
  sweep({
    input: breachedSnapshot(),
    queueHistory: series([
      [40, 5, 1],
      [20, 8, 1],
      [10, 10, 2],
    ]),
    probes: fakeProbes({
      queue: liveSample(14, 2),
      mainPush: found([directPush(1), review(2)]),
    }).probes,
  });

test('renderBehaviourStdout: counts and fixed words only, nothing that names a route, bucket or commit', async () => {
  const result = await BREACHED_RUN();
  const lines = renderBehaviourStdout(result);
  assert.deepEqual(lines, [
    'DavinTrade behaviour signals (counts only)',
    'behaviour_run: 2026-11-22T12:00:00.000Z mode=online',
    'behaviour_checks: total=10 pass=1 fail=9 unavailable=0 skipped=0',
    'behaviour_findings: P0=0 P1=7 P2=2 P3=0 total=9',
    'behaviour_signals: webhooks=fail auth=fail http=fail llm=fail queue=fail main=fail',
    'behaviour_telemetry: snapshot=present sections=4/5 stale=0 invalid=0',
  ]);
  for (const line of lines)
    assert.deepEqual(findPrivacyViolations(line), [], line);
  const text = lines.join('\n');
  for (const secret of ['money-stripe', 'a1b2c3d4', SHA(1).slice(0, 12)]) {
    assert.equal(text.includes(secret), false, secret);
  }
  assert.deepEqual(
    renderBehaviourStdout(result, { heading: false }),
    lines.slice(1)
  );
});

test('renderBehaviourStdout: an offline sweep with no file says so in words and counts', async () => {
  const lines = renderBehaviourStdout(await sweep({ offline: true }));
  assert.deepEqual(lines.slice(1), [
    'behaviour_run: 2026-11-22T12:00:00.000Z mode=offline',
    'behaviour_checks: total=10 pass=0 fail=0 unavailable=0 skipped=10',
    'behaviour_findings: P0=0 P1=0 P2=0 P3=0 total=0',
    'behaviour_signals: webhooks=skipped auth=skipped http=skipped llm=skipped queue=skipped main=skipped',
    'behaviour_telemetry: snapshot=absent sections=0/5 stale=0 invalid=0',
  ]);
  const degraded = renderBehaviourStdout(
    await sweep({ input: healthySnapshot(), probes: null })
  );
  assert.match(degraded[1], /mode=online degraded=yes$/);
});

test('the private report names the route, the bucket and the commit, with the playbook of each failure', async () => {
  const result = await BREACHED_RUN();
  const md = renderBehaviourMarkdown(result);
  assert.match(md, /^# DavinTrade behaviour signals \(private\)/);
  assert.match(
    md,
    /never commit it, paste it into an issue or attach it to a public log/
  );
  assert.match(md, /## Behaviour signals/);
  for (const text of [
    'bs1-webhook-money-stripe',
    'bs2-auth-ip-a1b2c3d4',
    `bs6-main-push-${SHA(1).slice(0, 12)}`,
    'PB-4',
    'PB-5',
    'Baseline for main: default',
  ]) {
    assert.ok(md.includes(text), text);
  }
  assert.match(
    md,
    /\| Signal \| Check \| Asset \| Status \| Priority \| Rule \| Response \|/
  );
  assert.equal(md.split('\n').at(-1), '');
  // the same lines are the section that joins the main posture report
  assert.deepEqual(renderBehaviourSection(result).slice(0, 2), [
    '## Behaviour signals',
    '',
  ]);
});

test('the report escapes a table cell, so a value cannot break out of it', async () => {
  const result = await sweep({ offline: true, input: healthySnapshot() });
  result.checks[0].observed = 'a|b <script> \\';
  const md = renderBehaviourMarkdown(result);
  assert.ok(md.includes('a\\|b &lt;script&gt; \\\\'));
});

// --- arguments ---------------------------------------------------------------------------------------------------------

test('parseBehaviourArgs: defaults, flags and values', () => {
  assert.deepEqual(parseBehaviourArgs([]), {
    offline: false,
    help: false,
    repo: 'ripper7375/trading-alerts-saas-public',
    root: null,
    pipelineDir: null,
    secretsFile: null,
  });
  assert.deepEqual(
    parseBehaviourArgs([
      '--offline',
      '--repo',
      'a/b',
      '--root=/r',
      '--pipeline-dir',
      '/p',
      '--secrets-file',
      '/s',
    ]),
    {
      offline: true,
      help: false,
      repo: 'a/b',
      root: '/r',
      pipelineDir: '/p',
      secretsFile: '/s',
    }
  );
  assert.equal(parseBehaviourArgs(['-h']).help, true);
  assert.match(BEHAVIOUR_USAGE, /run-behaviour-signals\.mjs/);
  assert.match(
    BEHAVIOUR_USAGE,
    /Exit codes: 0 done, 1 unexpected failure, 2 usage or setup error/
  );
});

test('parseBehaviourArgs: anything else is a usage error', () => {
  for (const argv of [
    ['--nope'],
    ['--offline=1'],
    ['--repo'],
    ['--repo', 'not a repo'],
    ['--root='],
    ['positional'],
  ]) {
    assert.throws(
      () => parseBehaviourArgs(argv),
      BehaviourUsageError,
      argv.join(' ')
    );
  }
});

// --- the standalone command ------------------------------------------------------------------------------------------

const PIPELINE_DIR = '/repo/davintrade-security-monitoring-pipeline';
const REPORTS = `${PIPELINE_DIR}/reports`;
const SECRET_TOKEN = 'fake-github-token-for-tests-only-0123456789';
const GATEWAY_URL = 'https://gateway.example.test/api/v1/health';
const norm = (path) => String(path).replaceAll('\\', '/');

function memoryFs(initial) {
  const files = new Map(Object.entries(initial));
  return {
    files,
    readText: (p) => files.get(norm(p)) ?? null,
    writeText: (p, t) => void files.set(norm(p), t),
    mkdirp: () => {},
  };
}

function cliHarness({
  files = {},
  probes = null,
  credential = null,
  createProbes = null,
} = {}) {
  const fs = memoryFs({
    '/repo/security/security-inventory.yaml': INVENTORY_TEXT,
    ...files,
  });
  const clock = { t: NOW.getTime() };
  const logs = [];
  const created = [];
  const credentialCalls = [];
  const deps = {
    root: '/repo',
    fs,
    createProbes:
      createProbes ??
      ((args) => {
        created.push(args);
        return probes ?? fakeProbes().probes;
      }),
    now: () => new Date(clock.t),
    log: (line) => logs.push(line),
    credentialFill: () => {
      credentialCalls.push(1);
      return credential;
    },
  };
  return {
    fs,
    clock,
    logs,
    created,
    credentialCalls,
    deps,
    run: (argv = [], env = {}) => runBehaviourCli({ argv, env, deps }),
    stdout: () => logs.join('\n'),
    report: (name) => fs.files.get(`${REPORTS}/${name}`),
    json: (name) => JSON.parse(fs.files.get(`${REPORTS}/${name}`)),
  };
}

test('--help prints the usage and a bad argument exits 2 without creating a probe', async () => {
  const help = cliHarness();
  assert.equal(await help.run(['--help']), 0);
  assert.match(
    help.stdout(),
    /Usage: node scripts\/security\/run-behaviour-signals\.mjs/
  );
  const bad = cliHarness();
  assert.equal(await bad.run(['--bogus']), 2);
  assert.match(bad.stdout(), /error=usage/);
  assert.equal(bad.created.length, 0);
});

test('a standalone sweep writes both private reports and prints counts only', async () => {
  const h = cliHarness({
    files: {
      [`${REPORTS}/behaviour-input.json`]: JSON.stringify(breachedSnapshot()),
      [`${PIPELINE_DIR}/behaviour-settings.json`]: JSON.stringify({
        queue: { health_url: GATEWAY_URL },
      }),
    },
    probes: fakeProbes({ mainPush: found([directPush(1), review(2)]) }).probes,
  });
  assert.equal(await h.run([], { DEPENDABOT_TRIAGE_TOKEN: SECRET_TOKEN }), 0);

  const report = h.json('latest-behaviour-signals.json');
  assert.equal(report.schema_version, '1.0');
  assert.equal(report.summary.checks.fail, 7); // the queue has one sample: BS-5 waits
  assert.ok(
    report.checks.some((c) => c.id === 'bs1-webhook-money-stripe'),
    'the private report names the route'
  );
  assert.match(
    h.report('latest-behaviour-signals.md'),
    /^# DavinTrade behaviour signals \(private\)/
  );

  const out = h.stdout();
  for (const line of h.logs) {
    assert.deepEqual(findPrivacyViolations(line), [], line);
    assert.equal(line.includes('privacy guard'), false, line);
  }
  assert.match(out, /DavinTrade behaviour signals \(counts only\)/);
  assert.match(out, /behaviour_checks: total=\d+ pass=\d+ fail=7/);
  assert.match(out, /reports: latest-behaviour-signals\.json and \.md written/);
  // no route, bucket, commit, address or token on stdout, or in any file the sweep wrote
  const written = [
    out,
    h.report('latest-behaviour-signals.json'),
    h.report('latest-behaviour-signals.md'),
    h.report('behaviour-queue-samples.json'),
  ].join('\n');
  for (const sentinel of ['gateway.example.test', SECRET_TOKEN]) {
    assert.equal(written.includes(sentinel), false, sentinel);
  }
  for (const sentinel of ['money-stripe', 'a1b2c3d4', SHA(1).slice(0, 12)]) {
    assert.equal(out.includes(sentinel), false, sentinel);
  }
});

test('the command hands the probes the token, the repository and the gateway address from the settings', async () => {
  const h = cliHarness({
    files: {
      [`${PIPELINE_DIR}/behaviour-settings.json`]: JSON.stringify({
        queue: { health_url: GATEWAY_URL },
      }),
    },
  });
  await h.run(['--repo', 'owner/name'], {
    DEPENDABOT_TRIAGE_TOKEN: SECRET_TOKEN,
  });
  assert.deepEqual(h.created, [
    { token: SECRET_TOKEN, repo: 'owner/name', gatewayHealthUrl: GATEWAY_URL },
  ]);
  assert.equal(
    h.credentialCalls.length,
    0,
    'the env token wins; Git is not asked'
  );
  // without a health address the probe gets none
  const bare = cliHarness();
  await bare.run([], { DEPENDABOT_TRIAGE_TOKEN: SECRET_TOKEN });
  assert.equal(bare.created[0].gatewayHealthUrl, null);
});

test('without a token in the environment the command asks Git once; offline it asks nobody', async () => {
  const online = cliHarness({
    credential: `protocol=https\nhost=github.com\nusername=x\npassword=${SECRET_TOKEN}\n`,
  });
  await online.run();
  assert.equal(online.credentialCalls.length, 1);
  assert.equal(online.created[0].token, SECRET_TOKEN);
  const offline = cliHarness({ credential: 'password=x\n' });
  assert.equal(await offline.run(['--offline']), 0);
  assert.equal(offline.credentialCalls.length, 0);
  assert.equal(offline.created[0].token, null);
  assert.match(offline.stdout(), /mode=offline/);
});

test('a missing inventory is a setup error with a fixed code', async () => {
  const h = cliHarness();
  h.fs.files.delete('/repo/security/security-inventory.yaml');
  assert.equal(await h.run(), 2);
  assert.equal(h.stdout(), 'error=inventory_not_found');
});

test('files that are not valid JSON are ignored with a note, and the sweep still runs', async () => {
  const h = cliHarness({
    files: {
      [`${REPORTS}/behaviour-input.json`]: '{ not json',
      [`${PIPELINE_DIR}/behaviour-settings.json`]: '[1,',
      [`${REPORTS}/behaviour-queue-samples.json`]: 'oops',
    },
  });
  assert.equal(await h.run([], { DEPENDABOT_TRIAGE_TOKEN: SECRET_TOKEN }), 0);
  assert.deepEqual(h.json('latest-behaviour-signals.json').notes.slice(0, 3), [
    'behaviour-settings.json is not valid JSON and was ignored',
    'behaviour-input.json is not valid JSON and was ignored',
    'behaviour-queue-samples.json was unreadable and was ignored',
  ]);
  // nothing usable was read, so the report says there is no snapshot
  assert.equal(
    h.json('latest-behaviour-signals.json').telemetry.snapshot_present,
    false
  );
});

test('a probe factory that throws leaves the live signals unavailable, not the sweep dead', async () => {
  const h = cliHarness({
    createProbes: () => {
      throw new Error('boom 192.0.2.1:443');
    },
  });
  assert.equal(await h.run([], { DEPENDABOT_TRIAGE_TOKEN: SECRET_TOKEN }), 0);
  const report = h.json('latest-behaviour-signals.json');
  assert.equal(report.run.degraded, true);
  assert.equal(
    report.checks.find((c) => c.area === 'main').detail,
    'no_probes'
  );
  assert.equal(JSON.stringify([h.stdout(), report]).includes('boom'), false);
});

test('a report that cannot be written is a fixed error and exit 1', async () => {
  const h = cliHarness();
  h.deps.fs.writeText = () => {
    throw new Error('disk full at /secret/path');
  };
  assert.equal(await h.run([], { DEPENDABOT_TRIAGE_TOKEN: SECRET_TOKEN }), 1);
  assert.match(h.stdout(), /error=report_write_failed/);
  assert.equal(h.stdout().includes('secret'), false);
});

test('queue samples saved by one run are the series of the next, so a sustained failure is seen across runs', async () => {
  const settings = {
    [`${PIPELINE_DIR}/behaviour-settings.json`]: JSON.stringify({
      queue: { health_url: GATEWAY_URL },
    }),
  };
  const h = cliHarness({
    files: settings,
    probes: fakeProbes({ queue: liveSample(0, 3) }).probes,
  });
  const env = { DEPENDABOT_TRIAGE_TOKEN: SECRET_TOKEN };
  // the first run has one sample: nothing can be sustained yet
  assert.equal(await h.run([], env), 0);
  let report = h.json('latest-behaviour-signals.json');
  assert.equal(report.queue.sample_count, 1);
  assert.equal(
    report.checks.find((c) => c.id === 'bs5-queue-failed').detail,
    'insufficient_samples'
  );
  const saved = JSON.parse(h.report('behaviour-queue-samples.json'));
  assert.equal(saved.schema_version, '1.0');
  assert.equal(saved.samples.length, 1);

  // twenty minutes later the same condition has lasted longer than 15 minutes
  h.clock.t += 20 * MIN;
  h.deps.createProbes = () => ({
    mainPush: fakeProbes().probes.mainPush,
    queue: async () => ({
      ok: true,
      sample: {
        at: new Date(h.clock.t).toISOString(),
        waiting: 0,
        failed: 3,
        active: 0,
      },
    }),
  });
  assert.equal(await h.run([], env), 0);
  report = h.json('latest-behaviour-signals.json');
  assert.equal(report.queue.sample_count, 2);
  assert.equal(
    report.checks.find((c) => c.id === 'bs5-queue-failed').status,
    'fail'
  );
  assert.equal(report.summary.tiers.P1, 1);
  assert.equal(
    JSON.parse(h.report('behaviour-queue-samples.json')).samples.length,
    2
  );
});

test('an offline run saves no queue sample, and a run without a health address saves none either', async () => {
  const offline = cliHarness();
  await offline.run(['--offline']);
  assert.equal(offline.report('behaviour-queue-samples.json'), undefined);
  // createBehaviourProbes gives no queue probe without an address
  const bare = cliHarness({
    probes: { mainPush: fakeProbes().probes.mainPush },
  });
  await bare.run([], { DEPENDABOT_TRIAGE_TOKEN: SECRET_TOKEN });
  assert.equal(bare.report('behaviour-queue-samples.json'), undefined);
});

test('a history that cannot be saved is a note and a degraded sweep, and the reports are still written', async () => {
  const h = cliHarness({
    probes: fakeProbes({ queue: liveSample(0, 0) }).probes,
  });
  const write = h.deps.fs.writeText;
  h.deps.fs.writeText = (p, t) => {
    if (norm(p).endsWith('behaviour-queue-samples.json')) {
      throw new Error('read-only');
    }
    write(p, t);
  };
  assert.equal(await h.run([], { DEPENDABOT_TRIAGE_TOKEN: SECRET_TOKEN }), 0);
  const report = h.json('latest-behaviour-signals.json');
  assert.equal(report.run.degraded, true);
  assert.ok(
    report.notes.includes(
      'behaviour-queue-samples.json could not be written; BS-5 cannot build its series'
    )
  );
});

// --- end of tests ---
