/**
 * The four segments of the prompt, in cache order (build step 7 part 2; architecture 5.4,
 * ADR-049), and the provider-neutral messages made of them.
 *
 *   STATIC   the rules and the wording guide: the same for everyone, every cycle
 *   CYCLE    the board with the synthesis line, then the day of OHLC: the same for every trader
 *            of one trader type in one cycle
 *   CHART    the chart image of that cycle, when one is attached
 *   USER     this trader's part: the header with the data status, the profile and events, the
 *            readings and zones, the knowledge, the history, and last of all the question
 *
 * THE PREFIX is STATIC plus CYCLE. Nothing above the user part may depend on a user, a request,
 * a clock or a word the trader typed: a test builds the prefix for two different traders and
 * compares the bytes, and it differs only between trader types (the board's synthesis line and
 * the profile label differ) and when a request had to put the OHLC in summary mode.
 *
 * `cacheable` says whether a provider that caches by prefix can serve the segment from its cache:
 * STATIC and CYCLE yes; the chart and the user part no (whether to mark a breakpoint is the
 * gateway's call, part 3, from the model's `prompt_caching` flag).
 *
 * Pure.
 *
 * @module lib/reply/context/segments
 */

import type { ContextComponent } from '../contracts/trace-fields';

export const PROMPT_SEGMENTS = ['STATIC', 'CYCLE', 'CHART', 'USER'] as const;
export type PromptSegmentId = (typeof PROMPT_SEGMENTS)[number];

/** The components of each segment, in the order their text appears in it. */
export const SEGMENT_COMPONENTS: Readonly<
  Record<PromptSegmentId, readonly ContextComponent[]>
> = {
  STATIC: ['SYSTEM_RULES'],
  CYCLE: ['BOARD_SYNTHESIS', 'OHLC'],
  CHART: ['CHART'],
  USER: [
    'PROFILE_EVENTS',
    'READINGS_ZONES',
    'KNOWLEDGE',
    'HISTORY',
    'QUESTION',
  ],
};

export interface Segment {
  id: PromptSegmentId;
  components: readonly ContextComponent[];
  /** null for the chart: an image has no text */
  text: string | null;
  /** the chart's reference, for the CHART segment */
  chartRef: string | null;
  /** its estimated size, the sum of its components */
  tokens: number;
  cacheable: boolean;
}

export type PromptPart =
  | { type: 'text'; segment: 'STATIC' | 'CYCLE' | 'USER'; text: string }
  | { type: 'chart'; ref: string };

export interface PromptMessage {
  role: 'system' | 'user';
  parts: PromptPart[];
}

/** What the gateway sends: a system message and a user message whose parts are in cache order. */
export interface Prompt {
  messages: PromptMessage[];
}

/** The segments from the text and size of each component. The chart has a size and no text. */
export function composeSegments(
  texts: Readonly<Record<ContextComponent, string | null>>,
  tokens: Readonly<Record<ContextComponent, number>>,
  chartRef: string | null
): Segment[] {
  return PROMPT_SEGMENTS.map((id) => {
    const components = SEGMENT_COMPONENTS[id];
    const sum = components.reduce((total, c) => total + tokens[c], 0);
    if (id === 'CHART') {
      return {
        id,
        components,
        text: null,
        chartRef,
        tokens: sum,
        cacheable: false,
      };
    }
    return {
      id,
      components,
      text: components.map((c) => texts[c] ?? '').join(''),
      chartRef: null,
      tokens: sum,
      cacheable: id === 'STATIC' || id === 'CYCLE',
    };
  });
}

export function composePrompt(segments: readonly Segment[]): Prompt {
  const text = (id: 'STATIC' | 'CYCLE' | 'USER'): PromptPart => {
    const segment = segments.find((s) => s.id === id) as Segment;
    return { type: 'text', segment: id, text: segment.text as string };
  };
  const chart = segments.find((s) => s.id === 'CHART') as Segment;
  const userParts: PromptPart[] = [text('CYCLE')];
  if (chart.chartRef !== null) {
    userParts.push({ type: 'chart', ref: chart.chartRef });
  }
  userParts.push(text('USER'));
  return {
    messages: [
      { role: 'system', parts: [text('STATIC')] },
      { role: 'user', parts: userParts },
    ],
  };
}

/** The text parts of a prompt in order, joined: what structure checks and hashes read. */
export function promptText(prompt: Prompt): string {
  return prompt.messages
    .flatMap((message) => message.parts)
    .map((part) => (part.type === 'text' ? part.text : ''))
    .join('');
}

/** The shared prefix: the static segment then the cycle block. */
export function prefixOf(segments: readonly Segment[]): {
  text: string;
  tokens: number;
} {
  const parts = segments.filter((s) => s.id === 'STATIC' || s.id === 'CYCLE');
  return {
    text: parts.map((s) => s.text ?? '').join(''),
    tokens: parts.reduce((total, s) => total + s.tokens, 0),
  };
}
