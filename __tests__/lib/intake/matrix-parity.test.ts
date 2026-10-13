/**
 * @jest-environment node
 */

/**
 * The router and the matrix review tool agree on every cell (build step 6 part 4).
 *
 * `scripts/intake/matrix_tool.py` computes M* for every intent against the 16 golden cycles,
 * for both trader types, with code of its own: the primary sensor from the registry rung, the
 * warnings, the five selectors. `lib/intake/router.ts` is the code that runs in production.
 * Davin approves the tables the Python writes, so the router must give exactly those cells:
 * this test runs the router over the same 320 cells and the whole Explain table and requires
 * the same primary sensor, warnings, ALWAYS, EXTRA, M*, domains and playbooks in each.
 *
 * Neither side is the reference. If they disagree, one of them is wrong; read the spec (plan
 * decisions D2 and D10) before changing either.
 */

import {
  INTENTS,
  type Intent,
  type Timeframe,
  type TraderType,
} from '@/lib/intake';

import { runWorld } from './helpers/assemble';
import { PYTHON, runPython } from './helpers/python';
import { goldenWorlds, type World } from './helpers/world';

interface PyRoute {
  primary: string[];
  warnings: { sensor: string; kind: string }[];
  always: string[];
  extra: string[];
  m_star: string[];
  domains: string[];
  playbooks: string[];
}
interface PyCell {
  cycle: string;
  trader: TraderType;
  primary: string[];
  warnings: { sensor: string; kind: string }[];
  intents: Record<Intent, PyRoute>;
}
interface PyContent {
  cells: PyCell[];
  explain_base: string;
  explain: {
    owners: string[];
    terms: string[];
    extra: Record<string, string[]>;
  }[];
}

const CODE = [
  'import json, sys',
  "sys.path.insert(0, 'scripts/intake')",
  'import matrix_tool as m',
  'from pathlib import Path',
  "sys.stdout.write(json.dumps(m.compute(m.Tree(Path('.')))))",
].join('\n');

const describeTool = PYTHON === null ? describe.skip : describe;

describeTool('the router against the matrix review tool', () => {
  let content: PyContent;
  const worlds = new Map<string, World>();

  beforeAll(() => {
    const run = runPython(['-c', CODE]);
    if (run.status !== 0) throw new Error(`matrix_tool failed: ${run.stderr}`);
    content = JSON.parse(run.stdout) as PyContent;
    for (const w of goldenWorlds()) worlds.set(w.name, w);
  });

  it('computes 320 cells: 16 cycles x 2 trader types x 10 intents', () => {
    expect(content.cells).toHaveLength(32);
    expect(
      content.cells.reduce((n, c) => n + Object.keys(c.intents).length, 0)
    ).toBe(320);
    expect(Object.keys(content.cells[0]!.intents)).toEqual([...INTENTS]);
    expect(new Set(content.cells.map((c) => c.cycle)).size).toBe(16);
  });

  it('agrees on the primary sensor, the warnings and every intent of every cell', async () => {
    let compared = 0;
    for (const cell of content.cells) {
      const w = worlds.get(cell.cycle);
      if (w === undefined) throw new Error(`no world ${cell.cycle}`);
      for (const intent of INTENTS) {
        const run = await runWorld(w, cell.trader, intent);
        const expected = cell.intents[intent];
        const found = {
          primary: run.route.primary,
          warnings: run.route.warnings.map((x) => ({
            sensor: x.mcd_id,
            kind: x.kind,
          })),
          always: run.route.always,
          extra: run.route.extra,
          m_star: run.route.m_star,
          domains: run.route.domains,
          playbooks: run.route.playbooks,
        };
        if (JSON.stringify(found) !== JSON.stringify(expected)) {
          throw new Error(
            `${cell.cycle} ${cell.trader} ${intent}\n  router: ${JSON.stringify(found)}\n  tool:   ${JSON.stringify(expected)}`
          );
        }
        compared += 1;
      }
      // the tool's own per-cycle summary is the same as what every intent saw
      expect(cell.primary).toEqual(cell.intents.DIRECTION.primary);
      expect(cell.warnings).toEqual(cell.intents.DIRECTION.warnings);
    }
    expect(compared).toBe(320);
  });

  it('agrees on the Explain table: every term of every owner group, per trader type and timeframe', async () => {
    const base = worlds.get(content.explain_base);
    if (base === undefined) throw new Error('no base world');
    const frames: Record<string, Timeframe[]> = {
      none: [],
      M5: ['M5'],
      M15: ['M15'],
      'M5+M15': ['M5', 'M15'],
    };
    let compared = 0;
    for (const group of content.explain) {
      for (const [key, expected] of Object.entries(group.extra)) {
        const [trader, frame] = key.split('|') as [TraderType, string];
        for (const term of group.terms) {
          const run = await runWorld(base, trader, 'EXPLAIN', {
            termIds: [term],
            timeframes: frames[frame] as Timeframe[],
          });
          if (JSON.stringify(run.route.extra) !== JSON.stringify(expected)) {
            throw new Error(
              `${term} ${key}: router ${JSON.stringify(run.route.extra)}, tool ${JSON.stringify(expected)}`
            );
          }
          compared += 1;
        }
      }
    }
    // 73 terms x 2 trader types x 4 timeframe cases
    expect(compared).toBe(73 * 2 * 4);
  });

  it('has the owner groups of the glossary: a term is in exactly one group', () => {
    const all = content.explain.flatMap((g) => g.terms);
    expect(all).toHaveLength(73);
    expect(new Set(all).size).toBe(73);
  });

  it('keeps the router and the tool apart: the tool never reads the roster’s primary_for', () => {
    const fs = jest.requireActual<typeof import('fs')>('fs');
    const source = fs.readFileSync('scripts/intake/matrix_tool.py', 'utf8');
    expect(source).not.toMatch(
      /\[['"]primary_for['"]\]|get\(['"]primary_for['"]/
    );
  });
});
