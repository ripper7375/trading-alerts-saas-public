// The real probes of the live posture sweep (posture-sweep-lib.mjs): an HTTPS request, a TLS
// handshake, DNS lookups, the GitHub REST API (settings, and the open secret-scanning alerts) and
// Git. Each factory takes the node primitive it wraps (`fetch`, `tls.connect`, a resolver,
// `spawnSync`) so the tests can fake it; nothing here runs at import time.
//
// What the wrappers refuse to do:
//   - turn certificate validation off (a failed validation is an answer: invalid certificate);
//   - send the GitHub token anywhere but the API origin, or follow a redirect with it;
//   - start a process through a shell, or pass an unchecked word to Git;
//   - return an error message: failures come back as fixed codes, because a message can quote
//     a host, an address or a token;
//   - hand on what the secret-scanning API returns beyond the alert numbers: its answer holds the
//     leaked secret itself.

import { spawnSync } from 'node:child_process';
import { Resolver } from 'node:dns/promises';
import tls from 'node:tls';

const HOST_RE = /^[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?$/i;
const SHA_RE = /^[0-9a-f]{40}$/;
const REF_RE = /^[A-Za-z0-9][A-Za-z0-9._/-]*$/;
const PATH_RE = /^[A-Za-z0-9._][A-Za-z0-9._/-]*$/;
const GITHUB_API = 'https://api.github.com';

const isoOrNull = (value) => {
  const ms = typeof value === 'string' ? Date.parse(value) : NaN;
  return Number.isFinite(ms) ? new Date(ms).toISOString() : null;
};

const isRef = (value) =>
  typeof value === 'string' && REF_RE.test(value) && !value.includes('..');

// --- web ----------------------------------------------------------------------------------

/**
 * GET of an https origin (`https://<host>/`), without following a redirect: the answer of the
 * host itself, status and headers (names in lower case). The body is dropped unread.
 */
export function createWebProbe({
  fetchImpl = globalThis.fetch,
  timeoutMs = 20000,
} = {}) {
  return async ({ url } = {}) => {
    if (typeof url !== 'string' || !/^https:\/\/[a-z0-9.-]+\/$/i.test(url)) {
      return { ok: false, error: 'bad_url' };
    }
    try {
      const response = await fetchImpl(url, {
        method: 'GET',
        redirect: 'manual',
        headers: {
          'User-Agent': 'davintrade-security-pipeline',
          Accept: 'text/html,*/*',
        },
        signal: AbortSignal.timeout(timeoutMs),
      });
      try {
        await response.body?.cancel();
      } catch {
        // the body is not needed
      }
      const headers = {};
      response.headers.forEach((value, name) => {
        headers[name.toLowerCase()] = value;
      });
      return { ok: true, status: response.status, headers };
    } catch (error) {
      return {
        ok: false,
        error: error?.name === 'TimeoutError' ? 'timeout' : 'network_error',
      };
    }
  };
}

// --- tls ----------------------------------------------------------------------------------

// Node's codes for a certificate that fails validation: an answer, not a broken probe.
const CERT_ERROR =
  /^(?:CERT_|ERR_TLS_CERT_|DEPTH_ZERO_|SELF_SIGNED_|UNABLE_TO_|HOSTNAME_MISMATCH|INVALID_PURPOSE|PATH_LENGTH|KEYUSAGE_)/;

/**
 * A TLS handshake with the host, validating the certificate chain and the host name as any
 * client would. `authorized: false` carries the validation error code; the dates come from the
 * peer certificate of a handshake that succeeded.
 */
export function createTlsProbe({
  connect = tls.connect,
  timeoutMs = 15000,
} = {}) {
  return ({ host, port = 443 } = {}) =>
    new Promise((resolve) => {
      if (typeof host !== 'string' || !HOST_RE.test(host)) {
        resolve({ ok: false, error: 'bad_host' });
        return;
      }
      let socket = null;
      let settled = false;
      const done = (result) => {
        if (settled) return;
        settled = true;
        try {
          socket?.destroy();
        } catch {
          // already closed
        }
        resolve(result);
      };
      try {
        // certificate validation stays on: no rejectUnauthorized option is passed
        socket = connect({ host, port, servername: host, timeout: timeoutMs });
      } catch {
        done({ ok: false, error: 'network_error' });
        return;
      }
      socket.once('secureConnect', () => {
        const cert = socket.getPeerCertificate();
        done({
          ok: true,
          authorized: socket.authorized === true,
          authorizationError: socket.authorizationError
            ? String(socket.authorizationError)
            : null,
          validFrom: isoOrNull(cert?.valid_from),
          validTo: isoOrNull(cert?.valid_to),
        });
      });
      socket.once('timeout', () => done({ ok: false, error: 'timeout' }));
      socket.once('error', (error) => {
        const code = typeof error?.code === 'string' ? error.code : '';
        done(
          CERT_ERROR.test(code)
            ? {
                ok: true,
                authorized: false,
                authorizationError: code,
                validFrom: null,
                validTo: null,
              }
            : { ok: false, error: 'network_error' }
        );
      });
    });
}

// --- dns ----------------------------------------------------------------------------------

/**
 * Address (A, AAAA) and alias (CNAME) records of a name. "No such name" and "no data" mean no
 * records; any other resolver failure is a failed probe, never "no record".
 */
export function createDnsProbe({
  resolver = new Resolver({ timeout: 5000, tries: 2 }),
} = {}) {
  const lookups = [
    ['resolve4', 'addresses'],
    ['resolve6', 'addresses'],
    ['resolveCname', 'cnames'],
  ];
  return async ({ host } = {}) => {
    if (typeof host !== 'string' || !HOST_RE.test(host)) {
      return { ok: false, error: 'bad_host' };
    }
    const out = { ok: true, addresses: [], cnames: [] };
    for (const [method, key] of lookups) {
      try {
        out[key].push(...(await resolver[method](host)));
      } catch (error) {
        const code = error?.code;
        if (code === 'ENOTFOUND' || code === 'ENODATA') continue;
        return {
          ok: false,
          error:
            code === 'ETIMEOUT'
              ? 'timeout'
              : code === 'ESERVFAIL'
                ? 'servfail'
                : 'resolver_error',
        };
      }
    }
    return out;
  };
}

// --- github -------------------------------------------------------------------------------

const QUERY_KEY_RE = /^[a-z_]{1,30}$/;
const QUERY_VALUE_RE = /^[A-Za-z0-9_.-]{1,30}$/;

/**
 * One GET of the GitHub REST API for the repository: the shared core of the GitHub probes.
 * `path` is what follows `/repos/{owner}/{repo}`; `query` is a flat object of short plain words.
 * The token goes to the API origin only and a redirect is not followed. The body of an error
 * answer is not kept. `project` reduces a successful body where it is parsed, so a probe that
 * needs one field of a sensitive answer never hands the rest on.
 */
async function githubGet({
  fetchImpl,
  token,
  repo,
  apiBase,
  timeoutMs,
  path,
  query = null,
  project = (body) => body,
}) {
  const failure = (error) => ({ ok: false, status: 0, body: null, error });
  if (!token) return failure('no_token');
  if (
    typeof repo !== 'string' ||
    !/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repo)
  ) {
    return failure('bad_repo');
  }
  if (
    typeof path !== 'string' ||
    (path !== '' &&
      (!/^\/[A-Za-z0-9_./-]*$/.test(path) ||
        path.includes('..') ||
        path.includes('//')))
  ) {
    return failure('bad_path');
  }
  let search = '';
  if (query !== null) {
    const pairs =
      query && typeof query === 'object' && !Array.isArray(query)
        ? Object.entries(query)
        : [];
    if (
      pairs.length === 0 ||
      pairs.some(
        ([key, value]) =>
          !QUERY_KEY_RE.test(key) || !QUERY_VALUE_RE.test(String(value))
      )
    ) {
      return failure('bad_query');
    }
    search = `?${pairs.map(([key, value]) => `${key}=${value}`).join('&')}`;
  }
  try {
    const response = await fetchImpl(
      `${apiBase}/repos/${repo}${path}${search}`,
      {
        method: 'GET',
        redirect: 'manual',
        headers: {
          Accept: 'application/vnd.github+json',
          Authorization: `Bearer ${token}`,
          'X-GitHub-Api-Version': '2022-11-28',
          'User-Agent': 'davintrade-security-pipeline',
        },
        signal: AbortSignal.timeout(timeoutMs),
      }
    );
    let body = null;
    if (response.ok && response.status !== 204) {
      try {
        body = project(await response.json());
      } catch {
        body = null;
      }
    }
    return {
      ok: response.ok,
      status: response.status,
      body,
      rateLimited:
        response.status === 403 &&
        response.headers.get('x-ratelimit-remaining') === '0',
      error: response.ok ? null : `http_${response.status}`,
      link: response.headers.get('link') ?? null,
    };
  } catch (error) {
    return failure(
      error?.name === 'TimeoutError' ? 'timeout' : 'network_error'
    );
  }
}

/**
 * One GET of the GitHub REST API for the repository (`path` is what follows
 * `/repos/{owner}/{repo}`, `query` an optional flat object of short plain words). The token
 * goes to the API origin only and a redirect is not followed. The body of an error answer is
 * not kept.
 */
export function createGithubProbe({
  fetchImpl = globalThis.fetch,
  token,
  repo,
  apiBase = GITHUB_API,
  timeoutMs = 30000,
}) {
  return async ({ path, query = null } = {}) => {
    const answer = await githubGet({
      fetchImpl,
      token,
      repo,
      apiBase,
      timeoutMs,
      path,
      query,
    });
    // the Link header is for the secret-scanning probe only: this answer keeps its old shape
    delete answer.link;
    return answer;
  };
}

/** How many open secret-scanning alerts one sweep reads (a single page of the API). */
export const SECRET_ALERTS_PER_PAGE = 10;

// The alert numbers of one page, and nothing else: the answer of the secret-scanning API carries
// the leaked secret itself, its type, its locations and links, none of which may outlive the line
// that parses it. A body that is not a list is not an answer (null).
function alertNumbers(body) {
  if (!Array.isArray(body)) return null;
  const numbers = new Set();
  for (const alert of body) {
    const number = alert?.number;
    if (Number.isSafeInteger(number) && number > 0) numbers.add(number);
    if (numbers.size >= SECRET_ALERTS_PER_PAGE) break;
  }
  return [...numbers].sort((a, b) => a - b);
}

/**
 * The open secret-scanning alerts of the repository, read-only:
 * `GET /repos/{owner}/{repo}/secret-scanning/alerts?state=open&per_page=10`.
 *
 * It answers with the alert numbers and nothing else (see `alertNumbers`): no secret, no secret
 * type, no file path, no URL, and no error body. A token without the right to read the alerts, a
 * repository with secret scanning off and a rate limit all come back as `ok: false` with the HTTP
 * status and a fixed code, so the sweep can report the check as unavailable.
 *
 * @returns {() => Promise<{ ok: true, status: number, numbers: number[], more: boolean } | { ok: false, status: number, rateLimited: boolean, error: string }>}
 */
export function createSecretScanningProbe({
  fetchImpl = globalThis.fetch,
  token,
  repo,
  apiBase = GITHUB_API,
  timeoutMs = 30000,
} = {}) {
  return async () => {
    const answer = await githubGet({
      fetchImpl,
      token,
      repo,
      apiBase,
      timeoutMs,
      path: '/secret-scanning/alerts',
      query: { state: 'open', per_page: String(SECRET_ALERTS_PER_PAGE) },
      project: alertNumbers,
    });
    if (answer.ok !== true) {
      return {
        ok: false,
        status: answer.status,
        rateLimited: answer.rateLimited === true,
        error: answer.error,
      };
    }
    if (!Array.isArray(answer.body)) {
      return {
        ok: false,
        status: answer.status,
        rateLimited: false,
        error: 'unexpected_response',
      };
    }
    return {
      ok: true,
      status: answer.status,
      numbers: answer.body,
      // a Link header with a next page: more alerts are open than this sweep lists
      more: /rel="next"/.test(answer.link ?? ''),
    };
  };
}

// --- git ----------------------------------------------------------------------------------

/**
 * The three Git questions of the deployed-build check, asked with fixed argument lists and no
 * shell. A ref, a sha or a path that could be read as an option is refused unstarted.
 */
export function createGitProbe({ cwd, spawn = spawnSync } = {}) {
  const run = (args, timeout = 60000) => {
    const result = spawn('git', args, {
      cwd,
      encoding: 'utf8',
      timeout,
      windowsHide: true,
      shell: false,
      maxBuffer: 1 << 24,
      env: {
        ...process.env,
        GIT_TERMINAL_PROMPT: '0',
        GCM_INTERACTIVE: 'never',
        GIT_OPTIONAL_LOCKS: '0',
      },
    });
    return {
      status: result.error ? null : result.status,
      stdout: result.stdout ?? '',
    };
  };
  return {
    /** Updates the remote-tracking branch of `mainRef` (refs only, never the work tree). */
    async fetchMain({ mainRef } = {}) {
      if (!isRef(mainRef)) return { ok: false };
      const at = mainRef.indexOf('/');
      if (at === -1) return { ok: true, skipped: true }; // a local branch: nothing to fetch
      const remote = mainRef.slice(0, at);
      const branch = mainRef.slice(at + 1);
      if (!isRef(remote) || !isRef(branch)) return { ok: false };
      return {
        ok:
          run(['fetch', '--quiet', '--no-tags', remote, branch], 120000)
            .status === 0,
      };
    },
    /** The full commit sha a ref or an abbreviated sha names, or null. */
    async resolve(ref) {
      if (!isRef(ref)) return null;
      const { status, stdout } = run([
        'rev-parse',
        '--verify',
        '--quiet',
        `${ref}^{commit}`,
      ]);
      const sha = stdout.trim();
      return status === 0 && SHA_RE.test(sha) ? sha : null;
    },
    /**
     * Commits on the first-parent line of `mainRef` that touch `paths` and are not in the
     * deployed build, oldest first. The first-parent line is what landed on `main`, so a
     * commit's time is when it was merged, not when its branch was started.
     */
    async pending({ deployed, mainRef, paths } = {}) {
      if (
        typeof deployed !== 'string' ||
        !SHA_RE.test(deployed) ||
        !isRef(mainRef) ||
        !Array.isArray(paths) ||
        paths.length === 0 ||
        paths.some(
          (p) =>
            typeof p !== 'string' ||
            !PATH_RE.test(p) ||
            p.split('/').includes('..')
        )
      ) {
        return { ok: false, error: 'bad_input' };
      }
      const { status, stdout } = run([
        'log',
        '--first-parent',
        '--reverse',
        '--format=%H%x09%ct',
        `${deployed}..${mainRef}`,
        '--',
        ...paths,
      ]);
      if (status !== 0) return { ok: false, error: 'git_error' };
      const commits = [];
      for (const line of stdout.split(/\r?\n/)) {
        const [sha, seconds] = line.split('\t');
        if (SHA_RE.test(sha ?? '') && /^\d{1,12}$/.test(seconds ?? '')) {
          commits.push({
            sha,
            at: new Date(Number(seconds) * 1000).toISOString(),
          });
        }
      }
      return { ok: true, commits };
    },
  };
}

// --- credentials and wiring ----------------------------------------------------------------

/**
 * The credential Git holds for github.com (`git credential fill`), in memory only: the caller
 * parses it and never prints or stores it. Returns Git's stdout, or null.
 */
export function createCredentialFill({ spawn = spawnSync } = {}) {
  return () => {
    const result = spawn('git', ['credential', 'fill'], {
      input: 'protocol=https\nhost=github.com\n\n',
      encoding: 'utf8',
      timeout: 20000,
      windowsHide: true,
      env: {
        ...process.env,
        GIT_TERMINAL_PROMPT: '0',
        GCM_INTERACTIVE: 'never',
      },
    });
    return result.status === 0 ? result.stdout : null;
  };
}

/** All six probes of one sweep. `root` is the repository Git runs in. */
export function createPostureProbes({
  root,
  token = null,
  repo,
  fetchImpl = globalThis.fetch,
} = {}) {
  return {
    web: createWebProbe({ fetchImpl }),
    tls: createTlsProbe(),
    dns: createDnsProbe(),
    github: createGithubProbe({ fetchImpl, token, repo }),
    secretScanning: createSecretScanningProbe({ fetchImpl, token, repo }),
    git: createGitProbe({ cwd: root }),
  };
}
