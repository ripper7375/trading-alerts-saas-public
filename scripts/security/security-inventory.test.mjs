// Run: node --test 'scripts/security/*.test.mjs'
//
// Checks security/security-inventory.yaml without a YAML parser: the file keeps
// to a simple block style, and these tests read the parts they need with
// small, strict helpers. They enforce that the inventory stays true to the
// repository: the excluded paths equal the Dependabot triage prefixes, every
// referenced path exists, the build-platform and base-image claims match the
// build files, and nothing in it is an address or a credential.
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { NONPROD_PREFIXES } from './dependabot-triage-lib.mjs';
import { inventoryAssetIds, isIsoDate } from './vex-lib.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..', '..');
const read = (path) =>
  readFileSync(join(ROOT, path), 'utf8').replace(/\r\n/g, '\n');
const INVENTORY = read('security/security-inventory.yaml');

const LIFECYCLES = [
  'production',
  'paused',
  'pre_cutover',
  'needs_owner_confirmation',
  'archived',
];
const ALIASES = [
  'PROD_DB',
  'PROD_REDIS',
  'STAGING_DB',
  'STAGING_REDIS',
  'CHAT_VPS_IP',
  'MT5_VPS_IP',
];

const unquote = (value) => value.trim().replace(/^(['"])(.*)\1$/, '$2');

// Items of a top-level block list: `key:` followed by `- value` lines. Blank
// and comment lines are skipped; the list ends at the next top-level key.
function topLevelList(text, key) {
  const lines = text.split('\n');
  const start = lines.findIndex((line) => line.startsWith(`${key}:`));
  assert.ok(start >= 0, `missing top-level key ${key}`);
  const items = [];
  for (const line of lines.slice(start + 1)) {
    if (line.trim() === '' || line.startsWith('#')) continue;
    if (!/^\s/.test(line)) break;
    const match = /^\s+-\s+("[^"]*"|'[^']*'|[^#\s][^#]*?)\s*(?:#.*)?$/.exec(
      line
    );
    if (match) items.push(unquote(match[1]));
  }
  return items;
}

// The `- id:` blocks of the assets section.
function assetBlocks(text) {
  const lines = text.split('\n');
  const start = lines.findIndex((line) => /^assets:\s*(?:#.*)?$/.test(line));
  assert.ok(start >= 0, 'missing the assets section');
  const blocks = [];
  let current = null;
  for (const line of lines.slice(start + 1)) {
    if (/^[A-Za-z_]/.test(line)) break;
    if (/^ {2}- id:/.test(line)) {
      current = [];
      blocks.push(current);
    }
    current?.push(line);
  }
  return blocks.map((blockLines) => ({
    id: /^ {2}- id:\s*(\S+?)\s*(?:#.*)?$/.exec(blockLines[0])[1],
    text: blockLines.join('\n'),
  }));
}

const BLOCKS = assetBlocks(INVENTORY);
const field = (block, name, indent) =>
  new RegExp(`^ {${indent}}${name}:\\s*([^\\s#]+)`, 'm').exec(block.text)?.[1];

// The `public_endpoints` an asset declares: `[]`, or a block list under the key.
function assetPublicEndpoints(block) {
  const lines = block.text.split('\n');
  const start = lines.findIndex((line) => /^ {4}public_endpoints:/.test(line));
  if (start < 0 || /^ {4}public_endpoints:\s*\[\]/.test(lines[start]))
    return [];
  const items = [];
  for (const line of lines.slice(start + 1)) {
    if (line.trim() === '' || /^\s*#/.test(line)) continue;
    const item = /^ {6}-\s+("[^"]*"|'[^']*')\s*(?:#.*)?$/.exec(line);
    if (!item) break;
    items.push(unquote(item[1]));
  }
  return items;
}

test('excluded_paths equals the Dependabot triage prefixes (single source of truth)', () => {
  const entries = topLevelList(INVENTORY, 'excluded_paths');
  for (const entry of entries) {
    assert.match(
      entry,
      /^[a-z0-9._-]+(?:\/[a-z0-9._-]+)*\/\*\*$/,
      `not a directory glob: ${entry}`
    );
  }
  assert.equal(new Set(entries).size, entries.length, 'a duplicated entry');
  // "seed-code/**" -> "seed-code/", the form NONPROD_PREFIXES uses
  const prefixes = entries.map((entry) => entry.slice(0, -2));
  assert.deepEqual([...prefixes].sort(), [...NONPROD_PREFIXES].sort());
});

test('the header keeps the v3.0 keys, a valid date and an exact pnpm pin', () => {
  assert.match(INVENTORY, /^schema_version:\s*["']?3\.0["']?\s*(?:#.*)?$/m);
  const date = /^updated_at:\s*["']?(\d{4}-\d{2}-\d{2})["']?/m.exec(INVENTORY);
  assert.ok(date && isIsoDate(date[1]), 'updated_at is not a valid date');
  for (const key of [
    'toolchain_pins',
    'expected_public_endpoints',
    'assets',
    'excluded_paths',
  ]) {
    assert.match(INVENTORY, new RegExp(`^${key}:`, 'm'), `missing ${key}`);
  }
  assert.match(INVENTORY, /^ {2}pnpm_version:\s*["']?\d+\.\d+\.\d+["']?/m);
  assert.match(INVENTORY, /^ {4}v24_min_patch:\s*["']?\d+\.\d+\.\d+["']?/m);
  assert.match(INVENTORY, /^ {4}v22_min_patch:\s*["']?\d+\.\d+\.\d+["']?/m);
});

test('asset ids are unique kebab-case names and agree with inventoryAssetIds', () => {
  const ids = BLOCKS.map((block) => block.id);
  assert.ok(ids.length >= 10, `only ${ids.length} assets`);
  assert.equal(new Set(ids).size, ids.length, 'a duplicated asset id');
  for (const id of ids) assert.match(id, /^[a-z0-9][a-z0-9-]*$/);
  assert.deepEqual([...inventoryAssetIds(INVENTORY)].sort(), [...ids].sort());
});

test('every asset states a known lifecycle and the fields the engine needs', () => {
  for (const block of BLOCKS) {
    const lifecycle = field(block, 'lifecycle', 4);
    assert.ok(
      LIFECYCLES.includes(lifecycle),
      `${block.id}: lifecycle ${lifecycle}`
    );
    if (lifecycle !== 'needs_owner_confirmation') {
      const tier = Number(field(block, 'exposure_tier', 4));
      assert.ok([1, 2, 3, 4].includes(tier), `${block.id}: exposure_tier`);
    }
    if (lifecycle === 'production') {
      assert.ok(
        field(block, 'deployment_evidence', 4),
        `${block.id}: evidence`
      );
    }
    if (lifecycle === 'paused' && block.id === 'chat-server') {
      assert.ok(field(block, 'restore_gate', 4), 'chat-server: restore_gate');
    }
  }
  assert.ok(
    BLOCKS.some((b) => field(b, 'lifecycle', 4) === 'needs_owner_confirmation'),
    'the unconfirmed assets are no longer listed'
  );
});

test('every path the inventory references exists in the repository', () => {
  const pathFields =
    /^\s+(manifest_path|lockfile_path|dockerfile_path|compose_path|nixpacks_path|deployment_evidence|restore_gate|drift_check|covered_by_lockfile):\s*("[^"]+"|'[^']+')/gm;
  let checked = 0;
  for (const block of BLOCKS) {
    for (const match of block.text.matchAll(pathFields)) {
      const path = unquote(match[2]);
      assert.ok(
        existsSync(join(ROOT, path)),
        `${block.id}: ${match[1]} ${path}`
      );
      checked += 1;
    }
  }
  assert.ok(checked >= 30, `only ${checked} paths were checked`);
});

test('the two manifests of the Phase 2 coverage gap are classified in the inventory', () => {
  const block = (id) => BLOCKS.find((b) => b.id === id);
  // development tooling of the Flask service: mapped, and marked as development only
  assert.match(
    block('mt5-service-legacy').text,
    /manifest_path:\s*'mt5-service\/requirements-dev\.txt'\s*\n\s+scope:\s*development/
  );
  // a file: dependency of operation-service: mapped, audited through the service lockfile
  assert.match(
    block('operation-service').text,
    /manifest_path:\s*'operation-service\/packages\/types\/package\.json'[^\n]*\n\s+covered_by_lockfile:\s*'operation-service\/package-lock\.json'/
  );
});

test('a covered manifest names a lockfile the same asset audits, and a scope is a known word', () => {
  let covered = 0;
  for (const block of BLOCKS) {
    const lockfiles = [
      ...block.text.matchAll(/^\s+lockfile_path:\s*("[^"]+"|'[^']+')/gm),
    ].map((m) => unquote(m[1]));
    for (const m of block.text.matchAll(
      /^\s+covered_by_lockfile:\s*("[^"]+"|'[^']+')/gm
    )) {
      covered += 1;
      assert.ok(
        lockfiles.includes(unquote(m[1])),
        `${block.id}: ${m[1]} is not a lockfile of this asset`
      );
    }
    for (const m of block.text.matchAll(/^\s+scope:\s*(\S+)/gm)) {
      assert.ok(
        ['runtime', 'development'].includes(m[1]),
        `${block.id}: scope ${m[1]}`
      );
    }
  }
  assert.ok(covered >= 1, 'no covered manifest is left');
});

test('a paused asset names the DNS name that must not resolve, and its restore gate has a drift check', () => {
  const chat = BLOCKS.find((b) => b.id === 'chat-server');
  const hosts = /^ {4}public_hostnames:\s*\[([^\]]*)\]/m.exec(chat.text);
  assert.ok(hosts, 'chat-server: public_hostnames');
  const names = hosts[1]
    .split(',')
    .map((name) => unquote(name.trim()))
    .filter(Boolean);
  assert.ok(names.length >= 1);
  const expected = topLevelList(INVENTORY, 'expected_public_endpoints');
  for (const name of names) {
    assert.match(name, /^(?:[a-z0-9-]+\.)+[a-z]{2,}$/, name);
    assert.equal(
      expected.includes(name),
      false,
      `${name} is listed as an expected public endpoint while its asset is paused`
    );
  }
  assert.equal(field(chat, 'lifecycle', 4), 'paused');
  assert.ok(field(chat, 'drift_check', 4), 'chat-server: drift_check');
  assert.ok(field(chat, 'restore_gate', 4), 'chat-server: restore_gate');
});

test('platform claims match the build configuration in the repository', () => {
  const nixpacks = BLOCKS.filter(
    (block) => field(block, 'platform', 6) === 'railway-nixpacks'
  );
  assert.ok(nixpacks.length >= 3, 'the three Railway services are missing');
  for (const block of nixpacks) {
    const manifest = /manifest_path:\s*["']([^"']+)["']/.exec(block.text)[1];
    const dir = dirname(manifest);
    const configs = ['railway.toml', 'railway.json']
      .map((name) => join(ROOT, dir, name))
      .filter((path) => existsSync(path));
    assert.ok(
      configs.length > 0,
      `${block.id}: no railway.toml or railway.json`
    );
    assert.ok(
      configs.some((path) => /nixpacks/i.test(readFileSync(path, 'utf8'))),
      `${block.id}: the build config does not select nixpacks`
    );
  }
});

test('declared base images appear in the Dockerfile or Compose file they belong to', () => {
  const pairs =
    /(dockerfile_path|compose_path):\s*["']([^"']+)["']\s*\n\s+base_image:\s*["']([^"']+)["']/g;
  let checked = 0;
  for (const block of BLOCKS) {
    for (const match of block.text.matchAll(pairs)) {
      const [, kind, path, image] = match;
      const content = read(path);
      const escaped = image.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const pattern =
        kind === 'dockerfile_path'
          ? new RegExp(`^FROM\\s+${escaped}(?:\\s|$)`, 'm')
          : new RegExp(`^\\s+image:\\s*${escaped}\\s*$`, 'm');
      assert.match(
        content,
        pattern,
        `${block.id}: ${image} not found in ${path}`
      );
      checked += 1;
    }
  }
  assert.ok(checked >= 5, `only ${checked} images were checked`);
});

test('every public endpoint an asset declares is also an expected public endpoint', () => {
  const expected = topLevelList(INVENTORY, 'expected_public_endpoints');
  assert.equal(new Set(expected).size, expected.length, 'a duplicated entry');
  const declared = BLOCKS.flatMap((block) =>
    assetPublicEndpoints(block).map((endpoint) => ({ id: block.id, endpoint }))
  );
  assert.ok(
    declared.length >= 2,
    'the production proxies are no longer declared'
  );
  for (const { id, endpoint } of declared) {
    assert.ok(
      expected.includes(endpoint),
      `${id}: "${endpoint}" is not in expected_public_endpoints`
    );
  }
});

test('the inventory is public-safe: no address, credential or proxy host, only known aliases', () => {
  assert.ok(!/\b(?:\d{1,3}\.){3}\d{1,3}\b/.test(INVENTORY), 'an IPv4 address');
  assert.ok(
    !/:\/\/|\.rlwy\.net|\bpassword\b|BEGIN [A-Z ]*PRIVATE KEY/i.test(INVENTORY),
    'a URL, proxy host or credential'
  );
  for (const [, alias] of INVENTORY.matchAll(/<([A-Z_]+)>/g)) {
    const base = alias.replace(/_(HOST|PORT)$/, '');
    assert.ok(ALIASES.includes(base), `unknown alias <${alias}>`);
  }
});
