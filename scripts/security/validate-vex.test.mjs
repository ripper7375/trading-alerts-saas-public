// Run: node --test 'scripts/security/*.test.mjs'
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  buildValidationReport,
  daysBetween,
  inventoryAssetIds,
  isIsoDate,
  parityCounts,
  validateRegistry,
} from './vex-lib.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..', '..');
const CLI = join(HERE, 'validate-vex.mjs');

// Strings that must never reach the output.
const SECRET_ADVISORY = 'GHSA-abcd-efgh-ijkl';
const SECRET_PACKAGE = 'sentinel-package-name';
const SECRET_TEXT = 'sentinel impact text';
const SECRETS = [SECRET_ADVISORY, SECRET_PACKAGE, SECRET_TEXT];

const TODAY = '2026-11-21';
const ASSETS = new Set(['monolith-web', 'money-service']);

const statement = (patch = {}) => ({
  advisory_id: SECRET_ADVISORY,
  asset_id: 'monolith-web',
  package_spec: `${SECRET_PACKAGE}@1.2.3`,
  status: 'not_affected',
  justification: 'vulnerable_code_not_in_execute_path',
  impact_statement: SECRET_TEXT,
  scope: 'runtime',
  created_at: '2026-11-01',
  review_after: '2027-01-15',
  expires_when: {
    when_advisory_withdrawn: true,
    when_fix_available_in_range: true,
  },
  ...patch,
});
const registry = (statements) => ({
  schema_version: '1.0',
  updated_at: TODAY,
  statements,
});
const validate = (statements, options = {}) =>
  validateRegistry(registry(statements), {
    assetIds: ASSETS,
    today: TODAY,
    ...options,
  });
const codes = (result) => result.errors.map((error) => error.code);

test('isIsoDate and daysBetween', () => {
  assert.ok(isIsoDate('2026-11-21'));
  assert.ok(isIsoDate('2028-02-29'));
  for (const bad of [
    '2026-02-30',
    '2026-13-01',
    'soon',
    '2026-1-1',
    20261121,
    null,
  ]) {
    assert.ok(!isIsoDate(bad), String(bad));
  }
  assert.equal(daysBetween('2026-11-01', '2026-11-21'), 20);
  assert.equal(daysBetween('2026-11-21', '2026-11-01'), -20);
});

test('inventoryAssetIds reads the assets section only', () => {
  const text = [
    'schema_version: "3.0"',
    'other:',
    '  - id: not-an-asset',
    'assets:',
    '  - id: first-asset',
    '    lifecycle: production',
    '  - id: second-asset # comment',
    'excluded_paths:',
    '  - id: also-not-an-asset',
  ].join('\n');
  assert.deepEqual([...inventoryAssetIds(text)].sort(), [
    'first-asset',
    'second-asset',
  ]);
});

test('a valid registry passes, and statements are counted by status', () => {
  const result = validate([
    statement(),
    statement({
      advisory_id: 'CVE-2026-12345',
      asset_id: 'money-service',
      status: 'fixed',
      justification: undefined,
      fixed_in: '1.2.4',
    }),
  ]);
  assert.deepEqual(result.errors, []);
  assert.deepEqual(result.counts, {
    statements: 2,
    not_affected: 1,
    fixed: 1,
    expired: 0,
  });
  assert.deepEqual(validate([]).errors, []);
});

const INVALID = [
  ['advisory_id', { advisory_id: 'not-an-id' }],
  ['malicious_advisory', { advisory_id: 'MAL-2026-1234' }],
  ['asset_id', { asset_id: 'Not Valid' }],
  ['unknown_asset', { asset_id: 'ghost-asset' }],
  ['package_spec', { package_spec: 'no-version' }],
  ['status', { status: 'affected' }],
  ['status', { status: 'under_investigation' }],
  ['justification_required', { justification: undefined }],
  ['justification_invalid', { justification: 'because' }],
  ['fixed_in_not_allowed', { fixed_in: '1.2.4' }],
  ['fixed_in_required', { status: 'fixed', justification: undefined }],
  ['justification_not_allowed', { status: 'fixed', fixed_in: '1.2.4' }],
  ['impact_statement', { impact_statement: '' }],
  ['impact_statement', { impact_statement: 'x'.repeat(281) }],
  ['address_in_text', { impact_statement: 'see https://example.invalid/x' }],
  ['address_in_text', { impact_statement: 'reachable at 10.0.0.1' }],
  ['address_in_text', { impact_statement: 'host.proxy.rlwy.net' }],
  ['scope', { scope: 'prod' }],
  ['created_at', { created_at: '2026-02-30' }],
  ['review_after', { review_after: 'soon' }],
  ['review_window', { review_after: '2026-10-01' }],
  ['review_window', { review_after: '2027-09-01' }],
  ['expires_when', { expires_when: 'never' }],
  ['expires_when', { expires_when: { when_in_cisa_kev: 'yes' } }],
  [
    'expires_when',
    { expires_when: { when_package_absent_from_lockfile: 'x' } },
  ],
  ['unknown_expiry_key', { expires_when: { whenever: true } }],
  [
    'withdrawn_trigger_disabled',
    { expires_when: { when_advisory_withdrawn: false } },
  ],
  ['unknown_key', { notes: 'extra' }],
];
for (const [code, patch] of INVALID) {
  test(`validateRegistry rejects: ${code} (${Object.keys(patch).join(', ')})`, () => {
    assert.ok(codes(validate([statement(patch)])).includes(code), code);
  });
}

test('a statement that is not an object, a duplicate key and registry-level errors', () => {
  assert.ok(codes(validate(['text'])).includes('statement_not_object'));
  const duplicate = validate([statement(), statement({ scope: 'build_only' })]);
  assert.deepEqual(codes(duplicate), ['duplicate_key']);
  assert.equal(duplicate.errors[0].index, 1);

  const bad = validateRegistry({
    schema_version: '2.0',
    updated_at: 'x',
    extra: 1,
    statements: [],
  });
  assert.deepEqual(codes(bad).sort(), [
    'schema_version',
    'unknown_registry_key',
    'updated_at',
  ]);
  assert.deepEqual(
    codes(validateRegistry({ schema_version: '1.0', updated_at: TODAY })),
    ['statements_not_array']
  );
  assert.deepEqual(codes(validateRegistry([])), ['registry_not_object']);
});

test('an expired review is counted, never an error; without an inventory asset ids are not checked', () => {
  const expired = validate([
    statement({ created_at: '2026-10-01', review_after: '2026-11-10' }),
  ]);
  assert.deepEqual(expired.errors, []);
  assert.equal(expired.counts.expired, 1);

  const noInventory = validate([statement({ asset_id: 'ghost-asset' })], {
    assetIds: null,
  });
  assert.deepEqual(noInventory.errors, []);
});

test('parityCounts counts accepted ignores that have a statement', () => {
  const reg = registry([
    statement(),
    statement({ advisory_id: 'GHSA-zzzz-yyyy-xxxx' }),
  ]);
  assert.deepEqual(
    parityCounts(reg, [SECRET_ADVISORY.toUpperCase(), 'GHSA-aaaa-bbbb-cccc']),
    {
      ignored: 2,
      covered: 1,
    }
  );
  assert.deepEqual(parityCounts(registry([]), []), { ignored: 0, covered: 0 });
});

test('buildValidationReport: counts and codes only; parity fails only when required', () => {
  const ok = buildValidationReport({
    result: validate([statement()]),
    assetCount: 16,
    parity: { ignored: 3, covered: 1 },
  });
  assert.equal(ok.exitCode, 0);
  const text = ok.lines.join('\n');
  assert.match(text, /statements=1 not_affected=1 fixed=0 expired=0/);
  assert.match(
    text,
    /Accepted ignores in package.json: 3; with a VEX statement: 1/
  );

  const strict = buildValidationReport({
    result: validate([]),
    assetCount: 16,
    parity: { ignored: 3, covered: 1 },
    requireParity: true,
  });
  assert.equal(strict.exitCode, 1);
  assert.match(strict.lines.join('\n'), /registry: parity/);

  const failed = buildValidationReport({
    result: validate([statement({ status: 'affected' })]),
    assetCount: null,
    parity: null,
  });
  assert.equal(failed.exitCode, 1);
  assert.match(failed.lines.join('\n'), /statement #1: status/);
  assert.match(failed.lines.join('\n'), /Inventory not found/);
});

function cli(args) {
  const r = spawnSync(process.execPath, [CLI, ...args], { encoding: 'utf8' });
  return { code: r.status, out: `${r.stdout}${r.stderr}` };
}

function withFiles(files, fn) {
  const dir = mkdtempSync(join(tmpdir(), 'validate-vex-'));
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

const INVENTORY = [
  'assets:',
  '  - id: monolith-web',
  '  - id: money-service',
  '',
].join('\n');
const PACKAGE_JSON = (ghsas) =>
  JSON.stringify({ pnpm: { auditConfig: { ignoreGhsas: ghsas } } });
const assertNoSecrets = (out) => {
  for (const secret of SECRETS)
    assert.ok(!out.includes(secret), `leaked ${secret}`);
};

test('CLI: a valid registry passes and prints counts only', () => {
  withFiles(
    {
      reg: JSON.stringify(registry([statement()])),
      inv: INVENTORY,
      pkg: PACKAGE_JSON([SECRET_ADVISORY, 'GHSA-aaaa-bbbb-cccc']),
    },
    (p) => {
      const r = cli([
        '--registry',
        p.reg,
        '--inventory',
        p.inv,
        '--package-json',
        p.pkg,
        '--today',
        TODAY,
      ]);
      assert.equal(r.code, 0);
      assert.match(r.out, /statements=1 not_affected=1/);
      assert.match(r.out, /Inventory assets known: 2/);
      assert.match(
        r.out,
        /Accepted ignores in package.json: 2; with a VEX statement: 1/
      );
      assertNoSecrets(r.out);

      const strict = cli([
        '--registry',
        p.reg,
        '--inventory',
        p.inv,
        '--package-json',
        p.pkg,
        '--require-parity',
      ]);
      assert.equal(strict.code, 1);
      assertNoSecrets(strict.out);
    }
  );
});

test('CLI: an invalid statement fails with error codes and never prints its content', () => {
  withFiles(
    {
      reg: JSON.stringify(
        registry([statement({ status: 'affected', asset_id: 'ghost-asset' })])
      ),
      inv: INVENTORY,
    },
    (p) => {
      const r = cli([
        '--registry',
        p.reg,
        '--inventory',
        p.inv,
        '--package-json',
        join(tmpdir(), 'none.json'),
      ]);
      assert.equal(r.code, 1);
      assert.match(r.out, /statement #1: status/);
      assert.match(r.out, /statement #1: unknown_asset/);
      assert.match(r.out, /::error::/);
      assertNoSecrets(r.out);
    }
  );
});

test('CLI: bad input exits with the documented codes', () => {
  withFiles({ notJson: '{ nope' }, (p) => {
    assert.equal(cli(['--registry', p.notJson]).code, 1);
  });
  assert.equal(
    cli(['--registry', join(tmpdir(), 'no-such-registry.json')]).code,
    2
  );
  assert.equal(cli(['--unknown', 'x']).code, 2);
  assert.equal(cli(['--today', '21-11-2026']).code, 2);
});

test('CLI: the repository registry and inventory are valid', () => {
  const r = cli([
    '--registry',
    join(ROOT, 'security', 'vex-registry.json'),
    '--inventory',
    join(ROOT, 'security', 'security-inventory.yaml'),
    '--package-json',
    join(ROOT, 'package.json'),
    '--today',
    TODAY,
  ]);
  assert.equal(r.code, 0, r.out);
  assert.match(r.out, /statements=0 not_affected=0 fixed=0 expired=0/);
  assert.match(r.out, /Inventory assets known: 1\d/);
});
