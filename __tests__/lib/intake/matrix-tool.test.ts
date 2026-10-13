/**
 * @jest-environment node
 */

/**
 * The matrix review tool (`scripts/intake/matrix_tool.py`, build step 6 part 4).
 *
 * The dispatch matrix is DATA that Davin approves. The tool writes the tables he reads and
 * holds his approval. These tests hold three things:
 *
 *  1. the committed files are what a fresh run makes, and the rules hold for them;
 *  2. the approval gate works: an approval counts only when a person wrote APPROVED over the
 *     exact content they read, any later change (the matrix, the roster, a glossary owner, a
 *     golden cycle) makes it stale, `record` puts a stale one back to PENDING and never writes
 *     APPROVED, and `--require-approved` refuses while it is PENDING;
 *  3. each rule of the tool refuses what it should, on a scratch copy of the tree, and the
 *     tool and the router move together when the matrix or the roster is edited.
 *
 * The gate is also a switch: `INTAKE_REQUIRE_APPROVED=1 npx jest __tests__/lib/intake/matrix-tool.test.ts`
 * (the Jest twin of `python scripts/intake/matrix_tool.py check --require-approved`) fails
 * while the matrix is PENDING. Without it, PENDING is the expected state of a new draft.
 */

import {
  cpSync,
  mkdirSync,
  existsSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

import {
  INTENTS,
  parseRoster,
  type Roster,
  type TraderType,
} from '@/lib/intake';

import { runWorld } from './helpers/assemble';
import { clone } from './helpers/packets';
import { PYTHON, REPO_ROOT, runPython } from './helpers/python';
import { goldenWorlds } from './helpers/world';

const TOOL = 'scripts/intake/matrix_tool.py';
const REQUIRE_APPROVED = process.env['INTAKE_REQUIRE_APPROVED'] === '1';
const GOLDEN = 'davintrade-stack-d-and-e/engine-1-5-new/mcd_worker/golden';

const describeTool = PYTHON === null ? describe.skip : describe;

const tool = (args: string[], root?: string) =>
  runPython([TOOL, ...(root === undefined ? [] : ['--root', root]), ...args]);

// ---------------------------------------------------------------------------------------
// A scratch copy of the tree: the four inputs and the golden scenarios' two JSON files
// ---------------------------------------------------------------------------------------

const made: string[] = [];
afterAll(() => {
  for (const dir of made) rmSync(dir, { recursive: true, force: true });
});

function scratch(): string {
  const root = mkdtempSync(join(tmpdir(), 'matrix-tool-'));
  made.push(root);
  for (const file of [
    'config/intake/dispatch-matrix.v1.json',
    'config/intake/sensor-roster.json',
    'config/intake/glossary.v1.json',
    'lib/intake/version.ts',
  ]) {
    cpSync(join(REPO_ROOT, file), join(root, file), { recursive: true });
  }
  cpSync(join(REPO_ROOT, GOLDEN), join(root, GOLDEN), {
    recursive: true,
    filter: (src) =>
      statSync(src).isDirectory() ||
      /[\\/](scenario|expected)\.json$/.test(src),
  });
  return root;
}

const path = (root: string, ...parts: string[]) => join(root, ...parts);
const matrixPath = (root: string) =>
  path(root, 'config/intake/dispatch-matrix.v1.json');
const rosterPath = (root: string) =>
  path(root, 'config/intake/sensor-roster.json');
const glossaryPath = (root: string) =>
  path(root, 'config/intake/glossary.v1.json');
const reviewPath = (root: string) =>
  path(root, 'config/intake/matrix-review/review.md');
const approvalPath = (root: string) =>
  path(root, 'config/intake/matrix-review/approval.json');

const readJson = (file: string): any => JSON.parse(readFileSync(file, 'utf8'));
const writeJson = (file: string, value: unknown) =>
  writeFileSync(file, JSON.stringify(value, null, 2) + '\n');

/** A scratch tree that has been recorded once. */
function recorded(): string {
  const root = scratch();
  expect(tool(['record'], root).status).toBe(0);
  return root;
}

function approve(root: string, over: Record<string, unknown> = {}): void {
  const approval = readJson(approvalPath(root));
  writeJson(approvalPath(root), {
    ...approval,
    status: 'APPROVED',
    approved_by: 'Davin',
    approved_on: '2026-10-13',
    ...over,
  });
}

// ---------------------------------------------------------------------------------------
// 1. The committed files
// ---------------------------------------------------------------------------------------

describeTool('the committed matrix and its review', () => {
  it('is what a fresh run makes, and holds its rules', () => {
    const run = tool(['check']);
    expect(run.stderr).toBe('');
    expect(run.stdout).toContain('same  matrix');
    expect(run.stdout).toContain('0 problem(s)');
    expect(run.status).toBe(0);
  });

  it('lists the matrix, its version and its status', () => {
    const run = tool(['list']);
    expect(run.status).toBe(0);
    expect(run.stdout).toMatch(
      /^matrix \[(PENDING|APPROVED)\]  routing-v1, 10 intents, 16 cycles, 320 cells\r?\n$/
    );
  });

  it('has an approval that is whole: the hash of the content, and a status', () => {
    const approval = readJson(
      join(REPO_ROOT, 'config/intake/matrix-review/approval.json')
    );
    expect(Object.keys(approval).sort()).toEqual(
      [
        'approved_by',
        'approved_on',
        'area',
        'content_sha256',
        'note',
        'schema',
        'status',
      ].sort()
    );
    expect(approval.schema).toBe('matrix-approval/1');
    expect(approval.area).toBe('matrix');
    expect(approval.content_sha256).toMatch(/^[0-9a-f]{64}$/);
    expect(['PENDING', 'APPROVED']).toContain(approval.status);
  });

  it('holds the gate: --require-approved fails while the matrix is PENDING', () => {
    const run = tool(['check', '--require-approved']);
    if (REQUIRE_APPROVED) {
      expect(run.status).toBe(0);
    } else if (
      readJson(join(REPO_ROOT, 'config/intake/matrix-review/approval.json'))
        .status === 'PENDING'
    ) {
      expect(run.status).toBe(1);
      expect(run.stderr).toContain('not approved yet');
    }
  });

  it('shows every intent against every golden cycle for both trader types', () => {
    const text = readFileSync(
      join(REPO_ROOT, 'config/intake/matrix-review/review.md'),
      'utf8'
    );
    for (const intent of INTENTS) expect(text).toContain(intent);
    expect(text).toContain('## Day Trader');
    expect(text).toContain('## Scalper');
    expect(text).toContain('## Explain: the sensor that owns the term');
    expect(text).toContain('## Readings of the rules to confirm');
    // 16 rows in each of the two M* tables
    for (let n = 1; n <= 16; n += 1) {
      const id = String(n).padStart(2, '0');
      expect(
        (text.match(new RegExp(`^\\| ${id} \\|`, 'gm')) ?? []).length
      ).toBeGreaterThanOrEqual(5);
    }
  });

  it('lists no status in the generated review, so signing it makes nothing stale', () => {
    const text = readFileSync(
      join(REPO_ROOT, 'config/intake/matrix-review/review.md'),
      'utf8'
    );
    expect(text).not.toMatch(/APPROVED|PENDING/);
  });
});

// ---------------------------------------------------------------------------------------
// 2. The approval gate
// ---------------------------------------------------------------------------------------

describeTool('record and the approval gate', () => {
  it('writes both files into an empty review folder, once, and then nothing', () => {
    const root = scratch();
    expect(existsSync(reviewPath(root))).toBe(false);
    const first = tool(['record'], root);
    expect(first.status).toBe(0);
    expect(first.stdout).toContain('wrote  review.md');
    expect(first.stdout).toContain('wrote  approval.json');
    expect(first.stdout).toContain('2 file(s) written');
    const second = tool(['record'], root);
    expect(second.status).toBe(0);
    expect(second.stdout).toContain('nothing to write');
    expect(tool(['check'], root).status).toBe(0);
  });

  it('writes the same files as the committed ones from the same inputs', () => {
    const root = recorded();
    expect(readFileSync(reviewPath(root), 'utf8')).toBe(
      readFileSync(
        join(REPO_ROOT, 'config/intake/matrix-review/review.md'),
        'utf8'
      ).replace(/\r\n/g, '\n')
    );
    const mine = readJson(approvalPath(root));
    const committed = readJson(
      join(REPO_ROOT, 'config/intake/matrix-review/approval.json')
    );
    expect(mine.content_sha256).toBe(committed.content_sha256);
  });

  it('writes PENDING and never APPROVED', () => {
    const root = recorded();
    expect(readJson(approvalPath(root))).toMatchObject({
      status: 'PENDING',
      approved_by: null,
      approved_on: null,
      note: '',
    });
    const gate = tool(['check', '--require-approved'], root);
    expect(gate.status).toBe(1);
    expect(gate.stdout).toContain(
      '1 area, 0 approved, 1 pending approval, 0 problem(s)'
    );
  });

  it('opens the gate the moment a person signs, with no record in between', () => {
    const root = recorded();
    approve(root);
    const gate = tool(['check', '--require-approved'], root);
    expect(gate.status).toBe(0);
    expect(gate.stdout).toContain(
      '1 area, 1 approved, 0 pending approval, 0 problem(s)'
    );
    expect(tool(['list'], root).stdout).toContain('matrix [APPROVED]');
  });

  it('keeps a signature that is still true of the content when record runs again', () => {
    const root = recorded();
    approve(root);
    const before = readFileSync(approvalPath(root), 'utf8');
    const run = tool(['record'], root);
    expect(run.stdout).toContain('nothing to write');
    expect(readFileSync(approvalPath(root), 'utf8')).toBe(before);
  });

  it('keeps a note a person wrote on a PENDING approval', () => {
    const root = recorded();
    writeJson(approvalPath(root), {
      ...readJson(approvalPath(root)),
      note: 'waiting for the Advisor',
    });
    expect(tool(['record'], root).status).toBe(0);
    expect(readJson(approvalPath(root)).note).toBe('waiting for the Advisor');
  });

  describe('a change after approval makes it stale', () => {
    const CHANGES: [string, (root: string) => void][] = [
      [
        'a cell of the matrix',
        (root) => {
          const m = readJson(matrixPath(root));
          m.intents.ENTRY_TIMING.extra = 'NONE';
          writeJson(matrixPath(root), m);
        },
      ],
      [
        'the knowledge of an intent',
        (root) => {
          const m = readJson(matrixPath(root));
          m.intents.NEWS.domains = ['D1', 'D5'];
          writeJson(matrixPath(root), m);
        },
      ],
      [
        'the note of a row',
        (root) => {
          const m = readJson(matrixPath(root));
          m.intents.NEWS.note = 'A different explanation.';
          writeJson(matrixPath(root), m);
        },
      ],
      [
        'the rung that makes a sensor primary',
        (root) => {
          const r = readJson(rosterPath(root));
          r.sensors.find((s: any) => s.mcd_id === 'MCD3').rung.SCALPER =
            'primary_structure';
          r.sensors.find((s: any) => s.mcd_id === 'MCD2').rung.SCALPER =
            'oscillators';
          writeJson(rosterPath(root), r);
        },
      ],
      [
        'the owner of a glossary term',
        (root) => {
          const g = readJson(glossaryPath(root));
          g.terms.find((t: any) => t.id === 'momentum').owners = ['MCD2'];
          writeJson(glossaryPath(root), g);
        },
      ],
      [
        'what a golden cycle’s sensor said',
        (root) => {
          const file = path(
            root,
            GOLDEN,
            '04-trend-up-all-valid/expected.json'
          );
          const e = readJson(file);
          const sensor = e.sensors.find((s: any) => s.mcd_id === 'MCD3');
          const envelope = JSON.parse(sensor.envelope_json);
          envelope.bias = 'STAND_ASIDE';
          sensor.envelope_json = JSON.stringify(envelope);
          writeJson(file, e);
        },
      ],
    ];

    it.each(CHANGES)('after %s', (_name, change) => {
      const root = recorded();
      approve(root);
      expect(tool(['check', '--require-approved'], root).status).toBe(0);
      change(root);

      const stale = tool(['check'], root);
      expect(stale.status).toBe(1);
      expect(stale.stdout).toContain('changed after approval');

      const gate = tool(['check', '--require-approved'], root);
      expect(gate.status).toBe(1);

      // record rewrites the review and puts the approval back to PENDING, with the reason
      const again = tool(['record'], root);
      expect(again.status).toBe(0);
      const approval = readJson(approvalPath(root));
      expect(approval.status).toBe('PENDING');
      expect(approval.note).toContain('Reset by record');
      expect(approval.note).toContain('Davin');
      expect(approval.approved_by).toBeNull();
      expect(tool(['check'], root).status).toBe(0);
      expect(tool(['check', '--require-approved'], root).status).toBe(1);
    });

    it('and a change that touches nothing the tables show leaves the approval alone', () => {
      // the golden folder’s review files are not inputs of this tool
      const root = recorded();
      approve(root);
      writeFileSync(path(root, GOLDEN, 'INDEX.md'), 'anything\n');
      expect(tool(['check', '--require-approved'], root).status).toBe(0);
    });
  });

  it('reports a review.md that was edited by hand, and one that is missing', () => {
    const root = recorded();
    writeFileSync(
      reviewPath(root),
      readFileSync(reviewPath(root), 'utf8').replace('DIRECTION', 'DIRECTIONS')
    );
    const edited = tool(['check'], root);
    expect(edited.status).toBe(1);
    expect(edited.stdout).toContain('review.md differs from a fresh run');
    rmSync(reviewPath(root));
    const missing = tool(['check'], root);
    expect(missing.status).toBe(1);
    expect(missing.stdout).toContain('review.md is missing (run record)');
    expect(tool(['record'], root).status).toBe(0);
    expect(tool(['check'], root).status).toBe(0);
  });

  it('reports an approval.json that is missing, and record writes it PENDING', () => {
    const root = recorded();
    rmSync(approvalPath(root));
    const run = tool(['check'], root);
    expect(run.status).toBe(1);
    expect(run.stdout).toContain('approval.json is missing (run record)');
    expect(tool(['record'], root).status).toBe(0);
    expect(readJson(approvalPath(root)).status).toBe('PENDING');
  });
});

// ---------------------------------------------------------------------------------------
// An approval that has been tampered with
// ---------------------------------------------------------------------------------------

describeTool('an approval that is not true', () => {
  const BAD: [string, (a: any) => unknown, string][] = [
    ['an unknown key', (a) => ({ ...a, signed: true }), "unknown key 'signed'"],
    [
      'a missing key',
      (a) => {
        const { note: _n, ...rest } = a;
        return rest;
      },
      "missing key 'note'",
    ],
    [
      'a status that is not a status',
      (a) => ({ ...a, status: 'MAYBE' }),
      'status must be PENDING or APPROVED',
    ],
    ['another area', (a) => ({ ...a, area: 'terms' }), "area is 'terms'"],
    [
      'another schema',
      (a) => ({ ...a, schema: 'glossary-approval/1' }),
      'schema must be',
    ],
    [
      'a hash that is not a hash',
      (a) => ({ ...a, content_sha256: 'abc' }),
      'not a SHA-256',
    ],
    [
      'a hash of other content',
      (a) => ({ ...a, content_sha256: '0'.repeat(64) }),
      'not the hash of the content',
    ],
    [
      'a note that is not text',
      (a) => ({ ...a, note: 5 }),
      'note must be a text',
    ],
    [
      'APPROVED with no name',
      (a) => ({ ...a, status: 'APPROVED', approved_on: '2026-10-13' }),
      'needs approved_by',
    ],
    [
      'APPROVED with a blank name',
      (a) => ({
        ...a,
        status: 'APPROVED',
        approved_by: '  ',
        approved_on: '2026-10-13',
      }),
      'needs approved_by',
    ],
    [
      'APPROVED with no date',
      (a) => ({ ...a, status: 'APPROVED', approved_by: 'Davin' }),
      'needs approved_on',
    ],
    [
      'APPROVED with a date that is not a date',
      (a) => ({
        ...a,
        status: 'APPROVED',
        approved_by: 'Davin',
        approved_on: '13/10/2026',
      }),
      'needs approved_on',
    ],
    ['a file that is not an object', () => [], 'not an object'],
  ];

  it.each(BAD)('refuses %s', (_name, change, expected) => {
    const root = recorded();
    writeJson(approvalPath(root), change(readJson(approvalPath(root))));
    const run = tool(['check'], root);
    expect(run.status).toBe(1);
    expect(run.stdout).toContain(expected);
    // and does not count it as approved
    expect(tool(['check', '--require-approved'], root).status).toBe(1);
    expect(tool(['list'], root).stdout).toContain('matrix [PENDING]');
  });

  it('refuses an approval.json that is not JSON, and record writes a new one', () => {
    const root = recorded();
    writeFileSync(approvalPath(root), '{ not json');
    const run = tool(['check'], root);
    expect(run.status).toBe(1);
    expect(run.stdout).toContain('approval.json is not valid JSON');
    expect(run.stdout).toContain(
      '1 area, 0 approved, 1 pending approval, 1 problem(s)'
    );
    expect(tool(['record'], root).status).toBe(0);
    expect(tool(['check'], root).status).toBe(0);
  });

  it('does not let record sign: an APPROVED file that is wrong is made PENDING', () => {
    const root = recorded();
    approve(root, { content_sha256: '1'.repeat(64) });
    expect(tool(['record'], root).status).toBe(0);
    expect(readJson(approvalPath(root)).status).toBe('PENDING');
  });
});

// ---------------------------------------------------------------------------------------
// 3. The rules of the matrix
// ---------------------------------------------------------------------------------------

describeTool('a matrix that breaks a rule is refused, not reviewed', () => {
  const RULES: [string, (m: any) => unknown, string][] = [
    ['a matrix that is not an object', () => [], 'the matrix is not an object'],
    ['an unknown top key', (m) => ({ ...m, extra: 1 }), "unknown key 'extra'"],
    [
      'no version',
      (m) => {
        const { version: _v, ...rest } = m;
        return rest;
      },
      "missing key 'version'",
    ],
    [
      'another schema',
      (m) => ({ ...m, schema: 'dispatch-matrix/2' }),
      'schema must be',
    ],
    [
      'a version the code does not name',
      (m) => ({ ...m, version: 'routing-v2' }),
      "version is 'routing-v2'",
    ],
    [
      'intents that are not an object',
      (m) => ({ ...m, intents: [] }),
      'intents is not an object',
    ],
    [
      'a missing intent',
      (m) => {
        delete m.intents.NEWS;
        return m;
      },
      'intents.NEWS: missing',
    ],
    [
      'an unknown intent',
      (m) => {
        m.intents.VOICE = m.intents.NEWS;
        return m;
      },
      'intents.VOICE: not an intent',
    ],
    [
      'a row that is not an object',
      (m) => {
        m.intents.NEWS = 'NONE';
        return m;
      },
      'intents.NEWS: not an object',
    ],
    [
      'an unknown key in a row',
      (m) => {
        m.intents.NEWS.weight = 1;
        return m;
      },
      "unknown key 'weight'",
    ],
    [
      'a missing key in a row',
      (m) => {
        delete m.intents.NEWS.extra;
        return m;
      },
      "missing key 'extra'",
    ],
    [
      'always as text',
      (m) => {
        m.intents.NEWS.always = 'yes';
        return m;
      },
      'always: must be true or false',
    ],
    [
      'an unknown selector',
      (m) => {
        m.intents.NEWS.extra = 'ALL';
        return m;
      },
      'is not a selector',
    ],
    [
      'an unknown playbook scope',
      (m) => {
        m.intents.NEWS.playbooks = 'ALL';
        return m;
      },
      'is not a scope',
    ],
    [
      'an empty note',
      (m) => {
        m.intents.NEWS.note = '';
        return m;
      },
      'note: must be 1 to 240 characters',
    ],
    [
      'a note of 241 characters',
      (m) => {
        m.intents.NEWS.note = 'x'.repeat(241);
        return m;
      },
      'note: must be 1 to 240 characters',
    ],
    [
      'a domain that does not exist',
      (m) => {
        m.intents.NEWS.domains = ['D9'];
        return m;
      },
      "'D9' is not a domain",
    ],
    [
      'domains out of order',
      (m) => {
        m.intents.NEWS.domains = ['D5', 'D1'];
        return m;
      },
      'repeated or out of order',
    ],
    [
      'a repeated domain',
      (m) => {
        m.intents.NEWS.domains = ['D5', 'D5'];
        return m;
      },
      'repeated or out of order',
    ],
    [
      'domains that are not a list',
      (m) => {
        m.intents.NEWS.domains = 'D5';
        return m;
      },
      'domains: must be a list',
    ],
    [
      'Report 2 with readings',
      (m) => {
        m.intents.REPORT_2.always = true;
        return m;
      },
      'REPORT_2.always: must be false',
    ],
    [
      'Out of scope with an extra sensor',
      (m) => {
        m.intents.OUT_OF_SCOPE.extra = 'ZONE_SOURCES';
        return m;
      },
      'carries no readings',
    ],
    [
      'Report 2 with knowledge',
      (m) => {
        m.intents.REPORT_2.domains = ['D1'];
        return m;
      },
      'names no knowledge',
    ],
    [
      'another intent without the always set',
      (m) => {
        m.intents.RISK_SIZING.always = false;
        return m;
      },
      'RISK_SIZING.always: must be true',
    ],
  ];

  it.each(RULES)('refuses %s', (_name, change, expected) => {
    const root = scratch();
    writeJson(matrixPath(root), change(readJson(matrixPath(root))));
    for (const command of ['record', 'check', 'list']) {
      const run = tool([command], root);
      expect(run.status).toBe(2);
      expect(run.stderr).toContain('ERROR');
      expect(run.stderr).toContain(expected);
    }
    // and nothing was written
    expect(existsSync(reviewPath(root))).toBe(false);
  });

  it('reports every broken rule, not only the first', () => {
    const root = scratch();
    const m = readJson(matrixPath(root));
    m.intents.NEWS.extra = 'ALL';
    m.intents.DIRECTION.playbooks = 'ALL';
    delete m.intents.EXPLAIN;
    writeJson(matrixPath(root), m);
    const run = tool(['check'], root);
    expect(run.status).toBe(2);
    expect(run.stderr.match(/ERROR/g)?.length).toBeGreaterThanOrEqual(3);
  });

  it('reads the version the code names from lib/intake/version.ts', () => {
    const root = scratch();
    const file = path(root, 'lib/intake/version.ts');
    writeFileSync(
      file,
      readFileSync(file, 'utf8').replace("'routing-v1'", "'routing-v3'")
    );
    const run = tool(['check'], root);
    expect(run.status).toBe(2);
    expect(run.stderr).toContain("lib/intake/version.ts names 'routing-v3'");
    writeFileSync(file, 'export const nothing = 1;\n');
    expect(tool(['check'], root).stderr).toContain('names no ROUTING_VERSION');
  });
});

describeTool('files that are not usable', () => {
  const FILES = [
    ['the matrix', matrixPath],
    ['the roster', rosterPath],
    ['the glossary', glossaryPath],
    ['the version file', (r: string) => path(r, 'lib/intake/version.ts')],
    ['the golden folder', (r: string) => path(r, GOLDEN)],
  ] as const;

  it.each(FILES)('exits 2 when %s is missing', (_name, locate) => {
    const root = scratch();
    rmSync(locate(root), { recursive: true });
    const run = tool(['check'], root);
    expect(run.status).toBe(2);
    expect(run.stderr).toContain('is missing');
  });

  it.each([
    ['the matrix', matrixPath],
    ['the roster', rosterPath],
    ['the glossary', glossaryPath],
  ] as const)('exits 2 when %s is not JSON', (_name, locate) => {
    const root = scratch();
    writeFileSync(locate(root), '{ nope');
    const run = tool(['check'], root);
    expect(run.status).toBe(2);
    expect(run.stderr).toContain('is not valid JSON');
  });

  it('exits 2 for a roster or a glossary that is not what it says', () => {
    const a = scratch();
    writeJson(rosterPath(a), { sensors: 'none' });
    expect(tool(['check'], a).stderr).toContain('is not a roster');
    const b = scratch();
    writeJson(glossaryPath(b), { terms: 'none' });
    expect(tool(['check'], b).stderr).toContain('is not a glossary');
  });

  it('exits 2 for an unknown command, and for none', () => {
    expect(runPython([TOOL, 'approve']).status).toBe(2);
    expect(runPython([TOOL]).status).toBe(2);
  });
});

// ---------------------------------------------------------------------------------------
// The tool and the router move together
// ---------------------------------------------------------------------------------------

describeTool('the tool and the router read the same data', () => {
  const CODE = [
    'import json, sys',
    "sys.path.insert(0, 'scripts/intake')",
    'import matrix_tool as m',
    'from pathlib import Path',
    'sys.stdout.write(json.dumps(m.compute(m.Tree(Path(sys.argv[1])))))',
  ].join('\n');

  const cellsOf = (root: string): any[] => {
    const run = runPython(['-c', CODE, root]);
    if (run.status !== 0) throw new Error(run.stderr);
    return JSON.parse(run.stdout).cells;
  };

  it('both follow an edit of the matrix: Entry timing with no extra sensor', async () => {
    const root = scratch();
    const m = readJson(matrixPath(root));
    m.intents.ENTRY_TIMING.extra = 'NONE';
    writeJson(matrixPath(root), m);
    const cells = cellsOf(root);
    expect(
      cells.every((c) => JSON.stringify(c.intents.ENTRY_TIMING.extra) === '[]')
    ).toBe(true);

    // the router, handed the same edited matrix, gives the same cells
    const { parseMatrix } = await import('@/lib/intake');
    const parsed = parseMatrix(m);
    if (!parsed.ok) throw new Error('the edited matrix does not parse');
    for (const world of goldenWorlds()) {
      for (const trader of ['DAY_TRADER', 'SCALPER'] as TraderType[]) {
        const run = await runWorld(world, trader, 'ENTRY_TIMING');
        const { route } = await import('@/lib/intake');
        const edited = route({
          intent: 'ENTRY_TIMING',
          traderType: trader,
          liveIds: run.snapshot.live_ids,
          sensors: Object.fromEntries(
            Object.entries(run.snapshot.rows).map(([id, row]) => [
              id,
              row.facts,
            ])
          ),
          synthesis: run.snapshot.synthesis?.facts ?? null,
          matrix: parsed.matrix,
        });
        const cell = cells.find(
          (c) => c.cycle === world.name && c.trader === trader
        );
        expect(edited.m_star).toEqual(cell.intents.ENTRY_TIMING.m_star);
        expect(edited.extra).toEqual([]);
      }
    }
  });

  it('both follow an edit of the rung: MCD3 becomes the Scalper’s primary sensor', async () => {
    const root = scratch();
    const r = readJson(rosterPath(root));
    const find = (id: string) => r.sensors.find((s: any) => s.mcd_id === id);
    find('MCD2').rung.SCALPER = 'oscillators';
    find('MCD2').primary_for = [];
    find('MCD3').rung.SCALPER = 'primary_structure';
    find('MCD3').primary_for = ['SCALPER'];
    writeJson(rosterPath(root), r);
    const parsed = parseRoster(clone(r));
    if (!parsed.ok) throw new Error(JSON.stringify(parsed.issues));
    const roster: Roster = parsed.roster;

    const cells = cellsOf(root);
    let compared = 0;
    for (const world of goldenWorlds()) {
      for (const intent of INTENTS) {
        const run = await runWorld(world, 'SCALPER', intent, { roster });
        const cell = cells.find(
          (c) => c.cycle === world.name && c.trader === 'SCALPER'
        );
        const expected = cell.intents[intent];
        expect({
          primary: run.route.primary,
          always: run.route.always,
          extra: run.route.extra,
          m_star: run.route.m_star,
        }).toEqual({
          primary: expected.primary,
          always: expected.always,
          extra: expected.extra,
          m_star: expected.m_star,
        });
        expect(run.route.primary).toEqual(['MCD3']);
        compared += 1;
      }
    }
    expect(compared).toBe(160);
  });
});

// ---------------------------------------------------------------------------------------
// The details a mutation check found nobody looking at
// ---------------------------------------------------------------------------------------

describeTool('the files and the messages, in detail', () => {
  const CODE = [
    'import json, sys',
    "sys.path.insert(0, 'scripts/intake')",
    'import matrix_tool as m',
    'from pathlib import Path',
    'sys.stdout.write(json.dumps(m.compute(m.Tree(Path(sys.argv[1])))))',
  ].join('\n');

  it('reads review.md and approval.json checked out with CRLF line endings as the same files', () => {
    const root = recorded();
    approve(root);
    for (const file of [reviewPath(root), approvalPath(root)]) {
      writeFileSync(file, readFileSync(file, 'utf8').replace(/\n/g, '\r\n'));
    }
    const gate = tool(['check', '--require-approved'], root);
    expect(gate.status).toBe(0);
    expect(gate.stdout).toContain('0 problem(s)');
    expect(tool(['record'], root).stdout).toContain('nothing to write');
  });

  it('names the first line that differs, as stored and as a fresh run has it, cut at 100 characters', () => {
    const root = recorded();
    const lines = readFileSync(reviewPath(root), 'utf8').split('\n');
    const index = lines.findIndex((line) => line.startsWith('| EXPLAIN |'));
    const fresh = lines[index] as string;
    expect(fresh.length).toBeGreaterThan(100);
    const edited = fresh.replace('EXPLAIN', 'EXPLAINS');
    lines[index] = edited;
    writeFileSync(reviewPath(root), lines.join('\n'));
    const run = tool(['check'], root);
    expect(run.stdout).toContain(
      `review.md differs from a fresh run: line ${index + 1} is '${edited.slice(0, 100)}', a fresh run has '${fresh.slice(0, 100)}'`
    );
  });

  it('says the file ends early, and that it goes on too long', () => {
    const root = recorded();
    const text = readFileSync(reviewPath(root), 'utf8');
    const fresh = text.split('\n');
    writeFileSync(reviewPath(root), fresh.slice(0, -5).join('\n'));
    const early = tool(['check'], root);
    expect(early.stdout).toContain(
      `line ${fresh.length - 5 + 1} is '<end of file>', a fresh run has `
    );
    writeFileSync(reviewPath(root), text + '\nmore');
    const late = tool(['check'], root);
    expect(late.stdout).toContain(
      `line ${fresh.length + 1} is 'more', a fresh run has '<end of file>'`
    );
  });

  it('reports every row, also those after a row that is not an object', () => {
    const root = scratch();
    const m = readJson(matrixPath(root));
    m.intents.DIRECTION = 'NONE';
    m.intents.EXPLAIN.extra = 'ALL';
    writeJson(matrixPath(root), m);
    const run = tool(['check'], root);
    expect(run.status).toBe(2);
    expect(run.stderr).toContain('intents.DIRECTION: not an object');
    expect(run.stderr).toContain(
      "intents.EXPLAIN.extra: 'ALL' is not a selector"
    );
  });

  it('ignores what is not a scenario in the golden folder', () => {
    const root = recorded();
    mkdirSync(path(root, GOLDEN, 'drafts'));
    writeFileSync(path(root, GOLDEN, '99-a-file-not-a-folder'), 'text');
    const run = tool(['check'], root);
    expect(run.stderr).toBe('');
    expect(run.status).toBe(0);
  });

  it('keeps a note with a line break and a bar on one line of the table', () => {
    const root = scratch();
    const m = readJson(matrixPath(root));
    m.intents.NEWS.note = 'first line\nsecond | line';
    writeJson(matrixPath(root), m);
    expect(tool(['record'], root).status).toBe(0);
    expect(readFileSync(reviewPath(root), 'utf8')).toContain(
      'first line second \\| line |'
    );
  });

  it('says "none" when no cycle gives Direction the whole board', () => {
    const root = scratch();
    for (const name of [
      '01-real-18-sep-counter-trend-rally',
      '02-real-28-sep-1415-snapback-no-zones',
      '03-real-28-sep-2315-downtrend-continuation',
    ]) {
      rmSync(path(root, GOLDEN, name), { recursive: true });
    }
    for (const entry of readdirSync(path(root, GOLDEN))) {
      if (/^\d\d-/.test(entry) && !entry.startsWith('04-')) {
        rmSync(path(root, GOLDEN, entry), { recursive: true });
      }
    }
    expect(tool(['record'], root).status).toBe(0);
    const text = readFileSync(reviewPath(root), 'utf8');
    expect(text.match(/in cycle\(s\): none\./g)).toHaveLength(2);
  });

  it('writes a fresh note when the old one is not text, and keeps one that is', () => {
    const root = recorded();
    writeJson(approvalPath(root), { ...readJson(approvalPath(root)), note: 5 });
    expect(tool(['record'], root).status).toBe(0);
    expect(readJson(approvalPath(root)).note).toBe('');
  });

  it('does not call a wrong hash on a PENDING approval a change after approval', () => {
    const root = recorded();
    writeJson(approvalPath(root), {
      ...readJson(approvalPath(root)),
      content_sha256: '2'.repeat(64),
    });
    const run = tool(['check'], root);
    expect(run.stdout).toContain(
      'content_sha256 is not the hash of the content'
    );
    expect(run.stdout).not.toContain('changed after approval');
  });

  it('adds a sensor to Exit and targets only for a level strictly beyond the entry', () => {
    const snippet = [
      'import json, sys',
      "sys.path.insert(0, 'scripts/intake')",
      'import matrix_tool as m',
      'from pathlib import Path',
      'tree = m.Tree(Path(sys.argv[1]))',
      'matrix = m.load_json(tree.matrix)',
      'roster = m.load_roster(tree)',
      'cycle = json.loads(sys.argv[2])',
      'out = m.route(matrix, roster, {}, cycle, "DAY_TRADER", "EXIT_TARGETS")',
      'sys.stdout.write(json.dumps(out["extra"]))',
    ].join('\n');
    const sensors = (levels: Record<string, number[]>) =>
      Object.fromEntries(
        Object.entries(levels).map(([id, l]) => [
          id,
          { status: 'VALID', bias: 'LONG', levels: l },
        ])
      );
    const extraOf = (
      syn: Record<string, unknown>,
      levels: Record<string, number[]>
    ) => {
      const run = runPython([
        '-c',
        snippet,
        REPO_ROOT,
        JSON.stringify({
          sensors: sensors(levels),
          synthesis: {
            DAY_TRADER: { rule: 'R', status: 'VALID', sources: [], ...syn },
          },
        }),
      ]);
      if (run.status !== 0) throw new Error(run.stderr);
      return JSON.parse(run.stdout) as string[];
    };
    const levels = { MCD1: [100], MCD2: [100.01], MCD3: [99.99] };
    expect(
      extraOf({ bias: 'LONG', entry: 100, reference: null }, levels)
    ).toEqual(['MCD2']);
    expect(
      extraOf({ bias: 'SHORT', entry: 100, reference: null }, levels)
    ).toEqual(['MCD3']);
    // with no zone, the close of the reading is the entry
    expect(
      extraOf({ bias: 'LONG', entry: null, reference: 100 }, levels)
    ).toEqual(['MCD2']);
    // no direction, no entry: nothing
    expect(
      extraOf({ bias: 'NEUTRAL', entry: 100, reference: null }, levels)
    ).toEqual([]);
    expect(
      extraOf({ bias: 'LONG', entry: null, reference: null }, levels)
    ).toEqual([]);
  });

  it('works out a cycle whose synthesis has no reading for one trader type, as the router does', async () => {
    const root = scratch();
    const file = path(root, GOLDEN, '04-trend-up-all-valid/expected.json');
    const e = readJson(file);
    e.synthesis.readings = e.synthesis.readings.filter(
      (r: { profile: string }) => r.profile !== 'SCALPER'
    );
    writeJson(file, e);
    expect(tool(['record'], root).status).toBe(0);
    const run = runPython(['-c', CODE, root]);
    expect(run.status).toBe(0);
    const cells = JSON.parse(run.stdout).cells as {
      cycle: string;
      trader: string;
      intents: Record<string, { m_star: string[]; extra: string[] }>;
    }[];
    const cell = cells.find(
      (c) => c.cycle.startsWith('04-') && c.trader === 'SCALPER'
    )!;
    const world = goldenWorlds().find((w) => w.name.startsWith('04-'))!;
    const without = {
      ...world,
      synthesis: world.synthesis.filter((r) => r.profile !== 'SCALPER'),
    };
    for (const intent of INTENTS) {
      const routed = await runWorld(without, 'SCALPER', intent);
      expect(routed.route.m_star).toEqual(cell.intents[intent]!.m_star);
      expect(routed.route.extra).toEqual(cell.intents[intent]!.extra);
    }
    // no synthesis, no zones and no direction: only the always set
    expect(cell.intents['ENTRY_TIMING']!.extra).toEqual([]);
    expect(cell.intents['EXIT_TARGETS']!.extra).toEqual([]);
  });
});
