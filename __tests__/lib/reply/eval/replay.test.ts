/**
 * @jest-environment node
 */

/**
 * The replay of a recorded run (build step 7 part 10): the checks run again over the recorded replies,
 * with no model, and every difference from the record is a sentence. Each case breaks ONE thing in a
 * copy of the committed stand-in run and shows the replay naming it, and the gate not trusting the
 * summary a file carries.
 */

jest.mock('@/lib/db/prisma', () => ({ prisma: {} }));

import { SCENARIO_SET } from '@/lib/reply/eval/scenarios';
import {
  evalGate,
  replayRun,
  runFileText,
  runProblems,
} from '@/lib/reply/eval/suite';
import type { EvalRun } from '@/lib/reply/eval/suite';

import { judgeWorldsFor } from './helpers/harness';
import {
  STAND_IN_PATH,
  clone,
  currentParts,
  liveCopyOf,
  readRunFile,
} from './helpers/runs';

const SCENARIOS = SCENARIO_SET.scenarios;
let stand: EvalRun;
let worldOf: Awaited<ReturnType<typeof judgeWorldsFor>>;

beforeAll(async () => {
  stand = readRunFile(STAND_IN_PATH).run;
  worldOf = await judgeWorldsFor(stand, SCENARIOS);
}, 120_000);

const replay = (run: EvalRun) => replayRun(run, SCENARIOS, worldOf);

describe('replayRun', () => {
  it('agrees with the committed run, with the summary it recomputes', () => {
    const result = replay(stand);
    expect(result.problems).toEqual([]);
    expect(result.summary).toEqual(stand.summary);
  });

  it('names a reply that was changed after it was recorded', () => {
    const run = clone(stand);
    const cell = run.cells.find(
      (c) => c.scenario === 'G03' && c.locale === 'fr'
    )!;
    cell.calls[0]!.text = '{"headline":"x"}';
    const { problems } = replay(run);
    expect(problems).toContain(
      `${cell.id}: the judgement of the recorded replies is not the recorded one`
    );
  });

  it('names a judgement that was edited while the replies were not', () => {
    const run = clone(stand);
    const cell = run.cells.find(
      (c) => c.scenario === 'G03' && c.locale === 'fr'
    )!;
    cell.judgement!.wording_violations_shown = 1;
    expect(replay(run).problems.join('\n')).toContain(
      `${cell.id}: the judgement`
    );
  });

  it('names a summary that is not the summary of the cells', () => {
    const run = clone(stand);
    run.summary.all_pass = false;
    expect(replay(run).problems).toContain(
      'the summary of the run is not the summary of its cells'
    );
    const other = clone(stand);
    other.summary.locales[0]!.clean -= 1;
    expect(replay(other).problems).toContain(
      'the summary of the run is not the summary of its cells'
    );
  });

  it('names a cell whose id does not say what it is, and a scenario that is not in the set', () => {
    // the world of a damaged cell is the world of the same place in the committed run
    const sameWorld = (run: EvalRun) => (cell: EvalRun['cells'][number]) =>
      worldOf(stand.cells[run.cells.indexOf(cell)]!);
    const run = clone(stand);
    run.cells[5]!.id = 'G01.DAY_TRADER.xx.1';
    expect(replayRun(run, SCENARIOS, sameWorld(run)).problems).toContain(
      'G01.DAY_TRADER.xx.1: the cell id does not name its scenario, trader, locale and pass'
    );
    const unknown = clone(stand);
    unknown.cells[5]!.scenario = 'Z99';
    expect(
      replayRun(unknown, SCENARIOS, sameWorld(unknown)).problems.some((p) =>
        p.endsWith('the scenario Z99 is not in the set')
      )
    ).toBe(true);
  });

  it('judges a cell whose first call returned nothing as no reply, without needing its world', () => {
    const run = clone(stand);
    const staged = run.cells.find((c) => c.scenario === 'D06b')!;
    expect(staged.calls.every((call) => call.text === null)).toBe(true);
    let asked = 0;
    const result = replayRun(run, SCENARIOS, (cell) => {
      asked += 1;
      return worldOf(cell);
    });
    expect(result.problems).toEqual([]);
    // (the 676 cells with a reply asked for their world, the four without did not)
    expect(asked).toBe(
      run.cells.filter(
        (c) => c.calls[0] !== undefined && c.calls[0].text !== null
      ).length
    );
  });
});

describe('runProblems', () => {
  it('accepts the committed run and names what is wrong with a damaged one', async () => {
    expect(await runProblems(stand)).toEqual([]);
    const damage: [string, (r: any) => void, string][] = [
      [
        'another schema',
        (r) => {
          r.schema = 'eval-run/2';
        },
        'schema is not eval-run/1',
      ],
      [
        'a missing id',
        (r) => {
          r.id = '';
        },
        'id is empty',
      ],
      [
        'a kind that is neither',
        (r) => {
          r.kind = 'HUMAN';
        },
        'kind is not STAND_IN or LIVE',
      ],
      [
        'a stand-in without its label',
        (r) => {
          r.label = 'a run';
        },
        'must carry the stand-in label word for word',
      ],
      [
        'a date that is not one',
        (r) => {
          r.made_on = 'today';
        },
        'made_on is not a date',
      ],
      [
        'no passes',
        (r) => {
          r.passes = 0;
        },
        'passes is not a count from 1',
      ],
      [
        'no model',
        (r) => {
          r.model = null;
        },
        'model is not { slug, provider }',
      ],
      [
        'a fingerprint of another model',
        (r) => {
          r.model.slug = 'x/y';
        },
        'names another model than the run does',
      ],
      [
        'no cells',
        (r) => {
          r.cells = [];
        },
        'cells is empty',
      ],
      [
        'no summary',
        (r) => {
          delete r.summary;
        },
        'summary is missing',
      ],
    ];
    for (const [, change, words] of damage) {
      const run = clone(stand) as any;
      change(run);
      expect((await runProblems(run)).join('\n')).toContain(words);
    }
    expect(await runProblems(null)).toEqual(['the run is not an object']);
    expect(await runProblems([])).toEqual(['the run is not an object']);
  });
});

describe('the gate does not trust what a file says about itself', () => {
  it('judges the cells, not the summary the file carries', async () => {
    const live = await liveCopyOf(stand, {
      slug: 'google/gemini-3.6-flash',
      provider: 'fake',
    });
    // damage a cell and leave the summary as it was: the file still claims every bar holds
    const lying = clone(live);
    lying.cells.find(
      (c) => c.scenario === 'G01' && c.locale === 'en-US'
    )!.judgement!.direction_equals_syn = false;
    expect(lying.summary.all_pass).toBe(true);
    const problems = await evalGate({
      models: [
        {
          slug: 'google/gemini-3.6-flash',
          status: 'passed',
          eval_run: { id: lying.id, date: lying.made_on },
          languages_ok: lying.summary.locales.map((l) => l.locale),
        },
      ],
      runs: [lying],
      scenarios: SCENARIOS,
      current: await currentParts(),
    });
    expect(problems.map((p) => p.code)).toContain('BAR_FAILED');
  }, 60_000);
});

describe('the run file', () => {
  it('is the header, then one cell to a line, and reads back as the same run', () => {
    const text = runFileText(stand);
    const lines = text.split('\n');
    expect(text.endsWith('}\n')).toBe(true);
    expect(JSON.parse(text)).toEqual(stand);
    const cellLines = lines.filter((l) => l.startsWith('    {"id":"'));
    expect(cellLines).toHaveLength(stand.cells.length);
    // a cell is found by its id with grep
    expect(cellLines[0]).toContain('"id":"G01.DAY_TRADER.en-US.1"');
  });
});
