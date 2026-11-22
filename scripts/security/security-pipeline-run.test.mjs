// Run: node --test 'scripts/security/*.test.mjs'
//
// One whole sweep of the private security pipeline, end to end: a small in-memory
// repository, fake `pnpm audit` and `npm audit` output, and a fake network (OSV,
// KEV, EPSS, the Node index, the Dependabot API and LINE). Nothing real is read
// or sent. Package names and identifiers are invented; the assertions check that
// they reach the private reports and never stdout or a LINE message.
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  USAGE,
  UsageError,
  parseArgs,
  runPipeline,
} from './security-pipeline-run.mjs';
import { findPrivacyViolations } from './line-notifier-lib.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const CLI = join(HERE, 'run-security-pipeline.mjs');
const ROOT = join(HERE, '..', '..');

// Strings that must never reach stdout or a LINE message.
const SENTINELS = [
  'trans-pkg',
  'npm-vuln',
  'py-vuln',
  'mal-pkg',
  'ignored-pkg',
  'direct-pkg',
  'sentinel-cli',
  'GHSA-aaaa-bbbb-cccc',
  'GHSA-dddd-eeee-ffff',
  'GHSA-iiii-gggg-nnnn',
  'GHSA-pypy-vuln-0001',
  'CVE-2099-0001',
  'CVE-2099-0002',
  'CVE-2099-0004',
  'MAL-2099-0001',
  'PYSEC-2099-1',
];
const LINE_TOKEN = 'fake-channel-token-0123456789abcdefghijklmnopqrstuvwxyz';
const LINE_USER = 'U0123456789abcdef0123456789abcdef';
const GITHUB_TOKEN = 'fake-github-token-for-tests-only-0123456789';
const REPORTS = '/repo/davintrade-security-monitoring-pipeline/reports';

// --- the fixture repository ---------------------------------------------------------

const INVENTORY = `
schema_version: '3.0'
updated_at: '2026-11-21'
toolchain_pins:
  pnpm_version: '10.34.9'
  node_runtime_floors:
    v24_min_patch: '24.22.3'
    v22_min_patch: '22.23.5'
expected_public_endpoints:
  - 'app.example (fixture)'
assets:
  - id: app-web
    name: 'Fixture web app'
    lifecycle: production
    exposure_tier: 1
    escalation_required: false
    ecosystems:
      - type: pnpm
        manifest_path: 'package.json'
        lockfile_path: 'pnpm-lock.yaml'
        include_workspace_importers:
          - '.'
    build_only_packages:
      - 'sentinel-cli'
    runtime:
      type: nodejs
      declared_range: '24.x'
  - id: svc-a
    name: 'Fixture service'
    lifecycle: production
    exposure_tier: 1
    escalation_required: true
    ecosystems:
      - type: npm
        manifest_path: 'svc-a/package.json'
        lockfile_path: 'svc-a/package-lock.json'
    runtime:
      type: nodejs
      declared_range: '24.x'
  - id: svc-py
    name: 'Fixture python service'
    lifecycle: production
    exposure_tier: 2
    ecosystems:
      - type: pip
        manifest_path: 'py/requirements.txt'
        pinning_required: true
  - id: old-mobile
    name: 'Excluded app'
    lifecycle: pre_cutover
    exposure_tier: 4
    ecosystems:
      - type: npm
        manifest_path: 'mobile-app/package.json'
        lockfile_path: 'mobile-app/package-lock.json'
  - id: box
    name: 'Docker only'
    lifecycle: paused
    exposure_tier: 3
    ecosystems:
      - type: docker
        dockerfile_path: 'box/Dockerfile'
        base_image: 'alpine:3.24'
excluded_paths:
  - 'mobile-app/**'
`;

const PNPM_LOCK = `lockfileVersion: '9.0'

importers:

  .:
    dependencies:
      direct-pkg:
        specifier: ^1.0.0
        version: 1.0.0

packages:

  direct-pkg@1.0.0:
    resolution: {integrity: sha512-abc}

  trans-pkg@2.0.0:
    resolution: {integrity: sha512-abc}

  ignored-pkg@1.0.0:
    resolution: {integrity: sha512-abc}

  sentinel-cli@3.0.0:
    resolution: {integrity: sha512-abc}

  mal-pkg@1.0.0:
    resolution: {integrity: sha512-abc}

snapshots:

  direct-pkg@1.0.0: {}
`;

const NPM_LOCK = {
  lockfileVersion: 3,
  packages: {
    '': { dependencies: { 'app-dep': '^1.0.0' } },
    'node_modules/app-dep': {
      version: '1.4.0',
      dependencies: { 'npm-vuln': '~6.15.1' },
    },
    'node_modules/npm-vuln': { version: '6.15.1' },
  },
};

const BASE_FILES = {
  '/repo/security/security-inventory.yaml': INVENTORY,
  '/repo/security/vex-registry.json': JSON.stringify({
    schema_version: '1.0',
    updated_at: '2026-11-21',
    readme: 'fixture',
    statements: [],
  }),
  '/repo/package.json': JSON.stringify({
    dependencies: { 'direct-pkg': '^1.0.0' },
    pnpm: {
      overrides: { 'direct-pkg': '1.0.0' },
      auditConfig: { ignoreGhsas: ['GHSA-iiii-gggg-nnnn'] },
    },
  }),
  '/repo/pnpm-lock.yaml': PNPM_LOCK,
  '/repo/svc-a/package.json': JSON.stringify({
    dependencies: { 'app-dep': '^1.0.0' },
  }),
  '/repo/svc-a/package-lock.json': JSON.stringify(NPM_LOCK),
  '/repo/py/requirements.txt':
    'py-vuln==2.31.0\npytest==7.4.3\nunpinned-lib>=1.0\n',
};

const pnpmAdvisory = (id, name, over = {}) => ({
  id,
  module_name: name,
  severity: 'high',
  title: 'Sentinel advisory title',
  url: `https://github.com/advisories/${over.ghsa}`,
  github_advisory_id: over.ghsa,
  cves: over.cves ?? [],
  cwe: ['CWE-79'],
  vulnerable_versions: '<9.0.0',
  patched_versions: '>=9.0.1',
  findings: [{ version: over.version ?? '1.0.0', paths: over.paths }],
  ...over.extra,
});
const PNPM_AUDIT = {
  advisories: {
    1: pnpmAdvisory(1, 'trans-pkg', {
      ghsa: 'GHSA-aaaa-bbbb-cccc',
      cves: ['CVE-2099-0001'],
      version: '2.0.0',
      paths: ['.>direct-pkg>trans-pkg'],
      extra: { patched_versions: '>=2.0.1' },
    }),
    2: pnpmAdvisory(2, 'sentinel-cli', {
      ghsa: 'GHSA-cccc-llll-iiii',
      version: '3.0.0',
      paths: ['.>sentinel-cli'],
    }),
    3: pnpmAdvisory(3, 'direct-pkg', {
      ghsa: 'GHSA-dddd-iiii-rrrr',
      paths: ['.>direct-pkg'],
      extra: { severity: 'moderate' },
    }),
  },
  muted: [],
  metadata: {
    vulnerabilities: { info: 0, low: 0, moderate: 2, high: 3, critical: 0 },
  },
};
const NPM_AUDIT = {
  auditReportVersion: 2,
  vulnerabilities: {
    'npm-vuln': {
      name: 'npm-vuln',
      severity: 'high',
      isDirect: false,
      via: [
        {
          source: 7001,
          name: 'npm-vuln',
          title: 'Sentinel advisory title',
          url: 'https://github.com/advisories/GHSA-dddd-eeee-ffff',
          severity: 'high',
          cwe: ['CWE-79'],
          cvss: { score: 7.5 },
          range: '>=6.0.0 <6.16.0',
        },
      ],
      effects: ['app-dep'],
      range: '>=6.0.0 <6.16.0',
      nodes: ['node_modules/npm-vuln'],
    },
  },
  metadata: {
    vulnerabilities: {
      info: 0,
      low: 0,
      moderate: 0,
      high: 1,
      critical: 0,
      total: 1,
    },
  },
};

const osvRecord = (id, over = {}) => ({
  id,
  modified: '2026-11-18T10:00:00Z',
  aliases: [],
  summary: 'Sentinel summary',
  database_specific: { severity: 'HIGH', cwe_ids: ['CWE-79'] },
  affected: [],
  ...over,
});
const affects = (ecosystem, name, events) => [
  { package: { ecosystem, name }, ranges: [{ type: 'ECOSYSTEM', events }] },
];
const RECORDS = {
  'GHSA-aaaa-bbbb-cccc': osvRecord('GHSA-aaaa-bbbb-cccc', {
    aliases: ['CVE-2099-0001'],
    affected: affects('npm', 'trans-pkg', [
      { introduced: '0' },
      { fixed: '2.0.1' },
    ]),
  }),
  'GHSA-dddd-eeee-ffff': osvRecord('GHSA-dddd-eeee-ffff', {
    aliases: ['CVE-2099-0002'],
  }),
  'MAL-2099-0001': osvRecord('MAL-2099-0001', {
    summary: 'Malicious code in mal-pkg',
    database_specific: {},
  }),
  'PYSEC-2099-1': osvRecord('PYSEC-2099-1', {
    aliases: ['GHSA-pypy-vuln-0001', 'CVE-2099-0003'],
    database_specific: {},
    affected: affects('PyPI', 'py-vuln', [
      { introduced: '0' },
      { fixed: '2.32.0' },
    ]),
  }),
  'GHSA-pypy-vuln-0001': osvRecord('GHSA-pypy-vuln-0001', {
    aliases: ['PYSEC-2099-1', 'CVE-2099-0003'],
    database_specific: { severity: 'MODERATE', cwe_ids: ['CWE-79'] },
  }),
  'GHSA-iiii-gggg-nnnn': osvRecord('GHSA-iiii-gggg-nnnn', {
    aliases: ['CVE-2099-0004'],
    affected: affects('npm', 'ignored-pkg', [
      { introduced: '0' },
      { fixed: '1.1.0' },
    ]),
  }),
};
const OSV_HITS = {
  'npm|mal-pkg|1.0.0': ['MAL-2099-0001'],
  'PyPI|py-vuln|2.31.0': ['PYSEC-2099-1', 'GHSA-pypy-vuln-0001'],
};
const NODE_INDEX = [
  { version: 'v24.22.3', date: '2026-11-11', security: true },
  { version: 'v22.23.5', date: '2026-11-11', security: true },
];

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json' },
  });
const norm = (path) => String(path).replaceAll('\\', '/');

function memoryFs(initial) {
  const files = new Map(Object.entries(initial));
  return {
    files,
    readText: (p) => files.get(norm(p)) ?? null,
    writeText: (p, t) => void files.set(norm(p), t),
    appendText: (p, t) =>
      void files.set(norm(p), (files.get(norm(p)) ?? '') + t),
    mkdirp: () => {},
  };
}

function harness({
  files = {},
  records = RECORDS,
  pnpm = PNPM_AUDIT,
  npm = NPM_AUDIT,
  npmFull = null, // the answer to an audit that includes development dependencies
  osvHits = OSV_HITS,
  kev = ['CVE-2099-0009'],
  lineStatus = 200,
  alerts = [],
  credential = null,
  networkAllowed = true,
} = {}) {
  const fs = memoryFs({ ...BASE_FILES, ...files });
  const clock = { t: Date.parse('2026-11-21T12:00:00Z') };
  const fetchCalls = [];
  const commandCalls = [];
  const logs = [];
  const route = (url, init) => {
    const u = new URL(url);
    if (u.host === 'api.osv.dev' && u.pathname === '/v1/querybatch') {
      const { queries } = JSON.parse(init.body);
      return json({
        results: queries.map((q) => ({
          vulns: (
            osvHits[`${q.package.ecosystem}|${q.package.name}|${q.version}`] ??
            []
          ).map((id) => ({ id })),
        })),
      });
    }
    if (u.host === 'api.osv.dev' && u.pathname.startsWith('/v1/vulns/')) {
      const record = records[decodeURIComponent(u.pathname.split('/').pop())];
      return record ? json(record) : json({ code: 5 }, 404);
    }
    if (u.host === 'www.cisa.gov')
      return json({
        catalogVersion: 'test',
        vulnerabilities: kev.map((cveID) => ({ cveID })),
      });
    if (u.host === 'api.first.org') return json({ status: 'OK', data: [] });
    if (u.host === 'nodejs.org') return json(NODE_INDEX);
    if (u.host === 'api.github.com') return json(alerts);
    if (u.host === 'api.line.me')
      return new Response('{}', { status: lineStatus });
    throw new Error('unexpected network call');
  };
  const deps = {
    root: '/repo',
    fs,
    runCommand: (command, args, { cwd }) => {
      commandCalls.push({ command, args, cwd: norm(cwd) });
      if (command === 'pnpm' && args[0] === '--version')
        return { status: 0, stdout: '10.34.9\n' };
      if (command === 'pnpm')
        return { status: 1, stdout: JSON.stringify(pnpm) };
      const answer =
        npmFull !== null && !args.includes('--omit=dev') ? npmFull : npm;
      return {
        status: 1,
        stdout: typeof answer === 'string' ? answer : JSON.stringify(answer),
      };
    },
    fetchImpl: async (url, init = {}) => {
      fetchCalls.push({ url: String(url), init });
      if (!networkAllowed) throw new Error('no network in this test');
      return route(String(url), init);
    },
    now: () => new Date(clock.t),
    sleep: async () => {},
    log: (line) => logs.push(line),
    credentialFill: () => credential,
    nodeVersion: 'v24.22.3',
  };
  return {
    fs,
    clock,
    fetchCalls,
    commandCalls,
    logs,
    deps,
    run: (argv = [], env = {}) => runPipeline({ argv, env, deps }),
    stdout: () => logs.join('\n'),
    json: (name) => JSON.parse(fs.files.get(`${REPORTS}/${name}`)),
    file: (name) => fs.files.get(`${REPORTS}/${name}`),
    lineCalls: () =>
      fetchCalls.filter((c) => new URL(c.url).host === 'api.line.me'),
  };
}

const LINE_ENV = `LINE_CHANNEL_ACCESS_TOKEN=${LINE_TOKEN}\nLINE_TARGET_USER_ID=${LINE_USER}\nNEXTAUTH_SECRET=must-never-be-read\n`;
const noSentinels = (text) => {
  for (const s of SENTINELS)
    assert.equal(text.includes(s), false, `leaked: ${s}`);
};

// --- arguments --------------------------------------------------------------------------

test('parseArgs reads flags, values and the = form, and refuses the rest', () => {
  const o = parseArgs([
    '--notify-line',
    '--heartbeat',
    '--offline',
    '--assets',
    'a-b,c',
    '--repo=o/r',
    '--pipeline-dir',
    '/x',
    '--secrets-file=/y',
  ]);
  assert.deepEqual(
    {
      n: o.notifyLine,
      h: o.heartbeat,
      off: o.offline,
      a: o.assets,
      r: o.repo,
      p: o.pipelineDir,
      s: o.secretsFile,
      d: o.dryRunLine,
    },
    {
      n: true,
      h: true,
      off: true,
      a: ['a-b', 'c'],
      r: 'o/r',
      p: '/x',
      s: '/y',
      d: false,
    }
  );
  assert.equal(parseArgs(['-h']).help, true);
  for (const bad of [
    ['--nope'],
    ['--assets'],
    ['--assets', 'Bad Id'],
    ['--repo', 'nonsense'],
    ['--notify-line=1'],
    ['positional'],
  ]) {
    assert.throws(() => parseArgs(bad), UsageError, JSON.stringify(bad));
  }
});

test('usage and setup errors exit 2; --help exits 0', async () => {
  const bad = harness();
  assert.equal(await bad.run(['--bogus']), 2);
  assert.match(bad.stdout(), /error=usage/);
  const help = harness();
  assert.equal(await help.run(['--help']), 0);
  assert.match(help.stdout(), /Exit codes:/);
  const unknown = harness();
  assert.equal(await unknown.run(['--assets', 'nope']), 2);
  assert.match(unknown.stdout(), /error=unknown_asset/);
  const noInventory = harness();
  noInventory.fs.files.delete('/repo/security/security-inventory.yaml');
  assert.equal(await noInventory.run([]), 2);
  assert.match(noInventory.stdout(), /error=inventory_not_found/);
  const broken = harness({
    files: {
      '/repo/security/security-inventory.yaml': 'schema_version: [oops',
    },
  });
  assert.equal(await broken.run([]), 2);
  assert.match(broken.stdout(), /error=inventory_unreadable/);
});

// --- a whole sweep -------------------------------------------------------------------------

test('a sweep scores every source, writes the private reports and prints counts only', async () => {
  const h = harness();
  assert.equal(await h.run([]), 0);

  const out = h.stdout();
  noSentinels(out);
  assert.match(out, /findings: P0=1 P1=2 P2=0 P3=4 withdrawn=0 total=7/);
  assert.match(out, /matchers: ok=3 failed=0 skipped=2/);
  assert.match(out, /assets: total=5 scanned=3 skipped=2/);
  assert.match(
    out,
    /signals: kev=0 malicious=1 rule5_escalations=0 accepted_ignores=1/
  );
  assert.match(out, /line: off/);
  assert.match(out, /pinning: unpinned_lines=1/);
  assert.equal(findPrivacyViolations(out).length, 0);

  const posture = h.json('latest-security-posture.json');
  assert.equal(posture.findings.length, 7);
  assert.equal(posture.run.degraded, false);
  assert.deepEqual(posture.summary.tiers, {
    P0: 1,
    P1: 2,
    P2: 0,
    P3: 4,
    WITHDRAWN: 0,
  });
  const by = (name) => posture.findings.find((f) => f.packageName === name);
  assert.equal(by('mal-pkg').priority, 'P0');
  assert.equal(by('mal-pkg').rule, 'R-3');
  assert.equal(by('trans-pkg').rule, 'R-8');
  assert.deepEqual(by('trans-pkg').advisoryIds.slice(0, 2), [
    'GHSA-aaaa-bbbb-cccc',
    'CVE-2099-0001',
  ]);
  assert.equal(by('sentinel-cli').rule, 'R-2');
  assert.equal(by('sentinel-cli').scope, 'build_only');
  assert.equal(by('npm-vuln').rule, 'R-8');
  assert.equal(by('npm-vuln').resolution, 'TRANSITIVE_RANGE_BLOCKS_FIX');
  assert.equal(by('npm-vuln').rule5Boundary, true);
  assert.equal(by('ignored-pkg').rule, 'R-1');
  assert.equal(by('ignored-pkg').acceptedIgnore, true);
  assert.equal(by('py-vuln').priority, 'P3');
  assert.deepEqual(posture.parity.pnpm_gate, { high: 2, critical: 0 });
  assert.deepEqual(posture.pinning, [
    { assetId: 'svc-py', pinned: 2, unpinned: 1, pinningRequired: true },
  ]);
  const ids = posture.matchers.items.map((m) => `${m.id}=${m.status}`);
  assert.ok(ids.includes('old-mobile:npm=skipped'));
  assert.ok(ids.includes('box:docker=skipped'));

  // details are in the private report
  const md = h.file('latest-security-posture.md');
  assert.match(md, /GHSA-aaaa-bbbb-cccc/);
  assert.match(md, /trans-pkg@2\.0\.0/);
  assert.match(md, /Accepted ignores/);
  // counts-only history line, and no alert state without a LINE flag
  const history = JSON.parse(h.file('sweep-history.jsonl').trim());
  assert.equal(history.total, 7);
  noSentinels(h.file('sweep-history.jsonl'));
  assert.equal(h.fs.files.has(`${REPORTS}/alert-state.json`), false);
  assert.equal(h.lineCalls().length, 0);
  // the audit tools ran where expected
  assert.ok(
    h.commandCalls.some(
      (c) =>
        c.command === 'pnpm' && c.args.includes('--prod') && c.cwd === '/repo'
    )
  );
  assert.ok(
    h.commandCalls.some(
      (c) =>
        c.command === 'npm' &&
        c.args.includes('--package-lock-only') &&
        c.cwd === '/repo/svc-a'
    )
  );
});

test('--dry-run-line writes the exact preview, sends nothing and leaves the alert state alone', async () => {
  const h = harness({ files: { '/repo/.env.local': LINE_ENV } });
  assert.equal(await h.run(['--dry-run-line']), 0);
  assert.equal(h.lineCalls().length, 0);
  assert.equal(h.fs.files.has(`${REPORTS}/alert-state.json`), false);
  const preview = h.file('last-line-message-preview.txt');
  assert.match(preview, /Nothing was sent\./);
  assert.match(preview, /Malicious-package record: 1 \(app-web\)/);
  assert.match(preview, /New P1: 2 \(app-web, svc-a\)/);
  assert.match(
    preview,
    /✅ \[DavinTrade Security Heartbeat\] 2026-11-21 12:00 UTC/
  );
  assert.match(
    preview,
    /Sweep: OK \| assets scanned 3\/5 \| matchers ok 3, failed 0/
  );
  noSentinels(preview);
  assert.equal(
    preview.includes(LINE_TOKEN) || preview.includes(LINE_USER),
    false
  );
  assert.equal(
    findPrivacyViolations(
      preview
        .split('\n')
        .filter((l) => !l.startsWith('#'))
        .join('\n')
    ).length,
    0
  );
  noSentinels(h.stdout());
  assert.match(
    h.stdout(),
    /line: dry run, preview written \(alerts=3 heartbeat=due\)/
  );
});

test('--notify-line sends one push, records the state, and the next runs deduplicate', async () => {
  const h = harness({ files: { '/repo/.env.local': LINE_ENV } });
  assert.equal(await h.run(['--notify-line', '--heartbeat']), 0);
  assert.equal(h.lineCalls().length, 1);
  const call = h.lineCalls()[0];
  assert.equal(call.init.headers.Authorization, `Bearer ${LINE_TOKEN}`);
  const body = JSON.parse(call.init.body);
  assert.equal(body.to, LINE_USER);
  assert.equal(body.messages.length, 2);
  for (const message of body.messages) {
    noSentinels(message.text);
    assert.equal(findPrivacyViolations(message.text).length, 0);
  }
  assert.match(h.stdout(), /line: sent \(alerts=3 heartbeat=yes\)/);
  const state = h.json('alert-state.json');
  assert.equal(state.last_heartbeat_at, '2026-11-21T12:00:00.000Z');
  assert.equal(Object.keys(state.findings).length, 7);
  // the token and the user id never reach stdout, a report or the state
  for (const text of [
    h.stdout(),
    h.file('latest-security-posture.json'),
    h.file('latest-security-posture.md'),
    JSON.stringify(state),
  ]) {
    assert.equal(
      text.includes(LINE_TOKEN) ||
        text.includes(LINE_USER) ||
        text.includes('must-never-be-read'),
      false
    );
  }

  // two hours later, the same findings, --heartbeat again: nothing to send
  h.clock.t += 2 * 3600 * 1000;
  h.logs.length = 0;
  assert.equal(await h.run(['--notify-line', '--heartbeat']), 0);
  assert.equal(h.lineCalls().length, 1, 'deduplicated: no second push');
  assert.match(
    h.stdout(),
    /line: nothing to send \(alerts=0 heartbeat=deduplicated\)/
  );

  // 25 hours after the first: no alert, but the heartbeat is due again
  h.clock.t += 23 * 3600 * 1000;
  h.logs.length = 0;
  assert.equal(await h.run(['--notify-line', '--heartbeat']), 0);
  assert.equal(h.lineCalls().length, 2);
  const daily = JSON.parse(h.lineCalls()[1].init.body);
  assert.equal(daily.messages.length, 1);
  assert.match(
    daily.messages[0].text,
    /^✅ \[DavinTrade Security Heartbeat\] 2026-11-22 13:00 UTC/
  );
  assert.match(daily.messages[0].text, /Last heartbeat: 25\.0 h ago/);
});

test('--notify-line without credentials writes the preview and exits cleanly', async () => {
  const h = harness();
  assert.equal(await h.run(['--notify-line', '--heartbeat']), 0);
  assert.equal(h.lineCalls().length, 0);
  assert.equal(
    h.fs.files.has(`${REPORTS}/alert-state.json`),
    false,
    'the alerts stay pending'
  );
  assert.match(
    h.file('last-line-message-preview.txt'),
    /the LINE credentials are not configured/
  );
  assert.match(h.stdout(), /line: credentials not configured, preview written/);
});

test('a failed push exits 3, keeps the state and never prints the token', async () => {
  const h = harness({
    files: { '/repo/.env.local': LINE_ENV },
    lineStatus: 401,
  });
  assert.equal(await h.run(['--notify-line']), 3);
  assert.match(h.stdout(), /line: send failed \(auth_failed\)/);
  assert.equal(h.fs.files.has(`${REPORTS}/alert-state.json`), false);
  assert.equal(h.stdout().includes(LINE_TOKEN), false);
});

test('the LINE secrets can come from the environment instead of the file', async () => {
  const h = harness();
  await h.run(['--notify-line'], {
    LINE_CHANNEL_ACCESS_TOKEN: LINE_TOKEN,
    LINE_TARGET_USER_ID: LINE_USER,
  });
  assert.equal(h.lineCalls().length, 1);
});

// --- degraded modes ----------------------------------------------------------------------------

test('--offline makes no network call, skips the audit tools and reports a degraded sweep', async () => {
  const h = harness({ networkAllowed: false });
  assert.equal(
    await h.run(['--offline', '--dry-run-line', '--with-dependabot']),
    0
  );
  assert.equal(h.fetchCalls.length, 0);
  assert.equal(h.commandCalls.length, 0);
  const posture = h.json('latest-security-posture.json');
  assert.equal(posture.run.offline, true);
  assert.equal(posture.run.degraded, true);
  assert.equal(posture.dependabot.status, 'skipped');
  assert.equal(posture.dependabot.detail, 'offline');
  assert.match(
    h.file('last-line-message-preview.txt'),
    /Sweep: DEGRADED \(offline\)/
  );
  assert.match(h.stdout(), /mode=offline degraded=yes/);
});

test('a matcher that fails degrades the sweep without stopping it', async () => {
  const h = harness({ npm: '' });
  assert.equal(await h.run(['--dry-run-line']), 0);
  const posture = h.json('latest-security-posture.json');
  assert.equal(posture.matchers.failed, 1);
  assert.equal(posture.run.degraded, true);
  assert.ok(
    posture.matchers.items.some(
      (m) =>
        m.id === 'svc-a:npm' &&
        m.status === 'failed' &&
        m.detail === 'registry_unavailable'
    )
  );
  assert.equal(
    posture.findings.some((f) => f.packageName === 'npm-vuln'),
    false
  );
  assert.ok(posture.findings.length > 0);
  assert.match(
    h.file('last-line-message-preview.txt'),
    /Sweep: DEGRADED \| assets scanned 2\/5 \| matchers ok 2, failed 1/
  );
});

test('an unavailable feed is reported by name and degrades the sweep', async () => {
  const h = harness();
  const real = h.deps.fetchImpl;
  h.deps.fetchImpl = async (url, init) =>
    new URL(url).host === 'www.cisa.gov' ? json({}, 503) : real(url, init);
  assert.equal(await h.run([]), 0);
  assert.match(h.stdout(), /kev=unavailable/);
  assert.equal(h.json('latest-security-posture.json').run.degraded, true);
});

// --- the muted advisories, VEX, runtime floors -------------------------------------------------------

test('a muted advisory that is withdrawn resurfaces as WITHDRAWN, and one in KEV becomes P0', async () => {
  const withdrawn = harness({
    records: {
      ...RECORDS,
      'GHSA-iiii-gggg-nnnn': {
        ...RECORDS['GHSA-iiii-gggg-nnnn'],
        withdrawn: '2026-11-16T00:00:00Z',
      },
    },
  });
  await withdrawn.run([]);
  const gone = withdrawn
    .json('latest-security-posture.json')
    .findings.find((f) => f.packageName === 'ignored-pkg');
  assert.equal(gone.priority, 'WITHDRAWN');
  assert.equal(gone.resolution, 'ADVISORY_WITHDRAWN');
  assert.equal(
    withdrawn.json('latest-security-posture.json').accepted_ignores[0]
      .withdrawn,
    true
  );

  const listed = harness({ kev: ['CVE-2099-0004'] });
  await listed.run([]);
  const posture = listed.json('latest-security-posture.json');
  const hot = posture.findings.find((f) => f.packageName === 'ignored-pkg');
  assert.equal(hot.priority, 'P0');
  assert.equal(hot.rule, 'R-5');
  assert.equal(hot.inKev, true);
  assert.equal(posture.accepted_ignores[0].inKev, true);
  assert.match(listed.stdout(), /signals: kev=1/);
});

const STATEMENT = {
  advisory_id: 'GHSA-aaaa-bbbb-cccc',
  asset_id: 'app-web',
  package_spec: 'trans-pkg@2.0.0',
  status: 'not_affected',
  justification: 'vulnerable_code_not_present',
  impact_statement: 'The vulnerable function is never called.',
  created_at: '2026-11-01',
  review_after: '2027-01-15',
  expires_when: { when_advisory_withdrawn: true, when_in_cisa_kev: true },
};
const overlay = (statements) =>
  JSON.stringify({
    schema_version: '1.0',
    updated_at: '2026-11-21',
    readme: 'private',
    statements,
  });

test('the private VEX overlay suppresses a finding; an invalid overlay is ignored', async () => {
  const path = '/repo/davintrade-security-monitoring-pipeline/private-vex.json';
  const ok = harness({ files: { [path]: overlay([STATEMENT]) } });
  await ok.run([]);
  const posture = ok.json('latest-security-posture.json');
  const f = posture.findings.find((x) => x.packageName === 'trans-pkg');
  assert.equal(f.priority, 'P3');
  assert.equal(f.rule, 'R-1');
  assert.equal(f.vexSource, 'private');
  assert.equal(posture.vex.private.count, 1);
  assert.match(ok.stdout(), /vex: public=0 private=1 stale=0/);

  const bad = harness({
    files: { [path]: overlay([{ ...STATEMENT, status: 'affected' }]) },
  });
  await bad.run([]);
  const kept = bad.json('latest-security-posture.json');
  assert.equal(
    kept.findings.find((x) => x.packageName === 'trans-pkg').priority,
    'P1'
  );
  assert.equal(kept.vex.private.valid, false);

  const garbage = harness({ files: { [path]: '{not json' } });
  await garbage.run([]);
  assert.deepEqual(
    garbage.json('latest-security-posture.json').vex.private.errors,
    ['invalid_json']
  );
});

test('the runtime state and the Node feed raise a floor breach, once', async () => {
  const state = JSON.stringify({
    assets: {
      'app-web': {
        node: '24.10.0',
        verified: false,
        note: 'derived from the pinned package set',
      },
      'svc-a': { node: '24.22.3', verified: true },
    },
  });
  const h = harness({
    files: {
      '/repo/.env.local': LINE_ENV,
      [`${REPORTS}/runtime-state.json`]: state,
    },
  });
  assert.equal(await h.run(['--notify-line']), 0);
  const posture = h.json('latest-security-posture.json');
  const floor = posture.findings.find((f) => f.kind === 'runtime-floor');
  assert.equal(floor.assetId, 'app-web');
  assert.equal(floor.priority, 'P1');
  assert.equal(floor.rule, 'R-7');
  assert.equal(posture.runtime_floors.counts.below_floor, 1);
  const alert = JSON.parse(h.lineCalls()[0].init.body).messages[0].text;
  assert.match(alert, /Runtime floor breach: 1 \(app-web\)/);
  assert.match(h.stdout(), /runtime_floors: below_floor=1/);
  h.clock.t += 3600 * 1000;
  await h.run(['--notify-line']);
  assert.equal(h.lineCalls().length, 1, 'the same breach does not alert again');
});

test('a malicious-package record alerts as such and cannot be suppressed', async () => {
  const path = '/repo/davintrade-security-monitoring-pipeline/private-vex.json';
  const h = harness({
    files: {
      '/repo/.env.local': LINE_ENV,
      [path]: overlay([
        {
          ...STATEMENT,
          advisory_id: 'GHSA-aaaa-bbbb-cccc',
          package_spec: 'mal-pkg@1.0.0',
        },
      ]),
    },
    records: {
      ...RECORDS,
      'MAL-2099-0001': {
        ...RECORDS['MAL-2099-0001'],
        aliases: ['GHSA-aaaa-bbbb-cccc'],
      },
    },
  });
  await h.run(['--notify-line']);
  const mal = h
    .json('latest-security-posture.json')
    .findings.find((f) => f.malicious);
  assert.equal(mal.priority, 'P0');
  assert.equal(mal.vexActive, false);
  assert.match(
    JSON.parse(h.lineCalls()[0].init.body).messages[0].text,
    /Malicious-package record: 1 \(app-web\)/
  );
});

// --- Dependabot --------------------------------------------------------------------------------------

test('--with-dependabot reconciles the alerts and keeps the token out of every output', async () => {
  const alert = (ghsa, path, name, scope = 'runtime') => ({
    number: 1,
    dependency: {
      package: { ecosystem: 'npm', name },
      manifest_path: path,
      scope,
    },
    security_advisory: { ghsa_id: ghsa, cve_id: null, severity: 'high' },
  });
  const h = harness({
    alerts: [
      alert('GHSA-dddd-eeee-ffff', 'svc-a/package-lock.json', 'npm-vuln'), // agrees
      alert('GHSA-zzzz-yyyy-xxxx', 'svc-a/package-lock.json', 'other-pkg'), // Dependabot only
      alert('GHSA-wwww-vvvv-uuuu', 'mobile-app/package-lock.json', 'x'), // excluded path
    ],
  });
  assert.equal(
    await h.run(['--with-dependabot'], {
      DEPENDABOT_TRIAGE_TOKEN: GITHUB_TOKEN,
    }),
    0
  );
  const posture = h.json('latest-security-posture.json');
  assert.equal(posture.dependabot.status, 'compared');
  assert.equal(posture.dependabot.open, 3);
  assert.equal(posture.dependabot.excludedPaths, 1);
  assert.equal(posture.dependabot.dependabotOnly.length, 1);
  assert.match(
    h.stdout(),
    /dependabot: open=3 compared=2 dependabot_only=1 local_only=\d+/
  );
  const github = h.fetchCalls.filter(
    (c) => new URL(c.url).host === 'api.github.com'
  );
  assert.equal(github.length, 1);
  assert.equal(github[0].init.headers.Authorization, `Bearer ${GITHUB_TOKEN}`);
  for (const text of [
    h.stdout(),
    JSON.stringify(posture),
    h.file('latest-security-posture.md'),
    h.file('sweep-history.jsonl'),
  ]) {
    assert.equal(text.includes(GITHUB_TOKEN), false);
  }
  noSentinels(h.stdout());
});

test('--with-dependabot falls back to the Git credential, and is skipped without any token', async () => {
  const viaGit = harness({
    credential: `username=x\npassword=${GITHUB_TOKEN}\n`,
  });
  await viaGit.run(['--with-dependabot']);
  assert.equal(
    viaGit.json('latest-security-posture.json').dependabot.status,
    'compared'
  );
  const none = harness();
  await none.run(['--with-dependabot']);
  assert.deepEqual(
    {
      s: none.json('latest-security-posture.json').dependabot.status,
      d: none.json('latest-security-posture.json').dependabot.detail,
    },
    { s: 'skipped', d: 'no_token' }
  );
  const refused = harness({ alerts: { message: 'Resource not accessible' } });
  await refused.run(['--with-dependabot'], {
    DEPENDABOT_TRIAGE_TOKEN: GITHUB_TOKEN,
  });
  assert.equal(
    refused.json('latest-security-posture.json').dependabot.status,
    'unavailable'
  );
  assert.equal(refused.json('latest-security-posture.json').run.degraded, true);
});

// --- the live posture sweep (--with-posture) -----------------------------------------------------------------

// the fixture inventory with a public web host and a paused asset that has a DNS name
const POSTURE_INVENTORY = INVENTORY.replace(
  "  - 'app.example (fixture)'",
  "  - 'www.fixture.test'"
).replace(
  "    name: 'Docker only'\n",
  "    name: 'Docker only'\n    public_hostnames: ['box.fixture.test']\n"
);
const POSTURE_FILES = {
  '/repo/security/security-inventory.yaml': POSTURE_INVENTORY,
};
const POSTURE_ENV = { DEPENDABOT_TRIAGE_TOKEN: GITHUB_TOKEN };
const POSTURE_REPO = 'ripper7375/trading-alerts-saas-public';

// every probe answers as the healthy live system does; `over` bends one of them
function postureProbes(over = {}) {
  const calls = { web: [], tls: [], dns: [], github: [], git: [] };
  const github = {
    '': {
      ok: true,
      status: 200,
      body: {
        permissions: { admin: true },
        security_and_analysis: {
          secret_scanning: { status: 'enabled' },
          secret_scanning_push_protection: { status: 'enabled' },
        },
      },
    },
    '/rules/branches/main': {
      ok: true,
      status: 200,
      body: [{ type: 'deletion' }, { type: 'non_fast_forward' }],
    },
    '/actions/permissions': {
      ok: true,
      status: 200,
      body: { allowed_actions: 'selected', sha_pinning_required: true },
    },
    '/actions/permissions/workflow': {
      ok: true,
      status: 200,
      body: {
        default_workflow_permissions: 'read',
        can_approve_pull_request_reviews: false,
      },
    },
    '/vulnerability-alerts': { ok: true, status: 204, body: null },
    '/private-vulnerability-reporting': {
      ok: true,
      status: 200,
      body: { enabled: true },
    },
    ...(over.github ?? {}),
  };
  const probes = {
    web: async ({ url }) => {
      calls.web.push(url);
      return url === 'https://www.fixture.test/'
        ? {
            ok: true,
            status: 200,
            headers: {
              'strict-transport-security':
                'max-age=63072000; includeSubDomains; preload',
              'content-security-policy': "default-src 'self'",
              'x-frame-options': 'SAMEORIGIN',
              'x-content-type-options': 'nosniff',
              'referrer-policy': 'strict-origin-when-cross-origin',
              'permissions-policy': 'camera=()',
            },
          }
        : {
            ok: true,
            status: 308,
            headers: { location: 'https://www.fixture.test/' },
          };
    },
    tls: async ({ host }) => {
      calls.tls.push(host);
      return (
        over.tls ?? {
          ok: true,
          authorized: true,
          authorizationError: null,
          validFrom: '2026-10-01T00:00:00.000Z',
          validTo: '2027-01-05T00:00:00.000Z',
        }
      );
    },
    dns: async ({ host }) => {
      calls.dns.push(host);
      return { ok: true, addresses: [], cnames: [] };
    },
    github: async ({ path }) => {
      calls.github.push(path);
      return github[path];
    },
    git: {
      fetchMain: async () => {
        calls.git.push('fetch');
        return { ok: true };
      },
      resolve: async (ref) => {
        calls.git.push(`resolve ${ref}`);
        return 'b'.repeat(40);
      },
      pending: async () => ({ ok: true, commits: [] }),
    },
  };
  return { probes, calls };
}

function withPosture(h, over = {}) {
  const fake = postureProbes(over);
  const created = [];
  h.deps.posture = {
    createProbes: (args) => {
      created.push(args);
      return fake.probes;
    },
  };
  return { fake, created };
}

test('--with-posture adds the live posture to both reports and its counts to stdout', async () => {
  const h = harness({ files: POSTURE_FILES });
  const wp = withPosture(h);
  assert.equal(await h.run(['--with-posture'], POSTURE_ENV), 0);
  assert.deepEqual(wp.created, [
    { root: '/repo', token: GITHUB_TOKEN, repo: POSTURE_REPO },
  ]);

  const posture = h.json('latest-security-posture.json');
  assert.equal(posture.live_posture.summary.checks.fail, 0);
  assert.ok(posture.live_posture.summary.checks.total >= 15);
  // the standalone reports are the same sweep
  assert.deepEqual(h.json('latest-posture-sweep.json'), posture.live_posture);
  assert.match(
    h.file('latest-posture-sweep.md'),
    /^# DavinTrade live posture sweep \(private\)/
  );
  const md = h.file('latest-security-posture.md');
  assert.match(md, /## Live posture sweep/);
  assert.match(md, /github-secret-scanning/);
  assert.match(md, /www\.fixture\.test/);

  const out = h.stdout();
  noSentinels(out);
  for (const line of h.logs) {
    assert.equal(findPrivacyViolations(line).length, 0, line);
  }
  assert.equal(out.includes('fixture.test'), false, 'no host on stdout');
  assert.match(out, /posture_checks: total=\d+ pass=\d+ fail=0/);
  assert.match(
    out,
    /posture_areas: web=ok tls=ok dns=ok github=ok runtime=skipped/
  );
  // the vulnerability counts are what they are without the flag
  assert.match(out, /findings: P0=1 P1=2 P2=0 P3=4 withdrawn=0 total=7/);
  const everything = JSON.stringify([out, ...h.fs.files.values()]);
  assert.equal(
    everything.includes(GITHUB_TOKEN),
    false,
    'the token is kept out'
  );
});

test('a failed posture check is a P1 finding, a LINE alert and a heartbeat line', async () => {
  const h = harness({
    files: { ...POSTURE_FILES, '/repo/.env.local': LINE_ENV },
  });
  withPosture(h, {
    github: {
      '/private-vulnerability-reporting': {
        ok: true,
        status: 200,
        body: { enabled: false },
      },
    },
  });
  assert.equal(
    await h.run(['--dry-run-line', '--with-posture'], POSTURE_ENV),
    0
  );
  const posture = h.json('latest-security-posture.json');
  assert.deepEqual(posture.summary.tiers, {
    P0: 1,
    P1: 3,
    P2: 0,
    P3: 4,
    WITHDRAWN: 0,
  });
  const finding = posture.findings.find((f) => f.source === 'posture-sweep');
  assert.equal(finding.kind, 'posture-drift');
  assert.equal(finding.assetId, 'github-repo');
  assert.equal(finding.priority, 'P1');
  assert.equal(finding.rule, 'PS-1');

  const preview = h.file('last-line-message-preview.txt');
  assert.match(preview, /Live posture breach: 1 \(github-repo\)/);
  assert.match(
    preview,
    /Live posture: pass=\d+ fail=1 unavailable=0 skipped=\d+ \| web=ok tls=ok dns=ok github=fail runtime=skipped/
  );
  noSentinels(preview);
  assert.equal(
    findPrivacyViolations(
      preview
        .split('\n')
        .filter((l) => !l.startsWith('#'))
        .join('\n')
    ).length,
    0
  );
  assert.match(h.stdout(), /findings: P0=1 P1=3 P2=0 P3=4 withdrawn=0 total=8/);
  assert.match(
    h.stdout(),
    /line: dry run, preview written \(alerts=4 heartbeat=due\)/
  );
});

test('an unavailable posture probe degrades the whole sweep and the heartbeat says so', async () => {
  const h = harness({
    files: { ...POSTURE_FILES, '/repo/.env.local': LINE_ENV },
  });
  withPosture(h, { tls: { ok: false, error: 'timeout' } });
  assert.equal(
    await h.run(['--dry-run-line', '--with-posture'], POSTURE_ENV),
    0
  );
  const posture = h.json('latest-security-posture.json');
  assert.equal(posture.run.degraded, true);
  assert.equal(posture.live_posture.run.degraded, true);
  assert.match(h.stdout(), /degraded=yes/);
  const preview = h.file('last-line-message-preview.txt');
  assert.match(preview, /Sweep: DEGRADED/);
  assert.match(preview, /tls=unavailable/);
});

test('the same posture breach alerts once, not on every run', async () => {
  const h = harness({
    files: { ...POSTURE_FILES, '/repo/.env.local': LINE_ENV },
  });
  withPosture(h, {
    github: {
      '/vulnerability-alerts': { ok: false, status: 404, body: null },
    },
  });
  assert.equal(
    await h.run(['--notify-line', '--with-posture'], POSTURE_ENV),
    0
  );
  assert.equal(h.lineCalls().length, 1);
  const body = JSON.parse(h.lineCalls()[0].init.body);
  assert.match(body.messages[0].text, /Live posture breach: 1 \(github-repo\)/);
  h.clock.t += 3600 * 1000;
  await h.run(['--notify-line', '--with-posture'], POSTURE_ENV);
  assert.equal(h.lineCalls().length, 1, 'the same breach does not alert again');
});

test('a Node floor breach is counted once, by the engine and the sweep together', async () => {
  const state = JSON.stringify({
    assets: {
      'app-web': { node: '24.10.0', verified: false },
      'svc-a': { node: '24.22.3', verified: true },
    },
  });
  const h = harness({
    files: {
      ...POSTURE_FILES,
      [`${REPORTS}/runtime-state.json`]: state,
    },
  });
  withPosture(h);
  assert.equal(await h.run(['--with-posture'], POSTURE_ENV), 0);
  const posture = h.json('latest-security-posture.json');
  assert.equal(
    posture.findings.filter((f) => f.kind === 'runtime-floor').length,
    1
  );
  assert.equal(posture.summary.tiers.P1, 3, 'two advisories and one floor');
  const check = posture.live_posture.checks.find(
    (c) => c.id === 'runtime-app-web-node'
  );
  assert.equal(check.status, 'fail');
  assert.equal(check.rule, 'R-7');
});

test('--with-posture --offline probes nothing over the network and still writes the posture reports', async () => {
  const h = harness({ files: POSTURE_FILES });
  const wp = withPosture(h);
  assert.equal(await h.run(['--with-posture', '--offline'], POSTURE_ENV), 0);
  assert.deepEqual(
    [
      wp.fake.calls.web,
      wp.fake.calls.tls,
      wp.fake.calls.dns,
      wp.fake.calls.github,
    ],
    [[], [], [], []]
  );
  assert.equal(wp.fake.calls.git.includes('fetch'), false);
  assert.equal(wp.created[0].token, null, 'an offline run asks for no token');
  assert.equal(h.json('latest-posture-sweep.json').run.offline, true);
  assert.match(
    h.stdout(),
    /posture_areas: web=skipped tls=skipped dns=skipped github=skipped runtime=skipped/
  );
});

test('without --with-posture the posture sweep does not run and leaves no trace', async () => {
  const h = harness({ files: POSTURE_FILES });
  const wp = withPosture(h);
  assert.equal(await h.run([], POSTURE_ENV), 0);
  assert.equal(wp.created.length, 0);
  assert.equal('live_posture' in h.json('latest-security-posture.json'), false);
  assert.equal(h.fs.files.has(`${REPORTS}/latest-posture-sweep.json`), false);
  assert.equal(h.stdout().includes('posture_'), false);
  assert.doesNotMatch(h.file('latest-security-posture.md'), /Live posture/);
});

test('--no-fetch and --main-ref reach the sweep', async () => {
  const h = harness({ files: POSTURE_FILES });
  const wp = withPosture(h);
  assert.equal(
    await h.run(
      ['--with-posture', '--no-fetch', '--main-ref', 'origin/release'],
      POSTURE_ENV
    ),
    0
  );
  assert.equal(wp.fake.calls.git.includes('fetch'), false);
  assert.equal(
    h.json('latest-posture-sweep.json').run.main_ref,
    'origin/release'
  );
});

test('parseArgs knows --with-posture, --no-fetch and --main-ref', () => {
  const o = parseArgs([
    '--with-posture',
    '--no-fetch',
    '--main-ref',
    'origin/release',
  ]);
  assert.deepEqual(
    { w: o.withPosture, n: o.noFetch, r: o.mainRef },
    { w: true, n: true, r: 'origin/release' }
  );
  const d = parseArgs([]);
  assert.deepEqual(
    { w: d.withPosture, n: d.noFetch, r: d.mainRef },
    { w: false, n: false, r: 'origin/main' }
  );
  for (const bad of [
    ['--main-ref', '--x'],
    ['--main-ref', 'a..b'],
    ['--main-ref'],
    ['--with-posture=1'],
  ]) {
    assert.throws(() => parseArgs(bad), UsageError, JSON.stringify(bad));
  }
  assert.match(USAGE, /--with-posture/);
  assert.match(USAGE, /--no-fetch/);
  assert.match(USAGE, /--main-ref/);
});

// --- coverage and build hygiene ----------------------------------------------------------------------------

// svc-a also lists a covered manifest and a nixpacks file; svc-py also lists a development manifest
const COVERAGE_INVENTORY = INVENTORY.replace(
  "        lockfile_path: 'svc-a/package-lock.json'\n",
  "        lockfile_path: 'svc-a/package-lock.json'\n        nixpacks_path: 'svc-a/nixpacks.toml'\n      - type: npm\n        manifest_path: 'svc-a/packages/types/package.json'\n        covered_by_lockfile: 'svc-a/package-lock.json'\n"
).replace(
  "        manifest_path: 'py/requirements.txt'\n        pinning_required: true\n",
  "        manifest_path: 'py/requirements.txt'\n        pinning_required: true\n      - type: pip\n        manifest_path: 'py/requirements-dev.txt'\n        scope: development\n"
);
const NIXPACKS_DEV = '[variables]\nNPM_CONFIG_PRODUCTION = "false"\n';
const NPM_LOCK_WITH_DEV = {
  ...NPM_LOCK,
  packages: {
    ...NPM_LOCK.packages,
    'node_modules/dev-tool': { version: '2.0.0', dev: true },
    'node_modules/dev-crit': { version: '3.0.0', dev: true },
    'node_modules/dev-mod': { version: '4.0.0', dev: true },
  },
};
const devVuln = (name, source, severity, ghsa) => ({
  name,
  severity,
  isDirect: false,
  via: [
    {
      source,
      name,
      title: 'Sentinel advisory title',
      url: `https://github.com/advisories/${ghsa}`,
      severity,
      cwe: ['CWE-79'],
      cvss: { score: 7.5 },
      range: '<9.0.0',
    },
  ],
  effects: [],
  nodes: [`node_modules/${name}`],
});
// the full audit: the production finding again, and three development-only ones
const NPM_AUDIT_FULL = {
  ...NPM_AUDIT,
  vulnerabilities: {
    ...NPM_AUDIT.vulnerabilities,
    'dev-tool': devVuln('dev-tool', 8001, 'high', 'GHSA-devt-aaaa-bbbb'),
    'dev-crit': devVuln('dev-crit', 8002, 'critical', 'GHSA-devc-aaaa-bbbb'),
    'dev-mod': devVuln('dev-mod', 8003, 'moderate', 'GHSA-devm-aaaa-bbbb'),
  },
};
const HYGIENE_FILES = {
  '/repo/security/security-inventory.yaml': COVERAGE_INVENTORY,
  '/repo/svc-a/nixpacks.toml': NIXPACKS_DEV,
  '/repo/svc-a/package-lock.json': JSON.stringify(NPM_LOCK_WITH_DEV),
  '/repo/py/requirements-dev.txt':
    'dev-lib==1.0.0\npytest==7.4.3\nunpinned-dev>=1.0\n',
};
const HYGIENE_SENTINELS = [
  'dev-tool',
  'dev-crit',
  'dev-mod',
  'dev-lib',
  'GHSA-devt-aaaa-bbbb',
  'GHSA-devc-aaaa-bbbb',
];

test('a service that installs development dependencies at build time also gets a full audit, and its dev-only high and critical advisories surface as build_only (P3)', async () => {
  const h = harness({ files: HYGIENE_FILES, npmFull: NPM_AUDIT_FULL });
  assert.equal(await h.run([]), 0);
  // two npm audits for svc-a: the production one and the full one
  const audits = h.commandCalls.filter(
    (c) => c.command === 'npm' && c.cwd === '/repo/svc-a'
  );
  assert.equal(audits.length, 2);
  assert.ok(audits.some((c) => c.args.includes('--omit=dev')));
  assert.ok(
    audits.some(
      (c) =>
        !c.args.includes('--omit=dev') &&
        c.args.includes('--package-lock-only') &&
        c.args.includes('--json')
    )
  );

  const posture = h.json('latest-security-posture.json');
  const hygiene = posture.findings.filter((f) => f.buildHygiene);
  assert.deepEqual(hygiene.map((f) => f.packageName).sort(), [
    'dev-crit',
    'dev-tool',
  ]);
  for (const f of hygiene) {
    assert.equal(f.priority, 'P3');
    assert.equal(f.rule, 'R-2');
    assert.equal(f.scope, 'build_only');
    assert.equal(f.source, 'npm-audit-dev');
    assert.equal(f.assetId, 'svc-a');
  }
  assert.deepEqual(posture.build_hygiene, [
    {
      asset_id: 'svc-a',
      nixpacks_path: 'svc-a/nixpacks.toml',
      installs_dev_dependencies: true,
      audited: true,
      dev_high_critical: 2,
    },
  ]);
  assert.ok(
    posture.matchers.items.some(
      (m) => m.id === 'svc-a:npm-dev-audit' && m.status === 'ok'
    )
  );
  // the production finding the full audit repeats is not counted twice
  assert.equal(
    posture.findings.filter((f) => f.packageName === 'npm-vuln').length,
    1
  );

  // counts only on stdout; the details are in the private report
  const out = h.stdout();
  noSentinels(out);
  for (const sentinel of HYGIENE_SENTINELS) {
    assert.equal(out.includes(sentinel), false, `leaked: ${sentinel}`);
  }
  assert.match(out, /build_hygiene: assets=1 dev_high_critical=2/);
  assert.match(out, /findings: P0=1 P1=2 P2=0 P3=\d+ withdrawn=0 total=\d+/);
  const md = h.file('latest-security-posture.md');
  assert.match(md, /dev-tool@2\.0\.0/);
  assert.match(md, /build-hygiene/);
  assert.match(md, /## Build hygiene/);
  assert.doesNotMatch(
    md,
    /dev-mod@/,
    'a moderate advisory is not a hygiene finding'
  );
});

test('without NPM_CONFIG_PRODUCTION=false there is no full audit', async () => {
  const h = harness({
    files: {
      ...HYGIENE_FILES,
      '/repo/svc-a/nixpacks.toml':
        '[variables]\nNPM_CONFIG_PRODUCTION = "true"\n',
    },
    npmFull: NPM_AUDIT_FULL,
  });
  assert.equal(await h.run([]), 0);
  assert.equal(
    h.commandCalls.filter((c) => c.command === 'npm' && c.cwd === '/repo/svc-a')
      .length,
    1
  );
  const posture = h.json('latest-security-posture.json');
  assert.equal(
    posture.findings.some((f) => f.buildHygiene),
    false
  );
  assert.deepEqual(
    posture.build_hygiene.map((r) => [
      r.asset_id,
      r.installs_dev_dependencies,
      r.audited,
    ]),
    [['svc-a', false, false]]
  );
  assert.doesNotMatch(h.stdout(), /build_hygiene:/);
});

test('a failing full audit degrades the sweep without stopping it; offline it is skipped', async () => {
  const failing = harness({ files: HYGIENE_FILES, npmFull: 'not json' });
  assert.equal(await failing.run([]), 0);
  const posture = failing.json('latest-security-posture.json');
  assert.ok(
    posture.matchers.items.some(
      (m) => m.id === 'svc-a:npm-dev-audit' && m.status === 'failed'
    )
  );
  assert.equal(posture.run.degraded, true);
  assert.equal(posture.build_hygiene[0].audited, false);
  assert.equal(
    posture.findings.some((f) => f.buildHygiene),
    false
  );

  const offline = harness({ files: HYGIENE_FILES, npmFull: NPM_AUDIT_FULL });
  assert.equal(await offline.run(['--offline']), 0);
  assert.equal(offline.commandCalls.length, 0, 'no audit tool ran');
  const off = offline.json('latest-security-posture.json');
  assert.ok(
    off.matchers.items.some(
      (m) => m.id === 'svc-a:npm-dev-audit' && m.status === 'skipped'
    )
  );
  assert.equal(off.build_hygiene[0].installs_dev_dependencies, true);
  assert.equal(off.build_hygiene[0].audited, false);
});

test('a manifest covered by another lockfile is mapped to its asset but not audited on its own', async () => {
  const h = harness({
    files: { ...HYGIENE_FILES, '/repo/svc-a/nixpacks.toml': '' },
    alerts: [
      {
        number: 1,
        dependency: {
          package: { name: 'npm-vuln', ecosystem: 'npm' },
          manifest_path: 'svc-a/packages/types/package.json',
          scope: 'runtime',
        },
        security_advisory: {
          ghsa_id: 'GHSA-dddd-eeee-ffff',
          cve_id: 'CVE-2099-0002',
          severity: 'high',
        },
      },
    ],
  });
  assert.equal(
    await h.run(['--with-dependabot'], {
      DEPENDABOT_TRIAGE_TOKEN: GITHUB_TOKEN,
    }),
    0
  );
  const posture = h.json('latest-security-posture.json');
  assert.deepEqual(
    posture.matchers.items.find((m) => m.id === 'svc-a:npm-covered'),
    {
      id: 'svc-a:npm-covered',
      status: 'skipped',
      detail: 'covered_by_lockfile',
    }
  );
  assert.equal(posture.matchers.failed, 0);
  assert.equal(
    h.commandCalls.filter((c) => c.command === 'npm' && c.cwd === '/repo/svc-a')
      .length,
    1,
    'only the service lockfile is audited'
  );
  // its Dependabot alert is mapped and compared with the service lockfile's findings
  assert.equal(posture.dependabot.unmapped, 0);
  assert.equal(posture.dependabot.compared, 1);
  assert.equal(posture.dependabot.agreed, 1);
});

test('a development-only Python manifest is audited as dev_only (P3) and is not counted as unpinned runtime', async () => {
  const h = harness({
    files: HYGIENE_FILES,
    osvHits: { ...OSV_HITS, 'PyPI|dev-lib|1.0.0': ['PYSEC-2099-9'] },
    records: {
      ...RECORDS,
      'PYSEC-2099-9': osvRecord('PYSEC-2099-9', {
        database_specific: {},
        affected: affects('PyPI', 'dev-lib', [
          { introduced: '0' },
          { fixed: '1.1.0' },
        ]),
      }),
    },
  });
  assert.equal(await h.run([]), 0);
  const posture = h.json('latest-security-posture.json');
  const f = posture.findings.find((x) => x.packageName === 'dev-lib');
  assert.equal(f.scope, 'dev_only');
  assert.equal(f.priority, 'P3');
  assert.equal(f.rule, 'R-2');
  assert.equal(f.assetId, 'svc-py');
  // the runtime manifest's pinning figures are unchanged by the development manifest
  assert.deepEqual(posture.pinning, [
    { assetId: 'svc-py', pinned: 2, unpinned: 1, pinningRequired: true },
  ]);
  const ids = posture.matchers.items.map((m) => `${m.id}=${m.status}`);
  assert.ok(ids.includes('svc-py:pip=ok'));
  assert.ok(ids.includes('svc-py:pip-dev=ok'));
  noSentinels(h.stdout());
  for (const sentinel of HYGIENE_SENTINELS) {
    assert.equal(h.stdout().includes(sentinel), false, `leaked: ${sentinel}`);
  }
});

test('the same package in the runtime and the development manifest stays runtime', async () => {
  const h = harness({
    files: {
      ...HYGIENE_FILES,
      // py-vuln is pinned in the runtime manifest; the development manifest repeats it
      '/repo/py/requirements-dev.txt': 'py-vuln==2.31.0\n',
    },
  });
  assert.equal(await h.run([]), 0);
  const f = h
    .json('latest-security-posture.json')
    .findings.find((x) => x.packageName === 'py-vuln');
  assert.notEqual(f.scope, 'dev_only', 'a runtime declaration wins');
});

test('a runtime declaration wins whichever manifest is read first', async () => {
  // the development manifest is now listed before the runtime one
  const devFirst = COVERAGE_INVENTORY.replace(
    "      - type: pip\n        manifest_path: 'py/requirements.txt'\n        pinning_required: true\n      - type: pip\n        manifest_path: 'py/requirements-dev.txt'\n        scope: development\n",
    "      - type: pip\n        manifest_path: 'py/requirements-dev.txt'\n        scope: development\n      - type: pip\n        manifest_path: 'py/requirements.txt'\n        pinning_required: true\n"
  );
  assert.notEqual(devFirst, COVERAGE_INVENTORY, 'the fixture was reordered');
  const h = harness({
    files: {
      ...HYGIENE_FILES,
      '/repo/security/security-inventory.yaml': devFirst,
      // py-vuln is pinned in both manifests
      '/repo/py/requirements-dev.txt': 'py-vuln==2.31.0\n',
    },
  });
  assert.equal(await h.run([]), 0);
  const f = h
    .json('latest-security-posture.json')
    .findings.find((x) => x.packageName === 'py-vuln');
  assert.notEqual(f.scope, 'dev_only', 'the runtime declaration wins');
});

// --- narrowing and the real CLI ----------------------------------------------------------------------------

test('--assets limits the sweep to the named assets', async () => {
  const h = harness();
  assert.equal(await h.run(['--assets', 'app-web']), 0);
  assert.equal(
    h.commandCalls.some((c) => c.command === 'npm'),
    false
  );
  assert.match(h.stdout(), /assets: total=1 scanned=1 skipped=0/);
  assert.equal(
    h
      .json('latest-security-posture.json')
      .findings.every((f) => f.assetId === 'app-web'),
    true
  );
});

test('the real CLI starts, reads --secrets-file itself and reports its exit code', () => {
  const dir = mkdtempSync(join(tmpdir(), 'pipeline-cli-'));
  try {
    const help = spawnSync(process.execPath, [CLI, '--help'], {
      encoding: 'utf8',
      cwd: ROOT,
    });
    assert.equal(help.status, 0);
    assert.match(help.stdout, /--dry-run-line/);
    const bad = spawnSync(process.execPath, [CLI, '--bogus'], {
      encoding: 'utf8',
      cwd: ROOT,
    });
    assert.equal(bad.status, 2);
    // a whole offline sweep of this repository, into a scratch folder: no network, no tool run
    const sweep = spawnSync(
      process.execPath,
      [
        CLI,
        '--offline',
        '--dry-run-line',
        '--pipeline-dir',
        dir,
        '--secrets-file',
        join(dir, 'absent.env'),
      ],
      { encoding: 'utf8', cwd: ROOT }
    );
    assert.equal(sweep.status, 0, sweep.stdout);
    assert.match(
      sweep.stdout,
      /DavinTrade security pipeline sweep \(counts only\)/
    );
    assert.equal(findPrivacyViolations(sweep.stdout).length, 0);
    for (const name of [
      'latest-security-posture.json',
      'latest-security-posture.md',
      'last-line-message-preview.txt',
    ]) {
      assert.ok(existsSync(join(dir, 'reports', name)), name);
    }
    assert.equal(existsSync(join(dir, 'reports', 'alert-state.json')), false);
    const posture = JSON.parse(
      readFileSync(join(dir, 'reports', 'latest-security-posture.json'), 'utf8')
    );
    assert.equal(posture.run.offline, true);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('the real CLIs run the live posture sweep offline, into a scratch folder', () => {
  const dir = mkdtempSync(join(tmpdir(), 'posture-cli-'));
  const STANDALONE = join(HERE, 'run-posture-sweep.mjs');
  // A recorded deployed commit makes the sweep ask Git (local, read-only) even offline. With
  // the real Git probe wired in, the deployed-build check never says `no_git`; without the
  // wiring it always does, so this is what proves the CLIs are wired.
  const state = JSON.stringify({
    assets: {
      'money-service': { node: '24.22.3', commit_sha: 'a'.repeat(40) },
    },
  });
  const seed = (folder) => {
    mkdirSync(join(folder, 'reports'), { recursive: true });
    writeFileSync(join(folder, 'reports', 'runtime-state.json'), state);
  };
  const wired = (file) => {
    const live = JSON.parse(readFileSync(file, 'utf8'));
    const deploy = live.checks.find(
      (c) => c.id === 'runtime-money-service-deploy'
    );
    assert.ok(deploy, 'the deployed-build check ran');
    assert.notEqual(deploy.detail, 'no_git', 'the real Git probe is wired in');
    return live;
  };
  try {
    seed(dir);
    // the full pipeline with the flag: no network, nothing probed, the reports written
    const full = spawnSync(
      process.execPath,
      [
        CLI,
        '--offline',
        '--with-posture',
        '--dry-run-line',
        '--pipeline-dir',
        dir,
        '--secrets-file',
        join(dir, 'absent.env'),
      ],
      { encoding: 'utf8', cwd: ROOT }
    );
    assert.equal(full.status, 0, full.stdout);
    assert.match(full.stdout, /posture_checks: total=\d+/);
    assert.match(
      full.stdout,
      /posture_areas: web=skipped tls=skipped dns=skipped github=skipped/
    );
    assert.equal(findPrivacyViolations(full.stdout).length, 0);
    assert.equal(full.stdout.includes('privacy guard'), false);
    for (const name of [
      'latest-security-posture.json',
      'latest-posture-sweep.json',
      'latest-posture-sweep.md',
    ]) {
      assert.ok(existsSync(join(dir, 'reports', name)), name);
    }
    const live = wired(join(dir, 'reports', 'latest-posture-sweep.json'));
    assert.equal(live.run.offline, true);
    assert.equal(live.summary.checks.fail, 0);

    // the standalone command
    const alone = join(dir, 'alone');
    seed(alone);
    const sweep = spawnSync(
      process.execPath,
      [
        STANDALONE,
        '--offline',
        '--pipeline-dir',
        alone,
        '--secrets-file',
        join(dir, 'absent.env'),
      ],
      { encoding: 'utf8', cwd: ROOT }
    );
    assert.equal(sweep.status, 0, sweep.stdout);
    assert.match(sweep.stdout, /DavinTrade live posture sweep \(counts only\)/);
    assert.equal(findPrivacyViolations(sweep.stdout).length, 0);
    wired(join(alone, 'reports', 'latest-posture-sweep.json'));
    assert.equal(
      spawnSync(process.execPath, [STANDALONE, '--help'], { cwd: ROOT }).status,
      0
    );
    assert.equal(
      spawnSync(process.execPath, [STANDALONE, '--bogus'], { cwd: ROOT })
        .status,
      2
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
