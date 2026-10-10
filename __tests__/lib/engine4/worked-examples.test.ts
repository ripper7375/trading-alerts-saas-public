/**
 * @jest-environment node
 */

/**
 * The worked examples (build step 5 part 8; architecture 7.7 and 7.10).
 *
 * Each example under `worked-examples/` is a situation worked out by the independent
 * oracle (`scripts/engine4/oracle.py` with `scripts/engine4/worked_examples.py`) that Davin
 * reads and approves, example by example. These tests hold three things:
 *
 *  1. the REAL Engine 4 gives the oracle's figures, one by one, for every example;
 *  2. the figures an example copies from the stored 18 Sep cycle are still the stored ones;
 *  3. the approval gate works: an example counts only when a person wrote APPROVED over the
 *     exact files they read, and `--require-approved` refuses while any is PENDING.
 *
 * The gate is also a switch: `ENGINE4_REQUIRE_APPROVED=1 npx jest __tests__/lib/engine4/worked-examples.test.ts`
 * (the Jest twin of `python scripts/engine4/worked_examples.py check --require-approved`)
 * fails while any example is PENDING. Without it, PENDING is the expected state of a new example.
 */

import { spawnSync } from 'child_process';
import {
  cpSync,
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

import {
  EXAMPLES_ROOT,
  ORACLE_PATH,
  REPO_ROOT,
  TOOL_PATH,
  approvalProblems,
  approvalText,
  checkApprovals,
  compareClaims,
  exampleFolders,
  flatten,
  readExample,
  runExample,
  sha256Lf,
  storedProblems,
} from './helpers/worked-examples';

const REQUIRE_APPROVED = process.env['ENGINE4_REQUIRE_APPROVED'] === '1';

const NAMED = [
  'doc-6-7-table',
  '18-sep-z1-default-profile',
  '18-sep-z1-leverage-1-to-5',
  'm15-uoedt-stop-underflow',
  '500-dollar-account',
  'counter-trend-cap-2-50',
  'cautionary-half-risk',
  'blackout-window-edge',
  'stale-symbol-specs',
  'leverage-underflow-twin',
];

const ids = exampleFolders();

function numbersIn(value: unknown, path: string, out: string[]): string[] {
  if (typeof value === 'number') out.push(path);
  else if (Array.isArray(value))
    value.forEach((item, i) => numbersIn(item, `${path}[${i}]`, out));
  else if (value !== null && typeof value === 'object') {
    for (const [key, inner] of Object.entries(value))
      numbersIn(inner, `${path}.${key}`, out);
  }
  return out;
}

describe('the set of worked examples', () => {
  test('holds the examples the order names, numbered in order (8 to 10 of them)', () => {
    expect(ids.length).toBeGreaterThanOrEqual(8);
    expect(ids.length).toBeLessThanOrEqual(10);
    expect(ids.map((id) => id.slice(0, 2))).toEqual(
      ids.map((_id, i) => String(i + 1).padStart(2, '0'))
    );
    const slugs = ids.map((id) => id.slice(3));
    for (const slug of NAMED) expect(slugs).toContain(slug);
  });

  test.each(ids)('%s has its four files', (id) => {
    for (const name of [
      'scenario.json',
      'expected.json',
      'review.md',
      'approval.json',
    ]) {
      expect(existsSync(join(EXAMPLES_ROOT, id, name))).toBe(true);
    }
    expect(existsSync(join(EXAMPLES_ROOT, 'INDEX.md'))).toBe(true);
    expect(existsSync(join(EXAMPLES_ROOT, 'generator.json'))).toBe(true);
  });

  test('every figure is text: no JSON number in any scenario or expected file', () => {
    const found: string[] = [];
    for (const id of ids) {
      const example = readExample(id);
      numbersIn(example.scenario, `${id}/scenario`, found);
      numbersIn(example.expected, `${id}/expected`, found);
    }
    expect(found).toEqual([]);
  });

  test('the expected files were made by the oracle and the tool as they are now (SHA-256, LF)', () => {
    const generator = JSON.parse(
      readFileSync(join(EXAMPLES_ROOT, 'generator.json'), 'utf8')
    ) as {
      tool_sha256: string;
      oracle_sha256: string;
      examples: string[];
    };
    expect(generator.oracle_sha256).toBe(
      sha256Lf(readFileSync(ORACLE_PATH, 'utf8'))
    );
    expect(generator.tool_sha256).toBe(
      sha256Lf(readFileSync(TOOL_PATH, 'utf8'))
    );
    expect(generator.examples).toEqual(ids);
  });
});

describe.each(ids)('%s', (id) => {
  const example = readExample(id);

  test('names itself the same in the scenario and the expected file', () => {
    expect(example.scenario.id).toBe(id);
    expect(example.expected.example).toBe(id);
    expect(example.expected.kind).toBe(example.scenario.kind);
  });

  test('the real engine gives the oracle’s figures, one by one', () => {
    const expected = flatten({ result: example.expected.result });
    const problems = compareClaims(expected, runExample(example));
    expect(problems).toEqual([]);
    expect(expected.size).toBeGreaterThan(8);
  });

  test('the figures taken from the stored cycle are still the stored ones', () => {
    expect(storedProblems(example.scenario)).toEqual([]);
  });
});

describe('the comparison can fail', () => {
  const example = readExample(ids[1] as string);
  const expected = flatten({ result: example.expected.result });

  test('a wrong lot is reported', () => {
    const wrong = new Map(expected);
    wrong.set('result.sizing.lot', '0.02');
    const problems = compareClaims(wrong, runExample(example));
    expect(problems.join('\n')).toMatch(/result\.sizing\.lot: engine 0\.01/);
  });

  test('a figure the engine claims and the oracle does not is reported', () => {
    const fewer = new Map(expected);
    fewer.delete('result.sizing.lot');
    expect(compareClaims(fewer, runExample(example)).join('\n')).toMatch(
      /result\.sizing\.lot: the engine claims it/
    );
  });

  test('a figure the oracle has and the engine does not claim is reported', () => {
    const more = new Map(expected);
    more.set('result.sizing.invented', '1');
    expect(compareClaims(more, runExample(example)).join('\n')).toMatch(
      /result\.sizing\.invented: the oracle has "1", the engine said nothing/
    );
  });

  test('a display figure is compared as text, an exact one by value', () => {
    const changed = new Map(expected);
    changed.set('result.sizing.actual_risk_2dp', '16.83');
    changed.set('result.sizing.declared_risk', '150/2'); // 75, written as a quotient
    const text = compareClaims(changed, runExample(example)).join('\n');
    expect(text).toMatch(/actual_risk_2dp: engine "16.82" but oracle "16.83"/);
    expect(text).not.toMatch(/declared_risk:/);
  });
});

describe('the approval gate (the twin of --require-approved)', () => {
  test('every approval.json is well formed and, when APPROVED, still true of the files read', () => {
    const check = checkApprovals(EXAMPLES_ROOT, {
      requireApproved: REQUIRE_APPROVED,
    });
    expect(check.problems).toEqual([]);
  });

  test('a PENDING example fails the gate and an APPROVED one passes it', () => {
    const dir = mkdtempSync(join(tmpdir(), 'engine4-we-gate-'));
    try {
      cpSync(EXAMPLES_ROOT, dir, { recursive: true });
      const [first, second] = ids as [string, string];
      for (const id of ids) {
        const e = readExample(id, dir);
        writeFileSync(
          join(dir, id, 'approval.json'),
          approvalText(id, e.scenarioText, e.expectedText, {
            status: 'PENDING',
          })
        );
      }
      const allPending = checkApprovals(dir, { requireApproved: true });
      expect(allPending.pending).toEqual(ids);
      expect(allPending.problems).toHaveLength(ids.length);
      expect(allPending.problems[0]).toMatch(/not approved yet/);
      expect(checkApprovals(dir, { requireApproved: false }).problems).toEqual(
        []
      );

      const e = readExample(first, dir);
      writeFileSync(
        join(dir, first, 'approval.json'),
        approvalText(first, e.scenarioText, e.expectedText, {
          status: 'APPROVED',
          approvedBy: 'Davin',
          approvedOn: '2026-10-11',
        })
      );
      const one = checkApprovals(dir, { requireApproved: true });
      expect(one.pending).not.toContain(first);
      expect(one.pending).toContain(second);
      expect(one.problems.some((p) => p.startsWith(`${first}:`))).toBe(false);

      for (const id of ids) {
        const x = readExample(id, dir);
        writeFileSync(
          join(dir, id, 'approval.json'),
          approvalText(id, x.scenarioText, x.expectedText, {
            status: 'APPROVED',
            approvedBy: 'Davin',
            approvedOn: '2026-10-11',
          })
        );
      }
      const all = checkApprovals(dir, { requireApproved: true });
      expect(all.pending).toEqual([]);
      expect(all.problems).toEqual([]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test('a change to either file after approval is caught, whatever the status', () => {
    const e = readExample(ids[0] as string);
    const id = e.id;
    const good = JSON.parse(
      approvalText(id, e.scenarioText, e.expectedText, {
        status: 'APPROVED',
        approvedBy: 'Davin',
        approvedOn: '2026-10-11',
      })
    ) as unknown;
    expect(approvalProblems(good, id, e.scenarioText, e.expectedText)).toEqual(
      []
    );
    const edited = approvalProblems(
      good,
      id,
      e.scenarioText,
      e.expectedText + ' '
    );
    expect(edited).toEqual([
      'approval.json: expected_sha256 is not the hash of expected.json (changed after approval)',
    ]);
    const editedScenario = approvalProblems(
      good,
      id,
      e.scenarioText + ' ',
      e.expectedText
    );
    expect(editedScenario[0]).toMatch(
      /scenario_sha256.*\(changed after approval\)/
    );
    const pending = JSON.parse(
      approvalText(id, e.scenarioText, e.expectedText, { status: 'PENDING' })
    ) as unknown;
    expect(
      approvalProblems(pending, id, e.scenarioText, e.expectedText + ' ')
    ).toEqual([
      'approval.json: expected_sha256 is not the hash of expected.json',
    ]);
  });

  test('line endings do not matter: a CRLF checkout hashes the same', () => {
    expect(sha256Lf('a\r\nb\r\n')).toBe(sha256Lf('a\nb\n'));
  });

  test.each([
    ['not an object', [], /not an object/],
    ['an unknown key', { extra: 1 }, /unknown key 'extra'/],
    ['a missing key', {}, /missing key 'status'/],
  ])('approvalProblems refuses %s', (_label, value, pattern) => {
    const e = readExample(ids[0] as string);
    const problems = approvalProblems(
      value,
      e.id,
      e.scenarioText,
      e.expectedText
    );
    expect(problems.join('\n')).toMatch(pattern);
  });

  test('APPROVED needs a name and a date; any other status is refused', () => {
    const e = readExample(ids[0] as string);
    const base = JSON.parse(
      approvalText(e.id, e.scenarioText, e.expectedText, { status: 'PENDING' })
    ) as Record<string, unknown>;
    const problems = (patch: Record<string, unknown>): string[] =>
      approvalProblems(
        { ...base, ...patch },
        e.id,
        e.scenarioText,
        e.expectedText
      );
    expect(problems({ status: 'APPROVED' })).toEqual([
      'approval.json: APPROVED needs approved_by',
      'approval.json: APPROVED needs approved_on as YYYY-MM-DD',
    ]);
    expect(
      problems({
        status: 'APPROVED',
        approved_by: 'Davin',
        approved_on: '11/10/2026',
      })
    ).toEqual(['approval.json: APPROVED needs approved_on as YYYY-MM-DD']);
    expect(problems({ status: 'MAYBE' })).toEqual([
      'approval.json: status must be PENDING or APPROVED',
    ]);
    expect(problems({ example: 'zz-other' })[0]).toMatch(
      /example is 'zz-other'/
    );
  });

  test('with ENGINE4_REQUIRE_APPROVED=1 no example may still be PENDING (run it as the release gate)', () => {
    const pending = checkApprovals(EXAMPLES_ROOT, {
      requireApproved: true,
    }).pending;
    if (REQUIRE_APPROVED) expect(pending).toEqual([]);
    else expect(Array.isArray(pending)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// The Python tool itself, on copies of the folder
// ---------------------------------------------------------------------------

// `python` on Windows, often only `python3` elsewhere; without either, the tests that run the tool are
// skipped (the figure-by-figure comparison and the hash tie above still run)
const PYTHON =
  ['python', 'python3'].find(
    (name) => spawnSync(name, ['--version'], { encoding: 'utf8' }).status === 0
  ) ?? null;
const describePython = PYTHON === null ? describe.skip : describe;

function python(
  args: string[],
  root?: string
): { status: number | null; out: string } {
  const run = spawnSync(
    PYTHON ?? 'python',
    ['-B', TOOL_PATH, ...(root === undefined ? [] : ['--root', root]), ...args],
    {
      cwd: REPO_ROOT,
      encoding: 'utf8',
      env: { ...process.env, PYTHONIOENCODING: 'utf-8' },
      timeout: 120000,
    }
  );
  return { status: run.status, out: `${run.stdout}\n${run.stderr}` };
}

function statuses(dir: string): string[] {
  return ids.map(
    (id) =>
      (
        JSON.parse(readFileSync(join(dir, id, 'approval.json'), 'utf8')) as {
          status: string;
        }
      ).status
  );
}

describePython('the Python tool (scripts/engine4/worked_examples.py)', () => {
  let dir = '';

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'engine4-we-'));
    cpSync(EXAMPLES_ROOT, dir, { recursive: true });
    // start every copy from PENDING, whatever state the repository is in
    for (const id of ids) {
      const e = readExample(id, dir);
      writeFileSync(
        join(dir, id, 'approval.json'),
        approvalText(id, e.scenarioText, e.expectedText, { status: 'PENDING' })
      );
    }
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  function approveAll(): void {
    for (const id of ids) {
      const e = readExample(id, dir);
      writeFileSync(
        join(dir, id, 'approval.json'),
        approvalText(id, e.scenarioText, e.expectedText, {
          status: 'APPROVED',
          approvedBy: 'Davin',
          approvedOn: '2026-10-11',
        })
      );
    }
  }

  test('check rebuilds every example from its scenario and finds the stored files equal (the repository itself)', () => {
    const run = python(['check']);
    expect(run.out).toMatch(/0 problem\(s\)/);
    expect(run.status).toBe(0);
  });

  test('check passes on PENDING examples, and --require-approved refuses them', () => {
    const plain = python(['check'], dir);
    expect(plain.status).toBe(0);
    expect(plain.out).toMatch(/0 approved, \d+ pending approval, 0 problem/);
    const gate = python(['check', '--require-approved'], dir);
    expect(gate.status).toBe(1);
    expect(gate.out).toMatch(/are not approved yet \(--require-approved\)/);
  });

  test('--require-approved passes once every example is APPROVED over the exact files read', () => {
    approveAll();
    const gate = python(['check', '--require-approved'], dir);
    expect(gate.out).toMatch(new RegExp(`${ids.length} approved, 0 pending`));
    expect(gate.status).toBe(0);
  });

  test('one example still PENDING is enough to fail --require-approved', () => {
    approveAll();
    const last = ids[ids.length - 1] as string;
    const e = readExample(last, dir);
    writeFileSync(
      join(dir, last, 'approval.json'),
      approvalText(last, e.scenarioText, e.expectedText, { status: 'PENDING' })
    );
    const gate = python(['check', '--require-approved'], dir);
    expect(gate.status).toBe(1);
    expect(gate.out).toMatch(/1 example\(s\) are not approved yet/);
  });

  test('an expected.json edited by hand after approval fails check (and the hash gate), and record repairs it from the oracle', () => {
    approveAll();
    const id = ids[1] as string;
    const path = join(dir, id, 'expected.json');
    writeFileSync(path, readFileSync(path, 'utf8').replace('"0.01"', '"0.02"'));
    const caught = python(['check', '--require-approved'], dir);
    expect(caught.status).toBe(1);
    expect(caught.out).toMatch(/expected\.json differs from a fresh run/);
    // the test-side gate hashes the files as stored, so it sees the edit too
    expect(checkApprovals(dir).problems.join('\n')).toMatch(
      new RegExp(
        `${id}: approval\\.json: expected_sha256 .*\\(changed after approval\\)`
      )
    );

    // the approval pins what the oracle makes, so repairing the file from the oracle keeps it
    expect(python(['record'], dir).status).toBe(0);
    expect(statuses(dir).every((s) => s === 'APPROVED')).toBe(true);
    expect(python(['check', '--require-approved'], dir).status).toBe(0);
    expect(checkApprovals(dir, { requireApproved: true }).problems).toEqual([]);
  });

  test('a changed scenario.json makes the approval stale, and record puts the example back to PENDING with a note', () => {
    approveAll();
    const id = ids[0] as string;
    const path = join(dir, id, 'scenario.json');
    writeFileSync(
      path,
      readFileSync(path, 'utf8').replace('"15.00"', '"16.00"')
    );
    const caught = python(['check'], dir);
    expect(caught.status).toBe(1);
    expect(caught.out).toMatch(
      /scenario_sha256 is not the hash of scenario\.json \(changed after approval\)/
    );
    expect(caught.out).toMatch(
      /expected_sha256 is not the hash of expected\.json \(changed after approval\)/
    );

    expect(python(['record'], dir).status).toBe(0);
    const approval = JSON.parse(
      readFileSync(join(dir, id, 'approval.json'), 'utf8')
    ) as { status: string; note: string };
    expect(approval.status).toBe('PENDING');
    expect(approval.note).toMatch(
      /Reset by record.*Davin approved it on 2026-10-11/
    );
    expect(statuses(dir).filter((s) => s === 'APPROVED')).toHaveLength(
      ids.length - 1
    );
    expect(python(['check'], dir).status).toBe(0);
    expect(python(['check', '--require-approved'], dir).status).toBe(1);
  });

  test('record NEVER writes APPROVED: on PENDING files it keeps PENDING, on a true approval it keeps the approval', () => {
    expect(python(['record'], dir).status).toBe(0);
    expect(statuses(dir).every((s) => s === 'PENDING')).toBe(true);
    approveAll();
    expect(python(['record'], dir).out).toMatch(/nothing to write/);
    expect(statuses(dir).every((s) => s === 'APPROVED')).toBe(true);
    // a record into a folder with no approval.json writes PENDING, never APPROVED
    rmSync(join(dir, ids[2] as string, 'approval.json'));
    expect(python(['record'], dir).status).toBe(0);
    expect(statuses(dir)[2]).toBe('PENDING');
  });

  test('a scenario holding a JSON number is refused (every figure is text)', () => {
    const id = ids[0] as string;
    const path = join(dir, id, 'scenario.json');
    writeFileSync(path, readFileSync(path, 'utf8').replace('"15.00"', '15.0'));
    const run = python(['check'], dir);
    expect(run.status).toBe(2);
    expect(run.out).toMatch(/a JSON number \(every figure is text\)/);
  });

  test('an example that stops matching the stored cycle is refused', () => {
    const id = ids[1] as string;
    const path = join(dir, id, 'scenario.json');
    writeFileSync(
      path,
      readFileSync(path, 'utf8').replace(
        '"next_opposing_price": "4369.57"',
        '"next_opposing_price": "4384.28"'
      )
    );
    const run = python(['check'], dir);
    expect(run.status).toBe(2);
    expect(run.out).toMatch(/next_opposing_price is '4384.28'/);
  });
});
