/**
 * The intent labels (architecture 4.5, ADR-036 and ADR-037).
 *
 * Eight labels come out of the one Understand call (ADR-039); the two instant
 * prompts carry labels of their own (4.2: they skip the Understand call, so the
 * model never returns them). Together they are the one list the router, the
 * packet, the trace and the labelled question set use.
 *
 * @module lib/intake/intents
 */

/** The eight labels of ADR-037: what the Understand call may return. */
export const UNDERSTAND_INTENTS = [
  'DIRECTION',
  'ENTRY_TIMING',
  'EXIT_TARGETS',
  'RISK_SIZING',
  'EXPLAIN',
  'NEWS',
  'REPORT_2',
  'OUT_OF_SCOPE',
] as const;

/** The two instant prompts of Panel C (4.2, 4.10): they never come from the model. */
export const INSTANT_INTENTS = [
  'INSTANT_M5_INSPECT',
  'INSTANT_M15_INSPECT',
] as const;

export const INTENTS = [...UNDERSTAND_INTENTS, ...INSTANT_INTENTS] as const;

export type UnderstandIntent = (typeof UNDERSTAND_INTENTS)[number];
export type InstantIntent = (typeof INSTANT_INTENTS)[number];
export type Intent = (typeof INTENTS)[number];

/**
 * An intent a PACKET can carry: every label but OUT_OF_SCOPE. A question that is
 * out of scope is answered by a fixed reply (`intake-refusal/1`) and nothing
 * else runs, so no packet is ever built for it (4.2 step 3).
 */
export type PacketIntent = Exclude<Intent, 'OUT_OF_SCOPE'>;

export const PACKET_INTENTS: readonly PacketIntent[] = INTENTS.filter(
  (intent): intent is PacketIntent => intent !== 'OUT_OF_SCOPE'
);

const asStrings = (list: readonly string[]): readonly string[] => list;

export function isIntent(value: unknown): value is Intent {
  return typeof value === 'string' && asStrings(INTENTS).includes(value);
}

export function isUnderstandIntent(value: unknown): value is UnderstandIntent {
  return (
    typeof value === 'string' && asStrings(UNDERSTAND_INTENTS).includes(value)
  );
}

export function isInstantIntent(value: unknown): value is InstantIntent {
  return (
    typeof value === 'string' && asStrings(INSTANT_INTENTS).includes(value)
  );
}

export function isPacketIntent(value: unknown): value is PacketIntent {
  return isIntent(value) && value !== 'OUT_OF_SCOPE';
}

/** The chart an instant prompt is about (4.2: "intent Explain scoped to M5 or M15"). */
export function instantTimeframe(intent: InstantIntent): 'M5' | 'M15' {
  return intent === 'INSTANT_M5_INSPECT' ? 'M5' : 'M15';
}
