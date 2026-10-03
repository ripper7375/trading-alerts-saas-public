import { spawnSync } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { ENGINE_DIR, StoredCycle } from './cycle-fixtures';

/**
 * Runs the Python cycle runner (`python -m mcd_worker.cli`, build step 3 part 1) the
 * way the sensor worker will (part 4): one JSON request on stdin, one JSON line on
 * stdout, from `davintrade-stack-d-and-e/engine-1-5-new/`, one process per cycle.
 *
 * Specs that need it are skipped when Python 3 with PyYAML and jsonschema is not on
 * the machine (`SENSOR_PYTHON` names another interpreter). A spec never installs
 * anything.
 */
const PYTHON = process.env['SENSOR_PYTHON'] ?? 'python';

const childEnv = {
  ...process.env,
  PYTHONDONTWRITEBYTECODE: '1',
  PYTHONIOENCODING: 'utf-8',
};

let available: boolean | undefined;

/** True when the interpreter can import the kit and the worker (and so PyYAML and jsonschema). */
export function pythonAvailable(): boolean {
  if (available === undefined) {
    const probe = spawnSync(
      PYTHON,
      ['-B', '-c', 'import mcd_common, mcd_worker.cli, yaml, jsonschema'],
      { cwd: ENGINE_DIR, env: childEnv, encoding: 'utf8', timeout: 60_000 }
    );
    available = probe.status === 0;
  }
  return available;
}

export interface CliRun {
  status: number | null;
  stdout: string;
  stderr: string;
  /** The parsed `mcd-cycle-result/1`, when the runner exited 0. */
  result: (StoredCycle & { runtime?: unknown }) | undefined;
}

/**
 * The committed `worker_config.yaml` has every MCD `off` (nothing runs until a person turns
 * one on and records its evidence), so a spec that wants readings supplies this file: all four
 * at `shadow`, as the stored cycles (`mcd_worker/fixtures/*.cycle.json`) were made. It is
 * written outside the repo, once per test process.
 */
let shadowConfig: string | undefined;
/** The all-`shadow` worker configuration the specs hand the runner (made on first use; `removeShadowConfig` deletes it). */
export function shadowConfigPath(): string {
  if (shadowConfig === undefined) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mcd-shadow-'));
    shadowConfig = path.join(dir, 'shadow.yaml');
    fs.writeFileSync(
      shadowConfig,
      'schema: mcd-worker-config/1\nflags:\n  MCD0: shadow\n  MCD1: shadow\n  MCD2: shadow\n  MCD3: shadow\n',
      'utf8'
    );
  }
  return shadowConfig;
}

/**
 * Deletes the folder `shadowConfigPath` made (nothing happens when none was made). Safe to call twice: the next
 * `runCycleCli` makes a new one. The folder is only ever the one this module created (`mcd-shadow-<random>` under the
 * operating system's temporary folder, holding `shadow.yaml`).
 */
export function removeShadowConfig(): void {
  if (shadowConfig === undefined) return;
  const dir = path.dirname(shadowConfig);
  shadowConfig = undefined;
  fs.rmSync(dir, { recursive: true, force: true });
}

// Jest gives every spec file its own copy of this module, and the file that loaded it is the one that made the folder, so
// each file removes its own when its tests are done (before part 7 one folder per Jest process stayed in the temporary
// folder for good). A script that loads this module outside Jest has no `afterAll` and calls `removeShadowConfig` itself.
if (typeof afterAll === 'function') afterAll(removeShadowConfig);

/**
 * One cycle through the real runner. `bundle` is sent as JSON exactly as given. The flags are
 * all `shadow` unless `config: 'committed'` asks for the committed file (everything off).
 */
export function runCycleCli(
  bundle: unknown,
  options: { retuningEnforced?: boolean; config?: 'shadow' | 'committed' } = {}
): CliRun {
  const request = {
    request_version: 'mcd-cycle-request/1',
    bundle,
    ...(options.retuningEnforced === undefined
      ? {}
      : { retuning_enforced: options.retuningEnforced }),
  };
  const args = ['-B', '-m', 'mcd_worker.cli'];
  if (options.config !== 'committed') args.push('--config', shadowConfigPath());
  const run = spawnSync(PYTHON, args, {
    cwd: ENGINE_DIR,
    env: childEnv,
    input: JSON.stringify(request),
    encoding: 'utf8',
    maxBuffer: 256 * 1024 * 1024,
    timeout: 120_000,
  });
  return {
    status: run.status,
    stdout: run.stdout,
    stderr: run.stderr,
    result: run.status === 0 ? JSON.parse(run.stdout) : undefined,
  };
}

/**
 * A one-off Python program's JSON output, for comparing a TypeScript function with the
 * kit's. `input` (JSON) goes to its stdin: a long list does not fit a command line.
 */
export function pythonJson<T>(code: string, input?: unknown): T {
  const run = spawnSync(PYTHON, ['-B', '-c', code], {
    cwd: ENGINE_DIR,
    env: childEnv,
    ...(input === undefined ? {} : { input: JSON.stringify(input) }),
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
    timeout: 120_000,
  });
  if (run.status !== 0) throw new Error(`python failed: ${run.stderr}`);
  return JSON.parse(run.stdout) as T;
}
