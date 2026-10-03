#!/usr/bin/env node
/**
 * Replay a stored cycle and check that it gives the same readings (build step 3 part 5,
 * STACK-D-ARCHITECTURE.md 2.2 point 6).
 *
 *   node scripts/replay-cycle.js --fixtures
 *   node scripts/replay-cycle.js --fixtures --slot 2026-09-18T20:55Z
 *   node scripts/replay-cycle.js --db --slot 2026-10-05T14:15Z [--slot ...] [--json]
 *
 * Reads the stored bundle (market_cycle_inputs) and the stored readings (mcd_outputs) of a
 * slot, or the stored fixture cycles of the Python runner, runs `python -m mcd_worker.cli`
 * on the bundle with the flags and the RETUNING enforcement the readings were made under,
 * and compares every envelope with the stored one, byte for byte. Each cycle ends in one
 * verdict: VERIFIED, TAMPERED_BUNDLE, STORED_READING_CORRUPT, VERSION_MISMATCH,
 * LOGIC_DIVERGENCE or NOT_REPLAYABLE (`--help` says what each means).
 *
 * READ ONLY. `--db` runs two SELECTs per slot against the database named by DATABASE_URL (from
 * a laptop that is the public URL: `railway run` injects the private one, which only resolves
 * inside Railway) and nothing else; `--fixtures` touches no database. All the logic is in
 * src/sensors/replay.ts, which has its own tests; this file only wires the command line to it.
 * TypeScript is loaded straight from src/ with ts-node (a dev dependency), so run it from a
 * checkout with `npm install` done, not from the deployed build. Python 3 with PyYAML and
 * jsonschema must be on the PATH (SENSOR_PYTHON names another interpreter).
 *
 * Exit status: 0 every cycle VERIFIED; 1 a difference was found; 2 a cycle could not be
 * replayed or the arguments are wrong.
 */
'use strict';

require('ts-node/register/transpile-only');

const {
  REPLAY_USAGE,
  parseReplayArgs,
  runReplayCommand,
} = require('../src/sensors/replay');

async function openDatabase() {
  if (!process.env.DATABASE_URL) {
    throw new Error(
      'DATABASE_URL is not set (the database to read, or use --fixtures)'
    );
  }
  const { PrismaClient } = require('@prisma/client');
  const { PrismaPg } = require('@prisma/adapter-pg');
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
  });
  return { database: prisma, close: () => prisma.$disconnect() };
}

async function main() {
  const options = parseReplayArgs(process.argv.slice(2));
  if (options.error) {
    console.error(`${options.error}\n\n${REPLAY_USAGE}`);
    process.exit(2);
  }
  if (options.help) {
    console.log(REPLAY_USAGE);
    return;
  }
  const { text, exitCode } = await runReplayCommand(options, { openDatabase });
  console.log(text);
  process.exitCode = exitCode;
}

main().catch((error) => {
  console.error(`replay-cycle: ${error.message}`);
  process.exit(2);
});
