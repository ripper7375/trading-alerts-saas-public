// Live posture sweep of the private security pipeline (Phase 3 of the security
// monitoring architecture, v3.0, sections 6.2 and 6.3): the attack surface and
// the drift of the live state, checked from outside.
//
//   web      the security response headers of the public site and the apex redirect
//   tls      the certificate of the public site: valid, and more than 21 days left
//   dns      a paused asset must not resolve (rule R-9: an unexpected public endpoint)
//   github   the repository security settings against the recorded Phase 0 and 1 baseline
//   runtime  what the services report in reports/runtime-state.json: the Node patch
//            level against the floors, the deployed commit against `main`, the base image
//
// Pure functions. Every probe (HTTP, TLS, DNS, the GitHub API, Git) is injected, so
// the tests run without a network, and nothing here prints. The repository is public:
// the only output that may name a host or a setting is the private, gitignored report;
// the console summary is counts and fixed words (`renderPostureSweepStdout`).
//
// A check ends in one of four states:
//   pass         the control is as recorded
//   fail         it is not; becomes a finding with a priority and a rule
//   unavailable  the probe could not run (network, API, Git): the sweep is degraded, because
//                the absence of a finding is then no proof of safety
//   skipped      there is nothing to judge (offline by choice, no data recorded): not degraded
//
// reports/runtime-state.json (schema 1.0 or 1.1, every field optional except `assets`):
//   { "schema_version": "1.1", "read_at": "<ISO time>",
//     "assets": { "<asset id>": { "node": "24.22.3", "verified": true,
//         "commit_sha": "<hex>", "deployed_at": "<ISO time>", "read_at": "<ISO time>",
//         "base_image": { "tag": "alpine:3.24", "digest": "sha256:<hex>" }, "note": "..." } } }

import { DEFAULT_REPO } from './dependabot-triage-lib.mjs';
import {
  SLA,
  compareFindings,
  escapeMarkdownCell,
  evaluateRuntimeFloors,
  findingKey,
  makeFinding,
  scoreFinding,
  vexExpiryReasons,
  vexStatementMatches,
} from './security-pipeline-lib.mjs';

const DAY_MS = 86400000;
const HOUR_MS = 3600000;

/** The recorded state of the controls. A change here is a decision, not a fix. */
export const POSTURE_BASELINE = Object.freeze({
  web: Object.freeze({
    hstsMinMaxAge: 31536000, // one year; the live value is two years
  }),
  tls: Object.freeze({
    warnDays: 21, // P2 at or below this many days
    criticalDays: 7, // P1 at or below this many days
  }),
  deploy: Object.freeze({
    graceHours: 24, // a merged change may wait this long for its deploy
    staleReadDays: 7, // a runtime reading older than this is stale
  }),
  github: Object.freeze({
    secretScanning: 'enabled',
    pushProtection: 'enabled',
    branchRules: Object.freeze(['deletion', 'non_fast_forward']),
    allowedActions: 'selected',
    shaPinningRequired: true,
    defaultWorkflowPermissions: 'read',
    canApprovePullRequestReviews: false,
  }),
});

/**
 * Rules of the posture checks. R-9 and R-7 are the rules of section 7.4; PS-n are the
 * posture rules (priority and time to a fix, the same wording as the matrix).
 */
export const POSTURE_RULES = Object.freeze({
  'R-7': { priority: 'P1', sla: SLA['R-7'] },
  'R-9': { priority: 'P1', sla: SLA['R-9'] },
  'PS-1': { priority: 'P1', sla: '< 72 h (restore the recorded setting)' },
  'PS-2': { priority: 'P1', sla: 'Before the certificate expires' },
  'PS-3': { priority: 'P2', sla: '14 days (the auto-renewal should have run)' },
  'PS-4': { priority: 'P1', sla: '< 72 h (restore the header)' },
  'PS-5': { priority: 'P2', sla: '14-30 days' },
  'PS-6': { priority: 'P2', sla: '14-30 days (deploy the merged change)' },
});

/** Finding kinds the posture sweep creates (the LINE notifier groups them). */
export const POSTURE_KINDS = Object.freeze([
  'public-endpoint',
  'posture-drift',
  'web-headers',
  'tls-certificate',
  'deploy-drift',
]);

export const AREAS = Object.freeze(['web', 'tls', 'dns', 'github', 'runtime']);

// --- small helpers ------------------------------------------------------------------------

const asArray = (value) => (Array.isArray(value) ? value : []);
const isObject = (value) =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

// Control characters are removed and a long value is cut: an observed value comes from
// the network, and is never stored whole.
function short(value, max = 120) {
  const text = String(value ?? '')
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001f\u007f]+/g, ' ')
    .trim();
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

// A reason code from a probe: fixed words only, never a message that could quote data.
const safeCode = (value, fallback = 'probe_error') =>
  typeof value === 'string' && /^[a-z0-9_]{1,40}$/i.test(value)
    ? value
    : fallback;

const isoOrNull = (value) => {
  const ms = typeof value === 'string' ? Date.parse(value) : NaN;
  return Number.isFinite(ms) ? new Date(ms).toISOString() : null;
};

const HOSTNAME_RE = /^(?:[a-z0-9-]+\.)+[a-z]{2,}$/i;
const SHA_RE = /^[0-9a-f]{7,40}$/i;
const ASSET_ID_RE = /^[a-z0-9][a-z0-9-]{0,39}$/;

// --- check constructors -------------------------------------------------------------------

function makeCheck(base, status, extra = {}) {
  const rule = status === 'fail' ? extra.rule : null;
  return {
    id: base.id,
    area: base.area,
    assetId: base.assetId,
    title: base.title,
    status,
    priority: rule ? POSTURE_RULES[rule].priority : null,
    rule,
    expected: base.expected ?? null,
    observed: extra.observed ?? null,
    detail: extra.detail ?? null,
  };
}
const pass = (base, observed) => makeCheck(base, 'pass', { observed });
const fail = (base, rule, observed) =>
  makeCheck(base, 'fail', { rule, observed: short(observed) });
const unavailable = (base, detail) =>
  makeCheck(base, 'unavailable', { detail: safeCode(detail) });
const skipped = (base, detail) =>
  makeCheck(base, 'skipped', { detail: safeCode(detail) });

/** Maps a probe result that did not run (offline by choice, or a failure) to a check. */
const notRun = (base, result) =>
  result?.skipped === true
    ? skipped(base, result.error ?? 'offline')
    : unavailable(base, result?.error);

// --- web: response headers --------------------------------------------------------------------

/** Header names compared in lower case; values trimmed; an empty value counts as absent. */
function normalizeHeaders(headers) {
  const out = {};
  if (!isObject(headers)) return out;
  for (const [name, raw] of Object.entries(headers)) {
    const value = Array.isArray(raw) ? raw.join(', ') : raw;
    if (typeof value !== 'string') continue;
    const trimmed = value.trim();
    if (trimmed !== '') out[name.toLowerCase()] = trimmed;
  }
  return out;
}

/** `max-age=63072000; includeSubDomains; preload` -> its parts. */
export function parseHsts(value) {
  const out = { maxAge: null, includeSubDomains: false, preload: false };
  for (const part of String(value ?? '').split(';')) {
    const directive = part.trim();
    const eq = directive.indexOf('=');
    const name = (eq === -1 ? directive : directive.slice(0, eq))
      .trim()
      .toLowerCase();
    if (name === 'max-age' && eq !== -1) {
      const digits = directive
        .slice(eq + 1)
        .trim()
        .replace(/^"(.*)"$/, '$1');
      if (/^\d{1,12}$/.test(digits)) out.maxAge = Number(digits);
    } else if (name === 'includesubdomains') out.includeSubDomains = true;
    else if (name === 'preload') out.preload = true;
  }
  return out;
}

const WEB = { area: 'web', assetId: 'public-web' };

const HEADER_SPECS = [
  {
    id: 'web-hsts',
    header: 'strict-transport-security',
    title: 'HSTS with includeSubDomains and a max-age of a year or more',
    expected: 'max-age of a year or more; includeSubDomains',
    rule: 'PS-4',
    judge: (value) => {
      const hsts = parseHsts(value);
      return (
        hsts.maxAge !== null &&
        hsts.maxAge >= POSTURE_BASELINE.web.hstsMinMaxAge &&
        hsts.includeSubDomains
      );
    },
  },
  {
    id: 'web-csp',
    header: 'content-security-policy',
    title: 'Content-Security-Policy is enforced',
    expected: 'present (enforcing)',
    rule: 'PS-4',
    judge: () => true,
    describe: (value, headers) =>
      value === undefined && headers['content-security-policy-report-only']
        ? 'report-only (not enforced)'
        : undefined,
  },
  {
    id: 'web-x-frame-options',
    header: 'x-frame-options',
    title: 'X-Frame-Options is DENY or SAMEORIGIN',
    expected: 'DENY or SAMEORIGIN',
    rule: 'PS-5',
    judge: (value) => /^(?:deny|sameorigin)$/i.test(value),
  },
  {
    id: 'web-x-content-type-options',
    header: 'x-content-type-options',
    title: 'X-Content-Type-Options is nosniff',
    expected: 'nosniff',
    rule: 'PS-5',
    judge: (value) => value.toLowerCase() === 'nosniff',
  },
  {
    id: 'web-referrer-policy',
    header: 'referrer-policy',
    title: 'Referrer-Policy is set and is not unsafe-url',
    expected: 'present; not unsafe-url',
    rule: 'PS-5',
    judge: (value) => {
      const last = value.split(',').pop().trim().toLowerCase();
      return last !== '' && last !== 'unsafe-url';
    },
  },
  {
    id: 'web-permissions-policy',
    header: 'permissions-policy',
    title: 'Permissions-Policy is set',
    expected: 'present',
    rule: 'PS-5',
    judge: () => true,
  },
];

/** The six required response headers of the public site (section 5 and 6.3). */
export function evaluateWebHeaders(headers) {
  const h = normalizeHeaders(headers);
  return HEADER_SPECS.map((spec) => {
    const base = {
      ...WEB,
      id: spec.id,
      title: spec.title,
      expected: spec.expected,
    };
    const value = h[spec.header];
    if (value === undefined) {
      return fail(base, spec.rule, spec.describe?.(value, h) ?? 'missing');
    }
    if (!spec.judge(value)) return fail(base, spec.rule, value);
    return pass(base, spec.id === 'web-csp' ? 'present' : short(value));
  });
}

const REDIRECTS = new Set([301, 302, 303, 307, 308]);

/** The apex domain must redirect to the www host over https. */
export function evaluateApexRedirect({ status, location, wwwHost }) {
  const base = {
    ...WEB,
    id: 'web-apex-redirect',
    title: 'The apex domain redirects to the www host over https',
    expected: 'a redirect to https on the www host',
  };
  const apex = String(wwwHost).replace(/^www\./i, '');
  let target = null;
  if (
    REDIRECTS.has(status) &&
    typeof location === 'string' &&
    location !== ''
  ) {
    try {
      target = new URL(location, `https://${apex}/`);
    } catch {
      target = null;
    }
  }
  if (
    target &&
    target.protocol === 'https:' &&
    target.hostname.toLowerCase() === String(wwwHost).toLowerCase()
  ) {
    return pass(base, `HTTP ${status} to the www host`);
  }
  if (!REDIRECTS.has(status)) {
    return fail(base, 'PS-5', `HTTP ${status}, no redirect`);
  }
  return fail(base, 'PS-5', `HTTP ${status} to another target`);
}

// --- tls: certificate ----------------------------------------------------------------------------

/**
 * The certificate of the public site. A handshake that fails certificate validation
 * (expired, wrong name, untrusted chain) arrives as `authorized: false` with the
 * validation error code, and is a P1.
 */
export function evaluateTlsCertificate({ probe, now }) {
  const base = {
    ...WEB,
    area: 'tls',
    id: 'tls-certificate',
    title: 'The TLS certificate is valid and has more than 21 days left',
    expected: `valid; more than ${POSTURE_BASELINE.tls.warnDays} days left`,
  };
  if (probe?.skipped === true) return skipped(base, probe.error ?? 'offline');
  if (!probe || probe.ok !== true) return unavailable(base, probe?.error);
  if (probe.authorized !== true) {
    return fail(
      base,
      'PS-2',
      `invalid (${short(probe.authorizationError ?? 'unknown', 60)})`
    );
  }
  const from = Date.parse(probe.validFrom);
  const to = Date.parse(probe.validTo);
  if (!Number.isFinite(from) || !Number.isFinite(to)) {
    return unavailable(base, 'bad_certificate_data');
  }
  const nowMs = now.getTime();
  if (from > nowMs) return fail(base, 'PS-2', 'not valid yet');
  const left = to - nowMs;
  if (left <= 0) {
    return fail(base, 'PS-2', `expired ${Math.floor(-left / DAY_MS)} days ago`);
  }
  const observed = `${Math.floor(left / DAY_MS)} days left`;
  if (left > POSTURE_BASELINE.tls.warnDays * DAY_MS)
    return pass(base, observed);
  return fail(
    base,
    left > POSTURE_BASELINE.tls.criticalDays * DAY_MS ? 'PS-3' : 'PS-2',
    observed
  );
}

// --- dns: paused assets ---------------------------------------------------------------------------

/** The public DNS names of paused assets: they must not resolve. */
export function pausedHostnames(inventory) {
  return inventory.assets
    .filter((asset) => asset.lifecycle === 'paused')
    .flatMap((asset) => asset.publicHostnames)
    .filter((host) => HOSTNAME_RE.test(host));
}

const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

/**
 * While an asset is paused, its names must not resolve: a record would point at a released
 * address or a deleted service (rule R-9). Only counts are recorded, never an address.
 *
 * @param {{ inventory: object, results: Record<string, { ok: boolean, addresses?: string[], cnames?: string[], error?: string, skipped?: boolean }> }} input
 */
export function evaluateDnsGuard({ inventory, results }) {
  const checks = [];
  for (const asset of inventory.assets) {
    const hosts = asset.publicHostnames.filter((host) =>
      HOSTNAME_RE.test(host)
    );
    if (asset.lifecycle !== 'paused' || hosts.length === 0) continue;
    hosts.forEach((host, index) => {
      const base = {
        area: 'dns',
        assetId: asset.id,
        id: `dns-paused-${asset.id}${hosts.length > 1 ? `-${index + 1}` : ''}`,
        title: 'A paused asset has no public DNS record',
        expected: 'no address or alias record',
      };
      const result = results?.[host];
      if (!result) return checks.push(skipped(base, 'not_probed'));
      if (result.ok !== true) return checks.push(notRun(base, result));
      const addresses = asArray(result.addresses).length;
      const aliases = asArray(result.cnames).length;
      if (addresses + aliases === 0)
        return checks.push(pass(base, 'no record'));
      const parts = [];
      if (addresses > 0) parts.push(plural(addresses, 'address record'));
      if (aliases > 0) parts.push(plural(aliases, 'alias record'));
      return checks.push(fail(base, 'R-9', parts.join(', ')));
    });
  }
  return checks;
}

// --- github: repository settings -------------------------------------------------------------------

const GH = { area: 'github', assetId: 'github-repo' };

function githubReason(result) {
  if (result?.skipped === true) return safeCode(result.error, 'offline');
  if (result?.error === 'no_token') return 'no_token';
  const status = result?.status ?? 0;
  if (status === 401) return 'unauthorized';
  if (status === 403) return result.rateLimited ? 'rate_limited' : 'forbidden';
  if (status === 404) return 'not_found';
  if (status === 429) return 'rate_limited';
  if (status > 0) return `http_${status}`;
  return safeCode(result?.error, 'network_error');
}

/**
 * The repository security settings against the baseline of Phase 0 and 1: secret scanning
 * and push protection, Dependabot alerts, private vulnerability reporting, the ruleset on
 * `main`, and the Actions policy. Any downgrade is a P1 (rule PS-1).
 *
 * Each argument is one API answer: `{ ok, status, body, error? }`.
 */
export function evaluateGithubSettings({
  repo,
  rules,
  actions,
  workflow,
  alerts,
  pvr,
}) {
  if (repo?.ok !== true) {
    const base = {
      ...GH,
      id: 'github-probe',
      title: 'The repository settings can be read',
      expected: 'readable with admin rights',
    };
    return [
      repo?.skipped === true
        ? skipped(base, githubReason(repo))
        : unavailable(base, githubReason(repo)),
    ];
  }
  const baseline = POSTURE_BASELINE.github;
  const admin = repo.body?.permissions?.admin === true;
  const analysis = isObject(repo.body?.security_and_analysis)
    ? repo.body.security_and_analysis
    : null;
  const checks = [];

  // a value that must equal the baseline; `read` says where it lives in an answer
  const setting = (id, title, expected, source, read, want) => {
    const base = { ...GH, id, title, expected: String(expected) };
    if (source?.ok !== true)
      return checks.push(unavailable(base, githubReason(source)));
    const value = read(source.body);
    if (value === undefined || value === null) {
      return checks.push(unavailable(base, 'field_missing'));
    }
    return checks.push(
      value === want
        ? pass(base, String(value))
        : fail(base, 'PS-1', String(value))
    );
  };
  const adminSetting = (id, title, expected, read, want) => {
    if (analysis === null) {
      return checks.push(
        unavailable(
          { ...GH, id, title, expected: String(expected) },
          admin ? 'field_missing' : 'needs_admin'
        )
      );
    }
    return setting(id, title, expected, repo, () => read(analysis), want);
  };

  adminSetting(
    'github-secret-scanning',
    'Secret scanning is enabled',
    baseline.secretScanning,
    (a) => a.secret_scanning?.status,
    baseline.secretScanning
  );
  adminSetting(
    'github-push-protection',
    'Secret scanning push protection is enabled',
    baseline.pushProtection,
    (a) => a.secret_scanning_push_protection?.status,
    baseline.pushProtection
  );

  // Dependabot alerts: 204 when enabled, 404 when not (only meaningful with admin rights)
  const alertsBase = {
    ...GH,
    id: 'github-dependabot-alerts',
    title: 'Dependabot alerts are enabled',
    expected: 'enabled',
  };
  if (alerts?.status === 204) checks.push(pass(alertsBase, 'enabled'));
  else if (alerts?.status === 404) {
    checks.push(
      admin
        ? fail(alertsBase, 'PS-1', 'disabled')
        : unavailable(alertsBase, 'needs_admin')
    );
  } else checks.push(unavailable(alertsBase, githubReason(alerts)));

  const pvrBase = {
    ...GH,
    id: 'github-private-vuln-reporting',
    title: 'Private vulnerability reporting is enabled',
    expected: 'enabled',
  };
  if (pvr?.ok !== true) checks.push(unavailable(pvrBase, githubReason(pvr)));
  else if (typeof pvr.body?.enabled !== 'boolean') {
    checks.push(unavailable(pvrBase, 'field_missing'));
  } else {
    checks.push(
      pvr.body.enabled
        ? pass(pvrBase, 'enabled')
        : fail(pvrBase, 'PS-1', 'disabled')
    );
  }

  const rulesBase = {
    ...GH,
    id: 'github-branch-rules',
    title: 'The ruleset on main blocks deletion and force-push',
    expected: baseline.branchRules.join(', '),
  };
  if (rules?.ok !== true)
    checks.push(unavailable(rulesBase, githubReason(rules)));
  else if (!Array.isArray(rules.body)) {
    checks.push(unavailable(rulesBase, 'unexpected_response'));
  } else {
    const types = new Set(rules.body.map((rule) => rule?.type));
    const missing = baseline.branchRules.filter((type) => !types.has(type));
    checks.push(
      missing.length === 0
        ? pass(rulesBase, baseline.branchRules.join(', '))
        : fail(rulesBase, 'PS-1', `missing ${missing.join(', ')}`)
    );
  }

  setting(
    'github-actions-allowlist',
    'Actions are limited to an allow-list',
    baseline.allowedActions,
    actions,
    (body) => body?.allowed_actions,
    baseline.allowedActions
  );
  setting(
    'github-actions-sha-pinning',
    'Actions must be pinned by full commit SHA',
    baseline.shaPinningRequired,
    actions,
    (body) =>
      typeof body?.sha_pinning_required === 'boolean'
        ? body.sha_pinning_required
        : undefined,
    baseline.shaPinningRequired
  );
  setting(
    'github-workflow-token-read',
    'The default workflow token is read-only',
    baseline.defaultWorkflowPermissions,
    workflow,
    (body) => body?.default_workflow_permissions,
    baseline.defaultWorkflowPermissions
  );
  setting(
    'github-workflow-pr-approval',
    'Workflows cannot approve pull requests',
    baseline.canApprovePullRequestReviews,
    workflow,
    (body) =>
      typeof body?.can_approve_pull_request_reviews === 'boolean'
        ? body.can_approve_pull_request_reviews
        : undefined,
    baseline.canApprovePullRequestReviews
  );
  return checks;
}

// --- runtime state ------------------------------------------------------------------------------------

/**
 * Reads reports/runtime-state.json into the fields the sweep uses. Unknown fields are
 * ignored; what is wrong is reported as fixed issue codes.
 */
export function parseRuntimeState(raw) {
  const empty = {
    present: false,
    schemaVersion: null,
    readAt: null,
    assets: Object.create(null),
    issues: [],
  };
  if (!isObject(raw) || !isObject(raw.assets)) return empty;
  const readAt = isoOrNull(raw.read_at);
  const issues = [];
  const assets = Object.create(null);
  for (const [id, entry] of Object.entries(raw.assets)) {
    if (!ASSET_ID_RE.test(id) || !isObject(entry)) {
      issues.push('invalid_asset_entry');
      continue;
    }
    let commitSha = null;
    if (entry.commit_sha !== undefined) {
      if (
        typeof entry.commit_sha === 'string' &&
        SHA_RE.test(entry.commit_sha)
      ) {
        commitSha = entry.commit_sha.toLowerCase();
      } else issues.push('invalid_commit_sha');
    }
    const image = isObject(entry.base_image) ? entry.base_image : null;
    assets[id] = {
      node: typeof entry.node === 'string' ? entry.node : null,
      verified: entry.verified === true,
      note: typeof entry.note === 'string' ? entry.note : null,
      commitSha,
      deployedAt: isoOrNull(entry.deployed_at),
      readAt: isoOrNull(entry.read_at) ?? readAt,
      baseImage:
        image && typeof image.tag === 'string'
          ? {
              tag: image.tag,
              digest:
                typeof image.digest === 'string' &&
                /^sha256:[0-9a-f]{64}$/i.test(image.digest)
                  ? image.digest.toLowerCase()
                  : null,
            }
          : null,
    };
  }
  return {
    present: true,
    schemaVersion:
      typeof raw.schema_version === 'string' ? raw.schema_version : null,
    readAt,
    assets,
    issues,
  };
}

/**
 * The folders whose changes belong to an asset: the directories of its manifests. An asset
 * with a manifest at the repository root has no folder of its own (empty list).
 */
export function servicePaths(asset) {
  const dirs = new Set();
  for (const eco of asset.ecosystems) {
    for (const path of [
      eco.manifestPath,
      eco.lockfilePath,
      eco.dockerfilePath,
      eco.composePath,
      eco.nixpacksPath,
    ]) {
      if (typeof path !== 'string') continue;
      const clean = path.replace(/\\/g, '/').replace(/^(?:\.\/|\/)+/, '');
      const at = clean.lastIndexOf('/');
      if (at <= 0) return []; // a file at the root: the asset spans the repository
      dirs.add(clean.slice(0, at));
    }
  }
  return [...dirs].sort();
}

// --- runtime truth ----------------------------------------------------------------------------------------

const POLICY_ASSET = Object.freeze({
  id: 'inventory',
  lifecycle: 'production',
  exposureTier: 1,
  escalationRequired: false,
  buildOnlyPackages: new Set(),
});

const baseImageOf = (asset) =>
  asset.ecosystems.find((eco) => eco.baseImage)?.baseImage ?? null;

/**
 * Reads what the running services report against the floors and against `main`.
 *
 * `gitFacts` comes from Git: for each asset the commits on `main` that touch its folders and
 * are not in the deployed build. The deployed build is stale when the OLDEST such commit is
 * more than 24 hours old (a fresh commit never hides an old one).
 *
 * @param {{
 *   inventory: object,
 *   runtimeState: ReturnType<typeof parseRuntimeState>,
 *   nodeLines?: object | null,
 *   now: Date,
 *   gitFacts?: object | null,
 *   assetIds?: string[] | null,
 * }} input
 */
export function evaluateRuntimeTruth({
  inventory,
  runtimeState,
  nodeLines = null,
  now,
  gitFacts = null,
  assetIds = null,
}) {
  const state = runtimeState ?? parseRuntimeState(null);
  const empty = {
    checks: [],
    assets: [],
    floorFindings: [],
    stale_reads: 0,
    unknown_assets: 0,
    with_commit_sha: 0,
  };
  if (!state.present) {
    return {
      ...empty,
      checks: [
        skipped(
          {
            area: 'runtime',
            assetId: 'runtime-state',
            id: 'runtime-state',
            title: 'The runtime state file is present',
            expected: 'reports/runtime-state.json',
          },
          'no_runtime_state'
        ),
      ],
    };
  }

  const candidates = inventory.assets.filter(
    (asset) =>
      asset.lifecycle === 'production' &&
      (asset.runtime?.type === 'nodejs' || state.assets[asset.id]) &&
      (assetIds === null || assetIds.includes(asset.id))
  );
  const known = new Set(inventory.assets.map((asset) => asset.id));
  const unknownAssets = Object.keys(state.assets).filter(
    (id) => !known.has(id)
  );

  const floors = evaluateRuntimeFloors({
    inventory,
    nodeLines,
    runtimeState: {
      assets: Object.fromEntries(
        Object.entries(state.assets).map(([id, entry]) => [
          id,
          { node: entry.node, verified: entry.verified, note: entry.note },
        ])
      ),
    },
  });
  const floorByAsset = new Map(
    floors.assets.map((entry) => [entry.assetId, entry])
  );

  const checks = [];
  const rows = [];
  let staleReads = 0;
  let withSha = 0;
  for (const asset of candidates) {
    const entry = state.assets[asset.id] ?? null;
    const row = {
      assetId: asset.id,
      node: entry?.node ?? null,
      verified: entry?.verified === true,
      node_status: null,
      commit_sha: entry?.commitSha ? entry.commitSha.slice(0, 12) : null,
      deployed_at: entry?.deployedAt ?? null,
      read_at: entry?.readAt ?? null,
      read_age_days: null,
      stale_read: false,
      pending_commits: null,
      oldest_pending_age_hours: null,
      base_image_tag: entry?.baseImage?.tag ?? null,
      base_image_digest: entry?.baseImage?.digest
        ? entry.baseImage.digest.slice(0, 19)
        : null,
    };
    if (entry?.readAt) {
      row.read_age_days = Math.floor(
        (now.getTime() - Date.parse(entry.readAt)) / DAY_MS
      );
      row.stale_read =
        row.read_age_days > POSTURE_BASELINE.deploy.staleReadDays;
      if (row.stale_read) staleReads += 1;
    }
    if (entry?.commitSha) withSha += 1;

    // Node patch level against the floors
    if (asset.runtime?.type === 'nodejs') {
      const nodeBase = {
        area: 'runtime',
        assetId: asset.id,
        id: `runtime-${asset.id}-node`,
        title: 'The Node.js runtime is at or above its floor',
        expected: 'at or above the floor of its line',
      };
      const floor = floorByAsset.get(asset.id);
      row.node_status = floor?.status ?? 'unverified';
      if (floor?.status === 'ok')
        checks.push(pass(nodeBase, `${floor.version}`));
      else if (floor?.status === 'below_floor') {
        checks.push(
          fail(nodeBase, 'R-7', `${floor.version} is below ${floor.floor}`)
        );
      } else if (floor?.status === 'behind_latest_security') {
        checks.push(
          fail(
            nodeBase,
            'R-7',
            `${floor.version} is behind the security release ${floor.latestSecurity}`
          )
        );
      } else if (floor?.status === 'unknown_line') {
        checks.push(skipped(nodeBase, 'unknown_line'));
      } else checks.push(skipped(nodeBase, 'no_reading'));
    }

    // the deployed commit against main
    const deployBase = {
      area: 'runtime',
      assetId: asset.id,
      id: `runtime-${asset.id}-deploy`,
      title:
        'The deployed build includes the latest change to the service folders',
      expected: `no change older than ${POSTURE_BASELINE.deploy.graceHours} h is missing`,
    };
    const paths = servicePaths(asset);
    if (!entry?.commitSha) checks.push(skipped(deployBase, 'no_commit_sha'));
    else if (gitFacts === null) checks.push(skipped(deployBase, 'no_git'));
    else if (paths.length === 0)
      checks.push(skipped(deployBase, 'paths_unscoped'));
    else if (!gitFacts.mainSha)
      checks.push(unavailable(deployBase, 'main_ref_missing'));
    else {
      const fact = gitFacts.assets?.[asset.id];
      if (fact?.state === 'deployed_sha_unknown') {
        checks.push(unavailable(deployBase, 'deployed_sha_unknown'));
      } else if (fact?.state !== 'ok' || !Array.isArray(fact.pending)) {
        checks.push(unavailable(deployBase, 'git_error'));
      } else if (fact.pending.length === 0) {
        row.pending_commits = 0;
        checks.push(pass(deployBase, 'up to date'));
      } else {
        const oldest = Math.min(...fact.pending.map((c) => Date.parse(c.at)));
        const hours = (now.getTime() - oldest) / HOUR_MS;
        row.pending_commits = fact.pending.length;
        row.oldest_pending_age_hours = Math.round(hours * 10) / 10;
        const observed = `${fact.pending.length} pending, oldest ${hours.toFixed(1)} h`;
        checks.push(
          hours > POSTURE_BASELINE.deploy.graceHours
            ? fail(deployBase, 'PS-6', observed)
            : pass(deployBase, observed)
        );
      }
    }

    // the base image against the one the inventory declares
    const declared = baseImageOf(asset);
    if (declared && entry?.baseImage) {
      const imageBase = {
        area: 'runtime',
        assetId: asset.id,
        id: `runtime-${asset.id}-base-image`,
        title: 'The running base image is the one the inventory declares',
        expected: declared,
      };
      checks.push(
        entry.baseImage.tag === declared
          ? pass(imageBase, entry.baseImage.tag)
          : fail(imageBase, 'PS-6', `running ${entry.baseImage.tag}`)
      );
    }
    rows.push(row);
  }

  const candidateIds = new Set(candidates.map((asset) => asset.id));
  const floorFindings = floors.findings
    .filter((f) => f.assetId === 'inventory' || candidateIds.has(f.assetId))
    .map((f) =>
      scoreFinding(
        f,
        inventory.assets.find((asset) => asset.id === f.assetId) ??
          POLICY_ASSET,
        {
          today: now.toISOString().slice(0, 10),
          vexStatements: [],
          vexMatches: vexStatementMatches,
          vexExpiry: vexExpiryReasons,
        }
      )
    );
  return {
    checks,
    assets: rows,
    floorFindings,
    stale_reads: staleReads,
    unknown_assets: unknownAssets.length,
    with_commit_sha: withSha,
  };
}

// --- findings -----------------------------------------------------------------------------------------------

const KIND_BY_AREA = {
  dns: 'public-endpoint',
  github: 'posture-drift',
  web: 'web-headers',
  tls: 'tls-certificate',
  runtime: 'deploy-drift',
};
const SEVERITY_BY_TIER = { P0: 'critical', P1: 'high', P2: 'moderate' };

/**
 * A failed check as a scored finding, shaped like the findings of the vulnerability engine so
 * the priority sort, the alert state and the report table take it unchanged.
 */
export function makePostureFinding(check, { inventory = null } = {}) {
  const asset = inventory?.assets.find((a) => a.id === check.assetId) ?? null;
  const rule = POSTURE_RULES[check.rule] ?? POSTURE_RULES['PS-1'];
  return {
    ...makeFinding({
      kind: KIND_BY_AREA[check.area] ?? 'posture-drift',
      source: 'posture-sweep',
      ecosystem: 'posture',
      assetId: check.assetId,
      packageName: check.id,
      version: check.observed,
      primaryId: `POSTURE-${check.id.toUpperCase()}`,
      title: check.title,
      severity: SEVERITY_BY_TIER[check.priority] ?? 'low',
      vulnClass: 'other',
      fixKnown: true,
      scope: 'runtime',
      key: findingKey(['posture', check.id]),
      posture: { expected: check.expected, observed: check.observed },
    }),
    lifecycle: asset?.lifecycle ?? 'production',
    exposureTier: asset?.exposureTier ?? null,
    rule5Boundary: false,
    vexActive: false,
    vexSource: null,
    vexExpired: [],
    priority: check.priority,
    rule: check.rule,
    sla: rule.sla,
    escalation: false,
  };
}

/** Adds findings whose key is not there yet (one per key), sorted like the engine's. */
export function mergePostureFindings(existing, extra) {
  const seen = new Set(existing.map((f) => f.key));
  const merged = [...existing];
  for (const finding of extra) {
    if (seen.has(finding.key)) continue;
    seen.add(finding.key);
    merged.push(finding);
  }
  return merged.sort(compareFindings);
}

// --- the sweep ---------------------------------------------------------------------------------------------------

/** The first plain host name among the expected public endpoints: the public web origin. */
export function primaryWebHost(inventory) {
  return (
    inventory.expectedPublicEndpoints.find((endpoint) =>
      HOSTNAME_RE.test(endpoint)
    ) ?? null
  );
}

async function attempt(fn, fallback) {
  try {
    return await fn();
  } catch {
    return fallback;
  }
}

const PROBE_ERROR = Object.freeze({ ok: false, error: 'probe_error' });

function areaStatus(checks) {
  if (checks.some((c) => c.status === 'fail')) return 'fail';
  if (checks.some((c) => c.status === 'unavailable')) return 'unavailable';
  return checks.some((c) => c.status === 'pass') ? 'ok' : 'skipped';
}

/**
 * One live posture sweep. Never throws: a probe that fails makes its checks unavailable.
 *
 * @param {{
 *   inventory: object,
 *   runtimeState?: unknown,
 *   nodeLines?: object | null,
 *   probes?: { web?: Function, tls?: Function, dns?: Function, github?: Function, git?: { fetchMain?: Function, resolve: Function, pending: Function } } | null,
 *   now: Date,
 *   offline?: boolean,
 *   repo?: string,
 *   mainRef?: string,
 *   fetchMain?: boolean,
 *   assetIds?: string[] | null,
 * }} input
 */
export async function runPostureSweep({
  inventory,
  runtimeState = null,
  nodeLines = null,
  probes = null,
  now,
  offline = false,
  repo = DEFAULT_REPO,
  mainRef = 'origin/main',
  fetchMain = true,
  assetIds = null,
}) {
  const notes = [];
  const state = parseRuntimeState(runtimeState);
  if (state.issues.length > 0) {
    notes.push(
      `runtime-state.json: ${state.issues.length} entr${state.issues.length === 1 ? 'y was' : 'ies were'} ignored (${[...new Set(state.issues)].join(', ')})`
    );
  }
  const webHost = primaryWebHost(inventory);
  const apexHost = webHost?.startsWith('www.') ? webHost.slice(4) : null;
  const pausedHosts = pausedHostnames(inventory);

  // one probe call: offline is a choice (skipped), a missing or failing probe is not
  const call = (name, args) => {
    if (offline) return { ok: false, skipped: true, error: 'offline' };
    if (typeof probes?.[name] !== 'function') {
      return { ok: false, error: 'no_probes' };
    }
    return attempt(() => probes[name](args), PROBE_ERROR);
  };

  const webArea = async () => {
    const probeBase = {
      ...WEB,
      id: 'web-probe',
      title: 'The public site answers over https',
      expected: 'an HTTP answer',
    };
    if (!webHost) return [skipped(probeBase, 'no_web_host')];
    const [www, apex] = await Promise.all([
      call('web', { url: `https://${webHost}/` }),
      apexHost ? call('web', { url: `https://${apexHost}/` }) : null,
    ]);
    if (www?.ok !== true) return [notRun(probeBase, www)];
    if (www.status >= 500)
      return [unavailable(probeBase, `http_${www.status}`)];
    const checks = evaluateWebHeaders(www.headers);
    if (apex) {
      const apexBase = {
        ...WEB,
        id: 'web-apex-redirect',
        title: 'The apex domain redirects to the www host over https',
        expected: 'a redirect to https on the www host',
      };
      checks.push(
        apex.ok === true
          ? evaluateApexRedirect({
              status: apex.status,
              location: normalizeHeaders(apex.headers).location,
              wwwHost: webHost,
            })
          : notRun(apexBase, apex)
      );
    }
    return checks;
  };

  const tlsArea = async () => {
    if (!webHost) {
      return [
        skipped(
          {
            ...WEB,
            area: 'tls',
            id: 'tls-certificate',
            title: 'The TLS certificate is valid',
          },
          'no_web_host'
        ),
      ];
    }
    const probe = await call('tls', { host: webHost, port: 443 });
    return [evaluateTlsCertificate({ probe, now })];
  };

  const dnsArea = async () => {
    const results = {};
    await Promise.all(
      [...new Set(pausedHosts)].map(async (host) => {
        results[host] = await call('dns', { host });
      })
    );
    return evaluateDnsGuard({ inventory, results });
  };

  const githubArea = async () => {
    const paths = {
      repo: '',
      rules: '/rules/branches/main',
      actions: '/actions/permissions',
      workflow: '/actions/permissions/workflow',
      alerts: '/vulnerability-alerts',
      pvr: '/private-vulnerability-reporting',
    };
    const entries = await Promise.all(
      Object.entries(paths).map(async ([name, path]) => [
        name,
        (await call('github', { path })) ?? PROBE_ERROR,
      ])
    );
    return evaluateGithubSettings(Object.fromEntries(entries));
  };

  const [webChecks, tlsChecks, dnsChecks, githubChecks] = await Promise.all([
    webArea(),
    tlsArea(),
    dnsArea(),
    githubArea(),
  ]);

  // runtime truth: the local evidence is read offline too; only the fetch needs the network
  const git = probes?.git;
  const hasGit =
    typeof git?.resolve === 'function' && typeof git?.pending === 'function';
  let fetched = false;
  if (!offline && hasGit && fetchMain && typeof git.fetchMain === 'function') {
    fetched =
      (await attempt(() => git.fetchMain({ mainRef }), PROBE_ERROR))?.ok ===
      true;
    if (!fetched) {
      notes.push(
        'git fetch of the main branch failed: the deployed-build check uses the last fetched ref'
      );
    }
  }
  const candidates = inventory.assets.filter(
    (asset) =>
      asset.lifecycle === 'production' &&
      (assetIds === null || assetIds.includes(asset.id))
  );
  let gitFacts = null;
  if (hasGit && state.present) {
    const mainSha = await attempt(() => git.resolve(mainRef), null);
    gitFacts = {
      mainRef,
      mainSha: typeof mainSha === 'string' && mainSha !== '' ? mainSha : null,
      assets: {},
    };
    for (const asset of gitFacts.mainSha ? candidates : []) {
      const entry = state.assets[asset.id];
      const paths = servicePaths(asset);
      if (!entry?.commitSha || paths.length === 0) continue;
      const deployed = await attempt(() => git.resolve(entry.commitSha), null);
      if (typeof deployed !== 'string' || deployed === '') {
        gitFacts.assets[asset.id] = {
          state: 'deployed_sha_unknown',
          pending: null,
        };
        continue;
      }
      const pending = await attempt(
        () => git.pending({ deployed, mainRef, paths }),
        PROBE_ERROR
      );
      gitFacts.assets[asset.id] =
        pending?.ok === true && Array.isArray(pending.commits)
          ? {
              state: 'ok',
              pending: pending.commits
                .filter(
                  (c) =>
                    typeof c?.at === 'string' &&
                    Number.isFinite(Date.parse(c.at))
                )
                .map((c) => ({ sha: String(c.sha ?? ''), at: c.at })),
            }
          : { state: 'error', pending: null };
    }
  }
  const truth = evaluateRuntimeTruth({
    inventory,
    runtimeState: state,
    nodeLines,
    now,
    gitFacts,
    assetIds,
  });

  const checks = [
    ...webChecks,
    ...tlsChecks,
    ...dnsChecks,
    ...githubChecks,
    ...truth.checks,
  ];
  // a failed Node check is reported by its R-7 finding (the engine's own), not twice
  const checkFindings = checks
    .filter(
      (c) =>
        c.status === 'fail' && !(c.area === 'runtime' && c.id.endsWith('-node'))
    )
    .map((c) => makePostureFinding(c, { inventory }));
  const findings = mergePostureFindings(
    [],
    [...checkFindings, ...truth.floorFindings]
  );

  const count = (status) => checks.filter((c) => c.status === status).length;
  const tiers = { P0: 0, P1: 0, P2: 0, P3: 0 };
  for (const f of findings) if (f.priority in tiers) tiers[f.priority] += 1;
  const degraded = count('unavailable') > 0;

  return {
    schema_version: '1.0',
    generated_at: now.toISOString(),
    run: {
      offline,
      degraded,
      fetched_main: fetched,
      main_ref: mainRef,
    },
    targets: {
      web_host: webHost,
      apex_host: apexHost,
      github_repo: repo,
      paused_hostnames: [...new Set(pausedHosts)],
    },
    summary: {
      checks: {
        total: checks.length,
        pass: count('pass'),
        fail: count('fail'),
        unavailable: count('unavailable'),
        skipped: count('skipped'),
      },
      tiers,
      findings: findings.length,
      areas: Object.fromEntries(
        AREAS.map((area) => [
          area,
          areaStatus(checks.filter((c) => c.area === area)),
        ])
      ),
    },
    checks,
    findings,
    runtime_truth: {
      main_ref: mainRef,
      main_sha: gitFacts?.mainSha ? gitFacts.mainSha.slice(0, 12) : null,
      state_present: state.present,
      assets: truth.assets,
      stale_reads: truth.stale_reads,
      unknown_assets: truth.unknown_assets,
      with_commit_sha: truth.with_commit_sha,
    },
    notes,
  };
}

// --- reports ------------------------------------------------------------------------------------------------------

const esc = escapeMarkdownCell;

/**
 * The console summary: counts and fixed words only. No host name, no asset id, no address.
 *
 * @param {ReturnType<typeof runPostureSweep> extends Promise<infer R> ? R : never} result
 */
export function renderPostureSweepStdout(result, { heading = true } = {}) {
  const { checks: c, tiers: t, areas, findings } = result.summary;
  const rt = result.runtime_truth;
  const lines = [];
  if (heading) lines.push('DavinTrade live posture sweep (counts only)');
  // every line is prefixed: in the full sweep they follow the vulnerability summary lines
  lines.push(
    `posture_run: ${result.generated_at} mode=${result.run.offline ? 'offline' : 'online'}${result.run.degraded ? ' degraded=yes' : ''}`,
    `posture_checks: total=${c.total} pass=${c.pass} fail=${c.fail} unavailable=${c.unavailable} skipped=${c.skipped}`,
    `posture_findings: P0=${t.P0} P1=${t.P1} P2=${t.P2} P3=${t.P3} total=${findings}`,
    `posture_areas: ${AREAS.map((area) => `${area}=${areas[area]}`).join(' ')}`,
    `posture_runtime: assets=${rt.assets.length} with_commit_sha=${rt.with_commit_sha} stale_reads=${rt.stale_reads}`
  );
  return lines;
}

/** The report section (also embedded in the main posture report): private, names hosts. */
export function renderPostureSweepSection(result) {
  const { checks: c, tiers: t, areas } = result.summary;
  const out = ['## Live posture sweep', ''];
  out.push(
    `Mode: ${result.run.offline ? 'offline (no network probes)' : 'online'}; checks ${c.total}: pass ${c.pass}, fail ${c.fail}, unavailable ${c.unavailable}, skipped ${c.skipped}. Findings: P0 ${t.P0}, P1 ${t.P1}, P2 ${t.P2}, P3 ${t.P3}.`
  );
  out.push(
    `Areas: ${AREAS.map((area) => `${area} ${areas[area]}`).join(', ')}.`
  );
  if (result.run.degraded) {
    out.push(
      '',
      '**At least one probe could not run (unavailable). Absence of a finding is not proof of safety.**'
    );
  }
  const tg = result.targets;
  out.push(
    '',
    `Targets: web ${esc(tg.web_host ?? 'none')}, apex ${esc(tg.apex_host ?? 'none')}, repository ${esc(tg.github_repo)}, paused names ${tg.paused_hostnames.length}. Branch for the deployed-build check: ${esc(result.run.main_ref)}${result.run.fetched_main ? ' (fetched this run)' : ' (not fetched this run)'}.`
  );
  out.push('', '### Checks', '');
  out.push(
    '| Area | Check | Status | Priority | Rule | Expected | Observed | Detail |',
    '| :- | :- | :- | :- | :- | :- | :- | :- |'
  );
  for (const check of result.checks) {
    out.push(
      `| ${esc(check.area)} | ${esc(check.id)} | ${esc(check.status)} | ${esc(check.priority ?? '')} | ${esc(check.rule ?? '')} | ${esc(check.expected ?? '')} | ${esc(check.observed ?? '')} | ${esc(check.detail ?? '')} |`
    );
  }
  const rt = result.runtime_truth;
  out.push('', '### Runtime truth', '');
  if (!rt.state_present) {
    out.push('reports/runtime-state.json is missing or unreadable.');
  } else {
    out.push(
      '| Asset | Node | Verified | Commit | Deployed | Read | Stale read | Pending | Oldest pending (h) | Base image |',
      '| :- | :- | :- | :- | :- | :- | :- | -: | -: | :- |'
    );
    for (const a of rt.assets) {
      out.push(
        `| ${esc(a.assetId)} | ${esc(a.node ?? 'unknown')} | ${a.verified ? 'yes' : 'no'} | ${esc(a.commit_sha ?? 'none')} | ${esc(a.deployed_at ?? '')} | ${esc(a.read_at ?? '')} | ${a.stale_read ? 'YES' : 'no'} | ${a.pending_commits ?? ''} | ${a.oldest_pending_age_hours ?? ''} | ${esc(a.base_image_tag ?? '')} |`
      );
    }
    out.push(
      '',
      `Main ${esc(rt.main_ref)} at ${esc(rt.main_sha ?? 'unknown')}; assets with a commit recorded ${rt.with_commit_sha}; stale readings ${rt.stale_reads}; entries for assets not in the inventory ${rt.unknown_assets}.`
    );
  }
  if (result.notes.length > 0) {
    out.push('', '### Notes', '');
    for (const note of result.notes) out.push(`- ${esc(note, 300)}`);
  }
  out.push('');
  return out;
}

/** The standalone private report (Markdown). */
export function renderPostureSweepMarkdown(result) {
  return `${[
    '# DavinTrade live posture sweep (private)',
    '',
    `Generated ${result.generated_at} by scripts/security/run-posture-sweep.mjs (or by scripts/security/run-security-pipeline.mjs --with-posture).`,
    'This file names hosts and settings. It stays in the gitignored reports folder: never commit it, paste it into an issue or attach it to a public log.',
    '',
    ...renderPostureSweepSection(result),
  ].join('\n')}\n`;
}

// --- arguments --------------------------------------------------------------------------------------------------------

export class PostureUsageError extends Error {}

/** A branch or remote-tracking name (`origin/main`): never something Git could read as an option. */
export const isBranchRef = (value) =>
  typeof value === 'string' &&
  /^[A-Za-z0-9][A-Za-z0-9._/-]*$/.test(value) &&
  !value.includes('..');

const FLAGS = {
  '--offline': 'offline',
  '--no-fetch': 'noFetch',
  '--help': 'help',
  '-h': 'help',
};
const VALUES = {
  '--repo': 'repo',
  '--root': 'root',
  '--pipeline-dir': 'pipelineDir',
  '--secrets-file': 'secretsFile',
  '--main-ref': 'mainRef',
  '--assets': 'assets',
};

export const POSTURE_USAGE = [
  'Usage: node scripts/security/run-posture-sweep.mjs [options]',
  '  --offline            no network probes (web, TLS, DNS, GitHub, git fetch); the local evidence is still read',
  '  --no-fetch           do not run `git fetch origin main` before the deployed-build check',
  '  --main-ref <ref>     the branch the deployed build is compared with (default origin/main)',
  '  --assets a,b         only these inventory asset ids in the runtime checks',
  '  --repo owner/name    repository whose settings are checked (default ' +
    DEFAULT_REPO +
    ')',
  '  --root <dir>         repository root (default: the checkout this script is in)',
  '  --pipeline-dir <dir> private folder (default: <root>/davintrade-security-monitoring-pipeline)',
  '  --secrets-file <f>   file with DEPENDABOT_TRIAGE_TOKEN (default: <root>/.env.local; only 3 keys are read)',
  'Output: counts only on stdout; details in <pipeline-dir>/reports/latest-posture-sweep.json and .md (gitignored).',
  'Exit codes: 0 done, 1 unexpected failure, 2 usage or setup error.',
].join('\n');

/** @param {string[]} argv arguments after the script name */
export function parsePostureArgs(argv) {
  const options = {
    offline: false,
    noFetch: false,
    help: false,
    repo: DEFAULT_REPO,
    root: null,
    pipelineDir: null,
    secretsFile: null,
    mainRef: 'origin/main',
    assets: null,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const eq = arg.startsWith('--') ? arg.indexOf('=') : -1;
    const flag = eq === -1 ? arg : arg.slice(0, eq);
    const inline = eq === -1 ? undefined : arg.slice(eq + 1);
    if (FLAGS[flag] && inline === undefined) {
      options[FLAGS[flag]] = true;
    } else if (VALUES[flag]) {
      const value = inline ?? argv[(i += 1)];
      if (value === undefined || value === '') {
        throw new PostureUsageError(`${flag} needs a value`);
      }
      options[VALUES[flag]] = value;
    } else {
      throw new PostureUsageError('unknown argument');
    }
  }
  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(options.repo)) {
    throw new PostureUsageError('--repo must look like owner/name');
  }
  if (!isBranchRef(options.mainRef)) {
    throw new PostureUsageError('--main-ref must be a branch name');
  }
  if (options.assets !== null) {
    options.assets = options.assets
      .split(',')
      .map((id) => id.trim())
      .filter(Boolean);
    if (
      options.assets.length === 0 ||
      options.assets.some((id) => !/^[a-z0-9][a-z0-9-]*$/.test(id))
    ) {
      throw new PostureUsageError('--assets must be a list of asset ids');
    }
  }
  return options;
}
