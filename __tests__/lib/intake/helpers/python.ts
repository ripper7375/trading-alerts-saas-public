/**
 * Running Python from a test. `python` on Windows, often only `python3` elsewhere; without
 * either (or without the two packages the tools use) the tests that need it are skipped,
 * not failed, as `__tests__/lib/engine4/worked-examples.test.ts` does. `-B` keeps
 * `__pycache__` out of the tree.
 */

import { spawnSync } from 'child_process';
import { join } from 'path';

export const REPO_ROOT = join(__dirname, '..', '..', '..', '..');

export const PYTHON: string | null =
  ['python', 'python3'].find(
    (name) => spawnSync(name, ['--version'], { encoding: 'utf8' }).status === 0
  ) ?? null;

const hasPackages =
  PYTHON !== null &&
  spawnSync(PYTHON, ['-B', '-c', 'import jsonschema, yaml'], {
    encoding: 'utf8',
  }).status === 0;

/** `describe` when Python and its packages are there, `describe.skip` when they are not. */
export const describePython = hasPackages ? describe : describe.skip;

export interface PythonRun {
  status: number | null;
  stdout: string;
  stderr: string;
}

export function runPython(
  args: string[],
  options: { input?: string; cwd?: string } = {}
): PythonRun {
  const run = spawnSync(PYTHON ?? 'python', ['-B', ...args], {
    encoding: 'utf8',
    cwd: options.cwd ?? REPO_ROOT,
    input: options.input,
    maxBuffer: 256 * 1024 * 1024,
    env: { ...process.env, PYTHONIOENCODING: 'utf-8' },
  });
  return { status: run.status, stdout: run.stdout, stderr: run.stderr };
}
