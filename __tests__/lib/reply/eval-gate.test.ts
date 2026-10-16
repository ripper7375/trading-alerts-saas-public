/**
 * @jest-environment node
 */

/**
 * The evaluation gate (build step 7 part 10; architecture 5.10: "a model joins only after passing",
 * 7.7: the release gate; plan part 10 items 3 and 4).
 *
 * Three things are shown here, each by running the real code and then by breaking it on purpose:
 *
 *  1. THE STAND-IN RUN that is committed is the run a fresh recording gives, byte for byte, with
 *     zero model calls, and its fingerprint is the CURRENT one. If the checks, the prompt, the wording
 *     lists, the caps or the scenarios move, this fails and says which, until the run is recorded
 *     again (`node scripts/reply/eval-run.js --stand-in --write`).
 *  2. THE GATE over the registry: a model in `config/ai-models.ts` is `passed` only with a LIVE run
 *     for the current fingerprint whose bars all hold. Today no row is `passed`, so the gate is open
 *     for the right reason, and the day someone flips a row without a run this file goes red.
 *  3. THE GATE FAILS, on purpose, for each way a model could be let in wrongly: a `passed` model with
 *     no run, a run that is missing, a stand-in run offered as evidence, a run for another model, a
 *     stale fingerprint (each of its four moving parts), a language 6 points under English, a
 *     direction that is not the synthesis reading's, an unverified number or a listed phrase shown, a
 *     schema that stayed wrong, languages not all listed.
 *
 * THE STAND-IN IS NOT EVIDENCE. Every assertion about it says what it is; none says anything about a
 * model.
 */

jest.mock('@/lib/db/prisma', () => ({ prisma: {} }));

import { AI_MODELS } from '@/config/ai-models';
import { currentFingerprint } from '@/lib/reply/eval/fingerprint';
import type { CurrentParts } from '@/lib/reply/eval/fingerprint';
import { renderRunReport } from '@/lib/reply/eval/report';
import { SCENARIO_SET } from '@/lib/reply/eval/scenarios';
import {
  STAND_IN_LABEL,
  evalGate,
  expectationProblems,
  replayRun,
  runFileText,
  runProblems,
  summarizeCells,
} from '@/lib/reply/eval/suite';
import type { EvalRun, GateModel, GateProblem } from '@/lib/reply/eval/suite';

import {
  STAND_IN_MODEL,
  judgeWorldsFor,
  recordRun,
} from './eval/helpers/harness';
import {
  STAND_IN_PATH,
  clone,
  currentParts,
  lf,
  liveCopyOf,
  loadRuns,
  readRunFile,
  scoredCellsOfLocale,
} from './eval/helpers/runs';

const SCENARIOS = SCENARIO_SET.scenarios;
const MODEL = { slug: 'google/gemini-3.6-flash', provider: 'fake-host' };

const passedRow = (run: EvalRun, over: Partial<GateModel> = {}): GateModel => ({
  slug: MODEL.slug,
  status: 'passed',
  eval_run: { id: run.id, date: run.made_on },
  languages_ok: SCENARIO_SET.scenarios.length > 0 ? ALL_LOCALES : [],
  ...over,
});

const ALL_LOCALES = [
  'en-US',
  'en-GB',
  'es',
  'de',
  'pt',
  'pt-BR',
  'it',
  'ja',
  'ar',
  'fr',
  'ko',
  'zh',
  'zh-TW',
  'ur',
  'hi',
  'vi',
  'id',
  'th',
  'tr',
];

async function gate(
  run: EvalRun | null,
  row: GateModel,
  extraRuns: EvalRun[] = [],
  current?: CurrentParts
): Promise<GateProblem[]> {
  return evalGate({
    models: [row],
    runs: [...(run === null ? [] : [run]), ...extraRuns],
    scenarios: SCENARIOS,
    current: current ?? (await currentParts()),
  });
}

const codes = (problems: GateProblem[]): string[] =>
  problems.map((problem) => problem.code);

describe('the committed STAND-IN run', () => {
  const { text, run } = readRunFile(STAND_IN_PATH);

  it('is well formed, says STAND-IN word for word, and cannot be mistaken for a live run', async () => {
    expect(await runProblems(run)).toEqual([]);
    expect(run.kind).toBe('STAND_IN');
    expect(run.label).toBe(STAND_IN_LABEL);
    expect(run.model).toEqual(STAND_IN_MODEL);
    expect(run.id.startsWith('standin-')).toBe(true);
    expect(run.passes).toBe(1);
    expect(renderRunReport(run).split('\n')[0]).toBe(STAND_IN_LABEL);
    // every table the report prints is introduced by the label
    expect(renderRunReport(run)).toContain('(STAND-IN RUN)');
    expect(renderRunReport(run)).toContain('does not make any model `passed`');
  });

  it('is the run a fresh recording gives, byte for byte, with no paid call (recomputed in CI)', async () => {
    const fresh = await recordRun({
      kind: 'STAND_IN',
      scenarios: SCENARIO_SET,
      passes: run.passes,
      madeOn: run.made_on,
      model: STAND_IN_MODEL,
    });
    // (a failure here is a message, not a 900 KB diff)
    if (lf(runFileText(fresh)) !== text) {
      const before = new Map(
        run.cells.map((cell) => [cell.id, JSON.stringify(cell)])
      );
      const differ = fresh.cells
        .filter((cell) => before.get(cell.id) !== JSON.stringify(cell))
        .map((cell) => cell.id)
        .slice(0, 5);
      throw new Error(
        `the stand-in run is stale (${fresh.fingerprint.sha256.slice(0, 12)} now, ${run.fingerprint.sha256.slice(0, 12)} recorded); cells that differ: ${differ.join(', ') || 'none, the header'}. Record it again: node scripts/reply/eval-run.js --stand-in --write`
      );
    }
    expect(lf(runFileText(fresh))).toBe(text);
  }, 120_000);

  it('has the current fingerprint: the model, the prompt, the wording lists, the caps and the scenarios', async () => {
    const now = await currentFingerprint(run.model, await currentParts());
    expect(run.fingerprint).toEqual(now);
  }, 60_000);

  it('is replayed from its recorded replies with no model call and gives the record again', async () => {
    const worldOf = await judgeWorldsFor(run, SCENARIOS);
    const replayed = replayRun(run, SCENARIOS, worldOf);
    expect(replayed.problems).toEqual([]);
    expect(replayed.summary).toEqual(run.summary);
  }, 120_000);

  it('meets every approved expectation of every one of its cells, and every bar holds (the mechanism, nothing more)', () => {
    const byId = new Map(SCENARIOS.map((scenario) => [scenario.id, scenario]));
    const problems = run.cells.flatMap((cell) =>
      expectationProblems(byId.get(cell.scenario)!, cell)
    );
    expect(problems).toEqual([]);
    const summary = summarizeCells(run.cells, SCENARIOS);
    expect(summary.all_pass).toBe(true);
    expect(summary.bars.map((bar) => bar.key)).toEqual([
      'GOLDEN',
      'SCHEMA',
      'NUMBERS',
      'WORDING',
      'LANGUAGES',
      'COST_TIME',
      'EXPECTATIONS',
    ]);
    expect(summary.locales).toHaveLength(19);
  });

  it('covers every cell of the scenario set once (a cell is a scenario, a trader type, a locale and a pass)', () => {
    const expected = SCENARIOS.reduce(
      (sum, scenario) =>
        sum +
        scenario.traders.length *
          (scenario.locales === 'ALL' ? 19 : scenario.locales.length),
      0
    );
    expect(run.cells).toHaveLength(expected);
    expect(new Set(run.cells.map((cell) => cell.id)).size).toBe(expected);
  });

  it('can never make a model `passed`: the gate refuses it as evidence by name', async () => {
    const problems = await gate(
      run,
      passedRow(run, {
        slug: run.model.slug,
        eval_run: { id: run.id, date: run.made_on },
      })
    );
    expect(codes(problems)).toEqual(['STAND_IN_IS_NOT_EVIDENCE']);
    expect(problems[0]!.message).toContain('stand-in');
  });
});

describe('the registry and the gate today', () => {
  it('no model is `passed` yet, so no row needs a run, and the launch pair is empty', () => {
    expect(AI_MODELS.filter((model) => model.status === 'passed')).toEqual([]);
    expect(AI_MODELS.filter((model) => model.launch_role !== null)).toEqual([]);
    expect(AI_MODELS.every((model) => model.eval_run === null)).toBe(true);
  });

  it('is open for the shipped registry: every `passed` row, if one is ever written, has a LIVE run for the current fingerprint', async () => {
    const problems = await evalGate({
      models: AI_MODELS,
      runs: loadRuns(),
      scenarios: SCENARIOS,
      current: await currentParts(),
    });
    expect(problems).toEqual([]);
  }, 60_000);
});

describe('the gate lets a model in only on a live run that meets every bar', () => {
  let stand: EvalRun;
  beforeAll(() => {
    stand = readRunFile(STAND_IN_PATH).run;
  });

  it('is open for a live run of the model, for the current fingerprint, with every bar holding (the positive control)', async () => {
    const live = await liveCopyOf(stand, MODEL);
    expect(live.summary.all_pass).toBe(true);
    expect(await gate(live, passedRow(live))).toEqual([]);
  }, 60_000);

  it('does not look at a model that is only a candidate or retired', async () => {
    expect(
      await gate(
        null,
        passedRow(stand, { status: 'candidate', eval_run: null })
      )
    ).toEqual([]);
    expect(
      await gate(null, passedRow(stand, { status: 'retired', eval_run: null }))
    ).toEqual([]);
  });

  it('FAILS a `passed` model that names no run', async () => {
    const problems = await gate(null, passedRow(stand, { eval_run: null }));
    expect(codes(problems)).toEqual(['NO_RUN']);
  });

  it('FAILS a `passed` model whose run is not among the recorded runs', async () => {
    const live = await liveCopyOf(stand, MODEL);
    const problems = await gate(
      null,
      passedRow(live, {
        eval_run: { id: 'live-000000000000', date: '2026-10-16' },
      })
    );
    expect(codes(problems)).toEqual(['RUN_MISSING']);
  });

  it('FAILS a run that is damaged', async () => {
    const live = await liveCopyOf(stand, MODEL);
    const broken = clone(live) as unknown as Record<string, unknown>;
    delete broken['fingerprint'];
    const problems = await gate(broken as unknown as EvalRun, passedRow(live));
    expect(codes(problems)).toEqual(['BROKEN_RUN']);
  });

  it('FAILS a run of another model', async () => {
    const live = await liveCopyOf(stand, {
      slug: 'deepseek/deepseek-v4-flash',
      provider: 'fake-host',
    });
    expect(codes(await gate(live, passedRow(live)))).toEqual(['WRONG_MODEL']);
  });

  it.each([
    [
      'the prompt text',
      (c: CurrentParts) => ({ ...c, prompt_sha256: 'a'.repeat(64) }),
      'the prompt text changed',
    ],
    [
      'the prompt version',
      (c: CurrentParts) => ({ ...c, prompt_version: 'prompts.v2' }),
      'the prompt version changed',
    ],
    [
      'the wording lists',
      (c: CurrentParts) => ({ ...c, wording_sha256: 'b'.repeat(64) }),
      'the wording lists changed',
    ],
    [
      'the context caps',
      (c: CurrentParts) => ({ ...c, caps_sha256: 'c'.repeat(64) }),
      'the context caps changed',
    ],
    [
      'the scenarios or their worlds',
      (c: CurrentParts) => ({ ...c, scenario_set_sha256: 'd'.repeat(64) }),
      'the scenarios or the worlds they run on changed',
    ],
  ])(
    'FAILS a stale fingerprint when %s changed after the run',
    async (_name, change, words) => {
      const live = await liveCopyOf(stand, MODEL);
      const problems = await gate(
        live,
        passedRow(live),
        [],
        change(await currentParts())
      );
      expect(codes(problems)).toEqual(['STALE_FINGERPRINT']);
      expect(problems[0]!.message).toContain(words);
    },
    60_000
  );

  it('FAILS a run whose provider is another than the one it names (the fingerprint names it)', async () => {
    const live = await liveCopyOf(stand, MODEL);
    const moved = clone(live);
    moved.model = { ...moved.model, provider: 'another-host' };
    expect(codes(await gate(moved, passedRow(moved)))).toEqual(['BROKEN_RUN']);
  });

  it('FAILS a language 6 points under English, and names the language', async () => {
    // 34 scored runs per locale: one miss is 2.9 points (inside the bar), two are 5.9 (outside)
    const oneMiss = await liveCopyOf(stand, MODEL, (cells) => {
      const arCells = scoredCellsOfLocale({ cells } as EvalRun, 'ar');
      arCells[0]!.judgement!.clean = false;
    });
    expect(await gate(oneMiss, passedRow(oneMiss))).toEqual([]);

    const twoMisses = await liveCopyOf(stand, MODEL, (cells) => {
      const arCells = scoredCellsOfLocale({ cells } as EvalRun, 'ar');
      arCells[0]!.judgement!.clean = false;
      arCells[1]!.judgement!.clean = false;
    });
    const problems = await gate(twoMisses, passedRow(twoMisses));
    expect(codes(problems)).toEqual(['BAR_FAILED', 'LANGUAGES_INCOMPLETE']);
    expect(problems[0]!.message).toContain('Languages');
    expect(problems[1]!.message).toContain('ar');
    expect(problems[1]!.message).not.toContain('de');
    const row = twoMisses.summary.locales.find((l) => l.locale === 'ar')!;
    expect(row.gap_bp).toBeGreaterThan(500);
    expect(row.ok).toBe(false);
  }, 60_000);

  it('FAILS a model whose English score is the one that dropped less than the others (a language compared with English, not with itself)', async () => {
    // English two misses down: every other locale is then ABOVE English, which is fine for them
    const live = await liveCopyOf(stand, MODEL, (cells) => {
      const en = scoredCellsOfLocale({ cells } as EvalRun, 'en-US');
      en[0]!.judgement!.clean = false;
      en[1]!.judgement!.clean = false;
    });
    expect(await gate(live, passedRow(live))).toEqual([]);
  }, 60_000);

  it('FAILS a golden scenario whose direction is not the synthesis reading', async () => {
    const live = await liveCopyOf(stand, MODEL, (cells) => {
      const cell = cells.find(
        (c) => c.scenario === 'G01' && c.locale === 'en-US'
      )!;
      cell.direction_equals_syn = false;
      cell.judgement!.direction_equals_syn = false;
    });
    const problems = await gate(live, passedRow(live));
    expect(codes(problems)).toContain('BAR_FAILED');
    const messages = problems.map((problem) => problem.message).join('\n');
    expect(messages).toContain('Golden scenarios');
    expect(messages).toContain('Approved expectations');
  }, 60_000);

  it('FAILS a zone id that is not a stored zone, and a stand-aside reading that took a side', async () => {
    const zone = await liveCopyOf(stand, MODEL, (cells) => {
      cells.find((c) => c.scenario === 'G04')!.judgement!.zones_valid = false;
    });
    expect(
      (await gate(zone, passedRow(zone))).map((p) => p.message).join()
    ).toContain('Golden scenarios');
    const aside = await liveCopyOf(stand, MODEL, (cells) => {
      cells.find((c) => c.scenario === 'G09')!.judgement!.stand_aside_kept =
        false;
    });
    expect(
      (await gate(aside, passedRow(aside))).map((p) => p.message).join()
    ).toContain('Golden scenarios');
  }, 60_000);

  it('FAILS an unverified number that was shown', async () => {
    const live = await liveCopyOf(stand, MODEL, (cells) => {
      cells[0]!.judgement!.numbers_unverified_shown = 1;
    });
    const problems = await gate(live, passedRow(live));
    expect(problems.map((problem) => problem.message).join('\n')).toContain(
      'Numbers'
    );
  }, 60_000);

  it('FAILS a listed phrase that was shown', async () => {
    const live = await liveCopyOf(stand, MODEL, (cells) => {
      cells[0]!.judgement!.wording_violations_shown = 1;
    });
    const problems = await gate(live, passedRow(live));
    expect(problems.map((problem) => problem.message).join('\n')).toContain(
      'Wording'
    );
  }, 60_000);

  it('FAILS a schema that stayed wrong after the one retry', async () => {
    const live = await liveCopyOf(stand, MODEL, (cells) => {
      cells[0]!.judgement!.schema_ok_final = false;
    });
    const problems = await gate(live, passedRow(live));
    expect(problems.map((problem) => problem.message).join('\n')).toContain(
      'Schema'
    );
  }, 60_000);

  it('FAILS a registry row that does not list all 19 languages as good', async () => {
    const live = await liveCopyOf(stand, MODEL);
    const problems = await gate(
      live,
      passedRow(live, {
        languages_ok: ALL_LOCALES.filter((locale) => locale !== 'th'),
      })
    );
    expect(codes(problems)).toEqual(['LANGUAGES_INCOMPLETE']);
    expect(problems[0]!.message).toContain('th');
  }, 60_000);

  it('FAILS when the cost or the time was not recorded (a bar of 5.10 that feeds 5.6)', async () => {
    const live = await liveCopyOf(stand, MODEL, (cells) => {
      for (const cell of cells) cell.judgement = null;
    });
    const problems = await gate(live, passedRow(live));
    expect(problems.map((problem) => problem.message).join('\n')).toContain(
      'Cost and time'
    );
  }, 60_000);
});
