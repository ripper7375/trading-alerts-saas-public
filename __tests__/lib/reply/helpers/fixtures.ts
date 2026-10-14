/**
 * Fixtures for the reply contracts and the platform stores (build step 7, part 1).
 *
 * The packets are the signed-off golden cycles through the intake helper. The three "stored
 * reports" are model outputs (`report1.v1`) for the three REAL cycles (18 Sep, 28 Sep 14:15
 * and 28 Sep 23:15); the rest are the results, traces and rows that fit them. Nothing here
 * invents market data: a level in a sentence is a value id, the way the contract wants it.
 */

import { createHash } from 'crypto';

import type { AnswerModel } from '@/lib/reply/contracts/answer';
import type { Report1Model } from '@/lib/reply/contracts/report1';
import type {
  AnswerResult,
  ActionResult,
  ComposedReport1,
  DirectionLine,
  FixedAnswerResult,
  Report1Result,
} from '@/lib/reply/contracts/result';
import type { ReplyTrace } from '@/lib/reply/contracts/trace-fields';
import { contextOfPacket } from '@/lib/reply/contracts/shape';
import type { ReplyContext } from '@/lib/reply/contracts/shape';
import type { IntakePacket, TraderType } from '@/lib/intake';

import { GOLDENS, clone, packetFromGolden } from '../../intake/helpers/packets';

export { clone };

export type Any = any;

// ---------------------------------------------------------------------------
// Ids (long enough that a user id cannot occur inside a report by accident)
// ---------------------------------------------------------------------------

export const USER_ID = 'cm0user00000000000000000001';
export const OTHER_USER_ID = 'cm0user00000000000000000002';
export const THREAD_ID = 'cm0thread000000000000000001';
export const REQUEST_ID = 'req-7f3a9c1e-0001';
export const CLIENT_REQUEST_ID = 'cli-5b2d8e4a-0001';
export const SLOT = '2026-09-18T20:55Z';
/** `2026-09-18T20:55Z` in unix seconds */
export const SLOT_SECONDS = Date.UTC(2026, 8, 18, 20, 55) / 1000;
export const T0 = new Date(Date.UTC(2026, 8, 18, 21, 0, 12, 345));

// ---------------------------------------------------------------------------
// Packets and contexts
// ---------------------------------------------------------------------------

export function golden(prefix: string) {
  const found = GOLDENS.find((g) => g.id.startsWith(prefix));
  if (found === undefined) throw new Error(`no golden ${prefix}`);
  return found;
}

/** Value ids the fixture reports place; the real dictionary is built in part 4/5. */
export const VALUE_IDS: readonly string[] = [
  'LAST_PRICE',
  'DAY.high',
  'DAY.low',
  'MCD1.UOEDT',
  'MCD1.LOEDT',
  'MCD2.baseline',
  'MCD2.UOEDT',
  'MCD2.LOEDT',
  'Z1.invalidation',
  'Z1.reference',
  'Z1.low',
  'Z1.high',
  'Z1.room',
  'Z2.invalidation',
  'Z2.reference',
];

export function packetFor(
  prefix: string,
  traderType: TraderType = 'DAY_TRADER'
): IntakePacket {
  return packetFromGolden(golden(prefix), { traderType });
}

export function contextFor(
  prefix: string,
  traderType: TraderType = 'DAY_TRADER'
): ReplyContext {
  return contextOfPacket(packetFor(prefix, traderType), VALUE_IDS);
}

// ---------------------------------------------------------------------------
// The three stored reports (model outputs for the real cycles)
// ---------------------------------------------------------------------------

/** 18 Sep: a counter-trend rally, LONG, zones Z1 and Z2. */
export const REPORT_01: Report1Model = {
  headline:
    'Counter-trend rally inside the M5 corridor; M15 still falling, price near {LAST_PRICE}',
  zones: ['Z1', 'Z2'],
  rationale: [
    { text: 'M5 holds above {MCD2.baseline}', cites: ['MCD2'] },
    { text: 'The M15 upper edge sits at {MCD1.UOEDT}', cites: ['MCD1'] },
    {
      text: 'The synthesis reads a rally against the M15 trend',
      cites: ['SYN'],
    },
  ],
  watch: [
    {
      text: 'A close below {Z1.invalidation} cancels this view for Z1',
      cites: ['Z1'],
    },
    {
      text: 'A close below {Z2.invalidation} cancels this view for Z2',
      cites: ['Z2'],
    },
  ],
  risks: [
    { text: 'MCD3 is cautionary', cites: ['MCD3'] },
    {
      text: 'Less room to {MCD1.UOEDT} than a full stop',
      cites: ['Z1', 'MCD1'],
    },
  ],
};

/** 28 Sep 14:15: a snapback with no zone source, so no zones are chosen. */
export const REPORT_02: Report1Model = {
  headline: 'Snapback after a spike down, no entry zone is available',
  zones: [],
  rationale: [
    { text: 'The synthesis reads an exhaustion snapback', cites: ['SYN'] },
    { text: 'M5 reclaimed {MCD2.baseline}', cites: ['MCD2'] },
  ],
  watch: [
    {
      text: 'A fall back under {MCD2.LOEDT} ends the snapback',
      cites: ['MCD2'],
    },
  ],
  risks: [],
};

/** 28 Sep 23:15: a downtrend continuation, SHORT, zone Z1. */
export const REPORT_03: Report1Model = {
  headline: 'Downtrend continuation on both charts',
  zones: ['Z1'],
  rationale: [
    { text: 'Both channels slope down', cites: ['MCD1', 'MCD2'] },
    {
      text: 'Price is at {LAST_PRICE}, under {MCD2.baseline}',
      cites: ['MCD2'],
    },
  ],
  watch: [
    {
      text: 'A close above {Z1.invalidation} cancels the short',
      cites: ['Z1'],
    },
  ],
  risks: [{ text: 'MCD3 is cautionary', cites: ['MCD3'] }],
};

export const STORED_REPORTS: readonly [string, Report1Model][] = [
  ['01', REPORT_01],
  ['02', REPORT_02],
  ['03', REPORT_03],
];

export const ANSWER: AnswerModel = {
  locale: 'en-US',
  text: 'UOEDT is the upper edge of the corridor; it is {MCD1.UOEDT} on M15 now.',
  cites: ['MCD1'],
  action: null,
};

// ---------------------------------------------------------------------------
// Results
// ---------------------------------------------------------------------------

export const DIRECTION: DirectionLine = {
  bias: 'LONG',
  trend_relation: 'COUNTER_TREND',
  rule_id: 'R1_MACRO_COUNTER_TREND_RALLY',
  archetype: 'A',
  stand_aside: false,
  profile: 'DAY_TRADER',
};

export function composedReport(): ComposedReport1 {
  return {
    headline: 'Counter-trend rally inside the M5 corridor; price near 4,367.25',
    direction: clone(DIRECTION),
    alignment: {
      trend_relation: 'COUNTER_TREND',
      channels: [
        {
          mcd_id: 'MCD1',
          timeframe: 'M15',
          status: 'CAUTIONARY',
          state_code: 'MCD1_UP_IN_CORRIDOR',
          bias: 'SHORT',
        },
        {
          mcd_id: 'MCD2',
          timeframe: 'M5',
          status: 'CAUTIONARY',
          state_code: 'MCD2_UP_IN_CORRIDOR',
          bias: 'LONG',
        },
      ],
      lines: [{ text: 'M5 holds above 4,367.25', cites: ['MCD2'] }],
    },
    levels: [
      {
        id: 'MCD2.baseline',
        kind: 'CHANNEL',
        timeframe: 'M5',
        name: 'baseline',
        price: 4367.25,
      },
      {
        id: 'MCD1.UOEDT',
        kind: 'CHANNEL',
        timeframe: 'M15',
        name: 'UOEDT',
        price: 4392.1,
      },
    ],
    zones: [
      {
        zone_id: 'Z1',
        bias: 'LONG',
        low: 4364.5,
        high: 4368.0,
        reference_price: 4367.2,
        invalidation_price: 4350.22,
        invalidation_basis: 'LEVEL',
        stop_distance: 16.98,
        next_opposing_price: 4392.1,
        runway: 24.9,
        runway_ratio: 1.47,
        source_sensors: ['MCD1', 'MCD2'],
        confluence_count: 2,
      },
    ],
    watch: [
      {
        text: 'A close below 4,350.22 cancels this view for Z1',
        cites: ['Z1'],
      },
    ],
    risks: [{ text: 'MCD3 is cautionary', cites: ['MCD3'] }],
    news: { status: 'OK', calendar_age_seconds: 300, items: [] },
  };
}

const baseResult = (
  kind: 'REPORT1' | 'ANSWER' | 'FIXED_ANSWER' | 'ACTION'
) => ({
  schema: 'reply-result/1' as const,
  kind,
  thread_id: THREAD_ID,
  reply_locale: 'en-US',
  intent: 'DIRECTION' as const,
  stamp: {
    as_of: SLOT,
    data_status: 'FRESH' as const,
    retuning: false,
    flags: [] as ('SENSORS_NOT_LIVE' | 'GATEWAY_UNREACHABLE')[],
  },
  disclaimer_version: 'disc-2026-10',
  provenance: {
    request_id: REQUEST_ID,
    model: 'google/gemini-2.5-flash',
    prompt_version: 'prompt-1',
    reply_version: '1.0.0',
  },
  checks: { numbers_flagged: 0, regenerations: 1 },
  changes: [],
});

export function reportResult(): Report1Result {
  return {
    ...baseResult('REPORT1'),
    kind: 'REPORT1',
    report: composedReport(),
  };
}

export function answerResult(): AnswerResult {
  return {
    ...baseResult('ANSWER'),
    kind: 'ANSWER',
    intent: 'EXPLAIN',
    answer: {
      text: 'UOEDT is the upper edge of the corridor; it is 4,392.10 on M15 now.',
      cites: ['MCD1'],
    },
    action: null,
  };
}

export function fixedResult(): FixedAnswerResult {
  return {
    ...baseResult('FIXED_ANSWER'),
    kind: 'FIXED_ANSWER',
    fixed: {
      reason: 'WORDING_FAILED',
      direction: clone(DIRECTION),
      board: [
        {
          mcd_id: 'MCD1',
          status: 'CAUTIONARY',
          state_code: 'MCD1_UP_IN_CORRIDOR',
        },
        { mcd_id: 'MCD2', status: 'ABSENT', state_code: null },
      ],
      levels: [
        {
          id: 'MCD2.baseline',
          kind: 'CHANNEL',
          timeframe: 'M5',
          name: 'baseline',
          price: 4367.25,
        },
      ],
    },
  };
}

export function actionResult(): ActionResult {
  return {
    ...baseResult('ACTION'),
    kind: 'ACTION',
    intent: 'REPORT_2',
    provenance: {
      ...baseResult('ACTION').provenance,
      model: null,
      prompt_version: null,
    },
    checks: { numbers_flagged: 0, regenerations: 0 },
    action: {
      type: 'OPEN_TRADE_SETUP',
      cycle_slot: SLOT,
      trader_type: 'DAY_TRADER',
      zone_ids: ['Z1', 'Z2'],
    },
  };
}

// ---------------------------------------------------------------------------
// The trace
// ---------------------------------------------------------------------------

/** A trace of a Report 1 that needed its one regeneration. */
export function makeTrace(): ReplyTrace {
  return {
    request: {
      reply_version: '1.0.0',
      request_id: REQUEST_ID,
      client_request_id: CLIENT_REQUEST_ID,
      thread_id: THREAD_ID,
      tier: 'PRO',
      kind: 'TYPED',
      intent: 'DIRECTION',
      language: 'en',
      interface_locale: 'en-US',
      reply_locale: 'en-US',
      question_flags: [],
    },
    data: {
      cycle_slot: SLOT,
      data_status: 'FRESH',
      retuning: false,
      flags: [],
      sensor_statuses: {
        MCD1: 'CAUTIONARY',
        MCD2: 'CAUTIONARY',
        MCD3: 'CAUTIONARY',
      },
      synthesis_rule: 'R1_MACRO_COUNTER_TREND_RALLY',
      synthesis_rules_version: 'draft-1',
      last_price_bar: '2026-09-18T20:50Z',
      intake_version: '1.2.0',
      routing_version: 'routing-v1',
      packet_sha256: 'a'.repeat(64),
    },
    knowledge: {
      m_star: ['MCD1', 'MCD2', 'MCD3'],
      chunk_ids: ['D2-MCD1-UP_IN_CORRIDOR', 'D1-LEVELS'],
      index_build_id: `kb-${'b'.repeat(32)}`,
      status: 'OK',
      missed: null,
    },
    model: {
      model: 'google/gemini-2.5-flash',
      prompt_version: 'prompt-1',
      fallback_used: false,
      components: {
        SYSTEM_RULES: 1400,
        BOARD_SYNTHESIS: 700,
        OHLC: 7700,
        CHART: 0,
        READINGS_ZONES: 1900,
        KNOWLEDGE: 1800,
        PROFILE_EVENTS: 400,
        HISTORY: 0,
        QUESTION: 60,
        ANSWER: 900,
      },
      cycle_block_sha256: 'c'.repeat(64),
      tokens: { prompt: 14000, completion: 700, cached: 9000 },
      calls: [
        {
          role: 'UNDERSTAND',
          model: 'google/gemini-2.5-flash',
          outcome: 'OK',
          attempts: 1,
          tokens_prompt: 600,
          tokens_completion: 90,
          tokens_cached: null,
          cost_micro_usd: 120,
          cost_estimated: false,
          latency_ms: 640,
        },
        {
          role: 'ANSWER',
          model: 'google/gemini-2.5-flash',
          outcome: 'OK',
          attempts: 1,
          tokens_prompt: 14000,
          tokens_completion: 700,
          tokens_cached: 9000,
          cost_micro_usd: 3100,
          cost_estimated: false,
          latency_ms: 5200,
        },
        {
          role: 'REGENERATE',
          model: 'google/gemini-2.5-flash',
          outcome: 'OK',
          attempts: 1,
          tokens_prompt: 14300,
          tokens_completion: 690,
          tokens_cached: 14000,
          cost_micro_usd: 1400,
          cost_estimated: true,
          latency_ms: 4800,
        },
      ],
      units_charged: 4620,
      cost_micro_usd: 4620,
    },
    checks: {
      answer_gate: {
        direction: 'YES',
        other_questions: 'ALL',
        chart: 'NOT_CALLED_FOR',
        report2: 'ALLOWED',
      },
      shape: 'REPORT1',
      schema_retries: 0,
      numbers: {
        extracted: 9,
        matched: 8,
        violations: 1,
        flagged: 0,
        classes: { PRICE: 1, DISTANCE: 0, PCT: 0, RATIO: 0, TIME: 0, COUNT: 0 },
      },
      wording: {
        violations: 0,
        categories: {
          ADVICE: 0,
          PROBABILITY: 0,
          GUARANTEE: 0,
          URGENCY: 0,
          UNLISTED_NEWS: 0,
          DIRECTION_WORD: 0,
        },
        fixed_answer: false,
      },
      regenerations: 1,
      direction_equals_syn: true,
      fixed_reason: null,
    },
    risk: null,
    time: {
      started_at: '2026-09-18T21:00:12.345Z',
      total_ms: 12400,
      deadline_hit: false,
      stages: [
        { name: 'GATE', ms: 12 },
        { name: 'UNDERSTAND', ms: 640 },
        { name: 'MODEL', ms: 10000 },
        { name: 'CHECKS', ms: 40 },
      ],
    },
    outcome: 'REPORT1',
  };
}

/** The exact text Engine 4 serializes for the validated setup: the text its consent record hashes. */
export const REPORT2_TEXT = JSON.stringify(report2());

export const sha256 = (text: string): string =>
  createHash('sha256').update(text, 'utf8').digest('hex');

/** A risk group that names the hash of `text` (Report 2 by default) as the setup that was shown. */
export function riskGroup(
  text: string = REPORT2_TEXT
): import('@/lib/reply/contracts/trace-fields').TraceRiskGroup {
  return {
    engine4_version: '1.0.0',
    setup_sha256: sha256(text),
    profile_snapshot_id: 'cm0snapshot000000000000001',
    validator_results: [
      { code: 'RISK', ok: true },
      { code: 'STOP', ok: true },
    ],
    overrides: [],
    consent_action: 'ACCEPT',
  };
}

/** The shape of Report 2 the trace needs: the validated setup, with the trader's own figures. */
export function report2(): Record<string, unknown> {
  return {
    schema: 'validated-setup/1',
    ok: true,
    pinnedSlot: String(SLOT_SECONDS),
    side: 'BUY',
    equity: '10000',
    riskPct: '0.75',
    profile: { equity: '10000', commission: '4' },
  };
}

// ---------------------------------------------------------------------------
// Small helpers for damaging copies
// ---------------------------------------------------------------------------

/** Set `path` (`a.b[0].c`) of a copy of `base` to `value`. */
export function withPath<T>(base: T, path: string, value: unknown): T {
  const copy = clone(base) as Any;
  const parts = path.replace(/\[(\d+)\]/g, '.$1').split('.');
  let node = copy;
  for (const part of parts.slice(0, -1)) node = node[part];
  node[parts[parts.length - 1] as string] = value;
  return copy as T;
}

/** A copy of `base` without `path`. */
export function without<T>(base: T, path: string): T {
  const copy = clone(base) as Any;
  const parts = path.replace(/\[(\d+)\]/g, '.$1').split('.');
  let node = copy;
  for (const part of parts.slice(0, -1)) node = node[part];
  delete node[parts[parts.length - 1] as string];
  return copy as T;
}

/**
 * The `path:code` of every issue, sorted: a stable thing to compare. A result is ok exactly
 * when it has no issues; a validator that answers otherwise would hide behind a test that only
 * reads the list, so every use of this checks that too.
 */
export function summary(result: {
  ok: boolean;
  issues?: { path: string; code: string }[];
}): string[] {
  const issues = result.issues ?? [];
  expect(result.ok).toBe(issues.length === 0);
  return issues.map((i) => `${i.path}:${i.code}`).sort();
}
