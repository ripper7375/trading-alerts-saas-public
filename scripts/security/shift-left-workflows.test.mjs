// Run: node --test 'scripts/security/*.test.mjs'
//
// The three Phase 5 workflows (Trivy, OSV-Scanner, custom Semgrep) cannot run here, so what a reviewer
// would check by eye is checked by test: the supply-chain rules of this repository (full-SHA pins, an
// allow-listed set of actions, a read-only token, the tool pinned by SHA-256 or digest and verified
// before it runs), the public-log rules (counts only, no upload, no shell injection) and that each
// workflow's path filter covers the files it scans. A workflow that breaks one fails here first.
//
// The three scanners are INFORMATIVE at first (the order: exit 0 until the baseline is triaged). When a
// later PR turns one on, it changes that one value and the matching assertion below, which is the point:
// the switch is a reviewed decision, not a drive-by edit.
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { compareVersions } from './security-semver-lite.mjs';
import { globToRegExp } from './semgrep-rules-lib.mjs';
import { loadShiftLeftTargets } from './shift-left-targets-lib.mjs';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const WORKFLOW_DIR = join(ROOT, '.github', 'workflows');
const FILES = {
  trivy: 'security-containers-iac.yml',
  osv: 'security-python-osv.yml',
  semgrep: 'security-sast-custom.yml',
};
const read = (path) =>
  readFileSync(join(ROOT, path), 'utf8').replace(/\r/g, '');
const workflow = (key) => read(`.github/workflows/${FILES[key]}`);
const ALL = Object.fromEntries(
  Object.keys(FILES).map((key) => [key, workflow(key)])
);

// the workflow without its comments: a comment may say "no SARIF" without there being any
const withoutComments = (yaml) =>
  yaml
    .split('\n')
    .filter((line) => !/^\s*#/.test(line))
    .map((line) => line.replace(/\s+#\s.*$/, ''))
    .join('\n');
const CODE = Object.fromEntries(
  Object.entries(ALL).map(([key, yaml]) => [key, withoutComments(yaml)])
);

// the `run:` scripts of a workflow, one string each
function runBlocks(yaml) {
  const lines = yaml.split('\n');
  const blocks = [];
  for (let i = 0; i < lines.length; i += 1) {
    const m = /^(\s*)(?:- )?run:\s*(.*)$/.exec(lines[i]);
    if (!m) continue;
    const indent = m[1].length;
    if (/^[|>][+-]?$/.test(m[2])) {
      const body = [];
      for (let j = i + 1; j < lines.length; j += 1) {
        if (lines[j].trim() !== '' && lines[j].search(/\S/) <= indent) break;
        body.push(lines[j]);
      }
      blocks.push(body.join('\n'));
    } else {
      blocks.push(m[2]);
    }
  }
  return blocks;
}

// the `paths:` list of `push:` and `pull_request:`
function pathFilters(yaml) {
  const out = { push: [], pull_request: [] };
  let section = null;
  let inPaths = false;
  for (const line of yaml.split('\n')) {
    if (/^(permissions|concurrency|env|jobs):/.test(line)) break;
    const trigger = /^ {2}(\w+):/.exec(line);
    if (trigger) {
      section = trigger[1];
      inPaths = false;
      continue;
    }
    if (/^ {4}paths:\s*$/.test(line)) {
      inPaths = true;
      continue;
    }
    if (/^ {4}\S/.test(line) && !/^ {4}paths:/.test(line)) inPaths = false;
    const item = /^ {6}- '([^']+)'\s*$/.exec(line);
    if (inPaths && item && section in out) out[section].push(item[1]);
  }
  return out;
}

const covered = (globs, path) =>
  globs.some((glob) => globToRegExp(glob).test(path));

// --- the rules of this repository's workflows --------------------------------------------------------------

test('each workflow has the read-only token and nothing wider, at the top and in its jobs', () => {
  for (const [key, yaml] of Object.entries(ALL)) {
    const top = yaml.split('\n');
    const at = top.findIndex((l) => l === 'permissions:');
    assert.ok(at !== -1, `${key}: a top-level permissions block`);
    const block = [];
    for (
      let i = at + 1;
      i < top.length && (top[i] === '' || top[i].startsWith(' '));
      i += 1
    ) {
      if (top[i] !== '') block.push(top[i]);
    }
    assert.deepEqual(block, ['  contents: read'], `${key}: contents read only`);
    assert.equal(
      yaml.split('\n').filter((l) => /^\s*permissions:/.test(l)).length,
      1,
      `${key}: no job widens it`
    );
    assert.doesNotMatch(yaml, /:\s*write\b/, `${key}: no write permission`);
    assert.doesNotMatch(yaml, /\bsecrets\./, `${key}: no secret is read`);
    assert.doesNotMatch(yaml, /GITHUB_TOKEN/, `${key}: no token is passed on`);
  }
});

test('only the two allow-listed GitHub-owned actions run, each pinned by full commit SHA with its version', () => {
  const allowed = new Set(['actions/checkout', 'actions/setup-node']);
  for (const [key, yaml] of Object.entries(ALL)) {
    const uses = [...yaml.matchAll(/^\s*(?:- )?uses:\s*(.+?)\s*$/gm)].map(
      (m) => m[1]
    );
    assert.ok(uses.length >= 2, key);
    for (const use of uses) {
      const m = /^([\w.-]+\/[\w.-]+)@([0-9a-f]{40}) # v\d+\.\d+\.\d+$/.exec(
        use
      );
      assert.ok(m, `${key}: ${use} must be action@<40-hex SHA> # vX.Y.Z`);
      assert.ok(allowed.has(m[1]), `${key}: ${m[1]} is not an allowed action`);
    }
    // the checkout does not keep the token in the workspace
    assert.match(
      yaml,
      /uses: actions\/checkout@[0-9a-f]{40} # v[\d.]+\n\s+with:\n\s+persist-credentials: false/,
      key
    );
  }
});

test('no workflow uploads anything, reaches the Security tab, or runs code from a pull request with a token', () => {
  for (const [key, yaml] of Object.entries(CODE)) {
    for (const forbidden of [
      /upload-artifact/,
      /download-artifact/,
      /actions\/cache/,
      /codeql-action/,
      /upload-sarif/,
      /github-script/,
      /pull_request_target/,
      /workflow_run/,
      /--sarif\b|--format[= ]sarif|\bsarif\b/i,
      /--format[= ]table\b/,
      /--debug\b|--verbose\b|--trace\b/,
    ]) {
      assert.doesNotMatch(yaml, forbidden, `${key}: ${forbidden}`);
    }
  }
});

test('no run script takes anything from the event: values come through the environment', () => {
  for (const [key, yaml] of Object.entries(ALL)) {
    for (const block of runBlocks(yaml)) {
      assert.doesNotMatch(
        block,
        /\$\{\{/,
        `${key}: an expression inside a script is a shell injection waiting for a name`
      );
    }
  }
});

test('every workflow has a name, a trigger on main and on a schedule or by hand, a timeout and a concurrency group', () => {
  const names = new Set();
  for (const file of readdirSync(WORKFLOW_DIR).filter((f) =>
    f.endsWith('.yml')
  )) {
    const name = /^name:\s*(.+)$/m.exec(read(`.github/workflows/${file}`))?.[1];
    assert.ok(name, `${file}: a name`);
    assert.equal(
      names.has(name),
      false,
      `${file}: the name ${name} is used twice`
    );
    names.add(name);
  }
  for (const [key, yaml] of Object.entries(CODE)) {
    assert.match(yaml, /^on:\n {2}push:\n {4}branches: \[main\]/m, key);
    assert.match(yaml, /^ {2}pull_request:\n {4}branches: \[main\]/m, key);
    assert.match(yaml, /^ {2}workflow_dispatch:/m, key);
    assert.match(
      yaml,
      /^concurrency:\n {2}group: \$\{\{ github\.workflow \}\}-\$\{\{ github\.ref \}\}\n {2}cancel-in-progress: true/m,
      key
    );
    assert.match(yaml, /timeout-minutes: \d+/, key);
  }
  assert.match(CODE.trivy, /schedule:\n {4}- cron: '\d+ \d+ \* \* \d'/);
  assert.match(CODE.osv, /schedule:\n {4}- cron: '\d+ \d+ \* \* \d'/);
});

// --- the tools ------------------------------------------------------------------------------------------------

const envValue = (yaml, name) =>
  new RegExp(`^  ${name}: '([^']*)'$`, 'm').exec(yaml)?.[1];

test('Trivy: a pinned release after every known fix, a SHA-256, and the checksum verified before the binary is used', () => {
  const version = envValue(ALL.trivy, 'TRIVY_VERSION');
  assert.match(version, /^\d+\.\d+\.\d+$/);
  // GHSA-mcj4-mphf-j9ff is fixed in 0.71.1 and GHSA-8rc5-4fr6-64pw in 0.72.0; 0.69.4 to 0.69.6 were
  // the compromised releases of March 2026 (GHSA-69fq-xp46-6x23)
  assert.ok(
    compareVersions(version, '0.72.0') >= 0,
    'older than the last known fix'
  );
  for (const bad of ['0.69.4', '0.69.5', '0.69.6'])
    assert.notEqual(version, bad);
  assert.match(envValue(ALL.trivy, 'TRIVY_SHA256'), /^[0-9a-f]{64}$/);
  const install = runBlocks(ALL.trivy).find(
    (b) => b.includes('trivy.tar.gz') && b.includes('curl')
  );
  assert.ok(install, 'the install step');
  assert.match(
    install,
    /releases\/download\/v\$\{TRIVY_VERSION\}\/trivy_\$\{TRIVY_VERSION\}_Linux-64bit\.tar\.gz/
  );
  assert.match(install, /--proto '=https' --tlsv1\.2/);
  assert.ok(
    install.indexOf('sha256sum --check --strict') > install.indexOf('curl') &&
      install.indexOf('sha256sum --check --strict') <
        install.indexOf('tar -xzf'),
    'the checksum is verified between the download and the unpacking'
  );
  assert.match(
    install,
    /echo "\$\{TRIVY_SHA256\}  trivy\.tar\.gz" \| sha256sum --check --strict/
  );
  assert.equal(
    envValue(ALL.trivy, 'TRIVY_BLOCKING'),
    'false',
    'informative at first'
  );
});

test('OSV-Scanner: a pinned release, a SHA-256, and the checksum verified before the binary may run', () => {
  const version = envValue(ALL.osv, 'OSV_SCANNER_VERSION');
  assert.match(version, /^\d+\.\d+\.\d+$/);
  assert.match(envValue(ALL.osv, 'OSV_SCANNER_SHA256'), /^[0-9a-f]{64}$/);
  const install = runBlocks(ALL.osv).find((b) =>
    b.includes('osv-scanner_linux_amd64')
  );
  assert.ok(install, 'the install step');
  assert.match(
    install,
    /releases\/download\/v\$\{OSV_SCANNER_VERSION\}\/osv-scanner_linux_amd64/
  );
  assert.match(install, /--proto '=https' --tlsv1\.2/);
  assert.ok(
    install.indexOf('sha256sum --check --strict') < install.indexOf('chmod +x'),
    'verified before it may run'
  );
  assert.equal(
    envValue(ALL.osv, 'OSV_BLOCKING'),
    'false',
    'informative at first'
  );
});

test('Semgrep: an image pinned by digest, the same version the comment names, metrics and the version check off', () => {
  const image = envValue(ALL.semgrep, 'SEMGREP_IMAGE');
  assert.match(image, /^semgrep\/semgrep@sha256:[0-9a-f]{64}$/);
  assert.doesNotMatch(image, /:latest/);
  assert.match(envValue(ALL.semgrep, 'SEMGREP_VERSION'), /^\d+\.\d+\.\d+$/);
  assert.equal(envValue(ALL.semgrep, 'SEMGREP_SEND_METRICS'), 'off');
  assert.equal(
    envValue(ALL.semgrep, 'SEMGREP_BLOCKING'),
    'false',
    'informative at first'
  );
  const scans = runBlocks(ALL.semgrep).filter((b) => b.includes('docker run'));
  assert.equal(scans.length, 2, 'the fixtures, then the repository');
  for (const scan of scans) {
    assert.match(scan, /"\$SEMGREP_IMAGE"/);
    assert.match(scan, /--metrics=off --disable-version-check/);
    assert.match(scan, /--json --output \/out\/(?:fixtures|repo)\.json/);
    assert.match(
      scan,
      /> \/dev\/null 2>&1/,
      "Semgrep's own output never reaches the public log"
    );
  }
  assert.match(scans[0], /--config \/rules\/semgrep-rules\.yml/);
  assert.match(scans[1], /--config security\/semgrep-rules\.yml/);
  // the repository is mounted read-only, and the fixtures are outside it
  assert.match(scans[1], /-v "\$GITHUB_WORKSPACE:\/src:ro"/);
  assert.match(scans[0], /-v "\$RUNNER_TEMP\/semgrep-fixtures:\/src:ro"/);
});

// --- counts only ---------------------------------------------------------------------------------------------

test('every scanner writes to a file, and the log gets the counts of shift-left-counts.mjs only', () => {
  const trivy = runBlocks(ALL.trivy).join('\n');
  assert.match(
    trivy,
    /trivy config --quiet --format json --output "\$RUNNER_TEMP\/trivy-out\/config\.json"/
  );
  assert.match(
    trivy,
    /trivy image --quiet --scanners vuln --image-src remote --format json/
  );
  assert.match(trivy, /--output "\$RUNNER_TEMP\/trivy-out\/image-\$n\.json"/);
  assert.match(trivy, /shift-left-counts\.mjs trivy/);
  const osv = runBlocks(ALL.osv).join('\n');
  assert.match(osv, /osv-scanner scan source --format json/);
  assert.match(osv, /--output-file "\$RUNNER_TEMP\/osv-out\/osv\.json"/);
  assert.match(osv, /> \/dev\/null 2> "\$RUNNER_TEMP\/osv-out\/osv\.err"/);
  assert.match(osv, /shift-left-counts\.mjs osv/);
  const semgrep = runBlocks(ALL.semgrep).join('\n');
  assert.match(semgrep, /shift-left-counts\.mjs semgrep-fixtures/);
  assert.match(semgrep, /shift-left-counts\.mjs semgrep /);
  // nothing prints a report: no cat, head or jq of a JSON file, and no step echoes a scanner's output
  for (const [key, yaml] of Object.entries(ALL)) {
    for (const block of runBlocks(yaml)) {
      assert.doesNotMatch(
        block,
        /\b(?:cat|head|tail|jq|less|more)\b[^\n]*\.(?:json|err)\b/,
        `${key}: a report is printed`
      );
    }
  }
});

test('the scripts and test files a workflow runs exist', () => {
  for (const [key, yaml] of Object.entries(ALL)) {
    for (const path of new Set(
      yaml.match(/scripts\/security\/[\w.-]+\.mjs/g) ?? []
    )) {
      assert.ok(existsSync(join(ROOT, path)), `${key}: ${path}`);
    }
    for (const path of new Set(
      yaml.match(/security\/semgrep-rules\.yml|\.semgrepignore/g) ?? []
    )) {
      assert.ok(existsSync(join(ROOT, path)), `${key}: ${path}`);
    }
  }
});

// --- what each workflow reads is what its trigger watches --------------------------------------------------

test('the path filters of a workflow cover every file it scans, on a push and on a pull request', () => {
  const targets = loadShiftLeftTargets({
    inventoryText: read('security/security-inventory.yaml'),
    readText: (path) => (existsSync(join(ROOT, path)) ? read(path) : null),
  });
  const trivyFiles = [
    ...targets.dockerfiles.map((d) => d.path),
    ...targets.notScannable.map((n) => n.path),
  ];
  const osvFiles = targets.pip.map((p) => p.path);
  const semgrepFiles = [
    'security/semgrep-rules.yml',
    '.semgrepignore',
    'scripts/security/semgrep-fixtures.mjs',
    'lib/platform/metering/ledger-store.ts',
    'money-service/src/stripe/stripe-webhook.controller.ts',
    'app/api/cron/world-gold/route.ts',
  ];
  for (const [key, files] of [
    ['trivy', trivyFiles],
    ['osv', osvFiles],
    ['semgrep', semgrepFiles],
  ]) {
    const filters = pathFilters(ALL[key]);
    for (const trigger of ['push', 'pull_request']) {
      assert.ok(
        filters[trigger].length > 0,
        `${key}: a path filter on ${trigger}`
      );
      for (const file of files) {
        assert.ok(
          covered(filters[trigger], file),
          `${key} ${trigger}: ${file} is not watched`
        );
      }
      // the workflow, the inventory and its own helpers
      for (const own of [
        `.github/workflows/${FILES[key]}`,
        'scripts/security/shift-left-counts.mjs',
      ]) {
        assert.ok(
          covered(filters[trigger], own),
          `${key} ${trigger}: ${own} is not watched`
        );
      }
    }
    assert.deepEqual(
      filters.push,
      filters.pull_request,
      `${key}: both triggers watch the same paths`
    );
  }
  assert.ok(
    trivyFiles.length >= 7,
    'the four Dockerfiles, the Compose file and two nixpacks files'
  );
  assert.ok(osvFiles.length >= 6, 'the Python manifests');
});

test('the helper tests a workflow runs on are the real ones', () => {
  for (const [key, yaml] of Object.entries(ALL)) {
    const tests = runBlocks(yaml).find((b) => b.startsWith('node --test'));
    assert.ok(tests, `${key}: a unit-test step`);
    for (const path of tests.match(/scripts\/security\/[\w.-]+\.test\.mjs/g)) {
      assert.ok(existsSync(join(ROOT, path)), `${key}: ${path}`);
    }
  }
});

test('the workflows README says what the three scans are', () => {
  const readme = read('.github/workflows/README.md');
  for (const file of Object.values(FILES)) {
    assert.ok(
      readme.includes(file),
      `${file} is named in .github/workflows/README.md`
    );
  }
});
