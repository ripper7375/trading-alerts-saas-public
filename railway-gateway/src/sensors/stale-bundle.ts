import type { CycleInputsBundle } from './inputs/bundle-types';
import { slotToIso, statsSlots } from './inputs/stats-slot';

/**
 * The bundle of a cycle the worker cannot load: no bars, no statistics, no setting, and
 * `data_status` STALE (rule 7).
 *
 * The kit already knows what that means: its cycle check (`mcd_common/preflight.py`) ends every
 * reading of a STALE cycle as STALE with `DATA_STALE`, before any bar or statistic is read. So
 * the worker gets its STALE rows (architecture 2.2: "every enabled MCD always yields exactly one
 * row") from the same runner, the same flags, the same schema and the same envelope text as any
 * other cycle, and invents no envelope of its own. Used when the cycle's READY row never appeared
 * after the retries, and when it is there but cannot be trusted.
 *
 * `retuning` is what the job said (observed); the STALE cycle check comes before the RETUNING
 * one, so it changes no reading.
 */
export function staleBundle(
  symbol: string,
  slot: number,
  retuning: boolean
): CycleInputsBundle {
  const collected = statsSlots(slot);
  return {
    symbol,
    cycle_slot: slotToIso(slot),
    data_status: 'STALE',
    retuning,
    bars: { M5: [], M15: [] },
    statistics: {},
    stats_slot: {
      M5: slotToIso(collected.M5),
      M15: slotToIso(collected.M15),
    },
    active_indicator: {},
    config_hash: {},
    channel_mode: {},
  };
}
