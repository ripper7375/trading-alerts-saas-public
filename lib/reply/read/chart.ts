/**
 * The chart rule and its reader (build step 7 part 5; architecture 5.3, 5.11, ADR-014, ADR-051,
 * rule 8; plan decision D9; finding S7-F8). Imported by path, never through a barrel, like
 * `read/day-bars.ts`, whose style this follows.
 *
 * THE RULE. A chart image reaches the model only when ALL of these hold, checked in this order and
 * BEFORE any storage is touched, so a chart nobody wants is never fetched:
 *   1. the data status allows a chart (`DATA_STATUS`: STALE and UNKNOWN never send one);
 *   2. the intent calls for it (`NOT_CALLED_FOR`): the two Panel C instant prompts, and the first
 *      Direction or Entry question of a (thread, cycle); never a follow-up nobody asked a chart
 *      question in (`chartCalledFor`);
 *   3. the trader's tier allows the model to inspect the chart (`TIER`);
 *   4. the chosen model can read an image (`NO_VISION`).
 * Then the stamp of the stored render is read (a HEAD request, no image bytes move) and judged by
 * `chartMatchesCycle(stamp, cycleSlot)`, the rule 8 check this file is the first caller of:
 *   - no object, no trustworthy stamp, or storage unreachable -> `MISSING`;
 *   - a stamp for another slot -> `CYCLE_MISMATCH`: the image is dropped and the reply says so;
 *   - the stamp matches -> the image is fetched, and the stamp of THE OBJECT THAT WAS DOWNLOADED is
 *     judged again (the renderer replaces the object every cycle: a swap between the HEAD and the
 *     GET must not put another cycle's picture in front of the model) -> `SENT`.
 *
 * WHAT THE REPLY SAYS. A chart that was wanted and dropped for its cycle (`CHART_OTHER_CYCLE`) or
 * for being unreadable (`CHART_UNAVAILABLE`) comes back as a note code; a chart that was never
 * wanted, or that the tier or the model cannot use, is not mentioned (nobody was promised one).
 *
 * MARKET CLOSED is not special here: the newest cycle is the last session's, and its render, if
 * the renderer drew one for that slot, matches it. The reply is labelled "last session" by the
 * stamp's data status.
 *
 * INJECTABLE. The storage sits behind `ChartPort`; the real one is `getChartStamp` and
 * `getChartImage` of `lib/storage/r2.ts`, which fit it with no cast and are handed in by the
 * orchestrator (a test passes its own; this file never loads the AWS SDK). Nothing here throws
 * for a storage failure: it is a `MISSING` chart with the reason. Pure apart from the port.
 *
 * @module lib/reply/read/chart
 */

import { chartMatchesCycle } from '@/lib/storage/chart-keys';
import type { ChartStamp, ChartVariant } from '@/lib/storage/chart-keys';

import { isInstantIntent, secondsOfSlot } from '../contracts/intake';
import type { PacketIntent } from '../contracts/intake';
import type { ResultNote } from '../contracts/result';
import type { ChartDecision } from '../contracts/trace-fields';

/** An image read server-side, with the stamp of the very object that was downloaded. */
export interface ChartImageObject {
  bytes: Uint8Array;
  contentType: string;
  stamp: ChartStamp | null;
}

/** The two reads the rule needs; `lib/storage/r2.ts` provides both. */
export interface ChartPort {
  getChartStamp(variant: ChartVariant): Promise<ChartStamp | null>;
  getChartImage(variant: ChartVariant): Promise<ChartImageObject | null>;
}

export interface ChartRequest {
  /** the packet's cycle slot, `2026-09-18T20:55Z`; null when no cycle could be read */
  cycleSlot: string | null;
  /** the answer gate allows a chart on this data status (`GateDecision.chartAllowed`) */
  dataAllows: boolean;
  /** the intent calls for a chart (`chartCalledFor`) */
  calledFor: boolean;
  /** the entitlement table lets this tier have the model inspect the chart (part 6; a plain input here) */
  tierAllows: boolean;
  /** the chosen model can read an image (registry `vision`) */
  modelVision: boolean;
  /** the render to use; the overlay render by default (the M5 and M15 panels with the channel drawn) */
  variant?: ChartVariant;
}

/** The image the gateway turns into the prompt's image part. */
export interface ChartImagePart {
  /** the opaque reference the assembler's chart slot carries (`ChartInput.ref`) */
  ref: string;
  contentType: string;
  /** `data:image/png;base64,...` (the gateway accepts https and `data:` URLs) */
  dataUrl: string;
  byteLength: number;
}

export interface ChartRead {
  decision: ChartDecision;
  /** what the reply says about the chart; null when it need not say anything */
  note: ResultNote | null;
  /** why, for the trace and the log (`CHART_SLOT_MISMATCH: ...`, `NO_CHART_STAMP`, a storage error); null when sent */
  reason: string | null;
  /** the stamp that was judged (the HEAD's, or the download's when it was fetched) */
  stamp: ChartStamp | null;
  /** present exactly when `decision` is `SENT` */
  image: ChartImagePart | null;
}

/** The image types the models take. */
export const CHART_CONTENT_TYPES = ['image/png', 'image/jpeg', 'image/webp'];

export const DEFAULT_CHART_VARIANT: ChartVariant = 'overlay';

/**
 * Does this question call for the chart? The Panel C instant prompts always do (they ARE about
 * the chart); a Direction or Entry question does only when it is the first of its (thread, cycle),
 * so a follow-up in the same cycle does not pay for the image again (5.11, ADR-057); nothing else
 * does. `firstOfCycle` is the orchestrator's fact, read from the thread's history.
 */
export function chartCalledFor(input: {
  intent: PacketIntent;
  firstOfCycle: boolean;
}): boolean {
  if (isInstantIntent(input.intent)) return true;
  if (input.intent === 'DIRECTION' || input.intent === 'ENTRY_TIMING') {
    return input.firstOfCycle;
  }
  return false;
}

/**
 * The rule's decision before storage is touched: the first of the four conditions that fails, or
 * null when the stamp has to be read.
 */
export function chartDecisionBeforeRead(
  request: Pick<
    ChartRequest,
    'dataAllows' | 'calledFor' | 'tierAllows' | 'modelVision'
  >
): ChartDecision | null {
  if (!request.dataAllows) return 'DATA_STATUS';
  if (!request.calledFor) return 'NOT_CALLED_FOR';
  if (!request.tierAllows) return 'TIER';
  if (!request.modelVision) return 'NO_VISION';
  return null;
}

const none = (
  decision: ChartDecision,
  note: ResultNote | null,
  reason: string | null,
  stamp: ChartStamp | null = null
): ChartRead => ({ decision, note, reason, stamp, image: null });

const messageOf = (error: unknown): string =>
  error instanceof Error ? error.message : 'unknown error';

/** Judge one stamp against the cycle: the drop, with its reason, or null when it is the cycle's own. */
function mismatch(
  stamp: ChartStamp | null,
  cycleSeconds: number
): ChartRead | null {
  const verdict = chartMatchesCycle(stamp, cycleSeconds);
  if (verdict.matches) return null;
  const reason = verdict.reason ?? 'NO_CHART_STAMP';
  return stamp === null
    ? none('MISSING', 'CHART_UNAVAILABLE', reason)
    : none('CYCLE_MISMATCH', 'CHART_OTHER_CYCLE', reason, stamp);
}

/** Apply the rule and, when it allows, read the chart. */
export async function readChart(
  request: ChartRequest,
  port: ChartPort
): Promise<ChartRead> {
  const before = chartDecisionBeforeRead(request);
  if (before !== null) return none(before, null, null);

  const cycleSeconds = secondsOfSlot(request.cycleSlot);
  if (cycleSeconds === null) {
    return none(
      'MISSING',
      'CHART_UNAVAILABLE',
      'NO_CYCLE: there is no cycle to compare the chart with'
    );
  }
  const variant = request.variant ?? DEFAULT_CHART_VARIANT;

  let head: ChartStamp | null;
  try {
    head = await port.getChartStamp(variant);
  } catch (error) {
    return none(
      'MISSING',
      'CHART_UNAVAILABLE',
      `CHART_STORE_ERROR: ${messageOf(error)}`
    );
  }
  const headVerdict = mismatch(head, cycleSeconds);
  if (headVerdict !== null) return headVerdict;

  let object: ChartImageObject | null;
  try {
    object = await port.getChartImage(variant);
  } catch (error) {
    return none(
      'MISSING',
      'CHART_UNAVAILABLE',
      `CHART_STORE_ERROR: ${messageOf(error)}`,
      head
    );
  }
  if (object === null) {
    return none('MISSING', 'CHART_UNAVAILABLE', 'NO_CHART_IMAGE', head);
  }
  // the object that was downloaded is judged by its own stamp, not by the one the HEAD saw
  const downloadVerdict = mismatch(object.stamp, cycleSeconds);
  if (downloadVerdict !== null) return downloadVerdict;
  const stamp = object.stamp as ChartStamp;

  if (
    !CHART_CONTENT_TYPES.includes(object.contentType) ||
    object.bytes.byteLength === 0
  ) {
    return none(
      'MISSING',
      'CHART_UNAVAILABLE',
      `CHART_BAD_IMAGE: ${object.contentType}, ${object.bytes.byteLength} bytes`,
      stamp
    );
  }
  const base64 = Buffer.from(object.bytes).toString('base64');
  return {
    decision: 'SENT',
    note: null,
    reason: null,
    stamp,
    image: {
      ref: `chart:${variant}:${stamp.slot}`,
      contentType: object.contentType,
      dataUrl: `data:${object.contentType};base64,${base64}`,
      byteLength: object.bytes.byteLength,
    },
  };
}
