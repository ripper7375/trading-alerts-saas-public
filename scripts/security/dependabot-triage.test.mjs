// Run: node --test 'scripts/security/*.test.mjs'
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DISMISS_BODY,
  NONPROD_PREFIXES,
  isSameOrigin,
  matchNonProdPrefix,
  parseArgs,
  parseNextLink,
  rateLimitState,
  runTriage,
  dismissAlerts,
} from './dependabot-triage-lib.mjs';

const API = 'https://api.github.com';
const REPO = 'ripper7375/trading-alerts-saas-public';
const TOKEN = 'ghp_TESTTOKEN_never_printed_1234567890';
const LIST_URL = `${API}/repos/${REPO}/dependabot/alerts?state=open&per_page=100`;

// Strings that must never reach the output.
const SECRET_ADVISORY = 'GHSA-abcd-efgh-ijkl';
const SECRET_CVE = 'CVE-2026-424242';
const SECRET_PACKAGE = 'leaky-package-name';
const SECRET_VERSION = '9.8.7-leak';
const SECRET_SUMMARY = 'Prototype pollution in leaky helper';

function alert(number, manifestPath) {
  return {
    number,
    state: 'open',
    dependency: {
      manifest_path: manifestPath,
      package: { ecosystem: 'npm', name: SECRET_PACKAGE },
      scope: 'runtime',
    },
    security_advisory: {
      ghsa_id: SECRET_ADVISORY,
      cve_id: SECRET_CVE,
      summary: SECRET_SUMMARY,
      severity: 'high',
    },
    security_vulnerability: {
      package: { name: SECRET_PACKAGE },
      vulnerable_version_range: `< ${SECRET_VERSION}`,
    },
  };
}

function headers(values = {}) {
  const map = new Map(
    Object.entries(values).map(([k, v]) => [k.toLowerCase(), String(v)])
  );
  return { get: (name) => map.get(name.toLowerCase()) ?? null };
}

function response(status, body, headerValues = {}) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: headers({ 'x-ratelimit-remaining': 4000, ...headerValues }),
    json: async () => body,
  };
}

/**
 * A fake GitHub: `pages` is a list of alert arrays served through Link
 * headers; `patch` decides each PATCH response.
 */
function fakeGitHub({ pages, patch = () => response(200, {}) }) {
  const calls = [];
  const fetchImpl = async (url, init) => {
    calls.push({
      url,
      method: init.method,
      headers: init.headers,
      body: init.body,
    });
    if (init.method === 'GET') {
      const page =
        url === LIST_URL
          ? 0
          : Number(new URL(url).searchParams.get('page')) - 1;
      const link =
        page + 1 < pages.length
          ? `<${API}/repositories/1/dependabot/alerts?state=open&per_page=100&page=${page + 2}>; rel="next", <${API}/x?page=9>; rel="last"`
          : `<${API}/x?page=1>; rel="first"`;
      return response(200, pages[page], { link });
    }
    if (init.method === 'PATCH') {
      const number = Number(url.split('/').pop());
      return patch(number, calls.filter((c) => c.method === 'PATCH').length);
    }
    throw new Error('unexpected method');
  };
  return { fetchImpl, calls };
}

async function run(
  argv,
  github,
  env = { DEPENDABOT_TRIAGE_TOKEN: TOKEN },
  extra = {}
) {
  const lines = [];
  const code = await runTriage({
    argv,
    env,
    fetchImpl: github.fetchImpl,
    log: (line) => lines.push(line),
    apiBase: API,
    ...extra,
  });
  return { code, lines, output: lines.join('\n') };
}

function value(lines, key) {
  const line = lines.find((l) => l.startsWith(`${key}=`));
  return line === undefined ? undefined : line.slice(key.length + 1);
}

function assertNoLeak(output) {
  for (const secret of [
    SECRET_ADVISORY,
    SECRET_CVE,
    SECRET_PACKAGE,
    SECRET_VERSION,
    SECRET_SUMMARY,
    TOKEN,
  ]) {
    assert.equal(output.includes(secret), false, `output leaked ${secret}`);
  }
  assert.doesNotMatch(output, /GHSA-[a-z0-9]{4}-/i);
  assert.doesNotMatch(output, /CVE-\d{4}-\d+/i);
  assert.doesNotMatch(output, /Bearer/i);
}

const MIXED_PAGE = [
  alert(1, 'seed-code/v0-components/package-lock.json'),
  alert(2, 'package.json'),
  alert(3, 'archive/old/package.json'),
  alert(4, 'money-service/package-lock.json'),
  alert(
    5,
    'frontend-and-backend-python-stack/davintrade-prototype/requirements.txt'
  ),
  alert(6, 'mobile-app/package.json'),
  alert(7, 'davintrade-mobile-app/yarn.lock'),
  alert(8, 'pnpm-lock.yaml'),
];

// ---------------------------------------------------------------- matching

test('every non-production prefix matches files below it', () => {
  const cases = {
    'seed-code/': [
      'seed-code/stack-auth/package.json',
      'seed-code/a/b/c/pnpm-lock.yaml',
    ],
    'archive/': ['archive/package.json', 'archive/2025/web/package-lock.json'],
    'frontend-and-backend-python-stack/davintrade-prototype/': [
      'frontend-and-backend-python-stack/davintrade-prototype/requirements.txt',
      'frontend-and-backend-python-stack/davintrade-prototype/web/package.json',
    ],
    'mobile-app/': ['mobile-app/package.json'],
    'davintrade-mobile-app/': ['davintrade-mobile-app/ios/Podfile.lock'],
  };
  assert.deepEqual(Object.keys(cases), [...NONPROD_PREFIXES]);
  for (const [prefix, paths] of Object.entries(cases)) {
    for (const path of paths)
      assert.equal(matchNonProdPrefix(path), prefix, path);
  }
});

test('leading ./ or / and Windows separators are normalised', () => {
  assert.equal(matchNonProdPrefix('./seed-code/x/package.json'), 'seed-code/');
  assert.equal(matchNonProdPrefix('/archive/x/package.json'), 'archive/');
  assert.equal(matchNonProdPrefix('mobile-app\\package.json'), 'mobile-app/');
});

test('live production manifests never match', () => {
  const live = [
    'package.json',
    'pnpm-lock.yaml',
    'packages/types/package.json',
    'money-service/package.json',
    'money-service/package-lock.json',
    'operation-service/package.json',
    'operation-service/package-lock.json',
    'railway-gateway/package.json',
    'railway-gateway/package-lock.json',
    'railway-gateway/python-requirements.txt',
    'mt5-service/requirements.txt',
    'mt5-service/requirements-dev.txt',
    'knowledge-service/requirements.txt',
    'knowledge-service/pyproject.toml',
    'infra/pgbouncer/Dockerfile',
    'infra/contabo-chat-stack/apps/server/package-lock.json',
    'davintrade-stack-d-and-e/package.json',
    'davintrade-stack-d-and-e/archive/package.json',
    'davintrade-stack-d-and-e/seed-code/package.json',
  ];
  for (const path of live) assert.equal(matchNonProdPrefix(path), null, path);
});

test('look-alike directories and odd input never match', () => {
  const lookAlikes = [
    'seed-code',
    'seed-codex/package.json',
    'seed-code-live/package.json',
    'archived/package.json',
    'archive-docs/package.json',
    'mobile-apps/package.json',
    'mobile-app-live/package.json',
    'davintrade-mobile-app-v2/package.json',
    'frontend-and-backend-python-stack/package.json',
    'frontend-and-backend-python-stack/davintrade-prototype-v2/package.json',
    'apps/seed-code/package.json',
    'docs/archive/package.json',
    'seed-code/../package.json',
    '',
  ];
  for (const path of lookAlikes)
    assert.equal(matchNonProdPrefix(path), null, path);
  for (const bad of [undefined, null, 42, {}, []])
    assert.equal(matchNonProdPrefix(bad), null);
});

// ---------------------------------------------------------------- Link header

test('parseNextLink reads rel="next" in any position', () => {
  assert.equal(
    parseNextLink(
      '<https://api.github.com/a?page=2>; rel="next", <https://api.github.com/a?page=5>; rel="last"'
    ),
    'https://api.github.com/a?page=2'
  );
  assert.equal(
    parseNextLink(
      '<https://api.github.com/a?page=1>; rel="prev", <https://api.github.com/a?after=Y3Vy>; rel="next"'
    ),
    'https://api.github.com/a?after=Y3Vy'
  );
  assert.equal(
    parseNextLink('<https://api.github.com/a?page=1>; rel="prev next"'),
    'https://api.github.com/a?page=1'
  );
});

test('parseNextLink returns null without a next link', () => {
  assert.equal(
    parseNextLink('<https://api.github.com/a?page=1>; rel="first"'),
    null
  );
  assert.equal(parseNextLink(''), null);
  assert.equal(parseNextLink(null), null);
  assert.equal(parseNextLink(undefined), null);
  assert.equal(parseNextLink('garbage'), null);
});

test('isSameOrigin keeps the token on the API host', () => {
  assert.equal(isSameOrigin('https://api.github.com/x?page=2', API), true);
  assert.equal(isSameOrigin('https://evil.example/x', API), false);
  assert.equal(isSameOrigin('http://api.github.com/x', API), false);
  assert.equal(isSameOrigin('not a url', API), false);
});

// ---------------------------------------------------------------- arguments

test('parseArgs defaults and flags', () => {
  assert.deepEqual(parseArgs([]), {
    dryRun: false,
    strictRateLimit: false,
    maxDismiss: 4500,
    repo: REPO,
  });
  const parsed = parseArgs([
    '--dry-run',
    '--max-dismiss',
    '800',
    '--repo=octo/demo',
    '--strict-rate-limit',
  ]);
  assert.equal(parsed.dryRun, true);
  assert.equal(parsed.maxDismiss, 800);
  assert.equal(parsed.repo, 'octo/demo');
  assert.equal(parsed.strictRateLimit, true);
  assert.equal(parseArgs(['--max-dismiss=0']).maxDismiss, 0);
});

test('parseArgs rejects bad values', () => {
  assert.throws(() => parseArgs(['--max-dismiss', '-1']));
  assert.throws(() => parseArgs(['--max-dismiss', '12abc']));
  assert.throws(() => parseArgs(['--max-dismiss']));
  assert.throws(() => parseArgs(['--repo', 'no-slash']));
  assert.throws(() => parseArgs(['--repo', 'a/b/c']));
  assert.throws(() => parseArgs(['--surprise']));
});

test('a usage error exits 64 and makes no request', async () => {
  const github = fakeGitHub({ pages: [MIXED_PAGE] });
  const { code } = await run(['--max-dismiss', 'lots'], github);
  assert.equal(code, 64);
  assert.equal(github.calls.length, 0);
});

// ---------------------------------------------------------------- token

test('a missing token exits 1 without a request', async () => {
  const github = fakeGitHub({ pages: [MIXED_PAGE] });
  const { code, output } = await run([], github, {});
  assert.equal(code, 1);
  assert.match(output, /missing_token/);
  assert.equal(github.calls.length, 0);
});

test('GITHUB_TOKEN is the fallback and the token is sent but never printed', async () => {
  const github = fakeGitHub({ pages: [MIXED_PAGE] });
  const { code, output } = await run(['--dry-run'], github, {
    GITHUB_TOKEN: TOKEN,
  });
  assert.equal(code, 0);
  assert.equal(github.calls[0].headers.Authorization, `Bearer ${TOKEN}`);
  assertNoLeak(output);
});

// ---------------------------------------------------------------- dry run

test('dry run lists every page, prints counts and sends no PATCH', async () => {
  const github = fakeGitHub({
    pages: [
      MIXED_PAGE,
      [
        alert(9, 'seed-code/z/package.json'),
        alert(10, 'infra/pgbouncer/Dockerfile'),
      ],
    ],
  });
  const { code, lines, output } = await run(['--dry-run'], github);
  assert.equal(code, 0);
  assert.equal(github.calls.filter((c) => c.method === 'PATCH').length, 0);
  assert.equal(github.calls.filter((c) => c.method === 'GET').length, 2);
  assert.equal(value(lines, 'mode'), 'dry-run');
  assert.equal(value(lines, 'scanned'), '10');
  assert.equal(value(lines, 'matched'), '6');
  assert.equal(value(lines, 'would_dismiss'), '6');
  assert.equal(value(lines, 'dismissed'), '0');
  assert.equal(value(lines, 'remaining_matched'), '6');
  assert.equal(value(lines, 'live_open_remaining'), '4');
  assert.ok(lines.includes('matched_prefix seed-code/ 2'));
  assert.ok(lines.includes('matched_prefix archive/ 1'));
  assertNoLeak(output);
});

// ---------------------------------------------------------------- live run

test('live run collects every page before the first PATCH, then dismisses with the fixed body', async () => {
  const github = fakeGitHub({
    pages: [
      MIXED_PAGE,
      [
        alert(9, 'seed-code/z/package.json'),
        alert(10, 'infra/pgbouncer/Dockerfile'),
      ],
    ],
  });
  const { code, lines, output } = await run([], github);
  assert.equal(code, 0);
  const methods = github.calls.map((c) => c.method);
  assert.equal(methods.lastIndexOf('GET') < methods.indexOf('PATCH'), true);
  const patches = github.calls.filter((c) => c.method === 'PATCH');
  assert.deepEqual(
    patches.map((c) => Number(c.url.split('/').pop())).sort((a, b) => a - b),
    [1, 3, 5, 6, 7, 9]
  );
  for (const call of patches) {
    assert.deepEqual(JSON.parse(call.body), DISMISS_BODY);
    assert.equal(
      call.url.startsWith(`${API}/repos/${REPO}/dependabot/alerts/`),
      true
    );
  }
  assert.equal(value(lines, 'dismissed'), '6');
  assert.equal(value(lines, 'remaining_matched'), '0');
  assert.equal(value(lines, 'live_open_remaining'), '4');
  assert.equal(value(lines, 'stopped_reason'), 'none');
  assertNoLeak(output);
});

test('--max-dismiss caps the batch and says so', async () => {
  const github = fakeGitHub({ pages: [MIXED_PAGE] });
  const { code, lines } = await run(['--max-dismiss', '2'], github);
  assert.equal(code, 0);
  assert.equal(github.calls.filter((c) => c.method === 'PATCH').length, 2);
  assert.equal(value(lines, 'dismissed'), '2');
  assert.equal(value(lines, 'remaining_matched'), '3');
  assert.equal(value(lines, 'stopped_reason'), 'max_dismiss_reached');
});

test('--max-dismiss 0 dismisses nothing', async () => {
  const github = fakeGitHub({ pages: [MIXED_PAGE] });
  const { code, lines } = await run(['--max-dismiss', '0'], github);
  assert.equal(code, 0);
  assert.equal(github.calls.filter((c) => c.method === 'PATCH').length, 0);
  assert.equal(value(lines, 'remaining_matched'), '5');
});

test('concurrency never exceeds the bound', async () => {
  let inFlight = 0;
  let peak = 0;
  const alerts = Array.from({ length: 40 }, (_, i) => ({
    number: i + 1,
    prefix: 'seed-code/',
  }));
  const result = await dismissAlerts({
    apiBase: API,
    repo: REPO,
    token: TOKEN,
    alerts,
    concurrency: 5,
    fetchImpl: async () => {
      inFlight += 1;
      peak = Math.max(peak, inFlight);
      await new Promise((resolve) => setTimeout(resolve, 2));
      inFlight -= 1;
      return response(200, {});
    },
  });
  assert.equal(result.dismissed, 40);
  assert.equal(peak <= 5, true);
  assert.equal(peak > 1, true);
});

// ---------------------------------------------------------------- rate limit

test('rateLimitState reads quota and rate-limit responses', () => {
  assert.deepEqual(
    rateLimitState(200, headers({ 'x-ratelimit-remaining': 151 })),
    { stop: false, reason: null }
  );
  assert.deepEqual(
    rateLimitState(200, headers({ 'x-ratelimit-remaining': 150 })),
    {
      stop: true,
      reason: 'rate_limit_reserve',
    }
  );
  assert.equal(rateLimitState(429, headers({})).reason, 'rate_limited');
  assert.equal(
    rateLimitState(403, headers({ 'x-ratelimit-remaining': 0 })).reason,
    'rate_limited'
  );
  assert.equal(
    rateLimitState(
      403,
      headers({ 'retry-after': 60, 'x-ratelimit-remaining': 900 })
    ).reason,
    'rate_limited'
  );
  assert.deepEqual(
    rateLimitState(403, headers({ 'x-ratelimit-remaining': 900 })),
    { stop: false, reason: null }
  );
  assert.deepEqual(rateLimitState(200, headers({})), {
    stop: false,
    reason: null,
  });
});

test('reaching the quota reserve stops dispatching and exits 0', async () => {
  const alerts = Array.from({ length: 30 }, (_, i) =>
    alert(i + 1, 'seed-code/x/package.json')
  );
  const github = fakeGitHub({
    pages: [alerts],
    patch: (_n, count) =>
      response(200, {}, { 'x-ratelimit-remaining': count >= 3 ? 150 : 400 }),
  });
  const { code, lines, output } = await run([], github, undefined, {
    concurrency: 1,
  });
  assert.equal(code, 0);
  assert.equal(github.calls.filter((c) => c.method === 'PATCH').length, 3);
  assert.equal(value(lines, 'dismissed'), '3');
  assert.equal(value(lines, 'remaining_matched'), '27');
  assert.equal(value(lines, 'stopped_reason'), 'rate_limit_reserve');
  assertNoLeak(output);
});

test('a 429 stops dispatching; --strict-rate-limit turns it into exit 2', async () => {
  const alerts = Array.from({ length: 20 }, (_, i) =>
    alert(i + 1, 'archive/x/package.json')
  );
  const patch = (_n, count) =>
    count >= 4 ? response(429, {}, { 'retry-after': 30 }) : response(200, {});
  const graceful = fakeGitHub({ pages: [alerts], patch });
  const first = await run([], graceful, undefined, { concurrency: 1 });
  assert.equal(first.code, 0);
  assert.equal(value(first.lines, 'stopped_reason'), 'rate_limited');
  assert.equal(value(first.lines, 'dismissed'), '3');
  assert.equal(value(first.lines, 'failed'), '0');
  assert.equal(graceful.calls.filter((c) => c.method === 'PATCH').length, 4);

  const strict = fakeGitHub({ pages: [alerts], patch });
  const second = await run(['--strict-rate-limit'], strict, undefined, {
    concurrency: 1,
  });
  assert.equal(second.code, 2);
});

test('a rate-limited listing sends no PATCH', async () => {
  const github = {
    calls: [],
    fetchImpl: async (url, init) => {
      github.calls.push({ method: init.method });
      return response(
        403,
        { message: SECRET_SUMMARY },
        { 'x-ratelimit-remaining': 0 }
      );
    },
  };
  const { code, lines, output } = await run([], github);
  assert.equal(code, 0);
  assert.equal(value(lines, 'stopped_reason'), 'rate_limited_while_listing');
  assert.equal(
    github.calls.every((c) => c.method === 'GET'),
    true
  );
  assertNoLeak(output);
});

// ---------------------------------------------------------------- failures

test('a forbidden PATCH stops the run and exits 1', async () => {
  const alerts = Array.from({ length: 10 }, (_, i) =>
    alert(i + 1, 'seed-code/x/package.json')
  );
  const github = fakeGitHub({
    pages: [alerts],
    patch: () =>
      response(
        403,
        { message: SECRET_SUMMARY },
        { 'x-ratelimit-remaining': 900 }
      ),
  });
  const { code, lines, output } = await run([], github, undefined, {
    concurrency: 1,
  });
  assert.equal(code, 1);
  assert.equal(value(lines, 'stopped_reason'), 'patch_http_403');
  assert.equal(github.calls.filter((c) => c.method === 'PATCH').length, 1);
  assertNoLeak(output);
});

test('a failed listing exits 1 and sends no PATCH', async () => {
  const github = {
    calls: [],
    fetchImpl: async (url, init) => {
      github.calls.push({ method: init.method });
      return response(404, { message: SECRET_SUMMARY });
    },
  };
  const { code, lines } = await run([], github);
  assert.equal(code, 1);
  assert.equal(value(lines, 'stopped_reason'), 'list_http_404');
  assert.equal(github.calls.length, 1);
});

test('a next link to another host is refused', async () => {
  const github = {
    calls: [],
    fetchImpl: async (url, init) => {
      github.calls.push({ url, method: init.method });
      return response(200, MIXED_PAGE, {
        link: '<https://evil.example/steal?page=2>; rel="next"',
      });
    },
  };
  const { code, lines } = await run([], github);
  assert.equal(code, 1);
  assert.equal(value(lines, 'stopped_reason'), 'list_next_link_off_origin');
  assert.equal(github.calls.length, 1);
  assert.equal(
    github.calls.some((c) => c.method === 'PATCH'),
    false
  );
});

test('an unreadable body or a network error never leaks its text', async () => {
  const github = {
    fetchImpl: async () => ({
      ok: true,
      status: 200,
      headers: headers({}),
      json: async () => {
        throw new SyntaxError(
          `Unexpected token in "${SECRET_ADVISORY} ${SECRET_PACKAGE}"`
        );
      },
    }),
  };
  const { code, lines, output } = await run([], github);
  assert.equal(code, 1);
  assert.equal(value(lines, 'stopped_reason'), 'list_network_error');
  assertNoLeak(output);
});

test('every printed line is a fixed key with a count or a fixed prefix', async () => {
  const github = fakeGitHub({ pages: [MIXED_PAGE] });
  const { lines } = await run([], github);
  const allowed = new RegExp(
    `^(mode=(live|dry-run)|(scanned|matched|max_dismiss|would_dismiss|dismissed|failed|remaining_matched|live_open_remaining)=\\d+|stopped_reason=[a-z_0-9]+|matched_prefix (${NONPROD_PREFIXES.map((p) => p.replace(/[/-]/g, '\\$&')).join('|')}) \\d+)$`
  );
  for (const line of lines) assert.match(line, allowed);
});
