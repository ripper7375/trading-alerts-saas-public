/**
 * Test support for the evaluation gate (build step 7 part 10): the recorded runs on disk, the
 * current fingerprint parts, and a LIVE-looking copy of the stand-in run to break on purpose.
 *
 * A copy is made so the gate's positive case can be shown (a live run for a `passed` model that
 * meets every bar) and so each negative case changes ONE thing and nothing else.
 */

import { readdirSync, readFileSync } from 'fs';
import { join, resolve } from 'path';

import type { CurrentParts } from '@/lib/reply/eval/fingerprint';
import { currentFingerprint } from '@/lib/reply/eval/fingerprint';
import { SCENARIO_SET } from '@/lib/reply/eval/scenarios';
import { summarizeCells } from '@/lib/reply/eval/suite';
import type { CellRecord, EvalRun } from '@/lib/reply/eval/suite';

import { currentPartsFor } from './harness';

export const ROOT = resolve(__dirname, '..', '..', '..', '..', '..');
export const RUNS_DIR = join(ROOT, 'config', 'reply', 'eval-runs');
export const STAND_IN_PATH = join(RUNS_DIR, 'stand-in.json');

export const lf = (text: string): string => text.replace(/\r\n/g, '\n');

export function readRunFile(path: string): { text: string; run: EvalRun } {
  const text = lf(readFileSync(path, 'utf8'));
  return { text, run: JSON.parse(text) as EvalRun };
}

export function loadRuns(): EvalRun[] {
  return readdirSync(RUNS_DIR)
    .filter((name) => name.endsWith('.json'))
    .sort()
    .map((name) => readRunFile(join(RUNS_DIR, name)).run);
}

let partsPromise: Promise<CurrentParts> | null = null;
/** The fingerprint parts that do not name a model, as the code and the data are now (computed once). */
export function currentParts(): Promise<CurrentParts> {
  partsPromise ??= currentPartsFor(SCENARIO_SET);
  return partsPromise;
}

export const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

/**
 * The stand-in run dressed as the LIVE run of a model, with its fingerprint recomputed for the
 * current parts and its summary recomputed from its cells. Every bar holds in it.
 */
export async function liveCopyOf(
  stand: EvalRun,
  model: { slug: string; provider: string },
  mutate: (cells: CellRecord[]) => void = () => undefined
): Promise<EvalRun> {
  const copy = clone(stand);
  mutate(copy.cells);
  const fingerprint = await currentFingerprint(model, await currentParts());
  copy.kind = 'LIVE';
  copy.label = `LIVE RUN of ${model.slug} served by ${model.provider}`;
  copy.model = { ...model };
  copy.fingerprint = fingerprint;
  copy.id = `live-${fingerprint.sha256.slice(0, 12)}`;
  copy.summary = summarizeCells(copy.cells, SCENARIO_SET.scenarios);
  return copy;
}

/** The scored cells of one locale, in the run's order. */
export function scoredCellsOfLocale(
  run: EvalRun,
  locale: string
): CellRecord[] {
  const scored = new Set(
    SCENARIO_SET.scenarios
      .filter(
        (scenario) =>
          scenario.source === 'MODEL' &&
          scenario.locales === 'ALL' &&
          scenario.expect.regenerations === 0 &&
          (scenario.expect.outcome === 'REPORT1' ||
            scenario.expect.outcome === 'ANSWER')
      )
      .map((scenario) => scenario.id)
  );
  return run.cells.filter(
    (cell) => cell.locale === locale && scored.has(cell.scenario)
  );
}
