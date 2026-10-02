#!/usr/bin/env node
/**
 * Copies gateway_contract_symbol_specs.schema.json into the gateway package.
 *
 * The contract is OWNED by the VPS side (backend-stack-c), next to the exporter,
 * the collector and the push worker that are tested against it. The gateway keeps
 * a copy inside this package, as it does for the cycle manifest, because Railway
 * builds from this directory only: a path into ../backend-stack-c would not exist
 * there.
 *
 * test/symbol-specs-contract.spec.ts fails if the two ever differ, and says to
 * re-run this script:
 *
 *   npm run sync:symbol-specs-contract
 */
const fs = require('fs');
const path = require('path');

const SOURCE = path.join(
  __dirname,
  '../../backend-stack-c/1_EA-and-backfill-worker-on-contabo-vps/v2_29_data_pipeline_architecture/gateway_contract_symbol_specs.schema.json'
);
const TARGET = path.join(
  __dirname,
  '../src/symbol-specs/symbol-specs.schema.json'
);

fs.copyFileSync(SOURCE, TARGET);
console.log(`copied ${path.relative(process.cwd(), SOURCE)}`);
console.log(`    to ${path.relative(process.cwd(), TARGET)}`);
