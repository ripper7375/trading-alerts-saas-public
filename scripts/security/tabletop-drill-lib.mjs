// The automated tabletop exercise (Phase 4 of the security monitoring architecture, v3.0,
// sections 8 and 9): the first of the annual rehearsals of the response playbooks.
//
// Two synthetic scenarios run end to end, in memory, through the real parts of the pipeline:
//
//   A  a confirmed secret exposure and a malicious package (PB-1, PB-2; rule R-3; under 4 hours)
//   B  an unexpected public endpoint on a data store and a webhook signature spike
//      (PB-3, PB-4; rule R-9 and signal BS-1)
//
// For each finding the exercise checks what the pipeline would do: the scoring engine gives the
// exact tier and rule, the LINE notifier builds an alert that is counts, tiers and asset ids only
// (and says nothing twice), and the alert maps to a section of
// docs/runbooks/security-incident-playbooks.md that lists its rule. The runbook is read as text and
// parsed, so the code and the document cannot drift apart without a check failing.
//
// What this does not do: it reads no live system and never touches reports/alert-state.json. The
// findings are built here; the only file read is the runbook, and the only files written are the
// dated reports. The human half of a tabletop exercise (who does what, how long it really takes)
// is in the report as a facilitator sheet: the first 30 minutes of each playbook, questions, and
// the gaps the rehearsal found in the pipeline.

import { join } from 'node:path';
import {
  BEHAVIOUR_RULES,
  runBehaviourSignals,
} from './behaviour-signals-lib.mjs';
import {
  buildAlertMessage,
  buildHeartbeatMessage,
  computeTransitions,
  emptyAlertState,
  findPrivacyViolations,
  heartbeatDecision,
  sanitizeLineText,
  snapshotFindings,
} from './line-notifier-lib.mjs';
import {
  evaluateSecretScanningAlerts,
  makePostureFinding,
} from './posture-sweep-lib.mjs';
import {
  compareFindings,
  escapeMarkdownCell,
  findingKey,
  makeFinding,
  scoreFinding,
  summarizeFindings,
  vexExpiryReasons,
  vexStatementMatches,
} from './security-pipeline-lib.mjs';

const HOUR_MS = 3600000;
const RUNBOOK_PATH = ['docs', 'runbooks', 'security-incident-playbooks.md'];
const esc = escapeMarkdownCell;

// The parts of the pipeline the exercise exercises. The tests replace one at a time with a broken
// one, to prove that the exercise notices; the command never does.
const REAL_PARTS = Object.freeze({
  scoreFinding,
  computeTransitions,
  buildAlertMessage,
  sanitizeLineText,
  evaluateSecretScanningAlerts,
  makePostureFinding,
});

/**
 * The seven playbooks of section 8 as the runbook must have them: the heading title and the
 * rules or signals the section lists as its triggers.
 */
export const PLAYBOOKS = Object.freeze({
  'PB-1': { title: 'Secret exposure', threat: 'T2', triggers: ['R-3'] },
  'PB-2': {
    title: 'Exploitable dependency or malicious package',
    threat: 'T4, T5',
    triggers: ['R-3', 'R-5', 'R-6'],
  },
  'PB-3': { title: 'Exposed data store', threat: 'T3', triggers: ['R-9'] },
  'PB-4': {
    title: 'Webhook or payment anomaly',
    threat: 'T6',
    triggers: ['BS-1'],
  },
  'PB-5': {
    title: 'Suspicious change on main',
    threat: 'T1',
    triggers: ['BS-6'],
  },
  'PB-6': {
    title: 'DNS or certificate anomaly',
    threat: 'T9',
    triggers: ['R-9'],
  },
  'PB-7': {
    title: 'VPS compromise suspected',
    threat: 'T10',
    triggers: ['check-vps-drift.sh'],
  },
});

// An R-9 finding on one of these assets is an exposed data store; elsewhere it is DNS or a name.
const DATA_STORE_ASSETS = new Set([
  'railway-managed-stores',
  'railway-pgbouncer',
]);

/**
 * The playbook that answers a scored finding, or null when the runbook has no playbook of its
 * own for it (BS-2 to BS-5 are answered by a short section instead).
 */
export function playbookFor(finding) {
  if (!finding) return null;
  if (finding.secretExposureConfirmed) return 'PB-1';
  if (finding.malicious) return 'PB-2';
  if (finding.rule === 'R-5' || finding.rule === 'R-6') return 'PB-2';
  if (finding.source === 'behaviour-signals') {
    return BEHAVIOUR_RULES[finding.rule]?.playbook ?? null;
  }
  if (finding.kind === 'public-endpoint') {
    return DATA_STORE_ASSETS.has(finding.assetId) ? 'PB-3' : 'PB-6';
  }
  return null;
}

// --- the runbook as text -------------------------------------------------------------------------------

const TRIGGER_TOKEN_RE = /\b(?:R-\d+|BS-\d+b?|check-vps-drift\.sh)\b/g;

function sectionsOf(text) {
  const sections = [];
  let current = null;
  for (const line of String(text ?? '').split(/\r?\n/)) {
    const heading = /^## (.+)$/.exec(line);
    if (heading) {
      current = { heading: heading[1].trim(), lines: [] };
      sections.push(current);
    } else if (current) {
      current.lines.push(line);
    }
  }
  return sections;
}

/**
 * Describes the runbook: its playbooks (title, trigger tokens, whether it has a first 30
 * minutes), the standing rules, the two rehearsal sections and the signals that have a short
 * section instead of a playbook. Never throws; a runbook that is missing or broken is described
 * as such.
 *
 * @param {string | null | undefined} text
 */
export function parseRunbook(text) {
  const sections = sectionsOf(text);
  const playbooks = {};
  for (const section of sections) {
    const m = /^(PB-\d+): (.+)$/.exec(section.heading);
    if (!m) continue;
    const triggerLine = section.lines.find((l) =>
      l.startsWith('**Triggers:**')
    );
    playbooks[m[1]] = {
      id: m[1],
      title: m[2],
      hasTriggersLine: triggerLine !== undefined,
      triggers:
        triggerLine === undefined
          ? []
          : [...new Set(triggerLine.match(TRIGGER_TOKEN_RE) ?? [])],
      hasFirstThirtyMinutes: section.lines.some(
        (l) => l.trim() === '### First 30 minutes'
      ),
    };
  }
  const named = (name) => sections.find((s) => s.heading === name) ?? null;
  const rules = named('Standing rules for every incident');
  const rulesText = rules ? rules.lines.join('\n') : '';
  const noPlaybook = named('Behaviour signals without their own playbook');
  return {
    playbooks,
    standingRules: {
      incidentNotes: rulesText.includes('reports/incidents/'),
      waitingOn: rulesText.includes('waiting-on.md'),
    },
    tabletopSection: named('Annual tabletop exercise') !== null,
    restoreDrillSection: named('Quarterly Postgres restore drill') !== null,
    noPlaybookSignals: noPlaybook
      ? noPlaybook.lines
          .map((l) => /^### (BS-\d+):/.exec(l)?.[1])
          .filter(Boolean)
      : [],
  };
}

const plainText = (text) =>
  text
    .replace(/\*\*/g, '')
    .replace(/`/g, '')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    // _italic_ marks around a phrase; an underscore inside an identifier is kept
    .replace(/(^|\s)_([^_\s][^_]*?)_(?=\s|$)/g, '$1$2')
    .trim();

/**
 * The numbered steps of the "First 30 minutes" block of a playbook, without Markdown. A step
 * keeps the cases listed under it (its indented bullets), so a facilitator sees all of it.
 */
export function extractSteps(text, id) {
  const section = sectionsOf(text).find((s) => s.heading.startsWith(`${id}:`));
  if (!section) return [];
  const start = section.lines.findIndex(
    (l) => l.trim() === '### First 30 minutes'
  );
  if (start === -1) return [];
  const steps = [];
  for (const line of section.lines.slice(start + 1)) {
    if (line.startsWith('#')) break;
    const item = /^\d+\.\s+(.+)$/.exec(line);
    if (item) {
      steps.push(plainText(item[1]));
      continue;
    }
    const nested = /^\s+[-*]\s+(.+)$/.exec(line);
    if (nested && steps.length > 0) {
      steps[steps.length - 1] += ` ${plainText(nested[1])}`;
    }
  }
  return steps.map((step) => step.slice(0, 600));
}

// --- the synthetic world -----------------------------------------------------------------------------------

// The inventory ids of the real assets, with the exposure the real inventory gives them. Defined
// here so the exercise does not depend on the live inventory file.
const ASSETS = Object.freeze({
  'money-service': {
    id: 'money-service',
    lifecycle: 'production',
    exposureTier: 1,
    escalationRequired: true,
    buildOnlyPackages: new Set(),
  },
  'monolith-web': {
    id: 'monolith-web',
    lifecycle: 'production',
    exposureTier: 1,
    escalationRequired: false,
    buildOnlyPackages: new Set(),
  },
  'railway-managed-stores': {
    id: 'railway-managed-stores',
    lifecycle: 'production',
    exposureTier: 2,
    escalationRequired: false,
    buildOnlyPackages: new Set(),
  },
});
const INVENTORY = { assets: Object.values(ASSETS) };

const check = (id, description, expected, observed, ok) => ({
  id,
  description,
  expected,
  observed,
  status: ok ? 'pass' : 'fail',
});

const slaHours = (sla) => {
  const m = /^< (\d+) h/.exec(String(sla ?? ''));
  return m ? Number(m[1]) : null;
};

const briefFinding = (f) => ({
  kind: f.kind,
  priority: f.priority,
  rule: f.rule,
  assetId: f.assetId,
  escalation: f.escalation === true,
  playbook: playbookFor(f),
  sla: f.sla,
});

// the strings a message must never carry, as the sweep builds them
const forbiddenWords = (findings) => [
  ...new Set(
    findings
      .flatMap((f) => [
        ...f.advisoryIds,
        f.primaryId,
        /[\d@/_.-]/.test(f.packageName) ? f.packageName : null,
      ])
      .filter(Boolean)
  ),
];

function syntheticPosture({ findings, behaviour }) {
  return {
    run: { degraded: false, offline: true },
    inventory: {
      assets_total: INVENTORY.assets.length,
      assets_scanned: INVENTORY.assets.length,
    },
    matchers: { ok: 0, failed: 0, skipped: 0 },
    summary: summarizeFindings(findings),
    runtime_floors: {
      counts: {
        below_floor: 0,
        behind_latest_security: 0,
        unverified: 0,
        ok: 0,
        unknown_line: 0,
      },
      floors: [],
    },
    dependabot: { status: 'skipped' },
    findings,
    ...(behaviour ? { live_behaviour: behaviour } : {}),
  };
}

// The alert, the second sweep and the heartbeat of a set of findings, with their checks.
function alertChain({
  P,
  prefix,
  findings,
  behaviour,
  now,
  expectedReasons,
  expectedLabels,
}) {
  const alerts = P.computeTransitions(emptyAlertState(), findings).alerts;
  const posture = syntheticPosture({ findings, behaviour });
  const message = P.buildAlertMessage({ alerts, posture, now });
  const forbidden = forbiddenWords(findings);
  const violations = findPrivacyViolations(message, { forbidden });
  const sanitized = P.sanitizeLineText(message, 'alert', { forbidden });
  const again = P.computeTransitions(
    { ...emptyAlertState(), findings: snapshotFindings(findings) },
    findings
  ).alerts;
  const heartbeat = buildHeartbeatMessage({
    posture,
    now,
    heartbeat: heartbeatDecision({
      lastHeartbeatAt: null,
      now,
      requested: true,
    }),
    resolved: 0,
  });
  const heartbeatViolations = findPrivacyViolations(heartbeat, { forbidden });
  const t = posture.summary.tiers;
  const tiers = `P0=${t.P0} P1=${t.P1} P2=${t.P2} P3=${t.P3}`;
  const reasons = alerts.map((a) => a.reason);
  return {
    alerts,
    message,
    heartbeat,
    checks: [
      check(
        `${prefix}-alert-reasons`,
        'The first sweep raises one alert per finding, with the notifier reason of each',
        expectedReasons.join(', '),
        reasons.join(', '),
        reasons.join() === expectedReasons.join()
      ),
      check(
        `${prefix}-alert-message`,
        'The LINE alert is counts, tiers and asset ids only, and carries every reason and the open counts',
        'no leak; every reason and the open counts',
        `violations=${violations.length} safe=${sanitized.safe ? 'yes' : 'no'}`,
        violations.length === 0 &&
          sanitized.safe &&
          expectedLabels.every((label) => message.includes(label)) &&
          message.includes(`Open now: ${tiers}`)
      ),
      check(
        `${prefix}-alert-once`,
        'A second sweep with the same findings raises nothing',
        'alerts=0',
        `alerts=${again.length}`,
        again.length === 0
      ),
      check(
        `${prefix}-heartbeat`,
        'The heartbeat of the same sweep is counts only and shows the open tiers',
        'no leak; the open counts',
        `violations=${heartbeatViolations.length}`,
        heartbeatViolations.length === 0 && heartbeat.includes(`Open: ${tiers}`)
      ),
    ],
  };
}

// Does the runbook have a section for every finding, and does it list the finding's rule?
function playbookCheck({ prefix, findings, rb }) {
  const parts = [];
  const problems = [];
  for (const f of findings) {
    const id = playbookFor(f);
    const entry = id ? rb.playbooks[id] : null;
    if (!id) problems.push(`no playbook for ${f.rule}`);
    else if (!entry) problems.push(`${id} is not in the runbook`);
    else if (entry.title !== PLAYBOOKS[id].title)
      problems.push(`${id} has another title`);
    else if (!entry.hasFirstThirtyMinutes)
      problems.push(`${id} has no first 30 minutes`);
    else if (!entry.triggers.includes(f.rule))
      problems.push(`${id} does not list ${f.rule}`);
    else parts.push(`${id} ok`);
  }
  return check(
    `${prefix}-playbooks`,
    'Every alert maps to a section of the runbook that lists its rule and has a first 30 minutes',
    findings.map((f) => `${playbookFor(f)} (${f.rule})`).join(', '),
    problems.length === 0 ? parts.join(', ') : problems.join('; '),
    problems.length === 0
  );
}

function context(now) {
  return {
    today: now.toISOString().slice(0, 10),
    vexStatements: [],
    vexMatches: vexStatementMatches,
    vexExpiry: vexExpiryReasons,
  };
}

function finishScenario({ spec, now, findings, chain, checks }) {
  const hours = findings
    .map((f) => slaHours(f.sla))
    .filter((h) => h !== null)
    .reduce((min, h) => Math.min(min, h), Infinity);
  return {
    id: spec.id,
    title: spec.title,
    status: checks.every((c) => c.status === 'pass') ? 'pass' : 'fail',
    playbooks: spec.playbooks,
    injects: spec.injects,
    questions: spec.questions,
    findings: findings.map(briefFinding),
    alerts: chain.alerts,
    message: chain.message,
    heartbeat: chain.heartbeat,
    sla_hours: Number.isFinite(hours) ? hours : null,
    sla_deadline: Number.isFinite(hours)
      ? new Date(now.getTime() + hours * HOUR_MS).toISOString()
      : null,
    checks,
  };
}

// --- scenario A: a secret and a malicious package ------------------------------------------------------------

const SCENARIO_A = Object.freeze({
  id: 'A',
  title: 'A confirmed secret exposure and a malicious package',
  playbooks: ['PB-1', 'PB-2'],
  injects: [
    'GitHub secret scanning reports that a payment-provider key was committed to a public file, and the owner confirms the key is live. (Since Phase 5 the posture sweep reads the open alerts and raises each one itself; the exercise also builds the finding of a payment-provider key on the Rule 5 asset by hand, to rehearse the escalation.)',
    'The OSV feed publishes a malicious-package (MAL-) record for a package that is in the lockfile of the web app.',
  ],
  questions: [
    'Who rotates the key, in what order, and how long does it take from the provider to the last copy (Railway, Vercel, the Actions secrets, local files)?',
    'Is there one list of every copy of that key, and where is it?',
    'What could the key do in the window, and where do you read what it did?',
    'For the package: was it ever installed on a developer machine or in CI? How would you know?',
    'Which secrets could that build or that machine read, and who rotates them?',
    'Under 4 hours: what stops you (no laptop, asleep, travelling)? Who is the backup?',
  ],
});

function scenarioA({ now, rb, P }) {
  const ctx = context(now);
  const secret = P.scoreFinding(
    makeFinding({
      kind: 'secret-exposure',
      source: 'secret-scanning',
      ecosystem: 'secrets',
      assetId: 'money-service',
      packageName: 'drill-exposed-key',
      primaryId: 'DRILL-SECRET-0001',
      title: 'A confirmed secret exposure (synthetic)',
      severity: 'critical',
      scope: 'runtime',
      secretExposureConfirmed: true,
      key: findingKey(['drill', 'secret']),
    }),
    ASSETS['money-service'],
    ctx
  );
  const malicious = P.scoreFinding(
    makeFinding({
      kind: 'advisory',
      source: 'osv',
      ecosystem: 'npm',
      assetId: 'monolith-web',
      packageName: 'drill-malicious-pkg',
      version: '1.0.0',
      advisoryIds: ['MAL-2099-0001'],
      title: 'Malicious code in a package (synthetic)',
      severity: 'critical',
      scope: 'runtime',
      malicious: true,
      key: findingKey(['drill', 'malicious']),
    }),
    ASSETS['monolith-web'],
    ctx
  );
  const findings = [secret, malicious].sort(compareFindings);
  const chain = alertChain({
    P,
    prefix: 'a',
    findings,
    behaviour: null,
    now,
    expectedReasons: ['secret_breach', 'malicious_package'],
    expectedLabels: [
      'Malicious-package record: 1 (monolith-web)',
      'Secret scanning breach: 1 (money-service)',
    ],
  });
  // The producer (Phase 5): an open alert in the answer of the secret-scanning probe becomes the
  // same kind of finding on its own, so the pipeline can raise R-3 for a secret without a person.
  const [alertCheck = null] = P.evaluateSecretScanningAlerts({
    result: { ok: true, status: 200, numbers: [1], more: false },
  });
  const produced = alertCheck
    ? P.makePostureFinding(alertCheck, { inventory: INVENTORY })
    : null;
  const producedAlerts = produced
    ? P.computeTransitions(emptyAlertState(), [produced]).alerts
    : [];
  const hours = [secret, malicious].map((f) => slaHours(f.sla));
  const checks = [
    check(
      'a-secret-tier',
      'A confirmed secret exposure scores P0 under R-3',
      'P0 R-3',
      `${secret.priority} ${secret.rule}`,
      secret.priority === 'P0' && secret.rule === 'R-3'
    ),
    check(
      'a-malicious-tier',
      'A MAL- record on a production lockfile scores P0 under R-3',
      'P0 R-3',
      `${malicious.priority} ${malicious.rule}`,
      malicious.priority === 'P0' && malicious.rule === 'R-3'
    ),
    check(
      'a-sla',
      'The clock of R-3 is under 4 hours',
      '4 hours',
      hours.map((h) => `${h} hours`).join(', '),
      hours.every((h) => h === 4)
    ),
    check(
      'a-escalation',
      'The secret on a Rule 5 asset escalates to Davin; the package on the web app does not',
      'true, false',
      `${secret.escalation}, ${malicious.escalation}`,
      secret.escalation === true && malicious.escalation === false
    ),
    check(
      'a-secret-producer',
      'The sweep reads GitHub secret scanning: an open alert becomes a P0 finding under R-3 with the confirmed-secret flag, the Rule 5 escalation, the PB-1 playbook and the secret_breach alert',
      'P0 R-3, flag set, escalates, PB-1, secret_breach',
      produced
        ? `${produced.priority} ${produced.rule}, flag ${produced.secretExposureConfirmed === true ? 'set' : 'not set'}, ${produced.escalation === true ? 'escalates' : 'no escalation'}, ${playbookFor(produced) ?? 'no playbook'}, ${producedAlerts.map((a) => a.reason).join('+') || 'no alert'}`
        : 'no finding',
      produced !== null &&
        produced.priority === 'P0' &&
        produced.rule === 'R-3' &&
        produced.secretExposureConfirmed === true &&
        produced.escalation === true &&
        playbookFor(produced) === 'PB-1' &&
        producedAlerts.length === 1 &&
        producedAlerts[0].reason === 'secret_breach'
    ),
    ...chain.checks,
    playbookCheck({ prefix: 'a', findings, rb }),
  ];
  return finishScenario({ spec: SCENARIO_A, now, findings, chain, checks });
}

// --- scenario B: an exposed data store and a webhook spike ----------------------------------------------------

const SCENARIO_B = Object.freeze({
  id: 'B',
  title: 'An unexpected data-store endpoint and a webhook signature spike',
  playbooks: ['PB-3', 'PB-4'],
  injects: [
    'Railway shows a new public TCP proxy on the production Postgres service that is not in the expected list of the inventory. (The exercise injects the finding a Railway exposure probe would create: that probe is not built, see the gaps.)',
    'The Stripe webhook route of money-service records 9 signature failures in one hour and no 5xx.',
  ],
  questions: [
    'Who can remove the proxy, and what breaks when they do (the Vercel app, the migration check, laptop tooling)?',
    'Can you tell forged webhooks from a provider outage in under 15 minutes, and with what?',
    'Who reconciles the ledger against the provider, and what is the first query?',
    'Would the daily sweep have seen the proxy? The signature failures? What would have told you?',
    'Pausing the route or rotating the signing secret: which of the two, and who decides?',
    'What do you tell users, and when?',
  ],
});

async function scenarioB({ now, rb, P }) {
  const ctx = context(now);
  const endpoint = P.scoreFinding(
    makeFinding({
      kind: 'public-endpoint',
      source: 'posture-sweep',
      ecosystem: 'posture',
      assetId: 'railway-managed-stores',
      packageName: 'drill-unexpected-endpoint',
      primaryId: 'DRILL-PUBLIC-ENDPOINT',
      title:
        'An unexpected public endpoint on the production database service (synthetic)',
      scope: 'runtime',
      key: findingKey(['drill', 'endpoint']),
    }),
    ASSETS['railway-managed-stores'],
    ctx
  );
  // the webhook spike goes through the behaviour signals themselves, offline, from a snapshot
  const behaviour = await runBehaviourSignals({
    inventory: INVENTORY,
    input: {
      schema_version: '1.0',
      collected_at: new Date(now.getTime() - 5 * 60000).toISOString(),
      webhooks: {
        window_minutes: 60,
        routes: [
          {
            id: 'money-stripe',
            asset: 'money-service',
            requests: 120,
            status_5xx: 0,
            signature_failures: 9,
          },
        ],
      },
    },
    now,
    offline: true,
  });
  const spike = behaviour.findings.find((f) => f.rule === 'BS-1') ?? null;
  const findings = [...behaviour.findings, endpoint].sort(compareFindings);
  const chain = alertChain({
    P,
    prefix: 'b',
    findings,
    behaviour,
    now,
    expectedReasons: ['behaviour_breach', 'posture_breach'],
    expectedLabels: [
      'Live posture breach: 1 (railway-managed-stores)',
      'Behaviour signal breach: 1 (money-service)',
    ],
  });
  const checks = [
    check(
      'b-endpoint-tier',
      'An unexpected public endpoint on a data store scores P1 under R-9',
      'P1 R-9',
      `${endpoint.priority} ${endpoint.rule}`,
      endpoint.priority === 'P1' && endpoint.rule === 'R-9'
    ),
    check(
      'b-webhook-tier',
      'Nine signature failures an hour on a webhook route score P1 under BS-1',
      'P1 BS-1',
      spike ? `${spike.priority} ${spike.rule}` : 'no finding',
      spike !== null && spike.priority === 'P1' && spike.rule === 'BS-1'
    ),
    check(
      'b-sla',
      'The clock of both rules is 72 hours',
      '72 hours, 72 hours',
      `${slaHours(endpoint.sla)} hours, ${slaHours(spike?.sla)} hours`,
      slaHours(endpoint.sla) === 72 && slaHours(spike?.sla) === 72
    ),
    check(
      'b-escalation',
      'The webhook signal is a Rule 5 escalation (money); the endpoint is not',
      'true, false',
      `${spike?.escalation === true}, ${endpoint.escalation === true}`,
      spike?.escalation === true && endpoint.escalation !== true
    ),
    ...chain.checks,
    playbookCheck({ prefix: 'b', findings, rb }),
  ];
  return finishScenario({ spec: SCENARIO_B, now, findings, chain, checks });
}

// --- the runbook checks --------------------------------------------------------------------------------------------

function runbookChecks(rb) {
  const ids = Object.keys(PLAYBOOKS);
  const complete = ids.filter(
    (id) =>
      rb.playbooks[id]?.title === PLAYBOOKS[id].title &&
      rb.playbooks[id].hasTriggersLine &&
      rb.playbooks[id].hasFirstThirtyMinutes
  );
  // the rules with no playbook of their own, as the signal they belong to (BS-3b is BS-3)
  const withoutPlaybook = [
    ...new Set(
      Object.entries(BEHAVIOUR_RULES)
        .filter(([, def]) => def.playbook === null)
        .map(([rule]) => rule.slice(0, 4))
    ),
  ];
  const answered = withoutPlaybook.filter((s) =>
    rb.noPlaybookSignals.includes(s)
  );
  return [
    check(
      'runbook-playbooks',
      'The runbook has all seven playbooks, each with its title, a trigger line and a first 30 minutes',
      `${ids.length} of ${ids.length}`,
      `${complete.length} of ${ids.length}`,
      complete.length === ids.length
    ),
    check(
      'runbook-standing-rules',
      'The runbook states the standing rules: the dated incident note and the counts-only waiting-on entry',
      'reports/incidents and waiting-on named',
      `incident notes ${rb.standingRules.incidentNotes ? 'yes' : 'no'}, waiting-on ${rb.standingRules.waitingOn ? 'yes' : 'no'}`,
      rb.standingRules.incidentNotes && rb.standingRules.waitingOn
    ),
    check(
      'runbook-schedules',
      'The runbook schedules the annual tabletop exercise and the quarterly restore drill',
      'both sections present',
      `tabletop ${rb.tabletopSection ? 'yes' : 'no'}, restore drill ${rb.restoreDrillSection ? 'yes' : 'no'}`,
      rb.tabletopSection && rb.restoreDrillSection
    ),
    check(
      'runbook-no-playbook',
      'Every behaviour signal without a playbook is answered by the short section for them',
      withoutPlaybook.join(', '),
      answered.join(', ') || 'none',
      answered.length === withoutPlaybook.length
    ),
  ];
}

/**
 * What the rehearsal found about the pipeline itself, as it stood on the day. These are facts of
 * the code at the time of writing, dated by the report: the exercise is how they get decided.
 */
const GAPS = Object.freeze([
  // G-secret-detection (no producer for a confirmed secret, rule R-3) was closed in Phase 5: the
  // posture sweep reads the open secret-scanning alerts, and check a-secret-producer proves it.
  {
    id: 'G-endpoint-diff',
    text: 'An unexpected public endpoint on a data store (rule R-9) has no automated probe. The Railway exposure diff of section 6.3 is not built, and only the DNS guard for paused assets creates public-endpoint findings. The exercise injected the finding such a probe would create.',
  },
  {
    id: 'G-telemetry',
    text: 'Signals BS-1 to BS-4 have no collector. Until something writes reports/behaviour-input.json they report skipped (no_telemetry_sample), so the daily sweep would not have seen the signature failures of scenario B.',
  },
  {
    id: 'G-cadence',
    text: 'Signal BS-5 needs samples spread over 15 minutes or more, and a push to main is only seen when the sweep runs. A daily run alone gives BS-5 too few samples: decide how often run-behaviour-signals.mjs should run.',
  },
  {
    id: 'G-no-playbook',
    text: 'Signals BS-2 to BS-5 have no playbook of their own. The runbook has a short section for them: decide whether any should become a full playbook.',
  },
]);

const dayPlusOneYear = (day) => {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCFullYear(d.getUTCFullYear() + 1);
  return d.toISOString().slice(0, 10);
};

/**
 * Runs the exercise. A pure function of the runbook text, the time and the report date; it
 * touches no file and no live system. `parts` replaces the engine, notifier and producer
 * functions the exercise exercises (`scoreFinding`, `computeTransitions`, `buildAlertMessage`,
 * `sanitizeLineText`, `evaluateSecretScanningAlerts`, `makePostureFinding`): the tests use it to
 * prove that a broken part makes the exercise fail.
 *
 * @param {{ runbookText: string | null | undefined, now: Date, date?: string | null, parts?: Partial<typeof REAL_PARTS> }} input
 */
export async function runTabletopDrill({
  runbookText,
  now,
  date = null,
  parts = {},
}) {
  const rb = parseRunbook(runbookText);
  const day = date ?? now.toISOString().slice(0, 10);
  const P = { ...REAL_PARTS, ...parts };
  const scenarios = [
    scenarioA({ now, rb, P }),
    await scenarioB({ now, rb, P }),
  ];
  const checks = [...scenarios.flatMap((s) => s.checks), ...runbookChecks(rb)];
  const failed = checks.filter((c) => c.status === 'fail').length;
  return {
    schema_version: '1.0',
    generated_at: now.toISOString(),
    date: day,
    next_due: dayPlusOneYear(day),
    overall: failed === 0 ? 'pass' : 'fail',
    summary: {
      checks: {
        total: checks.length,
        pass: checks.length - failed,
        fail: failed,
      },
      scenarios: {
        total: scenarios.length,
        passed: scenarios.filter((s) => s.status === 'pass').length,
        failed: scenarios.filter((s) => s.status === 'fail').length,
      },
      runbook: {
        playbooks_found: Object.keys(PLAYBOOKS).filter(
          (id) => id in rb.playbooks
        ).length,
        playbooks_expected: Object.keys(PLAYBOOKS).length,
      },
    },
    scenarios,
    checks,
    gaps: GAPS.map((g) => ({ ...g })),
  };
}

// --- reports -------------------------------------------------------------------------------------------------------

const checkTable = (checks) => [
  '| Check | What it verifies | Expected | Observed | Result |',
  '| :- | :- | :- | :- | :- |',
  ...checks.map(
    (c) =>
      `| ${esc(c.id)} | ${esc(c.description)} | ${esc(c.expected)} | ${esc(c.observed)} | ${c.status === 'pass' ? 'pass' : 'FAIL'} |`
  ),
];

/**
 * The private report: the result, then for each scenario the checks, the alert as it would
 * arrive, the first 30 minutes of each playbook and the questions for the walk-through, then the
 * gaps. `runbookText` supplies the playbook steps; without it the report points at the runbook.
 *
 * @param {Awaited<ReturnType<typeof runTabletopDrill>>} result
 * @param {{ runbookText?: string | null }} [options]
 */
export function renderTabletopMarkdown(result, { runbookText = null } = {}) {
  const out = [
    '# DavinTrade tabletop exercise report (private)',
    '',
    `Generated ${result.generated_at} by scripts/security/run-tabletop-drill.mjs: the annual tabletop exercise of ${result.date} (sections 8 and 9 of the architecture).`,
    'The scenarios are synthetic: nothing live was read and no alert state was touched. This file stays in the gitignored reports/incidents folder: never commit it, paste it into an issue or attach it to a public log.',
    '',
    '## Result',
    '',
    `Overall: ${result.overall === 'pass' ? 'PASS' : 'FAIL'} (${result.summary.checks.pass} of ${result.summary.checks.total} checks). The next exercise is due by ${result.next_due}.`,
    '',
    '| Scenario | Playbooks | Result |',
    '| :- | :- | :- |',
    ...result.scenarios.map(
      (s) =>
        `| ${esc(`${s.id}: ${s.title}`)} | ${esc(s.playbooks.join(', '))} | ${s.status === 'pass' ? 'pass' : 'FAIL'} |`
    ),
    '',
    `Runbook: ${result.summary.runbook.playbooks_found} of ${result.summary.runbook.playbooks_expected} playbooks found by title.`,
    '',
  ];
  for (const s of result.scenarios) {
    out.push(
      `## Scenario ${s.id}: ${s.title}`,
      '',
      `**Playbooks:** ${s.playbooks.join(', ')}. **Clock:** under ${s.sla_hours} hours; if it were detected at ${result.generated_at}, the deadline is ${s.sla_deadline}.`,
      '',
      'What happens (synthetic):',
      ''
    );
    for (const inject of s.injects) out.push(`- ${inject}`);
    out.push('', '### Automated checks', '', ...checkTable(s.checks), '');
    out.push(
      '### The alert as it would arrive on LINE',
      '',
      '```text',
      s.message,
      '```',
      ''
    );
    out.push('### The first 30 minutes of each playbook', '');
    for (const id of s.playbooks) {
      out.push(`**${id}: ${PLAYBOOKS[id].title}**`, '');
      const steps = runbookText === null ? [] : extractSteps(runbookText, id);
      if (steps.length === 0) {
        out.push(
          `The steps are in docs/runbooks/security-incident-playbooks.md (section ${id}).`
        );
      } else {
        steps.forEach((step, i) => out.push(`${i + 1}. ${step}`));
      }
      out.push('');
    }
    out.push('### Questions for the walk-through', '');
    for (const q of s.questions) out.push(`- ${q}`);
    out.push('', 'Notes from the walk-through (fill in):', '', '- ', '');
  }
  out.push(
    '## Checks of the runbook itself',
    '',
    ...checkTable(result.checks.filter((c) => c.id.startsWith('runbook-'))),
    '',
    '## Gaps the exercise found in the pipeline',
    ''
  );
  for (const g of result.gaps) out.push(`- **${g.id}:** ${g.text}`);
  out.push(
    '',
    '## Follow-ups',
    '',
    '- [ ] For each gap above, decide what to do (a rule, a probe, a test or a line in the runbook) and write the decision here.',
    '- [ ] Fill in the notes of each scenario after the walk-through with Davin.',
    `- [ ] Run the next exercise by ${result.next_due}: node scripts\\security\\run-tabletop-drill.mjs`,
    '- [ ] Run the quarterly restore drill of the runbook (the first is due by 2027-02-22).',
    ''
  );
  return `${out.join('\n')}\n`.replace(/\n\n$/, '\n');
}

/** The console summary: counts and fixed words only. */
export function renderTabletopStdout(result) {
  const { checks, scenarios, runbook } = result.summary;
  return [
    'DavinTrade tabletop exercise (counts only)',
    `tabletop_run: ${result.generated_at}`,
    `tabletop_scenarios: total=${scenarios.total} passed=${scenarios.passed} failed=${scenarios.failed}`,
    `tabletop_checks: total=${checks.total} pass=${checks.pass} fail=${checks.fail}`,
    `tabletop_runbook: playbooks=${runbook.playbooks_found}/${runbook.playbooks_expected}`,
    `tabletop_result: ${result.overall === 'pass' ? 'PASS' : 'FAIL'}`,
    `reports: ${result.date} tabletop-exercise-report.md and .json written to reports/incidents/ (private, gitignored)`,
  ];
}

// --- arguments and the command ---------------------------------------------------------------------------------

export class TabletopUsageError extends Error {}

const FLAGS = { '--help': 'help', '-h': 'help' };
const VALUES = {
  '--root': 'root',
  '--pipeline-dir': 'pipelineDir',
  '--date': 'date',
};

export const TABLETOP_USAGE = [
  'Usage: node scripts/security/run-tabletop-drill.mjs [options]',
  '  --date YYYY-MM-DD    the date the reports are named with (default: today, UTC)',
  '  --root <dir>         repository root (default: the checkout this script is in)',
  '  --pipeline-dir <dir> private folder (default: <root>/davintrade-security-monitoring-pipeline)',
  'Reads docs/runbooks/security-incident-playbooks.md; touches no live system and no alert state.',
  'Output: counts only on stdout; the report is <pipeline-dir>/reports/incidents/<date>-tabletop-exercise-report.md and .json (gitignored).',
  'Exit codes: 0 every check passed, 1 a check failed or an unexpected failure, 2 usage or setup error.',
].join('\n');

// an impossible month makes toISOString throw, so the time is checked first
const isCalendarDay = (value) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const ms = Date.parse(`${value}T00:00:00Z`);
  return (
    Number.isFinite(ms) && new Date(ms).toISOString().slice(0, 10) === value
  );
};

/** @param {string[]} argv arguments after the script name */
export function parseTabletopArgs(argv) {
  const options = { help: false, root: null, pipelineDir: null, date: null };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const eq = arg.startsWith('--') ? arg.indexOf('=') : -1;
    const flag = eq === -1 ? arg : arg.slice(0, eq);
    const inline = eq === -1 ? undefined : arg.slice(eq + 1);
    if (FLAGS[flag] && inline === undefined) {
      options[FLAGS[flag]] = true;
    } else if (VALUES[flag]) {
      const value = inline ?? argv[(i += 1)];
      if (value === undefined || value === '') {
        throw new TabletopUsageError(`${flag} needs a value`);
      }
      options[VALUES[flag]] = value;
    } else {
      throw new TabletopUsageError('unknown argument');
    }
  }
  if (options.date !== null && !isCalendarDay(options.date)) {
    throw new TabletopUsageError('--date must be a day such as 2026-11-22');
  }
  return options;
}

const safeLog = (log) => (line) =>
  log(
    findPrivacyViolations(line).length > 0
      ? '[line withheld by the privacy guard]'
      : line
  );

/**
 * Runs the exercise and returns the exit code (0 every check passed, 1 a check failed or an
 * unexpected failure, 2 usage or setup error).
 *
 * @param {{
 *   argv: string[],
 *   deps: {
 *     root: string,
 *     fs: { readText: (p: string) => string | null, writeText: (p: string, t: string) => void, mkdirp: (p: string) => void },
 *     now: () => Date,
 *     log: (line: string) => void,
 *   },
 * }} input
 */
export async function runTabletopCli({ argv, deps }) {
  let options;
  try {
    options = parseTabletopArgs(argv);
  } catch (error) {
    if (!(error instanceof TabletopUsageError)) throw error;
    deps.log(`error=usage (${error.message})`);
    deps.log(TABLETOP_USAGE);
    return 2;
  }
  if (options.help) {
    deps.log(TABLETOP_USAGE);
    return 0;
  }
  const out = safeLog(deps.log);
  try {
    const root = options.root ?? deps.root;
    const pipelineDir =
      options.pipelineDir ??
      join(root, 'davintrade-security-monitoring-pipeline');
    const runbookText = deps.fs.readText(join(root, ...RUNBOOK_PATH));
    if (runbookText === null) {
      out('error=runbook_not_found');
      return 2;
    }
    const result = await runTabletopDrill({
      runbookText,
      now: deps.now(),
      date: options.date,
    });
    const dir = join(pipelineDir, 'reports', 'incidents');
    const base = join(dir, `${result.date}-tabletop-exercise-report`);
    try {
      deps.fs.mkdirp(dir);
      deps.fs.writeText(`${base}.json`, `${JSON.stringify(result, null, 2)}\n`);
      deps.fs.writeText(
        `${base}.md`,
        renderTabletopMarkdown(result, { runbookText })
      );
    } catch {
      out('error=report_write_failed');
      return 1;
    }
    for (const line of renderTabletopStdout(result)) out(line);
    return result.overall === 'pass' ? 0 : 1;
  } catch {
    out('error=unexpected_failure');
    return 1;
  }
}
