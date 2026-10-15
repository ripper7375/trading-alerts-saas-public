/**
 * What changed between two cycles (build step 7 part 5; architecture 5.11): the opening of a
 * follow-up on a NEW cycle, "data updated 21:00 UTC: MCD2 left the corridor", built by code from
 * the two cycles' sensors and never by the model.
 *
 * This file produces the STRUCTURE: for each sensor whose state code moved, `{ mcd_id, from, to }`
 * (`StateChange`). The sentence is the interface's: it words the time from the reply's stamp
 * (`as_of`) and the change from the state codes, in the reader's language, so no translated string
 * is made twice. A sensor that gained or lost its state (it became unavailable, or came back) is a
 * change with `null` on one side.
 *
 * Not a change: the same cycle (nothing new happened), a first message (nothing to compare with),
 * a previous cycle with no sensors (nothing was running), and a sensor whose reading could not be
 * believed on either side (unknown is not "absent"). A status that moved while the state code
 * stayed (VALID to CAUTIONARY) is not a change of state: the stamp and the board carry statuses.
 *
 * Pure.
 *
 * @module lib/reply/report1/changes
 */

import type { IntakePacket } from '../contracts/intake';
import { RESULT_LIMITS } from '../contracts/result';
import type { StateChange } from '../contracts/result';

/** The states of the sensors of one cycle. */
export interface CycleStates {
  /** `2026-09-18T20:55Z`; null when no cycle was read */
  slot: string | null;
  /** one entry per sensor that had a line on the board; `state_code` is null when it had none */
  sensors: readonly { mcd_id: string; state_code: string | null }[];
  /** sensors whose stored reading could not be believed: their state is unknown, not absent */
  unreadable?: readonly string[];
}

/** The states of the cycle a packet is pinned to, from its board. */
export function statesOfPacket(packet: IntakePacket): CycleStates {
  return {
    slot: packet.data.cycle_slot,
    sensors: packet.board.sensors.map((line) => ({
      mcd_id: line.mcd_id,
      state_code: line.status === 'ABSENT' ? null : line.state_code,
    })),
  };
}

const mcdNumber = (id: string): number => {
  const found = /^MCD(\d+)$/.exec(id);
  return found === null ? Number.MAX_SAFE_INTEGER : Number(found[1]);
};

/** The sensors whose state code differs between the previous cycle and this one, in id order. */
export function stateChanges(
  previous: CycleStates | null,
  current: CycleStates
): StateChange[] {
  if (
    previous === null ||
    previous.slot === null ||
    previous.slot === current.slot ||
    previous.sensors.length === 0
  ) {
    return [];
  }
  const before = new Map(previous.sensors.map((s) => [s.mcd_id, s.state_code]));
  const after = new Map(current.sensors.map((s) => [s.mcd_id, s.state_code]));
  const unknown = new Set([
    ...(previous.unreadable ?? []),
    ...(current.unreadable ?? []),
  ]);
  const ids = [...new Set([...before.keys(), ...after.keys()])]
    .filter((id) => !unknown.has(id))
    .sort((a, b) => mcdNumber(a) - mcdNumber(b));

  const changes: StateChange[] = [];
  for (const id of ids) {
    const from = before.get(id) ?? null;
    const to = after.get(id) ?? null;
    if (from !== to) changes.push({ mcd_id: id, from, to });
  }
  return changes.slice(0, RESULT_LIMITS.changes);
}
