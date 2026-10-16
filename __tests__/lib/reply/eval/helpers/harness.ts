/**
 * The executor of the evaluation suite (build step 7 part 10): one CELL (a scenario, a trader
 * type, a locale, a pass) goes through the REAL orchestrator, over the same world the orchestrator
 * tests use, and comes back as a `CellRecord`.
 *
 * What runs for real: the intake path over a stored golden cycle, the gate, the answer gate, the
 * context assembler, the checks, the composer, the quota meter over the ledger's model, the thread,
 * message and trace stores. What is replaced: the clock, the Understand model (its answer), the
 * market database (the day's bars come from the seeded world), storage of the chart, and THE ANSWER
 * MODEL: the fixture model with scripted replies (the STAND-IN) or a real port handed in (a LIVE run).
 *
 * The record is cross-checked against the orchestrator: what `judgeReplies` finds in the captured
 * replies must be what the orchestrator did with them. A disagreement throws, so the judge and the
 * answer step cannot drift apart.
 *
 * This file is test support. `scripts/reply/eval-run.js` loads it through `tsx` for a recording, and
 * the Jest suites load it for the gate. Nothing in `lib/` or `app/` imports it.
 */

import type { IntakeRequest } from '@/lib/intake';
import { buildValueDictionary } from '@/lib/reply/checks/value-dictionary';
import type { ValueDictionary } from '@/lib/reply/checks/value-dictionary';
import {
  familyOfLocale,
  isInstantIntent,
  secondsOfSlot,
} from '@/lib/reply/contracts/intake';
import type {
  Locale,
  PacketIntent,
  TraderType,
} from '@/lib/reply/contracts/intake';
import type { IntakePacket } from '@/lib/reply/contracts/intake';
import { currentParts } from '@/lib/reply/eval/fingerprint';
import type { CurrentParts } from '@/lib/reply/eval/fingerprint';
import {
  RUN_SCHEMA,
  STAND_IN_LABEL,
  judgeReplies,
  summarizeCells,
  worldDigestOf,
} from '@/lib/reply/eval/suite';
import type {
  CallRecord,
  CellRecord,
  EvalRun,
  JudgeWorld,
  RunKind,
} from '@/lib/reply/eval/suite';
import { cellId, cellsOf, scenarioSetSha256 } from '@/lib/reply/eval/scenarios';
import type {
  CellKey,
  Scenario,
  ScenarioSet,
} from '@/lib/reply/eval/scenarios';
import { currentFingerprint } from '@/lib/reply/eval/fingerprint';
import { FIXTURE_TARGET } from '@/lib/reply/gateway/fixture';
import type { FixtureScript } from '@/lib/reply/gateway/fixture';
import type {
  ModelCallResult,
  ModelPort,
  ModelRequest,
} from '@/lib/reply/gateway/types';
import { boundOf } from '@/lib/reply/meter/estimate';
import { directionEqualsSynthesis } from '@/lib/reply/report1/compose';
import type { DayBars } from '@/lib/reply/context/ohlc-compact';
import type { ChartPort } from '@/lib/reply/read/chart';
import { CHART_SLOT_SECONDS } from '@/lib/storage/chart-keys';
import type { ChartStamp } from '@/lib/storage/chart-keys';

import { echoResult, run as intakeRun } from '../../../intake/helpers/ports';
import type { FakeOptions2 } from '../../../intake/helpers/ports';
import { dayBarsFor, worldFor } from '../../context/helpers/context-fixtures';
import {
  GOLDENS,
  PRICED_A,
  buildWorld,
  run as runReplyWorld,
} from '../../run/helpers/world';
import type { ReplyWorld } from '../../run/helpers/world';

import {
  asJson,
  standInAnswer,
  standInReport,
  withBadJson,
  withBadZone,
  withBannedPhrase,
  withWrongPrice,
} from './stand-in';

const QUESTIONS: Readonly<Record<string, string>> = {
  DIRECTION: 'What is the direction of gold now?',
  EXPLAIN: 'Explain what the M5 channel state means.',
  NEWS: 'Is there any news today?',
  REPORT_2: 'Open a trade setup for me.',
};

export const cycleIndex = (cycle: string): number => {
  const index = GOLDENS.findIndex((world) => world.name.startsWith(cycle));
  if (index < 0) throw new Error(`no golden cycle ${cycle}`);
  return index;
};

const shapeOf = (intent: PacketIntent): 'REPORT1' | 'ANSWER' =>
  intent === 'EXPLAIN' || intent === 'NEWS' ? 'ANSWER' : 'REPORT1';

/** The intake fakes of a scenario: the overlay, the knowledge pack and the calendar. */
export function intakeOptionsFor(
  scenario: Scenario,
  trader: TraderType,
  locale: Locale
): FakeOptions2 {
  const typed = !isInstantIntent(scenario.intent);
  return {
    locale,
    profile: {
      trader_type: trader,
      style: 'BOTH',
      max_risk_pct: '1.5',
      max_leverage: '5',
      target_rrr: '1.75',
      min_sld: '13',
    },
    ...(typed
      ? {
          understand: echoResult(
            QUESTIONS[scenario.intent] as string,
            scenario.intent,
            { language: familyOfLocale(locale) }
          ),
        }
      : {}),
    worldOptions: {
      gateway: scenario.overlay.status as
        | 'FRESH'
        | 'DELAYED'
        | 'STALE'
        | 'MARKET_CLOSED',
      retuning: scenario.overlay.retuning,
    },
    ...(scenario.condition === 'KNOWLEDGE_DOWN'
      ? { knowledge: 'UNAVAILABLE' as const }
      : {}),
    ...(scenario.condition === 'CALENDAR_LATE'
      ? { events: 'LATE' as const }
      : {}),
  };
}

const requestFor = (scenario: Scenario): IntakeRequest =>
  isInstantIntent(scenario.intent)
    ? {
        kind: 'INSTANT',
        intent: scenario.intent as 'INSTANT_M5_INSPECT' | 'INSTANT_M15_INSPECT',
        threadId: null,
      }
    : {
        kind: 'TYPED',
        question: QUESTIONS[scenario.intent] as string,
        threadId: null,
      };

// ---------------------------------------------------------------------------
// The world a cell runs on, for judging
// ---------------------------------------------------------------------------

interface WorldEntry {
  judge: JudgeWorld;
  packet: IntakePacket;
  dictionary: ValueDictionary;
  /** the day of bars the prompt is made from, anchored to the cycle's last price */
  dayBars: DayBars;
}

/**
 * The seeded test day of bars (a random walk, `context-fixtures.ts`) moved so that its last CLOSED
 * M5 bar closes at the cycle's own last price. The walk knows nothing of a golden cycle, so without
 * this the prompt would say the price is 4,378.31 and the day ranged from 4,310 to 4,331: a model
 * (and a trader looking at the recorded example) would be shown a market that contradicts itself.
 * Every price is moved by one amount, so the shape, the gaps and the counts are the seed's.
 */
const dayBarsBySlot = new Map<string, Promise<DayBars>>();
function dayBarsOf(
  slotIso: string,
  lastPrice: number | null
): Promise<DayBars> {
  const key = `${slotIso}|${lastPrice}`;
  let found = dayBarsBySlot.get(key);
  if (found === undefined) {
    const raw = worldFor(slotIso);
    let bars = raw;
    if (lastPrice !== null) {
      const closedAt = (secondsOfSlot(slotIso) as number) - 300;
      const reference = raw.find(
        (bar) => bar.timeframe === 'M5' && bar.timestamp === closedAt
      );
      if (reference === undefined) {
        throw new Error(`no closed M5 bar at ${slotIso} in the test world`);
      }
      const offset = Math.round((lastPrice - reference.close) * 100) / 100;
      const move = (value: number): number =>
        Math.round((value + offset) * 100) / 100;
      bars = raw.map((bar) => ({
        ...bar,
        open: move(bar.open),
        high: move(bar.high),
        low: move(bar.low),
        close: move(bar.close),
      }));
    }
    found = dayBarsFor(slotIso, bars);
    dayBarsBySlot.set(key, found);
  }
  return found;
}

const worldCache = new Map<string, Promise<WorldEntry>>();

/** The packet the orchestrator's intake builds for a scenario, and the cycle's dictionary. */
export function worldEntry(
  scenario: Scenario,
  trader: TraderType,
  locale: Locale
): Promise<WorldEntry> {
  const key = [
    scenario.cycle,
    trader,
    locale,
    scenario.overlay.status,
    scenario.overlay.retuning,
    scenario.intent,
    scenario.condition,
  ].join('|');
  let found = worldCache.get(key);
  if (found === undefined) {
    found = (async (): Promise<WorldEntry> => {
      const world = GOLDENS[cycleIndex(scenario.cycle)]!;
      const options = intakeOptionsFor(scenario, trader, locale);
      const result = await intakeRun(requestFor(scenario), {
        ...options,
        world,
      });
      if (result.result.kind !== 'PACKET') {
        throw new Error(
          `scenario ${scenario.id}: intake gave ${result.result.kind}, not a packet`
        );
      }
      const packet = result.result.packet;
      const dayBars = await dayBarsOf(
        world.slotIso,
        packet.data.last_price?.price ?? null
      );
      const dictionary = buildValueDictionary(packet, dayBars);
      return {
        packet,
        dictionary,
        dayBars,
        judge: { packet, dictionary, shape: shapeOf(scenario.intent) },
      };
    })();
    worldCache.set(key, found);
  }
  return found;
}

// ---------------------------------------------------------------------------
// Scripts: what the answer model returns
// ---------------------------------------------------------------------------

function good(entry: WorldEntry, scenario: Scenario, locale: Locale): string {
  return shapeOf(scenario.intent) === 'REPORT1'
    ? asJson(standInReport(entry.packet, entry.dictionary, locale))
    : asJson(standInAnswer(entry.packet, locale));
}

const reply = (text: string): FixtureScript => ({ kind: 'REPLY', text });
const fail = (): FixtureScript => ({ kind: 'FAIL', code: 'TIMEOUT' });

/** The primary and fallback scripts a scenario's condition stages. */
export function scriptsFor(
  entry: WorldEntry,
  scenario: Scenario,
  locale: Locale
): { primary: FixtureScript[]; fallback: FixtureScript[] | null } {
  const text = good(entry, scenario, locale);
  const report = standInReport(entry.packet, entry.dictionary, locale);
  switch (scenario.condition) {
    case 'MODEL_DOWN':
      return { primary: [fail()], fallback: [reply(text)] };
    case 'BOTH_MODELS_DOWN':
      return { primary: [fail()], fallback: [fail()] };
    case 'PLANT_WRONG_PRICE': {
      const wrong = withWrongPrice(report);
      return { primary: [reply(wrong), reply(wrong)], fallback: null };
    }
    case 'PLANT_BANNED_PHRASE':
      return {
        primary: [reply(withBannedPhrase(report, locale)), reply(text)],
        fallback: null,
      };
    case 'PLANT_BAD_JSON':
      return {
        primary: [reply(withBadJson(report)), reply(text)],
        fallback: null,
      };
    case 'PLANT_BAD_ZONE': {
      const stored = new Set(
        (entry.packet.readings.synthesis?.zones ?? []).map((zone) =>
          String(zone['zone_id'])
        )
      );
      const unknown = ['Z5', 'Z4', 'Z3', 'Z2', 'Z1'].find(
        (id) => !stored.has(id)
      );
      if (unknown === undefined) throw new Error('every zone id exists');
      return {
        primary: [reply(withBadZone(report, unknown)), reply(text)],
        fallback: null,
      };
    }
    default:
      return { primary: [reply(text)], fallback: null };
  }
}

// ---------------------------------------------------------------------------
// Capturing the model's calls
// ---------------------------------------------------------------------------

interface Try {
  slot: 'PRIMARY' | 'FALLBACK';
  result: ModelCallResult;
}

/** The stand-in prices a call like PRICED_A so the units are in proportion (and fictional). */
function withDerivedCost(
  result: ModelCallResult,
  target: ModelPort['target']
): ModelCallResult {
  if (!result.ok || result.usage.cost_micro_usd !== 0) return result;
  const priceIn = target.price_in ?? 0;
  const priceOut = target.price_out ?? 0;
  return {
    ...result,
    usage: {
      ...result.usage,
      cost_micro_usd: Math.round(
        (result.usage.prompt_tokens ?? 0) * priceIn +
          (result.usage.completion_tokens ?? 0) * priceOut
      ),
    },
  };
}

function capture(
  port: ModelPort,
  slot: Try['slot'],
  log: Try[],
  derive: boolean
): ModelPort {
  return {
    target: port.target,
    complete: async (request: ModelRequest) => {
      const raw = await port.complete(request);
      const result = derive ? withDerivedCost(raw, port.target) : raw;
      log.push({ slot, result });
      return result;
    },
  };
}

/** Group the tries into the answer step's logical calls: a primary try starts one, a fallback try joins it. */
function callsOf(tries: readonly Try[]): CallRecord[] {
  const calls: CallRecord[] = [];
  let current: { tries: Try[] } | null = null;
  const groups: { tries: Try[] }[] = [];
  for (const entry of tries) {
    if (entry.slot === 'PRIMARY' || current === null) {
      current = { tries: [] };
      groups.push(current);
    }
    current.tries.push(entry);
  }
  for (const group of groups) {
    const answered = group.tries.find((entry) => entry.result.ok);
    const latency = group.tries.reduce(
      (sum, entry) => sum + entry.result.latency_ms,
      0
    );
    if (answered === undefined || !answered.result.ok) {
      calls.push({
        slot: null,
        host: null,
        text: null,
        tries: group.tries.length,
        prompt_tokens: 0,
        completion_tokens: 0,
        cached_tokens: 0,
        cost_micro_usd: 0,
        cost_estimated: false,
        latency_ms: latency,
      });
    } else {
      calls.push({
        slot: answered.slot,
        host: answered.result.host,
        text: answered.result.text,
        tries: group.tries.length,
        prompt_tokens: answered.result.usage.prompt_tokens ?? 0,
        completion_tokens: answered.result.usage.completion_tokens ?? 0,
        cached_tokens: answered.result.usage.cached_tokens ?? 0,
        cost_micro_usd: answered.result.usage.cost_micro_usd ?? 0,
        cost_estimated: answered.result.usage.cost_flag !== null,
        latency_ms: latency,
      });
    }
  }
  return calls;
}

// ---------------------------------------------------------------------------
// The chart of a condition
// ---------------------------------------------------------------------------

const PNG = new Uint8Array([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3,
]);

function chartFor(scenario: Scenario, slot: number): ChartPort {
  if (scenario.condition === 'CHART_OTHER_CYCLE') {
    const stamp: ChartStamp = {
      slot: slot - CHART_SLOT_SECONDS,
      lastClosedBar: slot - 2 * CHART_SLOT_SECONDS,
      overlay: 'best_fit_a',
      variant: 'overlay',
    };
    return {
      getChartStamp: async () => stamp,
      getChartImage: async () => ({
        bytes: PNG,
        contentType: 'image/png',
        stamp,
      }),
    };
  }
  if (scenario.condition === 'CHART_MISSING') {
    return { getChartStamp: async () => null, getChartImage: async () => null };
  }
  // the normal state: the renderer drew this cycle's chart, so the stamp matches
  const stamp: ChartStamp = {
    slot,
    lastClosedBar: slot - CHART_SLOT_SECONDS,
    overlay: 'best_fit_a',
    variant: 'overlay',
  };
  return {
    getChartStamp: async () => stamp,
    getChartImage: async () => ({
      bytes: PNG,
      contentType: 'image/png',
      stamp,
    }),
  };
}

// ---------------------------------------------------------------------------
// One cell
// ---------------------------------------------------------------------------

export interface LiveModels {
  primary: ModelPort;
  fallback: ModelPort | null;
}

export interface RunCellOptions {
  /** a real model for the scenarios whose source is MODEL; absent: the stand-in's fixture replies */
  live?: LiveModels;
  /**
   * Replace the primary model's scripts with these replies (in order). A recording uses it to play
   * a recorded run's replies through the pipeline again, so the delivered result is made from them.
   */
  replies?: readonly (string | null)[];
}

/** The id every recorded thread gets: a run must be the same on every machine and every day. */
export const EVAL_THREAD_ID = 'th-eval-0001';

export class HarnessMismatch extends Error {
  constructor(cell: string, what: string) {
    super(`${cell}: the judge and the orchestrator disagree: ${what}`);
    this.name = 'HarnessMismatch';
  }
}

/** One cell, and the orchestrator's own answer to it (the demo recording keeps the result). */
export async function runCellFull(
  scenario: Scenario,
  key: CellKey,
  options: RunCellOptions = {}
): Promise<{
  record: CellRecord;
  out: Awaited<ReturnType<typeof runReplyWorld>>;
  /** the world the request ran in: its trace rows, its ledger, its stores */
  world: ReplyWorld;
}> {
  const id = cellId(key);
  const entry = await worldEntry(scenario, key.trader, key.locale);
  const index = cycleIndex(scenario.cycle);
  const golden = GOLDENS[index]!;
  const useLive = options.live !== undefined && scenario.source === 'MODEL';
  const scripts = scriptsFor(entry, scenario, key.locale);

  const intake = intakeOptionsFor(scenario, key.trader, key.locale);
  const chart = chartFor(scenario, golden.slot);
  const world: ReplyWorld = await buildWorld({
    golden: index,
    traderType: key.trader,
    intake,
    allowance: scenario.condition === 'QUOTA_EXHAUSTED' ? 30_000 : 20_000_000,
    primary: useLive
      ? []
      : options.replies !== undefined
        ? options.replies.map((text) =>
            text === null
              ? ({ kind: 'FAIL', code: 'TIMEOUT' } as FixtureScript)
              : reply(text)
          )
        : scripts.primary,
    fallback:
      useLive || options.replies !== undefined ? null : scripts.fallback,
    chart,
  });
  world.ports.newThreadId = () => EVAL_THREAD_ID;
  // the day of bars the prompt is made from is the one the judge's dictionary was built from
  world.ports.dayBars = async () => ({ ok: true, bars: entry.dayBars });

  const tries: Try[] = [];
  const primaryPort: ModelPort | null = useLive
    ? (options.live as LiveModels).primary
    : world.primary;
  const fallbackPort: ModelPort | null = useLive
    ? (options.live as LiveModels).fallback
    : world.fallback;
  world.ports.models = {
    primary:
      primaryPort === null
        ? null
        : capture(primaryPort, 'PRIMARY', tries, !useLive),
    fallback:
      fallbackPort === null
        ? null
        : capture(fallbackPort, 'FALLBACK', tries, !useLive),
  };
  if (useLive) {
    const target = (options.live as LiveModels).primary.target;
    const original = world.ports.bounds;
    world.ports.bounds = (kind) => {
      const bounds = original(kind);
      return bounds === null
        ? null
        : { ...bounds, answer: boundOf(target, 19_600, 1_500) };
    };
  }

  const request =
    requestFor(scenario).kind === 'INSTANT'
      ? ({
          kind: 'INSTANT',
          intent: scenario.intent as
            | 'INSTANT_M5_INSPECT'
            | 'INSTANT_M15_INSPECT',
        } as const)
      : ({
          kind: 'TYPED',
          question: QUESTIONS[scenario.intent] as string,
        } as const);
  const out = await runReplyWorld(world, request);

  const calls = callsOf(tries);
  const judgement = judgeReplies(
    entry.judge,
    calls.map((call) => call.text)
  );

  let outcome: CellRecord['outcome'];
  let fixedReason: CellRecord['fixed_reason'] = null;
  let refusal: string | null = null;
  let balanceShown = false;
  let notes: CellRecord['notes'] = [];
  let directionStated = false;
  let directionEquals: boolean | null = null;
  let newsStatus: CellRecord['news_status'] = null;

  if (out.kind === 'REFUSED') {
    outcome = 'REFUSED';
    refusal = out.refusal.code;
    balanceShown = out.quota !== null;
  } else if (out.kind === 'REPLY') {
    outcome = out.result.kind;
    notes = [...out.result.notes];
    if (out.result.kind === 'REPORT1') {
      directionStated = true;
      directionEquals = directionEqualsSynthesis(
        entry.packet,
        out.result.report.direction
      );
      newsStatus = out.result.report.news.status;
    }
    if (out.result.kind === 'FIXED_ANSWER') {
      fixedReason = out.result.fixed.reason;
      directionStated = out.result.fixed.direction !== null;
      if (out.result.fixed.direction !== null) {
        directionEquals = directionEqualsSynthesis(
          entry.packet,
          out.result.fixed.direction
        );
      }
    }
    // the judge and the orchestrator must agree on what the checks found
    if (out.result.kind === 'REPORT1' || out.result.kind === 'ANSWER') {
      if (judgement === null || judgement.final_action === 'FIXED_ANSWER') {
        throw new HarnessMismatch(
          id,
          'the orchestrator delivered a reply the judge would not'
        );
      }
      if (out.result.checks.numbers_flagged !== judgement.numbers_flagged) {
        throw new HarnessMismatch(
          id,
          `numbers flagged ${out.result.checks.numbers_flagged} against ${judgement.numbers_flagged}`
        );
      }
      if (
        out.result.kind === 'REPORT1' &&
        directionStated !== (judgement.direction_equals_syn !== null)
      ) {
        throw new HarnessMismatch(
          id,
          'the direction was composed by one and not the other'
        );
      }
    } else if (
      out.result.kind === 'FIXED_ANSWER' &&
      (out.result.fixed.reason === 'WORDING_FAILED' ||
        out.result.fixed.reason === 'SCHEMA_FAILED')
    ) {
      if (
        judgement === null ||
        judgement.fixed_reason !== out.result.fixed.reason
      ) {
        throw new HarnessMismatch(
          id,
          `fixed ${out.result.fixed.reason} against ${judgement?.fixed_reason ?? 'no judgement'}`
        );
      }
    }
  } else {
    throw new Error(`${id}: the orchestrator ended in ${out.kind}`);
  }

  const row = [...world.traces.rows.values()][0];
  const record: CellRecord = {
    id,
    scenario: scenario.id,
    trader: key.trader,
    locale: key.locale,
    pass: key.pass,
    outcome,
    fixed_reason: fixedReason,
    refusal,
    balance_shown: balanceShown,
    notes,
    direction_stated: directionStated,
    direction_equals_syn: directionEquals,
    news_status: newsStatus,
    model_calls: calls.reduce((sum, call) => sum + call.tries, 0),
    fallback_used: calls.some((call) => call.slot === 'FALLBACK'),
    calls,
    units: row === undefined ? 0 : Number(row.units_charged),
    latency_ms: calls.reduce((sum, call) => sum + call.latency_ms, 0),
    judgement,
  };
  return { record, out, world };
}

export async function runCell(
  scenario: Scenario,
  key: CellKey,
  options: RunCellOptions = {}
): Promise<CellRecord> {
  return (await runCellFull(scenario, key, options)).record;
}

/**
 * The judge worlds of a run's cells, built once, for a replay: `replayRun` wants them synchronously.
 */
export async function judgeWorldsFor(
  run: Pick<EvalRun, 'cells'>,
  scenarios: readonly Scenario[]
): Promise<(cell: CellRecord) => JudgeWorld> {
  const byId = new Map(scenarios.map((scenario) => [scenario.id, scenario]));
  const worlds = new Map<string, JudgeWorld>();
  for (const cell of run.cells) {
    if (cell.calls[0]?.text === undefined || cell.calls[0]?.text === null)
      continue;
    const scenario = byId.get(cell.scenario);
    if (scenario === undefined) continue;
    const entry = await worldEntry(scenario, cell.trader, cell.locale);
    worlds.set(cell.id, entry.judge);
  }
  return (cell) => {
    const found = worlds.get(cell.id);
    if (found === undefined) throw new Error(`no world for cell ${cell.id}`);
    return found;
  };
}

// ---------------------------------------------------------------------------
// A whole run
// ---------------------------------------------------------------------------

/** The digest of every (cycle, trader type) world the set uses, from the FRESH English packet. */
export async function worldDigests(
  scenarios: readonly Scenario[]
): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  for (const scenario of scenarios) {
    for (const trader of scenario.traders) {
      const name = `${scenario.cycle}.${trader}`;
      if (out[name] !== undefined) continue;
      const base: Scenario = {
        ...scenario,
        intent: 'DIRECTION',
        condition: 'NONE',
        overlay: { status: 'FRESH', retuning: false },
      };
      const entry = await worldEntry(base, trader, 'en-US');
      out[name] = await worldDigestOf(entry.packet, entry.dictionary);
    }
  }
  return out;
}

export async function currentPartsFor(
  set: ScenarioSet,
  digests?: Record<string, string>
): Promise<CurrentParts> {
  const worlds = digests ?? (await worldDigests(set.scenarios));
  return currentParts(await scenarioSetSha256(set, worlds));
}

export interface RecordOptions {
  kind: RunKind;
  scenarios: ScenarioSet;
  passes: number;
  madeOn: string;
  /**
   * The model the run is about. For a LIVE run the provider is not known until the calls are made:
   * leave it out and it is the host(s) the gateway reported, joined with `+`.
   */
  model: { slug: string; provider?: string };
  live?: LiveModels;
  /** limit the cells (the live script's --locales); default: every cell */
  only?: (key: CellKey, scenario: Scenario) => boolean;
  onCell?: (cell: CellRecord, done: number, total: number) => void;
}

/** Run every cell and build the run file's content. */
export async function recordRun(options: RecordOptions): Promise<EvalRun> {
  const set = options.scenarios;
  const byId = new Map(
    set.scenarios.map((scenario) => [scenario.id, scenario])
  );
  const keys = cellsOf(set.scenarios, options.passes).filter((key) =>
    options.only === undefined
      ? true
      : options.only(key, byId.get(key.scenario) as Scenario)
  );
  const digests = await worldDigests(set.scenarios);
  const current = await currentPartsFor(set, digests);

  const cells: CellRecord[] = [];
  for (const key of keys) {
    const cell = await runCell(byId.get(key.scenario) as Scenario, key, {
      ...(options.live === undefined ? {} : { live: options.live }),
    });
    cells.push(cell);
    options.onCell?.(cell, cells.length, keys.length);
  }
  const summary = summarizeCells(cells, set.scenarios);
  const hosts = [
    ...new Set(
      cells.flatMap((cell) =>
        cell.calls.flatMap((call) =>
          call.host === null || call.host === 'fixture' ? [] : [call.host]
        )
      )
    ),
  ].sort();
  const provider =
    options.model.provider ?? (hosts.length > 0 ? hosts.join('+') : 'unknown');
  const model = { slug: options.model.slug, provider };
  const fingerprint = await currentFingerprint(model, current);
  return {
    schema: RUN_SCHEMA,
    id: `${options.kind === 'STAND_IN' ? 'standin' : 'live'}-${fingerprint.sha256.slice(0, 12)}`,
    kind: options.kind,
    label:
      options.kind === 'STAND_IN'
        ? STAND_IN_LABEL
        : `LIVE RUN of ${options.model.slug} served by ${provider}`,
    made_on: options.madeOn,
    passes: options.passes,
    model,
    fingerprint,
    worlds: digests,
    cells,
    summary,
  };
}

/** The model a stand-in run names. */
export const STAND_IN_MODEL = {
  slug: FIXTURE_TARGET.slug,
  provider: 'fixture',
} as const;

export { PRICED_A };
