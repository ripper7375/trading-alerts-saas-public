// Counts-only readers for the Phase 5 shift-left scans: Trivy (container files and images),
// OSV-Scanner (Python manifests), Semgrep (the custom rules) and Gitleaks (the one-off history scan).
//
// The repository is public and so are its Actions logs. A scanner's own output holds identifiers
// (CVE and GHSA ids, package names, rule findings on real files, secret matches), so none of it may
// reach a log: each scanner writes its JSON to a file that is never uploaded, and these functions
// reduce that file to numbers and fixed words. Pure functions: the files are read by the command
// (shift-left-counts.mjs), and a line that still looks like a leak is replaced by a fixed notice.
//
// A document that cannot be read as the scanner's report is an ERROR, never an empty (clean) one:
// "no findings" must mean the scan ran.

import { findPrivacyViolations } from './line-notifier-lib.mjs';
import { normalizePackageName } from './shift-left-targets-lib.mjs';

export const SEVERITIES = Object.freeze([
  'critical',
  'high',
  'medium',
  'low',
  'unknown',
]);

const isObject = (value) =>
  value !== null && typeof value === 'object' && !Array.isArray(value);
const asArray = (value) => (Array.isArray(value) ? value : []);

export const zeroCounts = () => ({
  critical: 0,
  high: 0,
  medium: 0,
  low: 0,
  unknown: 0,
});

function bump(counts, severity) {
  const key = String(severity ?? '').toLowerCase();
  if (key === 'moderate') counts.medium += 1;
  else if (SEVERITIES.includes(key)) counts[key] += 1;
  else counts.unknown += 1;
}

function addCounts(into, from) {
  for (const key of SEVERITIES) into[key] += from[key];
  return into;
}

const countsText = (counts) =>
  SEVERITIES.map((key) => `${key}=${counts[key]}`).join(' ');

const normalizePath = (value) =>
  String(value ?? '')
    .replace(/\\/g, '/')
    .replace(/^(\.\/)+/, '');

// --- Trivy -------------------------------------------------------------------------------------

/**
 * One Trivy JSON report (schema 2): vulnerabilities and misconfigurations by severity, how many
 * critical or high vulnerabilities have a fixed version, and how many targets it covered.
 * A listed misconfiguration counts when its status is FAIL (or absent): passes are not findings.
 */
export function summarizeTrivyReport(report) {
  if (!isObject(report) || !Number.isInteger(report.SchemaVersion)) {
    return { valid: false };
  }
  const vulnerabilities = zeroCounts();
  const misconfigurations = zeroCounts();
  let fixable = 0;
  let targets = 0;
  for (const result of asArray(report.Results)) {
    if (!isObject(result)) continue;
    targets += 1;
    for (const vuln of asArray(result.Vulnerabilities)) {
      bump(vulnerabilities, vuln?.Severity);
      const severe = ['CRITICAL', 'HIGH'].includes(
        String(vuln?.Severity ?? '').toUpperCase()
      );
      if (
        severe &&
        typeof vuln?.FixedVersion === 'string' &&
        vuln.FixedVersion !== ''
      ) {
        fixable += 1;
      }
    }
    for (const misconf of asArray(result.Misconfigurations)) {
      if (misconf?.Status === undefined || misconf.Status === 'FAIL') {
        bump(misconfigurations, misconf?.Severity);
      }
    }
  }
  return { valid: true, vulnerabilities, misconfigurations, fixable, targets };
}

/**
 * The scans of one run: the `trivy config` report of the Dockerfiles and one `trivy image` report
 * per image. A report that is missing or unreadable (null) is an error; so is an image that was
 * expected but has no report at all.
 *
 * @param {{ config: unknown, images: unknown[], expectedImages?: number | null }} input
 */
export function summarizeTrivy({
  config = null,
  images = [],
  expectedImages = null,
}) {
  const cfg = config === null ? { valid: false } : summarizeTrivyReport(config);
  const reports = images.map((image) =>
    image === null ? { valid: false } : summarizeTrivyReport(image)
  );
  const valid = reports.filter((r) => r.valid);
  const counted = Math.max(
    reports.length,
    Number.isInteger(expectedImages) ? expectedImages : 0
  );
  const imageCounts = zeroCounts();
  let fixable = 0;
  for (const r of valid) {
    addCounts(imageCounts, r.vulnerabilities);
    fixable += r.fixable;
  }
  return {
    config: {
      ok: cfg.valid === true,
      targets: cfg.valid ? cfg.targets : 0,
      counts: cfg.valid ? cfg.misconfigurations : zeroCounts(),
    },
    images: {
      scanned: valid.length,
      errors: counted - valid.length,
      counts: imageCounts,
      fixable,
    },
  };
}

export function renderTrivyLines(summary, { notScannable = 0 } = {}) {
  const { config, images } = summary;
  const lines = [
    `trivy_config: ok=${config.ok ? 'yes' : 'no'} targets=${config.targets} ${countsText(config.counts)}`,
    `trivy_images: scanned=${images.scanned} errors=${images.errors} ${countsText(images.counts)} fixable_critical_high=${images.fixable}`,
  ];
  if (notScannable > 0) {
    lines.push(
      `trivy_not_scannable: files=${notScannable} (Docker Compose and nixpacks files have no Trivy check; the images a Compose file names are scanned)`
    );
  }
  return lines;
}

/**
 * Whether the run fails. Informational (the first iteration): never, a scan error is a warning.
 * Blocking: any critical or high finding, or any scan error.
 */
export function trivyGate({ summary, blocking }) {
  const failing =
    summary.config.counts.critical +
    summary.config.counts.high +
    summary.images.counts.critical +
    summary.images.counts.high;
  const errors = (summary.config.ok ? 0 : 1) + summary.images.errors;
  return {
    mode: blocking ? 'blocking' : 'informational',
    failing,
    errors,
    exit: blocking && (failing > 0 || errors > 0) ? 1 : 0,
  };
}

// --- OSV-Scanner -------------------------------------------------------------------------------------

function osvSeverity(group, vulnerabilities) {
  const score = Number.parseFloat(group?.max_severity);
  if (Number.isFinite(score)) {
    if (score >= 9) return 'critical';
    if (score >= 7) return 'high';
    if (score >= 4) return 'medium';
    if (score > 0) return 'low';
    return 'unknown';
  }
  // no score: the database's own word for the advisory, when there is one
  const ids = new Set(asArray(group?.ids));
  for (const vuln of vulnerabilities) {
    if (!ids.has(vuln?.id)) continue;
    const word = String(vuln?.database_specific?.severity ?? '').toLowerCase();
    if (word === 'moderate') return 'medium';
    if (SEVERITIES.includes(word) && word !== 'unknown') return word;
  }
  return 'unknown';
}

/**
 * One OSV-Scanner JSON report: the vulnerability groups by severity (an advisory and its aliases
 * are one group), split into runtime and development-only manifests, and the number of vulnerable
 * packages. `devPaths` are repository paths of the development-only manifests (a report path may
 * be absolute: the end of the path decides).
 *
 * With `manifests` (`{ assetId, scope, path, names }`, the manifests the inventory lists and the
 * package names each declares) each source is also attributed to its manifest, so the totals can
 * be explained one asset at a time. A source that is none of them is counted on its own (`other`)
 * and kept out of the totals: it was not asked for, and must not make the Python numbers look like
 * something they are not.
 *
 * OSV-Scanner resolves a requirements file into the packages `pip` would install, transitive ones
 * included, so each manifest also gets a `shape` that says how its counts are made up, in numbers
 * only: its entries in the report (each with the packages listed, the vulnerable ones and the
 * advisory groups), the groups listed against the distinct ones (a package reported twice lists the
 * same groups twice), and how many vulnerable package names the manifest declares itself against
 * how many only come in as a dependency of those.
 */
export function summarizeOsvReport(
  report,
  { devPaths = [], manifests = [] } = {}
) {
  if (!isObject(report) || !Array.isArray(report.results)) {
    return { valid: false };
  }
  const dev = devPaths.map(normalizePath);
  const runtime = zeroCounts();
  const development = zeroCounts();
  const vulnerable = new Set();
  const bucket = (names = null) => ({
    sources: 0,
    vulnerablePackages: 0,
    counts: zeroCounts(),
    seen: new Set(),
    entries: [],
    groupKeys: new Set(),
    declared: Array.isArray(names)
      ? new Set(names.map(normalizePackageName))
      : null,
    declaredVulnerable: new Set(),
    dependencyVulnerable: new Set(),
  });
  const listed = manifests.map((m) => ({
    assetId: m.assetId,
    scope: m.scope,
    path: normalizePath(m.path),
    ...bucket(m.names),
  }));
  const other = bucket();
  let sources = 0;
  for (const result of report.results) {
    if (!isObject(result)) continue;
    sources += 1;
    const path = normalizePath(result.source?.path);
    const isDev = dev.some((d) => path === d || path.endsWith(`/${d}`));
    const match = listed.find(
      (m) => path === m.path || path.endsWith(`/${m.path}`)
    );
    // without a manifest list every source is in the totals, as before
    const entry = match ?? (listed.length > 0 ? other : null);
    if (entry) entry.sources += 1;
    const shape = { packages: 0, vulnerable: 0, groups: 0 };
    for (const pkg of asArray(result.packages)) {
      shape.packages += 1;
      const vulnerabilities = asArray(pkg?.vulnerabilities);
      const groups = asArray(pkg?.groups);
      if (vulnerabilities.length === 0 && groups.length === 0) continue;
      shape.vulnerable += 1;
      const name = `${pkg?.package?.name ?? ''}|${pkg?.package?.version ?? ''}`;
      if (entry && !entry.seen.has(name)) {
        entry.seen.add(name);
        entry.vulnerablePackages += 1;
      }
      if (entry?.declared) {
        const family = normalizePackageName(pkg?.package?.name);
        (entry.declared.has(family)
          ? entry.declaredVulnerable
          : entry.dependencyVulnerable
        ).add(family);
      }
      if (entry !== other) vulnerable.add(`${path}|${name}`);
      const list =
        groups.length > 0
          ? groups
          : vulnerabilities.map((v) => ({ ids: [v?.id], max_severity: null }));
      for (const group of list) {
        const severity = osvSeverity(group, vulnerabilities);
        shape.groups += 1;
        if (entry) {
          bump(entry.counts, severity);
          entry.groupKeys.add(
            `${name}|${asArray(group?.ids).map(String).sort().join(',')}`
          );
        }
        if (entry !== other) bump(isDev ? development : runtime, severity);
      }
    }
    if (entry) entry.entries.push(shape);
  }
  const view = ({
    assetId,
    scope,
    sources: n,
    vulnerablePackages,
    counts,
    entries,
    groupKeys,
    declared,
    declaredVulnerable,
    dependencyVulnerable,
  }) => ({
    assetId,
    scope,
    sources: n,
    vulnerablePackages,
    counts,
    shape: {
      declaredPackages: declared ? declared.size : null,
      entries,
      distinctGroups: groupKeys.size,
      declaredVulnerable: declared ? declaredVulnerable.size : null,
      dependencyVulnerable: declared ? dependencyVulnerable.size : null,
    },
  });
  return {
    valid: true,
    sources,
    vulnerablePackages: vulnerable.size,
    runtime,
    development,
    manifests: listed.map(view),
    other: {
      sources: other.sources,
      vulnerablePackages: other.vulnerablePackages,
      counts: other.counts,
    },
  };
}

export function renderOsvLines(summary, { pinning = null } = {}) {
  if (!summary.valid) return ['osv_python: scan=failed (no readable report)'];
  const lines = [
    `osv_python: sources=${summary.sources} vulnerable_packages=${summary.vulnerablePackages} ${countsText(summary.runtime)}`,
    `osv_python_development: ${countsText(summary.development)}`,
  ];
  // two lines per manifest of the inventory, by asset id (never a path): where the totals come from,
  // and how those counts are made up
  const perEntry = (entries, key) =>
    entries.length > 0 ? entries.map((e) => e[key]).join(',') : '-';
  const total = (counts) => SEVERITIES.reduce((n, key) => n + counts[key], 0);
  for (const m of summary.manifests ?? []) {
    lines.push(
      `osv_python_manifest: ${m.assetId} scope=${m.scope} sources=${m.sources} vulnerable_packages=${m.vulnerablePackages} ${countsText(m.counts)}`
    );
    const s = m.shape;
    lines.push(
      `osv_python_manifest_shape: ${m.assetId} scope=${m.scope} declared_packages=${s.declaredPackages ?? 'unknown'} entries=${s.entries.length} packages_per_entry=${perEntry(s.entries, 'packages')} vulnerable_per_entry=${perEntry(s.entries, 'vulnerable')} groups_per_entry=${perEntry(s.entries, 'groups')} groups=${total(m.counts)} distinct_groups=${s.distinctGroups} vulnerable_declared=${s.declaredVulnerable ?? 'unknown'} vulnerable_dependencies=${s.dependencyVulnerable ?? 'unknown'}`
    );
  }
  if ((summary.other?.sources ?? 0) > 0) {
    lines.push(
      `osv_python_other_sources: sources=${summary.other.sources} vulnerable_packages=${summary.other.vulnerablePackages} ${countsText(summary.other.counts)} (not an inventory manifest, kept out of the totals)`
    );
  }
  if (pinning) {
    lines.push(
      `osv_python_pinning: requirement_lines=${pinning.requirements} unpinned=${pinning.unpinned}`
    );
  }
  return lines;
}

/** Informational: never fails. Blocking: any critical or high in a runtime manifest, or a failed scan. */
export function osvGate({ summary, blocking }) {
  const failing = summary.valid
    ? summary.runtime.critical + summary.runtime.high
    : 0;
  const errors = summary.valid ? 0 : 1;
  return {
    mode: blocking ? 'blocking' : 'informational',
    failing,
    errors,
    exit: blocking && (failing > 0 || errors > 0) ? 1 : 0,
  };
}

// --- Semgrep -------------------------------------------------------------------------------------------

/**
 * One Semgrep JSON report: the findings by severity, how many files were scanned, and the
 * engine's own errors (an invalid rule, a timeout) apart from its warnings (a file it could only
 * partly parse).
 */
export function summarizeSemgrepReport(report) {
  if (!isObject(report) || !Array.isArray(report.results)) {
    return { valid: false };
  }
  const findings = { error: 0, warning: 0, info: 0, other: 0 };
  for (const result of report.results) {
    const severity = String(result?.extra?.severity ?? '').toLowerCase();
    findings[
      severity in findings && severity !== 'other' ? severity : 'other'
    ] += 1;
  }
  let scanErrors = 0;
  let scanWarnings = 0;
  for (const entry of asArray(report.errors)) {
    const level = String(entry?.level ?? '').toLowerCase();
    if (level === 'warn' || level === 'warning') scanWarnings += 1;
    else scanErrors += 1;
  }
  return {
    valid: true,
    findings,
    scanErrors,
    scanWarnings,
    filesScanned: asArray(report.paths?.scanned).length,
  };
}

export function renderSemgrepLines(summary) {
  if (!summary.valid)
    return ['semgrep_custom: scan=failed (no readable report)'];
  const f = summary.findings;
  return [
    `semgrep_custom: files_scanned=${summary.filesScanned} error=${f.error} warning=${f.warning} info=${f.info} scan_errors=${summary.scanErrors} scan_warnings=${summary.scanWarnings}`,
  ];
}

/**
 * A scan that did not run (no report, a rule or engine error, no file scanned) always fails: with
 * no scan there is no protection. Findings fail only in blocking mode, and only the ERROR severity.
 */
export function semgrepGate({ summary, blocking }) {
  const broken =
    !summary.valid || summary.scanErrors > 0 || summary.filesScanned === 0;
  const failing = summary.valid ? summary.findings.error : 0;
  return {
    mode: blocking ? 'blocking' : 'informational',
    failing,
    broken,
    exit: broken || (blocking && failing > 0) ? 1 : 0,
  };
}

// --- Semgrep: the rules against their fixtures -------------------------------------------------

const EXPECT_RE = /\bexpect:\s*([a-z0-9-]+(?:\s*,\s*[a-z0-9-]+)*)/g;

/** The `expect: <rule-id>` markers of the fixtures: where a rule must report, by file and line. */
export function parseFixtureExpectations(fixtures) {
  const expected = [];
  for (const fixture of fixtures) {
    const lines = String(fixture.content).split(/\r?\n/);
    lines.forEach((text, index) => {
      for (const match of text.matchAll(EXPECT_RE)) {
        for (const rule of match[1].split(',')) {
          expected.push({
            path: normalizePath(fixture.path),
            line: index + 1,
            rule: rule.trim(),
          });
        }
      }
    });
  }
  return expected;
}

const sameRule = (checkId, rule) =>
  checkId === rule || String(checkId).endsWith(`.${rule}`);

/**
 * Compares a Semgrep run over the fixtures with their markers. A finding is expected when a marker
 * for its rule sits on its first line or on the line before. `missed` is a marker no finding
 * answers (the rule no longer catches what it should); `unexpected` is a finding no marker asks
 * for (the rule catches what it should not).
 *
 * @param {{ report: unknown, fixtures: { path: string, content: string }[] }} input
 */
export function checkSemgrepFixtures({ report, fixtures }) {
  const expected = parseFixtureExpectations(fixtures);
  const rules = new Set(expected.map((e) => e.rule));
  if (!isObject(report) || !Array.isArray(report.results)) {
    return {
      valid: false,
      expected: expected.length,
      matched: 0,
      missed: expected.length,
      unexpected: 0,
      rules: rules.size,
      cases: fixtures.length,
    };
  }
  const paths = fixtures.map((f) => normalizePath(f.path));
  const findings = [];
  for (const result of report.results) {
    const path = normalizePath(result?.path);
    const fixture = paths.find((p) => path === p || path.endsWith(`/${p}`));
    if (!fixture) continue;
    findings.push({
      path: fixture,
      line: result?.start?.line,
      checkId: String(result?.check_id ?? ''),
      used: false,
    });
  }
  let matched = 0;
  for (const want of expected) {
    const hit = findings.find(
      (f) =>
        !f.used &&
        f.path === want.path &&
        sameRule(f.checkId, want.rule) &&
        (f.line === want.line || f.line === want.line + 1)
    );
    if (hit) {
      hit.used = true;
      matched += 1;
    }
  }
  return {
    valid: true,
    expected: expected.length,
    matched,
    missed: expected.length - matched,
    unexpected: findings.filter((f) => !f.used).length,
    rules: rules.size,
    cases: fixtures.length,
  };
}

export function renderFixtureLines(result) {
  if (!result.valid) {
    return [
      `semgrep_fixtures: scan=failed (no readable report) expected=${result.expected}`,
    ];
  }
  return [
    `semgrep_fixtures: cases=${result.cases} rules=${result.rules} expected=${result.expected} matched=${result.matched} missed=${result.missed} unexpected=${result.unexpected}`,
  ];
}

/** The fixtures are a test of the rules, not of the repository: any mismatch fails, always. */
export const fixturesGate = (result) => ({
  exit: result.valid && result.missed === 0 && result.unexpected === 0 ? 0 : 1,
});

// --- Gitleaks (the one-off history scan, run on the owner's machine) ------------------------------------------

/**
 * A Gitleaks JSON report: how many findings, of how many rules, in how many commits and files.
 * Never the match or the secret. (Run with `--redact` so the report does not hold them either.)
 */
export function summarizeGitleaks(report) {
  if (!Array.isArray(report)) return { valid: false };
  const byRule = new Map();
  const commits = new Set();
  const files = new Set();
  for (const finding of report) {
    if (!isObject(finding)) continue;
    const rule = String(finding.RuleID ?? 'unknown').slice(0, 60);
    byRule.set(rule, (byRule.get(rule) ?? 0) + 1);
    if (finding.Commit) commits.add(String(finding.Commit));
    if (finding.File) files.add(String(finding.File));
  }
  return {
    valid: true,
    findings: [...byRule.values()].reduce((a, b) => a + b, 0),
    rules: byRule.size,
    commits: commits.size,
    files: files.size,
    byRule: [...byRule.entries()].sort(
      (a, b) => b[1] - a[1] || a[0].localeCompare(b[0])
    ),
  };
}

export function renderGitleaksLines(summary, { byRule = false } = {}) {
  if (!summary.valid) return ['gitleaks_history: report=unreadable'];
  const lines = [
    `gitleaks_history: findings=${summary.findings} rules=${summary.rules} commits=${summary.commits} files=${summary.files}`,
  ];
  if (byRule) {
    for (const [rule, count] of summary.byRule) {
      lines.push(`gitleaks_rule: ${rule}=${count}`);
    }
  }
  return lines;
}

// --- output guard and arguments --------------------------------------------------------------------------------------

export const WITHHELD = '[line withheld by the privacy guard]';

/** Every printed line passes the same guard as the LINE messages: a leak-shaped line is withheld. */
export const guardLines = (lines) =>
  lines.map((line) =>
    findPrivacyViolations(line).length > 0 ? WITHHELD : line
  );

export class CountsUsageError extends Error {}

export const COUNTS_USAGE = [
  'Usage: node scripts/security/shift-left-counts.mjs <kind> [options] [files...]',
  '  trivy            --config <config.json> [--targets <targets.json>] [--blocking true|false] <image.json>...',
  '  osv              --report <osv.json> [--targets <targets.json>] [--blocking true|false]',
  '  semgrep          --report <semgrep.json> [--blocking true|false]',
  '  semgrep-fixtures --report <semgrep.json>',
  '  gitleaks         --report <gitleaks.json> [--by-rule]',
  'Prints counts only. A report that is missing or unreadable is an error, never a clean scan.',
  'Exit codes: 0 done, 1 the gate failed or a scan did not run, 2 usage error.',
].join('\n');

const KINDS = new Set([
  'trivy',
  'osv',
  'semgrep',
  'semgrep-fixtures',
  'gitleaks',
]);
const VALUE_FLAGS = new Set([
  '--config',
  '--report',
  '--targets',
  '--blocking',
]);

/** @param {string[]} argv arguments after the script name */
export function parseCountsArgs(argv) {
  const [kind, ...rest] = argv;
  if (!KINDS.has(kind)) throw new CountsUsageError('unknown kind');
  const options = {
    kind,
    config: null,
    report: null,
    targets: null,
    blocking: false,
    byRule: false,
    files: [],
  };
  for (let i = 0; i < rest.length; i += 1) {
    const arg = rest[i];
    if (arg === '--by-rule') {
      options.byRule = true;
    } else if (VALUE_FLAGS.has(arg)) {
      const value = rest[(i += 1)];
      if (value === undefined || value === '') {
        throw new CountsUsageError('a flag needs a value');
      }
      if (arg === '--blocking') {
        if (value !== 'true' && value !== 'false') {
          throw new CountsUsageError('--blocking is true or false');
        }
        options.blocking = value === 'true';
      } else {
        options[arg.slice(2)] = value;
      }
    } else if (arg.startsWith('-')) {
      throw new CountsUsageError('unknown argument');
    } else {
      options.files.push(arg);
    }
  }
  return options;
}
