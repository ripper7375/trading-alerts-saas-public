// The real probes of the behaviour signals (behaviour-signals-lib.mjs): the GitHub REST API for
// BS-6 and the public health endpoint of the gateway for BS-5. Each factory takes the primitive it
// wraps (`fetch`, the GitHub probe) so the tests can fake it; nothing here runs at import time.
//
// What the wrappers refuse to do:
//   - send the GitHub token anywhere but the API origin (the GitHub probe of the posture sweep
//     does that), or send any credential to the gateway (its health endpoint is public);
//   - follow a redirect, or read an answer bigger than 64 KB;
//   - return an error message: failures come back as fixed codes, because a message can quote a
//     host, an address or a token.

import { parseQueueSample } from './behaviour-signals-lib.mjs';
import { createGithubProbe } from './posture-sweep-probes.mjs';

const SHA_RE = /^[0-9a-f]{40}$/;
const ANCHOR_RE = /^[0-9a-f]{7,40}$/;
const REF_RE = /^[A-Za-z0-9][A-Za-z0-9._/-]*$/;
const MAX_BODY_BYTES = 64 * 1024;
const LOOKUP_CONCURRENCY = 5;
const MAX_COMMITS_LIMIT = 200;

const isObject = (value) =>
  value !== null && typeof value === 'object' && !Array.isArray(value);
const isRef = (value) =>
  typeof value === 'string' && REF_RE.test(value) && !value.includes('..');
const isoOrNull = (value) => {
  const ms = typeof value === 'string' ? Date.parse(value) : NaN;
  return Number.isFinite(ms) ? new Date(ms).toISOString() : null;
};
const safeCode = (value, fallback) =>
  typeof value === 'string' && /^[a-z0-9_]{1,40}$/i.test(value)
    ? value
    : fallback;
// the first line of a commit message: no control characters, cut short
const subjectOf = (message) =>
  String(message ?? '')
    .split(/\r?\n/, 1)[0]
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001f\u007f]+/g, ' ')
    .trim()
    .slice(0, 160);

// --- main: a push that did not come from a merged pull request ---------------------------------------

/** A commit of the GitHub API as the walk needs it, or null when it is not well formed. */
function readCommit(body) {
  if (
    !isObject(body) ||
    typeof body.sha !== 'string' ||
    !SHA_RE.test(body.sha)
  ) {
    return null;
  }
  if (!Array.isArray(body.parents)) return null;
  const parents = body.parents.map((p) => (isObject(p) ? p.sha : null));
  if (parents.some((sha) => typeof sha !== 'string' || !SHA_RE.test(sha))) {
    return null;
  }
  return {
    sha: body.sha,
    parents,
    at: isoOrNull(body.commit?.committer?.date ?? body.commit?.author?.date),
    subject: subjectOf(body.commit?.message),
  };
}

/** A pull request of the commit-to-pulls endpoint, reduced to what the evaluation reads. */
function readPull(pull) {
  if (!isObject(pull)) return null;
  return {
    number: Number.isInteger(pull.number) ? pull.number : null,
    merged: isoOrNull(pull.merged_at) !== null,
    baseRef: typeof pull.base?.ref === 'string' ? pull.base.ref : null,
  };
}

const githubError = (answer) =>
  answer?.rateLimited === true
    ? 'rate_limited'
    : safeCode(answer?.error, 'github_error');

/**
 * Walks the first-parent line of `main` from its tip down to the baseline and asks GitHub which
 * merged pull request, if any, introduced each commit.
 *
 * The line is followed by parent links, not by dates: the commit list of the API is ordered by
 * date and holds the commits of the merged branches too. A time baseline stops at the first
 * commit older than it (a commit that carries a forged old date escapes that); a baseline commit
 * (`baseline.sha`) stops at that commit whatever the dates say.
 *
 * @param {{ github: (input: { path: string }) => Promise<{ ok: boolean, status?: number, body?: unknown, error?: string | null, rateLimited?: boolean }> }} deps
 * @returns {(input: { baseline: { source?: string, at: string | null, sha: string | null }, mainBranch?: string, maxCommits?: number }) => Promise<object>}
 */
export function createMainPushProbe({ github }) {
  return async ({ baseline, mainBranch = 'main', maxCommits = 60 } = {}) => {
    if (!isRef(mainBranch)) return { ok: false, error: 'bad_branch' };
    const anchor = baseline?.sha ?? null;
    const sinceMs = anchor === null ? Date.parse(baseline?.at) : null;
    if (
      !isObject(baseline) ||
      (anchor !== null ? !ANCHOR_RE.test(anchor) : !Number.isFinite(sinceMs)) ||
      !Number.isInteger(maxCommits) ||
      maxCommits < 1 ||
      maxCommits > MAX_COMMITS_LIMIT
    ) {
      return { ok: false, error: 'bad_input' };
    }

    const walked = [];
    let anchorFound = anchor === null ? null : false;
    let truncated = false;
    let answer = await github({ path: `/commits/${mainBranch}` });
    for (;;) {
      if (!answer?.ok) return { ok: false, error: githubError(answer) };
      const commit = readCommit(answer.body);
      if (commit === null) return { ok: false, error: 'bad_response' };
      if (anchor !== null && commit.sha.startsWith(anchor)) {
        anchorFound = true;
        break;
      }
      if (
        anchor === null &&
        commit.at !== null &&
        Date.parse(commit.at) < sinceMs
      ) {
        break;
      }
      if (walked.length >= maxCommits) {
        truncated = true;
        break;
      }
      walked.push(commit);
      if (commit.parents.length === 0) break; // the first commit of the repository
      answer = await github({ path: `/commits/${commit.parents[0]}` });
    }

    const commits = walked.map((c) => ({
      sha: c.sha,
      at: c.at,
      parents: c.parents.length,
      subject: c.subject,
      pulls: null,
    }));
    for (let i = 0; i < commits.length; i += LOOKUP_CONCURRENCY) {
      await Promise.all(
        commits.slice(i, i + LOOKUP_CONCURRENCY).map(async (c) => {
          const pulls = await github({ path: `/commits/${c.sha}/pulls` });
          if (pulls?.ok && Array.isArray(pulls.body)) {
            c.pulls = pulls.body.map(readPull).filter((p) => p !== null);
          } // otherwise it stays null: the commit is undecided, never reviewed
        })
      );
    }
    return { ok: true, commits, truncated, anchorFound };
  };
}

// --- queue: the public health endpoint of the gateway ---------------------------------------------------

/** The address as the probe will request it, or null: https only, no credentials in it. */
function httpsUrl(value) {
  if (typeof value !== 'string' || value === '') return null;
  let url;
  try {
    url = new URL(value);
  } catch {
    return null;
  }
  return url.protocol === 'https:' &&
    url.username === '' &&
    url.password === '' &&
    url.hostname !== ''
    ? url.href
    : null;
}

// The body as text, or null when it is larger than the limit (the rest is not read).
async function readCapped(response, limit) {
  const reader = response.body?.getReader?.();
  if (!reader) {
    const text = await response.text();
    return text.length <= limit ? text : null;
  }
  const chunks = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > limit) {
      try {
        await reader.cancel();
      } catch {
        // the rest is not needed
      }
      return null;
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks).toString('utf8');
}

/**
 * One GET of the gateway health endpoint: the `queue` counts of `services.queue`, stamped with
 * the time they were read. `url` comes from the owner's private settings and is never returned.
 */
export function createQueueProbe({
  fetchImpl = globalThis.fetch,
  url,
  timeoutMs = 20000,
  now = () => new Date(),
} = {}) {
  const target = httpsUrl(url);
  return async () => {
    if (target === null) return { ok: false, error: 'no_url' };
    try {
      const response = await fetchImpl(target, {
        method: 'GET',
        redirect: 'manual',
        headers: {
          Accept: 'application/json',
          'User-Agent': 'davintrade-security-pipeline',
        },
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (!response.ok) {
        try {
          await response.body?.cancel();
        } catch {
          // the body is not needed
        }
        return { ok: false, error: `http_${response.status}` };
      }
      const text = await readCapped(response, MAX_BODY_BYTES);
      if (text === null) return { ok: false, error: 'bad_response' };
      let body;
      try {
        body = JSON.parse(text);
      } catch {
        return { ok: false, error: 'bad_response' };
      }
      const queue = body?.services?.queue;
      if (!isObject(queue)) return { ok: false, error: 'bad_response' };
      if (queue.status !== 'up') return { ok: false, error: 'queue_down' };
      const sample = parseQueueSample({
        at: now().toISOString(),
        waiting: queue.waiting,
        failed: queue.failed,
        active: queue.active,
      });
      return sample === null
        ? { ok: false, error: 'bad_response' }
        : { ok: true, sample };
    } catch (error) {
      return {
        ok: false,
        error: error?.name === 'TimeoutError' ? 'timeout' : 'network_error',
      };
    }
  };
}

// --- wiring ---------------------------------------------------------------------------------------------------------

/**
 * The probes of one behaviour sweep. The queue probe exists only when the owner gave the address
 * of the health endpoint; without it BS-5 judges the saved samples alone.
 */
export function createBehaviourProbes({
  token = null,
  repo,
  fetchImpl = globalThis.fetch,
  gatewayHealthUrl = null,
} = {}) {
  const github = createGithubProbe({ fetchImpl, token, repo });
  return {
    mainPush: createMainPushProbe({ github }),
    ...(gatewayHealthUrl
      ? { queue: createQueueProbe({ fetchImpl, url: gatewayHealthUrl }) }
      : {}),
  };
}
