#!/usr/bin/env node
/**
 * Copies syn-output-1.schema.json (the SYN reading, `syn-output/1`) into the gateway package.
 *
 * The schema is OWNED by the synthesis engine (`davintrade-stack-d-and-e/engine-1-5-new/mcd_worker/synthesis/`),
 * next to the rules and the Python tests that pin it. The sensor worker validates every SYN reading against a
 * copy kept inside this package because Railway builds from this directory only: a path into
 * ../davintrade-stack-d-and-e would not exist at runtime. (The Python runner has its own copy of the same
 * file inside `sensors/`, put there by `npm run sync:sensor-kit`.)
 *
 * test/sensors-syn-validator.spec.ts fails if the two ever differ, and says to re-run this script:
 *
 *   npm run sync:syn-output-schema
 */
const fs = require('fs');
const path = require('path');

const SOURCE = path.join(
  __dirname,
  '../../davintrade-stack-d-and-e/engine-1-5-new/mcd_worker/synthesis/syn-output-1.schema.json'
);
const TARGET = path.join(__dirname, '../src/sensors/syn-output-1.schema.json');

fs.copyFileSync(SOURCE, TARGET);
console.log(`copied ${path.relative(process.cwd(), SOURCE)}`);
console.log(`    to ${path.relative(process.cwd(), TARGET)}`);
