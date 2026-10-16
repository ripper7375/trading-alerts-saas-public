/**
 * @jest-environment node
 */

/**
 * The review tool for the golden scenarios (build step 7 part 10; the pattern of
 * `wording-tool.test.ts`): `record` writes a review sheet and a PENDING approval and never writes
 * APPROVED; `check` holds the sheet to a fresh one and the approval to the scenarios as they were
 * read; `--require-approved` is the gate that stays closed until a person signs.
 *
 * Every case works on a copy of the scenario file in a temporary tree, never on the real
 * approval: whether Davin has signed is his, and no test here depends on it.
 */

import { spawnSync } from 'child_process';
import {
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'fs';
import { tmpdir } from 'os';
import { join, resolve } from 'path';

const ROOT = resolve(__dirname, '..', '..', '..', '..');
const SCRIPT = join(ROOT, 'scripts', 'reply', 'golden-tool.js');
const SCENARIOS = 'config/reply/golden/scenarios.v1.json';

const tool = require(SCRIPT) as {
  check: (
    root: string,
    o?: { requireApproved?: boolean }
  ) => { problems: string[]; status: string | null };
  record: (root: string) => string[];
  renderReview: (file: unknown) => string;
  counts: (file: unknown) => { cells: number; scored: number; live: number };
  coverageProblems: (file: unknown) => string[];
  structureProblems: (file: unknown) => string[];
};

let tree: string;
const path = (rel: string): string => join(tree, rel);
const readJson = (rel: string): any =>
  JSON.parse(readFileSync(path(rel), 'utf8'));
const writeJson = (rel: string, value: unknown): void =>
  writeFileSync(path(rel), `${JSON.stringify(value, null, 2)}\n`, 'utf8');

beforeEach(() => {
  tree = mkdtempSync(join(tmpdir(), 'golden-tool-'));
  mkdirSync(path('config/reply/golden'), { recursive: true });
  copyFileSync(join(ROOT, SCENARIOS), path(SCENARIOS));
});
afterEach(() => {
  rmSync(tree, { recursive: true, force: true });
});

function run(
  args: string[],
  root = tree
): { code: number | null; out: string } {
  const result = spawnSync(
    process.execPath,
    [SCRIPT, ...args, '--root', root],
    {
      encoding: 'utf8',
    }
  );
  return { code: result.status, out: `${result.stdout}${result.stderr}` };
}

describe('record', () => {
  it('writes the review sheet and a PENDING approval, and never APPROVED', () => {
    expect(tool.record(tree).sort()).toEqual([
      'config/reply/golden/approval.json',
      'config/reply/golden/review.md',
    ]);
    const approval = readJson('config/reply/golden/approval.json');
    expect(approval).toMatchObject({
      schema: 'golden-reply-approval/1',
      area: 'golden-reply',
      status: 'PENDING',
      approved_by: '',
      approved_on: '',
    });
    expect(approval.content_sha256).toMatch(/^[0-9a-f]{64}$/);
  });

  it('puts the ten rows, every scenario and its reason on the sheet, and no status', () => {
    tool.record(tree);
    const sheet = readFileSync(path('config/reply/golden/review.md'), 'utf8');
    const file = readJson(SCENARIOS);
    for (const scenario of file.scenarios) {
      expect(sheet).toContain(`| ${scenario.id} |`);
      expect(sheet).toContain(scenario.rule);
    }
    for (let row = 1; row <= 10; row += 1)
      expect(sheet).toContain(`| ${row} |`);
    expect(sheet).toContain('Architecture 7.6');
    // it lists no status, so signing the approval makes it stale for nobody
    const approval = readJson('config/reply/golden/approval.json');
    writeJson('config/reply/golden/approval.json', {
      ...approval,
      status: 'APPROVED',
      approved_by: 'Davin',
      approved_on: '2026-10-17',
    });
    expect(tool.check(tree).problems).toEqual([]);
    expect(readFileSync(path('config/reply/golden/review.md'), 'utf8')).toBe(
      sheet
    );
    const counts = tool.counts(file);
    expect(sheet).toContain(`${counts.cells} cells in one pass`);
  });

  it('keeps a signature only for the same scenarios', () => {
    tool.record(tree);
    const approval = readJson('config/reply/golden/approval.json');
    writeJson('config/reply/golden/approval.json', {
      ...approval,
      status: 'APPROVED',
      approved_by: 'Davin',
      approved_on: '2026-10-17',
    });
    tool.record(tree);
    expect(readJson('config/reply/golden/approval.json').status).toBe(
      'APPROVED'
    );

    // a scenario changes: recording again puts the approval back to PENDING
    const file = readJson(SCENARIOS);
    file.scenarios[0].title += ' (edited)';
    writeJson(SCENARIOS, file);
    tool.record(tree);
    expect(readJson('config/reply/golden/approval.json')).toMatchObject({
      status: 'PENDING',
      approved_by: '',
    });
  });

  it.each([
    [
      'row 3 of 7.6 has no scenario',
      (f: any) => {
        f.scenarios = f.scenarios.filter((s: any) => s.row !== 3);
      },
    ],
    [
      'a golden cycle has no scenario',
      (f: any) => {
        f.scenarios = f.scenarios.filter((s: any) => s.id !== 'G05');
      },
    ],
    [
      'a cycle is run for one trader type',
      (f: any) => {
        f.scenarios[2].traders = ['DAY_TRADER'];
      },
    ],
    [
      'no scenario runs on STALE data',
      (f: any) => {
        f.scenarios = f.scenarios.filter(
          (s: any) => s.overlay.status !== 'STALE'
        );
      },
    ],
    [
      'the planted phrase is not run in all 19 locales',
      (f: any) => {
        f.scenarios.find(
          (s: any) => s.condition === 'PLANT_BANNED_PHRASE'
        ).locales = ['en-US'];
      },
    ],
    [
      'the demo scenario is not run in all 19 locales',
      (f: any) => {
        f.scenarios.find((s: any) => s.family === 'DEMO').locales = ['en-US'];
      },
    ],
    [
      'a planted failure is not staged',
      (f: any) => {
        f.scenarios.find((s: any) => s.id === 'P01').source = 'MODEL';
      },
    ],
    [
      'the set is smaller than the architecture asks',
      (f: any) => {
        f.scenarios = f.scenarios.slice(0, 10);
      },
    ],
  ])('refuses to record when %s', (_name, change) => {
    const file = readJson(SCENARIOS);
    change(file);
    writeJson(SCENARIOS, file);
    expect(() => tool.record(tree)).toThrow(/do not cover|have problems/);
    expect(
      tool.coverageProblems(file).length + tool.structureProblems(file).length
    ).toBeGreaterThan(0);
  });
});

describe('check', () => {
  it('passes on a fresh record, PENDING', () => {
    tool.record(tree);
    expect(tool.check(tree)).toEqual({ problems: [], status: 'PENDING' });
  });

  it('fails without --require-approved only on a stale sheet or an approval for other scenarios', () => {
    tool.record(tree);
    const file = readJson(SCENARIOS);
    file.scenarios[3].title += ' (edited)';
    writeJson(SCENARIOS, file);
    const { problems } = tool.check(tree);
    expect(problems.join('\n')).toContain('differs from a fresh run');
    expect(problems.join('\n')).toContain('written for other scenarios');
  });

  it('keeps the gate closed while PENDING and opens it only when a person signs for these scenarios', () => {
    tool.record(tree);
    expect(
      tool.check(tree, { requireApproved: true }).problems.join()
    ).toContain('PENDING');

    const approval = readJson('config/reply/golden/approval.json');
    writeJson('config/reply/golden/approval.json', {
      ...approval,
      status: 'APPROVED',
      approved_by: 'Davin',
      approved_on: '2026-10-17',
    });
    expect(tool.check(tree, { requireApproved: true })).toEqual({
      problems: [],
      status: 'APPROVED',
    });

    // signed, then an expectation edited: the signature no longer counts
    const file = readJson(SCENARIOS);
    file.scenarios[0].expect.model_calls = { min: 0, max: 3 };
    writeJson(SCENARIOS, file);
    tool.record(tree); // regenerates the sheet; the approval is reset
    expect(
      tool.check(tree, { requireApproved: true }).problems.join()
    ).toContain('PENDING');
  });

  it('refuses a signature without a name or a date', () => {
    tool.record(tree);
    const approval = readJson('config/reply/golden/approval.json');
    writeJson('config/reply/golden/approval.json', {
      ...approval,
      status: 'APPROVED',
    });
    const problems = tool.check(tree).problems.join('\n');
    expect(problems).toContain('needs approved_by');
    expect(problems).toContain('needs approved_on');
  });

  it('reports a missing sheet and a missing approval', () => {
    const problems = tool.check(tree).problems.join('\n');
    expect(problems).toContain('review.md is missing');
    expect(problems).toContain('approval.json is missing');
  });
});

describe('the command line', () => {
  it('check exits 0 on the real tree, whoever has signed', () => {
    const result = run(['check'], ROOT);
    expect(result.out).toContain('the golden scenarios are as they should be');
    expect(result.code).toBe(0);
  });

  it('check --require-approved exits 1 on a fresh copy and says why', () => {
    expect(run(['record']).code).toBe(0);
    const closed = run(['check', '--require-approved']);
    expect(closed.code).toBe(1);
    expect(closed.out).toContain('PENDING');
    expect(run(['check']).code).toBe(0);
  });

  it('matrix prints the ten rows and exits 0 while each has a scenario, 1 when one has none', () => {
    const open = run(['matrix']);
    expect(open.code).toBe(0);
    expect(
      open.out.split('\n').filter((l) => /^\| \d+ \|/.test(l))
    ).toHaveLength(10);
    const file = readJson(SCENARIOS);
    file.scenarios = file.scenarios.filter((s: any) => s.row !== 8);
    writeJson(SCENARIOS, file);
    const closed = run(['matrix']);
    expect(closed.code).toBe(1);
    expect(closed.out).toContain("| 8 | Knowledge index won't load | NONE |");
  });

  it('exits 2 for a file it cannot use or a command it does not know', () => {
    expect(run(['nonsense']).code).toBe(2);
    writeFileSync(path(SCENARIOS), '{ not json', 'utf8');
    expect(run(['check']).code).toBe(2);
  });
});
