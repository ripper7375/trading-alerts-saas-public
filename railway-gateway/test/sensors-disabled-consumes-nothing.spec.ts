import * as fs from 'fs';
import * as path from 'path';
import { BullModule, getQueueToken } from '@nestjs/bull';
import { Global, Module } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AppModule } from '../src/app.module';
import { CycleReadModule } from '../src/cycle/read/cycle-read.module';
import { PrismaService } from '../src/prisma/prisma.service';
import {
  CycleReadyProcessor,
  INPUTS_SOURCE,
} from '../src/sensors/cycle-ready.processor';
import { EnvelopeValidator } from '../src/sensors/envelope-validator';
import { DatabaseInputsSource } from '../src/sensors/inputs/database-inputs.source';
import { McdOutputsWriter } from '../src/sensors/mcd-outputs.writer';
import { SynReadingValidator } from '../src/sensors/syn-validator';
import { SynthesisWriter } from '../src/sensors/synthesis.writer';
import { CYCLE_RUNNER, PythonCycleRunner } from '../src/sensors/python-runner';
import { SENSOR_CONFIG } from '../src/sensors/sensor-config';
import { SensorsModule } from '../src/sensors/sensors.module';
import { CYCLE_READY_JOB, CYCLE_READY_QUEUE } from '../src/worker/cycle-queues';

/**
 * The sensor worker is OFF unless `SENSOR_WORKER_ENABLED` is exactly `true` (build step 3
 * part 4; the plan's S4: a consumer that starts at deploy would evaluate days of queued jobs).
 * Three levels of evidence that "off" really consumes nothing:
 *
 *   1. what `register()` returns for every value of the variable;
 *   2. a real Nest module graph with a Bull explorer and a fake queue: when off, `process()` is
 *      never called on the queue; when on, it is called once, for the `cycle-ready` job;
 *   3. a read of the source: only one file declares a consumer of the queue, and only the
 *      sensors module provides it.
 */

const OFF_VALUES: Array<string | undefined> = [
  undefined,
  '',
  'false',
  'FALSE',
  'TRUE',
  'True',
  '1',
  'yes',
  'on',
  ' true',
  'true ',
  '"true"',
  'enabled',
  '0',
];

const ENABLED = { SENSOR_WORKER_ENABLED: 'true' };

describe('SensorsModule.register: what each value of SENSOR_WORKER_ENABLED does', () => {
  it.each(OFF_VALUES.map((v) => [v] as const))(
    '%j registers NOTHING: no import, no provider, no controller, no export',
    (value) => {
      const env = value === undefined ? {} : { SENSOR_WORKER_ENABLED: value };
      const registered = SensorsModule.register(env);
      expect(registered).toEqual({ module: SensorsModule });
      expect(Object.keys(registered)).toEqual(['module']);
    }
  );

  it('does not even read the other settings while off (a bad number cannot stop a gateway that is not using the worker)', () => {
    expect(() =>
      SensorsModule.register({
        SENSOR_MAX_JOB_AGE_SECONDS: 'banana',
        SENSOR_RUNNER_TIMEOUT_MS: '-1',
      })
    ).not.toThrow();
  });

  it('with no argument it reads the process environment, which has the worker off here', () => {
    expect(process.env['SENSOR_WORKER_ENABLED']).toBeUndefined();
    expect(SensorsModule.register()).toEqual({ module: SensorsModule });
  });

  it('is on only for exactly "true", and then registers the one consumer with its parts', () => {
    const registered = SensorsModule.register(ENABLED);
    expect(registered.module).toBe(SensorsModule);
    const providers = (registered.providers ?? []) as any[];
    const classes = providers.filter((p) => typeof p === 'function');
    expect(classes).toEqual([
      DatabaseInputsSource,
      EnvelopeValidator,
      SynReadingValidator,
      SynthesisWriter,
      McdOutputsWriter,
      CycleReadyProcessor,
    ]);
    const tokens = providers
      .filter((p) => typeof p !== 'function')
      .map((p) => p.provide);
    expect(tokens).toEqual([SENSOR_CONFIG, INPUTS_SOURCE, CYCLE_RUNNER]);
    expect(registered.imports).toContain(CycleReadModule);
    const queues = (registered.imports ?? []).filter(
      (i: any) => i.module === BullModule
    ) as any[];
    expect(queues).toHaveLength(1);
    expect(queues[0].providers.map((p: any) => p.provide)).toContain(
      getQueueToken(CYCLE_READY_QUEUE)
    );
  });

  it('the runner it builds is the Python one, set up from the config it read', () => {
    const registered = SensorsModule.register({
      ...ENABLED,
      SENSOR_PYTHON: 'python3.11',
      SENSOR_ENGINE_DIR: '/app/engine',
      SENSOR_WORKER_CONFIG: '/app/shadow.yaml',
    });
    const providers = registered.providers as any[];
    const config = providers.find((p) => p.provide === SENSOR_CONFIG).useValue;
    expect(config).toMatchObject({
      python: 'python3.11',
      engineDir: '/app/engine',
      workerConfigPath: '/app/shadow.yaml',
      retuningEnforced: false,
    });
    const factory = providers.find((p) => p.provide === CYCLE_RUNNER);
    expect(factory.inject).toEqual([SENSOR_CONFIG]);
    const runner = factory.useFactory(config) as PythonCycleRunner;
    expect(runner).toBeInstanceOf(PythonCycleRunner);
    expect(runner.args()).toEqual([
      '-B',
      '-m',
      'mcd_worker.cli',
      '--config',
      '/app/shadow.yaml',
    ]);
  });

  it('RETUNING is not enforced unless SENSOR_RETUNING_ENFORCED says exactly true', () => {
    const configOf = (env: NodeJS.ProcessEnv) =>
      (SensorsModule.register(env).providers as any[]).find(
        (p) => p.provide === SENSOR_CONFIG
      ).useValue;
    expect(configOf(ENABLED).retuningEnforced).toBe(false);
    expect(
      configOf({ ...ENABLED, SENSOR_RETUNING_ENFORCED: 'TRUE' })
        .retuningEnforced
    ).toBe(false);
    expect(
      configOf({ ...ENABLED, SENSOR_RETUNING_ENFORCED: 'true' })
        .retuningEnforced
    ).toBe(true);
  });

  it('enabled with a bad number refuses to start, loudly', () => {
    expect(() =>
      SensorsModule.register({
        ...ENABLED,
        SENSOR_MAX_JOB_AGE_SECONDS: 'banana',
      })
    ).toThrow(/SENSOR_MAX_JOB_AGE_SECONDS must be a positive whole number/);
  });
});

describe('the gateway’s AppModule', () => {
  it('imports the sensors module through register(), and with the variable unset that import is the empty module', () => {
    const imports: any[] = Reflect.getMetadata('imports', AppModule);
    const sensors = imports.filter((i) => i && i.module === SensorsModule);
    expect(sensors).toHaveLength(1);
    expect(sensors[0]).toEqual({ module: SensorsModule });
  });

  it('imports nothing else of the sensors directory: the one entry point is SensorsModule', () => {
    const source = fs.readFileSync(
      path.join(__dirname, '..', 'src', 'app.module.ts'),
      'utf8'
    );
    expect(source.match(/from '\.\/sensors\/[^']+'/g)).toEqual([
      "from './sensors/sensors.module'",
    ]);
    expect(source).toContain('SensorsModule.register(),');
  });
});

// ---------------------------------------------------------------- a real module graph with a fake queue

/** A queue that records what the Bull explorer asks of it, and talks to no Redis. */
function fakeQueue() {
  return {
    name: CYCLE_READY_QUEUE,
    process: jest.fn(),
    on: jest.fn(),
    add: jest.fn(),
    isReady: jest.fn().mockResolvedValue(undefined),
    close: jest.fn().mockResolvedValue(undefined),
  };
}

@Global()
@Module({
  providers: [{ provide: PrismaService, useValue: {} }],
  exports: [PrismaService],
})
class FakePrismaModule {}

async function boot(env: NodeJS.ProcessEnv) {
  const queue = fakeQueue();
  const moduleRef = await Test.createTestingModule({
    imports: [
      FakePrismaModule,
      BullModule.forRoot({ redis: 'redis://127.0.0.1:1' }),
      // the producer's registration, as WorkerModule has it: the queue exists whether or not the worker does
      BullModule.registerQueue({ name: CYCLE_READY_QUEUE }),
      SensorsModule.register(env),
    ],
  })
    .overrideProvider(getQueueToken(CYCLE_READY_QUEUE))
    .useValue(queue)
    .compile();
  await moduleRef.init();
  return { moduleRef, queue };
}

describe('in a real module graph with a Bull explorer', () => {
  it.each(OFF_VALUES.map((v) => [v] as const))(
    'with SENSOR_WORKER_ENABLED=%j nothing is registered on the queue and the worker’s parts do not exist',
    async (value) => {
      const { moduleRef, queue } = await boot(
        value === undefined ? {} : { SENSOR_WORKER_ENABLED: value }
      );
      try {
        expect(queue.process).not.toHaveBeenCalled();
        expect(queue.on).not.toHaveBeenCalled();
        for (const token of [
          CycleReadyProcessor,
          DatabaseInputsSource,
          McdOutputsWriter,
          EnvelopeValidator,
          INPUTS_SOURCE,
          CYCLE_RUNNER,
          SENSOR_CONFIG,
        ]) {
          expect(() => moduleRef.get(token, { strict: false })).toThrow();
        }
      } finally {
        await moduleRef.close();
      }
    }
  );

  it('with SENSOR_WORKER_ENABLED=true the explorer registers ONE consumer on the cycle-ready queue: the `cycle-ready` job, concurrency 1, and a failure listener', async () => {
    const { moduleRef, queue } = await boot(ENABLED);
    try {
      expect(queue.process).toHaveBeenCalledTimes(1);
      const [name, concurrency, handler] = queue.process.mock.calls[0];
      expect(name).toBe(CYCLE_READY_JOB);
      expect(concurrency).toBe(1);
      expect(typeof handler).toBe('function');
      expect(queue.on.mock.calls.map((c) => c[0])).toEqual(['failed']);
      const processor = moduleRef.get(CycleReadyProcessor, { strict: false });
      expect(processor).toBeInstanceOf(CycleReadyProcessor);
      expect(moduleRef.get(INPUTS_SOURCE, { strict: false })).toBeInstanceOf(
        DatabaseInputsSource
      );
      expect(moduleRef.get(CYCLE_RUNNER, { strict: false })).toBeInstanceOf(
        PythonCycleRunner
      );
    } finally {
      await moduleRef.close();
    }
  });
});

// ---------------------------------------------------------------- the source

describe('nothing but the sensors module can register the consumer', () => {
  const SRC = path.join(__dirname, '..', 'src');
  function files(dir: string): string[] {
    return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) return files(full);
      return entry.name.endsWith('.ts') ? [full] : [];
    });
  }
  const all = files(SRC).map((file) => ({
    name: path.relative(SRC, file).replace(/\\/g, '/'),
    text: fs.readFileSync(file, 'utf8'),
  }));
  const using = (needle: RegExp) =>
    all
      .filter((f) => needle.test(f.text))
      .map((f) => f.name)
      .sort();

  it('exactly one file declares a processor of the cycle-ready queue', () => {
    expect(using(/@Processor\(\s*CYCLE_READY_QUEUE\s*\)/)).toEqual([
      'sensors/cycle-ready.processor.ts',
    ]);
    expect(using(/@Processor\(\s*['"`]cycle-ready['"`]\s*\)/)).toEqual([]);
  });

  it('only the sensors module provides CycleReadyProcessor', () => {
    expect(using(/\bCycleReadyProcessor\b/)).toEqual([
      'sensors/cycle-ready.processor.ts',
      'sensors/sensors.module.ts',
    ]);
  });

  it('the only other users of the queue are its producer (the manifest service) and the module that registers it', () => {
    expect(using(/\bCYCLE_READY_QUEUE\b/)).toEqual([
      'sensors/cycle-ready.processor.ts',
      'sensors/sensors.module.ts',
      'worker/cycle-manifest.service.ts',
      'worker/cycle-queues.ts',
      'worker/worker.module.ts',
    ]);
  });

  it('the registration is inside the branch that checks the switch, after it returns the empty module', () => {
    const text = fs.readFileSync(
      path.join(SRC, 'sensors', 'sensors.module.ts'),
      'utf8'
    );
    const guard = text.indexOf('if (!sensorWorkerEnabled(env))');
    const registration = text.indexOf('CycleReadyProcessor,\n      ],');
    expect(guard).toBeGreaterThan(-1);
    expect(registration).toBeGreaterThan(guard);
    expect(text.slice(guard, text.indexOf('\n    }\n', guard))).toContain(
      'return { module: SensorsModule };'
    );
  });
});
