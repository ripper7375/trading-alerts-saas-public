// Run: node --test 'scripts/security/*.test.mjs'
//
// The counts-only readers of the Phase 5 scanners (Trivy, OSV-Scanner, Semgrep, Gitleaks). The
// repository is public and so are its Actions logs, so what matters here is what the readers do NOT
// print: every report below is full of identifiers (advisory ids, package names, rule findings on
// files, secret matches) that are invented sentinels, and none may reach a line. Reports are built
// from the documented JSON shapes of each scanner.
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  COUNTS_USAGE,
  CountsUsageError,
  WITHHELD,
  checkSemgrepFixtures,
  fixturesGate,
  guardLines,
  osvGate,
  parseCountsArgs,
  parseFixtureExpectations,
  renderFixtureLines,
  renderGitleaksLines,
  renderOsvLines,
  renderSemgrepLines,
  renderTrivyLines,
  semgrepGate,
  summarizeGitleaks,
  summarizeOsvReport,
  summarizeSemgrepReport,
  summarizeTrivy,
  summarizeTrivyReport,
  trivyGate,
  zeroCounts,
} from './shift-left-counts-lib.mjs';
import { findPrivacyViolations } from './line-notifier-lib.mjs';
import { SEMGREP_FIXTURES } from './semgrep-fixtures.mjs';
import {
  parseSemgrepRules,
  runSemgrepRules,
  toSemgrepReport,
} from './semgrep-rules-lib.mjs';
import { readFileSync } from 'node:fs';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));

// invented identifiers that must never reach a line
const SENTINELS = [
  'CVE-2099-0001',
  'GHSA-aaaa-bbbb-cccc',
  'sentinel-package',
  'sentinel/internal-file.ts',
  'not-a-real-secret-value-0001',
  'sentinel-library-name',
];
const noSentinels = (lines) => {
  const text = lines.join('\n');
  for (const s of SENTINELS)
    assert.equal(text.includes(s), false, `leaked: ${s}`);
  for (const line of lines)
    assert.deepEqual(findPrivacyViolations(line), [], line);
};

// --- Trivy ---------------------------------------------------------------------------------------------

const vuln = (severity, fixed = null) => ({
  VulnerabilityID: 'CVE-2099-0001',
  PkgName: 'sentinel-package',
  InstalledVersion: '1.0.0',
  FixedVersion: fixed,
  Severity: severity,
});

const IMAGE_REPORT = {
  SchemaVersion: 2,
  ArtifactName: 'sentinel-library-name:1',
  Results: [
    {
      Target: 'sentinel/internal-file.ts',
      Class: 'os-pkgs',
      Vulnerabilities: [
        vuln('CRITICAL', '1.0.1'),
        vuln('HIGH', '1.0.2'),
        vuln('HIGH'),
        vuln('MEDIUM', '1.1'),
        vuln('LOW'),
        vuln('UNKNOWN'),
        vuln('nonsense'),
        vuln(undefined),
      ],
    },
    { Target: 'Node.js', Class: 'lang-pkgs' },
  ],
};

const CONFIG_REPORT = {
  SchemaVersion: 2,
  ArtifactName: '.',
  Results: [
    {
      Target: '1/Dockerfile',
      Class: 'config',
      Misconfigurations: [
        {
          ID: 'DS-0002',
          Severity: 'HIGH',
          Status: 'FAIL',
          Title: 'sentinel-package',
        },
        { ID: 'DS-0026', Severity: 'LOW', Status: 'FAIL' },
        { ID: 'DS-0001', Severity: 'MEDIUM' },
        { ID: 'DS-0099', Severity: 'CRITICAL', Status: 'PASS' },
        { ID: 'DS-0098', Severity: 'HIGH', Status: 'EXCEPTION' },
      ],
    },
    { Target: '2/Dockerfile', Class: 'config' },
  ],
};

test('one Trivy report is counted by severity, with the fixable critical and high ones', () => {
  const s = summarizeTrivyReport(IMAGE_REPORT);
  assert.equal(s.valid, true);
  assert.deepEqual(s.vulnerabilities, {
    critical: 1,
    high: 2,
    medium: 1,
    low: 1,
    unknown: 3,
  });
  assert.equal(
    s.fixable,
    2,
    'a fixed version exists for one critical and one high'
  );
  assert.equal(s.targets, 2);
  assert.deepEqual(
    summarizeTrivyReport({ SchemaVersion: 2 }).vulnerabilities,
    zeroCounts()
  );
});

test('a misconfiguration counts when it failed; a pass or an exception is not a finding', () => {
  const s = summarizeTrivyReport(CONFIG_REPORT);
  assert.deepEqual(s.misconfigurations, {
    critical: 0,
    high: 1,
    medium: 1,
    low: 1,
    unknown: 0,
  });
  assert.equal(s.targets, 2);
});

test('a document that is not a Trivy report is an error, never a clean scan', () => {
  for (const bad of [
    null,
    undefined,
    5,
    'x',
    [],
    {},
    { SchemaVersion: 'two' },
    { Results: [] },
  ]) {
    assert.equal(summarizeTrivyReport(bad).valid, false, JSON.stringify(bad));
  }
  const missing = summarizeTrivy({
    config: null,
    images: [null, IMAGE_REPORT],
    expectedImages: 4,
  });
  assert.equal(missing.config.ok, false);
  assert.equal(missing.images.scanned, 1);
  assert.equal(
    missing.images.errors,
    3,
    'one unreadable and two never produced'
  );
  // an expected count never hides an extra report
  assert.equal(
    summarizeTrivy({
      config: CONFIG_REPORT,
      images: [IMAGE_REPORT],
      expectedImages: 0,
    }).images.errors,
    0
  );
});

test('the Trivy lines carry counts and fixed words, never an id, a package or a path', () => {
  const summary = summarizeTrivy({
    config: CONFIG_REPORT,
    images: [IMAGE_REPORT, IMAGE_REPORT],
    expectedImages: 2,
  });
  const lines = renderTrivyLines(summary, { notScannable: 3 });
  assert.deepEqual(lines, [
    'trivy_config: ok=yes targets=2 critical=0 high=1 medium=1 low=1 unknown=0',
    'trivy_images: scanned=2 errors=0 critical=2 high=4 medium=2 low=2 unknown=6 fixable_critical_high=4',
    'trivy_not_scannable: files=3 (Docker Compose and nixpacks files have no Trivy check; the images a Compose file names are scanned)',
  ]);
  noSentinels(lines);
  assert.equal(
    renderTrivyLines(summary).length,
    2,
    'the note only when there are such files'
  );
});

test('Trivy is informational at first: findings and scan errors never fail the run until it is made blocking', () => {
  const findings = summarizeTrivy({
    config: CONFIG_REPORT,
    images: [IMAGE_REPORT],
    expectedImages: 1,
  });
  // one high misconfiguration, one critical and two high vulnerabilities
  assert.deepEqual(trivyGate({ summary: findings, blocking: false }), {
    mode: 'informational',
    failing: 4,
    errors: 0,
    exit: 0,
  });
  assert.equal(trivyGate({ summary: findings, blocking: true }).exit, 1);
  const broken = summarizeTrivy({
    config: null,
    images: [],
    expectedImages: 2,
  });
  assert.equal(trivyGate({ summary: broken, blocking: false }).exit, 0);
  assert.equal(trivyGate({ summary: broken, blocking: false }).errors, 3);
  assert.equal(trivyGate({ summary: broken, blocking: true }).exit, 1);
  const clean = summarizeTrivy({
    config: { SchemaVersion: 2, Results: [] },
    images: [
      {
        SchemaVersion: 2,
        Results: [
          vuln('MEDIUM') && { Target: 't', Vulnerabilities: [vuln('MEDIUM')] },
        ],
      },
    ],
    expectedImages: 1,
  });
  assert.equal(
    trivyGate({ summary: clean, blocking: true }).exit,
    0,
    'medium and below never fail'
  );
});

// --- OSV-Scanner -----------------------------------------------------------------------------------------

const osvPackage = (name, groups, vulnerabilities = []) => ({
  package: { name, version: '1.0.0', ecosystem: 'PyPI' },
  vulnerabilities,
  groups,
});
const OSV_REPORT = {
  results: [
    {
      source: {
        path: '/home/runner/work/r/r/knowledge-service/requirements.txt',
        type: 'lockfile',
      },
      packages: [
        osvPackage('sentinel-package', [
          {
            ids: ['GHSA-aaaa-bbbb-cccc', 'CVE-2099-0001'],
            max_severity: '9.8',
          },
          { ids: ['GHSA-dddd-eeee-ffff'], max_severity: '7.5' },
          { ids: ['GHSA-gggg-hhhh-iiii'], max_severity: '5.3' },
          { ids: ['GHSA-jjjj-kkkk-llll'], max_severity: '2.1' },
          { ids: ['GHSA-mmmm-nnnn-oooo'], max_severity: '0' },
        ]),
        osvPackage('clean-package', []),
      ],
    },
    {
      source: {
        path: '/home/runner/work/r/r/mt5-service/requirements-dev.txt',
        type: 'lockfile',
      },
      packages: [
        osvPackage('sentinel-library-name', [
          { ids: ['GHSA-pppp-qqqq-rrrr'], max_severity: '8.1' },
        ]),
      ],
    },
    {
      // no groups: the advisory's own word decides, and no word is unknown
      source: { path: 'mcd_common/requirements.txt', type: 'lockfile' },
      packages: [
        osvPackage(
          'p',
          [],
          [
            { id: 'GHSA-s1', database_specific: { severity: 'MODERATE' } },
            { id: 'GHSA-s2', database_specific: { severity: 'CRITICAL' } },
            { id: 'GHSA-s3' },
          ]
        ),
      ],
    },
  ],
};

test('OSV groups count once per advisory family and split runtime from development manifests', () => {
  const s = summarizeOsvReport(OSV_REPORT, {
    devPaths: ['mt5-service/requirements-dev.txt'],
  });
  assert.equal(s.valid, true);
  assert.equal(s.sources, 3);
  assert.deepEqual(s.runtime, {
    critical: 2,
    high: 1,
    medium: 2,
    low: 1,
    unknown: 2,
  });
  assert.deepEqual(s.development, {
    critical: 0,
    high: 1,
    medium: 0,
    low: 0,
    unknown: 0,
  });
  assert.equal(
    s.vulnerablePackages,
    3,
    'a package with no advisory is not counted'
  );
  // without the development list the same manifest counts as runtime
  assert.equal(summarizeOsvReport(OSV_REPORT).runtime.high, 2);
});

test('a document that is not an OSV report is a failed scan, and the lines say so', () => {
  for (const bad of [null, [], {}, { results: 'x' }]) {
    const s = summarizeOsvReport(bad);
    assert.equal(s.valid, false);
    assert.deepEqual(renderOsvLines(s), [
      'osv_python: scan=failed (no readable report)',
    ]);
  }
  assert.equal(
    summarizeOsvReport({ results: [] }).valid,
    true,
    'no result at all is a clean scan of nothing'
  );
});

test('the OSV lines carry counts only, and the gate is informational until it is made blocking', () => {
  const s = summarizeOsvReport(OSV_REPORT, {
    devPaths: ['mt5-service/requirements-dev.txt'],
  });
  const lines = renderOsvLines(s, {
    pinning: { requirements: 12, unpinned: 8 },
  });
  assert.deepEqual(lines, [
    'osv_python: sources=3 vulnerable_packages=3 critical=2 high=1 medium=2 low=1 unknown=2',
    'osv_python_development: critical=0 high=1 medium=0 low=0 unknown=0',
    'osv_python_pinning: requirement_lines=12 unpinned=8',
  ]);
  noSentinels(lines);
  assert.equal(osvGate({ summary: s, blocking: false }).exit, 0);
  assert.equal(osvGate({ summary: s, blocking: true }).exit, 1);
  // development-only findings never fail a blocking run
  const onlyDev = summarizeOsvReport(
    { results: [OSV_REPORT.results[1]] },
    { devPaths: ['mt5-service/requirements-dev.txt'] }
  );
  assert.equal(osvGate({ summary: onlyDev, blocking: true }).exit, 0);
  const failed = summarizeOsvReport(null);
  assert.equal(osvGate({ summary: failed, blocking: false }).exit, 0);
  assert.equal(osvGate({ summary: failed, blocking: true }).exit, 1);
});

test('each source is attributed to its inventory manifest, and one that is not a manifest stays out of the totals', () => {
  const manifests = [
    {
      assetId: 'knowledge-service',
      scope: 'runtime',
      path: 'knowledge-service/requirements.txt',
      // written the way a requirements file may spell it: PyPI treats `_`, `-` and case alike
      names: ['Sentinel_Package'],
    },
    {
      assetId: 'mt5-service-legacy',
      scope: 'development',
      path: 'mt5-service/requirements-dev.txt',
      names: [],
    },
    {
      assetId: 'stack-d-mcd-common',
      scope: 'runtime',
      path: 'mcd_common/requirements.txt',
    },
    {
      assetId: 'railway-gateway',
      scope: 'runtime',
      path: 'railway-gateway/python-requirements.txt',
      names: ['a', 'b'],
    },
  ];
  const unlisted = {
    source: { path: '/work/elsewhere/pnpm-lock.yaml', type: 'lockfile' },
    packages: [
      osvPackage('sentinel-package', [
        { ids: ['GHSA-aaaa-bbbb-cccc'], max_severity: '9.9' },
        { ids: ['GHSA-dddd-eeee-ffff'], max_severity: '8.0' },
      ]),
    ],
  };
  const s = summarizeOsvReport(
    { results: [...OSV_REPORT.results, unlisted] },
    { devPaths: ['mt5-service/requirements-dev.txt'], manifests }
  );
  // the totals are those of the manifests alone: the unlisted source is not in them
  assert.equal(s.sources, 4);
  assert.equal(s.vulnerablePackages, 3);
  assert.deepEqual(s.runtime, {
    critical: 2,
    high: 1,
    medium: 2,
    low: 1,
    unknown: 2,
  });
  assert.deepEqual(s.development, {
    critical: 0,
    high: 1,
    medium: 0,
    low: 0,
    unknown: 0,
  });
  assert.deepEqual(s.other, {
    sources: 1,
    vulnerablePackages: 1,
    counts: { critical: 1, high: 1, medium: 0, low: 0, unknown: 0 },
  });
  const lines = renderOsvLines(s);
  assert.deepEqual(lines, [
    'osv_python: sources=4 vulnerable_packages=3 critical=2 high=1 medium=2 low=1 unknown=2',
    'osv_python_development: critical=0 high=1 medium=0 low=0 unknown=0',
    'osv_python_manifest: knowledge-service scope=runtime sources=1 vulnerable_packages=1 critical=1 high=1 medium=1 low=1 unknown=1',
    'osv_python_manifest_shape: knowledge-service scope=runtime declared_packages=1 entries=1 packages_per_entry=2 vulnerable_per_entry=1 groups_per_entry=5 groups=5 distinct_groups=5 vulnerable_declared=1 vulnerable_dependencies=0',
    'osv_python_manifest: mt5-service-legacy scope=development sources=1 vulnerable_packages=1 critical=0 high=1 medium=0 low=0 unknown=0',
    'osv_python_manifest_shape: mt5-service-legacy scope=development declared_packages=0 entries=1 packages_per_entry=1 vulnerable_per_entry=1 groups_per_entry=1 groups=1 distinct_groups=1 vulnerable_declared=0 vulnerable_dependencies=1',
    'osv_python_manifest: stack-d-mcd-common scope=runtime sources=1 vulnerable_packages=1 critical=1 high=0 medium=1 low=0 unknown=1',
    'osv_python_manifest_shape: stack-d-mcd-common scope=runtime declared_packages=unknown entries=1 packages_per_entry=1 vulnerable_per_entry=1 groups_per_entry=3 groups=3 distinct_groups=3 vulnerable_declared=unknown vulnerable_dependencies=unknown',
    'osv_python_manifest: railway-gateway scope=runtime sources=0 vulnerable_packages=0 critical=0 high=0 medium=0 low=0 unknown=0',
    'osv_python_manifest_shape: railway-gateway scope=runtime declared_packages=2 entries=0 packages_per_entry=- vulnerable_per_entry=- groups_per_entry=- groups=0 distinct_groups=0 vulnerable_declared=0 vulnerable_dependencies=0',
    'osv_python_other_sources: sources=1 vulnerable_packages=1 critical=1 high=1 medium=0 low=0 unknown=0 (not an inventory manifest, kept out of the totals)',
  ]);
  noSentinels(lines);
  // a source outside the list never fails a blocking run
  const outsideOnly = summarizeOsvReport(
    { results: [unlisted] },
    { manifests }
  );
  assert.equal(osvGate({ summary: outsideOnly, blocking: true }).exit, 0);
  // no `other` line when every source is a manifest, and no manifest line without a list
  const allListed = summarizeOsvReport(OSV_REPORT, {
    manifests: manifests.slice(0, 3),
  });
  assert.equal(
    renderOsvLines(allListed).some((l) =>
      l.startsWith('osv_python_other_sources')
    ),
    false
  );
  assert.equal(
    renderOsvLines(summarizeOsvReport(OSV_REPORT)).some((l) =>
      l.startsWith('osv_python_manifest')
    ),
    false
  );
  // a package reported twice in one manifest is one vulnerable package, from two sources
  const twice = summarizeOsvReport(
    { results: [OSV_REPORT.results[0], OSV_REPORT.results[0]] },
    { manifests }
  );
  assert.equal(twice.manifests[0].vulnerablePackages, 1);
  assert.equal(twice.manifests[0].sources, 2);
});

test('the shape of a manifest says how its counts are made up: entries, repeated groups, declared and dependency packages', () => {
  const manifest = {
    assetId: 'mt5-service-legacy',
    scope: 'runtime',
    path: 'mt5-service/requirements.txt',
    // the file spells a name its own way; the report spells it the way the resolver does
    names: ['Flask_CORS', 'requests'],
  };
  const pkg = (name, version, groups) => ({
    package: { name, version, ecosystem: 'PyPI' },
    vulnerabilities: [],
    groups,
  });
  const group = (id, score) => ({ ids: [id], max_severity: score });
  const source = {
    path: '/work/r/mt5-service/requirements.txt',
    type: 'lockfile',
  };
  const report = {
    results: [
      {
        source,
        packages: [
          pkg('flask-cors', '4.0.0', [
            group('GHSA-sentinel-1', '9.1'),
            group('GHSA-sentinel-2', '7.5'),
          ]),
          // spelled the way the file spells it
          pkg('Requests', '2.31.0', [group('GHSA-sentinel-5', '6.1')]),
          pkg('tidy-library', '1.0.0', []),
        ],
      },
      {
        // the same file again: the first package repeated as it was, the same packages at another
        // version (an advisory that is the same, one that is new), spelled the way the resolver
        // does, and a package that is no line of the file (at the same version as the first)
        source,
        packages: [
          pkg('flask-cors', '4.0.0', [
            group('GHSA-sentinel-1', '9.1'),
            group('GHSA-sentinel-2', '7.5'),
          ]),
          pkg('flask-cors', '6.0.1', [
            group('GHSA-sentinel-3', '5.0'),
            group('GHSA-sentinel-2', '7.5'),
          ]),
          pkg('requests', '2.32.0', [group('GHSA-sentinel-5', '6.1')]),
          pkg('sentinel-dependency', '4.0.0', [
            group('GHSA-sentinel-1', '8.8'),
          ]),
        ],
      },
    ],
  };
  const s = summarizeOsvReport(report, { manifests: [manifest] });
  assert.equal(s.sources, 2);
  assert.equal(s.vulnerablePackages, 5, 'distinct package and version');
  assert.deepEqual(s.runtime, {
    critical: 2,
    high: 4,
    medium: 3,
    low: 0,
    unknown: 0,
  });
  assert.deepEqual(s.manifests[0].shape, {
    declaredPackages: 2,
    entries: [
      { packages: 3, vulnerable: 2, groups: 3 },
      { packages: 4, vulnerable: 4, groups: 6 },
    ],
    // 9 groups listed; the same package at the same version listed twice is 2 of them, and the
    // same advisory on another package or at another version is a group of its own
    distinctGroups: 7,
    // `requests` is one family in both spellings and at both versions
    declaredVulnerable: 2,
    dependencyVulnerable: 1,
  });
  const lines = renderOsvLines(s);
  assert.deepEqual(lines, [
    'osv_python: sources=2 vulnerable_packages=5 critical=2 high=4 medium=3 low=0 unknown=0',
    'osv_python_development: critical=0 high=0 medium=0 low=0 unknown=0',
    'osv_python_manifest: mt5-service-legacy scope=runtime sources=2 vulnerable_packages=5 critical=2 high=4 medium=3 low=0 unknown=0',
    'osv_python_manifest_shape: mt5-service-legacy scope=runtime declared_packages=2 entries=2 packages_per_entry=3,4 vulnerable_per_entry=2,4 groups_per_entry=3,6 groups=9 distinct_groups=7 vulnerable_declared=2 vulnerable_dependencies=1',
  ]);
  for (const word of [
    'flask-cors',
    'equests',
    'sentinel-dependency',
    'tidy-library',
    'GHSA',
    '4.0.0',
  ]) {
    assert.equal(lines.join('\n').includes(word), false, `leaked: ${word}`);
  }
  for (const line of lines)
    assert.deepEqual(findPrivacyViolations(line), [], line);
  // an entry of the report with nothing vulnerable in it is still an entry (the sources count it)
  const withClean = summarizeOsvReport(
    {
      results: [
        ...report.results,
        { source, packages: [pkg('tidy-library', '1.0.0', [])] },
      ],
    },
    { manifests: [manifest] }
  );
  assert.equal(withClean.sources, 3);
  assert.equal(withClean.manifests[0].sources, 3);
  assert.deepEqual(withClean.manifests[0].shape.entries[2], {
    packages: 1,
    vulnerable: 0,
    groups: 0,
  });
  assert.equal(withClean.manifests[0].shape.entries.length, 3);
  assert.deepEqual(withClean.runtime, s.runtime, 'a clean entry adds no count');
  // the declared names must be a list: anything else is "unknown", never a guess
  for (const names of [undefined, null, 'flask-cors', {}]) {
    const unknown = summarizeOsvReport(report, {
      manifests: [{ ...manifest, names }],
    });
    assert.equal(unknown.manifests[0].shape.declaredPackages, null);
    assert.equal(unknown.manifests[0].shape.declaredVulnerable, null);
    assert.equal(unknown.manifests[0].shape.dependencyVulnerable, null);
  }
  // a source that is not a manifest has no shape line, as it has no manifest line
  const outside = summarizeOsvReport(report, {
    manifests: [{ ...manifest, path: 'elsewhere/requirements.txt' }],
  });
  assert.equal(outside.manifests[0].shape.entries.length, 0);
  assert.equal(outside.other.sources, 2);
});

// --- Semgrep -------------------------------------------------------------------------------------------

const finding = (severity, over = {}) => ({
  check_id: 'security.semgrep-rules.davintrade-x',
  path: 'sentinel/internal-file.ts',
  start: { line: 3 },
  extra: { severity, message: 'sentinel-package' },
  ...over,
});
const SEMGREP_REPORT = {
  version: '1.184.0',
  results: [
    finding('ERROR'),
    finding('ERROR'),
    finding('WARNING'),
    finding('INFO'),
    finding('weird'),
  ],
  errors: [
    { level: 'warn', type: 'PartialParsing', message: 'sentinel-package' },
    { level: 'error', type: 'SomethingBroke', message: 'sentinel-package' },
    { level: 'warning' },
  ],
  paths: { scanned: ['a', 'b', 'c'], skipped: [] },
};

test('a Semgrep report is counted by severity, with scan errors apart from scan warnings', () => {
  const s = summarizeSemgrepReport(SEMGREP_REPORT);
  assert.deepEqual(s.findings, { error: 2, warning: 1, info: 1, other: 1 });
  assert.equal(s.scanErrors, 1);
  assert.equal(s.scanWarnings, 2);
  assert.equal(s.filesScanned, 3);
  const lines = renderSemgrepLines(s);
  assert.deepEqual(lines, [
    'semgrep_custom: files_scanned=3 error=2 warning=1 info=1 scan_errors=1 scan_warnings=2',
  ]);
  noSentinels(lines);
  assert.deepEqual(renderSemgrepLines(summarizeSemgrepReport(null)), [
    'semgrep_custom: scan=failed (no readable report)',
  ]);
});

test('a Semgrep scan that did not run always fails; findings fail only when it is blocking', () => {
  const clean = summarizeSemgrepReport({
    results: [],
    errors: [],
    paths: { scanned: ['a'] },
  });
  assert.equal(semgrepGate({ summary: clean, blocking: true }).exit, 0);
  const found = summarizeSemgrepReport({
    results: [finding('ERROR')],
    errors: [],
    paths: { scanned: ['a'] },
  });
  assert.equal(semgrepGate({ summary: found, blocking: false }).exit, 0);
  assert.equal(semgrepGate({ summary: found, blocking: true }).exit, 1);
  const warningOnly = summarizeSemgrepReport({
    results: [finding('WARNING')],
    paths: { scanned: ['a'] },
  });
  assert.equal(
    semgrepGate({ summary: warningOnly, blocking: true }).exit,
    0,
    'only ERROR fails'
  );
  // broken: no report, an engine error, or no file scanned at all
  for (const report of [
    null,
    { results: [], errors: [{ level: 'error' }], paths: { scanned: ['a'] } },
    { results: [], paths: { scanned: [] } },
    { results: [] },
  ]) {
    const gate = semgrepGate({
      summary: summarizeSemgrepReport(report),
      blocking: false,
    });
    assert.equal(gate.broken, true, JSON.stringify(report));
    assert.equal(
      gate.exit,
      1,
      'a rule or engine failure is a failure even when informational'
    );
  }
});

// --- Semgrep: the rules against their fixtures ----------------------------------------------------------

const FIXTURES = [
  {
    path: 'lib/a.ts',
    content: [
      '// expect: rule-one',
      'first();',
      'clean();',
      '// expect: rule-one, rule-two',
      'second();',
    ].join('\n'),
  },
  { path: 'lib/b.ts', content: 'nothing();\n' },
];

test('markers say where a rule must report: on their own line or the next', () => {
  assert.deepEqual(parseFixtureExpectations(FIXTURES), [
    { path: 'lib/a.ts', line: 1, rule: 'rule-one' },
    { path: 'lib/a.ts', line: 4, rule: 'rule-one' },
    { path: 'lib/a.ts', line: 4, rule: 'rule-two' },
  ]);
});

test('the fixture check matches by rule, file and line, and tells a missed case from an unexpected one', () => {
  const report = (results) => ({ results });
  const at = (path, line, rule) => ({ check_id: rule, path, start: { line } });
  const exact = checkSemgrepFixtures({
    report: report([
      at('lib/a.ts', 2, 'rule-one'),
      at('lib/a.ts', 4, 'rule-one'),
      at('lib/a.ts', 5, 'rule-two'),
    ]),
    fixtures: FIXTURES,
  });
  assert.deepEqual(
    { m: exact.matched, x: exact.missed, u: exact.unexpected },
    { m: 3, x: 0, u: 0 }
  );
  assert.equal(fixturesGate(exact).exit, 0);
  // the rule's file prefix and a path root are tolerated
  const prefixed = checkSemgrepFixtures({
    report: report([
      at('/work/fx/lib/a.ts', 1, 'security.semgrep-rules.rule-one'),
      at('/work/fx/lib/a.ts', 5, 'security.semgrep-rules.rule-one'),
      at('/work/fx/lib/a.ts', 4, 'security.semgrep-rules.rule-two'),
    ]),
    fixtures: FIXTURES,
  });
  assert.equal(prefixed.missed + prefixed.unexpected, 0);
  // a case nobody reports is missed; a finding nobody asked for is unexpected
  const wrong = checkSemgrepFixtures({
    report: report([
      at('lib/a.ts', 2, 'rule-one'),
      at('lib/b.ts', 1, 'rule-one'),
      at('lib/a.ts', 9, 'rule-one'),
    ]),
    fixtures: FIXTURES,
  });
  assert.deepEqual(
    { m: wrong.matched, x: wrong.missed, u: wrong.unexpected },
    { m: 1, x: 2, u: 2 }
  );
  assert.equal(fixturesGate(wrong).exit, 1);
  // two markers do not share one finding, and a rule id is not a suffix of another
  const shared = checkSemgrepFixtures({
    report: report([at('lib/a.ts', 2, 'rule-two')]),
    fixtures: [
      {
        path: 'lib/a.ts',
        content: '// expect: rule-two\n// expect: rule-two\nx();',
      },
    ],
  });
  assert.equal(shared.matched, 1);
  assert.equal(shared.missed, 1);
  const suffix = checkSemgrepFixtures({
    report: report([at('lib/a.ts', 1, 'my-rule-one')]),
    fixtures: [{ path: 'lib/a.ts', content: '// expect: rule-one' }],
  });
  assert.equal(
    suffix.matched,
    0,
    'only a dot separates the file prefix from the rule id'
  );
  // a report that cannot be read fails, with the markers counted as missed
  const unreadable = checkSemgrepFixtures({ report: null, fixtures: FIXTURES });
  assert.equal(unreadable.valid, false);
  assert.equal(fixturesGate(unreadable).exit, 1);
  assert.match(renderFixtureLines(unreadable)[0], /scan=failed/);
  assert.equal(
    renderFixtureLines(exact)[0],
    'semgrep_fixtures: cases=2 rules=2 expected=3 matched=3 missed=0 unexpected=0'
  );
});

// --- Gitleaks -----------------------------------------------------------------------------------------------

const LEAK = (rule, commit, file) => ({
  RuleID: rule,
  Commit: commit,
  File: file,
  Secret: 'not-a-real-secret-value-0001',
  Match: 'not-a-real-secret-value-0001',
  Description: 'sentinel-package',
});

test('a Gitleaks report is counted by rule, commit and file; no secret, match or path is printed', () => {
  const report = [
    LEAK('generic-api-key', 'c1', 'sentinel/internal-file.ts'),
    LEAK('generic-api-key', 'c2', 'sentinel/internal-file.ts'),
    LEAK('stripe-access-token', 'c2', 'b.env'),
    null,
    'x',
  ];
  const s = summarizeGitleaks(report);
  assert.deepEqual(
    { f: s.findings, r: s.rules, c: s.commits, files: s.files },
    { f: 3, r: 2, c: 2, files: 2 }
  );
  const lines = renderGitleaksLines(s);
  assert.deepEqual(lines, [
    'gitleaks_history: findings=3 rules=2 commits=2 files=2',
  ]);
  noSentinels(lines);
  const byRule = renderGitleaksLines(s, { byRule: true });
  assert.deepEqual(byRule.slice(1), [
    'gitleaks_rule: generic-api-key=2',
    'gitleaks_rule: stripe-access-token=1',
  ]);
  noSentinels(byRule);
  assert.deepEqual(renderGitleaksLines(summarizeGitleaks([])), [
    'gitleaks_history: findings=0 rules=0 commits=0 files=0',
  ]);
  for (const bad of [null, {}, 'x']) {
    assert.deepEqual(renderGitleaksLines(summarizeGitleaks(bad)), [
      'gitleaks_history: report=unreadable',
    ]);
  }
});

// --- the output guard and the arguments -------------------------------------------------------------------

test('every printed line passes the same guard as the LINE messages', () => {
  const lines = guardLines([
    'trivy_images: scanned=4 errors=0 critical=0 high=1',
    `a ${'x'.repeat(40)} token-shaped run`,
    'GHSA-aaaa-bbbb-cccc leaked',
    'reachable at 203.0.113.9',
  ]);
  assert.deepEqual(lines, [
    'trivy_images: scanned=4 errors=0 critical=0 high=1',
    WITHHELD,
    WITHHELD,
    WITHHELD,
  ]);
});

test('parseCountsArgs reads the kind, the flags and the files, and refuses the rest', () => {
  const o = parseCountsArgs([
    'trivy',
    '--config',
    'c.json',
    '--targets',
    't.json',
    '--blocking',
    'true',
    'i1.json',
    'i2.json',
  ]);
  assert.deepEqual(
    {
      kind: o.kind,
      config: o.config,
      targets: o.targets,
      blocking: o.blocking,
      files: o.files,
    },
    {
      kind: 'trivy',
      config: 'c.json',
      targets: 't.json',
      blocking: true,
      files: ['i1.json', 'i2.json'],
    }
  );
  assert.equal(
    parseCountsArgs(['osv', '--report', 'o.json']).blocking,
    false,
    'informational by default'
  );
  assert.equal(
    parseCountsArgs(['gitleaks', '--report', 'g.json', '--by-rule']).byRule,
    true
  );
  for (const bad of [
    [],
    ['nope'],
    ['trivy', '--blocking', 'yes'],
    ['trivy', '--config'],
    ['trivy', '--config', ''],
    ['trivy', '--wat'],
  ]) {
    assert.throws(
      () => parseCountsArgs(bad),
      CountsUsageError,
      JSON.stringify(bad)
    );
  }
  assert.match(COUNTS_USAGE, /Exit codes/);
});

// --- the command ----------------------------------------------------------------------------------------------

function withFiles(files, fn) {
  const dir = mkdtempSync(join(tmpdir(), 'shift-left-counts-'));
  try {
    const paths = {};
    for (const [name, value] of Object.entries(files)) {
      paths[name] = join(dir, name);
      writeFileSync(
        paths[name],
        typeof value === 'string' ? value : JSON.stringify(value),
        'utf8'
      );
    }
    return fn(paths, dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}
const cli = (args) =>
  spawnSync(
    process.execPath,
    [join(ROOT, 'scripts', 'security', 'shift-left-counts.mjs'), ...args],
    {
      encoding: 'utf8',
      timeout: 60000,
    }
  );

test('the command prints Trivy counts and never fails an informational run, however much it finds', () => {
  withFiles(
    {
      'config.json': CONFIG_REPORT,
      'image-1.json': IMAGE_REPORT,
      'image-2.json': '{ not json',
      'targets.json': { images: ['a', 'b', 'c'], notScannable: [{}, {}, {}] },
    },
    (p) => {
      const run = cli([
        'trivy',
        '--config',
        p['config.json'],
        '--targets',
        p['targets.json'],
        p['image-1.json'],
        p['image-2.json'],
      ]);
      assert.equal(run.status, 0, run.stdout);
      assert.match(run.stdout, /^trivy_config: ok=yes /m);
      assert.match(
        run.stdout,
        /^trivy_images: scanned=1 errors=2 critical=1 high=2 /m
      );
      assert.match(run.stdout, /^trivy_not_scannable: files=3 /m);
      assert.match(
        run.stdout,
        /^trivy_gate: informational \(critical\+high=4, scan_errors=2; set TRIVY_BLOCKING to true to fail on them\)$/m
      );
      assert.match(
        run.stdout,
        /^::warning::/m,
        'a scan that did not complete is flagged in the run summary'
      );
      noSentinels(run.stdout.split('\n').filter(Boolean));
      const blocking = cli([
        'trivy',
        '--config',
        p['config.json'],
        '--blocking',
        'true',
        p['image-1.json'],
      ]);
      assert.equal(blocking.status, 1);
      assert.match(blocking.stdout, /trivy_gate: blocking/);
    }
  );
});

test('the command prints OSV, Semgrep and Gitleaks counts, and a missing report is an error line, not a crash', () => {
  withFiles(
    {
      'osv.json': OSV_REPORT,
      'semgrep.json': SEMGREP_REPORT,
      'gitleaks.json': [
        LEAK('generic-api-key', 'c1', 'sentinel/internal-file.ts'),
      ],
      'targets.json': {
        pip: [
          {
            assetId: 'knowledge-service',
            path: 'knowledge-service/requirements.txt',
            scope: 'runtime',
            requirements: 10,
            unpinned: 2,
            names: ['sentinel-package', 'another-package'],
          },
          {
            assetId: 'mt5-service-legacy',
            path: 'mt5-service/requirements-dev.txt',
            scope: 'development',
            requirements: 2,
            unpinned: 2,
          },
          {
            assetId: 'stack-d-mcd-common',
            path: 'mcd_common/requirements.txt',
            scope: 'runtime',
            requirements: 4,
            unpinned: 0,
          },
        ],
      },
    },
    (p) => {
      const osv = cli([
        'osv',
        '--report',
        p['osv.json'],
        '--targets',
        p['targets.json'],
      ]);
      assert.equal(osv.status, 0, osv.stdout);
      assert.match(
        osv.stdout,
        /^osv_python: sources=3 vulnerable_packages=3 critical=2 high=1 /m
      );
      assert.match(osv.stdout, /^osv_python_development: critical=0 high=1 /m);
      // one line per manifest of the inventory, by asset id, and none for a source that is not one
      assert.match(
        osv.stdout,
        /^osv_python_manifest: knowledge-service scope=runtime sources=1 vulnerable_packages=1 critical=1 high=1 /m
      );
      assert.match(
        osv.stdout,
        /^osv_python_manifest: mt5-service-legacy scope=development sources=1 /m
      );
      // and how each one's counts are made up: the declared names come from the targets file
      assert.match(
        osv.stdout,
        /^osv_python_manifest_shape: knowledge-service scope=runtime declared_packages=2 entries=1 .* vulnerable_declared=1 vulnerable_dependencies=0$/m
      );
      assert.match(
        osv.stdout,
        /^osv_python_manifest_shape: mt5-service-legacy scope=development declared_packages=unknown /m
      );
      assert.doesNotMatch(osv.stdout, /osv_python_other_sources/);
      assert.match(
        osv.stdout,
        /^osv_python_pinning: requirement_lines=16 unpinned=4$/m
      );
      noSentinels(osv.stdout.split('\n').filter(Boolean));
      const semgrep = cli(['semgrep', '--report', p['semgrep.json']]);
      assert.equal(
        semgrep.status,
        1,
        'an engine error in the report is a broken scan'
      );
      assert.match(semgrep.stdout, /scan_errors=1/);
      const leaks = cli([
        'gitleaks',
        '--report',
        p['gitleaks.json'],
        '--by-rule',
      ]);
      assert.equal(leaks.status, 0);
      assert.match(
        leaks.stdout,
        /^gitleaks_history: findings=1 rules=1 commits=1 files=1$/m
      );
      assert.match(leaks.stdout, /^gitleaks_rule: generic-api-key=1$/m);
      noSentinels(leaks.stdout.split('\n').filter(Boolean));
      const missing = cli([
        'osv',
        '--report',
        join(p['osv.json'], 'nope.json'),
      ]);
      assert.equal(missing.status, 0, 'informational');
      assert.match(missing.stdout, /osv_python: scan=failed/);
      const gone = cli([
        'gitleaks',
        '--report',
        join(p['osv.json'], 'nope.json'),
      ]);
      assert.equal(gone.status, 1);
    }
  );
});

test('the command checks the real fixtures against a report of the Node evaluator, and fails on a report that misses a case', () => {
  const rules = parseSemgrepRules(
    readFileSync(join(ROOT, 'security', 'semgrep-rules.yml'), 'utf8')
  );
  const good = toSemgrepReport(
    runSemgrepRules({
      rules,
      files: SEMGREP_FIXTURES.map(({ path, content }) => ({
        path,
        text: content,
      })),
    })
  );
  withFiles({ 'good.json': good, 'empty.json': { results: [] } }, (p) => {
    const ok = cli(['semgrep-fixtures', '--report', p['good.json']]);
    assert.equal(ok.status, 0, ok.stdout);
    assert.match(
      ok.stdout,
      /^semgrep_fixtures: cases=\d+ rules=4 expected=\d+ matched=\d+ missed=0 unexpected=0$/m
    );
    const bad = cli(['semgrep-fixtures', '--report', p['empty.json']]);
    assert.equal(bad.status, 1);
    assert.match(bad.stdout, /missed=[1-9]/);
  });
});

test('the command prints the usage for an unknown kind and never an error message', () => {
  const run = cli(['nope']);
  assert.equal(run.status, 2);
  assert.match(run.stdout, /^error=usage/);
  assert.match(
    run.stdout,
    /Usage: node scripts\/security\/shift-left-counts\.mjs/
  );
  assert.equal(cli([]).status, 2);
});
