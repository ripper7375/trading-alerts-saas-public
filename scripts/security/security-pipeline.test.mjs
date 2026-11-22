// Run: node --test 'scripts/security/*.test.mjs'
//
// The engine of the private security pipeline: policy loading, the matchers, the
// 3-scope filter, the 8-class classifier, the R-0..R-11 priority matrix and its
// sort order, VEX handling, Node runtime floors, Dependabot reconciliation and
// the parity with the blocking audit gate.
//
// Fixtures use invented package names and identifiers on purpose (a public
// repository must not hold the identifier of a real, unfixed advisory).
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  RESOLUTION_CLASSES,
  SLA,
  TIERS,
  applyScope,
  buildHygieneFindings,
  buildNpmGraph,
  classifyResolution,
  classifyVulnerability,
  compareFindings,
  cvss3Score,
  escapeMarkdownCell,
  evaluatePriority,
  evaluateRuntimeFloors,
  extractAdvisoryIds,
  isExcludedPath,
  isPipDevTool,
  loadInventory,
  makeFinding,
  mergeVexRegistries,
  normalizeInventory,
  npmFindings,
  parseNixpacksBuildEnv,
  parseNpmAuditJson,
  parseRequirements,
  pnpmFindings,
  pnpmGateParityCounts,
  reconcileDependabot,
  reduceNodeIndex,
  scoreFinding,
  severityFromScore,
  staleVexStatements,
  summarizeFindings,
  vexExpiryReasons,
  vexStatementMatches,
  PolicyError,
} from './security-pipeline-lib.mjs';
import { parseAuditJson } from './audit-diff-gate-lib.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..', '..');
const INVENTORY_TEXT = readFileSync(
  join(ROOT, 'security', 'security-inventory.yaml'),
  'utf8'
);

const ADVISORY = 'GHSA-aaaa-bbbb-cccc';
const ADVISORY_2 = 'GHSA-dddd-eeee-ffff';
const CVE = 'CVE-2099-0001';

// --- priority matrix -----------------------------------------------------------

const BASE = {
  kind: 'advisory',
  scope: 'runtime',
  severity: 'moderate',
  vulnClass: 'other',
  inKev: false,
  epssScore: null,
  malicious: false,
  withdrawn: false,
  vexActive: false,
  acceptedIgnore: false,
  lifecycle: 'production',
  exposureTier: 1,
};
const rule = (over) => {
  const { tier, rule: id, sla } = evaluatePriority({ ...BASE, ...over });
  return `${tier}/${id}/${sla === SLA[id]}`;
};

test('R-0: a withdrawn advisory is WITHDRAWN before anything else', () => {
  assert.equal(
    rule({ withdrawn: true, inKev: true, malicious: true }),
    `WITHDRAWN/R-0/true`
  );
});

test('R-1: an active VEX statement or accepted ignore is P3 unless the advisory is in KEV', () => {
  assert.equal(rule({ vexActive: true, severity: 'critical' }), 'P3/R-1/true');
  assert.equal(rule({ acceptedIgnore: true, severity: 'high' }), 'P3/R-1/true');
  // KEV lifts it out of R-1: runtime + KEV + tier 1 is R-5
  assert.equal(rule({ vexActive: true, inKev: true }), 'P0/R-5/true');
});

test('R-2: build-only and dev-only findings are P3 unless KEV or malicious', () => {
  assert.equal(
    rule({ scope: 'build_only', severity: 'critical' }),
    'P3/R-2/true'
  );
  assert.equal(
    rule({ scope: 'dev_only', severity: 'critical' }),
    'P3/R-2/true'
  );
  // build-only + KEV skips R-2; R-5/R-6/R-8 need the runtime scope, so it is R-11
  assert.equal(rule({ scope: 'build_only', inKev: true }), 'P3/R-11/true');
  assert.equal(rule({ scope: 'dev_only', malicious: true }), 'P0/R-3/true');
});

test('R-3: a malicious package or a confirmed secret exposure is P0, whatever the scope', () => {
  assert.equal(
    rule({ malicious: true, scope: 'dev_only', lifecycle: 'paused' }),
    'P0/R-3/true'
  );
  assert.equal(
    rule({ secretExposureConfirmed: true, lifecycle: 'pre_cutover' }),
    'P0/R-3/true'
  );
});

test('R-4: paused and pre-cutover assets are P2 (high or critical) or P3', () => {
  assert.equal(rule({ lifecycle: 'paused', severity: 'high' }), 'P2/R-4/true');
  assert.equal(
    rule({ lifecycle: 'pre_cutover', severity: 'critical' }),
    'P2/R-4/true'
  );
  assert.equal(
    rule({ lifecycle: 'pre_cutover', severity: 'moderate' }),
    'P3/R-4/true'
  );
  // R-4 comes before R-5: a KEV advisory on a paused asset waits for the restore
  assert.equal(
    rule({ lifecycle: 'paused', inKev: true, severity: 'critical' }),
    'P2/R-4/true'
  );
});

test('R-5: runtime + (KEV or EPSS >= 0.10) + tier 1-2 is P0', () => {
  assert.equal(rule({ inKev: true }), 'P0/R-5/true');
  assert.equal(rule({ epssScore: 0.1, exposureTier: 2 }), 'P0/R-5/true');
  assert.notEqual(rule({ epssScore: 0.099, exposureTier: 2 }), 'P0/R-5/true');
  // tier 3 + KEV is not R-5; it is R-8
  assert.equal(rule({ inKev: true, exposureTier: 3 }), 'P1/R-8/true');
});

test('R-6: runtime + critical RCE, auth bypass or SQLi + tier 1 is P0', () => {
  for (const vulnClass of ['rce', 'auth_bypass', 'sqli']) {
    assert.equal(rule({ severity: 'critical', vulnClass }), 'P0/R-6/true');
  }
  // tier 2 is not R-6; critical non-DoS on tier 2 is R-8
  assert.equal(
    rule({ severity: 'critical', vulnClass: 'rce', exposureTier: 2 }),
    'P1/R-8/true'
  );
  // a critical DoS without confirmed reachability is R-10
  assert.equal(
    rule({ severity: 'critical', vulnClass: 'dos' }),
    'P2/R-10/true'
  );
});

test('R-7: a Node.js security release above the floor or the runtime is P1', () => {
  assert.equal(
    rule({ kind: 'runtime-floor', severity: 'high' }),
    'P1/R-7/true'
  );
  // on a paused asset R-4 still comes first
  assert.equal(
    rule({ kind: 'runtime-floor', severity: 'high', lifecycle: 'paused' }),
    'P2/R-4/true'
  );
});

test('R-8: runtime high or critical non-DoS on tier 1-2, KEV on tier 3, reachable DoS on tier 1 is P1', () => {
  assert.equal(rule({ severity: 'high', exposureTier: 2 }), 'P1/R-8/true');
  assert.equal(rule({ severity: 'high', exposureTier: 1 }), 'P1/R-8/true');
  assert.equal(
    rule({ inKev: true, exposureTier: 3, severity: 'low' }),
    'P1/R-8/true'
  );
  assert.equal(
    rule({
      vulnClass: 'dos',
      dosReachableUnauthenticated: true,
      severity: 'moderate',
    }),
    'P1/R-8/true'
  );
  assert.equal(
    rule({
      vulnClass: 'dos',
      dosReachableUnauthenticated: true,
      exposureTier: 2,
    }),
    'P2/R-10/true'
  );
});

test('R-9: an unexpected public endpoint is P1', () => {
  assert.equal(
    rule({ kind: 'public-endpoint', severity: 'low' }),
    'P1/R-9/true'
  );
});

test('R-10: base image EOL, DoS without confirmed reachability, high on tier 3, moderate with EPSS >= 0.02 is P2', () => {
  assert.equal(rule({ baseImageEol: true, severity: 'low' }), 'P2/R-10/true');
  assert.equal(rule({ vulnClass: 'dos', severity: 'high' }), 'P2/R-10/true');
  assert.equal(rule({ severity: 'high', exposureTier: 3 }), 'P2/R-10/true');
  assert.equal(rule({ severity: 'moderate', epssScore: 0.02 }), 'P2/R-10/true');
  assert.equal(
    rule({ severity: 'moderate', epssScore: 0.019 }),
    'P3/R-11/true'
  );
});

test('R-11: everything else is P3', () => {
  assert.equal(rule({ severity: 'low' }), 'P3/R-11/true');
  assert.equal(rule({ severity: 'moderate', exposureTier: 3 }), 'P3/R-11/true');
  assert.equal(rule({ severity: 'high', exposureTier: 4 }), 'P3/R-11/true');
  assert.equal(rule({ severity: 'high', exposureTier: null }), 'P3/R-11/true');
});

test('every rule from R-0 to R-11 has an SLA and a tier', () => {
  for (let n = 0; n <= 11; n += 1) assert.ok(SLA[`R-${n}`], `R-${n}`);
  assert.deepEqual(TIERS, ['P0', 'P1', 'P2', 'P3']);
});

// --- sorting -------------------------------------------------------------------------

test('findings sort by tier, then KEV, exposure tier, Rule 5, CVSS and EPSS (nulls last)', () => {
  const make = (id, over) => ({
    assetId: 'a',
    packageName: id,
    primaryId: id,
    version: '1.0.0',
    priority: 'P1',
    inKev: false,
    exposureTier: 2,
    rule5Boundary: false,
    cvss: 5,
    epssScore: null,
    ...over,
  });
  const rows = [
    make('e-epss-null', {}),
    make('d-epss-high', { epssScore: 0.5 }),
    make('c-cvss-9', { cvss: 9 }),
    make('b-rule5', { rule5Boundary: true }),
    make('a-tier1', { exposureTier: 1 }),
    make('z-kev', { inKev: true, exposureTier: 4 }),
    make('p2-first-by-name', { priority: 'P2', inKev: true }),
    make('p0-wins', { priority: 'P0', cvss: 1, exposureTier: 4 }),
    make('withdrawn', { priority: 'WITHDRAWN', inKev: true }),
  ];
  const sorted = [...rows].sort(compareFindings).map((r) => r.packageName);
  assert.deepEqual(sorted, [
    'p0-wins',
    'z-kev', // KEV first
    'a-tier1', // then the lower exposure tier
    'b-rule5', // then the Rule 5 boundary
    'c-cvss-9', // then CVSS desc
    'd-epss-high', // then EPSS desc ...
    'e-epss-null', // ... nulls last
    'p2-first-by-name',
    'withdrawn',
  ]);
});

// --- resolution classes --------------------------------------------------------------

const resolve = (over) =>
  classifyResolution(
    makeFinding({
      packageName: 'sentinel-pkg',
      version: '6.15.1',
      fixedVersions: ['6.16.0'],
      fixKnown: true,
      direct: false,
      parentRanges: [],
      ...over,
    })
  );

test('the classifier knows exactly the eight classes of the design', () => {
  assert.equal(RESOLUTION_CLASSES.length, 8);
  const produced = new Set([
    resolve({ withdrawn: true }).resolution,
    resolve({ fixedVersions: [] }).resolution,
    resolve({ direct: true }).resolution,
    resolve({ direct: true, pinnedByOverride: true }).resolution,
    resolve({ parentRanges: [{ parent: 'p', range: '^6.15.1' }] }).resolution,
    resolve({ parentRanges: [{ parent: 'p', range: '~6.15.1' }] }).resolution,
    resolve({ parentRanges: [{ parent: 'p', range: '6.15.1' }] }).resolution,
    resolve({ version: '0.55.0', fixedVersions: ['0.75.0'] }).resolution,
  ]);
  assert.deepEqual([...produced].sort(), [...RESOLUTION_CLASSES].sort());
});

test('classifyResolution: withdrawn, no fix, direct and pinned', () => {
  assert.equal(resolve({ withdrawn: true }).resolution, 'ADVISORY_WITHDRAWN');
  const none = resolve({ fixedVersions: [] });
  assert.equal(none.resolution, 'NO_FIX_AVAILABLE');
  assert.equal(none.confidence, 'high');
  assert.equal(
    resolve({ fixedVersions: [], fixKnown: false }).confidence,
    'low'
  );
  // a fix at or below the installed version is no fix
  assert.equal(
    resolve({ fixedVersions: ['6.15.1'] }).resolution,
    'NO_FIX_AVAILABLE'
  );
  assert.equal(resolve({ direct: true }).resolution, 'DIRECT_DEP');
  assert.equal(
    resolve({ direct: true, pinnedByOverride: true }).resolution,
    'DIRECT_PINNED_BY_OVERRIDE'
  );
});

test('classifyResolution: transitive findings follow the parents ranges', () => {
  const parents = (...ranges) =>
    ranges.map((range, i) => ({ parent: `p${i}`, range }));
  assert.deepEqual(resolve({ parentRanges: parents('^6.15.1') }), {
    resolution: 'TRANSITIVE_UNLOCKED_RANGE',
    confidence: 'high',
    fixInRange: true,
    targetVersion: '6.16.0',
  });
  assert.equal(
    resolve({ parentRanges: parents('~6.15.1') }).resolution,
    'TRANSITIVE_RANGE_BLOCKS_FIX'
  );
  assert.equal(
    resolve({ parentRanges: parents('6.15.1') }).resolution,
    'TRANSITIVE_EXACT_PIN'
  );
  // one parent permits the fix, another pins the vulnerable version
  assert.equal(
    resolve({ parentRanges: parents('^6.15.1', '6.15.1') }).resolution,
    'TRANSITIVE_EXACT_PIN'
  );
  // the root's own dependency range does not count as a parent
  assert.equal(
    resolve({ parentRanges: [{ parent: '(root)', range: '~6.15.1' }] })
      .confidence,
    'assumed'
  );
  // without ranges (pnpm) the class is assumed, and a breaking fix is still detected
  assert.equal(resolve({}).confidence, 'assumed');
  const breaking = resolve({ version: '0.55.0', fixedVersions: ['0.75.0'] });
  assert.equal(breaking.resolution, 'TRANSITIVE_BREAKING_MAJOR');
  assert.equal(breaking.fixInRange, false);
  // a fix across a major is breaking only when no same-major fix exists
  assert.equal(
    resolve({
      version: '4.1.0',
      fixedVersions: ['5.0.0', '4.9.9'],
      parentRanges: parents('^4.0.0'),
    }).resolution,
    'TRANSITIVE_UNLOCKED_RANGE'
  );
});

// --- scope ------------------------------------------------------------------------------

test('applyScope: build_only_packages win; dev_only is kept; the default is runtime', () => {
  const asset = { buildOnlyPackages: new Set(['sentinel-cli']) };
  assert.equal(
    applyScope({ packageName: 'sentinel-cli', scope: 'runtime' }, asset),
    'build_only'
  );
  assert.equal(
    applyScope({ packageName: 'other', scope: 'dev_only' }, asset),
    'dev_only'
  );
  assert.equal(
    applyScope({ packageName: 'other', scope: 'build_only' }, asset),
    'build_only'
  );
  assert.equal(applyScope({ packageName: 'other' }, asset), 'runtime');
});

// --- vulnerability class --------------------------------------------------------------------

test('classifyVulnerability reads CWEs, then the title, then the CVSS vector', () => {
  assert.equal(classifyVulnerability({ cwes: [94] }), 'rce');
  assert.equal(classifyVulnerability({ cwes: [287] }), 'auth_bypass');
  assert.equal(classifyVulnerability({ cwes: [89] }), 'sqli');
  assert.equal(classifyVulnerability({ cwes: [1333] }), 'dos');
  assert.equal(classifyVulnerability({ cwes: [79] }), 'other');
  assert.equal(
    classifyVulnerability({ title: 'Remote Code Execution in x' }),
    'rce'
  );
  assert.equal(
    classifyVulnerability({ title: 'Authentication bypass via header' }),
    'auth_bypass'
  );
  assert.equal(
    classifyVulnerability({ title: 'Denial of service in parser' }),
    'dos'
  );
  assert.equal(
    classifyVulnerability({
      vector: 'CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:N/I:N/A:H',
    }),
    'dos'
  );
  assert.equal(
    classifyVulnerability({
      vector: 'CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H',
    }),
    'other'
  );
});

test('cvss3Score matches known base scores', () => {
  assert.equal(cvss3Score('CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H'), 9.8);
  assert.equal(cvss3Score('CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:C/C:H/I:H/A:H'), 10);
  assert.equal(cvss3Score('CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:N/I:N/A:H'), 7.5);
  assert.equal(cvss3Score('CVSS:3.0/AV:L/AC:L/PR:L/UI:N/S:U/C:H/I:N/A:N'), 5.5);
  assert.equal(cvss3Score('CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:N/I:N/A:N'), 0);
  assert.equal(
    cvss3Score('CVSS:4.0/AV:N/AC:L/AT:N/PR:N/UI:N/VC:H/VI:H/VA:H'),
    null
  );
  assert.equal(cvss3Score('AV:N/AC:L'), null);
  assert.equal(severityFromScore(9.8), 'critical');
  assert.equal(severityFromScore(7.5), 'high');
  assert.equal(severityFromScore(5.5), 'moderate');
  assert.equal(severityFromScore(2), 'low');
  assert.equal(severityFromScore(0), null);
});

// --- pnpm matcher and parity with the audit gate -----------------------------------------------

function pnpmAdvisory(over = {}) {
  return {
    id: 1001,
    module_name: 'sentinel-pkg',
    severity: 'high',
    title: 'Sentinel advisory title',
    url: `https://github.com/advisories/${ADVISORY}`,
    github_advisory_id: ADVISORY,
    cves: [CVE],
    cwe: ['CWE-1333'],
    cvss: {
      score: 7.5,
      vectorString: 'CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:N/I:N/A:H',
    },
    vulnerable_versions: '<1.2.3',
    patched_versions: '>=1.2.3',
    findings: [{ version: '1.0.0', paths: ['.>sentinel-pkg'] }],
    ...over,
  };
}

test('pnpmFindings: one finding per advisory and installed version', () => {
  const advisories = [
    pnpmAdvisory({
      findings: [
        { version: '1.0.0', paths: ['.>sentinel-pkg'] },
        {
          version: '1.1.0',
          paths: ['.>parent-pkg>sentinel-pkg', '.>other>sentinel-pkg'],
        },
      ],
    }),
    pnpmAdvisory({
      id: 1002,
      module_name: 'sentinel-cli-dep',
      github_advisory_id: ADVISORY_2,
      url: `https://github.com/advisories/${ADVISORY_2}`,
      cves: [],
      patched_versions: '<0.0.0',
      findings: [
        { version: '2.0.0', paths: ['.>sentinel-cli>sentinel-cli-dep'] },
      ],
    }),
  ];
  const findings = pnpmFindings({
    advisories,
    assetId: 'monolith-web',
    overrideNames: new Set(['sentinel-pkg']),
    buildOnly: new Set(['sentinel-cli']),
  });
  assert.equal(findings.length, 3);
  const [direct, transitive, buildOnly] = findings;
  assert.equal(direct.direct, true);
  assert.equal(direct.pinnedByOverride, true);
  assert.equal(direct.version, '1.0.0');
  assert.deepEqual(direct.advisoryIds, [ADVISORY, CVE]);
  assert.equal(direct.primaryId, ADVISORY);
  assert.equal(direct.vulnClass, 'dos');
  assert.equal(direct.cvss, 7.5);
  assert.deepEqual(direct.fixedVersions, ['1.2.3']);
  assert.equal(transitive.direct, false);
  assert.equal(transitive.scope, 'runtime');
  assert.deepEqual(transitive.paths, [
    ['parent-pkg', 'sentinel-pkg'],
    ['other', 'sentinel-pkg'],
  ]);
  assert.equal(buildOnly.scope, 'build_only');
  assert.deepEqual(buildOnly.fixedVersions, []);
  assert.equal(buildOnly.fixKnown, true);
  assert.notEqual(direct.key, transitive.key);
});

test('pnpmFindings: a package is build-only only when every path runs through a build-only package', () => {
  const advisory = pnpmAdvisory({
    findings: [
      {
        version: '1.0.0',
        paths: ['.>sentinel-cli>sentinel-pkg', '.>plain-parent>sentinel-pkg'],
      },
    ],
  });
  const [finding] = pnpmFindings({
    advisories: [advisory],
    assetId: 'monolith-web',
    buildOnly: new Set(['sentinel-cli']),
  });
  assert.equal(finding.scope, 'runtime');
});

test('parity: the pipeline and audit-diff-gate.mjs count the same high and critical advisories', () => {
  const distinct = (n, over = {}) => {
    const id = `GHSA-aaaa-bbbb-c${String(n).padStart(3, '0')}`;
    return pnpmAdvisory({
      id: n,
      github_advisory_id: id,
      url: `https://github.com/advisories/${id}`,
      cves: [],
      ...over,
    });
  };
  const advisories = [
    distinct(1, { severity: 'critical' }),
    distinct(2, {
      severity: 'high',
      findings: [
        { version: '1.0.0', paths: ['.>sentinel-pkg'] },
        { version: '1.1.0', paths: ['.>a>sentinel-pkg'] },
        { version: '1.1.5', paths: ['.>b>sentinel-pkg'] },
      ],
    }),
    distinct(3, { severity: 'high' }),
    distinct(4, { severity: 'moderate' }),
    distinct(5, { severity: 'low' }),
  ];
  const report = JSON.stringify({
    advisories: Object.fromEntries(advisories.map((a) => [a.id, a])),
    metadata: { vulnerabilities: {} },
  });

  const dir = mkdtempSync(join(tmpdir(), 'pipeline-parity-'));
  try {
    const file = join(dir, 'audit.json');
    writeFileSync(file, report);
    const gate = spawnSync(
      process.execPath,
      [
        join(HERE, 'audit-diff-gate.mjs'),
        '--mode',
        'full',
        '--audit-json',
        file,
      ],
      { encoding: 'utf8', cwd: ROOT }
    );
    const match = /production dependencies: high=(\d+) critical=(\d+)/.exec(
      gate.stdout
    );
    assert.ok(
      match,
      `the gate printed its counts (exit ${gate.status}, ${gate.stdout.length} bytes)`
    );
    const gateCounts = { high: Number(match[1]), critical: Number(match[2]) };
    assert.deepEqual(gateCounts, { high: 2, critical: 1 });

    const parsed = parseAuditJson(report);
    assert.equal(parsed.kind, 'ok');
    assert.deepEqual(pnpmGateParityCounts(parsed.advisories), gateCounts);

    // the engine's own findings, regrouped by advisory, agree as well: three
    // installed versions of one advisory are one advisory for the gate
    const findings = pnpmFindings({
      advisories: parsed.advisories,
      assetId: 'monolith-web',
    });
    assert.equal(
      findings.length,
      7,
      'one finding per advisory and installed version'
    );
    const distinctBySeverity = (severity) =>
      new Set(
        findings.filter((f) => f.severity === severity).map((f) => f.primaryId)
      ).size;
    assert.deepEqual(
      {
        high: distinctBySeverity('high'),
        critical: distinctBySeverity('critical'),
      },
      gateCounts
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// --- npm matcher ----------------------------------------------------------------------------------

function lockFixture() {
  const pkg = (version, extra = {}) => ({
    version,
    resolved: 'https://registry.example/x.tgz',
    ...extra,
  });
  return {
    lockfileVersion: 3,
    packages: {
      '': {
        name: 'fixture-app',
        dependencies: {
          'app-dep': '^1.0.0',
          'build-tool': '^2.0.0',
          'direct-vuln': '^3.0.0',
        },
        devDependencies: { 'test-tool': '^1.0.0' },
      },
      'node_modules/app-dep': pkg('1.4.0', {
        dependencies: { 'sentinel-lib': '~6.15.1', shared: '^1.0.0' },
      }),
      'node_modules/sentinel-lib': pkg('6.15.1'),
      'node_modules/shared': pkg('1.0.0'),
      'node_modules/build-tool': pkg('2.1.0', {
        dependencies: { 'only-via-build': '*', shared: '^1.0.0' },
      }),
      'node_modules/only-via-build': pkg('0.5.0'),
      'node_modules/direct-vuln': pkg('3.0.1', {
        dependencies: { nested: '1.0.0' },
      }),
      'node_modules/direct-vuln/node_modules/nested': pkg('1.0.0'),
      'node_modules/nested': pkg('2.0.0'),
      'node_modules/test-tool': pkg('1.0.0', {
        dev: true,
        dependencies: { 'dev-only-dep': '*' },
      }),
      'node_modules/dev-only-dep': pkg('1.0.0', { dev: true }),
    },
  };
}

test('buildNpmGraph: installs, parents, direct dependencies and nested resolution', () => {
  const graph = buildNpmGraph(lockFixture());
  assert.equal(graph.instancesOf('sentinel-lib').length, 1);
  assert.equal(graph.instancesOf('nested').length, 2);
  assert.equal(graph.isDirect('node_modules/direct-vuln'), true);
  assert.equal(graph.isDirect('node_modules/sentinel-lib'), false);
  assert.deepEqual(graph.parents('node_modules/sentinel-lib'), [
    { parent: 'app-dep', range: '~6.15.1' },
  ]);
  // `direct-vuln` needs nested@1.0.0: it resolves to its own nested copy, not the hoisted 2.0.0
  assert.deepEqual(
    graph.parents('node_modules/direct-vuln/node_modules/nested'),
    [{ parent: 'direct-vuln', range: '1.0.0' }]
  );
  assert.deepEqual(graph.parents('node_modules/nested'), []);
  assert.ok(graph.packageKeys().has('sentinel-lib@6.15.1'));
  assert.equal(buildNpmGraph({}), null);
  assert.equal(buildNpmGraph(null), null);
});

test('buildNpmGraph.scopeOf: runtime, build-only through a build-only parent, and dev', () => {
  const graph = buildNpmGraph(lockFixture());
  const buildOnly = new Set(['build-tool']);
  assert.equal(
    graph.scopeOf('node_modules/sentinel-lib', buildOnly),
    'runtime'
  );
  assert.equal(
    graph.scopeOf('node_modules/build-tool', buildOnly),
    'build_only'
  );
  assert.equal(
    graph.scopeOf('node_modules/only-via-build', buildOnly),
    'build_only'
  );
  // reachable both through the build-only package and through app-dep
  assert.equal(graph.scopeOf('node_modules/shared', buildOnly), 'runtime');
  assert.equal(
    graph.scopeOf('node_modules/dev-only-dep', buildOnly),
    'dev_only'
  );
  // without a build-only list everything production-reachable is runtime
  assert.equal(
    graph.scopeOf('node_modules/only-via-build', new Set()),
    'runtime'
  );
});

function npmReport() {
  const via = (over) => ({
    source: 5001,
    name: 'sentinel-lib',
    dependency: 'sentinel-lib',
    title: 'Sentinel advisory title',
    url: `https://github.com/advisories/${ADVISORY}`,
    severity: 'high',
    cwe: ['CWE-755'],
    cvss: {
      score: 7.5,
      vectorString: 'CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:N/I:N/A:H',
    },
    range: '>=6.0.0 <6.16.0',
    ...over,
  });
  return {
    auditReportVersion: 2,
    vulnerabilities: {
      'sentinel-lib': {
        name: 'sentinel-lib',
        severity: 'high',
        isDirect: false,
        via: [via()],
        effects: ['app-dep'],
        range: '>=6.0.0 <6.16.0',
        nodes: ['node_modules/sentinel-lib'],
        fixAvailable: true,
      },
      'app-dep': {
        name: 'app-dep',
        severity: 'high',
        isDirect: true,
        via: ['sentinel-lib'],
        effects: [],
        range: '*',
        nodes: ['node_modules/app-dep'],
        fixAvailable: false,
      },
      'only-via-build': {
        name: 'only-via-build',
        severity: 'moderate',
        isDirect: false,
        via: [
          via({
            source: 5002,
            name: 'only-via-build',
            url: `https://github.com/advisories/${ADVISORY_2}`,
            severity: 'moderate',
            range: '<=0.5.0',
            cwe: [],
            cvss: { score: 0 },
          }),
        ],
        effects: [],
        range: '<=0.5.0',
        nodes: ['node_modules/only-via-build'],
        fixAvailable: false,
      },
    },
    metadata: {
      vulnerabilities: {
        info: 0,
        low: 0,
        moderate: 1,
        high: 2,
        critical: 0,
        total: 3,
      },
    },
  };
}

test('npmFindings: installed versions, scope, parents and fixes come from the lockfile graph', () => {
  const graph = buildNpmGraph(lockFixture());
  const findings = npmFindings({
    report: npmReport(),
    graph,
    assetId: 'money-service',
    buildOnly: new Set(['build-tool']),
  });
  assert.equal(findings.length, 2, 'string via entries are not advisories');
  const lib = findings.find((f) => f.packageName === 'sentinel-lib');
  assert.equal(lib.version, '6.15.1');
  assert.deepEqual(lib.advisoryIds, [ADVISORY]);
  assert.equal(lib.severity, 'high');
  assert.equal(lib.vulnClass, 'dos');
  assert.deepEqual(lib.fixedVersions, ['6.16.0']);
  assert.deepEqual(lib.parentRanges, [{ parent: 'app-dep', range: '~6.15.1' }]);
  assert.equal(lib.scope, 'runtime');
  assert.equal(
    classifyResolution(lib).resolution,
    'TRANSITIVE_RANGE_BLOCKS_FIX'
  );
  const build = findings.find((f) => f.packageName === 'only-via-build');
  assert.equal(build.scope, 'build_only');
  assert.equal(build.cvss, null, 'a zero score is no score');
  assert.deepEqual(
    build.fixedVersions,
    ['0.5.1'],
    '<=0.5.0 is fixed at the next patch (approximate)'
  );
});

test('npmFindings without a lockfile still reports the advisory, version unknown', () => {
  const findings = npmFindings({
    report: npmReport(),
    graph: null,
    assetId: 'money-service',
  });
  assert.equal(findings.length, 2);
  assert.equal(findings[0].version, null);
});

test('parseNpmAuditJson: ok, unavailable and invalid', () => {
  assert.equal(parseNpmAuditJson(JSON.stringify(npmReport())).kind, 'ok');
  assert.equal(parseNpmAuditJson('').kind, 'unavailable');
  assert.equal(
    parseNpmAuditJson(
      JSON.stringify({ message: 'request failed', error: { summary: '' } })
    ).kind,
    'unavailable'
  );
  assert.equal(parseNpmAuditJson('<html>').kind, 'invalid');
  assert.equal(parseNpmAuditJson('[]').kind, 'invalid');
  assert.equal(parseNpmAuditJson('{"x":1}').kind, 'invalid');
});

// --- Python ----------------------------------------------------------------------------------------

test('parseRequirements: pinned and unpinned entries, comments, extras, markers and options', () => {
  const parsed = parseRequirements(
    [
      '# a comment',
      '--extra-index-url https://example.invalid/simple',
      '-r other.txt',
      'Flask==3.0.0',
      'PyYAML==6.0.2  # inline comment',
      'Typing_Extensions==4.12.2 ; python_version < "3.13"',
      'requests[socks]==2.31.0',
      'pandas>=2.0',
      'numpy',
      'pinned-with-hash==1.0.0 \\',
      '    --hash=sha256:abc',
      'wildcard==1.*',
      'git+https://example.invalid/repo.git',
      'pydantic>=2.12.0  # runtime validation',
    ].join('\n')
  );
  assert.deepEqual(parsed.pinned, [
    { name: 'flask', version: '3.0.0' },
    { name: 'pyyaml', version: '6.0.2' },
    { name: 'typing-extensions', version: '4.12.2' },
    { name: 'requests', version: '2.31.0' },
    { name: 'pinned-with-hash', version: '1.0.0' },
  ]);
  assert.deepEqual(parsed.unpinned, [
    { name: 'pandas', spec: '>=2.0' },
    { name: 'numpy', spec: '(any)' },
    { name: 'wildcard', spec: '==1.*' },
    { name: 'pydantic', spec: '>=2.12.0' },
  ]);
  assert.equal(parsed.skipped, 3);
  assert.equal(isPipDevTool('pytest-cov'), true);
  assert.equal(isPipDevTool('flask'), false);
});

test('the real requirements files of the inventory parse', () => {
  const inventory = loadInventory(INVENTORY_TEXT);
  let pinned = 0;
  for (const asset of inventory.assets) {
    for (const eco of asset.ecosystems.filter((e) => e.type === 'pip')) {
      const parsed = parseRequirements(
        readFileSync(join(ROOT, eco.manifestPath), 'utf8')
      );
      pinned += parsed.pinned.length;
      if (eco.pinningRequired)
        assert.ok(parsed.unpinned.length > 0, 'pinning_required has a reason');
    }
  }
  assert.ok(pinned > 20);
});

// --- policy ----------------------------------------------------------------------------------------

test('loadInventory reads the real inventory', () => {
  const inventory = loadInventory(INVENTORY_TEXT);
  assert.equal(inventory.schemaVersion, '3.0');
  assert.equal(inventory.toolchain.pnpmVersion, '10.34.9');
  assert.deepEqual(Object.keys(inventory.toolchain.nodeFloors).sort(), [
    '22',
    '24',
  ]);
  const money = inventory.assets.find((a) => a.id === 'money-service');
  assert.equal(money.exposureTier, 1);
  assert.equal(money.escalationRequired, true);
  assert.ok(money.buildOnlyPackages.has('prisma'));
  assert.equal(
    money.ecosystems[0].lockfilePath,
    'money-service/package-lock.json'
  );
  assert.equal(
    inventory.assets.find((a) => a.id === 'chat-server').lifecycle,
    'paused'
  );
  assert.equal(inventory.excludedPaths.length, 5);
});

test('normalizeInventory fails loudly on a broken policy file', () => {
  const ok = {
    schema_version: '3.0',
    toolchain_pins: { node_runtime_floors: { v24_min_patch: '24.22.3' } },
    assets: [{ id: 'a', lifecycle: 'production' }],
  };
  assert.equal(normalizeInventory(ok).assets.length, 1);
  const cases = {
    inventory_not_a_mapping: null,
    inventory_schema_version: { ...ok, schema_version: '2.0' },
    inventory_node_floor: {
      ...ok,
      toolchain_pins: { node_runtime_floors: {} },
    },
    inventory_no_assets: { ...ok, assets: [] },
    inventory_asset_lifecycle: {
      ...ok,
      assets: [{ id: 'a', lifecycle: 'live' }],
    },
    inventory_asset_id: { ...ok, assets: [{ lifecycle: 'production' }] },
    inventory_duplicate_asset: {
      ...ok,
      assets: [
        { id: 'a', lifecycle: 'production' },
        { id: 'a', lifecycle: 'paused' },
      ],
    },
  };
  for (const [code, doc] of Object.entries(cases)) {
    assert.throws(
      () => normalizeInventory(doc),
      (error) => error instanceof PolicyError && error.message === code,
      code
    );
  }
  assert.throws(() => loadInventory('a: [1, 2'), {
    message: 'inventory_unreadable',
  });
});

test('normalizeInventory carries the Phase 3 fields: host names, drift check, covered manifests, scope', () => {
  const doc = (ecosystems, extra = {}) => ({
    schema_version: '3.0',
    toolchain_pins: { node_runtime_floors: { v24_min_patch: '24.22.3' } },
    assets: [
      {
        id: 'a',
        lifecycle: 'paused',
        public_hostnames: ['a.example.test', 7, null],
        drift_check: 'scripts/x.sh',
        ecosystems,
        ...extra,
      },
    ],
  });
  const [asset] = normalizeInventory(
    doc([
      {
        type: 'npm',
        manifest_path: 'a/package.json',
        lockfile_path: 'a/package-lock.json',
        nixpacks_path: 'a/nixpacks.toml',
        compose_path: 'a/compose.yml',
      },
      {
        type: 'npm',
        manifest_path: 'a/sub/package.json',
        covered_by_lockfile: 'a/package-lock.json',
      },
      {
        type: 'pip',
        manifest_path: 'a/requirements-dev.txt',
        scope: 'development',
      },
    ])
  ).assets;
  assert.deepEqual(asset.publicHostnames, ['a.example.test']);
  assert.equal(asset.driftCheckPath, 'scripts/x.sh');
  assert.equal(asset.ecosystems[0].nixpacksPath, 'a/nixpacks.toml');
  assert.equal(asset.ecosystems[0].composePath, 'a/compose.yml');
  assert.equal(asset.ecosystems[0].scope, null);
  assert.equal(asset.ecosystems[0].coveredByLockfile, null);
  assert.equal(asset.ecosystems[1].coveredByLockfile, 'a/package-lock.json');
  assert.equal(asset.ecosystems[2].scope, 'development');
  // a field that is absent is empty, not undefined
  const [bare] = normalizeInventory({
    schema_version: '3.0',
    toolchain_pins: { node_runtime_floors: { v24_min_patch: '24.22.3' } },
    assets: [{ id: 'b', lifecycle: 'production' }],
  }).assets;
  assert.deepEqual(bare.publicHostnames, []);
  assert.equal(bare.driftCheckPath, null);
  // a typo must not turn a runtime manifest into a development one
  for (const scope of ['dev', 'Development', 5]) {
    assert.throws(
      () =>
        normalizeInventory(
          doc([{ type: 'pip', manifest_path: 'a/r.txt', scope }])
        ),
      (error) =>
        error instanceof PolicyError &&
        error.message === 'inventory_ecosystem_scope',
      String(scope)
    );
  }
});

test('the real inventory closes the two coverage gaps of Phase 2 and names the restore gate', () => {
  const inventory = loadInventory(INVENTORY_TEXT);
  const asset = (id) => inventory.assets.find((a) => a.id === id);
  const eco = (id, path) =>
    asset(id).ecosystems.find((e) => e.manifestPath === path);
  // a development-only manifest of the (unconfirmed) Flask service
  assert.equal(
    eco('mt5-service-legacy', 'mt5-service/requirements-dev.txt').scope,
    'development'
  );
  // a file: dependency of operation-service, resolved in the service lockfile
  assert.equal(
    eco('operation-service', 'operation-service/packages/types/package.json')
      .coveredByLockfile,
    'operation-service/package-lock.json'
  );
  // a paused asset: its name must not resolve, and the drift check is its restore gate
  assert.deepEqual(asset('chat-server').publicHostnames, [
    'chat-api.davintrade.app',
  ]);
  assert.equal(
    asset('chat-server').driftCheckPath,
    'scripts/security/check-vps-drift.sh'
  );
  // Dependabot alerts on those manifests now map to their assets
  const alert = (manifestPath, scope) => ({
    ghsa: ADVISORY,
    cve: null,
    packageName: 'x',
    ecosystem: 'pip',
    manifestPath,
    scope,
  });
  const result = reconcileDependabot({
    alerts: [
      alert('mt5-service/requirements-dev.txt', 'development'),
      alert('operation-service/packages/types/package.json', 'runtime'),
    ],
    findings: [],
    inventory,
  });
  assert.equal(result.unmapped, 0);
  assert.deepEqual(result.unmappedManifests, []);
  assert.equal(result.development, 1, 'the development alert is set aside');
  assert.equal(result.compared, 1, 'the runtime alert is compared');
});

// --- build hygiene: development dependencies installed at build time ------------------------------

test('parseNixpacksBuildEnv reads NPM_CONFIG_PRODUCTION from the [variables] table only', () => {
  const parse = parseNixpacksBuildEnv;
  const yes = { npmConfigProduction: 'false', installsDevDependencies: true };
  assert.deepEqual(
    parse('[variables]\nNPM_CONFIG_PRODUCTION = "false"\n'),
    yes
  );
  assert.deepEqual(
    parse("[variables]\nNPM_CONFIG_PRODUCTION = 'false' # dev\n"),
    yes
  );
  assert.deepEqual(parse('[variables]\nNPM_CONFIG_PRODUCTION = false\n'), yes);
  assert.deepEqual(
    parse('[variables]\r\n"NPM_CONFIG_PRODUCTION" = "false"\r\n'),
    yes
  );
  assert.deepEqual(
    parse(
      '[phases.setup]\nnixPkgs = ["..."]\n\n[variables]\nOTHER = "1"\nNPM_CONFIG_PRODUCTION="false"\n'
    ),
    yes
  );
  const no = { npmConfigProduction: 'true', installsDevDependencies: false };
  assert.deepEqual(parse('[variables]\nNPM_CONFIG_PRODUCTION = "true"\n'), no);
  const none = { npmConfigProduction: null, installsDevDependencies: false };
  assert.deepEqual(parse(''), none);
  assert.deepEqual(parse(null), none);
  assert.deepEqual(parse('[variables]\nNODE_ENV = "production"\n'), none);
  // a comment, or the key in another table, does not count
  assert.deepEqual(
    parse('# NPM_CONFIG_PRODUCTION = "false"\n[variables]\n'),
    none
  );
  assert.deepEqual(
    parse('[phases.install]\nNPM_CONFIG_PRODUCTION = "false"\n'),
    none
  );
});

test('the nixpacks files of the two services that install development dependencies say so', () => {
  const inventory = loadInventory(INVENTORY_TEXT);
  const withFile = inventory.assets.flatMap((a) =>
    a.ecosystems
      .filter((e) => e.nixpacksPath)
      .map((e) => ({ id: a.id, path: e.nixpacksPath }))
  );
  assert.deepEqual(withFile.map((w) => w.id).sort(), [
    'operation-service',
    'railway-gateway',
  ]);
  for (const { path } of withFile) {
    assert.equal(
      parseNixpacksBuildEnv(readFileSync(join(ROOT, path), 'utf8'))
        .installsDevDependencies,
      true,
      path
    );
  }
});

test('buildHygieneFindings keeps the high and critical advisories found only in development dependencies, as build_only', () => {
  const lock = {
    lockfileVersion: 3,
    packages: {
      '': { dependencies: { 'prod-dep': '^1.0.0' } },
      'node_modules/prod-dep': { version: '1.0.0' },
      'node_modules/dev-high': { version: '2.0.0', dev: true },
      'node_modules/dev-crit': { version: '3.0.0', dev: true },
      'node_modules/dev-mod': { version: '4.0.0', dev: true },
      'node_modules/dev-low': { version: '5.0.0', dev: true },
    },
  };
  const via = (name, source, severity) => ({
    source,
    name,
    title: `Sentinel ${name}`,
    url: `https://github.com/advisories/GHSA-${name
      .replace(/[^a-z]/g, '')
      .slice(0, 4)
      .padEnd(4, 'x')}-aaaa-bbbb`,
    severity,
    cwe: ['CWE-79'],
    range: '<9.0.0',
  });
  const entry = (name, source, severity) => ({
    name,
    severity,
    isDirect: false,
    via: [via(name, source, severity)],
    nodes: [`node_modules/${name}`],
  });
  const report = {
    vulnerabilities: {
      'prod-dep': entry('prod-dep', 1, 'high'),
      'dev-high': entry('dev-high', 2, 'high'),
      'dev-crit': entry('dev-crit', 3, 'critical'),
      'dev-mod': entry('dev-mod', 4, 'moderate'),
      'dev-low': entry('dev-low', 5, 'low'),
    },
  };
  const found = buildHygieneFindings({
    report,
    graph: buildNpmGraph(lock),
    assetId: 'svc-a',
  });
  assert.deepEqual(found.map((f) => f.packageName).sort(), [
    'dev-crit',
    'dev-high',
  ]);
  for (const f of found) {
    assert.equal(f.scope, 'build_only');
    assert.equal(f.source, 'npm-audit-dev');
    assert.equal(f.buildHygiene, true);
    assert.equal(f.assetId, 'svc-a');
    assert.match(f.key, /^[0-9a-f]{16}$/);
  }
  // the engine sends them to P3 (R-2): present in the report, never a page
  const asset = {
    id: 'svc-a',
    lifecycle: 'production',
    exposureTier: 1,
    escalationRequired: true,
    buildOnlyPackages: new Set(),
  };
  const context = {
    today: '2026-11-22',
    vexStatements: [],
    vexMatches: vexStatementMatches,
    vexExpiry: vexExpiryReasons,
  };
  for (const f of found) {
    const scored = scoreFinding(f, asset, context);
    assert.equal(scored.priority, 'P3');
    assert.equal(scored.rule, 'R-2');
  }
  // the key differs from the key the same advisory would get as a regular finding
  const regular = npmFindings({
    report,
    graph: buildNpmGraph(lock),
    assetId: 'svc-a',
  }).find((f) => f.packageName === 'dev-high');
  assert.notEqual(
    found.find((f) => f.packageName === 'dev-high').key,
    regular.key
  );
  // no repeats: the same advisory reached twice is one finding
  const twice = buildHygieneFindings({
    report: {
      vulnerabilities: {
        ...report.vulnerabilities,
        again: entry('dev-high', 2, 'high'),
      },
    },
    graph: buildNpmGraph(lock),
    assetId: 'svc-a',
  });
  assert.equal(twice.filter((f) => f.packageName === 'dev-high').length, 1);
});

test('isExcludedPath: directory globs match whole directories only', () => {
  const patterns = ['seed-code/**', 'archive/**'];
  assert.equal(isExcludedPath('seed-code/txtai/package.json', patterns), true);
  assert.equal(isExcludedPath('./seed-code/x', patterns), true);
  assert.equal(isExcludedPath('seed-codex/package.json', patterns), false);
  assert.equal(isExcludedPath('money-service/package.json', patterns), false);
  assert.equal(
    isExcludedPath('seed-code/../money-service/package.json', patterns),
    false
  );
  assert.equal(isExcludedPath('', patterns), false);
});

// --- VEX -----------------------------------------------------------------------------------------------

const statement = (over = {}) => ({
  advisory_id: ADVISORY,
  asset_id: 'money-service',
  package_spec: 'sentinel-pkg@1.2.3',
  status: 'not_affected',
  justification: 'vulnerable_code_not_present',
  impact_statement: 'The vulnerable function is never called.',
  created_at: '2026-11-01',
  review_after: '2027-01-15',
  expires_when: { when_advisory_withdrawn: true, when_in_cisa_kev: true },
  ...over,
});
const registry = (statements) => ({
  schema_version: '1.0',
  updated_at: '2026-11-21',
  readme: 'fixture',
  statements,
});
const ASSET_IDS = new Set(['money-service', 'monolith-web']);

test('mergeVexRegistries merges the public registry and the private overlay', () => {
  const merged = mergeVexRegistries({
    publicRegistry: registry([]),
    privateRegistry: registry([statement()]),
    assetIds: ASSET_IDS,
    today: '2026-11-21',
  });
  assert.equal(merged.statements.length, 1);
  assert.equal(merged.statements[0].source, 'private');
  assert.equal(merged.status.private.count, 1);
  assert.equal(merged.status.public.count, 0);
  assert.equal(merged.status.private.valid, true);
});

test('mergeVexRegistries ignores an invalid file (more findings, never fewer) and reports codes', () => {
  const merged = mergeVexRegistries({
    publicRegistry: registry([]),
    privateRegistry: registry([
      statement({ status: 'affected' }),
      statement({ asset_id: 'nope' }),
    ]),
    assetIds: ASSET_IDS,
    today: '2026-11-21',
  });
  assert.equal(merged.statements.length, 0);
  assert.equal(merged.status.private.valid, false);
  assert.ok(merged.status.private.errors.includes('#1:status'));
  assert.ok(merged.status.private.errors.includes('#2:unknown_asset'));
  // an absent overlay is not an error
  const absent = mergeVexRegistries({
    publicRegistry: registry([]),
    assetIds: ASSET_IDS,
    today: '2026-11-21',
  });
  assert.equal(absent.status.private.present, false);
  assert.equal(absent.status.private.valid, true);
  // a statement refused by the validator never suppresses a malicious package
  const mal = mergeVexRegistries({
    publicRegistry: registry([]),
    privateRegistry: registry([statement({ advisory_id: 'MAL-2099-0001' })]),
    assetIds: ASSET_IDS,
    today: '2026-11-21',
  });
  assert.equal(mal.statements.length, 0);
});

test('mergeVexRegistries keeps the first of two statements with the same compound key', () => {
  const merged = mergeVexRegistries({
    publicRegistry: registry([statement({ impact_statement: 'public one' })]),
    privateRegistry: registry([statement({ impact_statement: 'private one' })]),
    assetIds: ASSET_IDS,
    today: '2026-11-21',
  });
  assert.equal(merged.statements.length, 1);
  assert.equal(merged.statements[0].source, 'public');
});

const vexFinding = (over = {}) => ({
  assetId: 'money-service',
  packageName: 'sentinel-pkg',
  version: '1.2.3',
  advisoryIds: [ADVISORY, CVE],
  scope: 'runtime',
  withdrawn: false,
  inKev: false,
  fixInRange: false,
  ...over,
});

test('vexStatementMatches: advisory alias, asset, package spec and scope', () => {
  const s = statement();
  assert.equal(vexStatementMatches(s, vexFinding()), true);
  assert.equal(
    vexStatementMatches(statement({ advisory_id: CVE }), vexFinding()),
    true
  );
  assert.equal(
    vexStatementMatches(
      s,
      vexFinding({ advisoryIds: [ADVISORY.toUpperCase()] })
    ),
    true
  );
  assert.equal(
    vexStatementMatches(s, vexFinding({ assetId: 'monolith-web' })),
    false
  );
  assert.equal(
    vexStatementMatches(s, vexFinding({ packageName: 'other' })),
    false
  );
  assert.equal(vexStatementMatches(s, vexFinding({ version: '1.2.4' })), false);
  assert.equal(
    vexStatementMatches(
      statement({ package_spec: 'sentinel-pkg@*' }),
      vexFinding({ version: '9.9.9' })
    ),
    true
  );
  assert.equal(
    vexStatementMatches(
      statement({ package_spec: 'sentinel-pkg@^1.2.0' }),
      vexFinding({ version: '1.9.0' })
    ),
    true
  );
  assert.equal(
    vexStatementMatches(
      statement({ package_spec: '@scope/pkg@1.0.0' }),
      vexFinding({ packageName: '@scope/pkg', version: '1.0.0' })
    ),
    true
  );
  assert.equal(
    vexStatementMatches(statement({ scope: 'build_only' }), vexFinding()),
    false
  );
  assert.equal(
    vexStatementMatches(statement({ scope: 'runtime' }), vexFinding()),
    true
  );
});

test('vexExpiryReasons: review date, withdrawal, fix in range, KEV and a fixed statement', () => {
  const today = '2026-11-21';
  assert.deepEqual(vexExpiryReasons(statement(), vexFinding(), { today }), []);
  assert.deepEqual(
    vexExpiryReasons(
      statement({ review_after: '2026-11-20', created_at: '2026-06-01' }),
      vexFinding(),
      { today }
    ),
    ['review_expired']
  );
  assert.deepEqual(
    vexExpiryReasons(statement(), vexFinding({ withdrawn: true }), { today }),
    ['advisory_withdrawn']
  );
  assert.deepEqual(
    vexExpiryReasons(statement(), vexFinding({ inKev: true }), { today }),
    ['in_cisa_kev']
  );
  assert.deepEqual(
    vexExpiryReasons(statement(), vexFinding({ fixInRange: true }), { today }),
    []
  );
  assert.deepEqual(
    vexExpiryReasons(
      statement({ expires_when: { when_fix_available_in_range: true } }),
      vexFinding({ fixInRange: true }),
      { today }
    ),
    ['fix_available_in_range']
  );
  const fixed = statement({
    status: 'fixed',
    justification: undefined,
    fixed_in: '1.2.3',
  });
  assert.deepEqual(
    vexExpiryReasons(fixed, vexFinding({ version: '1.2.3' }), { today }),
    []
  );
  assert.deepEqual(
    vexExpiryReasons(fixed, vexFinding({ version: '1.2.0' }), { today }),
    ['not_yet_fixed']
  );
});

test('staleVexStatements: a statement whose package left the lockfile', () => {
  const stale = statement({
    expires_when: { when_package_absent_from_lockfile: 'sentinel-pkg@1.2.3' },
  });
  const fresh = statement({
    advisory_id: ADVISORY_2,
    expires_when: { when_package_absent_from_lockfile: 'sentinel-pkg@1.2.3' },
  });
  const noTrigger = statement({ advisory_id: CVE });
  const keys = { 'money-service': new Set(['sentinel-pkg@1.2.3']) };
  assert.deepEqual(
    staleVexStatements([fresh, noTrigger], (id) => keys[id] ?? null),
    []
  );
  assert.deepEqual(
    staleVexStatements([stale], () => new Set(['other@1.0.0'])),
    [stale]
  );
  assert.deepEqual(
    staleVexStatements([stale], () => null),
    [],
    'unknown lockfile: not judged'
  );
  const ranged = statement({
    expires_when: { when_package_absent_from_lockfile: 'sentinel-pkg@^1.0.0' },
  });
  assert.deepEqual(
    staleVexStatements([ranged], () => new Set(['sentinel-pkg@1.4.0'])),
    []
  );
  assert.deepEqual(
    staleVexStatements([ranged], () => new Set(['sentinel-pkg@2.0.0'])),
    [ranged]
  );
});

// --- scoring a finding end to end ------------------------------------------------------------------------

const ASSET = {
  id: 'money-service',
  lifecycle: 'production',
  exposureTier: 1,
  escalationRequired: true,
  buildOnlyPackages: new Set(['sentinel-cli']),
};
const ctx = (statements = []) => ({
  today: '2026-11-21',
  vexStatements: statements,
  vexMatches: vexStatementMatches,
  vexExpiry: vexExpiryReasons,
});

test('scoreFinding: scope, class, Rule 5, VEX and the matrix come together', () => {
  const finding = makeFinding({
    assetId: 'money-service',
    packageName: 'sentinel-pkg',
    version: '1.2.3',
    advisoryIds: [ADVISORY],
    severity: 'high',
    fixedVersions: ['1.2.4'],
    fixKnown: true,
    direct: true,
  });
  const scored = scoreFinding(finding, ASSET, ctx());
  assert.equal(scored.priority, 'P1');
  assert.equal(scored.rule, 'R-8');
  assert.equal(scored.resolution, 'DIRECT_DEP');
  assert.equal(scored.rule5Boundary, true);
  assert.equal(scored.exposureTier, 1);

  const vex = scoreFinding(
    finding,
    ASSET,
    ctx([{ ...statement(), source: 'private' }])
  );
  assert.equal(vex.priority, 'P3');
  assert.equal(vex.rule, 'R-1');
  assert.equal(vex.vexSource, 'private');

  const lifted = scoreFinding(
    { ...finding, inKev: true },
    ASSET,
    ctx([{ ...statement(), source: 'private' }])
  );
  assert.equal(lifted.priority, 'P0');
  assert.equal(lifted.vexActive, false);
  assert.deepEqual(lifted.vexExpired, ['in_cisa_kev']);

  const buildOnly = scoreFinding(
    { ...finding, packageName: 'sentinel-cli' },
    ASSET,
    ctx()
  );
  assert.equal(buildOnly.scope, 'build_only');
  assert.equal(buildOnly.priority, 'P3');
});

test('scoreFinding: an accepted ignore is P3 until the advisory is withdrawn or enters KEV', () => {
  const ignored = makeFinding({
    assetId: 'monolith-web',
    packageName: 'sentinel-pkg',
    version: '1.0.0',
    advisoryIds: [ADVISORY],
    severity: 'high',
    acceptedIgnore: true,
  });
  const asset = { ...ASSET, id: 'monolith-web' };
  assert.equal(scoreFinding(ignored, asset, ctx()).priority, 'P3');
  assert.equal(scoreFinding(ignored, asset, ctx()).vexSource, 'pnpm-ignore');
  assert.equal(
    scoreFinding({ ...ignored, withdrawn: true }, asset, ctx()).priority,
    'WITHDRAWN'
  );
  assert.equal(
    scoreFinding({ ...ignored, inKev: true }, asset, ctx()).priority,
    'P0'
  );
});

test('scoreFinding: a malicious package is never suppressed by a VEX statement for an alias', () => {
  const malicious = makeFinding({
    assetId: 'money-service',
    packageName: 'sentinel-pkg',
    version: '1.2.3',
    advisoryIds: ['MAL-2099-0001', ADVISORY],
    severity: 'critical',
    malicious: true,
  });
  const scored = scoreFinding(
    malicious,
    ASSET,
    ctx([{ ...statement(), source: 'private' }])
  );
  assert.equal(scored.priority, 'P0');
  assert.equal(scored.rule, 'R-3');
  assert.equal(scored.vexActive, false);
});

test('summarizeFindings counts tiers per asset', () => {
  const summary = summarizeFindings([
    {
      priority: 'P0',
      assetId: 'a',
      inKev: true,
      malicious: false,
      escalation: true,
    },
    { priority: 'P1', assetId: 'a' },
    { priority: 'P3', assetId: 'b', malicious: true },
    { priority: 'WITHDRAWN', assetId: 'b' },
  ]);
  assert.deepEqual(summary.tiers, { P0: 1, P1: 1, P2: 0, P3: 1, WITHDRAWN: 1 });
  assert.deepEqual(summary.byAsset.a, {
    P0: 1,
    P1: 1,
    P2: 0,
    P3: 0,
    WITHDRAWN: 0,
  });
  assert.equal(summary.total, 4);
  assert.equal(summary.kev, 1);
  assert.equal(summary.malicious, 1);
  assert.equal(summary.escalations, 1);
});

// --- Node runtime floors -----------------------------------------------------------------------------------------

const NODE_INDEX = [
  { version: 'v24.23.0', date: '2026-11-18', security: false },
  { version: 'v24.22.3', date: '2026-11-11', security: true },
  { version: 'v24.22.1', date: '2026-10-20', security: false },
  { version: 'v22.23.5', date: '2026-11-11', security: true },
  { version: 'v22.23.6', date: '2026-11-19', security: false },
  { version: 'v20.99.0', date: '2026-05-01', security: true },
  { version: 'garbage', security: true },
];

test('reduceNodeIndex keeps the latest and the latest security release per line', () => {
  assert.deepEqual(reduceNodeIndex(NODE_INDEX)['24'], {
    latest: '24.23.0',
    latestSecurity: '24.22.3',
    latestSecurityDate: '2026-11-11',
  });
  assert.equal(reduceNodeIndex(NODE_INDEX)['22'].latest, '22.23.6');
  assert.deepEqual(reduceNodeIndex('nope'), {});
});

test('evaluateRuntimeFloors compares floors, security releases and the runtimes in runtime-state', () => {
  const inventory = loadInventory(INVENTORY_TEXT);
  const nodeLines = reduceNodeIndex(NODE_INDEX);
  const runtimeState = {
    assets: {
      'money-service': {
        node: '24.10.0',
        verified: false,
        note: 'derived from the pinned package set',
      },
      'operation-service': { node: '24.22.3', verified: true },
      'railway-gateway': { node: '24.22.2', verified: true },
    },
  };
  const result = evaluateRuntimeFloors({
    inventory,
    nodeLines,
    runtimeState,
    runnerVersion: '24.22.1',
  });
  const status = Object.fromEntries(
    result.assets.map((a) => [a.assetId, a.status])
  );
  assert.equal(status['money-service'], 'below_floor');
  assert.equal(status['operation-service'], 'ok');
  assert.equal(status['railway-gateway'], 'below_floor');
  assert.equal(status['monolith-web'], 'unverified');
  assert.deepEqual(result.counts, {
    ok: 1,
    below_floor: 2,
    behind_latest_security: 0,
    unverified: 1,
    unknown_line: 0,
  });
  assert.equal(result.floors.find((f) => f.major === 24).floorBehind, false);
  assert.equal(result.runner.below_floor, true);
  assert.equal(result.findings.length, 2);
  for (const finding of result.findings) {
    assert.equal(finding.kind, 'runtime-floor');
    assert.equal(
      evaluatePriority({ ...BASE, ...finding, lifecycle: 'production' }).rule,
      'R-7'
    );
  }
});

test('evaluateRuntimeFloors: a new security release above the floor puts the floor itself behind', () => {
  const inventory = loadInventory(INVENTORY_TEXT);
  const nodeLines = reduceNodeIndex([
    ...NODE_INDEX,
    { version: 'v24.23.1', date: '2026-11-21', security: true },
  ]);
  const runtimeState = {
    assets: { 'operation-service': { node: '24.22.3', verified: true } },
  };
  const result = evaluateRuntimeFloors({ inventory, nodeLines, runtimeState });
  assert.equal(result.floors.find((f) => f.major === 24).floorBehind, true);
  assert.equal(
    result.assets.find((a) => a.assetId === 'operation-service').status,
    'behind_latest_security'
  );
  const kinds = result.findings.map((f) => f.assetId).sort();
  assert.deepEqual(kinds, ['inventory', 'operation-service']);
});

test('evaluateRuntimeFloors without a feed or runtime state reports unverified, no findings', () => {
  const inventory = loadInventory(INVENTORY_TEXT);
  const result = evaluateRuntimeFloors({ inventory, nodeLines: null });
  assert.equal(result.findings.length, 0);
  assert.equal(result.counts.unverified, 4);
  assert.equal(
    result.floors.every((f) => f.feedKnown === false),
    true
  );
});

// --- Dependabot reconciliation -----------------------------------------------------------------------------------------

test('reconcileDependabot: agreement, one-sided findings, excluded paths, unmapped manifests, development scope', () => {
  const inventory = loadInventory(INVENTORY_TEXT);
  const alert = (over) => ({
    ghsa: ADVISORY,
    cve: null,
    packageName: 'sentinel-pkg',
    manifestPath: 'money-service/package-lock.json',
    scope: 'runtime',
    ...over,
  });
  const finding = (over) =>
    makeFinding({
      assetId: 'money-service',
      packageName: 'sentinel-pkg',
      version: '1.0.0',
      advisoryIds: [ADVISORY, CVE],
      ...over,
    });
  const result = reconcileDependabot({
    inventory,
    alerts: [
      alert({}), // agrees
      alert({ ghsa: ADVISORY_2, packageName: 'dependabot-only-pkg' }), // Dependabot only
      alert({ manifestPath: 'seed-code/x/package-lock.json' }), // excluded path
      alert({ manifestPath: 'unknown/package.json' }), // unmapped
      alert({ ghsa: 'GHSA-gggg-hhhh-iiii', scope: 'development' }), // development scope
    ],
    findings: [
      finding({}),
      finding({
        packageName: 'local-only-pkg',
        advisoryIds: ['GHSA-jjjj-kkkk-llll'],
        primaryId: 'GHSA-jjjj-kkkk-llll',
      }),
      finding({
        packageName: 'dev-tool',
        advisoryIds: ['GHSA-mmmm-nnnn-oooo'],
        scope: 'dev_only',
      }),
    ],
  });
  assert.equal(result.status, 'compared');
  assert.equal(result.open, 5);
  assert.equal(result.excludedPaths, 1);
  assert.equal(result.unmapped, 1);
  assert.deepEqual(result.unmappedManifests, ['unknown/package.json']);
  assert.equal(result.development, 1);
  assert.equal(result.compared, 2);
  assert.equal(result.agreed, 1);
  assert.deepEqual(
    result.dependabotOnly.map((d) => d.packageName),
    ['dependabot-only-pkg']
  );
  assert.deepEqual(
    result.localOnly.map((d) => d.packageName),
    ['local-only-pkg']
  );
  assert.equal(result.mismatch, 2);
});

test('reconcileDependabot compares Python package names in their normalized form', () => {
  const inventory = loadInventory(INVENTORY_TEXT);
  const result = reconcileDependabot({
    inventory,
    alerts: [
      {
        ghsa: ADVISORY,
        cve: null,
        packageName: 'Flask-Cors',
        ecosystem: 'pip',
        manifestPath: 'mt5-service/requirements.txt',
        scope: 'runtime',
      },
    ],
    findings: [
      makeFinding({
        ecosystem: 'pip',
        assetId: 'mt5-service-legacy',
        packageName: 'flask-cors',
        version: '4.0.0',
        advisoryIds: [ADVISORY, CVE],
      }),
    ],
  });
  assert.equal(result.mismatch, 0);
  assert.equal(result.agreed, 1);
  assert.deepEqual(result.unmappedManifests, []);
});

test('reconcileDependabot maps a workspace importer manifest to its asset', () => {
  const inventory = loadInventory(INVENTORY_TEXT);
  const result = reconcileDependabot({
    inventory,
    alerts: [
      {
        ghsa: ADVISORY,
        cve: null,
        packageName: 'sentinel-pkg',
        ecosystem: 'npm',
        manifestPath: 'packages/types/package.json',
        scope: 'runtime',
      },
      {
        ghsa: ADVISORY_2,
        cve: null,
        packageName: 'sentinel-pkg',
        ecosystem: 'npm',
        // a manifest that is in no asset of the inventory (the two of the Phase 2 gap are
        // mapped now; see "the real inventory closes the two coverage gaps")
        manifestPath: 'unlisted-service/package.json',
        scope: 'runtime',
      },
    ],
    findings: [
      makeFinding({
        assetId: 'monolith-web',
        packageName: 'sentinel-pkg',
        version: '1.0.0',
        advisoryIds: [ADVISORY],
      }),
    ],
  });
  assert.equal(result.unmapped, 1);
  assert.deepEqual(result.unmappedManifests, ['unlisted-service/package.json']);
  assert.equal(result.compared, 1);
  assert.equal(result.agreed, 1);
});

test('reconcileDependabot does not count a build-hygiene finding as a local-only disagreement', () => {
  // an advisory in a development tool that the build installs: Dependabot labels the alert
  // `development` (set aside by design), the full audit reports it as a build_only finding
  const inventory = loadInventory(INVENTORY_TEXT);
  const hygiene = makeFinding({
    assetId: 'operation-service',
    packageName: 'sentinel-dev-tool',
    version: '1.0.0',
    advisoryIds: [ADVISORY],
    scope: 'build_only',
    buildHygiene: true,
    source: 'npm-audit-dev',
  });
  const alert = {
    ghsa: ADVISORY,
    cve: null,
    packageName: 'sentinel-dev-tool',
    ecosystem: 'npm',
    manifestPath: 'operation-service/package.json',
    scope: 'development',
  };
  const result = reconcileDependabot({
    inventory,
    alerts: [alert],
    findings: [hygiene],
  });
  assert.equal(result.development, 1, 'the alert is set aside');
  assert.deepEqual(result.localOnly, []);
  assert.equal(result.mismatch, 0);
  // a runtime finding that Dependabot does not report is still a disagreement
  const runtime = makeFinding({
    assetId: 'operation-service',
    packageName: 'sentinel-runtime',
    version: '1.0.0',
    advisoryIds: [ADVISORY_2],
  });
  assert.equal(
    reconcileDependabot({ inventory, alerts: [], findings: [runtime] })
      .localOnly.length,
    1
  );
});

test('escapeMarkdownCell keeps untrusted text inside its table cell', () => {
  assert.equal(escapeMarkdownCell('a|b'), 'a\\|b');
  // a backslash in the input is doubled first, so it cannot cancel the pipe escape
  assert.equal(escapeMarkdownCell('a\\|b'), 'a\\\\\\|b');
  assert.equal(escapeMarkdownCell('C:\\path'), 'C:\\\\path');
  assert.equal(escapeMarkdownCell('line\nbreak\u0007'), 'line break ');
  assert.equal(escapeMarkdownCell('<b>x</b>'), '&lt;b&gt;x&lt;/b&gt;');
  assert.equal(escapeMarkdownCell('x'.repeat(300)).length, 200);
  // ampersands are escaped first, so a literal entity in the input stays text
  assert.equal(escapeMarkdownCell('a&b'), 'a&amp;b');
  assert.equal(escapeMarkdownCell('&lt;'), '&amp;lt;');
  assert.equal(escapeMarkdownCell('<&>'), '&lt;&amp;&gt;');
  assert.equal(escapeMarkdownCell(undefined), '');
});

test('extractAdvisoryIds finds identifiers in text and normalizes their case', () => {
  assert.deepEqual(
    extractAdvisoryIds(
      `see https://github.com/advisories/${ADVISORY.toUpperCase()} and ${CVE.toLowerCase()}`
    ),
    [ADVISORY, CVE]
  );
  assert.deepEqual(extractAdvisoryIds('no ids here'), []);
});
