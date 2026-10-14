/**
 * From the assembler's prompt to the gateway's messages (build step 7 part 3; architecture 5.4,
 * ADR-049).
 *
 * Part 2's assembler gives a provider-neutral `Prompt`: a system message and a user message whose
 * parts are in cache order, with the chart as an opaque reference (`ChartInput.ref`). The gateway
 * sends `ChatMessage`s: text, and images by URL. This is the seam between the two, and it is the
 * only place that decides what is cacheable: the STATIC segment (the rules) and the CYCLE segment
 * (the board and the day of OHLC) are the same for many requests, so they are marked
 * `cacheable`; the chart and the user's part are not. Whether the mark then becomes a cache
 * breakpoint is the model's `prompt_caching` flag, decided in `wireMessages`.
 *
 * A chart reference with no URL in `charts` is dropped and named in `unresolved_charts`, never sent
 * as an empty image: whether the model sees a chart is the answer gate's call (part 5), and a
 * reply that says "chart dropped" needs to know it.
 *
 * Pure: no I/O, no clock, no randomness.
 *
 * @module lib/reply/gateway/messages
 */

import type { Prompt } from '../context/segments';

import type { ChatMessage, ContentPart } from './types';

export interface PromptMessages {
  messages: ChatMessage[];
  /** chart references the prompt carried that had no image to send */
  unresolved_charts: string[];
}

/** `charts` maps a chart reference to an https or `data:` image URL. */
export function messagesFromPrompt(
  prompt: Prompt,
  charts: Readonly<Record<string, string>> = {}
): PromptMessages {
  const unresolved: string[] = [];
  const messages: ChatMessage[] = [];
  for (const message of prompt.messages) {
    const parts: ContentPart[] = [];
    for (const part of message.parts) {
      if (part.type === 'text') {
        parts.push({
          type: 'text',
          text: part.text,
          cacheable: part.segment === 'STATIC' || part.segment === 'CYCLE',
        });
      } else if (
        Object.prototype.hasOwnProperty.call(charts, part.ref) &&
        typeof charts[part.ref] === 'string'
      ) {
        parts.push({ type: 'image', url: charts[part.ref] as string });
      } else {
        unresolved.push(part.ref);
      }
    }
    messages.push({ role: message.role, content: parts });
  }
  return { messages, unresolved_charts: unresolved };
}
