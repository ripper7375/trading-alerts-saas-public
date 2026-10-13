/**
 * Fake ports for the pipeline tests (build step 6 part 5): every edge of `runIntake` is a
 * function here that COUNTS how often it was called and with what, so a test can prove that a
 * refusal stopped the request before a later port was reached.
 *
 * Nothing is invented: the snapshot is the real reader over the stored world of a golden or
 * stored cycle (`helpers/world.ts`), the replies are the real dictionaries
 * (`lib/intake/server/reply.ts`), and the knowledge pack and the calendar are labelled TEST.
 */

import type {
  GatePorts,
  GateSession,
  IntakePorts,
  IntakeRequest,
  IntakeResult,
  IntakeTrace,
  PacketProfile,
  ProfileGateRead,
  QuotaRequest,
  ThreadCheck,
  TraderType,
  EventsScope,
  UnderstandPort,
  UnderstandRequest,
} from '@/lib/intake';
import { TraceRecorder, runIntake } from '@/lib/intake';
import type {
  KnowledgeRequest,
  KnowledgeResult,
} from '@/lib/intake/knowledge-client';
import { unavailableKnowledge } from '@/lib/intake/knowledge-client';
import type { EventsRead } from '@/lib/intake/read/events';
import { readSnapshot } from '@/lib/intake/read/snapshot';
import { replyText } from '@/lib/intake/server/reply';
import type { RequestFailure } from '@/lib/intake/server/errors';

import {
  depsFor,
  goldenWorlds,
  type FakeOptions,
  type GatewayStatus,
  type World,
} from './world';

export const PROFILE: PacketProfile = {
  trader_type: 'DAY_TRADER',
  style: 'BOTH',
  max_risk_pct: '1.5',
  max_leverage: '5',
  target_rrr: '1.75',
  min_sld: '13',
};

export const profileFor = (traderType: TraderType): PacketProfile => ({
  ...PROFILE,
  trader_type: traderType,
});

export interface Calls {
  enabled: number;
  session: number;
  entitlement: number;
  thread: number;
  profile: number;
  quota: number;
  locale: number;
  understand: number;
  snapshot: number;
  events: number;
  knowledge: number;
  reply: number;
  entitlementTiers: string[];
  threadChecks: ThreadCheck[];
  profileUsers: string[];
  quotaRequests: QuotaRequest[];
  understandRequests: UnderstandRequest[];
  snapshotRequests: { traderType: TraderType }[];
  eventsRequests: { nowSeconds: number; scope: EventsScope }[];
  knowledgeRequests: KnowledgeRequest[];
}

export interface FakeOptions2 {
  enabled?: boolean;
  session?: GateSession | null | 'THROWS';
  /** the tier is allowed (default) or not, or the port throws */
  entitlement?: boolean | 'THROWS';
  thread?: 'OK' | 'INVALID' | 'THROWS';
  profile?: ProfileGateRead | PacketProfile | 'THROWS';
  quota?: boolean | 'THROWS';
  /** the interface setting; `'THROWS'` makes the port fail */
  locale?: string | null | 'THROWS';
  /** what the model says; a function sees the request */
  understand?: UnderstandPort | unknown;
  world?: World;
  worldOptions?: FakeOptions & {
    gateway?: GatewayStatus | 'THROWS';
    retuning?: boolean;
    noCycle?: boolean;
  };
  /** replace the snapshot altogether */
  snapshot?: IntakePorts['snapshot'];
  knowledge?:
    | 'OK'
    | 'EMPTY'
    | 'UNAVAILABLE'
    | 'THROWS'
    | 'BUILD_LESS'
    | ((request: KnowledgeRequest) => Promise<KnowledgeResult>);
  events?: 'OK' | 'LATE' | 'UNAVAILABLE' | 'THROWS' | 'ROWS_LEFT_OUT';
  reply?: IntakePorts['reply'];
  /** the clock in ms; defaults to two minutes after the world's slot */
  now?: number;
}

export function sampleChunk(id = 'D1-LEVELS') {
  return {
    id,
    domain: 'D1' as const,
    mcd_id: null,
    state_codes: [] as string[],
    timeframe: null,
    version: '1.0.0',
    text: 'TEST ONLY. UOEDT is the upper edge of the corridor.',
  };
}

const isPort = (value: unknown): value is UnderstandPort =>
  typeof value === 'object' &&
  value !== null &&
  typeof (value as { understand?: unknown }).understand === 'function';

export function echoResult(
  question: string,
  intent: string,
  overrides: Record<string, unknown> = {}
): Record<string, unknown> {
  return {
    schema: 'understand-result/1',
    language: 'en',
    english: question,
    intent,
    symbols: ['XAUUSD'],
    timeframes: [],
    ...overrides,
  };
}

export interface Fake {
  ports: IntakePorts;
  calls: Calls;
  world: World;
  /** the stage names the recorder had when the knowledge port was called, if it was */
  atRetrieval: { stages: string[]; dataStatus: string | null }[];
}

export function makeFake(
  options: FakeOptions2 = {},
  trace?: TraceRecorder
): Fake {
  const world = options.world ?? (goldenWorlds()[0] as World);
  const { deps } = depsFor(world, options.worldOptions);
  const calls: Calls = {
    enabled: 0,
    session: 0,
    entitlement: 0,
    thread: 0,
    profile: 0,
    quota: 0,
    locale: 0,
    understand: 0,
    snapshot: 0,
    events: 0,
    knowledge: 0,
    reply: 0,
    entitlementTiers: [],
    threadChecks: [],
    profileUsers: [],
    quotaRequests: [],
    understandRequests: [],
    snapshotRequests: [],
    eventsRequests: [],
    knowledgeRequests: [],
  };
  const atRetrieval: Fake['atRetrieval'] = [];
  const now = options.now ?? (world.slot + 120) * 1000;

  const gate: GatePorts = {
    enabled: () => {
      calls.enabled += 1;
      return options.enabled ?? true;
    },
    session: {
      current: async () => {
        calls.session += 1;
        if (options.session === 'THROWS') throw new Error('session store down');
        if (options.session === undefined) {
          return { userId: 'user-pro-1', tier: 'PRO' };
        }
        return options.session;
      },
    },
    entitlement: {
      allows: (tier) => {
        calls.entitlement += 1;
        calls.entitlementTiers.push(tier);
        if (options.entitlement === 'THROWS')
          throw new Error('entitlements down');
        return options.entitlement ?? true;
      },
    },
    thread: {
      check: async (check) => {
        calls.thread += 1;
        calls.threadChecks.push(check);
        if (options.thread === 'THROWS') throw new Error('threads down');
        return options.thread === 'INVALID'
          ? { ok: false }
          : { ok: true, threadId: check.threadId };
      },
    },
    profile: {
      read: async (userId) => {
        calls.profile += 1;
        calls.profileUsers.push(userId);
        if (options.profile === 'THROWS') throw new Error('profiles down');
        const given = options.profile;
        if (given === undefined) return { ok: true, profile: PROFILE };
        if ('ok' in given) return given;
        return { ok: true, profile: given };
      },
    },
    quota: {
      precheck: async (request) => {
        calls.quota += 1;
        calls.quotaRequests.push(request);
        if (options.quota === 'THROWS') throw new Error('quota down');
        return { allowed: options.quota ?? true };
      },
    },
  };

  const understand: UnderstandPort = {
    understand: async (request) => {
      calls.understand += 1;
      calls.understandRequests.push(request);
      const given = options.understand;
      if (isPort(given)) return given.understand(request);
      if (given === undefined) {
        const { question } = JSON.parse(request.user) as { question: string };
        return echoResult(question, 'DIRECTION');
      }
      return given;
    },
  };

  const ports: IntakePorts = {
    gate,
    interfaceLocale: async () => {
      calls.locale += 1;
      if (options.locale === 'THROWS') throw new Error('cookies unavailable');
      return options.locale === undefined ? 'en-US' : options.locale;
    },
    reply: (code, locale, params) => {
      calls.reply += 1;
      return (options.reply ?? replyText)(code, locale, params);
    },
    understand,
    snapshot: async (request) => {
      calls.snapshot += 1;
      calls.snapshotRequests.push(request);
      return options.snapshot !== undefined
        ? options.snapshot(request)
        : readSnapshot(request, deps);
    },
    events: async (request): Promise<EventsRead> => {
      calls.events += 1;
      calls.eventsRequests.push(request);
      if (options.events === 'THROWS') throw new Error('calendar down');
      if (options.events === 'UNAVAILABLE') {
        return {
          events: {
            status: 'UNAVAILABLE',
            calendar_age_seconds: null,
            scope: request.scope,
            items: [],
          },
          problems: ['the news calendar holds no row'],
        };
      }
      return {
        events: {
          status: options.events === 'LATE' ? 'LATE' : 'OK',
          calendar_age_seconds: options.events === 'LATE' ? 3_600 : 120,
          scope: request.scope,
          items: [],
        },
        problems:
          options.events === 'ROWS_LEFT_OUT' ? ['a row was left out'] : [],
      };
    },
    knowledge: {
      search: async (request) => {
        calls.knowledge += 1;
        calls.knowledgeRequests.push(request);
        atRetrieval.push({
          stages: trace === undefined ? [] : trace.stageNames,
          dataStatus: trace === undefined ? null : trace.snapshot().data_status,
        });
        const mode = options.knowledge ?? 'OK';
        if (typeof mode === 'function') return mode(request);
        if (mode === 'THROWS') throw new Error('knowledge service exploded');
        if (mode === 'UNAVAILABLE') {
          return {
            knowledge: unavailableKnowledge(),
            problems: ['KNOWLEDGE_TIMEOUT'],
          };
        }
        if (mode === 'EMPTY') {
          return {
            knowledge: {
              status: 'EMPTY',
              index_build_id: 'build-0001',
              chunks: [],
              expansions: [],
            },
            problems: [],
          };
        }
        return {
          knowledge: {
            status: 'OK',
            index_build_id: 'build-0001',
            chunks: [sampleChunk()],
            expansions: [sampleChunk('D2-MCD1-EXPANSION')],
          },
          problems: [],
        };
      },
    },
    now: () => now,
  };
  return { ports, calls, world, atRetrieval };
}

/** A recorder on a clock that moves five milliseconds at every reading, so a test can read the stage times. */
export function newTrace(route: 'typed' | 'instant' = 'typed'): TraceRecorder {
  let t = 1_000;
  return new TraceRecorder({
    requestId: 'req-test-0001',
    route,
    method: 'POST',
    startedAt: '2026-10-13T00:00:00.000Z',
    clock: () => {
      t += 5;
      return t;
    },
  });
}

export const typed = (
  question: string,
  threadId: string | null = null
): IntakeRequest => ({ kind: 'TYPED', question, threadId });

export const instant = (
  intent: 'INSTANT_M5_INSPECT' | 'INSTANT_M15_INSPECT',
  threadId: string | null = null
): IntakeRequest => ({ kind: 'INSTANT', intent, threadId });

export interface Run {
  result: IntakeResult<RequestFailure>;
  trace: IntakeTrace;
  recorder: TraceRecorder;
  fake: Fake;
  /** how many times the request reader was called */
  reads: number;
}

/** Run a request through `runIntake` over fake ports. */
export async function run(
  request: IntakeRequest | { failure: RequestFailure },
  options: FakeOptions2 = {}
): Promise<Run> {
  const recorder = newTrace(
    'kind' in request && request.kind === 'INSTANT' ? 'instant' : 'typed'
  );
  const fake = makeFake(options, recorder);
  let reads = 0;
  const result = await runIntake<RequestFailure>(
    fake.ports,
    recorder,
    async () => {
      reads += 1;
      return 'failure' in request
        ? { ok: false, failure: request.failure }
        : { ok: true, request };
    }
  );
  return { result, trace: recorder.snapshot(), recorder, fake, reads };
}
