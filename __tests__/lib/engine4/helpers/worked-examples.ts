/**
 * The worked examples of build step 5 part 8 (`__tests__/lib/engine4/worked-examples/`):
 * the loader, the runner that asks the REAL Engine 4 the question each example asks, the
 * figure-by-figure comparison with the oracle's `expected.json`, and the approval gate
 * (the test-side twin of `python scripts/engine4/worked_examples.py check
 * [--require-approved]`).
 *
 * An example's expected file is made by the Python oracle, never by this code. This file
 * only turns the engine's answers into the same flat list of claims ("result.sizing.lot is
 * 0.04") so the two can be compared exactly: an exact figure by value (the oracle writes a
 * quotient as "n/d"), a display figure and every word by text.
 */

import { createHash } from 'crypto';
import { existsSync, readFileSync, readdirSync } from 'fs';
import { join } from 'path';

import {
  Rational,
  badgeContextFromReading,
  buildScenarios,
  checkBlackout,
  decideBadge,
  readBrokerFigures,
  riskPreset,
  roomAhead,
  sizeSetup,
  stopOptions,
  underflowHelp,
} from '@/lib/engine4';
import type {
  BadgeContext,
  CalendarEvent,
  Level,
  LevelOrigin,
  SizingInput,
  SymbolSpecInput,
  Tier1Kind,
  Tier1List,
} from '@/lib/engine4';

import { SPECS_ROW, golden, readingOf, setup, structureOf } from './setup';

export const REPO_ROOT = join(__dirname, '..', '..', '..', '..');
export const EXAMPLES_ROOT = join(__dirname, '..', 'worked-examples');
export const ORACLE_PATH = join(REPO_ROOT, 'scripts', 'engine4', 'oracle.py');
export const TOOL_PATH = join(
  REPO_ROOT,
  'scripts',
  'engine4',
  'worked_examples.py'
);

export const EXAMPLE_ID = /^[0-9]{2}-[a-z0-9]+(?:-[a-z0-9]+)*$/;
const DATE = /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/;

// ---------------------------------------------------------------------------
// Text and hashes (line endings do not matter: a CRLF checkout hashes the same)
// ---------------------------------------------------------------------------

export const lf = (text: string): string => text.replace(/\r\n/g, '\n');

export const sha256Lf = (text: string): string =>
  createHash('sha256').update(lf(text), 'utf8').digest('hex');

export const readLf = (path: string): string => lf(readFileSync(path, 'utf8'));

// ---------------------------------------------------------------------------
// The files of an example
// ---------------------------------------------------------------------------

export interface ScenarioSpec {
  contract_size: string;
  volume_min: string;
  volume_step: string;
  volume_max: string;
  typical_spread: string;
  point: string;
}

export interface ScenarioSetup {
  side: 'BUY' | 'SELL';
  entry: string;
  stop_distance: string;
  equity: string;
  risk_pct: string;
  max_leverage: string;
  commission: string;
  spec: ScenarioSpec;
  target_rrr: string;
  max_risk_pct: string;
  min_sld: string;
  counter_trend: boolean;
  structural_stops?: string[];
}

export interface ScenarioLevel {
  name: string;
  tf: 'M5' | 'M15';
  price: string;
  origin: LevelOrigin;
}

export interface ScenarioStored {
  golden: string;
  reading: string;
  zone: string;
  facts: {
    reference_price: string;
    invalidation_price: string;
    stop_distance: string;
    next_opposing_price: string | null;
    bias: string;
    status: string;
    status_reasons: string[];
    trend_relation: string;
  };
}

export interface ScenarioRelease {
  value_id: string;
  event_id: string;
  name: string;
  time_utc: string;
  currency: string;
  importance: string;
  time_mode: string;
}

export interface BlackoutProbe {
  label: string;
  anchor: string;
  offset_s: string;
  trader_type: 'SCALPER' | 'DAY_TRADER';
  calendar_age_s: string;
}

export interface SpecsProbe {
  label: string;
  captured_offset_s?: string;
  no_row?: boolean;
}

export interface Scenario {
  schema: string;
  id: string;
  title: string;
  why: string;
  kind: 'setup' | 'blackout' | 'specs';
  setup?: ScenarioSetup;
  stored?: ScenarioStored;
  levels?: ScenarioLevel[];
  trend?: {
    relation: 'WITH_TREND' | 'COUNTER_TREND';
    conflict: boolean;
    both_timeframes: boolean;
  };
  cycle?: { status: string; status_reasons: string[]; retuning: boolean };
  blackout?: {
    tier1: { event_id: string; kind: string; name: string }[];
    releases: ScenarioRelease[];
    probes: BlackoutProbe[];
  };
  specs?: { now_utc: string; probes: SpecsProbe[] };
}

export interface Example {
  id: string;
  folder: string;
  scenarioText: string;
  expectedText: string;
  scenario: Scenario;
  expected: { schema: string; example: string; kind: string; result: unknown };
  /** null when approval.json is missing */
  approvalText: string | null;
}

export function exampleFolders(root: string = EXAMPLES_ROOT): string[] {
  return readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && EXAMPLE_ID.test(entry.name))
    .map((entry) => entry.name)
    .sort();
}

export function readExample(id: string, root: string = EXAMPLES_ROOT): Example {
  const folder = join(root, id);
  const scenarioText = readLf(join(folder, 'scenario.json'));
  const expectedText = readLf(join(folder, 'expected.json'));
  const approvalPath = join(folder, 'approval.json');
  return {
    id,
    folder,
    scenarioText,
    expectedText,
    scenario: JSON.parse(scenarioText) as Scenario,
    expected: JSON.parse(expectedText) as Example['expected'],
    approvalText: existsSync(approvalPath) ? readLf(approvalPath) : null,
  };
}

// ---------------------------------------------------------------------------
// The approval gate: the twin of the Python tool's `approval_problems` and `check`
// ---------------------------------------------------------------------------

export const APPROVAL_SCHEMA = 'worked-example-approval/1';
const APPROVAL_KEYS = [
  'schema',
  'example',
  'status',
  'approved_by',
  'approved_on',
  'scenario_sha256',
  'expected_sha256',
  'note',
];

export function approvalProblems(
  approval: unknown,
  id: string,
  scenarioText: string,
  expectedText: string
): string[] {
  if (
    typeof approval !== 'object' ||
    approval === null ||
    Array.isArray(approval)
  ) {
    return ['approval.json is not an object'];
  }
  const a = approval as Record<string, unknown>;
  const problems: string[] = [];
  for (const key of Object.keys(a).sort()) {
    if (!APPROVAL_KEYS.includes(key))
      problems.push(`approval.json: unknown key '${key}'`);
  }
  for (const key of [...APPROVAL_KEYS].sort()) {
    if (!(key in a)) problems.push(`approval.json: missing key '${key}'`);
  }
  if (problems.length > 0) return problems;
  if (a['schema'] !== APPROVAL_SCHEMA) {
    problems.push(`approval.json: schema must be '${APPROVAL_SCHEMA}'`);
  }
  if (a['example'] !== id) {
    problems.push(
      `approval.json: example is '${String(a['example'])}', not '${id}'`
    );
  }
  if (a['status'] !== 'PENDING' && a['status'] !== 'APPROVED') {
    return [...problems, 'approval.json: status must be PENDING or APPROVED'];
  }
  const changed = a['status'] === 'APPROVED' ? ' (changed after approval)' : '';
  if (a['scenario_sha256'] !== sha256Lf(scenarioText)) {
    problems.push(
      `approval.json: scenario_sha256 is not the hash of scenario.json${changed}`
    );
  }
  if (a['expected_sha256'] !== sha256Lf(expectedText)) {
    problems.push(
      `approval.json: expected_sha256 is not the hash of expected.json${changed}`
    );
  }
  if (a['status'] === 'APPROVED') {
    if (
      typeof a['approved_by'] !== 'string' ||
      a['approved_by'].trim() === ''
    ) {
      problems.push('approval.json: APPROVED needs approved_by');
    }
    if (typeof a['approved_on'] !== 'string' || !DATE.test(a['approved_on'])) {
      problems.push('approval.json: APPROVED needs approved_on as YYYY-MM-DD');
    }
  }
  return problems;
}

export interface ApprovalReport {
  id: string;
  status: 'PENDING' | 'APPROVED' | null;
  problems: string[];
}

export interface ApprovalCheck {
  reports: ApprovalReport[];
  /** every problem, worded for a person; includes PENDING ones when `requireApproved` */
  problems: string[];
  pending: string[];
}

/** `check [--require-approved]` over approval.json alone (the oracle's own comparison is the Python tool's and the figure test's). */
export function checkApprovals(
  root: string = EXAMPLES_ROOT,
  options: { requireApproved: boolean } = { requireApproved: false }
): ApprovalCheck {
  const reports: ApprovalReport[] = [];
  const problems: string[] = [];
  const pending: string[] = [];
  for (const id of exampleFolders(root)) {
    const example = readExample(id, root);
    const report: ApprovalReport = { id, status: null, problems: [] };
    if (example.approvalText === null) {
      report.problems.push('approval.json is missing (run record)');
    } else {
      let approval: unknown;
      try {
        approval = JSON.parse(example.approvalText);
      } catch {
        report.problems.push('approval.json is not valid JSON');
      }
      if (approval !== undefined) {
        report.problems.push(
          ...approvalProblems(
            approval,
            id,
            example.scenarioText,
            example.expectedText
          )
        );
        const status = (approval as { status?: unknown } | null)?.status;
        if (status === 'PENDING' || status === 'APPROVED') {
          report.status = status;
        }
      }
    }
    if (report.status !== 'APPROVED') pending.push(id);
    reports.push(report);
    for (const problem of report.problems) problems.push(`${id}: ${problem}`);
  }
  if (options.requireApproved) {
    for (const id of pending) {
      problems.push(`${id}: not approved yet (--require-approved)`);
    }
  }
  return { reports, problems, pending };
}

/** The text of an approval.json as the Python tool writes it. */
export function approvalText(
  id: string,
  scenarioText: string,
  expectedText: string,
  fields: {
    status: 'PENDING' | 'APPROVED';
    approvedBy?: string;
    approvedOn?: string;
    note?: string;
  }
): string {
  return (
    JSON.stringify(
      {
        schema: APPROVAL_SCHEMA,
        example: id,
        status: fields.status,
        approved_by: fields.approvedBy ?? null,
        approved_on: fields.approvedOn ?? null,
        scenario_sha256: sha256Lf(scenarioText),
        expected_sha256: sha256Lf(expectedText),
        note: fields.note ?? '',
      },
      null,
      2
    ) + '\n'
  );
}

// ---------------------------------------------------------------------------
// Claims: what the engine says, in the oracle's own paths
// ---------------------------------------------------------------------------

export type Leaf = string | boolean | null;

/** The oracle's expected.json as a flat map: "result.sizing.lot" -> "0.04"; a list adds "path#" -> its length. */
export function flatten(
  value: unknown,
  path = '',
  out: Map<string, Leaf> = new Map()
): Map<string, Leaf> {
  if (Array.isArray(value)) {
    out.set(`${path}#`, String(value.length));
    value.forEach((item, index) => flatten(item, `${path}[${index}]`, out));
  } else if (value !== null && typeof value === 'object') {
    for (const [key, inner] of Object.entries(value)) {
      flatten(inner, path === '' ? key : `${path}.${key}`, out);
    }
  } else {
    out.set(path, value as Leaf);
  }
  return out;
}

type Claim =
  | { kind: 'exact'; value: Rational | null }
  | { kind: 'text'; value: string | null }
  | { kind: 'bool'; value: boolean };

export class Claims {
  readonly map = new Map<string, Claim>();

  exact(path: string, value: Rational | null): void {
    this.put(path, { kind: 'exact', value });
  }

  text(path: string, value: string | null): void {
    this.put(path, { kind: 'text', value });
  }

  bool(path: string, value: boolean): void {
    this.put(path, { kind: 'bool', value });
  }

  /** the items as text, with the list's length */
  list(path: string, items: readonly string[]): void {
    this.put(`${path}#`, { kind: 'text', value: String(items.length) });
    items.forEach((item, index) => this.text(`${path}[${index}]`, item));
  }

  /** only the length (the items are claimed field by field) */
  count(path: string, length: number): void {
    this.put(`${path}#`, { kind: 'text', value: String(length) });
  }

  private put(path: string, claim: Claim): void {
    if (this.map.has(path)) throw new Error(`claimed twice: ${path}`);
    this.map.set(path, claim);
  }
}

/** "10000/150400" or "90.24" as an exact value. */
export function readFigure(text: string): Rational {
  const slash = text.indexOf('/');
  if (slash < 0) return Rational.of(text);
  return Rational.of(text.slice(0, slash)).div(
    Rational.of(text.slice(slash + 1))
  );
}

/** Every difference between the oracle's file and the engine's claims; empty means equal, in both directions. */
export function compareClaims(
  expected: ReadonlyMap<string, Leaf>,
  claims: Claims
): string[] {
  const problems: string[] = [];
  for (const [path, want] of expected) {
    const got = claims.map.get(path);
    if (got === undefined) {
      problems.push(
        `${path}: the oracle has ${JSON.stringify(want)}, the engine said nothing`
      );
      continue;
    }
    if (got.kind === 'bool') {
      if (got.value !== want) {
        problems.push(
          `${path}: engine ${got.value} but oracle ${JSON.stringify(want)}`
        );
      }
    } else if (got.kind === 'text') {
      if (got.value !== want) {
        problems.push(
          `${path}: engine ${JSON.stringify(got.value)} but oracle ${JSON.stringify(want)}`
        );
      }
    } else if (want === null || got.value === null) {
      // "no figure" must be said by both
      if (want !== null || got.value !== null) {
        problems.push(
          `${path}: engine ${got.value === null ? 'none' : got.value.toString()} but oracle ${JSON.stringify(want)}`
        );
      }
    } else if (typeof want !== 'string') {
      problems.push(
        `${path}: the oracle's ${JSON.stringify(want)} is not a figure`
      );
    } else {
      let figure: Rational | null = null;
      try {
        figure = readFigure(want);
      } catch {
        problems.push(`${path}: the oracle's "${want}" is not a figure`);
      }
      if (figure !== null && !got.value.eq(figure)) {
        problems.push(
          `${path}: engine ${got.value.toString()} but oracle ${figure.toString()}`
        );
      }
    }
  }
  for (const path of claims.map.keys()) {
    if (!expected.has(path)) {
      problems.push(`${path}: the engine claims it, the oracle does not`);
    }
  }
  return problems;
}

// ---------------------------------------------------------------------------
// Time: UTC text <-> seconds (test code; the engine takes seconds)
// ---------------------------------------------------------------------------

export const epoch = (text: string): number => {
  const ms = Date.parse(text);
  if (Number.isNaN(ms)) throw new Error(`not a UTC time: ${text}`);
  return ms / 1000;
};

export const iso = (seconds: number | bigint): string =>
  new Date(Number(seconds) * 1000).toISOString().replace('.000Z', 'Z');

// ---------------------------------------------------------------------------
// The runner: ask the real engine what each example asks
// ---------------------------------------------------------------------------

function specOf(spec: ScenarioSpec): SymbolSpecInput {
  return {
    contractSize: spec.contract_size,
    volumeMin: spec.volume_min,
    volumeStep: spec.volume_step,
    volumeMax: spec.volume_max,
    typicalSpread: spec.typical_spread,
    point: spec.point,
  };
}

export function sizingInputOf(s: ScenarioSetup): SizingInput {
  return {
    side: s.side,
    entry: s.entry,
    stopDistance: s.stop_distance,
    equity: s.equity,
    riskPct: s.risk_pct,
    maxLeverage: s.max_leverage,
    commission: s.commission,
    spec: specOf(s.spec),
  };
}

export function levelsOf(levels: readonly ScenarioLevel[]): Level[] {
  return levels.map((level) => ({
    name: level.name,
    tf: level.tf,
    price: Rational.of(level.price),
    origin: level.origin,
  }));
}

function runSetup(scenario: Scenario): Claims {
  const s = scenario.setup;
  if (s === undefined) throw new Error('a setup example has no setup');
  const c = new Claims();
  const input = sizingInputOf(s);
  const levels =
    scenario.levels === undefined ? null : levelsOf(scenario.levels);

  // -- the risk the modal opens on ------------------------------------------------
  if (scenario.cycle !== undefined) {
    const stored = scenario.stored;
    if (stored === undefined) throw new Error('a cycle needs a stored cycle');
    const world = setup({
      golden: stored.golden.slice(0, 3),
      gProfile: stored.reading,
      retuning: scenario.cycle.retuning,
    });
    const preset = riskPreset({ maxRiskPct: s.max_risk_pct }, world.offer);
    c.exact('result.risk_preset.max_pct', preset.max);
    c.exact('result.risk_preset.preset_pct', preset.preset);
    c.bool('result.risk_preset.half_risk', preset.halfRisk);
    c.list('result.risk_preset.reasons', preset.reasons);
  }

  // -- the structural stop options ---------------------------------------------------
  const options =
    levels === null
      ? null
      : stopOptions(levels, {
          side: s.side,
          entry: s.entry,
          minSld: s.min_sld,
        });
  if (options !== null) {
    c.count('result.stop_options', options.length);
    options.forEach((o, i) => {
      const at = `result.stop_options[${i}]`;
      c.text(`${at}.level`, o.level.name);
      c.text(`${at}.tf`, o.level.tf);
      c.exact(`${at}.level_price`, o.level.price);
      c.exact(`${at}.stop_price`, o.stopPrice);
      c.exact(`${at}.stop_distance`, o.stopDistance);
      c.list(
        `${at}.also_at`,
        o.alsoAt.map((l) => `${l.tf} ${l.name}`)
      );
    });
  }

  // -- 6.7 steps 1 to 7 --------------------------------------------------------------------
  const sizing = sizeSetup(input);
  const z = 'result.sizing';
  c.text(`${z}.status`, sizing.status);
  c.list(`${z}.causes`, sizing.status === 'UNDERFLOW' ? sizing.causes : []);
  if (sizing.status === 'OK') c.text(`${z}.limited_by`, sizing.limitedBy);
  c.exact(`${z}.fill_price`, sizing.fillPrice);
  c.exact(`${z}.spread_price`, sizing.spreadPrice);
  c.exact(`${z}.loss_per_ounce`, sizing.lossPerOunce);
  c.exact(`${z}.loss_per_lot`, sizing.lossPerLot);
  c.exact(`${z}.max_lot_by_leverage`, sizing.maxLotByLeverage);
  c.exact(`${z}.lot_at_stop`, sizing.lotAtStop);
  c.exact(`${z}.raw_lot`, sizing.rawLot);
  c.exact(`${z}.declared_risk`, sizing.declaredRisk);
  c.text(`${z}.declared_risk_2dp`, sizing.declaredRisk.toDecimal(2));
  c.exact(`${z}.stop_price`, sizing.stopPrice);
  c.text(`${z}.stop_price_2dp`, sizing.stopPrice.toDecimal(2));
  c.exact(`${z}.stop_chart_level`, sizing.stopChartLevel);
  c.text(`${z}.stop_chart_level_2dp`, sizing.stopChartLevel.toDecimal(2));
  c.exact(`${z}.lot`, sizing.lot);
  if (sizing.status === 'OK') {
    c.exact(`${z}.actual_risk`, sizing.actualRisk);
    c.text(`${z}.actual_risk_2dp`, sizing.actualRisk.toDecimal(2));
    c.exact(`${z}.actual_risk_pct`, sizing.actualRiskPct);
    c.text(`${z}.actual_risk_pct_2dp`, sizing.actualRiskPct.toDecimal(2));
    c.exact(`${z}.leverage_used`, sizing.leverageUsed);
    c.text(`${z}.leverage_used_3dp`, sizing.leverageUsed.toDecimal(3));
  }

  // -- the three scenarios -------------------------------------------------------------------
  const set = buildScenarios(input, {
    targetRrr: s.target_rrr,
    counterTrend: s.counter_trend,
  });
  const q = 'result.scenarios';
  c.exact(`${q}.normal_rrr`, set.normalRrr);
  c.bool(`${q}.normal_capped`, set.normalCapped);
  c.count(`${q}.scenarios`, set.scenarios.length);
  set.scenarios.forEach((sc, i) => {
    const at = `${q}.scenarios[${i}]`;
    const t = sc.target;
    c.text(`${at}.name`, sc.name);
    c.exact(`${at}.rrr`, sc.rrr);
    c.exact(`${at}.gain_per_ounce`, t.gainPerOunce);
    c.exact(`${at}.target_distance`, t.targetDistance);
    c.text(`${at}.target_distance_2dp`, t.targetDistance.toDecimal(2));
    c.exact(`${at}.target_price`, t.targetPrice);
    c.text(`${at}.target_price_2dp`, t.targetPrice.toDecimal(2));
    c.exact(`${at}.target_chart_level`, t.targetChartLevel);
    c.text(`${at}.target_chart_level_2dp`, t.targetChartLevel.toDecimal(2));
    c.exact(`${at}.net_profit`, t.netProfit);
    c.text(
      `${at}.net_profit_2dp`,
      t.netProfit === null ? null : t.netProfit.toDecimal(2)
    );
  });
  c.count(`${q}.omitted`, set.omitted.length);
  set.omitted.forEach((o, i) => {
    c.text(`${q}.omitted[${i}].name`, o.name);
    c.exact(`${q}.omitted[${i}].rrr`, o.rrr);
    c.text(`${q}.omitted[${i}].reason`, o.reason);
  });

  // -- a lot below the broker minimum (6.8) ---------------------------------------------------
  const help = underflowHelp(input, {
    maxRiskPct: s.max_risk_pct,
    minSld: s.min_sld,
    structuralStopDistances:
      options === null
        ? (s.structural_stops ?? [])
        : options.map((o) => o.stopDistance),
  });
  if (help === null) {
    c.text('result.underflow', null);
  } else {
    const u = 'result.underflow';
    c.list(`${u}.causes`, help.causes);
    c.exact(`${u}.min_lot_loss`, help.minLotLoss);
    c.exact(`${u}.min_lot_risk_pct`, help.minLotRiskPct);
    c.count(`${u}.options`, help.options.length);
    help.options.forEach((o, i) => {
      const at = `${u}.options[${i}]`;
      c.text(`${at}.kind`, o.kind);
      if (o.kind === 'RAISE_RISK') {
        c.exact(`${at}.risk_pct`, o.riskPct);
        c.exact(`${at}.risk_pct_exact`, o.riskPctExact);
        c.exact(`${at}.lot`, o.lot);
        c.exact(`${at}.actual_risk`, o.actualRisk);
      } else if (o.kind === 'NEARER_STRUCTURAL_STOP') {
        c.exact(`${at}.stop_distance`, o.stopDistance);
        c.exact(`${at}.lot`, o.lot);
        c.exact(`${at}.actual_risk`, o.actualRisk);
        c.exact(`${at}.actual_risk_pct`, o.actualRiskPct);
      }
    });
    c.count(`${u}.facts`, help.facts.length);
    help.facts.forEach((f, i) => {
      const at = `${u}.facts[${i}]`;
      c.text(`${at}.kind`, f.kind);
      c.exact(`${at}.equity`, f.equity);
      c.text(`${at}.equity_at_least_2dp`, f.equity.toDecimal(2, 'CEIL'));
      if (f.kind === 'EQUITY_NEEDED_FOR_RISK') {
        c.exact(`${at}.at_risk_pct`, f.atRiskPct);
      } else {
        c.exact(`${at}.at_max_leverage`, f.atMaxLeverage);
      }
    });
  }

  // -- the room and the badge (6.5) -------------------------------------------------------
  if (levels !== null) {
    const room = roomAhead(levels, s.side, s.entry);
    if (room.level === null) {
      c.text('result.room.next_level', null);
    } else {
      c.text('result.room.next_level.name', room.level.name);
      c.text('result.room.next_level.tf', room.level.tf);
      c.exact('result.room.next_level.price', room.level.price);
    }
    c.exact('result.room.distance', room.room);
    if (sizing.status === 'OK' && scenario.trend !== undefined) {
      const context: BadgeContext = {
        trendRelation: scenario.trend.relation,
        conflict: scenario.trend.conflict,
        trendOnBothTimeframes: scenario.trend.both_timeframes,
      };
      const badge = decideBadge({
        side: s.side,
        context,
        scenarios: set.scenarios,
        nextLevel: room.level,
      });
      c.text('result.badge.row', badge.row);
      c.text('result.badge.cap', badge.cap);
      c.list('result.badge.fitting', badge.fitting);
      c.text('result.badge.badge', badge.badge);
      c.text('result.badge.no_badge_reason', badge.noBadgeReason);
    }
  }
  return c;
}

function runBlackout(scenario: Scenario): Claims {
  const b = scenario.blackout;
  if (b === undefined) throw new Error('a blackout example has no blackout');
  const c = new Claims();
  const list: Tier1List = {
    schemaVersion: 1,
    listVersion: 1,
    events: b.tier1.map((entry) => ({
      eventId: entry.event_id,
      kind: entry.kind as Tier1Kind,
      name: entry.name,
    })),
  };
  const anchors = new Map(b.releases.map((r) => [r.value_id, r]));
  c.count('result.probes', b.probes.length);
  b.probes.forEach((probe, index) => {
    const anchor = anchors.get(probe.anchor);
    if (anchor === undefined) throw new Error(`no release ${probe.anchor}`);
    const now = epoch(anchor.time_utc) + Number(probe.offset_s);
    const age = Number(probe.calendar_age_s);
    const events: CalendarEvent[] = b.releases.map((r) => ({
      valueId: r.value_id,
      eventId: r.event_id,
      eventName: r.name,
      eventTime: epoch(r.time_utc),
      currency: r.currency,
      importance: r.importance,
      timeMode: Number(r.time_mode),
      capturedAt: now - age,
    }));
    const result = checkBlackout({
      nowSeconds: now,
      traderType: probe.trader_type,
      list,
      events,
      newestCapturedAt: now - age,
    });
    const at = `result.probes[${index}]`;
    c.text(`${at}.label`, probe.label);
    c.text(`${at}.trader_type`, probe.trader_type);
    c.text(`${at}.now_utc`, iso(now));
    c.text(`${at}.status`, result.status);
    c.list(
      `${at}.blocked_by`,
      result.blocks.map((block) => block.valueId)
    );
    const first = result.blocks[0];
    if (first !== undefined && result.windowEndsAt !== null) {
      c.text(`${at}.window_start_utc`, iso(first.windowStart));
      c.text(`${at}.window_end_utc`, iso(result.windowEndsAt));
      c.text(`${at}.margin_s`, String(first.marginSeconds));
    }
    c.count(`${at}.warnings`, result.warnings.length);
    result.warnings.forEach((w, i) => {
      c.text(`${at}.warnings[${i}].value_id`, w.valueId);
      c.bool(`${at}.warnings[${i}].tier1`, w.tier1);
      c.text(`${at}.warnings[${i}].seconds_until`, String(w.secondsUntil));
    });
    c.text(
      `${at}.calendar_age_s`,
      result.calendar.ageSeconds === null
        ? null
        : String(result.calendar.ageSeconds)
    );
    c.bool(`${at}.calendar_late`, result.calendar.late);
  });
  return c;
}

function runSpecs(scenario: Scenario): Claims {
  const sp = scenario.specs;
  if (sp === undefined) throw new Error('a specs example has no specs');
  const c = new Claims();
  const now = epoch(sp.now_utc);
  c.text('result.now_utc', sp.now_utc);
  c.count('result.probes', sp.probes.length);
  sp.probes.forEach((probe, index) => {
    const at = `result.probes[${index}]`;
    const offset = Number(probe.captured_offset_s ?? '0');
    const row =
      probe.no_row === true
        ? null
        : { ...SPECS_ROW, captured_at: now + offset };
    const figures = readBrokerFigures(row, now);
    // the rest of the offer is the stored 18 Sep cycle, which offers: only the broker figures differ
    const world = setup(
      probe.no_row === true ? { specs: null } : { specsAge: -offset }
    );
    if (BigInt(world.now) !== BigInt(now)) {
      throw new Error('the stored cycle and the example disagree about now');
    }
    c.text(`${at}.label`, probe.label);
    c.text(
      `${at}.age_s`,
      figures.ok
        ? String(figures.figures.ageSeconds)
        : figures.ageSeconds === null
          ? null
          : String(figures.ageSeconds)
    );
    c.text(`${at}.figures`, figures.ok ? 'OK' : figures.code);
    c.text(`${at}.offer_verdict`, world.offer.verdict);
    c.text(`${at}.offer_reason`, world.offer.reason?.code ?? null);
    c.text(
      `${at}.offer_row`,
      world.offer.reason === null ? null : String(world.offer.reason.row)
    );
  });
  return c;
}

/** The claims the REAL engine makes for an example, at the oracle's own paths. */
export function runExample(example: Example): Claims {
  switch (example.scenario.kind) {
    case 'setup':
      return runSetup(example.scenario);
    case 'blackout':
      return runBlackout(example.scenario);
    default:
      return runSpecs(example.scenario);
  }
}

// ---------------------------------------------------------------------------
// The figures an example copies from a stored cycle
// ---------------------------------------------------------------------------

/** Differences between an example's stored-cycle claims and the cycle itself (empty: still the stored figures). */
export function storedProblems(scenario: Scenario): string[] {
  const stored = scenario.stored;
  if (stored === undefined) return [];
  const problems: string[] = [];
  const g = golden(stored.golden.slice(0, 3));
  const reading = readingOf(g, stored.reading);
  const zone = reading.zones.find((z) => z['zone_id'] === stored.zone);
  if (zone === undefined) return [`no zone ${stored.zone} in ${stored.golden}`];
  const same = (label: string, claimed: unknown, found: unknown): void => {
    if (JSON.stringify(claimed) !== JSON.stringify(found)) {
      problems.push(
        `${label}: the example says ${JSON.stringify(claimed)}, the stored cycle ${JSON.stringify(found)}`
      );
    }
  };
  const exact = (
    label: string,
    claimed: string | null,
    found: unknown
  ): void => {
    if (claimed === null || found === null || found === undefined) {
      same(label, claimed, found ?? null);
    } else if (!Rational.of(claimed).eq(Rational.of(found as number))) {
      problems.push(
        `${label}: the example says ${claimed}, the stored cycle ${String(found)}`
      );
    }
  };
  const f = stored.facts;
  exact('reference_price', f.reference_price, zone['reference_price']);
  exact('invalidation_price', f.invalidation_price, zone['invalidation_price']);
  exact('stop_distance', f.stop_distance, zone['stop_distance']);
  const opposing = zone['next_opposing_level'] as { price: number } | null;
  exact(
    'next_opposing_price',
    f.next_opposing_price,
    opposing === null ? null : opposing.price
  );
  same('bias', f.bias, reading.reading['bias']);
  same('status', f.status, reading.reading['status']);
  same('status_reasons', f.status_reasons, reading.reading['status_reasons']);
  same('trend_relation', f.trend_relation, reading.reading['trend_relation']);
  if (scenario.setup !== undefined) {
    exact('setup.entry', scenario.setup.entry, zone['reference_price']);
  }

  if (scenario.levels !== undefined) {
    const key = (l: {
      tf: string;
      name: string;
      price: Rational;
      origin: string;
    }): string => `${l.tf}|${l.name}|${l.price.toString()}|${l.origin}`;
    const claimed = levelsOf(scenario.levels).map(key).sort();
    const found = structureOf(g)
      .levels.map((l) => key({ ...l, price: l.price.roundTo(2, 'HALF_UP') }))
      .sort();
    same('levels', claimed, found);
  }
  if (scenario.trend !== undefined) {
    const context = badgeContextFromReading(reading.reading);
    same('trend', context, {
      trendRelation: scenario.trend.relation,
      conflict: scenario.trend.conflict,
      trendOnBothTimeframes: scenario.trend.both_timeframes,
    });
  }
  if (scenario.cycle !== undefined) {
    same('cycle.status', scenario.cycle.status, reading.reading['status']);
    same(
      'cycle.status_reasons',
      scenario.cycle.status_reasons,
      reading.reading['status_reasons']
    );
  }
  return problems;
}
