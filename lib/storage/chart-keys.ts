/**
 * Object naming for the multi-timeframe chart renders.
 *
 * Deliberately separate from `r2.ts` and free of any dependency. Two reasons:
 *
 *  - The route only needs `parseChartVariant` to read a query parameter; it
 *    should not drag the AWS SDK in to do that.
 *  - These names must be pinned by a test against the renderer's own output
 *    filenames, and that test has no business loading an S3 client. (The AWS
 *    SDK also ships ESM that Jest will not parse without loosening the shared
 *    `transformIgnorePatterns`, which is not worth doing for string handling.)
 *
 * @module lib/storage/chart-keys
 */

/** The two renders produced per cycle. Both are PRO-only artifacts. */
export type ChartVariant = 'overlay' | 'standard';

export const CHART_VARIANTS: readonly ChartVariant[] = [
  'overlay',
  'standard',
] as const;

/**
 * Object key for a variant.
 *
 * MUST stay in step with the renderer's own output filenames, which
 * `mtf_render/__main__.py` builds as `<stem>_<variant>.png` from
 * `DEFAULT_OUT = "mtf_render_xauusd_m5_m15.png"`. The two are maintained in
 * different languages with nothing linking them, so a test pins them together --
 * drift here would surface as a 404 on download rather than as an error, which
 * is the same quiet failure mode that hid the renderer's `best_fit` rename.
 */
export function chartObjectKey(variant: ChartVariant): string {
  return `xauusd/mtf_render_xauusd_m5_m15_${variant}.png`;
}

/**
 * The slot length, in seconds: one cycle per 5-minute slot (rule 1). The renderer's
 * `mtf_render/stamp.py` holds the same number; a test pins them together.
 */
export const CHART_SLOT_SECONDS = 300;

/**
 * What a rendered image says about itself (rule 8, ADR-014): the cycle slot it was
 * drawn for, the last bar that was closed at that slot, the indicators it shows and
 * its variant. Written by the VPS renderer as R2 object metadata and read back here
 * with `getChartStamp` (HeadObject), so a download can say what it is and a prompt
 * can refuse an image from another slot (`chartMatchesCycle`).
 */
export interface ChartStamp {
  /** The cycle's slot: unix UTC seconds, a multiple of 300. */
  slot: number;
  /** Open time of the newest M5 bar closed at the slot: always `slot - 300`. */
  lastClosedBar: number;
  /**
   * The channel indicator drawn on the M5 panel (and overlaid on the M15 panel in the
   * `overlay` variant): a registry key such as `best_fit_a`, or a comma-separated list
   * when the renderer fell back to its configured default.
   */
  overlay: string;
  variant: ChartVariant;
  /** When the image was drawn, unix UTC seconds. */
  renderedAt?: number;
  /** The channel the M15 panel carries as its own (the active indicator for M15). */
  overlayM15?: string;
  /**
   * `setting` when the indicators came from the active-indicator setting for this slot;
   * `default` when the renderer fell back to its configured default (the gateway could
   * not say), so the image may not show the setting's indicators.
   */
  overlaySource?: 'setting' | 'default';
}

/**
 * The R2 object metadata keys the renderer writes (S3 stores them lowercased as
 * `x-amz-meta-<key>`). MUST stay in step with `METADATA_KEYS` in the renderer's
 * `mtf_render/stamp.py`; a test pins the two together.
 */
export const CHART_STAMP_METADATA_KEYS = {
  slot: 'cycle-slot',
  lastClosedBar: 'last-closed-bar',
  overlay: 'overlay',
  variant: 'variant',
  renderedAt: 'rendered-at',
  overlayM15: 'overlay-m15',
  overlaySource: 'overlay-source',
} as const;

const OVERLAY_LIST = /^[a-z0-9_]+(,[a-z0-9_]+)*$/;
const DIGITS = /^\d{1,12}$/;

/** Whole seconds as plain digits (at most 12, far beyond any real time and always a safe integer). */
function readInt(value: string | undefined): number | null {
  if (typeof value !== 'string' || !DIGITS.test(value)) return null;
  return Number(value);
}

/**
 * Read a stamp back out of an object's metadata, or `null` when there is none or it
 * cannot be trusted. Strict on purpose: a stamp is only useful if it can be believed,
 * so a missing or malformed required field, a slot off the 5-minute boundary, a last
 * closed bar that is not `slot - 300`, or a variant that is not the object's own all
 * mean "no stamp" rather than a best-effort guess.
 *
 * Optional fields (`rendered-at`, `overlay-m15`, `overlay-source`) may be absent (an
 * image from a renderer that predates them) but not corrupt.
 */
export function parseChartStamp(
  metadata: Record<string, string | undefined> | null | undefined,
  expectedVariant: ChartVariant
): ChartStamp | null {
  if (!metadata || typeof metadata !== 'object') return null;
  const keys = CHART_STAMP_METADATA_KEYS;

  const slot = readInt(metadata[keys.slot]);
  const lastClosedBar = readInt(metadata[keys.lastClosedBar]);
  if (slot === null || lastClosedBar === null) return null;
  if (slot % CHART_SLOT_SECONDS !== 0) return null;
  if (lastClosedBar !== slot - CHART_SLOT_SECONDS) return null;

  const overlay = metadata[keys.overlay];
  if (typeof overlay !== 'string' || !OVERLAY_LIST.test(overlay)) return null;

  // The variant on the object must be the one this object lives under: an
  // overlay-stamped image under the standard key is a corrupt pair, not a chart.
  const variant = metadata[keys.variant];
  if (variant !== expectedVariant) return null;

  const stamp: ChartStamp = { slot, lastClosedBar, overlay, variant };

  const renderedAtRaw = metadata[keys.renderedAt];
  if (renderedAtRaw !== undefined) {
    const renderedAt = readInt(renderedAtRaw);
    if (renderedAt === null) return null;
    stamp.renderedAt = renderedAt;
  }
  const overlayM15 = metadata[keys.overlayM15];
  if (overlayM15 !== undefined) {
    if (!OVERLAY_LIST.test(overlayM15)) return null;
    stamp.overlayM15 = overlayM15;
  }
  const overlaySource = metadata[keys.overlaySource];
  if (overlaySource !== undefined) {
    if (overlaySource !== 'setting' && overlaySource !== 'default') return null;
    stamp.overlaySource = overlaySource;
  }
  return stamp;
}

export interface ChartCycleMatch {
  matches: boolean;
  /** Why not, for a log or a trace: `NO_CHART_STAMP` or `CHART_SLOT_MISMATCH: ...`. */
  reason?: string;
}

/**
 * Rule 8: is this image from the cycle in hand? An image from a different slot must
 * never reach the prompt (it is fine to serve it as a download, labelled). The check
 * is on the slot only; the stamp's other fields say what the image shows, not whether
 * it is current.
 */
export function chartMatchesCycle(
  stamp: ChartStamp | null,
  cycleSlot: number
): ChartCycleMatch {
  if (stamp === null) return { matches: false, reason: 'NO_CHART_STAMP' };
  if (stamp.slot !== cycleSlot) {
    return {
      matches: false,
      reason: `CHART_SLOT_MISMATCH: chart is for slot ${stamp.slot}, the cycle is slot ${cycleSlot}`,
    };
  }
  return { matches: true };
}

/**
 * The response headers that describe a stamp (the download route attaches them to its
 * redirect). Optional fields appear only when the image has them.
 */
export function chartStampHeaders(stamp: ChartStamp): Record<string, string> {
  const headers: Record<string, string> = {
    'X-Chart-Slot': String(stamp.slot),
    'X-Chart-Last-Closed-Bar': String(stamp.lastClosedBar),
    'X-Chart-Overlay': stamp.overlay,
    'X-Chart-Variant': stamp.variant,
  };
  if (stamp.renderedAt !== undefined) {
    headers['X-Chart-Rendered-At'] = String(stamp.renderedAt);
  }
  if (stamp.overlayM15 !== undefined) {
    headers['X-Chart-Overlay-M15'] = stamp.overlayM15;
  }
  if (stamp.overlaySource !== undefined) {
    headers['X-Chart-Overlay-Source'] = stamp.overlaySource;
  }
  return headers;
}
