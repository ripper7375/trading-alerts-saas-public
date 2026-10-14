/**
 * @jest-environment node
 */

import { fitToBudget, startForm } from '@/lib/reply/context/cut';
import type { CutResult, Form, Ladder } from '@/lib/reply/context/cut';
import { CONTEXT_COMPONENTS } from '@/lib/reply/contracts/trace-fields';
import type { ContextComponent } from '@/lib/reply/contracts/trace-fields';

import { lcg } from './helpers/context-fixtures';

/** The ranks of ADR-048 / architecture 5.4. */
const RANK: Record<ContextComponent, number | null> = {
  SYSTEM_RULES: null,
  BOARD_SYNTHESIS: null,
  OHLC: 3,
  CHART: null,
  READINGS_ZONES: 4,
  KNOWLEDGE: 2,
  PROFILE_EVENTS: null,
  HISTORY: 1,
  QUESTION: null,
  ANSWER: null,
};

const forms = (...sizes: number[]): Form[] =>
  sizes.map((tokens, index) => ({ label: `F${index}`, tokens }));

/** Ladders for every component; `sizes` overrides the single form of the ones named. */
function ladders(
  sizes: Partial<Record<ContextComponent, number[]>>,
  start: Partial<Record<ContextComponent, number>> = {}
): Ladder[] {
  return CONTEXT_COMPONENTS.map((id) => ({
    id,
    rank: RANK[id],
    forms: forms(...(sizes[id] ?? [100])),
    start: start[id] ?? 0,
  }));
}

const total = (list: Ladder[], chosen: Record<string, number>): number =>
  list.reduce(
    (sum, l) => sum + (l.forms[chosen[l.id] ?? l.start] as Form).tokens,
    0
  );

function must(result: CutResult): Extract<CutResult, { ok: true }> {
  if (!result.ok) throw new Error(`refused at ${result.total}`);
  return result;
}

describe('startForm: the fullest form within the cap', () => {
  it('picks the first form that fits', () => {
    expect(startForm(forms(900, 600, 300), 1000)).toBe(0);
    expect(startForm(forms(900, 600, 300), 899)).toBe(1);
    expect(startForm(forms(900, 600, 300), 599)).toBe(2);
  });

  it('fits a form that is exactly the cap', () => {
    expect(startForm(forms(900, 600, 300), 900)).toBe(0);
    expect(startForm(forms(900, 600, 300), 600)).toBe(1);
    expect(startForm(forms(900, 600, 300), 300)).toBe(2);
  });

  it('falls to the smallest form when none fits', () => {
    expect(startForm(forms(900, 600, 300), 299)).toBe(2);
    expect(startForm(forms(900, 600, 300), 0)).toBe(2);
  });

  it('is zero for a single form, whatever the cap', () => {
    expect(startForm(forms(900), 10)).toBe(0);
    expect(startForm(forms(900), 5000)).toBe(0);
  });
});

describe('fitToBudget: nothing to cut', () => {
  it('leaves everything alone when the total is within the budget, even exactly at it', () => {
    const list = ladders({ OHLC: [800, 50], HISTORY: [300, 20] });
    const sum = total(list, {});
    const exact = must(fitToBudget(list, sum));
    expect(exact.steps).toEqual([]);
    expect(exact.total).toBe(sum);
    expect(exact.chosen.OHLC).toBe(0);
    const roomy = must(fitToBudget(list, sum + 1));
    expect(roomy.steps).toEqual([]);
  });

  it('starts every ladder where it is told to start', () => {
    const list = ladders(
      { OHLC: [800, 50], HISTORY: [300, 20, 10] },
      { OHLC: 1, HISTORY: 2 }
    );
    const result = must(fitToBudget(list, 100_000));
    expect(result.chosen.OHLC).toBe(1);
    expect(result.chosen.HISTORY).toBe(2);
    expect(result.total).toBe(8 * 100 + 50 + 10);
  });
});

describe('fitToBudget: the order of ADR-048', () => {
  const LONG = (): Ladder[] =>
    ladders({
      HISTORY: [400, 300, 200, 100],
      KNOWLEDGE: [400, 300, 200],
      OHLC: [800, 100],
      READINGS_ZONES: [500, 200],
    });
  const FULL_TOTAL = total(LONG(), {});

  it('cuts one form of history first', () => {
    const result = must(fitToBudget(LONG(), FULL_TOTAL - 1));
    expect(result.steps).toEqual([
      {
        component: 'HISTORY',
        from: 'F0',
        to: 'F1',
        totalAfter: FULL_TOTAL - 100,
      },
    ]);
  });

  it('uses up the history before it touches the knowledge', () => {
    const result = must(fitToBudget(LONG(), FULL_TOTAL - 300 - 1));
    expect(result.steps.map((s) => s.component)).toEqual([
      'HISTORY',
      'HISTORY',
      'HISTORY',
      'KNOWLEDGE',
    ]);
    expect(result.chosen.HISTORY).toBe(3);
    expect(result.chosen.KNOWLEDGE).toBe(1);
  });

  it('then the knowledge, then the OHLC, then the details of the readings', () => {
    const result = must(
      fitToBudget(LONG(), FULL_TOTAL - 300 - 200 - 700 - 300)
    );
    expect(result.steps.map((s) => s.component)).toEqual([
      'HISTORY',
      'HISTORY',
      'HISTORY',
      'KNOWLEDGE',
      'KNOWLEDGE',
      'OHLC',
      'READINGS_ZONES',
    ]);
    expect(result.chosen).toMatchObject({
      HISTORY: 3,
      KNOWLEDGE: 2,
      OHLC: 1,
      READINGS_ZONES: 1,
    });
  });

  it('stops as soon as the total fits: no further than it must', () => {
    for (let budget = FULL_TOTAL; budget >= FULL_TOTAL - 1500; budget -= 50) {
      const result = must(fitToBudget(LONG(), budget));
      expect(result.total).toBeLessThanOrEqual(budget);
      if (result.steps.length > 0) {
        const previousTotal =
          result.steps.length > 1
            ? (result.steps[result.steps.length - 2] as { totalAfter: number })
                .totalAfter
            : FULL_TOTAL;
        expect(previousTotal).toBeGreaterThan(budget);
      }
    }
  });

  it('reports the total after each step as the sum of the chosen forms', () => {
    const result = must(fitToBudget(LONG(), FULL_TOTAL - 1200));
    const replay = LONG();
    const chosen: Record<string, number> = {};
    for (const l of replay) chosen[l.id] = l.start;
    for (const step of result.steps) {
      chosen[step.component] = (chosen[step.component] as number) + 1;
      expect(step.totalAfter).toBe(total(replay, chosen));
      const ladder = replay.find((l) => l.id === step.component) as Ladder;
      expect(ladder.forms[(chosen[step.component] as number) - 1]?.label).toBe(
        step.from
      );
      expect(ladder.forms[chosen[step.component] as number]?.label).toBe(
        step.to
      );
    }
  });

  it('never touches a component that has no rank, however large it is', () => {
    const list = ladders({
      SYSTEM_RULES: [5000],
      BOARD_SYNTHESIS: [5000],
      PROFILE_EVENTS: [5000],
      QUESTION: [5000],
      HISTORY: [400, 100],
    });
    const result = fitToBudget(list, 100);
    expect(result.ok).toBe(false);
    expect(result.chosen.SYSTEM_RULES).toBe(0);
    expect(result.chosen.BOARD_SYNTHESIS).toBe(0);
    expect(result.chosen.PROFILE_EVENTS).toBe(0);
    expect(result.chosen.QUESTION).toBe(0);
    // the ranked ones are cut to the bone before it gives up
    expect(result.chosen.HISTORY).toBe(1);
  });

  it('never cuts a ladder with no rank, even one that has smaller forms', () => {
    const list: Ladder[] = [
      { id: 'SYSTEM_RULES', rank: null, forms: forms(500, 100), start: 0 },
      { id: 'HISTORY', rank: 1, forms: forms(400, 300), start: 0 },
    ];
    const refused = fitToBudget(list, 450);
    expect(refused).toMatchObject({
      ok: false,
      code: 'CONTEXT_OVER_BUDGET',
      total: 800,
    });
    expect(refused.chosen).toEqual({ SYSTEM_RULES: 0, HISTORY: 1 });
    expect(refused.steps.map((s) => s.component)).toEqual(['HISTORY']);
  });

  it('cuts the first of two ladders that share a rank (the list is the tie-break)', () => {
    const list: Ladder[] = [
      { id: 'HISTORY', rank: 1, forms: forms(400, 100), start: 0 },
      { id: 'KNOWLEDGE', rank: 1, forms: forms(400, 100), start: 0 },
    ];
    const result = fitToBudget(list, 700);
    expect(result.ok).toBe(true);
    expect(result.steps.map((s) => s.component)).toEqual(['HISTORY']);
    const both = fitToBudget(list, 200);
    expect(both.steps.map((s) => s.component)).toEqual([
      'HISTORY',
      'KNOWLEDGE',
    ]);
  });

  it('takes the next form of a ladder even when the next form is not smaller (it is a step all the same)', () => {
    const list = ladders({ HISTORY: [400, 400, 100] });
    // nine components of 100 and the history: 1,300 at F0 and at F1, 1,000 at F2
    const result = must(fitToBudget(list, 1000));
    expect(result.steps.map((s) => `${s.from}>${s.to}`)).toEqual([
      'F0>F1',
      'F1>F2',
    ]);
  });

  it('only steps a ladder that still has a smaller form', () => {
    const list = ladders({ HISTORY: [400], KNOWLEDGE: [400, 300] });
    const result = must(fitToBudget(list, 100 * 8 + 400 + 400 - 1));
    expect(result.steps.map((s) => s.component)).toEqual(['KNOWLEDGE']);
  });
});

describe('fitToBudget: refusal', () => {
  it('refuses with CONTEXT_OVER_BUDGET when everything that can be cut is cut and it is still over', () => {
    const list = ladders({
      HISTORY: [400, 100],
      KNOWLEDGE: [400, 100],
      OHLC: [800, 100],
      READINGS_ZONES: [500, 200],
    });
    const smallest = 100 * 6 + 100 + 100 + 100 + 200;
    const refused = fitToBudget(list, smallest - 1);
    expect(refused).toMatchObject({
      ok: false,
      code: 'CONTEXT_OVER_BUDGET',
      total: smallest,
    });
    expect(refused.chosen).toMatchObject({
      HISTORY: 1,
      KNOWLEDGE: 1,
      OHLC: 1,
      READINGS_ZONES: 1,
    });
    expect(refused.steps).toHaveLength(4);
    const fits = fitToBudget(list, smallest);
    expect(fits.ok).toBe(true);
  });

  it('refuses at once when nothing can be cut at all', () => {
    const refused = fitToBudget(ladders({}), 10);
    expect(refused).toMatchObject({
      ok: false,
      code: 'CONTEXT_OVER_BUDGET',
      total: 1000,
      steps: [],
    });
  });

  it('accepts a budget of exactly the total', () => {
    expect(fitToBudget(ladders({}), 1000).ok).toBe(true);
    expect(fitToBudget(ladders({}), 999).ok).toBe(false);
  });
});

describe('the cut order over every subset of the four cuttable components', () => {
  const CUTTABLE = ['HISTORY', 'KNOWLEDGE', 'OHLC', 'READINGS_ZONES'] as const;
  const BY_RANK = [...CUTTABLE].sort(
    (a, b) => (RANK[a] as number) - (RANK[b] as number)
  );

  for (let mask = 1; mask < 16; mask += 1) {
    const subset = CUTTABLE.filter((_, bit) => (mask >> bit) & 1);
    it(`with room in ${subset.join(' + ')}, the first cut is ${BY_RANK.find((id) => subset.includes(id as never))} and the last resort is the highest rank`, () => {
      const sizes: Partial<Record<ContextComponent, number[]>> = {};
      for (const id of subset) sizes[id] = [100, 60, 20];
      const list = ladders(sizes);
      const full = total(list, {});
      const first = must(fitToBudget(list, full - 1));
      expect(first.steps[0]?.component).toBe(
        BY_RANK.find((id) => (subset as readonly string[]).includes(id))
      );
      expect(first.steps).toHaveLength(1);
      // pushed to the limit, every ladder of the subset is used up in rank order, and nothing else moves
      const floor = full - subset.length * 80;
      const limit = must(fitToBudget(list, floor));
      const sequence = limit.steps.map((s) => s.component);
      const ranks = sequence.map((id) => RANK[id] as number);
      expect([...ranks].sort((a, b) => a - b)).toEqual(ranks);
      expect(new Set(sequence)).toEqual(new Set(subset));
      expect(fitToBudget(list, floor - 1).ok).toBe(false);
    });
  }
});

describe('property: random requests over lowered budgets (seeded)', () => {
  const random = lcg(48);
  const pick = (n: number): number => Math.floor(random() * n);

  function randomLadders(): Ladder[] {
    return CONTEXT_COMPONENTS.map((id) => {
      const count = RANK[id] === null ? 1 : 1 + pick(6);
      let size = 50 + pick(900);
      const sizes: number[] = [];
      for (let i = 0; i < count; i += 1) {
        sizes.push(size);
        size = Math.max(0, size - pick(300));
      }
      return { id, rank: RANK[id], forms: forms(...sizes), start: pick(count) };
    });
  }

  it('holds the four laws for 3,000 random requests', () => {
    for (let run = 0; run < 3000; run += 1) {
      const list = randomLadders();
      const startTotal = total(
        list,
        Object.fromEntries(list.map((l) => [l.id, l.start]))
      );
      const budget = pick(Math.floor(startTotal * 1.2) + 1);
      const result = fitToBudget(list, budget);

      // 1. unranked components never move
      for (const l of list) {
        if (l.rank === null) expect(result.chosen[l.id]).toBe(l.start);
        expect(result.chosen[l.id]).toBeGreaterThanOrEqual(l.start);
        expect(result.chosen[l.id]).toBeLessThanOrEqual(l.forms.length - 1);
      }
      // 2. the total is what the chosen forms add up to
      expect(result.total).toBe(total(list, result.chosen));
      // 3. a ladder is used up before the next rank is touched: replay the steps
      const at: Record<string, number> = {};
      for (const l of list) at[l.id] = l.start;
      for (const step of result.steps) {
        const rank = RANK[step.component] as number;
        for (const l of list) {
          if (l.rank !== null && l.rank < rank) {
            expect(at[l.id]).toBe(l.forms.length - 1);
          }
        }
        at[step.component] = (at[step.component] as number) + 1;
      }
      expect(at).toEqual(result.chosen);
      // 4. it fits, or nothing that can be cut is left
      if (result.ok) {
        expect(result.total).toBeLessThanOrEqual(budget);
        if (result.steps.length > 0) {
          const previous =
            result.steps.length > 1
              ? (
                  result.steps[result.steps.length - 2] as {
                    totalAfter: number;
                  }
                ).totalAfter
              : startTotal;
          expect(previous).toBeGreaterThan(budget);
        }
      } else {
        expect(result.total).toBeGreaterThan(budget);
        for (const l of list) {
          if (l.rank !== null)
            expect(result.chosen[l.id]).toBe(l.forms.length - 1);
        }
      }
    }
  });
});
