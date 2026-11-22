// Run: node --test 'scripts/security/*.test.mjs'
//
// What the shift-left scans cover (Phase 5): the Dockerfiles, the images, the Python manifests, read
// from security/security-inventory.yaml. Pure parsers on small inputs, the collector on a synthetic
// inventory, then the real inventory and the real files (the order names them, so they are pinned
// here), and the command that writes the lists for the workflow.
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  collectShiftLeftTargets,
  countRequirementPins,
  isImageRef,
  isRepoPath,
  loadShiftLeftTargets,
  parseComposeImages,
  parseDockerfileImages,
  renderTargetsLine,
} from './shift-left-targets-lib.mjs';
import { loadInventory } from './security-pipeline-lib.mjs';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const readRepo = (path) => {
  const file = join(ROOT, path);
  return existsSync(file) ? readFileSync(file, 'utf8') : null;
};

// --- parsers ------------------------------------------------------------------------------------------

test('a Dockerfile names its base images; a build stage, scratch and a build argument are not images', () => {
  const text = [
    '# FROM commented:1',
    'FROM node:22-alpine AS build',
    'RUN npm run build',
    'from --platform=linux/amd64 alpine:3.24 as runtime',
    'FROM build AS again',
    'FROM scratch',
    'ARG BASE=node:22',
    'FROM ${BASE}',
    'FROM $BASE AS other',
    '  FROM python:3.11-slim  ',
    'FROM redis@sha256:' + 'a'.repeat(64),
  ].join('\n');
  assert.deepEqual(parseDockerfileImages(text), {
    images: [
      'node:22-alpine',
      'alpine:3.24',
      'python:3.11-slim',
      `redis@sha256:${'a'.repeat(64)}`,
    ],
    unresolved: 2,
  });
  assert.deepEqual(parseDockerfileImages(null), { images: [], unresolved: 0 });
});

test('a Compose file names the images it pulls; a service that is only built has none', () => {
  const text = [
    'services:',
    '  cache:',
    '    image: redis:7-alpine # pinned by tag',
    '    ports: ["6379:6379"]',
    '  web:',
    '    build:',
    '      context: ./web',
    '  db:',
    "    image: 'postgres:16'",
    '  tool:',
    '    image: "${TOOL_IMAGE}"',
    '  other:',
    '    image: ${OTHER}',
  ].join('\n');
  assert.deepEqual(parseComposeImages(text), {
    images: ['redis:7-alpine', 'postgres:16'],
    unresolved: 2,
  });
});

test('countRequirementPins: only name==version is pinned', () => {
  const text = [
    '# a comment',
    '',
    '-r other.txt',
    '--index-url https://example.invalid/simple',
    'pinned==1.2.3',
    'triple===1.0',
    'extras[a,b]==2.0 ; python_version >= "3.8"',
    'trailing==3.0  # why',
    'hashed==4.0 \\',
    '    --hash=sha256:' + 'b'.repeat(64),
    'range>=1.24',
    'compatible~=2.0',
    'bare',
    'wildcard==1.*',
    'upper<3,>=2',
    'git+https://example.invalid/pkg.git',
  ].join('\n');
  // five pinned lines, six not: a range, a compatible release, a bare name, a wildcard, two bounds, a URL
  assert.deepEqual(countRequirementPins(text), {
    requirements: 11,
    unpinned: 6,
  });
  assert.deepEqual(countRequirementPins(''), { requirements: 0, unpinned: 0 });
  assert.deepEqual(countRequirementPins(null), {
    requirements: 0,
    unpinned: 0,
  });
});

test('an image reference and a repository path must be plain words before a command sees them', () => {
  for (const ok of [
    'alpine:3.24',
    'node:22-alpine',
    'library/redis:7',
    'registry/team/app:1.0.0-rc.1',
    `redis@sha256:${'0'.repeat(64)}`,
    'python',
  ]) {
    assert.equal(isImageRef(ok), true, ok);
  }
  for (const bad of [
    '',
    'Alpine:3',
    'a b',
    'a;b',
    'a$(x)',
    '${BASE}',
    'a:',
    ':3',
    'a@sha256:abc',
    '-rm',
    'a\nb',
    null,
    5,
  ]) {
    assert.equal(isImageRef(bad), false, String(bad));
  }
  for (const ok of [
    'infra/pgbouncer/Dockerfile',
    'a/b-c_d.e/f',
    '.github/x.yml',
  ]) {
    assert.equal(isRepoPath(ok), true, ok);
  }
  for (const bad of [
    '',
    '../x',
    'a/../b',
    '/abs',
    'a b',
    'a;b',
    '-x',
    'a/$(x)',
    null,
  ]) {
    assert.equal(isRepoPath(bad), false, String(bad));
  }
});

// --- the collector ---------------------------------------------------------------------------------------

const INVENTORY = `
schema_version: '3.0'
updated_at: '2026-11-22'
toolchain_pins:
  node_runtime_floors:
    v24_min_patch: '24.22.3'
assets:
  - id: svc
    lifecycle: production
    ecosystems:
      - type: docker
        dockerfile_path: 'svc/Dockerfile'
        base_image: 'alpine:3.24'
      - type: pip
        manifest_path: 'svc/requirements.txt'
      - type: npm
        manifest_path: 'svc/package.json'
        nixpacks_path: 'svc/nixpacks.toml'
  - id: stack
    lifecycle: paused
    ecosystems:
      - type: docker
        compose_path: 'stack/docker-compose.yml'
        base_image: 'redis:7-alpine'
      - type: pip
        manifest_path: 'stack/requirements-dev.txt'
        scope: development
        pinning_required: true
  - id: old
    lifecycle: archived
    ecosystems:
      - type: docker
        dockerfile_path: 'old/Dockerfile'
        base_image: 'debian:9'
`;
const FILES = {
  'svc/Dockerfile':
    'FROM node:22-alpine AS build\nFROM alpine:3.24\nFROM ${X}\n',
  'svc/requirements.txt': 'a==1\nb>=2\n',
  'svc/nixpacks.toml': '[variables]\n',
  'stack/docker-compose.yml':
    'services:\n  c:\n    image: redis:7-alpine\n  d:\n    image: postgres:16\n',
  'stack/requirements-dev.txt': 'x>=1\ny~=2\n',
  'old/Dockerfile': 'FROM debian:9\n',
};
const collect = (over = {}, files = FILES) =>
  collectShiftLeftTargets({
    inventory: loadInventory(INVENTORY),
    readText: (path) => (path in files ? files[path] : null),
    ...over,
  });

test('the collector lists Dockerfiles, images, Compose and nixpacks files, and Python manifests', () => {
  const t = collect();
  assert.deepEqual(t.dockerfiles, [{ assetId: 'svc', path: 'svc/Dockerfile' }]);
  assert.deepEqual(t.composeFiles, [
    { assetId: 'stack', path: 'stack/docker-compose.yml' },
  ]);
  assert.deepEqual(t.nixpacksFiles, [
    { assetId: 'svc', path: 'svc/nixpacks.toml' },
  ]);
  // the inventory's base images, the Dockerfile's FROM lines and the Compose image: lines, once each
  assert.deepEqual(t.images, [
    'alpine:3.24',
    'node:22-alpine',
    'postgres:16',
    'redis:7-alpine',
  ]);
  assert.equal(t.unresolvedImages, 1);
  assert.deepEqual(t.notScannable, [
    { path: 'stack/docker-compose.yml', kind: 'compose' },
    { path: 'svc/nixpacks.toml', kind: 'nixpacks' },
  ]);
  assert.deepEqual(
    t.pip.map((p) => [
      p.path,
      p.scope,
      p.lifecycle,
      p.requirements,
      p.unpinned,
      p.pinningRequired,
    ]),
    [
      ['svc/requirements.txt', 'runtime', 'production', 2, 1, false],
      ['stack/requirements-dev.txt', 'development', 'paused', 2, 2, true],
    ]
  );
  assert.deepEqual(t.issues, []);
  assert.equal(
    renderTargetsLine(t),
    'targets: dockerfiles=1 images=4 not_scannable=2 pip_manifests=2 pip_development=1 unpinned_requirement_lines=3 issues=0'
  );
});

test('an archived asset is not scanned, a paused one is (its files are the restore gate)', () => {
  const t = collect();
  assert.equal(
    t.dockerfiles.some((d) => d.assetId === 'old'),
    false
  );
  assert.equal(t.images.includes('debian:9'), false);
  assert.equal(
    t.composeFiles.some((d) => d.assetId === 'stack'),
    true
  );
});

test('a file the inventory names but the repository lacks is an issue, not a smaller scan', () => {
  const lacking = (path) => {
    const files = { ...FILES };
    delete files[path];
    return collect({}, files).issues;
  };
  assert.deepEqual(lacking('svc/Dockerfile'), ['dockerfile_unreadable']);
  assert.deepEqual(lacking('stack/docker-compose.yml'), ['compose_unreadable']);
  assert.deepEqual(lacking('svc/nixpacks.toml'), ['nixpacks_unreadable']);
  assert.deepEqual(lacking('svc/requirements.txt'), [
    'pip_manifest_unreadable',
  ]);
});

test('an image or a path a command must not see is an issue', () => {
  const bad = INVENTORY.replace(
    "base_image: 'alpine:3.24'",
    "base_image: 'alpine:3.24; rm -rf /'"
  ).replace(
    "dockerfile_path: 'svc/Dockerfile'",
    "dockerfile_path: '../svc/Dockerfile'"
  );
  const t = collectShiftLeftTargets({
    inventory: loadInventory(bad),
    readText: (path) => (path in FILES ? FILES[path] : null),
  });
  assert.ok(t.issues.includes('image_ref_invalid'));
  assert.ok(t.issues.includes('path_invalid'));
  assert.equal(
    t.images.some((i) => i.includes(';')),
    false
  );
  assert.equal(t.dockerfiles.length, 0);
});

// --- the real inventory ------------------------------------------------------------------------------------

test('the real inventory covers the files the Phase 5 order names', () => {
  const targets = loadShiftLeftTargets({
    inventoryText: readRepo('security/security-inventory.yaml'),
    readText: readRepo,
  });
  assert.deepEqual(targets.issues, [], 'every path of the inventory exists');
  assert.deepEqual(targets.dockerfiles.map((d) => d.path).sort(), [
    'infra/contabo-chat-stack/apps/bot-worker/Dockerfile',
    'infra/contabo-chat-stack/apps/server/Dockerfile',
    'infra/pgbouncer/Dockerfile',
    'knowledge-service/Dockerfile',
  ]);
  const notScannable = targets.notScannable.map((n) => n.path).sort();
  assert.deepEqual(notScannable, [
    'infra/contabo-chat-stack/docker-compose.yml',
    'operation-service/nixpacks.toml',
    'railway-gateway/nixpacks.toml',
  ]);
  for (const image of targets.images)
    assert.equal(isImageRef(image), true, image);
  assert.ok(
    targets.images.includes('redis:7-alpine'),
    'the image the Compose file pulls'
  );
  assert.equal(
    targets.unresolvedImages,
    0,
    'every base image resolves to a name'
  );
  const pip = targets.pip.map((p) => p.path);
  for (const required of [
    'mt5-service/requirements.txt',
    'knowledge-service/requirements.txt',
    'davintrade-stack-d-and-e/engine-1-5-new/mcd_common/requirements.txt',
    'backend-stack-c/1_EA-and-backfill-worker-on-contabo-vps/v2_29_multi-timeframe-visualisation/requirements.txt',
  ]) {
    assert.ok(pip.includes(required), required);
  }
  assert.deepEqual(
    targets.pip.filter((p) => p.scope === 'development').map((p) => p.path),
    ['mt5-service/requirements-dev.txt']
  );
  const stackC = targets.pip.find((p) => p.path.startsWith('backend-stack-c/'));
  assert.equal(stackC.pinningRequired, true);
  assert.ok(
    stackC.unpinned >= 3,
    'Stack C still has its unpinned ranges (the pin decision is in the Phase 5 report)'
  );
});

// --- the command ---------------------------------------------------------------------------------------------------

const run = (args) =>
  spawnSync(
    process.execPath,
    [join(ROOT, 'scripts', 'security', 'shift-left-targets.mjs'), ...args],
    {
      encoding: 'utf8',
      timeout: 60000,
    }
  );

test('the command writes the lists and the staged Dockerfiles, and prints counts only', () => {
  const out = mkdtempSync(join(tmpdir(), 'shift-left-targets-'));
  try {
    const result = run(['--out', out]);
    assert.equal(result.status, 0, result.stdout);
    assert.match(
      result.stdout,
      /^targets: dockerfiles=4 images=\d+ not_scannable=3 pip_manifests=\d+ pip_development=1 unpinned_requirement_lines=\d+ issues=0\n$/
    );
    const lines = (name) =>
      readFileSync(join(out, name), 'utf8').split('\n').filter(Boolean);
    assert.equal(lines('dockerfiles.txt').length, 4);
    assert.ok(lines('images.txt').every(isImageRef));
    assert.deepEqual(lines('pip-dev-manifests.txt'), [
      'mt5-service/requirements-dev.txt',
    ]);
    assert.ok(
      lines('pip-manifests.txt').includes('mt5-service/requirements.txt')
    );
    const targets = JSON.parse(readFileSync(join(out, 'targets.json'), 'utf8'));
    assert.equal(targets.dockerfiles.length, 4);
    // one copy of each Dockerfile, so a single `trivy config` run reads exactly these
    targets.dockerfiles.forEach((d, index) => {
      assert.equal(
        readFileSync(join(out, 'iac', String(index + 1), 'Dockerfile'), 'utf8'),
        readFileSync(join(ROOT, d.path), 'utf8')
      );
    });
  } finally {
    rmSync(out, { recursive: true, force: true });
  }
});

test('the command refuses a missing or odd argument list', () => {
  for (const args of [
    [],
    ['--out'],
    ['--out', ''],
    ['--nope', 'x'],
    ['--out', 'a', 'b'],
  ]) {
    const result = run(args);
    assert.equal(result.status, 2, JSON.stringify(args));
    assert.match(result.stdout, /^error=usage/);
  }
});
