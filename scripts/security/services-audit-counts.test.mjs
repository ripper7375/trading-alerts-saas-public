// Run: node --test 'scripts/security/*.test.mjs'
//
// The counts-only services audit for the public CI log: it prints vulnerable
// packages per severity and never an advisory id, package name, version or title.
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const CLI = join(HERE, 'services-audit-counts.mjs');
const ROOT = join(HERE, '..', '..');

// Strings that must never reach the output.
const SECRETS = [
  'sentinel-package-name',
  'GHSA-aaaa-bbbb-cccc',
  '9.9.9',
  'Sentinel advisory title',
];

const report = (counts) => ({
  auditReportVersion: 2,
  vulnerabilities: {
    'sentinel-package-name': {
      name: 'sentinel-package-name',
      severity: 'high',
      isDirect: true,
      via: [
        {
          source: 1,
          name: 'sentinel-package-name',
          title: 'Sentinel advisory title',
          url: 'https://github.com/advisories/GHSA-aaaa-bbbb-cccc',
          severity: 'high',
          range: '<9.9.9',
        },
      ],
      range: '<9.9.9',
      nodes: ['node_modules/sentinel-package-name'],
    },
  },
  metadata: {
    vulnerabilities: {
      info: 0,
      low: 0,
      moderate: 0,
      high: 0,
      critical: 0,
      total: 0,
      ...counts,
    },
  },
});

function run(args, json) {
  const dir = mkdtempSync(join(tmpdir(), 'services-audit-'));
  try {
    const argv = [...args];
    if (json !== undefined) {
      const file = join(dir, 'audit.json');
      writeFileSync(
        file,
        typeof json === 'string' ? json : JSON.stringify(json)
      );
      argv.unshift('--audit-json', file);
    }
    const r = spawnSync(process.execPath, [CLI, ...argv], {
      encoding: 'utf8',
      cwd: ROOT,
    });
    return { status: r.status, out: r.stdout };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

test('prints counts per severity and a warning for high or critical, without any identifier', () => {
  const { status, out } = run(
    ['svc-a'],
    report({ moderate: 47, high: 6, total: 53 })
  );
  assert.equal(status, 0);
  assert.match(out, /service=svc-a critical=0 high=6 moderate=47 low=0/);
  assert.match(out, /::warning title=svc-a::critical=0 high=6 \(counts only/);
  assert.match(
    out,
    /At least one service reports high or critical production advisories/
  );
  for (const secret of SECRETS)
    assert.equal(out.includes(secret), false, secret);
});

test('a clean report prints zero counts and no warning', () => {
  const { status, out } = run(['svc-a', 'svc-b'], report({}));
  assert.equal(status, 0);
  assert.match(out, /service=svc-a critical=0 high=0 moderate=0 low=0/);
  assert.match(out, /service=svc-b critical=0 high=0 moderate=0 low=0/);
  assert.equal(out.includes('::warning'), false);
  assert.match(
    out,
    /No service reports high or critical production advisories\./
  );
});

test('an unavailable or invalid audit is reported as unavailable and never fails the step', () => {
  for (const json of [
    '',
    '<html>',
    JSON.stringify({ message: 'registry unreachable', error: {} }),
  ]) {
    const { status, out } = run(['svc-a'], json);
    assert.equal(status, 0);
    assert.match(out, /service=svc-a result=unavailable/);
  }
});

test('wrong usage exits 2 and never passes an odd folder name on', () => {
  for (const args of [
    [],
    ['--audit-json'],
    ['../escape'],
    ['a;b'],
    ['--other'],
  ]) {
    const { status, out } = run(args);
    assert.equal(status, 2, JSON.stringify(args));
    assert.match(out, /::error::usage/);
  }
});
