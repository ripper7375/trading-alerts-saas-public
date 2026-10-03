import {
  Timeframe,
  TIMEFRAMES,
  isSlot,
  lastCollectedSlot,
} from '../../cycle/slot';

/**
 * Slot arithmetic for the sensor inputs (STACK-D-ARCHITECTURE.md section 1.3
 * rules 1, 2 and 5).
 *
 * The gateway keeps a slot as unix seconds (Int, a multiple of 300). The MCD kit
 * (Python, `mcd_common/cycle_inputs.py`) keeps it as ISO 8601 UTC text,
 * "2026-09-18T20:55Z", and the envelope carries that text. This file is the one
 * place the two meet; test/sensors-stats-slot.spec.ts compares it with the kit's
 * own `slot_to_epoch`, `epoch_to_slot` and `stats_slot_for` over many slots.
 *
 * Which slot a timeframe's statistics were captured at (rule 5) is NOT worked out
 * again here: it is `lastCollectedSlot` of the cycle read side, so there is one
 * answer in the gateway, and the spec pins it to the kit's.
 */

const ISO_SLOT = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):([0-5][05])Z$/;

/** "2026-09-18T20:55Z" for a slot. Throws for anything that is not a slot (a caller bug). */
export function slotToIso(slot: number): string {
  if (!Number.isInteger(slot) || !isSlot(slot)) {
    throw new RangeError(
      `slot must be a unix time on a 5-minute boundary, got ${String(slot)}`
    );
  }
  return `${new Date(slot * 1000).toISOString().slice(0, 16)}Z`;
}

/** The slot of an ISO 8601 UTC slot text; null when the text is not one (a date that does not exist counts). */
export function isoToSlot(iso: unknown): number | null {
  if (typeof iso !== 'string') return null;
  const m = ISO_SLOT.exec(iso);
  if (!m) return null;
  const [year, month, day, hour, minute] = m.slice(1).map(Number);
  const slot = Date.UTC(year, month - 1, day, hour, minute) / 1000;
  // Date.UTC rolls 2026-02-30 over to March: only a text that survives the round trip was a real date.
  return Number.isInteger(slot) && isSlot(slot) && slotToIso(slot) === iso
    ? slot
    : null;
}

/** Rule 5: the slot at which `timeframe` was last collected, for a cycle slot (M15 at 20:55 is 20:45). */
export function statsSlotFor(slot: number, timeframe: Timeframe): number {
  return lastCollectedSlot(timeframe, slot);
}

/** `statsSlotFor` for both timeframes. */
export function statsSlots(slot: number): Record<Timeframe, number> {
  const out = {} as Record<Timeframe, number>;
  for (const timeframe of TIMEFRAMES)
    out[timeframe] = statsSlotFor(slot, timeframe);
  return out;
}
