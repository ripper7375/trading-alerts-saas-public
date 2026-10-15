/**
 * @jest-environment node
 */

/**
 * What changed between two cycles (build step 7 part 5; architecture 5.11). The diff of two
 * stored cycles must name exactly the sensors whose state moved, computed here from the golden
 * files themselves, not from the code under test.
 */

import { RESULT_LIMITS } from '@/lib/reply/contracts/result';
import { stateChanges, statesOfPacket } from '@/lib/reply/report1/changes';
import type { CycleStates } from '@/lib/reply/report1/changes';

import { GOLDENS } from '../../intake/helpers/packets';
import { overlay, packetOf } from './helpers/report1-fixtures';

const states = (
  slot: string | null,
  ...pairs: [string, string | null][]
): CycleStates => ({
  slot,
  sensors: pairs.map(([mcd_id, state_code]) => ({ mcd_id, state_code })),
});

const A = '2026-09-18T20:55Z';
const B = '2026-09-18T21:00Z';

describe('the states of a packet', () => {
  it('are the state codes of its board, in board order, with none for an absent sensor', () => {
    const packet = packetOf('01');
    expect(statesOfPacket(packet)).toEqual({
      slot: '2026-09-18T20:55Z',
      sensors: [
        { mcd_id: 'MCD1', state_code: 'MCD1_DOWN_UPPER_BREAKOUT' },
        { mcd_id: 'MCD2', state_code: 'MCD2_UP_IN_CORRIDOR' },
        { mcd_id: 'MCD3', state_code: 'MCD3_NON_CONSOLIDATED_TREND_CONFLICT' },
      ],
    });
    const absent = JSON.parse(JSON.stringify(packet));
    absent.board.sensors[1] = {
      mcd_id: 'MCD2',
      status: 'ABSENT',
      state_code: 'MCD2_UP_IN_CORRIDOR', // a damaged line: an absent sensor has no state, whatever it says
      bias: null,
      summary: null,
      reasons: ['NO_ROW'],
    };
    expect(statesOfPacket(absent).sensors[1]).toEqual({
      mcd_id: 'MCD2',
      state_code: null,
    });
  });

  it('are those of the cycle the packet is pinned to, none when no cycle was read', () => {
    const packet = packetOf('03');
    expect(statesOfPacket(packet).slot).toBe('2026-09-28T23:15Z');
    const none = { ...packet, data: { ...packet.data, cycle_slot: null } };
    expect(statesOfPacket(none).slot).toBeNull();
  });
});

describe('the sensors whose state moved', () => {
  it('names a sensor that left a state for another', () => {
    expect(
      stateChanges(
        states(A, ['MCD1', 'MCD1_UP'], ['MCD2', 'MCD2_UP_IN_CORRIDOR']),
        states(B, ['MCD1', 'MCD1_UP'], ['MCD2', 'MCD2_UP_OUT_OF_CORRIDOR'])
      )
    ).toEqual([
      {
        mcd_id: 'MCD2',
        from: 'MCD2_UP_IN_CORRIDOR',
        to: 'MCD2_UP_OUT_OF_CORRIDOR',
      },
    ]);
  });

  it('names a sensor that lost its state and one that came back', () => {
    expect(
      stateChanges(
        states(A, ['MCD1', 'MCD1_UP'], ['MCD2', null]),
        states(B, ['MCD1', null], ['MCD2', 'MCD2_DOWN'])
      )
    ).toEqual([
      { mcd_id: 'MCD1', from: 'MCD1_UP', to: null },
      { mcd_id: 'MCD2', from: null, to: 'MCD2_DOWN' },
    ]);
  });

  it('names a sensor that appeared on or disappeared from the board', () => {
    expect(
      stateChanges(
        states(A, ['MCD1', 'MCD1_UP']),
        states(B, ['MCD1', 'MCD1_UP'], ['MCD3', 'MCD3_X'])
      )
    ).toEqual([{ mcd_id: 'MCD3', from: null, to: 'MCD3_X' }]);
    expect(
      stateChanges(
        states(A, ['MCD1', 'MCD1_UP'], ['MCD3', 'MCD3_X']),
        states(B, ['MCD1', 'MCD1_UP'])
      )
    ).toEqual([{ mcd_id: 'MCD3', from: 'MCD3_X', to: null }]);
  });

  it('names nothing when every state is the same, and nothing for a sensor with no state on both sides', () => {
    expect(
      stateChanges(
        states(A, ['MCD1', 'MCD1_UP'], ['MCD2', null]),
        states(B, ['MCD1', 'MCD1_UP'], ['MCD2', null])
      )
    ).toEqual([]);
  });

  it('lists them in the order of the sensor number, not of the text', () => {
    const before = states(
      A,
      ...[1, 2, 3, 10, 11].map((n) => [`MCD${n}`, 'S_A'] as [string, string])
    );
    const after = states(
      B,
      ...[11, 10, 3, 2, 1].map((n) => [`MCD${n}`, 'S_B'] as [string, string])
    );
    expect(stateChanges(before, after).map((c) => c.mcd_id)).toEqual([
      'MCD1',
      'MCD2',
      'MCD3',
      'MCD10',
      'MCD11',
    ]);
  });

  it('keeps at most 16', () => {
    // fifteen sensors can exist; more than sixteen cannot, but the bound is the contract's and is enforced
    const fifteen = Array.from({ length: 15 }, (_, i) => `MCD${i + 1}`);
    expect(
      stateChanges(
        states(A, ...fifteen.map((id) => [id, 'S_A'] as [string, string])),
        states(B, ...fifteen.map((id) => [id, 'S_B'] as [string, string]))
      )
    ).toHaveLength(15);
    const many = Array.from({ length: 20 }, (_, i) => `SENSOR${i}`);
    const wideBefore = states(
      A,
      ...many.map((id) => [id, 'S_A'] as [string, string])
    );
    const wideAfter = states(
      B,
      ...many.map((id) => [id, 'S_B'] as [string, string])
    );
    expect(stateChanges(wideBefore, wideAfter)).toHaveLength(
      RESULT_LIMITS.changes
    );
    expect(RESULT_LIMITS.changes).toBe(16);
  });
});

describe('when there is nothing to compare', () => {
  const now = states(B, ['MCD1', 'MCD1_UP']);

  it('says nothing on a first message', () => {
    expect(stateChanges(null, now)).toEqual([]);
  });

  it('says nothing inside the same cycle: nothing new happened', () => {
    expect(stateChanges(states(B, ['MCD1', 'MCD1_DOWN']), now)).toEqual([]);
  });

  it('says nothing when the earlier cycle is unknown or had no sensors running', () => {
    expect(stateChanges(states(null, ['MCD1', 'MCD1_DOWN']), now)).toEqual([]);
    expect(stateChanges(states(A), now)).toEqual([]);
  });

  it('leaves out a sensor whose reading could not be believed on either side', () => {
    const before: CycleStates = {
      ...states(A, ['MCD1', 'MCD1_UP'], ['MCD2', null]),
      unreadable: ['MCD2'],
    };
    expect(
      stateChanges(before, states(B, ['MCD1', 'MCD1_DOWN'], ['MCD2', 'MCD2_X']))
    ).toEqual([{ mcd_id: 'MCD1', from: 'MCD1_UP', to: 'MCD1_DOWN' }]);
    const after: CycleStates = {
      ...states(B, ['MCD1', 'MCD1_UP']),
      unreadable: ['MCD1'],
    };
    expect(stateChanges(states(A, ['MCD1', 'MCD1_DOWN']), after)).toEqual([]);
  });

  it('does not change what it was given', () => {
    const before = states(A, ['MCD1', 'MCD1_UP']);
    const after = states(B, ['MCD1', 'MCD1_DOWN']);
    const frozen = JSON.stringify([before, after]);
    stateChanges(before, after);
    expect(JSON.stringify([before, after])).toBe(frozen);
  });
});

describe('the diff between two stored cycles', () => {
  /** each board sensor's state code, straight from the golden file (the independent computation) */
  function stateOf(golden: (typeof GOLDENS)[number]): CycleStates {
    return {
      slot: golden.slot,
      sensors: golden.sensors
        .filter((s) => s.mcd_id !== 'MCD0') // the gate has no line on the board
        .map((s) => {
          const envelope = JSON.parse(s.envelope_json) as {
            state_code?: string | null;
          };
          return { mcd_id: s.mcd_id, state_code: envelope.state_code ?? null };
        }),
    };
  }

  it('names exactly the sensors whose state changed, for every ordered pair of the 16 cycles', () => {
    let pairs = 0;
    let withChanges = 0;
    for (const previous of GOLDENS) {
      for (const current of GOLDENS) {
        if (previous.slot === current.slot) continue;
        const prev = stateOf(previous);
        const cur = stateOf(current);
        const expected: {
          mcd_id: string;
          from: string | null;
          to: string | null;
        }[] = [];
        const ids = [
          ...new Set([...prev.sensors, ...cur.sensors].map((s) => s.mcd_id)),
        ].sort((a, b) => Number(a.slice(3)) - Number(b.slice(3)));
        for (const id of ids) {
          const from =
            prev.sensors.find((s) => s.mcd_id === id)?.state_code ?? null;
          const to =
            cur.sensors.find((s) => s.mcd_id === id)?.state_code ?? null;
          if (from !== to) expected.push({ mcd_id: id, from, to });
        }
        const got = stateChanges(prev, cur);
        expect(got).toEqual(expected);
        pairs += 1;
        if (got.length > 0) withChanges += 1;
      }
    }
    expect(pairs).toBe(16 * 15);
    expect(withChanges).toBeGreaterThan(100);
  });

  it('is the same from the packets as from the files', () => {
    for (const golden of GOLDENS) {
      const packet = packetOf(golden.id.slice(0, 2));
      expect(statesOfPacket(packet)).toEqual(stateOf(golden));
    }
  });

  it('reads the 18 Sep and the 28 Sep 14:15 cycles as they were: MCD2 left its corridor', () => {
    const sep18 = statesOfPacket(packetOf('01'));
    const sep28 = statesOfPacket(packetOf('02'));
    const changes = stateChanges(sep18, sep28);
    expect(changes.map((c) => c.mcd_id)).toContain('MCD2');
    const mcd2 = changes.find((c) => c.mcd_id === 'MCD2');
    expect(mcd2?.from).toBe('MCD2_UP_IN_CORRIDOR');
    expect(mcd2?.to).not.toBe('MCD2_UP_IN_CORRIDOR');
  });

  it('is empty against itself, whatever the overlay', () => {
    const packet = packetOf('01');
    expect(
      stateChanges(
        statesOfPacket(packet),
        statesOfPacket(overlay(packet, { status: 'DELAYED' }))
      )
    ).toEqual([]);
  });
});
