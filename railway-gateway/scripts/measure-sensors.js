#!/usr/bin/env node
/**
 * Measure the sensor worker on real cycles (build step 3 part 7, STACK-D-ARCHITECTURE.md 2.11,
 * standard 11.2; the live use is Phase B, steps B1 to B3).
 *
 *   node scripts/measure-sensors.js --db   [--last 576] [--jobs jobs.json | --redis] [--replay 3]
 *   node scripts/measure-sensors.js --file sensors.json
 *
 * Reads mcd_outputs and the READY market_cycles rows and prints the mix of readings per MCD, how
 * often MCD0 flags M5, M15 and both, the EVALUATOR_ERROR count, what the output guards recorded,
 * how long each MCD and the whole cycle took against the 1 s and 30 s budgets, how many rows each
 * cycle has, how many jobs the worker skipped, whether a replay of stored cycles reproduces them,
 * and whether the MCD0 marks on the channel MCDs agree with MCD0's own reading.
 *
 * READ ONLY. `--db` runs SELECTs against the database named by DATABASE_URL (from a laptop that is
 * the public URL: `railway run` injects the private one, which only resolves inside Railway);
 * `--redis` runs three read commands (ZREVRANGE, HGET, ZCARD) against REDIS_URL; `--replay N` runs
 * the same read-only replay as scripts/replay-cycle.js on the newest N cycles (it needs Python with
 * PyYAML and jsonschema and the engine folder: SENSOR_PYTHON, SENSOR_ENGINE_DIR); `--file` reads a
 * JSON file and touches nothing. All the logic is in src/sensors/measure-sensors.ts, which has its
 * own tests; this file only wires the command line to it. TypeScript is loaded straight from src/
 * with ts-node (a dev dependency), so run it from a checkout with `npm install` done, not from the
 * deployed build.
 *
 * Exit status: 0 the report was printed; 1 an error, or a finding with --strict; 2 the arguments are wrong.
 */
'use strict';

require('ts-node/register/transpile-only');

const fs = require('fs');
const {
  USAGE,
  parseArgs,
  redisJobReader,
  runMeasureCommand,
} = require('../src/sensors/measure-sensors');

async function openDatabase() {
  if (!process.env.DATABASE_URL) {
    throw new Error(
      'DATABASE_URL is not set (the database to read, or use --file)'
    );
  }
  const { PrismaClient } = require('@prisma/client');
  const { PrismaPg } = require('@prisma/adapter-pg');
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
  });
  return { database: prisma, close: () => prisma.$disconnect() };
}

async function openQueue() {
  if (!process.env.REDIS_URL) {
    throw new Error(
      'REDIS_URL is not set (--redis reads the cycle-ready queue)'
    );
  }
  const Redis = require('ioredis');
  const redis = new Redis(process.env.REDIS_URL, { lazyConnect: false });
  return {
    queue: redisJobReader(redis),
    close: async () => {
      await redis.quit();
    },
  };
}

/** The same read-only replay as scripts/replay-cycle.js, for the slots the measurement picked. */
async function replaySlots(database, symbol, slots) {
  const { CycleReplayer, loadStoredCycle } = require('../src/sensors/replay');
  const { readSensorConfig } = require('../src/sensors/sensor-config');
  const config = readSensorConfig(process.env);
  const replayer = new CycleReplayer({
    python: config.python,
    engineDir: config.engineDir,
    runnerTimeoutMs: config.runnerTimeoutMs,
  });
  const reports = [];
  for (const slot of slots) {
    reports.push(
      await replayer.replay(await loadStoredCycle(database, symbol, slot))
    );
  }
  return reports;
}

function envelopeScanner() {
  const { EnvelopeValidator } = require('../src/sensors/envelope-validator');
  const validator = new EnvelopeValidator();
  return (envelopeJson) => {
    const check = validator.check(envelopeJson);
    return check.ok ? [] : check.problems;
  };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.error) {
    console.error(`${options.error}\n\n${USAGE}`);
    process.exit(2);
  }
  if (options.help) {
    console.log(USAGE);
    return;
  }
  const { text, exitCode } = await runMeasureCommand(options, {
    readFile: (file) => fs.readFileSync(file, 'utf8'),
    openDatabase,
    openQueue,
    replaySlots,
    scan: envelopeScanner(),
  });
  console.log(text);
  process.exitCode = exitCode;
}

main().catch((error) => {
  console.error(`measure-sensors: ${error.message}`);
  process.exit(1);
});
