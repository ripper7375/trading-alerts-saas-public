/**
 * Intake packets made from the signed-off golden cycles (the three real ones, 01 to 03,
 * and the thirteen synthetic ones). Nothing here invents a reading: the sensor envelopes,
 * the SYN readings, the zones and their hashes are the files Davin approved, read through
 * the helper the Engine 4 tests use. What the golden files do not hold (the question, the
 * knowledge pack, the calendar) is a fixed sample, the same for every packet.
 */

import { readFileSync } from 'fs';
import { join } from 'path';

import {
  INTAKE_VERSION,
  PACKET_SYMBOL,
  ROUTING_VERSION,
  SENSOR_ROSTER,
  boardSensors,
  deriveTrace,
  replyLocale,
  type BoardSensorLine,
  type IntakePacket,
  type KnowledgeChunk,
  type PacketBody,
  type PacketIntent,
  type PacketQuestion,
  type TraderType,
} from '@/lib/intake';

import {
  WORKER,
  loadGoldens,
  slotSeconds,
  type Golden,
} from '../../engine4/helpers/stored';

export const GOLDENS: Golden[] = loadGoldens();

export const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

interface ReadingExtras {
  reading_sha256: string;
  zones_sha256: string;
  zones_reason: string | null;
}

function extrasOf(goldenId: string): Record<string, ReadingExtras> {
  const expected = JSON.parse(
    readFileSync(join(WORKER, 'golden', goldenId, 'expected.json'), 'utf8')
  ) as {
    synthesis: {
      readings: ({ profile: string } & ReadingExtras)[];
    };
  };
  const out: Record<string, ReadingExtras> = {};
  for (const reading of expected.synthesis.readings) {
    out[reading.profile] = {
      reading_sha256: reading.reading_sha256,
      zones_sha256: reading.zones_sha256,
      zones_reason: reading.zones_reason,
    };
  }
  return out;
}

/** `2026-09-18T20:55Z` five minutes earlier: the slot of the last closed M5 bar. */
export function previousSlot(slot: string): string {
  const earlier = new Date((slotSeconds(slot) - 300) * 1000).toISOString();
  return `${earlier.slice(0, 16)}Z`;
}

const SAMPLE_CHUNKS: KnowledgeChunk[] = [
  {
    id: 'D2-MCD1-UP_IN_CORRIDOR',
    domain: 'D2',
    mcd_id: 'MCD1',
    state_codes: ['MCD1_UP_IN_CORRIDOR'],
    timeframe: 'M15',
    version: '1.0.0',
    text: 'TEST ONLY. The M15 channel slopes up and the latest closed bar is inside the corridor.',
  },
  {
    id: 'D1-LEVELS',
    domain: 'D1',
    mcd_id: null,
    state_codes: [],
    timeframe: null,
    version: '1.0.0',
    text: 'TEST ONLY. UOEDT is the upper edge of the corridor; LOEDT is the lower edge.',
  },
];

export interface PacketOptions {
  traderType?: TraderType;
  intent?: PacketIntent;
  /** the sensors given in full; by default every sensor of the board that has a reading */
  mStar?: string[];
  question?: Partial<PacketQuestion>;
  interfaceLocale?: string;
}

const TYPED_INTENTS: readonly string[] = [
  'DIRECTION',
  'ENTRY_TIMING',
  'EXIT_TARGETS',
  'RISK_SIZING',
  'EXPLAIN',
  'NEWS',
  'REPORT_2',
];

/** A packet for `golden`, valid by construction. Tests break copies of it. */
export function packetFromGolden(
  golden: Golden,
  options: PacketOptions = {}
): IntakePacket {
  const traderType = options.traderType ?? 'DAY_TRADER';
  const intent = options.intent ?? 'DIRECTION';
  const instant = !TYPED_INTENTS.includes(intent);
  const interfaceLocale = options.interfaceLocale ?? 'en-US';

  const onBoard = new Set(boardSensors().map((sensor) => sensor.mcd_id));
  const lines: BoardSensorLine[] = [];
  const envelopes = new Map<
    string,
    { sha: string; envelope: Record<string, unknown> }
  >();
  for (const stored of golden.sensors) {
    if (!onBoard.has(stored.mcd_id)) continue;
    const envelope = JSON.parse(stored.envelope_json) as Record<
      string,
      unknown
    >;
    lines.push({
      mcd_id: stored.mcd_id,
      status: stored.status as BoardSensorLine['status'],
      state_code: (envelope['state_code'] as string | null) ?? null,
      bias: (envelope['bias'] as BoardSensorLine['bias']) ?? null,
      summary: (envelope['summary_line'] as string | undefined) ?? null,
      reasons: envelope['status_reasons'] as string[],
    });
    envelopes.set(stored.mcd_id, {
      sha: stored.envelope_sha256,
      envelope,
    });
  }
  const mStar =
    intent === 'REPORT_2'
      ? []
      : (options.mStar ?? lines.map((line) => line.mcd_id));

  const syn = golden.readings.find((r) => r.profile === traderType);
  if (syn === undefined)
    throw new Error(`no ${traderType} reading in ${golden.id}`);
  const reading = syn.reading;
  const extras = extrasOf(golden.id)[traderType];
  if (extras === undefined) throw new Error('no stored hashes');

  const original = instant ? null : 'Where should I enter gold now?';
  const language = instant ? 'en' : 'en';
  const question: PacketQuestion = {
    source: instant ? 'INSTANT' : 'TYPED',
    original,
    english: instant
      ? 'Explain the current reading for gold and what it implies for the trader type'
      : 'Where should I enter gold now?',
    language,
    interface_locale: interfaceLocale,
    reply_locale: replyLocale(language, interfaceLocale),
    flags: [],
    ...options.question,
  };

  const body: PacketBody = {
    schema: 'intake-packet/1',
    symbol: PACKET_SYMBOL,
    thread_id: null,
    question,
    intent,
    profile: {
      trader_type: traderType,
      style: 'BOTH',
      max_risk_pct: '1.5',
      max_leverage: '1.5',
      target_rrr: '2',
      min_sld: '5',
    },
    data: {
      status: 'FRESH',
      retuning: false,
      cycle_slot: golden.slot,
      last_price:
        golden.referencePrice === null
          ? null
          : {
              price: golden.referencePrice,
              timeframe: 'M5',
              bar: previousSlot(golden.slot),
            },
      flags: lines.length === 0 ? ['SENSORS_NOT_LIVE'] : [],
    },
    board: {
      syn: {
        state: 'RUNNING',
        status: reading['status'] as 'VALID',
        rule_id: reading['rule_id'] as string,
        bias: reading['bias'] as 'LONG',
        trend_relation: reading['trend_relation'] as 'COUNTER_TREND' | null,
        summary: reading['summary_line'] as string,
      },
      sensors: lines,
    },
    readings: {
      m_star: mStar,
      sensors: mStar.map((id) => {
        const found = envelopes.get(id);
        if (found === undefined) throw new Error(`no reading for ${id}`);
        return {
          mcd_id: id,
          envelope_sha256: found.sha,
          envelope: found.envelope,
        };
      }),
      synthesis:
        intent === 'REPORT_2'
          ? null
          : {
              profile: traderType,
              reading_sha256: extras.reading_sha256,
              reading,
              zones_sha256: extras.zones_sha256,
              zones_reason: extras.zones_reason,
              zones: syn.zones,
            },
    },
    knowledge:
      intent === 'REPORT_2'
        ? null
        : {
            status: 'OK',
            index_build_id: 'build-0001',
            chunks: clone(SAMPLE_CHUNKS),
            expansions: [],
          },
    events: {
      status: 'OK',
      calendar_age_seconds: 120,
      scope: intent === 'NEWS' ? 'UPCOMING_ALL' : 'NEXT_24H_HIGH',
      items: [
        {
          event_id: 'EV-CPI-US',
          name: 'CPI (Consumer Price Index)',
          time: '2026-09-18T21:30:00Z',
          currency: 'USD',
          importance: 'HIGH',
          approximate: false,
          tier1: true,
        },
      ],
    },
  };

  return clone({
    ...body,
    trace: deriveTrace(body, {
      intake: INTAKE_VERSION,
      routing: ROUTING_VERSION,
    }),
  });
}

/** Every golden for both trader types: 32 packets, each for the intent it suits. */
export function allGoldenPackets(): {
  name: string;
  packet: IntakePacket;
}[] {
  const out: { name: string; packet: IntakePacket }[] = [];
  for (const golden of GOLDENS) {
    for (const traderType of ['DAY_TRADER', 'SCALPER'] as const) {
      out.push({
        name: `${golden.id} ${traderType}`,
        packet: packetFromGolden(golden, { traderType }),
      });
    }
  }
  return out;
}

export function roster() {
  return SENSOR_ROSTER;
}
