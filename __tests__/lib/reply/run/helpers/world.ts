/**
 * The world of the orchestrator tests (build step 7 part 7a): every port of `runReply` is a thing
 * that COUNTS, and everything that can run for real does.
 *
 * What runs for real: the intake path over a stored golden cycle (`makeFake`), the gate, the
 * answer gate, the context assembler, the checks, the composer, the quota meter over the real
 * ledger store (answering from `LedgerModel`, the model of the two tables), and the thread,
 * message and trace stores (over in-memory clients) with all their validation: a trace or a reply
 * the contracts refuse fails the test, because the real writer refuses it.
 *
 * What is replaced: the clock (it stands two minutes after the cycle), the model (the fixture
 * model, with scripted replies), the Understand model (its answer, and a reported cost), storage
 * of the chart, the market database (the day's bars come from the seeded world) and the deadline.
 */

import { createThreadPort } from '@/lib/platform/chat/thread-port';
import { canUseAiChat } from '@/lib/platform/entitlements';
import { createLedgerPort } from '@/lib/platform/metering/ledger-port';
import { runReply } from '@/lib/reply/orchestrator';
import {
  addressableIds,
  buildValueDictionary,
} from '@/lib/reply/checks/value-dictionary';
import type { ValueDictionary } from '@/lib/reply/checks/value-dictionary';
import { DEFAULT_CALIBRATION } from '@/lib/reply/context/tokens';
import type { DayBars } from '@/lib/reply/context/ohlc-compact';
import type {
  GateCaller,
  PacketIntent,
  RequestRead,
  TraderType,
} from '@/lib/reply/contracts/intake';
import { boundOf, floorUnits } from '@/lib/reply/meter/estimate';
import type { RequestBounds } from '@/lib/reply/meter/estimate';
import { createMeter, createQuotaPort } from '@/lib/reply/meter/quota-port';
import type { FallbackPorts } from '@/lib/reply/gateway/fallback';
import {
  FIXTURE_TARGET,
  FIXTURE_TARGET_B,
  createFixtureModel,
} from '@/lib/reply/gateway/fixture';
import type { FixtureModel, FixtureScript } from '@/lib/reply/gateway/fixture';
import type { ModelTarget } from '@/lib/reply/gateway/types';
import type { ChartPort } from '@/lib/reply/read/chart';
import type { CycleStates } from '@/lib/reply/report1/changes';
import {
  createThreadsPort,
  createTracesPort,
} from '@/lib/reply/server/store-ports';
import type {
  Deadline,
  ReplyOptions,
  ReplyPorts,
  ReplyRequest,
  ReplyRun,
} from '@/lib/reply/run/types';
import type { AuditKey } from '@/lib/platform/traces/hash';
import type { LedgerClient } from '@/lib/platform/metering/ledger-store';
import type { MessageStoreClient } from '@/lib/platform/chat/messages-store';
import type { ThreadStoreClient } from '@/lib/platform/chat/threads-store';
import type { TraceStoreClient } from '@/lib/platform/traces/store';

import { goldenWorlds, type World } from '../../../intake/helpers/world';
import { makeFake, echoResult } from '../../../intake/helpers/ports';
import type { FakeOptions2 } from '../../../intake/helpers/ports';
import {
  dayBarsFor,
  goldenPacket,
  worldFor,
} from '../../context/helpers/context-fixtures';
import { LedgerModel } from '../../../platform/helpers/ledger-model';
import {
  FakeChatClient,
  FakeTraceClient,
} from '../../../platform/helpers/fakes';
import { modelReportFor } from '../../report1/helpers/report1-fixtures';

export const USER = 'user-pro-1';
export const AUDIT_KEY: AuditKey = {
  key: 'k'.repeat(48),
  version: 3,
  source: 'ENV',
};

/** A fixture target with a price, so the worst case of a call can be worked out. */
export const PRICED_A: ModelTarget = {
  ...FIXTURE_TARGET,
  price_in: 1,
  price_out: 4,
  calibration: DEFAULT_CALIBRATION,
};
export const PRICED_B: ModelTarget = {
  ...FIXTURE_TARGET_B,
  price_in: 1,
  price_out: 4,
  calibration: DEFAULT_CALIBRATION,
};
export const UNDERSTAND_TARGET: ModelTarget = {
  ...FIXTURE_TARGET,
  slug: 'understand-vendor/small',
  vision: false,
  json_schema: false,
  context_budget: 8_000,
  max_output_tokens: 700,
  price_in: 0.1,
  price_out: 0.4,
};

export const CLIENT_ID = 'client-0001-aaaa-bbbb';

/** Names this run, so ids made by two runs on one database cannot meet. */
const RUN_TAG = Date.now().toString(36);
let threadCounter = 0;

export type Golden = World;
export const GOLDENS: World[] = goldenWorlds();

export interface ReplyWorldOptions {
  /** index of the golden cycle (default: the real 18 Sep cycle, 0) */
  golden?: number;
  traderType?: TraderType;
  /** the intake fakes: the session, the thread verdict, the profile, the understand answer, ... */
  intake?: FakeOptions2;
  /** the monthly allowance in units; null refuses everything (default 20,000,000: 20 dollars) */
  allowance?: number | null;
  /** the scripts of the primary model; a function sees the packet's report; `[]` for no model */
  primary?: 'REPORT' | FixtureScript[] | null;
  /** the scripts of the fallback model; null for none */
  fallback?: FixtureScript[] | null;
  /** what the Understand call is reported to have cost, in micro-dollars */
  understandCost?: number | null;
  /** the reply costs the primary reports, micro-dollars */
  replyCost?: number;
  chart?: ChartPort;
  previousStates?: CycleStates | null;
  /** the deadline, replaced by one a test fires */
  deadline?: Deadline;
  /** the day's bars cannot be read */
  noBars?: boolean;
  /** make the trace store fail */
  traceFails?: boolean;
  /** another target for the primary model (a small window, say) */
  primaryTarget?: ModelTarget;
  /**
   * Real clients for the gated spec on a real PostgreSQL: the quota ledger's, the chat tables' and
   * the trace table's. Without them the in-memory models run.
   */
  clients?: {
    ledger?: LedgerClient;
    chat?: ThreadStoreClient & MessageStoreClient;
    traces?: TraceStoreClient;
  };
}

export interface ReplyWorld {
  ports: ReplyPorts;
  fake: ReturnType<typeof makeFake>;
  world: World;
  primary: FixtureModel | null;
  fallback: FixtureModel | null;
  ledger: LedgerModel;
  chat: FakeChatClient;
  traces: FakeTraceClient;
  logs: { code: string; detail?: Readonly<Record<string, string | number>> }[];
  calls: {
    bars: number;
    chart: number;
    previousStates: number;
    deadlines: number;
    /** the milliseconds each deadline was asked for */
    deadlineArgs: number[];
    cancelled: number;
  };
  /** the packet and the dictionary the fixture model's reply is made from */
  packet: ReturnType<typeof goldenPacket>;
  dictionary: ValueDictionary;
  dayBars: DayBars;
}

/** A controllable deadline. */
export function manualDeadline(): Deadline & { fire(): void } {
  const controller = new AbortController();
  return {
    signal: controller.signal,
    cancel: () => undefined,
    fire: () => controller.abort(),
  };
}

export async function buildWorld(
  options: ReplyWorldOptions = {}
): Promise<ReplyWorld> {
  const world = GOLDENS[options.golden ?? 0] as World;
  const traderType = options.traderType ?? 'DAY_TRADER';
  const fake = makeFake({
    world,
    ...(options.intake ?? {}),
    profile: options.intake?.profile ?? {
      trader_type: traderType,
      style: 'BOTH',
      max_risk_pct: '1.5',
      max_leverage: '5',
      target_rrr: '1.75',
      min_sld: '13',
    },
  });
  const slotIso = world.slotIso;
  const dayBars = await dayBarsFor(slotIso, worldFor(slotIso));
  // the packet the model's reply is made from: same cycle, same trader type, an intent that wants a report
  const packet = goldenPacket(world.name.slice(0, 2), {
    traderType,
    intent: 'DIRECTION' as PacketIntent,
  });
  const dictionary = buildValueDictionary(packet, dayBars);
  const report = modelReportFor(packet, dictionary);

  const now = (): number => fake.ports.now();
  const ledger = new LedgerModel();
  ledger.addUser(USER);
  const ledgerPort = createLedgerPort({
    client: options.clients?.ledger ?? ledger,
  });
  const allowance =
    options.allowance === undefined ? 20_000_000 : options.allowance;
  const allowanceOf = (tier: string): number | null =>
    tier === 'PRO' ? allowance : 0;
  const quota = createQuotaPort({
    ledger: ledgerPort,
    now,
    allowanceOf,
    floorOf: (kind) =>
      floorUnits({
        kind,
        understandModel: UNDERSTAND_TARGET,
        answerModels: [PRICED_A],
      }),
  });
  fake.ports.gate.quota = quota;
  const meter = createMeter({
    ledger: ledgerPort,
    now,
    allowanceOf,
    floorOf: () => 1,
  });

  const replyScripts: FixtureScript[] = [
    {
      kind: 'REPLY',
      text: JSON.stringify(report),
      usage: {
        prompt_tokens: 14_000,
        completion_tokens: 300,
        cost_micro_usd: options.replyCost ?? 2_500,
      },
    },
  ];
  const primaryScripts =
    options.primary === undefined || options.primary === 'REPORT'
      ? replyScripts
      : options.primary;
  const primary =
    primaryScripts === null
      ? null
      : createFixtureModel({
          target: options.primaryTarget ?? PRICED_A,
          scenarios: { default: primaryScripts },
        });
  const fallback =
    options.fallback === undefined || options.fallback === null
      ? null
      : createFixtureModel({
          target: PRICED_B,
          scenarios: { default: options.fallback },
        });
  const models: FallbackPorts = { primary, fallback };

  const logs: ReplyWorld['logs'] = [];
  const calls = {
    bars: 0,
    chart: 0,
    previousStates: 0,
    deadlines: 0,
    deadlineArgs: [] as number[],
    cancelled: 0,
  };
  const chat = new FakeChatClient();
  const traces = new FakeTraceClient();
  const chatClient = options.clients?.chat ?? chat.client();
  const traceClient = options.clients?.traces ?? traces;
  const threadsPort = createThreadsPort({ client: chatClient });
  // the gate asks the real entitlement table and the (in-memory) chat store, as production does
  fake.ports.gate.entitlement = { allows: (tier) => canUseAiChat(tier) };
  fake.ports.gate.thread = createThreadPort({ client: chatClient });
  const tracesPort = createTracesPort({ client: traceClient, key: AUDIT_KEY });
  const chartPort: ChartPort = options.chart ?? {
    getChartStamp: async () => {
      calls.chart += 1;
      return null;
    },
    getChartImage: async () => {
      calls.chart += 1;
      return null;
    },
  };
  // the fake knowledge service names its index "build-0001"; the service's real ids are "kb-" and 32 hex digits,
  // and the trace contract holds the id to that, so the fake is given a real-looking one
  const searched = fake.ports.knowledge.search.bind(fake.ports.knowledge);
  fake.ports.knowledge.search = async (request) => {
    const found = await searched(request);
    return found.knowledge.index_build_id === null
      ? found
      : {
          ...found,
          knowledge: {
            ...found.knowledge,
            index_build_id: `kb-${'ab'.repeat(16)}`,
          },
        };
  };
  const { understand: _understand, ...intake } = fake.ports;
  void _understand;
  const understandCost =
    options.understandCost === undefined ? 300 : options.understandCost;

  const ports: ReplyPorts = {
    intake,
    understand: ({ onCall }) => ({
      understand: async (request) => {
        const answer = await fake.ports.understand.understand(request);
        onCall({
          ok: true,
          text: JSON.stringify(answer),
          model: UNDERSTAND_TARGET.slug,
          served_model: null,
          host: null,
          generation_id: null,
          response_mode: 'JSON_OBJECT',
          finish_reason: 'stop',
          usage: {
            prompt_tokens: 800,
            completion_tokens: 120,
            cached_tokens: 0,
            cost_micro_usd: understandCost,
            cost_flag: null,
          },
          latency_ms: 40,
          attempts: 1,
        });
        return answer;
      },
    }),
    bounds: (kind): RequestBounds | null =>
      primary === null
        ? null
        : {
            understand:
              kind === 'TYPED' ? boundOf(UNDERSTAND_TARGET, 5_000) : null,
            answer: boundOf(PRICED_A, 19_600, 1_500),
          },
    meter,
    models,
    dayBars: async () => {
      calls.bars += 1;
      return options.noBars === true
        ? { ok: false, code: 'DATABASE_ERROR', detail: 'down' }
        : { ok: true, bars: dayBars };
    },
    chart: chartPort,
    tierAllowsChart: (tier) => tier === 'PRO',
    previousStates: async () => {
      calls.previousStates += 1;
      return options.previousStates ?? null;
    },
    threads: threadsPort,
    traces:
      options.traceFails === true
        ? {
            ...tracesPort,
            write: async () => {
              throw new Error('the trace table is down');
            },
          }
        : tracesPort,
    newThreadId: () => {
      threadCounter += 1;
      // (unique across worlds: a real database keeps the threads of every test of a run)
      return `th-new-${RUN_TAG}-${String(threadCounter).padStart(5, '0')}`;
    },
    anonymousRequestId: () => 'anon-0000000000000001',
    deadline: (ms) => {
      calls.deadlines += 1;
      calls.deadlineArgs.push(ms);
      if (options.deadline !== undefined) return options.deadline;
      return {
        signal: new AbortController().signal,
        cancel: () => {
          calls.cancelled += 1;
        },
      };
    },
    log: (code, detail) => {
      logs.push({ code, ...(detail === undefined ? {} : { detail }) });
    },
  };

  return {
    ports,
    fake,
    world,
    primary,
    fallback,
    ledger,
    chat,
    traces,
    logs,
    calls,
    packet,
    dictionary,
    dayBars,
  };
}

/** A request reader that returns what the test gives it; the thread and the client id are the test's. */
export function reading(
  request: Partial<ReplyRequest> & { kind?: 'TYPED' | 'INSTANT' } = {}
): (caller: GateCaller) => Promise<RequestRead<ReplyRequest, never>> {
  return async () => {
    const kind = request.kind ?? 'TYPED';
    const base = {
      threadId: request.threadId ?? null,
      clientRequestId: request.clientRequestId ?? CLIENT_ID,
    };
    return {
      ok: true,
      request:
        kind === 'TYPED'
          ? {
              kind: 'TYPED',
              question:
                (request as { question?: string }).question ??
                'What is the direction of gold now?',
              ...base,
            }
          : {
              kind: 'INSTANT',
              intent:
                (
                  request as {
                    intent?: 'INSTANT_M5_INSPECT' | 'INSTANT_M15_INSPECT';
                  }
                ).intent ?? 'INSTANT_M5_INSPECT',
              ...base,
            },
    };
  };
}

export async function run(
  w: ReplyWorld,
  request: Parameters<typeof reading>[0] = {},
  options: ReplyOptions = {}
): Promise<ReplyRun<never>> {
  return runReply(w.ports, reading(request), options);
}

export { echoResult, addressableIds };
