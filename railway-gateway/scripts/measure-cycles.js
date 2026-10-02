#!/usr/bin/env node
/**
 * Measure real cycles (build step 2 part 10, STACK-D-ARCHITECTURE.md 1.8).
 *
 *   node scripts/measure-cycles.js --db   [--symbol XAUUSD] [--last 576]
 *   node scripts/measure-cycles.js --file cycles.json
 *
 * Reads market_cycles and prints how long cycles really took (slot to ready, the
 * manifest's arrival, the gateway's own time), how old the newest bar was at the
 * slot, and how the cycles split into FRESH, DELAYED, INCOMPLETE and RETUNING.
 *
 * READ ONLY. `--db` runs one SELECT against the database named by DATABASE_URL (run
 * it with `railway run` for the production one) and nothing else; `--file` reads a
 * JSON file and touches no database. All the logic is in src/cycle/measure-cycles.ts,
 * which has its own tests; this file only wires the command line to it. TypeScript
 * is loaded straight from src/ with ts-node (a dev dependency), so run it from a
 * checkout with `npm install` done, not from the deployed build.
 */
'use strict';

require('ts-node/register/transpile-only');

const fs = require('fs');
const {
  USAGE,
  formatReport,
  loadRows,
  measureCycles,
  parseArgs,
  parseRowsJson,
} = require('../src/cycle/measure-cycles');

async function readRows(options) {
  if (options.file !== null) {
    const rows = parseRowsJson(fs.readFileSync(options.file, 'utf8'));
    return rows.filter((r) => !r.symbol || r.symbol === options.symbol);
  }
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is not set (use `railway run`, or --file)');
  }
  const { PrismaClient } = require('@prisma/client');
  const { PrismaPg } = require('@prisma/adapter-pg');
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
  });
  try {
    return await loadRows(prisma, options);
  } finally {
    await prisma.$disconnect();
  }
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
  const report = measureCycles(await readRows(options));
  console.log(
    options.json ? JSON.stringify(report, null, 2) : formatReport(report)
  );
}

main().catch((error) => {
  console.error(`measure-cycles: ${error.message}`);
  process.exit(1);
});
