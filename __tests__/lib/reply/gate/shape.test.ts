/**
 * @jest-environment node
 */

/**
 * Which reply a request becomes (build step 7 part 5; plan decisions D9 and D20). The model flag
 * is what the orchestrator asks before it assembles a prompt: it is false for every request that
 * needs no model, so the call count of the model port stays zero for them.
 */

import { SHAPE_OF_INTENT } from '@/lib/reply/contracts/intent-shapes';
import { evaluateAnswerGate } from '@/lib/reply/gate/answer-gate';
import {
  actionZoneIds,
  resolveShape,
  traceShape,
} from '@/lib/reply/gate/shape';
import type { ShapeResolution } from '@/lib/reply/gate/shape';
import type {
  IntakePacket,
  PacketIntent,
  TraderType,
} from '@/lib/reply/contracts/intake';
import { REPLY_SHAPES } from '@/lib/reply/contracts/trace-fields';

import {
  GOLDEN_IDS,
  INTENTS,
  STATUSES,
  TRADER_TYPE_LIST,
  overlay,
  packetOf,
} from '../report1/helpers/report1-fixtures';

function shapeOf(
  packet: IntakePacket,
  zoneIds?: readonly string[]
): ShapeResolution {
  const gate = evaluateAnswerGate({
    intent: packet.intent,
    dataStatus: packet.data.status,
    retuning: packet.data.retuning,
    cycleSlot: packet.data.cycle_slot,
  });
  return resolveShape({
    packet,
    gate,
    ...(zoneIds === undefined ? {} : { zoneIds }),
  });
}

describe('a request on live data', () => {
  it.each(
    INTENTS.filter((intent) => intent !== 'REPORT_2').map(
      (intent) => [intent] as const
    )
  )('%s becomes the shape decision D9 gives it', (intent) => {
    const resolution = shapeOf(packetOf('01', 'DAY_TRADER', intent));
    const expected = SHAPE_OF_INTENT[intent];
    expect(resolution.shape).toBe(expected);
    expect(resolution.model).toBe(true);
  });

  it('turns REPORT_2 into the Trade Setup action with no model', () => {
    const packet = packetOf('01', 'SCALPER', 'REPORT_2');
    const resolution = shapeOf(packet, ['Z1', 'Z2']);
    expect(resolution).toEqual({
      shape: 'ACTION',
      model: false,
      action: {
        type: 'OPEN_TRADE_SETUP',
        cycle_slot: '2026-09-18T20:55Z',
        trader_type: 'SCALPER',
        zone_ids: ['Z1', 'Z2'],
      },
    });
  });

  it('opens on the retuned and the delayed cycle too', () => {
    const packet = packetOf('01', 'DAY_TRADER', 'REPORT_2');
    expect(shapeOf(overlay(packet, { status: 'DELAYED' })).shape).toBe(
      'ACTION'
    );
    expect(shapeOf(overlay(packet, { retuning: true })).shape).toBe('ACTION');
  });
});

describe('the zone ids of the action', () => {
  it('come from the caller first, then from the packet, then are empty', () => {
    const report2 = packetOf('01', 'DAY_TRADER', 'REPORT_2');
    expect(report2.readings.synthesis).toBeNull(); // Report 2 carries no readings
    const open = (zoneIds?: readonly string[]) => {
      const r = shapeOf(report2, zoneIds);
      return r.shape === 'ACTION' ? r.action.zone_ids : null;
    };
    expect(open(['Z2', 'Z1'])).toEqual(['Z2', 'Z1']);
    expect(open()).toEqual([]);
    expect(open([])).toEqual([]);

    // a packet that does carry the reading offers its zones when the caller gave none
    const withReading = {
      ...packetOf('01', 'DAY_TRADER'),
      intent: 'REPORT_2' as const,
    };
    const r = shapeOf(withReading);
    expect(r.shape === 'ACTION' && r.action.zone_ids).toEqual(['Z1', 'Z2']);
    expect(open(['Z1'])).toEqual(['Z1']);
  });

  it('are well formed, none twice, at most five, in the order given', () => {
    expect(actionZoneIds(['Z3', 'Z1', 'Z3', 'Z2'])).toEqual(['Z3', 'Z1', 'Z2']);
    expect(actionZoneIds(['Z0', 'Z6', 'z1', 'Z10', '', 'X1', 'Z1'])).toEqual([
      'Z1',
    ]);
    expect(actionZoneIds(['Z1', 'Z2', 'Z3', 'Z4', 'Z5'])).toEqual([
      'Z1',
      'Z2',
      'Z3',
      'Z4',
      'Z5',
    ]);
    expect(actionZoneIds(['Z1', 'Z2', 'Z3', 'Z4', 'Z5', 'Z1'])).toHaveLength(5);
    expect(actionZoneIds([])).toEqual([]);
    expect(
      actionZoneIds([7 as unknown as string, null as unknown as string])
    ).toEqual([]);
  });

  it('keep the trader type of the packet', () => {
    for (const type of TRADER_TYPE_LIST) {
      const r = shapeOf(packetOf('04', type, 'REPORT_2'), ['Z1']);
      expect(r.shape === 'ACTION' && r.action.trader_type).toBe(type);
    }
  });

  it('fail closed when no cycle is pinned: the modal has nothing to open on', () => {
    const packet = packetOf('01', 'DAY_TRADER', 'REPORT_2');
    const noCycle = { ...packet, data: { ...packet.data, cycle_slot: null } };
    expect(shapeOf(noCycle, ['Z1'])).toEqual({
      shape: 'FIXED_ANSWER',
      model: false,
      reason: 'DATA_STALE',
      stoppedAt: null,
    });
  });
});

describe('a request the data does not allow', () => {
  it('is a fixed answer, the data stopped, with no model (STALE and UNKNOWN)', () => {
    for (const status of ['STALE', 'UNKNOWN'] as const) {
      for (const intent of INTENTS) {
        const packet = overlay(packetOf('01', 'DAY_TRADER', intent), {
          status,
        });
        const resolution = shapeOf(packet);
        if (intent === 'EXPLAIN' || intent === 'NEWS') {
          expect(resolution.model).toBe(true);
          expect(resolution.shape).toBe('ANSWER');
        } else {
          expect(resolution).toEqual({
            shape: 'FIXED_ANSWER',
            model: false,
            reason: 'DATA_STALE',
            stoppedAt: '2026-09-18T20:55Z',
          });
        }
      }
    }
  });

  it('is a fixed answer, the market is closed, for Report 2 only', () => {
    const closed = overlay(packetOf('01', 'DAY_TRADER', 'REPORT_2'), {
      status: 'MARKET_CLOSED',
    });
    expect(shapeOf(closed)).toEqual({
      shape: 'FIXED_ANSWER',
      model: false,
      reason: 'MARKET_CLOSED',
      stoppedAt: '2026-09-18T20:55Z',
    });
    const direction = overlay(packetOf('01'), { status: 'MARKET_CLOSED' });
    expect(shapeOf(direction)).toEqual({ shape: 'REPORT1', model: true });
  });

  it('needs no model for a refusal on any of the 16 golden cycles and both trader types', () => {
    for (const id of GOLDEN_IDS) {
      for (const type of TRADER_TYPE_LIST) {
        const stale = overlay(packetOf(id.slice(0, 2), type), {
          status: 'STALE',
        });
        const r = shapeOf(stale);
        expect(r.model).toBe(false);
        expect(r.shape).toBe('FIXED_ANSWER');
      }
    }
  });
});

describe('a direction asked for where there is none to copy', () => {
  it('is a fixed answer built from the board when the cycle has no synthesis reading', () => {
    const packet = packetOf('01');
    const noReading = {
      ...packet,
      readings: { ...packet.readings, synthesis: null },
    };
    for (const intent of [
      'DIRECTION',
      'ENTRY_TIMING',
      'INSTANT_M5_INSPECT',
      'INSTANT_M15_INSPECT',
    ] as const) {
      expect(shapeOf({ ...noReading, intent })).toEqual({
        shape: 'FIXED_ANSWER',
        model: false,
        reason: 'NO_SYNTHESIS',
        stoppedAt: null,
      });
    }
  });

  it('still lets a short answer go to the model: explaining does not need a direction', () => {
    const packet = packetOf('01', 'DAY_TRADER', 'EXPLAIN');
    const noReading = {
      ...packet,
      readings: { ...packet.readings, synthesis: null },
    };
    expect(shapeOf(noReading)).toEqual({ shape: 'ANSWER', model: true });
  });
});

describe('every request on every status', () => {
  it('asks the model for a report or an answer only when the gate allows it and the shape needs one', () => {
    for (const status of STATUSES) {
      for (const intent of INTENTS) {
        const packet = overlay(packetOf('01', 'DAY_TRADER', intent), {
          status,
        });
        const gate = evaluateAnswerGate({
          intent,
          dataStatus: status,
          retuning: false,
          cycleSlot: packet.data.cycle_slot,
        });
        const resolution = shapeOf(packet);
        const needsModel = gate.allowed && intent !== 'REPORT_2';
        expect({ status, intent, model: resolution.model }).toEqual({
          status,
          intent,
          model: needsModel,
        });
      }
    }
  });
});

describe('the shape the trace records', () => {
  it('is what the request tried to produce, and a word the trace contract has', () => {
    const samples: [ShapeResolution, string][] = [
      [{ shape: 'REPORT1', model: true }, 'REPORT1'],
      [{ shape: 'ANSWER', model: true }, 'ANSWER'],
      [
        {
          shape: 'FIXED_ANSWER',
          model: false,
          reason: 'DATA_STALE',
          stoppedAt: null,
        },
        'NONE',
      ],
      [
        {
          shape: 'ACTION',
          model: false,
          action: {
            type: 'OPEN_TRADE_SETUP',
            cycle_slot: '2026-09-18T20:55Z',
            trader_type: 'DAY_TRADER' as TraderType,
            zone_ids: [],
          },
        },
        'NONE',
      ],
    ];
    for (const [resolution, expected] of samples) {
      expect(traceShape(resolution)).toBe(expected);
      expect(REPLY_SHAPES).toContain(traceShape(resolution));
    }
  });

  it('does not change the resolution or the packet', () => {
    const packet = packetOf('02', 'SCALPER');
    const before = JSON.stringify(packet);
    shapeOf(packet);
    expect(JSON.stringify(packet)).toBe(before);
    const intent: PacketIntent = packet.intent;
    expect(intent).toBe('DIRECTION');
  });
});
