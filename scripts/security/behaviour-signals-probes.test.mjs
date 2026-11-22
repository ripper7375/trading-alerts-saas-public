// Run: node --test 'scripts/security/*.test.mjs'
//
// The real probes of the behaviour signals (behaviour-signals-probes.mjs), entirely offline:
// the GitHub API is a small fake repository, the gateway health endpoint is a fake `fetch`.
// Hosts are invented (`.test`); nothing here touches the network.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createBehaviourProbes,
  createMainPushProbe,
  createQueueProbe,
} from './behaviour-signals-probes.mjs';
import { runBehaviourSignals } from './behaviour-signals-lib.mjs';

const NOW = new Date('2026-11-22T12:00:00Z');
const HOUR = 3600000;
const ago = (ms) => new Date(NOW.getTime() - ms).toISOString();
const H = (n) => n.toString(16).padStart(2, '0').repeat(20); // 40 hex characters

// --- a fake GitHub: commits by sha, the branch tip, the pull requests of a commit ---------------------

const apiCommit = (
  n,
  parents,
  { at = ago(HOUR), message = `commit ${n}` } = {}
) => ({
  sha: H(n),
  parents: parents.map((p) => ({ sha: H(p) })),
  commit: { committer: { date: at }, author: { date: at }, message },
});
const apiPull = (number, { merged = true, base = 'main' } = {}) => ({
  number,
  merged_at: merged ? ago(HOUR) : null,
  base: { ref: base },
});

/**
 * A fake `github` probe (the interface of createGithubProbe). `commits` maps a number to its API
 * body; `tip` is the number of the branch tip; `pulls` maps a number to the list the pulls
 * endpoint returns; `failing` maps a path to the failure it answers with.
 */
function fakeGithub({ commits, tip, pulls = {}, failing = {}, delayMs = 0 }) {
  const calls = [];
  let inFlight = 0;
  let maxInFlight = 0;
  const github = async ({ path }) => {
    calls.push(path);
    inFlight += 1;
    maxInFlight = Math.max(maxInFlight, inFlight);
    if (delayMs > 0) await new Promise((done) => setTimeout(done, delayMs));
    inFlight -= 1;
    if (failing[path]) return failing[path];
    let m = /^\/commits\/(main|trunk)$/.exec(path);
    if (m) return { ok: true, status: 200, body: commits[tip] };
    m = /^\/commits\/([0-9a-f]{40})\/pulls$/.exec(path);
    if (m) {
      const n = Number.parseInt(m[1].slice(0, 2), 16);
      return { ok: true, status: 200, body: pulls[n] ?? [] };
    }
    m = /^\/commits\/([0-9a-f]{40})$/.exec(path);
    if (m) {
      const n = Number.parseInt(m[1].slice(0, 2), 16);
      return commits[n]
        ? { ok: true, status: 200, body: commits[n] }
        : { ok: false, status: 404, body: null, error: 'http_404' };
    }
    return { ok: false, status: 0, body: null, error: 'bad_path' };
  };
  return {
    github,
    calls,
    maxInFlight: () => maxInFlight,
  };
}

// main: M3 <- M2 <- M1 <- M0 (30 hours old); each merge has a side-branch parent that is never fetched
const GRAPH = () => ({
  13: apiCommit(13, [12, 23], {
    at: ago(1 * HOUR),
    message: 'Merge pull request #513 from owner/b3\n\nbody',
  }),
  12: apiCommit(12, [11, 22], {
    at: ago(2 * HOUR),
    message: 'Merge pull request #512 from owner/b2',
  }),
  11: apiCommit(11, [10, 21], {
    at: ago(3 * HOUR),
    message: 'Merge pull request #511 from owner/b1',
  }),
  10: apiCommit(10, [9], { at: ago(30 * HOUR), message: 'older work' }),
  9: apiCommit(9, [], { at: ago(31 * HOUR), message: 'the first commit' }),
});
const PULLS = { 13: [apiPull(513)], 12: [apiPull(512)], 11: [apiPull(511)] };
const DATE_BASELINE = { source: 'recorded', at: ago(24 * HOUR), sha: null };
const ask = (probe, over = {}) =>
  probe({
    baseline: DATE_BASELINE,
    mainBranch: 'main',
    maxCommits: 60,
    ...over,
  });

// --- the first-parent walk ------------------------------------------------------------------------------------------

test('main push probe: walks the first-parent line from the tip and stops before the baseline time', async () => {
  const fake = fakeGithub({ commits: GRAPH(), tip: 13, pulls: PULLS });
  const result = await ask(createMainPushProbe({ github: fake.github }));
  assert.equal(result.ok, true);
  assert.equal(result.truncated, false);
  assert.equal(result.anchorFound, null);
  assert.deepEqual(
    result.commits.map((c) => [c.sha, c.parents, c.subject]),
    [
      [H(13), 2, 'Merge pull request #513 from owner/b3'],
      [H(12), 2, 'Merge pull request #512 from owner/b2'],
      [H(11), 2, 'Merge pull request #511 from owner/b1'],
    ]
  );
  assert.deepEqual(result.commits[0].pulls, [
    { number: 513, merged: true, baseRef: 'main' },
  ]);
  assert.equal(result.commits[0].at, ago(HOUR));
  // the side branches are never asked for; the first commit older than the baseline is read once
  assert.equal(
    fake.calls.some((p) => /\/commits\/(15|16|17)/.test(p)),
    false
  );
  assert.deepEqual(
    fake.calls.filter((p) => !p.endsWith('/pulls')),
    [
      '/commits/main',
      `/commits/${H(12)}`,
      `/commits/${H(11)}`,
      `/commits/${H(10)}`,
    ]
  );
  assert.deepEqual(
    fake.calls.filter((p) => p.endsWith('/pulls')).sort(),
    [H(11), H(12), H(13)].map((s) => `/commits/${s}/pulls`).sort()
  );
});

test('main push probe: a tip that is older than the baseline means nothing new', async () => {
  const fake = fakeGithub({ commits: GRAPH(), tip: 10 });
  const result = await ask(createMainPushProbe({ github: fake.github }));
  assert.deepEqual(result, {
    ok: true,
    commits: [],
    truncated: false,
    anchorFound: null,
  });
  assert.deepEqual(fake.calls, ['/commits/main']);
});

test('main push probe: a commit with no pull request carries an empty list; a lookup that failed carries null', async () => {
  const fake = fakeGithub({
    commits: GRAPH(),
    tip: 13,
    pulls: { 13: [], 11: [apiPull(511)] },
    failing: {
      [`/commits/${H(12)}/pulls`]: {
        ok: false,
        status: 500,
        body: null,
        error: 'http_500',
      },
    },
  });
  const { commits } = await ask(createMainPushProbe({ github: fake.github }));
  assert.deepEqual(
    commits.map((c) => [c.sha, c.pulls]),
    [
      [H(13), []],
      [H(12), null],
      [H(11), [{ number: 511, merged: true, baseRef: 'main' }]],
    ]
  );
});

test('main push probe: a pull request that is open, or merged elsewhere, is reported as it is', async () => {
  const fake = fakeGithub({
    commits: GRAPH(),
    tip: 13,
    pulls: {
      13: [apiPull(1, { merged: false }), apiPull(2, { base: 'release' })],
      12: [{ number: 'x', merged_at: 'never', base: {} }, null, 'text'],
    },
  });
  const { commits } = await ask(createMainPushProbe({ github: fake.github }));
  assert.deepEqual(commits[0].pulls, [
    { number: 1, merged: false, baseRef: 'main' },
    { number: 2, merged: true, baseRef: 'release' },
  ]);
  assert.deepEqual(commits[1].pulls, [
    { number: null, merged: false, baseRef: null },
  ]);
});

test('main push probe: at most maxCommits commits are returned and the walk says it was cut', async () => {
  const fake = fakeGithub({ commits: GRAPH(), tip: 13, pulls: PULLS });
  const result = await ask(createMainPushProbe({ github: fake.github }), {
    maxCommits: 2,
  });
  assert.equal(result.ok, true);
  assert.equal(result.truncated, true);
  assert.deepEqual(
    result.commits.map((c) => c.sha),
    [H(13), H(12)]
  );
  assert.equal(fake.calls.filter((p) => p.endsWith('/pulls')).length, 2);
});

// --- the anchor and a forged date ----------------------------------------------------------------------------------

test('main push probe: a baseline commit is the stop, found by its abbreviation, whatever the dates say', async () => {
  const fake = fakeGithub({ commits: GRAPH(), tip: 13, pulls: PULLS });
  const result = await ask(createMainPushProbe({ github: fake.github }), {
    baseline: { source: 'anchor', at: null, sha: H(10).slice(0, 10) },
  });
  assert.equal(result.anchorFound, true);
  assert.deepEqual(
    result.commits.map((c) => c.sha),
    [H(13), H(12), H(11)]
  );
});

test('main push probe: an anchor that is not on the first-parent line is reported, with what was walked', async () => {
  const fake = fakeGithub({ commits: GRAPH(), tip: 13, pulls: PULLS });
  const result = await ask(createMainPushProbe({ github: fake.github }), {
    baseline: { source: 'anchor', at: null, sha: H(99).slice(0, 10) },
  });
  assert.equal(result.ok, true);
  assert.equal(result.anchorFound, false);
  // the walk ended at the first commit of the repository
  assert.deepEqual(
    result.commits.map((c) => c.sha),
    [H(13), H(12), H(11), H(10), H(9)]
  );
});

test('main push probe: a forged old commit date hides a commit from a time baseline, but not from an anchor', async () => {
  const forged = GRAPH();
  forged[11] = apiCommit(11, [10, 21], {
    at: '2001-01-01T00:00:00Z',
    message: 'fix: pushed straight to main',
  });
  const byTime = await ask(
    createMainPushProbe({
      github: fakeGithub({ commits: forged, tip: 13, pulls: PULLS }).github,
    })
  );
  assert.deepEqual(
    byTime.commits.map((c) => c.sha),
    [H(13), H(12)]
  ); // the limit of a time baseline, documented in the runbook
  const byAnchor = await ask(
    createMainPushProbe({
      github: fakeGithub({ commits: forged, tip: 13, pulls: PULLS }).github,
    }),
    { baseline: { source: 'anchor', at: null, sha: H(10) } }
  );
  assert.deepEqual(
    byAnchor.commits.map((c) => c.sha),
    [H(13), H(12), H(11)]
  );
});

test('main push probe: a commit made exactly at the baseline time is examined, one before it is not', async () => {
  const graph = GRAPH();
  graph[11] = apiCommit(11, [10, 21], {
    at: DATE_BASELINE.at,
    message: 'made at the baseline',
  });
  const result = await ask(
    createMainPushProbe({
      github: fakeGithub({ commits: graph, tip: 13, pulls: PULLS }).github,
    })
  );
  assert.deepEqual(
    result.commits.map((c) => c.sha),
    [H(13), H(12), H(11)]
  );
});

// --- failures and bad input ------------------------------------------------------------------------------------------

test('main push probe: a failed API answer is a fixed code, never a message', async () => {
  const run = (failing, over) =>
    ask(
      createMainPushProbe({
        github: fakeGithub({ commits: GRAPH(), tip: 13, pulls: PULLS, failing })
          .github,
      }),
      over
    );
  assert.deepEqual(
    await run({
      '/commits/main': {
        ok: false,
        status: 404,
        body: null,
        error: 'http_404',
      },
    }),
    { ok: false, error: 'http_404' }
  );
  assert.deepEqual(
    await run({
      '/commits/main': {
        ok: false,
        status: 403,
        body: null,
        rateLimited: true,
        error: 'http_403',
      },
    }),
    { ok: false, error: 'rate_limited' }
  );
  assert.deepEqual(
    await run({
      [`/commits/${H(12)}`]: {
        ok: false,
        status: 0,
        body: null,
        error: 'timeout',
      },
    }),
    { ok: false, error: 'timeout' }
  );
  assert.deepEqual(
    await run({
      '/commits/main': { ok: false, status: 0, body: null, error: 'no_token' },
    }),
    { ok: false, error: 'no_token' }
  );
  // an error text that is not a code is not repeated
  assert.deepEqual(
    await run({
      '/commits/main': {
        ok: false,
        status: 0,
        body: null,
        error: 'connect ECONNREFUSED 192.0.2.1:443',
      },
    }),
    { ok: false, error: 'github_error' }
  );
});

test('main push probe: a body that is not a commit is a bad response', async () => {
  for (const body of [
    {},
    null,
    { sha: 'abc', parents: [] },
    { sha: H(13), parents: [{ sha: 'not a sha' }] },
    { sha: H(13), parents: 'none' },
  ]) {
    const github = async () => ({ ok: true, status: 200, body });
    assert.deepEqual(await ask(createMainPushProbe({ github })), {
      ok: false,
      error: 'bad_response',
    });
  }
});

test('main push probe: input that could be read as an option, or is out of range, is refused unstarted', async () => {
  const fake = fakeGithub({ commits: GRAPH(), tip: 13 });
  const probe = createMainPushProbe({ github: fake.github });
  const refuse = async (over, error) =>
    assert.deepEqual(await ask(probe, over), { ok: false, error });
  await refuse({ mainBranch: '--bad' }, 'bad_branch');
  await refuse({ mainBranch: 'a..b' }, 'bad_branch');
  await refuse({ mainBranch: 'a b' }, 'bad_branch');
  await refuse({ baseline: null }, 'bad_input');
  await refuse(
    { baseline: { source: 'recorded', at: 'soon', sha: null } },
    'bad_input'
  );
  await refuse(
    { baseline: { source: 'anchor', at: null, sha: 'zzz' } },
    'bad_input'
  );
  await refuse({ maxCommits: 0 }, 'bad_input');
  await refuse({ maxCommits: 1.5 }, 'bad_input');
  await refuse({ maxCommits: 500 }, 'bad_input');
  assert.deepEqual(fake.calls, []);
  assert.deepEqual(await probe(), { ok: false, error: 'bad_input' });
});

test('main push probe: pull request lookups run a few at a time, not all at once and not one by one', async () => {
  const commits = {};
  const pulls = {};
  for (let n = 1; n <= 12; n += 1) {
    commits[n] = apiCommit(n, n > 1 ? [n - 1] : [], { at: ago(n * 60000) });
    pulls[n] = [apiPull(100 + n)];
  }
  const fake = fakeGithub({ commits, tip: 12, pulls, delayMs: 5 });
  const result = await ask(createMainPushProbe({ github: fake.github }));
  assert.equal(result.commits.length, 12);
  assert.ok(fake.maxInFlight() >= 2, 'lookups overlap');
  assert.ok(fake.maxInFlight() <= 5, 'but never more than five at once');
});

// --- the gateway health endpoint ------------------------------------------------------------------------------------

const HEALTH_URL = 'https://gateway.example.test/api/v1/health';
// a URL that carries a user name and a password, built here so none is written into the source
const withCredentials = (href) => {
  const url = new URL(href);
  url.username = 'name';
  url.password = 'pass-word';
  return url.href;
};
const healthBody = (queue) => ({
  status: 'healthy',
  timestamp: '2026-11-22T11:59:59.000Z',
  services: {
    redis: { status: 'up', latency: 2 },
    queue,
    database: { status: 'up', latency: 3 },
  },
  uptime: 1234.5,
});
const jsonResponse = (body, status = 200) =>
  new Response(typeof body === 'string' ? body : JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
function fakeFetch(handler) {
  const calls = [];
  const fetchImpl = async (url, init) => {
    calls.push({ url, init });
    return handler(url, init);
  };
  return { fetchImpl, calls };
}
const queueProbe = (handler, over = {}) => {
  const fetchFake = fakeFetch(handler);
  return {
    ...fetchFake,
    probe: createQueueProbe({
      fetchImpl: fetchFake.fetchImpl,
      url: HEALTH_URL,
      now: () => NOW,
      ...over,
    }),
  };
};

test('queue probe: reads the queue counts of the health answer and stamps them with the time it read them', async () => {
  const { probe, calls } = queueProbe(() =>
    jsonResponse(
      healthBody({
        status: 'up',
        waiting: 3,
        active: 1,
        completed: 9000,
        failed: 2,
      })
    )
  );
  assert.deepEqual(await probe(), {
    ok: true,
    sample: { at: NOW.toISOString(), waiting: 3, failed: 2, active: 1 },
  });
  // one plain GET with no credential and no redirect following
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, HEALTH_URL);
  assert.equal(calls[0].init.method, 'GET');
  assert.equal(calls[0].init.redirect, 'manual');
  assert.equal(
    Object.keys(calls[0].init.headers).some((h) =>
      /authorization|cookie/i.test(h)
    ),
    false
  );
});

test('queue probe: a queue that is down, missing or not numbers is not a sample', async () => {
  const answer = async (body) => queueProbe(() => jsonResponse(body)).probe();
  assert.deepEqual(
    await answer(
      healthBody({ status: 'down', error: 'Redis is gone at 192.0.2.1:6379' })
    ),
    { ok: false, error: 'queue_down' }
  );
  for (const body of [
    {},
    { services: {} },
    { services: { queue: 'up' } },
    healthBody({ status: 'up', waiting: 'many', failed: 0 }),
    healthBody({ status: 'up', waiting: 1, failed: -1 }),
    healthBody({ status: 'up', waiting: 1 }),
    [],
    'not json at all',
  ]) {
    assert.deepEqual(await answer(body), { ok: false, error: 'bad_response' });
  }
});

test('queue probe: an HTTP error, a redirect, a timeout or a network failure is a fixed code', async () => {
  const code = async (handler) => (await queueProbe(handler).probe()).error;
  assert.equal(await code(() => jsonResponse({}, 503)), 'http_503');
  assert.equal(
    await code(
      () =>
        new Response(null, {
          status: 301,
          headers: { location: 'https://elsewhere.test/' },
        })
    ),
    'http_301'
  );
  assert.equal(
    await code(() => {
      throw Object.assign(new Error('The operation timed out'), {
        name: 'TimeoutError',
      });
    }),
    'timeout'
  );
  assert.equal(
    await code(() => {
      throw new Error('connect ECONNREFUSED 192.0.2.1:443');
    }),
    'network_error'
  );
});

test('queue probe: an answer larger than 64 KB is refused, not read whole, even when it is a good one', async () => {
  const big = JSON.stringify({
    ...healthBody({
      status: 'up',
      waiting: 1,
      active: 0,
      completed: 1,
      failed: 0,
    }),
    padding: 'x'.repeat(70 * 1024),
  });
  const result = await queueProbe(() => jsonResponse(big)).probe();
  assert.deepEqual(result, { ok: false, error: 'bad_response' });
  // the same answer without the padding is a sample
  const small = await queueProbe(() =>
    jsonResponse(
      healthBody({
        status: 'up',
        waiting: 1,
        active: 0,
        completed: 1,
        failed: 0,
      })
    )
  ).probe();
  assert.equal(small.ok, true);
});

test('queue probe: only an https address without credentials is used', async () => {
  for (const url of [
    undefined,
    '',
    'http://gateway.example.test/api/v1/health',
    withCredentials(HEALTH_URL),
    'gateway.example.test/api/v1/health',
    42,
  ]) {
    const fetchFake = fakeFetch(() => jsonResponse({}));
    const probe = createQueueProbe({
      fetchImpl: fetchFake.fetchImpl,
      url,
      now: () => NOW,
    });
    assert.deepEqual(
      await probe(),
      { ok: false, error: 'no_url' },
      String(url)
    );
    assert.equal(fetchFake.calls.length, 0);
  }
});

// --- the two probes of a sweep -----------------------------------------------------------------------------------------

test('createBehaviourProbes: the main push probe always, the queue probe only with an address, the token only to GitHub', async () => {
  const requests = [];
  const graph = GRAPH();
  const fetchImpl = async (url, init) => {
    requests.push({ url: String(url), init });
    const { pathname, hostname } = new URL(url);
    if (hostname === 'gateway.example.test') {
      return jsonResponse(
        healthBody({
          status: 'up',
          waiting: 0,
          active: 0,
          completed: 1,
          failed: 0,
        })
      );
    }
    const m =
      /^\/repos\/owner\/name\/commits\/(main|[0-9a-f]{40})(\/pulls)?$/.exec(
        pathname
      );
    if (!m) return jsonResponse({}, 404);
    if (m[2])
      return jsonResponse(PULLS[Number.parseInt(m[1].slice(0, 2), 16)] ?? []);
    const n = m[1] === 'main' ? 13 : Number.parseInt(m[1].slice(0, 2), 16);
    return graph[n] ? jsonResponse(graph[n]) : jsonResponse({}, 404);
  };

  const withBoth = createBehaviourProbes({
    token: 'ghp_fixture_token_value',
    repo: 'owner/name',
    fetchImpl,
    gatewayHealthUrl: HEALTH_URL,
  });
  assert.equal(typeof withBoth.mainPush, 'function');
  assert.equal(typeof withBoth.queue, 'function');
  assert.equal(
    'queue' in
      createBehaviourProbes({ token: 't', repo: 'owner/name', fetchImpl }),
    false
  );

  const result = await runBehaviourSignals({
    now: NOW,
    probes: withBoth,
    settings: { main_push: { baseline_at: ago(24 * HOUR) } },
  });
  // three merged pull requests on main: the line is clean; the queue gave one sample, too few to judge
  assert.equal(result.checks.find((c) => c.area === 'main').status, 'pass');
  assert.equal(result.main.commits.examined, 3);
  assert.equal(result.queue.live, 'ok');
  assert.equal(result.queue.sample_count, 1);
  assert.equal(
    result.checks.find((c) => c.id === 'bs5-queue-failed').status,
    'skipped'
  );

  const github = requests.filter(
    (r) => new URL(r.url).hostname === 'api.github.com'
  );
  const gateway = requests.filter(
    (r) => new URL(r.url).hostname === 'gateway.example.test'
  );
  assert.ok(github.length >= 6);
  assert.equal(gateway.length, 1);
  assert.ok(
    github.every(
      (r) => r.init.headers.Authorization === 'Bearer ghp_fixture_token_value'
    )
  );
  assert.ok(gateway.every((r) => !('Authorization' in r.init.headers)));
  // nothing of the token or the address reaches the result
  const text = JSON.stringify(result);
  assert.equal(text.includes('ghp_fixture_token_value'), false);
  assert.equal(text.includes('gateway.example.test'), false);
});

// --- end of tests ---
