/**
 * DEVELOPMENT ONLY (build step 6, part 5): the world the intake preview runs in.
 *
 * It is the REAL intake path over a STORED cycle: the sensors' envelopes, the synthesis readings
 * and the zones come from the signed-off golden scenarios of the Python worker
 * (`davintrade-stack-d-and-e/engine-1-5-new/mcd_worker/golden/`), read from disk, and go through
 * the real snapshot reader, board, router and packet assembly (`runIntake`). What a golden does
 * not hold is made here and LABELLED TEST: the trader's profile, the calendar (an empty one), the
 * knowledge pack (one chunk marked TEST ONLY, or an unavailable one) and the Understand answer
 * (it echoes the question with the intent the page chose; no model is called).
 *
 * Nothing is read from a database or a gateway, nothing is sent anywhere, nothing is recorded.
 * Every entry point refuses to run in a production build.
 */

import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

import type { CurrentCycleResponse } from '@/lib/active-indicator/gateway-client';
import {
  LOCALES,
  TraceRecorder,
  buildBoard,
  runIntake,
  unavailablePack,
  type IntakePorts,
  type IntakeResult,
  type IntakeTrace,
  type TraderType,
  type UnderstandIntent,
} from '@/lib/intake';
import {
  readSnapshot,
  type EntryZoneRow,
  type McdOutputRow,
  type SnapshotClient,
  type SnapshotDeps,
  type SynthesisReadingRow,
} from '@/lib/intake/read/snapshot';
import { replyText } from '@/lib/intake/server/reply';
import type { RequestFailure } from '@/lib/intake/server/errors';

const WORKER = join(
  process.cwd(),
  'davintrade-stack-d-and-e',
  'engine-1-5-new',
  'mcd_worker'
);
const GOLDEN = join(WORKER, 'golden');

export const GATEWAY_STATES = [
  'FRESH',
  'DELAYED',
  'STALE',
  'MARKET_CLOSED',
  'UNREACHABLE',
] as const;
export type GatewayState = (typeof GATEWAY_STATES)[number];

export const REQUEST_KINDS = [
  'TYPED',
  'INSTANT_M5_INSPECT',
  'INSTANT_M15_INSPECT',
] as const;
export type RequestKindChoice = (typeof REQUEST_KINDS)[number];

export const TYPED_INTENTS: readonly UnderstandIntent[] = [
  'DIRECTION',
  'ENTRY_TIMING',
  'EXIT_TARGETS',
  'RISK_SIZING',
  'EXPLAIN',
  'NEWS',
  'REPORT_2',
  'OUT_OF_SCOPE',
];

export const TRADERS: readonly TraderType[] = ['DAY_TRADER', 'SCALPER'];

export interface PreviewParams {
  scenario: string;
  trader: TraderType;
  kind: RequestKindChoice;
  /** what the (fake) Understand step says the typed question is */
  intent: UnderstandIntent;
  question: string;
  locale: string;
  gateway: GatewayState;
  knowledge: 'OK' | 'UNAVAILABLE';
  quota: 'ALLOW' | 'DENY';
}

export interface ScenarioInfo {
  id: string;
  title: string;
}

export interface PreviewResult {
  result: IntakeResult<RequestFailure>;
  trace: IntakeTrace;
  /** the board as a prompt shows it, or null when no cycle could be read */
  boardLines: string[] | null;
}

function refuseInProduction(): void {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('the intake preview does not run in production');
  }
}

const readJson = (path: string): Record<string, any> =>
  JSON.parse(readFileSync(path, 'utf8')) as Record<string, any>;

function slotSeconds(iso: string): number {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})Z$/.exec(iso);
  if (match === null) throw new Error(`not a cycle slot: ${iso}`);
  const part = (i: number): number => Number(match[i]);
  return Date.UTC(part(1), part(2) - 1, part(3), part(4), part(5)) / 1000;
}

export function listScenarios(): ScenarioInfo[] {
  refuseInProduction();
  return readdirSync(GOLDEN)
    .sort()
    .filter((name) => /^\d\d-/.test(name))
    .map((id) => ({
      id,
      title: String(readJson(join(GOLDEN, id, 'scenario.json'))['title']),
    }));
}

interface StoredWorld {
  slot: number;
  sensors: McdOutputRow[];
  synthesis: (SynthesisReadingRow & { profile: string })[];
}

function loadWorld(id: string): StoredWorld {
  const name = readdirSync(GOLDEN).find((entry) => entry === id);
  if (name === undefined) throw new Error(`no golden scenario ${id}`);
  const expected = readJson(join(GOLDEN, name, 'expected.json'));
  const referencePrice =
    typeof expected['reference_price'] === 'number'
      ? (expected['reference_price'] as number)
      : null;
  return {
    slot: slotSeconds(String(expected['cycle_slot'])),
    sensors: (expected['sensors'] as any[]).map((s) => ({
      mcd_id: s.mcd_id,
      flag: 'live',
      status: s.status,
      envelope_json: s.envelope_json,
      envelope_sha256: s.envelope_sha256,
    })),
    synthesis: (expected['synthesis'].readings as any[]).map((r) => ({
      profile: r.profile,
      flag: 'live',
      reading_json: r.reading_json,
      reading_sha256: r.reading_sha256,
      zone_count: (JSON.parse(r.zones_json) as unknown[]).length,
      zones_reason: r.zones_reason,
      zones_json: r.zones_json,
      zones_sha256: r.zones_sha256,
      reference_price: referencePrice,
    })),
  };
}

function zoneRows(zonesJson: string): EntryZoneRow[] {
  return (JSON.parse(zonesJson) as Record<string, unknown>[]).map((doc) => ({
    zone_id: doc['zone_id'] as string,
    rank: doc['rank'] as number,
    bias: doc['bias'] as string,
    low: doc['low'] as number,
    high: doc['high'] as number,
    reference_price: doc['reference_price'] as number,
  }));
}

function snapshotDeps(world: StoredWorld, gateway: GatewayState): SnapshotDeps {
  const client: SnapshotClient = {
    mcdOutput: {
      findMany: async (args) =>
        world.sensors.filter(
          (row) => args.where.cycle_slot === world.slot && row.flag === 'live'
        ),
    },
    synthesisReading: {
      findFirst: async (args) => {
        const found = world.synthesis.find(
          (row) =>
            args.where.cycle_slot === world.slot &&
            row.profile === args.where.profile
        );
        if (found === undefined) return null;
        const { profile: _profile, ...row } = found;
        return row;
      },
    },
    entryZone: {
      findMany: async (args) => {
        const found = world.synthesis.find(
          (row) => row.profile === args.where.profile
        );
        return found === undefined ? [] : zoneRows(found.zones_json);
      },
    },
    marketCycle: { findFirst: async () => ({ slot: world.slot }) },
  };
  return {
    client,
    fetchCurrentCycle: async (): Promise<CurrentCycleResponse> => {
      if (gateway === 'UNREACHABLE') {
        throw Object.assign(new Error('the gateway could not be reached'), {
          kind: 'UNREACHABLE',
        });
      }
      return {
        contract: 'cycles-current/1',
        now: world.slot + 120,
        cycle: {
          slot: world.slot,
          status: gateway === 'DELAYED' ? 'DELAYED' : 'FRESH',
          attempts: 1,
          retuning: false,
          closedBarsDigest: null,
          checkReason: null,
          timings: {
            readyAt: world.slot + 20,
            manifestReceivedAt: world.slot + 10,
            slotToReadySec: 20,
            gatewaySec: 10,
            collectorStartedAt: null,
            collectorValidatedAt: null,
            m5ExportAt: null,
            m15ExportAt: null,
          },
        },
        dataStatus: {
          status: gateway,
          reason: 'preview',
          dataAsOfSlot: world.slot,
          secondsSinceReady: 100,
        },
        activeIndicators: {
          resolvedAtSlot: world.slot,
          basis: 'CYCLE',
          byTimeframe: { M5: null, M15: null },
        },
      };
    },
  };
}

/** TEST profile: not a claim about any trader. */
const PREVIEW_PROFILE = {
  style: 'BOTH' as const,
  max_risk_pct: '1.5',
  max_leverage: '5',
  target_rrr: '1.75',
  min_sld: '13',
};

export async function buildPreview(
  params: PreviewParams
): Promise<PreviewResult> {
  refuseInProduction();
  const world = loadWorld(params.scenario);
  const deps = snapshotDeps(world, params.gateway);
  const locale = (LOCALES as readonly string[]).includes(params.locale)
    ? params.locale
    : 'en-US';
  const now = (world.slot + 120) * 1000;

  const ports: IntakePorts = {
    gate: {
      enabled: () => true,
      session: {
        current: async () => ({ userId: 'preview-user', tier: 'PRO' }),
      },
      entitlement: { allows: () => true },
      thread: { check: async ({ threadId }) => ({ ok: true, threadId }) },
      profile: {
        read: async () => ({
          ok: true,
          profile: { trader_type: params.trader, ...PREVIEW_PROFILE },
        }),
      },
      quota: { precheck: async () => ({ allowed: params.quota === 'ALLOW' }) },
    },
    interfaceLocale: async () => locale,
    reply: replyText,
    understand: {
      // no model is called: the answer echoes the question with the intent the page chose
      understand: async (request) => ({
        schema: 'understand-result/1',
        language: locale.split('-')[0] === 'zh' ? locale : locale.split('-')[0],
        english: (JSON.parse(request.user) as { question: string }).question,
        intent: params.intent,
        symbols: ['XAUUSD'],
        timeframes: [],
      }),
    },
    snapshot: (request) => readSnapshot(request, deps),
    events: async ({ scope }) => ({
      events: {
        status: 'OK',
        calendar_age_seconds: 120,
        scope,
        items: [],
      },
      problems: [],
    }),
    knowledge: {
      search: async () =>
        params.knowledge === 'UNAVAILABLE'
          ? { knowledge: unavailablePack(), problems: ['KNOWLEDGE_TIMEOUT'] }
          : {
              knowledge: {
                status: 'OK',
                index_build_id: 'preview-build',
                chunks: [
                  {
                    id: 'TEST-ONLY-D1',
                    domain: 'D1',
                    mcd_id: null,
                    state_codes: [],
                    timeframe: null,
                    version: '0.0.0',
                    text: 'TEST ONLY. This chunk stands where the knowledge service would answer.',
                  },
                ],
                expansions: [],
              },
              problems: [],
            },
    },
    now: () => now,
  };

  const trace = new TraceRecorder({
    requestId: 'preview-request',
    route: params.kind === 'TYPED' ? 'typed' : 'instant',
    method: 'POST',
    startedAt: new Date(now).toISOString(),
    clock: () => now,
  });
  const result = await runIntake<RequestFailure>(ports, trace, async () =>
    params.kind === 'TYPED'
      ? {
          ok: true,
          request: {
            kind: 'TYPED',
            question: params.question,
            threadId: null,
          },
        }
      : {
          ok: true,
          request: { kind: 'INSTANT', intent: params.kind, threadId: null },
        }
  );

  const snapshot = await readSnapshot({ traderType: params.trader }, deps);
  const boardLines =
    snapshot.data.cycle_slot === null
      ? null
      : buildBoard({
          traderType: params.trader,
          liveIds: snapshot.live_ids,
          sensors: Object.fromEntries(
            Object.entries(snapshot.rows).map(([id, row]) => [id, row.facts])
          ),
          synthesis: snapshot.synthesis?.facts ?? null,
          data: {
            status: snapshot.data.status,
            retuning: snapshot.data.retuning,
            cycle_slot: snapshot.data.cycle_slot,
            last_price: snapshot.data.last_price,
          },
        }).lines;
  return { result, trace: trace.snapshot(), boardLines };
}
