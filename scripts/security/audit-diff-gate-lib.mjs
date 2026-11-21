// Pure helpers for scripts/security/audit-diff-gate.mjs.
//
// The repository is public, so nothing here may print an advisory identifier
// (CVE or GHSA), a package name, a version or an advisory summary. Reports are
// limited to aggregate counts and fixed sentences.

export const BLOCKING_SEVERITIES = Object.freeze(['high', 'critical']);

const MODES = Object.freeze(['auto', 'full', 'diff', 'summary']);

/**
 * The `name@version` keys of the `packages:` section of a pnpm lockfile (v9).
 * Keys sit at two-space indentation and are quoted when the name starts with
 * `@`. The `snapshots:` section (keys with peer suffixes) is not read.
 *
 * @param {string} text
 * @returns {Set<string>}
 */
export function lockfilePackageKeys(text) {
  const keys = new Set();
  let inPackages = false;
  for (const line of String(text).split(/\r?\n/)) {
    if (/^[A-Za-z]/.test(line)) {
      inPackages = /^packages:\s*$/.test(line);
      continue;
    }
    if (!inPackages) continue;
    const match =
      /^ {2}(?:'((?:[^']|'')+)'|"((?:[^"\\]|\\.)+)"|([^\s'"][^\r\n]*?)):\s*$/.exec(
        line
      );
    if (match) {
      keys.add((match[1] ?? match[2] ?? match[3]).replace(/''/g, "'"));
    }
  }
  return keys;
}

/**
 * Keys present in the head lockfile and absent from the base: packages the
 * change adds, or whose resolved version it changes. A removal is not listed.
 *
 * @param {Set<string>} headKeys
 * @param {Set<string>} baseKeys
 * @returns {Set<string>}
 */
export function introducedKeys(headKeys, baseKeys) {
  const out = new Set();
  for (const key of headKeys) if (!baseKeys.has(key)) out.add(key);
  return out;
}

/**
 * Reads the JSON of `pnpm audit --json`.
 *
 *   { kind: 'ok', advisories }  usable; advisories muted through
 *                               `pnpm.auditConfig` are already absent
 *   { kind: 'unavailable' }     empty output, or an error object without
 *                               advisories (what --ignore-registry-errors lets
 *                               through when the advisory endpoint is down)
 *   { kind: 'invalid' }         anything else
 *
 * @param {string | null | undefined} text
 * @returns {{ kind: 'ok', advisories: object[] } | { kind: 'unavailable' } | { kind: 'invalid' }}
 */
export function parseAuditJson(text) {
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
  const advisories = data.advisories;
  if (
    advisories &&
    typeof advisories === 'object' &&
    !Array.isArray(advisories)
  ) {
    return { kind: 'ok', advisories: Object.values(advisories) };
  }
  if (advisories === undefined && data.error) return { kind: 'unavailable' };
  if (advisories === undefined && data.metadata) {
    return { kind: 'ok', advisories: [] };
  }
  return { kind: 'invalid' };
}

/** `name@version` for every installed version an advisory affects. */
export function affectedKeys(advisory) {
  const name = advisory?.module_name;
  return (advisory?.findings ?? []).map((f) => `${name}@${f?.version}`);
}

const zero = () => ({ high: 0, critical: 0 });

/**
 * Counts high and critical advisories. With `introduced` null (full gate) every
 * one blocks. With a Set (diff gate) an advisory blocks when it affects at least
 * one added or changed package; the others are counted as already present.
 *
 * @param {object[]} advisories
 * @param {Set<string> | null} introduced
 */
export function classifyAdvisories(advisories, introduced) {
  const counts = { blocking: zero(), preexisting: zero() };
  for (const advisory of advisories) {
    const severity = String(advisory?.severity ?? '').toLowerCase();
    if (!BLOCKING_SEVERITIES.includes(severity)) continue;
    // An advisory that lists no affected version cannot be tied to a package
    // the change did not touch, so it blocks rather than slipping through.
    const keys = affectedKeys(advisory);
    const blocks =
      introduced === null ||
      keys.length === 0 ||
      keys.some((k) => introduced.has(k));
    counts[blocks ? 'blocking' : 'preexisting'][severity] += 1;
  }
  return counts;
}

/**
 * `full` on the default branch (push, weekly schedule, manual run), `diff` on a
 * pull request or any other ref. Outside GitHub Actions the default is `full`,
 * so a local run shows the whole picture. An explicit `full`, `diff` or
 * `summary` (the informational all-dependencies report) wins.
 *
 * @param {{ requested?: string, env?: Record<string, string | undefined> }} options
 * @returns {'full' | 'diff' | 'summary'}
 */
export function chooseMode({ requested = 'auto', env = process.env } = {}) {
  if (!MODES.includes(requested)) {
    throw new Error('unknown mode (expected auto, full, diff or summary)');
  }
  if (requested !== 'auto') return requested;
  if (!env.GITHUB_ACTIONS) return 'full';
  return env.GITHUB_REF === 'refs/heads/main' ? 'full' : 'diff';
}

const SEVERITIES = Object.freeze([
  'info',
  'low',
  'moderate',
  'high',
  'critical',
]);

/**
 * Advisories per severity, for the informational all-dependencies summary.
 *
 * @param {object[]} advisories
 * @returns {Record<string, number>}
 */
export function severityCounts(advisories) {
  const counts = Object.fromEntries(SEVERITIES.map((s) => [s, 0]));
  for (const advisory of advisories) {
    const severity = String(advisory?.severity ?? '').toLowerCase();
    if (Object.hasOwn(counts, severity)) counts[severity] += 1;
  }
  return counts;
}

/**
 * The informational report for all dependencies: advisories per severity.
 * It never fails; the blocking gate is the production gate.
 *
 * @param {{
 *   counts?: Record<string, number> | null,
 *   auditUnavailable?: boolean,
 *   auditFailedExit?: number | null,
 * }} input
 * @returns {{ exitCode: number, lines: string[] }}
 */
export function buildSummaryReport({
  counts = null,
  auditUnavailable = false,
  auditFailedExit = null,
}) {
  const lines = [
    'Audit summary (counts only, informational): all dependencies',
  ];
  if (auditFailedExit !== null) {
    lines.push(
      `The audit did not produce a result (exit code ${auditFailedExit}).`
    );
  } else if (auditUnavailable || counts === null) {
    lines.push(
      'Advisory data unavailable (registry error ignored): no result.'
    );
  } else {
    const shown = ['low', 'moderate', 'high', 'critical'].map(
      (s) => `${s}=${counts[s]}`
    );
    lines.push(
      `Advisories by severity (accepted ignores excluded): ${shown.join(' ')}`
    );
  }
  lines.push(
    'This step is informational and never blocks; the production gate is the blocking one.'
  );
  return { exitCode: 0, lines };
}

export const formatCounts = (c) => `high=${c.high} critical=${c.critical}`;
export const totalCount = (c) => c.high + c.critical;

/**
 * The report: fixed sentences and counts only.
 *
 * @param {{
 *   mode: 'full' | 'diff',
 *   introducedCount?: number | null,
 *   counts?: { blocking: {high:number,critical:number}, preexisting: {high:number,critical:number} } | null,
 *   auditUnavailable?: boolean,
 *   auditFailedExit?: number | null,
 *   baseUnavailable?: boolean,
 * }} input
 * @returns {{ exitCode: number, lines: string[] }}
 */
export function buildReport({
  mode,
  introducedCount = null,
  counts = null,
  auditUnavailable = false,
  auditFailedExit = null,
  baseUnavailable = false,
}) {
  const lines = [`Production audit gate (counts only): mode=${mode}`];
  if (baseUnavailable) {
    lines.push(
      'The base lockfile is unavailable: running the full gate instead.'
    );
  }
  if (mode === 'diff') {
    lines.push(
      `Lockfile packages added or changed by this change: ${introducedCount}`
    );
    if (introducedCount === 0) {
      lines.push('Nothing to audit.');
      lines.push('RESULT: PASS');
      return { exitCode: 0, lines };
    }
  }

  if (auditFailedExit !== null) {
    lines.push(
      `The audit did not produce a result (exit code ${auditFailedExit}).`
    );
    lines.push('RESULT: FAIL');
    lines.push(
      '::error::Production audit gate: the audit did not produce a result.'
    );
    return { exitCode: 1, lines };
  }
  if (auditUnavailable || counts === null) {
    lines.push(
      'Advisory data unavailable (registry error ignored): no result.'
    );
    lines.push('RESULT: PASS (not evaluated)');
    return { exitCode: 0, lines };
  }

  if (mode === 'diff') {
    lines.push(
      `High and critical advisories in added or changed packages: ${formatCounts(counts.blocking)}`
    );
    lines.push(
      `High and critical advisories already present on the base (not blocking here): ${formatCounts(counts.preexisting)}`
    );
  } else {
    lines.push(
      `High and critical advisories in production dependencies: ${formatCounts(counts.blocking)}`
    );
  }

  if (totalCount(counts.blocking) === 0) {
    lines.push('RESULT: PASS');
    return { exitCode: 0, lines };
  }

  lines.push('RESULT: FAIL');
  lines.push(
    mode === 'diff'
      ? '::error::Production audit gate: this change adds or changes a dependency with a high or critical advisory.'
      : '::error::Production audit gate: high or critical advisories in production dependencies.'
  );
  lines.push(
    'Details are not printed in public logs. Run `pnpm audit --prod --audit-level=high` locally, or read the private security report.'
  );
  if (mode === 'full') {
    lines.push(
      "Fix it in a dedicated 'fix(security): ...' PR directly on main (.claude/rules/security-overrides.md)."
    );
  }
  return { exitCode: 1, lines };
}
