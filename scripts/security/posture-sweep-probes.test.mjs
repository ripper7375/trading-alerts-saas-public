// Run: node --test 'scripts/security/*.test.mjs'
//
// The real probes of the live posture sweep, with the node primitives faked: a fake
// `fetch`, TLS socket, DNS resolver and process runner. Nothing here touches the network
// or starts a process. What matters is what the wrappers refuse to do: certificate
// validation stays on, a token only goes to the API origin, and nothing reaches a shell.
import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import {
  SECRET_ALERTS_PER_PAGE,
  createCredentialFill,
  createDnsProbe,
  createGitProbe,
  createGithubProbe,
  createPostureProbes,
  createSecretScanningProbe,
  createTlsProbe,
  createWebProbe,
} from './posture-sweep-probes.mjs';

const TOKEN = 'fake-github-token-for-tests-only-0123456789';

// --- web --------------------------------------------------------------------------------------

test('the web probe reads status and headers without following a redirect', async () => {
  const calls = [];
  let cancelled = false;
  const probe = createWebProbe({
    fetchImpl: async (url, init) => {
      calls.push({ url, init });
      const response = new Response('<html></html>', {
        status: 308,
        headers: {
          Location: 'https://www.example.test/',
          'Strict-Transport-Security': 'max-age=1',
        },
      });
      const original = response.body.cancel.bind(response.body);
      response.body.cancel = (...args) => {
        cancelled = true;
        return original(...args);
      };
      return response;
    },
  });
  const result = await probe({ url: 'https://example.test/' });
  assert.equal(result.ok, true);
  assert.equal(result.status, 308);
  // header names arrive in lower case, whatever the server sent
  assert.equal(result.headers.location, 'https://www.example.test/');
  assert.equal(result.headers['strict-transport-security'], 'max-age=1');
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, 'https://example.test/');
  assert.equal(calls[0].init.method, 'GET');
  assert.equal(calls[0].init.redirect, 'manual');
  assert.ok(calls[0].init.signal, 'a timeout signal');
  assert.equal(cancelled, true, 'the body is dropped unread');
});

test('the web probe maps a timeout and any other failure to fixed codes', async () => {
  const run = (error) =>
    createWebProbe({
      fetchImpl: async () => {
        throw error;
      },
    })({ url: 'https://example.test/' });
  assert.deepEqual(
    await run(Object.assign(new Error('slow'), { name: 'TimeoutError' })),
    { ok: false, error: 'timeout' }
  );
  assert.deepEqual(await run(new Error('connect refused to 203.0.113.9')), {
    ok: false,
    error: 'network_error',
  });
});

test('the web probe only fetches https origins', async () => {
  let calls = 0;
  const probe = createWebProbe({
    fetchImpl: async () => {
      calls += 1;
      return new Response('');
    },
  });
  for (const url of [
    'http://example.test/',
    'https://example.test/path',
    'https://user@example.test/',
    'https://exa mple.test/',
    'ftp://example.test/',
    '',
    undefined,
  ]) {
    assert.deepEqual(
      await probe({ url }),
      { ok: false, error: 'bad_url' },
      String(url)
    );
  }
  assert.equal(calls, 0);
});

// --- tls --------------------------------------------------------------------------------------

function fakeConnect(script) {
  const seen = { options: null, socket: null };
  const connect = (options) => {
    seen.options = options;
    const socket = new EventEmitter();
    socket.destroyed = false;
    socket.destroy = () => {
      socket.destroyed = true;
    };
    socket.getPeerCertificate = () => script.cert ?? {};
    socket.authorized = script.authorized ?? true;
    socket.authorizationError = script.authorizationError ?? null;
    seen.socket = socket;
    queueMicrotask(() => script.run(socket));
    return socket;
  };
  return { connect, seen };
}

test('the TLS probe reads the certificate dates of a valid handshake', async () => {
  const { connect, seen } = fakeConnect({
    cert: {
      valid_from: 'Oct  8 00:30:24 2026 GMT',
      valid_to: 'Jan  6 00:30:23 2027 GMT',
    },
    run: (socket) => socket.emit('secureConnect'),
  });
  const result = await createTlsProbe({ connect })({
    host: 'www.example.test',
  });
  assert.deepEqual(result, {
    ok: true,
    authorized: true,
    authorizationError: null,
    validFrom: '2026-10-08T00:30:24.000Z',
    validTo: '2027-01-06T00:30:23.000Z',
  });
  assert.equal(seen.socket.destroyed, true, 'the socket is closed');
});

test('the TLS probe keeps certificate validation on and checks the name it asked for', async () => {
  const { connect, seen } = fakeConnect({
    run: (s) => s.emit('secureConnect'),
  });
  await createTlsProbe({ connect })({ host: 'www.example.test', port: 443 });
  assert.equal(seen.options.host, 'www.example.test');
  assert.equal(seen.options.servername, 'www.example.test');
  assert.equal(seen.options.port, 443);
  assert.notEqual(
    seen.options.rejectUnauthorized,
    false,
    'validation must never be switched off (CodeQL js/disabling-certificate-validation)'
  );
  assert.ok(seen.options.timeout > 0);
});

test('a certificate validation error is an answer (invalid certificate), not a probe failure', async () => {
  for (const code of [
    'CERT_HAS_EXPIRED',
    'ERR_TLS_CERT_ALTNAME_INVALID',
    'DEPTH_ZERO_SELF_SIGNED_CERT',
    'UNABLE_TO_VERIFY_LEAF_SIGNATURE',
    'CERT_NOT_YET_VALID',
  ]) {
    const { connect } = fakeConnect({
      run: (socket) =>
        socket.emit('error', Object.assign(new Error('x'), { code })),
    });
    const result = await createTlsProbe({ connect })({
      host: 'h.example.test',
    });
    assert.deepEqual(
      result,
      {
        ok: true,
        authorized: false,
        authorizationError: code,
        validFrom: null,
        validTo: null,
      },
      code
    );
  }
});

test('a network error, a timeout or a throwing connect is a failed probe', async () => {
  const reset = fakeConnect({
    run: (s) =>
      s.emit('error', Object.assign(new Error('x'), { code: 'ECONNRESET' })),
  });
  assert.deepEqual(
    await createTlsProbe({ connect: reset.connect })({
      host: 'h.example.test',
    }),
    {
      ok: false,
      error: 'network_error',
    }
  );
  const slow = fakeConnect({ run: (s) => s.emit('timeout') });
  assert.deepEqual(
    await createTlsProbe({ connect: slow.connect })({ host: 'h.example.test' }),
    {
      ok: false,
      error: 'timeout',
    }
  );
  const throwing = () => {
    throw new Error('boom');
  };
  assert.deepEqual(
    await createTlsProbe({ connect: throwing })({ host: 'h.example.test' }),
    {
      ok: false,
      error: 'network_error',
    }
  );
});

test('the TLS probe answers once, even when several events fire', async () => {
  const { connect } = fakeConnect({
    run: (socket) => {
      socket.emit('timeout');
      socket.emit(
        'error',
        Object.assign(new Error('x'), { code: 'CERT_HAS_EXPIRED' })
      );
      socket.emit('secureConnect');
    },
  });
  const result = await createTlsProbe({ connect })({ host: 'h.example.test' });
  assert.equal(result.ok, false);
  assert.equal(result.error, 'timeout');
});

test('the TLS probe only connects to a plain host name', async () => {
  let calls = 0;
  const connect = () => {
    calls += 1;
    return new EventEmitter();
  };
  for (const host of ['', 'a b', 'host/path', 'host:443', undefined]) {
    assert.deepEqual(await createTlsProbe({ connect })({ host }), {
      ok: false,
      error: 'bad_host',
    });
  }
  assert.equal(calls, 0);
});

// --- dns -------------------------------------------------------------------------------------

const dnsError = (code) => Object.assign(new Error('dns'), { code });
const resolverOf = (answers) => ({
  resolve4: async () => {
    if (answers.a instanceof Error) throw answers.a;
    return answers.a ?? [];
  },
  resolve6: async () => {
    if (answers.aaaa instanceof Error) throw answers.aaaa;
    return answers.aaaa ?? [];
  },
  resolveCname: async () => {
    if (answers.cname instanceof Error) throw answers.cname;
    return answers.cname ?? [];
  },
});

test('a name that does not exist (NXDOMAIN or no data) resolves to no records', async () => {
  const none = dnsError('ENOTFOUND');
  const nodata = dnsError('ENODATA');
  const probe = createDnsProbe({
    resolver: resolverOf({ a: none, aaaa: nodata, cname: none }),
  });
  assert.deepEqual(await probe({ host: 'chat.example.test' }), {
    ok: true,
    addresses: [],
    cnames: [],
  });
});

test('records are returned as lists, for the caller to count', async () => {
  const probe = createDnsProbe({
    resolver: resolverOf({
      a: ['198.51.100.1', '198.51.100.2'],
      aaaa: dnsError('ENODATA'),
      cname: ['target.example.test'],
    }),
  });
  const result = await probe({ host: 'chat.example.test' });
  assert.equal(result.ok, true);
  assert.equal(result.addresses.length, 2);
  assert.equal(result.cnames.length, 1);
});

test('a resolver failure is a failed probe, never "no record"', async () => {
  for (const [code, error] of [
    ['ESERVFAIL', 'servfail'],
    ['ETIMEOUT', 'timeout'],
    ['ECONNREFUSED', 'resolver_error'],
    ['EAI_AGAIN', 'resolver_error'],
  ]) {
    const probe = createDnsProbe({
      resolver: resolverOf({ a: dnsError(code), aaaa: [], cname: [] }),
    });
    assert.deepEqual(
      await probe({ host: 'chat.example.test' }),
      { ok: false, error },
      code
    );
  }
  assert.deepEqual(
    await createDnsProbe({ resolver: resolverOf({}) })({ host: 'bad host' }),
    {
      ok: false,
      error: 'bad_host',
    }
  );
});

// --- github ---------------------------------------------------------------------------------------

function githubWith(handler) {
  const calls = [];
  const fetchImpl = async (url, init) => {
    calls.push({ url: String(url), init });
    return handler(String(url), init);
  };
  return {
    calls,
    probe: createGithubProbe({ fetchImpl, token: TOKEN, repo: 'owner/name' }),
  };
}

test('the GitHub probe sends the token to the API origin only, and does not follow redirects', async () => {
  const { calls, probe } = githubWith(
    () => new Response(JSON.stringify([{ type: 'deletion' }]), { status: 200 })
  );
  const result = await probe({ path: '/rules/branches/main' });
  assert.deepEqual(result, {
    ok: true,
    status: 200,
    body: [{ type: 'deletion' }],
    rateLimited: false,
    error: null,
  });
  assert.equal(
    calls[0].url,
    'https://api.github.com/repos/owner/name/rules/branches/main'
  );
  assert.equal(calls[0].init.headers.Authorization, `Bearer ${TOKEN}`);
  assert.equal(calls[0].init.headers['X-GitHub-Api-Version'], '2022-11-28');
  assert.equal(calls[0].init.redirect, 'manual');
  assert.ok(calls[0].init.signal);
  assert.equal(JSON.stringify(result).includes(TOKEN), false);
  // the repository itself
  await probe({ path: '' });
  assert.equal(calls[1].url, 'https://api.github.com/repos/owner/name');
});

test('the GitHub probe reads 204 and error statuses, keeping no error body', async () => {
  const ok204 = githubWith(() => new Response(null, { status: 204 }));
  assert.deepEqual(await ok204.probe({ path: '/vulnerability-alerts' }), {
    ok: true,
    status: 204,
    body: null,
    rateLimited: false,
    error: null,
  });
  const missing = githubWith(
    () =>
      new Response(JSON.stringify({ message: 'Not Found' }), { status: 404 })
  );
  assert.deepEqual(await missing.probe({ path: '/vulnerability-alerts' }), {
    ok: false,
    status: 404,
    body: null,
    rateLimited: false,
    error: 'http_404',
  });
  const limited = githubWith(
    () =>
      new Response('{}', {
        status: 403,
        headers: { 'x-ratelimit-remaining': '0' },
      })
  );
  assert.equal((await limited.probe({ path: '' })).rateLimited, true);
  const plain403 = githubWith(() => new Response('{}', { status: 403 }));
  assert.equal((await plain403.probe({ path: '' })).rateLimited, false);
  const garbled = githubWith(() => new Response('not json', { status: 200 }));
  assert.deepEqual(await garbled.probe({ path: '' }), {
    ok: true,
    status: 200,
    body: null,
    rateLimited: false,
    error: null,
  });
});

test('the GitHub probe never calls out without a token, with a bad path or a bad repository', async () => {
  let calls = 0;
  const fetchImpl = async () => {
    calls += 1;
    return new Response('{}');
  };
  const noToken = createGithubProbe({
    fetchImpl,
    token: null,
    repo: 'owner/name',
  });
  assert.deepEqual(await noToken({ path: '' }), {
    ok: false,
    status: 0,
    body: null,
    error: 'no_token',
  });
  const probe = createGithubProbe({
    fetchImpl,
    token: TOKEN,
    repo: 'owner/name',
  });
  for (const path of [
    'rules',
    '/../x',
    'https://evil.test/',
    '/a b',
    '//evil.test',
    '/x?y=1',
  ]) {
    const result = await probe({ path });
    assert.equal(result.error, 'bad_path', path);
  }
  const badRepo = createGithubProbe({
    fetchImpl,
    token: TOKEN,
    repo: 'not a repo',
  });
  assert.equal((await badRepo({ path: '' })).error, 'bad_repo');
  assert.equal(calls, 0);
});

test('the GitHub probe turns a network failure into a fixed code', async () => {
  const boom = githubWith(() => {
    throw new Error(`socket hang up, token ${TOKEN}`);
  });
  const result = await boom.probe({ path: '' });
  assert.deepEqual(result, {
    ok: false,
    status: 0,
    body: null,
    error: 'network_error',
  });
  assert.equal(JSON.stringify(result).includes(TOKEN), false);
  const slow = githubWith(() => {
    throw Object.assign(new Error('t'), { name: 'TimeoutError' });
  });
  assert.equal((await slow.probe({ path: '' })).error, 'timeout');
});

test('the GitHub probe appends a query of plain words and refuses anything else', async () => {
  const { calls, probe } = githubWith(
    () => new Response('[]', { status: 200 })
  );
  const ok = await probe({
    path: '/some/list',
    query: { state: 'open', per_page: 10 },
  });
  assert.equal(ok.ok, true);
  assert.equal(
    calls[0].url,
    'https://api.github.com/repos/owner/name/some/list?state=open&per_page=10'
  );
  assert.equal(Object.hasOwn(ok, 'link'), false, 'the answer keeps its shape');
  const before = calls.length;
  for (const query of [
    {},
    [],
    'state=open',
    { 'a b': 'x' },
    { state: 'open&admin=true' },
    { state: 'a b' },
    { state: 'x\ny' },
    { state: '' },
    { state: { nested: 1 } },
    { UPPER: 'x' },
    { state: 'x'.repeat(31) },
  ]) {
    const result = await probe({ path: '/some/list', query });
    assert.equal(result.error, 'bad_query', JSON.stringify(query));
    assert.equal(result.status, 0);
  }
  assert.equal(calls.length, before, 'a refused query is never sent');
});

// --- secret scanning -------------------------------------------------------------------------------------

// A stand-in for what the real answer holds: the secret itself, its type, links and a place.
// The values are obviously invented: this repository is public and scans its own pushes.
const SECRET_VALUE = 'not-a-real-secret-value-0001';
const SECRET_TYPE = 'invented_provider_token';
const SECRET_URL = 'https://alerts.example.test/secret-scanning/alert';

const alertAnswer = (number, over = {}) => ({
  number,
  state: 'open',
  secret_type: SECRET_TYPE,
  secret_type_display_name: 'Invented Provider Token',
  secret: `${SECRET_VALUE}-${number}`,
  html_url: `${SECRET_URL}/${number}`,
  locations_url: `${SECRET_URL}/${number}/locations`,
  validity: 'unknown',
  first_location_detected: { path: 'config/invented.env', start_line: 4 },
  ...over,
});

function secretProbeWith(handler, over = {}) {
  const calls = [];
  const fetchImpl = async (url, init) => {
    calls.push({ url: String(url), init });
    return handler(String(url), init);
  };
  return {
    calls,
    probe: createSecretScanningProbe({
      fetchImpl,
      token: TOKEN,
      repo: 'owner/name',
      ...over,
    }),
  };
}

const sentinels = [
  SECRET_VALUE,
  SECRET_TYPE,
  SECRET_URL,
  'invented.env',
  TOKEN,
];
const leaks = (value) =>
  sentinels.filter((text) => JSON.stringify(value).includes(text));

test('the secret-scanning probe reads one page of open alerts and returns only their numbers', async () => {
  const { calls, probe } = secretProbeWith(
    () =>
      new Response(JSON.stringify([alertAnswer(7), alertAnswer(3)]), {
        status: 200,
      })
  );
  const result = await probe();
  assert.deepEqual(result, {
    ok: true,
    status: 200,
    numbers: [3, 7],
    more: false,
  });
  assert.equal(calls.length, 1);
  assert.equal(
    calls[0].url,
    'https://api.github.com/repos/owner/name/secret-scanning/alerts?state=open&per_page=10'
  );
  assert.equal(SECRET_ALERTS_PER_PAGE, 10);
  assert.equal(calls[0].init.method, 'GET');
  assert.equal(calls[0].init.headers.Authorization, `Bearer ${TOKEN}`);
  assert.equal(calls[0].init.redirect, 'manual');
  assert.deepEqual(leaks(result), [], 'no secret, type, link, place or token');
});

test('the secret-scanning probe answers with no alert for an empty list', async () => {
  const { probe } = secretProbeWith(() => new Response('[]', { status: 200 }));
  assert.deepEqual(await probe(), {
    ok: true,
    status: 200,
    numbers: [],
    more: false,
  });
});

test('a next page is reported, never followed', async () => {
  const { calls, probe } = secretProbeWith(
    () =>
      new Response(JSON.stringify([alertAnswer(1)]), {
        status: 200,
        headers: {
          link: '<https://api.github.com/x?page=2>; rel="next", <https://api.github.com/x?page=9>; rel="last"',
        },
      })
  );
  const result = await probe();
  assert.equal(result.more, true);
  assert.equal(calls.length, 1, 'one page per sweep');
  // a Link header without a next page is not "more"
  const last = secretProbeWith(
    () =>
      new Response('[]', {
        status: 200,
        headers: { link: '<https://api.github.com/x?page=1>; rel="prev"' },
      })
  );
  assert.equal((await last.probe()).more, false);
});

test('the secret-scanning probe keeps at most one page and skips entries that are not alert numbers', async () => {
  const junk = [
    null,
    'x',
    7,
    {},
    { number: '7' },
    { number: -1 },
    { number: 0 },
    { number: 1.5 },
    { number: Number.MAX_SAFE_INTEGER + 2 },
    { number: null },
  ];
  const valid = Array.from({ length: 12 }, (_, i) => alertAnswer(20 + i));
  const { probe } = secretProbeWith(
    () =>
      new Response(JSON.stringify([...junk, ...valid, alertAnswer(20)]), {
        status: 200,
      })
  );
  const result = await probe();
  assert.deepEqual(
    result.numbers,
    [20, 21, 22, 23, 24, 25, 26, 27, 28, 29],
    'ten numbers, sorted, once each'
  );
  assert.deepEqual(leaks(result), []);
});

test('a body that is not a list of alerts is not an answer', async () => {
  for (const text of [
    JSON.stringify({ message: 'Not what we asked', secret: SECRET_VALUE }),
    'not json',
    'null',
    '"text"',
  ]) {
    const { probe } = secretProbeWith(
      () => new Response(text, { status: 200 })
    );
    const result = await probe();
    assert.deepEqual(result, {
      ok: false,
      status: 200,
      rateLimited: false,
      error: 'unexpected_response',
    });
    assert.deepEqual(leaks(result), []);
  }
});

test('failures come back as the status and a fixed code, never a body', async () => {
  const body = JSON.stringify({
    message: `Resource not accessible, secret ${SECRET_VALUE}`,
    secret: SECRET_VALUE,
  });
  const cases = [
    [new Response(body, { status: 403 }), 403, false],
    [new Response(body, { status: 404 }), 404, false],
    [new Response(body, { status: 401 }), 401, false],
    [new Response(body, { status: 500 }), 500, false],
    [
      new Response(body, {
        status: 403,
        headers: { 'x-ratelimit-remaining': '0' },
      }),
      403,
      true,
    ],
  ];
  for (const [response, status, rateLimited] of cases) {
    const { probe } = secretProbeWith(() => response);
    const result = await probe();
    assert.deepEqual(result, {
      ok: false,
      status,
      rateLimited,
      error: `http_${status}`,
    });
    assert.deepEqual(leaks(result), []);
  }
  const boom = secretProbeWith(() => {
    throw new Error(`socket hang up, token ${TOKEN}, secret ${SECRET_VALUE}`);
  });
  const failed = await boom.probe();
  assert.deepEqual(failed, {
    ok: false,
    status: 0,
    rateLimited: false,
    error: 'network_error',
  });
  assert.deepEqual(leaks(failed), []);
  const slow = secretProbeWith(() => {
    throw Object.assign(new Error('t'), { name: 'TimeoutError' });
  });
  assert.equal((await slow.probe()).error, 'timeout');
});

test('the secret-scanning probe never calls out without a token or with a bad repository', async () => {
  let calls = 0;
  const fetchImpl = async () => {
    calls += 1;
    return new Response('[]');
  };
  const noToken = createSecretScanningProbe({
    fetchImpl,
    token: null,
    repo: 'owner/name',
  });
  assert.deepEqual(await noToken(), {
    ok: false,
    status: 0,
    rateLimited: false,
    error: 'no_token',
  });
  const badRepo = createSecretScanningProbe({
    fetchImpl,
    token: TOKEN,
    repo: 'not a repo',
  });
  assert.equal((await badRepo()).error, 'bad_repo');
  assert.equal(calls, 0);
});

// --- git ----------------------------------------------------------------------------------------------

function gitWith(reply = { status: 0, stdout: '' }) {
  const calls = [];
  const spawn = (command, args, options) => {
    calls.push({ command, args, options });
    return typeof reply === 'function' ? reply(args) : reply;
  };
  return { calls, git: createGitProbe({ cwd: '/work/repo', spawn }) };
}
const SHA = 'a'.repeat(40);

test('git commands run without a shell, never prompt and use fixed argument lists', async () => {
  const { calls, git } = gitWith({ status: 0, stdout: `${SHA}\n` });
  assert.equal(await git.resolve('origin/main'), SHA);
  assert.deepEqual(calls[0].args, [
    'rev-parse',
    '--verify',
    '--quiet',
    'origin/main^{commit}',
  ]);
  assert.equal(calls[0].command, 'git');
  assert.equal(calls[0].options.shell, false);
  assert.equal(calls[0].options.cwd, '/work/repo');
  assert.equal(calls[0].options.env.GIT_TERMINAL_PROMPT, '0');
  assert.equal(calls[0].options.windowsHide, true);
});

test('resolve answers null for an unknown commit and for a garbled answer', async () => {
  assert.equal(
    await gitWith({ status: 1, stdout: '' }).git.resolve('origin/main'),
    null
  );
  assert.equal(
    await gitWith({ status: 0, stdout: 'not a sha' }).git.resolve(
      'origin/main'
    ),
    null
  );
  assert.equal(
    await gitWith({ status: null, stdout: '' }).git.resolve('origin/main'),
    null
  );
});

test('resolve and pending refuse anything that could be read as an option or a shell word', async () => {
  const { calls, git } = gitWith({ status: 0, stdout: `${SHA}\n` });
  for (const ref of [
    '--upload-pack=x',
    '-x',
    'a b',
    'a;b',
    '$(x)',
    '',
    'a..b',
    undefined,
  ]) {
    assert.equal(await git.resolve(ref), null, String(ref));
  }
  for (const input of [
    { deployed: 'zzz', mainRef: 'origin/main', paths: ['svc-a'] },
    { deployed: SHA, mainRef: '--x', paths: ['svc-a'] },
    { deployed: SHA, mainRef: 'origin/main', paths: ['../etc'] },
    { deployed: SHA, mainRef: 'origin/main', paths: ['-svc'] },
    { deployed: SHA, mainRef: 'origin/main', paths: ['a b'] },
    { deployed: SHA, mainRef: 'origin/main', paths: [] },
    { deployed: SHA, mainRef: 'origin/main', paths: ['/abs'] },
  ]) {
    assert.deepEqual(
      await git.pending(input),
      { ok: false, error: 'bad_input' },
      JSON.stringify(input)
    );
  }
  assert.equal(calls.length, 0, 'nothing was started');
});

test('pending lists the commits on the first-parent line of main that touch the paths, oldest first', async () => {
  const older = 1763800000;
  const newer = 1763900000;
  const { calls, git } = gitWith({
    status: 0,
    stdout: `${'b'.repeat(40)}\t${older}\n${'c'.repeat(40)}\t${newer}\n`,
  });
  const result = await git.pending({
    deployed: SHA,
    mainRef: 'origin/main',
    paths: ['svc-a', 'svc-b'],
  });
  assert.deepEqual(result, {
    ok: true,
    commits: [
      { sha: 'b'.repeat(40), at: new Date(older * 1000).toISOString() },
      { sha: 'c'.repeat(40), at: new Date(newer * 1000).toISOString() },
    ],
  });
  assert.deepEqual(calls[0].args, [
    'log',
    '--first-parent',
    '--reverse',
    '--format=%H%x09%ct',
    `${SHA}..origin/main`,
    '--',
    'svc-a',
    'svc-b',
  ]);
  // an empty answer is "nothing pending", a failing git is an error
  assert.deepEqual(
    await gitWith({ status: 0, stdout: '' }).git.pending({
      deployed: SHA,
      mainRef: 'origin/main',
      paths: ['svc-a'],
    }),
    { ok: true, commits: [] }
  );
  assert.deepEqual(
    await gitWith({ status: 128, stdout: '' }).git.pending({
      deployed: SHA,
      mainRef: 'origin/main',
      paths: ['svc-a'],
    }),
    { ok: false, error: 'git_error' }
  );
});

test('fetchMain updates the remote-tracking branch only', async () => {
  const { calls, git } = gitWith({ status: 0, stdout: '' });
  assert.deepEqual(await git.fetchMain({ mainRef: 'origin/main' }), {
    ok: true,
  });
  assert.deepEqual(calls[0].args, [
    'fetch',
    '--quiet',
    '--no-tags',
    'origin',
    'main',
  ]);
  assert.equal(calls[0].options.shell, false);
  assert.deepEqual(
    await gitWith({ status: 1, stdout: '' }).git.fetchMain({
      mainRef: 'origin/main',
    }),
    { ok: false }
  );
  // a local branch has nothing to fetch; anything odd is refused unstarted
  const local = gitWith();
  assert.deepEqual(await local.git.fetchMain({ mainRef: 'main' }), {
    ok: true,
    skipped: true,
  });
  assert.deepEqual(await local.git.fetchMain({ mainRef: '--x/y' }), {
    ok: false,
  });
  assert.deepEqual(await local.git.fetchMain({}), { ok: false });
  assert.equal(local.calls.length, 0);
});

// --- credentials and wiring ---------------------------------------------------------------------------

test('the credential helper asks Git for github.com and returns only its stdout', () => {
  const calls = [];
  const fill = createCredentialFill({
    spawn: (command, args, options) => {
      calls.push({ command, args, options });
      return { status: 0, stdout: 'username=x\npassword=y\n' };
    },
  });
  assert.equal(fill(), 'username=x\npassword=y\n');
  assert.equal(calls[0].command, 'git');
  assert.deepEqual(calls[0].args, ['credential', 'fill']);
  assert.equal(calls[0].options.input, 'protocol=https\nhost=github.com\n\n');
  assert.equal(calls[0].options.env.GIT_TERMINAL_PROMPT, '0');
  assert.equal(
    createCredentialFill({ spawn: () => ({ status: 1, stdout: 'x' }) })(),
    null
  );
});

test('createPostureProbes assembles the six probes', () => {
  const probes = createPostureProbes({
    root: '/work/repo',
    token: TOKEN,
    repo: 'owner/name',
    fetchImpl: async () => new Response('{}'),
  });
  for (const name of ['web', 'tls', 'dns', 'github', 'secretScanning']) {
    assert.equal(typeof probes[name], 'function', name);
  }
  for (const name of ['fetchMain', 'resolve', 'pending']) {
    assert.equal(typeof probes.git[name], 'function', name);
  }
});
