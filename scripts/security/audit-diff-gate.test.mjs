// Run: node --test 'scripts/security/*.test.mjs'
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  buildReport,
  buildSummaryReport,
  chooseMode,
  classifyAdvisories,
  introducedKeys,
  lockfilePackageKeys,
  parseAuditJson,
  severityCounts,
} from './audit-diff-gate-lib.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const CLI = join(HERE, 'audit-diff-gate.mjs');
const REPO_LOCKFILE = join(HERE, '..', '..', 'pnpm-lock.yaml');

// Strings that must never reach the output.
const SECRET_PACKAGE = 'sentinel-package-name';
const SECRET_ADVISORY = 'GHSA-test-sent-inel';
const SECRET_VERSION = '9.9.9';
const SECRET_TITLE = 'Sentinel advisory title';
const SECRETS = [SECRET_PACKAGE, SECRET_ADVISORY, SECRET_VERSION, SECRET_TITLE];

const quote = (key) => (key.startsWith('@') ? `'${key}'` : key);

// A small pnpm lockfile (v9). Snapshot keys carry a peer suffix on purpose: the
// parser must read the packages section only.
function lockfile(keys, { eol = '\n' } = {}) {
  return [
    "lockfileVersion: '9.0'",
    '',
    'settings:',
    '  autoInstallPeers: true',
    '',
    'importers:',
    '',
    '  .:',
    '    dependencies:',
    '      app-dependency:',
    '        specifier: ^1.0.0',
    '        version: 1.0.0',
    '',
    'packages:',
    '',
    ...keys.flatMap((key) => [
      `  ${quote(key)}:`,
      '    resolution: {integrity: sha512-abc}',
      "    engines: {node: '>=18'}",
      '',
    ]),
    'snapshots:',
    '',
    ...keys.flatMap((key) => [
      `  ${quote(key)}(peer-dependency@1.0.0):`,
      '    dependencies:',
      '      other: 1.0.0',
      '',
    ]),
  ].join(eol);
}

function advisory(id, severity, name, versions) {
  return {
    id,
    severity,
    module_name: name,
    github_advisory_id: SECRET_ADVISORY,
    title: SECRET_TITLE,
    findings: versions.map((version) => ({ version, paths: [`.>${name}`] })),
  };
}

const auditJson = (advisories) =>
  JSON.stringify({
    actions: [],
    advisories: Object.fromEntries(advisories.map((a) => [a.id, a])),
    muted: [],
    metadata: { vulnerabilities: {} },
  });

function cli(args) {
  const env = { ...process.env };
  delete env.GITHUB_ACTIONS;
  delete env.GITHUB_REF;
  const r = spawnSync(process.execPath, [CLI, ...args], {
    encoding: 'utf8',
    env,
  });
  return { code: r.status, out: `${r.stdout}${r.stderr}` };
}

function withFiles(files, fn) {
  const dir = mkdtempSync(join(tmpdir(), 'audit-gate-'));
  try {
    const paths = {};
    for (const [name, content] of Object.entries(files)) {
      paths[name] = join(dir, name);
      writeFileSync(paths[name], content);
    }
    return fn(paths);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

const assertNoSecrets = (out) => {
  for (const secret of SECRETS) {
    assert.ok(!out.includes(secret), `output leaked ${secret}`);
  }
};

test('lockfilePackageKeys reads the packages section only, quoted and unquoted keys, CRLF included', () => {
  const keys = ['abab@2.0.6', '@scope/pkg@1.2.3', 'left-pad@1.3.0'];
  for (const eol of ['\n', '\r\n']) {
    assert.deepEqual(
      [...lockfilePackageKeys(lockfile(keys, { eol }))].sort(),
      [...keys].sort()
    );
  }
});

test('lockfilePackageKeys keeps keys that contain a colon (tarball and file dependencies)', () => {
  const text = [
    'packages:',
    '',
    "  'foo@https://example.com/foo-1.0.0.tgz':",
    '    resolution: {tarball: https://example.com/foo-1.0.0.tgz}',
    '',
    '  bar@file:../bar:',
    '    resolution: {directory: ../bar, type: directory}',
    '',
    'snapshots:',
    '',
  ].join('\n');
  assert.deepEqual([...lockfilePackageKeys(text)].sort(), [
    'bar@file:../bar',
    'foo@https://example.com/foo-1.0.0.tgz',
  ]);
});

test('lockfilePackageKeys finds the packages of the repository lockfile (format-drift guard)', () => {
  const keys = lockfilePackageKeys(readFileSync(REPO_LOCKFILE, 'utf8'));
  assert.ok(keys.size > 500, `expected a real package list, got ${keys.size}`);
  for (const key of keys) {
    assert.ok(key.lastIndexOf('@') > 0, `a key without a version: ${key}`);
  }
});

test('introducedKeys lists added and version-changed packages, not removals or unchanged ones', () => {
  const base = new Set(['a@1.0.0', 'b@1.0.0', 'gone@1.0.0']);
  const head = new Set(['a@1.0.0', 'b@1.1.0', 'new@2.0.0']);
  assert.deepEqual([...introducedKeys(head, base)].sort(), [
    'b@1.1.0',
    'new@2.0.0',
  ]);
});

test('parseAuditJson tells usable, unavailable and invalid output apart', () => {
  assert.deepEqual(parseAuditJson(auditJson([])), {
    kind: 'ok',
    advisories: [],
  });
  assert.equal(
    parseAuditJson(auditJson([advisory('1', 'high', 'x', ['1.0.0'])]))
      .advisories.length,
    1
  );
  assert.equal(parseAuditJson('{"metadata":{}}').kind, 'ok');
  assert.equal(parseAuditJson('').kind, 'unavailable');
  assert.equal(parseAuditJson('  \n').kind, 'unavailable');
  assert.equal(
    parseAuditJson('{"error":{"code":"ERR_PNPM_AUDIT_BAD_RESPONSE"}}').kind,
    'unavailable'
  );
  assert.equal(parseAuditJson('not json').kind, 'invalid');
  assert.equal(parseAuditJson('[]').kind, 'invalid');
  assert.equal(parseAuditJson('{"advisories":[1]}').kind, 'invalid');
});

test('classifyAdvisories: the full gate counts every high and critical advisory and nothing below', () => {
  const counts = classifyAdvisories(
    [
      advisory('1', 'critical', 'a', ['1.0.0']),
      advisory('2', 'high', 'b', ['1.0.0']),
      advisory('3', 'moderate', 'c', ['1.0.0']),
      advisory('4', 'low', 'd', ['1.0.0']),
    ],
    null
  );
  assert.deepEqual(counts.blocking, { high: 1, critical: 1 });
  assert.deepEqual(counts.preexisting, { high: 0, critical: 0 });
});

test('classifyAdvisories: the diff gate blocks only on packages the change adds or changes', () => {
  const introduced = new Set(['new-pkg@2.0.0', 'bumped@1.1.0']);
  const counts = classifyAdvisories(
    [
      advisory('1', 'high', 'new-pkg', ['2.0.0']), // introduced: blocks
      advisory('2', 'critical', 'old-pkg', ['1.0.0']), // already on the base
      advisory('3', 'high', 'bumped', ['1.0.0', '1.1.0']), // one version is new: blocks
      advisory('4', 'high', 'no-findings', []), // unknown versions: blocks
      advisory('5', 'moderate', 'new-pkg', ['2.0.0']), // below the gate
    ],
    introduced
  );
  assert.deepEqual(counts.blocking, { high: 3, critical: 0 });
  assert.deepEqual(counts.preexisting, { high: 0, critical: 1 });
});

test('chooseMode: full on main and outside GitHub Actions, diff elsewhere, an explicit mode wins', () => {
  const actions = (ref) => ({ GITHUB_ACTIONS: 'true', GITHUB_REF: ref });
  assert.equal(chooseMode({ env: {} }), 'full');
  assert.equal(chooseMode({ env: actions('refs/heads/main') }), 'full');
  assert.equal(chooseMode({ env: actions('refs/pull/7/merge') }), 'diff');
  assert.equal(chooseMode({ env: actions('refs/heads/claude/x') }), 'diff');
  assert.equal(
    chooseMode({ requested: 'full', env: actions('refs/pull/7/merge') }),
    'full'
  );
  assert.equal(chooseMode({ requested: 'diff', env: {} }), 'diff');
  assert.equal(chooseMode({ requested: 'summary', env: {} }), 'summary');
  assert.throws(() => chooseMode({ requested: 'everything' }));
});

test('buildReport: results and exit codes, with counts and fixed sentences only', () => {
  const counts = {
    blocking: { high: 1, critical: 2 },
    preexisting: { high: 4, critical: 0 },
  };
  const failing = buildReport({ mode: 'diff', introducedCount: 3, counts });
  assert.equal(failing.exitCode, 1);
  const text = failing.lines.join('\n');
  assert.match(text, /added or changed packages: high=1 critical=2/);
  assert.match(
    text,
    /already present on the base \(not blocking here\): high=4 critical=0/
  );
  assert.match(text, /RESULT: FAIL/);
  assert.match(text, /::error::/);

  const passing = buildReport({
    mode: 'diff',
    introducedCount: 2,
    counts: {
      blocking: { high: 0, critical: 0 },
      preexisting: { high: 4, critical: 1 },
    },
  });
  assert.equal(passing.exitCode, 0);

  const nothing = buildReport({ mode: 'diff', introducedCount: 0 });
  assert.equal(nothing.exitCode, 0);
  assert.match(nothing.lines.join('\n'), /Nothing to audit/);

  const full = buildReport({ mode: 'full', counts });
  assert.equal(full.exitCode, 1);
  assert.match(
    full.lines.join('\n'),
    /production dependencies: high=1 critical=2/
  );

  assert.equal(
    buildReport({ mode: 'full', auditUnavailable: true }).exitCode,
    0
  );
  const failed = buildReport({ mode: 'full', auditFailedExit: 3 });
  assert.equal(failed.exitCode, 1);
  assert.match(failed.lines.join('\n'), /exit code 3/);
});

test('CLI diff mode: fails when a vulnerable package is added, prints counts only', () => {
  withFiles(
    {
      head: lockfile(['safe@1.0.0', `${SECRET_PACKAGE}@${SECRET_VERSION}`]),
      base: lockfile(['safe@1.0.0']),
      audit: auditJson([
        advisory('1', 'high', SECRET_PACKAGE, [SECRET_VERSION]),
      ]),
    },
    (p) => {
      const r = cli([
        '--mode',
        'diff',
        '--lockfile',
        p.head,
        '--base-lockfile',
        p.base,
        '--audit-json',
        p.audit,
      ]);
      assert.equal(r.code, 1);
      assert.match(r.out, /added or changed packages: high=1 critical=0/);
      assert.match(r.out, /::error::/);
      assertNoSecrets(r.out);
    }
  );
});

test('CLI diff mode: an advisory already present on the base does not fail the change', () => {
  const vulnerable = `${SECRET_PACKAGE}@${SECRET_VERSION}`;
  withFiles(
    {
      head: lockfile([vulnerable, 'added-safe@1.0.0']),
      base: lockfile([vulnerable]),
      audit: auditJson([
        advisory('1', 'critical', SECRET_PACKAGE, [SECRET_VERSION]),
      ]),
    },
    (p) => {
      const r = cli([
        '--mode',
        'diff',
        '--lockfile',
        p.head,
        '--base-lockfile',
        p.base,
        '--audit-json',
        p.audit,
      ]);
      assert.equal(r.code, 0);
      assert.match(r.out, /added or changed packages: high=0 critical=0/);
      assert.match(
        r.out,
        /already present on the base \(not blocking here\): high=0 critical=1/
      );
      assertNoSecrets(r.out);
    }
  );
});

test('CLI diff mode: a change that touches no lockfile package audits nothing', () => {
  const same = lockfile(['a@1.0.0', 'b@2.0.0']);
  withFiles({ head: same, base: same }, (p) => {
    const r = cli([
      '--mode',
      'diff',
      '--lockfile',
      p.head,
      '--base-lockfile',
      p.base,
      '--audit-json',
      join(tmpdir(), 'no-such-audit.json'),
    ]);
    assert.equal(r.code, 0);
    assert.match(r.out, /Nothing to audit/);
  });
});

test('CLI full mode: fails on any high or critical advisory, passes a clean audit', () => {
  withFiles(
    {
      head: lockfile([`${SECRET_PACKAGE}@${SECRET_VERSION}`]),
      dirty: auditJson([
        advisory('1', 'high', SECRET_PACKAGE, [SECRET_VERSION]),
        advisory('2', 'critical', 'other', ['1.0.0']),
        advisory('3', 'moderate', 'third', ['1.0.0']),
      ]),
      clean: auditJson([advisory('3', 'moderate', 'third', ['1.0.0'])]),
    },
    (p) => {
      let r = cli([
        '--mode',
        'full',
        '--lockfile',
        p.head,
        '--audit-json',
        p.dirty,
      ]);
      assert.equal(r.code, 1);
      assert.match(r.out, /production dependencies: high=1 critical=1/);
      assert.match(r.out, /Details are not printed in public logs/);
      assertNoSecrets(r.out);

      r = cli([
        '--mode',
        'full',
        '--lockfile',
        p.head,
        '--audit-json',
        p.clean,
      ]);
      assert.equal(r.code, 0);
      assert.match(r.out, /high=0 critical=0/);
    }
  );
});

test('CLI: an unavailable advisory endpoint is not a finding, garbage output is a failure', () => {
  withFiles(
    {
      head: lockfile(['a@1.0.0']),
      empty: '',
      errorObject: '{"error":{"code":"ERR_PNPM_AUDIT_BAD_RESPONSE"}}',
      garbage: 'Segmentation fault',
    },
    (p) => {
      for (const name of ['empty', 'errorObject']) {
        const r = cli([
          '--mode',
          'full',
          '--lockfile',
          p.head,
          '--audit-json',
          p[name],
        ]);
        assert.equal(r.code, 0, name);
        assert.match(r.out, /not evaluated/);
      }
      const r = cli([
        '--mode',
        'full',
        '--lockfile',
        p.head,
        '--audit-json',
        p.garbage,
      ]);
      assert.equal(r.code, 1);
      assert.match(r.out, /did not produce a result/);
      assert.ok(!r.out.includes('Segmentation'));
    }
  );
});

test('CLI diff mode falls back to the full gate when the base cannot be read', () => {
  withFiles(
    {
      head: lockfile([`${SECRET_PACKAGE}@${SECRET_VERSION}`]),
      dirty: auditJson([
        advisory('1', 'high', SECRET_PACKAGE, [SECRET_VERSION]),
      ]),
      clean: auditJson([]),
    },
    (p) => {
      const args = [
        '--mode',
        'diff',
        '--base',
        'no-such-ref-for-the-test',
        '--lockfile',
        p.head,
      ];
      let r = cli([...args, '--audit-json', p.dirty]);
      assert.equal(r.code, 1);
      assert.match(
        r.out,
        /base lockfile is unavailable: running the full gate/
      );
      assertNoSecrets(r.out);

      r = cli([...args, '--audit-json', p.clean]);
      assert.equal(r.code, 0);
    }
  );
});

test('CLI: the repository lockfile compared with itself has nothing to audit', () => {
  const r = cli([
    '--mode',
    'diff',
    '--lockfile',
    REPO_LOCKFILE,
    '--base-lockfile',
    REPO_LOCKFILE,
  ]);
  assert.equal(r.code, 0);
  assert.match(r.out, /added or changed by this change: 0/);
});

test('severityCounts and buildSummaryReport: counts per severity, never a failure', () => {
  const counts = severityCounts([
    advisory('1', 'critical', 'a', ['1.0.0']),
    advisory('2', 'high', 'b', ['1.0.0']),
    advisory('3', 'high', 'c', ['1.0.0']),
    advisory('4', 'moderate', 'd', ['1.0.0']),
    advisory('5', 'low', 'e', ['1.0.0']),
    advisory('6', 'constructor', 'f', ['1.0.0']),
  ]);
  assert.deepEqual(counts, {
    info: 0,
    low: 1,
    moderate: 1,
    high: 2,
    critical: 1,
  });
  const report = buildSummaryReport({ counts });
  assert.equal(report.exitCode, 0);
  assert.match(report.lines.join('\n'), /low=1 moderate=1 high=2 critical=1/);
  assert.equal(buildSummaryReport({ auditUnavailable: true }).exitCode, 0);
  assert.match(
    buildSummaryReport({ auditFailedExit: 4 }).lines.join('\n'),
    /exit code 4/
  );
});

test('CLI summary mode: counts per severity over all dependencies, always exit 0, nothing identifying', () => {
  withFiles(
    {
      audit: auditJson([
        advisory('1', 'high', SECRET_PACKAGE, [SECRET_VERSION]),
        advisory('2', 'moderate', 'other', ['1.0.0']),
        advisory('3', 'low', 'third', ['1.0.0']),
      ]),
      garbage: 'Segmentation fault',
    },
    (p) => {
      let r = cli(['--mode', 'summary', '--audit-json', p.audit]);
      assert.equal(r.code, 0);
      assert.match(r.out, /low=1 moderate=1 high=1 critical=0/);
      assertNoSecrets(r.out);

      r = cli(['--mode', 'summary', '--audit-json', p.garbage]);
      assert.equal(r.code, 0);
      assert.match(r.out, /did not produce a result/);
      assert.ok(!r.out.includes('Segmentation'));
    }
  );
});

test('CLI: setup errors exit 2', () => {
  assert.equal(
    cli(['--lockfile', join(tmpdir(), 'no-such-lockfile.yaml')]).code,
    2
  );
  assert.equal(cli(['--unknown', 'x']).code, 2);
  assert.equal(cli(['--mode', 'everything']).code, 2);
});
