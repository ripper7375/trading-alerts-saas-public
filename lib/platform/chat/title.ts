/**
 * Thread titles and previews (build step 7 plan decision D15: deterministic, no model call).
 *
 * A thread gets its title from its FIRST answer: the symbol, the chart if the trader pressed
 * an instant prompt, the bias, and the cycle slot (`XAUUSD · M15 · LONG · 18 SEP 20:55`). The
 * trader can rename it (`sanitizeTitle`). Everything here is plain data in the language of
 * the market, not of the interface: the symbol, a timeframe, a bias word, a UTC stamp; the
 * interface wraps them.
 *
 * Pure.
 *
 * @module lib/platform/chat/title
 */

import {
  boardStamp,
  instantTimeframe,
  isInstantIntent,
} from '@/lib/reply/contracts/intake';
import type {
  Bias,
  InstantIntent,
  PacketIntent,
} from '@/lib/reply/contracts/intake';
import { FORBIDDEN_TEXT_CHARS } from '@/lib/reply/contracts/shape';

export const TITLE_MAX_CHARS = 80;
export const PREVIEW_MAX_CHARS = 120;

const codePoints = (text: string): number => Array.from(text).length;

const BIAS_WORD: Readonly<Record<Bias, string>> = {
  LONG: 'LONG',
  SHORT: 'SHORT',
  NEUTRAL: 'NEUTRAL',
  STAND_ASIDE: 'STAND ASIDE',
};

/** The word for an intent that has no bias to name (an explanation, the news ...). An instant prompt names its chart instead. */
const INTENT_WORD: Readonly<
  Record<Exclude<PacketIntent, InstantIntent>, string>
> = {
  DIRECTION: 'DIRECTION',
  ENTRY_TIMING: 'ENTRY',
  EXIT_TARGETS: 'TARGETS',
  RISK_SIZING: 'SIZING',
  EXPLAIN: 'EXPLAIN',
  NEWS: 'NEWS',
  REPORT_2: 'TRADE SETUP',
};

export interface TitleInput {
  symbol: string;
  intent: PacketIntent;
  /** the bias of the first answer; null when it had none */
  bias: Bias | null;
  /** the cycle slot of the first answer, unix UTC seconds; null when none */
  cycleSlot: number | null;
}

/** `XAUUSD · M15 · LONG · 18 SEP 20:55`. At most 80 characters by construction (a symbol is at most 24). */
export function deriveThreadTitle(input: TitleInput): string {
  const parts = [input.symbol];
  if (isInstantIntent(input.intent)) {
    parts.push(instantTimeframe(input.intent));
  } else if (input.bias === null) {
    parts.push(INTENT_WORD[input.intent]);
  }
  if (input.bias !== null) parts.push(BIAS_WORD[input.bias]);
  if (input.cycleSlot !== null) parts.push(boardStamp(input.cycleSlot));
  return parts.join(' · ');
}

export type TitleCheck =
  | { ok: true; title: string }
  | { ok: false; code: 'EMPTY' | 'TOO_LONG' };

/**
 * A title the trader typed: control, separator and bidirectional-override characters out
 * (a line break becomes a space), white space collapsed, ends trimmed, Unicode composed.
 * Empty after that is refused, and so is anything longer than 80 characters (the field
 * has a limit the interface shows; a title is not silently cut).
 */
export function sanitizeTitle(raw: string): TitleCheck {
  const cleaned = raw
    .normalize('NFC')
    .replace(/[\p{Cc}\u{2028}\u{2029}]+/gu, ' ')
    .replace(new RegExp(FORBIDDEN_TEXT_CHARS.source, 'gu'), '')
    .replace(/\s+/gu, ' ')
    .trim();
  if (cleaned === '') return { ok: false, code: 'EMPTY' };
  if (codePoints(cleaned) > TITLE_MAX_CHARS)
    return { ok: false, code: 'TOO_LONG' };
  return { ok: true, title: cleaned };
}

/**
 * The one line Panel A shows under a title: the text collapsed to one line and cut at 120
 * characters (a cut ends in an ellipsis that counts in the 120). Code-point safe, so an
 * emoji or a Thai cluster is never split in half.
 */
export function previewOf(text: string): string {
  const flat = text
    .replace(new RegExp(FORBIDDEN_TEXT_CHARS.source, 'gu'), ' ')
    .replace(/\s+/gu, ' ')
    .trim();
  const chars = Array.from(flat);
  if (chars.length <= PREVIEW_MAX_CHARS) return flat;
  return `${chars
    .slice(0, PREVIEW_MAX_CHARS - 1)
    .join('')
    .trimEnd()}…`;
}
