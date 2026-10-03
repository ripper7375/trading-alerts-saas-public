import { DynamicModule, Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { CycleReadModule } from '../cycle/read/cycle-read.module';
import { CYCLE_READY_QUEUE } from '../worker/cycle-queues';
import { CycleReadyProcessor, INPUTS_SOURCE } from './cycle-ready.processor';
import { EnvelopeValidator } from './envelope-validator';
import { DatabaseInputsSource } from './inputs/database-inputs.source';
import { McdOutputsWriter } from './mcd-outputs.writer';
import { CYCLE_RUNNER, PythonCycleRunner } from './python-runner';
import {
  SENSOR_CONFIG,
  SensorConfig,
  readSensorConfig,
  sensorWorkerEnabled,
} from './sensor-config';

/**
 * The sensor worker (STACK-D-ARCHITECTURE.md chapter 2, build step 3 part 4).
 *
 * A DYNAMIC module on purpose: `SensorsModule.register()` gives back an EMPTY module, with no
 * import, no provider, no queue and no consumer, unless the environment says exactly
 * `SENSOR_WORKER_ENABLED=true`. Anything else, including a typo, leaves the gateway as it was
 * before this module existed: the `cycle-ready` jobs wait in Redis and nothing reads the inputs,
 * starts Python or writes `mcd_outputs`. Flipping the variable off and redeploying is the
 * rollback. (test/sensors-disabled-consumes-nothing.spec.ts pins all of this.)
 *
 * When enabled it registers ONE consumer of the `cycle-ready` queue (`CycleReadyProcessor`),
 * with the database as its source of inputs, the Python runner as its evaluator, the envelope
 * validator and the writer. Which MCDs run is decided by the runner's worker configuration
 * (`worker_config.yaml`, every flag `off` until a person turns one on), not by this module.
 *
 * Deploy note (phase B0): Python 3.11 with PyYAML and jsonschema, and the engine folder, must be
 * in the Railway image, and `SENSOR_ENGINE_DIR` must name it. None of that is done here.
 */
@Module({})
export class SensorsModule {
  /** `env` is injectable so a spec can ask what any value of the variable does without touching the process. */
  static register(env: NodeJS.ProcessEnv = process.env): DynamicModule {
    if (!sensorWorkerEnabled(env)) {
      return { module: SensorsModule };
    }
    const config: SensorConfig = readSensorConfig(env);
    return {
      module: SensorsModule,
      imports: [
        BullModule.registerQueue({ name: CYCLE_READY_QUEUE }),
        // ActiveIndicatorService, for the setting at the slot. PrismaModule is global.
        CycleReadModule,
      ],
      providers: [
        { provide: SENSOR_CONFIG, useValue: config },
        DatabaseInputsSource,
        { provide: INPUTS_SOURCE, useExisting: DatabaseInputsSource },
        {
          provide: CYCLE_RUNNER,
          useFactory: (settings: SensorConfig) =>
            new PythonCycleRunner(settings),
          inject: [SENSOR_CONFIG],
        },
        EnvelopeValidator,
        McdOutputsWriter,
        CycleReadyProcessor,
      ],
    };
  }
}
