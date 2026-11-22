// Run: node --test 'scripts/security/*.test.mjs'
//
// The two dependency-free parsers the security pipeline relies on: the semver
// helpers and the YAML-subset reader that loads security/security-inventory.yaml.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  cleanVersion,
  compareVersions,
  isBreakingUpgrade,
  isExactPin,
  lowerBounds,
  maxVersion,
  parseVersion,
  satisfies,
} from './security-semver-lite.mjs';
import { parseYaml, YamlLiteError } from './security-yaml-lite.mjs';
import { NONPROD_PREFIXES } from './dependabot-triage-lib.mjs';
import { inventoryAssetIds } from './vex-lib.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const INVENTORY_PATH = join(
  HERE,
  '..',
  '..',
  'security',
  'security-inventory.yaml'
);

// --- semver --------------------------------------------------------------

test('parseVersion reads complete versions only', () => {
  assert.deepEqual(parseVersion('1.2.3'), {
    major: 1,
    minor: 2,
    patch: 3,
    pre: [],
  });
  assert.deepEqual(parseVersion('v24.22.3'), parseVersion('24.22.3'));
  assert.deepEqual(parseVersion('1.0.0-beta.2+build').pre, ['beta', '2']);
  assert.equal(parseVersion('1.2'), null);
  assert.equal(parseVersion('latest'), null);
  assert.equal(parseVersion(undefined), null);
  assert.equal(cleanVersion('v10.34.9'), '10.34.9');
  assert.equal(cleanVersion('workspace:*'), null);
});

test('compareVersions orders releases and prereleases', () => {
  assert.equal(compareVersions('1.2.3', '1.2.3'), 0);
  assert.equal(compareVersions('1.2.3', '1.10.0'), -1);
  assert.equal(compareVersions('24.22.3', '24.10.0'), 1);
  assert.equal(compareVersions('1.0.0-alpha', '1.0.0'), -1);
  assert.equal(compareVersions('1.0.0-alpha.2', '1.0.0-alpha.10'), -1);
  assert.equal(compareVersions('1.0.0-1', '1.0.0-alpha'), -1);
  assert.equal(compareVersions('nope', '1.0.0'), null);
  assert.equal(maxVersion(['1.2.3', 'x', '1.10.0', '1.9.9']), '1.10.0');
  assert.equal(maxVersion([]), null);
});

test('satisfies handles exact, caret, tilde, x-ranges and comparators', () => {
  const yes = [
    ['1.2.3', '1.2.3'],
    ['1.2.3', '=1.2.3'],
    ['1.4.0', '^1.2.3'],
    ['0.2.9', '^0.2.3'],
    ['0.0.3', '^0.0.3'],
    ['1.9.9', '^1.x'],
    ['1.2.9', '~1.2.3'],
    ['1.2.9', '1.2.x'],
    ['1.2.9', '1.2'],
    ['7.0.0', '*'],
    ['7.0.0', ''],
    ['2.0.0', '>=1.0.0 <3.0.0'],
    ['2.0.0', '>= 1.0.0 < 3.0.0'],
    ['3.0.0', '<1.0.0 || >=3.0.0'],
    ['1.5.0', '1.2.3 - 2.0.0'],
  ];
  for (const [version, range] of yes) {
    assert.equal(satisfies(version, range), true, `${version} in ${range}`);
  }
  const no = [
    ['1.2.4', '1.2.3'],
    ['2.0.0', '^1.2.3'],
    ['0.3.0', '^0.2.3'],
    ['0.0.4', '^0.0.3'],
    ['1.3.0', '~1.2.3'],
    ['1.3.0', '1.2.x'],
    ['2.0.0', '<2.0.0'],
    ['2.0.1', '1.2.3 - 2.0.0'],
    ['2.0.0-beta.1', '^1.2.3'],
    ['2.0.0-beta.1', '>=1.0.0'],
    ['1.0.0', 'workspace:*'],
    ['not-a-version', '*'],
  ];
  for (const [version, range] of no) {
    assert.equal(
      satisfies(version, range),
      false,
      `${version} not in ${range}`
    );
  }
  assert.equal(satisfies('1.0.0-beta.2', '>=1.0.0-beta.1'), true);
});

test('lowerBounds lists the lowest version of each OR-ed set', () => {
  assert.deepEqual(lowerBounds('>=4.17.21'), ['4.17.21']);
  assert.deepEqual(lowerBounds('>=1.2.3 <2.0.0 || >=2.0.5'), [
    '1.2.3',
    '2.0.5',
  ]);
  assert.deepEqual(lowerBounds('<2.0.0'), ['0.0.0']);
  assert.deepEqual(lowerBounds('^6.15.1'), ['6.15.1']);
  assert.deepEqual(lowerBounds('~2.0.7'), ['2.0.7']);
  assert.deepEqual(lowerBounds('2.4.0'), ['2.4.0']);
  assert.deepEqual(lowerBounds('workspace:*'), []);
});

test('isBreakingUpgrade: a new major, or a new minor below 1.0.0', () => {
  assert.equal(isBreakingUpgrade('6.15.1', '6.16.0'), false);
  assert.equal(isBreakingUpgrade('6.15.1', '7.0.0'), true);
  assert.equal(isBreakingUpgrade('0.55.0', '0.56.1'), true);
  assert.equal(isBreakingUpgrade('0.55.0', '0.55.9'), false);
  assert.equal(isBreakingUpgrade('2.0.0', '1.0.0'), false);
  assert.equal(isBreakingUpgrade('x', '1.0.0'), false);
});

test('isExactPin tells a bare version from a range', () => {
  assert.equal(isExactPin('2.4.0'), true);
  assert.equal(isExactPin('=2.4.0'), true);
  assert.equal(isExactPin('^2.4.0'), false);
  assert.equal(isExactPin('~2.4.0'), false);
  assert.equal(isExactPin('>=2.4.0'), false);
  assert.equal(isExactPin('2.x'), false);
});

// --- YAML subset ---------------------------------------------------------

test('parseYaml reads scalars, comments and quoting', () => {
  const doc = parseYaml(
    [
      '# a comment',
      "name: 'Next.js # not a comment' # trailing comment",
      'plain: hello world',
      "apostrophe: Bob's thing",
      'count: 3',
      'ratio: 0.5',
      'on: true',
      'off: false',
      'nothing: null',
      'tilde: ~',
      "version: '10.34.9'",
      'double: "a \\"quoted\\" \\u0041"',
      "single: 'it''s'",
      'path: infra/pgbouncer/Dockerfile',
      'host_like: a:b',
    ].join('\n')
  );
  assert.deepEqual(doc, {
    name: 'Next.js # not a comment',
    plain: 'hello world',
    apostrophe: "Bob's thing",
    count: 3,
    ratio: 0.5,
    on: true,
    off: false,
    nothing: null,
    tilde: null,
    version: '10.34.9',
    double: 'a "quoted" A',
    single: "it's",
    path: 'infra/pgbouncer/Dockerfile',
    host_like: 'a:b',
  });
});

test('parseYaml reads nested blocks, sequences of mappings and flow lists', () => {
  const doc = parseYaml(
    [
      'a:',
      '  b:',
      '    c: 1',
      '  list:',
      '    - one',
      "    - 'two'",
      '    - three # note',
      'assets:',
      '  - id: x',
      '    flags: [auth, payments]',
      '    empty: []',
      '    ecosystems:',
      '      - type: npm',
      '        manifest_path: m/package.json',
      '      - type: pip',
      '  - id: y',
      '    note: only',
      'tail:',
      '- same',
      '- indent',
    ].join('\n')
  );
  assert.deepEqual(doc, {
    a: { b: { c: 1 }, list: ['one', 'two', 'three'] },
    assets: [
      {
        id: 'x',
        flags: ['auth', 'payments'],
        empty: [],
        ecosystems: [
          { type: 'npm', manifest_path: 'm/package.json' },
          { type: 'pip' },
        ],
      },
      { id: 'y', note: 'only' },
    ],
    tail: ['same', 'indent'],
  });
});

test('parseYaml accepts CRLF and a byte-order mark', () => {
  assert.deepEqual(parseYaml('\uFEFFa: 1\r\nb:\r\n  - x\r\n'), {
    a: 1,
    b: ['x'],
  });
});

test('parseYaml refuses what it cannot read faithfully', () => {
  const bad = [
    'a: 1\na: 2',
    'a:\n\tb: 1',
    'a: &anchor 1',
    'a: *alias',
    'a: !!str 1',
    'a: |\n  text',
    'a: [1, 2',
    "a: 'open",
    'a: 1\n  b: 2',
    'just text',
  ];
  for (const text of bad) {
    assert.throws(() => parseYaml(text), YamlLiteError, JSON.stringify(text));
  }
});

test('parseYaml reads the real inventory and agrees with the other readers', () => {
  const text = readFileSync(INVENTORY_PATH, 'utf8');
  const doc = parseYaml(text);
  assert.equal(doc.schema_version, '3.0');
  assert.equal(doc.toolchain_pins.pnpm_version, '10.34.9');
  assert.match(doc.toolchain_pins.node_runtime_floors.v24_min_patch, /^24\./);
  assert.ok(Array.isArray(doc.expected_public_endpoints));
  assert.deepEqual(
    doc.assets.map((asset) => asset.id).sort(),
    [...inventoryAssetIds(text.replace(/\r\n/g, '\n'))].sort()
  );
  assert.deepEqual(
    doc.excluded_paths.map((entry) => entry.slice(0, -2)).sort(),
    [...NONPROD_PREFIXES].sort()
  );
  const monolith = doc.assets.find((asset) => asset.id === 'monolith-web');
  assert.equal(monolith.exposure_tier, 1);
  assert.equal(monolith.escalation_required, false);
  assert.deepEqual(monolith.ecosystems[0].include_workspace_importers, [
    '.',
    'packages/types',
  ]);
  assert.ok(monolith.build_only_packages.includes('prisma'));
  const bouncer = doc.assets.find((asset) => asset.id === 'railway-pgbouncer');
  assert.deepEqual(bouncer.public_endpoints, []);
  const stackC = doc.assets.find((asset) => asset.id === 'stack-c-mt5-vps');
  assert.equal(stackC.ecosystems[0].pinning_required, true);
});
