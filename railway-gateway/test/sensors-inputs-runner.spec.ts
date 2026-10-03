import { DatabaseInputsSource } from '../src/sensors/inputs/database-inputs.source';
import {
  FakeIndicators,
  FakeInputsPrisma,
  SeedPlan,
} from './helpers/inputs-world';
import { defineLoaderToRunnerScenarios } from './helpers/inputs-scenarios';
import { pythonAvailable } from './helpers/kit-runner';

/**
 * The database loader into the real Python runner, on an in-memory stand-in for Prisma
 * (so it runs wherever Python 3 with PyYAML and jsonschema is installed, no database
 * needed). The same scenarios run on a real PostgreSQL in test/sensors-inputs.pg.spec.ts.
 * Skipped without Python.
 */
const suite = pythonAvailable() ? describe : describe.skip;

suite('the database loader into the runner, in memory', () => {
  defineLoaderToRunnerScenarios({
    async open(plan: SeedPlan) {
      const prisma = new FakeInputsPrisma().apply(plan);
      return new DatabaseInputsSource(
        prisma.asPrisma(),
        FakeIndicators.fromPlan(plan).asService()
      );
    },
  });
});
