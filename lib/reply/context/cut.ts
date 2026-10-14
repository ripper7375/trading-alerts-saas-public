/**
 * The cut order (build step 7 part 2; architecture 5.4, ADR-048, ADR-041).
 *
 * Each component of the prompt is a LADDER of forms, fullest first, each with its size in
 * tokens: the history is its last messages written out, then fewer, then none and a summary;
 * the knowledge is its chunks and expansions, then fewer; the OHLC is the full day, then the
 * summary; the readings are full, then with their details dropped. A component with one form
 * cannot be cut. A ladder has a RANK, the order of ADR-048: 1 is cut first, 4 last; a ladder
 * with no rank is never cut, whatever its size.
 *
 * `startForm` puts a component in the fullest form that fits its OWN cap (the "when over" column).
 * `fitToBudget` then takes the request's total and, while it is over the budget, moves the
 * lowest-ranked ladder that still has a smaller form down by exactly one form and looks again:
 *
 *   history -> knowledge -> OHLC -> reading details
 *
 * so a ladder is used up before the next rank is touched, and the request is cut no further than
 * it must be. If every cuttable ladder is at its smallest form and the total is still over the
 * budget, the result is a REFUSAL with the code `CONTEXT_OVER_BUDGET`: the board, the warnings,
 * the profile and events, the question and the rules are never reduced to make room, and a prompt
 * that cannot fit without them does not go to a model.
 *
 * Pure.
 *
 * @module lib/reply/context/cut
 */

import type { ContextComponent } from '../contracts/trace-fields';

export interface Form {
  /** what the form is, for the trace: `FULL`, `SUMMARY`, `VERBATIM_7` ... */
  label: string;
  /** its estimated size, in tokens */
  tokens: number;
}

export interface Ladder {
  id: ContextComponent;
  /** 1 (cut first) to 4; null: never cut */
  rank: number | null;
  /** fullest first; at least one */
  forms: readonly Form[];
  /** the index of the form the component starts in */
  start: number;
}

export interface CutStep {
  component: ContextComponent;
  from: string;
  to: string;
  /** the request's total after this step */
  totalAfter: number;
}

export type CutResult =
  | {
      ok: true;
      /** the index of the chosen form, per component */
      chosen: Record<ContextComponent, number>;
      steps: CutStep[];
      total: number;
    }
  | {
      ok: false;
      code: 'CONTEXT_OVER_BUDGET';
      chosen: Record<ContextComponent, number>;
      steps: CutStep[];
      total: number;
    };

/** The index of the fullest form that is within `cap`; the smallest form when none is. */
export function startForm(forms: readonly Form[], cap: number): number {
  const found = forms.findIndex((form) => form.tokens <= cap);
  return found === -1 ? forms.length - 1 : found;
}

function totalOf(
  ladders: readonly Ladder[],
  chosen: Record<string, number>
): number {
  let total = 0;
  for (const ladder of ladders) {
    total += (ladder.forms[chosen[ladder.id] as number] as Form).tokens;
  }
  return total;
}

/**
 * Cut the request down to `budget` in the order of the ranks, or refuse. The ladders must have
 * one entry per component, forms with whole non-negative token counts, and a start inside the
 * ladder; the assembler builds them, a test builds many.
 */
export function fitToBudget(
  ladders: readonly Ladder[],
  budget: number
): CutResult {
  const chosen = {} as Record<ContextComponent, number>;
  for (const ladder of ladders) chosen[ladder.id] = ladder.start;
  const steps: CutStep[] = [];
  for (;;) {
    const total = totalOf(ladders, chosen);
    if (total <= budget) return { ok: true, chosen, steps, total };
    let next: Ladder | null = null;
    for (const ladder of ladders) {
      if (ladder.rank === null) continue;
      if (chosen[ladder.id] >= ladder.forms.length - 1) continue;
      if (next === null || ladder.rank < (next.rank as number)) next = ladder;
    }
    if (next === null) {
      return { ok: false, code: 'CONTEXT_OVER_BUDGET', chosen, steps, total };
    }
    const from = next.forms[chosen[next.id]] as Form;
    chosen[next.id] += 1;
    const to = next.forms[chosen[next.id]] as Form;
    steps.push({
      component: next.id,
      from: from.label,
      to: to.label,
      totalAfter: totalOf(ladders, chosen),
    });
  }
}
