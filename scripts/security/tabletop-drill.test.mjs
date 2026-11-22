// Run: node --test 'scripts/security/*.test.mjs'
//
// The automated tabletop exercise (Phase 4 of the security monitoring architecture, v3.0,
// sections 8 and 9): two synthetic scenarios run through the real scoring engine, the real
// LINE message builders and the behaviour signals, in memory, and are checked against the
// playbooks of docs/runbooks/security-incident-playbooks.md (the real file: the doc and the
// code are kept in step by these tests). Nothing live is read and no alert state is touched.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  PLAYBOOKS,
  TABLETOP_USAGE,
  TabletopUsageError,
  extractSteps,
  parseRunbook,
  parseTabletopArgs,
  playbookFor,
  renderTabletopMarkdown,
  renderTabletopStdout,
  runTabletopCli,
  runTabletopDrill,
} from './tabletop-drill-lib.mjs';
import { BEHAVIOUR_RULES } from './behaviour-signals-lib.mjs';
import {
  buildAlertMessage,
  computeTransitions,
  findPrivacyViolations,
  sanitizeLineText,
} from './line-notifier-lib.mjs';
import { scoreFinding } from './security-pipeline-lib.mjs';

const NOW = new Date('2026-11-22T12:00:00Z');
const RUNBOOK_URL = new URL(
  '../../docs/runbooks/security-incident-playbooks.md',
  import.meta.url
);
const RUNBOOK = readFileSync(RUNBOOK_URL, 'utf8');
const SYNTHETIC = ['MAL-2099-0001', 'drill-malicious-pkg', 'drill-exposed-key'];

const drill = (over = {}) =>
  runTabletopDrill({ runbookText: RUNBOOK, now: NOW, ...over });

// --- the runbook and the code stay in step ------------------------------------------------------------

test('parseRunbook: the real runbook has the seven playbooks, each with triggers and a first 30 minutes', () => {
  const rb = parseRunbook(RUNBOOK);
  assert.deepEqual(Object.keys(rb.playbooks), [
    'PB-1',
    'PB-2',
    'PB-3',
    'PB-4',
    'PB-5',
    'PB-6',
    'PB-7',
  ]);
  for (const pb of Object.values(rb.playbooks)) {
    assert.equal(pb.hasTriggersLine, true, pb.id);
    assert.equal(pb.hasFirstThirtyMinutes, true, pb.id);
    assert.ok(pb.triggers.length > 0, pb.id);
  }
  assert.equal(rb.standingRules.incidentNotes, true);
  assert.equal(rb.standingRules.waitingOn, true);
  assert.equal(rb.tabletopSection, true);
  assert.equal(rb.restoreDrillSection, true);
  assert.deepEqual(rb.noPlaybookSignals, ['BS-2', 'BS-3', 'BS-4', 'BS-5']);
});

test('the playbook table of the code matches the headings and trigger lines of the runbook', () => {
  const rb = parseRunbook(RUNBOOK);
  for (const [id, expected] of Object.entries(PLAYBOOKS)) {
    assert.equal(rb.playbooks[id]?.title, expected.title, id);
    for (const trigger of expected.triggers) {
      assert.ok(
        rb.playbooks[id].triggers.includes(trigger),
        `${id} lists ${trigger}`
      );
    }
  }
});

test('every playbook a behaviour rule names exists, and the rules without one are in the runbook section for them', () => {
  const rb = parseRunbook(RUNBOOK);
  for (const [rule, def] of Object.entries(BEHAVIOUR_RULES)) {
    if (def.playbook !== null) {
      assert.ok(PLAYBOOKS[def.playbook], `${rule} names ${def.playbook}`);
      assert.ok(
        rb.playbooks[def.playbook],
        `${rule}: ${def.playbook} is in the runbook`
      );
    } else {
      // BS-3b and BS-5b are the second rule of BS-3 and BS-5: the section names the signal
      assert.ok(
        rb.noPlaybookSignals.includes(rule.slice(0, 4)),
        `${rule} is answered by the section for signals without a playbook`
      );
    }
  }
});

test('parseRunbook: a runbook with a missing section, a missing trigger line and CRLF endings is described, not trusted', () => {
  const broken = [
    '# x',
    '## PB-1: Secret exposure',
    '**Triggers:** R-3',
    '### First 30 minutes',
    '1. do it',
    '## PB-2: Exploitable dependency or malicious package',
    'no trigger line here',
    '',
  ].join('\r\n');
  const rb = parseRunbook(broken);
  assert.deepEqual(Object.keys(rb.playbooks), ['PB-1', 'PB-2']);
  assert.equal(rb.playbooks['PB-1'].hasTriggersLine, true);
  assert.deepEqual(rb.playbooks['PB-1'].triggers, ['R-3']);
  assert.equal(rb.playbooks['PB-2'].hasTriggersLine, false);
  assert.equal(rb.playbooks['PB-2'].hasFirstThirtyMinutes, false);
  assert.equal(rb.tabletopSection, false);
  assert.deepEqual(rb.noPlaybookSignals, []);
  assert.deepEqual(Object.keys(parseRunbook('').playbooks), []);
  assert.deepEqual(Object.keys(parseRunbook(undefined).playbooks), []);
});

test('extractSteps: the numbered steps of the first 30 minutes of a playbook, without markup', () => {
  const steps = extractSteps(RUNBOOK, 'PB-1');
  assert.ok(steps.length >= 4);
  assert.match(steps[0], /^Scope it without copying it\./);
  assert.ok(
    steps.some((s) => /Revoke and rotate at the provider first/.test(s))
  );
  assert.equal(
    steps.some((s) => /\*\*|`/.test(s)),
    false
  );
  // the steps of a later block are not mixed in
  assert.equal(
    steps.some((s) => /History clean-up comes last/.test(s)),
    false
  );
  assert.deepEqual(extractSteps(RUNBOOK, 'PB-99'), []);
  assert.deepEqual(extractSteps('', 'PB-1'), []);
});

test('extractSteps: the cases listed under a step stay with it, without Markdown', () => {
  const steps = extractSteps(RUNBOOK, 'PB-4');
  assert.match(
    steps[2],
    /^Decide which case it is\. 5xx only: a fault in the service/
  );
  assert.match(
    steps[2],
    /Signature failures from an unknown source: forged traffic/
  );
  assert.equal(/(^|\s)_|_(\s|$)/.test(steps[2]), false, 'no italic marks');
  // an identifier with underscores keeps them
  assert.ok(
    extractSteps(RUNBOOK, 'PB-5').some((s) => /acknowledged_shas/.test(s))
  );
  // the next numbered step is not swallowed
  assert.match(steps[3], /^If forgery is confirmed/);
});

test('playbookFor: the finding decides the playbook', () => {
  assert.equal(
    playbookFor({ secretExposureConfirmed: true, rule: 'R-3' }),
    'PB-1'
  );
  assert.equal(playbookFor({ malicious: true, rule: 'R-3' }), 'PB-2');
  assert.equal(playbookFor({ rule: 'R-5' }), 'PB-2');
  assert.equal(playbookFor({ rule: 'R-6' }), 'PB-2');
  for (const assetId of ['railway-managed-stores', 'railway-pgbouncer']) {
    assert.equal(
      playbookFor({ kind: 'public-endpoint', rule: 'R-9', assetId }),
      'PB-3'
    );
  }
  assert.equal(
    playbookFor({
      kind: 'public-endpoint',
      rule: 'R-9',
      assetId: 'chat-server',
    }),
    'PB-6'
  );
  assert.equal(
    playbookFor({ source: 'behaviour-signals', rule: 'BS-1' }),
    'PB-4'
  );
  assert.equal(
    playbookFor({ source: 'behaviour-signals', rule: 'BS-6' }),
    'PB-5'
  );
  assert.equal(
    playbookFor({ source: 'behaviour-signals', rule: 'BS-2' }),
    null
  );
  assert.equal(playbookFor({ rule: 'R-11' }), null);
  assert.equal(playbookFor(null), null);
});

// --- the exercise -----------------------------------------------------------------------------------------------

test('the drill passes against the real runbook, scenario by scenario', async () => {
  const result = await drill();
  assert.equal(result.schema_version, '1.0');
  assert.equal(result.generated_at, NOW.toISOString());
  assert.equal(result.date, '2026-11-22');
  assert.equal(result.next_due, '2027-11-22');
  assert.equal(result.overall, 'pass');
  assert.deepEqual(
    result.scenarios.map((s) => [s.id, s.status]),
    [
      ['A', 'pass'],
      ['B', 'pass'],
    ]
  );
  assert.deepEqual(
    result.scenarios.map((s) => s.playbooks),
    [
      ['PB-1', 'PB-2'],
      ['PB-3', 'PB-4'],
    ]
  );
  assert.deepEqual(
    result.checks.filter((c) => c.status !== 'pass'),
    []
  );
  assert.equal(result.summary.checks.fail, 0);
  assert.equal(result.summary.checks.total, result.checks.length);
  assert.ok(result.summary.checks.total >= 20);
  assert.deepEqual(result.summary.scenarios, {
    total: 2,
    passed: 2,
    failed: 0,
  });
  assert.deepEqual(result.summary.runbook, {
    playbooks_found: 7,
    playbooks_expected: 7,
  });
  // the same inputs give the same report
  assert.equal(JSON.stringify(await drill()), JSON.stringify(result));
});

test('scenario A: a confirmed secret and a malicious package are P0 under R-3, with the clock of the rule', async () => {
  const a = (await drill()).scenarios.find((s) => s.id === 'A');
  assert.deepEqual(
    a.findings.map((f) => [
      f.kind,
      f.priority,
      f.rule,
      f.assetId,
      f.escalation,
      f.playbook,
    ]),
    [
      ['secret-exposure', 'P0', 'R-3', 'money-service', true, 'PB-1'],
      ['advisory', 'P0', 'R-3', 'monolith-web', false, 'PB-2'],
    ]
  );
  assert.deepEqual(a.alerts, [
    { reason: 'new_p0', assetId: 'money-service' },
    { reason: 'malicious_package', assetId: 'monolith-web' },
  ]);
  assert.equal(
    a.message,
    [
      '🚨 [DavinTrade Security Alert] 2026-11-22 12:00 UTC',
      'Malicious-package record: 1 (monolith-web)',
      'New P0: 1 (money-service)',
      'Open now: P0=2 P1=0 P2=0 P3=0',
      'Details: reports/latest-security-posture.md',
    ].join('\n')
  );
  assert.equal(a.sla_hours, 4);
  assert.equal(a.sla_deadline, '2026-11-22T16:00:00.000Z');
});

test('scenario B: an unexpected data-store endpoint is P1 under R-9 and a signature spike is P1 under BS-1', async () => {
  const b = (await drill()).scenarios.find((s) => s.id === 'B');
  assert.deepEqual(
    b.findings.map((f) => [
      f.kind,
      f.priority,
      f.rule,
      f.assetId,
      f.escalation,
      f.playbook,
    ]),
    [
      ['webhook-anomaly', 'P1', 'BS-1', 'money-service', true, 'PB-4'],
      ['public-endpoint', 'P1', 'R-9', 'railway-managed-stores', false, 'PB-3'],
    ]
  );
  assert.deepEqual(b.alerts, [
    { reason: 'behaviour_breach', assetId: 'money-service' },
    { reason: 'posture_breach', assetId: 'railway-managed-stores' },
  ]);
  assert.equal(
    b.message,
    [
      '🚨 [DavinTrade Security Alert] 2026-11-22 12:00 UTC',
      'Live posture breach: 1 (railway-managed-stores)',
      'Behaviour signal breach: 1 (money-service)',
      'Open now: P0=0 P1=2 P2=0 P3=0',
      'Details: reports/latest-security-posture.md',
    ].join('\n')
  );
  assert.match(
    b.heartbeat,
    /Behaviour signals: pass=0 fail=1 unavailable=0 skipped=9 \| webhooks=fail/
  );
  assert.equal(b.sla_hours, 72);
  assert.equal(b.sla_deadline, '2026-11-25T12:00:00.000Z');
});

test('every message of the drill is counts only: no identifier, package name or address', async () => {
  const result = await drill();
  for (const s of result.scenarios) {
    for (const text of [s.message, s.heartbeat]) {
      assert.deepEqual(
        findPrivacyViolations(text, { forbidden: SYNTHETIC }),
        [],
        text
      );
      for (const word of SYNTHETIC) {
        assert.equal(text.includes(word), false, word);
      }
      assert.equal(text.includes('<PROD_DB>'), false);
    }
  }
  // and neither report names the synthetic identifiers
  const report =
    JSON.stringify(result) +
    renderTabletopMarkdown(result, { runbookText: RUNBOOK });
  for (const word of SYNTHETIC) {
    assert.equal(report.includes(word), false, word);
  }
});

test('a second sweep with the same findings alerts nobody again', async () => {
  const result = await drill();
  for (const s of result.scenarios) {
    const check = result.checks.find(
      (c) => c.id === `${s.id.toLowerCase()}-alert-once`
    );
    assert.equal(check.status, 'pass', s.id);
    assert.equal(check.observed, 'alerts=0');
  }
});

test('the drill fails loudly when the runbook loses a playbook, a trigger or a section', async () => {
  const noPb4 = RUNBOOK.replace(
    '## PB-4: Webhook or payment anomaly',
    '## Webhooks'
  );
  const result = await drill({ runbookText: noPb4 });
  assert.equal(result.overall, 'fail');
  assert.equal(result.scenarios.find((s) => s.id === 'B').status, 'fail');
  assert.equal(result.scenarios.find((s) => s.id === 'A').status, 'pass');
  const bad = result.checks.filter((c) => c.status === 'fail');
  assert.ok(
    bad.some((c) => c.id === 'b-playbooks'),
    'the mapping check fails'
  );
  assert.ok(
    bad.some((c) => c.id === 'runbook-playbooks'),
    'the runbook check fails'
  );
  assert.equal(result.summary.runbook.playbooks_found, 6);

  const noTrigger = RUNBOOK.replace(
    /\*\*Triggers:\*\* BS-1/,
    '**Triggers:** a webhook'
  );
  assert.equal(
    (await drill({ runbookText: noTrigger })).checks.find(
      (c) => c.id === 'b-playbooks'
    ).status,
    'fail'
  );
  const noRules = RUNBOOK.replace(
    '## Standing rules for every incident',
    '## Rules'
  );
  assert.equal(
    (await drill({ runbookText: noRules })).checks.find(
      (c) => c.id === 'runbook-standing-rules'
    ).status,
    'fail'
  );
  const noSchedules = RUNBOOK.replace(
    '## Quarterly Postgres restore drill',
    '## Restores'
  );
  assert.equal(
    (await drill({ runbookText: noSchedules })).checks.find(
      (c) => c.id === 'runbook-schedules'
    ).status,
    'fail'
  );
  const noSignals = RUNBOOK.replace(
    '## Behaviour signals without their own playbook',
    '## Signals'
  );
  assert.equal(
    (await drill({ runbookText: noSignals })).checks.find(
      (c) => c.id === 'runbook-no-playbook'
    ).status,
    'fail'
  );
  const empty = await drill({ runbookText: '' });
  assert.equal(empty.overall, 'fail');
  assert.equal(empty.summary.runbook.playbooks_found, 0);
});

// A drill that cannot fail is no control. These break one part of the pipeline at a time and
// check that the exercise notices.

const failedIds = (result) =>
  result.checks.filter((c) => c.status === 'fail').map((c) => c.id);

test('the drill fails when the scoring engine scores a confirmed secret too low', async () => {
  const result = await drill({
    parts: {
      scoreFinding: (finding, asset, ctx) => ({
        ...scoreFinding(finding, asset, ctx),
        ...(finding.secretExposureConfirmed
          ? { priority: 'P1', rule: 'R-8' }
          : {}),
      }),
    },
  });
  assert.equal(result.overall, 'fail');
  assert.ok(failedIds(result).includes('a-secret-tier'));
  assert.equal(result.scenarios.find((s) => s.id === 'A').status, 'fail');
  assert.equal(result.scenarios.find((s) => s.id === 'B').status, 'pass');
});

test('the drill fails when a secret on a Rule 5 asset stops escalating, or a package starts to', async () => {
  const noEscalation = await drill({
    parts: {
      scoreFinding: (finding, asset, ctx) => ({
        ...scoreFinding(finding, asset, ctx),
        escalation: false,
      }),
    },
  });
  assert.ok(failedIds(noEscalation).includes('a-escalation'));
  const everything = await drill({
    parts: {
      scoreFinding: (finding, asset, ctx) => ({
        ...scoreFinding(finding, asset, ctx),
        escalation: true,
      }),
    },
  });
  assert.ok(failedIds(everything).includes('a-escalation'));
});

test('the drill fails when the notifier would alert twice for the same finding', async () => {
  const result = await drill({
    parts: {
      computeTransitions: (state, findings) =>
        Object.keys(state.findings).length > 0
          ? {
              alerts: [{ reason: 'new_p1', assetId: 'money-service' }],
              resolved: 0,
            }
          : computeTransitions(state, findings),
    },
  });
  assert.ok(failedIds(result).includes('a-alert-once'));
  assert.ok(failedIds(result).includes('b-alert-once'));
  assert.equal(
    result.checks.find((c) => c.id === 'a-alert-once').observed,
    'alerts=1'
  );
});

test('the drill fails when the message guard rejects the alert, or the alert carries an address', async () => {
  const rejected = await drill({
    parts: {
      sanitizeLineText: (text, kind, options) => ({
        ...sanitizeLineText(text, kind, options),
        safe: false,
      }),
    },
  });
  assert.ok(failedIds(rejected).includes('a-alert-message'));
  assert.ok(failedIds(rejected).includes('b-alert-message'));
  const leaking = await drill({
    parts: {
      buildAlertMessage: (input) =>
        `${buildAlertMessage(input)}\nhost 203.0.113.9`,
    },
  });
  assert.ok(failedIds(leaking).includes('a-alert-message'));
  assert.equal(
    leaking.checks.find((c) => c.id === 'a-alert-message').observed,
    'violations=1 safe=no'
  );
});

test('the drill fails when the alert loses a reason, so the owner would not be told', async () => {
  const result = await drill({
    parts: {
      computeTransitions: (state, findings) => ({
        ...computeTransitions(state, findings),
        alerts: [],
      }),
    },
  });
  assert.ok(failedIds(result).includes('a-alert-reasons'));
  assert.ok(failedIds(result).includes('b-alert-message'));
});

// --- the reports --------------------------------------------------------------------------------------------------------

test('the Markdown report is a facilitator sheet: results, the alert as sent, the playbook steps, the gaps', async () => {
  const md = renderTabletopMarkdown(await drill(), { runbookText: RUNBOOK });
  assert.match(md, /^# DavinTrade tabletop exercise report \(private\)/);
  assert.match(md, /2026-11-22/);
  assert.match(
    md,
    /never commit it, paste it into an issue or attach it to a public log/
  );
  for (const heading of [
    '## Result',
    '## Scenario A: ',
    '## Scenario B: ',
    '### Automated checks',
    '### The alert as it would arrive on LINE',
    '### The first 30 minutes of each playbook',
    '### Questions for the walk-through',
    '## Gaps the exercise found in the pipeline',
    '## Follow-ups',
  ]) {
    assert.ok(md.includes(heading), heading);
  }
  assert.match(md, /Malicious-package record: 1 \(monolith-web\)/);
  assert.match(md, /Revoke and rotate at the provider first/);
  assert.match(md, /Overall: PASS/);
  assert.match(md, /next exercise is due by 2027-11-22/);
  assert.equal(md.split('\n').at(-1), '');
  // without the runbook text the report still renders, and says where the steps are
  assert.match(
    renderTabletopMarkdown(await drill()),
    /docs\/runbooks\/security-incident-playbooks\.md/
  );
});

test('the gaps are what the exercise really found: no producer for a confirmed secret, no endpoint diff for data stores', async () => {
  const { gaps } = await drill();
  assert.ok(gaps.length >= 5);
  assert.deepEqual(
    gaps.map((g) => g.id),
    [
      'G-secret-detection',
      'G-endpoint-diff',
      'G-telemetry',
      'G-cadence',
      'G-no-playbook',
    ]
  );
  assert.match(gaps[0].text, /secret/i);
  for (const g of gaps) {
    assert.deepEqual(findPrivacyViolations(g.text), [], g.id);
  }
});

test('the Markdown report escapes a table cell, so a value cannot break out of it', async () => {
  const result = await drill();
  result.scenarios[0].checks[0].observed = 'a|b <x> \\';
  assert.ok(
    renderTabletopMarkdown(result, { runbookText: RUNBOOK }).includes(
      'a\\|b &lt;x&gt; \\\\'
    )
  );
});

test('a failed drill says FAIL in the report', async () => {
  const failed = await drill({ runbookText: '' });
  assert.match(
    renderTabletopMarkdown(failed, { runbookText: '' }),
    /Overall: FAIL/
  );
});

test('renderTabletopStdout: counts and fixed words only', async () => {
  const lines = renderTabletopStdout(await drill());
  assert.equal(lines[0], 'DavinTrade tabletop exercise (counts only)');
  assert.match(lines[1], /^tabletop_run: 2026-11-22T12:00:00\.000Z$/);
  assert.match(lines[2], /^tabletop_scenarios: total=2 passed=2 failed=0$/);
  assert.match(lines[3], /^tabletop_checks: total=\d+ pass=\d+ fail=0$/);
  assert.equal(lines[4], 'tabletop_runbook: playbooks=7/7');
  assert.equal(lines[5], 'tabletop_result: PASS');
  assert.equal(
    lines[6],
    'reports: 2026-11-22 tabletop-exercise-report.md and .json written to reports/incidents/ (private, gitignored)'
  );
  assert.equal(lines.length, 7);
  for (const line of lines) {
    assert.deepEqual(findPrivacyViolations(line), [], line);
  }
  assert.equal(
    renderTabletopStdout(await drill({ runbookText: '' }))[5],
    'tabletop_result: FAIL'
  );
});

// --- the command ----------------------------------------------------------------------------------------------------------

const ROOT = '/repo';
const norm = (path) => String(path).replaceAll('\\', '/');
const INCIDENTS = `${ROOT}/davintrade-security-monitoring-pipeline/reports/incidents`;

function cliHarness({ runbook = RUNBOOK } = {}) {
  const files = new Map();
  if (runbook !== null) {
    files.set(`${ROOT}/docs/runbooks/security-incident-playbooks.md`, runbook);
  }
  const reads = [];
  const writes = [];
  const logs = [];
  const deps = {
    root: ROOT,
    fs: {
      readText: (p) => {
        reads.push(norm(p));
        return files.get(norm(p)) ?? null;
      },
      writeText: (p, t) => {
        writes.push(norm(p));
        files.set(norm(p), t);
      },
      mkdirp: () => {},
    },
    now: () => NOW,
    log: (line) => logs.push(line),
  };
  return {
    files,
    reads,
    writes,
    logs,
    deps,
    run: (argv = []) => runTabletopCli({ argv, deps }),
    stdout: () => logs.join('\n'),
  };
}

test('the command reads only the runbook, writes only the two dated reports, and prints counts', async () => {
  const h = cliHarness();
  assert.equal(await h.run(), 0);
  assert.deepEqual(h.reads, [
    `${ROOT}/docs/runbooks/security-incident-playbooks.md`,
  ]);
  assert.deepEqual(h.writes.sort(), [
    `${INCIDENTS}/2026-11-22-tabletop-exercise-report.json`,
    `${INCIDENTS}/2026-11-22-tabletop-exercise-report.md`,
  ]);
  assert.equal(
    h.writes.some((p) => /alert-state|sweep-history|runtime-state/.test(p)),
    false
  );
  const json = JSON.parse(
    h.files.get(`${INCIDENTS}/2026-11-22-tabletop-exercise-report.json`)
  );
  assert.equal(json.overall, 'pass');
  assert.match(
    h.files.get(`${INCIDENTS}/2026-11-22-tabletop-exercise-report.md`),
    /^# DavinTrade tabletop exercise report \(private\)/
  );
  for (const line of h.logs) {
    assert.deepEqual(findPrivacyViolations(line), [], line);
  }
  assert.match(h.stdout(), /tabletop_result: PASS/);
  assert.match(
    h.stdout(),
    /reports: 2026-11-22 tabletop-exercise-report\.md and \.json written/
  );
});

test('a failed exercise still writes the report, and exits 1', async () => {
  const h = cliHarness({
    runbook: RUNBOOK.replace('## PB-3: Exposed data store', '## Stores'),
  });
  assert.equal(await h.run(), 1);
  assert.equal(h.writes.length, 2);
  assert.match(h.stdout(), /tabletop_result: FAIL/);
});

test('--date names the report, --root and --pipeline-dir move it', async () => {
  const h = cliHarness();
  assert.equal(await h.run(['--date', '2027-11-20']), 0);
  assert.ok(
    h.writes.every((p) => p.includes('/2027-11-20-tabletop-exercise-report.'))
  );
  assert.match(h.stdout(), /reports: 2027-11-20 tabletop-exercise-report/);
  const moved = cliHarness();
  moved.files.set(
    '/elsewhere/docs/runbooks/security-incident-playbooks.md',
    RUNBOOK
  );
  assert.equal(
    await moved.run(['--root', '/elsewhere', '--pipeline-dir', '/private']),
    0
  );
  assert.deepEqual(moved.writes.sort(), [
    '/private/reports/incidents/2026-11-22-tabletop-exercise-report.json',
    '/private/reports/incidents/2026-11-22-tabletop-exercise-report.md',
  ]);
});

test('a missing runbook is a setup error with a fixed code, and nothing is written', async () => {
  const h = cliHarness({ runbook: null });
  assert.equal(await h.run(), 2);
  assert.equal(h.stdout(), 'error=runbook_not_found');
  assert.deepEqual(h.writes, []);
});

test('--help prints the usage; a bad argument exits 2', async () => {
  const help = cliHarness();
  assert.equal(await help.run(['--help']), 0);
  assert.match(
    help.stdout(),
    /Usage: node scripts\/security\/run-tabletop-drill\.mjs/
  );
  assert.equal(help.reads.length, 0);
  const bad = cliHarness();
  assert.equal(await bad.run(['--bogus']), 2);
  assert.match(bad.stdout(), /error=usage/);
  assert.deepEqual(bad.writes, []);
});

test('a report that cannot be written is a fixed error and exit 1', async () => {
  const h = cliHarness();
  h.deps.fs.writeText = () => {
    throw new Error('disk full at /secret/path');
  };
  assert.equal(await h.run(), 1);
  assert.equal(h.stdout(), 'error=report_write_failed');
});

test('parseTabletopArgs: defaults, values and refusals', () => {
  assert.deepEqual(parseTabletopArgs([]), {
    help: false,
    root: null,
    pipelineDir: null,
    date: null,
  });
  assert.deepEqual(
    parseTabletopArgs([
      '--root=/r',
      '--pipeline-dir',
      '/p',
      '--date',
      '2026-12-01',
    ]),
    { help: false, root: '/r', pipelineDir: '/p', date: '2026-12-01' }
  );
  assert.equal(parseTabletopArgs(['-h']).help, true);
  assert.match(
    TABLETOP_USAGE,
    /Exit codes: 0 every check passed, 1 a check failed or an unexpected failure, 2 usage or setup error/
  );
  for (const argv of [
    ['--nope'],
    ['--date', 'tomorrow'],
    ['--date', '2026-13-40'],
    ['--date'],
    ['--root='],
    ['positional'],
  ]) {
    assert.throws(
      () => parseTabletopArgs(argv),
      TabletopUsageError,
      argv.join(' ')
    );
  }
});
