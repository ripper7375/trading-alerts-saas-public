// The hybrid matchers of the private security pipeline: they read what each
// ecosystem's own tool reports (`pnpm audit`, `npm audit`, pinned Python
// requirements) and normalize it into findings.
//
// Pure functions. The runner spawns the tools and reads the lockfiles; nothing
// here touches the network, the file system or the console. Findings carry
// advisory identifiers and package names: they belong in the private, gitignored
// reports only, never in stdout, CI logs or notifications.

import { createHash } from 'node:crypto';
import { classifyAdvisories } from './audit-diff-gate-lib.mjs';
import {
  lowerBounds,
  satisfies,
  upperBoundFixes,
} from './security-semver-lite.mjs';

export const SEVERITY_ORDER = Object.freeze([
  'info',
  'low',
  'moderate',
  'high',
  'critical',
]);

const asArray = (value) => (Array.isArray(value) ? value : []);
const unique = (items) => [...new Set(items)];

/** `HIGH`, `medium`, `Moderate` ... -> one of SEVERITY_ORDER, or null. */
export function normalizeSeverity(label) {
  const text = String(label ?? '')
    .trim()
    .toLowerCase();
  if (text === 'medium') return 'moderate';
  if (text === 'none' || text === 'unknown' || text === '') return null;
  return SEVERITY_ORDER.includes(text) ? text : null;
}

export const severityRank = (severity) => SEVERITY_ORDER.indexOf(severity);

const ID_IN_TEXT =
  /\b(?:GHSA-[a-z0-9]{4}-[a-z0-9]{4}-[a-z0-9]{4}|CVE-\d{4}-\d{4,}|MAL-\d{4}-\d+|PYSEC-\d{4}-\d+|OSV-\d{4}-\d+)\b/gi;

/** Advisory identifiers found in a piece of text (an advisory URL, say). */
export function extractAdvisoryIds(text) {
  const found = String(text ?? '').match(ID_IN_TEXT) ?? [];
  return unique(
    found.map((id) =>
      /^ghsa-/i.test(id)
        ? `GHSA-${id.slice(5).toLowerCase()}`
        : id.toUpperCase()
    )
  );
}

/** `CWE-79`, 79, ['CWE-79', 'CWE-80'] -> [79, 80]. */
export function parseCwes(value) {
  const items = Array.isArray(value) ? value : [value];
  return unique(
    items
      .map((item) => /(\d{1,5})/.exec(String(item ?? ''))?.[1])
      .filter(Boolean)
      .map(Number)
  );
}

/** A stable, opaque id for a finding: used for deduplication, safe to store. */
export function findingKey(parts) {
  return createHash('sha256')
    .update(parts.map((part) => String(part ?? '')).join('|'))
    .digest('hex')
    .slice(0, 16);
}

// --- CVSS v3 -------------------------------------------------------------

const AV = { N: 0.85, A: 0.62, L: 0.55, P: 0.2 };
const AC = { L: 0.77, H: 0.44 };
const UI = { N: 0.85, R: 0.62 };
const CIA = { H: 0.56, L: 0.22, N: 0 };

function roundUp(value) {
  const scaled = Math.round(value * 100000);
  return scaled % 10000 === 0
    ? scaled / 100000
    : (Math.floor(scaled / 10000) + 1) / 10;
}

/**
 * The base score of a CVSS 3.x vector, or null for anything else (v2, v4 or a
 * malformed vector).
 * @param {unknown} vector
 * @returns {number | null}
 */
export function cvss3Score(vector) {
  const text = String(vector ?? '');
  if (!/^CVSS:3\.[01]\//.test(text)) return null;
  const metrics = Object.fromEntries(
    text
      .split('/')
      .slice(1)
      .map((part) => part.split(':'))
  );
  const scope = metrics.S;
  const pr = {
    N: 0.85,
    L: scope === 'C' ? 0.68 : 0.62,
    H: scope === 'C' ? 0.5 : 0.27,
  }[metrics.PR];
  const parts = [AV[metrics.AV], AC[metrics.AC], pr, UI[metrics.UI]];
  const impacts = [CIA[metrics.C], CIA[metrics.I], CIA[metrics.A]];
  if (
    parts.some((x) => x === undefined) ||
    impacts.some((x) => x === undefined) ||
    (scope !== 'U' && scope !== 'C')
  ) {
    return null;
  }
  const iss = 1 - (1 - impacts[0]) * (1 - impacts[1]) * (1 - impacts[2]);
  const impact =
    scope === 'U'
      ? 6.42 * iss
      : 7.52 * (iss - 0.029) - 3.25 * (iss - 0.02) ** 15;
  if (impact <= 0) return 0;
  const exploitability = 8.22 * parts[0] * parts[1] * parts[2] * parts[3];
  const total =
    scope === 'U'
      ? Math.min(impact + exploitability, 10)
      : Math.min(1.08 * (impact + exploitability), 10);
  return roundUp(total);
}

/** The severity label of a base score (0.1-3.9 low ... 9.0-10 critical). */
export function severityFromScore(score) {
  if (typeof score !== 'number' || !(score > 0)) return null;
  if (score >= 9) return 'critical';
  if (score >= 7) return 'high';
  if (score >= 4) return 'moderate';
  return 'low';
}

// --- vulnerability class ---------------------------------------------------

const RCE_CWES = new Set([77, 78, 94, 95, 96, 98, 502, 917]);
const AUTH_CWES = new Set([
  285, 287, 288, 290, 294, 302, 303, 304, 305, 306, 347, 639, 862, 863,
]);
const SQLI_CWES = new Set([89, 564, 943]);
const DOS_CWES = new Set([
  248, 400, 405, 407, 409, 476, 674, 755, 770, 772, 834, 835, 1050, 1333,
]);

/**
 * `rce`, `auth_bypass`, `sqli`, `dos` or `other`, from the CWE list, then the
 * CVSS vector (an availability-only impact reads as DoS), then the title.
 */
export function classifyVulnerability({ cwes = [], title = '', vector = '' }) {
  const has = (set) => cwes.some((cwe) => set.has(cwe));
  if (has(RCE_CWES)) return 'rce';
  if (has(AUTH_CWES)) return 'auth_bypass';
  if (has(SQLI_CWES)) return 'sqli';
  if (has(DOS_CWES)) return 'dos';
  const text = String(title).toLowerCase();
  if (
    /remote code execution|command injection|code injection|arbitrary code/.test(
      text
    )
  )
    return 'rce';
  if (
    /(?:authentication|authorization|auth) bypass|improper authentication|missing authentication|signature (?:bypass|verification)/.test(
      text
    )
  )
    return 'auth_bypass';
  if (/sql injection/.test(text)) return 'sqli';
  if (
    /denial of service|\bdos\b|redos|resource exhaustion|infinite loop|excessive memory|crash/.test(
      text
    )
  )
    return 'dos';
  const m = /\/C:N\/I:N\/A:[HL]/.exec(String(vector));
  return m ? 'dos' : 'other';
}

// Packages whose changes are Rule 5 territory (auth, payments, CORS) even in an
// asset that does not escalate as a whole.
const RULE5_PACKAGES =
  /^(?:next-auth|@auth\/.+|jose|jsonwebtoken|jws|jwa|bcrypt\w*|argon2|stripe|@stripe\/.+|otplib|speakeasy|passport(?:-.+)?|@nestjs\/(?:jwt|passport)|openid-client|oauth4webapi|cors|helmet)$/;

export const isRule5Package = (name) => RULE5_PACKAGES.test(String(name ?? ''));

// --- findings ------------------------------------------------------------------

/**
 * Fills the defaults every finding carries, so the rest of the pipeline never
 * has to guard against a missing field.
 */
export function makeFinding(partial) {
  const f = {
    kind: 'advisory',
    source: 'unknown',
    ecosystem: 'npm',
    assetId: '',
    packageName: '',
    version: null,
    advisoryIds: [],
    primaryId: '',
    title: '',
    severity: 'moderate',
    severityAssumed: false,
    cvss: null,
    cvssVector: null,
    cwes: [],
    vulnerableRange: null,
    fixedVersions: [],
    fixKnown: false,
    direct: false,
    pinnedByOverride: false,
    paths: [],
    parentRanges: [],
    scope: 'runtime',
    malicious: false,
    withdrawn: false,
    acceptedIgnore: false,
    inKev: false,
    epssScore: null,
    epssPercentile: null,
    ...partial,
  };
  f.advisoryIds = unique(f.advisoryIds.filter(Boolean));
  f.primaryId ||= f.advisoryIds[0] ?? '';
  f.vulnClass ??= classifyVulnerability({
    cwes: f.cwes,
    title: f.title,
    vector: f.cvssVector ?? '',
  });
  f.key ??= findingKey([f.assetId, f.primaryId, f.packageName, f.version]);
  return f;
}

// --- pnpm ------------------------------------------------------------------------

/**
 * The high and critical advisory counts the blocking gate
 * (scripts/security/audit-diff-gate.mjs) would report for the same audit output.
 * The engine calls the gate's own function, so the two cannot drift apart.
 */
export const pnpmGateParityCounts = (advisories) =>
  classifyAdvisories(advisories, null).blocking;

/**
 * Findings of one `pnpm audit --prod --json` report (one per advisory and
 * installed version).
 *
 * @param {{
 *   advisories: object[],
 *   assetId: string,
 *   directNames?: Set<string>,
 *   overrideNames?: Set<string>,
 *   buildOnly?: Set<string>,
 * }} input
 */
export function pnpmFindings({
  advisories,
  assetId,
  directNames = new Set(),
  overrideNames = new Set(),
  buildOnly = new Set(),
}) {
  const out = [];
  for (const advisory of advisories) {
    const name = String(advisory?.module_name ?? '');
    if (!name) continue;
    const ids = unique(
      [
        advisory.github_advisory_id,
        ...extractAdvisoryIds(advisory.url),
        ...asArray(advisory.cves),
      ].filter((id) => typeof id === 'string' && id !== '')
    );
    const patched =
      typeof advisory.patched_versions === 'string' &&
      advisory.patched_versions !== '<0.0.0'
        ? advisory.patched_versions
        : null;
    const versions = asArray(advisory.findings);
    for (const finding of versions.length > 0
      ? versions
      : [{ version: null, paths: [] }]) {
      const chains = asArray(finding.paths).map((p) => String(p).split('>'));
      // `importer>name`: two segments mean a direct dependency of the importer
      const direct =
        chains.some((segments) => segments.length === 2) ||
        directNames.has(name);
      const buildOnlyOnly =
        buildOnly.has(name) ||
        (chains.length > 0 &&
          chains.every((segments) =>
            segments.slice(1).some((n) => buildOnly.has(n))
          ));
      out.push(
        makeFinding({
          source: 'pnpm-audit',
          ecosystem: 'npm',
          assetId,
          packageName: name,
          version: typeof finding.version === 'string' ? finding.version : null,
          advisoryIds: ids,
          primaryId: ids[0] ?? `NPM-${advisory.id}`,
          title: String(advisory.title ?? ''),
          severity: normalizeSeverity(advisory.severity) ?? 'moderate',
          cvss:
            typeof advisory.cvss?.score === 'number'
              ? advisory.cvss.score
              : null,
          cvssVector: advisory.cvss?.vectorString ?? null,
          cwes: parseCwes(advisory.cwe),
          vulnerableRange: advisory.vulnerable_versions ?? null,
          fixedVersions: patched ? lowerBounds(patched) : [],
          fixKnown: typeof advisory.patched_versions === 'string',
          direct,
          pinnedByOverride: direct && overrideNames.has(name),
          paths: chains.map((segments) => segments.slice(1)),
          scope: buildOnlyOnly ? 'build_only' : 'runtime',
        })
      );
    }
  }
  return out;
}

// --- npm ---------------------------------------------------------------------------

/**
 * Reads the JSON of `npm audit --json`.
 *   ok           a report with a `vulnerabilities` object
 *   unavailable  empty output or an error object (registry unreachable)
 *   invalid      anything else
 *
 * @param {string | null | undefined} text
 */
export function parseNpmAuditJson(text) {
  const trimmed = String(text ?? '').trim();
  if (!trimmed) return { kind: 'unavailable' };
  let data;
  try {
    data = JSON.parse(trimmed);
  } catch {
    return { kind: 'invalid' };
  }
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return { kind: 'invalid' };
  }
  if (data.vulnerabilities && typeof data.vulnerabilities === 'object') {
    return { kind: 'ok', report: data };
  }
  if (data.error || data.message) return { kind: 'unavailable' };
  return { kind: 'invalid' };
}

/** Counts of vulnerable packages per severity, as npm reports them. */
export function npmSeverityCounts(report) {
  const counts = Object.fromEntries(SEVERITY_ORDER.map((s) => [s, 0]));
  const meta = report?.metadata?.vulnerabilities;
  if (meta && typeof meta === 'object') {
    for (const s of SEVERITY_ORDER) {
      if (Number.isInteger(meta[s])) counts[s] = meta[s];
    }
    return counts;
  }
  for (const entry of Object.values(report?.vulnerabilities ?? {})) {
    const s = normalizeSeverity(entry?.severity);
    if (s) counts[s] += 1;
  }
  return counts;
}

function nameFromPath(path, entry) {
  if (typeof entry?.name === 'string') return entry.name;
  const marker = 'node_modules/';
  const at = path.lastIndexOf(marker);
  return at === -1 ? null : path.slice(at + marker.length);
}

/**
 * The dependency graph of an npm lockfile (v2 or v3): installed packages, the
 * ranges their parents declare, which of them the root depends on directly and
 * which are reachable at runtime or only through build-only packages.
 *
 * @param {unknown} lock parsed package-lock.json
 */
export function buildNpmGraph(lock) {
  const packages = lock && typeof lock === 'object' ? lock.packages : null;
  if (!packages || typeof packages !== 'object') return null;

  const nodes = new Map();
  const byName = new Map();
  for (const [path, entry] of Object.entries(packages)) {
    if (path === '' || entry?.link || typeof entry?.version !== 'string')
      continue;
    const name = nameFromPath(path, entry);
    if (!name) continue;
    const node = {
      path,
      name,
      version: entry.version,
      dev: entry.dev === true,
      entry,
    };
    nodes.set(path, node);
    if (!byName.has(name)) byName.set(name, []);
    byName.get(name).push(node);
  }

  const resolve = (from, dep) => {
    let base = from;
    for (;;) {
      const candidate = `${base ? `${base}/` : ''}node_modules/${dep}`;
      if (nodes.has(candidate)) return candidate;
      if (base === '') return null;
      const cut = base.lastIndexOf('/node_modules/');
      base = cut === -1 ? '' : base.slice(0, cut);
    }
  };

  const edges = new Map();
  const reverse = new Map();
  const link = (from, dep, range, to) => {
    if (!to) return;
    if (!edges.has(from)) edges.set(from, []);
    edges.get(from).push(to);
    if (!reverse.has(to)) reverse.set(to, []);
    reverse.get(to).push({ from, range });
  };
  for (const [path, node] of nodes) {
    for (const key of [
      'dependencies',
      'optionalDependencies',
      'peerDependencies',
    ]) {
      for (const [dep, range] of Object.entries(node.entry[key] ?? {})) {
        link(path, dep, String(range), resolve(path, dep));
      }
    }
  }

  const root = packages[''] ?? {};
  const rootDirect = new Map();
  for (const key of ['dependencies', 'optionalDependencies']) {
    for (const [dep, range] of Object.entries(root[key] ?? {})) {
      const to = resolve('', dep);
      if (to) rootDirect.set(to, String(range));
    }
  }

  const reach = (stopAtBuildOnly, buildOnly) => {
    const seen = new Set();
    const queue = [...rootDirect.keys()];
    while (queue.length > 0) {
      const path = queue.pop();
      if (seen.has(path)) continue;
      seen.add(path);
      if (stopAtBuildOnly && buildOnly.has(nodes.get(path).name)) continue;
      for (const next of edges.get(path) ?? []) queue.push(next);
    }
    return seen;
  };
  const cache = new Map();
  const reachability = (buildOnly) => {
    if (!cache.has(buildOnly)) {
      cache.set(buildOnly, {
        runtime: reach(true, buildOnly),
        all: reach(false, buildOnly),
      });
    }
    return cache.get(buildOnly);
  };

  return {
    nodes,
    instancesOf: (name) => byName.get(name) ?? [],
    isDirect: (path) => rootDirect.has(path),
    packageKeys: () =>
      new Set([...nodes.values()].map((n) => `${n.name}@${n.version}`)),
    /** `{ parent, range }` for every declared dependency on this install. */
    parents: (path) => [
      ...(rootDirect.has(path)
        ? [{ parent: '(root)', range: rootDirect.get(path) }]
        : []),
      ...(reverse.get(path) ?? []).map(({ from, range }) => ({
        parent: nodes.get(from).name,
        range,
      })),
    ],
    /**
     * `runtime` when a production dependency of the root reaches the install
     * without passing through a build-only package; `build_only` when the
     * package is one or is reachable only through one; `dev_only` when the
     * lockfile marks it dev and nothing production reaches it.
     */
    scopeOf: (path, buildOnly) => {
      const node = nodes.get(path);
      if (!node) return 'runtime';
      if (buildOnly.has(node.name)) return 'build_only';
      const { runtime, all } = reachability(buildOnly);
      if (runtime.has(path)) return 'runtime';
      if (all.has(path)) return 'build_only';
      return node.dev ? 'dev_only' : 'runtime';
    },
  };
}

/**
 * Findings of one `npm audit --json` report. The installed versions come from
 * the lockfile graph: npm lists only the vulnerable range.
 *
 * @param {{
 *   report: object,
 *   graph: ReturnType<typeof buildNpmGraph> | null,
 *   assetId: string,
 *   buildOnly?: Set<string>,
 *   overrideNames?: Set<string>,
 * }} input
 */
export function npmFindings({
  report,
  graph,
  assetId,
  buildOnly = new Set(),
  overrideNames = new Set(),
}) {
  const out = [];
  const seen = new Set();
  for (const entry of Object.values(report?.vulnerabilities ?? {})) {
    for (const via of asArray(entry?.via)) {
      if (!via || typeof via !== 'object' || !via.name) continue;
      const dedupe = `${via.source}|${via.name}`;
      if (seen.has(dedupe)) continue;
      seen.add(dedupe);
      const ids = extractAdvisoryIds(via.url);
      const installs = graph
        ? graph
            .instancesOf(via.name)
            .filter((n) => !via.range || satisfies(n.version, via.range))
        : [];
      for (const install of installs.length > 0 ? installs : [null]) {
        const direct = install
          ? graph.isDirect(install.path)
          : entry.isDirect === true;
        out.push(
          makeFinding({
            source: 'npm-audit',
            ecosystem: 'npm',
            assetId,
            packageName: via.name,
            version: install?.version ?? null,
            advisoryIds: ids,
            primaryId: ids[0] ?? `NPM-${via.source}`,
            title: String(via.title ?? ''),
            severity: normalizeSeverity(via.severity) ?? 'moderate',
            cvss:
              typeof via.cvss?.score === 'number' && via.cvss.score > 0
                ? via.cvss.score
                : null,
            cvssVector: via.cvss?.vectorString ?? null,
            cwes: parseCwes(via.cwe),
            vulnerableRange: via.range ?? null,
            // npm gives the vulnerable range: the fix is where it ends. npm's
            // own `fixAvailable` is not used (it can suggest a downgrade).
            fixedVersions: via.range
              ? upperBoundFixes(via.range, install?.version ?? null)
              : [],
            fixKnown: Boolean(via.range),
            direct,
            pinnedByOverride: direct && overrideNames.has(via.name),
            parentRanges: install ? graph.parents(install.path) : [],
            scope: install
              ? graph.scopeOf(install.path, buildOnly)
              : buildOnly.has(via.name)
                ? 'build_only'
                : 'runtime',
          })
        );
      }
    }
  }
  return out;
}

// --- build hygiene: development dependencies installed at build time ------------------------

/**
 * What a nixpacks.toml says about installing development dependencies. Railway builds with
 * `NPM_CONFIG_PRODUCTION=false` in `[variables]` install them, so an advisory in a development
 * tool is reachable at build time (the IaC hygiene check of the design). Only the `[variables]`
 * table counts: a comment, or the key in another table, does not.
 *
 * @param {string | null | undefined} text
 * @returns {{ npmConfigProduction: 'true' | 'false' | null, installsDevDependencies: boolean }}
 */
export function parseNixpacksBuildEnv(text) {
  let table = null;
  let value = null;
  for (const raw of String(text ?? '').split(/\r?\n/)) {
    const line = raw.trim();
    if (line === '' || line.startsWith('#')) continue;
    const header = /^\[([^\]]+)\]\s*(?:#.*)?$/.exec(line);
    if (header) {
      table = header[1].trim();
      continue;
    }
    if (table !== 'variables') continue;
    const m = /^["']?NPM_CONFIG_PRODUCTION["']?\s*=\s*(.*)$/.exec(line);
    if (m) {
      value = m[1]
        .replace(/\s+#.*$/, '')
        .trim()
        .replace(/^["']|["']$/g, '')
        .toLowerCase();
    }
  }
  const npmConfigProduction =
    value === 'false' || value === 'true' ? value : null;
  return {
    npmConfigProduction,
    installsDevDependencies: npmConfigProduction === 'false',
  };
}

const HYGIENE_SEVERITIES = new Set(['high', 'critical']);

/**
 * The high and critical advisories that only a full `npm audit` (development dependencies
 * included) finds in a lockfile: the production audit never sees them. They are `build_only`
 * findings, so the priority matrix files them at P3 (rule R-2): in the private report, never
 * a page. The key differs from the one a regular finding for the same advisory would get.
 *
 * @param {Parameters<typeof npmFindings>[0]} input a full audit report and the lockfile graph
 */
export function buildHygieneFindings(input) {
  const out = [];
  const seen = new Set();
  for (const f of npmFindings(input)) {
    if (f.scope !== 'dev_only' || !HYGIENE_SEVERITIES.has(f.severity)) continue;
    const key = findingKey([
      'build-hygiene',
      input.assetId,
      f.primaryId,
      f.packageName,
      f.version,
    ]);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      ...f,
      scope: 'build_only',
      source: 'npm-audit-dev',
      buildHygiene: true,
      key,
    });
  }
  return out;
}

// --- Python ----------------------------------------------------------------------

const PIP_DEV_TOOLS =
  /^(?:pytest(?:-.+)?|coverage|black|flake8|mypy|ruff|isort|pylint|bandit|tox|nox|pre-commit|types-.+|sphinx(?:-.+)?|hypothesis|freezegun|responses)$/;

/** Test and lint tooling: installed for development, never at runtime. */
export const isPipDevTool = (name) => PIP_DEV_TOOLS.test(String(name ?? ''));

/** PEP 503 normalization: lower case, runs of `-`, `_`, `.` become `-`. */
export const normalizePyName = (name) =>
  String(name)
    .toLowerCase()
    .replace(/[-_.]+/g, '-');

/**
 * Reads a requirements file: pinned `name==version` entries (the only ones OSV
 * can match), unpinned entries (ranges, no version) and lines it skips
 * (options, URLs, includes).
 *
 * @param {string} text
 */
export function parseRequirements(text) {
  const pinned = [];
  const unpinned = [];
  let skipped = 0;
  const merged = String(text).replace(/\\\r?\n/g, ' ');
  for (const raw of merged.split(/\r?\n/)) {
    const line = raw.replace(/(^|\s)#.*$/, '').trim();
    if (line === '') continue;
    if (
      line.startsWith('-') ||
      /^(?:[a-z+]+:\/\/|\.{0,2}\/|file:)/i.test(line)
    ) {
      skipped += 1;
      continue;
    }
    const spec = line
      .split(';')[0]
      .replace(/\s--hash=\S+/g, '')
      .trim();
    const m = /^([A-Za-z0-9][A-Za-z0-9._-]*)(?:\[[^\]]*\])?\s*(.*)$/.exec(spec);
    if (!m) {
      skipped += 1;
      continue;
    }
    const name = normalizePyName(m[1]);
    const pin = /^===?\s*([A-Za-z0-9._+!-]+)$/.exec(m[2].trim());
    if (pin && !pin[1].includes('*')) pinned.push({ name, version: pin[1] });
    else unpinned.push({ name, spec: m[2].trim() || '(any)' });
  }
  return { pinned, unpinned, skipped };
}

/** The `name@version` keys of an npm graph or any list of `{name, version}`. */
export const packageKeySet = (packages) =>
  new Set(packages.map((p) => `${p.name}@${p.version}`));
