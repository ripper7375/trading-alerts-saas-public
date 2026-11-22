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
            path: 'knowledge-service/requirements.txt',
            scope: 'runtime',
            requirements: 10,
            unpinned: 2,
          },
          {
            path: 'mt5-service/requirements-dev.txt',
            scope: 'development',
            requirements: 2,
            unpinned: 2,
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
      assert.match(
        osv.stdout,
        /^osv_python_pinning: requirement_lines=12 unpinned=4$/m
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
