import { spawn } from 'child_process';
import { EventEmitter } from 'events';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { PassThrough, Writable } from 'stream';
import { RunnerError } from '../src/sensors/cycle-run-result';
import {
  MAX_STDERR_BYTES,
  MAX_STDOUT_BYTES,
  PythonCycleRunner,
  RunnerSettings,
} from '../src/sensors/python-runner';
import {
  ENGINE_DIR,
  FIXTURE_SLOTS,
  readFixtureBundle,
  readFixtureCycle,
} from './helpers/cycle-fixtures';
import { pythonAvailable } from './helpers/kit-runner';
import { sha256, unitResult } from './helpers/sensors-worker-world';

/**
 * The bridge to the Python cycle runner (build step 3 part 4): what it sends, what it does with
 * every way a process can end, and (when Python is on the machine) the real runner behind it.
 */

// ---------------------------------------------------------------- a process that does what a spec says

interface FakeChild extends EventEmitter {
  stdout: PassThrough;
  stderr: PassThrough;
  stdin: Writable;
  kill: jest.Mock;
  stdinText: () => string;
}

function fakeChild(): FakeChild {
  const written: Buffer[] = [];
  const stdin = new Writable({
    write(chunk, _encoding, done) {
      written.push(Buffer.from(chunk));
      done();
    },
  });
  const child = new EventEmitter() as FakeChild;
  child.stdout = new PassThrough();
  child.stderr = new PassThrough();
  child.stdin = stdin;
  child.kill = jest.fn();
  child.stdinText = () => Buffer.concat(written).toString('utf8');
  return child;
}

interface Launch {
  command: string;
  args: string[];
  options: Record<string, any>;
  child: FakeChild;
}

/** A `spawn` that records each launch and lets the spec drive the child once the request has been written. */
function fakeSpawn(behave: (child: FakeChild, launch: Launch) => void): {
  spawn: typeof spawn;
  launches: Launch[];
} {
  const launches: Launch[] = [];
  const fake = ((
    command: string,
    args: string[],
    options: Record<string, any>
  ) => {
    const child = fakeChild();
    const launch = { command, args, options, child };
    launches.push(launch);
    child.stdin.on('finish', () => setImmediate(() => behave(child, launch)));
    return child;
  }) as unknown as typeof spawn;
  return { spawn: fake, launches };
}

const settings = (over: Partial<RunnerSettings> = {}): RunnerSettings => ({
  python: 'python',
  engineDir: ENGINE_DIR,
  workerConfigPath: undefined,
  runnerTimeoutMs: 5000,
  ...over,
});

const answer = (child: FakeChild, text: string, code = 0): void => {
  child.stdout.write(text);
  child.emit('close', code, null);
};

async function failure(promise: Promise<unknown>): Promise<RunnerError> {
  try {
    await promise;
  } catch (error) {
    expect(error).toBeInstanceOf(RunnerError);
    return error as RunnerError;
  }
  throw new Error('expected the runner to fail');
}

describe('PythonCycleRunner with a process that does what the spec says', () => {
  const bundle = { symbol: 'XAUUSD', cycle_slot: '2026-09-18T20:55Z' };

  it('starts `python -B -m mcd_worker.cli` in the engine folder and sends ONE request: version, bundle, retuning_enforced', async () => {
    const { spawn: fake, launches } = fakeSpawn((child) =>
      answer(child, JSON.stringify(unitResult()))
    );
    const output = await new PythonCycleRunner(settings(), fake).run({
      bundle,
      retuningEnforced: true,
    });
    expect(launches).toHaveLength(1);
    const [launch] = launches;
    expect(launch.command).toBe('python');
    expect(launch.args).toEqual(['-B', '-m', 'mcd_worker.cli']);
    expect(launch.options['cwd']).toBe(ENGINE_DIR);
    expect(launch.options['env']['PYTHONDONTWRITEBYTECODE']).toBe('1');
    expect(launch.options['env']['PYTHONIOENCODING']).toBe('utf-8');
    expect(launch.options['stdio']).toEqual(['pipe', 'pipe', 'pipe']);
    expect(launch.options['windowsHide']).toBe(true);
    expect(JSON.parse(launch.child.stdinText())).toEqual({
      request_version: 'mcd-cycle-request/1',
      bundle,
      retuning_enforced: true,
    });
    expect(output.result.results).toHaveLength(4);
    expect(output.stderr).toBe('');
  });

  it('sends retuning_enforced as a JSON boolean, false included (the runner refuses anything else)', async () => {
    const { spawn: fake, launches } = fakeSpawn((child) =>
      answer(child, JSON.stringify(unitResult()))
    );
    await new PythonCycleRunner(settings(), fake).run({
      bundle,
      retuningEnforced: false,
    });
    expect(JSON.parse(launches[0].child.stdinText()).retuning_enforced).toBe(
      false
    );
  });

  it('passes --config only when an override is set', () => {
    expect(new PythonCycleRunner(settings()).args()).toEqual([
      '-B',
      '-m',
      'mcd_worker.cli',
    ]);
    expect(
      new PythonCycleRunner(
        settings({ workerConfigPath: '/etc/sensors/shadow.yaml' })
      ).args()
    ).toEqual([
      '-B',
      '-m',
      'mcd_worker.cli',
      '--config',
      '/etc/sensors/shadow.yaml',
    ]);
  });

  it('returns the runner’s log lines with the result, and how long the process took', async () => {
    const log =
      '{"level":"ERROR","logger":"mcd.worker","message":"evaluator raised"}\n';
    const { spawn: fake } = fakeSpawn((child) => {
      child.stderr.write(log);
      answer(child, JSON.stringify(unitResult()));
    });
    const output = await new PythonCycleRunner(settings(), fake).run({
      bundle,
      retuningEnforced: false,
    });
    expect(output.stderr).toBe(log);
    expect(output.wallMs).toBeGreaterThanOrEqual(0);
  });

  it('keeps only the first 64 KB of the log', async () => {
    const { spawn: fake } = fakeSpawn((child) => {
      for (let i = 0; i < 5; i += 1) child.stderr.write('x'.repeat(40_000));
      answer(child, JSON.stringify(unitResult()));
    });
    const output = await new PythonCycleRunner(settings(), fake).run({
      bundle,
      retuningEnforced: false,
    });
    expect(output.stderr).toHaveLength(MAX_STDERR_BYTES);
  });

  it('exit 2 is a REQUEST error that will not mend by retrying, with the first line of the log', async () => {
    const { spawn: fake } = fakeSpawn((child) => {
      child.stderr.write(
        '\n{"error":"ConfigError","problems":["no such file"]}\n'
      );
      child.emit('close', 2, null);
    });
    const error = await failure(
      new PythonCycleRunner(settings(), fake).run({
        bundle,
        retuningEnforced: false,
      })
    );
    expect(error.kind).toBe('REQUEST');
    expect(error.retryable).toBe(false);
    expect(error.message).toContain('ConfigError');
    expect(error.details.exitCode).toBe(2);
    expect(error.details.stderr).toContain('no such file');
  });

  it('exit 1 is a crash worth another try', async () => {
    const { spawn: fake } = fakeSpawn((child) => {
      child.stderr.write('Traceback (most recent call last):\n  boom\n');
      child.emit('close', 1, null);
    });
    const error = await failure(
      new PythonCycleRunner(settings(), fake).run({
        bundle,
        retuningEnforced: false,
      })
    );
    expect(error.kind).toBe('EXIT');
    expect(error.retryable).toBe(true);
    expect(error.message).toContain('exit 1');
    expect(error.message).toContain('Traceback');
  });

  it('a process ended by a signal is a crash, and the message says which signal', async () => {
    const { spawn: fake } = fakeSpawn((child) =>
      child.emit('close', null, 'SIGKILL')
    );
    const error = await failure(
      new PythonCycleRunner(settings(), fake).run({
        bundle,
        retuningEnforced: false,
      })
    );
    expect(error.kind).toBe('EXIT');
    expect(error.message).toContain('signal SIGKILL');
    expect(error.message).toContain('no message on stderr');
  });

  it('exit 0 with something that is not a result is an OUTPUT error that keeps the exit code and the log', async () => {
    const { spawn: fake } = fakeSpawn((child) => {
      child.stderr.write('a warning\n');
      answer(child, 'not json');
    });
    const error = await failure(
      new PythonCycleRunner(settings(), fake).run({
        bundle,
        retuningEnforced: false,
      })
    );
    expect(error.kind).toBe('OUTPUT');
    expect(error.retryable).toBe(false);
    expect(error.details).toEqual({ exitCode: 0, stderr: 'a warning\n' });
  });

  it('exit 0 with a result of the wrong shape is an OUTPUT error naming the problem', async () => {
    const { spawn: fake } = fakeSpawn((child) =>
      answer(child, JSON.stringify({ ...unitResult(), results: 'none' }))
    );
    const error = await failure(
      new PythonCycleRunner(settings(), fake).run({
        bundle,
        retuningEnforced: false,
      })
    );
    expect(error.kind).toBe('OUTPUT');
    expect(error.message).toContain('results must be a list');
  });

  it('output beyond the limit kills the process and is an OUTPUT error', async () => {
    const half = Buffer.alloc(Math.floor(MAX_STDOUT_BYTES / 2) + 1, 0x20);
    const { spawn: fake, launches } = fakeSpawn((child) => {
      child.stdout.write(half);
      child.stdout.write(half);
      setImmediate(() => child.emit('close', null, 'SIGKILL'));
    });
    const error = await failure(
      new PythonCycleRunner(settings(), fake).run({
        bundle,
        retuningEnforced: false,
      })
    );
    expect(error.kind).toBe('OUTPUT');
    expect(error.message).toContain('wrote more than');
    expect(launches[0].child.kill).toHaveBeenCalledWith('SIGKILL');
  });

  it('a process that runs past its time is killed and is a TIMEOUT worth another try; a late close changes nothing', async () => {
    const { spawn: fake, launches } = fakeSpawn(() => undefined);
    const promise = new PythonCycleRunner(
      settings({ runnerTimeoutMs: 30 }),
      fake
    ).run({ bundle, retuningEnforced: false });
    const error = await failure(promise);
    expect(error.kind).toBe('TIMEOUT');
    expect(error.retryable).toBe(true);
    expect(error.message).toContain('30 ms');
    expect(launches[0].child.kill).toHaveBeenCalledWith('SIGKILL');
    launches[0].child.emit('close', 0, null); // after the verdict: ignored, no second settle
  });

  it('an interpreter that does not exist (spawn throws, or the error event) is a SPAWN error that will not mend by retrying', async () => {
    const enoent = Object.assign(new Error('spawn python ENOENT'), {
      code: 'ENOENT',
    });
    const throwing = (() => {
      throw enoent;
    }) as unknown as typeof spawn;
    const thrown = await failure(
      new PythonCycleRunner(settings(), throwing).run({
        bundle,
        retuningEnforced: false,
      })
    );
    expect(thrown.kind).toBe('SPAWN');
    expect(thrown.retryable).toBe(false);
    expect(thrown.message).toContain('cannot start "python"');

    const { spawn: fake } = fakeSpawn((child) => child.emit('error', enoent));
    const emitted = await failure(
      new PythonCycleRunner(settings(), fake).run({
        bundle,
        retuningEnforced: false,
      })
    );
    expect(emitted.kind).toBe('SPAWN');
    expect(emitted.retryable).toBe(false);
  });

  it.each(['ENOENT', 'EACCES', 'ENOTDIR'])(
    'a spawn failure with code %s fails the same way every time: not worth another try',
    async (code) => {
      const failed = Object.assign(new Error(`spawn ${code}`), { code });
      const { spawn: fake } = fakeSpawn((child) => child.emit('error', failed));
      const error = await failure(
        new PythonCycleRunner(settings(), fake).run({
          bundle,
          retuningEnforced: false,
        })
      );
      expect(error.kind).toBe('SPAWN');
      expect(error.retryable).toBe(false);
    }
  );

  it('a spawn failure that may pass (EAGAIN: no process slot) is worth another try', async () => {
    const eagain = Object.assign(new Error('spawn EAGAIN'), { code: 'EAGAIN' });
    const { spawn: fake } = fakeSpawn((child) => child.emit('error', eagain));
    const error = await failure(
      new PythonCycleRunner(settings(), fake).run({
        bundle,
        retuningEnforced: false,
      })
    );
    expect(error.kind).toBe('SPAWN');
    expect(error.retryable).toBe(true);
  });

  it('a broken pipe on stdin (the runner exited before reading) does not crash the worker: the exit code tells why', async () => {
    const { spawn: fake } = fakeSpawn((child) => {
      child.stdin.emit('error', new Error('write EPIPE'));
      child.stderr.write('usage: bad flag\n');
      child.emit('close', 2, null);
    });
    const error = await failure(
      new PythonCycleRunner(settings(), fake).run({
        bundle,
        retuningEnforced: false,
      })
    );
    expect(error.kind).toBe('REQUEST');
  });
});

// ---------------------------------------------------------------- the real runner

const realPython = pythonAvailable();
const real = realPython ? describe : describe.skip;

real('PythonCycleRunner with the real `python -m mcd_worker.cli`', () => {
  jest.setTimeout(180_000);
  let dir: string;
  let shadow: string;

  beforeAll(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sensor-runner-'));
    shadow = path.join(dir, 'shadow.yaml');
    fs.writeFileSync(
      shadow,
      'schema: mcd-worker-config/1\nflags:\n  MCD0: shadow\n  MCD1: shadow\n  MCD2: shadow\n  MCD3: shadow\n',
      'utf8'
    );
  });
  afterAll(() => fs.rmSync(dir, { recursive: true, force: true }));

  const runner = (over: Partial<RunnerSettings> = {}) =>
    new PythonCycleRunner(
      settings({
        python: process.env['SENSOR_PYTHON'] ?? 'python',
        workerConfigPath: shadow,
        ...over,
      })
    );

  it.each(FIXTURE_SLOTS.map((f) => [f.name, f] as const))(
    '%s: every envelope is the stored one, and the result carries the exact bundle text the hash is of',
    async (_name, fixture) => {
      const stored = readFixtureCycle(fixture);
      const bundle = readFixtureBundle(fixture);
      const { result } = await runner().run({
        bundle,
        retuningEnforced: false,
      });
      expect(result.results.map((r) => [r.mcd_id, r.envelope_json])).toEqual(
        stored.results.map((r) => [r.mcd_id, r.envelope_json])
      );
      expect(result.inputs_sha256).toBe(stored.inputs_sha256);
      expect(result.bundle_canonical_json).not.toBeNull();
      expect(sha256(result.bundle_canonical_json as string)).toBe(
        result.inputs_sha256
      );
      // the text is the bundle that was sent, in the runner's own canonical writing
      expect(JSON.parse(result.bundle_canonical_json as string)).toEqual(
        bundle
      );
      expect(result.runtime.python).toMatch(/^3\.\d+\.\d+/);
    }
  );

  it('the committed worker configuration (no override) has every MCD off: no reading, but still the bundle text', async () => {
    const { result } = await runner({ workerConfigPath: undefined }).run({
      bundle: readFixtureBundle(FIXTURE_SLOTS[0]),
      retuningEnforced: false,
    });
    expect(result.results).toEqual([]);
    expect(result.order).toEqual([]);
    expect(typeof result.bundle_canonical_json).toBe('string');
  });

  it('JavaScript and Python write a small float differently: the text to store is the runner’s, never a rebuild (Davin, part 3 decision 3)', async () => {
    const bundle = readFixtureBundle(FIXTURE_SLOTS[0]);
    const damaged = JSON.parse(JSON.stringify(bundle));
    damaged.bars.M5[damaged.bars.M5.length - 1].close = 0.00001;
    const { result } = await runner().run({
      bundle: damaged,
      retuningEnforced: false,
    });
    const text = result.bundle_canonical_json as string;
    expect(text).toContain('1e-05');
    expect(JSON.stringify(JSON.parse(text))).toContain('0.00001');
    expect(JSON.stringify(JSON.parse(text))).not.toBe(text);
    expect(sha256(text)).toBe(result.inputs_sha256);
  });

  it('RETUNING: observed is recorded; applied only when enforced; the stored text keeps what the cycle said', async () => {
    const bundle = { ...readFixtureBundle(FIXTURE_SLOTS[0]), retuning: true };
    const observed = (await runner().run({ bundle, retuningEnforced: false }))
      .result;
    expect(observed.retuning).toEqual({
      observed: true,
      enforced: false,
      applied: false,
    });
    const applied = (await runner().run({ bundle, retuningEnforced: true }))
      .result;
    expect(applied.retuning).toEqual({
      observed: true,
      enforced: true,
      applied: true,
    });
    expect(new Set(applied.results.map((r) => r.status))).toEqual(
      new Set(['CAUTIONARY'])
    );
    expect(JSON.parse(observed.bundle_canonical_json as string).retuning).toBe(
      true
    );
    expect(observed.bundle_canonical_json).toBe(applied.bundle_canonical_json);
  });

  it('a configuration file that does not exist is refused by the runner (exit 2): REQUEST, not retried', async () => {
    const error = await failure(
      runner({ workerConfigPath: path.join(dir, 'nope.yaml') }).run({
        bundle: readFixtureBundle(FIXTURE_SLOTS[0]),
        retuningEnforced: false,
      })
    );
    expect(error.kind).toBe('REQUEST');
    expect(error.retryable).toBe(false);
    expect(error.details.exitCode).toBe(2);
  });

  it('a bundle that is not a bundle is refused by the runner (exit 2)', async () => {
    const error = await failure(
      runner().run({ bundle: { symbol: 'XAUUSD' }, retuningEnforced: false })
    );
    expect(error.kind).toBe('REQUEST');
    expect(error.message).toContain('not a CycleInputs');
  });

  it('an interpreter that is not installed is a SPAWN error', async () => {
    const error = await failure(
      runner({ python: 'no-such-python-for-the-sensor-worker' }).run({
        bundle: readFixtureBundle(FIXTURE_SLOTS[0]),
        retuningEnforced: false,
      })
    );
    expect(error.kind).toBe('SPAWN');
    expect(error.retryable).toBe(false);
  });

  it('an engine folder that does not exist is a SPAWN error too (the process cannot start there)', async () => {
    const error = await failure(
      runner({ engineDir: path.join(dir, 'no-engine-here') }).run({
        bundle: readFixtureBundle(FIXTURE_SLOTS[0]),
        retuningEnforced: false,
      })
    );
    expect(error.kind).toBe('SPAWN');
  });

  it('a time limit of 1 ms kills the real process: TIMEOUT', async () => {
    const error = await failure(
      runner({ runnerTimeoutMs: 1 }).run({
        bundle: readFixtureBundle(FIXTURE_SLOTS[0]),
        retuningEnforced: false,
      })
    );
    expect(error.kind).toBe('TIMEOUT');
    expect(error.retryable).toBe(true);
  });
});
