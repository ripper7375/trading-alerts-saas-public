import * as path from 'path';

/**
 * The sensor worker's settings (build step 3 part 4), read from the environment once,
 * when the module is registered. Nothing here is read while the worker is disabled.
 *
 *   SENSOR_WORKER_ENABLED        exactly `true` turns the worker on; anything else (unset, `TRUE`,
 *                                `1`, `yes`) leaves it off. OFF is the default and the rollback.
 *   SENSOR_RETUNING_ENFORCED     exactly `true` tells the sensors about a promote (rule 9); the
 *                                default is false: RETUNING is read and recorded, not applied
 *                                (Davin, Q6; B5 turns it on).
 *   SENSOR_PYTHON                the interpreter, default `python` (the specs use the same name).
 *   SENSOR_ENGINE_DIR            the folder holding `mcd_common`, `mcd0`.. and `mcd_worker`. Default:
 *                                this checkout's `davintrade-stack-d-and-e/engine-1-5-new`. Railway builds
 *                                the gateway alone, so the deployed value is set in B0.
 *   SENSOR_WORKER_CONFIG         a worker configuration file (`--config`), for rollback or a rehearsal
 *                                without a deploy. Unset: the committed `worker_config.yaml` (every flag `off`
 *                                until a person records the evidence and turns one on).
 *   SENSOR_MAX_JOB_AGE_SECONDS   a `cycle-ready` job older than this is skipped and recorded, never read
 *                                (Q11, the ADR-012 STALE window); default 600.
 *   SENSOR_RUNNER_TIMEOUT_MS     how long one runner process may take; default 30,000 (the cycle budget).
 */

export const SENSOR_CONFIG = 'SENSOR_CONFIG';

export const DEFAULT_MAX_JOB_AGE_SECONDS = 600;
export const DEFAULT_RUNNER_TIMEOUT_MS = 30_000;

export interface SensorConfig {
  retuningEnforced: boolean;
  python: string;
  engineDir: string;
  workerConfigPath: string | undefined;
  maxJobAgeSeconds: number;
  runnerTimeoutMs: number;
}

/** True only for the text `true`: a flag that turns something ON must not be switched on by a misspelling. */
export function sensorWorkerEnabled(
  env: NodeJS.ProcessEnv = process.env
): boolean {
  return env['SENSOR_WORKER_ENABLED'] === 'true';
}

function positiveInteger(
  env: NodeJS.ProcessEnv,
  name: string,
  fallback: number
): number {
  const raw = env[name];
  if (raw === undefined || raw === '') return fallback;
  if (!/^[1-9]\d*$/.test(raw)) {
    throw new Error(`${name} must be a positive whole number, got "${raw}"`);
  }
  return Number(raw);
}

function nonEmpty(env: NodeJS.ProcessEnv, name: string): string | undefined {
  const raw = env[name];
  return raw === undefined || raw.trim() === '' ? undefined : raw;
}

/** Where this checkout keeps the Python engine (src/sensors -> the repository root). */
export const DEFAULT_ENGINE_DIR = path.resolve(
  __dirname,
  '..',
  '..',
  '..',
  'davintrade-stack-d-and-e',
  'engine-1-5-new'
);

/** A bad number is a refusal to start: it throws, and so does nothing quietly wrong. */
export function readSensorConfig(
  env: NodeJS.ProcessEnv = process.env
): SensorConfig {
  return {
    retuningEnforced: env['SENSOR_RETUNING_ENFORCED'] === 'true',
    python: nonEmpty(env, 'SENSOR_PYTHON') ?? 'python',
    engineDir: nonEmpty(env, 'SENSOR_ENGINE_DIR') ?? DEFAULT_ENGINE_DIR,
    workerConfigPath: nonEmpty(env, 'SENSOR_WORKER_CONFIG'),
    maxJobAgeSeconds: positiveInteger(
      env,
      'SENSOR_MAX_JOB_AGE_SECONDS',
      DEFAULT_MAX_JOB_AGE_SECONDS
    ),
    runnerTimeoutMs: positiveInteger(
      env,
      'SENSOR_RUNNER_TIMEOUT_MS',
      DEFAULT_RUNNER_TIMEOUT_MS
    ),
  };
}
