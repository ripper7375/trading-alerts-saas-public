import { ChildProcess, spawn } from 'child_process';
import {
  REQUEST_VERSION,
  RunnerError,
  RunnerOutput,
  parseCycleResult,
} from './cycle-run-result';
import type { SensorConfig } from './sensor-config';

/**
 * The bridge to the Python cycle runner (`python -m mcd_worker.cli`, build step 3 part 1):
 * one process per cycle, the request as one JSON object on stdin, the answer as one JSON line
 * on stdout, the runner's logs on stderr. Nothing is kept between cycles (Davin, Q2 and Q3).
 *
 * The process is started from the engine folder, so `mcd_common`, the four evaluators and
 * `mcd_worker` are found as the checkout has them. A request the runner refuses (exit 2), a
 * crash (exit 1), a timeout, a missing interpreter and an answer that is not a result are each
 * a `RunnerError`: the worker invents no reading when the runner gave none.
 */

export const CYCLE_RUNNER = 'CYCLE_RUNNER';

export interface RunnerRequest {
  /** The bundle (`CycleInputsBundle`), sent as it is. */
  bundle: unknown;
  /** The SENSOR_RETUNING_ENFORCED switch. */
  retuningEnforced: boolean;
}

export interface CycleRunner {
  run(request: RunnerRequest): Promise<RunnerOutput>;
}

/** A result carries the bundle text and every envelope: far more than a megabyte would be a runner gone wrong. */
export const MAX_STDOUT_BYTES = 64 * 1024 * 1024;
/** The runner's log lines kept for the worker: enough for a stack trace, never a flood. */
export const MAX_STDERR_BYTES = 64 * 1024;

type SpawnFn = typeof spawn;

export type RunnerSettings = Pick<
  SensorConfig,
  'python' | 'engineDir' | 'workerConfigPath' | 'runnerTimeoutMs'
>;

export class PythonCycleRunner implements CycleRunner {
  constructor(
    private readonly settings: RunnerSettings,
    private readonly spawnProcess: SpawnFn = spawn
  ) {}

  /** The command line of one run: `-B` so no bytecode is written beside the kit, `--config` only when an override is set. */
  args(): string[] {
    return [
      '-B',
      '-m',
      'mcd_worker.cli',
      ...(this.settings.workerConfigPath === undefined
        ? []
        : ['--config', this.settings.workerConfigPath]),
    ];
  }

  run(request: RunnerRequest): Promise<RunnerOutput> {
    const { python, engineDir, runnerTimeoutMs } = this.settings;
    const body = JSON.stringify({
      request_version: REQUEST_VERSION,
      bundle: request.bundle,
      retuning_enforced: request.retuningEnforced,
    });
    const started = Date.now();

    return new Promise<RunnerOutput>((resolve, reject) => {
      let child: ChildProcess;
      try {
        child = this.spawnProcess(python, this.args(), {
          cwd: engineDir,
          env: {
            ...process.env,
            PYTHONDONTWRITEBYTECODE: '1',
            PYTHONIOENCODING: 'utf-8',
          },
          stdio: ['pipe', 'pipe', 'pipe'],
          windowsHide: true,
        });
      } catch (error) {
        reject(spawnFailure(python, error));
        return;
      }

      const stdout: Buffer[] = [];
      const stderr: Buffer[] = [];
      let stdoutBytes = 0;
      let stderrBytes = 0;
      let tooLarge = false;
      let settled = false;

      const settle = (finish: () => void): void => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        finish();
      };
      const log = (): string => Buffer.concat(stderr).toString('utf8');

      const timer = setTimeout(() => {
        child.kill('SIGKILL');
        settle(() =>
          reject(
            new RunnerError(
              'TIMEOUT',
              `the runner took more than ${runnerTimeoutMs} ms and was killed`,
              true,
              { stderr: log() }
            )
          )
        );
      }, runnerTimeoutMs);

      child.stdout?.on('data', (chunk: Buffer) => {
        stdoutBytes += chunk.length;
        if (stdoutBytes > MAX_STDOUT_BYTES) {
          tooLarge = true;
          child.kill('SIGKILL');
          return;
        }
        stdout.push(chunk);
      });
      child.stderr?.on('data', (chunk: Buffer) => {
        if (stderrBytes >= MAX_STDERR_BYTES) return;
        const room = MAX_STDERR_BYTES - stderrBytes;
        stderr.push(chunk.length > room ? chunk.subarray(0, room) : chunk);
        stderrBytes += Math.min(chunk.length, room);
      });
      child.on('error', (error) =>
        settle(() => reject(spawnFailure(python, error)))
      );
      // The runner may exit before it has read the request (a bad flag): the exit code says why.
      child.stdin?.on('error', () => undefined);
      child.on('close', (code, signal) =>
        settle(() => {
          if (tooLarge) {
            reject(
              new RunnerError(
                'OUTPUT',
                `the runner wrote more than ${MAX_STDOUT_BYTES} bytes`,
                false,
                { exitCode: code, stderr: log() }
              )
            );
            return;
          }
          if (code === 0) {
            try {
              resolve({
                result: parseCycleResult(
                  Buffer.concat(stdout).toString('utf8')
                ),
                stderr: log(),
                wallMs: Date.now() - started,
              });
            } catch (error) {
              if (error instanceof RunnerError) {
                reject(
                  new RunnerError(error.kind, error.message, error.retryable, {
                    exitCode: code,
                    stderr: log(),
                  })
                );
              } else {
                reject(error);
              }
            }
            return;
          }
          if (code === 2) {
            reject(
              new RunnerError(
                'REQUEST',
                `the runner refused the request or its configuration (exit 2): ${firstLine(log())}`,
                false,
                { exitCode: code, stderr: log() }
              )
            );
            return;
          }
          reject(
            new RunnerError(
              'EXIT',
              `the runner failed (${code === null ? `signal ${String(signal)}` : `exit ${code}`}): ${firstLine(log())}`,
              true,
              { exitCode: code, stderr: log() }
            )
          );
        })
      );

      child.stdin?.end(body);
    });
  }
}

function firstLine(text: string): string {
  const line = text.split('\n').find((candidate) => candidate.trim() !== '');
  return line === undefined ? 'no message on stderr' : line.slice(0, 500);
}

function spawnFailure(python: string, error: unknown): RunnerError {
  const code = (error as NodeJS.ErrnoException).code;
  const reason = (error as Error).message;
  return new RunnerError(
    'SPAWN',
    `cannot start "${python}" (${reason})`,
    // a missing interpreter or folder fails the same way every time; anything else (EAGAIN) may pass
    code !== 'ENOENT' && code !== 'EACCES' && code !== 'ENOTDIR'
  );
}
