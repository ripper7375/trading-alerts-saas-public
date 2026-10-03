#!/usr/bin/env node
/**
 * Copies mcd-output-1.schema.json (the MCD output envelope, `mcd-output/1`) into the gateway package.
 *
 * The schema is OWNED by the MCD kit (`davintrade-stack-d-and-e/engine-1-5-new/mcd_common/`), next to the
 * evaluators that produce envelopes and the Python tests that pin them. The sensor worker validates
 * every envelope against a copy kept inside this package because Railway builds from this directory
 * only: a path into ../davintrade-stack-d-and-e would not exist at runtime.
 *
 * test/sensors-envelope-validator.spec.ts fails if the two ever differ, and says to re-run this script:
 *
 *   npm run sync:mcd-output-schema
 */
const fs = require('fs');
const path = require('path');

const SOURCE = path.join(
  __dirname,
  '../../davintrade-stack-d-and-e/engine-1-5-new/mcd_common/mcd-output-1.schema.json'
);
const TARGET = path.join(__dirname, '../src/sensors/mcd-output-1.schema.json');

fs.copyFileSync(SOURCE, TARGET);
console.log(`copied ${path.relative(process.cwd(), SOURCE)}`);
console.log(`    to ${path.relative(process.cwd(), TARGET)}`);
