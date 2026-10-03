import * as fs from 'fs';
import * as path from 'path';
import {
  DEFAULT_ENGINE_DIR,
  DEFAULT_MAX_JOB_AGE_SECONDS,
  DEFAULT_RUNNER_TIMEOUT_MS,
  readSensorConfig,
  sensorWorkerEnabled,
} from '../src/sensors/sensor-config';

/**
 * The sensor worker's switches (build step 3 part 4). The one that matters most is that the
 * worker is OFF unless the text is exactly `true`: a misspelling must never turn a consumer on.
 */
describe('SENSOR_WORKER_ENABLED', () => {
  it('is on only for exactly the text "true"', () => {
    expect(sensorWorkerEnabled({ SENSOR_WORKER_ENABLED: 'true' })).toBe(true);
  });

  it.each([
    [undefined],
    [''],
    ['false'],
    ['TRUE'],
    ['True'],
    ['1'],
    ['yes'],
    ['on'],
    [' true'],
    ['true '],
    ['"true"'],
    ['enabled'],
  ])('is off for %j', (value) => {
    expect(
      sensorWorkerEnabled(
        value === undefined ? {} : { SENSOR_WORKER_ENABLED: value }
      )
    ).toBe(false);
  });

  it('reads the process environment when none is given, and is off in this one', () => {
    expect(process.env['SENSOR_WORKER_ENABLED']).toBeUndefined();
    expect(sensorWorkerEnabled()).toBe(false);
  });
});

describe('readSensorConfig', () => {
  it('has the defaults: RETUNING recorded and not applied, `python`, this checkout’s engine, the committed worker configuration, 10 minutes, 30 seconds', () => {
    expect(readSensorConfig({})).toEqual({
      retuningEnforced: false,
      python: 'python',
      engineDir: DEFAULT_ENGINE_DIR,
      workerConfigPath: undefined,
      maxJobAgeSeconds: 600,
      runnerTimeoutMs: 30_000,
    });
    expect(DEFAULT_MAX_JOB_AGE_SECONDS).toBe(600);
    expect(DEFAULT_RUNNER_TIMEOUT_MS).toBe(30_000);
  });

  it('the default engine folder is the one that holds the runner (the repository layout)', () => {
    expect(
      fs.existsSync(path.join(DEFAULT_ENGINE_DIR, 'mcd_worker', 'cli.py'))
    ).toBe(true);
    expect(
      fs.existsSync(path.join(DEFAULT_ENGINE_DIR, 'mcd_common', 'envelope.py'))
    ).toBe(true);
  });

  it('SENSOR_RETUNING_ENFORCED is true only for exactly "true"', () => {
    expect(
      readSensorConfig({ SENSOR_RETUNING_ENFORCED: 'true' }).retuningEnforced
    ).toBe(true);
    for (const value of ['TRUE', '1', 'yes', '', 'false', ' true'])
      expect(
        readSensorConfig({ SENSOR_RETUNING_ENFORCED: value }).retuningEnforced
      ).toBe(false);
  });

  it('takes every override', () => {
    expect(
      readSensorConfig({
        SENSOR_PYTHON: 'python3.11',
        SENSOR_ENGINE_DIR: '/app/engine',
        SENSOR_WORKER_CONFIG: '/app/shadow.yaml',
        SENSOR_MAX_JOB_AGE_SECONDS: '120',
        SENSOR_RUNNER_TIMEOUT_MS: '5000',
      })
    ).toEqual({
      retuningEnforced: false,
      python: 'python3.11',
      engineDir: '/app/engine',
      workerConfigPath: '/app/shadow.yaml',
      maxJobAgeSeconds: 120,
      runnerTimeoutMs: 5000,
    });
  });

  it('a blank text is "not set"', () => {
    expect(
      readSensorConfig({
        SENSOR_PYTHON: '  ',
        SENSOR_ENGINE_DIR: '',
        SENSOR_WORKER_CONFIG: '   ',
        SENSOR_MAX_JOB_AGE_SECONDS: '',
        SENSOR_RUNNER_TIMEOUT_MS: '',
      })
    ).toEqual(readSensorConfig({}));
  });

  it.each([['0'], ['-5'], ['1.5'], ['abc'], ['10s'], ['0600'], [' 5']])(
    'refuses to start on a bad number: %j',
    (value) => {
      expect(() =>
        readSensorConfig({ SENSOR_MAX_JOB_AGE_SECONDS: value })
      ).toThrow(/SENSOR_MAX_JOB_AGE_SECONDS must be a positive whole number/);
      expect(() =>
        readSensorConfig({ SENSOR_RUNNER_TIMEOUT_MS: value })
      ).toThrow(/SENSOR_RUNNER_TIMEOUT_MS must be a positive whole number/);
    }
  );
});
