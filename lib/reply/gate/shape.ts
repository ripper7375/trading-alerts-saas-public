/**
 * Which reply a request becomes (build step 7 part 5; architecture 5.2, ADR-052; plan decisions
 * D9 and D20; finding S7-F10): the shape the orchestrator builds BEFORE it assembles a prompt, so
 * a request that needs no model never reaches one.
 *
 *   REPORT1       a full analysis: the model writes `report1.v1`, the server composes the report
 *                 (DIRECTION, ENTRY_TIMING and the two instant prompts);
 *   ANSWER        a short answer: the model writes `answer.v1` (EXIT_TARGETS, RISK_SIZING,
 *                 EXPLAIN, NEWS);
 *   FIXED_ANSWER  built from the board, no model: the gate refused the request (the data stopped;
 *                 Report 2 on a closed market), or a direction was asked for and the cycle has no
 *                 synthesis reading to copy it from;
 *   ACTION        `REPORT_2` opens the Trade Setup modal (Section 6): `OPEN_TRADE_SETUP` with the
 *                 cycle slot, the trader type and the zone ids. No model, no cost.
 *
 * The order is fixed: the gate's refusal first (so a STALE cycle never reaches the composer with
 * a direction in it), then Report 2, then the missing synthesis for a report that needs one, then
 * the model. `SHAPE_OF_INTENT` (D9) decides REPORT1 against ANSWER; this file adds only what the
 * facts of THIS cycle change.
 *
 * Report 2's packet carries no readings (Section 6 reads the pinned cycle by id), so the zone ids
 * of the action come from the caller (the stored zones of the cycle for the trader type); when the
 * caller gives none, the packet's synthesis reading is asked, and when it has none either the list
 * is empty and the modal reads the zones itself.
 *
 * Pure.
 *
 * @module lib/reply/gate/shape
 */

import type { IntakePacket } from '../contracts/intake';
import { SHAPE_OF_INTENT } from '../contracts/intent-shapes';
import type { FixedReason, TradeSetupAction } from '../contracts/result';
import { ZONE_ID } from '../contracts/shape';
import type { ReplyShape } from '../contracts/trace-fields';
import type { GateDecision, GateRefusal } from './answer-gate';

export type ShapeResolution =
  | { shape: 'REPORT1'; model: true }
  | { shape: 'ANSWER'; model: true }
  | {
      shape: 'FIXED_ANSWER';
      model: false;
      reason: Extract<
        FixedReason,
        'DATA_STALE' | 'MARKET_CLOSED' | 'NO_SYNTHESIS'
      >;
      /** the time the data stopped (the cycle's slot) when the data is why; null otherwise */
      stoppedAt: string | null;
    }
  | { shape: 'ACTION'; model: false; action: TradeSetupAction };

export interface ShapeInput {
  packet: IntakePacket;
  gate: GateDecision;
  /** the stored zone ids of the cycle for the trader type, when the packet carries no readings (Report 2) */
  zoneIds?: readonly string[];
}

/**
 * The zone ids of an action: well-formed, none twice, in the order given. Only five ids are well
 * formed (Z1 to Z5), so "none twice" is also "at most five".
 */
export function actionZoneIds(ids: readonly string[]): string[] {
  const out: string[] = [];
  for (const id of ids) {
    if (typeof id === 'string' && ZONE_ID.test(id) && !out.includes(id)) {
      out.push(id);
    }
  }
  return out;
}

function fixed(
  refusal: GateRefusal
): Extract<ShapeResolution, { shape: 'FIXED_ANSWER' }> {
  return {
    shape: 'FIXED_ANSWER',
    model: false,
    reason: refusal.reason,
    stoppedAt: refusal.stoppedAt,
  };
}

export function resolveShape(input: ShapeInput): ShapeResolution {
  const { packet, gate } = input;
  if (gate.refusal !== null) return fixed(gate.refusal);

  if (packet.intent === 'REPORT_2') {
    const cycleSlot = packet.data.cycle_slot;
    if (cycleSlot === null) {
      // the gate let it through on a status that says the data is live, yet no cycle is pinned:
      // the modal has nothing to open on, so fail closed
      return fixed({ reason: 'DATA_STALE', stoppedAt: null });
    }
    const given =
      input.zoneIds ??
      (packet.readings.synthesis?.zones ?? []).map((zone) =>
        String(zone['zone_id'])
      );
    return {
      shape: 'ACTION',
      model: false,
      action: {
        type: 'OPEN_TRADE_SETUP',
        cycle_slot: cycleSlot,
        trader_type: packet.profile.trader_type,
        zone_ids: actionZoneIds(given),
      },
    };
  }

  const shape = SHAPE_OF_INTENT[packet.intent];
  if (shape === 'REPORT1') {
    if (packet.readings.synthesis === null) {
      return {
        shape: 'FIXED_ANSWER',
        model: false,
        reason: 'NO_SYNTHESIS',
        stoppedAt: null,
      };
    }
    return { shape: 'REPORT1', model: true };
  }
  return { shape: 'ANSWER', model: true };
}

/** The shape the trace records: what the request tried to produce (`checks.shape`). */
export function traceShape(resolution: ShapeResolution): ReplyShape {
  switch (resolution.shape) {
    case 'REPORT1':
      return 'REPORT1';
    case 'ANSWER':
      return 'ANSWER';
    default:
      return 'NONE';
  }
}
