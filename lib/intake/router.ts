/**
 * The router (architecture 4.2 step 6 and 4.5, ADR-036, ADR-040, ADR-041, plan decisions D2
 * and D10): which sensors a question needs in FULL, and which knowledge to look in.
 *
 *     M* = ALWAYS ∪ EXTRA(intent)
 *
 *  - ALWAYS is the trader type's primary sensor (read from the roster's registry rung, never
 *    named here) and every WARNING sensor (`warnings.ts`), for every intent that gives
 *    readings at all. The matrix says which do not: Report 2 and Out of scope (D2 a, g).
 *  - EXTRA is chosen by the intent's row of the dispatch matrix
 *    (`config/intake/dispatch-matrix.v1.json`, `routing-v1`) through one of five selectors,
 *    each a small rule over what the snapshot holds (D2 c, d, e and D10 b): the sensors that
 *    supplied the entry zones, the sensors with a level beyond the entry on the target side,
 *    the owners of the terms in the question, the sensors that read a timeframe's channel.
 *
 * M* only ever holds a sensor that is LIVE and has a reading for the cycle: nothing that is
 * switched off, in shadow, or missing is given in full (an ABSENT sensor has no envelope to
 * give; the board already lists it as unavailable). The primary sensor is given in full even
 * when it is INVALID or STALE: its envelope is what says why it is unavailable.
 *
 * The router never reads a database and never looks at the clock: the same input gives the
 * same route, in the same order.
 *
 * @module lib/intake/router
 */

import {
  isUsable,
  orderedMcdIds,
  type SensorFacts,
  type SynthesisFacts,
} from './facts';
import { instantTimeframe, isInstantIntent, type Intent } from './intents';
import { DISPATCH_MATRIX, matrixRow, type Matrix } from './matrix';
import type { KnowledgeDomain } from './packet';
import {
  SENSOR_ROSTER,
  boardSensors,
  primarySensors,
  type Roster,
  type Timeframe,
  type TraderType,
} from './roster';
import { GLOSSARY, termById, type Glossary } from './text/glossary';
import { findWarnings, type Warning } from './warnings';

export interface RouteInput {
  intent: Intent;
  traderType: TraderType;
  /** the sensors that have a line on the board */
  liveIds: readonly string[];
  /** what each live sensor said; a live sensor with no entry has no reading to give */
  sensors: Readonly<Record<string, SensorFacts | undefined>>;
  /** the trader's synthesis reading; null when it is not running */
  synthesis: SynthesisFacts | null;
  /** the glossary terms the question names (the Explain intent) */
  termIds?: readonly string[];
  /** the timeframes the question names; an instant label supplies its own */
  timeframes?: readonly Timeframe[];
  roster?: Roster;
  matrix?: Matrix;
  glossary?: Glossary;
}

export interface Route {
  intent: Intent;
  traderType: TraderType;
  /** the version of the matrix that routed this request (the packet's `routing_version`) */
  routing_version: string;
  /** the primary sensor(s) of the trader type (one, in a roster that has been parsed) */
  primary: string[];
  /** every warning among the live sensors, whatever the intent */
  warnings: Warning[];
  /** the ALWAYS set that applies to this intent: the primary sensor and the warnings that have a reading */
  always: string[];
  /** the sensors the intent's selector adds */
  extra: string[];
  /** the sensors given in full, in the order of the MCD number */
  m_star: string[];
  /** the knowledge domains of the intent's row, in the order D1 to D5 */
  domains: KnowledgeDomain[];
  /** the sensors whose domain-D2 playbook is searched: M*, or none (finding F6 a) */
  playbooks: string[];
  /** things a person debugging a route wants to know; never an error */
  notes: string[];
}

function timeframesOf(
  intent: Intent,
  named: readonly Timeframe[] | undefined
): Timeframe[] {
  if (isInstantIntent(intent)) return [instantTimeframe(intent)];
  return [...new Set(named ?? [])];
}

/** `ZONE_SOURCES`: the sensors that supplied the entry zones of the trader's reading (D2 d). */
function zoneSources(
  input: RouteInput,
  available: ReadonlySet<string>
): string[] {
  return (input.synthesis?.zone_sources ?? []).filter((id) =>
    available.has(id)
  );
}

/**
 * `TARGET_SIDE_LEVELS`: the sensors with a price strictly beyond the entry on the side the
 * target lies (above for a LONG, below for a SHORT) (D2 e). The entry is the first zone's
 * reference price; with no zone, the close of the reading. No direction or no entry: none.
 */
function targetSideSensors(
  input: RouteInput,
  available: ReadonlySet<string>,
  notes: string[]
): string[] {
  const bias = input.synthesis?.bias;
  if (bias !== 'LONG' && bias !== 'SHORT') {
    notes.push('NO_TARGET_SIDE');
    return [];
  }
  const entry =
    input.synthesis?.entry_price ?? input.synthesis?.reference_price ?? null;
  if (entry === null) {
    notes.push('NO_ENTRY_PRICE');
    return [];
  }
  const found: string[] = [];
  for (const id of available) {
    const facts = input.sensors[id];
    if (facts === undefined || !isUsable(facts.status)) continue;
    if (
      facts.levels.some((price) =>
        bias === 'LONG' ? price > entry : price < entry
      )
    ) {
      found.push(id);
    }
  }
  return found;
}

/**
 * `TERM_OWNERS`: for each glossary term in the question, the sensors that own it. A term
 * with one sensor owner gives that sensor. A term several sensors own (the level names are in
 * all three channel sensors) gives the primary sensor among them and the sensor of each
 * timeframe the question names, that is the owner that reads that timeframe and no other
 * (D2 c). A term owned only by the synthesis or a knowledge domain gives no sensor.
 */
function termOwners(
  input: RouteInput,
  roster: Roster,
  glossary: Glossary,
  available: ReadonlySet<string>,
  timeframes: readonly Timeframe[],
  notes: string[]
): string[] {
  const onBoard = new Map(boardSensors(roster).map((s) => [s.mcd_id, s]));
  const primary = new Set(
    primarySensors(input.traderType, roster).map((s) => s.mcd_id)
  );
  const found = new Set<string>();
  const termIds = [...new Set(input.termIds ?? [])];
  if (termIds.length === 0) notes.push('NO_TERM');
  for (const termId of termIds) {
    const term = termById(glossary, termId);
    if (term === undefined) {
      notes.push(`UNKNOWN_TERM:${termId}`);
      continue;
    }
    const owners = term.owners.filter((owner) => onBoard.has(owner));
    if (owners.length === 1) {
      found.add(owners[0] as string);
    } else if (owners.length > 1) {
      for (const owner of owners) {
        const sensor = onBoard.get(owner);
        if (sensor === undefined) continue;
        const ownTimeframe =
          sensor.timeframes.length === 1 &&
          timeframes.includes(sensor.timeframes[0] as Timeframe);
        if (primary.has(owner) || ownTimeframe) found.add(owner);
      }
    }
  }
  return [...found].filter((id) => available.has(id));
}

/** `TIMEFRAME_CHANNEL`: the sensors that read the channel of a timeframe in question (D10 b). */
function channelSensors(
  roster: Roster,
  available: ReadonlySet<string>,
  timeframes: readonly Timeframe[]
): string[] {
  return boardSensors(roster)
    .filter((sensor) =>
      sensor.uses_channel.some((tf) => timeframes.includes(tf))
    )
    .map((sensor) => sensor.mcd_id)
    .filter((id) => available.has(id));
}

/** Route a request. Never throws for a roster or matrix that parsed. */
export function route(input: RouteInput): Route {
  const roster = input.roster ?? SENSOR_ROSTER;
  const matrix = input.matrix ?? DISPATCH_MATRIX;
  const glossary = input.glossary ?? GLOSSARY;
  const row = matrixRow(input.intent, matrix);
  const notes: string[] = [];

  const live = orderedMcdIds(input.liveIds);
  // a sensor can be given in full only if it is live and has a reading for the cycle
  const available = new Set(
    live.filter((id) => input.sensors[id] !== undefined)
  );

  const primary = primarySensors(input.traderType, roster).map((s) => s.mcd_id);
  if (primary.length !== 1) notes.push(`PRIMARY_COUNT:${primary.length}`);

  const warnings = findWarnings(
    live.flatMap((id) => {
      const facts = input.sensors[id];
      return facts === undefined ? [] : [facts];
    }),
    input.synthesis?.bias ?? null
  );

  let always: string[] = [];
  if (row.always) {
    for (const id of primary) {
      if (!available.has(id)) notes.push(`PRIMARY_UNAVAILABLE:${id}`);
    }
    always = orderedMcdIds([
      ...primary.filter((id) => available.has(id)),
      ...warnings.map((w) => w.mcd_id),
    ]);
  }

  const timeframes = timeframesOf(input.intent, input.timeframes);
  let extra: string[] = [];
  switch (row.extra) {
    case 'NONE':
      break;
    case 'ZONE_SOURCES':
      extra = zoneSources(input, available);
      break;
    case 'TARGET_SIDE_LEVELS':
      extra = targetSideSensors(input, available, notes);
      break;
    case 'TERM_OWNERS':
      extra = termOwners(input, roster, glossary, available, timeframes, notes);
      break;
    case 'TIMEFRAME_CHANNEL':
      extra = channelSensors(roster, available, timeframes);
      break;
  }
  extra = orderedMcdIds(extra);

  const mStar = orderedMcdIds([...always, ...extra]);
  return {
    intent: input.intent,
    traderType: input.traderType,
    routing_version: matrix.version,
    primary,
    warnings,
    always,
    extra,
    m_star: mStar,
    domains: [...row.domains],
    playbooks: row.playbooks === 'M_STAR' ? mStar : [],
    notes,
  };
}
