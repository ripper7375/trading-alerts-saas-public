// Core of the private security pipeline (Phase 2 of the security monitoring
// architecture, v3.0): scope filter, resolution-class classifier, the first-match
// priority matrix (section 7.4), sorting, Node runtime floors, Dependabot
// reconciliation and the report builders.
//
// Pure functions. The repository is public, so the only output allowed to carry
// advisory identifiers or package names is the private, gitignored posture
// report; the stdout summary is counts only (`renderStdoutSummary`).

import { isExcludedPath } from './security-pipeline-policy.mjs';
import {
  findingKey,
  isRule5Package,
  makeFinding,
  normalizePyName,
} from './security-pipeline-matchers.mjs';
import {
  cleanVersion,
  compareVersions,
  isBreakingUpgrade,
  isExactPin,
  parseVersion,
  satisfies,
} from './security-semver-lite.mjs';

export * from './security-pipeline-policy.mjs';
export * from './security-pipeline-matchers.mjs';

export const TIERS = Object.freeze(['P0', 'P1', 'P2', 'P3']);
export const TIER_ORDER = Object.freeze([...TIERS, 'WITHDRAWN']);

export const RESOLUTION_CLASSES = Object.freeze([
  'ADVISORY_WITHDRAWN',
  'DIRECT_DEP',
  'DIRECT_PINNED_BY_OVERRIDE',
  'TRANSITIVE_UNLOCKED_RANGE',
  'TRANSITIVE_RANGE_BLOCKS_FIX',
  'TRANSITIVE_EXACT_PIN',
  'TRANSITIVE_BREAKING_MAJOR',
  'NO_FIX_AVAILABLE',
]);

/** Time to a merged and deployed fix, per rule (section 7.4). */
export const SLA = Object.freeze({
  'R-0': 'Clean up on the next maintenance PR',
  'R-1': 'None while the acceptance holds (review before it expires)',
  'R-2': 'None (build-time or dev-only)',
  'R-3': '< 4 h (rotate or remove first)',
  'R-4': 'Before cutover or restore (P3: none)',
  'R-5': '< 24 h',
  'R-6': '< 24 h, Rule 5 escalation',
  'R-7': '< 72 h',
  'R-8': '< 72 h',
  'R-9': '< 72 h (remove or justify)',
  'R-10': '14-30 days',
  'R-11': 'Watchlist',
});

// --- scope filter ------------------------------------------------------------------

/**
 * The 3-scope filter. A finding is `build_only` when its package is one the
 * asset lists in `build_only_packages` (or a matcher found it reachable only
 * through such a package), `dev_only` when it is installed for development
 * only, and `runtime` otherwise.
 *
 * @param {{ scope?: string, packageName: string }} finding
 * @param {{ buildOnlyPackages: Set<string> }} asset
 */
export function applyScope(finding, asset) {
  if (asset.buildOnlyPackages.has(finding.packageName)) return 'build_only';
  return finding.scope === 'dev_only' || finding.scope === 'build_only'
    ? finding.scope
    : 'runtime';
}

// --- resolution class ---------------------------------------------------------------

/**
 * How the finding is resolved: one of the eight classes of the design.
 *
 * `confidence` is `high` when the data decides it, `assumed` when a transitive
 * fix inside the same major could not be checked against the parents' declared
 * ranges (pnpm lockfiles carry resolved versions, not ranges).
 *
 * @returns {{ resolution: string, confidence: 'high' | 'assumed' | 'low', fixInRange: boolean, targetVersion: string | null }}
 */
export function classifyResolution(finding) {
  if (finding.withdrawn) {
    return {
      resolution: 'ADVISORY_WITHDRAWN',
      confidence: 'high',
      fixInRange: false,
      targetVersion: null,
    };
  }
  const installed = finding.version;
  const fixes = finding.fixedVersions.filter(
    (v) =>
      parseVersion(v) &&
      (installed === null || compareVersions(v, installed) === 1)
  );
  if (finding.fixedVersions.length === 0 || fixes.length === 0) {
    const decided = finding.fixKnown && finding.fixedVersions.length === 0;
    return {
      resolution: 'NO_FIX_AVAILABLE',
      confidence: decided ? 'high' : 'low',
      fixInRange: false,
      targetVersion: null,
    };
  }
  const nonBreaking = fixes.filter(
    (v) => installed === null || !isBreakingUpgrade(installed, v)
  );
  const target = nonBreaking.length > 0 ? lowest(nonBreaking) : lowest(fixes);
  if (finding.direct) {
    return {
      resolution: finding.pinnedByOverride
        ? 'DIRECT_PINNED_BY_OVERRIDE'
        : 'DIRECT_DEP',
      confidence: 'high',
      fixInRange: nonBreaking.length > 0,
      targetVersion: target,
    };
  }
  if (nonBreaking.length === 0) {
    return {
      resolution: 'TRANSITIVE_BREAKING_MAJOR',
      confidence: 'high',
      fixInRange: false,
      targetVersion: target,
    };
  }
  const parents = finding.parentRanges.filter((p) => p.parent !== '(root)');
  if (parents.length === 0) {
    return {
      resolution: 'TRANSITIVE_UNLOCKED_RANGE',
      confidence: 'assumed',
      fixInRange: true,
      targetVersion: target,
    };
  }
  const blockers = parents.filter((p) => !satisfies(target, p.range));
  if (blockers.length === 0) {
    return {
      resolution: 'TRANSITIVE_UNLOCKED_RANGE',
      confidence: 'high',
      fixInRange: true,
      targetVersion: target,
    };
  }
  return {
    resolution: blockers.some((p) => isExactPin(p.range))
      ? 'TRANSITIVE_EXACT_PIN'
      : 'TRANSITIVE_RANGE_BLOCKS_FIX',
    confidence: 'high',
    fixInRange: false,
    targetVersion: target,
  };
}

function lowest(versions) {
  return versions.reduce((best, v) =>
    compareVersions(v, best) < 0 ? v : best
  );
}

// --- priority matrix (section 7.4) ------------------------------------------------

const rce = new Set(['rce', 'auth_bypass', 'sqli']);

/**
 * First match wins, top to bottom. Expects the finding to carry `scope`,
 * `severity`, `vulnClass`, `inKev`, `epssScore`, `malicious`, `withdrawn`,
 * `vexActive`, `acceptedIgnore`, `lifecycle` and `exposureTier`.
 *
 * @returns {{ tier: 'WITHDRAWN' | 'P0' | 'P1' | 'P2' | 'P3', rule: string, sla: string }}
 */
export function evaluatePriority(f) {
  const out = (tier, rule) => ({ tier, rule, sla: SLA[rule] });
  const tier = f.exposureTier ?? null;
  const runtime = f.scope === 'runtime';
  const severe = f.severity === 'high' || f.severity === 'critical';
  const epss = typeof f.epssScore === 'number' ? f.epssScore : null;
  const exposed12 = tier === 1 || tier === 2;

  if (f.withdrawn) return out('WITHDRAWN', 'R-0');
  if ((f.vexActive || f.acceptedIgnore) && !f.inKev) return out('P3', 'R-1');
  if (
    (f.scope === 'dev_only' || f.scope === 'build_only') &&
    !f.inKev &&
    !f.malicious
  ) {
    return out('P3', 'R-2');
  }
  if (f.malicious || f.secretExposureConfirmed) return out('P0', 'R-3');
  if (f.lifecycle === 'pre_cutover' || f.lifecycle === 'paused') {
    return out(severe ? 'P2' : 'P3', 'R-4');
  }
  if (runtime && (f.inKev || (epss !== null && epss >= 0.1)) && exposed12) {
    return out('P0', 'R-5');
  }
  if (
    runtime &&
    f.severity === 'critical' &&
    rce.has(f.vulnClass) &&
    tier === 1
  ) {
    return out('P0', 'R-6');
  }
  if (f.kind === 'runtime-floor') return out('P1', 'R-7');
  if (
    runtime &&
    ((f.inKev && tier === 3) ||
      (severe && f.vulnClass !== 'dos' && exposed12) ||
      (f.vulnClass === 'dos' &&
        f.dosReachableUnauthenticated === true &&
        tier === 1))
  ) {
    return out('P1', 'R-8');
  }
  if (f.kind === 'public-endpoint') return out('P1', 'R-9');
  if (
    f.baseImageEol ||
    f.vulnClass === 'dos' ||
    (f.severity === 'high' && tier === 3) ||
    (f.severity === 'moderate' && epss !== null && epss >= 0.02)
  ) {
    return out('P2', 'R-10');
  }
  return out('P3', 'R-11');
}

/**
 * Sort order: tier, then (KEV desc, exposure tier asc, Rule 5 boundary desc,
 * CVSS desc, EPSS desc nulls last), then a fixed tie-break so reports are stable.
 */
export function compareFindings(a, b) {
  const byTier =
    TIER_ORDER.indexOf(a.priority) - TIER_ORDER.indexOf(b.priority);
  if (byTier !== 0) return byTier;
  const steps = [
    (x) => (x.inKev ? 0 : 1),
    (x) => x.exposureTier ?? 99,
    (x) => (x.rule5Boundary ? 0 : 1),
    (x) => -(x.cvss ?? -1),
    (x) => -(x.epssScore ?? -1),
  ];
  for (const step of steps) {
    const d = step(a) - step(b);
    if (d !== 0) return d;
  }
  return (
    String(a.assetId).localeCompare(b.assetId) ||
    String(a.packageName).localeCompare(b.packageName) ||
    String(a.primaryId).localeCompare(b.primaryId) ||
    String(a.version).localeCompare(String(b.version))
  );
}

/**
 * Scores a finding against its asset: scope, resolution class, VEX, priority.
 *
 * @param {object} finding a normalized finding (see makeFinding)
 * @param {object} asset the inventory asset
 * @param {{ today: string, vexStatements?: object[], vexMatches: (statement: object, finding: object) => boolean, vexExpiry: (statement: object, finding: object, ctx: object) => string[] }} context
 */
export function scoreFinding(finding, asset, context) {
  const f = { ...finding };
  f.lifecycle = asset.lifecycle;
  f.exposureTier = asset.exposureTier;
  f.scope = applyScope(f, asset);
  Object.assign(f, classifyResolution(f));
  f.rule5Boundary = asset.escalationRequired || isRule5Package(f.packageName);

  f.vexActive = false;
  f.vexSource = null;
  f.vexExpired = [];
  // A malicious package is never suppressed: the validator refuses a statement
  // for a MAL- advisory, and this keeps one written for an alias from working.
  for (const statement of f.malicious ? [] : (context.vexStatements ?? [])) {
    if (!context.vexMatches(statement, f)) continue;
    const reasons = context.vexExpiry(statement, f, { today: context.today });
    if (reasons.length === 0) {
      f.vexActive = true;
      f.vexSource = statement.source ?? 'public';
      break;
    }
    f.vexExpired.push(...reasons);
  }
  if (f.acceptedIgnore && !f.vexSource) f.vexSource = 'pnpm-ignore';

  const { tier, rule, sla } = evaluatePriority(f);
  f.priority = tier;
  f.rule = rule;
  f.sla = sla;
  f.escalation = tier === 'P0' && (rule === 'R-6' || f.rule5Boundary);
  return f;
}

// --- Node runtime floors --------------------------------------------------------------

/**
 * Reduces the Node.js release index (`dist/index.json`) to the latest release
 * and the latest *security* release of each major line.
 *
 * @param {unknown} index
 * @returns {Record<string, { latest: string | null, latestSecurity: string | null, latestSecurityDate: string | null }>}
 */
export function reduceNodeIndex(index) {
  const lines = {};
  if (!Array.isArray(index)) return lines;
  for (const entry of index) {
    const version = cleanVersion(entry?.version);
    if (!version) continue;
    const major = String(parseVersion(version).major);
    const line = (lines[major] ??= {
      latest: null,
      latestSecurity: null,
      latestSecurityDate: null,
    });
    if (line.latest === null || compareVersions(version, line.latest) > 0) {
      line.latest = version;
    }
    if (
      entry.security === true &&
      (line.latestSecurity === null ||
        compareVersions(version, line.latestSecurity) > 0)
    ) {
      line.latestSecurity = version;
      line.latestSecurityDate =
        typeof entry.date === 'string' ? entry.date : null;
    }
  }
  return lines;
}

const NODE_STATUS_SEVERITY = Object.freeze({
  below_floor: 'high',
  behind_latest_security: 'high',
});

/**
 * Compares the Node floors of the inventory, the newest security releases and
 * (when known) the runtime each asset runs.
 *
 * @param {{
 *   inventory: ReturnType<typeof import('./security-pipeline-policy.mjs').normalizeInventory>,
 *   nodeLines: ReturnType<typeof reduceNodeIndex> | null,
 *   runtimeState?: { assets?: Record<string, { node?: string, verified?: boolean, note?: string }> } | null,
 *   runnerVersion?: string | null,
 * }} input
 */
export function evaluateRuntimeFloors({
  inventory,
  nodeLines,
  runtimeState = null,
  runnerVersion = null,
}) {
  const floors = Object.entries(inventory.toolchain.nodeFloors).map(
    ([major, floor]) => {
      const line = nodeLines?.[major] ?? null;
      const latestSecurity = line?.latestSecurity ?? null;
      return {
        major: Number(major),
        floor,
        latest: line?.latest ?? null,
        latestSecurity,
        latestSecurityDate: line?.latestSecurityDate ?? null,
        feedKnown: line !== null,
        floorBehind:
          latestSecurity !== null &&
          compareVersions(latestSecurity, floor) === 1,
      };
    }
  );
  const floorOf = (major) => floors.find((f) => f.major === major) ?? null;

  const assets = [];
  for (const asset of inventory.assets) {
    if (asset.runtime?.type !== 'nodejs') continue;
    const state = runtimeState?.assets?.[asset.id] ?? null;
    const version = cleanVersion(state?.node);
    let status = 'unverified';
    let line = null;
    if (version) {
      line = floorOf(parseVersion(version).major);
      if (!line) status = 'unknown_line';
      else if (compareVersions(version, line.floor) === -1)
        status = 'below_floor';
      else if (
        line.latestSecurity &&
        compareVersions(version, line.latestSecurity) === -1
      ) {
        status = 'behind_latest_security';
      } else status = 'ok';
    }
    assets.push({
      assetId: asset.id,
      lifecycle: asset.lifecycle,
      version,
      verified: state?.verified === true,
      status,
      floor: line?.floor ?? null,
      latestSecurity: line?.latestSecurity ?? null,
      note: typeof state?.note === 'string' ? state.note : null,
    });
  }

  const findings = [];
  for (const entry of assets) {
    if (
      entry.status !== 'below_floor' &&
      entry.status !== 'behind_latest_security'
    )
      continue;
    findings.push(
      makeFinding({
        kind: 'runtime-floor',
        source: 'node-feed',
        ecosystem: 'runtime',
        assetId: entry.assetId,
        packageName: 'node',
        version: entry.version,
        primaryId: `NODE-RUNTIME-${entry.floor}`,
        title: `Node.js ${entry.version} is ${entry.status === 'below_floor' ? 'below the floor' : 'behind the latest security release'}`,
        severity: NODE_STATUS_SEVERITY[entry.status],
        vulnClass: 'other',
        fixedVersions: [
          entry.status === 'below_floor' ? entry.floor : entry.latestSecurity,
        ],
        fixKnown: true,
        key: findingKey(['runtime-floor', entry.assetId, entry.floor]),
        runtime: entry,
      })
    );
  }
  for (const line of floors.filter((f) => f.floorBehind)) {
    findings.push(
      makeFinding({
        kind: 'runtime-floor',
        source: 'node-feed',
        ecosystem: 'runtime',
        assetId: 'inventory',
        packageName: 'node',
        version: line.floor,
        primaryId: `NODE-FLOOR-${line.major}`,
        title: `The Node ${line.major} floor ${line.floor} is behind the latest security release ${line.latestSecurity}`,
        severity: 'high',
        vulnClass: 'other',
        fixedVersions: [line.latestSecurity],
        fixKnown: true,
        key: findingKey(['runtime-floor', 'inventory', line.major]),
        runtime: { status: 'floor_behind', ...line },
      })
    );
  }

  const runner = parseVersion(runnerVersion)
    ? {
        version: cleanVersion(runnerVersion),
        below_floor:
          floorOf(parseVersion(runnerVersion).major) !== null &&
          compareVersions(
            runnerVersion,
            floorOf(parseVersion(runnerVersion).major).floor
          ) === -1,
      }
    : null;

  const counts = {
    ok: 0,
    below_floor: 0,
    behind_latest_security: 0,
    unverified: 0,
    unknown_line: 0,
  };
  for (const entry of assets) counts[entry.status] += 1;
  return { floors, assets, findings, runner, counts };
}

// --- Dependabot reconciliation -------------------------------------------------------

/**
 * Compares the open Dependabot alerts with what the local matchers found. A
 * disagreement is itself a finding (section 7.1); the lists hold identifiers and
 * go to the private report only, the summary carries counts.
 *
 * @param {{
 *   alerts: { ghsa: string | null, cve: string | null, packageName: string, manifestPath: string, scope: string | null }[],
 *   findings: object[],
 *   inventory: object,
 * }} input
 */
export function reconcileDependabot({ alerts, findings, inventory }) {
  const manifests = new Map();
  for (const asset of inventory.assets) {
    for (const eco of asset.ecosystems) {
      for (const path of [eco.manifestPath, eco.lockfilePath]) {
        if (path) manifests.set(path, asset.id);
      }
      // a workspace importer is part of the same asset: Dependabot reports
      // its alerts against the importer's own package.json
      for (const importer of eco.workspaceImporters ?? []) {
        if (importer !== '.') {
          manifests.set(
            `${importer.replace(/\/+$/, '')}/package.json`,
            asset.id
          );
        }
      }
    }
  }
  const counts = {
    open: alerts.length,
    excludedPaths: 0,
    unmapped: 0,
    development: 0,
    compared: 0,
  };
  // Python names compare in their PEP 503 form (Dependabot says `Flask-Cors`,
  // OSV and the requirements file say `flask-cors`).
  const nameOf = (ecosystem, name) =>
    String(ecosystem).toLowerCase() === 'pip'
      ? normalizePyName(name)
      : String(name);
  const keyOf = (assetId, id, ecosystem, packageName) =>
    `${assetId}|${String(id).toLowerCase()}|${nameOf(ecosystem, packageName)}`;

  // Dependabot side: one entry per alert on a live, mapped, non-development manifest.
  const remote = new Map();
  const unmappedManifests = new Set();
  for (const alert of alerts) {
    if (isExcludedPath(alert.manifestPath, inventory.excludedPaths)) {
      counts.excludedPaths += 1;
      continue;
    }
    const manifestPath = String(alert.manifestPath ?? '').replaceAll('\\', '/');
    const assetId = manifests.get(manifestPath);
    if (!assetId) {
      counts.unmapped += 1;
      unmappedManifests.add(manifestPath);
      continue;
    }
    if (alert.scope === 'development') {
      counts.development += 1;
      continue;
    }
    const id = alert.ghsa ?? alert.cve;
    if (!id) continue;
    remote.set(keyOf(assetId, id, alert.ecosystem, alert.packageName), {
      assetId,
      id,
      packageName: alert.packageName,
    });
  }

  // Local side: every identifier of every advisory finding.
  const localIds = new Set();
  for (const f of findings) {
    if (f.kind !== 'advisory' || f.malicious) continue;
    for (const id of f.advisoryIds) {
      localIds.add(keyOf(f.assetId, id, f.ecosystem, f.packageName));
    }
  }

  const dependabotOnly = [];
  for (const [key, item] of remote) {
    counts.compared += 1;
    if (!localIds.has(key)) dependabotOnly.push(item);
  }
  const localOnly = [];
  const seen = new Set();
  for (const f of findings) {
    // a package installed for development is not audited by the production matchers
    if (f.kind !== 'advisory' || f.malicious || f.scope === 'dev_only') {
      continue;
    }
    if (!f.advisoryIds.some((id) => /^(?:GHSA|CVE)-/i.test(id))) continue;
    const dedupe = `${f.assetId}|${f.primaryId}|${nameOf(f.ecosystem, f.packageName)}`;
    if (seen.has(dedupe)) continue;
    seen.add(dedupe);
    if (
      f.advisoryIds.some((id) =>
        remote.has(keyOf(f.assetId, id, f.ecosystem, f.packageName))
      )
    ) {
      continue;
    }
    localOnly.push({
      assetId: f.assetId,
      id: f.primaryId,
      packageName: f.packageName,
    });
  }
  return {
    status: 'compared',
    ...counts,
    agreed: counts.compared - dependabotOnly.length,
    dependabotOnly,
    localOnly,
    unmappedManifests: [...unmappedManifests].sort(),
    mismatch: dependabotOnly.length + localOnly.length,
  };
}

// --- reports -----------------------------------------------------------------------------

const emptyTierCounts = () => ({ P0: 0, P1: 0, P2: 0, P3: 0, WITHDRAWN: 0 });

/** Findings per tier, in total and per asset. */
export function summarizeFindings(findings) {
  const tiers = emptyTierCounts();
  const byAsset = {};
  let kev = 0;
  let malicious = 0;
  let escalations = 0;
  for (const f of findings) {
    tiers[f.priority] += 1;
    (byAsset[f.assetId] ??= emptyTierCounts())[f.priority] += 1;
    if (f.inKev) kev += 1;
    if (f.malicious) malicious += 1;
    if (f.escalation) escalations += 1;
  }
  return {
    tiers,
    byAsset,
    total: findings.length,
    kev,
    malicious,
    escalations,
  };
}

const esc = (value, max = 200) =>
  String(value ?? '')
    .slice(0, max)
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001f\u007f]+/g, ' ')
    // backslashes first, so the escapes added below are not escaped again
    .replace(/\\/g, '\\\\')
    .replace(/\|/g, '\\|')
    .replace(/[<>]/g, (c) => (c === '<' ? '&lt;' : '&gt;'));

/** Text from a feed or a lockfile, made safe to sit in one Markdown table cell. */
export { esc as escapeMarkdownCell };

const pct = (x) => (typeof x === 'number' ? x.toFixed(3) : 'n/a');

function findingRow(f) {
  const ids = f.advisoryIds.length > 0 ? f.advisoryIds.join(', ') : f.primaryId;
  const flags = [
    f.inKev ? 'KEV' : null,
    f.malicious ? 'MAL' : null,
    f.rule5Boundary ? 'Rule5' : null,
    f.escalation ? 'ESCALATE' : null,
    f.direct ? 'direct' : null,
    f.acceptedIgnore ? 'accepted-ignore' : null,
    f.vexActive ? `vex:${f.vexSource}` : null,
  ].filter(Boolean);
  return `| ${esc(f.assetId)} | ${esc(`${f.packageName}@${f.version ?? '?'}`)} | ${esc(ids)} | ${esc(f.severity)}${f.severityAssumed ? '*' : ''} | ${f.cvss ?? 'n/a'} | ${pct(f.epssScore)} | ${esc(f.scope)} | ${esc(f.vulnClass)} | ${esc(f.resolution ?? '')}${f.confidence === 'assumed' ? '*' : ''} | ${f.rule} | ${esc(f.sla, 60)} | ${esc(flags.join(' '))} |`;
}

/**
 * The private posture report (Markdown). It names advisories and packages, so
 * it is written to the gitignored reports folder only.
 */
export function renderPostureMarkdown(posture) {
  const s = posture.summary;
  const out = [];
  out.push('# DavinTrade security posture (private)');
  out.push('');
  out.push(
    `Generated ${posture.generated_at} by scripts/security/run-security-pipeline.mjs.`
  );
  out.push(
    'This file names advisories and packages. It stays in the gitignored reports folder: never commit it, paste it into an issue or attach it to a public log.'
  );
  out.push('');
  out.push('## Summary');
  out.push('');
  out.push(
    '| P0 | P1 | P2 | P3 | Withdrawn | KEV | Malicious | Rule 5 escalations |'
  );
  out.push('| -: | -: | -: | -: | -: | -: | -: | -: |');
  out.push(
    `| ${s.tiers.P0} | ${s.tiers.P1} | ${s.tiers.P2} | ${s.tiers.P3} | ${s.tiers.WITHDRAWN} | ${s.kev} | ${s.malicious} | ${s.escalations} |`
  );
  out.push('');
  out.push(
    `Mode: ${posture.run.offline ? 'offline (cached intelligence only)' : 'online'}; matchers ok ${posture.matchers.ok}, failed ${posture.matchers.failed}, skipped ${posture.matchers.skipped}.`
  );
  if (posture.run.degraded)
    out.push(
      '**The sweep is degraded: at least one matcher or feed was unavailable. Absence of findings is not proof of safety.**'
    );
  out.push('');

  const rf = posture.runtime_floors;
  out.push('## Node.js runtime floors');
  out.push('');
  out.push(
    '| Line | Floor | Latest security release | Latest release | Floor behind |'
  );
  out.push('| -: | :- | :- | :- | :- |');
  for (const line of rf.floors) {
    out.push(
      `| ${line.major} | ${line.floor} | ${line.latestSecurity ?? 'unknown'}${line.latestSecurityDate ? ` (${line.latestSecurityDate})` : ''} | ${line.latest ?? 'unknown'} | ${line.floorBehind ? 'YES' : 'no'} |`
    );
  }
  out.push('');
  out.push('| Asset | Runtime | Verified | Status | Note |');
  out.push('| :- | :- | :- | :- | :- |');
  for (const a of rf.assets) {
    out.push(
      `| ${esc(a.assetId)} | ${a.version ?? 'unknown'} | ${a.verified ? 'yes' : 'no'} | ${a.status} | ${esc(a.note ?? '', 120)} |`
    );
  }
  if (rf.runner)
    out.push(
      '',
      `Runner Node ${rf.runner.version}${rf.runner.below_floor ? ' (below the floor of its line)' : ''}.`
    );
  out.push('');

  for (const tier of TIER_ORDER) {
    const rows = posture.findings.filter((f) => f.priority === tier);
    if (rows.length === 0) continue;
    out.push(`## ${tier} (${rows.length})`, '');
    out.push(
      '| Asset | Package | Advisories | Severity | CVSS | EPSS | Scope | Class | Resolution | Rule | SLA | Flags |'
    );
    out.push('| :- | :- | :- | :- | -: | -: | :- | :- | :- | :- | :- | :- |');
    for (const f of rows) out.push(findingRow(f));
    out.push('');
  }
  out.push(
    '`*` severity or resolution assumed (the source did not state it).',
    ''
  );

  if (posture.accepted_ignores.length > 0) {
    out.push('## Accepted ignores (pnpm.auditConfig.ignoreGhsas)', '');
    out.push(
      'Muted by pnpm, so invisible to the audit gate. The engine re-reads them so a withdrawal, a fix or a KEV listing resurfaces.',
      ''
    );
    out.push(
      '| Advisory | Resolved to a package | Withdrawn | In KEV | VEX statement |'
    );
    out.push('| :- | :- | :- | :- | :- |');
    for (const a of posture.accepted_ignores) {
      out.push(
        `| ${esc(a.id)} | ${a.matched} | ${a.withdrawn ? 'YES' : 'no'} | ${a.inKev ? 'YES' : 'no'} | ${a.hasVex ? 'yes' : 'no'} |`
      );
    }
    out.push('');
  }

  const rec = posture.dependabot;
  out.push('## Dependabot reconciliation', '');
  if (rec.status !== 'compared') {
    out.push(`Not compared (${rec.status}).`, '');
  } else {
    out.push(
      `Open alerts ${rec.open}; compared ${rec.compared}; excluded paths ${rec.excludedPaths}; unmapped manifests ${rec.unmapped}; development scope ${rec.development}; agreed ${rec.agreed}.`,
      ''
    );
    if (rec.unmappedManifests?.length > 0) {
      out.push(
        'Manifests with open alerts that are not in the inventory (a coverage gap):',
        ''
      );
      for (const path of rec.unmappedManifests) out.push(`- ${esc(path)}`);
      out.push('');
    }
    if (rec.dependabotOnly.length > 0) {
      out.push(
        `Reported by Dependabot only (${rec.dependabotOnly.length}):`,
        ''
      );
      for (const item of rec.dependabotOnly)
        out.push(
          `- ${esc(item.assetId)}: ${esc(item.packageName)} (${esc(item.id)})`
        );
      out.push('');
    }
    if (rec.localOnly.length > 0) {
      out.push(`Found locally only (${rec.localOnly.length}):`, '');
      for (const item of rec.localOnly)
        out.push(
          `- ${esc(item.assetId)}: ${esc(item.packageName)} (${esc(item.id)})`
        );
      out.push('');
    }
  }

  out.push('## Matchers and feeds', '');
  out.push('| Source | Status | Detail |', '| :- | :- | :- |');
  for (const m of posture.matchers.items)
    out.push(
      `| ${esc(m.id)} | ${esc(m.status)} | ${esc(m.detail ?? '', 120)} |`
    );
  for (const [name, f] of Object.entries(posture.feeds))
    out.push(
      `| ${esc(name)} | ${esc(f.status)} | ${esc(f.detail ?? '', 120)} |`
    );
  out.push('');

  if (posture.pinning.length > 0) {
    out.push('## Python pinning', '');
    out.push(
      '| Asset | Pinned | Unpinned | Pinning required |',
      '| :- | -: | -: | :- |'
    );
    for (const p of posture.pinning)
      out.push(
        `| ${esc(p.assetId)} | ${p.pinned} | ${p.unpinned} | ${p.pinningRequired ? 'yes' : 'no'} |`
      );
    out.push('');
  }

  out.push('## VEX', '');
  out.push(
    `Public registry: ${posture.vex.public.valid ? `${posture.vex.public.count} statement(s)` : `INVALID (${posture.vex.public.errors.join(', ')})`}. Private overlay: ${posture.vex.private.present ? (posture.vex.private.valid ? `${posture.vex.private.count} statement(s)` : `INVALID (${posture.vex.private.errors.join(', ')})`) : 'absent'}. Stale statements: ${posture.vex.stale.length}.`,
    ''
  );

  if (posture.notes.length > 0) {
    out.push('## Notes', '');
    for (const note of posture.notes) out.push(`- ${esc(note, 300)}`);
    out.push('');
  }
  return `${out.join('\n')}\n`;
}

/**
 * The console summary: counts and fixed words only. No advisory identifier, no
 * package name, no asset name.
 */
export function renderStdoutSummary(posture) {
  const s = posture.summary;
  const rf = posture.runtime_floors.counts;
  const dep = posture.dependabot;
  const lines = [
    'DavinTrade security pipeline sweep (counts only)',
    `run: ${posture.generated_at} mode=${posture.run.offline ? 'offline' : 'online'}${posture.run.degraded ? ' degraded=yes' : ''}`,
    `assets: total=${posture.inventory.assets_total} scanned=${posture.inventory.assets_scanned} skipped=${posture.inventory.assets_skipped}`,
    `matchers: ok=${posture.matchers.ok} failed=${posture.matchers.failed} skipped=${posture.matchers.skipped}`,
    `feeds: ${Object.entries(posture.feeds)
      .map(([name, f]) => `${name}=${f.status}`)
      .join(' ')}`,
    `findings: P0=${s.tiers.P0} P1=${s.tiers.P1} P2=${s.tiers.P2} P3=${s.tiers.P3} withdrawn=${s.tiers.WITHDRAWN} total=${s.total}`,
    `signals: kev=${s.kev} malicious=${s.malicious} rule5_escalations=${s.escalations} accepted_ignores=${posture.accepted_ignores.length}`,
    `runtime_floors: below_floor=${rf.below_floor} behind_latest_security=${rf.behind_latest_security} unverified=${rf.unverified} ok=${rf.ok} floors_behind=${posture.runtime_floors.floors.filter((f) => f.floorBehind).length}`,
    dep.status === 'compared'
      ? `dependabot: open=${dep.open} compared=${dep.compared} dependabot_only=${dep.dependabotOnly.length} local_only=${dep.localOnly.length}`
      : `dependabot: ${dep.status}`,
    `pinning: unpinned_lines=${posture.pinning.reduce((sum, p) => sum + p.unpinned, 0)}`,
    `vex: public=${posture.vex.public.count} private=${posture.vex.private.count} stale=${posture.vex.stale.length}`,
  ];
  return lines;
}
