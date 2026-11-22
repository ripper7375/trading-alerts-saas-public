// Run: node --test 'scripts/security/*.test.mjs'
//
// The custom Semgrep rules (Phase 5 of the security monitoring architecture, v3.0, section 9):
// security/semgrep-rules.yml, .semgrepignore and the fixtures of scripts/security/semgrep-fixtures.mjs.
// Semgrep itself does not run here (it cannot on Windows, and the tests must stay hermetic). Every
// rule is a regex rule, so the Node evaluator of semgrep-rules-lib.mjs runs the same regexes, the
// same path scopes and the same ignore list; the CI job runs the real Semgrep over the same rules and
// the same fixtures, so a difference between the two shows up there.
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { findPrivacyViolations } from './line-notifier-lib.mjs';
import {
  SemgrepRulesError,
  compileRuleRegex,
  globToRegExp,
  isIgnored,
  parseSemgrepIgnore,
  parseSemgrepRules,
  ruleReadsFile,
  runSemgrepRules,
  toSemgrepReport,
} from './semgrep-rules-lib.mjs';
import { SEMGREP_FIXTURES, SEMGREP_RULE_IDS } from './semgrep-fixtures.mjs';
import {
  checkSemgrepFixtures,
  parseFixtureExpectations,
} from './shift-left-counts-lib.mjs';
import { loadInventory } from './security-pipeline-lib.mjs';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const read = (path) => readFileSync(join(ROOT, path), 'utf8');
const RULES_TEXT = read('security/semgrep-rules.yml');
const IGNORE_TEXT = read('.semgrepignore');
const RULES = parseSemgrepRules(RULES_TEXT);
const IGNORE = parseSemgrepIgnore(IGNORE_TEXT);
const ruleById = (id) => RULES.find((rule) => rule.id === id);

const runFixtures = (rules) =>
  checkSemgrepFixtures({
    report: toSemgrepReport(
      runSemgrepRules({
        rules,
        files: SEMGREP_FIXTURES.map(({ path, content }) => ({
          path,
          text: content,
        })),
      })
    ),
    fixtures: SEMGREP_FIXTURES,
  });

// --- the rules file ---------------------------------------------------------------------------------

test('the rules file has the four rules of Phase 5, each a portable pattern-regex rule', () => {
  assert.deepEqual(
    RULES.map((r) => r.id),
    [...SEMGREP_RULE_IDS]
  );
  for (const rule of RULES) {
    assert.equal(rule.severity, 'ERROR', rule.id);
    assert.match(rule.cwe, /^CWE-\d+/);
    assert.ok(rule.regex instanceof RegExp);
    assert.equal(
      rule.regex.flags,
      'g',
      'never an m flag: ^ means the start of the file'
    );
    assert.ok(rule.message.length >= 60, `${rule.id} says what to do`);
  }
  // the three scoped rules read named paths; the SQL rule reads all TypeScript and JavaScript
  assert.deepEqual(
    ruleById('davintrade-prisma-raw-unsafe-dynamic-sql').include,
    []
  );
  for (const id of SEMGREP_RULE_IDS.slice(1)) {
    assert.ok(ruleById(id).include.length > 0, `${id} is scoped by path`);
  }
});

// Rule 9 (non-negotiables): no real address, proxy host:port or credentialed URL in a tracked file.
// Precise patterns, not the LINE guard: that one flags long rule ids and `A03:2021` on purpose.
const rule9Violations = (text) =>
  [
    ['ipv4', /\b(?:\d{1,3}\.){3}\d{1,3}\b/],
    ['credentialed_url', /[a-z][a-z0-9+.-]*:\/\/[^\s/@:]+:[^\s/@]+@/i],
    [
      'proxy_host_port',
      /\b[a-z0-9.-]+\.(?:rlwy\.net|railway\.app|railway\.internal):\d{2,5}\b/i,
    ],
  ]
    .filter(([, pattern]) => pattern.test(text))
    .map(([code]) => code);

test('the rule messages and metadata carry no address, credential, token or advisory id', () => {
  for (const rule of RULES) {
    assert.deepEqual(findPrivacyViolations(rule.message), [], rule.id);
    assert.deepEqual(findPrivacyViolations(rule.cwe), [], rule.id);
  }
  // the whole file and the ignore list, Rule 9
  assert.deepEqual(rule9Violations(RULES_TEXT), []);
  assert.deepEqual(rule9Violations(IGNORE_TEXT), []);
  // the check itself sees what it is for. The samples are built here, never written out: this very
  // file is scanned by the repository's own secrets scan (a proxy host:port or a credentialed URL
  // in any tracked file fails it), as the earlier phases' tests do.
  const documentationAddress = ['192', '0', '2', '7'].join('.');
  const credentialed = [
    'postgres',
    '://',
    'user',
    ':',
    'pass',
    '@',
    'host',
  ].join('');
  const proxy = ['x', 'proxy', 'rlwy', 'net'].join('.') + ':12345';
  assert.deepEqual(rule9Violations(`a ${documentationAddress} b`), ['ipv4']);
  assert.deepEqual(rule9Violations(credentialed), ['credentialed_url']);
  assert.deepEqual(rule9Violations(proxy), ['proxy_host_port']);
});

const GOOD = `rules:
  - id: davintrade-example-rule
    languages: [typescript]
    severity: ERROR
    message: 'An example message that is long enough to say what to do about it.'
    metadata:
      cwe: 'CWE-89: Example'
    pattern-regex: 'abc'
`;

test('parseSemgrepRules accepts a small valid file and refuses what the evaluator cannot run', () => {
  assert.equal(parseSemgrepRules(GOOD).length, 1);
  const refused = [
    ['rules_unreadable', 'rules: [unclosed'],
    ['rules_missing', 'other: 1\n'],
    ['rules_missing', 'rules: []\n'],
    [
      'rule_id_invalid',
      GOOD.replace('davintrade-example-rule', 'Example Rule'),
    ],
    [
      'rule_id_invalid',
      GOOD.replace('davintrade-example-rule', 'example-rule'),
    ],
    ['rule_severity_invalid', GOOD.replace('ERROR', 'CRITICAL')],
    ['rule_languages_invalid', GOOD.replace('[typescript]', '[python]')],
    ['rule_languages_invalid', GOOD.replace('[typescript]', '[]')],
    ['rule_message_invalid', GOOD.replace(/message: .*/, "message: 'short'")],
    ['rule_cwe_missing', GOOD.replace("cwe: 'CWE-89: Example'", "cwe: 'none'")],
    ['rule_not_pattern_regex', GOOD.replace('pattern-regex', 'pattern')],
    [
      'rule_not_pattern_regex',
      `${GOOD}    pattern-either:\n      - pattern: a\n`,
    ],
    ['rule_regex_not_portable', GOOD.replace("'abc'", "'(?i)abc'")],
    ['rule_regex_not_portable', GOOD.replace("'abc'", "'abc\\z'")],
    ['rule_regex_not_portable', GOOD.replace("'abc'", "'a\\Ab'")],
    ['rule_regex_not_portable', GOOD.replace("'abc'", "'a++b'")],
    ['rule_regex_invalid', GOOD.replace("'abc'", "'a(b'")],
    ['rule_paths_invalid', `${GOOD}    paths:\n      include: 5\n`],
  ];
  for (const [code, text] of refused) {
    assert.throws(
      () => parseSemgrepRules(text),
      (error) => error instanceof SemgrepRulesError && error.message === code,
      code
    );
  }
  // a duplicate id is refused too
  const two = `${GOOD}${GOOD.replace('rules:\n', '')}`;
  assert.throws(() => parseSemgrepRules(two), /rule_id_duplicate/);
});

test('compileRuleRegex turns a leading \\A into the start of the text and refuses PCRE-only syntax elsewhere', () => {
  const re = compileRuleRegex('\\A(?=[\\s\\S]*x)[\\s\\S]');
  assert.equal(re.source.startsWith('^'), true);
  assert.equal(re.test('ax'), true);
  re.lastIndex = 0;
  assert.equal(re.test('ab'), false);
  // the start is the start of the FILE, not of a line (no m flag)
  const start = compileRuleRegex('\\Aa');
  assert.equal('b\na'.match(start), null);
  assert.throws(() => compileRuleRegex(''), /rule_regex_missing/);
  assert.throws(() => compileRuleRegex(5), /rule_regex_missing/);
});

// --- globs and the ignore list ------------------------------------------------------------------------

test('globToRegExp: ** crosses folders, * and ? stay in one, regex characters are literal', () => {
  const m = (glob, path) => globToRegExp(glob).test(path);
  assert.equal(m('a/**/b.ts', 'a/b.ts'), true, '** may match no folder');
  assert.equal(m('a/**/b.ts', 'a/x/y/b.ts'), true);
  assert.equal(m('a/*/b.ts', 'a/x/y/b.ts'), false);
  assert.equal(m('a/*.ts', 'a/x.ts'), true);
  assert.equal(m('a/*.ts', 'a/x/y.ts'), false);
  assert.equal(m('a/?.ts', 'a/x.ts'), true);
  assert.equal(m('a/?.ts', 'a/xy.ts'), false);
  assert.equal(m('a/b.ts', 'a/bxts'), false, 'the dot is a dot');
  assert.equal(m('a/**', 'a/x/y'), true);
  assert.equal(
    m(
      'money-service/src/**/*webhook*.controller.ts',
      'money-service/src/stripe/stripe-webhook.controller.ts'
    ),
    true
  );
  assert.equal(
    m(
      'money-service/src/**/*webhook*.controller.ts',
      'money-service/src/stripe/stripe.controller.ts'
    ),
    false
  );
  assert.equal(
    m('**/internal/**/*.controller.ts', 'a/internal/b/c.controller.ts'),
    true
  );
});

test('isIgnored follows the .gitignore rules the file uses', () => {
  assert.deepEqual(parseSemgrepIgnore('# c\n\n  node_modules/  \n*.md\n'), [
    'node_modules/',
    '*.md',
  ]);
  const ignored = (path, ...patterns) => isIgnored(path, patterns);
  // a folder name matches at any depth, and everything under it
  assert.equal(ignored('node_modules/x/y.js', 'node_modules/'), true);
  assert.equal(ignored('a/node_modules/x.js', 'node_modules/'), true);
  assert.equal(ignored('a/b/c.ts', 'node_modules/'), false);
  // a folder pattern does not ignore a FILE of that name, anchored or not
  assert.equal(ignored('a/test', 'test/'), false);
  assert.equal(ignored('a/test/x.ts', 'test/'), true);
  assert.equal(ignored('docs', '/docs/'), false);
  assert.equal(ignored('a/b', 'a/b/'), false);
  assert.equal(ignored('a/b/c.ts', 'a/b/'), true);
  // a name or glob without a slash matches a file at any depth
  assert.equal(ignored('lib/a.test.ts', '*.test.*'), true);
  assert.equal(ignored('lib/a.testing.ts', '*.test.*'), false);
  assert.equal(ignored('README.md', '*.md'), true);
  // a leading slash anchors at the root
  assert.equal(ignored('docs/a.js', '/docs/'), true);
  assert.equal(ignored('app/docs/page.ts', '/docs/'), false);
  // a slash inside anchors too
  assert.equal(ignored('scripts/test-a.ts', 'scripts/test-*'), true);
  assert.equal(ignored('lib/scripts/test-a.ts', 'scripts/test-*'), false);
  assert.equal(
    ignored(
      'scripts/security/semgrep-fixtures.mjs',
      'scripts/security/semgrep-fixtures.mjs'
    ),
    true
  );
  assert.equal(
    ignored(
      'scripts/security/other.mjs',
      'scripts/security/semgrep-fixtures.mjs'
    ),
    false
  );
});

test('.semgrepignore keeps out of scope every path the inventory excludes from every scan', () => {
  const inventory = loadInventory(read('security/security-inventory.yaml'));
  assert.ok(inventory.excludedPaths.length >= 5);
  for (const pattern of inventory.excludedPaths) {
    assert.ok(pattern.endsWith('/**'), pattern);
    const folder = `${pattern.slice(0, -2)}`; // 'seed-code/'
    assert.ok(
      IGNORE.includes(folder),
      `.semgrepignore must list ${folder} (excluded_paths of the inventory)`
    );
    assert.equal(isIgnored(`${folder}x/y.ts`, IGNORE), true, folder);
  }
  for (const test of [
    '__tests__/a.ts',
    'lib/__mocks__/b.ts',
    'a/b.test.ts',
    'a/b.spec.ts',
    'scripts/test-mt5-deployment.ts',
    'docs/handoffs/p.js',
    'node_modules/p/i.js',
    '.claude/worktrees/p5/a.ts',
  ]) {
    assert.equal(isIgnored(test, IGNORE), true, test);
  }
  // production code stays in scope
  for (const code of [
    'lib/platform/metering/ledger-store.ts',
    'money-service/src/stripe/stripe-webhook.controller.ts',
    'app/api/cron/world-gold/route.ts',
    'scripts/security/run-security-pipeline.mjs',
    'railway-gateway/src/gateway/cycles.controller.ts',
  ]) {
    assert.equal(isIgnored(code, IGNORE), false, code);
  }
});

test('a rule reads a file by language, then by include and exclude', () => {
  const sql = ruleById('davintrade-prisma-raw-unsafe-dynamic-sql');
  assert.equal(ruleReadsFile(sql, 'lib/a.ts'), true);
  assert.equal(ruleReadsFile(sql, 'lib/a.mjs'), true);
  assert.equal(ruleReadsFile(sql, 'lib/a.py'), false);
  assert.equal(ruleReadsFile(sql, 'lib/a.md'), false);
  assert.equal(
    ruleReadsFile(sql, 'lib/admin/analytics/regional.ts'),
    false,
    'the reviewed exception'
  );
  const guard = ruleById('davintrade-internal-controller-without-guard');
  assert.equal(
    ruleReadsFile(guard, 'railway-gateway/src/gateway/cycles.controller.ts'),
    true
  );
  assert.equal(
    ruleReadsFile(guard, 'railway-gateway/src/health/health.controller.ts'),
    false
  );
  assert.equal(
    ruleReadsFile(
      guard,
      'money-service/src/stripe/stripe-checkout.controller.ts'
    ),
    false
  );
  assert.equal(
    ruleReadsFile(guard, 'money-service/src/stuff/internal/x.controller.ts'),
    true
  );
});

// --- the fixtures ------------------------------------------------------------------------------------------

test('every rule has a case it must report and a clean case inside its scope', () => {
  const expectations = parseFixtureExpectations(SEMGREP_FIXTURES);
  for (const rule of RULES) {
    assert.ok(
      expectations.some((e) => e.rule === rule.id),
      `${rule.id}: no case it must report`
    );
    const clean = SEMGREP_FIXTURES.filter(
      (f) =>
        ruleReadsFile(rule, f.path) &&
        !expectations.some((e) => e.path === f.path && e.rule === rule.id)
    );
    assert.ok(clean.length > 0, `${rule.id}: no clean case inside its scope`);
    // a rule with an exclusion has a case at the excluded path, and one outside the scope
    for (const glob of rule.exclude) {
      assert.ok(
        SEMGREP_FIXTURES.some((f) => globToRegExp(glob).test(f.path)),
        `${rule.id}: no case at the excluded path ${glob}`
      );
    }
  }
  // every marker names a rule of the file
  for (const e of expectations) assert.ok(ruleById(e.rule), e.rule);
  // fixture paths are unique, plain, and never read as tests by the default ignore list
  const paths = SEMGREP_FIXTURES.map((f) => f.path);
  assert.equal(new Set(paths).size, paths.length);
  for (const p of paths) assert.equal(isIgnored(p, IGNORE), false, p);
});

test('the Node evaluator reports exactly what the fixtures ask for, and nothing else', () => {
  const result = runFixtures(RULES);
  assert.equal(result.valid, true);
  assert.equal(result.missed, 0, 'a case that must be reported was not');
  assert.equal(result.unexpected, 0, 'a clean case was reported');
  assert.equal(result.matched, result.expected);
  assert.ok(result.expected >= 10);
});

test('the fixture check also reads a Semgrep report: rule ids carry the file prefix, paths are absolute', () => {
  const local = toSemgrepReport(
    runSemgrepRules({
      rules: RULES,
      files: SEMGREP_FIXTURES.map(({ path, content }) => ({
        path,
        text: content,
      })),
    })
  );
  const semgrepLike = {
    ...local,
    results: local.results.map((r) => ({
      ...r,
      check_id: `security.semgrep-rules.${r.check_id}`,
      path: `/github/workspace/semgrep-fixtures/${r.path}`,
    })),
  };
  const result = checkSemgrepFixtures({
    report: semgrepLike,
    fixtures: SEMGREP_FIXTURES,
  });
  assert.equal(result.missed, 0);
  assert.equal(result.unexpected, 0);
});

// A control that cannot fail is no control: break each rule in both directions and see the fixtures notice.
test('the fixtures notice a rule that stops reporting, and one that reports everything', () => {
  for (const rule of RULES) {
    const broken = (regex) =>
      RULES.map((r) => (r.id === rule.id ? { ...r, regex } : r));
    const silent = runFixtures(broken(/(?!)/g));
    assert.ok(silent.missed > 0, `${rule.id}: a silent rule must be noticed`);
    const noisy = runFixtures(broken(/^[\s\S]/g));
    assert.ok(
      noisy.unexpected > 0,
      `${rule.id}: a rule that reports every file must be noticed`
    );
  }
});

test('the fixtures notice a verification helper that falls out of the webhook rule', () => {
  const rule = ruleById('davintrade-webhook-handler-without-signature-check');
  const without = (name) => ({
    ...rule,
    regex: compileRuleRegex(
      rule.source.replace(`${name}|`, '').replace(`|${name}`, '')
    ),
  });
  for (const helper of ['constructWebhookEvent', 'verifySignature']) {
    const result = runFixtures(
      RULES.map((r) => (r.id === rule.id ? without(helper) : r))
    );
    assert.ok(
      result.unexpected > 0,
      `${helper}: a verified handler would be reported`
    );
  }
});

test('the SQL rule tells a constant statement from a built one', () => {
  const rule = ruleById('davintrade-prisma-raw-unsafe-dynamic-sql');
  const hits = (code) => {
    rule.regex.lastIndex = 0;
    return [...code.matchAll(rule.regex)].length;
  };
  // built at run time: reported
  for (const code of [
    'db.$queryRawUnsafe(`a ${x}`)',
    'db.$queryRawUnsafe(`a ${x}`, 1)',
    'db.$executeRawUnsafe("a" + b)',
    "db.$executeRawUnsafe('a' + b)",
    'db.$queryRawUnsafe(sql)',
    'db.$queryRawUnsafe(sql, a, b)',
    'db.$queryRawUnsafe(fn(x))',
    'db.$queryRawUnsafe(this.sql)',
    'db.$queryRawUnsafe<R[]>(`a ${x}`)',
    'db.$queryRawUnsafe<Array<R>>(\n  `a ${x}`\n)',
    'tx.$executeRawUnsafe(`delete from ${t}`)',
    'db.$queryRawUnsafe(`a ${x}` + "b")',
    'db.$queryRawUnsafe(Lowercase.member)',
    'db.$queryRawUnsafe(UPPER.member.deeper)',
    'db.$queryRawUnsafe(UPPER + x)',
  ]) {
    assert.equal(hits(code), 1, code);
  }
  // constant: not reported
  for (const code of [
    'db.$queryRawUnsafe("select 1")',
    "db.$queryRawUnsafe('select 1')",
    'db.$queryRawUnsafe(`select $1::int`, id)',
    'db.$queryRawUnsafe(`select\n  1`)',
    'db.$queryRawUnsafe("select \\"a\\"")',
    'db.$queryRawUnsafe(SQL)',
    'db.$queryRawUnsafe(REAP_SQL, now)',
    'db.$queryRawUnsafe<unknown[]>(LEDGER_SQL.reserve, id)',
    'db.$queryRawUnsafe(\n  LEDGER_SQL.reserve,\n  id\n)',
    '$queryRawUnsafe<T = unknown>(query: string, ...values: unknown[]): Promise<T>;',
    'async $queryRawUnsafe<T = unknown>(sql: string) {}',
    'const f = db.$queryRawUnsafe;',
    '// the call is db.$queryRawUnsafe only with constants',
    'db.$queryRaw`select ${x}`',
  ]) {
    assert.equal(hits(code), 0, code);
  }
});

test('the fixtures hold no address, host:port or credentialed URL', () => {
  for (const f of SEMGREP_FIXTURES) {
    assert.deepEqual(rule9Violations(f.content), [], f.path);
  }
});

// --- the repository -----------------------------------------------------------------------------------------

function trackedFiles() {
  const listed = spawnSync('git', ['ls-files', '-z'], {
    cwd: ROOT,
    encoding: 'utf8',
    shell: false,
    maxBuffer: 1 << 28,
  });
  return listed.status === 0 && listed.stdout !== ''
    ? listed.stdout.split('\0').filter(Boolean)
    : null;
}

test('the rules have no finding on the tracked files of the repository', (t) => {
  const tracked = trackedFiles();
  if (tracked === null) {
    t.skip('git is not available here');
    return;
  }
  const code = /\.(?:[cm]?[jt]sx?)$/;
  const files = [];
  for (const path of tracked) {
    if (
      !code.test(path) ||
      isIgnored(path, IGNORE) ||
      !existsSync(join(ROOT, path))
    )
      continue;
    files.push({ path, text: readFileSync(join(ROOT, path), 'utf8') });
  }
  const { findings, scanned } = runSemgrepRules({
    rules: RULES,
    files,
    ignorePatterns: IGNORE,
  });
  assert.ok(
    scanned > 500,
    'the scan must have looked at the code of the repository'
  );
  assert.deepEqual(
    findings.map((f) => `${f.ruleId} ${f.path}:${f.line}`),
    []
  );
  // and the in-scope files of the three path-scoped rules exist: a rule that reads nothing guards nothing
  for (const id of SEMGREP_RULE_IDS.slice(1)) {
    const rule = ruleById(id);
    const read = tracked.filter(
      (p) =>
        ruleReadsFile(rule, p) &&
        !isIgnored(p, IGNORE) &&
        existsSync(join(ROOT, p))
    );
    assert.ok(
      read.length >= 1,
      `${id} reads no file of the repository: its path scope is stale`
    );
  }
});

test('the reviewed exception of the SQL rule is still exactly what was reviewed', () => {
  const rule = ruleById('davintrade-prisma-raw-unsafe-dynamic-sql');
  assert.deepEqual(rule.exclude, ['lib/admin/analytics/regional.ts']);
  assert.ok(
    existsSync(join(ROOT, 'lib/admin/analytics/regional.ts')),
    'the excluded file is gone: remove the exclusion from the rule'
  );
  const text = read('lib/admin/analytics/regional.ts');
  // every statement given to $queryRawUnsafe in that file, and what each one interpolates
  const calls = [
    ...text.matchAll(
      /\$queryRawUnsafe\s*(?:<[^()]*>)?\s*\(\s*`([\s\S]*?)`\s*\)/g
    ),
  ];
  assert.equal(
    calls.length,
    3,
    'the file has the three reviewed statements, no more'
  );
  const interpolated = new Set(
    calls.flatMap((m) =>
      [...m[1].matchAll(/\$\{([^}]*)\}/g)].map((i) => i[1].trim())
    )
  );
  assert.deepEqual(
    [...interpolated].sort(),
    ['invoiceOnlyCase', 'mergedRevenueCase', 'resolvedCountryCase'],
    'a new interpolation in the excluded file needs a new review'
  );
  // each one is the output of the CASE builder, called with a fixed column name
  for (const name of interpolated) {
    assert.match(
      text,
      new RegExp(
        `const ${name} = jurisdictionCaseSql\\(\\s*(?:'[^'$]*'|"[^"$]*")\\s*\\)`
      ),
      `${name} must come from jurisdictionCaseSql with a literal column`
    );
  }
  // nothing else in the file hands a built string to a raw call
  assert.equal([...text.matchAll(/\$executeRawUnsafe/g)].length, 0);
});

// --- the commands ---------------------------------------------------------------------------------------------

const node = (script, args, env = {}) =>
  spawnSync(
    process.execPath,
    [join(ROOT, 'scripts', 'security', script), ...args],
    {
      encoding: 'utf8',
      env: { ...process.env, ...env },
      timeout: 120000,
    }
  );

test('the local command prints counts for the repository, and refuses details inside GitHub Actions', () => {
  if (trackedFiles() === null) return;
  const run = node('check-semgrep-rules-local.mjs', []);
  assert.equal(run.status, 0, run.stdout);
  assert.match(
    run.stdout,
    /^semgrep_rules_local: rules=4 files_scanned=\d+ error=0 warning=0 info=0\n$/
  );
  const actions = node('check-semgrep-rules-local.mjs', ['--details'], {
    GITHUB_ACTIONS: 'true',
  });
  assert.equal(actions.status, 2);
  assert.match(actions.stdout, /error=details_not_allowed_in_actions/);
  const usage = node('check-semgrep-rules-local.mjs', ['--nope']);
  assert.equal(usage.status, 2);
});

test('the fixtures command writes the cases outside the repository and refuses a folder inside it', () => {
  const dir = mkdtempSync(join(tmpdir(), 'semgrep-fixtures-'));
  try {
    const run = node('write-semgrep-fixtures.mjs', ['--out', dir]);
    assert.equal(run.status, 0, run.stdout);
    assert.equal(
      run.stdout.trim(),
      `semgrep_fixtures_written: files=${SEMGREP_FIXTURES.length}`
    );
    for (const f of SEMGREP_FIXTURES) {
      assert.equal(readFileSync(join(dir, f.path), 'utf8'), f.content, f.path);
    }
    assert.ok(readdirSync(dir).length > 0);
    // inside the repository, or the repository itself: refused, nothing written
    for (const inside of [join(ROOT, 'scratch-fixtures-never'), ROOT]) {
      const refused = node('write-semgrep-fixtures.mjs', ['--out', inside]);
      assert.equal(refused.status, 2, inside);
      assert.match(refused.stdout, /error=out_inside_repository/);
    }
    assert.equal(existsSync(join(ROOT, 'scratch-fixtures-never')), false);
    assert.equal(node('write-semgrep-fixtures.mjs', []).status, 2);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
