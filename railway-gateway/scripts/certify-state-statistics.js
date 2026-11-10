#!/usr/bin/env node
/**
 * Certify MCD state statistics (Stage B4, docs/runbooks/deploy-stack-d-step3.md §6,
 * STACK-D-ARCHITECTURE.md §2.8, ADR-022).
 *
 *   node scripts/certify-state-statistics.js --db [--last 1440] [--compare-drift]
 *   node scripts/certify-state-statistics.js --db --source point-in-time [--last 288]
 *   node scripts/certify-state-statistics.js --db --last 1440 --write
 *   node scripts/certify-state-statistics.js --file <path> [--json]
 *
 * Bridges the Python statistics engine (`python -B -m mcd_worker.tools.compute_statistics`)
 * and `StateStatisticsWriter.writeRows`. Supports stored B3 readings (`--source stored`) and
 * point-in-time replay over `market_data_point_in_time` (`snapshot_age_bars = 1`, `--source point-in-time`),
 * plus the forming-bar / refit drift check (`--compare-drift`).
 *
 * Dry-run by default (READ ONLY unless `--write` is passed with `--db`).
 */
'use strict';

require('ts-node/register/transpile-only');

const fs = require('fs');
const {
  CERTIFY_USAGE,
  parseCertifyArgs,
  runCertifyCommand,
} = require('../src/sensors/certify-state-statistics');

async function openDatabase() {
  if (!process.env.DATABASE_URL) {
    throw new Error(
      'DATABASE_URL is not set (the database to read/write, or use --file)'
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
  const options = parseCertifyArgs(process.argv.slice(2));
  if (options.error) {
    console.error(`${options.error}\n\n${CERTIFY_USAGE}`);
    process.exit(2);
  }
  if (options.help) {
    console.log(CERTIFY_USAGE);
    return;
  }
  const { text, exitCode } = await runCertifyCommand(options, {
    openDatabase,
    readFile: (file) => fs.readFileSync(file, 'utf8'),
  });
  console.log(text);
  process.exitCode = exitCode;
}

main().catch((error) => {
  console.error(`certify-state-statistics: ${error.message}`);
  process.exit(1);
});
