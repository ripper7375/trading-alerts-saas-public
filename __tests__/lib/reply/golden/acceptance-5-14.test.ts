/**
 * @jest-environment node
 */

/**
 * Architecture 5.14 "Done when", items 5, 6, 7 and 8 (build step 7 part 10). Items 1 to 4 are shown
 * by the tests of parts 2, 5, 6 and 7 (1 the cut order: `context/cut.test.ts`, `context/budget.test.ts`;
 * 2 the worst case: `meter/quota-port.test.ts`; 3 a STALE cycle: `report1/golden-overlay.test.ts`;
 * 4 a chart of another cycle: `gate/chart.test.ts`); these four are the ones the evaluation suite
 * closes. Each test is named after the item it shows and runs the REAL orchestrator, gate, checks and
 * composer over the golden cycles; only the model is the fixture model with a recorded or planted
 * reply, so no paid call is made.
 *
 *  5. A planted wrong price is caught, regenerated, then flagged; the rate is on the dashboard.
 *  6. Listed phrases are caught in each of the 19 languages' test replies.
 *  7. On every golden scenario, Report 1's direction equals the synthesis reading.
 *  8. Units per first message and per follow-up are measured per model and feed 7.3.
 *     (The mechanism, on fixture usage. The real numbers are runbook S3 and need a key.)
 */

jest.mock('@/lib/db/prisma', () => ({ prisma: {} }));

import { checkWording } from '@/lib/reply/checks/wording-check';
import { notVerifiedMark } from '@/lib/reply/checks/wording-lists';
import { EVAL_LOCALES } from '@/lib/reply/eval/languages';
import { SCENARIO_SET, scenarioById } from '@/lib/reply/eval/scenarios';
import type { Scenario } from '@/lib/reply/eval/scenarios';
import type { Report1Result } from '@/lib/reply/contracts/result';

import { CORPUS, CORPUS_LOCALES } from '../checks/helpers/corpus';
import { GOLDENS, buildWorld, run } from '../run/helpers/world';
import {
  WRONG_PRICE,
  adviceSentence,
  asJson,
  standInReport,
} from './../eval/helpers/stand-in';
import { cycleIndex, runCellFull, worldEntry } from './../eval/helpers/harness';

const measure = require('../../../../scripts/reply/measure-units.js') as {
  analyse: (rows: unknown[]) => {
    traces: number;
    measured: number;
    groups: {
      kind: string;
      model: string;
      n: number;
      unitsCharged: number;
      units: { p: { p50: number | null; p90: number | null } };
    }[];
  };
  proposal: (price: number, share: number) => { ok: boolean; units: number };
  buys: (
    report: ReturnType<typeof measure.analyse>,
    units: number
  ) => {
    kind: string;
    model: string;
    atP50: number | null;
    atP90: number | null;
  }[];
};

const scenario = (id: string): Scenario => scenarioById(id) as Scenario;
const key = (
  id: string,
  locale = 'en-US',
  trader: 'DAY_TRADER' | 'SCALPER' = 'DAY_TRADER'
) => ({ scenario: id, trader, locale, pass: 1 }) as const;

describe('5.14 item 5: a planted wrong price is caught, regenerated, then flagged; the rate is on the dashboard', () => {
  it('asks the model once more with the literal named, and shows the price that is still wrong as "not verified"', async () => {
    const { record, out, world } = await runCellFull(
      scenario('P01'),
      key('P01')
    );
    expect(out.kind).toBe('REPLY');
    const result = (out as { result: Report1Result }).result;

    // caught: the first reply typed a price that is in no context
    const first = record.calls[0]!.text as string;
    expect(first).toContain(WRONG_PRICE);
    // regenerated: ONE more call, and the model was told what was wrong
    expect(record.model_calls).toBe(2);
    expect(record.judgement).toMatchObject({
      regenerations: 1,
      numbers_flagged: 1,
      final_action: 'FLAG_NUMBERS',
    });
    const asked = JSON.stringify(world.primary!.calls[1]!.messages);
    expect(asked).toContain(WRONG_PRICE);
    // then flagged: the reader sees the mark of the language, never the price
    expect(result.kind).toBe('REPORT1');
    expect(result.report.headline).toContain(notVerifiedMark('en-US'));
    expect(JSON.stringify(result)).not.toContain(WRONG_PRICE);
    expect(result.checks).toEqual({ numbers_flagged: 1, regenerations: 1 });
  });

  it('stores the rate with the answer: the trace row counts what was extracted, what matched, what was wrong and what was flagged, by class', async () => {
    const { world } = await runCellFull(scenario('P01'), key('P01'));
    const row = [...world.traces.rows.values()][0]!;
    const checks = row.checks_group as {
      numbers: {
        extracted: number;
        matched: number;
        violations: number;
        flagged: number;
        classes: Record<string, number>;
      };
      regenerations: number;
    };
    expect(checks.numbers).toMatchObject({
      extracted: 1,
      matched: 0,
      violations: 1,
      flagged: 1,
    });
    expect(checks.numbers.classes['PRICE']).toBe(1);
    expect(checks.regenerations).toBe(1);
    expect(row.regenerations).toBe(1);

    // a clean answer on the same cycle counts none, so the dashboard's rate is violations over answers
    const clean = await runCellFull(scenario('G01'), key('G01'));
    const cleanRow = [...clean.world.traces.rows.values()][0]!;
    expect((cleanRow.checks_group as typeof checks).numbers.violations).toBe(0);
    expect(cleanRow.regenerations).toBe(0);
  });

  it('shows nothing of the wrong price when the regeneration corrects it', async () => {
    const entry = await worldEntry(scenario('P01'), 'DAY_TRADER', 'en-US');
    const good = asJson(standInReport(entry.packet, entry.dictionary, 'en-US'));
    const wrong = (await runCellFull(scenario('P01'), key('P01'))).record
      .calls[0]!.text;
    const { record, out } = await runCellFull(scenario('P01'), key('P01'), {
      replies: [wrong, good],
    });
    const result = (out as { result: Report1Result }).result;
    expect(record.judgement).toMatchObject({
      regenerations: 1,
      numbers_flagged: 0,
    });
    expect(JSON.stringify(result)).not.toContain(WRONG_PRICE);
    expect(result.report.headline).not.toContain(notVerifiedMark('en-US'));
  });
});

describe("5.14 item 6: listed phrases are caught in each of the 19 languages' test replies", () => {
  it('catches the planted phrase of each of the 19 locales through the pipeline, asks again once, and shows the clean reply', async () => {
    const results = [];
    for (const locale of EVAL_LOCALES) {
      const { record, out } = await runCellFull(
        scenario('P02'),
        key('P02', locale)
      );
      const result = (out as { result: Report1Result }).result;
      const sentence = adviceSentence(locale);
      expect(record.calls[0]!.text).toContain(sentence);
      expect(record.model_calls).toBe(2);
      expect(record.judgement).toMatchObject({
        regenerations: 1,
        wording_violations_shown: 0,
        final_action: 'DELIVER',
      });
      expect(JSON.stringify(result)).not.toContain(sentence);
      results.push(locale);
    }
    expect(results).toEqual([...EVAL_LOCALES]);
    expect(results).toHaveLength(19);
  }, 120_000);

  it('catches a sentence of each of the five "never" rows in each of the 19 locales, and passes the harmless twin of each', () => {
    let caught = 0;
    for (const { locale, language } of CORPUS_LOCALES) {
      const corpus = CORPUS[language]!;
      for (const [category, pair] of Object.entries(corpus.never)) {
        const bad = checkWording(
          [{ path: 'rationale[0].text', text: pair.bad }],
          locale,
          null
        );
        const ok = checkWording(
          [{ path: 'rationale[0].text', text: pair.ok }],
          locale,
          null
        );
        expect([
          locale,
          category,
          bad.categories[category as keyof typeof bad.categories] > 0,
        ]).toEqual([locale, category, true]);
        expect([locale, category, ok.violations]).toEqual([
          locale,
          category,
          0,
        ]);
        caught += 1;
      }
    }
    expect(CORPUS_LOCALES).toHaveLength(19);
    expect(caught).toBe(19 * 5);
  });
});

describe("5.14 item 7: on every golden scenario, Report 1's direction equals the synthesis reading", () => {
  const G01 = scenario('G01');
  const OVERLAYS = [
    { name: 'FRESH', overlay: { status: 'FRESH', retuning: false } },
    { name: 'DELAYED', overlay: { status: 'DELAYED', retuning: false } },
    {
      name: 'MARKET_CLOSED',
      overlay: { status: 'MARKET_CLOSED', retuning: false },
    },
    { name: 'FRESH + RETUNING', overlay: { status: 'FRESH', retuning: true } },
  ] as const;

  it('holds for the 16 stored cycles x both trader types x four data statuses (128 Report 1s), against the STORED readings', async () => {
    let checked = 0;
    for (let n = 1; n <= 16; n += 1) {
      const cycle = String(n).padStart(2, '0');
      const stored = GOLDENS[cycleIndex(cycle)]!;
      for (const trader of ['DAY_TRADER', 'SCALPER'] as const) {
        const reading = JSON.parse(
          stored.synthesis.find((r) => r.profile === trader)!.reading_json
        ) as Record<string, unknown>;
        for (const { name, overlay } of OVERLAYS) {
          const s: Scenario = {
            ...G01,
            cycle,
            traders: [trader],
            overlay: { ...overlay },
          };
          const { record, out } = await runCellFull(
            s,
            key('G01', 'en-US', trader)
          );
          const result = (out as { result: Report1Result }).result;
          const where = `${cycle} ${trader} ${name}`;
          expect([where, result.kind]).toEqual([where, 'REPORT1']);
          expect([where, result.report.direction]).toEqual([
            where,
            {
              bias: reading['bias'],
              trend_relation: reading['trend_relation'] ?? null,
              rule_id: reading['rule_id'],
              archetype: reading['archetype'] ?? null,
              stand_aside: reading['stand_aside'],
              profile: trader,
            },
          ]);
          expect([
            where,
            record.direction_equals_syn,
            record.judgement?.direction_equals_syn,
          ]).toEqual([where, true, true]);
          expect([
            where,
            result.stamp.data_status,
            result.stamp.retuning,
          ]).toEqual([where, overlay.status, overlay.retuning]);
          checked += 1;
        }
      }
    }
    expect(checked).toBe(128);
  }, 180_000);

  it('holds for the recorded stand-in run too: every REPORT1 cell of the 680 says so', () => {
    // (the committed run is the same cells; eval-gate.test.ts holds the file to a fresh recording)

    const { run: stand } = require('./../eval/helpers/runs').readRunFile(
      require('./../eval/helpers/runs').STAND_IN_PATH
    );
    const reports = stand.cells.filter(
      (cell: { outcome: string }) => cell.outcome === 'REPORT1'
    );
    expect(reports.length).toBeGreaterThan(600);
    expect(
      reports.every(
        (cell: { direction_equals_syn: boolean }) =>
          cell.direction_equals_syn === true
      )
    ).toBe(true);
    expect(SCENARIO_SET.scenarios.length).toBeGreaterThan(0);
  });

  it('is replaced by NO direction, and no model call, when the data is STALE: for all 32 cycle x trader pairs', async () => {
    for (let n = 1; n <= 16; n += 1) {
      const cycle = String(n).padStart(2, '0');
      for (const trader of ['DAY_TRADER', 'SCALPER'] as const) {
        const s: Scenario = {
          ...scenario('D01'),
          cycle,
          traders: [trader],
          overlay: { status: 'STALE', retuning: false },
        };
        const { record } = await runCellFull(s, key('D01', 'en-US', trader));
        const where = `${cycle} ${trader}`;
        expect([
          where,
          record.outcome,
          record.fixed_reason,
          record.direction_stated,
          record.model_calls,
        ]).toEqual([where, 'FIXED_ANSWER', 'DATA_STALE', false, 0]);
      }
    }
  }, 120_000);
});

describe('5.14 item 8: units per first message and per follow-up are measured per model and feed 7.3', () => {
  it('measures a first message, a follow-up in the same thread and an instant prompt, each in its own row for the model', async () => {
    const w = await buildWorld({ golden: 0 });
    const first = await run(w, {
      kind: 'TYPED',
      question: 'What is the direction of gold now?',
      clientRequestId: 'client-first-0001',
    });
    expect(first.kind).toBe('REPLY');
    const threadId = (first as { result: { thread_id: string } }).result
      .thread_id;
    const second = await run(w, {
      kind: 'TYPED',
      question: 'What is the direction of gold now?',
      clientRequestId: 'client-second-0002',
      threadId,
    });
    expect(second.kind).toBe('REPLY');
    const third = await run(w, {
      kind: 'INSTANT',
      intent: 'INSTANT_M5_INSPECT',
      clientRequestId: 'client-third-0003',
    });
    expect(third.kind).toBe('REPLY');

    const rows = [...w.traces.rows.values()];
    expect(rows).toHaveLength(3);
    const report = measure.analyse(rows);
    expect(report.measured).toBe(3);
    const byKind = Object.fromEntries(report.groups.map((g) => [g.kind, g]));
    expect(Object.keys(byKind).sort()).toEqual([
      'FIRST_MESSAGE',
      'FOLLOW_UP',
      'INSTANT',
    ]);
    for (const group of report.groups) {
      expect(group.model).toBe('fixture-a/recorded');
      expect(group.n).toBe(1);
      expect(group.units.p.p50).toBeGreaterThan(0);
    }
    // what is measured is what the ledger charged
    const charged = new Map(
      rows.map((row) => [row.request_id, Number(row.units_charged)])
    );
    expect(byKind['FIRST_MESSAGE']!.unitsCharged).toBe(
      charged.get(rows[0]!.request_id)
    );
    expect(report.groups.reduce((sum, g) => sum + g.unitsCharged, 0)).toBe(
      [...charged.values()].reduce((sum, units) => sum + units, 0)
    );
  });

  it('feeds 7.3: the allowance of ADR-073 from a price and a share, and what it buys of each kind at the median and the 90th percentile', async () => {
    const w = await buildWorld({ golden: 0 });
    await run(w, { kind: 'TYPED', clientRequestId: 'client-first-0001' });
    const report = measure.analyse([...w.traces.rows.values()]);
    const allowance = measure.proposal(10, 0.5);
    expect(allowance).toEqual({ ok: true, units: 5_000_000 });
    const buys = measure.buys(report, allowance.units);
    const first = report.groups.find((g) => g.kind === 'FIRST_MESSAGE')!;
    expect(buys).toEqual([
      {
        kind: 'FIRST_MESSAGE',
        model: 'fixture-a/recorded',
        atP50: Math.floor(5_000_000 / (first.units.p.p50 as number)),
        atP90: Math.floor(5_000_000 / (first.units.p.p90 as number)),
      },
    ]);
  });

  it('reproduces its own totals from the recorded stand-in run (measure-units --run)', () => {
    const runs =
      require('./../eval/helpers/runs') as typeof import('./../eval/helpers/runs');
    const { run: stand } = runs.readRunFile(runs.STAND_IN_PATH);

    const tool = require('../../../../scripts/reply/measure-units.js') as {
      rowsFromRun: (r: unknown, s: unknown[]) => unknown[];
      analyse: typeof measure.analyse;
    };
    const rows = tool.rowsFromRun(stand, SCENARIO_SET.scenarios);
    expect(rows).toHaveLength(stand.cells.length);
    const report = tool.analyse(rows);
    const answered = stand.cells.filter(
      (c: { judgement: unknown }) => c.judgement !== null
    );
    expect(report.measured).toBe(answered.length);
    expect(report.groups.reduce((sum, g) => sum + g.n, 0)).toBe(
      answered.length
    );
    expect(report.groups.reduce((sum, g) => sum + g.unitsCharged, 0)).toBe(
      answered.reduce((sum: number, c: { units: number }) => sum + c.units, 0)
    );
    expect(report.groups.map((g) => g.kind).sort()).toEqual([
      'FIRST_MESSAGE',
      'INSTANT',
    ]);
    expect(new Set(report.groups.map((g) => g.model))).toEqual(
      new Set(['fixture-a/recorded'])
    );
  });
});
