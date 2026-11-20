// Pure helpers for scripts/security/dismiss-nonprod-dependabot-alerts.mjs.
//
// The repository is public, so nothing here may print an advisory identifier
// (CVE or GHSA), a package name, a version or an advisory summary. Output is
// limited to aggregate counts and the fixed directory prefixes below.

export const DEFAULT_REPO = 'ripper7375/trading-alerts-saas-public';
export const DEFAULT_API_BASE = 'https://api.github.com';
export const DEFAULT_MAX_DISMISS = 4500;
export const DEFAULT_CONCURRENCY = 5;
export const RATE_LIMIT_RESERVE = 150;

// Manifests under these directories are reference, archived, prototype or
// pre-release code that never ships. Each prefix ends with a slash, so a live
// path that only shares the first letters (for example `seed-codex/`) never
// matches.
export const NONPROD_PREFIXES = Object.freeze([
  'seed-code/',
  'archive/',
  'frontend-and-backend-python-stack/davintrade-prototype/',
  'mobile-app/',
  'davintrade-mobile-app/',
]);

export const DISMISS_BODY = Object.freeze({
  state: 'dismissed',
  dismissed_reason: 'not_used',
  dismissed_comment:
    'Auto-triaged: manifest belongs to non-production reference, archived, prototype, or pre-release mobile directory.',
});

const REPO_PATTERN = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;

/**
 * Returns the non-production prefix a manifest path falls under, or null.
 * @param {unknown} manifestPath
 * @returns {string | null}
 */
export function matchNonProdPrefix(manifestPath) {
  if (typeof manifestPath !== 'string' || manifestPath.length === 0) {
    return null;
  }
  const normalized = manifestPath
    .replace(/\\/g, '/')
    .replace(/^(\.\/|\/)+/, '');
  if (normalized.split('/').includes('..')) return null;
  return (
    NONPROD_PREFIXES.find((prefix) => normalized.startsWith(prefix)) ?? null
  );
}

/**
 * Extracts the rel="next" URL from a GitHub `Link` header.
 * @param {string | null | undefined} linkHeader
 * @returns {string | null}
 */
export function parseNextLink(linkHeader) {
  if (typeof linkHeader !== 'string' || linkHeader.length === 0) return null;
  for (const part of linkHeader.split(',')) {
    const match = part.match(/<([^>]+)>\s*;(.*)$/);
    if (!match) continue;
    const rels = match[2].match(/rel\s*=\s*"([^"]*)"/);
    if (rels && rels[1].split(/\s+/).includes('next')) return match[1];
  }
  return null;
}

/**
 * Accepts a `next` URL only when it stays on the API origin, so the token is
 * never sent to another host.
 */
export function isSameOrigin(url, apiBase) {
  try {
    return new URL(url).origin === new URL(apiBase).origin;
  } catch {
    return false;
  }
}

export class UsageError extends Error {}

/**
 * @param {string[]} argv arguments after the script name
 */
export function parseArgs(argv) {
  const options = {
    dryRun: false,
    strictRateLimit: false,
    maxDismiss: DEFAULT_MAX_DISMISS,
    repo: DEFAULT_REPO,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const [flag, inlineValue] = arg.includes('=')
      ? arg.split(/=(.*)/s, 2)
      : [arg];
    const value = () => {
      if (inlineValue !== undefined) return inlineValue;
      i += 1;
      if (i >= argv.length) throw new UsageError(`${flag} needs a value`);
      return argv[i];
    };
    switch (flag) {
      case '--dry-run':
        options.dryRun = true;
        break;
      case '--strict-rate-limit':
        options.strictRateLimit = true;
        break;
      case '--max-dismiss': {
        const raw = value().trim();
        if (!/^\d+$/.test(raw)) {
          throw new UsageError('--max-dismiss must be a whole number');
        }
        options.maxDismiss = Number.parseInt(raw, 10);
        break;
      }
      case '--repo': {
        const raw = value().trim();
        if (!REPO_PATTERN.test(raw)) {
          throw new UsageError('--repo must look like owner/name');
        }
        options.repo = raw;
        break;
      }
      case '--help':
      case '-h':
        options.help = true;
        break;
      default:
        throw new UsageError('unknown argument');
    }
  }
  return options;
}

export const USAGE = [
  'Usage: node scripts/security/dismiss-nonprod-dependabot-alerts.mjs [options]',
  '  --dry-run              list open alerts and print counts; no changes',
  `  --max-dismiss <N>      dismiss at most N alerts (default ${DEFAULT_MAX_DISMISS})`,
  `  --repo <owner/name>    repository (default ${DEFAULT_REPO})`,
  '  --strict-rate-limit    exit 2 when a rate-limit stop leaves alerts behind',
  'Token: DEPENDABOT_TRIAGE_TOKEN, else GITHUB_TOKEN.',
].join('\n');

/**
 * Reads the rate-limit state of a response.
 * @returns {{ stop: boolean, reason: string | null }}
 */
export function rateLimitState(status, headers, reserve = RATE_LIMIT_RESERVE) {
  const remainingRaw = headers?.get?.('x-ratelimit-remaining');
  const remaining =
    remainingRaw === null || remainingRaw === undefined || remainingRaw === ''
      ? null
      : Number(remainingRaw);
  const hasRetryAfter = Boolean(headers?.get?.('retry-after'));
  if (
    status === 429 ||
    (status === 403 && (remaining === 0 || hasRetryAfter))
  ) {
    return { stop: true, reason: 'rate_limited' };
  }
  if (
    remaining !== null &&
    Number.isFinite(remaining) &&
    remaining <= reserve
  ) {
    return { stop: true, reason: 'rate_limit_reserve' };
  }
  return { stop: false, reason: null };
}

function apiHeaders(token, withBody = false) {
  const headers = {
    Accept: 'application/vnd.github+json',
    Authorization: `Bearer ${token}`,
    'User-Agent': 'dependabot-triage-nonprod',
    'X-GitHub-Api-Version': '2022-11-28',
  };
  if (withBody) headers['Content-Type'] = 'application/json';
  return headers;
}

/**
 * Lists every open alert (following `Link: rel="next"`) and keeps only the
 * alert number and the matched prefix. Nothing else from an alert is kept.
 */
export async function collectOpenAlerts({
  fetchImpl,
  apiBase = DEFAULT_API_BASE,
  repo,
  token,
  reserve = RATE_LIMIT_RESERVE,
}) {
  let url = `${apiBase}/repos/${repo}/dependabot/alerts?state=open&per_page=100`;
  const matched = [];
  let scanned = 0;
  let liveOpen = 0;
  let pages = 0;
  while (url) {
    const response = await fetchImpl(url, {
      method: 'GET',
      headers: apiHeaders(token),
    });
    pages += 1;
    if (!response.ok) {
      const limit = rateLimitState(response.status, response.headers, reserve);
      const reason =
        limit.reason === 'rate_limited'
          ? 'rate_limited_while_listing'
          : `list_http_${response.status}`;
      return {
        scanned,
        matched,
        liveOpen,
        pages,
        complete: false,
        error: reason,
      };
    }
    const alerts = await response.json();
    if (!Array.isArray(alerts)) {
      return {
        scanned,
        matched,
        liveOpen,
        pages,
        complete: false,
        error: 'list_unexpected_body',
      };
    }
    for (const alert of alerts) {
      scanned += 1;
      const prefix = matchNonProdPrefix(alert?.dependency?.manifest_path);
      if (prefix && Number.isInteger(alert?.number)) {
        matched.push({ number: alert.number, prefix });
      } else {
        liveOpen += 1;
      }
    }
    const next = parseNextLink(response.headers.get('link'));
    if (next && !isSameOrigin(next, apiBase)) {
      return {
        scanned,
        matched,
        liveOpen,
        pages,
        complete: false,
        error: 'list_next_link_off_origin',
      };
    }
    url = next;
  }
  return { scanned, matched, liveOpen, pages, complete: true, error: null };
}

/**
 * Dismisses the given alerts with bounded concurrency. Stops dispatching as
 * soon as a response shows a rate limit or the remaining quota reaches the
 * reserve; requests already in flight are allowed to finish.
 */
export async function dismissAlerts({
  fetchImpl,
  apiBase = DEFAULT_API_BASE,
  repo,
  token,
  alerts,
  concurrency = DEFAULT_CONCURRENCY,
  reserve = RATE_LIMIT_RESERVE,
}) {
  const state = {
    next: 0,
    dismissed: 0,
    failed: 0,
    stoppedReason: null,
    inFlight: 0,
    maxInFlight: 0,
  };
  const body = JSON.stringify(DISMISS_BODY);

  async function worker() {
    while (state.stoppedReason === null && state.next < alerts.length) {
      const alert = alerts[state.next];
      state.next += 1;
      state.inFlight += 1;
      state.maxInFlight = Math.max(state.maxInFlight, state.inFlight);
      let response;
      try {
        response = await fetchImpl(
          `${apiBase}/repos/${repo}/dependabot/alerts/${alert.number}`,
          {
            method: 'PATCH',
            headers: apiHeaders(token, true),
            body,
          }
        );
      } catch {
        state.failed += 1;
        continue;
      } finally {
        state.inFlight -= 1;
      }
      const limit = rateLimitState(response.status, response.headers, reserve);
      if (response.ok) {
        state.dismissed += 1;
      } else if (limit.reason !== 'rate_limited') {
        state.failed += 1;
        if (response.status === 401 || response.status === 403) {
          state.stoppedReason ??= `patch_http_${response.status}`;
        }
      }
      if (limit.stop) state.stoppedReason ??= limit.reason;
    }
  }

  const workers = Array.from(
    { length: Math.max(1, Math.min(concurrency, alerts.length)) },
    worker
  );
  await Promise.all(workers);
  return {
    dismissed: state.dismissed,
    failed: state.failed,
    stoppedReason: state.stoppedReason,
    maxInFlight: state.maxInFlight,
  };
}

export function countByPrefix(alerts) {
  const counts = Object.fromEntries(
    NONPROD_PREFIXES.map((prefix) => [prefix, 0])
  );
  for (const alert of alerts) {
    if (alert.prefix in counts) counts[alert.prefix] += 1;
  }
  return counts;
}

/**
 * Builds the printable summary: fixed keys, numbers and the fixed prefixes.
 */
export function formatSummary(summary) {
  const lines = [
    `mode=${summary.dryRun ? 'dry-run' : 'live'}`,
    `scanned=${summary.scanned}`,
    `matched=${summary.matched}`,
  ];
  for (const [prefix, count] of Object.entries(summary.matchedByPrefix)) {
    lines.push(`matched_prefix ${prefix} ${count}`);
  }
  lines.push(
    `max_dismiss=${summary.maxDismiss}`,
    `would_dismiss=${summary.wouldDismiss}`,
    `dismissed=${summary.dismissed}`,
    `failed=${summary.failed}`,
    `remaining_matched=${summary.remainingMatched}`,
    `live_open_remaining=${summary.liveOpenRemaining}`,
    `stopped_reason=${summary.stoppedReason ?? 'none'}`
  );
  return lines;
}

/**
 * Runs the whole triage. Every dependency is injected so tests never touch
 * the network or the process.
 * @returns {Promise<number>} exit code
 */
export async function runTriage({
  argv,
  env,
  fetchImpl,
  log,
  apiBase = DEFAULT_API_BASE,
  concurrency = DEFAULT_CONCURRENCY,
  reserve = RATE_LIMIT_RESERVE,
}) {
  let options;
  try {
    options = parseArgs(argv);
  } catch (error) {
    if (error instanceof UsageError) {
      log(`error=usage (${error.message})`);
      log(USAGE);
      return 64;
    }
    throw error;
  }
  if (options.help) {
    log(USAGE);
    return 0;
  }
  const token = env.DEPENDABOT_TRIAGE_TOKEN || env.GITHUB_TOKEN;
  if (!token) {
    log('error=missing_token (set DEPENDABOT_TRIAGE_TOKEN or GITHUB_TOKEN)');
    return 1;
  }

  let listing;
  try {
    listing = await collectOpenAlerts({
      fetchImpl,
      apiBase,
      repo: options.repo,
      token,
      reserve,
    });
  } catch {
    listing = {
      scanned: 0,
      matched: [],
      liveOpen: 0,
      complete: false,
      error: 'list_network_error',
    };
  }

  const candidates = listing.matched.slice(0, options.maxDismiss);
  let dismissal = { dismissed: 0, failed: 0, stoppedReason: null };
  if (listing.complete && !options.dryRun && candidates.length > 0) {
    dismissal = await dismissAlerts({
      fetchImpl,
      apiBase,
      repo: options.repo,
      token,
      alerts: candidates,
      concurrency,
      reserve,
    });
  }

  let stoppedReason = listing.error ?? dismissal.stoppedReason;
  if (
    !stoppedReason &&
    listing.complete &&
    !options.dryRun &&
    listing.matched.length > candidates.length
  ) {
    stoppedReason = 'max_dismiss_reached';
  }

  const summary = {
    dryRun: options.dryRun,
    scanned: listing.scanned,
    matched: listing.matched.length,
    matchedByPrefix: countByPrefix(listing.matched),
    maxDismiss: options.maxDismiss,
    wouldDismiss: listing.complete ? candidates.length : 0,
    dismissed: dismissal.dismissed,
    failed: dismissal.failed,
    remainingMatched: listing.matched.length - dismissal.dismissed,
    liveOpenRemaining: listing.liveOpen,
    stoppedReason,
  };
  for (const line of formatSummary(summary)) log(line);

  if (listing.error) {
    return listing.error === 'rate_limited_while_listing' &&
      !options.strictRateLimit
      ? 0
      : 1;
  }
  if (
    dismissal.failed > 0 ||
    dismissal.stoppedReason?.startsWith('patch_http_')
  )
    return 1;
  if (
    options.strictRateLimit &&
    (dismissal.stoppedReason === 'rate_limited' ||
      dismissal.stoppedReason === 'rate_limit_reserve') &&
    summary.remainingMatched > 0
  ) {
    return 2;
  }
  return 0;
}
