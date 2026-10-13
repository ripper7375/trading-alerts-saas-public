/**
 * The orchestrator (architecture 4.2 steps 1 to 8, plan part 5, decisions D4, D9 and D10).
 *
 * `runIntake` takes one request from the gate to an `intake-packet/1` or an `intake-refusal/1`,
 * over ports, so every neighbour that is not built yet (the quota, the chat threads, the
 * model gateway) and every edge (the session, a database, the network) is a thing a test
 * can replace and COUNT:
 *
 *   1  Gate       `runGate`: flag, session, tier, [the request is read], thread, profile, quota
 *   2  Understand typed only: the door, then the one model call (`runUnderstand`)
 *   3  Scope      typed only: another symbol or timeframe is a fixed reply, and nothing else runs
 *   4  Snapshot   the cycle, the live sensors, the trader's synthesis reading, the data status
 *      (the data block is built NOW, a STALE or UNKNOWN status said in it, before anything is
 *       assembled: architecture 4.11 item 8)
 *   5  Board      `buildBoard`: every live sensor, unavailable ones listed
 *   6  Route      `route`: M* = ALWAYS u EXTRA(intent)
 *   7  Retrieve   the knowledge service, unless Report 2; a failure is an UNAVAILABLE pack
 *   8  Hand on    the packet, checked by `validatePacket`, fingerprinted, with its trace
 *
 * The INSTANT path (Panel C) passes the gate like any question and skips steps 2 and 3: its
 * intent is its label, its language is the interface setting's, and its question is the fixed
 * English one of decision D10 (a), the only thing retrieval reads (no typed text exists).
 *
 * What the proofs of 4.11 rest on: a request refused at the gate or at the scope check never
 * reaches a later port (the pipeline returns at once), and a refusal charges nothing (the
 * quota is a pre-check; nothing here charges). The interface locale comes from a port, so the
 * language of a refusal is the language of the interface and never something the body said.
 *
 * Pure: no I/O of its own, no clock (`ports.now`), no randomness.
 *
 * @module lib/intake/pipeline
 */

import { buildBoard } from './board';
import {
  runGate,
  type GateCaller,
  type GatePorts,
  type RequestRead,
} from './gate';
import {
  isPacketIntent,
  type InstantIntent,
  type PacketIntent,
} from './intents';
import type { KnowledgePort, KnowledgeRequest } from './knowledge-client';
import {
  DEFAULT_LOCALE,
  familyOfLocale,
  isLocale,
  replyLocale,
  type Locale,
} from './locales';
import { INTAKE_PACKET_SCHEMA, INTAKE_VERSION } from './version';
import {
  PACKET_SYMBOL,
  QUESTION_MAX_CHARS,
  deriveTrace,
  packetSha256,
  validatePacket,
  type EventsScope,
  type Knowledge,
  type PacketData,
  type PacketEvents,
  type PacketBody,
  type PacketQuestion,
  type Readings,
  type IntakePacket,
} from './packet';
import type { Issue } from './check';
import type { EventsRead } from './read/events';
import type { Snapshot } from './read/snapshot';
import {
  buildRefusal,
  validateRefusal,
  type IntakeRefusal,
  type RefusalCode,
} from './refusal';
import type { Timeframe, TraderType } from './roster';
import { route, type Route } from './router';
import { intakeText, refusalTextKey, type TextParams } from './text';
import { spotTerms } from './text/glossary';
import { passTheDoor } from './text/limits';
import { checkScope } from './text/scope';
import { runUnderstand, type UnderstandPort } from './text/understand';
import type { TraceRecorder } from './trace';

// ---------------------------------------------------------------------------
// The request and the result
// ---------------------------------------------------------------------------

export type IntakeRequest =
  | { kind: 'TYPED'; question: string; threadId: string | null }
  | { kind: 'INSTANT'; intent: InstantIntent; threadId: string | null };

export type IntakeResult<F> =
  /** the flag is off: the routes do not exist */
  | { kind: 'DISABLED' }
  /** the body could not be read: the route's own failure */
  | { kind: 'REQUEST_FAILED'; failure: F }
  | { kind: 'REFUSED'; refusal: IntakeRefusal }
  | { kind: 'PACKET'; packet: IntakePacket; packet_sha256: string };

/** A packet the validator refused: a defect on our side, never the trader's. Carries paths and codes, not values. */
export class PacketInvalidError extends Error {
  constructor(readonly issues: Issue[]) {
    super(
      `the packet failed its own validator: ${issues
        .slice(0, 5)
        .map((issue) => `${issue.path} ${issue.code}`)
        .join('; ')}`
    );
    this.name = 'PacketInvalidError';
  }
}

// ---------------------------------------------------------------------------
// The ports
// ---------------------------------------------------------------------------

export interface IntakePorts {
  gate: GatePorts;
  /** the interface setting the server reads (a cookie), never anything the body says */
  interfaceLocale(): Promise<string | null | undefined>;
  /** the fixed reply to a refusal, in a locale (the `intake.refusal.*` keys of the 19 dictionaries) */
  reply(code: RefusalCode, locale: Locale, params?: TextParams): string;
  understand: UnderstandPort;
  snapshot(request: { traderType: TraderType }): Promise<Snapshot>;
  events(request: {
    nowSeconds: number;
    scope: EventsScope;
  }): Promise<EventsRead>;
  knowledge: KnowledgePort;
  /** milliseconds since the epoch */
  now(): number;
}

// ---------------------------------------------------------------------------
// Pieces the tests hold on their own
// ---------------------------------------------------------------------------

/**
 * The fixed English question of each instant label (decision D10 (a)). Retrieval reads it as
 * the English pivot; nothing the trader typed is involved.
 */
export const INSTANT_QUESTIONS: Readonly<Record<InstantIntent, string>> = {
  INSTANT_M5_INSPECT:
    'Explain the current M5 reading for gold and what it implies for the trader type',
  INSTANT_M15_INSPECT:
    'Explain the current M15 reading for gold and what it implies for the trader type',
};

/** The News intent gets every upcoming release; every other intent the next day's high-impact ones (D9 b). */
export function eventsScopeOf(intent: PacketIntent): EventsScope {
  return intent === 'NEWS' ? 'UPCOMING_ALL' : 'NEXT_24H_HIGH';
}

/**
 * The data block of the packet, from the snapshot. It is built before the board, the route,
 * the retrieval or the assembly, so a STALE or UNKNOWN status is in the packet's `data` before
 * anything else is made (4.11 item 8).
 */
export function packetData(snapshot: Snapshot): PacketData {
  return {
    status: snapshot.data.status,
    retuning: snapshot.data.retuning,
    cycle_slot: snapshot.data.cycle_slot,
    last_price: snapshot.data.last_price,
    flags: [...snapshot.data.flags],
  };
}

/** The state codes of the sensors given in full, in the order of M*: what the retrieval query is built from (4.7). */
export function stateCodesOf(
  m_star: readonly string[],
  snapshot: Snapshot
): string[] {
  const codes: string[] = [];
  for (const id of m_star) {
    const code = snapshot.rows[id]?.facts.state_code ?? null;
    if (code !== null && !codes.includes(code)) codes.push(code);
  }
  return codes;
}

/** The readings of M* in full, as the packet carries them; Report 2 carries none (Section 6 reads the pinned cycle). */
export function packetReadings(
  intent: PacketIntent,
  routed: Route,
  snapshot: Snapshot,
  traderType: TraderType
): Readings {
  const reading = intent === 'REPORT_2' ? null : snapshot.synthesis;
  return {
    m_star: [...routed.m_star],
    sensors: routed.m_star.map((id) => {
      const row = snapshot.rows[id];
      if (row === undefined) {
        // the router only names a sensor that has a reading
        throw new Error(
          `the router named ${id} but the snapshot has no reading for it`
        );
      }
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
  };
}

export function unavailablePack(): Knowledge {
  return {
    status: 'UNAVAILABLE',
    index_build_id: null,
    chunks: [],
    expansions: [],
  };
}

// ---------------------------------------------------------------------------
// The run
// ---------------------------------------------------------------------------

export async function runIntake<F>(
  ports: IntakePorts,
  trace: TraceRecorder,
  readRequest: (caller: GateCaller) => Promise<RequestRead<IntakeRequest, F>>
): Promise<IntakeResult<F>> {
  /**
   * The interface setting. It is read at most once per request, at the one place that needs it
   * (the gate's refusal, or the first thing after the gate), and never when the flag is off.
   */
  const interfaceLocale = async (): Promise<Locale> => {
    let found: unknown;
    try {
      found = await ports.interfaceLocale();
    } catch {
      trace.problem('INTERFACE_LOCALE_ERROR');
    }
    const locale = isLocale(found) ? found : DEFAULT_LOCALE;
    trace.set({ interface_locale: locale });
    return locale;
  };

  const refuse = (
    code: RefusalCode,
    inLocale: Locale,
    params?: TextParams
  ): IntakeResult<F> => {
    let refusal = buildRefusal(
      code,
      inLocale,
      ports.reply(code, inLocale, params)
    );
    if (!validateRefusal(refusal).ok) {
      // a reply that fails its own validator is a defect in a translation; English is better than nothing
      trace.problem('REPLY_INVALID');
      refusal = buildRefusal(
        code,
        DEFAULT_LOCALE,
        intakeText(refusalTextKey(code), params)
      );
    }
    trace.recordRefusal(refusal);
    return { kind: 'REFUSED', refusal };
  };

  // 1. the gate
  const gate = await trace.stage('GATE', () =>
    runGate<IntakeRequest, F>(ports.gate, readRequest)
  );
  if (!gate.ok) {
    if (gate.kind === 'DISABLED') {
      trace.set({ outcome: 'DISABLED' });
      return { kind: 'DISABLED' };
    }
    if (gate.kind === 'REQUEST') {
      trace.set({ outcome: 'REQUEST_FAILED', tier: gate.tier });
      return { kind: 'REQUEST_FAILED', failure: gate.failure };
    }
    trace.set({ tier: gate.tier });
    trace.problems(
      gate.problems.map((problem) => problem.split(':')[0] as string)
    );
    return refuse(gate.code, await interfaceLocale());
  }
  trace.set({ tier: gate.caller.tier });
  const ui = await interfaceLocale();
  const request = gate.request;
  const traderType = gate.profile.trader_type;

  // 2 and 3. the typed question is read and held to the scope; an instant prompt has neither
  let question: PacketQuestion;
  let intent: PacketIntent;
  let termIds: string[] = [];
  let timeframes: Timeframe[] | undefined;
  if (request.kind === 'TYPED') {
    const door = await trace.stage('DOOR', async () =>
      passTheDoor(request.question)
    );
    if (!door.ok) {
      return refuse(
        door.code,
        ui,
        door.code === 'QUESTION_TOO_LONG'
          ? { limit: String(QUESTION_MAX_CHARS) }
          : undefined
      );
    }
    const normalized = door.question;
    const understood = await trace.stage('UNDERSTAND', async () =>
      runUnderstand(ports.understand, {
        text: normalized.text,
        hits: spotTerms(normalized.text),
      })
    );
    if (!understood.ok) {
      trace.problem(`UNDERSTAND_${understood.failure}`);
      if (understood.detail !== undefined) {
        trace.problem(`UNDERSTAND_${understood.detail}`);
      }
      return refuse('UNDERSTANDING_FAILED', ui);
    }
    const { result } = understood;
    const verdict = await trace.stage('SCOPE', async () =>
      checkScope({
        text: normalized.text,
        english: result.english,
        symbols: result.symbols,
        timeframes: result.timeframes,
        intent: result.intent,
      })
    );
    trace.set({ language: result.language });
    if (!verdict.inScope || !isPacketIntent(result.intent)) {
      trace.set({ intent: 'OUT_OF_SCOPE' });
      return refuse('OUT_OF_SCOPE', replyLocale(result.language, ui));
    }
    intent = result.intent;
    termIds = understood.preservation.checked;
    timeframes = verdict.timeframes;
    question = {
      source: 'TYPED',
      original: normalized.original,
      english: result.english,
      language: result.language,
      interface_locale: ui,
      reply_locale: replyLocale(result.language, ui),
      flags: [
        ...new Set([...understood.preservation.flags, ...normalized.flags]),
      ].sort(),
    };
  } else {
    intent = request.intent;
    const language = familyOfLocale(ui);
    trace.set({ language });
    question = {
      source: 'INSTANT',
      original: null,
      english: INSTANT_QUESTIONS[request.intent],
      language,
      interface_locale: ui,
      reply_locale: replyLocale(language, ui),
      flags: [],
    };
  }
  trace.set({ intent });

  // 4. the snapshot, and the data block before anything else is made of it
  const snapshot = await trace.stage('SNAPSHOT', () =>
    ports.snapshot({ traderType })
  );
  trace.problems(
    snapshot.problems.map((problem) => `SNAPSHOT_${problem.code}`)
  );
  const data = await trace.stage('DATA', async () => packetData(snapshot));
  trace.set({ data_status: data.status, cycle_slot: data.cycle_slot });
  if (data.status === 'STALE' || data.status === 'UNKNOWN') {
    trace.problem(`DATA_${data.status}`);
  }

  const events = await trace.stage(
    'EVENTS',
    async (): Promise<PacketEvents> => {
      const scope = eventsScopeOf(intent);
      try {
        const read = await ports.events({
          nowSeconds: Math.floor(ports.now() / 1000),
          scope,
        });
        if (read.events.status === 'UNAVAILABLE') {
          trace.problem('EVENTS_UNAVAILABLE');
        } else if (read.problems.length > 0) {
          trace.problem('EVENTS_ROWS_LEFT_OUT');
        }
        return read.events;
      } catch {
        trace.problem('EVENTS_PORT_ERROR');
        return {
          status: 'UNAVAILABLE',
          calendar_age_seconds: null,
          scope,
          items: [],
        };
      }
    }
  );

  // 5. the board
  const sensors = Object.fromEntries(
    Object.entries(snapshot.rows).map(([id, row]) => [id, row.facts])
  );
  const board = await trace.stage('BOARD', async () =>
    buildBoard({
      traderType,
      liveIds: snapshot.live_ids,
      sensors,
      synthesis: snapshot.synthesis?.facts ?? null,
      data: {
        status: data.status,
        retuning: data.retuning,
        cycle_slot: data.cycle_slot,
        last_price: data.last_price,
      },
    })
  );

  // 6. the route
  const routed = await trace.stage('ROUTE', async () =>
    route({
      intent,
      traderType,
      liveIds: snapshot.live_ids,
      sensors,
      synthesis: snapshot.synthesis?.facts ?? null,
      termIds,
      ...(timeframes === undefined ? {} : { timeframes }),
    })
  );
  trace.set({
    m_star: [...routed.m_star],
    routing_version: routed.routing_version,
  });
  trace.set({ route_notes: [...routed.notes] });

  // 7. retrieval: not for Report 2; a failure is a pack that says it is unavailable (7.6)
  let knowledge: Knowledge | null = null;
  if (intent !== 'REPORT_2') {
    const searched = await trace.stage('RETRIEVE', async () => {
      const search: KnowledgeRequest = {
        intent,
        question_en: question.english,
        m_star: [...routed.m_star],
        state_codes: stateCodesOf(routed.m_star, snapshot),
        routing_version: routed.routing_version,
      };
      try {
        return await ports.knowledge.search(search);
      } catch {
        return {
          knowledge: unavailablePack(),
          problems: ['KNOWLEDGE_PORT_ERROR'],
        };
      }
    });
    knowledge = searched.knowledge;
    trace.problems(searched.problems);
  }

  // 8. hand on
  return trace.stage('ASSEMBLE', async () => {
    const body: PacketBody = {
      schema: INTAKE_PACKET_SCHEMA,
      symbol: PACKET_SYMBOL,
      thread_id: gate.threadId,
      question,
      intent,
      profile: gate.profile,
      data,
      board: board.board,
      readings: packetReadings(intent, routed, snapshot, traderType),
      knowledge,
      events,
    };
    const packet: IntakePacket = {
      ...body,
      trace: deriveTrace(body, {
        intake: INTAKE_VERSION,
        routing: routed.routing_version,
      }),
    };
    const checked = validatePacket(packet);
    if (!checked.ok) throw new PacketInvalidError(checked.issues);
    const sha = await packetSha256(packet);
    trace.recordPacket(packet, sha);
    return { kind: 'PACKET', packet, packet_sha256: sha } as const;
  });
}
