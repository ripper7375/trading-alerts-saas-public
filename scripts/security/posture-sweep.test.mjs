// Run: node --test 'scripts/security/*.test.mjs'
//
// The live posture sweep (Phase 3 of the security monitoring architecture, v3.0,
// sections 6.2 and 6.3), entirely offline: every probe (HTTP, TLS, DNS, the
// GitHub API and Git) is a fake, so nothing real is read or sent. Hostnames are
// invented (`.test`); the assertions check that they reach the private reports
// and never stdout.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  POSTURE_BASELINE,
  PostureUsageError,
  evaluateApexRedirect,
  evaluateDnsGuard,
  evaluateGithubSettings,
  evaluateRuntimeTruth,
  evaluateTlsCertificate,
  evaluateWebHeaders,
  makePostureFinding,
  mergePostureFindings,
  parseHsts,
  parsePostureArgs,
  parseRuntimeState,
  renderPostureSweepMarkdown,
  renderPostureSweepSection,
  renderPostureSweepStdout,
  runPostureSweep,
  servicePaths,
} from './posture-sweep-lib.mjs';
import { findPrivacyViolations, safeAssetId } from './line-notifier-lib.mjs';
import { runPostureCli } from './posture-sweep-run.mjs';
import {
  compareFindings,
  evaluateRuntimeFloors,
  loadInventory,
} from './security-pipeline-lib.mjs';

const NOW = new Date('2026-11-22T12:00:00Z');
const DAY = 86400000;
const HOUR = 3600000;
const iso = (ms) => new Date(ms).toISOString();
const ago = (ms) => iso(NOW.getTime() - ms);
const ahead = (ms) => iso(NOW.getTime() + ms);

const INVENTORY_TEXT = `
schema_version: '3.0'
updated_at: '2026-11-22'
toolchain_pins:
  node_runtime_floors:
    v24_min_patch: '24.22.3'
    v22_min_patch: '22.23.5'
expected_public_endpoints:
  - 'www.example.test'
  - 'svc-a (fixture domain)'
assets:
  - id: svc-a
    lifecycle: production
    exposure_tier: 1
    ecosystems:
      - type: npm
        manifest_path: 'svc-a/package.json'
        lockfile_path: 'svc-a/package-lock.json'
    runtime:
      type: nodejs
      declared_range: '24.x'
  - id: svc-b
    lifecycle: production
    exposure_tier: 2
    ecosystems:
      - type: npm
        manifest_path: 'svc-b/package.json'
        lockfile_path: 'svc-b/package-lock.json'
      - type: docker
        dockerfile_path: 'svc-b/Dockerfile'
        base_image: 'alpine:3.24'
    runtime:
      type: nodejs
      declared_range: '24.x'
  - id: root-app
    lifecycle: production
    exposure_tier: 1
    ecosystems:
      - type: pnpm
        manifest_path: 'package.json'
        lockfile_path: 'pnpm-lock.yaml'
    runtime:
      type: nodejs
      declared_range: '24.x'
  - id: chat-box
    lifecycle: paused
    exposure_tier: 1
    public_hostnames: ['chat.example.test']
    ecosystems:
      - type: docker
        dockerfile_path: 'chat/Dockerfile'
        base_image: 'node:22-alpine'
  - id: live-box
    lifecycle: production
    exposure_tier: 2
    public_hostnames: ['live.example.test']
    ecosystems:
      - type: docker
        dockerfile_path: 'live/Dockerfile'
        base_image: 'redis:7-alpine'
excluded_paths: []
`;
const INVENTORY = loadInventory(INVENTORY_TEXT);

const GOOD_HEADERS = {
  'strict-transport-security': 'max-age=63072000; includeSubDomains; preload',
  'content-security-policy': "default-src 'self'",
  'x-frame-options': 'SAMEORIGIN',
  'x-content-type-options': 'nosniff',
  'referrer-policy': 'strict-origin-when-cross-origin',
  'permissions-policy': 'camera=(), microphone=()',
};

const GOOD_REPO = {
  ok: true,
  status: 200,
  body: {
    permissions: { admin: true },
    security_and_analysis: {
      secret_scanning: { status: 'enabled' },
      secret_scanning_push_protection: { status: 'enabled' },
      dependabot_security_updates: { status: 'disabled' },
    },
  },
};
const GOOD_GITHUB = {
  repo: GOOD_REPO,
  rules: {
    ok: true,
    status: 200,
    body: [
      { type: 'deletion', ruleset_id: 11 },
      { type: 'non_fast_forward', ruleset_id: 11 },
    ],
  },
  actions: {
    ok: true,
    status: 200,
    body: {
      enabled: true,
      allowed_actions: 'selected',
      sha_pinning_required: true,
    },
  },
  workflow: {
    ok: true,
    status: 200,
    body: {
      default_workflow_permissions: 'read',
      can_approve_pull_request_reviews: false,
    },
  },
  alerts: { ok: true, status: 204, body: null },
  pvr: { ok: true, status: 200, body: { enabled: true } },
};

const byId = (checks, id) => checks.find((c) => c.id === id);
const statuses = (checks) =>
  Object.fromEntries(checks.map((c) => [c.id, c.status]));

// --- web headers ------------------------------------------------------------------------

test('parseHsts reads max-age and the directives, ignoring case and quotes', () => {
  assert.deepEqual(parseHsts('max-age=63072000; includeSubDomains; preload'), {
    maxAge: 63072000,
    includeSubDomains: true,
    preload: true,
  });
  assert.deepEqual(parseHsts('MAX-AGE="31536000"; INCLUDESUBDOMAINS'), {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: false,
  });
  assert.deepEqual(parseHsts('includeSubDomains'), {
    maxAge: null,
    includeSubDomains: true,
    preload: false,
  });
  assert.deepEqual(parseHsts(''), {
    maxAge: null,
    includeSubDomains: false,
    preload: false,
  });
});

test('the live baseline headers pass all six header checks', () => {
  const checks = evaluateWebHeaders(GOOD_HEADERS);
  assert.deepEqual(
    checks.map((c) => c.id),
    [
      'web-hsts',
      'web-csp',
      'web-x-frame-options',
      'web-x-content-type-options',
      'web-referrer-policy',
      'web-permissions-policy',
    ]
  );
  for (const check of checks) {
    assert.equal(check.status, 'pass', check.id);
    assert.equal(check.area, 'web');
    assert.equal(check.assetId, 'public-web');
    assert.equal(check.priority, null);
  }
});

test('header names are matched without regard to case', () => {
  const upper = Object.fromEntries(
    Object.entries(GOOD_HEADERS).map(([k, v]) => [k.toUpperCase(), v])
  );
  assert.ok(evaluateWebHeaders(upper).every((c) => c.status === 'pass'));
});

test('a missing or weakened HSTS or CSP is P1; the other headers are P2', () => {
  const drop = (name) => {
    const copy = { ...GOOD_HEADERS };
    delete copy[name];
    return copy;
  };
  const cases = [
    ['web-hsts', drop('strict-transport-security'), 'P1'],
    ['web-csp', drop('content-security-policy'), 'P1'],
    ['web-x-frame-options', drop('x-frame-options'), 'P2'],
    ['web-x-content-type-options', drop('x-content-type-options'), 'P2'],
    ['web-referrer-policy', drop('referrer-policy'), 'P2'],
    ['web-permissions-policy', drop('permissions-policy'), 'P2'],
  ];
  for (const [id, headers, tier] of cases) {
    const check = byId(evaluateWebHeaders(headers), id);
    assert.equal(check.status, 'fail', id);
    assert.equal(check.priority, tier, id);
    assert.equal(check.observed, 'missing', id);
  }
});

test('HSTS needs includeSubDomains and a max-age of at least a year', () => {
  const hsts = (value) =>
    byId(
      evaluateWebHeaders({
        ...GOOD_HEADERS,
        'strict-transport-security': value,
      }),
      'web-hsts'
    );
  assert.equal(hsts('max-age=31536000; includeSubDomains').status, 'pass');
  assert.equal(hsts('max-age=63072000').status, 'fail');
  assert.equal(hsts('max-age=3600; includeSubDomains').status, 'fail');
  assert.equal(hsts('includeSubDomains').status, 'fail');
  assert.equal(hsts('max-age=63072000; includeSubDomains').priority, null);
  assert.equal(hsts('max-age=3600; includeSubDomains').priority, 'P1');
});

test('a report-only CSP is not an enforced CSP', () => {
  const headers = { ...GOOD_HEADERS };
  delete headers['content-security-policy'];
  headers['content-security-policy-report-only'] = "default-src 'self'";
  const check = byId(evaluateWebHeaders(headers), 'web-csp');
  assert.equal(check.status, 'fail');
  assert.match(check.observed, /report-only/);
});

test('weak values of the other headers fail', () => {
  const with_ = (name, value) => ({ ...GOOD_HEADERS, [name]: value });
  assert.equal(
    byId(
      evaluateWebHeaders(with_('x-frame-options', 'ALLOWALL')),
      'web-x-frame-options'
    ).status,
    'fail'
  );
  assert.equal(
    byId(
      evaluateWebHeaders(with_('x-frame-options', 'deny')),
      'web-x-frame-options'
    ).status,
    'pass'
  );
  assert.equal(
    byId(
      evaluateWebHeaders(with_('x-content-type-options', 'sniff')),
      'web-x-content-type-options'
    ).status,
    'fail'
  );
  assert.equal(
    byId(
      evaluateWebHeaders(with_('referrer-policy', 'unsafe-url')),
      'web-referrer-policy'
    ).status,
    'fail'
  );
  assert.equal(
    byId(
      evaluateWebHeaders(
        with_('referrer-policy', 'no-referrer, strict-origin')
      ),
      'web-referrer-policy'
    ).status,
    'pass'
  );
  assert.equal(
    byId(
      evaluateWebHeaders(with_('permissions-policy', '   ')),
      'web-permissions-policy'
    ).status,
    'fail'
  );
});

test('a very long header value is shortened in the check, never stored whole', () => {
  const long = 'x'.repeat(5000);
  const check = byId(
    evaluateWebHeaders({ ...GOOD_HEADERS, 'x-frame-options': long }),
    'web-x-frame-options'
  );
  assert.equal(check.status, 'fail');
  assert.ok(check.observed.length <= 130);
});

// --- apex redirect ----------------------------------------------------------------------

test('the apex must redirect to https on the www host', () => {
  const ok = (status, location) =>
    evaluateApexRedirect({ status, location, wwwHost: 'www.example.test' });
  assert.equal(ok(308, 'https://www.example.test/').status, 'pass');
  assert.equal(
    ok(301, 'https://www.example.test/some/path?x=1').status,
    'pass'
  );
  assert.equal(ok(307, '/').status, 'fail'); // a relative redirect stays on the apex
  for (const [status, location] of [
    [200, null],
    [308, null],
    [308, 'https://other.example.test/'],
    [308, 'http://www.example.test/'],
    [308, 'https://www.example.test.evil.test/'],
    [308, 'not a url'],
  ]) {
    const check = ok(status, location);
    assert.equal(check.status, 'fail', `${status} ${location}`);
    assert.equal(check.priority, 'P2');
    assert.equal(check.id, 'web-apex-redirect');
  }
});

// --- TLS certificate --------------------------------------------------------------------

test('the certificate check passes above 21 days, warns (P2) up to 21 and fails (P1) up to 7', () => {
  const probe = (days, over = {}) => ({
    ok: true,
    authorized: true,
    authorizationError: null,
    validFrom: ago(60 * DAY),
    validTo: ahead(days * DAY),
    ...over,
  });
  const check = (days) =>
    evaluateTlsCertificate({ probe: probe(days), now: NOW });
  assert.equal(check(45).status, 'pass');
  assert.match(check(45).observed, /45 days/);
  assert.equal(check(21.01).status, 'pass');
  assert.equal(check(21).status, 'fail');
  assert.equal(check(21).priority, 'P2');
  assert.equal(check(8).priority, 'P2');
  assert.equal(check(7).priority, 'P1');
  assert.equal(check(0.5).priority, 'P1');
  assert.equal(check(-3).priority, 'P1');
  assert.match(check(-3).observed, /expired/);
  assert.equal(check(45).id, 'tls-certificate');
  assert.equal(check(45).assetId, 'public-web');
});

test('an invalid certificate is P1 whatever its dates say', () => {
  const check = evaluateTlsCertificate({
    probe: {
      ok: true,
      authorized: false,
      authorizationError: 'CERT_HAS_EXPIRED',
      validFrom: ago(100 * DAY),
      validTo: ahead(300 * DAY),
    },
    now: NOW,
  });
  assert.equal(check.status, 'fail');
  assert.equal(check.priority, 'P1');
  assert.match(check.observed, /CERT_HAS_EXPIRED/);
});

test('a certificate that is not valid yet is P1', () => {
  const check = evaluateTlsCertificate({
    probe: {
      ok: true,
      authorized: true,
      authorizationError: null,
      validFrom: ahead(2 * DAY),
      validTo: ahead(90 * DAY),
    },
    now: NOW,
  });
  assert.equal(check.status, 'fail');
  assert.equal(check.priority, 'P1');
});

test('a failed or unreadable TLS probe is unavailable, never a pass', () => {
  const failed = evaluateTlsCertificate({
    probe: { ok: false, error: 'timeout' },
    now: NOW,
  });
  assert.equal(failed.status, 'unavailable');
  assert.equal(failed.detail, 'timeout');
  const garbled = evaluateTlsCertificate({
    probe: {
      ok: true,
      authorized: true,
      authorizationError: null,
      validFrom: 'nonsense',
      validTo: 'nonsense',
    },
    now: NOW,
  });
  assert.equal(garbled.status, 'unavailable');
  assert.equal(garbled.detail, 'bad_certificate_data');
});

// --- DNS guard for paused assets ---------------------------------------------------------

test('a paused asset whose name does not resolve passes the DNS guard', () => {
  const checks = evaluateDnsGuard({
    inventory: INVENTORY,
    results: { 'chat.example.test': { ok: true, addresses: [], cnames: [] } },
  });
  const check = byId(checks, 'dns-paused-chat-box');
  assert.equal(check.status, 'pass');
  assert.equal(check.area, 'dns');
  assert.equal(check.assetId, 'chat-box');
});

test('a record for a paused asset is an unexpected public endpoint: R-9, P1, no address in the report', () => {
  const secret = '203.0.113.99';
  const checks = evaluateDnsGuard({
    inventory: INVENTORY,
    results: {
      'chat.example.test': { ok: true, addresses: [secret], cnames: [] },
    },
  });
  const check = byId(checks, 'dns-paused-chat-box');
  assert.equal(check.status, 'fail');
  assert.equal(check.priority, 'P1');
  assert.equal(check.rule, 'R-9');
  assert.equal(JSON.stringify(check).includes(secret), false);
  assert.match(check.observed, /1 address record/);
});

test('only a paused asset is guarded; a resolver failure is unavailable', () => {
  const checks = evaluateDnsGuard({
    inventory: INVENTORY,
    results: {
      'chat.example.test': { ok: false, error: 'timeout' },
      'live.example.test': {
        ok: true,
        addresses: ['198.51.100.1'],
        cnames: [],
      },
    },
  });
  assert.equal(byId(checks, 'dns-paused-chat-box').status, 'unavailable');
  assert.equal(byId(checks, 'dns-paused-chat-box').detail, 'timeout');
  // a production asset may resolve: no check at all, nothing to guard
  assert.equal(
    checks.some((c) => c.assetId === 'live-box'),
    false
  );
});

// --- GitHub settings drift -----------------------------------------------------------------

test('the Phase 0 and 1 baseline passes all nine GitHub checks', () => {
  const checks = evaluateGithubSettings(GOOD_GITHUB);
  assert.deepEqual(
    checks.map((c) => c.id),
    [
      'github-secret-scanning',
      'github-push-protection',
      'github-dependabot-alerts',
      'github-private-vuln-reporting',
      'github-branch-rules',
      'github-actions-allowlist',
      'github-actions-sha-pinning',
      'github-workflow-token-read',
      'github-workflow-pr-approval',
    ]
  );
  for (const check of checks) {
    assert.equal(check.status, 'pass', check.id);
    assert.equal(check.area, 'github');
    assert.equal(check.assetId, 'github-repo');
  }
});

test('any downgrade from the baseline is a P1 finding', () => {
  const sa = (patch) => ({
    ...GOOD_REPO,
    body: {
      ...GOOD_REPO.body,
      security_and_analysis: {
        ...GOOD_REPO.body.security_and_analysis,
        ...patch,
      },
    },
  });
  const drifts = [
    [
      'github-secret-scanning',
      { repo: sa({ secret_scanning: { status: 'disabled' } }) },
    ],
    [
      'github-push-protection',
      { repo: sa({ secret_scanning_push_protection: { status: 'disabled' } }) },
    ],
    [
      'github-dependabot-alerts',
      { alerts: { ok: false, status: 404, body: null } },
    ],
    [
      'github-private-vuln-reporting',
      { pvr: { ok: true, status: 200, body: { enabled: false } } },
    ],
    [
      'github-branch-rules',
      {
        rules: {
          ok: true,
          status: 200,
          body: [{ type: 'deletion', ruleset_id: 1 }],
        },
      },
    ],
    ['github-branch-rules', { rules: { ok: true, status: 200, body: [] } }],
    [
      'github-actions-allowlist',
      {
        actions: {
          ok: true,
          status: 200,
          body: { allowed_actions: 'all', sha_pinning_required: true },
        },
      },
    ],
    [
      'github-actions-sha-pinning',
      {
        actions: {
          ok: true,
          status: 200,
          body: { allowed_actions: 'selected', sha_pinning_required: false },
        },
      },
    ],
    [
      'github-workflow-token-read',
      {
        workflow: {
          ok: true,
          status: 200,
          body: {
            default_workflow_permissions: 'write',
            can_approve_pull_request_reviews: false,
          },
        },
      },
    ],
    [
      'github-workflow-pr-approval',
      {
        workflow: {
          ok: true,
          status: 200,
          body: {
            default_workflow_permissions: 'read',
            can_approve_pull_request_reviews: true,
          },
        },
      },
    ],
  ];
  for (const [id, patch] of drifts) {
    const checks = evaluateGithubSettings({ ...GOOD_GITHUB, ...patch });
    const check = byId(checks, id);
    assert.equal(check.status, 'fail', id);
    assert.equal(check.priority, 'P1', id);
    assert.equal(check.rule, 'PS-1', id);
    // exactly that one check moved
    assert.equal(
      checks.filter((c) => c.status === 'fail').length,
      1,
      `${id}: only it should fail`
    );
  }
});

test('the branch-rules check names what is missing, not the whole response', () => {
  const checks = evaluateGithubSettings({
    ...GOOD_GITHUB,
    rules: {
      ok: true,
      status: 200,
      body: [{ type: 'deletion', ruleset_id: 1 }],
    },
  });
  assert.match(
    byId(checks, 'github-branch-rules').observed,
    /non_fast_forward/
  );
});

test('without admin rights a 404 is not proof that a setting is off', () => {
  const checks = evaluateGithubSettings({
    ...GOOD_GITHUB,
    repo: { ok: true, status: 200, body: { permissions: { admin: false } } },
    alerts: { ok: false, status: 404, body: null },
  });
  assert.equal(byId(checks, 'github-secret-scanning').status, 'unavailable');
  assert.equal(byId(checks, 'github-secret-scanning').detail, 'needs_admin');
  assert.equal(byId(checks, 'github-dependabot-alerts').status, 'unavailable');
  assert.equal(byId(checks, 'github-dependabot-alerts').detail, 'needs_admin');
  assert.equal(
    checks.some((c) => c.status === 'fail'),
    false
  );
});

test('an unreadable repository gives one unavailable check, with a fixed reason', () => {
  const none = { ok: false, status: 0, body: null, error: 'no_token' };
  const checks = evaluateGithubSettings({
    repo: none,
    rules: none,
    actions: none,
    workflow: none,
    alerts: none,
    pvr: none,
  });
  assert.deepEqual(statuses(checks), { 'github-probe': 'unavailable' });
  assert.equal(checks[0].detail, 'no_token');
  for (const [status, detail] of [
    [401, 'unauthorized'],
    [403, 'forbidden'],
    [404, 'not_found'],
    [429, 'rate_limited'],
    [502, 'http_502'],
  ]) {
    const result = evaluateGithubSettings({
      ...GOOD_GITHUB,
      repo: { ok: false, status, body: null },
    });
    assert.equal(result[0].detail, detail, String(status));
  }
});

test('one endpoint failing makes only its checks unavailable', () => {
  const checks = evaluateGithubSettings({
    ...GOOD_GITHUB,
    actions: { ok: false, status: 403, body: null },
  });
  assert.equal(byId(checks, 'github-actions-allowlist').status, 'unavailable');
  assert.equal(
    byId(checks, 'github-actions-sha-pinning').status,
    'unavailable'
  );
  assert.equal(byId(checks, 'github-secret-scanning').status, 'pass');
  // a field the API did not return is unavailable too, not a pass
  const missing = evaluateGithubSettings({
    ...GOOD_GITHUB,
    actions: { ok: true, status: 200, body: { allowed_actions: 'selected' } },
  });
  assert.equal(
    byId(missing, 'github-actions-sha-pinning').status,
    'unavailable'
  );
  assert.equal(
    byId(missing, 'github-actions-sha-pinning').detail,
    'field_missing'
  );
});

// --- runtime state ---------------------------------------------------------------------------

test('parseRuntimeState keeps what it understands and reports what it ignored', () => {
  const state = parseRuntimeState({
    schema_version: '1.1',
    read_at: '2026-11-20T00:00:00Z',
    assets: {
      'svc-a': {
        node: '24.22.3',
        verified: true,
        commit_sha: 'ABCDEF1234567',
        deployed_at: '2026-11-21T10:00:00Z',
        read_at: '2026-11-22T06:00:00Z',
        base_image: { tag: 'alpine:3.24', digest: `sha256:${'a'.repeat(64)}` },
      },
      'svc-b': { node: '24.10.0', commit_sha: 'not-a-sha' },
    },
  });
  assert.equal(state.present, true);
  assert.equal(state.assets['svc-a'].commitSha, 'abcdef1234567');
  assert.equal(state.assets['svc-a'].readAt, '2026-11-22T06:00:00.000Z');
  assert.equal(state.assets['svc-a'].baseImage.tag, 'alpine:3.24');
  assert.equal(state.assets['svc-b'].commitSha, null);
  assert.equal(state.assets['svc-b'].readAt, '2026-11-20T00:00:00.000Z');
  assert.deepEqual(state.issues, ['invalid_commit_sha']);
  for (const bad of [null, undefined, [], 'text', { assets: 5 }]) {
    assert.equal(parseRuntimeState(bad).present, false, JSON.stringify(bad));
  }
});

test('servicePaths scopes an asset to the folders of its manifests', () => {
  const asset = (id) => INVENTORY.assets.find((a) => a.id === id);
  assert.deepEqual(servicePaths(asset('svc-a')), ['svc-a']);
  assert.deepEqual(servicePaths(asset('svc-b')), ['svc-b']);
  assert.deepEqual(servicePaths(asset('root-app')), []); // the repository root is no scope
});

// --- runtime truth -----------------------------------------------------------------------------

const KNOWN = 'a'.repeat(40);
const stateOf = (assets, extra = {}) =>
  parseRuntimeState({
    schema_version: '1.1',
    read_at: ago(1 * DAY),
    assets,
    ...extra,
  });
const factsFor = (assetId, over = {}) => ({
  mainRef: 'origin/main',
  mainSha: 'b'.repeat(40),
  assets: { [assetId]: { state: 'ok', pending: [], ...over } },
});
const truth = (assets, facts, nodeLines = null, extra = {}) =>
  evaluateRuntimeTruth({
    inventory: INVENTORY,
    runtimeState: stateOf(assets, extra),
    nodeLines,
    now: NOW,
    gitFacts: facts,
  });

test('a deployed build that includes every change to the service paths passes', () => {
  const { checks } = truth(
    { 'svc-a': { node: '24.22.3', verified: true, commit_sha: KNOWN } },
    factsFor('svc-a')
  );
  assert.equal(byId(checks, 'runtime-svc-a-deploy').status, 'pass');
  assert.equal(byId(checks, 'runtime-svc-a-node').status, 'pass');
});

test('a change older than 24 hours that is not deployed is stale (P2)', () => {
  const { checks } = truth(
    { 'svc-a': { node: '24.22.3', commit_sha: KNOWN } },
    factsFor('svc-a', {
      pending: [{ sha: 'c'.repeat(40), at: ago(30 * HOUR) }],
    })
  );
  const check = byId(checks, 'runtime-svc-a-deploy');
  assert.equal(check.status, 'fail');
  assert.equal(check.priority, 'P2');
  assert.equal(check.rule, 'PS-6');
  assert.match(check.observed, /1 pending/);
  assert.match(check.observed, /30\.0 h/);
});

test('the oldest pending change decides, so a fresh commit cannot hide an old one', () => {
  const stale = truth(
    { 'svc-a': { node: '24.22.3', commit_sha: KNOWN } },
    factsFor('svc-a', {
      pending: [
        { sha: 'c'.repeat(40), at: ago(3 * DAY) },
        { sha: 'd'.repeat(40), at: ago(1 * HOUR) },
      ],
    })
  );
  assert.equal(byId(stale.checks, 'runtime-svc-a-deploy').status, 'fail');
  assert.match(
    byId(stale.checks, 'runtime-svc-a-deploy').observed,
    /2 pending/
  );
});

test('a change younger than 24 hours is within the grace period', () => {
  const { checks } = truth(
    { 'svc-a': { node: '24.22.3', commit_sha: KNOWN } },
    factsFor('svc-a', { pending: [{ sha: 'c'.repeat(40), at: ago(3 * HOUR) }] })
  );
  const check = byId(checks, 'runtime-svc-a-deploy');
  assert.equal(check.status, 'pass');
  assert.match(check.observed, /1 pending/);
});

test('missing evidence is skipped or unavailable, never a pass', () => {
  const cases = [
    // no commit sha recorded
    [{ node: '24.22.3' }, factsFor('svc-a'), 'skipped', 'no_commit_sha'],
    // a sha that is not hex
    [
      { node: '24.22.3', commit_sha: 'zzz' },
      factsFor('svc-a'),
      'skipped',
      'no_commit_sha',
    ],
    // the sha is not in the local history
    [
      { node: '24.22.3', commit_sha: KNOWN },
      factsFor('svc-a', { state: 'deployed_sha_unknown', pending: null }),
      'unavailable',
      'deployed_sha_unknown',
    ],
    // main could not be resolved
    [
      { node: '24.22.3', commit_sha: KNOWN },
      { mainRef: 'origin/main', mainSha: null, assets: {} },
      'unavailable',
      'main_ref_missing',
    ],
    // git failed on the log
    [
      { node: '24.22.3', commit_sha: KNOWN },
      factsFor('svc-a', { state: 'error', pending: null }),
      'unavailable',
      'git_error',
    ],
  ];
  for (const [entry, facts, status, detail] of cases) {
    const { checks } = truth({ 'svc-a': entry }, facts);
    const check = byId(checks, 'runtime-svc-a-deploy');
    assert.equal(check.status, status, detail);
    assert.equal(check.detail, detail);
  }
  // no git facts at all (offline)
  const offline = truth(
    { 'svc-a': { node: '24.22.3', commit_sha: KNOWN } },
    null
  );
  assert.equal(byId(offline.checks, 'runtime-svc-a-deploy').status, 'skipped');
  assert.equal(byId(offline.checks, 'runtime-svc-a-deploy').detail, 'no_git');
  // an asset with no folder of its own cannot be scoped
  const root = truth(
    { 'root-app': { node: '24.22.3', commit_sha: KNOWN } },
    factsFor('root-app')
  );
  assert.equal(byId(root.checks, 'runtime-root-app-deploy').status, 'skipped');
  assert.equal(
    byId(root.checks, 'runtime-root-app-deploy').detail,
    'paths_unscoped'
  );
});

test('a Node runtime below the floor is a P1 (R-7) and reuses the Phase 2 finding key', () => {
  const entry = { node: '24.10.0', verified: false, commit_sha: KNOWN };
  const { checks, floorFindings } = truth(
    { 'svc-a': entry },
    factsFor('svc-a')
  );
  const check = byId(checks, 'runtime-svc-a-node');
  assert.equal(check.status, 'fail');
  assert.equal(check.priority, 'P1');
  assert.equal(check.rule, 'R-7');
  // the same finding Phase 2 raises, so merging the two never double counts
  const phase2 = evaluateRuntimeFloors({
    inventory: INVENTORY,
    nodeLines: null,
    runtimeState: { assets: { 'svc-a': entry } },
  }).findings;
  assert.equal(floorFindings.length, 1);
  assert.equal(floorFindings[0].key, phase2[0].key);
  assert.equal(floorFindings[0].priority, 'P1');
  assert.equal(floorFindings[0].rule, 'R-7');
});

test('behind the latest security release counts when the Node index is known', () => {
  const nodeLines = {
    24: {
      latest: 'v24.30.0',
      latestSecurity: '24.30.0',
      latestSecurityDate: '2026-11-20',
    },
  };
  const { checks } = truth(
    { 'svc-a': { node: '24.22.3', commit_sha: KNOWN } },
    factsFor('svc-a'),
    nodeLines
  );
  assert.equal(byId(checks, 'runtime-svc-a-node').status, 'fail');
});

test('a service with no Node reading is skipped, not degraded', () => {
  const { checks } = truth(
    { 'svc-a': { commit_sha: KNOWN } },
    factsFor('svc-a')
  );
  const check = byId(checks, 'runtime-svc-a-node');
  assert.equal(check.status, 'skipped');
  assert.equal(check.detail, 'no_reading');
  // an asset that has no entry at all
  assert.equal(byId(checks, 'runtime-svc-b-node').status, 'skipped');
});

test('a base image that differs from the inventory is drift (P2); equal or unknown is quiet', () => {
  const drift = truth(
    {
      'svc-b': {
        node: '24.22.3',
        base_image: { tag: 'alpine:3.21' },
      },
    },
    factsFor('svc-b')
  );
  const check = byId(drift.checks, 'runtime-svc-b-base-image');
  assert.equal(check.status, 'fail');
  assert.equal(check.priority, 'P2');
  const same = truth(
    { 'svc-b': { node: '24.22.3', base_image: { tag: 'alpine:3.24' } } },
    factsFor('svc-b')
  );
  assert.equal(byId(same.checks, 'runtime-svc-b-base-image').status, 'pass');
  // no recorded image: no check; no declared image (svc-a): no check
  const none = truth({ 'svc-b': { node: '24.22.3' } }, factsFor('svc-b'));
  assert.equal(byId(none.checks, 'runtime-svc-b-base-image'), undefined);
  const undeclared = truth(
    { 'svc-a': { node: '24.22.3', base_image: { tag: 'alpine:3.24' } } },
    factsFor('svc-a')
  );
  assert.equal(byId(undeclared.checks, 'runtime-svc-a-base-image'), undefined);
});

test('the runtime table counts stale reads and unknown assets without raising findings', () => {
  const { assets, stale_reads, unknown_assets, checks } = truth(
    {
      'svc-a': {
        node: '24.22.3',
        commit_sha: KNOWN,
        read_at: ago(10 * DAY),
        verified: true,
      },
      ghost: { node: '24.0.0' },
    },
    factsFor('svc-a')
  );
  assert.equal(stale_reads, 1);
  assert.equal(unknown_assets, 1);
  const row = assets.find((a) => a.assetId === 'svc-a');
  assert.equal(row.stale_read, true);
  assert.equal(row.verified, true);
  assert.equal(row.read_age_days, 10);
  assert.equal(
    checks.some((c) => c.status === 'fail'),
    false
  );
});

// --- the sweep -----------------------------------------------------------------------------------

function fakeProbes(over = {}) {
  const calls = { web: [], tls: [], dns: [], github: [], git: [] };
  const github = { ...GOOD_GITHUB, ...(over.github ?? {}) };
  const route = {
    '': github.repo,
    '/rules/branches/main': github.rules,
    '/actions/permissions': github.actions,
    '/actions/permissions/workflow': github.workflow,
    '/vulnerability-alerts': github.alerts,
    '/private-vulnerability-reporting': github.pvr,
  };
  const probes = {
    web: async ({ url }) => {
      calls.web.push(url);
      if (over.web) return over.web(url);
      return url === 'https://www.example.test/'
        ? { ok: true, status: 200, headers: GOOD_HEADERS }
        : {
            ok: true,
            status: 308,
            headers: { location: 'https://www.example.test/' },
          };
    },
    tls: async ({ host }) => {
      calls.tls.push(host);
      return (
        over.tls ?? {
          ok: true,
          authorized: true,
          authorizationError: null,
          validFrom: ago(45 * DAY),
          validTo: ahead(45 * DAY),
        }
      );
    },
    dns: async ({ host }) => {
      calls.dns.push(host);
      return over.dns?.(host) ?? { ok: true, addresses: [], cnames: [] };
    },
    github: async ({ path }) => {
      calls.github.push(path);
      return route[path];
    },
    git: {
      fetchMain: async (args) => {
        calls.git.push('fetch');
        calls.fetchArgs = args;
        return over.fetch ?? { ok: true };
      },
      resolve: async (ref) => {
        calls.git.push(`resolve ${ref}`);
        if (over.resolve) return over.resolve(ref);
        return ref === 'origin/main' ? 'b'.repeat(40) : KNOWN;
      },
      pending: async (args) => {
        calls.git.push(`pending ${args.paths.join(',')}`);
        return over.pending?.(args) ?? { ok: true, commits: [] };
      },
    },
  };
  return { probes, calls };
}

const RUNTIME_STATE = {
  schema_version: '1.1',
  read_at: ago(1 * DAY),
  assets: {
    'svc-a': { node: '24.22.3', verified: true, commit_sha: KNOWN },
    'svc-b': { node: '24.22.3', verified: true, commit_sha: KNOWN },
  },
};

const sweep = (over = {}, input = {}) => {
  const fake = fakeProbes(over);
  return {
    fake,
    run: () =>
      runPostureSweep({
        inventory: INVENTORY,
        runtimeState: RUNTIME_STATE,
        probes: fake.probes,
        now: NOW,
        repo: 'owner/name',
        ...input,
      }),
  };
};

test('a healthy sweep passes every check and raises nothing', async () => {
  const { run, fake } = sweep();
  const result = await run();
  assert.equal(result.summary.checks.fail, 0);
  assert.equal(result.summary.checks.unavailable, 0);
  assert.equal(result.findings.length, 0);
  assert.equal(result.run.degraded, false);
  assert.deepEqual(result.summary.areas, {
    web: 'ok',
    tls: 'ok',
    dns: 'ok',
    github: 'ok',
    runtime: 'ok',
  });
  // the apex is probed too, and the paused asset's name is resolved
  assert.deepEqual(fake.calls.web, [
    'https://www.example.test/',
    'https://example.test/',
  ]);
  assert.deepEqual(fake.calls.dns, ['chat.example.test']);
  assert.deepEqual(fake.calls.tls, ['www.example.test']);
  assert.equal(fake.calls.github.length, 6);
  assert.equal(
    result.summary.checks.total,
    result.checks.length,
    'the counts add up'
  );
  assert.equal(
    result.summary.checks.pass +
      result.summary.checks.fail +
      result.summary.checks.unavailable +
      result.summary.checks.skipped,
    result.summary.checks.total
  );
  assert.equal(result.generated_at, NOW.toISOString());
});

test('checks come in a fixed order: web, tls, dns, github, runtime', async () => {
  const { run } = sweep();
  const result = await run();
  const order = ['web', 'tls', 'dns', 'github', 'runtime'];
  const areas = result.checks.map((c) => c.area);
  assert.deepEqual(
    areas,
    [...areas].sort((a, b) => order.indexOf(a) - order.indexOf(b))
  );
});

test('a failed check becomes a scored finding that the alert and report code can use', async () => {
  const { run } = sweep({
    github: {
      repo: {
        ...GOOD_REPO,
        body: {
          ...GOOD_REPO.body,
          security_and_analysis: {
            secret_scanning: { status: 'disabled' },
            secret_scanning_push_protection: { status: 'enabled' },
          },
        },
      },
    },
    dns: () => ({ ok: true, addresses: ['203.0.113.7'], cnames: [] }),
  });
  const result = await run();
  assert.equal(result.summary.tiers.P1, 2);
  assert.equal(result.findings.length, 2);
  for (const f of result.findings) {
    assert.match(f.key, /^[0-9a-f]{16}$/);
    assert.equal(f.priority, 'P1');
    assert.ok(f.rule);
    assert.ok(f.sla);
    assert.equal(f.source, 'posture-sweep');
    assert.equal(f.scope, 'runtime');
    assert.equal(f.advisoryIds.length, 0);
    assert.equal(safeAssetId(f.assetId), f.assetId, 'LINE-safe asset id');
  }
  const kinds = result.findings.map((f) => f.kind).sort();
  assert.deepEqual(kinds, ['posture-drift', 'public-endpoint']);
  assert.equal(
    result.findings.find((f) => f.kind === 'public-endpoint').rule,
    'R-9'
  );
  // the finding keys are stable between runs (deduplication of alerts)
  const again = await run();
  assert.deepEqual(
    again.findings.map((f) => f.key).sort(),
    result.findings.map((f) => f.key).sort()
  );
  // and sortable with the Phase 2 comparator
  assert.doesNotThrow(() => [...result.findings].sort(compareFindings));
});

test('offline skips every network probe and still reads the local evidence', async () => {
  const { run, fake } = sweep({}, { offline: true });
  const result = await run();
  assert.deepEqual(fake.calls.web, []);
  assert.deepEqual(fake.calls.tls, []);
  assert.deepEqual(fake.calls.dns, []);
  assert.deepEqual(fake.calls.github, []);
  assert.equal(fake.calls.git.includes('fetch'), false, 'no fetch offline');
  assert.equal(result.run.offline, true);
  assert.equal(
    result.run.degraded,
    false,
    'a chosen offline run is not degraded'
  );
  for (const area of ['web', 'tls', 'dns', 'github']) {
    assert.equal(result.summary.areas[area], 'skipped', area);
  }
  // the node floor is still evaluated from the file
  assert.ok(result.checks.some((c) => c.id === 'runtime-svc-a-node'));
});

test('a probe that throws makes its area unavailable and the run degraded, never an exception', async () => {
  const fake = fakeProbes();
  fake.probes.tls = async () => {
    throw new Error('boom with a secret detail');
  };
  fake.probes.github = async () => {
    throw new Error('boom');
  };
  const result = await runPostureSweep({
    inventory: INVENTORY,
    runtimeState: RUNTIME_STATE,
    probes: fake.probes,
    now: NOW,
    repo: 'owner/name',
  });
  assert.equal(result.summary.areas.tls, 'unavailable');
  assert.equal(result.summary.areas.github, 'unavailable');
  assert.equal(result.run.degraded, true);
  assert.equal(
    JSON.stringify(result).includes('secret detail'),
    false,
    'an error message is never copied into a report'
  );
  assert.equal(byId(result.checks, 'tls-certificate').detail, 'probe_error');
});

test('with no probes at all every network area is unavailable', async () => {
  const result = await runPostureSweep({
    inventory: INVENTORY,
    runtimeState: RUNTIME_STATE,
    probes: null,
    now: NOW,
  });
  assert.equal(result.run.degraded, true);
  assert.equal(result.summary.areas.web, 'unavailable');
});

test('the main branch is fetched once, and a failed fetch is noted, not fatal', async () => {
  const ok = sweep();
  const first = await ok.run();
  assert.equal(ok.fake.calls.git.filter((c) => c === 'fetch').length, 1);
  assert.deepEqual(
    ok.fake.calls.fetchArgs,
    { mainRef: 'origin/main' },
    'the probe needs the ref to know which remote branch to fetch'
  );
  assert.equal(first.run.fetched_main, true);
  const bad = sweep({ fetch: { ok: false } });
  const second = await bad.run();
  assert.equal(second.run.fetched_main, false);
  assert.ok(second.notes.some((n) => /fetch/.test(n)));
  assert.equal(second.run.degraded, false);
  const skipped = sweep({}, { fetchMain: false });
  await skipped.run();
  assert.equal(skipped.fake.calls.git.includes('fetch'), false);
});

test('the deployed-build check asks Git about each asset folder, from the deployed sha', async () => {
  const seen = [];
  const { run } = sweep({
    pending: (args) => {
      seen.push(args);
      return {
        ok: true,
        commits: [{ sha: 'c'.repeat(40), at: ago(2 * DAY) }],
      };
    },
  });
  const result = await run();
  assert.deepEqual(
    seen.map((a) => a.paths),
    [['svc-a'], ['svc-b']]
  );
  assert.equal(seen[0].deployed, KNOWN);
  assert.equal(seen[0].mainRef, 'origin/main');
  assert.equal(
    result.findings.filter((f) => f.kind === 'deploy-drift').length,
    2
  );
  assert.equal(result.summary.tiers.P2, 2);
  assert.equal(result.runtime_truth.assets.length >= 2, true);
});

test('floor findings from the sweep merge with the Phase 2 ones without duplicates', async () => {
  const { run } = sweep(
    {},
    {
      runtimeState: {
        ...RUNTIME_STATE,
        assets: {
          'svc-a': { node: '24.10.0', commit_sha: KNOWN },
        },
      },
    }
  );
  const result = await run();
  const floors = result.findings.filter((f) => f.kind === 'runtime-floor');
  assert.equal(floors.length, 1);
  const phase2 = evaluateRuntimeFloors({
    inventory: INVENTORY,
    nodeLines: null,
    runtimeState: { assets: { 'svc-a': { node: '24.10.0' } } },
  }).findings;
  const merged = mergePostureFindings(
    phase2.map((f) => ({ ...f, priority: 'P1', rule: 'R-7' })),
    result.findings
  );
  assert.equal(
    merged.filter((f) => f.kind === 'runtime-floor').length,
    1,
    'one finding per key'
  );
  // a missing runtime-state file is a skipped runtime area, not a crash
  const missing = await sweep({}, { runtimeState: null }).run();
  assert.equal(missing.summary.areas.runtime, 'skipped');
});

test('mergePostureFindings keeps the existing finding and sorts the result', () => {
  const existing = [
    {
      key: 'k1',
      priority: 'P2',
      assetId: 'a',
      packageName: 'x',
      primaryId: '1',
    },
  ];
  const posture = [
    {
      key: 'k1',
      priority: 'P1',
      assetId: 'a',
      packageName: 'x',
      primaryId: '1',
    },
    {
      key: 'k2',
      priority: 'P1',
      assetId: 'a',
      packageName: 'y',
      primaryId: '2',
    },
  ];
  const merged = mergePostureFindings(existing, posture);
  assert.deepEqual(
    merged.map((f) => `${f.key}:${f.priority}`),
    ['k2:P1', 'k1:P2']
  );
});

// --- findings ------------------------------------------------------------------------------------

test('makePostureFinding fills the columns the report table prints', () => {
  const finding = makePostureFinding(
    {
      id: 'github-secret-scanning',
      area: 'github',
      assetId: 'github-repo',
      title: 'Secret scanning is enabled',
      status: 'fail',
      priority: 'P1',
      rule: 'PS-1',
      expected: 'enabled',
      observed: 'disabled',
    },
    { inventory: INVENTORY }
  );
  assert.equal(finding.kind, 'posture-drift');
  assert.equal(finding.priority, 'P1');
  assert.equal(finding.rule, 'PS-1');
  assert.equal(finding.packageName, 'github-secret-scanning');
  assert.equal(finding.version, 'disabled');
  assert.equal(finding.primaryId, 'POSTURE-GITHUB-SECRET-SCANNING');
  assert.equal(finding.severity, 'high');
  assert.match(finding.key, /^[0-9a-f]{16}$/);
  assert.equal(finding.exposureTier, null, 'a pseudo asset has no tier');
});

test('a finding for a real asset carries its lifecycle and tier', () => {
  const finding = makePostureFinding(
    {
      id: 'dns-paused-chat-box',
      area: 'dns',
      assetId: 'chat-box',
      title: 'No DNS record while paused',
      status: 'fail',
      priority: 'P1',
      rule: 'R-9',
      expected: 'no record',
      observed: '1 address record',
    },
    { inventory: INVENTORY }
  );
  assert.equal(finding.kind, 'public-endpoint');
  assert.equal(finding.lifecycle, 'paused');
  assert.equal(finding.exposureTier, 1);
  assert.equal(finding.severity, 'high');
});

// --- reports -------------------------------------------------------------------------------------

async function failingResult() {
  const { run } = sweep({
    dns: () => ({ ok: true, addresses: ['203.0.113.7'], cnames: [] }),
    tls: { ok: false, error: 'timeout' },
  });
  return run();
}

test('the console summary is counts and fixed words only', async () => {
  const result = await failingResult();
  const lines = renderPostureSweepStdout(result);
  assert.ok(lines.length >= 5);
  for (const line of lines) {
    assert.deepEqual(findPrivacyViolations(line), [], line);
    for (const sentinel of ['example.test', 'chat-box', 'svc-a', '203.0.113']) {
      assert.equal(line.includes(sentinel), false, `${sentinel} in: ${line}`);
    }
  }
  const text = lines.join('\n');
  // prefixed, so they never read as the lines of the vulnerability summary beside them
  assert.match(
    text,
    /posture_checks: total=\d+ pass=\d+ fail=\d+ unavailable=\d+ skipped=\d+/
  );
  assert.match(text, /posture_findings: P0=0 P1=1 P2=0 P3=0/);
  assert.match(
    text,
    /posture_areas: web=ok tls=unavailable dns=fail github=ok runtime=ok/
  );
  assert.match(
    text,
    /posture_runtime: assets=\d+ with_commit_sha=\d+ stale_reads=\d+/
  );
  assert.match(text, /degraded=yes/);
  // without the heading line the same numbers embed in the main summary
  assert.equal(
    renderPostureSweepStdout(result, { heading: false }).length,
    lines.length - 1
  );
});

test('the private Markdown report names every check and escapes table cells', async () => {
  const result = await failingResult();
  const md = renderPostureSweepMarkdown(result);
  assert.match(md, /^# DavinTrade live posture sweep \(private\)/);
  assert.match(md, /never commit it/);
  // either command writes this report, so the header names both
  assert.match(md, /run-posture-sweep\.mjs/);
  assert.match(md, /run-security-pipeline\.mjs --with-posture/);
  for (const check of result.checks) assert.ok(md.includes(check.id), check.id);
  assert.match(md, /## Runtime truth/);
  assert.ok(md.endsWith('\n'));
  // cells are escaped: backslash, pipe, angle brackets and ampersand
  const nasty = {
    ...result,
    checks: [
      {
        id: 'web-hsts',
        area: 'web',
        assetId: 'public-web',
        title: 'T',
        status: 'fail',
        priority: 'P1',
        rule: 'PS-4',
        expected: 'e',
        observed: 'a|b\\c<d>&e',
        detail: null,
      },
    ],
  };
  const out = renderPostureSweepSection(nasty).join('\n');
  assert.ok(out.includes('a\\|b\\\\c&lt;d&gt;&amp;e'), out);
  assert.equal(out.includes('<d>'), false);
});

test('the section for the main report starts with its own heading', async () => {
  const result = await failingResult();
  const lines = renderPostureSweepSection(result);
  assert.equal(lines[0], '## Live posture sweep');
  assert.ok(lines.length > 5);
});

// --- arguments -----------------------------------------------------------------------------------

test('parsePostureArgs reads flags and values and refuses the rest', () => {
  const o = parsePostureArgs([
    '--offline',
    '--no-fetch',
    '--repo=o/r',
    '--root',
    '/x',
    '--pipeline-dir',
    '/y',
    '--secrets-file=/z',
    '--main-ref',
    'origin/main',
    '--assets',
    'a-b,c',
  ]);
  assert.deepEqual(
    {
      off: o.offline,
      nf: o.noFetch,
      repo: o.repo,
      root: o.root,
      dir: o.pipelineDir,
      secrets: o.secretsFile,
      ref: o.mainRef,
      assets: o.assets,
      help: o.help,
    },
    {
      off: true,
      nf: true,
      repo: 'o/r',
      root: '/x',
      dir: '/y',
      secrets: '/z',
      ref: 'origin/main',
      assets: ['a-b', 'c'],
      help: false,
    }
  );
  assert.equal(parsePostureArgs([]).mainRef, 'origin/main');
  assert.equal(parsePostureArgs(['-h']).help, true);
  for (const bad of [
    ['--nope'],
    ['--repo', 'nonsense'],
    ['--main-ref', '--upload-pack=x'],
    ['--main-ref', 'a..b'],
    ['--main-ref', 'has space'],
    ['--assets', 'Bad Id'],
    ['--offline=1'],
    ['positional'],
    ['--repo'],
  ]) {
    assert.throws(
      () => parsePostureArgs(bad),
      PostureUsageError,
      JSON.stringify(bad)
    );
  }
});

test('the baseline names the controls the architecture records as applied', () => {
  assert.deepEqual(POSTURE_BASELINE.github.branchRules, [
    'deletion',
    'non_fast_forward',
  ]);
  assert.equal(POSTURE_BASELINE.github.allowedActions, 'selected');
  assert.equal(POSTURE_BASELINE.github.defaultWorkflowPermissions, 'read');
  assert.equal(POSTURE_BASELINE.tls.warnDays, 21);
  assert.equal(POSTURE_BASELINE.deploy.graceHours, 24);
  assert.equal(POSTURE_BASELINE.web.hstsMinMaxAge, 31536000);
});

// --- the standalone command ----------------------------------------------------------------------

const PIPELINE_DIR = '/repo/davintrade-security-monitoring-pipeline';
const SECRET_TOKEN = 'fake-github-token-for-tests-only-0123456789';
const norm = (path) => String(path).replaceAll('\\', '/');

function memoryFs(initial) {
  const files = new Map(Object.entries(initial));
  return {
    files,
    readText: (p) => files.get(norm(p)) ?? null,
    writeText: (p, t) => void files.set(norm(p), t),
    appendText: (p, t) =>
      void files.set(norm(p), (files.get(norm(p)) ?? '') + t),
    mkdirp: () => {},
  };
}

function cliHarness({ files = {}, probes = null, credential = null } = {}) {
  const fs = memoryFs({
    '/repo/security/security-inventory.yaml': INVENTORY_TEXT,
    [`${PIPELINE_DIR}/reports/runtime-state.json`]:
      JSON.stringify(RUNTIME_STATE),
    ...files,
  });
  const logs = [];
  const created = [];
  const credentialCalls = [];
  const deps = {
    root: '/repo',
    fs,
    createProbes: (args) => {
      created.push(args);
      return probes ?? fakeProbes().probes;
    },
    now: () => NOW,
    log: (line) => logs.push(line),
    credentialFill: () => {
      credentialCalls.push(1);
      return credential;
    },
    nodeVersion: 'v24.22.3',
  };
  return {
    fs,
    logs,
    created,
    credentialCalls,
    deps,
    run: (argv = [], env = {}) => runPostureCli({ argv, env, deps }),
    stdout: () => logs.join('\n'),
    report: (name) => fs.files.get(`${PIPELINE_DIR}/reports/${name}`),
  };
}

test('--help prints the usage and a bad argument exits 2', async () => {
  const help = cliHarness();
  assert.equal(await help.run(['--help']), 0);
  assert.match(
    help.stdout(),
    /Usage: node scripts\/security\/run-posture-sweep\.mjs/
  );
  assert.match(help.stdout(), /Exit codes:/);
  const bad = cliHarness();
  assert.equal(await bad.run(['--bogus']), 2);
  assert.match(bad.stdout(), /error=usage/);
  assert.equal(bad.created.length, 0, 'no probe was created');
});

test('a standalone sweep writes both private reports and prints counts only', async () => {
  const h = cliHarness();
  assert.equal(await h.run(), 0);
  const report = JSON.parse(h.report('latest-posture-sweep.json'));
  assert.equal(report.schema_version, '1.0');
  assert.equal(report.summary.checks.fail, 0);
  assert.equal(report.targets.web_host, 'www.example.test');
  assert.match(
    h.report('latest-posture-sweep.md'),
    /^# DavinTrade live posture sweep \(private\)/
  );
  const out = h.stdout();
  for (const line of h.logs) {
    assert.deepEqual(findPrivacyViolations(line), [], line);
    assert.equal(line.includes('privacy guard'), false, line);
  }
  assert.match(out, /DavinTrade live posture sweep \(counts only\)/);
  assert.match(out, /posture_checks: total=\d+ pass=\d+ fail=0/);
  assert.match(out, /reports: latest-posture-sweep\.json and \.md written/);
  for (const sentinel of ['example.test', 'svc-a', 'chat-box']) {
    assert.equal(out.includes(sentinel), false, `leaked: ${sentinel}`);
  }
});

test('the command passes the repository, root and token to the probes', async () => {
  const h = cliHarness();
  await h.run(['--repo', 'owner/name'], {
    DEPENDABOT_TRIAGE_TOKEN: SECRET_TOKEN,
  });
  assert.deepEqual(h.created, [
    { root: '/repo', token: SECRET_TOKEN, repo: 'owner/name' },
  ]);
  assert.equal(
    h.credentialCalls.length,
    0,
    'the env token wins; Git is not asked'
  );
  // the token never reaches stdout or a report
  const everything = [h.stdout(), ...h.fs.files.values()].join('\n');
  assert.equal(everything.includes(SECRET_TOKEN), false);
});

test('without a token in the environment the command asks Git for its credential', async () => {
  const h = cliHarness({
    credential: `protocol=https\nhost=github.com\nusername=x\npassword=${SECRET_TOKEN}\n`,
  });
  await h.run();
  assert.equal(h.credentialCalls.length, 1);
  assert.equal(h.created[0].token, SECRET_TOKEN);
});

test('offline never asks for a credential and probes nothing over the network', async () => {
  const fake = fakeProbes();
  const h = cliHarness({ probes: fake.probes });
  assert.equal(await h.run(['--offline']), 0);
  assert.equal(h.credentialCalls.length, 0);
  assert.equal(h.created[0].token, null);
  assert.deepEqual(fake.calls.web, []);
  assert.deepEqual(fake.calls.github, []);
  assert.match(h.stdout(), /mode=offline/);
});

test('--no-fetch and --main-ref reach the sweep', async () => {
  const fake = fakeProbes();
  const h = cliHarness({ probes: fake.probes });
  assert.equal(await h.run(['--no-fetch', '--main-ref', 'origin/release']), 0);
  assert.equal(fake.calls.git.includes('fetch'), false);
  assert.ok(fake.calls.git.includes('resolve origin/release'));
  assert.equal(
    JSON.parse(h.report('latest-posture-sweep.json')).run.main_ref,
    'origin/release'
  );
});

test('--pipeline-dir moves the reports and the runtime state is read from there', async () => {
  const state = JSON.stringify({
    ...RUNTIME_STATE,
    assets: { 'svc-a': { node: '24.10.0', commit_sha: KNOWN } },
  });
  const h = cliHarness({
    files: { '/elsewhere/reports/runtime-state.json': state },
  });
  assert.equal(await h.run(['--pipeline-dir', '/elsewhere']), 0);
  assert.ok(h.fs.files.has('/elsewhere/reports/latest-posture-sweep.json'));
  assert.equal(h.report('latest-posture-sweep.json'), undefined);
  const report = JSON.parse(
    h.fs.files.get('/elsewhere/reports/latest-posture-sweep.json')
  );
  assert.equal(report.summary.tiers.P1, 1, 'the Node floor breach is found');
});

test('setup errors exit 2 with a fixed code', async () => {
  const noInventory = cliHarness();
  noInventory.fs.files.delete('/repo/security/security-inventory.yaml');
  assert.equal(await noInventory.run(), 2);
  assert.match(noInventory.stdout(), /error=inventory_not_found/);
  const unknown = cliHarness();
  assert.equal(await unknown.run(['--assets', 'no-such-asset']), 2);
  assert.match(unknown.stdout(), /error=unknown_asset/);
  const broken = cliHarness({
    files: { '/repo/security/security-inventory.yaml': ': : not yaml [' },
  });
  assert.equal(await broken.run(), 2);
});

test('an unreadable runtime state skips the runtime area and says so', async () => {
  const h = cliHarness({
    files: { [`${PIPELINE_DIR}/reports/runtime-state.json`]: '{ not json' },
  });
  assert.equal(await h.run(), 0);
  const report = JSON.parse(h.report('latest-posture-sweep.json'));
  assert.equal(report.summary.areas.runtime, 'skipped');
  assert.ok(report.notes.some((n) => /runtime-state\.json/.test(n)));
});

test('a probe that throws cannot crash the command', async () => {
  const fake = fakeProbes();
  fake.probes.github = async () => {
    throw new Error('boom');
  };
  const h = cliHarness({ probes: fake.probes });
  assert.equal(await h.run(), 0);
  assert.match(h.stdout(), /degraded=yes/);
  assert.match(h.stdout(), /github=unavailable/);
});

test('a report that cannot be written exits 1 with a fixed code', async () => {
  const h = cliHarness();
  h.deps.fs.writeText = () => {
    throw new Error('disk full: /secret/path');
  };
  assert.equal(await h.run(), 1);
  assert.match(h.stdout(), /error=report_write_failed/);
  assert.equal(h.stdout().includes('/secret/path'), false);
});

test('an unexpected failure prints one fixed line, never the error text', async () => {
  const h = cliHarness();
  h.deps.createProbes = () => {
    throw new Error('internal: value-that-must-not-be-printed');
  };
  assert.equal(await h.run(), 1);
  assert.equal(h.stdout(), 'error=unexpected_failure');
});
