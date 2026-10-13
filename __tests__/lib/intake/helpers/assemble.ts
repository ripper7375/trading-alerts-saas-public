/**
 * Run a stored world through the whole of part 4 and put the result in a packet:
 * reader -> board -> router -> `intake-packet/1` -> the validator of part 1.
 *
 * This is the smallest honest version of what the pipeline of part 5 will do with these
 * pieces, kept in the tests: the packet's knowledge pack and events are fixed samples (the
 * knowledge service and the calendar belong to other parts); everything that part 4 owns, the
 * data status, the board, M* and the readings given in full, comes from the real code. If a
 * board line disagreed with the envelope it summarises, or M* named a sensor the board does
 * not list, the validator would refuse the packet here.
 */

import {
  INTAKE_VERSION,
  PACKET_SYMBOL,
  ROUTING_VERSION,
  buildBoard,
  deriveTrace,
  isInstantIntent,
  replyLocale,
  route,
  validatePacket,
  type BoardResult,
  type Intent,
  type IntakePacket,
  type PacketBody,
  type PacketIntent,
  type PacketValidation,
  type Roster,
  type Route,
  type Timeframe,
  type TraderType,
} from '@/lib/intake';
import { readSnapshot, type Snapshot } from '@/lib/intake/read/snapshot';

import { clone } from './packets';
import {
  depsFor,
  type World,
  type FakeOptions,
  type GatewayStatus,
} from './world';

export interface RunOptions extends FakeOptions {
  roster?: Roster;
  gateway?: GatewayStatus | 'THROWS';
  retuning?: boolean;
  noCycle?: boolean;
  termIds?: string[];
  timeframes?: Timeframe[];
}

export interface Run {
  snapshot: Snapshot;
  board: BoardResult;
  route: Route;
  /** null for OUT_OF_SCOPE, which never gets a packet */
  body: PacketBody | null;
  packet: IntakePacket | null;
  validation: PacketValidation | null;
}

const TYPED_QUESTION = 'Where should I enter gold now?';
const INSTANT_QUESTION =
  'Explain the current reading for gold and what it implies for the trader type';

export async function runWorld(
  world: World,
  traderType: TraderType,
  intent: Intent,
  options: RunOptions = {}
): Promise<Run> {
  const { deps } = depsFor(world, options);
  const snapshot = await readSnapshot(
    {
      traderType,
      ...(options.roster === undefined ? {} : { roster: options.roster }),
    },
    deps
  );
  const sensors = Object.fromEntries(
    Object.entries(snapshot.rows).map(([id, row]) => [id, row.facts])
  );
  const board = buildBoard({
    traderType,
    liveIds: snapshot.live_ids,
    sensors,
    synthesis: snapshot.synthesis?.facts ?? null,
    data: {
      status: snapshot.data.status,
      retuning: snapshot.data.retuning,
      cycle_slot: snapshot.data.cycle_slot,
      last_price: snapshot.data.last_price,
    },
  });
  const routed = route({
    intent,
    traderType,
    liveIds: snapshot.live_ids,
    sensors,
    synthesis: snapshot.synthesis?.facts ?? null,
    ...(options.termIds === undefined ? {} : { termIds: options.termIds }),
    ...(options.timeframes === undefined
      ? {}
      : { timeframes: options.timeframes }),
    ...(options.roster === undefined ? {} : { roster: options.roster }),
  });
  if (intent === 'OUT_OF_SCOPE') {
    return {
      snapshot,
      board,
      route: routed,
      body: null,
      packet: null,
      validation: null,
    };
  }

  const packetIntent = intent as PacketIntent;
  const instant = isInstantIntent(intent);
  const interfaceLocale = 'en-US';
  const reading = intent === 'REPORT_2' ? null : snapshot.synthesis;
  const body: PacketBody = {
    schema: 'intake-packet/1',
    symbol: PACKET_SYMBOL,
    thread_id: null,
    question: {
      source: instant ? 'INSTANT' : 'TYPED',
      original: instant ? null : TYPED_QUESTION,
      english: instant ? INSTANT_QUESTION : TYPED_QUESTION,
      language: 'en',
      interface_locale: interfaceLocale,
      reply_locale: replyLocale('en', interfaceLocale),
      flags: [],
    },
    intent: packetIntent,
    profile: {
      trader_type: traderType,
      style: 'BOTH',
      max_risk_pct: '1.5',
      max_leverage: '1.5',
      target_rrr: '2',
      min_sld: '13',
    },
    data: {
      status: snapshot.data.status,
      retuning: snapshot.data.retuning,
      cycle_slot: snapshot.data.cycle_slot,
      last_price: snapshot.data.last_price,
      flags: [...snapshot.data.flags],
    },
    board: board.board,
    readings: {
      m_star: routed.m_star,
      sensors: routed.m_star.map((id) => {
        const row = snapshot.rows[id];
        if (row === undefined) throw new Error(`no reading for ${id}`);
        return {
          mcd_id: id,
          envelope_sha256: row.envelope_sha256,
          envelope: row.envelope,
        };
      }),
      synthesis:
        reading === null
          ? null
          : {
              profile: traderType,
              reading_sha256: reading.reading_sha256,
              reading: reading.reading,
              zones_sha256: reading.zones_sha256,
              zones_reason: reading.zones_reason,
              zones: reading.zones,
            },
    },
    knowledge:
      intent === 'REPORT_2'
        ? null
        : {
            status: 'OK',
            index_build_id: 'build-0001',
            chunks: [
              {
                id: 'D1-LEVELS',
                domain: 'D1',
                mcd_id: null,
                state_codes: [],
                timeframe: null,
                version: '1.0.0',
                text: 'TEST ONLY. UOEDT is the upper edge of the corridor.',
              },
            ],
            expansions: [],
          },
    events: {
      status: 'OK',
      calendar_age_seconds: 120,
      scope: intent === 'NEWS' ? 'UPCOMING_ALL' : 'NEXT_24H_HIGH',
      items: [],
    },
  };
  const packet = clone({
    ...body,
    trace: deriveTrace(body, {
      intake: INTAKE_VERSION,
      routing: ROUTING_VERSION,
    }),
  }) as IntakePacket;
  return {
    snapshot,
    board,
    route: routed,
    body,
    packet,
    validation: validatePacket(
      packet,
      options.roster === undefined ? {} : { roster: options.roster }
    ),
  };
}
