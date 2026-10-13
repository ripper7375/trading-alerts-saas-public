/**
 * The sensor board (architecture 4.4, ADR-040, plan decisions D7 and D8).
 *
 * Every request carries the whole board: a header, the synthesis line, ONE LINE PER LIVE
 * SENSOR, and a data line. A sensor that is live but cannot be read is still listed, as
 * unavailable, and never dropped: INVALID and STALE with their reasons, ABSENT when the
 * cycle has no row for it. A warning from a sensor outside the routed set must never
 * disappear, so the board is not routed.
 *
 *   SENSOR BOARD · XAUUSD · 18 SEP 20:55 · DAY TRADER
 *   SYN    CAUTIONARY  R1_MACRO_COUNTER_TREND_RALLY · LONG · COUNTER_TREND · Counter-trend rally, LONG
 *   MCD1   CAUTIONARY  MCD1_DOWN_UPPER_BREAKOUT · LONG · M15 downtrend, sustained close above the corridor
 *   MCD2   CAUTIONARY  MCD2_UP_IN_CORRIDOR · LONG · M5 uptrend, inside the corridor
 *   MCD3   CAUTIONARY  MCD3_NON_CONSOLIDATED_TREND_CONFLICT · STAND_ASIDE · M15 and M5 trends differ, no consolidated trend
 *   DATA   FRESH       cycle 20:55 · last price 4378.31 (close of the 20:50 M5 bar)
 *
 * Which sensors are live, and what each one said, is decided by the reader; this file
 * turns that into the board. `buildBoard` returns the board as the packet carries it
 * (`Board`) and the same board as the lines a prompt shows. The body of the board (the
 * lines between the header and the end) is always the number of live sensors plus two: the
 * synthesis line and the data line. When no sensor is live (the committed configuration
 * today, finding F8) the board says so in words on the synthesis line, and the packet says
 * `SENSORS_NOT_LIVE` (D7).
 *
 * The DATA line's price is the close of the last closed M5 bar of the stored reading,
 * labelled with that bar (D8). It is not the price of the bar still forming.
 *
 * Pure: no I/O, no clock.
 *
 * @module lib/intake/board
 */

import {
  isUsable,
  orderedMcdIds,
  type SensorFacts,
  type SynthesisFacts,
} from './facts';
import type {
  Board,
  BoardSensorLine,
  BoardSynLine,
  DataStatus,
  LastPrice,
} from './packet';
import { PACKET_SYMBOL } from './packet';
import {
  SENSOR_ROSTER,
  boardSensors,
  type Roster,
  type TraderType,
} from './roster';
import { boardStamp, clockOf, secondsOfSlot } from './slots';

/** The whole board is "about 600 to 800 tokens for 15 sensors" (4.4). */
export const BOARD_TOKEN_CAP = 800;

/**
 * A character-based stand-in for a token count (plan assumption A6). A real tokenizer
 * differs by model and belongs to step 7; codes such as `MCD1_DOWN_UPPER_BREAKOUT` take
 * about one token per three characters, so this over-counts ordinary words on purpose.
 */
export const CHARS_PER_TOKEN = 3;

export function estimateTokens(text: string): number {
  return Math.ceil(text.length / CHARS_PER_TOKEN);
}

export interface BoardData {
  status: DataStatus;
  retuning: boolean;
  /** the cycle the board is pinned to, as `2026-09-18T20:55Z`; null when none could be read */
  cycle_slot: string | null;
  /** the close of the last closed M5 bar of the stored synthesis reading (D8) */
  last_price: LastPrice | null;
}

export interface BoardInput {
  traderType: TraderType;
  /** the sensors that have a line on the board (they are live); any order, no repeats needed */
  liveIds: readonly string[];
  /** what each live sensor said; a live sensor with no entry here is ABSENT */
  sensors: Readonly<Record<string, SensorFacts | undefined>>;
  /** the trader's synthesis reading; null when it is not running */
  synthesis: SynthesisFacts | null;
  data: BoardData;
}

export interface BoardResult {
  board: Board;
  /** the header, the synthesis line, one line per sensor, the data line */
  lines: string[];
  /** true exactly when the board has no live sensor: the packet flags `SENSORS_NOT_LIVE` (D7) */
  sensorsNotLive: boolean;
}

/**
 * The sensors that have a line on the board: those the configuration marks `live`, and those
 * that have a LIVE row for the cycle (the row proves the sensor ran live at that slot, so a
 * warning from it cannot vanish because the configuration moved a minute later). A gate is
 * never a line. `rowIds` are the ids of the live rows that were read.
 */
export function liveSensorIds(
  rowIds: Iterable<string>,
  roster: Roster = SENSOR_ROSTER
): string[] {
  const onBoard = new Set(boardSensors(roster).map((sensor) => sensor.mcd_id));
  const live = new Set<string>();
  for (const sensor of boardSensors(roster)) {
    if (sensor.flag === 'live') live.add(sensor.mcd_id);
  }
  for (const id of rowIds) {
    if (onBoard.has(id)) live.add(id);
  }
  return orderedMcdIds(live);
}

const TRADER_LABEL: Record<TraderType, string> = {
  DAY_TRADER: 'DAY TRADER',
  SCALPER: 'SCALPER',
};

const STATUS_WIDTH = 11;
const ID_WIDTH = 5;

export const SYN_NOT_RUNNING_NO_SENSOR =
  'No sensor is live, so there are no readings (SENSORS_NOT_LIVE)';
export const SYN_NOT_RUNNING_NO_READING =
  'No live synthesis reading for this cycle';

function sensorLine(
  id: string,
  facts: SensorFacts | undefined
): BoardSensorLine {
  if (facts === undefined) {
    return {
      mcd_id: id,
      status: 'ABSENT',
      state_code: null,
      bias: null,
      summary: null,
      reasons: [],
    };
  }
  return {
    mcd_id: id,
    status: facts.status,
    state_code: facts.state_code,
    bias: facts.bias,
    summary: facts.summary,
    reasons: [...facts.reasons],
  };
}

function sensorText(line: BoardSensorLine): string {
  const head = `${line.mcd_id.padEnd(ID_WIDTH)} ${line.status.padEnd(STATUS_WIDTH)} `;
  if (line.status === 'ABSENT') {
    return `${head}unavailable · no reading for this cycle`;
  }
  if (!isUsable(line.status)) {
    return `${head}unavailable · ${line.reasons.join(', ')}`;
  }
  return `${head}${line.state_code ?? ''} · ${line.bias ?? ''} · ${line.summary ?? ''}`;
}

function synLine(
  synthesis: SynthesisFacts | null,
  anyLive: boolean
): BoardSynLine {
  if (synthesis === null) {
    return {
      state: 'NOT_RUNNING',
      status: null,
      rule_id: null,
      bias: null,
      trend_relation: null,
      summary: anyLive ? SYN_NOT_RUNNING_NO_READING : SYN_NOT_RUNNING_NO_SENSOR,
    };
  }
  return {
    state: 'RUNNING',
    status: synthesis.status,
    rule_id: synthesis.rule_id,
    bias: synthesis.bias,
    trend_relation: synthesis.trend_relation,
    summary: synthesis.summary,
  };
}

function synText(line: BoardSynLine): string {
  if (line.state === 'NOT_RUNNING') {
    return `${'SYN'.padEnd(ID_WIDTH)} ${'NOT RUNNING'.padEnd(STATUS_WIDTH)} ${line.summary}`;
  }
  const parts = [line.rule_id, line.bias, line.trend_relation, line.summary];
  return `${'SYN'.padEnd(ID_WIDTH)} ${(line.status ?? '').padEnd(STATUS_WIDTH)} ${parts
    .filter((part): part is string => part !== null)
    .join(' · ')}`;
}

function headerText(traderType: TraderType, slot: string | null): string {
  const at = slot === null ? null : secondsOfSlot(slot);
  const stamp = at === null ? 'NO CYCLE' : boardStamp(at);
  return `SENSOR BOARD · ${PACKET_SYMBOL} · ${stamp} · ${TRADER_LABEL[traderType]}`;
}

function dataText(data: BoardData): string {
  const at = data.cycle_slot === null ? null : secondsOfSlot(data.cycle_slot);
  const parts = [at === null ? 'no cycle' : `cycle ${clockOf(at)}`];
  if (data.last_price === null) {
    parts.push('last price unavailable');
  } else {
    const bar = secondsOfSlot(data.last_price.bar);
    parts.push(
      `last price ${data.last_price.price.toFixed(2)}` +
        (bar === null
          ? ''
          : ` (close of the ${clockOf(bar)} ${data.last_price.timeframe} bar)`)
    );
  }
  if (data.retuning) parts.push('RETUNING');
  return `${'DATA'.padEnd(ID_WIDTH)} ${data.status.padEnd(STATUS_WIDTH)} ${parts.join(' · ')}`;
}

/**
 * Build the board. Ids that are not MCD ids are ignored and repeats are one line. The
 * result is a pure function of its input: the same facts always give the same board.
 */
export function buildBoard(input: BoardInput): BoardResult {
  const ids = orderedMcdIds(input.liveIds);
  const sensors = ids.map((id) => sensorLine(id, input.sensors[id]));
  // with no live sensor there is nothing for the synthesis to have read: it is not running (D7)
  const syn = synLine(
    ids.length === 0 ? null : input.synthesis,
    ids.length > 0
  );
  const board: Board = { syn, sensors };
  const lines = [
    headerText(input.traderType, input.data.cycle_slot),
    synText(syn),
    ...sensors.map(sensorText),
    dataText(input.data),
  ];
  return { board, lines, sensorsNotLive: ids.length === 0 };
}
